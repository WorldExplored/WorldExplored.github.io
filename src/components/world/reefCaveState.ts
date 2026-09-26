import { getReefHabitat, marineFloorHeight, reefHabitatContains, reefFerryClearance, reefFloorHeight } from './reefHabitat';
import { landDistance, seededRandom, terrainMeshHeight } from './terrain';
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
  return {x:p.x,y:swimFloor(p.x,p.z)+((site.kind==='bank'?.74:.45)+index*.025)*site.scale,z:p.z,heading,pitch,swimming:phase<.88,phase};
}

let cached:ReefCaveSite[]|undefined;
export function createReefCaveSites() {
  if(cached)return cached;
  const random=seededRandom(17269),habitat=getReefHabitat(),sites:ReefCaveSite[]=COASTAL_CAVE_LAYOUT.map(site=>({...site,y:marineFloorHeight(site.x,site.z),period:96+site.form*21,offset:site.form*19,kind:'bank'}));
  const blockers=[...habitat.rocks,...habitat.colonies,...habitat.kelp.map(plant=>({...plant,radius:plant.width*.55}))];
  const centers=[[-54,-67,.9]];
  for(let index=0;index<centers.length;index++){
    const [cx,cz,scale]=centers[index];let accepted=false;
    for(let attempt=0;attempt<3000&&!accepted;attempt++){
      const angle=random()*Math.PI*2,r=Math.sqrt(random())*17,x=cx+Math.cos(angle)*r,z=cz+Math.sin(angle)*r;
      if(!reefHabitatContains(x,z,.8)||landDistance(x,z)>-8||reefFerryClearance(x,z)<9)continue;
      const site:ReefCaveSite={x,y:marineFloorHeight(x,z)-.09,z,scale,yaw:random()*Math.PI*2,form:2,period:124,offset:38,kind:'overhang'};
      if(site.y< -10||site.y> -3.8||sites.some(other=>Math.hypot(x-other.x,z-other.z)<10))continue;
      let clear=true,minFloor=site.y,maxFloor=site.y;
      for(let a=0;a<Math.PI*2;a+=Math.PI/12){
        const px=x+Math.cos(a)*2.2*scale,pz=z+Math.sin(a)*2.2*scale,floor=marineFloorHeight(px,pz);
        minFloor=Math.min(minFloor,floor);maxFloor=Math.max(maxFloor,floor);
      }
      if(maxFloor-minFloor>.52)continue;
      site.y=minFloor-.045;
      const nearby=blockers.filter(item=>Math.hypot(item.x-x,item.z-z)<item.radius+8*scale);
      if(nearby.some(item=>Math.hypot(item.x-x,item.z-z)<item.radius+2.2*scale))continue;
      for(let step=0;step<=160&&clear;step++){
        const p=worldPoint(site,step/160);
        if(landDistance(p.x,p.z)>-5||marineFloorHeight(p.x,p.z)>-3||nearby.some(item=>Math.hypot(item.x-p.x,item.z-p.z)<item.radius+.4*scale))clear=false;
      }
      if(!clear)continue;
      sites.push(site);accepted=true;
    }
    if(!accepted)throw new Error(`No clear cave habitat ${index}`);
  }
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
