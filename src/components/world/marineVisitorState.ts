import { Vector3 } from 'three';
import { getReefHabitat, marineFloorHeight, reefHabitatContains, reefFerryClearance } from './reefHabitat';
import { ISLANDS, islandContour, landDistance, seededRandom, terrainMeshHeight } from './terrain';

export type VisitorKind = 'stonefish' | 'octopus' | 'turtle';
// Both reef shelves are visited before the nearshore and seaward open-water rests.
// Each segment clears the larger octopus's swept arm disc; opposite directions
// keep the two animals from following one another in lockstep.
export const OCTOPUS_ROUTE: readonly (readonly [number,number])[] = [
  [10,-25],[7,-29],[10.5,-27.5],[17.5,-27.5],[23,-30],[27.5,-35],
  [31,-41],[31,-48],[25,-51],[20,-51],[15,-53],[15,-56],
];
type Blocker={x:number;y:number;z:number;radius:number;height:number};
const CELL=4;
let blockers:Map<string,Blocker[]>|undefined;
function nearby(x:number,z:number){
  if(!blockers){
    blockers=new Map();const habitat=getReefHabitat();
    for(const item of [...habitat.rocks,...habitat.colonies,...habitat.kelp.map(kelp=>({...kelp,radius:kelp.width*.37}))]){
      for(let cx=Math.floor((item.x-item.radius-1)/CELL);cx<=Math.floor((item.x+item.radius+1)/CELL);cx++)
        for(let cz=Math.floor((item.z-item.radius-1)/CELL);cz<=Math.floor((item.z+item.radius+1)/CELL);cz++){
          const key=`${cx},${cz}`,list=blockers.get(key)??[];list.push(item);blockers.set(key,list);
        }
    }
  }
  return blockers.get(`${Math.floor(x/CELL)},${Math.floor(z/CELL)}`)??[];
}
export interface MarineVisitorState {
  kind: VisitorKind; index: number; size: number; position: Vector3; home: Vector3; nest: Vector3; target: Vector3;
  heading: number; time: number; moving: boolean; moveUntil: number; nextMove: number;
  jet: number; reefVisits: number; openVisits: number; innerVisits: number; outerVisits: number;
  routeIndex: number; routeDirection: number; random: () => number;
}

/** Check the complete occupied disc, including floor under the swept arms or shell. */
export function visitorClear(kind: VisitorKind, x: number, z: number, radius: number) {
  if (kind === 'turtle') {
    if (landDistance(x, z) < .75 + radius || landDistance(x, z) > 3.4 - radius) return false;
    const y = terrainMeshHeight(x, z);
    for (const [dx,dz] of [[radius,0],[-radius,0],[0,radius],[0,-radius]])
      if (Math.abs(terrainMeshHeight(x+dx,z+dz)-y) > .19) return false;
    return true;
  }
  if (landDistance(x,z) > -4.2-radius || reefFerryClearance(x,z) < 3.6+radius) return false;
  const floor = marineFloorHeight(x,z);
  if (floor > -2.35 || floor < -9.5) return false;
  for (const obstacle of nearby(x,z)){
    if (Math.hypot(x-obstacle.x,z-obstacle.z) < obstacle.radius+radius+.04 && obstacle.y+obstacle.height > floor+.11) return false;
  }
  return true;
}

function pathClear(kind: VisitorKind, from: Vector3, x: number, z: number, radius: number) {
  const distance = Math.hypot(x-from.x,z-from.z);
  for (let step=1;step<=Math.ceil(distance/.22);step++) {
    const t=step/Math.ceil(distance/.22);
    if (!visitorClear(kind,from.x+(x-from.x)*t,from.z+(z-from.z)*t,radius)) return false;
  }
  return true;
}

function initialWaterPosition(kind: VisitorKind, index: number, random: () => number, radius: number) {
  // Western and eastern sandy reef corridors, with a nearshore exit for octopuses.
  const centers = index%2 ? [[-60,-36],[-50,-33],[-35,-35]] : [[-17,-44],[-7,-36],[10,-35]];
  for (const [cx,cz] of centers) for (let attempt=0;attempt<350;attempt++) {
    const x=cx+(random()-.5)*12,z=cz+(random()-.5)*12;
    if (visitorClear(kind,x,z,radius)) return new Vector3(x,marineFloorHeight(x,z)+.075,z);
  }
  throw new Error(`No safe ${kind} habitat`);
}

function initialTurtlePosition(index: number, random: () => number, radius: number) {
  const island=ISLANDS.find(item=>item.id===['experience-meadow','garden','museum-meadow'][index%3])!;
  for(let attempt=0;attempt<2000;attempt++){
    const a=random()*Math.PI*2, contour=islandContour(island,a),d=1.45+random()*1.0;
    const x=island.x+Math.cos(a)*island.rx*(contour-d/Math.min(island.rx,island.rz));
    const z=island.z+Math.sin(a)*island.rz*(contour-d/Math.min(island.rx,island.rz));
    if(visitorClear('turtle',x,z,radius+.3)) return new Vector3(x,terrainMeshHeight(x,z)+.005,z);
  }
  throw new Error('No safe turtle nesting beach');
}

function turtleNest(home:Vector3,random:()=>number){
  // A tangential patch keeps the clutch beside, rather than beneath, its guardian.
  for(let attempt=0;attempt<200;attempt++){
    const angle=attempt<40?(attempt%2?1:-1)*(.15+Math.floor(attempt/2)*.14):random()*Math.PI*2;
    const distance=1.22+random()*.28,x=home.x+Math.sin(angle)*distance,z=home.z+Math.cos(angle)*distance;
    if(!visitorClear('turtle',x,z,.44))continue;
    const height=terrainMeshHeight(x,z);
    if(Math.abs(height-(home.y-.005))>.17)continue;
    return new Vector3(x,height,z);
  }
  throw new Error('No adjacent beach patch for turtle nest');
}

function avoidsNest(state:MarineVisitorState,x:number,z:number){
  return state.kind!=='turtle'||Math.hypot(x-state.nest.x,z-state.nest.z)>1.01;
}

export function createMarineVisitor(kind: VisitorKind,index: number): MarineVisitorState {
  const random=seededRandom(271901+index*2719+(kind==='octopus'?17000:kind==='turtle'?42000:0));
  const size=kind==='octopus'?(index%2?.48:.74):kind==='stonefish'?.36:.68;
  const radius=kind==='octopus'?size*.85:kind==='stonefish'?.33:.58;
  const endpoint=OCTOPUS_ROUTE[index%2?OCTOPUS_ROUTE.length-1:0];
  const position=kind==='octopus'?new Vector3(endpoint[0],marineFloorHeight(...endpoint)+.075,endpoint[1]):kind==='turtle'?initialTurtlePosition(index,random,radius):initialWaterPosition(kind,index,random,radius);
  const direction=index%2?-1:1;
  const adjacent=OCTOPUS_ROUTE[index%2?OCTOPUS_ROUTE.length-2:1];
  const heading=kind==='octopus'?Math.atan2(position.z-adjacent[1],adjacent[0]-position.x):random()*Math.PI*2;
  const nest=kind==='turtle'?turtleNest(position,random):position.clone();
  const state:MarineVisitorState={kind,index,size,position,home:position.clone(),nest,target:position.clone(),heading,time:0,moving:false,moveUntil:0,nextMove:kind==='octopus'?2+random()*4:kind==='stonefish'?30+random()*38:22+random()*34,jet:0,reefVisits:0,openVisits:0,innerVisits:0,outerVisits:0,routeIndex:index%2?OCTOPUS_ROUTE.length-1:0,routeDirection:direction,random};
  return state;
}

function chooseTarget(state:MarineVisitorState) {
  const {kind,position,random,size}=state,radius=kind==='octopus'?size*.85:kind==='stonefish'?.33:.58;
  if(kind==='octopus'){
    state.routeIndex+=state.routeDirection;
    const [x,z]=OCTOPUS_ROUTE[state.routeIndex];
    state.target.set(x,0,z);state.moving=true;return;
  }
  const reach=kind==='stonefish'?2.7:1.15;
  for(let attempt=0;attempt<140;attempt++){
    const angle=random()*Math.PI*2,distance=(.35+random()*.65)*reach;
    const x=position.x+Math.cos(angle)*distance,z=position.z+Math.sin(angle)*distance;
    if(kind==='turtle'&&Math.hypot(x-state.home.x,z-state.home.z)>2.1)continue;
    if(!visitorClear(kind,x,z,radius)||!pathClear(kind,position,x,z,radius)||!avoidsNest(state,x,z))continue;
    if(kind==='turtle'){
      let clear=true;
      for(let t=.1;t<=1;t+=.1)if(!avoidsNest(state,position.x+(x-position.x)*t,position.z+(z-position.z)*t)){clear=false;break;}
      if(!clear)continue;
    }
    state.target.set(x,0,z);state.moving=true;state.moveUntil=state.time+distance/(kind==='stonefish'?.045:.055)+2;
    return;
  }
  state.nextMove=state.time+4;
}

export function stepMarineVisitor(state:MarineVisitorState,delta:number,paused=false){
  if(paused)return;
  const dt=Math.max(0,Math.min(delta,.05));if(!dt)return;
  state.time+=dt;
  if(!state.moving&&state.time>=state.nextMove)chooseTarget(state);
  if(state.moving){
    const dx=state.target.x-state.position.x,dz=state.target.z-state.position.z,distance=Math.hypot(dx,dz);
    const desired=Math.atan2(-dz,dx),turn=Math.atan2(Math.sin(desired-state.heading),Math.cos(desired-state.heading));
    state.heading+=Math.max(-dt*.75,Math.min(dt*.75,turn));
    const speed=state.kind==='octopus'?.22+Math.max(0,Math.sin(state.time*.8+state.index*2))*.38:state.kind==='stonefish'?.045:.055;
    const move=Math.min(distance,speed*dt)*(state.kind==='octopus'&&Math.abs(turn)>.18?0:1);
    const x=state.position.x+(state.kind==='octopus'?dx/Math.max(distance,.0001):Math.cos(state.heading))*move;
    const z=state.position.z+(state.kind==='octopus'?dz/Math.max(distance,.0001):-Math.sin(state.heading))*move;
    const radius=state.kind==='octopus'?state.size*.85:state.kind==='stonefish'?.33:.58;
    if(visitorClear(state.kind,x,z,radius)&&avoidsNest(state,x,z))state.position.set(x,state.kind==='turtle'?terrainMeshHeight(x,z)+.005:marineFloorHeight(x,z)+.075,z);
    else if(state.kind!=='octopus')state.moveUntil=state.time;
    state.jet=state.kind==='octopus'?Math.min(1,move/dt/.35):0;
    if((state.kind==='octopus'?distance<=move+.00001:distance<.16||state.time>=state.moveUntil)){
      state.moving=false;state.jet=0;
      if(state.kind==='octopus'){
        if(reefHabitatContains(state.position.x,state.position.z))state.reefVisits++;else state.openVisits++;
        if(state.routeIndex===0||state.routeIndex===OCTOPUS_ROUTE.length-1){
          if(state.routeIndex===0)state.innerVisits++;else state.outerVisits++;
          state.routeDirection*=-1;
          state.nextMove=state.time+3+state.random()*5;
        }else state.nextMove=state.time;
      }else state.nextMove=state.time+(state.kind==='stonefish'?32+state.random()*55:30+state.random()*48);
    }
  }
}
