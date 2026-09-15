import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, Vector3 } from 'three';
import { cityBuildings, createCityTransitRoute } from './city';
import { world, type LandmarkId } from '../../content/world';

export interface Footprint { id: string; x: number; z: number; radius: number }
export interface PathPoint { x: number; z: number }
export interface LandscapePath { points: PathPoint[]; width: number; bridge?: boolean; elevated?: boolean }
export interface LandscapeRock extends Footprint { y: number; scale: [number, number, number]; rotation: number }
export interface LandscapeTree extends Footprint { y: number; height: number; rotation: number }
export interface LandscapePlan { structures: Footprint[]; paths: LandscapePath[]; rocks: LandscapeRock[]; trees: LandscapeTree[] }
export interface PlantPosition { x: number; y: number; z: number; scale: number; rotation: number; phase: number; reach: number }
export interface Island { id: string; x: number; z: number; rx: number; rz: number; phase: number; beach: number; hill: number }

export const ISLANDS: readonly Island[] = [
  { id: 'main', x: -4, z: -5, rx: 20, rz: 16, phase: .3, beach: 2.8, hill: 2.4 },
  { id: 'garden', x: 1, z: 23, rx: 22, rz: 10, phase: 1.6, beach: 2.1, hill: 1.1 },
  { id: 'purdue', x: 26, z: -7, rx: 7.2, rz: 8.6, phase: 2.4, beach: 2.3, hill: .7 },
  { id: 'beacon', x: -35, z: -23, rx: 5.8, rz: 5.2, phase: 3.2, beach: 1.1, hill: 1.3 },
  { id: 'city', x: -7, z: -78, rx: 29, rz: 18, phase: 4.1, beach: 3.1, hill: .55 },
];
export const PLANT_REACH = .95;
export const FOOTPRINT_RADII: Record<LandmarkId, number> = { work: 5.5, research: 3.8, purdue: 1.8, about: 3.5, contact: 3.2, building: 2.4 };

export function seededRandom(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
export function smooth(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** The same asymmetric contour defines mesh rings, signed distance, and sampling. */
export function islandContour(island: Island, angle: number) {
  return 1 + .115 * Math.sin(3 * angle + island.phase) + .075 * Math.cos(5 * angle - island.phase * 1.4)
    + .035 * Math.sin(8 * angle + island.phase) - .16 * Math.exp(-Math.pow(Math.atan2(Math.sin(angle - island.phase), Math.cos(angle - island.phase)) / .32, 2));
}
export function islandDistance(island: Island, x: number, z: number) {
  const dx = (x - island.x) / island.rx;
  const dz = (z - island.z) / island.rz;
  return (islandContour(island, Math.atan2(dz, dx)) - Math.hypot(dx, dz)) * Math.min(island.rx, island.rz);
}
export function landDistance(x: number, z: number) {
  return Math.max(...ISLANDS.map(island => islandDistance(island, x, z)));
}
export function islandAt(x: number, z: number) {
  let owner = ISLANDS[0]; let distance = -Infinity;
  for (const island of ISLANDS) { const candidate = islandDistance(island, x, z); if (candidate > distance) { owner = island; distance = candidate; } }
  return { island: owner, distance };
}
export function architectureFootprints(): Footprint[] {
  return world.landmarks.map(item => ({ id: item.id, x: item.position[0], z: item.position[2], radius: FOOTPRINT_RADII[item.id] }));
}
export function terrainHeight(x: number, z: number) {
  const { island, distance } = islandAt(x, z);
  if (distance < 0) return -.04 - Math.min(5, -distance * .38 + Math.pow(Math.max(0, -distance - 3), 1.4) * .08);
  let height = (island.id === 'beacon' ? 2.6 : .8) * smooth(0, island.beach, distance);
  height += smooth(3, 8, distance) * island.hill * (.55 + .25 * Math.sin(x * .24 + z * .16) + .2 * Math.cos(z * .31));
  for (const item of world.landmarks) {
    const radius = FOOTPRINT_RADII[item.id];
    const blend = 1 - smooth(radius + .1, radius + 2, Math.hypot(x - item.position[0], z - item.position[2]));
    height += (.8 + item.position[1] - height) * blend * smooth(.2, 1.4, distance);
  }
  for (const item of cityBuildings) {
    const blend = 1 - smooth(item.radius + .1, item.radius + 1.4, Math.hypot(x - item.x, z - item.z));
    height += (.8 - height) * blend * smooth(.2, 1.4, distance);
  }
  return height;
}
export function terrainSlope(x: number, z: number) {
  return Math.hypot(terrainHeight(x + .25, z) - terrainHeight(x - .25, z), terrainHeight(x, z + .25) - terrainHeight(x, z - .25)) * 2;
}
export function distanceToSegment(x: number, z: number, a: PathPoint, b: PathPoint) {
  const dx = b.x - a.x; const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / Math.max(.0001, dx * dx + dz * dz)));
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}
function circleClearance(x: number, z: number, circles: readonly Footprint[]) {
  return Math.min(Infinity, ...circles.map(circle => Math.hypot(x - circle.x, z - circle.z) - circle.radius));
}
function pathClearance(x: number, z: number, paths: readonly LandscapePath[]) {
  let clearance = Infinity;
  for (const path of paths) for (let index = 1; index < path.points.length; index++) clearance = Math.min(clearance, distanceToSegment(x, z, path.points[index - 1], path.points[index]) - path.width / 2);
  return clearance;
}
export function vegetationSuitability(x: number, z: number, reach: number, plan: LandscapePlan) {
  const coast = landDistance(x, z) - reach;
  const clearance = Math.min(circleClearance(x, z, plan.structures), circleClearance(x, z, plan.rocks), circleClearance(x, z, plan.trees), pathClearance(x, z, plan.paths)) - reach;
  return smooth(1.1, 3.4, coast) * smooth(0, .75, clearance) * (1 - smooth(.35, .65, terrainSlope(x, z)));
}
export function canPlacePlant(x: number, z: number, reach: number, plan: LandscapePlan) { return vegetationSuitability(x, z, reach, plan) > 0; }

export function createLandscapePlan(): LandscapePlan {
  const structures = [...architectureFootprints(), ...cityBuildings.map(item => ({ id: item.id, x: item.x, z: item.z, radius: item.radius }))];
  const point = (id: LandmarkId): PathPoint => { const item = world.landmarks.find(landmark => landmark.id === id)!; return { x: item.position[0], z: item.position[2] }; };
  const paths: LandscapePath[] = [
    { width: 1.25, points: [point('work'), { x: -3, z: -3 }, point('research'), { x: 12, z: -7 }] },
    { width: 1.2, points: [point('about'), { x: -3, z: 20 }, { x: 5, z: 21 }, point('contact')] },
    { width: 1.25, points: [point('work'), { x: -10, z: 7 }] },
    { width: 1.3, bridge: true, points: [{ x: -10, z: 7 }, { x: -9, z: 13 }, { x: -10, z: 20 }] },
    { width: 1.1, bridge: true, points: [{ x: 12, z: -7 }, { x: 18, z: -8 }, point('purdue')] },
  ];
  for (const path of paths) {
    if (path.bridge) continue;
    const curve = new CatmullRomCurve3(path.points.map(point => new Vector3(point.x, 0, point.z)));
    path.points = curve.getPoints(20).map(point => ({ x: point.x, z: point.z }));
  }
  paths.push({ width: 2.2, elevated: true, points: createCityTransitRoute().curve.getPoints(80).map(point => ({ x: point.x, z: point.z })) });
  const rocks: LandscapeRock[] = []; const trees: LandscapeTree[] = []; const random = seededRandom(627);
  // A few coastal outcrops, with adjacent fragments rather than a necklace of stones.
  for (const [islandIndex, angle] of [[0, 3.55], [0, 5.15], [1, .55], [3, 2.7], [3, 4.1]] as const) {
    const island = ISLANDS[islandIndex];
    for (let fragment = 0; fragment < 3; fragment++) {
      const a = angle + (fragment - 1) * .08; const radius = islandContour(island, a);
      const x = island.x + Math.cos(a) * island.rx * radius; const z = island.z + Math.sin(a) * island.rz * radius;
      const size = .45 + random() * .65; const scale: [number, number, number] = [size * 1.3, size * .8, size];
      if (circleClearance(x, z, structures) < size + 1 || pathClearance(x, z, paths) < size + 1) continue;
      rocks.push({ id: `coast-rock-${rocks.length}`, x, z, y: terrainHeight(x, z) + .12, radius: size * 1.4, scale, rotation: random() * Math.PI });
    }
  }
  for (let attempt = 0; trees.length < 42 && attempt < 1200; attempt++) {
    const island = ISLANDS[attempt % ISLANDS.length];
    if (island.id === 'beacon') continue;
    const a = random() * Math.PI * 2; const r = Math.sqrt(random()) * islandContour(island, a);
    const x = island.x + Math.cos(a) * island.rx * r; const z = island.z + Math.sin(a) * island.rz * r;
    const height = 2.7 + random() * 1.7; const radius = height * .50;
    if (landDistance(x, z) < 3 + radius || terrainSlope(x, z) > .4 || circleClearance(x, z, [...structures, ...rocks, ...trees]) < radius + 1 || pathClearance(x, z, paths) < radius + .8) continue;
    trees.push({ id: `grove-tree-${trees.length}`, x, z, y: terrainHeight(x, z), radius, height, rotation: random() * Math.PI * 2 });
  }
  return { structures, paths, rocks, trees };
}
export function generatePlantPositions(count: number, plan: LandscapePlan, seed = 41): PlantPosition[] {
  const random = seededRandom(seed); const positions: PlantPosition[] = [];
  const area = ISLANDS.reduce((total, island) => total + island.rx * island.rz, 0);
  for (let attempt = 0; positions.length < count && attempt < count * 140; attempt++) {
    let choose = random() * area; let island = ISLANDS[0];
    for (const candidate of ISLANDS) { choose -= candidate.rx * candidate.rz; if (choose <= 0) { island = candidate; break; } }
    const angle = random() * Math.PI * 2; const radius = Math.sqrt(random()) * islandContour(island, angle);
    const x = island.x + Math.cos(angle) * island.rx * radius; const z = island.z + Math.sin(angle) * island.rz * radius;
    const reach = PLANT_REACH; const suitability = vegetationSuitability(x, z, reach, plan);
    if (random() >= suitability) continue;
    positions.push({ x, y: terrainHeight(x, z) - .015, z, scale: (.35 + random() * .45) * (.7 + .3 * suitability), rotation: random() * Math.PI * 2, phase: random() * Math.PI * 2, reach });
  }
  if (positions.length !== count) throw new Error('The islands have insufficient clear planting area.');
  return positions;
}

export function archipelagoGeometry() {
  const geometry = new BufferGeometry(); const positions: number[] = []; const colors: number[] = []; const uvs: number[] = []; const indices: number[] = [];
  const green = new Color(world.colors.grass); const lime = new Color(world.colors.grassLight); const sand = new Color('#f8f3d9'); const shelf = new Color('#91ded2'); const color = new Color();
  const sectors = 192; const rings = 48;
  for (const island of ISLANDS) {
    const start = positions.length / 3;
    for (let ring = 0; ring <= rings; ring++) for (let segment = 0; segment <= sectors; segment++) {
      const angle = segment / sectors * Math.PI * 2; const contour = islandContour(island, angle); const r = ring / rings;
      const x = island.x + Math.cos(angle) * (island.rx * contour + 8) * r;
      const z = island.z + Math.sin(angle) * (island.rz * contour + 8) * r;
      const d = islandDistance(island, x, z);
      const y = d < 0 ? -.04 - Math.min(5, -d * .38 + Math.pow(Math.max(0, -d - 3), 1.4) * .08) : terrainHeight(x, z);
      positions.push(x, y, z); uvs.push(x / 4, z / 4);
      color.copy(shelf).lerp(sand, smooth(-4, -.2, d)).lerp(green, smooth(.8, 3.4, d));
      if (d > 3.4) color.lerp(lime, .06 + .05 * Math.sin(x * .18 + z * .11));
      if (island.id === 'beacon' && d > 0 && d < 1.7) color.set('#8fa99a').lerp(green, smooth(1.1, 1.7, d));
      colors.push(color.r, color.g, color.b);
      if (ring < rings && segment < sectors) { const a = start + ring * (sectors + 1) + segment; const b = a + sectors + 1; indices.push(a, a + 1, b, a + 1, b + 1, b); }
    }
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new Float32BufferAttribute(colors, 3)); geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
export function pathHeight(path: LandscapePath, x: number, z: number) {
  if (!path.bridge) return terrainHeight(x, z) + .045;
  const a = path.points[0]; const b = path.points[path.points.length - 1]; const span = Math.hypot(b.x - a.x, b.z - a.z);
  const t = Math.max(0, Math.min(1, Math.hypot(x - a.x, z - a.z) / span));
  return Math.max(terrainHeight(x, z) + .045, .85 + Math.sin(t * Math.PI) * 1.15);
}
export function pathGeometry(paths: readonly LandscapePath[]) {
  const positions: number[] = []; const indices: number[] = [];
  for (const path of paths.filter(path => !path.elevated)) {
    const samples: PathPoint[] = [];
    for (let segment = 1; segment < path.points.length; segment++) {
      const a = path.points[segment - 1]; const b = path.points[segment];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) * 4));
      for (let step = 0; step < steps; step++) samples.push({ x: a.x + (b.x - a.x) * step / steps, z: a.z + (b.z - a.z) * step / steps });
    }
    samples.push(path.points[path.points.length - 1]);
    const start = positions.length / 3;
    for (let index = 0; index < samples.length; index++) {
      const point = samples[index]; const before = samples[Math.max(0, index - 1)]; const after = samples[Math.min(samples.length - 1, index + 1)];
      const length = Math.max(.0001, Math.hypot(after.x - before.x, after.z - before.z));
      const nx = -(after.z - before.z) / length * path.width / 2; const nz = (after.x - before.x) / length * path.width / 2;
      for (let across = 0; across <= 4; across++) {
        const offset = 1 - across / 2; const x = point.x + nx * offset; const z = point.z + nz * offset;
        positions.push(x, pathHeight(path, x, z) + .025, z);
        if (index < samples.length - 1 && across < 4) { const n = start + index * 5 + across; indices.push(n, n + 5, n + 1, n + 1, n + 5, n + 6); }
      }
    }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
