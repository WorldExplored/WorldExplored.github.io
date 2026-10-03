'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, DoubleSide, Group, InstancedMesh, MeshStandardMaterial, Object3D, RingGeometry, SphereGeometry } from 'three';
import type { QualityTier } from '../../content/world';
import type { EnvironmentProps } from './Water';
import { createFishBodyGeometry, createFishTailGeometry } from './CoastalLife';
import { createPelagicAnatomy } from './pelagicFishModels';
import { createPelagicFish, PELAGIC_COUNTS, updatePelagicFish, type PelagicSpecies } from './pelagicFishState';
import { harborWaterHeight } from './waterSurface';

export function createPelagicLife(){
  const root=new Group();root.name='marlin-flying-fish-and-lionfish';
  const states=createPelagicFish(),material=new MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.43,metalness:.08,side:DoubleSide});
  const meshes:InstancedMesh[]=[],geometries:BufferGeometry[]=[];
  const batch=(name:string,geometry:BufferGeometry,count:number,paint=material)=>{const mesh=new InstancedMesh(geometry,paint,count);mesh.name=name;mesh.raycast=()=>undefined;mesh.frustumCulled=false;meshes.push(mesh);geometries.push(geometry);root.add(mesh);return mesh;};
  const groups=(Object.keys(PELAGIC_COUNTS)as PelagicSpecies[]).map(species=>{
    const members=states.filter(fish=>fish.species===species),anatomy=species==='cave-silver'?{body:createFishBodyGeometry(1),tail:createFishTailGeometry(1),fins:[],tailX:-.40,finRoot:[.11,-.015,.037]as [number,number,number]}:createPelagicAnatomy(species);
    return {species,members,anatomy,body:batch(`${species}-bodies`,anatomy.body,members.length),tail:batch(`${species}-tails`,anatomy.tail,members.length),fins:anatomy.fins.map((geometry,i)=>batch(`${species}-pectoral-${i}`,geometry,members.length))};
  });
  const splashMaterial=new MeshStandardMaterial({color:'#dcffff',transparent:true,opacity:.7,roughness:.45,depthWrite:false,side:DoubleSide});
  const spray=batch('flying-fish-reentry-droplets',new SphereGeometry(1,5,4),18*5,splashMaterial),rings=batch('flying-fish-reentry-ripples',new RingGeometry(.83,1,16).rotateX(-Math.PI/2),18,splashMaterial);
  spray.renderOrder=4;rings.renderOrder=4;
  const transform=new Object3D(),detail=new Object3D();let quality:QualityTier='high',time=0;
  function write(){
    for(const group of groups){
      const count=Math.min(group.members.length,PELAGIC_COUNTS[group.species][quality]);
      for(let i=0;i<count;i++){
        const fish=group.members[i];transform.position.copy(fish.position);transform.rotation.set(0,fish.heading,fish.pitch,'YXZ');transform.scale.setScalar(fish.size);transform.updateMatrix();group.body.setMatrixAt(i,transform.matrix);
        detail.position.set(group.anatomy.tailX,0,0);detail.rotation.set(0,fish.tail,0);detail.scale.setScalar(1);detail.updateMatrix();detail.matrix.premultiply(transform.matrix);group.tail.setMatrixAt(i,detail.matrix);
        group.fins.forEach((fin,j)=>{
          const side=j?1:-1,root=group.anatomy.finRoot;detail.position.set(root[0],root[1],side*root[2]);
          const fold=group.species==='flying'?1-fish.finSpread:0;
          detail.rotation.set(side*(fold*1.15+(group.species==='lionfish'?Math.sin(time*1.8+i)*.13:.025)),side*fold*-.45,0);detail.scale.setScalar(1);detail.updateMatrix();detail.matrix.premultiply(transform.matrix);fin.setMatrixAt(i,detail.matrix);
        });
      }
      for(const mesh of [group.body,group.tail,...group.fins]){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;}
    }
    let drops=0,ripples=0;
    for(const fish of states){
      if(fish.species!=='flying'||fish.index>=PELAGIC_COUNTS.flying[quality]||fish.splashAge>1.5)continue;
      const age=fish.splashAge;
      transform.position.set(fish.splash.x,harborWaterHeight(fish.splash.x,fish.splash.z,time)+.012,fish.splash.z);transform.rotation.set(0,0,0);transform.scale.setScalar((.06+age*.30)*Math.max(.001,1-age/1.5));transform.updateMatrix();rings.setMatrixAt(ripples++,transform.matrix);
      for(let i=0;i<(quality==='low'?2:5);i++){
        const elapsed=age-i*.012,y=fish.splash.y+elapsed*(1.5+i*.11)-4.905*elapsed*elapsed;if(elapsed<0||elapsed>.42||y<harborWaterHeight(fish.splash.x,fish.splash.z,time))continue;
        const a=i*2.399,r=elapsed*.36;transform.position.set(fish.splash.x+Math.cos(a)*r,y,fish.splash.z+Math.sin(a)*r);transform.scale.set(.013,.030,.013);transform.updateMatrix();spray.setMatrixAt(drops++,transform.matrix);
      }
    }
    spray.count=drops;rings.count=ripples;spray.instanceMatrix.needsUpdate=true;rings.instanceMatrix.needsUpdate=true;
  }
  function update(seconds:number,paused=false){if(paused)return;time=Math.max(0,seconds);updatePelagicFish(states,time);write();}
  function setQuality(next:QualityTier){quality=next;write();}
  let timer:ReturnType<typeof setTimeout>|undefined;
  function dispose(){geometries.forEach(g=>g.dispose());meshes.forEach(m=>m.dispose());material.dispose();splashMaterial.dispose();}
  write();return{root,states,meshes,update,setQuality,dispose,retain(){clearTimeout(timer);return()=>{timer=setTimeout(dispose,0);};}};
}
export function PelagicLife({runtime,paused,quality}:EnvironmentProps){
  const life=useMemo(()=>createPelagicLife(),[]);
  const inspection=useMemo(()=>{if(typeof window==='undefined'||!['localhost','127.0.0.1'].includes(window.location.hostname))return null;const value=new URLSearchParams(window.location.search).get('qaFishTime');return value!==null&&Number.isFinite(Number(value))?Math.max(0,Number(value)):null;},[]);
  useEffect(()=>life.retain(),[life]);useEffect(()=>life.setQuality(quality),[life,quality]);
  useFrame(()=>life.update(inspection??runtime.current.activeElapsed,inspection===null&&paused));
  return <primitive object={life.root} dispose={null}/>;
}
