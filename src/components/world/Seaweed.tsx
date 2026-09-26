'use client';

// Fiber owns these persistent meshes and shader uniforms outside React rendering.
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { createLandscapePlan, distanceToSegment, landDistance, seededRandom, terrainMeshHeight, ISLANDS, islandContour, type LandscapePlan } from './terrain';
import { coastExposure } from './waves';
import { coastalCaveClearance } from './coastalCaveLayout';
import { createClusteredMarineLOD } from './ClusteredMarineLOD';
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
  { x: -70, z: -44, radius: 4.8 },
  { x: -36, z: -14, radius: 5.1 },
  { x: -29, z: -15, radius: 5.1 },
  { x: -46, z: -94, radius: 5.4 },
  { x: -25, z: 20, radius: 5.5 },
  { x: 30, z: 22, radius: 5.5 },
  { x: 44, z: -88, radius: 5.6 },
  { x: -20, z: -20, radius: 5.5 },
  { x: -84, z: -42, radius: 5.1 },
  { x: -72, z: -30, radius: 5.2 },
  { x: 30, z: -18, radius: 5.4 },
  { x: 48, z: -78, radius: 5.6 },
  { x: 30, z: -100, radius: 5.3 },
  { x: -30, z: -102, radius: 5.1 },
] as const;
export const SEAWEED_REACH = 0.62;
export const SEAWEED_FORMS = ['strap-leaved eelgrass', 'ruffled broad kelp', 'paired branching algae', 'twisting ribbon kelp', 'pleated sea fan', 'low seagrass turf', 'forked bladderwrack', 'serrated red algae'] as const;

export function seaweedSiteClear(x: number, z: number, plan: LandscapePlan, sheltered = true) {
  if (coastalCaveClearance(x,z,SEAWEED_REACH) <= 0) return false;
  const distance = landDistance(x, z);
  const seabed = terrainMeshHeight(x, z);
  if (distance > -1.6 || distance < -4.7 || seabed > -0.66 || seabed < -2.7 || coastExposure(x, z, distance) > (sheltered ? .3 : .7)) return false;
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
  const occupied = new Map<string, SeaweedSite[]>(), cellSize = .5;
  const remember = (site: SeaweedSite) => {
    const key = `${Math.floor(site.x / cellSize)},${Math.floor(site.z / cellSize)}`;
    const cell = occupied.get(key) ?? [];
    cell.push(site); occupied.set(key, cell);
  };
  const nearRoot = (x: number, z: number, spacing: number, include: (site: SeaweedSite) => boolean = () => true) => {
    for (let ix = Math.floor((x - spacing) / cellSize); ix <= Math.floor((x + spacing) / cellSize); ix++)
      for (let iz = Math.floor((z - spacing) / cellSize); iz <= Math.floor((z + spacing) / cellSize); iz++)
        for (const site of occupied.get(`${ix},${iz}`) ?? [])
          if (include(site) && Math.hypot(x - site.x, z - site.z) < spacing) return true;
    return false;
  };
  const clumps = SEAWEED_COVES.map(cove => Array.from({ length: 8 }, () => {
    const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * cove.radius * .8;
    return { x: cove.x + Math.cos(angle) * radius, z: cove.z + Math.sin(angle) * radius, radius: .65 + random() * 1.65 };
  }));
  // Round-robin ordering keeps complete beds and all forms on the low tier.
  for (let round = 0; round < 200; round++) {
    SEAWEED_COVES.forEach((cove, coveIndex) => {
      if((coveIndex===7||coveIndex===9)&&round>=100)return;
      for (let attempt = 0; attempt < 80; attempt++) {
        const clump = clumps[coveIndex][Math.floor(random() * clumps[coveIndex].length)];
        const angle = random() * Math.PI * 2, radius = Math.pow(random(), .7) * clump.radius;
        const x = clump.x + Math.cos(angle) * radius, z = clump.z + Math.sin(angle) * radius;
        if (Math.hypot(x - cove.x, z - cove.z) > cove.radius || !seaweedSiteClear(x, z, plan)
          || nearRoot(x, z, .16)) continue;
        const y = terrainMeshHeight(x, z) - .025;
        const variant = Math.floor(random() * SEAWEED_FORMS.length);
        const height = Math.min((variant === 5 ? .26 : .7) + random() * (variant === 5 ? .35 : 1.1), -.32 - y);
        const site = { x, y, z, height, width: .68 + random() * .5, spread: .7 + random() * .45,
          rotation: random() * Math.PI * 2, variant, cove: coveIndex, tint: random() };
        sites.push(site); remember(site);
        break;
      }
    });
  }
  const strays:SeaweedSite[]=[];
  for(let round=0;round<150;round++)for(let islandIndex=0;islandIndex<ISLANDS.length;islandIndex++){
    const island=ISLANDS[islandIndex];
    for(let attempt=0;attempt<60;attempt++){
      const angle=random()*Math.PI*2,contour=islandContour(island,angle),offshore=1.8+random()*3.4;
      const x=island.x+Math.cos(angle)*(island.rx*contour+offshore),z=island.z+Math.sin(angle)*(island.rz*contour+offshore);
      if(!seaweedSiteClear(x,z,plan,false)||nearRoot(x,z,.28,site=>site.cove>=0)||nearRoot(x,z,.32,site=>site.cove<0))continue;
      const y=terrainMeshHeight(x,z)-.025,variant=[0,1,3,5][Math.floor(random()*4)];
      const site={x,y,z,height:Math.min(.35+random()*.85,-.32-y),width:.48+random()*.43,spread:.7+random()*.4,rotation:random()*Math.PI*2,variant,cove:-1-islandIndex,tint:random()};
      strays.push(site);remember(site);break;
    }
  }
  // Distributed strays remain visible at every quality tier instead of being a trailing batch.
  const mixed:SeaweedSite[]=[];
  for(let i=0;i<Math.max(sites.length,strays.length);i++){if(sites[i])mixed.push(sites[i]);if(strays[i])mixed.push(strays[i]);}
  return mixed;
}

export function createSeaweedGeometry(variant: number, seed = 0, detail: 'near' | 'far' | 'distant' = 'near') {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const random = seededRandom(694 + variant + seed * 71);
  const tint = new Color(['#547e52', '#8b8c46', '#618552', '#a79550', '#74966b', '#537d47', '#858847', '#a57367'][variant % 8]);
  function blade(angle:number,length:number,breadth:number,lean:number,base=0,side=0) {
    const start=positions.length/3;
    const segments = detail !== 'near' ? 2 : variant === 2 || variant === 6 || variant === 7 ? 3 : 4;
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
      if(row&&rib){const n=start+row*3+rib;if(row<segments)indices.push(n,n-3,n-1);if(row>1)indices.push(n-1,n-3,n-4);}
    }
  }
  if(detail==='distant') {
    const leaves=[7,5,3,6,5,10,3,4][variant%8];
    for(let leaf=0;leaf<leaves;leaf++) {
      const branched=variant===2||variant===6||variant===7;
      blade(variant===4?.4+(leaf%2)*Math.PI:leaf*2.399,.62+random()*.36,
        branched?.065:variant===1?.085:variant===4?.055:variant===5?.012:.026,
        branched?.10:variant===4?.02:.16,0,variant===4?(leaf-2)*.12:0);
    }
  } else if(variant===0){
    // Eelgrass has parallel strap leaves, narrow midribs and gently drooping tips.
    for(let leaf=0;leaf<12;leaf++)blade(leaf*2.399,.64+random()*.34,.016+random()*.012,.14+random()*.07);
  }else if(variant===1){
    // Broad kelp rises from one holdfast; ruffled edges and raised stipes are part of the mesh.
    for(let leaf=0;leaf<7;leaf++)blade(leaf*2.399,.69+random()*.27,.065+random()*.025,.12+random()*.05);
  }else if(variant===2){
    // A branched algal frond has paired lateral blades attached along each central stipe.
    for(let stem=0;stem<3;stem++){
      const angle=stem*2.399;blade(angle,.86,.008,.012);
      for(let level=1;level<=6;level++)for(const side of [-1,1]){
        const base=level*.115;blade(angle+side*.25,.12,.023,.02,base,side*(.19-level*.013));
      }
    }
  }
  if(detail!=='distant'&&variant===3){
    for(let leaf=0;leaf<10;leaf++) blade(leaf*2.399,.65+random()*.32,.027+random()*.022,.22+random()*.08);
  }else if(detail!=='distant'&&variant===4){
    // A fan shares a holdfast and spreads into pleated lobes rather than repeating upright straps.
    for(let leaf=0;leaf<9;leaf++) blade(.4+(leaf%2)*Math.PI,.38+Math.sin(leaf/8*Math.PI)*.39,.035+random()*.028,.02,0,(leaf-4)*.075);
  }else if(detail!=='distant'&&variant===5){
    for(let leaf=0;leaf<21;leaf++) blade(leaf*2.399,.32+random()*.42,.008+random()*.01,.09+random()*.18);
  }else if(detail!=='distant'&&variant===6){
    for(let stem=0;stem<3;stem++){
      const angle=stem*2.399;blade(angle,.88,.013,.04);
      for(let level=1;level<=4;level++)for(const side of [-1,1]){
        blade(angle+side*.18,.32-level*.018,.02,.02,level*.13,side*(.28-level*.025));
      }
    }
  }else if(detail!=='distant'&&variant===7){
    for(let stem=0;stem<4;stem++){
      const angle=stem*2.399;blade(angle,.75+random()*.2,.018,.05);
      for(let level=1;level<=4;level++)for(const side of [-1,1])blade(angle,.18,.03,.02,level*.14,side*(.22-level*.015));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.detail=detail;
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
      mesh.frustumCulled = true;
      entries.forEach((site, index) => {
        transform.position.set(site.x, site.y, site.z);
        transform.rotation.set(0, site.rotation, 0);
        transform.scale.set(site.width, site.height, site.width * site.spread);
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
        mesh.setColorAt(index, new Color().setHSL(.10 + site.tint * .1, .13 + site.tint * .12, .72 + site.tint * .22));
      });
      mesh.computeBoundingSphere(); if(mesh.boundingSphere)mesh.boundingSphere.radius += .3;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      const farGeometry = createSeaweedGeometry(variant, 0, 'distant');
      const lod=createClusteredMarineLOD(mesh,farGeometry);
      return { mesh, geometry, farGeometry, material, lod, count: entries.length };
    });
    return { batches, time, timer: undefined as ReturnType<typeof setTimeout> | undefined };
  }, []);
  useEffect(() => {
    clearTimeout(seaweed.timer);
    return () => {
      seaweed.timer = setTimeout(() => seaweed.batches.forEach(batch => { batch.geometry.dispose(); batch.farGeometry.dispose(); batch.material.dispose(); batch.mesh.dispose(); batch.lod.dispose(); }), 0);
    };
  }, [seaweed]);
  useEffect(() => {
    const fraction = quality === 'high' ? 1 : quality === 'medium' ? 0.75 : 0.5;
    seaweed.batches.forEach(batch => batch.lod.setCount(Math.ceil(batch.count * fraction)));
  }, [quality, seaweed]);
  useFrame(({camera}) => {
    for(const batch of seaweed.batches)batch.lod.update(camera.position,quality==='high'?30:quality==='medium'?24:16);
    if (!paused) seaweed.time.value = runtime.current.elapsed;
  });
  return <group name="sheltered-seaweed-beds" dispose={null}>{seaweed.batches.flatMap(batch => [<primitive key={batch.mesh.name} object={batch.mesh} />, <primitive key={batch.lod.far.name} object={batch.lod.far}/>])}</group>;
}

/** Four growth habits share LOD and animation but have distinct branching anatomy. */
export function createForestKelpGeometry(variant:number, detail:'near'|'far'='near') {
  const positions:number[]=[],colors:number[]=[],indices:number[]=[],random=seededRandom(1849+variant);
  const stem=(t:number)=>({x:Math.sin(t*(variant===3?7:5)+variant)*.07*t,z:Math.sin(t*7+variant*.9)*.05*t});
  const tint=new Color(['#728b45','#9a8b42','#728047','#856249'][variant]);
  const vertex=(x:number,y:number,z:number,leaf=false)=>{
    positions.push(x,y,z);const light=.60+y*.40;
    colors.push(tint.r*light*(leaf?1:.84),tint.g*light,tint.b*light*(leaf?1:.79));
  };
  const rings=detail==='near'?10:5,sides=detail==='near'?5:4;
  for(let ring=0;ring<=rings;ring++)for(let side=0;side<sides;side++){
    const t=ring/rings,a=side/sides*Math.PI*2,c=stem(t),r=(variant===2?.031:.015)*(1-t*.7);
    vertex(c.x+Math.cos(a)*r,t,c.z+Math.sin(a)*r);
    if(ring){const i=ring*sides+side,next=ring*sides+(side+1)%sides;indices.push(i,next,i-sides,next,next-sides,i-sides);}
  }
  const rows=detail==='near'?3:2;
  function blade(base:number,a:number,length:number,breadth:number,rise:number,droop:number){
    const c=stem(base),start=positions.length/3;
    for(let row=0;row<=rows;row++)for(let rib=0;rib<3;rib++){
      const t=row/rows,ruffle=variant===1?1+.24*Math.sin(t*20+a):1+.12*Math.sin(t*25+a);
      const lateral=(rib-1)*breadth*Math.sin(t*Math.PI)*ruffle,along=length*t;
      const y=base+Math.sin(t*Math.PI)*rise-t*t*droop;
      vertex(c.x+Math.cos(a)*along-Math.sin(a)*lateral,y+(rib===1?.008*Math.sin(t*Math.PI):0),c.z+Math.sin(a)*along+Math.cos(a)*lateral,true);
      if(row&&rib){const n=start+row*3+rib;if(row<rows)indices.push(n,n-3,n-1);if(row>1)indices.push(n-1,n-3,n-4);}
    }
  }
  let blades=0;
  if(variant===0){
    // Feather kelp has offset, unequal paired pinnae and occasional broken gaps.
    for(let level=0;level<12;level++)for(let side=0;side<2;side++){
      if(level===3&&side===1||level===8&&side===0)continue;
      const base=.11+level*.069+(random()-.5)*.026;
      blade(base,level*.55+side*Math.PI+(random()-.5)*.5,.14+random()*.17,.035+random()*.03,.025,.027);blades++;
    }
  }else if(variant===1){
    // Sparse broad laminae hang in a canopy, rather than a regular fern ladder.
    for(let leaf=0;leaf<7;leaf++){
      blade(.28+leaf*.086+random()*.035,leaf*2.399+random()*.7,.23+random()*.12,.075+random()*.065,.12,.10+random()*.06);blades++;
    }
  }else if(variant===2){
    // A real gas bladder and a crown of long straps distinguish bull kelp.
    const start=positions.length/3,latitudes=detail==='near'?6:4,longitudes=detail==='near'?8:6,c=stem(.76);
    for(let row=0;row<=latitudes;row++)for(let side=0;side<longitudes;side++){
      const t=row/latitudes,a=side/longitudes*Math.PI*2,r=Math.sin(t*Math.PI)*.073;
      vertex(c.x+Math.cos(a)*r,.66+t*.19,c.z+Math.sin(a)*r,true);
      if(row){const i=start+row*longitudes+side,next=start+row*longitudes+(side+1)%longitudes;indices.push(i,next,i-longitudes,next,next-longitudes,i-longitudes);}
    }
    for(let leaf=0;leaf<6;leaf++){blade(.79+random()*.03,leaf*2.399+random()*.6,.25+random()*.095,.045+random()*.037,.11,.15+random()*.11);blades++;}
  }else{
    // Unpaired bronze ribbons twist away from an uneven branching stipe.
    for(let leaf=0;leaf<9;leaf++){blade(.16+leaf*.087+random()*.022,leaf*2.0+random(),.16+random()*.20,.028+random()*.035,.07,.07+random()*.05);blades++;}
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.stem={rings,sides};geometry.userData.blades=blades;
  geometry.userData.form=['offset feather kelp','broad hanging canopy kelp','bull kelp with gas bladder','twining bronze ribbon kelp'][variant%4];return geometry;
}
