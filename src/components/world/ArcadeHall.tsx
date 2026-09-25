'use client';

import { CylinderGeometry, SphereGeometry, Vector3, type BufferGeometry } from 'three';
import { combine, roundedBox, stroke, usePalette, useResources, type ModelProps } from './BuildingKit';
import { floorRectangle, floorSlab, FurnishedInterior, InteriorBuilder } from './InteriorKit';
import { architecturalBox as box, doorway, windowBay, type ShellParts } from './LandmarkShellKit';

export function createArcadeHall() {
  const shell: ShellParts = { walls: [], glass: [], frames: [] };
  const floor = 1.075, ceiling = 3.95;
  doorway(shell, 0, 2.2, 1.25, floor, ceiling);
  for (const x of [-1.7, 1.7]) windowBay(shell, x, 2.2, 1.85, floor, ceiling, 0, .28);
  for (const side of [-1, 1]) for (const z of [-1.1, 1.1]) windowBay(shell, side * 2.63, z, 2.2, floor, ceiling, Math.PI / 2, .34);
  shell.walls.push(box(5.4, ceiling - floor, .16, 0, (ceiling + floor) / 2, -2.2));
  const ribs: BufferGeometry[] = [];
  for (const x of [-2.6, -1.3, 0, 1.3, 2.6]) ribs.push(stroke(t => new Vector3(x, 4.15, -2.45 + t * 4.9), .045, 20));
  return {
    base: floorSlab('arcade-foundation', [floorRectangle(0, 0, 5.6, 4.6)], 1.05, .25, 'foundation'),
    threshold: floorSlab('arcade-threshold', [floorRectangle(0, 2.42, 1.4, .6)], 1.08, .28, 'threshold'),
    walls: combine(shell.walls), glass: combine(shell.glass), frames: combine(shell.frames),
    roof: roundedBox(5.7, .19, 4.9, .26).translate(0, 4.03, 0), ribs: combine(ribs),
    fascia: roundedBox(3.5, .62, .18, .22).translate(0, 3.71, 2.38),
    sign: combine([
      // A joystick and four inset light keys make the arcade legible from the city paths.
      box(.045, .26, .07, -.9, 3.73, 2.5), new SphereGeometry(.09, 10, 8).translate(-.9, 3.91, 2.5),
      ...[-.36, .14, .64, 1.14].map((x, i) => roundedBox(.29, .24 + i % 2 * .09, .055, .065).translate(x, 3.72, 2.51)),
    ]),
    canopy: roundedBox(1.85, .11, .7, .16).translate(0, 3.24, 2.52),
  };
}

function createArcadeInterior() {
  const b = new InteriorBuilder(), floor = 1.075;
  b.floor('arcade-room-floor', [floorRectangle(0, 0, 5.08, 4.16)], floor, .025);
  // Four individually shaped cabinets: upright, sit-down, broad dual panel, and low cocktail.
  const cabinets = [
    { x: -1.91, z: -1.54, width: .65, height: 1.74, tilt: -.14 },
    { x: -.65, z: -1.52, width: .79, height: 1.5, tilt: -.23 },
    { x: .71, z: -1.5, width: .92, height: 1.76, tilt: -.1 },
    { x: 1.87, z: -.74, width: .66, height: 1.38, tilt: -.26 },
  ];
  for (const [index, c] of cabinets.entries()) {
    const h = c.height, body = index % 2 ? 'wood' : 'metal';
    b.box(body, c.width, h * .58, .53, c.x, floor + h * .29, c.z);
    b.box('metal', c.width + .025, .11, .7, c.x, floor + h * .53, c.z + .07);
    b.box('screen', c.width - .12, h * .31, .055, c.x, floor + h * .77, c.z - .08, c.tilt);
    for (const side of [-1, 1]) b.box(body, .075, h * .47, .55, c.x + side * (c.width / 2 - .038), floor + h * .77, c.z - .09);
    b.box('light', c.width - .08, .14, .04, c.x, floor + h - .06, c.z + .18);
    b.box('metal', .085, .15, .055, c.x + c.width * .21, floor + .44, c.z + .284);
    b.box('paper', .045, .018, .06, c.x + c.width * .21, floor + .47, c.z + .316);
    b.add('metal', new CylinderGeometry(.018, .018, .11, 8).translate(c.x - c.width * .22, floor + h * .53 + .1, c.z + .19));
    b.add('fabric', new SphereGeometry(.046, 10, 8).translate(c.x - c.width * .22, floor + h * .53 + .165, c.z + .19));
    for (let key = 0; key < 3; key++) b.add('light', new CylinderGeometry(.026, .026, .018, 10).translate(c.x + .015 + key * .065, floor + h * .53 + .07, c.z + .21));
    // Different tiny game mosaics sit proud of each screen, never co-planar.
    for (let pixel = 0; pixel < 9; pixel++) {
      const px = c.x + (pixel % 3 - 1) * (c.width - .24) / 3, py = floor + h * .68 + Math.floor(pixel / 3) * .1;
      if ((pixel + index) % 4) b.box(index % 2 ? 'fabric' : 'light', .055 + index * .006, .05, .016, px, py, c.z - .042);
    }
  }
  b.box('fabric', .82, .06, 1.35, -1.92, floor + .032, .53);
  b.box('wood', .58, .49, .56, -1.96, floor + .245, .67);
  b.box('screen', .64, .07, .68, -1.96, floor + .52, .67);
  b.chair(-1.93, floor, 1.37, Math.PI);
  b.box('fabric', 1.25, .18, .53, 1.32, floor + .38, 1.35);
  b.box('fabric', 1.25, .4, .13, 1.32, floor + .6, 1.57);
  for (const x of [.74, 1.9]) b.box('wood', .065, .3, .43, x, floor + .15, 1.35);
  b.table(.63, floor, .45, .58, .48, .49);
  b.plant(2.11, floor, 1.72, .8);
  for (const x of [-1.4, 1.4]) b.lamp(x, 3.79, -.1, .8);
  for (const z of [-1.78, -.89, 0, .89, 1.78]) b.box('metal', .028, .02, .045, -2.51, floor + .025, z);
  return b.finish();
}

export function ArcadeHall(props: ModelProps) {
  const geometry = useResources(createArcadeHall), material = usePalette(props, 'arcade');
  return <group dispose={null}>
    <mesh geometry={geometry.base} material={material.paving} receiveShadow />
    <mesh geometry={geometry.threshold} material={material.paving} receiveShadow />
    <mesh geometry={geometry.walls} material={material.porcelain} castShadow receiveShadow />
    <mesh geometry={geometry.glass} material={material.facade} />
    <mesh geometry={geometry.frames} material={material.navy} castShadow />
    <mesh geometry={geometry.roof} material={material.cyan} castShadow receiveShadow />
    <mesh geometry={geometry.ribs} material={material.edge} castShadow />
    <mesh geometry={geometry.fascia} material={material.navy} castShadow />
    <mesh geometry={geometry.sign} material={material.green} />
    <mesh geometry={geometry.canopy} material={material.porcelain} castShadow />
    <FurnishedInterior name="arcade-games-room" build={createArcadeInterior} />
  </group>;
}
