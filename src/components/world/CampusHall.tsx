'use client';

import { BoxGeometry, BufferGeometry, ExtrudeGeometry, Shape } from 'three';
import { combine, roundedBox, usePalette, useResources, type ModelProps } from './BuildingKit';

export function CampusHall(props: ModelProps) {
  const material = usePalette(props, 'purdue');
  const geometry = useResources(() => {
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new BoxGeometry(w,h,d).translate(x,y,z);
    const roof = new Shape(); roof.moveTo(-1.33,2.71);roof.lineTo(0,3.25);roof.lineTo(1.33,2.71);roof.lineTo(1.33,2.59);roof.lineTo(0,3.10);roof.lineTo(-1.33,2.59);roof.closePath();
    const gable = new Shape();gable.moveTo(-1.2,2.62);gable.lineTo(0,3.1);gable.lineTo(1.2,2.62);gable.closePath();
    const walls: BufferGeometry[] = [box(2.42,1.66,.13,0,1.83,-.79),box(.14,1.66,1.62,-1.14,1.83,0),box(.14,1.66,1.62,1.14,1.83,0),box(2.42,.23,.14,0,2.55,.79),box(.77,1.43,.14,-.825,1.715,.79),box(.77,1.43,.14,.825,1.715,.79),new ExtrudeGeometry(gable,{depth:.12,bevelEnabled:false}).translate(0,0,.73),new ExtrudeGeometry(gable,{depth:.12,bevelEnabled:false}).translate(0,0,-.85)];
    const panes: BufferGeometry[] = [], frames: BufferGeometry[] = [];
    for(const side of [-1,1])for(const z of [-.38,.38]){
      panes.push(box(.055,.73,.48,side*1.225,2.05,z));
      frames.push(box(.045,.79,.035,side*1.265,2.05,z-.26),box(.045,.79,.035,side*1.265,2.05,z+.26),box(.045,.035,.53,side*1.265,2.45,z),box(.045,.035,.53,side*1.265,1.65,z));
    }
    return {
      base:roundedBox(2.75,.16,2.08,.08).translate(0,.92,0),
      walls:combine(walls),
      roof:new ExtrudeGeometry(roof,{depth:2.03,bevelEnabled:false}).translate(0,0,-1.015),
      windows:combine(panes),
      frames:combine(frames),
      doors:combine([box(.355,1.24,.07,-.19,1.64,.84),box(.355,1.24,.07,.19,1.64,.84)]),
      entry:combine([box(.06,1.37,.1,-.425,1.685,.88),box(.06,1.37,.1,.425,1.685,.88),box(.88,.06,.1,0,2.37,.88),box(.032,1.24,.08,0,1.64,.895),box(.023,.2,.025,-.055,1.62,.93),box(.023,.2,.025,.055,1.62,.93)]),
      trim:combine([box(2.68,.055,.06,0,2.69,1.03),box(2.68,.055,.06,0,2.69,-1.03),box(.55,.10,.025,0,2.53,.87)]),
      step:roundedBox(1.05,.08,.37,.025).translate(0,.92,1.1),
      bench:combine([box(.53,.075,.25,-.86,1.29,1.03),box(.065,.25,.21,-1.04,1.13,1.03),box(.065,.25,.21,-.68,1.13,1.03)]),
    };
  });
  return <group dispose={null}>
    <mesh name="purdue-foundation" geometry={geometry.base} material={material.paving} receiveShadow />
    <mesh name="purdue-enclosed-hall" geometry={geometry.walls} material={material.porcelain} castShadow receiveShadow />
    <mesh name="purdue-gabled-roof" geometry={geometry.roof} material={material.black} castShadow />
    <mesh name="purdue-campus-windows" geometry={geometry.windows} material={material.facade} />
    <mesh geometry={geometry.frames} material={material.edge} />
    <mesh name="purdue-entry-doors" geometry={geometry.doors} material={material.glass} />
    <mesh geometry={geometry.entry} material={material.black} />
    <mesh geometry={geometry.trim} material={material.gold} />
    <mesh name="purdue-entry-threshold" geometry={geometry.step} material={material.porcelain} receiveShadow />
    <mesh geometry={geometry.bench} material={material.porcelain} castShadow />
  </group>;
}
