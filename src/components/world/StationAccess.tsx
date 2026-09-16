'use client';

import { useEffect, useMemo } from 'react';
import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshPhysicalMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainMeshHeight } from './terrain';

import { STATION_ACCESS, stationAccessPlan, type StationStairSection } from './stationPlan';
export { STATION_ACCESS, stationAccessPlan } from './stationPlan';

// Every stair is a closed solid whose four bottom vertices are measured against final terrain.
export function stationSectionGeometry(section: StationStairSection) {
  const { x, width } = STATION_ACCESS;
  const points: number[] = [];
  for (const z of [section.from, section.to]) for (const side of [-1, 1]) {
    const px = x + side * width / 2;
    points.push(px, terrainMeshHeight(px, z), z, px, section.top, z);
  }
  const indices = [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 1, 3, 5, 3, 7, 5, 0, 4, 2, 2, 4, 6];
  for (let index = 0; index < indices.length; index += 3) [indices[index + 1], indices[index + 2]] = [indices[index + 2], indices[index + 1]];
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(points, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function railSegment(a: Vector3, b: Vector3, radius: number) {
  const direction = b.clone().sub(a);
  const geometry = new CylinderGeometry(radius, radius, direction.length(), 8);
  geometry.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()));
  geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geometry;
}

export function createStationAccess() {
  const root = new Group(); root.name = 'city-station-access';
  const plan = stationAccessPlan();
  const stone = new MeshPhysicalMaterial({ color: '#c3c6b7', roughness: .89, metalness: 0 });
  const metal = new MeshPhysicalMaterial({ color: '#899f98', roughness: .47, metalness: .58 });
  const parts: BufferGeometry[] = [];
  for (const section of plan.sections) parts.push(stationSectionGeometry(section));
  const steps = mergeGeometries(parts)!; parts.forEach(part => part.dispose());
  const structure = new Mesh(steps, stone); structure.name = 'city-station-grounded-stairs'; structure.castShadow = true; structure.receiveShadow = true; structure.raycast = () => {}; root.add(structure);
  const railParts: BufferGeometry[] = [];
  const postRecords: Array<{ bottom: number[]; top: number[] }> = [];
  for (const side of [-1, 1]) {
    const points = plan.railPoints.map(point => point.clone().add(new Vector3(side * (plan.width / 2 - .025), 0, 0)));
    for (const point of points) railParts.push(new SphereGeometry(STATION_ACCESS.railRadius, 8, 6).translate(point.x, point.y, point.z));
    for (let index = 1; index < points.length; index++) railParts.push(railSegment(points[index - 1], points[index], STATION_ACCESS.railRadius));
    for (let index = 0; index < points.length; index++) {
      if (index !== 0 && index !== points.length - 1 && index % 3 !== 1) continue;
      const top = points[index];
      const surface = index === 0 ? plan.bottom.y : index >= points.length - 2 ? plan.top.y : plan.sections[index].top;
      const bottom = new Vector3(top.x, surface, top.z);
      railParts.push(railSegment(bottom, top, .027)); postRecords.push({ bottom: bottom.toArray(), top: top.toArray() });
    }
  }
  const rails = mergeGeometries(railParts)!; railParts.forEach(part => part.dispose());
  rails.userData.postEndpoints = postRecords;
  const handrail = new Mesh(rails, metal); handrail.name = 'city-station-continuous-handrails'; handrail.castShadow = true; handrail.receiveShadow = true; handrail.raycast = () => {}; root.add(handrail);
  let timer: ReturnType<typeof setTimeout> | undefined;
  return { root, plan, dispose() { steps.dispose(); rails.dispose(); stone.dispose(); metal.dispose(); }, retain() { clearTimeout(timer); return () => { timer = setTimeout(() => { steps.dispose(); rails.dispose(); stone.dispose(); metal.dispose(); }, 0); }; } };
}

export function StationAccess() {
  const access = useMemo(() => createStationAccess(), []);
  useEffect(() => access.retain(), [access]);
  return <primitive object={access.root} dispose={null} />;
}
