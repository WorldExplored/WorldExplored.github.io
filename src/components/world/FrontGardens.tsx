'use client';
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial } from 'three';
import { world, type LandmarkId } from '@/content/world';
import { combine } from './BuildingKit';
import { createFacadeGarden } from './FacadeGarden';
import { terrainMeshHeight, terrainHeight } from './terrain';
import { cityTurbines } from './cityInfrastructure';
import { lighthouseRadius } from './CoastalLighthouse';

export interface FrontVineSite {building:LandmarkId|'turbine-west'|'turbine-east';x:number;y:number;z:number;yaw:number;width:number;height:number;seed:number;support?:{kind:'lighthouse'|'turbine';x:number;z:number;floor:number;height:number}}
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
    ['purdue',-3.475,-2.27,-Math.PI/2,.62,2.8],['purdue',3.475,-1.36,Math.PI/2,.73,2.5],['purdue',1.72,-3.435,Math.PI,.86,2.9],
    ['history',-5.435,-.75,-Math.PI/2,1.16,4.2],['history',5.435,-1.05,Math.PI/2,.94,4.5],
    ['history',-3.76,-3.685,Math.PI,1.3,4.35],['history',.85,-3.685,Math.PI,1.1,3.8],['history',3.7,3.67,0,.68,2.9],
    ['work',-.8,-2.375,Math.PI,1.18,3.7],['experience',2.08,-3.015,Math.PI,1.2,3.3],
    ['about',-.13,-3.025,Math.PI,.70,2.35],['contact',1.85,-2.735,Math.PI,.70,2.7],
  ];
  const sites:FrontVineSite[]=walls.map(([building,x,z,yaw,width,height],i)=>{
    const landmark=world.landmarks.find(item=>item.id===building)!,rotation=landmark.rotationY??0;
    const wx=landmark.position[0]+x*Math.cos(rotation)+z*Math.sin(rotation),wz=landmark.position[2]-x*Math.sin(rotation)+z*Math.cos(rotation);
    return {building,x:wx,y:terrainMeshHeight(wx,wz)-.015,z:wz,yaw:yaw+rotation,width,height,seed:2040+i*7};
  });
  const beacon=world.landmarks.find(item=>item.id==='building')!;
  for(const [index,angle] of [-1.12,1.38,2.35].entries()){
    const x=beacon.position[0]+Math.sin(angle)*1.395,z=beacon.position[2]+Math.cos(angle)*1.395;
    sites.push({building:'building',x,y:terrainMeshHeight(x,z)-.015,z,yaw:angle,width:.58+index*.12,height:3.8+index*.42,seed:3414+index*7,support:{kind:'lighthouse',x:beacon.position[0],z:beacon.position[2],floor:beacon.position[1],height:11.24}});
  }
  for(const [index,turbine] of cityTurbines.entries()){
    const angle=index?1.28:-1.45,x=turbine.x+Math.sin(angle)*.66,z=turbine.z+Math.cos(angle)*.66;
    sites.push({building:index?'turbine-east':'turbine-west',x,y:terrainMeshHeight(x,z)-.015,z,yaw:angle,width:.44,height:2.85+index*.44,seed:4021+index*3,support:{kind:'turbine',x:turbine.x,z:turbine.z,floor:terrainHeight(turbine.x,turbine.z),height:turbine.height}});
  }
  return sites;
}
/** Conform every stem, leaf and fruit to the actual tapered supporting surface. */
export function placeFrontVineGeometry(geometry:BufferGeometry,site:FrontVineSite){
  const support=site.support;
  if(!support){geometry.rotateY(site.yaw).translate(site.x,site.y,site.z);return geometry;}
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const y=positions.getY(i),worldY=site.y+y,localY=worldY-support.floor;
    const footing=support.kind==='lighthouse'?1.16*1.18:.61;
    const shaft=support.kind==='lighthouse'?lighthouseRadius(Math.max(1.02,localY)):.27-.14*Math.max(0,localY)/support.height;
    const transition=support.kind==='lighthouse'?Math.max(0,Math.min(1,(localY-.99)/.21)):Math.max(0,Math.min(1,(localY-.16)/.15));
    const radius=footing+(shaft-footing)*transition;
    const winding=support.kind==='turbine'?y*.58:Math.sin(y*.8)*.18;
    const angle=site.yaw+positions.getX(i)/Math.max(.20,radius)+winding,offset=Math.max(.008,positions.getZ(i));
    positions.setXYZ(i,support.x+Math.sin(angle)*(radius+offset),worldY,support.z+Math.cos(angle)*(radius+offset));
  }
  geometry.computeVertexNormals();return geometry;
}
export function createFrontGardens(){
  const root=new Group();root.name='main-building-rooted-climbers';
  const sites=frontVineSites(),colors:Record<string,string>={planter:'#685944',wood:'#68683f',foliage:'#ffffff',light:'#ffffff',fruit:'#ffffff'};
  const build=(detail:'near'|'far')=>{
    const parts:Record<string,BufferGeometry[]>={planter:[],wood:[],foliage:[],light:[],fruit:[]};
    for(const site of sites){
      const vine=createFacadeGarden({...site,detail});vine.trellis.dispose();
      for(const key of Object.keys(parts))parts[key].push(placeFrontVineGeometry(vine[key as keyof typeof vine],site));
    }
    return Object.fromEntries(Object.entries(parts).map(([name,parts])=>[name,combine(parts)]));
  };
  const near=build('near'),far=build('far');
  for(const [name,geometry] of Object.entries(near)){
    const material=new MeshStandardMaterial({color:colors[name],vertexColors:['foliage','light','fruit'].includes(name),roughness:.9,side:DoubleSide});
    const mesh=new Mesh(geometry,material);mesh.name=`main-climbing-${name}`;mesh.raycast=()=>{};mesh.receiveShadow=true;root.add(mesh);
  }
  let detailed=true;
  return {root,setDetail(close:boolean){if(close===detailed)return;detailed=close;for(const object of root.children){const mesh=object as Mesh,key=mesh.name.replace('main-climbing-','');mesh.geometry=(close?near:far)[key];}},dispose(){Object.values(near).forEach(geometry=>geometry.dispose());Object.values(far).forEach(geometry=>geometry.dispose());root.children.forEach(object=>((object as Mesh).material as MeshStandardMaterial).dispose());}};
}
export function FrontGardens(){
  const scene=useMemo(()=>({...createFrontGardens(),timer:undefined as ReturnType<typeof setTimeout>|undefined}),[]);
  useEffect(()=>{clearTimeout(scene.timer);return()=>{scene.timer=setTimeout(scene.dispose,0);};},[scene]);
  useFrame(({camera})=>scene.setDetail(camera.position.y<18));
  return <primitive object={scene.root} dispose={null}/>;
}
