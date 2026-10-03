import { Vector3 } from 'three';
import { coastalCaveClearance } from './coastalCaveLayout';
import { getReefHabitat, marineFloorHeight } from './reefHabitat';
import { landDistance, seededRandom } from './terrain';
import { pelagicLaneClearance } from './pelagicFishState';
import { harborWaterHeight } from './waterSurface';
import { SEAGRASS_MEADOW, seagrassMeadowClearance } from './seagrassMeadowLayout';

const TAU=Math.PI*2;
const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
export function meadowFloor(x:number,z:number){return marineFloorHeight(x,z);}
export interface MeadowPlant {x:number;y:number;z:number;height:number;width:number;angle:number;form:number;tint:number}
export interface MeadowShell {x:number;y:number;z:number;size:number;angle:number;form:number}
export interface SurfacePlant {x:number;z:number;floor:number;radius:number;angle:number;rooted:boolean;leaves:number}
export function createMeadowPlan(){
  const random=seededRandom(947101),plants:MeadowPlant[]=[],shells:MeadowShell[]=[],floating:SurfacePlant[]=[],lilies:SurfacePlant[]=[];
  const roots=new Map<string,MeadowPlant[]>();
  const m=SEAGRASS_MEADOW,patches=Array.from({length:13},()=>({x:m.x+(random()-.5)*m.rx*1.5,z:m.z+(random()-.5)*m.rz*1.5,r:.8+random()*1.8}));
  for(let i=0;i<4400;i++)for(let attempt=0;attempt<30;attempt++){
    const patch=patches[i%patches.length],a=random()*TAU,r=Math.sqrt(random())*patch.r*(i%5===0?1.9:1);
    const scattered=i%5===0,extent=Math.sqrt(random())*.97;
    const x=scattered?m.x+Math.cos(a)*m.rx*extent:patch.x+Math.cos(a)*r,z=scattered?m.z+Math.sin(a)*m.rz*extent:patch.z+Math.sin(a)*r;
    if(seagrassMeadowClearance(x,z,.1)>0||coastalCaveClearance(x,z,.3)<0)continue;
    const cellX=Math.floor(x*10),cellZ=Math.floor(z*10);let crowded=false;
    for(let ix=cellX-1;ix<=cellX+1&&!crowded;ix++)for(let iz=cellZ-1;iz<=cellZ+1&&!crowded;iz++)crowded=(roots.get(`${ix},${iz}`)??[]).some(p=>Math.hypot(x-p.x,z-p.z)<.08);
    if(crowded)continue;
    const y=meadowFloor(x,z);if(y> -2.5||y< -7)continue;
    const grazed=Math.abs(z-m.z-.6*Math.sin((x-m.x)*.4))<.20;
    const plant={x,y:y-.02,z,height:grazed?.10+random()*.12:.17+random()*.35,width:.38+random()*.28,angle:random()*TAU,form:i%3,tint:random()};
    plants.push(plant);const key=`${cellX},${cellZ}`,cell=roots.get(key)??[];cell.push(plant);roots.set(key,cell);break;
  }
  for(let i=0;i<42;i++){
    const a=random()*TAU,r=Math.sqrt(random())*.88,x=m.x+Math.cos(a)*m.rx*r,z=m.z+Math.sin(a)*m.rz*r;
    shells.push({x,y:meadowFloor(x,z)+.035,z,size:.065+random()*.075,angle:random()*TAU,form:i%3});
  }
  // Surface growth is limited to sheltered margins, outside the full swept shipping lanes.
  const surfaceRegions=[[-64,-3],[-88,-40],[-19,29],[-34,-108],[43,-105],[60,-67],[-8,-122]];
  for(let i=0;i<21;i++)for(let attempt=0;attempt<180;attempt++){
    const region=surfaceRegions[i%surfaceRegions.length],x=region[0]+(random()-.5)*9,z=region[1]+(random()-.5)*9;
    const large=i%7===0,radius=large?1.2+random()*.55:.34+random()*.62;
    if(pelagicLaneClearance(x,z)<radius+5||landDistance(x,z)>-4||floating.some(p=>Math.hypot(x-p.x,z-p.z)<p.radius+radius+.3))continue;
    floating.push({x,z,floor:meadowFloor(x,z),radius,angle:random()*TAU,rooted:false,leaves:large?24:10});break;
  }
  for(const [cx,cz]of [[-40,1],[-40,4],[-38,7]])for(let i=0;i<3;i++)for(let attempt=0;attempt<40;attempt++){
    const x=cx+(random()-.5)*1.2,z=cz+(random()-.5)*1.1,floor=meadowFloor(x,z),radius=.16+random()*.10;
    if(floor>-.5||floor< -1.7||landDistance(x,z)>-1.4||pelagicLaneClearance(x,z)<5||lilies.some(p=>Math.hypot(x-p.x,z-p.z)<radius+p.radius))continue;
    lilies.push({x,z,floor,radius,angle:random()*TAU,rooted:true,leaves:1});break;
  }
  return {plants,shells,floating,lilies};
}

export interface ManateeState {index:number;size:number;position:Vector3;heading:number;pitch:number;tail:number;flipper:number;graze:number;breath:number;radius:number;time:number}
export const MANATEE_SIZES=[.94,1.04,.79] as const;
function travelPhase(time:number,index:number){
  const clock=Math.max(0,time)+index*11,cycle=Math.floor(clock/48),age=clock-cycle*48;
  return (cycle+smooth((age-10)/38))*TAU/8+index*TAU/3;
}
export function manateeRoutePoint(time:number,index:number,point=new Vector3()){
  const phase=travelPhase(time,index);return point.set(SEAGRASS_MEADOW.x+Math.cos(phase)*6,0,SEAGRASS_MEADOW.z+Math.sin(phase)*3.7);
}
function bodyFloor(x:number,z:number,heading:number,size:number){
  let highest=meadowFloor(x,z);const c=Math.cos(heading),s=Math.sin(heading);
  for(const [along,across]of [[-1.97,0],[-1.5,-.58],[-1.5,.58],[-.65,-.6],[-.65,.6],[.6,-.8],[.6,.8],[1.47,0]])
    highest=Math.max(highest,meadowFloor(x+(c*along+s*across)*size,z+(-s*along+c*across)*size));
  return highest;
}
// The habitat is sampled once. Interpolating a dense conservative floor profile avoids per-frame terrain queries.
const SAMPLES=384,profile:Float32Array[]=[];
export function meadowObstacleClearance(x:number,z:number,radius:number){
  let clear=-landDistance(x,z)-radius;const habitat=getReefHabitat();
  for(const obstacle of [...habitat.rocks,...habitat.colonies,...habitat.kelp])clear=Math.min(clear,Math.hypot(x-obstacle.x,z-obstacle.z)-obstacle.radius-radius);
  return Math.min(clear,coastalCaveClearance(x,z,radius));
}
function ensureProfile(){
  if(profile.length)return;
  for(const size of MANATEE_SIZES){
    const heights=new Float32Array(SAMPLES+1);
    for(let i=0;i<=SAMPLES;i++){
      const a=i/SAMPLES*TAU,x=SEAGRASS_MEADOW.x+Math.cos(a)*6,z=SEAGRASS_MEADOW.z+Math.sin(a)*3.7,heading=Math.atan2(-Math.cos(a)*3.7,-Math.sin(a)*6);
      heights[i]=bodyFloor(x,z,heading,size)+.12;
    }
    profile.push(heights);
  }
}
export function sampleManatee(state:ManateeState,time:number,waterTime=time){
  ensureProfile();const phase=travelPhase(time,state.index),a=((phase%TAU)+TAU)%TAU;
  manateeRoutePoint(time,state.index,state.position);state.heading=Math.atan2(-Math.cos(a)*3.7,-Math.sin(a)*6);state.pitch=0;
  const u=a/TAU*SAMPLES,i=Math.floor(u),floor=profile[state.index][i]*(1-u+i)+profile[state.index][i+1]*(u-i);
  const age=(time+state.index*11)%48,rest=1-smooth((age-8)/6),grazing=(.55+.45*Math.sin(time*.38+state.index*1.7)**2)*(1-smooth((age-14)/12));
  // Breaths occur only on the western side, well clear of every shipping route.
  const fromWest=Math.atan2(Math.sin(a-Math.PI),Math.cos(a-Math.PI));
  state.breath=Math.abs(fromWest)<.56?Math.cos(fromWest/.56*Math.PI/2)**4:0;
  state.graze=grazing*(1-state.breath);state.tail=Math.sin(time*(rest>.5?.9:1.6)+state.index)*(.045+.105*(1-rest));
  state.flipper=Math.sin(time*.9+state.index*1.3)*.14;state.time=time;
  const bottom=floor+.43*state.size,water=harborWaterHeight(state.position.x,state.position.z,waterTime);
  state.position.y=bottom+(water-.16*state.size-bottom)*state.breath;
}
export function createManatees(){
  return MANATEE_SIZES.map((size,index)=>{const state:ManateeState={index,size,position:new Vector3(),heading:0,pitch:0,tail:0,flipper:0,graze:0,breath:0,radius:2.05*size,time:0};sampleManatee(state,0);return state;});
}
export interface MeadowScamper {index:number;home:Vector3;position:Vector3;heading:number;legPhase:number;size:number;moving:boolean}
export function createMeadowScamperers(){
  const random=seededRandom(44507),states:MeadowScamper[]=[];
  for(let i=0;i<12;i++)for(let attempt=0;attempt<400;attempt++){
    const a=random()*TAU,r=Math.sqrt(random()),x=SEAGRASS_MEADOW.x+Math.cos(a)*3*r,z=SEAGRASS_MEADOW.z+Math.sin(a)*.95*r;
    if(states.some(s=>Math.hypot(x-s.home.x,z-s.home.z)<.72))continue;
    const home=new Vector3(x,meadowFloor(x,z),z);states.push({index:i,home,position:home.clone(),heading:random()*TAU,legPhase:0,size:.7+random()*.35,moving:false});break;
  }
  return states;
}
export function sampleMeadowScamperer(state:MeadowScamper,time:number){
  const clock=time+state.index*4.1,cycle=Math.floor(clock/23),age=clock-cycle*23,travel=smooth((age-20)/3),phase=(cycle+travel)*1.7+state.index;
  state.position.set(state.home.x+Math.cos(phase)*.11,0,state.home.z+Math.sin(phase)*.075);state.position.y=meadowFloor(state.position.x,state.position.z)+.06*state.size;
  state.heading=Math.atan2(-Math.cos(phase)*.075,-Math.sin(phase)*.11);state.moving=age>20;state.legPhase=state.moving?time*24+state.index:state.index;
}
