'use client';

import { useEffect, useRef, useState } from 'react';
import { DoubleSide, ExtrudeGeometry, Group, InstancedMesh, MeshPhysicalMaterial, Object3D, Shape, TorusGeometry, Vector3, type BufferGeometry } from 'three';
import { combine, roundedBox, stroke, usePalette, useResources, type ModelProps } from './BuildingKit';
import { createFacadeGarden } from './FacadeGarden';
import { floraGeometry, type FloraKind } from './Flora';
import { circulationPaths } from './circulation';
import { distanceToSegment, seededRandom, terrainHeight } from './terrain';
import { world } from '../../content/world';
import { FurnishedInterior, InteriorBuilder, floorRectangle, floorSlab } from './InteriorKit';
import { architecturalSurface as surface, architecturalBox as box, doorway, guardRail, stairFlight, windowBay, type ShellParts } from './LandmarkShellKit';

function createExperienceInterior() {
  const b = new InteriorBuilder(); const floor = 1.075;
  b.floor('experience-studio-floor', [floorRectangle(0, 0, 7.84, 5.56)], floor, .025);
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

export function makeExperienceStudio() {
  const parts: ShellParts = { walls: [], glass: [], frames: [] };
  const bottom = 1.075, top = 4.6;
  for (const x of [-2.66, 2.66]) windowBay(parts, x, 2.88, 2.72, bottom, top, 0, .26);
  doorway(parts, 0, 2.88, 2.28, bottom, top);
  for (const side of [-1, 1]) for (const z of [-1.44, 1.44]) windowBay(parts, side * 4.02, z, 2.88, bottom, top, Math.PI / 2, .3);
  for (const x of [-2.68, 0, 2.68]) windowBay(parts, x, -2.88, 2.68, bottom, top, 0, .6);
  // One folded shell carries both wings to a connected valley gutter. Its soffit is exposed.
  const roofPoint = (u: number, v: number) => {
    const x = (u - .5) * 8.75;
    return new Vector3(x, 4.8 + .63 * Math.pow(Math.abs(x) / 4.375, 1.3), (v - .5) * 6.30);
  };
  const roof = surface(roofPoint, 40, 8, .17);
  const ribs: BufferGeometry[] = [], clerestory: BufferGeometry[] = [];
  for (const z of [-2.86, -1.42, 0, 1.42, 2.86]) {
    ribs.push(stroke(t => { const point = roofPoint(t, .5 + z / 6.30); point.y -= .18; return point; }, .065, 32));
    for (const x of [-3.95, 3.95]) ribs.push(box(.13, 4.8 + .63 * Math.pow(Math.abs(x) / 4.375, 1.3) - .17 - bottom, .13, x, (4.8 + .63 * Math.pow(Math.abs(x) / 4.375, 1.3) - .17 + bottom) / 2, z));
  }
  for (const z of [-2.88, 2.88]) clerestory.push(surface((u, v) => {
    const x = (u - .5) * 8.04, roofHeight = 4.8 + .63 * Math.pow(Math.abs(x) / 4.375, 1.3) - .18;
    return new Vector3(x, 4.59 + v * (roofHeight - 4.59), z);
  }, 32, 1, .035));
  for (const x of [-4.02, 4.02]) clerestory.push(box(.04, .59, 5.76, x, 4.875, 0));
  const shades: BufferGeometry[] = [];
  for (const x of [-3.67, -2.83, -1.99, 1.99, 2.83, 3.67]) shades.push(box(.055, 2.78, .36, x, 2.63, 3.01));
  const canopy = combine([roundedBox(3.05, .14, 1.32, .08).translate(0, 3.65, 3.35), box(.075, 2.59, .075, -1.42, 2.37, 3.85), box(.075, 2.59, .075, 1.42, 2.37, 3.85), box(.22, .32, .22, -1.42, .92, 3.85), box(.22, .32, .22, 1.42, .92, 3.85)]);
  return {
    base: floorSlab('experience-foundation', [floorRectangle(0, 0, 8.45, 6.12)], 1.01, .21, 'foundation'),
    walls: combine(parts.walls), windows: combine(parts.glass), frames: combine(parts.frames), roof,
    ribs: combine(ribs), clerestory: combine(clerestory), shades: combine(shades), canopy,
    gutter: stroke(t => new Vector3(0, 4.78, -3.22 + t * 6.44), .085, 2),
    threshold: floorSlab('experience-threshold', [floorRectangle(0, 3.075, 2.3, .63)], 1.08, .23, 'threshold'),
  };
}

export function ExperienceStudio(props: ModelProps) {
  const material = usePalette(props, 'experience');
  const geometry = useResources(makeExperienceStudio);
  return <group dispose={null}>
    <mesh name="experience-foundation" geometry={geometry.base} material={material.paving} receiveShadow />
    <mesh name="experience-opaque-structural-shell" geometry={geometry.walls} material={material.porcelain} castShadow receiveShadow />
    <mesh name="experience-window-openings" geometry={geometry.windows} material={material.facade} />
    <mesh name="experience-window-frames" geometry={geometry.frames} material={material.navy} castShadow />
    <mesh name="experience-continuous-folded-roof" geometry={geometry.roof} material={material.cyan} castShadow receiveShadow />
    <mesh name="experience-roof-bearing-portals" geometry={geometry.ribs} material={material.edge} castShadow />
    <mesh name="experience-roof-clerestory" geometry={geometry.clerestory} material={material.glass} />
    <mesh name="experience-vertical-sunshades" geometry={geometry.shades} material={material.edge} castShadow />
    <mesh name="experience-supported-entry-canopy" geometry={geometry.canopy} material={material.porcelain} castShadow />
    <mesh name="experience-valley-gutter" geometry={geometry.gutter} material={material.navy} />
    <mesh name="experience-door-threshold" geometry={geometry.threshold} material={material.paving} receiveShadow />
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
  // Framed gallery panels and picture lights sit against the solid rear wall.
  for (const x of [-3.8, -2.1, 2.1, 3.8]) {
    b.box('metal', 1.12, 1.25, .075, x, 5.06, -3.39);
    b.box('paper', .98, 1.11, .025, x, 5.06, -3.34);
    b.box('screen', .67, .56, .028, x, 5.13, -3.32);
    b.box('metal', .8, .055, .18, x, 5.75, -3.22);
    b.box('light', .67, .025, .12, x, 5.715, -3.22);
  }
  return b.finish();
}

export function createHistoryFlowerBorder(material: MeshPhysicalMaterial) {
  const root = new Group(); root.name = 'history-grounded-flower-border';
  const random = seededRandom(1977), transform = new Object3D();
  const landmark = world.landmarks.find(item => item.id === 'history')!;
  const heading = landmark.rotationY ?? 0;
  const paths = circulationPaths().filter(path => path.id?.startsWith('history-'));
  const borderSites: Array<[number, number]> = [
    ...[-4.4, -3.7, -3, -2.3, -1.6, -.9, -.2, .5, 1.2, 1.9, 2.6, 3.3, 4].map(x => [x, -4.36] as [number, number]),
    ...[-2.8, -1.9, -1, -.1, .8, 1.7, 2.5].flatMap(z => [[-6.08, z], [6.08, z]] as Array<[number, number]>),
  ];
  const entries: Record<FloraKind, Array<{ x: number; y: number; z: number; scale: number; rotation: number }>> = {
    reeds: [], beach: [], shrub: [], flower: [], broadleaf: [], sedge: [], clover: [], fern: [], foxglove: [], bluebell: [], poppy: [], allium: [],
  };
  for (const [localX, localZ] of borderSites) {
    const x = landmark.position[0] + localX * Math.cos(heading) + localZ * Math.sin(heading);
    const z = landmark.position[2] - localX * Math.sin(heading) + localZ * Math.cos(heading);
    if (paths.some(path => path.points.slice(1).some((point, i) => distanceToSegment(x, z, path.points[i], point) < path.width / 2 + .45))) continue;
    const kind: FloraKind = random() < .76 ? (['flower','foxglove','bluebell','poppy','allium'] as const)[Math.floor(random()*5)] : random() < .5 ? 'fern' : 'clover';
    entries[kind].push({ x: localX, y: terrainHeight(x, z) - .02, z: localZ,
      scale: .48 + random() * .22, rotation: random() * Math.PI * 2 });
  }
  const batches = (['flower', 'foxglove', 'bluebell', 'poppy', 'allium', 'fern', 'clover'] as const).map(kind => {
    const geometry = floraGeometry(kind), mesh = new InstancedMesh(geometry, material, entries[kind].length);
    mesh.name = `history-border-${kind}`; mesh.castShadow = true; mesh.raycast = () => {};
    entries[kind].forEach((site, index) => {
      transform.position.set(site.x, site.y, site.z); transform.rotation.set(0, site.rotation, 0);
      transform.scale.setScalar(site.scale); transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.computeBoundingSphere(); root.add(mesh); return mesh;
  });
  return { root, entries, dispose() { batches.forEach(mesh => { mesh.geometry.dispose(); mesh.dispose(); }); } };
}

export function HistoryFlowerBorder() {
  const [material] = useState(() => new MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, side: DoubleSide, roughness: .93, metalness: 0, envMapIntensity: .12 }));
  const [border] = useState(() => createHistoryFlowerBorder(material));
  const disposal = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const landmark = world.landmarks.find(item => item.id === 'history')!;
  useEffect(() => {
    clearTimeout(disposal.current);
    return () => { disposal.current = setTimeout(() => { border.dispose(); material.dispose(); }, 0); };
  }, [border, material]);
  return <group position={[landmark.position[0], 0, landmark.position[2]]} rotation-y={landmark.rotationY ?? 0} dispose={null}>
    <primitive object={border.root} />
  </group>;
}

export function makeHistoryMuseum() {
  const parts: ShellParts = { walls: [], glass: [], frames: [] };
  const floor = 1.075, ceiling = 5.8, upper = 4.3;
  for (const x of [-3.62, 3.62]) windowBay(parts, x, 3.54, 3.33, floor, ceiling, 0, .32);
  doorway(parts, 0, 3.54, 3.56, floor, ceiling);
  for (const side of [-1, 1]) for (const z of [-2.34, 0, 2.34]) windowBay(parts, side * 5.3, z, 2.34, floor, ceiling, Math.PI / 2, .62);
  parts.walls.push(box(10.72, 4.725, .22, 0, 3.4375, -3.55));
  // The shell closes continuously at both arch-shaped gables, with a structural rib at every bay.
  const archHeight = (x: number) => 5.84 + 1.42 * Math.cos(x / 11.25 * Math.PI);
  const roof = surface((u, v) => { const x = (u - .5) * 11.25; return new Vector3(x, archHeight(x), (v - .5) * 7.75); }, 48, 10, .16);
  const gable = new Shape(); gable.moveTo(-5.29, 5.76);
  for (let i = 0; i <= 48; i++) { const x = -5.29 + i / 48 * 10.58; gable.lineTo(x, archHeight(x) - .17); }
  gable.lineTo(5.29, 5.76); gable.closePath();
  const gables = combine([-3.55, 3.54].map(z => new ExtrudeGeometry(gable, { depth: .045, bevelEnabled: false }).translate(0, 0, z)));
  const ribs: BufferGeometry[] = [];
  for (const z of [-3.54, -1.77, 0, 1.77, 3.54]) {
    ribs.push(stroke(t => { const x = (t - .5) * 10.61; return new Vector3(x, archHeight(x) - .19, z); }, .075, 40));
    for (const x of [-5.21, 5.21]) ribs.push(box(.15, 4.85, .15, x, 3.5, z));
  }
  const stair = stairFlight(0, 1.73, 1.38, floor, upper, 17, .24);
  const gallery = floorSlab('history-upper-gallery-floor', [floorRectangle(-4.42, 0, 1.49, 6.72), floorRectangle(4.42, 0, 1.49, 6.72), floorRectangle(0, -2.69, 8.84, 1.34)], upper, .17);
  const rails = combine([stair.rails, guardRail(-3.68, 3.22, -3.68, -2.02, upper), guardRail(3.68, 3.22, 3.68, -2.02, upper), guardRail(-3.68, -2.02, -.73, -2.02, upper), guardRail(.73, -2.02, 3.68, -2.02, upper)]);
  const cases: BufferGeometry[] = [], caseGlass: BufferGeometry[] = [];
  for (const x of [-4.38, 4.38]) for (const z of [-.8, 1.42]) {
    cases.push(box(.8, .55, .75, x, upper + .275, z), box(.82, .055, .77, x, upper + .56, z));
    caseGlass.push(box(.72, .6, .66, x, upper + .89, z));
  }
  const details: BufferGeometry[] = [], exhibits: BufferGeometry[] = [], exhibitFrames: BufferGeometry[] = [];
  // Barrel-roof standing seams terminate in continuous eave gutters and downpipes.
  for (const z of [-3.71, -2.48, -1.24, 0, 1.24, 2.48, 3.71]) details.push(stroke(t => {
    const x = (t - .5) * 11.25; return new Vector3(x, archHeight(x) + .025, z);
  }, .018, 32));
  for (const side of [-1, 1]) {
    details.push(box(.14, .12, 7.75, side * 5.52, 5.88, 0));
    details.push(stroke(t => new Vector3(side * 5.43, 1.15 + t * 4.72, -3.64), .046, 2));
    for (const y of [1.4, 3.3, 5.4]) details.push(box(.16, .05, .16, side * 5.43, y, -3.64));
    // Sill flashings and facade joints follow actual structural bays.
    for (const z of [-2.34, 0, 2.34]) {
      details.push(box(.18, .065, 2.1, side * 5.31, 1.7, z));
    }
    for (const y of [2.8, 4.28]) details.push(box(.035, .045, 7.0, side * 5.415, y, 0));
    details.push(box(.035, .43, .045, side * .25, 2.13, 3.675));
  }
  for (const x of [-4.38, 4.38]) for (const z of [-.8, 1.42]) {
    exhibits.push(new TorusGeometry(.19, .055, 6, 16).rotateY(x < 0 ? .35 : -.35).translate(x, upper + .88, z));
    exhibits.push(box(.045, .24, .045, x, upper + .69, z));
    exhibitFrames.push(box(.43, .03, .4, x, upper + .58, z));
    for (const side of [-1, 1]) exhibitFrames.push(box(.018, .62, .66, x + side * .36, upper + .88, z));
    exhibitFrames.push(box(.74, .02, .68, x, upper + 1.19, z));
  }
  const planting: BufferGeometry[] = [], plantingWood: BufferGeometry[] = [], plantingBeds: BufferGeometry[] = [];
  for (const side of [-1, 1]) for (const z of [-2.95, 2.9]) {
    const garden = createFacadeGarden({ width: .64, height: 4.45, seed: side + Math.round(z) + 9 });
    for (const [part, geometry] of Object.entries(garden)) {
      geometry.rotateY(side * Math.PI / 2).translate(side * 5.27, 1.01, z);
      (part === 'planter' ? plantingBeds : part === 'wood' || part === 'trellis' ? plantingWood : planting).push(geometry);
    }
  }
  return {
    details: combine(details), exhibits: combine(exhibits), exhibitFrames: combine(exhibitFrames),
    planting: combine(planting), plantingWood: combine(plantingWood), plantingBeds: combine(plantingBeds),
    base: floorSlab('history-foundation', [floorRectangle(0, 0, 11.2, 7.7)], 1.01, .21, 'foundation'),
    walls: combine(parts.walls), windows: combine(parts.glass), frames: combine(parts.frames), roof, gables, ribs: combine(ribs), gallery, steps: stair.steps, rails,
    cases: combine(cases), caseGlass: combine(caseGlass),
    threshold: floorSlab('history-threshold', [floorRectangle(0, 3.82, 3.58, .7)], 1.08, .23, 'threshold'),
    canopy: combine([box(4.1, .15, 1.17, 0, 3.71, 3.95), box(.1, 2.61, .1, -1.96, 2.38, 4.42), box(.1, 2.61, .1, 1.96, 2.38, 4.42), box(.26, .32, .26, -1.96, .92, 4.42), box(.26, .32, .26, 1.96, .92, 4.42)]),
  };
}

export function HistoryMuseum(props: ModelProps) {
  const material = usePalette(props, 'history');
  const geometry = useResources(makeHistoryMuseum);
  const [gardenMaterial] = useState(() => new MeshPhysicalMaterial({ name: 'history-grape-foliage', color: '#ffffff', vertexColors: true, side: DoubleSide, roughness: .93, metalness: 0, envMapIntensity: .12 }));
  const gardenDisposal = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(gardenDisposal.current);
    return () => { gardenDisposal.current = setTimeout(() => { gardenMaterial.dispose(); }, 0); };
  }, [gardenMaterial]);
  return <group dispose={null}>
    <mesh name="history-museum-foundation" geometry={geometry.base} material={material.paving} receiveShadow />
    <mesh name="history-museum-opaque-shell" geometry={geometry.walls} material={material.porcelain} castShadow receiveShadow />
    <mesh name="history-gallery-window-openings" geometry={geometry.windows} material={material.facade} />
    <mesh name="history-window-frames" geometry={geometry.frames} material={material.navy} castShadow />
    <mesh name="history-vaulted-roof" geometry={geometry.roof} material={material.porcelain} castShadow receiveShadow />
    <mesh name="history-glazed-arch-gables" geometry={geometry.gables} material={material.glass} />
    <mesh name="history-vault-bearing-ribs" geometry={geometry.ribs} material={material.edge} castShadow />
    <mesh name="history-entry-threshold" geometry={geometry.threshold} material={material.paving} receiveShadow />
    <mesh name="history-supported-entry-canopy" geometry={geometry.canopy} material={material.cyan} castShadow />
    <mesh name="history-visible-staircase" geometry={geometry.steps} material={material.paving} castShadow receiveShadow />
    <mesh name="history-gallery-and-stair-rails" geometry={geometry.rails} material={material.edge} castShadow />
    <mesh name="history-continuous-upper-gallery" geometry={geometry.gallery} material={material.paving} receiveShadow />
    <mesh name="history-upper-exhibit-plinths" geometry={geometry.cases} material={material.porcelain} castShadow />
    <mesh name="history-exhibit-vitrines" geometry={geometry.caseGlass} material={material.glass} />
    <mesh name="history-seams-gutters-and-hardware" geometry={geometry.details} material={material.navy} castShadow />
    <mesh name="history-gallery-artifacts" geometry={geometry.exhibits} material={material.gold} castShadow />
    <mesh name="history-vitrine-frames" geometry={geometry.exhibitFrames} material={material.edge} />
    <mesh name="history-climbing-side-gardens" geometry={geometry.planting} material={gardenMaterial} castShadow />
    <mesh name="history-attached-garden-trellises" geometry={geometry.plantingWood} material={material.navy} castShadow />
    <mesh name="history-floor-supported-planters" geometry={geometry.plantingBeds} material={material.paving} castShadow receiveShadow />
    <FurnishedInterior name="history-visible-galleries" build={createHistoryInterior} />
  </group>;
}
