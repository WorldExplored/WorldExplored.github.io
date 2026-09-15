'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, BufferGeometry, CatmullRomCurve3, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshPhysicalMaterial, Object3D, Shape, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cityBuildings, createCityTransitRoute, writeCityTransitPose, type CityBuilding, type CityTransitRoute } from './city';
import { terrainHeight } from './terrain';
import type { EnvironmentProps } from './Water';
import { CityLife } from './CityLife';

type Finish = 'porcelain' | 'glass' | 'aqua' | 'garden' | 'window';
interface Part { geometry: BufferGeometry; building: string }
interface CityPartRange { building: string; start: number; count: number }

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

function makeFinishes() {
  return {
    porcelain: new MeshPhysicalMaterial({ color: '#f5fff4', roughness: .26, metalness: .04, clearcoat: .8, clearcoatRoughness: .18 }),
    glass: new MeshPhysicalMaterial({ color: '#1fadc3', roughness: .18, metalness: .05, clearcoat: 1, clearcoatRoughness: .12, envMapIntensity: .55 }),
    aqua: new MeshPhysicalMaterial({ color: '#56e4ee', roughness: .28, metalness: .03, clearcoat: .75 }),
    garden: new MeshPhysicalMaterial({ color: '#429a08', roughness: .9, metalness: 0, envMapIntensity: .15 }),
    window: new MeshPhysicalMaterial({ color: '#277f94', roughness: .18, metalness: .05, clearcoat: .9, side: DoubleSide }),
  };
}

function makeStaticCity(route: CityTransitRoute, materials: ReturnType<typeof makeFinishes>) {
  const parts: Record<Finish, Part[]> = { porcelain: [], glass: [], aqua: [], garden: [], window: [] };
  const placement = new Object3D();
  const local = new Object3D();
  const matrix = new Matrix4();
  let owner = '';
  function add(geometry: BufferGeometry, finish: Finish, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rotation = 0) {
    local.position.set(x, y, z); local.scale.set(sx, sy, sz); local.rotation.set(0, rotation, 0); local.updateMatrix();
    matrix.multiplyMatrices(placement.matrix, local.matrix); geometry.applyMatrix4(matrix);
    const plain = geometry.index ? geometry.toNonIndexed() : geometry;
    if (plain !== geometry) geometry.dispose();
    for (const name of Object.keys(plain.attributes)) if (name !== 'position' && name !== 'normal') plain.deleteAttribute(name);
    parts[finish].push({ geometry: plain, building: owner });
  }
  function planter(width: number, x: number, y: number, z: number) {
    add(roundedBox(width, .15, .38, .12), 'porcelain', x, y, z);
    add(roundedBox(width - .10, .07, .28, .10), 'garden', x, y + .14, z);
    const shrubs = Math.max(2, Math.floor(width / .52));
    for (let index = 0; index < shrubs; index++) add(new SphereGeometry(1, 10, 7), 'garden', x - width * .38 + index / Math.max(1, shrubs - 1) * width * .76, y + .30, z, .19, .16, .16);
  }
  function floors(building: Readonly<CityBuilding>) {
    const height = building.height - .28;
    const office = building.archetype === 'garden-office';
    const count = Math.floor((height - .35) / .84);
    const pitch = (height - .35) / count;
    for (let floor = 0; floor < count; floor++) {
      const fraction = floor / count;
      const step = office ? Math.floor(floor / 3) : 0;
      const taper = office ? 1 - step * .14 : 1 - fraction * .18;
      const width = building.width * taper;
      const depth = building.depth * (office ? 1 - step * .105 : 1 - fraction * .11);
      const x = office ? step * .18 : Math.sin(fraction * Math.PI) * .22;
      const z = office ? -step * .12 : -fraction * .12;
      const y = .22 + floor * pitch;
      add(roundedBox(width, .13, depth, office ? .26 : .65), 'porcelain', x, y, z);
      add(roundedBox(width - .25, pitch - .15, depth - .24, office ? .24 : .60), 'glass', x, y + .13, z);
      const bays = Math.max(4, Math.floor(width / .65));
      for (let bay = 0; bay < bays; bay++) {
        const bx = x - width * .36 + bay / (bays - 1) * width * .72;
        for (const side of [-1, 1]) add(new BoxGeometry(.045, pitch - .16, .045), 'porcelain', bx, y + pitch / 2 + .07, z + side * (depth / 2 - .10));
      }
      if (floor % 3 === 0 || floor === count - 1) planter(width * .58, x, y + .14, z + depth / 2 - .19);
    }
    const topScale = office ? 1 - Math.floor((count - 1) / 3) * .14 : .82;
    const tx = office ? Math.floor((count - 1) / 3) * .18 : .06;
    const tz = office ? -Math.floor((count - 1) / 3) * .12 : -.12;
    add(roundedBox(building.width * topScale + .12, .15, building.depth * .72, .35), 'porcelain', tx, height - .15, tz);
    add(roundedBox(building.width * topScale * .78, .06, building.depth * .5, .3), 'garden', tx, height, tz);

  }
  function dome(building: Readonly<CityBuilding>) {
    const rx = building.width / 2; const rz = building.depth / 2; const height = building.height - .35;
    add(new SphereGeometry(1, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), 'glass', 0, .28, 0, rx, height, rz);
    for (let rib = 0; rib < 5; rib++) {
      const angle = rib / 5 * Math.PI;
      const points = Array.from({ length: 19 }, (_, index) => { const t = index / 18 * Math.PI; return new Vector3(Math.cos(t) * rx * Math.cos(angle), Math.sin(t) * height + .30, Math.cos(t) * rz * Math.sin(angle)); });
      add(arch(points, .047), 'porcelain');
    }
    for (let ring = 1; ring <= 3; ring++) {
      const elevation = ring / 4 * Math.PI / 2;
      const points = Array.from({ length: 49 }, (_, index) => { const t = index / 48 * Math.PI * 2; return new Vector3(Math.cos(t) * rx * Math.cos(elevation), .30 + height * Math.sin(elevation), Math.sin(t) * rz * Math.cos(elevation)); });
      add(arch(points, .033, 64), 'porcelain');
    }
    add(roundedBox(1.55, 1.65, .08, .18), 'window', 0, .25, rz - .10);
    add(roundedBox(1.95, .12, .75, .28), 'porcelain', 0, 1.88, rz - .05);
    planter(building.width * .48, 0, .28, -rz * .74);
  }
  function pavilion(building: Readonly<CityBuilding>) {
    add(roundedBox(building.width - .45, building.height - .8, building.depth - .4, .62), 'glass', 0, .25);
    const roof = roundedBox(building.width + .35, .20, building.depth + .30, .7);
    const position = roof.attributes.position;
    for (let index = 0; index < position.count; index++) position.setY(index, position.getY(index) + Math.cos(position.getX(index) / (building.width + .35) * Math.PI) * .42);
    roof.computeVertexNormals();
    add(roof, 'porcelain', 0, building.height - .62);
    for (let bay = 0; bay < 6; bay++) for (const side of [-1, 1]) add(new BoxGeometry(.055, building.height - .82, .06), 'porcelain', (bay / 5 - .5) * building.width * .72, building.height / 2 - .15, side * (building.depth / 2 - .17));
    planter(building.width * .50, 0, .22, -building.depth / 2 + .14);
    add(roundedBox(1.3, .06, .85, .2), 'porcelain', 0, .24, building.depth / 2 - .12);
  }
  function station(building: Readonly<CityBuilding>) {
    const height = building.height;
    add(roundedBox(building.width, .18, building.depth, .35), 'porcelain', 0, 2.14);
    for (const z of [-building.depth * .43, 0, building.depth * .43]) {
      const points = Array.from({ length: 17 }, (_, index) => { const t = index / 16 * Math.PI; return new Vector3(Math.cos(t) * building.width * .49, .16 + Math.sin(t) * (height - .26), z); });
      add(arch(points, .09), 'porcelain');
    }
    for (const side of [-1, 1]) add(roundedBox(.07, .45, building.depth * .9, .03), 'glass', side * building.width * .46, 2.33);
    for (let stair = 0; stair < 7; stair++) add(new BoxGeometry(building.width * .38, .17, .16), 'porcelain', building.width * .23, .30 + stair * .29, building.depth * .36 - stair * .17);
  }
  for (const building of cityBuildings) {
    owner = building.id;
    placement.position.set(building.x, terrainHeight(building.x, building.z), building.z); placement.rotation.set(0, building.rotation, 0); placement.scale.set(1, 1, 1); placement.updateMatrix();
    add(roundedBox(building.width + .42, .22, building.depth + .38, .65), 'porcelain');
    if (building.archetype === 'residential' || building.archetype === 'garden-office') floors(building);
    else if (building.archetype === 'dome') dome(building);
    else if (building.archetype === 'pavilion') pavilion(building);
    else station(building);
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
    const nx = tangent.z; const nz = -tangent.x;
    const points = Array.from({ length: 15 }, (_, index) => { const angle = index / 14 * Math.PI; const offset = Math.cos(angle) * .62; return new Vector3(center.x + nx * offset, floor + Math.sin(angle) * (center.y - .17 - floor), center.z + nz * offset); });
    add(arch(points, .105, 20), 'porcelain');
  }
  const meshes: Mesh[] = [];
  for (const finish of Object.keys(parts) as Finish[]) {
    const bucket = parts[finish];
    if (!bucket.length) continue;
    const geometry = mergeGeometries(bucket.map(part => part.geometry))!;
    const ranges: CityPartRange[] = []; let offset = 0;
    for (const part of bucket) { const count = part.geometry.attributes.position.count; if (part.building) ranges.push({ building: part.building, start: offset, count }); offset += count; part.geometry.dispose(); }
    geometry.userData.buildingRanges = ranges;
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, materials[finish]); mesh.name = `eco-city-${finish}`; mesh.castShadow = true; mesh.receiveShadow = true; meshes.push(mesh);
  }
  return meshes;
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
  const meshes = makeStaticCity(route, materials);
  const carriage = makeCarriage(materials);
  const cars = [carriage, carriage.clone()];
  cars[0].name = 'city-monorail-front'; cars[1].name = 'city-monorail-rear';
  const resources = { route, materials, meshes, cars, position: new Vector3(), tangent: new Vector3(), disposeTimer: undefined as ReturnType<typeof setTimeout> | undefined };
  updateCityTransit(resources, 0);
  return resources;
}

function updateCityTransit(city: ReturnType<typeof makeCity>, elapsed: number) {
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
      for (const mesh of city.meshes) mesh.geometry.dispose();
      city.cars[0].traverse(object => { if (object instanceof Mesh) object.geometry.dispose(); });
      for (const material of Object.values(city.materials)) material.dispose();
    }, 0);
  };
}

export function EcoCity({ runtime, paused, quality }: EnvironmentProps) {
  const city = useMemo(() => makeCity(), []);
  useEffect(() => retainCity(city), [city]);
  useFrame(() => { if (!paused) updateCityTransit(city, runtime.current.elapsed); });
  return <group name="coastal-eco-city" dispose={null}>
    {city.meshes.map(mesh => <primitive object={mesh} key={mesh.uuid} />)}
    {city.cars.map(car => <primitive object={car} key={car.uuid} />)}
    <CityLife runtime={runtime} paused={paused} quality={quality} route={city.route} />
  </group>;
}
