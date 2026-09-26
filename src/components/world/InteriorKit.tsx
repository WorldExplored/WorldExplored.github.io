'use client';

import { useEffect, useState } from 'react';
import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Shape, MeshStandardMaterial, MeshPhysicalMaterial, SphereGeometry, Vector3 } from 'three';
import { combine, strut, useResources } from './BuildingKit';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { applySurface } from './surfaceMaterials';
import { applyBakedRoomLighting } from './RoomLighting';

export type InteriorFinish = 'wood' | 'fabric' | 'metal' | 'paper' | 'screen' | 'light' | 'leaf' | 'soil' | 'coolant' | 'pipe';
export type InteriorGeometry = Record<InteriorFinish, BufferGeometry>;
const finishes: InteriorFinish[] = ['wood', 'fabric', 'metal', 'paper', 'screen', 'light', 'leaf', 'soil', 'coolant', 'pipe'];
const timers = new WeakMap<object, ReturnType<typeof setTimeout>>();

export type FloorPoint = readonly [number, number];
export type FloorPolygon = readonly FloorPoint[];
export function floorRectangle(x: number, z: number, width: number, depth: number): FloorPoint[] {
  return [[x-width/2,z-depth/2],[x+width/2,z-depth/2],[x+width/2,z+depth/2],[x-width/2,z+depth/2]];
}
export function floorEllipse(x: number, z: number, rx: number, rz = rx, segments = 64): FloorPoint[] {
  return Array.from({length:segments},(_,i)=>[x+Math.cos(i/segments*Math.PI*2)*rx,z+Math.sin(i/segments*Math.PI*2)*rz]);
}
function inPolygon(x: number,z: number,polygon: FloorPolygon) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
/** Trace the union boundary before extrusion, removing overlapping coplanar slabs. */
export function floorUnion(polygons: readonly FloorPolygon[]): Shape[] {
  const edges=polygons.flatMap(p=>p.map((a,i)=>({a,b:p[(i+1)%p.length]})));
  const boundary=new Map<string,{a:FloorPoint;b:FloorPoint}>();
  const key=(p:FloorPoint)=>`${Math.round(p[0]*1e7)},${Math.round(p[1]*1e7)}`;
  const inside=(x:number,z:number)=>polygons.some(p=>inPolygon(x,z,p));
  for(const edge of edges) {
    const [ax,az]=edge.a,dx=edge.b[0]-ax,dz=edge.b[1]-az,length=Math.hypot(dx,dz),cuts=[0,1];
    for(const other of edges) {
      const ox=other.b[0]-other.a[0],oz=other.b[1]-other.a[1],det=dx*oz-dz*ox;
      const rx=other.a[0]-ax,rz=other.a[1]-az;
      if(Math.abs(det)>1e-10) {
        const t=(rx*oz-rz*ox)/det,u=(rx*dz-rz*dx)/det;
        if(t>1e-8&&t<1-1e-8&&u>=-1e-8&&u<=1+1e-8)cuts.push(t);
      } else if(Math.abs(rx*dz-rz*dx)<1e-8) {
        for(const p of [other.a,other.b]) {const t=((p[0]-ax)*dx+(p[1]-az)*dz)/(length*length);if(t>1e-8&&t<1-1e-8)cuts.push(t);}
      }
    }
    cuts.sort((a,b)=>a-b);
    for(let i=1;i<cuts.length;i++) {
      if(cuts[i]-cuts[i-1]<1e-8)continue;
      const t=(cuts[i]+cuts[i-1])/2,x=ax+dx*t,z=az+dz*t,e=.00001;
      const left=inside(x-dz/length*e,z+dx/length*e),right=inside(x+dz/length*e,z-dx/length*e);
      if(left===right)continue;
      let a:FloorPoint=[ax+dx*cuts[i-1],az+dz*cuts[i-1]],b:FloorPoint=[ax+dx*cuts[i],az+dz*cuts[i]];
      if(!left)[a,b]=[b,a];boundary.set(`${key(a)}:${key(b)}`,{a,b});
    }
  }
  const loops:FloorPoint[][]=[];
  while(boundary.size) {
    const [firstKey,first]=boundary.entries().next().value!;boundary.delete(firstKey);
    const loop:FloorPoint[]=[first.a,first.b];let next=first.b;
    while(key(next)!==key(first.a)) {
      const candidate=[...boundary.entries()].find(([,edge])=>key(edge.a)===key(next));
      if(!candidate)throw new Error('Floor union boundary is not closed');
      boundary.delete(candidate[0]);next=candidate[1].b;loop.push(next);
    }
    loops.push(loop.slice(0,-1));
  }
  const shapes:Shape[]=[],holes:FloorPoint[][]=[];
  for(const loop of loops) {
    const area=loop.reduce((sum,p,i)=>{const q=loop[(i+1)%loop.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
    if(area<0){holes.push(loop);continue;}
    const shape=new Shape();shape.moveTo(loop[0][0],-loop[0][1]);loop.slice(1).forEach(p=>shape.lineTo(p[0],-p[1]));shape.closePath();shapes.push(shape);
  }
  for(const loop of holes) {
    const owner=shapes.find(shape=>inPolygon(loop[0][0],loop[0][1],shape.getPoints().map(p=>[p.x,-p.y])));
    if(!owner)throw new Error('Floor courtyard has no enclosing foundation');
    const hole=new Shape();hole.moveTo(loop[0][0],-loop[0][1]);loop.slice(1).forEach(p=>hole.lineTo(p[0],-p[1]));hole.closePath();owner.holes.push(hole);
  }
  return shapes;
}
export function floorSlab(name: string, polygons: readonly FloorPolygon[], top: number, depth: number, kind: 'floor'|'foundation'|'threshold'|'balcony' = 'floor') {
  const geometry=new ExtrudeGeometry(floorUnion(polygons),{depth,bevelEnabled:false,curveSegments:1}).rotateX(-Math.PI/2).translate(0,top-depth,0);
  geometry.name=name;geometry.userData.floor={name,kind};return geometry;
}

/** Furniture is built in small assemblies, then merged into one draw per finish. */
export class InteriorBuilder {
  parts = Object.fromEntries(finishes.map(key => [key, [] as BufferGeometry[]])) as Record<InteriorFinish, BufferGeometry[]>;
  add(finish: InteriorFinish, geometry: BufferGeometry) { this.parts[finish].push(geometry); }
  floor(name: string, polygons: readonly FloorPolygon[], top: number, thickness = .018) { this.add('wood', floorSlab(name,polygons,top,thickness)); }
  box(finish: InteriorFinish, w: number, h: number, d: number, x: number, y: number, z: number, yaw = 0) {
    // Chamfer furniture that has a visible silhouette; thin boards and book spines
    // retain flat faces instead of spending hundreds of triangles on millimetre edges.
    const rounded=(finish==='fabric'&&w>=.25)||(finish==='wood'&&w>=.3&&d>=.3);
    const geometry=rounded ? new RoundedBoxGeometry(w,h,d,1,Math.min(.035,w*.12,h*.12,d*.12)) : new BoxGeometry(w,h,d);
    this.add(finish,geometry.rotateY(yaw).translate(x,y,z));
  }
  rod(finish: InteriorFinish, a: number[], b: number[], radius = .025) { this.add(finish, strut(new Vector3(...a), new Vector3(...b), radius)); }
  table(x: number, floor: number, z: number, width = .85, depth = .43, height = .64) {
    this.box('wood', width, .055, depth, x, floor + height, z);
    for (const dx of [-width * .4, width * .4]) for (const dz of [-depth * .35, depth * .35]) this.box('metal', .035, height - .025, .035, x + dx, floor + (height - .025) / 2, z + dz);
  }
  chair(x: number, floor: number, z: number, yaw = 0, scale = 1) {
    const put = (finish: InteriorFinish, w: number, h: number, d: number, dx: number, y: number, dz: number) => this.box(finish, w * scale, h * scale, d * scale, x + (dx * Math.cos(yaw) + dz * Math.sin(yaw)) * scale, floor + y * scale, z + (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) * scale, yaw);
    put('fabric', .34, .075, .35, 0, .36, 0); put('fabric', .34, .33, .065, 0, .56, -.145);
    for(const dx of [-.12,.12])for(const dz of [-.12,.12])put('metal',.025,.32,.025,dx,.16,dz);
    for(const side of [-1,1]) {put('wood',.04,.035,.28,side*.18,.49,-.02);put('metal',.022,.16,.022,side*.18,.41,-.1);}
  }
  monitor(x: number, desktop: number, z: number, yaw = 0) {
    this.box('metal', .18, .025, .14, x, desktop + .016, z, yaw);
    this.box('metal', .025, .12, .025, x, desktop + .08, z);
    this.box('metal', .36, .24, .045, x, desktop + .245, z, yaw);
    this.box('screen', .315, .193, .012, x + Math.sin(yaw) * .029, desktop + .245, z + Math.cos(yaw) * .029, yaw);
    this.box('paper', .21, .018, .085, x + Math.sin(yaw) * .13, desktop + .032, z + Math.cos(yaw) * .13, yaw);
  }
  shelf(x: number, floor: number, z: number, width = .8, height = 1, depth = .22) {
    for (const dx of [-width / 2, width / 2]) this.box('wood', .04, height, depth, x + dx, floor + height / 2, z);
    this.box('wood', width, .035, depth, x, floor + height, z);
    for (let row = 0; row < 3; row++) {
      const y = floor + .07 + row * (height - .32) / 2;
      this.box('wood', width, .035, depth, x, y, z);
      for (let n = 0; n < 5; n++) { const bookHeight = .17 + n % 3 * .025; this.box(n % 3 === 0 ? 'fabric' : 'paper', .055 + n % 2 * .02, bookHeight, depth * .7, x - width * .35 + n * width * .145, y + .0175 + bookHeight / 2, z); }
    }
  }
  plant(x: number, floor: number, z: number, scale = 1) {
    this.add('paper', new CylinderGeometry(.13 * scale, .09 * scale, .22 * scale, 12).translate(x, floor + .11 * scale, z));
    this.add('soil', new CylinderGeometry(.118 * scale, .118 * scale, .018 * scale, 12).translate(x, floor + .225 * scale, z));
    this.rod('leaf', [x, floor + .22 * scale, z], [x, floor + .62 * scale, z], .018 * scale);
    for (let n = 0; n < 5; n++) { const a = n * 2.4; this.add('leaf', new SphereGeometry(.1, 7, 5).scale(1.6 * scale, .42 * scale, .65 * scale).rotateZ(.45).rotateY(a).translate(x + Math.cos(a) * .08 * scale, floor + (.35 + n * .055) * scale, z + Math.sin(a) * .08 * scale)); }
  }
  lamp(x: number, ceiling: number, z: number, width = .55) {
    this.box('metal', width + .055, .045, .13, x, ceiling - .035, z);
    this.box('light', width, .018, .1, x, ceiling - .064, z);
  }
  finish(): InteriorGeometry {
    return Object.fromEntries(finishes.map(key => {
      let offset=0;const floors: Array<{start:number;count:number;name:string;kind:string}>=[];
      for(const part of this.parts[key]) {const count=part.index?.count??part.getAttribute('position').count;if(part.userData.floor)floors.push({start:offset,count,...part.userData.floor});offset+=count;}
      const geometry=this.parts[key].length?combine(this.parts[key]):new BufferGeometry();geometry.userData.floors=floors;return [key,geometry];
    })) as InteriorGeometry;
  }
}

export function FurnishedInterior({ build, name }: { build: () => InteriorGeometry; name: string }) {
  const geometry = useResources(build);
  const [materials] = useState(() => {const result={
    wood: applySurface(new MeshStandardMaterial({color:'#d1e5dd',roughness:.69}),'mineral',1.3),
    fabric: new MeshStandardMaterial({ color: '#1262c4', roughness: .98 }),
    metal: new MeshStandardMaterial({ color: '#244f64', roughness: .46, metalness: .65 }),
    paper: new MeshStandardMaterial({ color: '#edf6ef', roughness: .92 }),
    screen: new MeshStandardMaterial({ color: '#143a49', roughness: .38, emissive: '#3c8791', emissiveIntensity: .22 }),
    light: new MeshStandardMaterial({ color: '#e4f4ee', roughness: .5, emissive: '#ccebe2', emissiveIntensity: .32 }),
    leaf: new MeshStandardMaterial({ color: '#287843', roughness: .85 }),
    soil: new MeshStandardMaterial({ color: '#433b2d', roughness: 1 }),
    coolant: new MeshStandardMaterial({ color: '#06abc1', roughness: .23, metalness: .05 }),
    pipe: new MeshPhysicalMaterial({ color: '#d4f9f4', roughness: .08, transparent: true, opacity: .2, depthWrite: false }),
  };
    Object.entries(result).forEach(([finish,material])=>{if(finish!=='pipe')applyBakedRoomLighting(material);});return result;
  });
  useEffect(() => { clearTimeout(timers.get(materials)); return () => { timers.set(materials, setTimeout(() => Object.values(materials).forEach(material => material.dispose()), 0)); }; }, [materials]);
  return <group name={name} dispose={null}>{finishes.filter(key => geometry[key].getAttribute('position')?.count > 0).map(key => <mesh key={key} name={`${name}-${key}`} geometry={geometry[key]} material={materials[key]} receiveShadow raycast={() => {}} />)}</group>;
}
