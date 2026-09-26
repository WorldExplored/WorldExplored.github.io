/** Authored shore burrows. Pure layout data is shared by planting and animal clearance. */
export const COASTAL_CAVE_LAYOUT = [
  {x:-65.8,z:-35.1,yaw:1.0131930074,scale:1,form:0,floor:-2.55},
  {x:-48,z:-62.4,yaw:-.7666186095,scale:1,form:1,floor:-2.55},
  {x:-3.035,z:37.116,yaw:.0548991976,scale:1,form:3,floor:-2.55},
  {x:-39.288,z:-9.328,yaw:-1.5681753265,scale:.94,form:4,floor:-2.55},
] as const;

export function caveLocalXZ(site:{x:number;z:number;yaw:number;scale:number},x:number,z:number){
  const dx=(x-site.x)/site.scale,dz=(z-site.z)/site.scale,c=Math.cos(site.yaw),s=Math.sin(site.yaw);
  return {x:dx*c-dz*s,z:dx*s+dz*c};
}

/** Keep planted geometry outside the buried bank and its open swimming approach. */
export function coastalCaveClearance(x:number,z:number,radius=0){
  let distance=Infinity;
  for(const site of COASTAL_CAVE_LAYOUT){
    const local=caveLocalXZ(site,x,z);
    const dx=Math.abs(local.x)-4.5,dz=Math.abs(local.z+2.7)-2.7;
    const bank=Math.hypot(Math.max(dx,0),Math.max(dz,0))+Math.min(Math.max(dx,dz),0);
    const approach=Math.hypot(local.x/2.3,(local.z-3.0)/3.8)-1;
    distance=Math.min(distance,Math.min(bank,approach*2.3)*site.scale-radius);
  }
  return distance;
}


const ease=(a:number,b:number,value:number)=>{const t=Math.max(0,Math.min(1,(value-a)/(b-a)));return t*t*(3-2*t);};
/** Lower only the floor inside each bank. The same terrain triangles remain the actual cave floor. */
export function coastalCaveFloor(x:number,z:number,height:number){
  let result=height;
  for(const site of COASTAL_CAVE_LAYOUT){
    const local=caveLocalXZ(site,x,z);
    const across=1-ease(1.80,2.65,Math.abs(local.x));
    const depth=ease(-4.35,-3.0,local.z)*(1-ease(.45,1.65,local.z));
    result+=(Math.min(result,site.floor)-result)*across*depth;
  }
  return result;
}
