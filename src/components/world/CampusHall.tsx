'use client';

import { BoxGeometry, type BufferGeometry } from 'three';
import { combine, usePalette, useResources, type ModelProps } from './BuildingKit';
import { FurnishedInterior, InteriorBuilder, floorSlab, floorRectangle } from './InteriorKit';

export const CAMPUS_HALL = { width: 4.5, depth: 3.2, floor: 1.03, ceiling: 3.3, entrance: [0, 1.03, 1.72] as const };

export function createCampusInterior() {
  const b = new InteriorBuilder(); const floor = CAMPUS_HALL.floor;
  // A continuous substrate closes the joints above the graded entrance ground.
  // The narrow doorway tongue stops exactly where the exterior threshold begins.
  b.floor('purdue-continuous-subfloor',[floorRectangle(0,0,4.052,2.84),floorRectangle(0,1.4675,1.4,.095)],floor-.001,.024);
  for (let plank = 0; plank < 14; plank++) b.floor(`purdue-floor-plank-${plank}`,[floorRectangle(-1.885+plank*.29,0,.282,2.84)],floor,.001);
  // Two window study areas flank the clear central entrance and information wall.
  b.table(-1.32, floor, -.35, 1.12, .48); b.monitor(-1.32, floor + .67, -.43);
  b.chair(-1.32, floor, .14, Math.PI); b.chair(1.4, floor, .72, Math.PI / 2);
  b.chair(1.4, floor, .05, Math.PI / 2);
  b.table(1.4, floor, .38, .4, .35, .39);
  b.shelf(1.24, floor, -1.29, 1.2, 1.35, .22);
  b.box('wood', .94, .78, .055, -.15, 2.06, -1.455);
  b.box('paper', .78, .60, .025, -.15, 2.07, -1.412);
  for (let row = 0; row < 3; row++) b.box('metal', .55 - row * .08, .025, .012, -.18, 2.22 - row * .14, -1.391);
  b.box('fabric', .84, .10, .39, -1.3, floor + .38, 1.1);
  b.box('wood', .9, .07, .43, -1.3, floor + .30, 1.1);
  for (const x of [-1.64, -.96]) b.box('metal', .045, .27, .32, x, floor + .135, 1.1);
  b.plant(-1.91, floor, -1.1, .9); b.plant(1.9, floor, -1.07, .8);
  b.lamp(-1.15, 3.27, .22, 1.2); b.lamp(1.15, 3.27, .22, 1.2);
  return b.finish();
}

export function CampusHall(props: ModelProps) {
  const material = usePalette(props, 'purdue');
  const geometry = useResources(() => {
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new BoxGeometry(w,h,d).translate(x,y,z);
    const walls: BufferGeometry[] = [box(4.4,2.25,.15,0,2.15,-1.51),box(1.46,.25,.15,-1.47,1.14,1.51),box(1.46,.25,.15,1.47,1.14,1.51),box(4.4,.31,.15,0,3.15,1.51)];
    const windows: BufferGeometry[] = [], frames: BufferGeometry[] = [];
    for (const side of [-1,1]) {
      walls.push(box(.15,.25,3.08,side*2.13,1.14,0),box(.15,.31,3.08,side*2.13,3.15,0));
      for (const z of [-1.45,0,1.45]) frames.push(box(.13,2.0,.1,side*2.15,2.12,z));
      for (const z of [-.73,.73]) windows.push(box(.045,1.77,1.34,side*2.15,2.12,z));
      windows.push(box(1.26,1.77,.045,side*1.43,2.12,1.53));
      for (const x of [.73,2.13]) frames.push(box(.1,2.0,.1,side*x,2.12,1.55));
      frames.push(box(.045,1.78,.07,side*1.43,2.12,1.565));
    }
    // Solid corner piers, transparent bays, and a raised central clerestory.
    for (const x of [-2.13,2.13]) walls.push(box(.16,2.25,.16,x,2.15,-1.48));
    return {
      base:floorSlab('purdue-foundation',[floorRectangle(0,0,4.44,3.19)],1.005,.205,'foundation'), walls:combine(walls), windows:combine(windows), frames:combine(frames),
      roof:combine([box(4.72,.16,3.55,0,3.36,0),box(1.65,.12,2.82,0,3.92,-.1)]),
      clerestory:combine([box(.05,.42,2.68,-.76,3.65,-.1),box(.05,.42,2.68,.76,3.65,-.1),box(1.56,.42,.05,0,3.65,1.24),box(1.56,.42,.05,0,3.65,-1.44)]),
      clerestoryFrame:combine([box(.07,.44,.07,-.79,3.65,1.27),box(.07,.44,.07,.79,3.65,1.27),box(.07,.44,.07,-.79,3.65,-1.47),box(.07,.44,.07,.79,3.65,-1.47)]),
      doors:combine([box(.58,1.83,.065,-.3,1.975,1.57),box(.58,1.83,.065,.3,1.975,1.57)]),
      entry:combine([box(.085,1.95,.11,-.645,2.015,1.6),box(.085,1.95,.11,.645,2.015,1.6),box(1.37,.085,.11,0,2.99,1.6),box(.035,1.86,.08,0,1.97,1.63),box(.027,.27,.05,-.07,1.94,1.685),box(.027,.27,.05,.07,1.94,1.685)]),
      canopy:box(1.7,.10,.55,0,3.13,1.71),
      trim:combine([box(4.74,.047,.045,0,3.45,1.79),box(.53,.10,.025,0,3.19,2),box(.055,.06,3.53,-2.35,3.45,0),box(.055,.06,3.53,2.35,3.45,0)]),
      threshold:floorSlab('purdue-door-threshold',[floorRectangle(0,1.73,1.45,.43)],1.03,.23,'threshold'),
    };
  });
  return <group dispose={null}>
    <mesh name="purdue-foundation" geometry={geometry.base} material={material.paving} receiveShadow />
    <mesh name="purdue-enclosed-hall" geometry={geometry.walls} material={material.porcelain} castShadow receiveShadow />
    <mesh name="purdue-clerestory-roof" geometry={geometry.roof} material={material.black} castShadow />
    <mesh name="purdue-campus-windows" geometry={geometry.windows} material={material.facade} />
    <mesh geometry={geometry.clerestory} material={material.glass} />
    <mesh geometry={geometry.clerestoryFrame} material={material.black} />
    <mesh geometry={geometry.frames} material={material.black} />
    <mesh name="purdue-entry-doors" geometry={geometry.doors} material={material.glass} />
    <mesh geometry={geometry.entry} material={material.black} />
    <mesh geometry={geometry.canopy} material={material.porcelain} castShadow />
    <mesh geometry={geometry.trim} material={material.gold} />
    <mesh name="purdue-entry-threshold" geometry={geometry.threshold} material={material.paving} receiveShadow />
    <FurnishedInterior name="purdue-study-lobby" build={createCampusInterior} />
  </group>;
}
