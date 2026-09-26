'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, ShaderMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { world } from '../../content/world';
import { cityBuildings, cityLocalToWorld } from './city';
import { terrainMeshHeight } from './terrain';
import { nightLightingLevel } from './lighthouseControl';
import type { EnvironmentProps } from './Water';

export interface ExteriorLampSite {
  id: string; building: string; x: number; y: number; z: number;
  floor: number; yaw: number; width: number; reach: number;
  mount: 'canopy' | 'wall' | 'pole'; bracket: number;
}

// Canopy mounts meet the slab underside. Wall brackets end at the solid facade.
const mainEntries: ReadonlyArray<readonly [string, number, number, number, number, number, 'canopy' | 'wall', number]> = [
  ['work', 0, 3.27, 2.64, 1.105, .9, 'canopy', 0],
  ['experience', 0, 3.50, 3.01, 1.075, .8, 'canopy', 0],
  ['research', -1.33, 3.585, 1.80, 1.075, .62, 'canopy', 0],
  ['purdue', 0, 3.37, 1.66, 1.03, .62, 'wall', .13],
  ['history', 0, 3.575, 3.70, 1.075, 1.1, 'canopy', 0],
  ['about', 1.195, 3.39, -1.12, 1.06, .45, 'wall', .15],
  ['about', -1.95, 3.39, 1.62, 1.06, .45, 'wall', .14],
  ['contact', 0, 2.925, 1.79, 1.06, .48, 'canopy', 0],
  ['arcade', 0, 3.44, 2.35, 1.075, .65, 'wall', .13],
  ['building', 0, 2.19, 1.145, 1.06, .30, 'wall', .035],
];
// Actual canopy centers in each family's local coordinates. Thresholds used by
// paths are farther forward, especially at recessed doors and split row houses.
// Geometry tests below this system verify every attachment against its canopy.
const cityCanopies: ReadonlyArray<readonly [string, number, number, number, number]> = [
  ['residence-west', 0, 1.895, 1.270, .33],
  ['residence-garden', 0, 1.895, 1.575, .33],
  ['residence-east', 0, 1.895, 1.325, .33],
  ['residence-cove', 0, 1.875, 1.295, .34],
  ['office-west', 0, 1.895, .719, .33],
  ['office-courtyard', 0, 1.895, 1.700, .33],
  ['office-park', 0, 1.895, 1.825, .33],
  ['office-east', 0, 1.845, 1.385, .33],
  ['waterfront-west', -1.3, 1.895, 1.750, .33],
  ['waterfront-west', 1.3, 1.895, 1.550, .33],
  ['winter-garden', 0, 1.895, 2.050, .33],
  ['waterfront-gallery', 0, 1.895, 1.330, .33],
  ['waterfront-east', -.28, 1.895, 1.675, .33],
  ['transit-garden', -.82, 1.825, 1.450, .33],
];
let sites: readonly ExteriorLampSite[] | undefined;
export function exteriorLampSites(): readonly ExteriorLampSite[] {
  if (sites) return sites;
  const result: ExteriorLampSite[] = mainEntries.map(([id, x, y, z, floor, width, mount, bracket], index) => {
    const landmark = world.landmarks.find(item => item.id === id)!, yaw = landmark.rotationY ?? 0;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return { id: `${id}-entry-${index}`, building: id,
      x: landmark.position[0] + x * c + z * s, y: landmark.position[1] + y,
      z: landmark.position[2] - x * s + z * c, floor: landmark.position[1] + floor,
      yaw, width, reach: id === 'building' ? 2.1 : 3.3, mount, bracket };
  });
  cityCanopies.forEach(([id, localX, canopyY, localZ, floor], index) => {
    const building = cityBuildings.find(item => item.id === id)!;
    const [x, y, z] = cityLocalToWorld(building, [localX, canopyY - .0375 - .06, localZ + .07]);
    result.push({ id: `${id}-entry-${index}`, building: id, x, y, z,
      floor: cityLocalToWorld(building, [0, floor, 0])[1], yaw: building.rotation,
      width: .36, reach: 2.7, mount: 'canopy', bracket: 0 });
  });
  sites = Object.freeze(result);
  return sites;
}

let streetSites: readonly ExteriorLampSite[] | undefined;
export function streetLampSites(): readonly ExteriorLampSite[] {
  if (streetSites) return streetSites;
  // Head positions face the walking route; posts stand .60 behind each head.
  const locations = [
    [-18.8, 5.35, Math.PI], [-9.8, 5.3, Math.PI], [-1, 5.5, Math.PI],
    [-15.65, -7.5, Math.PI / 2], [-11.5, -17.4, 0], [7, -4.7, 0],
    [-4.2, 24.4, 0], [3.5, 24.4, 0],
    [-17.7, -73.7, Math.PI], [-8.5, -73.7, Math.PI], [3, -71, Math.PI],
    [12, -68.5, 0], [-18.6, -67.3, -.9], [-25.35, -71.2, Math.PI / 2],
  ];
  streetSites = Object.freeze(locations.map(([x, z, yaw], index) => {
    const floor = terrainMeshHeight(x - Math.sin(yaw) * .6, z - Math.cos(yaw) * .6);
    return { id: `solar-walk-lamp-${index}`, building: '', x, y: floor + 2.65, z,
      floor, yaw, width: .42, reach: 4.5, mount: 'pole' as const, bracket: 0 };
  }));
  return streetSites;
}
let combinedSites: readonly ExteriorLampSite[] | undefined;
const allLamps = () => combinedSites ?? (combinedSites = Object.freeze([...exteriorLampSites(), ...streetLampSites()]));

/** Baked once into grass instances: no night fill behind a fixture or across the island. */
export function exteriorIlluminance(x: number, y: number, z: number, lamps = allLamps()) {
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

export function createExteriorLighting(lamps = allLamps()) {
  const root = new Group(); root.name = 'exterior-entry-lighting'; root.userData.sites = lamps;
  const housings: BufferGeometry[] = [], lenses: BufferGeometry[] = [], pools: BufferGeometry[] = [], panels: BufferGeometry[] = [];
  for (const lamp of lamps) {
    const place = (geometry: BufferGeometry) => geometry.rotateY(lamp.yaw).translate(lamp.x, lamp.y, lamp.z);
    housings.push(place(new BoxGeometry(lamp.width + .10, .12, .22)));
    if (lamp.mount === 'wall') {
      housings.push(place(new BoxGeometry(lamp.width + .05, .17, .035 + lamp.bracket).translate(0, .025, -.105 - lamp.bracket / 2)));
    }
    if (lamp.mount === 'pole') {
      const height = lamp.y - lamp.floor;
      housings.push(place(new CylinderGeometry(.044, .067, height, 8).translate(0, -height / 2, -.6)));
      housings.push(place(new BoxGeometry(.24, .12, .24).translate(0, -height + .05, -.6)));
      housings.push(place(new BoxGeometry(.075, .075, .66).translate(0, -.022, -.31)));
      housings.push(place(new BoxGeometry(.06, .23, .06).translate(0, .115, -.6)));
      housings.push(place(new BoxGeometry(.76, .04, .56).rotateX(.22).translate(0, .20, -.52)));
      panels.push(place(new BoxGeometry(.69, .012, .49).rotateX(.22).translate(0, .226, -.52)));
      // Fine pearl bus bars split the photovoltaic plate into six real cells.
      for (const x of [-.23, 0, .23]) housings.push(place(new BoxGeometry(.008, .009, .49).translate(x, .0105, 0).rotateX(.22).translate(0, .226, -.52)));
      housings.push(place(new BoxGeometry(.69, .009, .008).translate(0, .0105, 0).rotateX(.22).translate(0, .226, -.52)));
    }
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
  const solar = new Mesh(join(panels), new MeshStandardMaterial({ color: '#164366', metalness: .36, roughness: .27 }));
  const wash = new Mesh(join(pools), new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -1,
    uniforms: { night: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float night;varying vec2 vUv;
      void main(){float radius=length(vec2((vUv.x-.5)*2.,(vUv.y-.38)/.62));
        float edge=max(0.,1.-radius);float nearEdge=smoothstep(0.,.06,vUv.y);
        gl_FragColor=vec4(.38,.63,.58,pow(edge,1.45)*nearEdge*night*.58);\n#include <colorspace_fragment>\n}`,
  }));
  wash.visible = false;
  solar.name = 'solar-walk-lamp-panels';
  shell.name = 'exterior-lamp-housings'; sources.name = 'exterior-pearl-diffusers'; wash.name = 'exterior-ground-light-pools';
  shell.castShadow = true; shell.receiveShadow = true; sources.receiveShadow = true;
  for (const mesh of [shell, sources, wash, solar]) { mesh.raycast = () => {}; root.add(mesh); }
  let timer: ReturnType<typeof setTimeout>, disposed = false;
  return {
    root,
    update(night: number) {
      const level = Math.max(0, Math.min(1, night));
      sources.material.emissiveIntensity = level * 1.6;
      wash.material.uniforms.night.value = level; wash.visible = level > .01;
    },
    dispose() {
      if (disposed) return; disposed = true;
      for (const mesh of [shell, sources, wash, solar]) { mesh.geometry.dispose(); mesh.material.dispose(); }
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
