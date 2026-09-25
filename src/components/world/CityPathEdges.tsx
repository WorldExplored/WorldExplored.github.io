'use client';

import { useEffect, useMemo } from 'react';
import { Color, Group, IcosahedronGeometry, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { circulationPaths } from './circulation';
import { cityBuildings } from './city';
import { distanceToSegment, groundRouteAt, landDistance, seededRandom, terrainMeshHeight } from './terrain';
import { world } from '../../content/world';
import { BRIDGES } from './bridgePlan';
import { applySurface } from './surfaceMaterials';

export function cityEdgeClear(x: number, z: number) {
  const museum = world.landmarks.find(item => item.id === 'history')!;
  const arcade = world.landmarks.find(item => item.id === 'arcade')!;
  const buildings = [...cityBuildings, { x: arcade.position[0], z: arcade.position[2], rotation: 0, width: 5.4, depth: 4.4 }, { x: museum.position[0], z: museum.position[2], rotation: museum.rotationY ?? 0, width: 11.6, depth: 8.1 }];
  return landDistance(x, z) > 1.5 && buildings.every(building => {
    const dx = x - building.x, dz = z - building.z, c = Math.cos(building.rotation), s = Math.sin(building.rotation);
    return Math.abs(dx * c - dz * s) > building.width / 2 + .3 || Math.abs(dx * s + dz * c) > building.depth / 2 + .3;
  });
}

/** Pebbles follow the outside of the paved union, leaving every junction and doorway open. */
export function createCityPathEdging() {
  const random = seededRandom(91312), occupied = new Map<string, Array<[number, number]>>();
  const sites: Array<{ x: number; y: number; z: number; yaw: number; size: number; tint: number }> = [];
  for (const path of circulationPaths().filter(path => !path.bridge && path.points[0].z < -60 && path.points[0].x > -40)) {
    let carry = 0;
    for (let index = 1; index < path.points.length; index++) {
      const a = path.points[index - 1], b = path.points[index], dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
      if (length < .00001) continue;
      for (let distance = carry; distance < length; distance += .23) for (const side of [-1, 1]) {
        const offset = side * (path.width / 2 + .12 + (random() - .5) * .035);
        const x = a.x + dx * distance / length + dz / length * offset;
        const z = a.z + dz * distance / length - dx / length * offset;
        const edge = groundRouteAt(x, z).distance;
        if (edge < .055 || edge > .20 || !cityEdgeClear(x, z)) continue;
        const cellX = Math.floor(x / .2), cellZ = Math.floor(z / .2);
        let duplicate = false;
        for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
          if (occupied.get(`${cellX + ix},${cellZ + iz}`)?.some(([px, pz]) => Math.hypot(x - px, z - pz) < .18)) duplicate = true;
        }
        if (duplicate) continue;
        const y = terrainMeshHeight(x, z);
        if (y < .42) continue;
        const yaw=Math.atan2(dx,dz)+(random()-.5)*.6,size=.085+random()*.025;
        // Check the rotated stone perimeter against the complete paving union.
        if(Array.from({length:16},(_,i)=>i/16*Math.PI*2).some(angle=>{
          const lx=Math.cos(angle)*size*.72,lz=Math.sin(angle)*size;
          return groundRouteAt(x+lx*Math.cos(yaw)+lz*Math.sin(yaw),z-lx*Math.sin(yaw)+lz*Math.cos(yaw)).distance<=.012;
        }))continue;
        const key = `${cellX},${cellZ}`, cell = occupied.get(key) ?? [];
        cell.push([x, z]); occupied.set(key, cell);
        sites.push({ x, y, z, yaw, size, tint: random() });
      }
      carry = (carry - length) % .23;
      if (carry < 0) carry += .23;
    }
  }
  return sites;
}

export function createMainPathEdging(garden = false) {
  const random=seededRandom(51073),sites:ReturnType<typeof createCityPathEdging>=[],occupied:Array<[number,number]>=[];
  const bounds={work:[-4.4,4.4,-2.5,2.65],experience:[-4.35,4.35,-3.2,3.98],research:[-3.9,3.9,-3.65,2.4]} as const;
  const paths=circulationPaths().filter(path=>!path.bridge && (garden
    ? path.points[0].z>=18&&path.points[0].z<28&&path.points[0].x<18
    : path.points[0].x>-45&&path.points[0].x<18&&path.points[0].z>-25&&path.points[0].z<12));
  const portals=paths.flatMap(path=>[path.startY===undefined?undefined:path.points[0],path.endY===undefined?undefined:path.points.at(-1)].filter(point=>point!==undefined));
  const clear=(x:number,z:number)=>{
    if(landDistance(x,z)<1.5||portals.some(point=>Math.hypot(x-point.x,z-point.z)<.8))return false;
    if(garden) {
      const gx=x+10,gz=z-23;
      if((gx>-3.7&&gx<2.8&&gz>-3.15&&gz<-1.05)||(gx>-3.75&&gx<-1.1&&gz>-1.65&&gz<1.8))return false;
      if(Math.hypot(gx,gz)<1.18||(gx>1.35&&gx<2.6&&gz>-.8&&gz<2.1))return false;
      if(Math.hypot(x-12,z-23)<1.85||(x>13.3&&x<16.3&&z>20.1&&z<24.65))return false;
    }
    for(const [id,b]of Object.entries(bounds)) {
      const item=world.landmarks.find(value=>value.id===id)!,a=item.rotationY??0,dx=x-item.position[0],dz=z-item.position[2],lx=dx*Math.cos(a)-dz*Math.sin(a),lz=dx*Math.sin(a)+dz*Math.cos(a);
      if(lx>b[0]-.15&&lx<b[1]+.15&&lz>b[2]-.15&&lz<b[3]+.15)return false;
    }
    return BRIDGES.every(bridge=>bridge.samples.slice(1).every((sample,i)=>distanceToSegment(x,z,bridge.samples[i].point,sample.point)>bridge.width/2+.22));
  };
  for(const path of paths) {
    let carry=0;
    for(let index=1;index<path.points.length;index++) {
      const a=path.points[index-1],b=path.points[index],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(length<.0001)continue;
      for(let distance=carry;distance<length;distance+=.34)for(const side of [-1,1]) {
        const offset=side*(path.width/2+.19+(random()-.5)*.035),x=a.x+dx*distance/length+dz/length*offset,z=a.z+dz*distance/length-dx/length*offset;
        const edge=groundRouteAt(x,z).distance;
        if(edge<.145||edge>.23||!clear(x,z)||occupied.some(([px,pz])=>Math.hypot(px-x,pz-z)<.27))continue;
        occupied.push([x,z]);sites.push({x,z,y:terrainMeshHeight(x,z),yaw:Math.atan2(dx,dz)+(random()-.5)*.9,size:.12+random()*.035,tint:random()});
      }
      carry=(carry-length)% .34;if(carry<0)carry+=.34;
    }
  }
  return sites;
}

function createPathEdges(sites:ReturnType<typeof createCityPathEdging>,name:string) {
  const root=new Group(),transform=new Object3D();root.name=name;
  const geometry=new IcosahedronGeometry(1,1);
  const material=applySurface(new MeshStandardMaterial({roughness:.95,color:'#c5c7b4'}),'mineral');
  const mesh=new InstancedMesh(geometry,material,sites.length);mesh.name=name;mesh.raycast=()=>{};mesh.receiveShadow=true;
  sites.forEach((site,index)=>{
    transform.position.set(site.x,site.y+.027,site.z);transform.rotation.set(.12,site.yaw,-.05);
    transform.scale.set(site.size*.72,.04,site.size);transform.updateMatrix();mesh.setMatrixAt(index,transform.matrix);
    mesh.setColorAt(index,new Color().setHSL(.11+site.tint*.03,.08,.67+site.tint*.2));
  });
  mesh.computeBoundingSphere();root.add(mesh);
  let timer:ReturnType<typeof setTimeout>|undefined;
  const dispose=()=>{geometry.dispose();material.dispose();mesh.dispose();};
  return {root,sites,retain(){clearTimeout(timer);return()=>{timer=setTimeout(dispose,0);};},dispose};
}
export function createCityPathEdges(){return createPathEdges(createCityPathEdging(),'city-pebble-path-edges');}
export function createMainPathEdges(){return createPathEdges(createMainPathEdging(),'main-pebble-path-edges');}
export function createGardenPathEdges(){return createPathEdges(createMainPathEdging(true),'garden-pebble-path-edges');}

export function CityPathEdges() {
  const edges=useMemo(()=>createCityPathEdges(),[]),mainEdges=useMemo(()=>createMainPathEdges(),[]),gardenEdges=useMemo(()=>createGardenPathEdges(),[]);
  useEffect(()=>edges.retain(),[edges]);useEffect(()=>mainEdges.retain(),[mainEdges]);useEffect(()=>gardenEdges.retain(),[gardenEdges]);
  return <group><primitive object={edges.root} dispose={null}/><primitive object={mainEdges.root} dispose={null}/><primitive object={gardenEdges.root} dispose={null}/></group>;
}
