'use client';

import { BufferGeometry, Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, RingGeometry, SphereGeometry, Vector3 } from 'three';
import { crawlingOctopusArmGeometry, crawlingOctopusBodyGeometry, seaSnakeGeometry, squidGeometry, whaleBodyGeometry, whaleFlukeGeometry, whalePectoralGeometry } from './marineModels';
import { createMarineResidentsState, offshoreWhaleClear, sampleOffshoreWhale, stepMarineResidents, WHALE_SCALE, WHALE_RADIUS } from './marineResidentState';
import { surfaceAnimals, vesselClearance } from './marineTraffic';
import { marineFloorHeight } from './reefHabitat';
import type { EnvironmentProps } from './Water';

export const OCTOPUS_VARIATIONS=[
  {mantle:[1,1,1],arms:.97,color:'#d79a80'},
  {mantle:[.84,1.18,1.16],arms:1.08,color:'#a785aa'},
  {mantle:[1.07,.89,.91],arms:.86,color:'#cbb37d'},
  {mantle:[.92,1.10,1.13],arms:1.02,color:'#809c8a'},
] as const;
export const SQUID_VARIATIONS=[
  {mantle:[1,1,1],arms:1,color:'#d6a8b6'},
  {mantle:[.82,1.23,1.18],arms:.9,color:'#b58d6e'},
  {mantle:[1.12,.81,.89],arms:1.11,color:'#85aab8'},
  {mantle:[.94,1.12,1.22],arms:.95,color:'#b4a9cf'},
  {mantle:[1.06,.93,.90],arms:1.04,color:'#c6cda1'},
] as const;

/** Shared anatomy and fixed pools keep the residents and rare whale independent of React renders. */
export function createMarineResidents(){
  const root=new Group();root.name='resident-marine-life';
  const states=createMarineResidentsState(),geometries:BufferGeometry[]=[],materials:MeshStandardMaterial[]=[],instances:InstancedMesh[]=[];
  const material=new MeshStandardMaterial({vertexColors:true,roughness:.66,side:DoubleSide});materials.push(material);
  const time={value:0},dummy=new Object3D(),limb=new Object3D(),point=new Vector3();
  const batch=(name:string,geometry:BufferGeometry,count:number,mat=material)=>{
    geometries.push(geometry);const mesh=new InstancedMesh(geometry,mat,count);mesh.name=name;mesh.raycast=()=>{};mesh.frustumCulled=false;root.add(mesh);instances.push(mesh);return mesh;
  };
  const octopus=states.filter(state=>state.kind==='crawling-octopus'),snakes=states.filter(state=>state.kind==='sea-snake'),squid=states.filter(state=>state.kind==='squid');
  const armMaterial=material.clone();materials.push(armMaterial);
  armMaterial.onBeforeCompile=shader=>{shader.vertexShader=`attribute float aArmPhase; attribute float aArmActivity;\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>
    float reach=smoothstep(.12,.56,position.x);
    transformed.z+=sin(position.x*10.-aArmPhase)*reach*.04*aArmActivity;
    transformed.y+=(.5+.5*sin(position.x*12.-aArmPhase))*reach*.025*aArmActivity;
  `);};armMaterial.customProgramCacheKey=()=> 'octopus-flexible-arm-v1';
  const octopusMaterial=material.clone();materials.push(octopusMaterial);
  octopusMaterial.onBeforeCompile=shader=>{shader.vertexShader=`attribute vec3 aMorph; attribute float aPattern;\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>
    float mantle=1.-smoothstep(-.10,.16,position.x);
    transformed.x*=mix(1.,aMorph.x,mantle);
    transformed.y=.11+(position.y-.11)*mix(1.,aMorph.y,mantle);
    transformed.z*=mix(1.,aMorph.z,mantle);
  `).replace('#include <color_vertex>',`#include <color_vertex>
    float freckle=sin(position.x*(55.+aPattern*7.)+sin(position.z*28.))*cos(position.z*69.+aPattern*3.);
    vColor.rgb*=mix(.74,1.10,smoothstep(-.18,.42,freckle));
  `);};octopusMaterial.customProgramCacheKey=()=> 'octopus-mantle-variation-v1';
  const octopusBodies=batch('resident-octopus-bodies',crawlingOctopusBodyGeometry(),octopus.length,octopusMaterial),octopusArms=batch('resident-octopus-articulated-arms',crawlingOctopusArmGeometry(),octopus.length*8,armMaterial);
  const armPhases=new InstancedBufferAttribute(new Float32Array(octopus.length*8),1),armActivity=new InstancedBufferAttribute(new Float32Array(octopus.length*8),1);
  octopusArms.geometry.setAttribute('aArmPhase',armPhases);octopusArms.geometry.setAttribute('aArmActivity',armActivity);
  octopusBodies.geometry.setAttribute('aMorph',new InstancedBufferAttribute(new Float32Array(OCTOPUS_VARIATIONS.flatMap(v=>[...v.mantle])),3));
  octopusBodies.geometry.setAttribute('aPattern',new InstancedBufferAttribute(new Float32Array([0,1,2,3]),1));
  octopus.forEach((_,i)=>{const color=new Color(OCTOPUS_VARIATIONS[i].color);octopusBodies.setColorAt(i,color);for(let arm=0;arm<8;arm++)octopusArms.setColorAt(i*8+arm,color);});
  const snakeMaterial=material.clone();materials.push(snakeMaterial);
  snakeMaterial.onBeforeCompile=shader=>{shader.vertexShader=`attribute float aStroke; attribute float aPropulsion;\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>
    float tail=clamp((.80-position.x)/1.85,0.,1.);
    transformed.z+=sin(tail*5.5-aStroke)*tail*(.006+aPropulsion*.13);
  `);};snakeMaterial.customProgramCacheKey=()=> 'resident-banded-snake-swimming-v2';
  const snakeBodies=batch('banded-sea-snakes',seaSnakeGeometry(),snakes.length,snakeMaterial);
  const strokes=new InstancedBufferAttribute(new Float32Array(snakes.length),1),propulsion=new InstancedBufferAttribute(new Float32Array(snakes.length),1);
  snakeBodies.geometry.setAttribute('aStroke',strokes);snakeBodies.geometry.setAttribute('aPropulsion',propulsion);
  const squidMaterial=material.clone();materials.push(squidMaterial);
  squidMaterial.onBeforeCompile=shader=>{shader.vertexShader=`attribute float aJet; attribute vec3 aMorph; attribute float aArms;\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>
    float mantle=smoothstep(-.34,-.10,position.x);
    transformed.x=-.34+(transformed.x+.34)*mix(aArms,aMorph.x,mantle);
    transformed.y*=mix(1.,aMorph.y,mantle);
    transformed.z*=mix(1.,aMorph.z,mantle);
    transformed.y*=1.-aJet*.11*mantle;
    transformed.z*=1.-aJet*.11*mantle;
    transformed.z+=sin(position.x*21.+aJet*5.)*.011*step(position.x,-.5);
  `);};squidMaterial.customProgramCacheKey=()=> 'resident-squid-mantle-v2';
  const squidBodies=batch('reef-darting-squid',squidGeometry(),squid.length,squidMaterial),jets=new InstancedBufferAttribute(new Float32Array(squid.length),1);squidBodies.geometry.setAttribute('aJet',jets);
  squidBodies.geometry.setAttribute('aMorph',new InstancedBufferAttribute(new Float32Array(SQUID_VARIATIONS.flatMap(v=>[...v.mantle])),3));
  squidBodies.geometry.setAttribute('aArms',new InstancedBufferAttribute(new Float32Array(SQUID_VARIATIONS.map(v=>v.arms)),1));
  squid.forEach((_,i)=>squidBodies.setColorAt(i,new Color(SQUID_VARIATIONS[i].color)));
  const whale=new Group();whale.name='rare-offshore-whale';whale.scale.setScalar(WHALE_SCALE);root.add(whale);
  const whalePart=(name:string,geometry:BufferGeometry)=>{geometries.push(geometry);const mesh=new Mesh(geometry,material);mesh.name=name;mesh.raycast=()=>{};whale.add(mesh);return mesh;};
  whalePart('humpback-streamlined-body',whaleBodyGeometry());
  const pectoralGeometry=whalePectoralGeometry(),left=whalePart('whale-left-pectoral',pectoralGeometry),right=whalePart('whale-right-pectoral',pectoralGeometry);
  left.position.set(.5,-.20,.89);right.position.set(.5,-.20,-.89);right.scale.z=-1;
  const fluke=whalePart('whale-horizontal-flukes',whaleFlukeGeometry());fluke.position.set(-4.46,0,0);
  const sprayMaterial=new MeshStandardMaterial({color:'#f0ffff',roughness:.35,transparent:true,opacity:.78,depthWrite:false});materials.push(sprayMaterial);
  const spray=batch('whale-splash-and-breath-pool',new SphereGeometry(1,6,4),224,sprayMaterial);
  const foamMaterial=new MeshStandardMaterial({color:'#dcffff',transparent:true,opacity:.38,depthWrite:false,side:DoubleSide});materials.push(foamMaterial);
  const foam=batch('whale-impact-ripples',new RingGeometry(1,1.055,56).rotateX(-Math.PI/2),2,foamMaterial);
  // Surface spray must composite after the transparent ocean, like shore impacts.
  spray.renderOrder=4;foam.renderOrder=4;
  const whaleOccupant={position:new Vector3(0,-10,0),radius:WHALE_RADIUS};surfaceAnimals.push(whaleOccupant);
  let elapsed=0,quality:EnvironmentProps['quality']='high';
  function poseResident(mesh:InstancedMesh,index:number,state:typeof states[number],shown:boolean){
    const {x,z}=state.position,h=state.heading;
    const gx=state.kind!=='crawling-octopus'?0:(marineFloorHeight(x+.25,z)-marineFloorHeight(x-.25,z))/.5,gz=state.kind!=='crawling-octopus'?0:(marineFloorHeight(x,z+.25)-marineFloorHeight(x,z-.25))/.5;
    dummy.position.copy(state.position);dummy.rotation.set(-Math.atan(gx*Math.sin(h)+gz*Math.cos(h)),h,state.kind!=='crawling-octopus'?state.pitch:Math.atan(gx*Math.cos(h)-gz*Math.sin(h)),'YXZ');dummy.scale.setScalar(shown?state.size:.00001);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
  }
  function write(){
    time.value=elapsed;
    octopus.forEach((state,i)=>{
      const shown=quality==='high'||i<(quality==='medium'?3:2);poseResident(octopusBodies,i,state,shown);
      for(let arm=0;arm<8;arm++){
        const angle=arm*Math.PI/4,phase=state.time*2.6+arm*Math.PI*.7;
        limb.position.set(.20+Math.cos(angle)*.075,.098,Math.sin(angle)*.075);limb.rotation.set(0,angle+Math.sin(phase)*(state.moving?.14:.035),Math.sin(phase)*(state.moving?.045:.009));
        armPhases.setX(i*8+arm,phase);armActivity.setX(i*8+arm,state.moving?1:.18);
        limb.scale.set(OCTOPUS_VARIATIONS[i].arms*(.88+(arm%3)*.085),1,1);limb.updateMatrix();limb.matrix.premultiply(dummy.matrix);octopusArms.setMatrixAt(i*8+arm,limb.matrix);
      }
    });
    armPhases.needsUpdate=true;armActivity.needsUpdate=true;
    snakes.forEach((state,i)=>{poseResident(snakeBodies,i,state,quality==='high'||i===0);strokes.setX(i,state.strokePhase);propulsion.setX(i,state.moving?.18+state.jet*.82:0);});strokes.needsUpdate=true;propulsion.needsUpdate=true;
    squid.forEach((state,i)=>{poseResident(squidBodies,i,state,quality==='high'||i<(quality==='medium'?3:2));jets.setX(i,state.jet);});jets.needsUpdate=true;
    const pose=sampleOffshoreWhale(elapsed),safe=offshoreWhaleClear(pose.position.x,pose.position.z)&&vesselClearance(pose.position.x,pose.position.z,WHALE_RADIUS)>18;
    whale.position.copy(pose.position);whale.rotation.set(pose.roll,pose.heading,pose.pitch,'YXZ');whale.visible=pose.visible&&safe;whale.updateMatrix();
    whaleOccupant.position.copy(pose.position);if(!whale.visible)whaleOccupant.position.y=-10;
    left.rotation.x=.12+Math.sin(elapsed*.7)*.13;right.rotation.x=-left.rotation.x;fluke.rotation.z=Math.sin(elapsed*1.05)*.12;
    let particles=0;
    const writeDrop=(x:number,y:number,z:number,sx:number,sy=sx,sz=sx)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();spray.setMatrixAt(particles++,dummy.matrix);};
    const splash=pose.splashAge>=0&&pose.splashAge<6&&safe;
    if(splash){
      const count=quality==='low'?88:176;
      for(let i=0;i<count;i++){
        const age=pose.splashAge-(i%7)*.024;if(age<0)continue;
        const a=i*2.399,speed=2.2+(i%11)*.38,vy=6.5+(i%9)*.68,r=1.7+speed*age,y=.06+vy*age-4.9*age*age;
        if(y<=.025)continue;
        writeDrop(pose.splashPoint.x+Math.cos(a)*r,y,pose.splashPoint.z+Math.sin(a)*r,.11+(i%4)*.038,.19+(i%3)*.06);
      }
      for(let ring=0;ring<2;ring++){dummy.position.set(pose.splashPoint.x,.025+ring*.008,pose.splashPoint.z);dummy.scale.setScalar(3.1+pose.splashAge*2.6+ring*1.25);dummy.rotation.set(0,0,0);dummy.updateMatrix();foam.setMatrixAt(ring,dummy.matrix);}
      foamMaterial.opacity=.36*(1-pose.splashAge/6);
    }
    foam.visible=splash;
    if(pose.spouting&&safe){
      point.set(1.48,1.085,0).applyMatrix4(whale.matrix);
      const count=quality==='low'?24:48;
      for(let i=0;i<count;i++){
        const age=pose.spoutAge-(i%12)*.035;if(age<0||age>1.8)continue;
        const a=i*2.399,r=age*(.40+(i%5)*.095),y=point.y+age*(7.8+(i%5)*.6)-2.7*age*age;
        if(y<.04)continue;
        writeDrop(point.x+Math.cos(a)*r,y,point.z+Math.sin(a)*r,.085+age*.13,.13+age*.14);
      }
    }
    spray.count=particles;spray.visible=particles>0;
    instances.forEach(mesh=>{mesh.instanceMatrix.needsUpdate=true;});
  }
  function update(delta:number,paused=false,activeTime?:number){if(paused)return;elapsed=activeTime??elapsed+Math.max(0,delta);stepMarineResidents(states,delta);write();}
  function setQuality(tier:EnvironmentProps['quality']){quality=tier;write();}
  function dispose(){const index=surfaceAnimals.indexOf(whaleOccupant);if(index>=0)surfaceAnimals.splice(index,1);new Set(geometries).forEach(g=>g.dispose());materials.forEach(m=>m.dispose());instances.forEach(mesh=>mesh.dispose());}
  write();return{root,states,whale,spray,foam,update,setQuality,dispose};
}
