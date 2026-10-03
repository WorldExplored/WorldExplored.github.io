'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Color, CylinderGeometry, DoubleSide, Group, InstancedMesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import type { QualityTier } from '../../content/world';
import type { EnvironmentProps } from './Water';
import { clamGeometry, floatingLeafGeometry, hermitBodyGeometry, hermitLegsGeometry, manateeBodyGeometry, manateeFlipperGeometry, manateeHeadGeometry, manateeTailGeometry, meadowGrassGeometry } from './meadowAnatomy';
import { createManatees, createMeadowPlan, createMeadowScamperers, sampleManatee, sampleMeadowScamperer } from './seagrassMeadowState';
import { harborWaterHeight } from './waterSurface';
import { surfaceAnimals } from './marineTraffic';

export function createSeagrassMeadow(){
  const root=new Group();root.name='seagrass-manatee-sanctuary';
  const plan=createMeadowPlan(),manatees=createManatees(),scamperers=createMeadowScamperers();
  const meshes:InstancedMesh[]=[],geometries:BufferGeometry[]=[],material=new MeshStandardMaterial({vertexColors:true,roughness:.83,side:DoubleSide});
  const grassMaterial=material.clone(),surfaceMaterial=material.clone(),stemMaterial=new MeshStandardMaterial({color:'#647d45',roughness:.86});
  const waveTime={value:0};grassMaterial.onBeforeCompile=shader=>{shader.uniforms.uMeadowTime=waveTime;shader.vertexShader=`uniform float uMeadowTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>\n    float phase=instanceMatrix[3].x*.57+instanceMatrix[3].z*.31;\n    transformed.x+=sin(uMeadowTime*.75+phase+position.y*2.)*position.y*position.y*.10;\n    transformed.z+=cos(uMeadowTime*.61+phase)*position.y*position.y*.07;`);};
  grassMaterial.customProgramCacheKey=()=> 'rooted-meadow-grass-v1';
  const batch=(name:string,g:BufferGeometry,count:number,paint=material)=>{const mesh=new InstancedMesh(g,paint,count);mesh.name=name;mesh.raycast=()=>undefined;mesh.frustumCulled=false;root.add(mesh);meshes.push(mesh);geometries.push(g);return mesh;};
  const grass=[0,1,2].map(form=>({mesh:batch(`meadow-rooted-grass-${form}`,meadowGrassGeometry(form),plan.plants.filter(p=>p.form===form).length,grassMaterial),plants:plan.plants.filter(p=>p.form===form)}));
  const clams=[0,1,2].map(form=>({mesh:batch(`meadow-ribbed-clams-${form}`,clamGeometry(form),plan.shells.filter(p=>p.form===form).length),shells:plan.shells.filter(p=>p.form===form)}));
  const bodies=batch('manatee-barrel-bodies',manateeBodyGeometry(),3),heads=batch('manatee-grazing-muzzles',manateeHeadGeometry(),3),tails=batch('manatee-paddle-tails',manateeTailGeometry(),3);
  const flippers=[-1,1].map(side=>batch(`manatee-pectoral-${side}`,manateeFlipperGeometry(side),3));
  const hermits=batch('meadow-hermit-crabs',hermitBodyGeometry(),scamperers.length),legs=[-1,1].map(side=>batch(`meadow-scampering-legs-${side}`,hermitLegsGeometry(side),scamperers.length));
  const algae=batch('floating-algae-fronds',floatingLeafGeometry(false),plan.floating.reduce((total,patch)=>total+patch.leaves,0),surfaceMaterial),pads=batch('shoreline-lily-pads',floatingLeafGeometry(true),plan.lilies.length,surfaceMaterial);
  algae.renderOrder=4;pads.renderOrder=4;
  const stems=batch('shore-rooted-lily-stems',new CylinderGeometry(.011,.017,1,5),plan.lilies.length,stemMaterial);
  const dummy=new Object3D(),limb=new Object3D(),tint=new Color(),axis=new Vector3(0,1,0),direction=new Vector3();let quality:QualityTier='high',time=0,waterTime=0;
  manatees.forEach((state,i)=>{tint.set(['#ffffff','#dce7df','#c1d6cb'][i]);for(const mesh of[bodies,heads,tails,...flippers])mesh.setColorAt(i,tint);});
  scamperers.forEach((state,i)=>{tint.set(['#ffffff','#d2ceb1','#bca799'][i%3]);for(const mesh of[hermits,...legs])mesh.setColorAt(i,tint);});
  for(const group of grass)group.plants.forEach((plant,i)=>{dummy.position.set(plant.x,plant.y,plant.z);dummy.rotation.set(0,plant.angle,0);dummy.scale.set(plant.width*1.9,plant.height,plant.width*1.9);dummy.updateMatrix();group.mesh.setMatrixAt(i,dummy.matrix);tint.setHSL(.25+plant.tint*.08,.10+plant.tint*.12,.80+plant.tint*.13);group.mesh.setColorAt(i,tint);});
  for(const group of clams)group.shells.forEach((shell,i)=>{dummy.position.set(shell.x,shell.y,shell.z);dummy.rotation.set(0,shell.angle,0);dummy.scale.setScalar(shell.size);dummy.updateMatrix();group.mesh.setMatrixAt(i,dummy.matrix);});
  function child(mesh:InstancedMesh,index:number,x:number,y:number,z:number,rx=0,ry=0,rz=0){limb.position.set(x,y,z);limb.rotation.set(rx,ry,rz);limb.scale.setScalar(1);limb.updateMatrix();limb.matrix.premultiply(dummy.matrix);mesh.setMatrixAt(index,limb.matrix);}
  function write(){
    const count=quality==='low'?2:3;
    for(let i=0;i<count;i++){
      const state=manatees[i];dummy.position.copy(state.position);dummy.rotation.set(0,state.heading,state.pitch,'YXZ');dummy.scale.setScalar(state.size);dummy.updateMatrix();bodies.setMatrixAt(i,dummy.matrix);
      child(heads,i,.74,.015,0,0,0,-state.graze*.19);child(tails,i,-1.06,0,0,0,0,state.tail);
      flippers.forEach((mesh,j)=>{const side=j?1:-1;child(mesh,i,.47,-.13,side*.38,side*state.flipper,0,-.10-state.graze*.08);});
    }
    for(const mesh of[bodies,heads,tails,...flippers]){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;}
    const crabs=quality==='low'?7:scamperers.length;
    for(let i=0;i<crabs;i++){
      const state=scamperers[i];dummy.position.copy(state.position);dummy.rotation.set(0,state.heading,0);dummy.scale.setScalar(state.size);dummy.updateMatrix();hermits.setMatrixAt(i,dummy.matrix);
      legs.forEach((mesh,j)=>child(mesh,i,0,0,0,0,Math.sin(state.legPhase+j*Math.PI)*.16,0));
    }
    for(const mesh of[hermits,...legs]){mesh.count=crabs;mesh.instanceMatrix.needsUpdate=true;}
    let n=0;
    plan.floating.forEach((patch,index)=>{
      for(let leaf=0;leaf<patch.leaves;leaf++){
        const a=leaf*2.399+patch.angle,r=Math.sqrt(leaf/patch.leaves)*patch.radius,x=patch.x+Math.cos(a)*r+Math.sin(time*.037+index)*.11,z=patch.z+Math.sin(a)*r+Math.cos(time*.029+index)*.09;
        dummy.position.set(x,harborWaterHeight(x,z,waterTime)+.019,z);dummy.rotation.set(.025*Math.sin(time*.8+leaf),a,.018*Math.cos(time*.7+leaf));dummy.scale.setScalar((.13+(leaf%4)*.028)*(patch.radius>1?1.7:1));dummy.updateMatrix();algae.setMatrixAt(n++,dummy.matrix);
      }
    });algae.count=n;algae.instanceMatrix.needsUpdate=true;
    plan.lilies.forEach((pad,i)=>{
      const y=harborWaterHeight(pad.x,pad.z,waterTime)+.020;
      dummy.position.set(pad.x,y,pad.z);dummy.rotation.set(0,pad.angle,0);dummy.scale.setScalar(pad.radius);dummy.updateMatrix();pads.setMatrixAt(i,dummy.matrix);
      direction.set(.04*Math.sin(time*.5+i),y-pad.floor,0);dummy.position.set(pad.x-direction.x*.5,(y+pad.floor)*.5,pad.z);const length=direction.length();dummy.quaternion.setFromUnitVectors(axis,direction.normalize());dummy.scale.set(1,length,1);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);
    });pads.instanceMatrix.needsUpdate=true;stems.instanceMatrix.needsUpdate=true;
  }
  function update(seconds:number,paused=false,waterSeconds=seconds){if(paused)return;time=Math.max(0,seconds);waterTime=Math.max(0,waterSeconds);waveTime.value=time;manatees.forEach(state=>sampleManatee(state,time,waterTime));scamperers.forEach(state=>sampleMeadowScamperer(state,time));write();}
  function setQuality(next:QualityTier){quality=next;for(const group of grass)group.mesh.count=Math.ceil(group.plants.length*(quality==='low'?.64:quality==='medium'?.84:1));write();}
  let timer:ReturnType<typeof setTimeout>|undefined,registered=false,disposed=false;
  function unregister(){for(const state of manatees){const index=surfaceAnimals.indexOf(state);if(index>=0)surfaceAnimals.splice(index,1);}registered=false;}
  function dispose(){if(disposed)return;disposed=true;unregister();geometries.forEach(g=>g.dispose());meshes.forEach(m=>m.dispose());material.dispose();grassMaterial.dispose();surfaceMaterial.dispose();stemMaterial.dispose();}
  update(0);return {root,plan,manatees,scamperers,meshes,waveTime,update,setQuality,dispose,retain(){clearTimeout(timer);if(!registered){surfaceAnimals.push(...manatees);registered=true;}return()=>{timer=setTimeout(dispose,0);};}};
}
export function SeagrassMeadow({runtime,paused,quality}:EnvironmentProps){
  const life=useMemo(()=>createSeagrassMeadow(),[]);
  const inspection=useMemo(()=>{if(typeof window==='undefined'||!['localhost','127.0.0.1'].includes(window.location.hostname))return null;const value=new URLSearchParams(window.location.search).get('qaMeadowTime');return value!==null&&Number.isFinite(Number(value))?Math.max(0,Number(value)):null;},[]);
  useEffect(()=>life.retain(),[life]);useEffect(()=>life.setQuality(quality),[life,quality]);
  useFrame(()=>life.update(inspection??runtime.current.activeElapsed,inspection===null&&paused,inspection??runtime.current.elapsed));
  return <primitive object={life.root} dispose={null}/>;
}
