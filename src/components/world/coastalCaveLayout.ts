/** Authored shore burrows. Pure layout data is shared by planting and animal clearance. */
export const COASTAL_CAVE_LAYOUT = [
  {x:-62.3835654675,z:-37.2248694082,yaw:Math.PI/2+.1,scale:1,form:0},
  {x:-39.2665203266,z:-64.5442316709,yaw:Math.PI/2-2.55,scale:.92,form:1},
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
