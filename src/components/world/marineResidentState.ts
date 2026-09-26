import { Vector3 } from 'three';
import { seededRandom, landDistance, terrainMeshHeight } from './terrain';
import { marineFloorHeight, reefFloorHeight } from './reefHabitat';
import { visitorClear } from './marineVisitorState';

export type ResidentKind='crawling-octopus'|'sea-snake'|'squid';
export interface MarineResident {kind:ResidentKind;index:number;size:number;radius:number;position:Vector3;home:Vector3;target:Vector3;heading:number;pitch:number;time:number;moving:boolean;nextMove:number;jet:number;distance:number;strokePhase:number;swimSpeed:number;random:()=>number}
export const RESIDENT_COUNTS={'crawling-octopus':4,'sea-snake':2,'squid':5} as const;
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const centers=[[-8,-36],[-51,-33],[9,-43],[-60,-36],[-18,-45]];
export function residentHeight(kind:ResidentKind,x:number,z:number,time:number,index:number){
  const floor=Math.max(marineFloorHeight(x,z),terrainMeshHeight(x,z));
  return kind==='squid'?Math.min(-1.35,floor+1.4+Math.sin(time*.31+index)*.20):kind==='sea-snake'?Math.min(-1.45,floor+.92+Math.sin(time*.18+index)*.05):floor+.055;
}
export function residentPositionClear(x:number,z:number,radius:number){return visitorClear('octopus',x,z,radius);}
function residentSegmentClear(ax:number,az:number,bx:number,bz:number,radius:number){
  const steps=Math.ceil(Math.hypot(bx-ax,bz-az)/.16);
  for(let i=0;i<=steps;i++)if(!residentPositionClear(ax+(bx-ax)*i/steps,az+(bz-az)*i/steps,radius))return false;
  return true;
}
export function createMarineResidentsState(){
  const states:MarineResident[]=[];
  for(const kind of Object.keys(RESIDENT_COUNTS) as ResidentKind[])for(let index=0;index<RESIDENT_COUNTS[kind];index++){
    const seed=27133+index*9331+(kind==='squid'?71209:kind==='sea-snake'?31177:0),random=seededRandom(seed);
    const size=kind==='crawling-octopus'?.78+index*.10:kind==='sea-snake'?.73+index*.17:.62+index*.095;
    const radius=kind==='crawling-octopus'?size*.91:kind==='sea-snake'?size*1.36:size*.75;
    let position:Vector3|undefined;
    for(let attempt=0;attempt<3000;attempt++){
      const [cx,cz]=centers[(index+Math.floor(attempt/300))%centers.length],x=cx+(random()-.5)*13,z=cz+(random()-.5)*11;
      if(!residentPositionClear(x,z,radius)||states.some(other=>Math.hypot(x-other.home.x,z-other.home.z)<radius+other.radius+1.3))continue;
      if(kind==='sea-snake'&&!Array.from({length:12},(_,n)=>n*Math.PI/6).some(a=>residentSegmentClear(x,z,x+Math.cos(a)*2.5,z+Math.sin(a)*2.5,radius)))continue;
      position=new Vector3(x,residentHeight(kind,x,z,0,index),z);break;
    }
    if(!position)throw new Error(`No clear ${kind} home ${index}`);
    states.push({kind,index,size,radius,position,home:position.clone(),target:position.clone(),heading:random()*Math.PI*2,pitch:0,time:0,moving:false,nextMove:index===0?1:3+random()*7,jet:0,distance:0,strokePhase:random()*Math.PI*2,swimSpeed:0,random});
  }
  return states;
}
function chooseResidentTarget(state:MarineResident){
  for(let attempt=0;attempt<90;attempt++){
    const a=state.random()*Math.PI*2,length=state.kind==='squid'?2+state.random()*4:state.kind==='sea-snake'?1.8+state.random()*2.3:.7+state.random()*2;
    const x=state.position.x+Math.cos(a)*length,z=state.position.z+Math.sin(a)*length;
    if(Math.hypot(x-state.home.x,z-state.home.z)>7)continue;
    if(!residentSegmentClear(state.position.x,state.position.z,x,z,state.radius))continue;
    state.target.set(x,0,z);state.moving=true;return;
  }
  state.nextMove=state.time+2;
}
export function stepMarineResidents(states:MarineResident[],delta:number,paused=false){
  if(paused||!Number.isFinite(delta)||delta<=0)return;
  const dt=Math.min(.05,delta);
  for(const state of states){
    state.time+=dt;
    if(state.kind!=='crawling-octopus'&&!state.moving){
      const targetY=residentHeight(state.kind,state.position.x,state.position.z,state.time,state.index);
      state.position.y+=Math.max(-dt*.7,Math.min(dt*.7,targetY-state.position.y));
    }
    if(!state.moving&&state.time>=state.nextMove)chooseResidentTarget(state);
    const stroke=(state.time+state.index*2.1)%5.7;
    state.jet=state.kind==='squid'?Math.max(0,Math.sin(state.time*2.2+state.index*1.7))**5:state.kind==='sea-snake'&&state.moving&&stroke<1.65?Math.sin(Math.PI*stroke/1.65)**2:0;
    state.strokePhase+=dt*(state.moving?.38+state.jet*4.7:.10);
    const snakeSpeed=state.moving?.07+state.jet*.69:0;
    state.swimSpeed+=Math.max(-.48*dt,Math.min(.48*dt,snakeSpeed-state.swimSpeed));
    if(state.moving){
      const dx=state.target.x-state.position.x,dz=state.target.z-state.position.z,distance=Math.hypot(dx,dz),turn=wrap(Math.atan2(-dz,dx)-state.heading);
      state.heading+=Math.max(-dt*1.7,Math.min(dt*1.7,turn));
      const speed=state.kind==='squid'?.16+state.jet*1.45:state.kind==='sea-snake'?state.swimSpeed:.10+.08*Math.sin(state.time*2)**2;
      const move=Math.abs(turn)>.25?0:Math.min(distance,speed*dt),x=state.position.x+dx/Math.max(distance,.0001)*move,z=state.position.z+dz/Math.max(distance,.0001)*move;
      const desiredY=residentHeight(state.kind,x,z,state.time,state.index);
      const y=state.kind==='crawling-octopus'?desiredY:state.position.y+Math.max(-dt*.7,Math.min(dt*.7,desiredY-state.position.y));
      const occupied=states.some(other=>other!==state&&Math.abs(other.position.y-y)<.48&&Math.hypot(x-other.position.x,z-other.position.z)<state.radius+other.radius);
      if(!occupied&&residentPositionClear(x,z,state.radius)){state.position.set(x,y,z);state.distance+=move;}
      else{state.moving=false;state.nextMove=state.time+1+state.random()*2;}
      if(distance<.05){state.moving=false;state.nextMove=state.time+(state.kind==='squid'?1+state.random()*3:state.kind==='sea-snake'?14+state.random()*22:9+state.random()*18);}
    }
    const dx=Math.cos(state.heading)*.25,dz=-Math.sin(state.heading)*.25;
    state.pitch=state.kind!=='crawling-octopus'?.035*Math.sin(state.time*.4+state.index):Math.atan((marineFloorHeight(state.position.x+dx,state.position.z+dz)-marineFloorHeight(state.position.x-dx,state.position.z-dz))/.5);
  }
}

export const WHALE_CYCLE=480;
export const WHALE_BREACH_AT=222;
export function whaleRoutePoint(elapsed:number,target=new Vector3()){
  const a=elapsed*.0039+.6;
  return target.set(-163+Math.cos(a)*27,0,22+Math.sin(a)*23);
}
export function offshoreWhaleClear(x:number,z:number){return landDistance(x,z)<-38&&reefFloorHeight(x,z)<-20;}
/** One rare offshore breach, with an independent slow surfacing/breathing rhythm. */
export function sampleOffshoreWhale(elapsed:number){
  const time=Math.max(0,elapsed),cycle=Math.floor(time/WHALE_CYCLE),age=time%WHALE_CYCLE;
  const breachAt=WHALE_BREACH_AT+(cycle%3)*31,breachAge=age-breachAt,breaching=breachAge>=0&&breachAge<=8;
  const position=whaleRoutePoint(time),next=whaleRoutePoint(time+.1),heading=Math.atan2(-(next.z-position.z),next.x-position.x);
  const breathAge=(time+17)%73,breathing=breathAge>=0&&breathAge<14;
  const surface=breathing?Math.sin(Math.PI*breathAge/14)**2:0;
  position.y=breaching?-4.4+7.7*Math.sin(Math.PI*breachAge/8):-4.8+4.15*surface;
  const pitch=breaching?.30+.95*Math.sin(Math.PI*breachAge/8)-.60*(breachAge/8):.045*Math.sin(time*.28);
  const splashAge=breachAge-6.8,spoutAge=breathAge-6.3;
  const splashPoint=whaleRoutePoint(cycle*WHALE_CYCLE+breachAt+6.8);
  return {position,heading,pitch,breaching,breachAge,splashAge,splashPoint,spoutAge,spouting:!breaching&&spoutAge>=0&&spoutAge<2.4,visible:breaching||breathing};
}
