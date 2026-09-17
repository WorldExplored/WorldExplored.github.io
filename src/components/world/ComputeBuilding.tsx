'use client';

import { BoxGeometry, CylinderGeometry, Vector3, type BufferGeometry } from 'three';
import { architecturalSurface as surface } from './LandmarkShellKit';
import { FurnishedInterior, InteriorBuilder, floorSlab, floorRectangle } from './InteriorKit';
import { combine, roundedBox, stroke, usePalette, useResources, type ModelProps } from './BuildingKit';

export function makeComputeBuilding() {
  const walls: BufferGeometry[] = [];
  const frames: BufferGeometry[] = [];
  const windows: BufferGeometry[] = [];
  const service: BufferGeometry[] = [];
  const planting: BufferGeometry[] = [];
  const solar: BufferGeometry[] = [];
  const hardware: BufferGeometry[] = [];
  const box = (width: number, height: number, depth: number, x: number, y: number, z: number) => new BoxGeometry(width, height, depth).translate(x, y, z);

  // Continuous sill, floor and parapet bands enclose both occupied levels.
  for (const side of [-1, 1]) {
    const x = side * 2.875;
    for (const [y, height] of [[1.28, 0.44], [3.04, 0.3], [4.78, 0.3]]) {
      walls.push(box(2.85, height, .22, x, y, 2.24), box(.22, height, 4.7, side * 4.19, y, 0));
    }
    // Open connections from the atrium to both occupied wings.
    for (const z of [-1.85, 1.85]) walls.push(box(0.22, 3.86, 0.22, side * 1.52, 2.99, z));
    for (const z of [-2.135, 2.135]) walls.push(box(0.22, 3.86, 0.43, side * 4.19, 2.99, z));
    for (const z of [-0.67, 0.67]) walls.push(box(0.22, 3.86, 0.18, side * 4.19, 2.99, z));
    // Solid rear walls and service recesses give the building a distinct back.
    walls.push(box(2.85, 3.86, 0.22, x, 2.99, -2.24));
    for (const [y, height] of [[2.195, 1.39], [3.91, 1.44]]) {
      windows.push(box(2.41, height, 0.08, x, y, 2.28));
      for (const offset of [-0.81, 0, 0.81]) frames.push(box(0.045, height, 0.13, x + offset, y, 2.32));
      // Side windows occupy real openings between structural piers.
      for (const z of [-1.34, 0, 1.34]) {
        windows.push(box(0.08, height, 1.16, side * 4.315, y, z));
        frames.push(box(0.12, height, 0.045, side * 4.4, y, z - 0.59));
        frames.push(box(0.12, height, 0.045, side * 4.4, y, z + 0.59));
      }
    }
    // Deep, framed equipment bays remain below the upper floor on the rear.
    service.push(box(1.76, 1.08, 0.1, x, 1.98, -2.39));
    for (let row = 0; row < 7; row++) frames.push(box(1.68, 0.035, 0.085, x, 1.52 + row * 0.14, -2.46));
    frames.push(box(1.94, 0.09, 0.14, x, 2.55, -2.42), box(1.94, 0.09, 0.14, x, 1.4, -2.42));
    // Low roof gardens sit clear of the central machinery mounting surface.
    walls.push(box(0.58, 0.19, 3.35, side * 3.86, 5.08, -0.07));
    planting.push(box(0.43, 0.13, 3.17, side * 3.86, 5.23, -0.07));
    for (let panel = 0; panel < 2; panel++) {
      solar.push(new BoxGeometry(1.27, 0.07, 0.76).rotateX(-0.1).translate(side * 2.69, 5.15, .67 + panel * .89));
      frames.push(box(1.33, 0.045, 0.035, side * 2.69, 5.235, .29 + panel * .89));
      frames.push(box(0.025, 0.055, 0.75, side * 2.69, 5.18, .67 + panel * .89));
    }
  }

  // The atrium has a solid rear service core, glazed front and enclosed sides.
  service.push(box(2.9, 3.9, 0.44, 0, 3.01, -2.12));
  walls.push(box(0.16, 3.9, 0.24, -1.45, 3.01, 2.32), box(0.16, 3.9, 0.24, 1.45, 3.01, 2.32));
  const atrium = combine([
    box(2.72, 1.71, 0.08, 0, 4.105, 2.35),
    box(0.37, 2.1, 0.08, -1.165, 2.11, 2.35),
    box(0.37, 2.1, 0.08, 1.165, 2.11, 2.35),
  ]);
  frames.push(box(2.9, 0.085, 0.14, 0, 3.205, 2.4), box(2.9, 0.1, 0.14, 0, 4.94, 2.4));
  for (const x of [-0.97, 0, 0.97]) frames.push(box(0.055, 1.73, 0.13, x, 4.085, 2.4));
  for (const x of [-0.97, 0, 0.97]) frames.push(box(0.065, 2.1, 0.15, x, 2.11, 2.42));
  frames.push(box(1.99, 0.075, 0.15, 0, 1.085, 2.42));
  const doors = combine([-1, 1].map(side => box(0.9, 2.045, 0.08, side * 0.485, 2.115, 2.39)));
  for (const side of [-1, 1]) {
    hardware.push(box(0.035, 0.38, 0.07, side * 0.11, 2.1, 2.49));
    hardware.push(box(0.1, 0.035, 0.09, side * 0.11, 1.94, 2.47));
  }

  // Actual floor slabs and a short internal stair establish a legible second story.
  const foundation = floorSlab('work-foundation', [floorRectangle(-2.875,0,2.87,4.72),floorRectangle(2.875,0,2.87,4.72),floorRectangle(0,.04,3.08,4.82)],1.02,.22,'foundation');
  const ground = floorSlab('work-ground-floor', [floorRectangle(-2.855,.055,2.43,4.35),floorRectangle(2.855,.055,2.43,4.35),floorRectangle(0,.14,3.28,4.08),floorRectangle(0,2.24,2.72,.12)],1.126,.106);
  const upper = floorSlab('work-upper-floors', [floorRectangle(-2.855,.055,2.43,4.35),floorRectangle(2.855,.055,2.43,4.35),floorRectangle(0,-1.58,3.28,.64)],3.206,.146);
  const floors: BufferGeometry[] = [];
  for (let step = 0; step < 11; step++) {
    const height = (step + 1) * 0.188;
    floors.push(box(0.77, height, 0.26, -0.9, 1.13 + height / 2, 1.2 - step * 0.26));
  }
  for (const side of [-1, 1]) {
    frames.push(box(0.045, 0.86, 0.06, side * 1.37, 3.64, 0.72), box(0.045, 0.86, 0.06, side * 1.37, 3.64, -0.94));
    frames.push(box(0.06, 0.05, 2.6, side * 1.37, 4.07, -0.23));
  }
  const roof = combine([
    roundedBox(2.98, 0.22, 4.86, 0.065).translate(-2.875, 4.99, 0),
    roundedBox(2.98, 0.22, 4.86, 0.065).translate(2.875, 4.99, 0),

  ]);
  // A raised glazed hall binds the two compute wings into one building. The roof closes
  // on its bearing rails and exposes the mezzanine rather than supporting novelty wheels.
  const atriumRoof = surface((u,v) => new Vector3((u-.5)*3.06,5.56+.53*Math.sin(u*Math.PI),(v-.5)*4.99),32,8,.075);
  const atriumRibs: BufferGeometry[] = [];
  for(const z of [-2.34,-1.17,0,1.17,2.34]) atriumRibs.push(stroke(t=>new Vector3((t-.5)*3.06,5.48+.53*Math.sin(t*Math.PI),z),.055,24));
  for(const x of [-1.48,1.48]) {
    atriumRibs.push(box(.09,.14,4.91,x,5.48,0));
    windows.push(box(.05,.54,4.68,x,5.21,0));
    for(const z of [-2.3,-1.15,0,1.15,2.3]) frames.push(box(.065,.57,.065,x,5.23,z));
  }
  for(const z of [-2.34,2.34]) windows.push(surface((u,v)=>{
    const x=(u-.5)*2.92,top=5.5+.53*Math.sin(u*Math.PI);
    return new Vector3(x,4.94+v*(top-4.94),z);
  },24,1,.045));
  const shades: BufferGeometry[] = [];
  for(const side of [-1,1]) {
    // Full-height piers and individually attached fins give the two occupied wings depth.
    for(const x of [1.62,2.45,3.28,4.12]) shades.push(box(.065,3.42,.42,side*x,3.05,2.47));
    for(const level of [3.15,4.94]) shades.push(box(2.8,.095,.55,side*2.875,level,2.48));
    for(const z of [-1.33,0,1.33]) shades.push(box(.35,3.28,.055,side*4.39,3.0,z));
  }
  const entry = combine([
    floorSlab('work-door-threshold',[floorRectangle(0,2.51,2.5,.5)],1.105,.305,'threshold'),
    box(2.23, 0.11, 0.68, 0, 3.275, 2.57),
  ]);
  return {
    walls: combine(walls), frames: combine(frames), windows: combine(windows),
    service: combine(service), planting: combine(planting), solar: combine(solar), hardware: combine(hardware),
    foundation, ground, upper, floors: combine(floors), roof, atrium, doors, entry, atriumRoof, atriumRibs: combine(atriumRibs), shades: combine(shades),
  };
}

export function makeComputeInterior() {
  const room = new InteriorBuilder();
  for (const x of [-2.875, 2.875]) {
    for (const floor of [1.135, 3.215]) {
      room.floor(`work-wing-floor-${x}-${floor}`, [floorRectangle(Math.sign(x)*2.855,0,2.39,4.05)],floor+.009);
      for (const dx of [-.59, .59]) {
        room.table(x + dx, floor + .01, 1.56, 1.03, .48, .64);
        room.monitor(x + dx, floor + .69, 1.56, Math.PI);
        room.chair(x + dx, floor + .01, .98);
      }
      room.plant(x + .82, floor + .01, -.35, .86);
      room.lamp(x, floor + 1.62, .8, 1.42);
      room.shelf(x - .28, floor + .01, -1.88, 1.55, 1.02, .24);
    }
  }
  for (const x of [-3.7, 3.7]) {
    room.box('metal', .53, 1.38, .58, x, 1.83, -.85);
    for (let row = 0; row < 7; row++) {
      room.box('screen', .43, .12, .02, x, 1.26 + row * .175, -.547);
      room.box('light', .06, .025, .025, x + .15, 1.28 + row * .175, -.531);
    }
    for (const dx of [-.35, .35]) {
      room.add('pipe', new CylinderGeometry(.065, .065, 1.34, 10).translate(x + dx, 1.84, -.75));
      room.add('coolant', new CylinderGeometry(.026, .026, 1.3, 8).translate(x + dx, 1.84, -.75));
      room.rod('pipe', [x + dx, 2.5, -.75], [x, 2.5, -.75], .07);
      room.rod('coolant', [x + dx, 2.5, -.75], [x, 2.5, -.75], .028);
    }
  }
  // The lobby stays clear between the double doors and stair approach.
  room.table(.77, 1.135, .75, .52, .44, .62);
  room.monitor(.77, 1.81, .68);
  room.plant(.82, 1.135, -.28, 1.1);
  room.lamp(0, 4.94, .4, 1.18);
  for (const x of [-1.31, -.49]) {
    for (const i of [0, 3, 6, 10]) {
      const y = 1.135 + (i + 1) * .188;
      room.rod('metal', [x, y, 1.2 - i * .26], [x, y + .66, 1.2 - i * .26], .018);
    }
    room.rod('wood', [x, 1.98, 1.2], [x, 3.86, -1.4], .025);
  }
  return room.finish();
}

export function ComputeBuilding(props: ModelProps) {
  const geometry = useResources(makeComputeBuilding);
  const materials = usePalette(props, 'work');
  return <group name="work-compute-building" dispose={null}>
    <FurnishedInterior name="work-interior" build={makeComputeInterior} />
    <mesh name="work-exterior-walls" geometry={geometry.walls} material={materials.porcelain} castShadow receiveShadow />
    <mesh name="work-raised-atrium-roof" geometry={geometry.atriumRoof} material={materials.glass} />
    <mesh name="work-atrium-roof-bearing-ribs" geometry={geometry.atriumRibs} material={materials.edge} castShadow />
    <mesh name="work-structural-piers-and-sunshades" geometry={geometry.shades} material={materials.edge} castShadow />
    <mesh name="work-roof" geometry={geometry.roof} material={materials.porcelain} castShadow receiveShadow />
    <mesh name="work-entry-threshold-and-lintel" geometry={geometry.entry} material={materials.porcelain} castShadow receiveShadow />
    <mesh name="work-foundation" geometry={geometry.foundation} material={materials.paving} receiveShadow />
    <mesh name="work-ground-floor" geometry={geometry.ground} material={materials.paving} receiveShadow />
    <mesh name="work-upper-floors" geometry={geometry.upper} material={materials.paving} receiveShadow />
    <mesh name="work-floors-and-atrium-stair" geometry={geometry.floors} material={materials.paving} receiveShadow />
    <mesh name="work-window-frames" geometry={geometry.frames} material={materials.edge} castShadow receiveShadow />
    <mesh name="work-wing-windows" geometry={geometry.windows} material={materials.glass} />
    <mesh name="work-atrium-glazing" geometry={geometry.atrium} material={materials.glass} />
    <mesh name="work-entry-doors" geometry={geometry.doors} material={materials.glass} />
    <mesh name="work-entry-handles" geometry={geometry.hardware} material={materials.navy} />
    <mesh name="work-rear-service-core" geometry={geometry.service} material={materials.navy} castShadow receiveShadow />
    <mesh name="work-roof-gardens" geometry={geometry.planting} material={materials.green} receiveShadow />
    <mesh name="work-solar-panels" geometry={geometry.solar} material={materials.navy} receiveShadow />
  </group>;
}
