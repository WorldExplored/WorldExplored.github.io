'use client';
/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, CylinderGeometry, Group, InstancedMesh, MeshStandardMaterial, Object3D, SphereGeometry, Vector3 } from 'three';
import { combine } from './BuildingKit';
import { createIslandMeadowSites } from './IslandMeadows';
import { terrainMeshHeight } from './terrain';
import type { EnvironmentProps } from './Water';

interface MeadowInsectSite {x:number;z:number;y:number;kind:'ladybug'|'grasshopper';phase:number}
let insectSites:readonly MeadowInsectSite[]|undefined;
export function meadowInsectSites() {
  if(insectSites)return insectSites;
  const meadow=createIslandMeadowSites();
  insectSites=Array.from({length:8},(_,i)=>{
    const site=meadow[(i*631+97)%meadow.length];
    return {x:site.x,z:site.z,y:site.y,kind:i%2===0?'ladybug':'grasshopper',phase:i*31.7} as const;
  });
  return insectSites;
}
export function meadowInsectPose(elapsed:number,index:number) {
  const site=meadowInsectSites()[index],age=(elapsed+site.phase)%172,flight=site.kind==='ladybug'&&age>143&&age<153;
  const hop=site.kind==='grasshopper'&&age>126&&age<127.2;
  const travel=flight?(age-143)/10:hop?(age-126)/1.2:Math.min(1,age/100);
  const x=site.x+Math.sin(travel*Math.PI*2+index)*.12,z=site.z+Math.cos(travel*Math.PI*2+index)*.12;
  return {x,z,y:terrainMeshHeight(x,z)+.025+(flight?Math.sin(travel*Math.PI)*.42:hop?Math.sin(travel*Math.PI)*.13:0),yaw:-travel*Math.PI*2-index,flight};
}
function insectGeometry(kind:'ladybug'|'grasshopper') {
  const shell:BufferGeometry[]=[],dark:BufferGeometry[]=[],limbs:BufferGeometry[]=[];
  const sphere=(r:number,sx:number,sy:number,sz:number,x:number,y:number,z:number)=>new SphereGeometry(r,8,5).scale(sx,sy,sz).translate(x,y,z);
  const stem=(a:Vector3,b:Vector3,r:number)=>{
    const g=new CylinderGeometry(r,r,a.distanceTo(b),4,1),q=new Object3D();q.quaternion.setFromUnitVectors(new Vector3(0,1,0),b.clone().sub(a).normalize());g.applyQuaternion(q.quaternion).translate(...a.clone().add(b).multiplyScalar(.5).toArray());return g;
  };
  if(kind==='ladybug'){
    for(const side of [-1,1])shell.push(sphere(.023,.47,.58,.83,side*.006,.012,0));
    dark.push(sphere(.012,.70,.5,.6,0,.013,.019));
    for(const side of [-1,1])for(let spot=0;spot<3;spot++)dark.push(sphere(.0038,1,.25,1,side*.009,.024-spot*.001,(spot-1)*.008));
    for(const side of [-1,1])for(let leg=0;leg<3;leg++)limbs.push(stem(new Vector3(side*.006,.01,(leg-1)*.012),new Vector3(side*.023,.002,(leg-1)*.016),.0014));
  }else{
    shell.push(sphere(.028,.38,.38,1.45,0,.014,0),sphere(.012,.75,.8,.85,0,.021,.037));
    for(const side of [-1,1]){
      dark.push(sphere(.0025,1,1,1,side*.008,.026,.04));
      limbs.push(stem(new Vector3(side*.006,.012,-.019),new Vector3(side*.025,.041,-.032),.004),stem(new Vector3(side*.025,.041,-.032),new Vector3(side*.033,.002,-.054),.0018));
      for(let leg=0;leg<2;leg++)limbs.push(stem(new Vector3(side*.006,.016,leg*.012),new Vector3(side*.021,.001,leg*.018),.0015));
      limbs.push(stem(new Vector3(side*.004,.027,.046),new Vector3(side*.012,.041,.064),.0009));
    }
  }
  return [combine(shell),combine(dark),combine(limbs)];
}
export function MeadowInsects({runtime,paused}:EnvironmentProps) {
  const scene=useMemo(()=>{
    const sites=meadowInsectSites(),root=new Group(),transform=new Object3D();root.name='close-meadow-insects';root.userData.ignoreRain=true;
    const materials=[new MeshStandardMaterial({color:'#bf482e',roughness:.71}),new MeshStandardMaterial({color:'#292f27',roughness:.85}),new MeshStandardMaterial({color:'#667738',roughness:.9}),new MeshStandardMaterial({color:'#859b47',roughness:.88})];
    const batches=(['ladybug','grasshopper'] as const).flatMap(kind=>insectGeometry(kind).map((geometry,part)=>{
      const mesh=new InstancedMesh(geometry,materials[part===0?(kind==='ladybug'?0:3):part],4);mesh.name=`meadow-${kind}-${part}`;mesh.frustumCulled=false;mesh.raycast=()=>{};root.add(mesh);return {mesh,kind,geometry};
    }));
    return {root,sites,transform,batches,materials,elapsed:0,timer:undefined as ReturnType<typeof setTimeout>|undefined};
  },[]);
  useEffect(()=>{clearTimeout(scene.timer);return()=>{scene.timer=setTimeout(()=>{scene.batches.forEach(({mesh,geometry})=>{mesh.dispose();geometry.dispose();});scene.materials.forEach(m=>m.dispose());},0);};},[scene]);
  useFrame(({camera})=>{
    if(!paused)scene.elapsed=runtime.current.elapsed;
    scene.batches.forEach(({mesh,kind})=>{
      mesh.count=0;
      scene.sites.forEach((site,index)=>{
        if(site.kind!==kind||Math.hypot(camera.position.x-site.x,camera.position.y-site.y,camera.position.z-site.z)>11)return;
        const pose=meadowInsectPose(scene.elapsed,index);scene.transform.position.set(pose.x,pose.y,pose.z);scene.transform.rotation.set(0,pose.yaw,0);scene.transform.updateMatrix();mesh.setMatrixAt(mesh.count++,scene.transform.matrix);
      });
      mesh.visible=mesh.count>0;if(mesh.count)mesh.instanceMatrix.needsUpdate=true;
    });
  });
  return <primitive object={scene.root} dispose={null}/>;
}
