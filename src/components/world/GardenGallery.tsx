'use client';

import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Shape, SphereGeometry, Vector3 } from 'three';
import { combine, platform, strut, surface, usePalette, useResources, type ModelProps } from './BuildingKit';

function box(width: number, height: number, depth: number, x: number, y: number, z: number) {
  return new BoxGeometry(width, height, depth).translate(x, y, z);
}

export function GardenGallery(props: ModelProps) {
  const material = usePalette(props, 'about');
  const geometry = useResources(() => {
    const outline = new Shape();
    outline.moveTo(-2.78, -1.9);
    outline.lineTo(-2.5, -2.25);
    outline.lineTo(2.5, -2.25);
    outline.lineTo(2.78, -1.9);
    outline.lineTo(2.78, 1.65);
    outline.quadraticCurveTo(2.78, 2.15, 2.28, 2.15);
    outline.lineTo(-2.28, 2.15);
    outline.quadraticCurveTo(-2.78, 2.15, -2.78, 1.65);
    outline.closePath();

    // The rear gallery and glazed western wing enclose two sides of an open court.
    const walls = [
      box(5.2, 0.62, 0.16, 0, 1.37, -2.08),
      box(5.2, 0.37, 0.16, 0, 3.095, -2.08),
      box(0.48, 1.23, 0.16, -2.36, 2.295, -2.08),
      box(0.48, 1.23, 0.16, 2.36, 2.295, -2.08),
      box(0.16, 2.22, 0.94, 2.52, 2.17, -1.69),
      box(0.16, 2.22, 0.94, -2.52, 2.17, -1.69),
      box(1.94, 0.47, 0.14, -0.2, 1.295, -1.29),
      box(0.93, 2.22, 0.14, 2.065, 2.17, -1.29),
      box(3.73, 0.4, 0.14, 0.665, 3.08, -1.29),
      box(0.14, 0.38, 2.79, -2.52, 1.25, 0.065),
      box(0.14, 0.38, 2.79, -1.38, 1.25, 0.065),
      box(0.14, 1.91, 0.16, -2.52, 2.015, 1.46),
      box(0.14, 1.91, 0.16, -1.38, 2.015, 1.46),
      box(1.28, 0.15, 0.16, -1.95, 2.945, 1.46),
    ];
    const glass: BufferGeometry[] = [
      box(4.24, 1.23, 0.06, 0, 2.295, -2.08),
      box(1.94, 1.36, 0.06, -0.2, 2.21, -1.29),
      box(0.06, 1.52, 2.65, -2.52, 2.2, 0.035),
      box(0.06, 1.52, 2.65, -1.38, 2.2, 0.035),
    ];
    const frames = [];
    for (const x of [-2.12, -1.06, 0, 1.06, 2.12]) frames.push(box(0.045, 1.28, 0.085, x, 2.295, -2.08));
    for (const z of [-1.25, -0.37, 0.51, 1.39]) {
      for (const x of [-2.52, -1.38]) frames.push(box(0.08, 1.56, 0.055, x, 2.2, z));
    }
    for (const x of [-1.17, -0.2, 0.77]) frames.push(box(0.045, 1.4, 0.085, x, 2.21, -1.29));

    // A shallow barrel roof meets the enclosed gallery at its rear edge.
    const roofPoint = (u: number, v: number) => new Vector3(-2.63 + u * 1.36, 3.01 + Math.sin(u * Math.PI) * 0.5, -1.38 + v * 2.98);
    const conservatoryRoof = surface(roofPoint, 24, 4, 0.06);
    const roofFrame = [];
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      for (let index = 0; index < 24; index++) roofFrame.push(strut(roofPoint(index / 24, v), roofPoint((index + 1) / 24, v), 0.038));
    }
    for (const u of [0, 0.5, 1]) roofFrame.push(strut(roofPoint(u, 0), roofPoint(u, 1), 0.043));
    const gable = new Shape();
    gable.moveTo(-2.63, 3.01);
    for (let index = 1; index <= 24; index++) {
      const point = roofPoint(index / 24, 0);
      gable.lineTo(point.x, point.y);
    }
    gable.closePath();
    for (const z of [-1.41, 1.46]) glass.push(new ExtrudeGeometry(gable, { depth: 0.06, bevelEnabled: false }).translate(0, 0, z));

    const doorFrames = [
      box(0.055, 1.81, 0.12, -2.43, 1.965, 1.51),
      box(0.055, 1.81, 0.12, -1.47, 1.965, 1.51),
      box(1.015, 0.055, 0.12, -1.95, 2.855, 1.51),
      box(0.055, 1.81, 0.12, 0.82, 1.965, -1.25),
      box(0.055, 1.81, 0.12, 1.57, 1.965, -1.25),
      box(0.805, 0.055, 0.12, 1.195, 2.855, -1.25),
      box(0.025, 0.3, 0.06, -1.61, 1.96, 1.58),
      box(0.025, 0.3, 0.06, 1.4, 1.96, -1.17),
    ];
    const doors = [box(0.9, 1.77, 0.06, -1.95, 1.945, 1.51), box(0.69, 1.77, 0.06, 1.195, 1.945, -1.25)];
    const furnishings: BufferGeometry[] = [
      box(0.43, 0.09, 1.1, 2.05, 1.49, 0.35),
      box(0.08, 0.5, 1.1, 2.25, 1.735, 0.35),
      box(0.14, 0.38, 0.12, 2.05, 1.25, -0.06),
      box(0.14, 0.38, 0.12, 2.05, 1.25, 0.76),
      box(0.67, 0.23, 0.73, 1.86, 1.175, 1.48),
    ];
    const plants: BufferGeometry[] = [box(0.58, 0.04, 0.64, 1.86, 1.31, 1.48)];
    for (let index = 0; index < 5; index++) {
      const angle = index * 2.4;
      plants.push(new SphereGeometry(0.16, 8, 5).scale(1, 1.3, 0.75).translate(1.86 + Math.sin(angle) * 0.19, 1.42 + index % 2 * 0.09, 1.48 + Math.cos(angle) * 0.2));
    }
    // A planter inside the conservatory makes its glazed enclosure legible.
    furnishings.push(new CylinderGeometry(0.2, 0.15, 0.28, 12).translate(-1.96, 1.2, -0.66));
    plants.push(new SphereGeometry(0.28, 10, 6).scale(0.85, 1.65, 0.85).translate(-1.96, 1.74, -0.66));

    return {
      foundation: combine([platform(outline), new CylinderGeometry(.48, .55, .46, 32).translate(0, 1.22, 0)]),
      floors: combine([box(5.2, 0.07, 0.94, 0, 1.025, -1.69), box(1.28, 0.07, 2.82, -1.95, 1.025, 0.08)]),
      walls: combine(walls),
      galleryRoof: combine([box(5.3, 0.14, 1.12, 0, 3.35, -1.66), box(5.34, 0.07, 0.1, 0, 3.27, -1.09)]),
      glass: combine(glass),
      frames: combine([...frames, ...roofFrame]),
      conservatoryRoof,
      doors: combine(doors),
      entrance: combine(doorFrames),
      thresholds: combine([box(1.14, 0.06, 0.4, -1.95, 1.03, 1.64), box(0.88, 0.04, 0.3, 1.195, 1.04, -1.14)]),
      furnishings: combine(furnishings),
      planting: combine(plants),
    };
  });
  return <group name="about-gallery-conservatory" dispose={null}>
    <mesh name="about-court-foundation" geometry={geometry.foundation} material={material.paving} receiveShadow />
    <mesh name="about-gallery-floors" geometry={geometry.floors} material={material.paving} receiveShadow />
    <mesh name="about-enclosing-walls" geometry={geometry.walls} material={material.porcelain} castShadow receiveShadow />
    <mesh name="about-gallery-roof" geometry={geometry.galleryRoof} material={material.porcelain} castShadow receiveShadow />
    <mesh name="about-glazed-walls" geometry={geometry.glass} material={material.glass} />
    <mesh name="about-conservatory-roof-frames" geometry={geometry.frames} material={material.edge} castShadow />
    <mesh name="about-barrel-glass-roof" geometry={geometry.conservatoryRoof} material={material.glass} />
    <mesh name="about-entrance-doors" geometry={geometry.doors} material={material.glass} />
    <mesh name="about-entrance-frames" geometry={geometry.entrance} material={material.navy} />
    <mesh name="about-entrance-thresholds" geometry={geometry.thresholds} material={material.edge} receiveShadow />
    <mesh name="about-court-bench-planters" geometry={geometry.furnishings} material={material.porcelain} castShadow receiveShadow />
    <mesh name="about-court-planting" geometry={geometry.planting} material={material.green} castShadow />
  </group>;
}
