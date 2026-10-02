import type { BufferGeometry } from 'three';

// Preserve proportions while fitting the museum below the residential skyline.
export const HISTORY_SCALE = .82;
export const HISTORY_FLOOR = 1.075;
export const historyHeight = (height: number) => HISTORY_FLOOR + (height - HISTORY_FLOOR) * HISTORY_SCALE;
export function sizeHistoryGeometry<T extends Record<string, BufferGeometry>>(parts: T): T {
  for (const [key,geometry] of Object.entries(parts)) {
    const bearing = key === 'base' || key === 'threshold';
    geometry.scale(HISTORY_SCALE, bearing ? 1 : HISTORY_SCALE, HISTORY_SCALE).translate(0, bearing ? 0 : (key.startsWith('planting') ? 1.01 : HISTORY_FLOOR) * (1 - HISTORY_SCALE), 0);
    const stair = geometry.userData.stair;
    if(stair)geometry.userData.stair = {...stair, lower:historyHeight(stair.lower),upper:historyHeight(stair.upper),width:stair.width*HISTORY_SCALE,tread:stair.tread*HISTORY_SCALE,x:stair.x*HISTORY_SCALE,startZ:stair.startZ*HISTORY_SCALE,endZ:stair.endZ*HISTORY_SCALE};
  }
  return parts;
}
