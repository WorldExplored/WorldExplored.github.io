'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MYTHIC_GROTTO } from './coastalCaveLayout';
import { marineFloorHeight } from './reefHabitat';
import { landDistance, terrainMeshHeight } from './terrain';
import { applySurface } from './surfaceMaterials';
import type { EnvironmentProps } from './Water';

const profile=[[-4.25,0],[-4.05,1.6],[-2.6,2.6],[-.8,2.8],[2.4,2.48],[4.05,1.5],[4.3,0],[0,0]];

/** An uneven slot cut through a sand-covered rock bank, with floor, roof and recessed walls. */
export function giantGrottoGeometry() {
  const positions:number[]=[],colors:number[]=[],uvs:number[]=[],indices:number[]=[];
  const rock=new Color('#677a77'),sand=new Color('#b8ae89');
  const ground=(x:number,z:number)=>{
    const wx=MYTHIC_GROTTO.x+x*MYTHIC_GROTTO.scale,wz=MYTHIC_GROTTO.z+z*MYTHIC_GROTTO.scale,reef=marineFloorHeight(wx,wz);
    // The terrain lattice ends offshore; its extrapolated height is not a physical surface.
    const surface=landDistance(wx,wz)>=-6.5?Math.max(terrainMeshHeight(wx,wz),reef):reef;
    return (surface-MYTHIC_GROTTO.floor)/MYTHIC_GROTTO.heightScale;
  };
  const add=(x:number,y:number,z:number,amount:number)=>{
    const c=rock.clone().lerp(sand,Math.max(0,Math.min(1,amount))),shade=.91+.055*Math.sin(x*2.4+z*1.7)+.018*Math.sin(x*35+y*29+z*17);
    positions.push(x,y,z);colors.push(c.r*shade,c.g*shade,c.b*shade);uvs.push(x*.65,z*.65+y*.2);return positions.length/3-1;
  };
  const quad=(a:number,b:number,c:number,d:number)=>indices.push(a,b,c,b,d,c);
  const divisions=8,ringSize=profile.length*divisions;
  const sampled=(points:readonly number[][],s:number)=>{
    const edge=Math.floor(s/divisions),t=s%divisions/divisions,a=points[edge],b=points[(edge+1)%points.length];
    return a.map((value,index)=>value+(b[index]-value)*t);
  };
  // The roof, weathered face and inner tunnel use the same edge vertices.
  // Only the buried outer perimeter is open; no overlapping facade/roof sheets.
  const tunnel:number[][]=[];
  for(let r=0;r<=8;r++){
    const ring:number[]=[],t=r/8;
    for(let s=0;s<ringSize;s++){
      const [px,py]=sampled(profile,s),x=px*(1-t*.18),y=py*(1-t*.1),z=1.3-t*7.1+.055*Math.sin(s*.7)*t;
      ring.push(add(x,y,z,.08));
    }
    if(r)for(let s=0;s<ringSize;s++)quad(tunnel[r-1][s],ring[s],tunnel[r-1][(s+1)%ringSize],ring[(s+1)%ringSize]);
    tunnel.push(ring);
  }
  const back=add(0,1.2,-5.88,.1);
  for(let s=0;s<ringSize;s++)indices.push(back,tunnel[8][s],tunnel[8][(s+1)%ringSize]);
  const outer=[[-8,0,.32],[-6.6,.35,.10],[-4.4,3.45,.25],[-1.3,3.7,.68],[3.7,3.35,.39],[6.6,.32,.05],[8,0,.25],[0,0,5.0]];
  const outerPoints=Array.from({length:ringSize},(_,s)=>{
    const [x,y,z]=sampled(outer,s),edge=Math.floor(s/divisions);
    // Flanks and the scalloped approach disappear into the measured floor.
    return new Vector3(x,edge>=6||s===0?ground(x,z)-.20:y,z);
  });
  let rim=tunnel[0];
  for(let r=1;r<=5;r++){
    const t=r/5,ring:number[]=[];
    for(let s=0;s<ringSize;s++){
      const inner=new Vector3().fromArray(positions,tunnel[0][s]*3),p=inner.lerp(outerPoints[s],t);
      // Sample the curved excavation here instead of bridging a raised triangular lip.
      if(s>=6*divisions||s===0)p.y=(ground(p.x,p.z)-.20)*t;
      else p.y+=Math.sin(Math.PI*t)*Math.sin(s*1.7)*.065;
      ring.push(add(p.x,p.y,p.z,t*.8));
    }
    for(let s=0;s<ringSize;s++)quad(rim[s],rim[(s+1)%ringSize],ring[s],ring[(s+1)%ringSize]);
    rim=ring;
  }
  const columns=6*divisions,rows=18;
  let previous=rim.slice(0,columns+1);
  for(let iz=1;iz<=rows;iz++){
    const t=iz/rows,rear=Math.max(0,Math.min(1,(t-.64)/.36)),fade=1-rear*rear*(3-2*rear),row:number[]=[];
    for(let ix=0;ix<=columns;ix++){
      const front=outerPoints[ix],u=ix/columns,x=front.x*(1-.35*t),z=front.z+(-8.8-front.z)*t;
      const envelope=Math.sin(Math.PI*u),height=(front.y-ground(front.x,front.z))*fade;
      const texture=(.08*Math.sin(x*2.7+z*.8)+.055*Math.sin(x*.9-z*1.7))*envelope*Math.sin(Math.PI*t)*fade;
      row.push(add(x,ground(x,z)+height+texture-.10*t,z,.67+.3*t));
      if(ix)quad(previous[ix-1],row[ix-1],previous[ix],row[ix]);
    }
    previous=row;
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.scale(MYTHIC_GROTTO.scale,MYTHIC_GROTTO.heightScale,MYTHIC_GROTTO.scale);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}

function merge(parts:BufferGeometry[]) {
  const plain=parts.map(p=>p.index?p.toNonIndexed():p),geometry=mergeGeometries(plain)!;
  plain.forEach((p,i)=>{p.dispose();if(p!==parts[i])parts[i].dispose();});return geometry;
}
const oval=(x:number,y:number,z:number,sx:number,sy:number,sz:number)=>new SphereGeometry(1,Math.max(sx,sy,sz)<.16?8:12,Math.max(sx,sy,sz)<.16?6:8).scale(sx,sy,sz).translate(x,y,z);
function limb(a:number[],b:number[],r1:number,r2:number){
  const from=new Vector3(...a),to=new Vector3(...b),direction=to.clone().sub(from);
  const geometry=new CylinderGeometry(r2,r1,direction.length(),8);
  geometry.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction.normalize()));
  geometry.translate((from.x+to.x)/2,(from.y+to.y)/2,(from.z+to.z)/2);
  return geometry;
}

export function mythicCrabPose(time:number) {
  const phase=((time%84)+84)%84;
  const ease=(t:number)=>t*t*(3-2*t);
  const advance=phase<16?ease(phase/16):phase<42?1:phase<62?1-ease((phase-42)/20):0;
  const walking=phase<16||(phase>=42&&phase<62);
  const strideAge=phase<16?phase:phase-42,strideDuration=phase<16?16:20;
  const gait=walking?ease(Math.max(0,Math.min(1,Math.min(strideAge,strideDuration-strideAge)/1.25))):0;
  return {x:Math.sin(advance*Math.PI)*.22,z:-.62+advance*.76,yaw:Math.sin(advance*Math.PI)*.06,walking,advance,gait};
}

export function makeMythicGrotto(){
  const root=new Group();root.name='hidden-titan-crab-grotto';root.position.set(MYTHIC_GROTTO.x,MYTHIC_GROTTO.floor,MYTHIC_GROTTO.z);
  const rock=applySurface(new MeshStandardMaterial({vertexColors:true,roughness:.98,side:DoubleSide}),'mineral');
  const bank=new Mesh(giantGrottoGeometry(),rock);bank.name='sand-buried-angular-grotto';bank.receiveShadow=true;root.add(bank);
  const body=new Group();body.name='ancient-crab';body.scale.setScalar(.58);root.add(body);
  const shellMaterial=new MeshStandardMaterial({color:'#667469',roughness:.86});
  const ivoryMaterial=new MeshStandardMaterial({color:'#b0ae88',roughness:.88});
  const darkMaterial=new MeshStandardMaterial({color:'#172c31',roughness:.8});
  const add=(parent:Group,parts:BufferGeometry[],material:MeshStandardMaterial,name:string)=>{
    const mesh=new Mesh(merge(parts),material);mesh.name=name;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const shell:BufferGeometry[]=[oval(0,.99,-1.6,2.3,.72,1.65)],dark:BufferGeometry[]=[],ivory:BufferGeometry[]=[];
  const legs:{upper:Object3D;lower:Object3D;joint:Object3D;side:number;index:number;origin:Vector3}[]=[];
  const upperLegs=new InstancedMesh(new CylinderGeometry(.72,1,1,8),shellMaterial,8);
  const lowerLegs=new InstancedMesh(new CylinderGeometry(.20,1,1,8),shellMaterial,8);
  const legJoints=new InstancedMesh(new SphereGeometry(.21,8,6),shellMaterial,8);
  for(const [mesh,name]of [[upperLegs,'crab-upper-legs'],[lowerLegs,'crab-lower-legs'],[legJoints,'crab-leg-joints']]as const){mesh.name=name;mesh.frustumCulled=false;body.add(mesh);}
  const claws:Group[]=[],jaws:Group[]=[];
  for(const side of [-1,1]) {
    for(let leg=0;leg<4;leg++){
      const z=-2.75+leg*.72,origin=new Vector3(side*1.5,.62,z);
      const upper=new Object3D(),lower=new Object3D(),joint=new Object3D();
      upper.name=`crab-leg-${side}-${leg}-upper`;lower.name=`crab-leg-${side}-${leg}-lower`;
      legs.push({upper,lower,joint,side,index:leg,origin});
    }
    const claw=new Group();claw.name=`crab-claw-${side}`;body.add(claw);claws.push(claw);
    const size=side<0?1.14:.89,x=side*2.55;
    add(claw,[limb([side*1.8,.75,-.85],[side*3.1,.52,.15],.3,.26),limb([side*3.1,.52,.15],[x,.61,1.25],.26,.31),oval(x,.63,1.42,.6*size,.42*size,.7*size)],shellMaterial,'claw-arm-and-palm');
    for(const branch of [-1,1]){
      const jaw=new Group();jaw.position.set(x,.65,1.55);jaw.userData.branch=branch;claw.add(jaw);jaws.push(jaw);
      const parts=[limb([branch*.32,0,0],[branch*.45,.02,.87],.22,.075),limb([branch*.45,.02,.87],[branch*.07,.03,1.15],.075,.018)];
      add(jaw,parts,shellMaterial,'hinged-pincer');
      add(jaw,Array.from({length:4},(_,tooth)=>oval(branch*(.20+tooth*.028),.02,.22+tooth*.16,.05,.04,.075)),ivoryMaterial,'pincer-teeth');
    }
    shell.push(limb([side*.62,1.17,-.12],[side*.75,1.6,.08],.085,.06));
    dark.push(oval(side*.75,1.61,.1,.10,.10,.13));
    for(let spur=0;spur<6;spur++)shell.push(limb([side*(1.95+.17*Math.sin(spur)),1.04,-2.65+spur*.45],[side*(2.36+.14*Math.sin(spur)),1.17,-2.78+spur*.45],.13,.006));
  }
  for(let i=0;i<34;i++){
    const a=i*2.399,r=Math.sqrt((i+.5)/34),x=Math.cos(a)*r*1.9,z=-1.6+Math.sin(a)*r*1.3,y=.99+.72*Math.sqrt(1-r*r*.75);
    ivory.push(oval(x,y,z,.05+(i%3)*.027,.038,.075));
  }
  add(body,shell,shellMaterial,'crab-carapace');add(body,ivory,ivoryMaterial,'crab-shell-encrustations');add(body,dark,darkMaterial,'crab-eyes');
  const knee=new Vector3(),foot=new Vector3(),direction=new Vector3(),axis=new Vector3(0,1,0);
  const segment=(mesh:Object3D,a:Vector3,b:Vector3,radius:number)=>{
    direction.copy(b).sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.set(radius,direction.length(),radius);mesh.quaternion.setFromUnitVectors(axis,direction.normalize());mesh.updateMatrix();
  };
  const update=(time:number,paused=false)=>{
    if(paused)return;
    const pose=mythicCrabPose(time);body.position.set(pose.x,0,pose.z);body.rotation.set(0,pose.yaw,0);
    for(const [i,leg]of legs.entries()){
      const phase=time*2.6+leg.index*Math.PI*.72+(leg.side>0?Math.PI:0),step=Math.sin(phase)*pose.gait;
      foot.set(leg.side*(3.75-leg.index*.15),.055+Math.max(0,step)*.18,leg.origin.z+.68+Math.cos(phase)*.19*pose.gait);
      knee.set(leg.side*(3.25+Math.sin(leg.index)*.28),.87+Math.max(0,step)*.08,leg.origin.z-.35);
      segment(leg.upper,leg.origin,knee,.21);segment(leg.lower,knee,foot,.15);leg.joint.position.copy(knee);leg.joint.updateMatrix();
      upperLegs.setMatrixAt(i,leg.upper.matrix);lowerLegs.setMatrixAt(i,leg.lower.matrix);legJoints.setMatrixAt(i,leg.joint.matrix);
    }
    for(const mesh of [upperLegs,lowerLegs,legJoints]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();}
    claws.forEach((claw,index)=>{claw.rotation.x=Math.sin(time*.55+index*2)*.035;});
    jaws.forEach((jaw,index)=>{jaw.rotation.y=jaw.userData.branch*(.04+.12*(.5+.5*Math.sin(time*.7+Math.floor(index/2)*1.8)));});
  };
  update(0);
  return {root,body,legs,claws,jaws,update};
}

export function MythicGrotto({runtime,paused}:EnvironmentProps){
  const life=useMemo(()=>makeMythicGrotto(),[]);
  useEffect(()=>()=>{const materials=new Set<MeshStandardMaterial>();life.root.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();materials.add(object.material as MeshStandardMaterial);}});materials.forEach(material=>material.dispose());},[life]);
  useFrame(()=>life.update(runtime.current.activeElapsed,paused));
  return <primitive object={life.root}/>;
}
