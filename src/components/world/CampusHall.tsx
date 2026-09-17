'use client';

import { Vector3, type BufferGeometry } from 'three';
import { combine, usePalette, useResources, type ModelProps } from './BuildingKit';
import { architecturalSurface as surface, architecturalBox as box, doorway, windowBay, type ShellParts } from './LandmarkShellKit';
import { FurnishedInterior, InteriorBuilder, floorSlab, floorRectangle } from './InteriorKit';

export const CAMPUS_HALL = { width: 6.8, depth: 4.8, floor: 1.03, ceiling: 3.88, entrance: [0, 1.03, 1.72] as const };

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
  b.box('wood', .94, .78, .055, -1.23, 2.36, -3.185);
  b.box('paper', .78, .60, .025, -1.23, 2.37, -3.143);
  for (let row = 0; row < 3; row++) b.box('metal', .55 - row * .08, .025, .012, -1.26, 2.52 - row * .14, -3.122);
  b.box('fabric', .84, .10, .39, -1.3, floor + .38, 1.1);
  b.box('wood', .9, .07, .43, -1.3, floor + .30, 1.1);
  for (const x of [-1.64, -.96]) b.box('metal', .045, .27, .32, x, floor + .135, 1.1);
  b.floor('purdue-rear-learning-lab',[floorRectangle(0,-2.2,6.42,1.7),floorRectangle(-2.62,-.05,1.2,2.8),floorRectangle(2.62,-.05,1.2,2.8)],floor,.025);
  for(const x of [-2.52,0,2.52]) { b.table(x,floor,-2.5,1.55,.62,.72); b.monitor(x,floor+.78,-2.56); b.chair(x,floor,-1.94,Math.PI); b.lamp(x,3.76,-2.35,1.2); }
  b.plant(-1.91, floor, -1.1, .9); b.plant(1.9, floor, -1.07, .8);
  b.lamp(-1.15, 3.27, .22, 1.2); b.lamp(1.15, 3.27, .22, 1.2);
  return b.finish();
}

export function makeCampusHall() {
  const parts: ShellParts = { walls: [], glass: [], frames: [] };
  const floor = CAMPUS_HALL.floor, top = 3.88;
  doorway(parts, 0, 1.51, 1.38, floor, top);
  for (const x of [-2.12, 2.12]) windowBay(parts, x, 1.51, 2.48, floor, top, 0, .25);
  for (const side of [-1, 1]) for (const z of [-2.1, .3]) windowBay(parts, side * 3.34, z, 2.4, floor, top, Math.PI / 2, .38);
  for (const x of [-2.23, 0, 2.23]) windowBay(parts, x, -3.3, 2.23, floor, top, 0, .64);
  const roof: BufferGeometry[] = [], clerestory: BufferGeometry[] = [], ribs: BufferGeometry[] = [], gables: BufferGeometry[] = [];
  // Three attached north-light roof bays make a compact academic workshop rather than a monument.
  for (let bay = 0; bay < 3; bay++) {
    const rear = -3.5 + bay * 1.76;
    roof.push(surface((u,v) => new Vector3(-3.58 + u * 7.16, 3.96 + v * .62, rear + v * 1.76), 2, 2, .15));
    clerestory.push(box(6.96, .59, .045, 0, 4.22, rear + 1.76));
    for(const x of [-3.34,3.34]) gables.push(surface((u,v)=>new Vector3(x,3.84+v*Math.max(.01,.62*u-.03),rear+u*1.76),12,1,.05));
    for (const x of [-3.32, -1.67, 0, 1.67, 3.32]) {
      ribs.push(box(.065, .64, .085, x, 4.24, rear + 1.76));
      ribs.push(surface((u,v) => new Vector3(x + (u-.5)*.09, 3.79+v*.62, rear+v*1.76), 1, 1, .11));
    }
  }
  const fins: BufferGeometry[] = [];
  for (const side of [-1,1]) for(const x of [1.15,1.65,2.15,2.65,3.15]) fins.push(box(.045,2.44,.32,side*x,2.37,1.67));
  return {
    base: floorSlab('purdue-foundation',[floorRectangle(0,-.895,6.88,4.99)],1.005,.205,'foundation'),
    walls: combine(parts.walls), windows: combine(parts.glass), frames: combine(parts.frames), roof: combine(roof), clerestory: combine(clerestory), ribs: combine(ribs), fins: combine(fins), gables: combine(gables),
    canopy: combine([box(2.08,.14,.87,0,3.14,1.85),box(.08,2.08,.08,-.96,2.07,2.22),box(.08,2.08,.08,.96,2.07,2.22),box(.22,.32,.22,-.96,.92,2.22),box(.22,.32,.22,.96,.92,2.22)]),
    trim: combine([box(6.8,.07,.24,0,3.74,1.51),box(.06,.075,4.86,-3.39,3.74,-.9),box(.06,.075,4.86,3.39,3.74,-.9)]),
    threshold: floorSlab('purdue-door-threshold',[floorRectangle(0,1.73,1.45,.43)],1.03,.23,'threshold'),
  };
}

export function CampusHall(props: ModelProps) {
  const material = usePalette(props, 'purdue');
  const geometry = useResources(makeCampusHall);
  return <group dispose={null}>
    <mesh name="purdue-foundation" geometry={geometry.base} material={material.paving} receiveShadow />
    <mesh name="purdue-academic-workshop-shell" geometry={geometry.walls} material={material.porcelain} castShadow receiveShadow />
    <mesh name="purdue-north-light-roof" geometry={geometry.roof} material={material.black} castShadow receiveShadow />
    <mesh name="purdue-campus-windows" geometry={geometry.windows} material={material.facade} />
    <mesh name="purdue-closed-sawtooth-gables" geometry={geometry.gables} material={material.porcelain} castShadow />
    <mesh name="purdue-sawtooth-clerestory" geometry={geometry.clerestory} material={material.glass} />
    <mesh name="purdue-roof-structural-ribs" geometry={geometry.ribs} material={material.edge} castShadow />
    <mesh name="purdue-window-frames" geometry={geometry.frames} material={material.black} />
    <mesh name="purdue-front-sunshade-fins" geometry={geometry.fins} material={material.black} castShadow />
    <mesh name="purdue-supported-canopy" geometry={geometry.canopy} material={material.porcelain} castShadow />
    <mesh name="purdue-brass-fascia" geometry={geometry.trim} material={material.gold} />
    <mesh name="purdue-entry-threshold" geometry={geometry.threshold} material={material.paving} receiveShadow />
    <FurnishedInterior name="purdue-study-lobby" build={createCampusInterior} />
  </group>;
}
