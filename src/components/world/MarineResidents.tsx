'use client';

import { BufferGeometry, Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, RingGeometry, SphereGeometry, Vector3 } from 'three';
import { crawlingOctopusArmGeometry, crawlingOctopusBodyGeometry, seaSnakeGeometry, squidGeometry, whaleBodyGeometry, whaleFlukeGeometry, whalePectoralGeometry } from './marineModels';
import { createMarineResidentsState, offshoreWhaleClear, sampleOffshoreWhale, stepMarineResidents } from './marineResidentState';
import { surfaceAnimals, vesselClearance } from './marineTraffic';
import { marineFloorHeight } from './reefHabitat';
import type { EnvironmentProps } from './Water';

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
  const octopusBodies=batch('resident-octopus-bodies',crawlingOctopusBodyGeometry(),octopus.length),octopusArms=batch('resident-octopus-articulated-arms',crawlingOctopusArmGeometry(),octopus.length*8);
  octopus.forEach((_,i)=>{const color=new Color(['#d99178','#9c7fab','#c99665','#95a681'][i]);octopusBodies.setColorAt(i,color);for(let arm=0;arm<8;arm++)octopusArms.setColorAt(i*8+arm,color);});
  const snakeMaterial=material.clone();materials.push(snakeMaterial);
  snakeMaterial.onBeforeCompile=shader=>{shader.uniforms.residentTime=time;shader.vertexShader=`uniform float residentTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>
    float tail=clamp((.80-position.x)/1.80,0.,1.);
    transformed.z+=sin(position.x*9.5-residentTime*2.4+instanceMatrix[3].x)*tail*.13;
  `);};snakeMaterial.customProgramCacheKey=()=> 'resident-banded-snake-v1';
  const snakeBodies=batch('banded-sea-snakes',seaSnakeGeometry(),snakes.length,snakeMaterial);
  const squidMaterial=material.clone();materials.push(squidMaterial);
  squidMaterial.onBeforeCompile=shader=>{shader.vertexShader=`attribute float aJet;\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>
    float mantle=smoothstep(-.34,-.10,position.x);
    transformed.y*=1.-aJet*.11*mantle;
    transformed.z*=1.-aJet*.11*mantle;
    transformed.z+=sin(position.x*21.+aJet*5.)*.011*step(position.x,-.5);
  `);};squidMaterial.customProgramCacheKey=()=> 'resident-squid-mantle-v1';
  const squidBodies=batch('reef-darting-squid',squidGeometry(),squid.length,squidMaterial),jets=new InstancedBufferAttribute(new Float32Array(squid.length),1);squidBodies.geometry.setAttribute('aJet',jets);
  const whale=new Group();whale.name='rare-offshore-whale';root.add(whale);
  const whalePart=(name:string,geometry:BufferGeometry)=>{geometries.push(geometry);const mesh=new Mesh(geometry,material);mesh.name=name;mesh.raycast=()=>{};whale.add(mesh);return mesh;};
  whalePart('humpback-streamlined-body',whaleBodyGeometry());
  const pectoralGeometry=whalePectoralGeometry(),left=whalePart('whale-left-pectoral',pectoralGeometry),right=whalePart('whale-right-pectoral',pectoralGeometry);
  left.position.set(.1,-.18,.84);right.position.set(.1,-.18,-.84);right.scale.z=-1;
  const fluke=whalePart('whale-horizontal-flukes',whaleFlukeGeometry());fluke.position.set(-4.46,0,0);
  const sprayMaterial=new MeshStandardMaterial({color:'#f0ffff',roughness:.35,transparent:true,opacity:.78,depthWrite:false});materials.push(sprayMaterial);
  const spray=batch('whale-splash-and-breath-pool',new SphereGeometry(1,6,4),224,sprayMaterial);
  const foamMaterial=new MeshStandardMaterial({color:'#dcffff',transparent:true,opacity:.38,depthWrite:false,side:DoubleSide});materials.push(foamMaterial);
  const foam=batch('whale-impact-ripples',new RingGeometry(1,1.055,56).rotateX(-Math.PI/2),2,foamMaterial);
  const whaleOccupant={position:new Vector3(0,-10,0),radius:6.5};surfaceAnimals.push(whaleOccupant);
  let elapsed=0,quality:EnvironmentProps['quality']='high';
  function poseResident(mesh:InstancedMesh,index:number,state:typeof states[number],shown:boolean){
    const {x,z}=state.position,h=state.heading;
    const gx=state.kind==='squid'?0:(marineFloorHeight(x+.25,z)-marineFloorHeight(x-.25,z))/.5,gz=state.kind==='squid'?0:(marineFloorHeight(x,z+.25)-marineFloorHeight(x,z-.25))/.5;
    dummy.position.copy(state.position);dummy.rotation.set(-Math.atan(gx*Math.sin(h)+gz*Math.cos(h)),h,state.kind==='squid'?state.pitch:Math.atan(gx*Math.cos(h)-gz*Math.sin(h)),'YXZ');dummy.scale.setScalar(shown?state.size:.00001);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
  }
  function write(){
    time.value=elapsed;
    octopus.forEach((state,i)=>{
      const shown=quality==='high'||i<(quality==='medium'?3:2);poseResident(octopusBodies,i,state,shown);
      for(let arm=0;arm<8;arm++){
        const angle=arm*Math.PI/4,phase=state.time*2.6+arm*Math.PI*.7;
        limb.position.set(.23,.098,0);limb.rotation.set(0,angle+Math.sin(phase)*(state.moving?.14:.035),Math.sin(phase)*(state.moving?.045:.009));
        limb.scale.setScalar(.88+(arm%3)*.085);limb.updateMatrix();limb.matrix.premultiply(dummy.matrix);octopusArms.setMatrixAt(i*8+arm,limb.matrix);
      }
    });
    snakes.forEach((state,i)=>poseResident(snakeBodies,i,state,quality==='high'||i<(quality==='medium'?2:1)));
    squid.forEach((state,i)=>{poseResident(squidBodies,i,state,quality==='high'||i<(quality==='medium'?3:2));jets.setX(i,state.jet);});jets.needsUpdate=true;
    const pose=sampleOffshoreWhale(elapsed),safe=offshoreWhaleClear(pose.position.x,pose.position.z)&&vesselClearance(pose.position.x,pose.position.z,7)>12;
    whale.position.copy(pose.position);whale.rotation.set(0,pose.heading,pose.pitch,'YXZ');whale.visible=pose.visible&&safe;whale.updateMatrix();
    whaleOccupant.position.copy(pose.position);if(!whale.visible)whaleOccupant.position.y=-10;
    left.rotation.x=.12+Math.sin(elapsed*.7)*.13;right.rotation.x=-left.rotation.x;fluke.rotation.z=Math.sin(elapsed*1.05)*.12;
    let particles=0;
    const writeDrop=(x:number,y:number,z:number,sx:number,sy=sx,sz=sx)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();spray.setMatrixAt(particles++,dummy.matrix);};
    const splash=pose.splashAge>=0&&pose.splashAge<4.3&&safe;
    if(splash){
      const count=quality==='low'?88:176;
      for(let i=0;i<count;i++){
        const age=pose.splashAge-(i%7)*.024;if(age<0)continue;
        const a=i*2.399,speed=1.25+(i%11)*.23,vy=3.4+(i%9)*.47,r=.6+speed*age,y=.06+vy*age-4.9*age*age;
        if(y<=.025)continue;
        writeDrop(pose.splashPoint.x+Math.cos(a)*r,y,pose.splashPoint.z+Math.sin(a)*r,.075+(i%4)*.025,.11+(i%3)*.035);
      }
      for(let ring=0;ring<2;ring++){dummy.position.set(pose.splashPoint.x,.025+ring*.008,pose.splashPoint.z);dummy.scale.setScalar(1.3+pose.splashAge*1.85+ring*.62);dummy.rotation.set(0,0,0);dummy.updateMatrix();foam.setMatrixAt(ring,dummy.matrix);}
      foamMaterial.opacity=.36*(1-pose.splashAge/4.3);
    }
    foam.visible=splash;
    if(pose.spouting&&safe){
      point.set(1.60,1.03,0).applyMatrix4(whale.matrix);
      const count=quality==='low'?24:48;
      for(let i=0;i<count;i++){
        const age=pose.spoutAge-(i%12)*.035;if(age<0||age>1.25)continue;
        const a=i*2.399,r=age*(.20+(i%5)*.045),y=point.y+age*(3.6+(i%5)*.3)-1.9*age*age;
        if(y<.04)continue;
        writeDrop(point.x+Math.cos(a)*r,y,point.z+Math.sin(a)*r,.038+age*.07,.073+age*.08);
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
