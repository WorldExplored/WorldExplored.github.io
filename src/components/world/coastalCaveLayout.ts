/** Authored shore burrows. Pure layout data is shared by planting and animal clearance. */
export const COASTAL_CAVE_LAYOUT = [
  {x:-65.8,z:-35.1,yaw:1.0131930074,scale:1,form:0,floor:-2.55},
  {x:-48,z:-62.4,yaw:-.7666186095,scale:1,form:1,floor:-2.55},
  {x:-39.288,z:-9.328,yaw:-1.5681753265,scale:.94,form:4,floor:-2.55},
] as const;

export const MYTHIC_GROTTO = { x: -55, z: -20, floor: -7.3, width: 6.05, depth: 6.34, scale: .72, heightScale: .78 } as const;
export function mythicalCaveClearance(x:number,z:number,radius=0){
  return (Math.hypot((x-MYTHIC_GROTTO.x)/6.8,(z-MYTHIC_GROTTO.z+1.8)/6)-1)*6-radius;
}

export function caveLocalXZ(site:{x:number;z:number;yaw:number;scale:number},x:number,z:number){
  const dx=(x-site.x)/site.scale,dz=(z-site.z)/site.scale,c=Math.cos(site.yaw),s=Math.sin(site.yaw);
  return {x:dx*c-dz*s,z:dx*s+dz*c};
}

/** Keep planted geometry outside the buried bank and its open swimming approach. */
export function coastalCaveClearance(x:number,z:number,radius=0){
  let distance=mythicalCaveClearance(x,z,radius);
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
/** Excavate a sloping entrance into the existing seabed, with an undisturbed outer bank. */
export function mythicalCaveFloor(x:number,z:number,height:number) {
  const lx=(x-MYTHIC_GROTTO.x)/MYTHIC_GROTTO.scale,lz=(z-MYTHIC_GROTTO.z)/MYTHIC_GROTTO.scale;
  const across=1-ease(4.8,7.7,Math.abs(lx));
  const depth=ease(-9.8,-6.8,lz)*(1-ease(3.0,8.0,lz));
  return height+(Math.min(height,MYTHIC_GROTTO.floor-.22)-height)*across*depth;
}

/** Lower only the floor inside each bank. The same terrain triangles remain the actual cave floor. */
export function coastalCaveFloor(x:number,z:number,height:number){
  let result=mythicalCaveFloor(x,z,height);
  for(const site of COASTAL_CAVE_LAYOUT){
    const local=caveLocalXZ(site,x,z);
    const across=1-ease(1.80,2.65,Math.abs(local.x));
    const depth=ease(-4.35,-3.0,local.z)*(1-ease(.45,1.65,local.z));
    result+=(Math.min(result,site.floor)-result)*across*depth;
  }
  return result;
}
