'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applySurface, surfaceTexture } from './surfaceMaterials';
import { coastalRockGeometry } from './coastalRocks';
import { createSeaweedGeometry } from './Seaweed';
import { getReefHabitat, reefFloorHeight, type ReefObstacle } from './reefHabitat';
import { landDistance, smooth } from './terrain';
import type { EnvironmentProps } from './Water';

function floorVertexHeight(x:number,z:number) {
  return Math.min(-2.4,reefFloorHeight(x,z))-smooth(22,75,-landDistance(x,z))*35;
}

/** Sample the rendered one-metre triangles, not just the analytic height field. */
function floorMeshHeight(x:number,z:number) {
  const ix=Math.floor(x),iz=Math.floor(z),u=x-ix,v=z-iz;
  const a=floorVertexHeight(ix,iz),b=floorVertexHeight(ix+1,iz),c=floorVertexHeight(ix,iz+1),d=floorVertexHeight(ix+1,iz+1);
  return u+v<=1?a*(1-u-v)+b*u+c*v:d*(u+v-1)+b*(1-v)+c*(1-u);
}

/** One translucent instance batch seats each colony in the actual rippled sand surface. */
export function createReefContactShade(entries:ReefObstacle[]) {
  const geometry=new PlaneGeometry(2,2,3,3).rotateX(-Math.PI/2);
  const heights=Array.from({length:4},()=>new Float32Array(entries.length*4));
  const material=new MeshBasicMaterial({color:'#174b43',transparent:true,opacity:.24,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=`attribute vec4 contactA; attribute vec4 contactB; attribute vec4 contactC; attribute vec4 contactD; varying vec2 contactUv;\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>
      contactUv = uv;
      float column = (position.x + 1.) * 1.5;
      float row = (position.z + 1.) * 1.5;
      vec4 rowHeights = row < .5 ? contactA : row < 1.5 ? contactB : row < 2.5 ? contactC : contactD;
      transformed.y = column < .5 ? rowHeights.x : column < 1.5 ? rowHeights.y : column < 2.5 ? rowHeights.z : rowHeights.w;
    `);
    shader.fragmentShader=`varying vec2 contactUv;\n${shader.fragmentShader}`.replace('#include <color_fragment>',`#include <color_fragment>
      float radius = length((contactUv - .5) * 2.);
      diffuseColor.a *= pow(1. - smoothstep(.12, 1., radius), 2.);
    `);
  };
  material.customProgramCacheKey=()=> 'terrain-conforming-reef-contact-v1';
  const mesh=new InstancedMesh(geometry,material,entries.length),transform=new Object3D();
  mesh.name='reef-soft-contact-shading';mesh.raycast=()=>{};mesh.renderOrder=-1;
  entries.forEach((entry,index)=>{
    const radius=entry.radius*1.32+.12,cos=Math.cos(entry.rotation),sin=Math.sin(entry.rotation);
    transform.position.set(entry.x,0,entry.z);transform.rotation.set(0,entry.rotation,0);transform.scale.set(radius,1,radius*.87);transform.updateMatrix();mesh.setMatrixAt(index,transform.matrix);
    for(let row=0;row<4;row++)for(let col=0;col<4;col++) {
      const lx=(col/3*2-1)*radius,lz=(row/3*2-1)*radius*.87;
      heights[row][index*4+col]=floorMeshHeight(entry.x+cos*lx+sin*lz,entry.z-sin*lx+cos*lz)+.035;
    }
  });
  ['contactA','contactB','contactC','contactD'].forEach((name,row)=>geometry.setAttribute(name,new InstancedBufferAttribute(heights[row],4)));
  mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;
  const fullMatrices=mesh.instanceMatrix.array.slice(),hiddenScale=new Vector3(0,0,0);
  function setVisibleSites(visible:Set<ReefObstacle>){
    mesh.instanceMatrix.array.set(fullMatrices);
    entries.forEach((entry,index)=>{if(!visible.has(entry))mesh.setMatrixAt(index,transform.matrix.fromArray(fullMatrices,index*16).scale(hiddenScale));});
    mesh.instanceMatrix.needsUpdate=true;
  }
  return {mesh,geometry,material,setVisibleSites};
}

export function reefSeafloorGeometry() {
  const positions: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [];
  const width = 206, depth = 216;
  for (let row = 0; row < depth; row++) for (let col = 0; col < width; col++) {
    const x = col - 115, z = row - 140, distance = landDistance(x,z);
    const y = floorVertexHeight(x,z);
    positions.push(x,y,z); uvs.push(x*.3,z*.3);
    // Match the island shader's submerged shelf before introducing pale sand further out.
    // The source named sand-color is dark mossy rock, so its raw albedo is unsuitable here.
    const depth = Math.max(0,-reefFloorHeight(x,z)-.18), blend=smooth(.4,3.5,depth);
    const shelf=[.55*(1-blend)+.16*blend,.74*(1-blend)+.43*blend,.60*(1-blend)+.38*blend];
    const openSand=smooth(6.8,12,-distance)*.62;
    const shade=1+smooth(6.8,9,-distance)*(.025*Math.sin(x*.27+z*.13)+.015*Math.cos(x*.69-z*.52));
    colors.push((shelf[0]*(1-openSand)+.39*openSand)*shade,(shelf[1]*(1-openSand)+.57*openSand)*shade,(shelf[2]*(1-openSand)+.44*openSand)*shade);
    if (row && col) { const i=row*width+col; indices.push(i,i-width,i-1,i-1,i-width,i-width-1); }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

function stem(ax:number,ay:number,az:number,bx:number,by:number,bz:number,radius:number) {
  const a=new Vector3(ax,ay,az),b=new Vector3(bx,by,bz),axis=b.clone().sub(a),transform=new Object3D();
  transform.position.copy(a).add(b).multiplyScalar(.5);
  transform.quaternion.setFromUnitVectors(new Vector3(0,1,0),axis.clone().normalize());transform.updateMatrix();
  return new CylinderGeometry(radius*.57,radius,axis.length(),5).applyMatrix4(transform.matrix);
}

/** Five modest shared meshes provide recognizable coral silhouettes at colony scale. */
export function reefCoralGeometry(form:number) {
  const parts:BufferGeometry[]=[];
  if(form===0) {
    parts.push(stem(0,0,0,0,.73,0,.065));
    for(let branch=0;branch<7;branch++) {
      const a=branch*2.399, y=.2+branch*.055, x=Math.cos(a)*.33,z=Math.sin(a)*.33;
      parts.push(stem(0,y,0,x,.75+branch*.03,z,.034));
      for(let twig=0;twig<2;twig++)parts.push(stem(x*.55,y+.18,z*.55,x+Math.cos(a+.9+twig)*.16,.82+twig*.13,z+Math.sin(a+.9+twig)*.16,.019));
    }
  } else if(form===1) {
    parts.push(stem(0,0,0,0,.74,0,.08));
    for(let level=0;level<3;level++) {
      const radius=.7-level*.13, y=.28+level*.27;
      const table=new CylinderGeometry(radius,radius*.94,.06,20,1);
      const p=table.getAttribute('position');
      for(let i=0;i<p.count;i++) {
        const x=p.getX(i),z=p.getZ(i),a=Math.atan2(z,x);
        p.setXYZ(i,x*(1+.08*Math.sin(a*5)),p.getY(i)+y+.035*Math.sin(a*7),z*(1+.09*Math.sin(a*3)));
      }
      table.computeVertexNormals();parts.push(table);
    }
  } else if(form===2) {
    parts.push(stem(0,0,0,0,.28,0,.045));
    for(let rib=0;rib<9;rib++) {
      const a=-1.12+rib*.28, x=Math.sin(a)*.59,y=.28+Math.cos(a)*.75;
      parts.push(stem(0,.18,0,x,y,.015*Math.sin(rib),.016));
      for(let rung=1;rung<4&&rib<8;rung++) {
        const t=rung/4;
        parts.push(stem(x*t,.18+(y-.18)*t,0,Math.sin(a+.28)*.59*t,.18+(.1+Math.cos(a+.28)*.75)*t,0,.008));
      }
    }
  } else if(form===3) {
    const positions:number[]=[],indices:number[]=[];
    for(let ring=0;ring<=9;ring++)for(let side=0;side<=24;side++) {
      const t=ring/9,a=side/24*Math.PI*2,r=.52*Math.cos(t*Math.PI/2),groove=.024*Math.sin(a*12+t*27)+.016*Math.sin(a*7-t*19);
      positions.push(Math.cos(a)*(r+groove*Math.sin(t*Math.PI)),t*.89,Math.sin(a)*(r+groove*Math.sin(t*Math.PI)));
      if(ring&&side){const i=ring*25+side;indices.push(i,i-25,i-1,i-1,i-25,i-26);}
    }
    const brain=new BufferGeometry();brain.setAttribute('position',new Float32BufferAttribute(positions,3));brain.setIndex(indices);brain.computeVertexNormals();parts.push(brain);
  } else {
    for(let tube=0;tube<7;tube++) {
      const a=tube*2.4,r=Math.sqrt(tube/7)*.3,h=.48+(tube%3)*.22;
      // An open hollow rim makes these distinct vase sponges rather than capped poles.
      const wall=new CylinderGeometry(.105,.063,h,8,1,true).translate(Math.cos(a)*r,h*.5,Math.sin(a)*r);
      parts.push(wall);
      const rim=new CylinderGeometry(.105,.105,.018,8,1,true).scale(.75,1,.75).translate(Math.cos(a)*r,h-.009,Math.sin(a)*r);parts.push(rim);
    }
  }
  parts.forEach(part=>part.deleteAttribute('uv'));
  const geometry=mergeGeometries(parts)!;parts.forEach(part=>part.dispose());
  geometry.computeBoundingBox();const box=geometry.boundingBox!;
  geometry.translate(0,-box.min.y,0);geometry.scale(1,1/(box.max.y-box.min.y),1);
  const p=geometry.getAttribute('position'),colors:number[]=[];
  for(let i=0;i<p.count;i++) {
    const shade=.71+p.getY(i)*.3+.07*Math.sin(p.getX(i)*47+p.getZ(i)*59+p.getY(i)*23);
    colors.push(shade,shade,shade);
  }
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();
  geometry.userData.form=['branching-staghorn','layered-table','reticulated-sea-fan','ridged-brain','hollow-vase-sponge'][form];return geometry;
}

export function createReefHabitat() {
  const root=new Group();root.name='full-channel-reef-habitat';
  const geometries:BufferGeometry[]=[],materials:(MeshStandardMaterial|MeshBasicMaterial)[]=[],batches:{mesh:InstancedMesh;count:number}[]=[];
  const time={value:0}, transform=new Object3D(),color=new Color(),plan=getReefHabitat();
  const floorMaterial=new MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.94,envMapIntensity:.2});
  floorMaterial.normalMap=surfaceTexture('sand','normal');floorMaterial.normalScale.set(.14,.14);
  floorMaterial.roughnessMap=surfaceTexture('sand','arm');floorMaterial.aoMap=floorMaterial.roughnessMap;floorMaterial.aoMapIntensity=.3;
  floorMaterial.onBeforeCompile=shader=>{
    shader.vertexShader=`varying vec2 sandXZ;\n${shader.vertexShader}`.replace('#include <begin_vertex>','#include <begin_vertex>\n sandXZ = position.xz;');
    shader.fragmentShader=`varying vec2 sandXZ;\n${shader.fragmentShader}`.replace('#include <map_fragment>',`
      float dune = sin(sandXZ.x * 3.7 + sandXZ.y * 7. + sin(sandXZ.x * .6) * 1.4);
      float fineGrain = fract(sin(dot(floor(sandXZ * 48.), vec2(127.1,311.7))) * 43758.5453);
      diffuseColor.rgb *= .986 + dune * .015 + fineGrain * .028;
    `);
  };
  floorMaterial.customProgramCacheKey=()=> 'continuous-submerged-sand-v2';materials.push(floorMaterial);
  const floorGeometry=reefSeafloorGeometry();geometries.push(floorGeometry);
  const floor=new Mesh(floorGeometry,floorMaterial);floor.name='continuous-rippled-sand-seafloor';floor.receiveShadow=true;floor.raycast=()=>{};root.add(floor);
  const contact=createReefContactShade([...plan.rocks,...plan.colonies]);geometries.push(contact.geometry);materials.push(contact.material);root.add(contact.mesh);
  const coralMaterial=new MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.88,side:DoubleSide});materials.push(coralMaterial);
  const palette=['#df876b','#bf67a9','#dfb95d','#528eae','#b85575','#749946','#5baa9b','#a684bb'];
  function instances(name:string,geometry:BufferGeometry,material:MeshStandardMaterial,entries:ReefObstacle[],scale:(entry:ReefObstacle)=>[number,number,number],tint?:(entry:ReefObstacle)=>string) {
    geometries.push(geometry);const mesh=new InstancedMesh(geometry,material,entries.length);mesh.name=name;mesh.raycast=()=>{};mesh.receiveShadow=true;
    entries.forEach((entry,i)=>{
      transform.position.set(entry.x,entry.y,entry.z);transform.rotation.set(0,entry.rotation,0);transform.scale.fromArray(scale(entry));transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
      if(tint)mesh.setColorAt(i,color.set(tint(entry)));
    });
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();batches.push({mesh,count:entries.length});root.add(mesh);return mesh;
  }
  for(let form=0;form<5;form++) {
    const geometry=reefCoralGeometry(form);geometry.computeBoundingBox();
    const positions=geometry.getAttribute('position');let radius=0;
    for(let i=0;i<positions.count;i++)radius=Math.max(radius,Math.hypot(positions.getX(i),positions.getZ(i)));
    instances(`reef-colony-${geometry.userData.form}`,geometry,coralMaterial,plan.colonies.filter(entry=>entry.form===form),entry=>[entry.radius/radius,entry.height,entry.radius/radius],entry=>palette[entry.color]);
  }
  const rockMaterial=applySurface(new MeshStandardMaterial({vertexColors:true,roughness:.96}),'mineral');materials.push(rockMaterial);
  for(let form=0;form<4;form++) {
    const geometry=coastalRockGeometry(form);geometry.computeBoundingBox();const box=geometry.boundingBox!;
    geometry.translate(0,-box.min.y,0);geometry.scale(1,1/(box.max.y-box.min.y),1);
    const colors=geometry.getAttribute('color');
    for(let i=0;i<colors.count;i++){const shade=.81+.11*Math.sin(i*.071);colors.setXYZ(i,shade,shade*.91,shade*.75);}
    const p=geometry.getAttribute('position');let radius=0;
    for(let i=0;i<p.count;i++)radius=Math.max(radius,Math.hypot(p.getX(i),p.getZ(i)));
    instances(`reef-weathered-limestone-${form}`,geometry,rockMaterial,plan.rocks.filter(entry=>entry.form===form),entry=>[entry.radius/radius,entry.height,entry.radius/radius]);
  }
  for(let form=0;form<3;form++) {
    const material=new MeshStandardMaterial({vertexColors:true,roughness:.86,side:DoubleSide});materials.push(material);
    material.onBeforeCompile=shader=>{
      shader.uniforms.reefTime=time;
      shader.vertexShader=`uniform float reefTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>
        float phase = instanceMatrix[3].x * .7 + instanceMatrix[3].z * .5;
        transformed.x += sin(reefTime * .6 + phase) * position.y * position.y * .09;
        transformed.z += cos(reefTime * .4 + phase) * position.y * position.y * .055;
      `);
    };
    material.customProgramCacheKey=()=>`channel-seaweed-${form}`;
    const entries=plan.plants.filter(entry=>entry.form===form);
    instances(`reef-seagrass-${form}`,createSeaweedGeometry(form),material,entries,entry=>[(entry as typeof entries[number]).width,entry.height,(entry as typeof entries[number]).width]);
  }
  let timer:ReturnType<typeof setTimeout>|undefined;
  function dispose(){geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());batches.forEach(batch=>batch.mesh.dispose());contact.mesh.dispose();}
  function setQuality(quality:EnvironmentProps['quality']){
    const fraction=quality==='high'?1:quality==='medium'?.76:.52;batches.forEach(batch=>{batch.mesh.count=Math.ceil(batch.count*fraction);});
    const visible=new Set<ReefObstacle>();
    for(const entries of [plan.rocks,plan.colonies])for(let form=0;form<5;form++){
      const group=entries.filter(entry=>entry.form===form);group.slice(0,Math.ceil(group.length*fraction)).forEach(entry=>visible.add(entry));
    }
    contact.setVisibleSites(visible);
  }
  return {root,setQuality,update(elapsed:number,paused=false){if(!paused)time.value=elapsed;},dispose,retain(){clearTimeout(timer);return()=>{timer=setTimeout(dispose,0);};}};
}

export function ReefHabitat({runtime,paused,quality}:EnvironmentProps) {
  const habitat=useMemo(()=>createReefHabitat(),[]);
  useEffect(()=>habitat.retain(),[habitat]);
  useEffect(()=>{habitat.setQuality(quality);},[habitat,quality]);
  useFrame(()=>habitat.update(runtime.current.elapsed,paused));
  return <primitive object={habitat.root} dispose={null} />;
}
