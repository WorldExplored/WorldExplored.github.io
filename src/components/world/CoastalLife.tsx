'use client';

// Frame callbacks update persistent Three.js objects outside React rendering.
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, InstancedMesh, Mesh, MeshPhysicalMaterial, Object3D, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createLandscapePlan, ISLANDS, islandContour, landDistance, pathHeight, seededRandom, terrainHeight } from './terrain';
import type { EnvironmentProps } from './Water';

export function createFishHomes() {
  const random = seededRandom(815); const homes: [number, number][] = [];
  for (let index = 0; index < 36; index++) {
    const island = ISLANDS[index % 3]; const angle = random() * Math.PI * 2; const contour = islandContour(island, angle);
    const x = island.x + Math.cos(angle) * (island.rx * contour + 3.2); const z = island.z + Math.sin(angle) * (island.rz * contour + 3.2);
    if (landDistance(x, z) < -.8) homes.push([x, z]);
  }
  return homes;
}

function createCoastalLife() {
  const rails: BufferGeometry[] = [];
  for (const path of createLandscapePlan().paths.filter(path => path.bridge)) {
    for (const side of [-1, 1]) {
      const points: Vector3[] = [];
      for (let segment = 1; segment < path.points.length; segment++) {
        const a = path.points[segment - 1]; const b = path.points[segment]; const length = Math.hypot(b.x - a.x, b.z - a.z);
        const nx = -(b.z - a.z) / length * path.width / 2 * side; const nz = (b.x - a.x) / length * path.width / 2 * side;
        for (let step = 0; step <= 16; step++) {
          const x = a.x + (b.x - a.x) * step / 16 + nx; const z = a.z + (b.z - a.z) * step / 16 + nz; const y = pathHeight(path, x, z);
          points.push(new Vector3(x, y + .65, z));
          if (step % 8 === 0) rails.push(new TubeGeometry(new CatmullRomCurve3([new Vector3(x, y, z), new Vector3(x, y + .3, z), new Vector3(x, y + .65, z)]), 4, .025, 5, false));
        }
      }
      rails.push(new TubeGeometry(new CatmullRomCurve3(points), 96, .035, 6, false));
    }
    const first = path.points[0]; const last = path.points[path.points.length - 1];
    const midX = (first.x + last.x) / 2; const midZ = (first.z + last.z) / 2;
    for (const side of [-1, 1]) {
      const dx = last.x - first.x; const dz = last.z - first.z; const length = Math.hypot(dx, dz); const nx = -dz / length * .45 * side; const nz = dx / length * .45 * side;
      rails.push(new TubeGeometry(new CatmullRomCurve3([new Vector3(first.x + nx, .35, first.z + nz), new Vector3(midX + nx, 1.1, midZ + nz), new Vector3(last.x + nx, .35, last.z + nz)]), 48, .09, 8, false));
    }
  }
  const railGeometry = mergeGeometries(rails)!; rails.forEach(geometry => geometry.dispose());
  const railMaterial = new MeshPhysicalMaterial({ color: '#f1fff3', metalness: .08, roughness: .22, clearcoat: 1 });
  const bridges = new Mesh(railGeometry, railMaterial); bridges.name = 'coastal-bridge-rails'; bridges.castShadow = true;
  const body = new SphereGeometry(1, 12, 8).scale(.25, .07, .075);
  const tail = new BufferGeometry(); tail.setAttribute('position', new Float32BufferAttribute([-.18,0,0,-.35,0,-.1,-.35,0,.1,-.18,0,0,-.35,.03,.1,-.35,.03,-.1],3)); tail.computeVertexNormals();
  // Match the sphere's vertex attributes before merging the small tapered tail.
  tail.setAttribute('uv',new Float32BufferAttribute(new Float32Array(12),2)); tail.setIndex([0,1,2,3,4,5]);
  const fishGeometry = mergeGeometries([body,tail])!; body.dispose(); tail.dispose();
  const fishMaterial = new MeshPhysicalMaterial({ color:'#ffffff',roughness:.28,clearcoat:1,metalness:.04 });
  const homes = createFishHomes(); const fish = new InstancedMesh(fishGeometry,fishMaterial,homes.length); fish.name='shallow-water-fish'; fish.frustumCulled=false;
  const color=new Color(); homes.forEach((_,index)=>{color.set(index%3?'#14a9b1':'#ffc151');fish.setColorAt(index,color);});
  return { bridges,fish,homes,scatter:homes.map(()=>new Vector3()),transform:new Object3D(), timer:undefined as ReturnType<typeof setTimeout>|undefined,dispose(){railGeometry.dispose();railMaterial.dispose();fishGeometry.dispose();fishMaterial.dispose();fish.dispose();} };
}

export function CoastalLife({runtime,paused,quality}:EnvironmentProps) {
  const life=useMemo(() => createCoastalLife(), []);
  useEffect(()=>{clearTimeout(life.timer);return()=>{life.timer=setTimeout(()=>life.dispose(),0);};},[life]);
  useFrame((_,delta)=>{
    const state=runtime.current;
    life.fish.count=quality==='low'?Math.ceil(life.homes.length*.5):life.homes.length;
    life.homes.forEach(([homeX,homeZ],index)=>{
      const phase=index*2.399; const time=state.elapsed*.28+phase; const offset=life.scatter[index];
      const px=state.pointerWorld[0]; const pz=state.pointerWorld[2]; const distance=Math.hypot(homeX-px,homeZ-pz);
      if(!paused){
        const response=state.pointerActive?1-Math.min(1,distance/3):0;
        const blend=1-Math.exp(-3*Math.min(.05,delta));
        offset.x+=((homeX-px)/Math.max(distance,.3)*response*1.8-offset.x)*blend;
        offset.z+=((homeZ-pz)/Math.max(distance,.3)*response*1.8-offset.z)*blend;
      }
      let x=homeX+Math.cos(time)*.6+offset.x; let z=homeZ+Math.sin(time)*.4+offset.z;
      if(landDistance(x,z)>-.65){
        let safe=0;let outside=1;
        for(let step=0;step<10;step++){const fraction=(safe+outside)/2;if(landDistance(homeX+(x-homeX)*fraction,homeZ+(z-homeZ)*fraction)<-.65)safe=fraction;else outside=fraction;}
        x=homeX+(x-homeX)*safe;z=homeZ+(z-homeZ)*safe;
      }
      life.transform.position.set(x,Math.max(-.28,terrainHeight(x,z)+.15),z);
      life.transform.rotation.set(0,Math.atan2(-Math.cos(time)*.4,-Math.sin(time)*.6),Math.sin(time*2)*.04);
      life.transform.scale.setScalar(.8+(index%4)*.15);life.transform.updateMatrix();life.fish.setMatrixAt(index,life.transform.matrix);
    });
    life.fish.instanceMatrix.needsUpdate=true;
  });
  return <group dispose={null} name="coastal-life"><primitive object={life.bridges}/><primitive object={life.fish}/></group>;
}
