'use client';

/* Frame callbacks mutate retained Three.js buffers outside React rendering. */
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Points, PointsMaterial } from 'three';
import type { SceneRuntime } from '../../content/world';

const COUNT=18;

/** One bounded response pool is shared by trees, rock impacts and fish re-entry. */
export function NatureResponses({runtime,paused}:{runtime:MutableRefObject<SceneRuntime>;paused:boolean}){
  const response=useMemo(()=>{
    const positions=new Float32Array(COUNT*3),velocity=new Float32Array(COUNT*3);
    const attribute=new Float32BufferAttribute(positions,3);attribute.setUsage(DynamicDrawUsage);
    const geometry=new BufferGeometry();geometry.setAttribute('position',attribute);geometry.setDrawRange(0,0);
    const material=new PointsMaterial({color:'#d9fff2',size:.12,transparent:true,opacity:.82,depthWrite:false,blending:AdditiveBlending,sizeAttenuation:true});
    const points=new Points(geometry,material);points.name='bounded-nature-response';points.frustumCulled=false;points.raycast=()=>{};
    return{positions,velocity,attribute,geometry,material,points,serial:-1,start:-100,base:[0,0,0] as [number,number,number],kind:'tree' as SceneRuntime['nature']['kind']};
  },[]);
  useEffect(()=>()=>{response.geometry.dispose();response.material.dispose();},[response]);
  useFrame(()=>{
    const event=runtime.current.nature;
    if(event.serial!==response.serial){
      response.serial=event.serial;response.start=runtime.current.elapsed;response.base=[event.x,event.y,event.z];response.kind=event.kind;
      response.material.color.set(event.kind==='tree'?'#d6ff83':'#c9ffff');response.geometry.setDrawRange(0,COUNT);
      for(let i=0;i<COUNT;i++){
        const angle=i*2.399963+event.serial*.37,radius=.04+(i%5)*.028;
        response.positions.set([event.x+Math.cos(angle)*radius,event.y,event.z+Math.sin(angle)*radius],i*3);
        response.velocity.set([Math.cos(angle)*(.18+(i%4)*.07),event.kind==='tree' ? .22+(i%5)*.055 : .55+(i%6)*.12,Math.sin(angle)*(.18+(i%3)*.08)],i*3);
      }
      response.attribute.needsUpdate=true;
    }
    const age=runtime.current.elapsed-response.start;
    if(age<0||age>1.65){response.geometry.setDrawRange(0,0);return;}
    response.material.opacity=.82*Math.max(0,1-age/1.65);
    if(paused)return;
    for(let i=0;i<COUNT;i++){
      const j=i*3;response.positions[j]=response.base[0]+response.velocity[j]*age;response.positions[j+1]=response.base[1]+response.velocity[j+1]*age-(response.kind==='tree' ? .03 : 1.6)*age*age;response.positions[j+2]=response.base[2]+response.velocity[j+2]*age;
    }
    response.attribute.needsUpdate=true;
  });
  return <primitive object={response.points} dispose={null}/>;
}
