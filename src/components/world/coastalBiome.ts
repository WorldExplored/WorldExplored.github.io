export const TOWN_BEDS = [[-4,-85,1.8,4.2],[6,-81,1.8,4],[-14,-84,1.1,3],[-25,-83,.9,3.1],[8,-86,1,3.3],[2,-76,.9,2.2],[-18,-88,.8,2.6],[-22,-67,.8,2.5],[13,-76,.7,2.3],[-3,-90,1.1,3.8],[5,-90,1,3.5],[12,-82,.9,3.2],[-5,-64,.7,2.6]] as const;
/** One ecological field drives both terrain color and instanced planting. */
export function biomeSmooth(a: number, b: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
export function patchNoise(x: number, z: number) {
  return .5 + Math.sin(x * .39 + Math.sin(z * .24) * 1.7) * .23 + Math.cos(z * .48 - x * .13) * .16 + Math.sin(x * 1.13 + z * .71) * .08;
}
export function coastalBiome(x: number, z: number, distance: number, height: number, slope = 0) {
  const town = 1 - biomeSmooth(15, 20, Math.abs(z + 78));
  const patch = patchNoise(x, z);
  const beacon = 1 - biomeSmooth(5.3, 7.5, Math.hypot(x + 76, z + 36));
  const beachWidth = 2.45 + .65 * Math.sin(x * .17 + z * .12) + .4 * Math.cos(z * .36 - x * .11);
  const inland = biomeSmooth(beachWidth - .6 - beacon * 1.25, beachWidth + 1.5 - beacon * 1.25, distance) * biomeSmooth(.34, .76, height);
  const cultivated = town===0?0:Math.max(
    ...TOWN_BEDS.map(([cx,cz,inner,outer])=>1-biomeSmooth(inner,outer,Math.hypot(x-cx,z-cz))),
    1 - biomeSmooth(1.8, 4.6, Math.hypot(x + 18, z + 80)),
    1 - biomeSmooth(1.2, 3.9, Math.hypot(x - 5, z + 80)),
    1 - biomeSmooth(1.4, 4.4, Math.hypot(x + 24, z + 67)),
    1 - biomeSmooth(1.8, 4.2, Math.hypot(x - 13, z + 66)),
    // History's garden reads as several joined planting pockets around its walls.
    1 - biomeSmooth(3.2, 7.4, Math.hypot(x - 20, z + 64)),
    1 - biomeSmooth(3.0, 7.1, Math.hypot(x - 28, z + 73)),
    1 - biomeSmooth(2.8, 6.5, Math.hypot(x - 18, z + 81)),
  );
  const stonyGrass = .56 + .25 * biomeSmooth(.16, .57, patch);
  const grass = inland * ((0.58 + .42*biomeSmooth(.12, .5, patch)) * (1-town) + town*(.37+.63*cultivated))
    * (1 - biomeSmooth(.48, .86, slope)) * (1 - beacon * (1 - stonyGrass));
  const wet = 1 - biomeSmooth(.09, .40, height);
  const soil = inland * (1 - grass) * (1 - town * .8);
  return { grass, soil, wet, inland, town, cultivated, beachWidth };
}
