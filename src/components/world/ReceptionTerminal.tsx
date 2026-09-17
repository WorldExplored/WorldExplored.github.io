'use client';

import { ExtrudeGeometry, LatheGeometry, Shape, Vector2, Vector3, type BufferGeometry } from 'three';
import { architecturalBox as box, windowBay, type ShellParts } from './LandmarkShellKit';
import { FurnishedInterior, InteriorBuilder, floorSlab, floorRectangle, floorEllipse } from './InteriorKit';
import { combine, platform, strut, usePalette, useResources, type ModelProps } from './BuildingKit';

export function makeReceptionInterior() {
  const room = new InteriorBuilder();
  room.floor('contact-lobby-and-service-wood-floor',[floorEllipse(0,0,1.51),floorRectangle(2.58,-.91,2.38,3.09),floorRectangle(1.285,-.04,.21,1.35)],1.086,.014);
  // A shallow curved desk faces the entry without occupying the arrival aisle.
  const counter = new Shape();
  counter.absarc(0, -.84, .66, .14, Math.PI - .14, false);
  counter.absarc(0, -.84, .4, Math.PI - .14, .14, true); counter.closePath();
  room.add('wood', platform(counter, 1.76, .67));
  const top = new Shape(); top.absarc(0, -.84, .7, .1, Math.PI - .1, false); top.absarc(0, -.84, .36, Math.PI - .1, .1, true); top.closePath();
  room.add('paper', platform(top, 1.8, .045));
  room.monitor(.34, 1.835, -.52, Math.PI); room.chair(0, 1.087, -.95, 0, .78);
  for (const z of [-.38, .25]) room.chair(-1.13, 1.087, z, Math.PI / 2, .85);
  room.table(-.73, 1.087, .15, .26, .37, .38);
  room.box('paper', .17, .025, .2, -.73, 1.5, .15);
  room.plant(-.81, 1.087, .91, .75); room.plant(.89, 1.087, .9, .75);
  // Service desk, cabinet and a cable riser physically connect to the roof mast.
  room.table(1.93, 1.087, -.58, .46, .8, .63); room.monitor(1.93, 1.762, -.58, -Math.PI / 2);
  room.chair(1.37, 1.087, -.62, Math.PI / 2, .75);
  room.shelf(1.91, 1.087, .54, .48, 1.14, .18);
  room.rod('metal', [1.94, 1.2, -.97], [1.94, 2.93, -.97], .036);
  room.rod('metal', [1.94, 2.93, -.97], [0, 2.93, -.97], .036);
  room.rod('metal', [0, 2.93, -.97], [0, 2.93, 0], .036);
  room.rod('metal', [0, 2.93, 0], [0, 3.13, 0], .036);
  for(const z of [-1.9,-.5]) { room.table(3.35,1.087,z,.57,.9,.72); room.monitor(3.35,1.86,z,-Math.PI/2); room.chair(2.7,1.087,z,Math.PI/2); }
  room.shelf(2.4,1.087,-2.32,1.18,1.6,.25);
  room.lamp(2.85,3.32,-1.2,1.3);
  room.lamp(-.56, 3.11, .29, .56); room.lamp(.54, 3.11, -.65, .46); room.lamp(1.9, 2.97, -.25, .44);
  return room.finish();
}

export function makeReceptionTerminal() {
  const arc=(outer:number,inner:number,top:number,height:number)=>combine([[Math.PI/2+.30,Math.PI*2-.32],[.32,Math.PI/2-.30]].map(([start,end])=>{
    const shape=new Shape();shape.absarc(0,0,outer,start,end,false);shape.absarc(0,0,inner,end,start,true);shape.closePath();return new ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:24}).rotateX(Math.PI/2).translate(0,top,0);
  }));
  const frames:BufferGeometry[]=[];
  for(const [start,end] of [[Math.PI/2+.32,Math.PI*2-.34],[.34,Math.PI/2-.32]]) {
    const count=Math.ceil((end-start)*3.8);
    for(let i=0;i<=count;i++) {const angle=start+i*(end-start)/count;frames.push(strut(new Vector3(Math.cos(angle)*1.67,1.56,Math.sin(angle)*1.67),new Vector3(Math.cos(angle)*1.67,3.16,Math.sin(angle)*1.67),.036));}
  }
  const service:ShellParts={walls:[],glass:[],frames:[]};
  for(const z of [-1.74,-.03]) windowBay(service,3.87,z,1.71,1.069,3.38,Math.PI/2,.54);
  windowBay(service,2.58,-2.6,2.58,1.069,3.38,0,.65);
  windowBay(service,2.6,.825,2.55,1.069,3.38,0,.38);
  // A service wall meets the curved lobby only behind the real connecting doorway.
  service.walls.push(box(.18,2.31,1.78,1.29,2.224,-1.71));
  const louvers:BufferGeometry[]=[];
  for(let i=0;i<10;i++)louvers.push(box(1.4,.035,.16,2.6,1.62+i*.13,-2.75));
  // Spun roof sections meet a perimeter bearing ring, with a high point over the communications riser.
  const profile=[[0,3.5],[.35,3.5],[.85,3.46],[1.4,3.36],[1.99,3.2],[1.99,3.05],[1.4,3.21],[.85,3.31],[.35,3.35],[0,3.35]].map(([r,y])=>new Vector2(r,y));
  const roof=new LatheGeometry(profile,64);
  return {
    foundation:floorSlab('contact-foundation',[floorEllipse(0,0,1.71),floorRectangle(2.55,-.9,2.83,3.58)],.99,.19,'foundation'),
    floor:floorSlab('contact-room-floors',[floorEllipse(0,0,1.535),floorRectangle(2.58,-.91,2.38,3.09),floorRectangle(1.285,-.04,.21,1.35)],1.069,.079),
    lobbyWalls:arc(1.7,1.55,1.57,.57),glazing:arc(1.66,1.60,3.13,1.56),frames:combine(frames),roof,
    fascia:arc(1.86,1.81,3.18,.08),serviceWing:combine(service.walls),serviceWindows:combine(service.glass),serviceFrames:combine(service.frames),louvers:combine(louvers),
    serviceRoof:combine([box(2.86,.19,3.79,2.6,3.47,-.89),box(.16,.24,3.81,3.99,3.64,-.89),box(2.84,.24,.15,2.6,3.64,-2.72)]),
    doors:combine([box(.425,1.62,.07,-.225,1.88,1.63),box(.425,1.62,.07,.225,1.88,1.63)]),
    entrance:combine([box(.055,1.7,.1,-.47,1.88,1.65),box(.055,1.7,.1,.47,1.88,1.65),box(.99,.07,.11,0,2.765,1.65),box(.035,1.62,.09,0,1.88,1.665),box(.022,.22,.03,-.07,1.86,1.71),box(.022,.22,.03,.07,1.86,1.71)]),
    canopy:combine([box(1.38,.11,.84,0,2.93,1.92),box(.06,1.82,.06,-.62,1.98,2.27),box(.06,1.82,.06,.62,1.98,2.27),box(.18,.32,.18,-.62,.92,2.27),box(.18,.32,.18,.62,.92,2.27)]),
    arrival:floorSlab('contact-door-threshold',[floorRectangle(0,1.95,1.28,.61)],1.06,.26,'threshold'),
  };
}

export function ReceptionTerminal(props:ModelProps) {
  const material=usePalette(props,'contact'),geometry=useResources(makeReceptionTerminal);
  return <group dispose={null}>
    <FurnishedInterior name="contact-interior" build={makeReceptionInterior}/>
    <mesh name="contact-foundation" geometry={geometry.foundation} material={material.paving} receiveShadow/>
    <mesh name="contact-room-floors" geometry={geometry.floor} material={material.paving} receiveShadow/>
    <mesh name="contact-curved-reception-shell" geometry={geometry.lobbyWalls} material={material.porcelain} castShadow/>
    <mesh name="contact-thick-curved-glazing" geometry={geometry.glazing} material={material.glass}/>
    <mesh name="contact-curtain-wall-mullions" geometry={geometry.frames} material={material.navy}/>
    <mesh name="contact-spun-lobby-roof" geometry={geometry.roof} material={material.porcelain} castShadow receiveShadow/>
    <mesh name="contact-roof-fascia" geometry={geometry.fascia} material={material.cyan}/>
    <mesh name="contact-communications-wing" geometry={geometry.serviceWing} material={material.porcelain} castShadow/>
    <mesh name="contact-wing-roof-and-parapets" geometry={geometry.serviceRoof} material={material.porcelain} castShadow/>
    <mesh name="contact-communications-windows" geometry={geometry.serviceWindows} material={material.facade}/>
    <mesh name="contact-service-window-frames" geometry={geometry.serviceFrames} material={material.edge}/>
    <mesh name="contact-rear-service-louvers" geometry={geometry.louvers} material={material.navy} castShadow/>
    <mesh name="contact-entry-doors" geometry={geometry.doors} material={material.glass}/>
    <mesh name="contact-entrance-hardware" geometry={geometry.entrance} material={material.navy}/>
    <mesh name="contact-supported-arrival-canopy" geometry={geometry.canopy} material={material.cyan} castShadow/>
    <mesh name="contact-arrival-threshold" geometry={geometry.arrival} material={material.paving} receiveShadow/>
  </group>;
}
