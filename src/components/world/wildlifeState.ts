import { Vector3 } from 'three';
import type { QualityTier } from '../../content/world';
import { createLandscapePlan, distanceToSegment, ISLANDS, islandContour, landDistance, seededRandom, terrainHeight, terrainSlope, type Island, type LandscapePlan } from './terrain';
export { createGullPerches, createGullStates, startGullTakeoff, stepGull, gullFlightFloor, GULL_TURN_RATE, GULL_MAX_PITCH, GULL_SEPARATION } from './gullLife';
export type { GullMode, GullPerch, GullState } from './gullLife';
export const WILDLIFE_COUNTS = { high: { gulls: 18, crabs: 10 }, medium: { gulls: 10, crabs: 6 }, low: { gulls: 6, crabs: 0 } } satisfies Record<QualityTier, { gulls: number; crabs: number }>;
const TAU = Math.PI * 2;

export interface CrabRoute { island: Island; angle: number; extent: number; band: number; phase: number }
export function writeCrabPosition(route: CrabRoute, progress: number, point: Vector3) {
  const angle = route.angle + progress * route.extent;
  const r = islandContour(route.island, angle) - route.band / Math.min(route.island.rx, route.island.rz);
  const x = route.island.x + Math.cos(angle) * route.island.rx * r; const z = route.island.z + Math.sin(angle) * route.island.rz * r;
  return point.set(x, terrainHeight(x, z) + .11, z);
}
export function validCrabPosition(point: Vector3, plan: LandscapePlan) {
  const distance = landDistance(point.x, point.z);
  return distance > .85 && distance < 1.75 && terrainHeight(point.x, point.z) > .16 && terrainSlope(point.x, point.z) < .65
    && [...plan.structures, ...plan.rocks].every(item => Math.hypot(point.x - item.x, point.z - item.z) > item.radius + .6)
    && plan.paths.every(path => path.points.slice(1).every((b, index) => distanceToSegment(point.x, point.z, path.points[index], b) > path.width / 2 + .65));
}
export function createCrabRoutes(plan = createLandscapePlan()): CrabRoute[] {
  const random = seededRandom(5778); const routes: CrabRoute[] = []; const point = new Vector3();
  const habitats = ['main', 'experience-meadow', 'garden', 'purdue'].map(id => ISLANDS.find(island => island.id === id)!);
  for (let attempt = 0; routes.length < 10 && attempt < 1000; attempt++) {
    const island = habitats[attempt % habitats.length];
    const route = { island, angle: random() * TAU, extent: .05 + random() * .035, band: 1.15 + random() * .25, phase: random() * TAU };
    if (Array.from({ length: 41 }, (_, index) => validCrabPosition(writeCrabPosition(route, index / 20 - 1, point), plan)).every(Boolean) && routes.every(other => {
      const a=writeCrabPosition(other,0,new Vector3()), b=writeCrabPosition(route,0,new Vector3());
      const ar=a.distanceTo(writeCrabPosition(other,1,new Vector3())),br=b.distanceTo(writeCrabPosition(route,1,new Vector3()));
      return a.distanceTo(b)>ar+br+.8;
    })) routes.push(route);
  }
  return routes;
}
export type CrabMode = 'Idle' | 'Walking' | 'Alert' | 'Fleeing' | 'Hiding' | 'Returning';
export interface CrabState { route: CrabRoute; position: Vector3; time: number; progress: number; heading: number; scuttle: number; gait: number; mode: CrabMode; age: number; speed: number; target: number; retreat: number; home: number; armed: boolean; clearTime: number; routeLength: number }
export function createCrabStates(): CrabState[] {
  return createCrabRoutes().map(route=>{
    const progress=Math.sin(route.phase)*.7;
    const a=writeCrabPosition(route,-1,new Vector3()),b=writeCrabPosition(route,1,new Vector3());
    return {route,position:writeCrabPosition(route,progress,new Vector3()),time:0,progress,heading:-route.angle,scuttle:0,gait:0,mode:'Idle',age:0,speed:0,target:progress,retreat:progress,home:progress,armed:true,clearTime:0,routeLength:a.distanceTo(b)};
  });
}
function crabMode(state: CrabState, mode: CrabMode){state.mode=mode;state.age=0;}
export function stepCrab(state: CrabState, delta: number, camera: Vector3, pointer: readonly number[] | null, paused = false) {
  if(paused)return;
  const dt=Math.min(.05,Math.max(0,delta));if(!dt)return;state.time+=dt;state.age+=dt;
  const pointerDistance=pointer?Math.hypot(pointer[0]-state.position.x,pointer[1]-state.position.y,pointer[2]-state.position.z):Infinity;
  const cameraDistance=camera.distanceTo(state.position);const distance=Math.min(pointerDistance,cameraDistance);
  if(distance>3.2)state.clearTime+=dt;else state.clearTime=0;
  if(state.clearTime>2)state.armed=true;
  if(distance<1.8&&state.armed&&!['Alert','Fleeing','Hiding'].includes(state.mode)){
    const threat=pointer&&pointerDistance<cameraDistance?new Vector3(...pointer):camera;
    const left=writeCrabPosition(state.route,-.95,new Vector3()),right=writeCrabPosition(state.route,.95,new Vector3());
    state.home=state.progress;state.retreat=left.distanceToSquared(threat)>right.distanceToSquared(threat)?-.95:.95;
    state.target=state.progress;state.armed=false;crabMode(state,'Alert');
  }
  if(state.mode==='Alert'&&state.age>.28){state.target=state.retreat;crabMode(state,'Fleeing');}
  if(state.mode==='Hiding'&&state.age>4&&distance>2.8){state.target=state.home;crabMode(state,'Returning');}
  if(state.mode==='Idle'&&state.age>2.5){state.target=state.progress>0?-.65:.65;crabMode(state,'Walking');}
  const moving=['Walking','Fleeing','Returning'].includes(state.mode);
  const remaining=(state.target-state.progress)*state.routeLength/2;
  const maxSpeed=state.mode==='Fleeing'?.7:.16, acceleration=.85;
  const desired=moving?Math.sign(remaining)*Math.min(maxSpeed,Math.abs(remaining)*3):0;
  state.speed+=Math.max(-acceleration*dt,Math.min(acceleration*dt,desired-state.speed));
  const travel=state.speed*dt;
  if(moving&&Math.abs(remaining)<.003&&Math.abs(state.speed)<acceleration*dt){state.progress=state.target;state.speed=0;crabMode(state,state.mode==='Fleeing'?'Hiding':'Idle');}
  else state.progress=Math.max(-.98,Math.min(.98,state.progress+travel*2/state.routeLength));
  writeCrabPosition(state.route,state.progress,state.position);
  const heading=-(state.route.angle+state.progress*state.route.extent);const turn=Math.atan2(Math.sin(heading-state.heading),Math.cos(heading-state.heading));
  state.heading+=Math.max(-1.5*dt,Math.min(1.5*dt,turn));
  state.scuttle+=((state.mode==='Fleeing'?1:0)-state.scuttle)*(1-Math.exp(-3*dt));state.gait+=Math.abs(travel)*18;
}
