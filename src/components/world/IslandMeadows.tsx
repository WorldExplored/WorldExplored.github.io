'use client';
/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DoubleSide, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { createLandscapePlan, ISLANDS, islandAt, islandContour, seededRandom, terrainMeshHeight, vegetationSuitability } from './terrain';
import { lighthouseEscarpmentSites } from './LighthouseEscarpment';
import { BEACH_PALMS } from './coastalBiome';
import { meadowGeometry } from './MeadowGeometry';
import type { EnvironmentProps } from './Water';

export interface MeadowSite {x:number;y:number;z:number;height:number;width:number;rotation:number;region:string;form:number;tint:number}
let meadowSiteCache:MeadowSite[]|undefined;
export function createIslandMeadowSites():MeadowSite[]{
  if(meadowSiteCache)return meadowSiteCache;
  const random=seededRandom(740322),plan=createLandscapePlan(),sites:MeadowSite[]=[],occupied=new Map<string,MeadowSite[]>();
  const patches=ISLANDS.flatMap(island=>Array.from({length:island.id==='city'||island.id==='main'?95:island.id==='beacon'?18:70},(_,patchIndex)=>{
    let x=island.x,z=island.z;
    for(let attempt=0;attempt<90;attempt++){const angle=random()*Math.PI*2,r=Math.sqrt(random())*islandContour(island,angle);x=island.x+Math.cos(angle)*island.rx*r;z=island.z+Math.sin(angle)*island.rz*r;
      if(island.id==='city'&&patchIndex<54){x=-25+random()*39;z=-73+random()*13;if(patchIndex<18){x=-20+random()*8;z=-73+random()*8;}}
      if(vegetationSuitability(x,z,.34,plan)>.09)break;}
    return {island,x,z,radius:.65+random()*2.7,aspect:.4+random()*.65,form:Math.floor(random()*3)};
  }));
  for(let attempt=0;attempt<65000&&sites.length<4700;attempt++){
    const patch=patches[Math.floor(random()*patches.length)],angle=random()*Math.PI*2,r=Math.pow(random(),.85)*patch.radius;
    const px=patch.x+Math.cos(angle)*r,pz=patch.z+Math.sin(angle)*r*patch.aspect,island=patch.island;
    if(islandAt(px,pz).island!==island||vegetationSuitability(px,pz,.34,plan)<.07)continue;
    if(island.id==='beacon'&&lighthouseEscarpmentSites().some(rock=>Math.hypot(px-rock.x,pz-rock.z)<rock.radius+.34))continue;
    if(BEACH_PALMS.some(palm=>Math.hypot(px-palm.x,pz-palm.z)<.35))continue;
    const ix=Math.floor(px),iz=Math.floor(pz),spacing=.12+random()*.13;
    let near=false;
    for(let x=ix-1;x<=ix+1&&!near;x++)for(let z=iz-1;z<=iz+1&&!near;z++)near=(occupied.get(`${x},${z}`)??[]).some(site=>Math.hypot(px-site.x,pz-site.z)<spacing);
    if(near)continue;
    const form=random()<.65?patch.form:Math.floor(random()*3),height=(form===1?.28:.20)+random()*(form===1?.60:.46);
    const layeredHeight=island.id==='city'&&pz>-74&&form===1?height*(.85+random()*.55):height;
    const site={x:px,y:terrainMeshHeight(px,pz)-.015,z:pz,height:layeredHeight,width:.51+random()*.28,rotation:random()*Math.PI*2,region:island.id,form,tint:random()};
    sites.push(site);const key=`${ix},${iz}`,cell=occupied.get(key)??[];cell.push(site);occupied.set(key,cell);
  }
  meadowSiteCache=sites;return sites;
}

export function IslandMeadows({runtime,paused,quality}:EnvironmentProps){
  const meadow=useMemo(()=>{
    const sites=createIslandMeadowSites(),near=[0,1,2].map(form=>meadowGeometry(false,'near',form)),far=[0,1,2].map(form=>meadowGeometry(false,'far',form)),time={value:0};
    const material=new MeshStandardMaterial({vertexColors:true,roughness:.94,side:DoubleSide});
    material.onBeforeCompile=shader=>{
      shader.uniforms.meadowTime=time;
      shader.vertexShader=`uniform float meadowTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>
        float phase=instanceMatrix[3].x*.6+instanceMatrix[3].z*.37;
        transformed.x+=sin(meadowTime*.83+phase)*position.y*position.y*.045;
      `);
    };
    material.customProgramCacheKey=()=> 'island-meadow-ribbons-v1';
    const transform=new Object3D(),color=new Color();
    const batches=ISLANDS.flatMap(island=>[0,1,2].map(form=>{
      const entries=sites.filter(site=>site.region===island.id&&site.form===form),mesh=new InstancedMesh(near[form],material,entries.length);
      mesh.name=`groundcover-${island.id}-${form}`;mesh.userData.form=form;mesh.raycast=()=>{};
      entries.forEach((site,i)=>{transform.position.set(site.x,site.y,site.z);transform.rotation.set(0,site.rotation,0);transform.scale.set(site.width,site.height,site.width);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);mesh.setColorAt(i,color.setHSL(.19+site.tint*.13,.10+site.tint*.08,.77+site.tint*.20));});
      mesh.computeBoundingSphere();if(mesh.boundingSphere)mesh.boundingSphere.radius+=.25;return mesh;
    }));
    return {batches,near,far,material,time,timer:undefined as ReturnType<typeof setTimeout>|undefined};
  },[]);
  useEffect(()=>{clearTimeout(meadow.timer);return()=>{meadow.timer=setTimeout(()=>{[...meadow.near,...meadow.far].forEach(geometry=>geometry.dispose());meadow.material.dispose();meadow.batches.forEach(mesh=>mesh.dispose());},0);};},[meadow]);
  useEffect(()=>{meadow.batches.forEach(mesh=>{mesh.geometry=quality==='high'?meadow.near[mesh.userData.form]:meadow.far[mesh.userData.form];});},[meadow,quality]);
  useFrame(({camera})=>{
    const close=quality==='high'&&camera.position.y<22;
    meadow.batches.forEach(mesh=>{mesh.geometry=close?meadow.near[mesh.userData.form]:meadow.far[mesh.userData.form];});
    if(!paused)meadow.time.value=runtime.current.elapsed;
  });
  return <group name="island-meadow-groundcover" dispose={null}>{meadow.batches.map(mesh=><primitive key={mesh.name} object={mesh}/>)}</group>;
}
