'use client';

import { CylinderGeometry, ExtrudeGeometry, Shape, SphereGeometry, Vector3, type BufferGeometry } from 'three';
import { FurnishedInterior, InteriorBuilder, floorSlab, floorRectangle } from './InteriorKit';
import { combine, stroke, usePalette, useResources, type ModelProps } from './BuildingKit';
import { architecturalSurface as surface, architecturalBox as box, doorway, windowBay, type ShellParts } from './LandmarkShellKit';

export function makeGalleryInterior() {
  const room = new InteriorBuilder(), floor = 1.078;
  room.floor('about-continuous-gallery-floor',[floorRectangle(-.48,-2.075,5.86,1.43),floorRectangle(-2.42,.01,1.98,2.74)],floor);
  for (const x of [-2.6,-1.1,.4,1.9]) {
    room.shelf(x,floor,-2.61,.95,1.5,.23);
    room.add('paper',new CylinderGeometry(.09,.07,.2,12).translate(x,2.68,-2.61));
    room.add('fabric',new SphereGeometry(.1,12,8).scale(.8,1.25,.8).translate(x+.27,2.69,-2.61));
  }
  room.table(-3.12,floor,-.22,.38,2.0,.68);
  for (const z of [-.91,-.24,.43]) room.plant(-3.12,floor+.73,z,.88);
  room.plant(-3.04,floor,1.05,1.2);
  // Low seating faces into the open sculpture court, leaving both door approaches clear.
  room.box('wood',.37,.07,.78,-1.63,1.44,.26);
  room.box('fabric',.35,.055,.75,-1.63,1.5,.26);
  room.box('wood',.06,.42,.8,-1.44,1.64,.26);
  for(const z of [-.03,.55]) room.box('metal',.045,.33,.045,-1.63,1.24,z);
  room.lamp(-2.46,3.52,-.2,1.4);
  room.lamp(.45,3.97,-2.02,2.0);
  return room.finish();
}

export function makeGardenGallery() {
  const parts: ShellParts = { walls: [], glass: [], frames: [] };
  const floor=1.06, spring=3.6;
  for(const x of [-2.48,-.45,1.58]) windowBay(parts,x,-2.89,2.03,floor,4.02,0,.55);
  windowBay(parts,2.52,-2.09,1.6,floor,4.02,Math.PI/2,.45);
  windowBay(parts,-3.5,-2.09,1.6,floor,4.02,Math.PI/2,.45);
  windowBay(parts,-.39,-1.29,2.34,floor,4.02,0,.32);
  doorway(parts,1.195,-1.29,.84,floor,4.02);
  windowBay(parts,2.15,-1.29,.58,floor,4.02,0,.3);
  for(const x of [-3.5,-1.38]) for(const z of [-.63,.7]) windowBay(parts,x,z,1.33,floor,spring,Math.PI/2,.2);
  doorway(parts,-1.95,1.46,.88,floor,spring);
  windowBay(parts,-2.96,1.46,1.08,floor,spring,0,.2);
  const roofPoint=(u:number,v:number)=>new Vector3(-3.62+u*2.36,3.61+Math.sin(u*Math.PI)*.83,-1.39+v*3.01);
  const conservatoryRoof=surface(roofPoint,32,8,.045);
  const ribs:BufferGeometry[]=[];
  for(const z of [-1.32,-.62,.08,.78,1.48]) {
    ribs.push(stroke(t=>roofPoint(t,(z+1.39)/3.01),.043,28));
    for(const x of [-3.49,-1.39]) ribs.push(box(.085,2.54,.085,x,2.33,z));
  }
  for(const u of [0,.25,.5,.75,1]) ribs.push(stroke(t=>roofPoint(u,t),.033,2));
  const gable=new Shape();gable.moveTo(-3.62,3.6);
  for(let i=0;i<=32;i++){const p=roofPoint(i/32,0);gable.lineTo(p.x,p.y);}
  gable.lineTo(-1.26,3.6);gable.closePath();
  parts.glass.push(new ExtrudeGeometry(gable,{depth:.04,bevelEnabled:false}).translate(0,0,1.46));
  // Gallery and conservatory share a full-width internal opening beneath the attached rear roof.
  const columns:BufferGeometry[]=[];
  for(const x of [-3.48,-1.38,2.51]) columns.push(box(.15,2.97,.15,x,2.545,-2.82));
  const planters:BufferGeometry[]=[box(.62,.32,1.42,2.08,1.22,.2)];
  const planting:BufferGeometry[]=[];
  for(let i=0;i<5;i++) planting.push(new SphereGeometry(.2,12,8).scale(.9,1.55,1).translate(2.08,1.58,-.35+i*.27));
  return {
    foundation:floorSlab('about-foundation',[floorRectangle(-.48,-2.09,6.16,1.78),floorRectangle(-2.44,.12,2.34,2.86)],.99,.22,'foundation'),
    floors:floorSlab('about-room-floors',[floorRectangle(-.48,-2.075,5.86,1.43),floorRectangle(-2.42,.01,1.98,2.74)],1.059,.069),
    walls:combine(parts.walls),glass:combine(parts.glass),frames:combine(parts.frames),ribs:combine(ribs),columns:combine(columns),conservatoryRoof,
    galleryRoof:combine([box(6.4,.18,1.99,-.48,4.12,-2.12),box(6.4,.1,.16,-.48,4.25,-1.17)]),
    thresholds:floorSlab('about-door-thresholds',[floorRectangle(-1.95,1.64,1.14,.4),floorRectangle(1.195,-1.14,.88,.3)],1.06,.26,'threshold'),
    canopy:box(1.16,.11,.7,1.195,3.28,-1.07),
    courtSupports:combine([new CylinderGeometry(.48,.55,.65,32).translate(0,1.125,0),box(.7,.28,1.5,2.08,.92,.2)]),
    planters:combine(planters),planting:combine(planting),
  };
}

export function GardenGallery(props:ModelProps) {
  const material=usePalette(props,'about'),geometry=useResources(makeGardenGallery);
  return <group name="about-gallery-conservatory" dispose={null}>
    <FurnishedInterior name="about-interior" build={makeGalleryInterior}/>
    <mesh name="about-court-foundation" geometry={geometry.foundation} material={material.paving} receiveShadow/>
    <mesh name="about-gallery-floors" geometry={geometry.floors} material={material.paving} receiveShadow/>
    <mesh name="about-enclosing-walls" geometry={geometry.walls} material={material.porcelain} castShadow receiveShadow/>
    <mesh name="about-gallery-roof" geometry={geometry.galleryRoof} material={material.porcelain} castShadow receiveShadow/>
    <mesh name="about-glazed-walls" geometry={geometry.glass} material={material.glass}/>
    <mesh name="about-window-frames" geometry={geometry.frames} material={material.navy} castShadow/>
    <mesh name="about-conservatory-ribs" geometry={geometry.ribs} material={material.edge} castShadow/>
    <mesh name="about-gallery-roof-columns" geometry={geometry.columns} material={material.edge} castShadow/>
    <mesh name="about-vaulted-conservatory-glass" geometry={geometry.conservatoryRoof} material={material.glass}/>
    <mesh name="about-entrance-thresholds" geometry={geometry.thresholds} material={material.paving} receiveShadow/>
    <mesh name="about-gallery-entry-canopy" geometry={geometry.canopy} material={material.cyan} castShadow/>
    <mesh name="about-court-furniture-footings" geometry={geometry.courtSupports} material={material.paving} receiveShadow/>
    <mesh name="about-court-planters" geometry={geometry.planters} material={material.porcelain} castShadow/>
    <mesh name="about-court-planting" geometry={geometry.planting} material={material.green} castShadow/>
  </group>;
}
