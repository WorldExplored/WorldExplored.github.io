/** Open grazing water in front of the buried cave; the crab approach stays to the north. */
export const SEAGRASS_MEADOW = { x: -55, z: -3, rx: 8.7, rz: 6.8, clarityInner: 1, clarityOuter: 1.5 } as const;
export function seagrassMeadowClearance(x:number,z:number,radius=0) {
  const meadow=SEAGRASS_MEADOW;
  return (Math.hypot((x-meadow.x)/meadow.rx,(z-meadow.z)/meadow.rz)-1)*Math.min(meadow.rx,meadow.rz)-radius;
}
