import { getReefHabitat, marineFloorHeight, reefHabitatContains, reefFerryClearance } from './reefHabitat';
import { landDistance, seededRandom } from './terrain';

export interface ReefCaveSite {x:number;y:number;z:number;scale:number;yaw:number;form:number;period:number;offset:number}
export interface CaveVisitorPose {x:number;y:number;z:number;heading:number;swimming:boolean;phase:number}
const ease=(t:number)=>t*t*(3-2*t);

/** The animal has a home inside the tunnel and a closed excursion through its mouth. */
export function caveLocalPose(phase:number) {
  let x=0,z=0;
  if(phase<.18)z=.15+ease(phase/.18)*2.85;
  else if(phase<.70){
    const angle=ease((phase-.18)/.52)*Math.PI*2;
    x=1.35*Math.sin(angle);z=3+1.3*(1-Math.cos(angle));
  }else if(phase<.88)z=3-ease((phase-.70)/.18)*2.85;
  else z=.15;
  return {x,z};
}

function worldPoint(site:ReefCaveSite,phase:number) {
  const p=caveLocalPose(phase),c=Math.cos(site.yaw),s=Math.sin(site.yaw);
  return {x:site.x+(p.x*c+p.z*s)*site.scale,z:site.z+(-p.x*s+p.z*c)*site.scale};
}
export function caveVisitorPose(site:ReefCaveSite,index:number,elapsed:number):CaveVisitorPose {
  const period=site.period+(index?19+index*7:0),phase=((elapsed+site.offset+index*11)%period)/period;
  const p=worldPoint(site,phase),next=worldPoint(site,Math.min(.8799,phase+.025)),previous=worldPoint(site,Math.max(0,phase-.025));
  const heading=phase>=.88?site.yaw-Math.PI/2:Math.atan2(-(next.z-previous.z),next.x-previous.x);
  const lateral=index?((index%2?1:-1)*(.16+(index%3)*.05))*site.scale:0;
  p.x+=Math.cos(site.yaw)*lateral;p.z-=Math.sin(site.yaw)*lateral;
  return {x:p.x,y:marineFloorHeight(p.x,p.z)+(.28+index*.035)*site.scale,z:p.z,heading,swimming:phase<.88,phase};
}

let cached:ReefCaveSite[]|undefined;
export function createReefCaveSites() {
  if(cached)return cached;
  const random=seededRandom(17269),habitat=getReefHabitat(),sites:ReefCaveSite[]=[];
  const blockers=[...habitat.rocks,...habitat.colonies,...habitat.kelp.map(plant=>({...plant,radius:plant.width*.55}))];
  const centers=[[-92,-45,1.1],[-12,-109,.76],[-54,-67,.9]];
  for(let index=0;index<centers.length;index++){
    const [cx,cz,scale]=centers[index];let accepted=false;
    for(let attempt=0;attempt<3000&&!accepted;attempt++){
      const angle=random()*Math.PI*2,r=Math.sqrt(random())*17,x=cx+Math.cos(angle)*r,z=cz+Math.sin(angle)*r;
      if(!reefHabitatContains(x,z,.8)||landDistance(x,z)>-8||reefFerryClearance(x,z)<9)continue;
      const site:ReefCaveSite={x,y:marineFloorHeight(x,z)-.09,z,scale,yaw:random()*Math.PI*2,form:index,period:78+index*23,offset:index*19};
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
