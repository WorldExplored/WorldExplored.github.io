import { landDistance, smooth, terrainBaseHeight } from './terrain';

/** The reef shelf spans the channel and both sheltered arms of the lighthouse triangle. */
export const REEF_BASINS = [
  { x: -2, z: -42, rx: 29, rz: 19 },
  { x: -46, z: -37, rx: 27, rz: 17 },
  { x: -46, z: -55, rx: 23, rz: 14 },
  { x: -61, z: -37, rx: 18, rz: 22 },
  { x: -79, z: -36, rx: 22, rz: 23 },
  { x: -7, z: -113, rx: 44, rz: 19 },
  { x: 52, z: -79, rx: 21, rz: 34 },
  { x: -58, z: -79, rx: 20, rz: 32 },
] as const;

function shelfInfluence(x: number, z: number) {
  return Math.max(...REEF_BASINS.map(basin => 1 - smooth(1, 1.8, Math.hypot((x - basin.x) / basin.rx, (z - basin.z) / basin.rz))));
}

const floorVertices = new Map<string, number>();

/** Integer vertices are shared by the floor mesh, collision queries and benthic life. */
export function reefFloorVertexHeight(x: number, z: number) {
  const key = `${x},${z}`, cached = floorVertices.get(key);
  if (cached !== undefined) return cached;
  const distance = landDistance(x, z);
  const waves = .16 * Math.sin(x * .31 + z * .17) + .09 * Math.cos(z * .43 - x * .13);
  const ripples = .026 * Math.sin(z * 5 + Math.sin(x * .41) * 2);
  const basin = (1 - smooth(.65, 1.35, Math.hypot((x + 2) / 34, (z + 42) / 24))) * smooth(7, 12, -distance);
  const shelf = shelfInfluence(x, z);
  const fractures = shelf * smooth(10, 17, -distance) * (.25 * Math.sin(x * .22 + z * .35) + .19 * Math.sin(x * .67 - z * .38));
  const shelfBand=Math.sin(x*.115+z*.071+Math.sin(z*.09)*.45);
  const terraces=(smooth(-.3,.15,shelfBand)-.5)*1.05;
  const hollow=Math.exp(-(((x+34)/11)**2+((z+30)/8)**2))*1.35;
  const trough=Math.exp(-(((x+52)/7)**2+((z+45)/14)**2))*.95;
  const forestHollows=(Math.exp(-(((x+13)/23)**2+((z+119)/8)**2))+Math.exp(-(((x-57)/9)**2+((z+83)/19)**2)))*1.25*smooth(8,13,-distance);
  const relief=shelf*smooth(7,12,-distance)*(terraces-hollow-trough);
  const floor = terrainBaseHeight(x, z) - .36 + smooth(6.9, 9, -distance) * (waves + ripples) - basin * 1.9 + fractures + relief - forestHollows;
  const height = Math.min(-2.4, floor) - smooth(22, 75, -distance) * 35 * (1 - shelf);
  floorVertices.set(key, height);
  return height;
}

/** Exact barycentric sampling of the rendered one-metre floor triangles. */
export function reefFloorHeight(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z), u = x - ix, v = z - iz;
  const a = reefFloorVertexHeight(ix, iz), b = reefFloorVertexHeight(ix + 1, iz);
  const c = reefFloorVertexHeight(ix, iz + 1), d = reefFloorVertexHeight(ix + 1, iz + 1);
  return u + v <= 1 ? a * (1 - u - v) + b * u + c * v : d * (u + v - 1) + b * (1 - v) + c * (1 - u);
}
