'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, ShaderMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { world } from '../../content/world';
import { cityBuildings, cityEntrances, citySecondaryEntrances } from './city';
import { terrainMeshHeight } from './terrain';
import { nightLightingLevel } from './lighthouseControl';
import type { EnvironmentProps } from './Water';

export interface ExteriorLampSite {
  id: string; building: string; x: number; y: number; z: number;
  floor: number; yaw: number; width: number; reach: number;
}

// Mounts sit on the actual entry lintels or beneath their canopies, in local coordinates.
const mainEntries: ReadonlyArray<readonly [string, number, number, number, number, number]> = [
  ['work', 0, 3.18, 2.64, 1.105, .9],
  ['experience', 0, 3.42, 3.01, 1.075, .8],
  ['research', -1.33, 3.42, 1.80, 1.075, .62],
  ['purdue', 0, 3.37, 1.66, 1.03, .62],
  ['history', 0, 3.46, 3.70, 1.075, 1.1],
  ['about', 1.195, 3.39, -1.12, 1.06, .45],
  ['about', -1.95, 3.39, 1.62, 1.06, .45],
  ['contact', 0, 2.84, 1.79, 1.06, .48],
  ['arcade', 0, 3.44, 2.35, 1.075, .65],
  ['building', 0, 2.14, .92, 1.06, .30],
];
let sites: readonly ExteriorLampSite[] | undefined;
export function exteriorLampSites(): readonly ExteriorLampSite[] {
  if (sites) return sites;
  const result: ExteriorLampSite[] = mainEntries.map(([id, x, y, z, floor, width], index) => {
    const landmark = world.landmarks.find(item => item.id === id)!, yaw = landmark.rotationY ?? 0;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return { id: `${id}-entry-${index}`, building: id,
      x: landmark.position[0] + x * c + z * s, y: landmark.position[1] + y,
      z: landmark.position[2] - x * s + z * c, floor: landmark.position[1] + floor,
      yaw, width, reach: id === 'building' ? 1.55 : 2.8 };
  });
  for (const building of cityBuildings) {
    const entry = building.family === 'public-station'
      ? citySecondaryEntrances.find(item => item.building === building.id)!
      : cityEntrances.find(item => item.building === building.id)!;
    const [x, floor, z] = entry.world, yaw = entry.yaw;
    result.push({ id: `${building.id}-entry`, building: building.id,
      x: x + Math.sin(yaw) * .23, y: floor + 1.49, z: z + Math.cos(yaw) * .23,
      floor, yaw, width: .36, reach: 2.05 });
  }
  sites = Object.freeze(result);
  return sites;
}

/** Baked once into grass instances: no night fill behind a fixture or across the island. */
export function exteriorIlluminance(x: number, y: number, z: number, lamps = exteriorLampSites()) {
  let light = 0;
  for (const lamp of lamps) {
    const dx = x - lamp.x, dz = z - lamp.z, c = Math.cos(lamp.yaw), s = Math.sin(lamp.yaw);
    const across = dx * c - dz * s, forward = dx * s + dz * c;
    if (forward < -.03 || forward > lamp.reach || y > lamp.y || y < lamp.floor - .75) continue;
    const radius = Math.hypot(across / (lamp.reach * .57), (forward - lamp.reach * .38) / (lamp.reach * .62));
    if (radius >= 1) continue;
    const falloff = 1 - radius;
    light = Math.max(light, falloff * falloff * .34);
  }
  return light;
}

function poolGeometry(lamp: ExteriorLampSite) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const c = Math.cos(lamp.yaw), s = Math.sin(lamp.yaw), columns = 8, rows = 10;
  for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    const u = column / columns, v = row / rows;
    const localX = (u - .5) * lamp.reach * 1.14, localZ = v * lamp.reach;
    const x = lamp.x + localX * c + localZ * s, z = lamp.z - localX * s + localZ * c;
    positions.push(x, terrainMeshHeight(x, z) + .023, z); uv.push(u, v);
    if (column < columns && row < rows) {
      const n = row * (columns + 1) + column;
      indices.push(n, n + columns + 1, n + 1, n + 1, n + columns + 1, n + columns + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function createExteriorLighting(lamps = exteriorLampSites()) {
  const root = new Group(); root.name = 'exterior-entry-lighting'; root.userData.sites = lamps;
  const housings: BufferGeometry[] = [], lenses: BufferGeometry[] = [], pools: BufferGeometry[] = [];
  for (const lamp of lamps) {
    const place = (geometry: BufferGeometry) => geometry.rotateY(lamp.yaw).translate(lamp.x, lamp.y, lamp.z);
    housings.push(place(new BoxGeometry(lamp.width + .10, .12, .22)));
    housings.push(place(new BoxGeometry(lamp.width + .05, .17, .035).translate(0, .025, -.105)));
    lenses.push(place(new BoxGeometry(lamp.width, .022, .135).translate(0, -.067, .015)));
    // A narrow front window makes the actual source visible from the street.
    lenses.push(place(new BoxGeometry(lamp.width * .84, .045, .012).translate(0, -.018, .116)));
    pools.push(poolGeometry(lamp));
  }
  const join = (parts: BufferGeometry[]) => {
    const geometry = parts.length ? mergeGeometries(parts)! : new BufferGeometry();
    for (const part of parts) part.dispose(); return geometry;
  };
  const shell = new Mesh(join(housings), new MeshStandardMaterial({ color: '#cfe4df', metalness: .34, roughness: .4 }));
  const sources = new Mesh(join(lenses), new MeshStandardMaterial({ color: '#e2f4ed', emissive: '#ccebe2', emissiveIntensity: 0, roughness: .35 }));
  const wash = new Mesh(join(pools), new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -1,
    uniforms: { night: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float night;varying vec2 vUv;
      void main(){float radius=length(vec2((vUv.x-.5)*2.,(vUv.y-.38)/.62));
        float edge=max(0.,1.-radius);float nearEdge=smoothstep(0.,.06,vUv.y);
        gl_FragColor=vec4(.38,.63,.58,edge*edge*nearEdge*night*.25);\n#include <colorspace_fragment>\n}`,
  }));
  wash.visible = false;
  shell.name = 'exterior-lamp-housings'; sources.name = 'exterior-pearl-diffusers'; wash.name = 'exterior-ground-light-pools';
  shell.castShadow = true; shell.receiveShadow = true; sources.receiveShadow = true;
  for (const mesh of [shell, sources, wash]) { mesh.raycast = () => {}; root.add(mesh); }
  let timer: ReturnType<typeof setTimeout>, disposed = false;
  return {
    root,
    update(night: number) {
      const level = Math.max(0, Math.min(1, night));
      sources.material.emissiveIntensity = level * .85;
      wash.material.uniforms.night.value = level; wash.visible = level > .01;
    },
    dispose() {
      if (disposed) return; disposed = true;
      for (const mesh of [shell, sources, wash]) { mesh.geometry.dispose(); mesh.material.dispose(); }
    },
    retain() { clearTimeout(timer); return () => { timer = setTimeout(() => this.dispose(), 0); }; },
  };
}

export function ExteriorLighting({ runtime }: Pick<EnvironmentProps, 'runtime'>) {
  const lighting = useMemo(() => createExteriorLighting(), []);
  useEffect(() => lighting.retain(), [lighting]);
  useFrame(() => lighting.update(nightLightingLevel(runtime.current.weather)));
  return <primitive object={lighting.root} dispose={null} />;
}
