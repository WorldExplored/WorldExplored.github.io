'use client';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Object3D } from 'three';
import { clearRainCatchments, installRainCatchments } from './rainCatchments';

export function rainArchitectureStage(stage:number){return stage>=3?3:stage>=1?1:0;}

export function RainRoofRegistry({stage}:{stage:number}){
  const scene=useThree(state=>state.scene),architectureStage=rainArchitectureStage(stage);
  useEffect(()=>{
    const roots:Object3D[]=[];
    scene.traverse(object=>{
      if(object.name.startsWith('landmark-model-')||object.name.startsWith('city-building-')||object.name==='coastal-bridges'||object.name==='visitor-boat-berth')roots.push(object);
    });
    installRainCatchments(roots);
    return clearRainCatchments;
  },[scene,architectureStage]);
  return null;
}
