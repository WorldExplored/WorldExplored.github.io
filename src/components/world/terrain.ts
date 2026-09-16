import { circulationPaths, entranceRiseAt } from './circulation';
import { coastExposure } from './waves';
import { BRIDGES, BRIDGE_LANDINGS, bridgeHeightAt } from './bridgePlan';
import { cityInfrastructureFootprints } from './cityInfrastructure';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { cityBuildings, createCityTransitRoute } from './city';
import { world, type LandmarkId } from '../../content/world';

export interface Footprint { id: string; x: number; z: number; radius: number }
export interface PathPoint { x: number; z: number }
export interface LandscapePath { id?: string; startY?: number; endY?: number; bridgeId?: string; points: PathPoint[]; width: number; bridge?: boolean; elevated?: boolean }
export interface LandscapeRock extends Footprint { y: number; scale: [number, number, number]; rotation: number }
export interface LandscapeTree extends Footprint { y: number; height: number; rotation: number }
export interface LandscapePlan { structures: Footprint[]; paths: LandscapePath[]; rocks: LandscapeRock[]; trees: LandscapeTree[] }
export interface PlantPosition { x: number; y: number; z: number; scale: number; rotation: number; phase: number; reach: number }
export interface Island { id: string; x: number; z: number; rx: number; rz: number; phase: number; beach: number; hill: number }

export const ISLANDS: readonly Island[] = [
  { id: 'main', x: -4, z: -5, rx: 20, rz: 16, phase: .3, beach: 2.8, hill: 2.4 },
  { id: 'garden', x: 1, z: 23, rx: 22, rz: 10, phase: 1.6, beach: 2.1, hill: 1.1 },
  { id: 'purdue', x: 26, z: -7, rx: 7.2, rz: 8.6, phase: 2.4, beach: 2.3, hill: .7 },
  { id: 'beacon', x: -76, z: -36, rx: 5.8, rz: 5.2, phase: 3.2, beach: 1.1, hill: 1.3 },
  { id: 'city', x: -7, z: -78, rx: 29, rz: 18, phase: 4.1, beach: 3.1, hill: .55 },
];
export const PLANT_REACH = .95;
export const FOOTPRINT_RADII: Record<LandmarkId, number> = { work: 5.5, research: 3.8, purdue: 3.05, about: 3.5, contact: 3.2, building: 2.4 };

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
  let distance = -Infinity;
  for (const island of ISLANDS) distance = Math.max(distance, islandDistance(island, x, z));
  return distance;
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
  for (const landing of BRIDGE_LANDINGS) {
    const blend = 1 - smooth(landing.radius, landing.radius + 1.2, Math.hypot(x-landing.x,z-landing.z));
    if (blend === 0) continue;
    const free = smooth(0, .5, Math.min(...world.landmarks.map(item => Math.hypot(x-item.position[0],z-item.position[2])-FOOTPRINT_RADII[item.id])));
    height += (landing.top - .05 - height) * blend * free;
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
type PlantCell = { circles: Footprint[]; segments: { a: PathPoint; b: PathPoint; halfWidth: number }[] };
const plantIndexes = new WeakMap<LandscapePlan, Map<string, PlantCell>>();
function plantingIndex(plan: LandscapePlan) {
  let index = plantIndexes.get(plan);
  if (index) return index;
  index = new Map();
  function add(x0: number, z0: number, x1: number, z1: number, insert: (cell: PlantCell) => void) {
    for (let z = Math.floor(z0 / 8); z <= Math.floor(z1 / 8); z++) for (let x = Math.floor(x0 / 8); x <= Math.floor(x1 / 8); x++) {
      const key = `${x},${z}`;
      let cell = index!.get(key);
      if (!cell) { cell = { circles: [], segments: [] }; index!.set(key, cell); }
      insert(cell);
    }
  }
  for (const circle of [...plan.structures, ...plan.rocks, ...plan.trees]) {
    const r = circle.radius + 3;
    add(circle.x - r, circle.z - r, circle.x + r, circle.z + r, cell => cell.circles.push(circle));
  }
  for (const path of plan.paths) for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1], b = path.points[i], r = path.width / 2 + 3;
    const segment = { a, b, halfWidth: path.width / 2 };
    add(Math.min(a.x,b.x)-r, Math.min(a.z,b.z)-r, Math.max(a.x,b.x)+r, Math.max(a.z,b.z)+r, cell => cell.segments.push(segment));
  }
  plantIndexes.set(plan, index);
  return index;
}
export function vegetationSuitability(x: number, z: number, reach: number, plan: LandscapePlan) {
  const coast = smooth(1.1, 3.4, landDistance(x, z) - reach);
  if (!coast) return 0;
  let clearance = Infinity;
  if (reach <= 2) {
    const cell = plantingIndex(plan).get(`${Math.floor(x / 8)},${Math.floor(z / 8)}`);
    if (cell) {
      clearance = circleClearance(x, z, cell.circles);
      for (const { a, b, halfWidth } of cell.segments) clearance = Math.min(clearance, distanceToSegment(x, z, a, b) - halfWidth);
    }
  } else clearance = Math.min(circleClearance(x, z, plan.structures), circleClearance(x, z, plan.rocks), circleClearance(x, z, plan.trees), pathClearance(x, z, plan.paths));
  const free = smooth(0, .75, clearance - reach);
  return free ? coast * free * (1 - smooth(.35, .65, terrainSlope(x, z))) : 0;
}
export function canPlacePlant(x: number, z: number, reach: number, plan: LandscapePlan) { return vegetationSuitability(x, z, reach, plan) > 0; }

export function createLandscapePlan(): LandscapePlan {
  const structures = [...architectureFootprints(), ...cityInfrastructureFootprints, ...cityBuildings.map(item => ({ id: item.id, x: item.x, z: item.z, radius: item.radius }))];
  const paths: LandscapePath[] = circulationPaths();
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
function* samplePlantPositions(count: number, plan: LandscapePlan, seed: number): Generator<void, PlantPosition[]> {
  const random = seededRandom(seed); const positions: PlantPosition[] = [];
  const area = ISLANDS.reduce((total, island) => total + island.rx * island.rz, 0);
  for (let attempt = 0; positions.length < count && attempt < count * 140; attempt++) {
    if (attempt % 256 === 0) yield;
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

export function generatePlantPositions(count: number, plan: LandscapePlan, seed = 41) {
  const sampler = samplePlantPositions(count, plan, seed);
  let batch = sampler.next();
  while (!batch.done) batch = sampler.next();
  return batch.value;
}
export async function generatePlantPositionsAsync(count: number, plan: LandscapePlan, signal: AbortSignal, seed = 41) {
  const sampler = samplePlantPositions(count, plan, seed);
  let batch = sampler.next();
  while (!batch.done) {
    if (signal.aborted) return null;
    const deadline = performance.now() + 5;
    do { batch = sampler.next(); } while (!batch.done && performance.now() < deadline);
    if (!batch.done) await new Promise(resolve => setTimeout(resolve, 0));
  }
  return signal.aborted ? null : batch.value;
}

/** A shared Cartesian lattice avoids radial seams and overlapping island shelves. */
export function archipelagoGeometry() {
  const geometry = new BufferGeometry();
  const positions: number[] = [], colors: number[] = [], uvs: number[] = [], zones: number[] = [], exposures: number[] = [], indices: number[] = [];
  const step = .4, vertices = new Map<string, number>();
  const vertex = (ix: number, iz: number) => {
    const key = `${ix},${iz}`;
    const existing = vertices.get(key); if (existing !== undefined) return existing;
    const x = ix * step, z = iz * step, y = terrainHeight(x, z);
    const index = positions.length / 3; vertices.set(key, index);
    positions.push(x, y, z); uvs.push(x / 4, z / 4); colors.push(1, 1, 1);
    const distance = landDistance(x, z);
    zones.push(distance, y, 0); exposures.push(distance > -.8 && distance < .8 ? coastExposure(x, z, distance) : 0);
    return index;
  };
  for (let iz = -280; iz < 110; iz++) for (let ix = -230; ix < 105; ix++) {
    if (landDistance((ix + .5) * step, (iz + .5) * step) < -6.5) continue;
    const a = vertex(ix, iz), b = vertex(ix + 1, iz), c = vertex(ix, iz + 1), d = vertex(ix + 1, iz + 1);
    indices.push(a, c, b, b, c, d);
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aTerrain', new Float32BufferAttribute(zones, 3));
  geometry.setAttribute('aExposure', new Float32BufferAttribute(exposures, 1));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal'), terrain = geometry.getAttribute('aTerrain');
  for (let i = 0; i < normals.count; i++) terrain.setZ(i, Math.hypot(normals.getX(i), normals.getZ(i)) / Math.max(.01, normals.getY(i)));
  return geometry;
}
const meshHeightSamples = new Map<string,number>();
function latticeHeight(ix:number,iz:number) {
  const key=`${ix},${iz}`;let value=meshHeightSamples.get(key);
  if(value===undefined){value=terrainHeight(ix*.4,iz*.4);meshHeightSamples.set(key,value);}
  return value;
}
/** Height on the same two triangles used by the ground lattice. */
export function terrainMeshHeight(x: number, z: number) {
  const step = .4, ix = Math.floor(x / step), iz = Math.floor(z / step);
  const u = x / step - ix, v = z / step - iz;
  const b = latticeHeight(ix+1,iz), c = latticeHeight(ix,iz+1);
  return u + v <= 1 ? latticeHeight(ix,iz) * (1 - u - v) + b * u + c * v
    : latticeHeight(ix+1,iz+1) * (u + v - 1) + b * (1 - v) + c * (1 - u);
}
export function pathHeight(path: LandscapePath, x: number, z: number) {
  if (!path.bridge) {
    let base=terrainMeshHeight(x,z)+.045;
    // The gallery court itself is a raised walking surface; paths cross its slab before descending.
    if(path.id==='gallery-entrance'||path.id==='conservatory-entrance') {
      const distance=Math.hypot(Math.max(-12.82-x,0,x+7.18),Math.max(20.72-z,0,z-25.18));
      const t=Math.max(0,1-distance/.85);base=Math.max(base,base+(1.035-base)*t*t*(3-2*t));
    }
    return entranceRiseAt(path,x,z,base);
  }
  return bridgeHeightAt(BRIDGES.find(bridge => bridge.id === path.bridgeId)!, x, z);
}
export function pathGeometry(paths: readonly LandscapePath[]) {
  const positions: number[] = []; const indices: number[] = [];
  for (const [pathIndex,path] of paths.filter(path => !path.elevated && !path.bridge).entries()) {
    const samples: PathPoint[] = [];
    for (let segment = 1; segment < path.points.length; segment++) {
      const a = path.points[segment - 1]; const b = path.points[segment];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) * 12));
      for (let step = 0; step < steps; step++) samples.push({ x: a.x + (b.x - a.x) * step / steps, z: a.z + (b.z - a.z) * step / steps });
    }
    samples.push(path.points[path.points.length - 1]);
    const start = positions.length / 3;
    for (let index = 0; index < samples.length; index++) {
      const point = samples[index]; const before = samples[Math.max(0, index - 1)]; const after = samples[Math.min(samples.length - 1, index + 1)];
      const length = Math.max(.0001, Math.hypot(after.x - before.x, after.z - before.z));
      const nx = -(after.z - before.z) / length * path.width / 2; const nz = (after.x - before.x) / length * path.width / 2;
      for (let across = 0; across <= 12; across++) {
        const offset = 1 - across / 6; const x = point.x + nx * offset; const z = point.z + nz * offset;
        // Bounded millimeter separation prevents coplanar joins from flickering.
        positions.push(x, pathHeight(path, x, z)+(pathIndex%3)*.002, z);
        if (index < samples.length - 1 && across < 12) { const n = start + index * 13 + across; indices.push(n, n + 13, n + 1, n + 1, n + 13, n + 14); }
      }
    }
  }
  // Close exposed ramp edges down into the same ground lattice used by the terrain.
  const surfaceCount=positions.length/3;
  for(let i=0;i<surfaceCount;i+=13) {
    for(const edge of [0,12]) {
      const top=(i+edge)*3,x=positions[top],z=positions[top+2];
      positions.push(x,terrainMeshHeight(x,z)-.025,z);
    }
  }
  // Each path remains independently capped, so disjoint streets never acquire connecting walls.
  let row=0;
  for(const path of paths.filter(path=>!path.elevated&&!path.bridge)) {
    let rows=1;for(let i=1;i<path.points.length;i++)rows+=Math.max(1,Math.ceil(Math.hypot(path.points[i].x-path.points[i-1].x,path.points[i].z-path.points[i-1].z)*12));
    for(let i=0;i<rows-1;i++)for(const side of [0,1]) {
      const a=(row+i)*13+side*12,b=a+13,c=surfaceCount+(row+i)*2+side,d=c+2;
      if(side===0)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);
    }
    for(const i of [0,rows-1]) {const a=(row+i)*13,b=a+12,c=surfaceCount+(row+i)*2;indices.push(a,b,c,b,c+1,c);}
    row+=rows;
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.userData.surfaceVertexCount=surfaceCount;geometry.userData.rowStride=13;return geometry;
}
