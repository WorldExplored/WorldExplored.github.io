'use client';

// Fiber owns these persistent meshes and shader uniforms outside React rendering.
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { createLandscapePlan, distanceToSegment, landDistance, seededRandom, terrainMeshHeight, ISLANDS, islandContour, type LandscapePlan } from './terrain';
import { coastExposure } from './waves';
import type { EnvironmentProps } from './Water';

export interface SeaweedSite {
  x: number; y: number; z: number; height: number; width: number; rotation: number; variant: number; cove: number; tint: number; spread: number;
}

// Overlapping clumps form broken meadow edges; exposed surf and landing approaches stay open.
export const SEAWEED_COVES = [
  { x: -13, z: 11, radius: 5.6 },
  { x: 9, z: 13, radius: 5.8 },
  { x: 18, z: 1, radius: 4.9 },
  { x: 18, z: -13, radius: 5.2 },
  { x: -2, z: -25, radius: 5.6 },
  { x: -76, z: -45, radius: 4.5 },
  { x: -67, z: -38, radius: 4.8 },
  { x: -36, z: -14, radius: 5.1 },
  { x: -29, z: -15, radius: 5.1 },
  { x: -40, z: -90, radius: 5.4 },
] as const;
export const SEAWEED_REACH = 0.62;
export const SEAWEED_FORMS = ['strap-leaved eelgrass', 'ruffled broad kelp', 'paired branching algae', 'twisting ribbon kelp', 'pleated sea fan', 'low seagrass turf', 'forked bladderwrack', 'serrated red algae'] as const;

export function seaweedSiteClear(x: number, z: number, plan: LandscapePlan, sheltered = true) {
  const distance = landDistance(x, z);
  const seabed = terrainMeshHeight(x, z);
  if (distance > -1.6 || distance < -4.7 || seabed > -0.66 || seabed < -2.0 || coastExposure(x, z, distance) > (sheltered ? .3 : .7)) return false;
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
  const clumps = SEAWEED_COVES.map(cove => Array.from({ length: 8 }, () => {
    const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * cove.radius * .8;
    return { x: cove.x + Math.cos(angle) * radius, z: cove.z + Math.sin(angle) * radius, radius: .65 + random() * 1.65 };
  }));
  // Round-robin ordering keeps complete beds and all forms on the low tier.
  for (let round = 0; round < 114; round++) {
    SEAWEED_COVES.forEach((cove, coveIndex) => {
      for (let attempt = 0; attempt < 80; attempt++) {
        const clump = clumps[coveIndex][Math.floor(random() * clumps[coveIndex].length)];
        const angle = random() * Math.PI * 2, radius = Math.pow(random(), .7) * clump.radius;
        const x = clump.x + Math.cos(angle) * radius, z = clump.z + Math.sin(angle) * radius;
        if (Math.hypot(x - cove.x, z - cove.z) > cove.radius || !seaweedSiteClear(x, z, plan)
          || sites.some(site => Math.hypot(x - site.x, z - site.z) < .19)) continue;
        const y = terrainMeshHeight(x, z) - .025;
        const variant = Math.floor(random() * SEAWEED_FORMS.length);
        const height = Math.min((variant === 5 ? .26 : .55) + random() * (variant === 5 ? .35 : .85), -.32 - y);
        sites.push({ x, y, z, height, width: .68 + random() * .5, spread: .7 + random() * .45,
          rotation: random() * Math.PI * 2, variant, cove: coveIndex, tint: random() });
        break;
      }
    });
  }
  const strays:SeaweedSite[]=[];
  for(let round=0;round<72;round++)for(let islandIndex=0;islandIndex<ISLANDS.length;islandIndex++){
    const island=ISLANDS[islandIndex];
    for(let attempt=0;attempt<60;attempt++){
      const angle=random()*Math.PI*2,contour=islandContour(island,angle),offshore=1.8+random()*3.4;
      const x=island.x+Math.cos(angle)*(island.rx*contour+offshore),z=island.z+Math.sin(angle)*(island.rz*contour+offshore);
      if(!seaweedSiteClear(x,z,plan,false)||sites.some(site=>Math.hypot(x-site.x,z-site.z)<.28)||strays.some(site=>Math.hypot(x-site.x,z-site.z)<.42))continue;
      const y=terrainMeshHeight(x,z)-.025,variant=[0,1,3,5][Math.floor(random()*4)];
      strays.push({x,y,z,height:Math.min(.25+random()*.62,-.32-y),width:.48+random()*.43,spread:.7+random()*.4,rotation:random()*Math.PI*2,variant,cove:-1-islandIndex,tint:random()});break;
    }
  }
  // Distributed strays remain visible at every quality tier instead of being a trailing batch.
  const mixed:SeaweedSite[]=[];
  for(let i=0;i<Math.max(sites.length,strays.length);i++){if(sites[i])mixed.push(sites[i]);if(strays[i])mixed.push(strays[i]);}
  return mixed;
}

export function createSeaweedGeometry(variant: number, seed = 0) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const random = seededRandom(694 + variant + seed * 71);
  const tint = new Color(['#547e52', '#8b8c46', '#618552', '#a79550', '#74966b', '#537d47', '#858847', '#a57367'][variant % 8]);
  function blade(angle:number,length:number,breadth:number,lean:number,base=0,side=0) {
    const start=positions.length/3;
    const segments = variant === 2 || variant === 6 || variant === 7 ? 4 : 8;
    for(let row=0;row<=segments;row++)for(let rib=0;rib<=2;rib++){
      const t=row/segments,v=rib-1;
      const edge=variant===1||variant===7?1+Math.sin(t*(variant===7?65:39)+angle)*.22:1;
      const width=Math.pow(Math.sin(t*Math.PI),variant===0?.45:.75)*breadth*edge;
      const along=lean*t*t+side*t+Math.sin(t*6+angle)*t*.018;
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
  }else if(variant===2){
    // A branched algal frond has paired lateral blades attached along each central stipe.
    for(let stem=0;stem<3;stem++){
      const angle=stem*2.399;blade(angle,.86,.008,.012);
      for(let level=1;level<=6;level++)for(const side of [-1,1]){
        const base=level*.115;blade(angle+side*.25,.12,.023,.02,base,side*(.19-level*.013));
      }
    }
  }
  if(variant===3){
    for(let leaf=0;leaf<6;leaf++) blade(leaf*2.399,.65+random()*.32,.027+random()*.022,.22+random()*.08);
  }else if(variant===4){
    // A fan shares a holdfast and spreads into pleated lobes rather than repeating upright straps.
    for(let leaf=0;leaf<9;leaf++) blade(.4+(leaf%2)*Math.PI,.38+Math.sin(leaf/8*Math.PI)*.39,.035+random()*.028,.02,0,(leaf-4)*.075);
  }else if(variant===5){
    for(let leaf=0;leaf<13;leaf++) blade(leaf*2.399,.32+random()*.42,.008+random()*.01,.09+random()*.18);
  }else if(variant===6){
    for(let stem=0;stem<3;stem++){
      const angle=stem*2.399;blade(angle,.88,.013,.04);
      for(let level=1;level<=4;level++)for(const side of [-1,1]){
        blade(angle+side*.18,.32-level*.018,.02,.02,level*.13,side*(.28-level*.025));
      }
    }
  }else if(variant===7){
    for(let stem=0;stem<4;stem++){
      const angle=stem*2.399;blade(angle,.75+random()*.2,.018,.05);
      for(let level=1;level<=4;level++)for(const side of [-1,1])blade(angle,.18,.03,.02,level*.14,side*(.22-level*.015));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.form=SEAWEED_FORMS[variant % SEAWEED_FORMS.length];
  return geometry;
}

export function Seaweed({ runtime, paused, quality }: EnvironmentProps) {
  const seaweed = useMemo(() => {
    const sites = createSeaweedLayout();
    const time = { value: 0 };
    const transform = new Object3D();
    const batches = SEAWEED_FORMS.map((_, variant) => {
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
      material.customProgramCacheKey = () => 'sheltered-seaweed-v2';
      const mesh = new InstancedMesh(geometry, material, entries.length);
      mesh.name = `submerged-seaweed-${variant}`;
      mesh.raycast = () => {};
      mesh.frustumCulled = false;
      entries.forEach((site, index) => {
        transform.position.set(site.x, site.y, site.z);
        transform.rotation.set(0, site.rotation, 0);
        transform.scale.set(site.width, site.height, site.width * site.spread);
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
        mesh.setColorAt(index, new Color().setHSL(.10 + site.tint * .1, .13 + site.tint * .12, .72 + site.tint * .22));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
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
