'use client';

import { BoxGeometry, CylinderGeometry, Shape, Vector3 } from 'three';
import { FurnishedInterior, InteriorBuilder } from './InteriorKit';
import { combine, gardenPlan, platform, roundedBox, strut, usePalette, useResources, type ModelProps } from './BuildingKit';

export function makeReceptionInterior() {
  const room = new InteriorBuilder();
  room.add('wood', new CylinderGeometry(1.51, 1.51, .014, 48).translate(0, 1.079, 0));
  room.box('wood', .65, .018, 1.94, 1.91, 1.079, -.25);
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
  room.lamp(-.56, 3.11, .29, .56); room.lamp(.54, 3.11, -.65, .46); room.lamp(1.9, 2.97, -.25, .44);
  return room.finish();
}

export function ReceptionTerminal(props: ModelProps) {
  const material=usePalette(props,'contact');
  const geometry=useResources(()=>{
    const box=(w:number,h:number,d:number,x:number,y:number,z:number)=>new BoxGeometry(w,h,d).translate(x,y,z);
    const arc=(outer:number,inner:number,top:number,height:number)=>{
      return combine([[Math.PI / 2 + .30, Math.PI * 2 - .32], [.32, Math.PI / 2 - .30]].map(([start,end]) => {
        const shape = new Shape(); shape.absarc(0,0,outer,start,end,false); shape.absarc(0,0,inner,end,start,true); shape.closePath();
        return platform(shape,top,height);
      }));
    };
    const frames=Array.from({length:13},(_,i)=>{
      const angle=Math.PI/2+.32+i*(Math.PI*2-.64)/12;
      return strut(new Vector3(Math.cos(angle)*1.67,1.56,Math.sin(angle)*1.67),new Vector3(Math.cos(angle)*1.67,3.12,Math.sin(angle)*1.67),.035);
    });
    return {
      foundation:platform(gardenPlan(5.3,4.8)),
      floor:new CylinderGeometry(1.66,1.66,.06,64).translate(0,1.04,0),
      lobbyWalls:arc(1.7,1.55,1.57,.57),
      glazing:arc(1.66,1.60,3.13,1.56),
      frames:combine(frames),
      roof:new CylinderGeometry(1.84,1.84,.17,64).translate(0,3.22,0),
      fascia:arc(1.86,1.81,3.18,.08),
      serviceWing:combine([
        box(1.22,.07,2.15,1.75,1.035,-.25), roundedBox(1.45,.16,2.33,.08).translate(1.73,3.06,-.25),
        box(1.22,2.02,.12,1.75,2.01,.825),
        box(.12,.88,2.15,2.3,1.44,-.25), box(.12,.28,2.15,2.3,2.88,-.25),
        box(.12,.86,.36,2.3,2.31,-1.145), box(.12,.86,.36,2.3,2.31,.645),
        box(1.22,.91,.12,1.75,1.455,-1.325),box(1.22,.24,.12,1.75,2.9,-1.325),
        box(.415,.91,.12,1.3475,2.335,-1.325),box(.15,.91,.12,2.285,2.335,-1.325),
      ]),
      serviceWindows:combine([box(.045,.75,1.37,2.381,2.32,-.26),box(.65,.85,.045,1.88,2.35,-1.351)]),
      serviceFrames:combine([
        ...[-.75,-.25,.25].map(z=>box(.055,.79,.028,2.415,2.32,z)),
        ...[1.91,2.72].map(y=>box(.075,.085,1.44,2.39,y,-.26)),
        ...[-.963,.443].map(z=>box(.075,.83,.065,2.39,2.32,z)),
        ...[1.9225,2.7775].map(y=>box(.69,.045,.07,1.88,y,-1.355)),
      ]),
      doors:combine([box(.425,1.62,.07,-.225,1.88,1.63),box(.425,1.62,.07,.225,1.88,1.63)]),
      entrance:combine([box(.055,1.70,.10,-.47,1.88,1.65),box(.055,1.70,.10,.47,1.88,1.65),box(.99,.07,.11,0,2.765,1.65),box(.035,1.62,.09,0,1.88,1.665),box(.022,.22,.03,-.07,1.86,1.71),box(.022,.22,.03,.07,1.86,1.71)]),
      arrival:roundedBox(1.28,.08,.61,.035).translate(0,1.0,1.95),
    };
  });
  return <group dispose={null}>
    <FurnishedInterior name="contact-interior" build={makeReceptionInterior} />
    <mesh name="contact-foundation" geometry={geometry.foundation} material={material.paving} receiveShadow />
    <mesh geometry={geometry.floor} material={material.porcelain} receiveShadow />
    <mesh name="contact-enclosed-lobby" geometry={geometry.lobbyWalls} material={material.porcelain} castShadow />
    <mesh name="contact-thick-curved-glazing" geometry={geometry.glazing} material={material.glass} />
    <mesh geometry={geometry.frames} material={material.edge} />
    <mesh name="contact-disc-roof" geometry={geometry.roof} material={material.porcelain} castShadow />
    <mesh geometry={geometry.fascia} material={material.cyan} />
    <mesh name="contact-service-wing" geometry={geometry.serviceWing} material={material.porcelain} castShadow />
    <mesh geometry={geometry.serviceWindows} material={material.facade} />
    <mesh geometry={geometry.serviceFrames} material={material.edge} />
    <mesh name="contact-entry-doors" geometry={geometry.doors} material={material.glass} />
    <mesh geometry={geometry.entrance} material={material.navy} />
    <mesh name="contact-arrival-threshold" geometry={geometry.arrival} material={material.porcelain} castShadow />
  </group>;
}
