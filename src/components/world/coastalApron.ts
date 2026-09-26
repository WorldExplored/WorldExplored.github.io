import { landDistance, smooth, terrainBaseHeight } from './terrain';
import { reefFloorHeight } from './seafloor';
import { coastalCaveClearance, coastalCaveFloor } from './coastalCaveLayout';

/** Ease the island's outer apron onto the reef while keeping depth surfaces separate. */
export function coastalApronHeight(x:number,z:number) {
  const distance=landDistance(x,z),base=terrainBaseHeight(x,z);
  const apronStart=4.15-1.45*smooth(0,4,coastalCaveClearance(x,z));
  if(distance>=-apronStart){
    const cut=coastalCaveFloor(x,z,base);
    return cut<base?Math.max(reefFloorHeight(x,z)+.08,cut):base;
  }
  const blend=smooth(apronStart,6.1,-distance),floor=reefFloorHeight(x,z);
  return Math.max(floor+.08,coastalCaveFloor(x,z,base+(floor+.08-base)*blend));
}
