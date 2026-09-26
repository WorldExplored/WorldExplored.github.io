'use client';
import { useEffect, useMemo } from 'react';
import { BufferGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial } from 'three';
import { world, type LandmarkId } from '@/content/world';
import { combine } from './BuildingKit';
import { createFacadeGarden } from './FacadeGarden';
import { terrainMeshHeight } from './terrain';

export interface FrontVineSite {building:LandmarkId;x:number;y:number;z:number;yaw:number;width:number;height:number;seed:number}
/** Wall faces are measured from their enclosing shells; entrances and lift bays stay clear. */
export function frontVineSites():FrontVineSite[]{
  const walls:Array<[LandmarkId,number,number,number,number,number]>=[
    ['work',-3.48,2.375,0,.8,3.1],['work',3.46,2.375,0,.67,2.7],
    ['work',-4.325,-1.08,-Math.PI/2,.8,3.7],['work',4.325,.9,Math.PI/2,.72,3.1],
    ['work',-2.5,-2.375,Math.PI,.85,3.8],['work',2.9,-2.375,Math.PI,.61,2.9],
    ['research',-3.815,-2.42,-Math.PI/2,.69,3.8],['research',3.815,-2.77,Math.PI/2,.79,2.8],
    ['research',-2.65,-3.535,Math.PI,.8,4.4],['research',2.43,-3.535,Math.PI,.66,3.2],
    ['research',3.16,1.795,0,.6,2.3],
    ['experience',-4.155,-1.75,-Math.PI/2,.75,3.2],['experience',4.155,-1.6,Math.PI/2,.78,3.5],
    ['experience',-3.6,3.015,0,.66,2.8],['experience',3.6,3.015,0,.61,2.5],
    ['experience',-.6,-3.015,Math.PI,.9,3.4],
    ['about',-3.635,-.42,-Math.PI/2,.62,2.4],['about',-2.5,-3.025,Math.PI,.67,2.8],
    ['about',1.51,-3.025,Math.PI,.76,2.5],['about',2.655,-2.2,Math.PI/2,.67,2.6],
    ['contact',4.005,-1.7,Math.PI/2,.65,2.2],['contact',2.87,-2.735,Math.PI,.72,2.5],
    ['contact',3.16,.96,0,.56,2.2],
    // Younger climbers fill gaps between mature vines on the same measured walls.
    ['work',-4.325,1.52,-Math.PI/2,.42,1.7],['work',4.325,-1.46,Math.PI/2,.45,1.9],
    ['research',-3.815,-.85,-Math.PI/2,.44,1.8],
    ['experience',-2.46,3.015,0,.40,1.6],['experience',2.1,-3.015,Math.PI,.42,1.9],
    ['about',-.79,-3.025,Math.PI,.42,1.7],['contact',3.65,-2.735,Math.PI,.32,1.5],
  ];
  return walls.map(([building,x,z,yaw,width,height],i)=>{
    const landmark=world.landmarks.find(item=>item.id===building)!,rotation=landmark.rotationY??0;
    const wx=landmark.position[0]+x*Math.cos(rotation)+z*Math.sin(rotation),wz=landmark.position[2]-x*Math.sin(rotation)+z*Math.cos(rotation);
    return {building,x:wx,y:terrainMeshHeight(wx,wz)-.015,z:wz,yaw:yaw+rotation,width,height,seed:2040+i*7};
  });
}
export function createFrontGardens(){
  const root=new Group();root.name='main-building-rooted-climbers';
  const parts:Record<string,BufferGeometry[]>={planter:[],wood:[],foliage:[],light:[],fruit:[]};
  for(const site of frontVineSites()){
    const vine=createFacadeGarden(site);vine.trellis.dispose();
    for(const key of Object.keys(parts)){
      const geometry=vine[key as keyof typeof vine];geometry.rotateY(site.yaw).translate(site.x,site.y,site.z);parts[key].push(geometry);
    }
  }
  const colors:Record<string,string>={planter:'#685944',wood:'#68683f',foliage:'#ffffff',light:'#ffffff',fruit:'#ffffff'};
  for(const [name,geometryParts] of Object.entries(parts)){
    const geometry=combine(geometryParts),material=new MeshStandardMaterial({color:colors[name],vertexColors:['foliage','light','fruit'].includes(name),roughness:.9,side:DoubleSide});
    const mesh=new Mesh(geometry,material);mesh.name=`main-climbing-${name}`;mesh.raycast=()=>{};root.add(mesh);
  }
  return {root,dispose(){root.children.forEach(object=>{const mesh=object as Mesh;mesh.geometry.dispose();(mesh.material as MeshStandardMaterial).dispose();});}};
}
export function FrontGardens(){
  const scene=useMemo(()=>({...createFrontGardens(),timer:undefined as ReturnType<typeof setTimeout>|undefined}),[]);
  useEffect(()=>{clearTimeout(scene.timer);return()=>{scene.timer=setTimeout(scene.dispose,0);};},[scene]);
  return <primitive object={scene.root} dispose={null}/>;
}
