import { marineFloorHeight, reefFloorHeight } from './reefHabitat';
import { terrainMeshHeight } from './terrain';
import { COASTAL_CAVE_LAYOUT, caveLocalXZ } from './coastalCaveLayout';

export interface ReefCaveSite {x:number;y:number;z:number;scale:number;yaw:number;form:number;period:number;offset:number;kind:'bank'|'overhang'}
export interface CaveVisitorPose {x:number;y:number;z:number;heading:number;pitch:number;swimming:boolean;phase:number}
const ease=(t:number)=>t*t*(3-2*t);

/** The animal has a home inside the tunnel and a closed excursion through its mouth. */
export function caveLocalPose(phase:number,kind:ReefCaveSite['kind']='bank') {
  let x=0,z=0;
  const home=kind==='bank'?-1.55:.15;
  if(phase<.18)z=home+ease(phase/.18)*(3-home);
  else if(phase<.70){
    const angle=ease((phase-.18)/.52)*Math.PI*2;
    x=1.35*Math.sin(angle);z=3+1.3*(1-Math.cos(angle));
  }else if(phase<.88)z=3-ease((phase-.70)/.18)*(3-home);
  else z=home;
  return {x,z};
}

function worldPoint(site:ReefCaveSite,phase:number) {
  const p=caveLocalPose(phase,site.kind),c=Math.cos(site.yaw),s=Math.sin(site.yaw);
  return {x:site.x+(p.x*c+p.z*s)*site.scale,z:site.z+(-p.x*s+p.z*c)*site.scale};
}
export function caveVisitorPose(site:ReefCaveSite,index:number,elapsed:number):CaveVisitorPose {
  const period=site.period+(index?19+index*7:0),phase=((elapsed+site.offset+index*11)%period)/period;
  const p=worldPoint(site,phase),next=worldPoint(site,Math.min(.8799,phase+.025)),previous=worldPoint(site,Math.max(0,phase-.025));
  // Turn within the recess before leaving again, instead of snapping 180 degrees at rest.
  const heading=phase>=.88?site.yaw+Math.PI/2+Math.PI*ease((phase-.88)/.12):Math.atan2(-(next.z-previous.z),next.x-previous.x);
  const lateral=index?((index%2?1:-1)*(.16+(index%3)*.05))*site.scale:0;
  p.x+=Math.cos(site.yaw)*lateral;p.z-=Math.sin(site.yaw)*lateral;
  // Follow the upper coastal surface continuously across the island/apron mesh boundary.
  const swimFloor=(x:number,z:number)=>site.kind==='bank'?Math.max(terrainMeshHeight(x,z),reefFloorHeight(x,z)):marineFloorHeight(x,z);
  const dx=Math.cos(heading)*.25,dz=-Math.sin(heading)*.25;
  const pitch=Math.atan((swimFloor(p.x+dx,p.z+dz)-swimFloor(p.x-dx,p.z-dz))/.5);
  return {x:p.x,y:swimFloor(p.x,p.z)+((site.kind==='bank'?.60:.45)+index*.020)*site.scale,z:p.z,heading,pitch,swimming:phase<.88,phase};
}

let cached:ReefCaveSite[]|undefined;
export function createReefCaveSites() {
  if(cached)return cached;
  const sites:ReefCaveSite[]=COASTAL_CAVE_LAYOUT.map(site=>({...site,y:marineFloorHeight(site.x,site.z),period:96+site.form*21,offset:site.form*19,kind:'bank'}));
  cached=sites;return sites;
}

export function caveWorldPoint(site:ReefCaveSite,x:number,z:number){
  const c=Math.cos(site.yaw),s=Math.sin(site.yaw);
  return {x:site.x+(x*c+z*s)*site.scale,z:site.z+(-x*s+z*c)*site.scale};
}
export function caveGroundLocal(site:ReefCaveSite,x:number,z:number){
  const point=caveWorldPoint(site,x,z);
  return (marineFloorHeight(point.x,point.z)-site.y)/site.scale;
}
export function reefCaveClearance(x:number,z:number,radius=0){
  let distance=Infinity;
  for(const site of createReefCaveSites()){
    const local=caveLocalXZ(site,x,z);
    const dx=Math.abs(local.x)-4.5,dz=Math.abs(local.z+2.7)-2.7;
    const bank=site.kind==='bank'?Math.hypot(Math.max(dx,0),Math.max(dz,0))+Math.min(Math.max(dx,dz),0):Math.hypot(local.x,local.z)-2.2;
    distance=Math.min(distance,bank*site.scale-radius);
  }
  return distance;
}
