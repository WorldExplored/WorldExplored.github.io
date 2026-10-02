'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MYTHIC_GROTTO } from './coastalCaveLayout';
import { marineFloorHeight } from './reefHabitat';
import { terrainMeshHeight } from './terrain';
import { applySurface } from './surfaceMaterials';
import type { EnvironmentProps } from './Water';

const profile=[[-4.25,0],[-4.05,1.6],[-2.6,2.6],[-.8,2.8],[2.4,2.48],[4.05,1.5],[4.3,0],[0,0]];

/** An uneven slot cut through a sand-covered rock bank, with floor, roof and recessed walls. */
export function giantGrottoGeometry() {
  const positions:number[]=[],colors:number[]=[],uvs:number[]=[],indices:number[]=[];
  const rock=new Color('#677a77'),sand=new Color('#b8ae89');
  const ground=(x:number,z:number)=>Math.max(terrainMeshHeight(MYTHIC_GROTTO.x+x,MYTHIC_GROTTO.z+z),marineFloorHeight(MYTHIC_GROTTO.x+x,MYTHIC_GROTTO.z+z))-MYTHIC_GROTTO.floor;
  const add=(x:number,y:number,z:number,amount:number)=>{
    const c=rock.clone().lerp(sand,Math.max(0,Math.min(1,amount))),shade=.91+.055*Math.sin(x*2.4+z*1.7)+.018*Math.sin(x*35+y*29+z*17);
    positions.push(x,y,z);colors.push(c.r*shade,c.g*shade,c.b*shade);uvs.push(x*.65,z*.65+y*.2);return positions.length/3-1;
  };
  const quad=(a:number,b:number,c:number,d:number)=>indices.push(a,b,c,b,d,c);
  const divisions=4,ringSize=profile.length*divisions;
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
    return new Vector3(x,edge>=6||s===0?ground(x,z)-.07:y,z);
  });
  let rim=tunnel[0];
  for(let r=1;r<=5;r++){
    const t=r/5,ring:number[]=[];
    for(let s=0;s<ringSize;s++){
      const inner=new Vector3().fromArray(positions,tunnel[0][s]*3),p=inner.lerp(outerPoints[s],t);
      if(s>0&&s<24)p.y+=Math.sin(Math.PI*t)*Math.sin(s*1.7)*.065;
      ring.push(add(p.x,p.y,p.z,t*.8));
    }
    for(let s=0;s<ringSize;s++)quad(rim[s],rim[(s+1)%ringSize],ring[s],ring[(s+1)%ringSize]);
    rim=ring;
  }
  const columns=24,rows=18;
  let previous=rim.slice(0,columns+1);
  for(let iz=1;iz<=rows;iz++){
    const t=iz/rows,rear=Math.max(0,Math.min(1,(t-.64)/.36)),fade=1-rear*rear*(3-2*rear),row:number[]=[];
    for(let ix=0;ix<=columns;ix++){
      const front=outerPoints[ix],u=ix/columns,x=front.x*(1-.35*t),z=front.z+(-8.8-front.z)*t;
      const envelope=Math.sin(Math.PI*u),height=(front.y-ground(front.x,front.z))*fade;
      const texture=(.08*Math.sin(x*2.7+z*.8)+.055*Math.sin(x*.9-z*1.7))*envelope*Math.sin(Math.PI*t)*fade;
      row.push(add(x,ground(x,z)+height+texture-.07*t,z,.67+.3*t));
      if(ix)quad(previous[ix-1],row[ix-1],previous[ix],row[ix]);
    }
    previous=row;
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
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

export function makeMythicGrotto(){
  const root=new Group();root.name='hidden-titan-crab-grotto';root.position.set(MYTHIC_GROTTO.x,MYTHIC_GROTTO.floor,MYTHIC_GROTTO.z);
  const rock=applySurface(new MeshStandardMaterial({vertexColors:true,roughness:.98,side:DoubleSide}),'mineral');
  const bank=new Mesh(giantGrottoGeometry(),rock);bank.name='sand-buried-angular-grotto';bank.receiveShadow=true;root.add(bank);
  const shell:BufferGeometry[]=[oval(0,.99,-1.6,2.3,.72,1.65)],dark:BufferGeometry[]=[],ivory:BufferGeometry[]=[];
  for(const side of [-1,1]) {
    for(let leg=0;leg<4;leg++){
      const z=-2.75+leg*.72,origin=[side*1.5,.62,z],knee=[side*(3.25+Math.sin(leg)*.28),.87,z-.35],foot=[side*(3.8-leg*.15),.06,z+.68];
      shell.push(limb(origin,knee,.21,.15),limb(knee,foot,.15,.035),oval(knee[0],knee[1],knee[2],.22,.20,.21));
    }
    // Oversized asymmetric pincers lie partly outside the shadowed mouth.
    const size=side<0?1.14:.89,x=side*2.55;
    shell.push(limb([side*1.8,.75,-.85],[side*3.1,.52,.15],.3,.26),limb([side*3.1,.52,.15],[x,.61,1.25],.26,.31),oval(x,.63,1.42,.6*size,.42*size,.7*size));
    for(const branch of [-1,1]){
      shell.push(limb([x+branch*.32,.65,1.55],[x+branch*.45,.67,2.42],.22,.075),limb([x+branch*.45,.67,2.42],[x+branch*.07,.68,2.70],.075,.018));
      for(let tooth=0;tooth<4;tooth++)ivory.push(oval(x+branch*(.20+tooth*.028),.67,1.77+tooth*.16,.05,.04,.075));
    }
    shell.push(limb([side*.62,1.17,-.12],[side*.75,1.6,.08],.085,.06));
    dark.push(oval(side*.75,1.61,.1,.10,.10,.13));
    for(let spur=0;spur<6;spur++)shell.push(limb([side*(1.95+.17*Math.sin(spur)),1.04,-2.65+spur*.45],[side*(2.36+.14*Math.sin(spur)),1.17,-2.78+spur*.45],.13,.006));
  }
  for(let i=0;i<42;i++){
    const a=i*2.399,r=Math.sqrt((i+.5)/42),x=Math.cos(a)*r*1.9,z=-1.6+Math.sin(a)*r*1.3,y=.99+.72*Math.sqrt(1-r*r*.75);
    ivory.push(oval(x,y,z,.05+(i%3)*.027,.038,.075));
  }
  const body=new Group();body.name='ancient-crab';root.add(body);
  for(const [parts,color] of [[shell,'#576b66'],[ivory,'#b0ae88'],[dark,'#172c31']] as const){const material=new MeshStandardMaterial({color,roughness:.86}),mesh=new Mesh(merge(parts),material);mesh.receiveShadow=true;body.add(mesh);}
  return {root,body};
}

export function MythicGrotto({runtime,paused}:EnvironmentProps){
  const life=useMemo(()=>makeMythicGrotto(),[]);
  useEffect(()=>()=>life.root.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();(object.material as MeshStandardMaterial).dispose();}}),[life]);
  useFrame(()=>{if(!paused)life.body.rotation.set(0,Math.sin(runtime.current.activeElapsed*.07)*.018,0);});
  return <primitive object={life.root}/>;
}
