import { landDistance, smooth, terrainBaseHeight } from './terrain';
import { reefFloorHeight } from './seafloor';

/** Ease the island's outer apron onto the reef while keeping depth surfaces separate. */
export function coastalApronHeight(x:number,z:number) {
  const distance=landDistance(x,z),base=terrainBaseHeight(x,z);
  if(distance>=-4.15)return base;
  const blend=smooth(4.15,6.1,-distance),floor=reefFloorHeight(x,z);
  return Math.max(floor+.08,base+(floor+.08-base)*blend);
}
