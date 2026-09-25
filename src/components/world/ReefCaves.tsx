'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, SphereGeometry } from 'three';
import { applySurface } from './surfaceMaterials';
import { createReefCaveSites, caveVisitorPose } from './reefCaveState';
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
    const geometry=reefCaveGeometry(site.form);geometries.push(geometry);
    const cave=new Mesh(geometry,rockMaterial);cave.name=`open-reef-cave-${site.form}`;cave.position.set(site.x,site.y,site.z);cave.rotation.y=site.yaw;cave.scale.setScalar(site.scale);cave.receiveShadow=true;cave.castShadow=true;cave.raycast=()=>{};root.add(cave);
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
      const pose=caveVisitorPose(site,0,elapsed);transform.position.set(pose.x,pose.y,pose.z);transform.rotation.set(0,pose.heading,0);transform.scale.setScalar(site.scale);transform.updateMatrix();
      eelBody.setMatrixAt(index,transform.matrix);eelHead.setMatrixAt(index,transform.matrix);eelEye.setMatrixAt(index*2,transform.matrix);
      transform.scale.z*=-1;transform.updateMatrix();eelEye.setMatrixAt(index*2+1,transform.matrix);
      for(let fish=1;fish<=3;fish++){
        const pose=caveVisitorPose(site,fish,elapsed);transform.position.set(pose.x,pose.y,pose.z);transform.rotation.set(0,pose.heading,0);transform.scale.setScalar(site.scale*(.8+fish*.12));transform.updateMatrix();
        fishBody.setMatrixAt((fish-1)*sites.length+index,transform.matrix);fishTail.setMatrixAt((fish-1)*sites.length+index,transform.matrix);
      }
    });
    moving.forEach(mesh=>{mesh.instanceMatrix.needsUpdate=true;});
  }
  update(0);
  function setQuality(quality:EnvironmentProps['quality']){fishBody.count=fishTail.count=quality==='low'?6:9;}
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
