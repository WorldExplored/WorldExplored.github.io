'use client';

import { useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Group, InstancedMesh, MeshPhysicalMaterial, Object3D, Shape, TorusGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cityBuildings, cityLocalToWorld, type CityPoint } from './city';
import type { EnvironmentProps } from './Water';
import type { QualityTier } from '@/content/world';

// Flat, non-solar service roofs. Heights are finished roof surfaces in building coordinates.
export const CITY_VENTILATION_MOUNTS: readonly { building: string; local: CityPoint }[] = [
  { building: 'waterfront-gallery', local: [1.45, 2.93, -.30] },
  { building: 'waterfront-east', local: [.55, 4.45, -.40] },
  { building: 'residence-east', local: [-.95, 10.23, -.20] },
  { building: 'residence-east', local: [.55, 10.23, -.20] },
  { building: 'residence-cove', local: [-.70, 8.35, 0] },
  { building: 'residence-cove', local: [.70, 8.35, 0] },
];

function combine(parts: BufferGeometry[]) {
  const sources = parts.map(part => part.index ? part.toNonIndexed() : part);
  const geometry = mergeGeometries(sources)!;
  new Set([...parts, ...sources]).forEach(part => part.dispose());
  return geometry;
}

export function createCityVentilation() {
  const root = new Group(); root.name = 'city-rooftop-ventilation';
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new BoxGeometry(w, h, d).translate(x, y, z);
  const casing: BufferGeometry[] = [];
  const vents: BufferGeometry[] = [];
  const guards: BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    casing.push(box(.96, .43, .065, 0, .325, side * .3975), box(.065, .43, .73, side * .4475, .325, 0));
    casing.push(box(.96, .045, .075, 0, .565, side * .3975));
    for (const z of [-.29, .29]) casing.push(box(.13, .10, .13, side * .35, .05, z));
    for (let slat = 0; slat < 6; slat++) vents.push(box(.70, .016, .027, 0, .18 + slat * .053, side * .438));
  }
  casing.push(box(.84, .045, .72, 0, .115, 0));
  const ring = (radius: number) => new TorusGeometry(radius, .008, 5, 32).rotateX(Math.PI / 2).translate(0, .623, 0);
  for (const radius of [.16, .25, .34]) guards.push(ring(radius));
  for (let spoke = 0; spoke < 8; spoke++) guards.push(new BoxGeometry(.68, .012, .012).rotateY(spoke * Math.PI / 4).translate(0, .623, 0));
  for (const side of [-1, 1]) guards.push(box(.055, .07, .075, side * .33, .592, 0));
  const blades: BufferGeometry[] = [new CylinderGeometry(.065, .073, .055, 16)];
  const shape = new Shape();
  shape.moveTo(.045, -.025); shape.bezierCurveTo(.13, -.105, .25, -.085, .30, -.025);
  shape.quadraticCurveTo(.28, .06, .17, .045); shape.lineTo(.045, .025); shape.closePath();
  for (let blade = 0; blade < 5; blade++) blades.push(new ExtrudeGeometry(shape, { depth: .018, bevelEnabled: false, curveSegments: 6 }).rotateX(Math.PI / 2).rotateY(blade * Math.PI * 2 / 5));
  const geometries = {
    casing: combine(casing),
    vents: combine([...vents, new CylinderGeometry(.085, .11, .39, 12).translate(0, .325, 0)]),
    guard: combine(guards),
    rotor: combine(blades),
    light: box(.12, .028, .016, .28, .48, .442),
  };
  const materials = {
    casing: new MeshPhysicalMaterial({ color: '#edf6ef', roughness: .33, metalness: .18, clearcoat: .4 }),
    vents: new MeshPhysicalMaterial({ color: '#203c49', roughness: .58, metalness: .5 }),
    guard: new MeshPhysicalMaterial({ color: '#1262c4', roughness: .34, metalness: .45 }),
    rotor: new MeshPhysicalMaterial({ color: '#15586c', roughness: .38, metalness: .4 }),
    light: new MeshPhysicalMaterial({ color: '#51ead7', emissive: '#20c8ab', emissiveIntensity: .35, roughness: .3 }),
  };
  const meshes = Object.fromEntries(Object.entries(geometries).map(([name, geometry]) => {
    const mesh = new InstancedMesh(geometry, materials[name as keyof typeof materials], CITY_VENTILATION_MOUNTS.length);
    mesh.name = `city-cooling-${name}`; mesh.castShadow = name !== 'light'; mesh.receiveShadow = true;
    mesh.raycast = () => {}; root.add(mesh); return [name, mesh];
  })) as Record<string, InstancedMesh>;
  const placements = CITY_VENTILATION_MOUNTS.map(mount => {
    const building = cityBuildings.find(item => item.id === mount.building)!;
    return { position: cityLocalToWorld(building, mount.local), yaw: building.rotation };
  });
  const pose = new Object3D();
  for (const [index, placement] of placements.entries()) {
    pose.position.set(...placement.position); pose.rotation.set(0, placement.yaw, 0); pose.updateMatrix();
    for (const name of ['casing', 'vents', 'guard', 'light'] as const) meshes[name].setMatrixAt(index, pose.matrix);
  }
  function update(elapsed: number) {
    for (const [index, placement] of placements.entries()) {
      pose.position.set(placement.position[0], placement.position[1] + .55, placement.position[2]);
      pose.rotation.set(0, placement.yaw + elapsed * (1.8 + index * .19) + index * 1.7, 0);
      pose.updateMatrix(); meshes.rotor.setMatrixAt(index, pose.matrix);
    }
    meshes.rotor.instanceMatrix.needsUpdate = true;
  }
  update(0);
  for (const mesh of Object.values(meshes)) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
  let disposal: ReturnType<typeof setTimeout> | undefined;
  return {
    root, update,
    setQuality(quality: QualityTier) {
      const count = quality === 'high' ? 6 : quality === 'medium' ? 4 : 2;
      for (const mesh of Object.values(meshes)) mesh.count = count;
    },
    retain() { clearTimeout(disposal); },
    release() { disposal = setTimeout(() => { Object.values(geometries).forEach(geometry => geometry.dispose()); Object.values(materials).forEach(material => material.dispose()); }, 0); },
  };
}

export function CityVentilation({ runtime, paused, quality }: EnvironmentProps) {
  const [assembly] = useState(createCityVentilation);
  useEffect(() => { assembly.retain(); return () => assembly.release(); }, [assembly]);
  useEffect(() => { assembly.setQuality(quality); }, [assembly, quality]);
  useFrame(() => { if (!paused) assembly.update(runtime.current.elapsed); });
  return <primitive object={assembly.root} dispose={null} />;
}
