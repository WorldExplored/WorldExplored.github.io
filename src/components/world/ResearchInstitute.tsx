'use client';

import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Path, Shape, SphereGeometry, type BufferGeometry } from 'three';
import { FurnishedInterior, InteriorBuilder } from './InteriorKit';
import { combine, roundedBox, usePalette, useResources, type ModelProps } from './BuildingKit';

const box = (width: number, height: number, depth: number, x: number, y: number, z: number) => new BoxGeometry(width, height, depth).translate(x, y, z);

function ring(radius: number, thickness: number, height: number, y: number, doorway = false) {
  const outline = new Shape();
  if (doorway) {
    outline.absarc(0, 0, radius, Math.PI + .43, Math.PI * 3 - .43, false);
    outline.absarc(0, 0, radius - thickness, Math.PI * 3 - .43, Math.PI + .43, true);
    outline.closePath();
    return new ExtrudeGeometry(outline, { depth: height, bevelEnabled: false, curveSegments: 32 }).rotateX(-Math.PI / 2).translate(1.58, y, -.73);
  }
  outline.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const opening = new Path();
  opening.absarc(0, 0, radius - thickness, 0, Math.PI * 2, true);
  outline.holes.push(opening);
  return new ExtrudeGeometry(outline, { depth: height, bevelEnabled: false, curveSegments: 32 }).rotateX(-Math.PI / 2).translate(1.58, y, -0.73);
}

/** A single-storey laboratory, glazed growing room and enclosed observatory. */
export function makeResearchInterior() {
  const room = new InteriorBuilder();
  room.box('wood', 2.97, .014, 3.12, -1.215, 1.067, -.015);
  // Window-side benches flank a clear central entrance aisle.
  room.table(-2.19, 1.077, .79, .72, 1.13, .59);
  room.box('paper', .3, .035, .38, -2.2, 1.712, .63);
  room.rod('metal', [-2.2, 1.73, .56], [-2.2, 1.99, .56], .026);
  room.rod('metal', [-2.2, 1.99, .56], [-2.08, 2.05, .72], .037);
  room.add('screen', new CylinderGeometry(.043, .043, .12, 10).rotateX(.6).translate(-2.07, 2.025, .72));
  for (let n = 0; n < 3; n++) {
    room.add('pipe', new CylinderGeometry(.055, .055, .19, 12).translate(-2.35 + n * .18, 1.79, 1.12));
    room.add('coolant', new CylinderGeometry(.04, .04, .11, 10).translate(-2.35 + n * .18, 1.755, 1.12));
  }
  room.table(-.22, 1.077, .96, .72, .45, .59); room.monitor(-.22, 1.71, .99, Math.PI); room.chair(-.22, 1.077, .45, 0, .85);
  room.table(-1.34, 1.077, -1.16, 1.12, .45, .61); room.chair(-1.34, 1.077, -.66, Math.PI, .85);
  room.box('paper', .32, .027, .23, -1.54, 1.718, -1.15);
  room.shelf(-2.27, 1.077, -1.28, .64, 1.1, .28);
  room.box('wood', .055, .72, .65, -.57, 1.437, -1.14);
  room.plant(-.18, 1.077, -1.42, .75);
  room.lamp(-1.6, 2.63, .3, 1.05);
  // Raised observation dais is connected to the lab by four shallow steps.
  room.add('wood', new CylinderGeometry(.58, .62, .1, 24).translate(1.67, 1.7, -.73));
  for (let n = 0; n < 4; n++) room.box('wood', .2, .15 * (n + 1), .61, .64 + n * .2, 1.06 + .075 * (n + 1), -.73);
  room.rod('metal', [1.2, 1.76, -.96], [1.7, 2.58, -.73], .032);
  room.rod('metal', [2.02, 1.76, -1.03], [1.7, 2.58, -.73], .032);
  room.rod('metal', [1.7, 1.76, -.28], [1.7, 2.58, -.73], .032);
  room.add('paper', new CylinderGeometry(.16, .19, .87, 16).rotateZ(-.9).translate(1.7, 2.91, -.73));
  room.add('screen', new CylinderGeometry(.145, .145, .035, 16).rotateZ(-.9).translate(2.05, 3.19, -.73));
  room.table(2.18, 1.067, -.73, .3, .44, .57); room.monitor(2.18, 1.68, -.73, -Math.PI / 2);
  room.lamp(1.6, 2.98, -1.48, .4);
  // Specimen tables sit along the glazing, leaving the greenhouse's center open.
  for (const z of [.61, 1.59]) {
    room.table(1.62, 1.067, z, 1.35, .28, .48);
    for (const x of [1.1, 1.6, 2.1]) room.plant(x, 1.58, z, .48);
  }
  return room.finish();
}

export function ResearchInstitute(props: ModelProps) {
  const material = usePalette(props, 'research');
  const geometry = useResources(() => {
    const walls: BufferGeometry[] = [];
    const panes: BufferGeometry[] = [];
    const frames: BufferGeometry[] = [];
    // Continuous wall bands surround real window openings; the entry interrupts the front band.
    for (const [left, right] of [[-2.83, -1.8], [-0.86, 0.4]]) {
      const width = right - left;
      const x = (left + right) / 2;
      walls.push(box(width, 0.62, 0.16, x, 1.37, 1.66), box(width, 0.32, 0.16, x, 2.52, 1.66));
      panes.push(box(width - 0.1, 0.68, 0.055, x, 2.02, 1.66));
      frames.push(box(width, 0.065, 0.2, x, 1.68, 1.66), box(width, 0.065, 0.2, x, 2.36, 1.66));
      for (const edge of [left + 0.045, x, right - 0.045]) frames.push(box(0.055, 0.71, 0.19, edge, 2.02, 1.66));
    }
    walls.push(box(3.23, 0.62, 0.16, -1.215, 1.37, -1.69), box(3.23, 0.32, 0.16, -1.215, 2.52, -1.69));
    panes.push(box(3.07, 0.68, 0.055, -1.215, 2.02, -1.69));
    for (const x of [-2.78, -2.0, -1.22, -0.44, 0.35]) frames.push(box(0.065, 0.71, 0.19, x, 2.02, -1.69));
    for (const y of [1.68, 2.36]) frames.push(box(3.23, 0.065, 0.2, -1.215, y, -1.69));
    for (const x of [-2.83, 0.4]) {
      if (x < 0) {
        walls.push(box(.16, .62, 3.51, x, 1.37, -.015));
        panes.push(box(.055, .68, 3.35, x, 2.02, -.015));
      } else {
        // Two genuine floor-level connections lead to the cupola and growing room.
        for (const [z, depth] of [[-1.52, .34], [.06, .4], [1.57, .18]]) walls.push(box(.16, 1.3, depth, x, 1.71, z));
      }
      walls.push(box(.16, .32, 3.51, x, 2.52, -.015));
      for (const z of (x < 0 ? [-1.69, -.85, 0, .85, 1.66] : [-1.69, -.26, .36, 1.66])) frames.push(box(0.19, 0.71, 0.065, x, 2.02, z));
      for (const y of (x < 0 ? [1.68, 2.36] : [2.36])) frames.push(box(0.2, 0.065, 3.51, x, y, -0.015));
    }
    // Door jambs run to the floor and carry a shallow weather hood.
    for (const x of [-1.8, -0.86]) walls.push(box(0.13, 1.62, 0.23, x, 1.87, 1.67));
    walls.push(box(1.07, 0.15, 0.23, -1.33, 2.605, 1.67));
    panes.push(box(0.81, 1.47, 0.065, -1.33, 1.815, 1.685));
    frames.push(box(0.05, 1.5, 0.09, -1.33, 1.82, 1.735));

    // The growing room is enclosed by thick glazing, a solid plinth and a glazed flat roof.
    const greenhouseX = 1.68;
    const greenhouseZ = 1.10;
    for (const z of [0.35, 1.85]) {
      walls.push(box(2.15, 0.22, 0.12, greenhouseX, 1.17, z));
      panes.push(box(2.07, 1.1, 0.055, greenhouseX, 1.83, z));
      for (const x of [0.605, 1.14, 1.68, 2.22, 2.755]) frames.push(box(0.065, 1.36, 0.095, x, 1.75, z));
      frames.push(box(2.22, 0.085, 0.13, greenhouseX, 2.4, z));
    }
    for (const x of [0.605, 2.755]) {
      if (x < 1) {
        for (const [z, depth] of [[.5, .3], [1.65, .4]]) {
          walls.push(box(.12, .22, depth, x, 1.17, z));
          panes.push(box(.055, 1.1, depth, x, 1.83, z));
        }
        panes.push(box(.055, .22, .8, x, 2.27, 1.05));
        walls.push(box(.205, 1.32, .06, .5025, 1.72, .65), box(.205, 1.32, .06, .5025, 1.72, 1.45), box(.205, .08, .86, .5025, 2.42, 1.05));
      }
      if (x > 1) {
        walls.push(box(.12, .22, 1.5, x, 1.17, greenhouseZ));
        panes.push(box(.055, 1.1, 1.45, x, 1.83, greenhouseZ));
      }
      frames.push(box(0.13, 0.085, 1.62, x, 2.4, greenhouseZ), box(0.08, 1.36, 0.065, x, 1.75, x > 1 ? greenhouseZ : .35));
    }
    panes.push(box(2.15, 0.075, 1.5, greenhouseX, 2.4, greenhouseZ));
    for (const x of [1.14, 1.68, 2.22]) frames.push(box(0.055, 0.08, 1.53, x, 2.425, greenhouseZ));
    // Closed drum, glazed clerestory and closed hemispherical roof share the same centre.
    walls.push(ring(1.07, .16, 1.3, 1.06, true), ring(1.07, .16, .15, 2.36));
    panes.push(ring(1.065, 0.055, 0.46, 2.51));
    for (let index = 0; index < 12; index++) {
      const angle = index / 12 * Math.PI * 2;
      frames.push(box(0.05, 0.46, 0.075, 0, 0, 0).rotateY(-angle).translate(1.58 + Math.sin(angle) * 1.045, 2.74, -0.73 + Math.cos(angle) * 1.045));
    }
    const plants: BufferGeometry[] = [];
    const planters: BufferGeometry[] = [];
    for (const [x, z, width] of [[-2.35, 1.80, 0.64], [-0.22, 1.80, 0.55], [2.48, 1.58, 0.3]]) {
      planters.push(roundedBox(width, 0.25, 0.28, 0.04).translate(x, 1.18, z));
      plants.push(new SphereGeometry(0.22, 10, 6).scale(width / 0.44, 0.65, 0.55).translate(x, 1.35, z));
    }
    return {
      foundation: box(5.98, 0.16, 4.0, 0, 0.91, 0),
      floor: box(5.76, 0.07, 3.82, 0, 1.025, 0),
      walls: combine(walls),
      glazing: combine(panes),
      frames: combine(frames),
      roof: combine([
        roundedBox(3.53, 0.18, 3.78, 0.06).translate(-1.215, 2.73, -0.015),
        box(3.19, 0.045, 3.36, -1.215, 2.8425, -0.015),
        ring(1.115, .095, .15, 2.97),
      ]),
      dome: new SphereGeometry(1.08, 40, 20, .32, Math.PI * 2 - .64, 0, Math.PI / 2).translate(1.58, 3.12, -0.73),
      domeShutter: new SphereGeometry(1.082, 8, 20, -.32, .64, 0, Math.PI / 2).translate(1.58, 3.12, -0.73),
      entry: combine([
        roundedBox(1.25, 0.12, 0.46, 0.04).translate(-1.33, 2.61, 1.74),
        box(1.13, 0.08, 0.28, -1.33, 1.03, 1.85),
        box(0.055, 0.24, 0.065, -1.23, 1.72, 1.765),
      ]),
      service: combine([
        box(0.045, 1.21, 0.62, -2.925, 1.665, -0.94),
        box(0.2, 0.27, 0.02, -2.22, 1.47, -1.782),
      ]),
      planters: combine(planters),
      plants: combine(plants),
    };
  });
  return <group name="research-institute" dispose={null}>
    <FurnishedInterior name="research-interior" build={makeResearchInterior} />
    <mesh name="research-foundation" geometry={geometry.foundation} material={material.porcelain} receiveShadow />
    <mesh name="research-floor" geometry={geometry.floor} material={material.paving} receiveShadow />
    <mesh name="research-lab-walls" geometry={geometry.walls} material={material.porcelain} castShadow receiveShadow />
    <mesh name="research-lab-roof" geometry={geometry.roof} material={material.porcelain} castShadow receiveShadow />
    <mesh name="research-observatory-dome" geometry={geometry.dome} material={material.porcelain} castShadow />
    <mesh name="research-observatory-shutter" geometry={geometry.domeShutter} material={material.glass} />
    <mesh name="research-clerestory-and-growing-room" geometry={geometry.glazing} material={material.glass} />
    <mesh name="research-window-divisions" geometry={geometry.frames} material={material.edge} castShadow />
    <mesh name="research-entry" geometry={geometry.entry} material={material.edge} castShadow />
    <mesh name="research-service-and-lab-bench" geometry={geometry.service} material={material.navy} />
    <mesh name="research-planters" geometry={geometry.planters} material={material.porcelain} castShadow />
    <mesh name="research-planting" geometry={geometry.plants} material={material.green} castShadow />
  </group>;
}
