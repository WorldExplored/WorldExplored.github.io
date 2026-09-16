import { Vector3 } from 'three';
import type { QualityTier } from '../../content/world';
import { cameraObstacles, type CameraObstacle } from './cameraControls';
import { createLandscapePlan, distanceToSegment, ISLANDS, islandContour, landDistance, seededRandom, terrainHeight, terrainSlope, type Island, type LandscapePlan } from './terrain';

export const WILDLIFE_COUNTS = { high: { gulls: 18, crabs: 10 }, medium: { gulls: 10, crabs: 6 }, low: { gulls: 6, crabs: 0 } } satisfies Record<QualityTier, { gulls: number; crabs: number }>;
export type GullMode = 'gliding' | 'flapping' | 'circling' | 'approach' | 'perched' | 'takeoff';
export interface GullPerch { id: string; position: Vector3; heading: number; capacity: 1; owner: number | null; resident?: boolean }
export interface GullState {
  index: number; position: Vector3; velocity: Vector3; anchor: Vector3; perch: GullPerch;
  fold: number; flap: number; mode: GullMode; age: number; time: number; phase: number; radius: number; speed: number; heading: number; aspect: number;
  start: Vector3; end: Vector3; duration: number; waypoints: Vector3[]; corridor: Vector3[]; routeTime: number; resident: boolean; returnAt: number;
}
interface Flock { birds: GullState[]; perches: GullPerch[]; obstacles: CameraObstacle[]; routes: Vector3[][] }
const flocks = new WeakMap<GullState, Flock>();
const TAU = Math.PI * 2;
const ease = (t: number) => t * t * t * (10 + t * (-15 + 6 * t));
const temporary = new Vector3();

export function createGullPerches(plan = createLandscapePlan()): GullPerch[] {
  const perches: GullPerch[] = [];
  for (const rock of plan.rocks) {
    if (rock.y + rock.scale[1] < .3 || rock.scale[0] < .7) continue;
    const position = new Vector3(rock.x, rock.y + rock.scale[1] + .28, rock.z);
    if (perches.some(perch => perch.position.distanceTo(position) < 4)) continue;
    if ([...plan.trees, ...plan.structures].some(item => Math.hypot(item.x-rock.x,item.z-rock.z) < item.radius+2)) continue;
    perches.push({ id: rock.id, position, heading: rock.rotation, capacity: 1, owner: null });
  }
  // Tangential orientation keeps the folded wings and tail outside the lantern.
  perches.unshift({ id: 'beacon-balcony-rail', position: new Vector3(-74.91, 7.88, -36), heading: 0, capacity: 1, owner: null, resident: true });
  return perches;
}

export function gullFlightFloor(x: number, z: number, obstacles: readonly CameraObstacle[]) {
  let floor = Math.max(0, terrainHeight(x,z)) + 2;
  for (const obstacle of obstacles) if (Math.hypot(x-obstacle.x,z-obstacle.z) < obstacle.radius+1.5) floor = Math.max(floor,obstacle.top+1.5);
  return floor;
}
function orbit(state: GullState, time: number, point: Vector3) {
  const angle = time * state.speed + state.phase;
  return point.set(state.anchor.x + Math.cos(angle) * state.radius, state.anchor.y + Math.sin(angle*2+state.phase)*.45, state.anchor.z + Math.sin(angle) * state.radius * state.aspect);
}

export function createGullStates(perches = createGullPerches()): GullState[] {
  const random = seededRandom(96213);
  const homes = [[-76,17,-36],[-12,14,7],[10,17,-4],[-24,21,-20],[22,16,15],[-14,17,29],[-3,28,-77],[17,30,-87],[-25,25,-75],[-37,18,4],[1,20,37],[30,21,-22],[-15,24,-43],[-53,18,-29],[-78,20,-58],[-37,28,-91],[22,26,-59],[-42,20,29]];
  const obstacles = cameraObstacles();
  const birds: GullState[] = homes.map((home,index) => {
    const state: GullState = { index, anchor: new Vector3(...home), position: new Vector3(), velocity: new Vector3(), perch: perches[0], phase: random()*TAU, radius: 4.5+random()*2.5, aspect: .6+index*.013, speed: .12+index*.003, heading: 0, fold: index===0?1:0, flap: 0, mode: index===0?'perched':(['gliding','flapping','circling'] as const)[index%3], age: index*.73, time: 0, start: new Vector3(), end: new Vector3(), duration: 0, waypoints: [], corridor: [], routeTime: 0, resident: index===0, returnAt: 20+index*2.1 };
    let floor=home[1];
    for(let i=0;i<96;i++) { orbit(state,i/96*TAU/state.speed,temporary); floor=Math.max(floor,gullFlightFloor(temporary.x,temporary.z,obstacles)+1); }
    state.anchor.y=floor;
    orbit(state,0,state.position);
    if(state.resident){state.position.copy(perches[0].position);perches[0].owner=index;state.heading=perches[0].heading;}
    return state;
  });
  const context: Flock = { birds, perches, obstacles, routes: birds.map(bird => Array.from({length:64},(_,i)=>orbit(bird,i/64*TAU/bird.speed,new Vector3()))) };
  birds.forEach(bird=>flocks.set(bird,context));
  return birds;
}
function beginSegment(state: GullState) {
  state.start.copy(state.position); state.end.copy(state.waypoints.shift()!); state.age=0;
  // Quintic interpolation has a maximum derivative of 1.875.
  state.duration=Math.max(1.4,state.start.distanceTo(state.end)*1.875/3.4);
}
function clearPerchColumn(perch: GullPerch, x: number, z: number) {
  return Math.hypot(x-perch.position.x,z-perch.position.z)<.12;
}
function safeTrajectory(state: GullState, points: Vector3[], perch: GullPerch) {
  const flock=flocks.get(state)!; let from=state.position;
  for(const to of points){
    const steps=Math.max(2,Math.ceil(from.distanceTo(to)*2));
    for(let i=0;i<=steps;i++){
      temporary.lerpVectors(from,to,i/steps);
      const column=clearPerchColumn(perch,temporary.x,temporary.z);
      if(!column && temporary.y<gullFlightFloor(temporary.x,temporary.z,flock.obstacles))return false;
      if(column && temporary.y<perch.position.y-.001)return false;
      for(const other of flock.birds){
        if(other===state)continue;
        if(flock.routes[other.index].some(p=>p.distanceToSquared(temporary)<6.25))return false;
        if(other.corridor.length){
          const route=other.corridor;
          for(let j=1;j<route.length;j++){
            const a=route[j-1],b=route[j];const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
            const u=Math.max(0,Math.min(1,((temporary.x-a.x)*dx+(temporary.y-a.y)*dy+(temporary.z-a.z)*dz)/(dx*dx+dy*dy+dz*dz||1)));
            if((temporary.x-a.x-u*dx)**2+(temporary.y-a.y-u*dy)**2+(temporary.z-a.z-u*dz)**2<6.25)return false;
          }
        }
      }
    }
    from=to;
  }
  return true;
}
function requestLanding(state: GullState) {
  const flock=flocks.get(state)!;
  const slots=flock.perches.filter(p=>p.owner===null && Boolean(p.resident)===state.resident).sort((a,b)=>a.position.distanceToSquared(state.position)-b.position.distanceToSquared(state.position));
  for(const perch of slots){
    const high=Math.max(32+state.index*1.7,state.anchor.y+6);
    const points=[new Vector3(state.position.x,high,state.position.z),new Vector3(perch.position.x,high,perch.position.z),new Vector3(perch.position.x,perch.position.y+3,perch.position.z),perch.position.clone()];
    if(!safeTrajectory(state,points,perch))continue;
    perch.owner=state.index;state.perch=perch;state.corridor=[state.position.clone(),...points.map(p=>p.clone())];state.waypoints=points;state.mode='approach';beginSegment(state);return true;
  }
  return false;
}
export function startGullTakeoff(state: GullState) {
  if(state.perch.owner===state.index)state.perch.owner=null;
  if(!state.corridor.length){
    const point=orbit(state,state.routeTime,new Vector3());const high=Math.max(state.anchor.y+7,32+state.index*1.7);
    state.corridor=[point,new Vector3(point.x,high,point.z),new Vector3(state.position.x,high,state.position.z),new Vector3(state.position.x,state.position.y+3,state.position.z),state.position.clone()];
  }
  state.mode='takeoff';state.fold=1;
  state.waypoints=state.corridor.slice(0,-1).reverse().map(p=>p.clone());beginSegment(state);
}

/** Reserved landing columns and prevalidated flight corridors avoid shared destinations. */
export function stepGull(state: GullState, delta: number, camera: Vector3, pointer: readonly number[] | null, paused = false) {
  if(paused)return;
  const dt=Math.min(.05,Math.max(0,delta));if(!dt)return;
  state.time+=dt;state.age+=dt;
  const targetFold=state.mode==='perched'||(state.mode==='approach'&&state.waypoints.length===0)||(state.mode==='takeoff'&&state.position.y<state.perch.position.y+2)?1:0;
  state.fold+=(targetFold-state.fold)*(1-Math.exp(-3*dt));state.flap+=((state.mode==='flapping'||state.mode==='takeoff'?1:0)-state.flap)*(1-Math.exp(-2.5*dt));
  if(state.mode==='perched'){
    const pointerClose=pointer&&new Vector3(...pointer).distanceToSquared(state.position)<6.25;
    if(camera.distanceToSquared(state.position)<9||pointerClose||(!state.resident&&state.age>22+state.index))startGullTakeoff(state);
    return;
  }
  const previous=state.position.clone();
  if(state.mode==='approach'||state.mode==='takeoff'){
    state.position.lerpVectors(state.start,state.end,ease(Math.min(1,state.age/state.duration)));
    if(state.age>=state.duration){
      if(state.waypoints.length)beginSegment(state);
      else if(state.mode==='approach'){state.mode='perched';state.age=0;state.heading=state.perch.heading;state.velocity.set(0,0,0);return;}
      else{state.corridor=[];state.mode='gliding';state.age=0;state.returnAt=state.time+35+state.index;}
    }
  }else{
    state.routeTime+=dt;orbit(state,state.routeTime,state.position);
    if(state.time>state.returnAt){requestLanding(state);state.returnAt=state.time+20+state.index;}
    else if(state.age>8+state.index*.2){state.mode=state.mode==='gliding'?'flapping':state.mode==='flapping'?'circling':'gliding';state.age=0;}
  }
  // A bounded neighbor check guards unusual simultaneous takeoffs without moving a bird into terrain.
  const flock=flocks.get(state)!;
  if(flock.birds.some(other=>other!==state && other.position.distanceToSquared(state.position)<2.25 && other.position.distanceToSquared(state.position)<other.position.distanceToSquared(previous))){
    state.position.copy(previous);state.age-=dt;if(!['approach','takeoff'].includes(state.mode))state.routeTime-=dt;
  }
  state.velocity.copy(state.position).sub(previous).divideScalar(dt);
  if(state.mode==='approach'&&state.waypoints.length===0){state.heading+=(state.perch.heading-state.heading)*(1-Math.exp(-3*dt));}
  else if(state.velocity.x**2+state.velocity.z**2>.001){const heading=Math.atan2(-state.velocity.x,-state.velocity.z);state.heading+=Math.atan2(Math.sin(heading-state.heading),Math.cos(heading-state.heading))*(1-Math.exp(-5*dt));}
}

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
