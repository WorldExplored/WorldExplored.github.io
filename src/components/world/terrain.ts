import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { world, type LandmarkId } from '../../content/world';

export interface Footprint { id: string; x: number; z: number; radius: number }
export interface PathPoint { x: number; z: number }
export interface LandscapePath { points: PathPoint[]; width: number }
export interface LandscapeRock extends Footprint { y: number; scale: [number, number, number]; rotation: number }
export interface LandscapeTree extends Footprint { y: number; height: number; rotation: number }
export interface LandscapePlan { structures: Footprint[]; paths: LandscapePath[]; rocks: LandscapeRock[]; trees: LandscapeTree[] }
export interface PlantPosition { x: number; y: number; z: number; scale: number; rotation: number; phase: number; reach: number }

export const MEADOW = { minX: -42, maxX: 42, minZ: -112, plantMinX: -29, plantMaxX: 29, plantMinZ: -32, plantMaxZ: 22, plantReach: .95 };
const FOOTPRINT_RADII: Record<LandmarkId, number> = { work: 5.2, research: 3.2, purdue: 1.8, about: 3.2, contact: 2.8, building: 2.2 };

export function seededRandom(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

function smooth(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function shorelineZ(x: number) {
  return 20 - 9 * Math.exp(-x * x / 35) + 2 * Math.sin(x * .16);
}

export function architectureFootprints(): Footprint[] {
  return world.landmarks.map(item => ({ id: item.id, x: item.position[0], z: item.position[2], radius: FOOTPRINT_RADII[item.id] }));
}

export function terrainHeight(x: number, z: number) {
  let rolling = Math.sin(x * .12 + z * .07) * .20 + Math.cos(z * .16 - x * .05) * .15;
  rolling += smooth(-25, -65, z) * (1.2 + Math.sin(x * .09 + z * .04) * .85);
  for (const landmark of world.landmarks) {
    const distance = Math.hypot(x - landmark.position[0], z - landmark.position[2]);
    rolling *= smooth(FOOTPRINT_RADII[landmark.id] + .8, FOOTPRINT_RADII[landmark.id] + 2.4, distance);
  }
  const coast = smooth(-1.3, 1.3, shorelineZ(x) - z);
  const side = smooth(0, 3.5, 42 - Math.abs(x));
  const back = smooth(-113, -105, z);
  return -.85 + (1.65 + rolling) * Math.min(coast, side, back);
}

export function distanceToSegment(x: number, z: number, a: PathPoint, b: PathPoint) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / Math.max(.0001, dx * dx + dz * dz)));
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}

function clearCircles(x: number, z: number, reach: number, circles: readonly Footprint[]) {
  return circles.every(circle => Math.hypot(x - circle.x, z - circle.z) > circle.radius + reach);
}

function clearPaths(x: number, z: number, reach: number, paths: readonly LandscapePath[]) {
  for (const path of paths) for (let index = 1; index < path.points.length; index++) {
    if (distanceToSegment(x, z, path.points[index - 1], path.points[index]) <= path.width / 2 + reach) return false;
  }
  return true;
}

export function canPlacePlant(x: number, z: number, reach: number, plan: LandscapePlan) {
  if (terrainHeight(x, z) < .35) return false;
  for (let index = 0; index < 8; index++) {
    const angle = index * Math.PI / 4;
    if (terrainHeight(x + Math.cos(angle) * reach, z + Math.sin(angle) * reach) < .30) return false;
  }
  return clearCircles(x, z, reach, plan.structures) && clearCircles(x, z, reach, plan.rocks)
    && clearCircles(x, z, reach, plan.trees) && clearPaths(x, z, reach, plan.paths);
}

export function createLandscapePlan(): LandscapePlan {
  const structures = architectureFootprints();
  const point = (id: LandmarkId): PathPoint => { const item = world.landmarks.find(landmark => landmark.id === id)!; return { x: item.position[0], z: item.position[2] }; };
  const paths: LandscapePath[] = [
    { width: 1.35, points: [point('about'), { x: -11, z: 5 }, point('work'), { x: -3, z: -4 }, point('research'), point('purdue')] },
    { width: 1.25, points: [point('research'), { x: 8, z: -2 }, { x: 11, z: 2 }, point('contact')] },
  ];
  const rocks: LandscapeRock[] = [];
  const trees: LandscapeTree[] = [];
  const random = seededRandom(627);
  for (let index = 0; index < 42; index++) {
    const x = -35 + index / 41 * 70 + (random() - .5) * .5;
    const z = shorelineZ(x) - .75 - random() * .35;
    const size = .22 + random() * .45;
    const scale: [number, number, number] = [size * 1.55, size * .75, size];
    const radius = Math.max(scale[0], scale[2]);
    if (!clearCircles(x, z, radius + .3, structures) || !clearPaths(x, z, radius + .3, paths)) continue;
    rocks.push({ id: `shore-rock-${index}`, x, y: terrainHeight(x, z) + .06, z, radius, scale, rotation: random() * Math.PI });
  }
  for (let index = 0; index < 12; index++) {
    const x = (index % 2 ? 1 : -1) * (25 + random() * 9);
    const z = -24 + Math.floor(index / 2) * 6 + random() * 2;
    const height = 2.4 + random() * 1.9;
    const radius = height * .50;
    if (!clearCircles(x, z, radius + .8, structures) || !clearPaths(x, z, radius + .8, paths)) continue;
    trees.push({ id: `grove-tree-${index}`, x, y: terrainHeight(x, z), z, radius, height, rotation: random() * Math.PI * 2 });
  }
  return { structures, paths, rocks, trees };
}

export function generatePlantPositions(count: number, plan: LandscapePlan, seed = 41): PlantPosition[] {
  const random = seededRandom(seed);
  const positions: PlantPosition[] = [];
  for (let attempt = 0; positions.length < count && attempt < count * 80; attempt++) {
    const x = MEADOW.plantMinX + random() * (MEADOW.plantMaxX - MEADOW.plantMinX);
    const z = MEADOW.plantMinZ + random() * (MEADOW.plantMaxZ - MEADOW.plantMinZ);
    const reach = MEADOW.plantReach;
    if (!canPlacePlant(x, z, reach, plan)) continue;
    positions.push({ x, y: terrainHeight(x, z) - .015, z, scale: .35 + random() * .45, rotation: random() * Math.PI * 2, phase: random() * Math.PI * 2, reach });
  }
  if (positions.length !== count) throw new Error('The meadow has insufficient clear planting area.');
  return positions;
}

export function meadowGeometry() {
  const geometry = new BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const width = 112;
  const depth = 160;
  const green = new Color(world.colors.grass);
  const lime = new Color(world.colors.grassLight);
  const shore = new Color('#e8f4db');
  const color = new Color();
  for (let row = 0; row <= depth; row++) for (let column = 0; column <= width; column++) {
    const x = MEADOW.minX + column / width * (MEADOW.maxX - MEADOW.minX);
    const z = MEADOW.minZ + row / depth * (shorelineZ(x) + 1.4 - MEADOW.minZ);
    const y = terrainHeight(x, z);
    positions.push(x, y, z);
    uvs.push(x / 4, z / 4);
    color.copy(green).lerp(lime, .07 + .08 * Math.sin(x * .18 + z * .11) + .04 * Math.cos(z * .27));
    if (y < .3) color.lerp(shore, smooth(.3, -.3, y));
    colors.push(color.r, color.g, color.b);
    if (row < depth && column < width) {
      const a = row * (width + 1) + column;
      const b = a + 1;
      const c = a + width + 1;
      indices.push(a, c, b, b, c, c + 1);
    }
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function pathGeometry(paths: readonly LandscapePath[]) {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const path of paths) for (let segment = 1; segment < path.points.length; segment++) {
    const a = path.points[segment - 1];
    const b = path.points[segment];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(length * 3);
    const nx = -(b.z - a.z) / length * path.width / 2;
    const nz = (b.x - a.x) / length * path.width / 2;
    const start = positions.length / 3;
    for (let index = 0; index <= steps; index++) {
      const x = a.x + (b.x - a.x) * index / steps;
      const z = a.z + (b.z - a.z) * index / steps;
      positions.push(x + nx, terrainHeight(x + nx, z + nz) + .035, z + nz, x - nx, terrainHeight(x - nx, z - nz) + .035, z - nz);
      if (index < steps) { const n = start + index * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
