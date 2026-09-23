'use client';

import { CylinderGeometry, PlaneGeometry, SphereGeometry, Vector3, type BufferGeometry } from 'three';
import { FurnishedInterior, InteriorBuilder, floorSlab, floorRectangle } from './InteriorKit';
import { combine, stroke, usePalette, useResources, type ModelProps } from './BuildingKit';
import { architecturalSurface as surface, architecturalBox as box, doorway, guardRail, stairFlight, windowBay, type ShellParts } from './LandmarkShellKit';

export const RESEARCH_BUILDING = { floor: 1.075, upper: 3.825, roof: 6.55, entrance: [-1.33, 1.07, 1.85] as const, bounds: [-3.8, 3.8, -3.6, 1.9] as const };

/** Two occupied laboratory levels flank a daylit stair and a planted upper terrace. */
export function makeResearchInterior() {
  const room = new InteriorBuilder();
  const floor = RESEARCH_BUILDING.floor;
  room.floor('research-lab-wood-floor', [floorRectangle(0, -.87, 7.1, 4.9)], floor, .016);
  for (const level of [floor, RESEARCH_BUILDING.upper]) {
    for (const z of [-2.52, -.85]) {
      room.table(-2.72, level, z, 1.15, .62, .72);
      room.monitor(-2.77, level + .78, z - .12);
      room.chair(-2.72, level, z + .55, Math.PI);
      for (let vial = 0; vial < 3; vial++) room.add('coolant', new CylinderGeometry(.043, .047, .15, 12).translate(-2.36 + vial * .13, level + .84, z + .15));
    }
    room.shelf(-2.72, level, -3.08, 1.1, 1.54, .26);
    room.box('screen', .85, .6, .035, -2.72, level + 1.3, -3.18);
    room.lamp(-2.1, level + 2.32, -.9, 1.7);
  }
  // Specimen benches face the full-height eastern glazing; the circulation aisle stays clear.
  room.table(2.57, floor, -1.32, .82, 1.7, .72);
  for (const z of [-1.85, -1.3, -.75]) room.plant(2.6, floor + .76, z, .55);
  room.table(2.9,RESEARCH_BUILDING.upper,-2.76,.95,.6,.7);
  room.monitor(2.9,RESEARCH_BUILDING.upper+.76,-2.82);
  room.chair(2.9,RESEARCH_BUILDING.upper,-2.10,Math.PI);
  room.plant(2.9, floor, .89, 1.2);
  room.plant(-3.04, floor, 1.14, .9);
  room.lamp(2.2, 3.52, -.9, 1.4);
  return room.finish();
}

export function makeResearchBuilding() {
  const parts: ShellParts = { walls: [], glass: [], frames: [] };
  const floor = RESEARCH_BUILDING.floor, upper = RESEARCH_BUILDING.upper;
  // Two continuous structural belts register the occupied levels. Every pane fills a real opening.
  for (const [bottom, top] of [[floor, 3.65], [upper, 6.4]]) {
    for (const x of [-2.48, 0, 2.48]) windowBay(parts, x, -3.4, 2.48, bottom, top);
    for (const x of [-3.68, 3.68]) for (const z of [-2.14, .4]) windowBay(parts, x, z, 2.54, bottom, top, Math.PI / 2, .4);
  }
  windowBay(parts, -2.94, 1.66, 1.48, floor, 3.65);
  doorway(parts, -1.33, 1.66, 1.42, floor, 3.65);
  windowBay(parts, .3375, 1.66, 1.595, floor, 3.65, 0, .22);
  windowBay(parts, 2.4075, 1.66, 2.545, floor, 3.65, 0, .22);
  // The second level steps back at the east, revealing a usable greenhouse terrace.
  for (const x of [-2.77, -.94]) windowBay(parts, x, 1.66, 1.82, upper, 6.4, 0, .32);
  // The terrace is reached through a genuine open door, not an unbroken glass wall.
  const portalX=2.12,portalWidth=1.1,portalTop=upper+2.18;
  windowBay(parts,1.2225,-1.18,.455,upper,6.4,0,.12);
  windowBay(parts,3.2275,-1.18,.875,upper,6.4,0,.12);
  for(const side of [-1,1])parts.walls.push(box(.12,6.4-upper,.2,portalX+side*(portalWidth/2+.06),(upper+6.4)/2,-1.18));
  parts.walls.push(box(portalWidth,6.4-portalTop,.2,portalX,(portalTop+6.4)/2,-1.18));
  parts.glass.push(new PlaneGeometry(1.02,2.1).rotateY(Math.PI/2).translate(portalX+portalWidth/2-.02,upper+1.07,-.68));
  for(const side of [-1,1])parts.frames.push(box(.035,2.18,.1,portalX+side*portalWidth/2,upper+1.09,-1.18));
  parts.frames.push(box(portalWidth,.055,.12,portalX,portalTop,-1.18));
  for (const z of [-.56, .84]) windowBay(parts, -.05, z, 1.4, upper, 6.4, Math.PI / 2, .1);
  const floors = [floorRectangle(-1.845, -.87, 3.39, 4.9), floorRectangle(2.54, -2.27, 1.98, 2.1), floorRectangle(.71,-2.973,1.72,.694)];
  const stair = stairFlight(.72,.86,1.12,floor,upper,15,.24);
  const terrace = floorSlab('research-accessible-terrace', [floorRectangle(2.54, .18, 1.98, 2.8)], upper, .18, 'balcony');
  const roof = combine([box(4.17, .2, 5.43, -1.72, 6.5, -.86), box(3.38, .2, 2.59, 2.11, 6.5, -2.22)]);
  const glassRoof = surface((u, v) => new Vector3(.25 + u * 3.56, 6.44, -1.25 + v * 3.05), 18, 4, .065);
  const pergola: BufferGeometry[] = [];
  for (const z of [-1.23, -.3, .63, 1.55]) pergola.push(stroke(t => new Vector3(.23 + t * 3.6, 6.46, z), .044, 2));
  for (const x of [.25, 2, 3.8]) pergola.push(box(.09, .1, 3.0, x, 6.46, .24));
  for (const x of [.3, 3.65]) for (const z of [-1.19, 1.54]) pergola.push(box(.11, 6.44 - upper, .11, x, (6.44 + upper) / 2, z));
  const planters: BufferGeometry[] = [], planting: BufferGeometry[] = [];
  for (const z of [-.5, .65]) {
    planters.push(box(.48, .38, .95, 3.22, upper + .19, z));
    for (let i = 0; i < 4; i++) planting.push(new SphereGeometry(.15, 10, 8).scale(.85, 1.6, 1.1).translate(3.22, upper + .48, z - .32 + i * .21));
  }
  return {
    foundation: floorSlab('research-foundation', [floorRectangle(0, -.87, 7.58, 5.36)], .99, .22, 'foundation'),
    floor: floorSlab('research-room-floors', [floorRectangle(0, -.87, 7.1, 4.9)], 1.059, .069),
    upper: floorSlab('research-upper-laboratories', floors, upper, .18), terrace,
    walls: combine(parts.walls), glazing: combine(parts.glass), frames: combine(parts.frames), roof, glassRoof, pergola: combine(pergola),
    steps: stair.steps, stairRails: stair.rails,
    upperRails: combine([guardRail(-.2, 1.42, -.2, -2.65, upper), guardRail(1.58, 1.42, 1.58, -2.65, upper), guardRail(1.5, 1.53, 3.57, 1.53, upper)]),
    bands: combine([box(7.59, .18, .24, 0, 3.735, -3.44), box(7.59, .18, .24, 0, 3.735, 1.7), box(.24, .18, 4.9, -3.67, 3.735, -.87), box(.24, .18, 4.9, 3.67, 3.735, -.87), box(.16, .18, 5.39, -3.78, 6.49, -.87), box(7.58, .18, .16, 0, 6.49, -3.57)]),
    entry: combine([box(2.08, .13, .88, -1.33, 3.27, 1.93), box(.08, 2.18, .08, -2.26, 2.165, 2.24), box(.08, 2.18, .08, -.4, 2.165, 2.24), box(.22, .32, .22, -2.26, .92, 2.24), box(.22, .32, .22, -.4, .92, 2.24)]),
    threshold: floorSlab('research-door-threshold', [floorRectangle(-1.33,1.8125,1.46,.495)], 1.07, .27, 'threshold'),
    planters: combine(planters), planting: combine(planting),
  };
}

export function ResearchInstitute(props: ModelProps) {
  const material = usePalette(props, 'research');
  const geometry = useResources(makeResearchBuilding);
  return <group name="research-institute" dispose={null}>
    <FurnishedInterior name="research-interior" build={makeResearchInterior} />
    <mesh name="research-foundation" geometry={geometry.foundation} material={material.paving} receiveShadow />
    <mesh name="research-floor" geometry={geometry.floor} material={material.paving} receiveShadow />
    <mesh name="research-upper-laboratories" geometry={geometry.upper} material={material.paving} receiveShadow />
    <mesh name="research-accessible-planted-terrace" geometry={geometry.terrace} material={material.paving} receiveShadow />
    <mesh name="research-lab-walls" geometry={geometry.walls} material={material.porcelain} castShadow receiveShadow />
    <mesh name="research-lab-roof" geometry={geometry.roof} material={material.porcelain} castShadow receiveShadow />
    <mesh name="research-glazed-envelope" geometry={geometry.glazing} material={material.glass} />
    <mesh name="research-window-divisions" geometry={geometry.frames} material={material.navy} castShadow />
    <mesh name="research-terrace-glass-roof" geometry={geometry.glassRoof} material={material.glass} />
    <mesh name="research-supported-terrace-roof" geometry={geometry.pergola} material={material.edge} castShadow />
    <mesh name="research-stair-to-second-floor" geometry={geometry.steps} material={material.paving} castShadow receiveShadow />
    <mesh name="research-stair-handrails" geometry={geometry.stairRails} material={material.edge} castShadow />
    <mesh name="research-gallery-and-terrace-guards" geometry={geometry.upperRails} material={material.edge} castShadow />
    <mesh name="research-structural-floor-bands" geometry={geometry.bands} material={material.cyan} castShadow />
    <mesh name="research-supported-entry-canopy" geometry={geometry.entry} material={material.edge} castShadow />
    <mesh name="research-door-threshold" geometry={geometry.threshold} material={material.paving} receiveShadow />
    <mesh name="research-planters" geometry={geometry.planters} material={material.porcelain} castShadow />
    <mesh name="research-planting" geometry={geometry.planting} material={material.green} castShadow />
  </group>;
}
