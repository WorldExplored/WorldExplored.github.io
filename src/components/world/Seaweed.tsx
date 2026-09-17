'use client';

// Fiber owns these persistent meshes and shader uniforms outside React rendering.
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { createLandscapePlan, distanceToSegment, landDistance, seededRandom, terrainHeight, type LandscapePlan } from './terrain';
import { coastExposure } from './waves';
import type { EnvironmentProps } from './Water';

export interface SeaweedSite {
  x: number; y: number; z: number; height: number; width: number; rotation: number; variant: number; cove: number;
}

// Small sheltered beds leave the exposed beaches and most of the shelf open.
export const SEAWEED_COVES = [
  { x: -13, z: 11, radius: 3.5 },
  { x: 9, z: 13, radius: 3.7 },
  { x: 18, z: 1, radius: 3.1 },
  { x: 18, z: -13, radius: 3.2 },
  { x: -2, z: -25, radius: 3.5 },
] as const;
export const SEAWEED_REACH = 0.52;

export function seaweedSiteClear(x: number, z: number, plan: LandscapePlan) {
  const distance = landDistance(x, z);
  const seabed = terrainHeight(x, z);
  if (distance > -1.6 || distance < -4.7 || seabed > -0.66 || seabed < -2.0 || coastExposure(x, z, distance) > 0.3) return false;
  for (const item of [...plan.structures, ...plan.rocks]) {
    if (Math.hypot(x - item.x, z - item.z) < item.radius + SEAWEED_REACH + 0.6) return false;
  }
  for (const path of plan.paths) {
    if (!path.bridge) continue;
    for (let index = 1; index < path.points.length; index++) {
      if (distanceToSegment(x, z, path.points[index - 1], path.points[index]) < path.width / 2 + SEAWEED_REACH + 0.75) return false;
    }
  }
  return true;
}

export function createSeaweedLayout(plan = createLandscapePlan()): SeaweedSite[] {
  const random = seededRandom(80317);
  const sites: SeaweedSite[] = [];
  // Interleaving the beds preserves each ecological location at lower quality.
  for (let round = 0; round < 16; round++) {
    SEAWEED_COVES.forEach((cove, coveIndex) => {
      for (let attempt = 0; attempt < 90; attempt++) {
        const angle = random() * Math.PI * 2;
        const radius = Math.sqrt(random()) * cove.radius;
        const x = cove.x + Math.cos(angle) * radius;
        const z = cove.z + Math.sin(angle) * radius;
        if (!seaweedSiteClear(x, z, plan) || sites.some(site => Math.hypot(x - site.x, z - site.z) < 0.48)) continue;
        const y = terrainHeight(x, z) - 0.025;
        const height = Math.min(0.4 + random() * 0.72, -0.32 - y);
        sites.push({ x, y, z, height, width: 0.72 + random() * 0.28, rotation: random() * Math.PI * 2, variant: round % 3, cove: coveIndex });
        break;
      }
    });
  }
  return sites;
}

export function createSeaweedGeometry(variant: number) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const random = seededRandom(694 + variant);
  const tint = new Color(['#3d795b', '#69813e', '#547e57'][variant]);
  function blade(angle:number,length:number,breadth:number,lean:number,base=0,side=0) {
    const start=positions.length/3;
    for(let row=0;row<=8;row++)for(let rib=0;rib<=2;rib++){
      const t=row/8,v=rib-1;
      const edge=variant===1?1+Math.sin(t*39+angle)*.17:1;
      const width=Math.pow(Math.sin(t*Math.PI),variant===0?.45:.75)*breadth*edge;
      const along=lean*t*t+side*t;
      const fold=(1-Math.abs(v))*.008*Math.sin(t*Math.PI);
      const across=v*width;
      positions.push(Math.sin(angle)*along+Math.cos(angle)*across,base+t*length+fold,Math.cos(angle)*along-Math.sin(angle)*across);
      const vein=rib===1?1.12:1;const light=(.62+(base+t*length)*.35)*vein;
      colors.push(tint.r*light,tint.g*light,tint.b*light);
      if(row&&rib){const n=start+row*3+rib;indices.push(n,n-3,n-1,n-1,n-3,n-4);}
    }
  }
  if(variant===0){
    // Eelgrass has parallel strap leaves, narrow midribs and gently drooping tips.
    for(let leaf=0;leaf<7;leaf++)blade(leaf*2.399,.64+random()*.34,.016+random()*.012,.14+random()*.07);
  }else if(variant===1){
    // Broad kelp rises from one holdfast; ruffled edges and raised stipes are part of the mesh.
    for(let leaf=0;leaf<4;leaf++)blade(leaf*2.399,.69+random()*.27,.065+random()*.025,.12+random()*.05);
  }else{
    // A branched algal frond has paired lateral blades attached along each central stipe.
    for(let stem=0;stem<3;stem++){
      const angle=stem*2.399;blade(angle,.86,.008,.012);
      for(let level=1;level<=6;level++)for(const side of [-1,1]){
        const base=level*.115;blade(angle+side*.25,.12,.023,.02,base,side*(.19-level*.013));
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.form=['strap-leaved eelgrass','ruffled broad kelp','paired branching algae'][variant];
  return geometry;
}

export function Seaweed({ runtime, paused, quality }: EnvironmentProps) {
  const seaweed = useMemo(() => {
    const sites = createSeaweedLayout();
    const time = { value: 0 };
    const transform = new Object3D();
    const batches = [0, 1, 2].map(variant => {
      const entries = sites.filter(site => site.variant === variant);
      const geometry = createSeaweedGeometry(variant);
      const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0, side: DoubleSide });
      material.onBeforeCompile = shader => {
        shader.uniforms.seaweedTime = time;
        shader.vertexShader = `uniform float seaweedTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
          float phase = instanceMatrix[3].x * .73 + instanceMatrix[3].z * .41;
          float tip = position.y * position.y;
          transformed.x += (sin(seaweedTime * .44 + phase) * .065 + sin(seaweedTime * .23 - phase) * .025) * tip;
          transformed.z += cos(seaweedTime * .31 + phase) * .055 * tip;
        `);
      };
      material.customProgramCacheKey = () => 'sheltered-seaweed-v1';
      const mesh = new InstancedMesh(geometry, material, entries.length);
      mesh.name = `submerged-seaweed-${variant}`;
      mesh.raycast = () => {};
      mesh.frustumCulled = false;
      entries.forEach((site, index) => {
        transform.position.set(site.x, site.y, site.z);
        transform.rotation.set(0, site.rotation, 0);
        transform.scale.set(site.width, site.height, site.width);
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      return { mesh, geometry, material, count: entries.length };
    });
    return { batches, time, timer: undefined as ReturnType<typeof setTimeout> | undefined };
  }, []);
  useEffect(() => {
    clearTimeout(seaweed.timer);
    return () => {
      seaweed.timer = setTimeout(() => seaweed.batches.forEach(batch => { batch.geometry.dispose(); batch.material.dispose(); batch.mesh.dispose(); }), 0);
    };
  }, [seaweed]);
  useEffect(() => {
    const fraction = quality === 'high' ? 1 : quality === 'medium' ? 0.75 : 0.5;
    seaweed.batches.forEach(batch => { batch.mesh.count = Math.ceil(batch.count * fraction); });
  }, [quality, seaweed]);
  useFrame(() => { if (!paused) seaweed.time.value = runtime.current.elapsed; });
  return <group name="sheltered-seaweed-beds" dispose={null}>{seaweed.batches.map(batch => <primitive key={batch.mesh.name} object={batch.mesh} />)}</group>;
}
