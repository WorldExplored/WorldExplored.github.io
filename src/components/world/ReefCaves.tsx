'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, SphereGeometry } from 'three';
import { applySurface } from './surfaceMaterials';
import { createReefCaveSites, caveVisitorPose, caveGroundLocal, type ReefCaveSite } from './reefCaveState';
import type { EnvironmentProps } from './Water';

/** A thick rock arch is open at both ends, with an actual illuminated inner surface. */
export function reefCaveGeometry(form:number) {
  const positions:number[]=[],colors:number[]=[],uvs:number[]=[],indices:number[]=[],angles=20,rings=10;
  const tint=new Color(['#8e9b94','#b0a58e','#7f9299'][form%3]);
  for(let surface=0;surface<2;surface++)for(let ring=0;ring<=rings;ring++)for(let side=0;side<=angles;side++){
    const a=side/angles*Math.PI,z=(ring/rings*2-1)*1.2;
    const irregular=surface===0?(1+.06*Math.sin(a*5+form)+.045*Math.cos(z*6+a*3)):1;
    const r=(surface===0?1.62:1.04)*irregular;
    const x=Math.cos(a)*r,y=Math.sin(a)*r*.86;
    positions.push(x,y,z+(surface===0?.045*Math.sin(a*7+form):0));uvs.push(x*.7,z*.7+y*.25);
    const shade=(surface===0?.83:.73)+Math.sin(a)*.13+.035*Math.sin(z*37+a*19);
    colors.push(tint.r*shade,tint.g*shade,tint.b*shade);
    if(ring&&side){const i=surface*(rings+1)*(angles+1)+ring*(angles+1)+side;
      if(surface===0)indices.push(i,i-angles-1,i-1,i-1,i-angles-1,i-angles-2);
      else indices.push(i,i-1,i-angles-1,i-1,i-angles-2,i-angles-1);
    }
  }
  const offset=(rings+1)*(angles+1);
  for(const end of [0,rings])for(let side=1;side<=angles;side++){
    const a=end*(angles+1)+side,b=a-1;
    if(end===0)indices.push(a,b,a+offset,b,b+offset,a+offset);
    else indices.push(a,a+offset,b,b,a+offset,b+offset);
  }
  for(let ring=1;ring<=rings;ring++)for(const side of [0,angles]){
    const a=ring*(angles+1)+side,b=a-angles-1;indices.push(a,a+offset,b,b,a+offset,b+offset);
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.openTunnel=true;return geometry;
}

/** A low fractured coastal shelf contains a jagged, recessed burrow under the shoreline. */
export function coastalBankCaveGeometry(site:ReefCaveSite){
  const positions:number[]=[],colors:number[]=[],uvs:number[]=[],indices:number[]=[];
  const mineral=[new Color('#687e79'),new Color('#929c89'),new Color('#556e72'),new Color('#a4a28a')];
  const vertex=(x:number,y:number,z:number,inner=false)=>{
    const band=Math.sin(x*1.7+z*2.3+site.form*2.1)+.45*Math.cos(x*3.1-z*.9);
    const tint=mineral[band>.75?1:band<-.7?2:0].clone().lerp(mineral[3],.22+.09*Math.sin(x*5+z*3));
    const ground=caveGroundLocal(site,x,z);
    tint.lerp(new Color('#b8b79c'),Math.max(0,Math.min(.7,(.20-(y-ground))*3)));
    const grain=(inner?.78-.44*Math.min(1,Math.max(0,-z)/2.45):.98)+.045*Math.sin(x*29+z*47+y*71);
    positions.push(x,y,z);colors.push(tint.r*grain,tint.g*grain,tint.b*grain);uvs.push(x*.8,z*.8+y*.24);return positions.length/3-1;
  };
  const floor=(x:number,z:number)=>caveGroundLocal(site,x,z),width=3.20,depth=5.4,sides=32;
  const form=site.form%5,mouthWidth=[1.58,1.80,1.30,1.39,1.64][form],mouthHeight=[.76,.71,.80,.90,.73][form];
  const submerged=(x:number,z:number)=>((-.57-.09*Math.sin(x*1.6+z*.8+site.form)) - site.y)/site.scale;
  const mouth=(a:number,t=0)=>{
    const radius=(mouthWidth-.13*t)*(1+.09*Math.sin(a*3+site.form*1.6)+.045*Math.cos(a*7+.5));
    const cosine=Math.cos(a),sine=Math.sin(a);
    const x=Math.sign(cosine)*Math.abs(cosine)**(form===3?1.1:.73)*radius,z=-2.65*t;
    const tooth=.07*Math.sin(a*5+site.form)*Math.sin(a);
    const top=Math.sign(sine)*Math.abs(sine)**(form===1?.43:form===4?.60:.82);
    const y=floor(x,z)+.92+top*(mouthHeight-.045*t)+tooth;
    return {x,y:Math.min(y,submerged(x,z)-.22),z};
  };
  const smooth=(t:number)=>{const v=Math.max(0,Math.min(1,t));return v*v*(3-2*v);};
  const frontInset=(u:number)=>-.56*Math.abs(u)**1.5+.10*Math.sin(u*6+site.form)*Math.abs(u);
  const shoulders=[[-1.9,-.45,.62,.66,.24],[-1.75,-1.65,.75,.9,.27],[1.94,-.67,.53,.8,.32],[1.58,-2.25,.67,.76,.21]];
  const ledge=(x:number,z:number,edge:number)=>{
    const inland=Math.max(0,Math.min(1,(-z-2.35)/3.05)),fall=1-inland*inland*(3-2*inland);
    const breaks=.16*Math.sin(x*2.9+site.form*1.7)+.11*Math.sin(x*5.1+z*1.9);
    const relief=shoulders.reduce((height,[cx,cz,rx,rz,h])=>height+h*Math.max(0,1-Math.abs((x-cx)/rx)-Math.abs((z-cz)/rz)),0);
    // Fractures are part of one surface, avoiding intersecting coplanar rock caps.
    return Math.min(floor(x,z)+.012+(1.98+breaks+.12*Math.sin(z*3.3+x*.4)+relief)*edge*fall,submerged(x,z));
  };
  const nx=32,nz=20,roofStart=positions.length/3;
  for(let row=0;row<=nz;row++)for(let col=0;col<=nx;col++){
    const u=col/nx*2-1,v=row/nz;
    const taper=(1-.67*smooth((v-.32)/.68))*(1+.035*Math.sin(v*7+site.form)*Math.sin(Math.PI*v));
    const x=u*width*taper+.13*Math.sin(v*4+site.form)*Math.sin(Math.PI*v);
    const z=-depth*v+frontInset(u)*(1-v)+.13*Math.sin(u*3+site.form)*v*(1-v);
    vertex(x,ledge(x,z,smooth((1-Math.abs(u))*2)),z);
    if(row&&col){const i=roofStart+row*(nx+1)+col;indices.push(i,i-1,i-nx-1,i-1,i-nx-2,i-nx-1);}
  }
  // The broken shelf surrounds a squat opening, instead of repeating a semicircular arch.
  const frontStart=positions.length/3,rings=6;
  for(let ring=0;ring<=rings;ring++)for(let side=0;side<=sides;side++){
    const a=side/sides*Math.PI*2,inside=mouth(a),xOuter=Math.cos(a)*width;
    const zOuter=frontInset(Math.cos(a));
    const yOuter=Math.sin(a)>=0?ledge(xOuter,zOuter,smooth((1-Math.abs(Math.cos(a)))*2)):floor(xOuter,zOuter)+.012;
    const t=ring/rings,x=inside.x+(xOuter-inside.x)*t;
    const fractures=.13*Math.sin(a*5+site.form)*Math.sin(Math.PI*t);
    const z=zOuter*t+.13*Math.sin(a*3+.4+site.form)*Math.sin(Math.PI*t);
    vertex(x,inside.y+(yOuter-inside.y)*t+fractures,z,true);
    if(ring&&side){const i=frontStart+ring*(sides+1)+side;indices.push(i,i-sides-1,i-1,i-1,i-sides-1,i-sides-2);}
  }
  const tunnelStart=positions.length/3,tunnelRings=16;
  for(let ring=0;ring<=tunnelRings;ring++)for(let side=0;side<=sides;side++){
    const p=mouth(side/sides*Math.PI*2,ring/tunnelRings);
    vertex(p.x,p.y,p.z,true);
    if(ring&&side){const i=tunnelStart+ring*(sides+1)+side;indices.push(i,i-1,i-sides-1,i-1,i-sides-2,i-sides-1);}
  }
  const backCenter=vertex(0,Math.min(floor(0,-2.90)+.72,submerged(0,-2.90)-.22),-2.90,true),backStart=tunnelStart+tunnelRings*(sides+1);
  for(let side=0;side<sides;side++)indices.push(backCenter,backStart+side,backStart+side+1);
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.coastalBurrow=true;geometry.userData.recessDepth=2.65*site.scale;geometry.userData.mouthWidth=mouthWidth*2*site.scale;geometry.userData.shelfGrid={nx,nz};
  return geometry;
}

export function createCaveEelGeometry() {
  const positions:number[]=[],colors:number[]=[],indices:number[]=[],rings=24,sides=7;
  for(let ring=0;ring<=rings;ring++)for(let side=0;side<=sides;side++){
    const t=ring/rings,a=side/sides*Math.PI*2,r=.083*(1-t*.94),stripe=.55+.4*Math.pow(Math.sin(t*23),2);
    positions.push(-t*.88,Math.cos(a)*r,Math.sin(a)*r);
    colors.push(.34*stripe,.62*stripe,.48*stripe);
    if(ring&&side){const i=ring*(sides+1)+side;indices.push(i,i-1,i-sides-1,i-1,i-sides-2,i-sides-1);}
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

export function createReefCaves() {
  const root=new Group();root.name='underwater-rock-caves';
  const sites=createReefCaveSites(),geometries:BufferGeometry[]=[],materials:MeshStandardMaterial[]=[],transform=new Object3D();
  const rockMaterial=applySurface(new MeshStandardMaterial({vertexColors:true,roughness:.98,side:DoubleSide}),'mineral');materials.push(rockMaterial);
  sites.forEach(site=>{
    const geometry=site.kind==='bank'?coastalBankCaveGeometry(site):reefCaveGeometry(site.form);geometries.push(geometry);
    const cave=new Mesh(geometry,rockMaterial);cave.name=`${site.kind==='bank'?'coastal-burrow':'open-reef-cave'}-${site.form}`;cave.position.set(site.x,site.y,site.z);cave.rotation.y=site.yaw;cave.scale.setScalar(site.scale);cave.receiveShadow=true;cave.castShadow=site.kind!=='bank';cave.raycast=()=>{};root.add(cave);
  });
  const time={value:0},eelMaterial=new MeshStandardMaterial({vertexColors:true,roughness:.63});materials.push(eelMaterial);
  eelMaterial.onBeforeCompile=shader=>{
    shader.uniforms.caveTime=time;
    shader.vertexShader=`uniform float caveTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>
      float tail=clamp(-position.x/.88,0.,1.);
      transformed.z+=sin(caveTime*3.3+position.x*11.+instanceMatrix[3].x)*tail*tail*.095;
    `);
  };
  eelMaterial.customProgramCacheKey=()=> 'cave-eel-tail-wave-v1';
  const bodyGeometry=createCaveEelGeometry(),headGeometry=new SphereGeometry(.09,9,6).scale(1.7,.85,.75).translate(.04,0,0);
  const eyeGeometry=new SphereGeometry(.012,6,4).translate(.128,.035,.05);
  geometries.push(bodyGeometry,headGeometry,eyeGeometry);
  const headMaterial=new MeshStandardMaterial({color:'#557e66',roughness:.63}),eyeMaterial=new MeshStandardMaterial({color:'#1a2724',roughness:.5});materials.push(headMaterial,eyeMaterial);
  const eelBody=new InstancedMesh(bodyGeometry,eelMaterial,sites.length),eelHead=new InstancedMesh(headGeometry,headMaterial,sites.length),eelEye=new InstancedMesh(eyeGeometry,eyeMaterial,sites.length*2);
  eelBody.name='cave-eel-tapered-bodies';eelHead.name='cave-eel-low-profile-heads';eelEye.name='cave-eel-small-eyes';
  const fishGeometry=new SphereGeometry(.11,7,5).scale(1.2,.72,.46);
  // Fish tails taper into a small fork, kept in the same instanced material batch.
  const tail=new BufferGeometry();tail.setAttribute('position',new Float32BufferAttribute([-.09,0,0,-.21,.065,0,-.185,0,0,-.21,-.065,0],3));tail.setIndex([0,1,2,0,2,3]);tail.computeVertexNormals();
  geometries.push(fishGeometry,tail);
  const fishMaterial=new MeshStandardMaterial({color:'#d6c579',roughness:.6,side:DoubleSide});materials.push(fishMaterial);
  const fishBody=new InstancedMesh(fishGeometry,fishMaterial,sites.length*3),fishTail=new InstancedMesh(tail,fishMaterial,sites.length*3);
  fishBody.name='cave-minnow-bodies';fishTail.name='cave-minnow-forked-tails';
  const moving=[eelBody,eelHead,eelEye,fishBody,fishTail];moving.forEach(mesh=>{mesh.frustumCulled=false;mesh.raycast=()=>{};root.add(mesh);});
  function update(elapsed:number,paused=false){
    if(paused)return;
    time.value=elapsed;
    sites.forEach((site,index)=>{
      const pose=caveVisitorPose(site,0,elapsed);transform.position.set(pose.x,pose.y,pose.z);transform.rotation.set(0,pose.heading,pose.pitch,'YXZ');transform.scale.setScalar(site.scale);transform.updateMatrix();
      eelBody.setMatrixAt(index,transform.matrix);eelHead.setMatrixAt(index,transform.matrix);eelEye.setMatrixAt(index*2,transform.matrix);
      transform.scale.z*=-1;transform.updateMatrix();eelEye.setMatrixAt(index*2+1,transform.matrix);
      for(let fish=1;fish<=3;fish++){
        const pose=caveVisitorPose(site,fish,elapsed);transform.position.set(pose.x,pose.y,pose.z);transform.rotation.set(0,pose.heading,pose.pitch,'YXZ');transform.scale.setScalar(site.scale*(.8+fish*.12));transform.updateMatrix();
        fishBody.setMatrixAt((fish-1)*sites.length+index,transform.matrix);fishTail.setMatrixAt((fish-1)*sites.length+index,transform.matrix);
      }
    });
    moving.forEach(mesh=>{mesh.instanceMatrix.needsUpdate=true;});
  }
  update(0);
  function setQuality(quality:EnvironmentProps['quality']){fishBody.count=fishTail.count=sites.length*(quality==='low'?1:quality==='medium'?2:3);}
  let timer:ReturnType<typeof setTimeout>|undefined;
  function dispose(){geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());moving.forEach(mesh=>mesh.dispose());}
  return {root,sites,update,setQuality,dispose,retain(){clearTimeout(timer);return()=>{timer=setTimeout(dispose,0);};}};
}

export function ReefCaves({runtime,paused,quality}:EnvironmentProps) {
  const caves=useMemo(()=>createReefCaves(),[]);
  useEffect(()=>{caves.setQuality(quality);},[caves,quality]);
  useEffect(()=>caves.retain(),[caves]);
  useFrame(()=>caves.update(runtime.current.elapsed,paused));
  return <primitive object={caves.root} dispose={null}/>;
}
