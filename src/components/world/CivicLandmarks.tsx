'use client';

import { BoxGeometry, CylinderGeometry, SphereGeometry, Vector3, type BufferGeometry } from 'three';
import { combine, roundedBox, stroke, surface, usePalette, useResources, type ModelProps } from './BuildingKit';
import { FurnishedInterior, InteriorBuilder, floorRectangle, floorSlab } from './InteriorKit';

function createExperienceInterior() {
  const b = new InteriorBuilder(); const floor = 1.075;
  b.floor('experience-studio-floor', [floorRectangle(0, 0, 7.65, 5.28)], floor, .025);
  for (const x of [-2.15, 0, 2.15]) {
    b.table(x, floor, -.65, 1.35, .58, .7);
    b.monitor(x, floor + .7, -.73);
    b.chair(x, floor, .02, Math.PI);
  }
  b.shelf(-3.55, floor, -2.33, 1.15, 1.55, .25);
  b.box('screen', 2.2, 1.1, .035, 2.15, 2.03, -2.64);
  b.box('metal', 2.32, 1.2, .045, 2.15, 2.03, -2.68);
  for (const x of [-3.42, 3.42]) b.plant(x, floor, 2.15, 1.2);
  for (const x of [-2.3, 0, 2.3]) b.lamp(x, 4.55, 0, 1.1);
  return b.finish();
}

export function ExperienceStudio(props: ModelProps) {
  const material = usePalette(props, 'experience');
  const geometry = useResources(() => {
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, yaw = 0) => new BoxGeometry(w, h, d).rotateY(yaw).translate(x, y, z);
    const walls: BufferGeometry[] = [
      box(8.2, 3.65, .18, 0, 2.84, -2.88),
      box(.18, 3.65, 5.6, -4.02, 2.84, 0), box(.18, 3.65, 5.6, 4.02, 2.84, 0),
      box(1.22, 3.65, .18, -3.35, 2.84, 2.88), box(1.22, 3.65, .18, 3.35, 2.84, 2.88),
      box(.24, 3.65, .24, -1.22, 2.84, 2.83), box(.24, 3.65, .24, 1.22, 2.84, 2.83),
      box(2.2, .42, .18, 0, 4.46, 2.88),
    ];
    const windows: BufferGeometry[] = [];
    const frames: BufferGeometry[] = [];
    for (const x of [-2.28, 2.28]) {
      windows.push(box(1.78, 2.82, .045, x, 2.83, 2.93));
      for (const edge of [-.92, .92]) frames.push(box(.075, 3.02, .1, x + edge, 2.83, 2.95));
      frames.push(box(1.92, .075, .1, x, 1.33, 2.95), box(1.92, .075, .1, x, 4.33, 2.95));
    }
    for (const side of [-1, 1]) {
      windows.push(box(.045, 2.45, 1.65, side * 4.11, 2.72, .55));
      frames.push(box(.1, 2.65, .075, side * 4.12, 2.72, -.31), box(.1, 2.65, .075, side * 4.12, 2.72, 1.41));
    }
    const roof = combine([
      box(4.35, .2, 6.35, -2.05, 4.86, -.05, -.035),
      box(4.35, .2, 6.35, 2.05, 4.86, -.05, .035),
      box(1.3, .16, 2.05, 0, 5.18, -.7),
    ]);
    const planters: BufferGeometry[] = [];
    for (const x of [-2.85, -1.85, 1.85, 2.85]) {
      planters.push(box(.72, .34, 1.5, x, 5.08, -.5));
      for (const z of [-.95, -.5, -.05]) planters.push(new SphereGeometry(.27, 10, 7).scale(1.15, 1.45, .8).translate(x, 5.47, z));
    }
    const vine = combine([-1, 1].map(side => stroke(t => new Vector3(side * (3.85 - .35 * Math.sin(t * Math.PI * 2)), 1.25 + t * 3.25, -2.98 + .2 * Math.sin(t * Math.PI * 3)), .045, 32)));
    return {
      base: floorSlab('experience-foundation', [floorRectangle(0, 0, 8.45, 6.12)], 1.01, .21, 'foundation'),
      walls: combine(walls), windows: combine(windows), frames: combine(frames), roof,
      doors: combine([box(.58, 2.15, .05, -.31, 2.12, 2.98), box(.58, 2.15, .05, .31, 2.12, 2.98)]),
      threshold: floorSlab('experience-threshold', [floorRectangle(0, 3.1, 1.5, .58)], 1.08, .23, 'threshold'),
      planters: combine(planters), vine,
      canopy: roundedBox(3.25, .18, 1.25, .12).rotateX(-.06).translate(0, 4.02, 3.42),
    };
  });
  return <group dispose={null}>
    <mesh name="experience-foundation" geometry={geometry.base} material={material.paving} receiveShadow />
    <mesh name="experience-opaque-structural-shell" geometry={geometry.walls} material={material.porcelain} castShadow receiveShadow />
    <mesh name="experience-window-openings" geometry={geometry.windows} material={material.facade} />
    <mesh name="experience-window-frames" geometry={geometry.frames} material={material.edge} castShadow />
    <mesh name="experience-glass-entry" geometry={geometry.doors} material={material.glass} />
    <mesh name="experience-butterfly-roof" geometry={geometry.roof} material={material.cyan} castShadow receiveShadow />
    <mesh name="experience-entry-canopy" geometry={geometry.canopy} material={material.glass} />
    <mesh name="experience-door-threshold" geometry={geometry.threshold} material={material.paving} receiveShadow />
    <mesh name="experience-roof-garden" geometry={geometry.planters} material={material.green} castShadow />
    <mesh name="experience-wall-vines" geometry={geometry.vine} material={material.green} castShadow />
    <FurnishedInterior name="experience-visible-workshop" build={createExperienceInterior} />
  </group>;
}

function createHistoryInterior() {
  const b = new InteriorBuilder(); const floor = 1.075;
  b.floor('history-gallery-floor', [floorRectangle(0, 0, 10.55, 7.1)], floor, .025);
  for (const x of [-3.55, 3.55]) {
    b.shelf(x, floor, -2.95, 1.8, 1.5, .28);
    b.box('paper', 1.7, 1.05, .035, x, 2.1, -2.76);
    b.box('metal', 1.8, 1.15, .045, x, 2.1, -2.8);
  }
  for (const [x, z] of [[-3.6, 2.6], [3.6, 2.6], [-4.35, -.2], [4.35, -.2]] as const) b.plant(x, floor, z, 1.25);
  b.table(-2.6, floor, .65, 1.4, .65, .7); b.table(2.6, floor, .65, 1.4, .65, .7);
  for (const x of [-2.95, -2.25, 2.25, 2.95]) b.chair(x, floor, 1.35, Math.PI);
  for (const x of [-3.2, 0, 3.2]) b.lamp(x, 5.7, -.8, 1.25);
  return b.finish();
}

export function HistoryMuseum(props: ModelProps) {
  const material = usePalette(props, 'history');
  const geometry = useResources(() => {
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, yaw = 0) => new BoxGeometry(w, h, d).rotateY(yaw).translate(x, y, z);
    const walls: BufferGeometry[] = [box(10.7, 4.75, .22, 0, 3.42, -3.55)];
    for (const side of [-1, 1]) {
      walls.push(box(.22, 4.75, 7.05, side * 5.3, 3.42, 0));
      walls.push(box(2.02, 4.75, .2, side * 4.22, 3.42, 3.54));
      walls.push(box(.24, 4.75, .24, side * 1.75, 3.42, 3.5));
    }
    const windows: BufferGeometry[] = [], frames: BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      windows.push(box(2.2, 3.8, .045, side * 2.92, 3.35, 3.65));
      frames.push(box(.08, 4, .11, side * 1.8, 3.35, 3.68), box(.08, 4, .11, side * 4.04, 3.35, 3.68));
      frames.push(box(2.32, .08, .11, side * 2.92, 1.37, 3.68), box(2.32, .08, .11, side * 2.92, 5.34, 3.68));
      for (const z of [-2.25, 0, 2.25]) windows.push(box(.045, 2.1, 1.55, side * 5.42, 3.25, z));
    }
    const atriumGlass = box(3.32, 4.18, .05, 0, 3.23, 3.65);
    const atriumFrame = combine([
      box(.09, 4.35, .12, -1.7, 3.23, 3.67), box(.09, 4.35, .12, 1.7, 3.23, 3.67),
      box(3.48, .09, .12, 0, 5.38, 3.67), box(.07, 4.18, .12, 0, 3.23, 3.67),
    ]);
    const roof = surface((u, v) => {
      const x = (u - .5) * 11.25; const z = (v - .5) * 7.75;
      return new Vector3(x, 5.64 + 1.16 * Math.cos(x / 11.25 * Math.PI), z);
    }, 56, 18, .12);
    const roofRibs: BufferGeometry[] = [];
    for (const z of [-3.55, -1.8, 0, 1.8, 3.55]) roofRibs.push(stroke(t => {
      const x = (t - .5) * 11.18;
      return new Vector3(x, 5.72 + 1.16 * Math.cos(x / 11.25 * Math.PI), z);
    }, .045, 48));
    for (const x of [-4.5, 0, 4.5]) roofRibs.push(stroke(t => new Vector3(x, 5.72 + 1.16 * Math.cos(x / 11.25 * Math.PI), (t - .5) * 7.55), .04, 28));
    const steps: BufferGeometry[] = [], rails: BufferGeometry[] = [];
    for (let index = 0; index < 13; index++) {
      const y = 1.12 + index * .255, z = 1.7 - index * .29;
      steps.push(box(1.28, .12, .48, 0, y, z));
    }
    for (const side of [-1, 1]) {
      rails.push(stroke(t => new Vector3(side * .72, 1.58 + t * 3.08, 1.9 - t * 3.48), .035, 32));
      for (let index = 0; index < 7; index++) rails.push(new CylinderGeometry(.025, .025, .8, 8).translate(side * .72, 1.34 + index * .5, 1.7 - index * .54));
    }
    const upperGallery = combine([
      box(3.9, .16, 1.2, -3.25, 4.22, 1.72), box(3.9, .16, 1.2, 3.25, 4.22, 1.72),
      box(10.3, .16, 1.1, 0, 4.22, -2.7),
    ]);
    const garden: BufferGeometry[] = [];
    for (const x of [-4.15, -2.8, 2.8, 4.15]) {
      garden.push(box(1.05, .38, 1.8, x, 6.15, -.35));
      for (const z of [-.85, -.35, .15]) garden.push(new SphereGeometry(.34, 10, 7).scale(1.3, 1.5, .9).translate(x, 6.62, z));
    }
    for (const x of [-4.6, 4.6]) garden.push(stroke(t => new Vector3(x + .22 * Math.sin(t * 12), 1.3 + t * 4.4, -3.68), .05, 40));
    return {
      base: floorSlab('history-foundation', [floorRectangle(0, 0, 11.2, 7.7)], 1.01, .21, 'foundation'),
      walls: combine(walls), windows: combine(windows), frames: combine(frames), atriumGlass, atriumFrame, roof, roofRibs: combine(roofRibs),
      doors: combine([box(.72, 2.3, .055, -.38, 2.19, 3.71), box(.72, 2.3, .055, .38, 2.19, 3.71)]),
      threshold: floorSlab('history-threshold', [floorRectangle(0, 3.82, 2, .7)], 1.08, .23, 'threshold'),
      steps: combine(steps), rails: combine(rails), upperGallery, garden: combine(garden),
    };
  });
  return <group dispose={null}>
    <mesh name="history-museum-foundation" geometry={geometry.base} material={material.paving} receiveShadow />
    <mesh name="history-museum-opaque-shell" geometry={geometry.walls} material={material.porcelain} castShadow receiveShadow />
    <mesh name="history-gallery-window-openings" geometry={geometry.windows} material={material.facade} />
    <mesh name="history-window-frames" geometry={geometry.frames} material={material.edge} castShadow />
    <mesh name="history-planted-atrium" geometry={geometry.atriumGlass} material={material.glass} />
    <mesh geometry={geometry.atriumFrame} material={material.edge} castShadow />
    <mesh name="history-curved-roof" geometry={geometry.roof} material={material.glass} receiveShadow />
    <mesh name="history-curved-roof-ribs" geometry={geometry.roofRibs} material={material.edge} castShadow />
    <mesh name="history-entry-doors" geometry={geometry.doors} material={material.glass} />
    <mesh name="history-entry-threshold" geometry={geometry.threshold} material={material.paving} receiveShadow />
    <mesh name="history-visible-staircase" geometry={geometry.steps} material={material.porcelain} castShadow receiveShadow />
    <mesh name="history-stair-rails" geometry={geometry.rails} material={material.edge} castShadow />
    <mesh name="history-upper-galleries" geometry={geometry.upperGallery} material={material.paving} receiveShadow />
    <mesh name="history-roof-garden-and-vines" geometry={geometry.garden} material={material.green} castShadow />
    <FurnishedInterior name="history-visible-galleries" build={createHistoryInterior} />
  </group>;
}
