'use client';

import { BoxGeometry, CylinderGeometry, Shape, Vector3 } from 'three';
import { combine, gardenPlan, platform, roundedBox, strut, usePalette, useResources, type ModelProps } from './BuildingKit';

export function ReceptionTerminal(props: ModelProps) {
  const material=usePalette(props,'contact');
  const geometry=useResources(()=>{
    const box=(w:number,h:number,d:number,x:number,y:number,z:number)=>new BoxGeometry(w,h,d).translate(x,y,z);
    const arc=(outer:number,inner:number,top:number,height:number)=>{
      const shape=new Shape();const start=Math.PI/2+.30,end=Math.PI/2+Math.PI*2-.30;
      shape.absarc(0,0,outer,start,end,false);shape.absarc(0,0,inner,end,start,true);shape.closePath();
      return platform(shape,top,height);
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
      serviceWing:combine([box(1.22,2.02,2.15,1.75,2.01,-.25),roundedBox(1.45,.16,2.33,.08).translate(1.73,3.06,-.25)]),
      serviceWindows:combine([box(.045,.75,1.37,2.381,2.32,-.26),box(.65,.85,.045,1.88,2.35,-1.351)]),
      serviceFrames:combine([- .75,-.25,.25].map(z=>box(.055,.79,.028,2.415,2.32,z))),
      doors:combine([box(.425,1.62,.07,-.225,1.88,1.63),box(.425,1.62,.07,.225,1.88,1.63)]),
      entrance:combine([box(.055,1.70,.10,-.47,1.88,1.65),box(.055,1.70,.10,.47,1.88,1.65),box(.99,.07,.11,0,2.765,1.65),box(.035,1.62,.09,0,1.88,1.665),box(.022,.22,.03,-.07,1.86,1.71),box(.022,.22,.03,.07,1.86,1.71)]),
      arrival:combine([roundedBox(1.28,.08,.61,.035).translate(0,1.0,1.95),roundedBox(1.16,.36,.44,.09).translate(-.8,1.25,-.57),box(1.15,.05,.43,-.8,1.46,-.57)]),
      counter:roundedBox(1.08,.71,.46,.12).translate(.22,1.435,-.64),
      counterFace:roundedBox(.79,.16,.026,.04).translate(.22,1.63,-.399),
    };
  });
  return <group dispose={null}>
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
    <mesh geometry={geometry.counter} material={material.porcelain} />
    <mesh geometry={geometry.counterFace} material={material.cyan} />
  </group>;
}
