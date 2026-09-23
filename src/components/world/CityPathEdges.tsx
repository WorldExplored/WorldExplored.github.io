'use client';

import { useEffect, useMemo } from 'react';
import { Color, Group, IcosahedronGeometry, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { circulationPaths } from './circulation';
import { cityBuildings } from './city';
import { groundRouteAt, landDistance, seededRandom, terrainMeshHeight } from './terrain';
import { world } from '../../content/world';
import { applySurface } from './surfaceMaterials';

export function cityEdgeClear(x: number, z: number) {
  const museum = world.landmarks.find(item => item.id === 'history')!;
  const buildings = [...cityBuildings, { x: museum.position[0], z: museum.position[2], rotation: museum.rotationY ?? 0, width: 11.6, depth: 8.1 }];
  return landDistance(x, z) > 1.5 && buildings.every(building => {
    const dx = x - building.x, dz = z - building.z, c = Math.cos(building.rotation), s = Math.sin(building.rotation);
    return Math.abs(dx * c - dz * s) > building.width / 2 + .3 || Math.abs(dx * s + dz * c) > building.depth / 2 + .3;
  });
}

/** Pebbles follow the outside of the paved union, leaving every junction and doorway open. */
export function createCityPathEdging() {
  const random = seededRandom(91312), occupied = new Map<string, Array<[number, number]>>();
  const sites: Array<{ x: number; y: number; z: number; yaw: number; size: number; tint: number }> = [];
  for (const path of circulationPaths().filter(path => !path.bridge && path.points[0].z < -60 && path.points[0].x > -40)) {
    let carry = 0;
    for (let index = 1; index < path.points.length; index++) {
      const a = path.points[index - 1], b = path.points[index], dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
      if (length < .00001) continue;
      for (let distance = carry; distance < length; distance += .23) for (const side of [-1, 1]) {
        const offset = side * (path.width / 2 + .12 + (random() - .5) * .035);
        const x = a.x + dx * distance / length + dz / length * offset;
        const z = a.z + dz * distance / length - dx / length * offset;
        const edge = groundRouteAt(x, z).distance;
        if (edge < .055 || edge > .20 || !cityEdgeClear(x, z)) continue;
        const cellX = Math.floor(x / .2), cellZ = Math.floor(z / .2);
        let duplicate = false;
        for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
          if (occupied.get(`${cellX + ix},${cellZ + iz}`)?.some(([px, pz]) => Math.hypot(x - px, z - pz) < .18)) duplicate = true;
        }
        if (duplicate) continue;
        const y = terrainMeshHeight(x, z);
        if (y < .42) continue;
        const key = `${cellX},${cellZ}`, cell = occupied.get(key) ?? [];
        cell.push([x, z]); occupied.set(key, cell);
        sites.push({ x, y, z, yaw: Math.atan2(dx, dz) + (random() - .5) * .6, size: .085 + random() * .025, tint: random() });
      }
      carry = (carry - length) % .23;
      if (carry < 0) carry += .23;
    }
  }
  return sites;
}

export function createCityPathEdges() {
  const sites = createCityPathEdging(), root = new Group(), transform = new Object3D();
  root.name = 'city-pebble-path-edges';
  const geometry = new IcosahedronGeometry(1, 1);
  const material = applySurface(new MeshStandardMaterial({ roughness: .95, color: '#c5c7b4' }), 'mineral');
  const mesh = new InstancedMesh(geometry, material, sites.length);
  mesh.name = root.name; mesh.raycast = () => {}; mesh.receiveShadow = true;
  sites.forEach((site, index) => {
    transform.position.set(site.x, site.y + .027, site.z); transform.rotation.set(.12, site.yaw, -.05);
    transform.scale.set(site.size * .72, .04, site.size); transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix);
    mesh.setColorAt(index, new Color().setHSL(.11 + site.tint * .03, .08, .67 + site.tint * .2));
  });
  mesh.computeBoundingSphere(); root.add(mesh);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const dispose = () => { geometry.dispose(); material.dispose(); mesh.dispose(); };
  return { root, sites, retain() { clearTimeout(timer); return () => { timer = setTimeout(dispose, 0); }; }, dispose };
}

export function CityPathEdges() {
  const edges = useMemo(() => createCityPathEdges(), []);
  useEffect(() => edges.retain(), [edges]);
  return <primitive object={edges.root} dispose={null} />;
}
