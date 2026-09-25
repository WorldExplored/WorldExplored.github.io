import { Vector3 } from 'three';
import { cameraObstacles, type CameraObstacle } from './cameraControls';
import { createLandscapePlan, ISLANDS, seededRandom, terrainHeight } from './terrain';

export type GullMode = 'gliding' | 'flapping' | 'circling' | 'approach' | 'perched' | 'preening' | 'takeoff' | 'hunting';
export interface GullPerch { id: string; position: Vector3; heading: number; capacity: 1; owner: number | null; nest?: boolean }
export interface GullFlight {
  perch: GullPerch; outward: number; radius: number; width: number; height: number; duration: number;
  points: Vector3[]; huntPoints?: Vector3[]; length: number; airborne?: boolean;
}
export interface GullState {
  index: number; position: Vector3; velocity: Vector3; perch: GullPerch; flight: GullFlight;
  fold: number; flap: number; legs: number; mode: GullMode; age: number; time: number; phase: number;
  heading: number; pitch: number; bank: number; progress: number; travelSpeed: number; cycle: number; rest: number;
  start: Vector3; duration: number; nextDeparture: number; hunt: boolean; caught: boolean; preyVisible: boolean; preyPosition: Vector3; preyStart: Vector3; preyEscape: number;
}
interface Flock { birds: GullState[]; obstacles: CameraObstacle[]; random: () => number }
const flocks = new WeakMap<GullState, Flock>();
const TAU = Math.PI * 2;
export const GULL_TURN_RATE = 1.15;
export const GULL_MAX_PITCH = .58;
export const GULL_SEPARATION = 3.05;
const POINTS = 240;
const temporary = new Vector3();
const ahead = new Vector3();

export function createGullPerches(plan = createLandscapePlan()): GullPerch[] {
  const perches: GullPerch[] = [{ id: 'beacon-balcony-rail', position: new Vector3(-74.91, 7.88, -36), heading: 0, capacity: 1, owner: null }];
  for (const rock of plan.rocks) {
    if (rock.y + rock.scale[1] < .3 || rock.scale[0] < .7) continue;
    const position = new Vector3(rock.x, rock.y + rock.scale[1] + .28, rock.z);
    if (perches.some(perch => perch.position.distanceTo(position) < 4)) continue;
    if ([...plan.trees, ...plan.structures].some(item => Math.hypot(item.x-rock.x,item.z-rock.z) < item.radius+2)) continue;
    perches.push({ id: rock.id, position, heading: rock.rotation, capacity: 1, owner: null, nest: perches.length < 4 });
  }
  return perches;
}

export function gullFlightFloor(x: number, z: number, obstacles: readonly CameraObstacle[]) {
  let floor = Math.max(0, terrainHeight(x,z)) + 1;
  for (const obstacle of obstacles) if (Math.hypot(x-obstacle.x,z-obstacle.z) < obstacle.radius+1.35) floor = Math.max(floor,obstacle.top+1.1);
  return floor;
}

/** A low banking circuit joins its perch tangentially, with no vertical landing column. */
function circuit(flight: GullFlight, t: number, point: Vector3, hunt = false) {
  const angle = t * TAU, c = Math.cos(flight.outward), s = Math.sin(flight.outward);
  const along = Math.sin(angle) * flight.width * (1+.08*Math.sin(angle*2+flight.outward));
  const out = (1-Math.cos(angle)) * flight.radius * (1+.09*Math.sin(angle+flight.outward));
  const lift = hunt
    ? (.50-flight.perch.position.y)*Math.sin(Math.PI*t)**2 + flight.height*.55*Math.sin(angle)**2
    : Math.sin((flight.airborne?TAU:Math.PI)*t)*flight.height;
  return point.set(flight.perch.position.x + c*out-s*along, flight.perch.position.y+lift, flight.perch.position.z+s*out+c*along);
}

function safePoint(point: Vector3, perch: GullPerch, obstacles: readonly CameraObstacle[], hunt: boolean) {
  if (point.y < Math.max(.32,terrainHeight(point.x,point.z)+.3)) return false;
  const beacon = perch.id === 'beacon-balcony-rail';
  for (const obstacle of obstacles) {
    if (beacon && Math.hypot(obstacle.x+76,obstacle.z+36)<.2) {
      // The rail is outside the lantern, and this circuit stays on its ocean-facing half.
      if (Math.hypot(point.x+76,point.z+36)<1.03) return false;
      continue;
    }
    if (Math.hypot(point.x-obstacle.x,point.z-obstacle.z)<obstacle.radius+1.35 && point.y<obstacle.top+1.1) return false;
  }
  if (hunt && point.distanceTo(perch.position)>3 && point.y<1.2 && terrainHeight(point.x,point.z)>-1.4) return false;
  return true;
}
function routeSamples(flight: GullFlight, hunt = false) {
  return Array.from({length:POINTS+1},(_,i)=>circuit(flight,i/POINTS,new Vector3(),hunt));
}
function separated(points: Vector3[], accepted: GullFlight[]) {
  return accepted.every(flight => {
    const envelope=flight.huntPoints?[...flight.points,...flight.huntPoints]:flight.points;
    return points.every(point=>envelope.every(other=>point.distanceToSquared(other)>GULL_SEPARATION**2));
  });
}
function planCircuits(perches: GullPerch[], obstacles: CameraObstacle[]) {
  const accepted: GullFlight[] = [];
  for (const perch of perches) {
    const island = ISLANDS.reduce((best,island)=>Math.hypot(perch.position.x-island.x,perch.position.z-island.z)<Math.hypot(perch.position.x-best.x,perch.position.z-best.z)?island:best,ISLANDS[0]);
    const outward = perch.id==='beacon-balcony-rail'?0:Math.atan2(perch.position.z-island.z,perch.position.x-island.x);
    for (let attempt=0;attempt<72;attempt++) {
      const radius=8+(perches.indexOf(perch)%3)*.65+(attempt%4)*2.4;
      const flight:GullFlight={perch,outward:outward+([0,.24,-.24,.48,-.48,.72][Math.floor(attempt/4)%6]),radius,width:radius*(.70+(perches.indexOf(perch)%4)*.04+Math.floor(attempt/24)*.11),height:5.5+Math.floor(attempt/24)*2.2,duration:0,points:[],length:0};
      const points=routeSamples(flight);
      if(!points.every(point=>safePoint(point,perch,obstacles,false))||!separated(points,accepted))continue;
      flight.points=points;
      flight.length=points.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(points[i]),0);
      flight.duration=flight.length/(1.85+accepted.length*.065)+4;
      const huntPoints=routeSamples(flight,true);
      if(huntPoints.every((point,i)=>safePoint(point,perch,obstacles,true)&&(i===0||Math.abs(point.y-huntPoints[i-1].y)<.72*Math.hypot(point.x-huntPoints[i-1].x,point.z-huntPoints[i-1].z)))&&separated(huntPoints,accepted))flight.huntPoints=huntPoints;
      perch.heading=Math.atan2(Math.sin(flight.outward),-Math.cos(flight.outward));
      accepted.push(flight);break;
    }
  }
  return accepted;
}
function routePoint(flight: GullFlight, progress: number, point: Vector3, hunt=false) {
  return circuit(flight,Math.max(0,Math.min(1,progress)),point,hunt&&Boolean(flight.huntPoints));
}

export function createGullStates(perches = createGullPerches()): GullState[] {
  const obstacles=[...cameraObstacles(),...createLandscapePlan().trees.map(tree=>({x:tree.x,z:tree.z,radius:tree.radius,top:tree.y+tree.height}))],random=seededRandom(96213),flights=planCircuits(perches,obstacles);
  const shoreCount=flights.length;
  flights.push(...flights);
  const homes=[[-12,20,7],[10,23,-4],[-24,26,-20],[22,29,15],[-14,32,29],[-3,25,-77],[17,28,-87],[-25,31,-75]];
  // Widely separated sky lanes are the fallback for birds without a clear shore approach.
  while(flights.length<18){
    const i=flights.length,home=homes[i-shoreCount*2]??homes[0],perch:GullPerch={id:`sky-${i}`,position:new Vector3(...home),heading:0,capacity:1,owner:null};
    const flight:GullFlight={perch,outward:random()*TAU,radius:4.5+random()*2,width:4.5+random()*2,height:.4,duration:46+i,points:[],length:0,airborne:true};
    flight.points=routeSamples(flight);flight.length=flight.points.slice(1).reduce((sum,p,j)=>sum+p.distanceTo(flight.points[j]),0);flights.push(flight);
  }
  const birds=flights.map((flight,index)=>{
    const onPerch=index<shoreCount;
    const paired=!flight.airborne&&!onPerch;
    const state:GullState={index,perch:flight.perch,flight,position:new Vector3(),velocity:new Vector3(),fold:onPerch?1:0,flap:0,legs:onPerch?1:0,mode:onPerch?'perched':'gliding',age:0,time:0,phase:random()*TAU,heading:flight.perch.heading,pitch:0,bank:0,progress:onPerch?0:paired?.32:.22+random()*.5,travelSpeed:onPerch?0:1,cycle:0,rest:12,start:new Vector3(),duration:flight.duration,nextDeparture:12+(paired?(flight.duration+18)/2:0),hunt:false,caught:false,preyVisible:false,preyPosition:new Vector3(),preyStart:new Vector3(),preyEscape:0};
    routePoint(flight,state.progress,state.position);routePoint(flight,state.progress+.001,ahead).sub(state.position);if(!onPerch){state.heading=Math.atan2(-ahead.x,-ahead.z);state.velocity.copy(ahead).multiplyScalar(1000/state.duration);}
    if(onPerch)flight.perch.owner=index;
    return state;
  });
  const context:Flock={birds,obstacles,random:seededRandom(74303)};
  birds.forEach(bird=>flocks.set(bird,context));return birds;
}

export function startGullTakeoff(state: GullState) {
  if(state.mode!=='perched'&&state.mode!=='preening')return;
  state.start.copy(state.position);state.age=0;state.mode='takeoff';state.travelSpeed=0;state.progress=0;
  if(state.perch.owner===state.index)state.perch.owner=null;
  state.nextDeparture=Math.max(state.nextDeparture,state.time)+state.duration+18;
  state.cycle++;
  state.hunt=Boolean(state.flight.huntPoints)&&state.cycle%3===2;
  state.caught=false;state.preyEscape=0;state.preyVisible=state.hunt;
}

function pose(state:GullState,dt:number) {
  const perched=state.mode==='perched'||state.mode==='preening';
  const horizontal=Math.hypot(state.velocity.x,state.velocity.z);
  const desiredHeading=horizontal>.025?Math.atan2(-state.velocity.x,-state.velocity.z):state.heading;
  const difference=Math.atan2(Math.sin(desiredHeading-state.heading),Math.cos(desiredHeading-state.heading));
  const turn=Math.max(-GULL_TURN_RATE*dt,Math.min(GULL_TURN_RATE*dt,difference));state.heading+=turn;
  const pitch=perched?-.04:Math.max(-GULL_MAX_PITCH,Math.min(GULL_MAX_PITCH,-Math.atan2(state.velocity.y,Math.max(.2,horizontal))));
  state.pitch+=Math.max(-.6*dt,Math.min(.6*dt,pitch-state.pitch));
  const bank=perched?0:Math.max(-.30,Math.min(.30,-turn/dt*.48));state.bank+=(bank-state.bank)*(1-Math.exp(-3*dt));
  let fold=perched?1:state.mode==='approach'?Math.max(0,(state.progress-.98)/.02)*.8:0;
  if(state.perch.id==='beacon-balcony-rail'){
    const railClearance=Math.max((Math.hypot(state.position.x+76,state.position.z+36)-1.25)/2,(state.position.y-8.35)/1.2);
    fold=Math.max(fold,1-Math.max(0,Math.min(1,railClearance)));
  }
  state.fold+=(fold-state.fold)*(1-Math.exp(-5*dt));
  const legs=perched||state.mode==='approach'&&state.progress>.965||state.mode==='takeoff'&&state.progress<.015?1:0;
  state.legs+=(legs-state.legs)*(1-Math.exp(-4*dt));
  const flap=state.mode==='takeoff'||state.mode==='flapping'||state.hunt&&state.progress>.51&&state.progress<.65?1:0;
  state.flap+=(flap-state.flap)*(1-Math.exp(-2.5*dt));
}

/** Static swept-flight clearance plus exclusive landing slots prevents wings sharing a destination. */
export function stepGull(state:GullState,delta:number,camera:Vector3,pointer:readonly number[]|null,paused=false) {
  if(paused)return;
  const dt=Math.min(.05,Math.max(0,delta));if(!dt)return;
  state.time+=dt;state.age+=dt;
  const flock=flocks.get(state)!;
  if(state.mode==='perched'||state.mode==='preening'){
    state.velocity.set(0,0,0);pose(state,dt);
    const pointerClose=pointer&&Math.hypot(pointer[0]-state.position.x,pointer[1]-state.position.y,pointer[2]-state.position.z)<2.2;
    const freeDeparture=flock.birds.every(other=>other===state||other.flight!==state.flight||other.position.distanceTo(state.position)>6);
    if(freeDeparture&&(state.time>=state.nextDeparture||camera.distanceToSquared(state.position)<9||pointerClose))startGullTakeoff(state);
    else state.mode=state.age>state.rest*.35&&state.age<state.rest*.76?'preening':'perched';
    return;
  }
  const previous=state.position.clone(),oldProgress=state.progress;
  const desired=state.flight.airborne?1:Math.min(1,Math.sqrt(Math.max(0,1-state.progress)*state.duration/2));
  state.travelSpeed+=Math.max(-.45*dt,Math.min(.45*dt,desired-state.travelSpeed));
  state.progress+=dt*state.travelSpeed/state.duration;
  if(!state.flight.airborne&&state.progress>.86){
    if(state.perch.owner===null)state.perch.owner=state.index;
    state.mode='approach';
  }else if(state.hunt&&state.progress>.32&&state.progress<.68)state.mode='hunting';
  else if(!state.flight.airborne&&state.progress<.075)state.mode='takeoff';
  else state.mode=(['gliding','flapping','circling'] as const)[Math.floor((state.time+state.phase)/7)%3];
  if(state.flight.airborne&&state.progress>=1)state.progress-=1;
  routePoint(state.flight,state.progress,state.position,state.hunt);
  if(state.progress>=1&&!state.flight.airborne){
    state.position.copy(state.perch.position);state.progress=0;state.travelSpeed=0;state.age=0;state.rest=Math.max(7,state.nextDeparture-state.time);state.mode='perched';state.velocity.set(0,0,0);state.hunt=false;state.preyVisible=false;pose(state,dt);return;
  }
  state.velocity.copy(state.position).sub(previous).divideScalar(dt);pose(state,dt);
  if(state.hunt){
    if(oldProgress<.5&&state.progress>=.5){state.caught=flock.random()<.5;state.preyEscape=0;state.preyStart.copy(state.preyPosition);}
    if(state.caught){state.preyVisible=state.progress<.64;}
    else if(state.progress>.5){
      state.preyEscape+=dt;state.preyPosition.copy(state.preyStart);state.preyPosition.x+=state.preyEscape*1.3;
      state.preyPosition.y-=Math.min(1.8,state.preyEscape)*.65;state.preyVisible=state.preyEscape<2.3;
    }else{
      const prey=routePoint(state.flight,.5,temporary,true);state.preyPosition.copy(prey);state.preyPosition.y=-.08;
      state.preyPosition.x+=Math.sin(state.time*2)*.32;state.preyPosition.z+=Math.cos(state.time*1.5)*.18;
      const jump=Math.max(0,Math.min(1,(state.progress-.475)/.025));
      const scale=.91+state.index%4*.075;
      ahead.set(state.position.x-Math.sin(state.heading)*.51*scale,state.position.y+.13*scale,state.position.z-Math.cos(state.heading)*.51*scale);
      state.preyPosition.lerp(ahead,jump*jump*(3-2*jump));state.preyVisible=true;
    }
  }
}
