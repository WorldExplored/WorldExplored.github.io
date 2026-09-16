'use client';

import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Path, Shape, SphereGeometry, type BufferGeometry } from 'three';
import { combine, roundedBox, usePalette, useResources, type ModelProps } from './BuildingKit';

const box = (width: number, height: number, depth: number, x: number, y: number, z: number) => new BoxGeometry(width, height, depth).translate(x, y, z);

function ring(radius: number, thickness: number, height: number, y: number) {
  const outline = new Shape();
  outline.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const opening = new Path();
  opening.absarc(0, 0, radius - thickness, 0, Math.PI * 2, true);
  outline.holes.push(opening);
  return new ExtrudeGeometry(outline, { depth: height, bevelEnabled: false, curveSegments: 32 }).rotateX(-Math.PI / 2).translate(1.58, y, -0.73);
}

/** A single-storey laboratory, glazed growing room and enclosed observatory. */
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
      walls.push(box(0.16, 0.62, 3.51, x, 1.37, -0.015), box(0.16, 0.32, 3.51, x, 2.52, -0.015));
      panes.push(box(0.055, 0.68, 3.35, x, 2.02, -0.015));
      for (const z of [-1.69, -0.85, 0, 0.85, 1.66]) frames.push(box(0.19, 0.71, 0.065, x, 2.02, z));
      for (const y of [1.68, 2.36]) frames.push(box(0.2, 0.065, 3.51, x, y, -0.015));
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
      walls.push(box(0.12, 0.22, 1.5, x, 1.17, greenhouseZ));
      panes.push(box(0.055, 1.1, 1.45, x, 1.83, greenhouseZ));
      frames.push(box(0.13, 0.085, 1.62, x, 2.4, greenhouseZ), box(0.08, 1.36, 0.065, x, 1.75, greenhouseZ));
    }
    panes.push(box(2.15, 0.075, 1.5, greenhouseX, 2.4, greenhouseZ));
    for (const x of [1.14, 1.68, 2.22]) frames.push(box(0.055, 0.08, 1.53, x, 2.425, greenhouseZ));
    // Closed drum, glazed clerestory and closed hemispherical roof share the same centre.
    walls.push(ring(1.07, 0.16, 1.45, 1.06));
    panes.push(ring(1.065, 0.055, 0.46, 2.51));
    for (let index = 0; index < 12; index++) {
      const angle = index / 12 * Math.PI * 2;
      frames.push(box(0.05, 0.46, 0.075, 0, 0, 0).rotateY(-angle).translate(1.58 + Math.sin(angle) * 1.045, 2.74, -0.73 + Math.cos(angle) * 1.045));
    }
    const plants: BufferGeometry[] = [];
    const planters: BufferGeometry[] = [];
    for (const [x, z, width] of [[-2.35, 1.80, 0.64], [-0.22, 1.80, 0.55], [1.06, 1.1, 0.45], [2.19, 1.1, 0.45]]) {
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
        new CylinderGeometry(1.115, 1.115, 0.15, 48).translate(1.58, 3.045, -0.73),
      ]),
      dome: new SphereGeometry(1.08, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2).translate(1.58, 3.12, -0.73),
      domeShutter: new SphereGeometry(1.089, 6, 20, Math.PI / 2 - 0.075, 0.15, 0.12, Math.PI / 2 - 0.12).translate(1.58, 3.12, -0.73),
      entry: combine([
        roundedBox(1.25, 0.12, 0.46, 0.04).translate(-1.33, 2.61, 1.74),
        box(1.13, 0.08, 0.28, -1.33, 1.03, 1.85),
        box(0.055, 0.24, 0.065, -1.23, 1.72, 1.765),
      ]),
      service: combine([
        box(0.045, 1.21, 0.62, -2.925, 1.665, -0.94),
        box(0.2, 0.27, 0.02, -2.22, 1.47, -1.782),
        box(0.92, 0.08, 0.38, -1.98, 1.58, -1.13),
        box(0.14, 0.5, 0.31, -2.28, 1.31, -1.13),
        box(0.14, 0.5, 0.31, -1.68, 1.31, -1.13),
      ]),
      planters: combine(planters),
      plants: combine(plants),
    };
  });
  return <group name="research-institute" dispose={null}>
    <mesh name="research-foundation" geometry={geometry.foundation} material={material.porcelain} receiveShadow />
    <mesh name="research-floor" geometry={geometry.floor} material={material.paving} receiveShadow />
    <mesh name="research-lab-walls" geometry={geometry.walls} material={material.porcelain} castShadow receiveShadow />
    <mesh name="research-lab-roof" geometry={geometry.roof} material={material.porcelain} castShadow receiveShadow />
    <mesh name="research-observatory-dome" geometry={geometry.dome} material={material.porcelain} castShadow />
    <mesh name="research-observatory-shutter" geometry={geometry.domeShutter} material={material.navy} />
    <mesh name="research-clerestory-and-growing-room" geometry={geometry.glazing} material={material.glass} />
    <mesh name="research-window-divisions" geometry={geometry.frames} material={material.edge} castShadow />
    <mesh name="research-entry" geometry={geometry.entry} material={material.edge} castShadow />
    <mesh name="research-service-and-lab-bench" geometry={geometry.service} material={material.navy} />
    <mesh name="research-planters" geometry={geometry.planters} material={material.porcelain} castShadow />
    <mesh name="research-planting" geometry={geometry.plants} material={material.green} castShadow />
  </group>;
}
