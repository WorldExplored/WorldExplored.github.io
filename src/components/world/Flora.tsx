'use client';

import { measureConstruction } from './renderDiagnostics';

// Frame callbacks mutate persistent Three.js resources outside React rendering.
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, MeshPhysicalMaterial, Object3D, Vector3 } from 'three';
import { createLandscapePlan, distanceToSegment, islandAt, landDistance, seededRandom, terrainHeight, terrainSlope, vegetationSuitability } from './terrain';
import type { EnvironmentProps } from './Water';

export type FloraKind = 'reeds' | 'beach' | 'shrub' | 'flower' | 'broadleaf' | 'sedge' | 'clover' | 'fern';
export interface FloraSite { x: number; y: number; z: number; scale: number; rotation: number; kind: FloraKind }
const KINDS: FloraKind[] = ['reeds', 'beach', 'shrub', 'flower', 'broadleaf', 'sedge', 'clover', 'fern'];

export function createFloraSites() {
  const random = seededRandom(4621); const plan = createLandscapePlan(); const sites: FloraSite[] = [];
  const anchors: Array<[number,number,number,FloraKind]> = [
    [-16,20,4,'flower'],[-7,24,3,'flower'],[3,22,3,'flower'],[16,25,3,'flower'],[3,23,1.4,'broadleaf'],[-1,-11,1.6,'broadleaf'],[-4,-11,2,'flower'],
    [-8,-12,2,'fern'],[2,-14,2,'fern'],[2,-14,2,'clover'],[6,23,3,'clover'],[-4,21,3,'clover'],[-13,-4,3,'clover'],[-4,-85,3,'clover'],[6,-81,3,'clover'],[-14,-84,2,'clover'],[-18,-80,3,'flower'],[5,-80,3,'flower'],[-24,-67,3,'shrub'],[13,-66,3,'clover'],[-15,1,3,'shrub'],[-4,4,3,'shrub'],[8,-3,2,'shrub'],[3,-13,3,'shrub'],[-23,-69,2,'shrub'],[2,-64,2,'shrub'],
  ];
  for (let round = 0; round < 100; round++) for (const [ax,az,radius,kind] of anchors) {
    const angle = random()*Math.PI*2; const r=Math.sqrt(random())*radius; const x=ax+Math.cos(angle)*r; const z=az+Math.sin(angle)*r;
    const reach=kind==='broadleaf'?1.55:kind==='shrub'?1.3:1.0;
    if(vegetationSuitability(x,z,reach,plan)<.13)continue;
    const spacing=kind==='broadleaf'?.85:kind==='shrub'?.65:kind==='flower'?.5:.35;
    if(sites.some(site=>Math.hypot(x-site.x,z-site.z)<spacing))continue;
    sites.push({x,y:terrainHeight(x,z),z,kind,scale:.7+random()*.65,rotation:random()*Math.PI*2});
  }
  for(let index=0;index<3200;index++) {
    const x=-34+random()*71;const z=-26+random()*65; const distance=landDistance(x,z);
    if(distance<.55||distance>3.8||terrainSlope(x,z)>.55)continue;
    if(plan.paths.some(path=>path.points.slice(1).some((point,i)=>distanceToSegment(x,z,path.points[i],point)<path.width/2+.9)))continue;
    if([...plan.structures,...plan.rocks,...plan.trees].some(item=>Math.hypot(x-item.x,z-item.z)<item.radius+.9))continue;
    const island=islandAt(x,z).island;
    const kind:FloraKind=distance<2.2&&island.id==='garden'&&Math.sin(x*.31+z*.17)>.2?'reeds':distance>2.5?'sedge':'beach';
    // Small continuous ecological patches, separated by open sand.
    if(Math.sin(x*.55+z*.32)+Math.cos(z*.65-x*.19)<.6)continue;
    sites.push({x,y:terrainHeight(x,z),z,kind,scale:.65+random()*.55,rotation:random()*Math.PI*2});
  }
  return sites;
}

export function floraGeometry(kind:FloraKind) {
  const positions:number[]=[];const colors:number[]=[];const indices:number[]=[];const random=seededRandom(940+KINDS.indexOf(kind));const tint=new Color();
  function leaf(angle:number,length:number,width:number,height:number,lean:number,color:string,offsetX=0,offsetZ=0) {
    const start=positions.length/3;tint.set(color);
    for(let segment=0;segment<=10;segment++) {
      const t=segment/10;
      const serration=kind==='fern'||kind==='shrub'?1+.06*Math.sin(segment*Math.PI*.8):1;
      const breadth=Math.pow(Math.sin(t*Math.PI),.8)*width*serration;
      for(let rib=0;rib<=4;rib++) {
        const side=rib/2-1;
        const x=side*breadth,z=t*length;
        const fold=Math.sin(t*Math.PI)*width*(.14*(1-Math.abs(side))-.16*side*side);
        const y=height*t+Math.sin(t*Math.PI)*lean+fold;
        positions.push(offsetX+x*Math.cos(angle)+z*Math.sin(angle),y,offsetZ-x*Math.sin(angle)+z*Math.cos(angle));
        const vein=rib===2||Math.abs(Math.sin(t*31-Math.abs(side)*2.2))<.22;
        const light=(.72+t*.22)+(vein?.12:0);
        colors.push(tint.r*light,tint.g*light,tint.b*light);
      }
      if(segment<10)for(let rib=0;rib<4;rib++){const n=start+segment*5+rib;indices.push(n,n+1,n+5,n+1,n+6,n+5);}
    }
  }

  function petal(cx:number,cy:number,cz:number,angle:number,color:string) {
    const start=positions.length/3;tint.set(color);
    for(let ring=0;ring<=7;ring++){
      const t=ring/7;const w=Math.sin(t*Math.PI)*.023;const r=.016+t*.066;
      for(const side of [-1,1]) {positions.push(cx+Math.cos(angle)*r-Math.sin(angle)*w*side,cy+Math.sin(t*Math.PI)*.018,cz+Math.sin(angle)*r+Math.cos(angle)*w*side);colors.push(tint.r,tint.g,tint.b);}
      if(ring<7){const n=start+ring*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
    }
  }
  if(kind==='reeds'||kind==='beach'||kind==='sedge')for(let i=0;i<9;i++)leaf(i*2.399,.16+random()*.25,kind==='reeds'?.035:kind==='sedge'?.055:.018,(kind==='reeds'?1.3:kind==='sedge'?.32:.65)+random()*.3,.1,kind==='reeds'?'#608e2b':'#8da94a',(random()-.5)*.25,(random()-.5)*.25);
  if(kind==='clover')for(let cluster=0;cluster<9;cluster++) {
    const a=cluster*2.399,r=Math.sqrt(cluster/9)*.5,x=Math.cos(a)*r,z=Math.sin(a)*r;
    for(let l=0;l<3;l++)leaf(l*Math.PI*2/3,.13,.075,.09,.025,l===0?'#70974c':'#517f37',x,z);
  }
  if(kind==='fern')for(let frond=0;frond<7;frond++) {
    const a=frond*2.399;leaf(a,.65,.016,.42,.20,'#5b8539');
    for(let level=1;level<8;level++)for(const side of [-1,1]) {
      const t=level/9,length=.20*Math.sin(t*Math.PI);
      leaf(a+side*1.12,length,.028,.07,.035,level%2?'#4d853a':'#639c44',Math.sin(a)*t*.65,Math.cos(a)*t*.65);
      // Lift the paired pinnae along the arching rachis.
      const vertices=55;for(let j=positions.length-vertices*3;j<positions.length;j+=3)positions[j+1]+=.42*t+Math.sin(t*Math.PI)*.20;
    }
  }
  if(kind==='broadleaf')for(let i=0;i<8;i++)leaf(i*2.399,.65+random()*.35,.20,.45+random()*.45,.27,i%2?'#287843':'#58a432');
  if(kind==='shrub')for(let i=0;i<26;i++)leaf(i*2.399,.25+random()*.45,.075,.3+random()*.55,.12,i%3?'#286c3f':'#4e9147',(random()-.5)*.4,(random()-.5)*.4);
  if(kind==='flower')for(let bloom=0;bloom<3;bloom++) {
    const x=(bloom-1)*.25;const z=Math.sin(bloom*2.1)*.23;const y=.55+bloom*.12;
    leaf(bloom,.01,.012,y,0,'#438832',x,z);
    const petals=bloom===0?12:bloom===1?5:8;
    for(let p=0;p<petals;p++)petal(x,y,z,p/petals*Math.PI*2,bloom===0?'#fffdf0':bloom===1?'#ea91ac':'#f2c552');
    const center=positions.length/3;tint.set('#dba526');positions.push(x,y+.025,z);colors.push(tint.r,tint.g,tint.b);
    for(let p=0;p<=12;p++){const a=p/12*Math.PI*2;positions.push(x+Math.cos(a)*.025,y+.028,z+Math.sin(a)*.025);colors.push(tint.r,tint.g,tint.b);if(p<12)indices.push(center,center+p+1,center+p+2);}
    for(let l=0;l<3;l++)leaf(l*2.399,.25,.06,y*.6,.08,'#408f30',x,z);
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function Flora({runtime,paused,quality}:EnvironmentProps) {
  const flora=useMemo(()=>{
    const sites=measureConstruction('flora-sites', () => createFloraSites());const transform=new Object3D();
    const uniforms={time:{value:0},pointer:{value:new Vector3(10000,0,10000)},strength:{value:0}};
    const batches=KINDS.map((kind,index)=>{
      const entries=sites.filter(site=>site.kind===kind);const geometry=floraGeometry(kind);
      const material=new MeshPhysicalMaterial({vertexColors:true,side:DoubleSide,roughness:kind==='broadleaf'?.46:.78,clearcoat:kind==='broadleaf'?.18:.02,envMapIntensity:.2});
      material.onBeforeCompile=shader=>{
        shader.uniforms.floraTime=uniforms.time;shader.uniforms.floraPointer=uniforms.pointer;shader.uniforms.floraStrength=uniforms.strength;
        shader.vertexShader=`uniform float floraTime;uniform vec3 floraPointer;uniform float floraStrength;\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>\nvec2 origin=instanceMatrix[3].xz;float phase=origin.x*.7+origin.y*.4;float wind=sin(floraTime*${[.8,1.3,.48,1.1,.36,1.1,.5,.6][index]}+phase)*.08+sin(floraTime*.43-phase)*.025;transformed.x+=wind*position.y*position.y;vec2 away=origin-floraPointer.xz;float wake=(1.-smoothstep(.2,2.4,length(away)))*floraStrength;transformed.xz+=away/max(.1,length(away))*wake*position.y*.25;`);
      };
      material.customProgramCacheKey=()=>`coastal-flora-${kind}`;
      const mesh=new InstancedMesh(geometry,material,entries.length);mesh.name=`flora-${kind}`;mesh.frustumCulled=false;
      entries.forEach((site,i)=>{transform.position.set(site.x,site.y,site.z);transform.rotation.set(0,site.rotation,0);transform.scale.setScalar(site.scale);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);});
      return {mesh,geometry,material,maximum:entries.length};
    });
    return {batches,uniforms,timer:undefined as ReturnType<typeof setTimeout>|undefined};
  },[]);
  useEffect(()=>{clearTimeout(flora.timer);return()=>{flora.timer=setTimeout(()=>flora.batches.forEach(b=>{b.geometry.dispose();b.material.dispose();b.mesh.dispose();}),0);};},[flora]);
  useFrame(({camera})=>{
    const detail=camera.position.y>95?.5:camera.position.y>65?.75:1;
    flora.batches.forEach(batch=>{batch.mesh.count=Math.ceil(batch.maximum*(quality==='high'?1:quality==='medium'?.7:.4)*detail);});
    if(paused)return;flora.uniforms.time.value=runtime.current.elapsed;flora.uniforms.pointer.value.fromArray(runtime.current.pointerWorld);flora.uniforms.strength.value=runtime.current.pointerActive?1:0;
  });
  return <group name="coastal-flora" dispose={null}>{flora.batches.map(batch=><primitive key={batch.mesh.uuid} object={batch.mesh}/>)}</group>;
}
