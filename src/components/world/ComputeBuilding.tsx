'use client';

import { BoxGeometry, type BufferGeometry } from 'three';
import { combine, roundedBox, usePalette, useResources, type ModelProps } from './BuildingKit';

function makeComputeBuilding() {
  const walls: BufferGeometry[] = [];
  const frames: BufferGeometry[] = [];
  const windows: BufferGeometry[] = [];
  const backing: BufferGeometry[] = [];
  const service: BufferGeometry[] = [];
  const planting: BufferGeometry[] = [];
  const solar: BufferGeometry[] = [];
  const hardware: BufferGeometry[] = [];
  const box = (width: number, height: number, depth: number, x: number, y: number, z: number) => new BoxGeometry(width, height, depth).translate(x, y, z);

  // Continuous sill, floor and parapet bands enclose both occupied levels.
  for (const side of [-1, 1]) {
    const x = side * 2.875;
    for (const [y, height] of [[1.28, 0.44], [3.04, 0.3], [4.78, 0.3]]) {
      walls.push(box(2.85, height, 4.7, x, y, 0));
    }
    walls.push(box(0.22, 3.86, 4.7, side * 1.52, 2.99, 0));
    for (const z of [-2.135, 2.135]) walls.push(box(0.22, 3.86, 0.43, side * 4.19, 2.99, z));
    for (const z of [-0.67, 0.67]) walls.push(box(0.22, 3.86, 0.18, side * 4.19, 2.99, z));
    // Solid rear walls and service recesses give the building a distinct back.
    walls.push(box(2.85, 3.86, 0.22, x, 2.99, -2.24));
    for (const [y, height] of [[2.195, 1.39], [3.91, 1.44]]) {
      windows.push(box(2.41, height, 0.08, x, y, 2.28));
      backing.push(box(2.41, height, 0.06, x, y, 2.19));
      for (const offset of [-0.81, 0, 0.81]) frames.push(box(0.045, height, 0.13, x + offset, y, 2.32));
      // Side windows occupy real openings between structural piers.
      for (const z of [-1.34, 0, 1.34]) {
        windows.push(box(0.08, height, 1.16, side * 4.315, y, z));
        backing.push(box(0.06, height, 1.16, side * 4.25, y, z));
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
    for (let panel = 0; panel < 3; panel++) {
      solar.push(new BoxGeometry(1.27, 0.07, 0.76).rotateX(-0.1).translate(side * 2.69, 5.15, -1.11 + panel * 0.89));
      frames.push(box(1.33, 0.045, 0.035, side * 2.69, 5.235, -1.49 + panel * 0.89));
      frames.push(box(0.025, 0.055, 0.75, side * 2.69, 5.18, -1.11 + panel * 0.89));
    }
  }

  // The atrium has a solid rear service core, glazed front and enclosed sides.
  service.push(box(2.9, 3.9, 0.44, 0, 3.01, -2.12));
  walls.push(box(0.16, 3.9, 0.24, -1.45, 3.01, 2.32), box(0.16, 3.9, 0.24, 1.45, 3.01, 2.32));
  const atrium = combine([
    box(2.72, 1.71, 0.08, 0, 4.105, 2.35),
    box(0.37, 2.1, 0.08, -1.165, 2.11, 2.35),
    box(0.37, 2.1, 0.08, 1.165, 2.11, 2.35),
    box(0.08, 3.9, 4.31, -1.4, 3.01, 0.095),
    box(0.08, 3.9, 4.31, 1.4, 3.01, 0.095),
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
  const floors = [box(8.82, 0.22, 4.81, 0, 0.91, 0), box(8.6, 0.14, 4.7, 0, 1.06, 0), box(2.85, 0.15, 4.28, -2.875, 3.135, 0), box(2.85, 0.15, 4.28, 2.875, 3.135, 0), box(2.7, 0.15, 0.72, 0, 3.135, -1.62)];
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
    roundedBox(3.02, 0.23, 4.94, 0.07).translate(0, 5.075, 0),
    box(0.28, 0.14, 0.72, -0.98, 5.26, -0.54),
    box(0.28, 0.14, 0.72, 0.98, 5.26, -0.54),
  ]);
  const entry = combine([
    roundedBox(2.5, 0.12, 0.5, 0.04).translate(0, 1.025, 2.51),
    box(2.23, 0.11, 0.68, 0, 3.275, 2.57),
  ]);
  return {
    walls: combine(walls), frames: combine(frames), windows: combine(windows), backing: combine(backing),
    service: combine(service), planting: combine(planting), solar: combine(solar), hardware: combine(hardware),
    floors: combine(floors), roof, atrium, doors, entry,
  };
}

export function ComputeBuilding(props: ModelProps) {
  const geometry = useResources(makeComputeBuilding);
  const materials = usePalette(props, 'work');
  return <group name="work-compute-building" dispose={null}>
    <mesh name="work-exterior-walls" geometry={geometry.walls} material={materials.porcelain} castShadow receiveShadow />
    <mesh name="work-roof" geometry={geometry.roof} material={materials.porcelain} castShadow receiveShadow />
    <mesh name="work-entry-threshold-and-lintel" geometry={geometry.entry} material={materials.porcelain} castShadow receiveShadow />
    <mesh name="work-floors-and-atrium-stair" geometry={geometry.floors} material={materials.paving} receiveShadow />
    <mesh name="work-window-frames" geometry={geometry.frames} material={materials.edge} castShadow receiveShadow />
    <mesh name="work-window-recesses" geometry={geometry.backing} material={materials.windowBacking} />
    <mesh name="work-wing-windows" geometry={geometry.windows} material={materials.glass} />
    <mesh name="work-atrium-glazing" geometry={geometry.atrium} material={materials.glass} />
    <mesh name="work-entry-doors" geometry={geometry.doors} material={materials.glass} />
    <mesh name="work-entry-handles" geometry={geometry.hardware} material={materials.navy} />
    <mesh name="work-rear-service-core" geometry={geometry.service} material={materials.navy} castShadow receiveShadow />
    <mesh name="work-roof-gardens" geometry={geometry.planting} material={materials.green} receiveShadow />
    <mesh name="work-solar-panels" geometry={geometry.solar} material={materials.navy} receiveShadow />
  </group>;
}
