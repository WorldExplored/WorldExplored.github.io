import { CatmullRomCurve3, Vector3 } from 'three';
import type { QualityTier } from '../../content/world';
import { HARBOR_OBSTACLES, createCityFerryRoute } from './cityInfrastructure';
import { MYTHIC_GROTTO, coastalCaveClearance } from './coastalCaveLayout';
import { createVesselRoute, vesselClearance } from './marineTraffic';
import { getReefHabitat, marineFloorHeight } from './reefHabitat';
import { landDistance, seededRandom, terrainMeshHeight } from './terrain';
import { harborWaterHeight } from './waterSurface';

export type PelagicSpecies = 'marlin' | 'flying' | 'lionfish' | 'cave-silver';
export const PELAGIC_COUNTS: Record<PelagicSpecies, Record<QualityTier, number>> = {
  marlin: { high: 2, medium: 2, low: 1 }, flying: { high: 18, medium: 12, low: 6 },
  lionfish: { high: 6, medium: 4, low: 2 }, 'cave-silver': { high: 18, medium: 12, low: 7 },
};
export const FLYING_PERIOD = 47, FLYING_GRAVITY = 9.81;
const TAKEOFF = .42, GLIDE = 1.35, LAUNCH = 4.4, LIFT_ACCELERATION = .65;
const TAU = Math.PI * 2;
const clamp = (x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth = (x:number)=>{const t=clamp(x);return t*t*(3-2*t);};

/** Ballistic climb, lift-supported glide, then a folded-wing gravitational descent. */
export function flyingVertical(age:number) {
  if(age<0)return {height:0,velocity:LAUNCH,spread:0,stage:'swim' as const};
  const crest=LAUNCH*TAKEOFF-.5*FLYING_GRAVITY*TAKEOFF*TAKEOFF,crestVelocity=LAUNCH-FLYING_GRAVITY*TAKEOFF;
  if(age<TAKEOFF)return {height:LAUNCH*age-.5*FLYING_GRAVITY*age*age,velocity:LAUNCH-FLYING_GRAVITY*age,spread:smooth(age/.22),stage:'climb' as const};
  const glideAge=Math.min(GLIDE,age-TAKEOFF);
  const height=crest+crestVelocity*glideAge-.5*LIFT_ACCELERATION*glideAge*glideAge,velocity=crestVelocity-LIFT_ACCELERATION*glideAge;
  if(age<TAKEOFF+GLIDE)return {height,velocity,spread:1,stage:'glide' as const};
  const fall=age-TAKEOFF-GLIDE;
  return {height:height+velocity*fall-.5*FLYING_GRAVITY*fall*fall,velocity:velocity-FLYING_GRAVITY*fall,spread:1-smooth(fall/.3),stage:'descent' as const};
}

function ellipse(cx:number,cz:number,rx:number,rz:number,y=0) {
  const curve=new CatmullRomCurve3(Array.from({length:32},(_,i)=>{const a=i/32*TAU;return new Vector3(cx+Math.cos(a)*rx,y,cz+Math.sin(a)*rz);}),true,'centripetal');
  curve.arcLengthDivisions=512;curve.updateArcLengths();return {curve,length:curve.getLength()};
}
type Course=ReturnType<typeof ellipse>;
let flyingCourse:Course|undefined,marlinCourse:Course|undefined;
export function flyingFishCourse(){return flyingCourse??=ellipse(-4,-1,48,43);}
export function marlinFishCourse(){return marlinCourse??=ellipse(-4,-1,50,43);}
const routePoint=new Vector3(),tangent=new Vector3();
function sampleCourse(course:Course,distance:number,position:Vector3,heading:Vector3){
  const u=((distance/course.length)%1+1)%1;course.curve.getPointAt(u,position);course.curve.getTangentAt(u,heading);
}
let lanes:Vector3[]|undefined;
export function pelagicLaneClearance(x:number,z:number){
  lanes??=[...createCityFerryRoute().curve.getSpacedPoints(140),...[0,1,2].flatMap(i=>createVesselRoute(i).curve.getSpacedPoints(i===2?650:260))];
  let distance=Infinity;for(const p of lanes)distance=Math.min(distance,Math.hypot(x-p.x,z-p.z));return distance;
}
export function pelagicCoastClearance(x:number,z:number){
  let distance=-landDistance(x,z);
  for(const box of HARBOR_OBSTACLES){const dx=Math.max(box.minX-x,0,x-box.maxX),dz=Math.max(box.minZ-z,0,z-box.maxZ);distance=Math.min(distance,Math.hypot(dx,dz));}
  return distance;
}
let obstacles:ReturnType<typeof getReefHabitat>['rocks']|undefined;
/** The real reef roofs and floors, including the thin layer above the island shelf. */
export function pelagicFloor(x:number,z:number,radius:number){
  let floor=Math.max(marineFloorHeight(x,z),terrainMeshHeight(x,z));
  obstacles??=[...getReefHabitat().rocks,...getReefHabitat().colonies,...getReefHabitat().kelp];
  for(const obstacle of obstacles)if(Math.hypot(x-obstacle.x,z-obstacle.z)<obstacle.radius+radius)floor=Math.max(floor,obstacle.y+obstacle.height);
  return floor;
}
function flyingDistance(time:number){
  const periodAge=Math.max(0,time-11),cycle=Math.floor(periodAge/FLYING_PERIOD),age=Math.min(7.5,periodAge-cycle*FLYING_PERIOD);
  const acceleration=cycle*6+1.6*(age*.5-7.5/(4*Math.PI)*Math.sin(2*Math.PI*age/7.5));
  return flyingFishCourse().length*.095+time*1.55+acceleration;
}
export function flyingSchoolPoint(index:number,time:number,position:Vector3,heading=new Vector3()) {
  const lane=(index%3-1)*.74+Math.sin(time*.27+index*2.399)*.045;
  sampleCourse(flyingFishCourse(),flyingDistance(time)-Math.floor(index/3)*1.12-(index%3)*.17,position,heading);
  position.x+=heading.z*lane;position.z-=heading.x*lane;
  return position;
}
interface FlightEvent { cycle:number; start:number; end:number; height:number; allowed:boolean; reentry:Vector3 }
export interface PelagicFish {
  species:PelagicSpecies;index:number;size:number;position:Vector3;heading:number;pitch:number;finSpread:number;tail:number;
  course:Course;offset:number;speed:number;time:number;event:FlightEvent|null;phase:'swim'|'climb'|'glide'|'descent'|'dive';
  splash:Vector3;splashAge:number;contacts:number;
}
function flightEvent(index:number,cycle:number):FlightEvent {
  const random=seededRandom(83017+cycle*917+index*1471),start=12+cycle*FLYING_PERIOD+index*.087+random()*.24+(Math.sin(cycle*2.37)*.65);
  flyingSchoolPoint(index,start,routePoint,tangent);const height=harborWaterHeight(routePoint.x,routePoint.z,start);
  let allowed=true;
  for(let dt=0;dt<=3.3;dt+=.3){flyingSchoolPoint(index,start+dt,routePoint,tangent);if(pelagicLaneClearance(routePoint.x,routePoint.z)<5.2||pelagicCoastClearance(routePoint.x,routePoint.z)<1.6)allowed=false;}
  let lo=TAKEOFF+GLIDE,hi=3.4;
  for(let n=0;n<28;n++){
    const age=(lo+hi)*.5;flyingSchoolPoint(index,start+age,routePoint,tangent);
    if(height+flyingVertical(age).height>harborWaterHeight(routePoint.x,routePoint.z,start+age))lo=age;else hi=age;
  }
  const end=start+(lo+hi)*.5,reentry=flyingSchoolPoint(index,end,new Vector3());reentry.y=harborWaterHeight(reentry.x,reentry.z,end);
  return {cycle,start,end,height,allowed,reentry};
}
function hoverCourse(index:number,caveSchool=false){
  const random=seededRandom(4997+index*881+(caveSchool?8833:0));
  const anchors=caveSchool?[[MYTHIC_GROTTO.x-6,MYTHIC_GROTTO.z+6],[MYTHIC_GROTTO.x+6,MYTHIC_GROTTO.z+7],[MYTHIC_GROTTO.x,MYTHIC_GROTTO.z+10.5]]:[[MYTHIC_GROTTO.x-7,MYTHIC_GROTTO.z+5],[MYTHIC_GROTTO.x+7,MYTHIC_GROTTO.z+6],[14,-43],[-66,-49],[-21,-43],[0,-35]];
  for(let attempt=0;attempt<360;attempt++){
    const center=anchors[(index+Math.floor(attempt/120))%anchors.length],x=center[0]+(random()-.5)*(caveSchool?2:7),z=center[1]+(random()-.5)*(caveSchool?1:6);
    const rx=caveSchool?1.5:1.0+random()*1.1,rz=caveSchool?.85:.7+random()*.7,radius=caveSchool?.24:.5;
    const course=ellipse(x,z,rx,rz);let top=-2.3,valid=true;
    for(const p of course.curve.getSpacedPoints(48)){
      if(pelagicCoastClearance(p.x,p.z)<radius+.8||coastalCaveClearance(p.x,p.z,radius)<.3){valid=false;break;}
      top=Math.max(top,pelagicFloor(p.x,p.z,radius)+radius+.22);
    }
    if(!valid||top>-.95)continue;
    for(const p of course.curve.points)p.y=top;course.curve.updateArcLengths();course.length=course.curve.getLength();return course;
  }
  // A changed reef may close every candidate. Omit that group rather than crashing the world or placing fish inside rock.
  return null;
}
export function createPelagicFish(){
  const result:PelagicFish[]=[],shoal=hoverCourse(0,true);
  for(const species of Object.keys(PELAGIC_COUNTS)as PelagicSpecies[])for(let index=0;index<PELAGIC_COUNTS[species].high;index++){
    const course=species==='marlin'?marlinFishCourse():species==='flying'?flyingFishCourse():species==='lionfish'?hoverCourse(index):shoal;
    if(!course)continue;
    const fish:PelagicFish={species,index,size:species==='marlin'?.88+index*.14:species==='flying'?.82+(index%5)*.043:species==='lionfish'?.82+(index%3)*.11:.43+(index%4)*.035,
      position:new Vector3(),heading:0,pitch:0,finSpread:0,tail:0,course,offset:species==='marlin'?course.length*(.32+index*.44):species==='cave-silver'?index*.47:index*2.399,
      speed:species==='marlin'?1.7+index*.15:species==='lionfish'?.16+index*.019:.40,time:0,event:null,phase:'swim',splash:new Vector3(),splashAge:100,contacts:0};
    samplePelagicFish(fish,0);result.push(fish);
  }
  return result;
}
export function samplePelagicFish(fish:PelagicFish,time:number){
  fish.time=Math.max(0,time);fish.phase='swim';fish.finSpread=0;
  if(fish.species==='flying'){
    flyingSchoolPoint(fish.index,time,fish.position,tangent);fish.heading=Math.atan2(-tangent.z,tangent.x);
    const water=harborWaterHeight(fish.position.x,fish.position.z,time),clear=vesselClearance(fish.position.x,fish.position.z,.42);
    const swim=water-.65-smooth((7-clear)/5)*1.9;
    fish.position.y=swim;fish.pitch=.025*Math.sin(time*.8+fish.index);
    const cycle=Math.floor((time-11)/FLYING_PERIOD);
    if(cycle>=0&&fish.event?.cycle!==cycle)fish.event=flightEvent(fish.index,cycle);
    const event=fish.event;
    if(event?.allowed){
      const age=time-event.start;
      if(age>=-.45&&age<0){const t=smooth((age+.45)/.45);fish.position.y=swim*(1-t)+event.height*t;fish.pitch=.12*t;}
      else if(age>=0&&time<=event.end){const jump=flyingVertical(age);fish.position.y=event.height+jump.height;fish.pitch=Math.atan2(jump.velocity,2.6);fish.finSpread=jump.spread;fish.phase=jump.stage==='swim'?'climb':jump.stage;}
      else if(time>event.end&&time<event.end+.75){const age=time-event.end,t=smooth(age/.75);fish.position.y=water+(swim-water)*t;fish.pitch=-.45*Math.sin(Math.PI*age/.75);fish.phase='dive';}
      if(time>=event.end){fish.splash.copy(event.reentry);fish.splashAge=time-event.end;}
    }
    fish.tail=Math.sin(time*(fish.phase==='swim'?23:5)+fish.index*2.399)*(fish.phase==='swim'?.25:.035);
  }else{
    sampleCourse(fish.course,fish.offset+time*fish.speed,fish.position,tangent);fish.heading=Math.atan2(-tangent.z,tangent.x);fish.pitch=0;
    if(fish.species==='marlin'){
      const lane=pelagicLaneClearance(fish.position.x,fish.position.z);
      // Cruise over the visible shelf, dipping below hull draft through shipping lanes.
      fish.position.y=-.78-smooth((8-lane)/6)*.78+.02*Math.sin(time*.3+fish.index);fish.tail=Math.sin(time*5.8+fish.index)*.18;
    }else{
      fish.position.y+=Math.sin(time*.6+fish.index*1.7)*.045;
      fish.tail=Math.sin(time*(fish.species==='lionfish'?3.1:10)+fish.index*2.39)*(fish.species==='lionfish'?.10:.28);
      fish.finSpread=.6+.08*Math.sin(time*1.8+fish.index);
      if(fish.species==='cave-silver'){
        const offset=(fish.index%3-1)*.28;fish.position.x+=tangent.z*offset;fish.position.z-=tangent.x*offset;fish.position.y+=(Math.floor(fish.index/6)-1)*.12;
      }
    }
  }
}
export function updatePelagicFish(states:PelagicFish[],time:number,paused=false){
  if(paused)return 0;let contacts=0;
  for(const fish of states){const before=fish.time;samplePelagicFish(fish,time);if(fish.species==='flying'&&fish.event?.allowed&&before<fish.event.end&&time>=fish.event.end){fish.contacts++;contacts++;}}
  return contacts;
}
