import { Vector3 } from 'three';
import { getReefHabitat, marineFloorHeight, reefHabitatContains, reefFerryClearance } from './reefHabitat';
import { createLandscapePlan, ISLANDS, islandContour, landDistance, seededRandom, terrainMeshHeight } from './terrain';

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
export type TurtleStage = 'arriving' | 'digging' | 'guarding' | 'leaving' | 'incubating' | 'hatching' | 'resting-at-sea';
export interface TurtleNursery {
  water:Vector3; guardSeconds:number; incubationSeconds:number; offset:number;
  stage:TurtleStage; stageTime:number; eggsExposed:number; hatchStart:number; cycleSeconds:number;
}
export interface MarineVisitorState {
  kind: VisitorKind; index: number; size: number; position: Vector3; home: Vector3; nest: Vector3; target: Vector3;
  heading: number; time: number; moving: boolean; moveUntil: number; nextMove: number;
  jet: number; reefVisits: number; openVisits: number; innerVisits: number; outerVisits: number;
  routeIndex: number; routeDirection: number; random: () => number; nursery?:TurtleNursery;
}

let beachObstacles:{x:number;z:number;radius:number}[]|undefined;
export function turtleRouteClear(x:number,z:number,radius:number){
  if(!beachObstacles){
    const plan=createLandscapePlan();
    beachObstacles=[...plan.structures,...plan.rocks,...plan.trees.map(tree=>({...tree,radius:tree.radius*.15+.1}))];
  }
  return beachObstacles.every(obstacle=>Math.hypot(x-obstacle.x,z-obstacle.z)>obstacle.radius+radius+.04);
}

/** Check the complete occupied disc, including floor under the swept arms or shell. */
export function visitorClear(kind: VisitorKind, x: number, z: number, radius: number) {
  if (kind === 'turtle') {
    if(!turtleRouteClear(x,z,radius))return false;
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

const CRAWL_SECONDS=150, DIG_SECONDS=42, HATCH_SECONDS=240;
const smooth=(t:number)=>{const v=Math.max(0,Math.min(1,t));return v*v*(3-2*v);};

function turtleWater(home:Vector3){
  const island=ISLANDS.reduce((best,item)=>Math.hypot(home.x-item.x,home.z-item.z)<Math.hypot(home.x-best.x,home.z-best.z)?item:best,ISLANDS[0]);
  const heading=Math.atan2(home.z-island.z,home.x-island.x);
  for(const turn of [0,.2,-.2,.4,-.4,.65,-.65]){
    const a=heading+turn;
    for(let d=5;d<20;d+=.5){
      const x=home.x+Math.cos(a)*d,z=home.z+Math.sin(a)*d;
      if(landDistance(x,z)>-3.2||terrainMeshHeight(x,z)>-.7)continue;
      let clear=true;
      for(let n=1;n<=40;n++){
        const px=home.x+(x-home.x)*n/40,pz=home.z+(z-home.z)*n/40;
        if(terrainMeshHeight(px,pz)>home.y+.15||!turtleRouteClear(px,pz,.58)){clear=false;break;}
      }
      if(clear)return new Vector3(x,-.35,z);
    }
  }
  throw new Error('No gentle turtle beach-to-water route');
}

/** Real-time nesting schedule; direct sampling also makes hour-long lifecycle QA deterministic. */
export function sampleTurtleCycle(state:MarineVisitorState,elapsedSeconds:number){
  const nursery=state.nursery;if(!nursery)return;
  const time=((Math.max(0,elapsedSeconds)+nursery.offset)%nursery.cycleSeconds);
  const guardedAt=CRAWL_SECONDS+DIG_SECONDS;
  const departureAt=guardedAt+nursery.guardSeconds;
  const seaAt=departureAt+CRAWL_SECONDS;
  const hatchAt=seaAt+nursery.incubationSeconds;
  nursery.hatchStart=hatchAt;
  let from=state.home,to=state.home,progress=0;
  if(time<CRAWL_SECONDS){nursery.stage='arriving';nursery.stageTime=time;from=nursery.water;to=state.home;progress=smooth(time/CRAWL_SECONDS);}
  else if(time<guardedAt){nursery.stage='digging';nursery.stageTime=time-CRAWL_SECONDS;}
  else if(time<departureAt){nursery.stage='guarding';nursery.stageTime=time-guardedAt;}
  else if(time<seaAt){nursery.stage='leaving';nursery.stageTime=time-departureAt;from=state.home;to=nursery.water;progress=smooth(nursery.stageTime/CRAWL_SECONDS);}
  else if(time<hatchAt){nursery.stage='incubating';nursery.stageTime=time-seaAt;from=to=nursery.water;}
  else if(time<hatchAt+HATCH_SECONDS){nursery.stage='hatching';nursery.stageTime=time-hatchAt;from=to=nursery.water;}
  else{nursery.stage='resting-at-sea';nursery.stageTime=time-hatchAt-HATCH_SECONDS;from=to=nursery.water;}
  state.position.copy(from).lerp(to,progress);
  if(nursery.stage==='digging'){
    const approach=smooth(nursery.stageTime/10)*(1-smooth((nursery.stageTime-30)/12));
    const distance=Math.hypot(state.home.x-state.nest.x,state.home.z-state.nest.z);
    state.position.x+=(state.nest.x-state.home.x)*(1-.65/distance)*approach;
    state.position.z+=(state.nest.z-state.home.z)*(1-.65/distance)*approach;
  }
  state.position.y=Math.max(-.35,terrainMeshHeight(state.position.x,state.position.z)+.008);
  const moving=from!==to;
  const guardedHeading=Math.atan2(state.nest.z-state.home.z,state.home.x-state.nest.x);
  const arrivingHeading=Math.atan2(nursery.water.z-state.home.z,state.home.x-nursery.water.x);
  if(moving){
    const heading=Math.atan2(from.z-to.z,to.x-from.x);
    const difference=Math.atan2(Math.sin(heading-guardedHeading),Math.cos(heading-guardedHeading));
    state.heading=nursery.stage==='leaving'?guardedHeading+difference*smooth(nursery.stageTime/12):heading;
  }else if(nursery.stage==='digging'){
    const difference=Math.atan2(Math.sin(guardedHeading-arrivingHeading),Math.cos(guardedHeading-arrivingHeading));
    state.heading=arrivingHeading+difference*smooth(nursery.stageTime/10);
  }else if(nursery.stage==='guarding')state.heading=guardedHeading;
  state.moving=moving;
  // Most eggs are buried. The small revealed clutch is visible while digging and just before hatching.
  nursery.eggsExposed=nursery.stage==='digging'?Math.sin(Math.PI*nursery.stageTime/DIG_SECONDS):nursery.stage==='hatching'?Math.max(0,1-nursery.stageTime/55):0;
}

export function turtleHatchlingPose(state:MarineVisitorState,index:number,target:Vector3){
  const nursery=state.nursery!;
  const age=nursery.stageTime-index*7;
  const visible=nursery.stage==='hatching'&&age>=0&&age<185;
  const progress=smooth(age/165);
  const directionX=nursery.water.x-state.nest.x,directionZ=nursery.water.z-state.nest.z;
  const length=Math.hypot(directionX,directionZ),lane=(index-2.5)*.13;
  const wobble=Math.sin(age*.42+index)*.035*Math.sin(Math.PI*progress);
  target.copy(state.nest).lerp(nursery.water,progress);
  target.x+=(directionZ/length)*(lane+wobble)*Math.sin(Math.PI*progress);
  target.z-=(directionX/length)*(lane+wobble)*Math.sin(Math.PI*progress);
  target.y=Math.max(-.32,terrainMeshHeight(target.x,target.z)+.009);
  return {visible,heading:Math.atan2(-directionZ,directionX),swimming:target.y<-.08};
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
  if(kind==='turtle'){
    const guardSeconds=1200+index*270,incubationSeconds=600+index*240;
    state.nursery={water:turtleWater(state.home),guardSeconds,incubationSeconds,offset:index===1?0:CRAWL_SECONDS+DIG_SECONDS+index*120,stage:'arriving',stageTime:0,eggsExposed:0,hatchStart:0,cycleSeconds:CRAWL_SECONDS*2+DIG_SECONDS+guardSeconds+incubationSeconds+HATCH_SECONDS+180};
    sampleTurtleCycle(state,0);
  }
  return state;
}

function chooseTarget(state:MarineVisitorState) {
  const {kind,position,random,size}=state,radius=kind==='octopus'?size*.85:kind==='stonefish'?.33:.58;
  if(kind==='octopus'){
    state.routeIndex+=state.routeDirection;
    const [x,z]=OCTOPUS_ROUTE[state.routeIndex];
    state.target.set(x,0,z);state.moving=true;return;
  }
  const reach=2.7;
  for(let attempt=0;attempt<140;attempt++){
    const angle=random()*Math.PI*2,distance=(.35+random()*.65)*reach;
    const x=position.x+Math.cos(angle)*distance,z=position.z+Math.sin(angle)*distance;
    if(!visitorClear(kind,x,z,radius)||!pathClear(kind,position,x,z,radius))continue;
    state.target.set(x,0,z);state.moving=true;state.moveUntil=state.time+distance/.045+2;return;
  }
  state.nextMove=state.time+4;
}

export function stepMarineVisitor(state:MarineVisitorState,delta:number,paused=false){
  if(paused)return;
  const dt=Math.max(0,Math.min(delta,.05));if(!dt)return;
  state.time+=state.kind==='turtle'?Math.max(0,Math.min(delta,.5)):dt;
  if(state.kind==='turtle'){sampleTurtleCycle(state,state.time);return;}
  if(!state.moving&&state.time>=state.nextMove)chooseTarget(state);
  if(state.moving){
    const dx=state.target.x-state.position.x,dz=state.target.z-state.position.z,distance=Math.hypot(dx,dz);
    const desired=Math.atan2(-dz,dx),turn=Math.atan2(Math.sin(desired-state.heading),Math.cos(desired-state.heading));
    state.heading+=Math.max(-dt*.75,Math.min(dt*.75,turn));
    const speed=state.kind==='octopus'?.12+Math.pow(Math.max(0,Math.sin(state.time*1.55+state.index*2)),4)*.9:state.kind==='stonefish'?.045:.055;
    const move=Math.min(distance,speed*dt)*(state.kind==='octopus'&&Math.abs(turn)>.18?0:1);
    const x=state.position.x+(state.kind==='octopus'?dx/Math.max(distance,.0001):Math.cos(state.heading))*move;
    const z=state.position.z+(state.kind==='octopus'?dz/Math.max(distance,.0001):-Math.sin(state.heading))*move;
    const radius=state.kind==='octopus'?state.size*.85:state.kind==='stonefish'?.33:.58;
    if(visitorClear(state.kind,x,z,radius))state.position.set(x,marineFloorHeight(x,z)+.075,z);
    else if(state.kind!=='octopus')state.moveUntil=state.time;
    state.jet=state.kind==='octopus'?Math.pow(Math.max(0,Math.sin(state.time*1.55+state.index*2)),4):0;
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
