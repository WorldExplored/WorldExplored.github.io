'use client';

// Retained Three.js materials are updated only by frame callbacks.
/* eslint-disable react-hooks/immutability */

import { measureConstruction } from './renderDiagnostics';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { BufferGeometry, CatmullRomCurve3, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshPhysicalMaterial, Object3D, Shape, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cityBuildings, createCityTransitRoute, writeCityTransitPose, type CityTransitRoute, type CityBuilding } from './city';
import { terrainHeight } from './terrain';
import type { EnvironmentProps } from './Water';
import { StationAccess } from './StationAccess';
import { CityLife } from './CityLife';
import { buildCityArchitecture, type CityRoomView, type CityFinish, type CityLiftPlan, type CityInteriorRecipe, type CityAdd } from './CityArchitecture';

import { createCityLift } from './CityLift';
import { applySurface } from './surfaceMaterials';
import { emitTechnologySound } from './coastalAudio';

type Finish = CityFinish;
interface Part { geometry: BufferGeometry; building: string }
interface CityPartRange { building: string; start: number; count: number }
interface DeferredCityInterior { building: Readonly<CityBuilding>; recipes: CityInteriorRecipe[]; object?: Group }

function roundedBox(width: number, height: number, depth: number, corner = .25) {
  const radius = Math.min(corner, width / 2, depth / 2);
  const x = width / 2; const z = depth / 2;
  const shape = new Shape();
  shape.moveTo(-x + radius, -z); shape.lineTo(x - radius, -z); shape.quadraticCurveTo(x, -z, x, -z + radius);
  shape.lineTo(x, z - radius); shape.quadraticCurveTo(x, z, x - radius, z); shape.lineTo(-x + radius, z); shape.quadraticCurveTo(-x, z, -x, z - radius);
  shape.lineTo(-x, -z + radius); shape.quadraticCurveTo(-x, -z, -x + radius, -z);
  const bevel = Math.min(.035, height / 4);
  const geometry = new ExtrudeGeometry(shape, { depth: height - bevel * 2, steps: 1, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 5 });
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, bevel, 0);
  return geometry;
}

function arch(points: Vector3[], radius = .065, segments = 28) {
  return new TubeGeometry(new CatmullRomCurve3(points), segments, radius, 7, false);
}

function finishSurface(material: MeshPhysicalMaterial, finish: Finish) {
  if (finish === 'stone' || finish === 'porcelain') applySurface(material, 'mineral', 1.5);
  if (finish === 'wood') applySurface(material, 'cedar', 1.2);
  return material;
}

function makeFinishes() {
  return {
    porcelain: new MeshPhysicalMaterial({ color: '#edf6ef', roughness: .62, metalness: .025, clearcoat: .12, clearcoatRoughness: .3 }),
    glass: new MeshPhysicalMaterial({ color: '#126681', roughness: .17, metalness: .03, transparent: true, opacity: .28, depthWrite: false, side: DoubleSide }),
    aqua: new MeshPhysicalMaterial({ color: '#067eae', roughness: .25, metalness: .20, clearcoat: .65, clearcoatRoughness: .18 }),
    garden: new MeshPhysicalMaterial({ color: '#3c922f', side: DoubleSide, roughness: .93, metalness: 0, envMapIntensity: .15 }),
    window: new MeshPhysicalMaterial({ color: '#3187a4', roughness: .12, metalness: .05, transparent: true, opacity: .25, depthWrite: false, side: DoubleSide }),
    stone: new MeshPhysicalMaterial({ color: '#a3b9b5', roughness: .91, metalness: 0 }),
    wood: new MeshPhysicalMaterial({ color: '#986345', roughness: .76, metalness: 0 }),
    fabric: new MeshPhysicalMaterial({ color: '#1262c4', roughness: 1, metalness: 0 }),
    metal: new MeshPhysicalMaterial({ color: '#244f64', roughness: .46, metalness: .6 }),
  };
}

function makeStaticCity(route: CityTransitRoute, materials: ReturnType<typeof makeFinishes>) {
  const parts: Record<Finish, Part[]> = { porcelain: [], glass: [], aqua: [], garden: [], window: [], stone: [], wood: [], fabric: [], metal: [] };
  const placement = new Object3D();
  const local = new Object3D();
  const matrix = new Matrix4();
  let owner = '';
  function add(geometry: BufferGeometry, finish: Finish, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rotation = 0) {
    local.position.set(x, y, z); local.scale.set(sx, sy, sz); local.rotation.set(0, rotation, 0); local.updateMatrix();
    matrix.multiplyMatrices(placement.matrix, local.matrix); geometry.applyMatrix4(matrix);
    const plain = geometry.index ? geometry.toNonIndexed() : geometry;
    if (plain !== geometry) geometry.dispose();
    for (const name of Object.keys(plain.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') plain.deleteAttribute(name);
    if (!plain.getAttribute('uv')) {
      const p=plain.getAttribute('position'),uv=new Float32Array(p.count*2);
      for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i);uv[i*2+1]=p.getY(i)+p.getZ(i);}
      plain.setAttribute('uv',new Float32BufferAttribute(uv,2));
    }
    parts[finish].push({ geometry: plain, building: owner });
  }
  const roomViews: CityRoomView[] = [];
  const liftPlans: CityLiftPlan[] = [];
  const interiors: DeferredCityInterior[] = [];
  for (const building of cityBuildings) {
    owner = building.id;
    placement.position.set(building.x, terrainHeight(building.x, building.z), building.z); placement.rotation.set(0, building.rotation, 0); placement.scale.set(1, 1, 1); placement.updateMatrix();
    const interior: DeferredCityInterior = { building, recipes: [] };
    roomViews.push(...buildCityArchitecture(building, add, plan => liftPlans.push(plan), recipe => interior.recipes.push(recipe)));
    interiors.push(interior);
  }
  owner = '';
  placement.position.set(0, 0, 0); placement.rotation.set(0, 0, 0); placement.updateMatrix();
  const center = new Vector3(); const ahead = new Vector3(); const tangent = new Vector3();
  const rails: Vector3[][] = [[], []];
  const deck: number[] = []; const indices: number[] = [];
  for (let index = 0; index <= 256; index++) {
    const progress = index / 256;
    route.curve.getPointAt(progress, center); route.curve.getPointAt((progress + .0001) % 1, ahead); tangent.subVectors(ahead, center).normalize();
    const nx = tangent.z; const nz = -tangent.x;
    for (const [edge, height] of [[-.50, -.10], [.50, -.10], [-.50, .03], [.50, .03]]) deck.push(center.x + nx * edge, center.y + height, center.z + nz * edge);
    for (let rail = 0; rail < 2; rail++) rails[rail].push(new Vector3(center.x + nx * (rail ? .32 : -.32), center.y + .09, center.z + nz * (rail ? .32 : -.32)));
    if (index < 256) { const n = index * 4; indices.push(n + 2, n + 6, n + 3, n + 3, n + 6, n + 7, n, n + 1, n + 4, n + 1, n + 5, n + 4, n, n + 4, n + 2, n + 2, n + 4, n + 6, n + 1, n + 3, n + 5, n + 3, n + 7, n + 5); }
  }
  const deckGeometry = new BufferGeometry(); deckGeometry.setAttribute('position', new Float32BufferAttribute(deck, 3)); deckGeometry.setIndex(indices); deckGeometry.computeVertexNormals(); add(deckGeometry, 'porcelain');
  for (const rail of rails) add(arch(rail, .043, 256), 'aqua');
  for (let support = 0; support < 20; support++) {
    route.curve.getPointAt(support / 20, center); route.curve.getPointAt((support / 20 + .001) % 1, ahead); tangent.subVectors(ahead, center).normalize();
    const floor = Math.min(terrainHeight(center.x, center.z), 1.1) - .15;
    // Rail piers are tapered structural supports, not decorative freestanding loops.
    const pier=new BufferGeometry();
    const base=floor,top=center.y-.13,wide=.32,narrow=.17;
    const p:number[]=[],ix:number[]=[];
    for(const [y,r] of [[base,wide],[top,narrow]])for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]])p.push(center.x+a*r,y,center.z+b*r);
    for(let side=0;side<4;side++){const j=(side+1)%4;ix.push(side,j,side+4,j,j+4,side+4);}
    pier.setAttribute('position',new Float32BufferAttribute(p,3));pier.setIndex(ix);pier.computeVertexNormals();add(pier,'stone');
  }
  const groups = new Map<string, Group>();
  for (const finish of Object.keys(parts) as Finish[]) {
    for (const building of ['', ...cityBuildings.map(item => item.id)]) {
      const bucket = parts[finish].filter(part => part.building === building);
      if (!bucket.length) continue;
      const geometry = mergeGeometries(bucket.map(part => part.geometry))!;
      const ranges: CityPartRange[] = []; let offset = 0;
      for (const part of bucket) { const count = part.geometry.attributes.position.count; if (building) ranges.push({ building, start: offset, count }); offset += count; part.geometry.dispose(); }
      geometry.userData.buildingRanges = ranges; geometry.userData.roomViews = roomViews;
      geometry.computeBoundingSphere();
      let group = groups.get(building);
      if (!group) { group = new Group(); group.name = building ? `city-building-${building}` : 'city-transit-structure'; group.userData.building = building; groups.set(building, group); }
      const material = building && ['window', 'aqua', 'porcelain'].includes(finish) ? materials[finish].clone() : materials[finish];
      // Families differ through structure and use, never alternating facade paint.
      finishSurface(material, finish);
      if (material !== materials[finish] && finish !== 'porcelain') { material.emissive.set('#11c8e0'); material.emissiveIntensity=0; material.userData.hoverResponse = true; }
      const mesh = new Mesh(geometry, material); mesh.name = `eco-city-${building || 'transit'}-${finish}`;
      mesh.castShadow = !material.transparent; mesh.receiveShadow = true; group.add(mesh);
    }
  }
  // Deferred recipes retain the collector closure; release its disposed source arrays.
  for(const bucket of Object.values(parts))bucket.length=0;
  const lifts = liftPlans.map(plan => {
    const lift = createCityLift(plan), building = cityBuildings.find(item => item.id === plan.building)!;
    const frame = new Group(); frame.position.set(building.x, terrainHeight(building.x, building.z), building.z); frame.rotation.y = building.rotation;
    frame.add(lift.cabin); groups.get(building.id)!.add(frame); lift.update(0); return lift;
  });
  return { groups: [...groups.values()], lifts, interiors };
}

function constructCityInterior(entry: DeferredCityInterior, materials: ReturnType<typeof makeFinishes>) {
  const root = new Group(); root.name = `city-interior-${entry.building.id}`;
  const buckets = new Map<Finish, BufferGeometry[]>(), local = new Object3D(), placement = new Object3D(), matrix = new Matrix4();
  const building = entry.building;
  placement.position.set(building.x, terrainHeight(building.x,building.z), building.z);
  placement.rotation.y = building.rotation; placement.updateMatrix();
  const add: CityAdd = (geometry,finish,x=0,y=0,z=0,sx=1,sy=1,sz=1,rotation=0) => {
    local.position.set(x,y,z);local.scale.set(sx,sy,sz);local.rotation.set(0,rotation,0);local.updateMatrix();
    geometry.applyMatrix4(matrix.multiplyMatrices(placement.matrix,local.matrix));
    const plain=geometry.index?geometry.toNonIndexed():geometry;
    if(plain!==geometry)geometry.dispose();
    for(const name of Object.keys(plain.attributes))if(!['position','normal','uv'].includes(name))plain.deleteAttribute(name);
    if(!plain.getAttribute('uv')) {
      const p=plain.getAttribute('position'),uv=new Float32Array(p.count*2);
      for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i);uv[i*2+1]=p.getY(i)+p.getZ(i);}
      plain.setAttribute('uv',new Float32BufferAttribute(uv,2));
    }
    const bucket=buckets.get(finish)??[];bucket.push(plain);buckets.set(finish,bucket);
  };
  entry.recipes.forEach(recipe=>recipe(add));
  entry.recipes.length=0;
  for(const [finish,parts] of buckets) {
    const geometry=mergeGeometries(parts)!;parts.forEach(part=>part.dispose());geometry.computeBoundingSphere();
    const mesh=new Mesh(geometry,finishSurface(materials[finish],finish));
    mesh.name=`city-interior-${building.id}-${finish}`;mesh.receiveShadow=true;mesh.raycast=()=>{};root.add(mesh);
  }
  return root;
}

/** One nearest building per frame bounds close-detail construction; hysteresis avoids edge flicker. */
function updateCityInteriors(city: ReturnType<typeof makeCity>, camera: Vector3, quality: EnvironmentProps['quality']) {
  const enter=quality==='high'?55:quality==='medium'?45:32, exit=quality==='high'?70:quality==='medium'?58:44;
  let nearest: DeferredCityInterior | undefined, nearestDistance=Infinity, waiting=0;
  for(const interior of city.interiors) {
    const building=interior.building;
    const distance=Math.hypot(camera.x-building.x,camera.z-building.z,Math.max(0,camera.y-building.height));
    if(interior.object) {
      interior.object.visible=distance<(interior.object.visible?exit:enter);
    } else if(distance<enter) {
      waiting++;
      if(distance<nearestDistance){nearest=interior;nearestDistance=distance;}
    }
  }
  if(nearest) {
    nearest.object=measureConstruction('city-interior',()=>constructCityInterior(nearest,city.materials));
    city.buildings.find(group=>group.userData.building===nearest.building.id)!.add(nearest.object);
  }
  return waiting>1;
}

function makeCarriage(materials: ReturnType<typeof makeFinishes>) {
  const body = roundedBox(.72, .53, 1.65, .32);
  const roof = roundedBox(.67, .09, 1.53, .30); roof.translate(0, .54, 0);
  const bodyGeometry = mergeGeometries([body, roof])!; body.dispose(); roof.dispose();
  const window = roundedBox(.735, .22, 1.57, .32); window.translate(0, .29, 0);
  const group = new Group();
  const shell = new Mesh(bodyGeometry, materials.porcelain); shell.castShadow = true;
  group.add(shell, new Mesh(window, materials.window));
  return group;
}

function makeCity() {
  const route = createCityTransitRoute();
  const materials = makeFinishes();
  const architecture = makeStaticCity(route, materials);
  const buildings = architecture.groups, lifts = architecture.lifts;
  const carriage = makeCarriage(materials);
  const cars = [carriage, carriage.clone()];
  cars[0].name = 'city-monorail-front'; cars[1].name = 'city-monorail-rear';
  const resources = { route, materials, buildings, lifts, interiors: architecture.interiors, cars, position: new Vector3(), tangent: new Vector3(), disposeTimer: undefined as ReturnType<typeof setTimeout> | undefined };
  updateCityTransit(resources, 0);
  return resources;
}

function updateCityTransit(city: ReturnType<typeof makeCity>, elapsed: number) {
  city.lifts.forEach((lift,index)=>{
    if(lift.update(elapsed+index*1.7).arrived) {
      lift.cabin.getWorldPosition(city.position);emitTechnologySound('arrival',city.position.toArray());
    }
  });
  for (let index = 0; index < city.cars.length; index++) {
    writeCityTransitPose(city.route, elapsed, index, city.position, city.tangent);
    city.cars[index].position.copy(city.position);
    city.cars[index].rotation.y = Math.atan2(city.tangent.x, city.tangent.z);
  }
}

function retainCity(city: ReturnType<typeof makeCity>) {
  clearTimeout(city.disposeTimer);
  return () => {
    // A replayed Strict Mode effect retains the same mounted scene resources.
    city.disposeTimer = setTimeout(() => {
      city.lifts.forEach(lift => { lift.dispose(); lift.cabin.removeFromParent(); });
      for (const group of city.buildings) group.traverse(object => { if (object instanceof Mesh) { object.geometry.dispose(); const material = object.material as MeshPhysicalMaterial; if (!Object.values(city.materials).includes(material)) material.dispose(); } });
      city.cars[0].traverse(object => { if (object instanceof Mesh) object.geometry.dispose(); });
      for (const material of Object.values(city.materials)) material.dispose();
    }, 0);
  };
}

export function EcoCity({ runtime, paused, quality }: EnvironmentProps) {
  const city = useMemo(() => measureConstruction('city', () => makeCity()), []);
  useEffect(() => retainCity(city), [city]);
  useFrame(({camera,invalidate}) => {
    if(updateCityInteriors(city,camera.position,quality))invalidate();
    if(!paused)updateCityTransit(city,runtime.current.elapsed);
  });
  return <group name="coastal-eco-city" dispose={null}>
    {city.buildings.map(group => <CityBuildingBoundary object={group} paused={paused} key={group.uuid} />)}
    {city.cars.map(car => <primitive object={car} key={car.uuid} />)}
    <StationAccess />
    <CityLife runtime={runtime} paused={paused} quality={quality} route={city.route} />
  </group>;
}

function CityBuildingBoundary({ object, paused }: { object: Group; paused: boolean }) {
  const hover = useRef(false), exit = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const invalidate = useThree(state => state.invalidate);
  const materials = useMemo(() => object.children.flatMap(child => { const material = (child as Mesh).material as MeshPhysicalMaterial; return material?.userData.hoverResponse ? [material] : []; }), [object]);
  useEffect(() => () => clearTimeout(exit.current), []);
  useFrame((_, delta) => { for (const material of materials) material.emissiveIntensity += ((hover.current ? .13 : 0) - material.emissiveIntensity) * (paused ? 1 : 1 - Math.exp(-12 * delta)); });
  const enter = (event: ThreeEvent<PointerEvent>) => { if (!object.userData.building) return; event.stopPropagation(); clearTimeout(exit.current); hover.current = event.pointerType !== 'touch'; invalidate(); };
  return <primitive object={object} onPointerOver={enter} onPointerMove={enter} onPointerOut={() => { clearTimeout(exit.current); exit.current = setTimeout(() => { hover.current = false; invalidate(); }, 120); }} />;
}
