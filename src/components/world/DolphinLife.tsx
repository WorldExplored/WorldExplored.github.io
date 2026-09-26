'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnvironmentProps } from './Water';
import { createDolphinState, stepDolphin } from './dolphinRoutes';
import { surfaceAnimals } from './marineTraffic';
import { harborWaterHeight } from './waterSurface';

function merge(parts: BufferGeometry[]) {
  parts.forEach(part => part.deleteAttribute('uv'));
  const result = mergeGeometries(parts)!; parts.forEach(part => part.dispose()); return result;
}
function sphere(x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  return new SphereGeometry(1, 12, 8).scale(sx, sy, sz).translate(x, y, z);
}
function fin(points: readonly [number, number][], thickness = .021) {
  const vertices: number[] = [], indices: number[] = [];
  const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  for (const side of [-1, 1]) {
    const start = vertices.length / 3; vertices.push(cx, cy, thickness * side);
    points.forEach(([x,y]) => vertices.push(x,y,0));
    for (let i = 0; i < points.length; i++) {
      const a = start, b = start + i + 1, c = start + (i + 1) % points.length + 1;
      indices.push(...(side > 0 ? [a,b,c] : [a,c,b]));
    }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
/** Smooth continuous body with a narrow tail stock, melon and gradual countershading. */
export function dolphinBodyGeometry(shark = false) {
  const profile = shark ? [[-1.5,.025,.025],[-1,.14,.14],[-.3,.28,.26],[.45,.28,.28],[1,.18,.2],[1.55,.001,.001]] : [[-1.3,.035,.04],[-.95,.10,.105],[-.5,.21,.20],[.1,.30,.275],[.57,.27,.24],[.85,.19,.17],[1.02,.07,.1],[1.10,.02,.06]];
  const rings = new CatmullRomCurve3(profile.map(p => new Vector3(...p as [number,number,number])), false, 'centripetal').getPoints(36);
  const vertices: number[] = [], colors: number[] = [], indices: number[] = [];
  const top = new Color(shark ? '#526d79' : '#638f9b'), belly = new Color('#dbe9e4'), color = new Color();
  rings.forEach((p,row) => {
    for (let side = 0; side <= 20; side++) {
      const angle = side / 20 * Math.PI * 2, c = Math.cos(angle);
      vertices.push(p.x, c * p.y + .035 * Math.sin((p.x + 1.3) * 1.6), Math.sin(angle) * p.z);
      color.copy(top).lerp(belly, Math.max(0, Math.min(1, (-c - .05) * 1.5))); colors.push(color.r,color.g,color.b);
      if (row && side) { const i = row * 21 + side; indices.push(i,i-1,i-21,i-1,i-22,i-21); }
    }
  });
  const geometry = new BufferGeometry(); geometry.setAttribute('position',new Float32BufferAttribute(vertices,3)); geometry.setAttribute('color',new Float32BufferAttribute(colors,3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
export function createDolphinLife() {
  const root = new Group(); root.name = 'roaming-coastal-dolphins';
  const geometries = new Set<BufferGeometry>(), materials = new Set<MeshStandardMaterial>();
  const material = (color: string, vertexColors = false) => { const result = new MeshStandardMaterial({ color, vertexColors, roughness: .38, metalness: .03, side: DoubleSide }); materials.add(result); return result; };
  const skins = [material('#638f9b'), material('#526d79')], bodyMaterial = material('#ffffff',true), dark = material('#173638'), pale = material('#cbdedb');
  const add = (group: Group, name: string, geometry: BufferGeometry, mat: MeshStandardMaterial) => { geometries.add(geometry); const mesh = new Mesh(geometry,mat); mesh.name = name; mesh.raycast = () => {}; group.add(mesh); return mesh; };
  const states = [createDolphinState(0),createDolphinState(1),createDolphinState(2),createDolphinState(3),createDolphinState(0,true),createDolphinState(1,true)];
  const shared = [false,true].map(shark => {
    const details: BufferGeometry[] = [fin(shark ? [[-.54,.20],[-.45,.46],[-.16,.98],[-.10,.97],[-.12,.62],[.13,.25]] : [[-.46,.21],[-.39,.55],[-.28,.72],[-.16,.58],[-.13,.39],[.12,.27]])];
    const features: BufferGeometry[] = [];
    const eyeX = shark ? 1.04 : .81, eyeZ = shark ? .2 : .167;
    for (const side of [-1,1]) {
      details.push(fin([[-.32,0],[-.71,.37],[-.80,.57],[-.67,.56],[-.44,.39],[.12,0]]).rotateX(side * Math.PI / 2).translate(.28,-.115,side*.20));
      features.push(sphere(eyeX,.105,side*eyeZ,.027,.025,.013));
      if (shark) for (let g = 0; g < 5; g++) features.push(new CylinderGeometry(.007,.007,.19,5).translate(.46-g*.074,.01,side*.271));
      else features.push(sphere(1.16,-.038,side*.072,.28,.009,.006));
    }
    if (!shark) {
      details.push(sphere(1.13,-.015,0,.32,.072,.077));
      features.push(sphere(.58,.295,0,.05,.006,.032));
    }
    const tail = fin(shark ? [[.06,0],[-.23,.31],[-.63,.79],[-.51,.34],[-.33,.01],[-.56,-.38],[-.27,-.22]] : [[.08,0],[-.18,.22],[-.54,.53],[-.48,.28],[-.30,.08],[-.24,0],[-.30,-.08],[-.48,-.28],[-.54,-.53],[-.18,-.22]],.026);
    if (!shark) tail.rotateX(Math.PI/2);
    return { body:dolphinBodyGeometry(shark), details:merge(details), features:merge(features), tail, jaw:sphere(1.13,-.062,0,.29,.019,.058) };
  });
  shared.forEach(parts => Object.values(parts).forEach(geometry => geometries.add(geometry)));
  const creatures = states.map(state => {
    const animal = new Group(); animal.name = state.shark ? 'offshore-shark' : 'bottlenose-dolphin'; animal.scale.setScalar(state.shark ? .68 : [ .34, .31, .36, .32 ][state.index % 4]); root.add(animal);
    const geometry = shared[Number(state.shark)], skin = skins[Number(state.shark)];
    add(animal,'countershaded-fusiform-body',geometry.body,bodyMaterial);
    add(animal,'rostrum-dorsal-and-paired-flippers',geometry.details,skin);
    add(animal,'eyes-mouth-and-blowhole',geometry.features,dark);
    if (!state.shark) add(animal,'separated-lower-jaw',geometry.jaw,pale);
    const tail = new Group(); tail.name = state.shark ? 'vertical-caudal-fin' : 'horizontal-tail-flukes'; tail.position.x = state.shark ? -1.5 : -1.3; animal.add(tail);
    add(tail,'articulated-tail-surface',geometry.tail,skin); return {animal,tail};
  });
  // Small contact spray expands from the body crossing, never a body-sized permanent circle.
  const ringGeometry = new TorusGeometry(1,.035,5,32).rotateX(Math.PI/2), dropGeometry = new SphereGeometry(1,6,4);
  geometries.add(ringGeometry); geometries.add(dropGeometry);
  const splashes = states.filter(state => !state.shark).map(() => {
    const mat = material('#e3ffff'); mat.transparent = true; mat.depthWrite = false;
    const ring = new Mesh(ringGeometry,mat); ring.renderOrder = 4; root.add(ring);
    const drops = new InstancedMesh(dropGeometry,mat,10); drops.renderOrder = 4; drops.frustumCulled = false; drops.raycast = () => {}; root.add(drops); return {ring,drops};
  });
  const dummy = new Object3D(); let quality: EnvironmentProps['quality'] = 'high';
  function update(delta: number, paused = false, onContact?: (point: Vector3) => void, waterTime?: number) {
    if (paused) return;
    states.forEach((state,i) => {
      if (stepDolphin(state,delta,false,waterTime)) onContact?.(state.splash);
      const {animal,tail} = creatures[i]; animal.position.copy(state.position); animal.rotation.set(0,state.heading,0); animal.rotateZ(state.pitch);
      if (state.shark) tail.rotation.y = state.tail; else tail.rotation.z = state.tail;
      if (state.shark) animal.visible = quality !== 'low' || state.index === 0;
      if (state.shark) return;
      const {ring,drops} = splashes[i], age = state.splashAge; ring.visible = drops.visible = age < 1.1;
      if (age >= 1.1) return;
      ring.position.set(state.splash.x,harborWaterHeight(state.splash.x,state.splash.z,waterTime ?? state.time)+.015,state.splash.z);
      ring.scale.setScalar(.08 + age*.62); ring.material.opacity = .65*(1-age/1.1);
      for (let j = 0; j < 10; j++) {
        const angle = j/10*Math.PI*2, spread = age*(.43+j%3*.04);
        dummy.position.set(state.splash.x+Math.cos(angle)*spread,state.splash.y+Math.max(0,age*(1.15+j%3*.1)-age*age*4.9),state.splash.z+Math.sin(angle)*spread);
        dummy.scale.set(.016,.03,.016).multiplyScalar(age < .32 ? 1 : 0); dummy.updateMatrix(); drops.setMatrixAt(j,dummy.matrix);
      }
      drops.instanceMatrix.needsUpdate = true;
    });
  }
  function setQuality(tier: EnvironmentProps['quality']) { quality=tier; creatures.forEach((creature,i) => { creature.animal.visible = !states[i].shark || states[i].index === 0 || tier !== 'low'; }); }
  update(0);
  // Shared geometry is retained across Strict Mode's effect replay.
  let timer: ReturnType<typeof setTimeout>;
  function dispose() { geometries.forEach(value=>value.dispose()); materials.forEach(value=>value.dispose()); splashes.forEach(({drops})=>drops.dispose()); }
  return {root,states,update,setQuality,dispose,retain(){clearTimeout(timer);return()=>{timer=setTimeout(dispose,0);};}};
}
export function DolphinLife({runtime,paused,quality}: EnvironmentProps) {
  const life = useMemo(()=>createDolphinLife(),[]);
  useEffect(()=>life.retain(),[life]);
  useEffect(()=>{
    const occupants=life.states.map(state=>({position:state.position,radius:state.shark?1.1:.65}));
    surfaceAnimals.push(...occupants);
    return()=>{occupants.forEach(item=>{const i=surfaceAnimals.indexOf(item);if(i>=0)surfaceAnimals.splice(i,1);});};
  },[life]);
  useEffect(()=>{life.setQuality(quality);},[life,quality]);
  useFrame((_,delta)=>life.update(delta,paused,point=>{
    const state=runtime.current; state.ripple.x=point.x; state.ripple.z=point.z; state.ripple.time=state.elapsed; state.ripple.serial++;
  },runtime.current.elapsed));
  return <primitive object={life.root} />;
}
