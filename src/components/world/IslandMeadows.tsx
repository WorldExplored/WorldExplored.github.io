'use client';
/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DoubleSide, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { createLandscapePlan, ISLANDS, islandAt, seededRandom, terrainMeshHeight, vegetationSuitability } from './terrain';
import { lighthouseEscarpmentSites } from './LighthouseEscarpment';
import { meadowGeometry } from './MeadowGeometry';
import type { EnvironmentProps } from './Water';

export interface MeadowSite {x:number;y:number;z:number;height:number;width:number;rotation:number;region:string}
export function createIslandMeadowSites():MeadowSite[]{
  const random=seededRandom(740322),plan=createLandscapePlan(),sites:MeadowSite[]=[];
  for(const island of ISLANDS)for(let x=island.x-island.rx*1.2;x<island.x+island.rx*1.2;x+=.43)for(let z=island.z-island.rz*1.2;z<island.z+island.rz*1.2;z+=.43){
    const px=x+(random()-.5)*.34,pz=z+(random()-.5)*.34;
    if(islandAt(px,pz).island!==island||vegetationSuitability(px,pz,.29,plan)<.07)continue;
    if(island.id==='beacon'&&lighthouseEscarpmentSites().some(rock=>Math.hypot(px-rock.x,pz-rock.z)<rock.radius+.3))continue;
    // Low grass joins existing ferns and flowers into visible, irregular ground cover.
    const patch=.5+.27*Math.sin(px*.37+pz*.19)+.19*Math.sin(pz*.77-px*.4);
    if(random()>patch*.7+.28)continue;
    sites.push({x:px,y:terrainMeshHeight(px,pz)-.015,z:pz,height:.25+random()*.31,width:.63+random()*.15,rotation:random()*Math.PI*2,region:island.id});
  }
  return sites;
}

export function IslandMeadows({runtime,paused,quality}:EnvironmentProps){
  const meadow=useMemo(()=>{
    const sites=createIslandMeadowSites(),near=meadowGeometry(),far=meadowGeometry(false,'far'),time={value:0};
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
    const batches=ISLANDS.map(island=>{
      const entries=sites.filter(site=>site.region===island.id),mesh=new InstancedMesh(near,material,entries.length);
      mesh.name=`groundcover-${island.id}`;mesh.raycast=()=>{};
      entries.forEach((site,i)=>{transform.position.set(site.x,site.y,site.z);transform.rotation.set(0,site.rotation,0);transform.scale.set(site.width,site.height,site.width);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);mesh.setColorAt(i,color.setHSL(.23+(i%7)*.009,.12,.83+(i%5)*.025));});
      mesh.computeBoundingSphere();if(mesh.boundingSphere)mesh.boundingSphere.radius+=.25;return mesh;
    });
    return {batches,near,far,material,time,timer:undefined as ReturnType<typeof setTimeout>|undefined};
  },[]);
  useEffect(()=>{clearTimeout(meadow.timer);return()=>{meadow.timer=setTimeout(()=>{meadow.near.dispose();meadow.far.dispose();meadow.material.dispose();meadow.batches.forEach(mesh=>mesh.dispose());},0);};},[meadow]);
  useEffect(()=>{meadow.batches.forEach(mesh=>{mesh.geometry=quality==='high'?meadow.near:meadow.far;});},[meadow,quality]);
  useFrame(()=>{if(!paused)meadow.time.value=runtime.current.elapsed;});
  return <group name="island-meadow-groundcover" dispose={null}>{meadow.batches.map(mesh=><primitive key={mesh.name} object={mesh}/>)}</group>;
}
