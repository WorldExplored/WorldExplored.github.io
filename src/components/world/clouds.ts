import { Ray, Vector3 } from 'three';
import { world, type Vec3 } from '../../content/world';
import { seededRandom } from './terrain';
import { windDisplacement } from './weatherState';

export type CloudArchetype = 'layered' | 'cauliflower' | 'cotton' | 'bank' | 'atmospheric';
export interface CloudPuff { offset: Vec3; scale: Vec3 }
export interface CloudCluster { archetype: CloudArchetype; center: Vec3; azimuth: number; density: number; speed: number; layer: number; puffs: CloudPuff[]; response: number; targeted: boolean; interaction: Vec3 }
export interface PuffTransform { position: Vector3; scale: Vector3 }
export interface CloudInstanceRange { start: number; count: number }

const ARCHETYPES: CloudArchetype[] = ['layered', 'cauliflower', 'cotton', 'bank', 'atmospheric'];
const PUFF_GRAPHS: Record<CloudArchetype, [number, number, number, number, number, number][]> = {
  layered: [
    [-3.2, 0, .1, 1.4, .65, 1.05], [-1.5, -.12, .7, 1.6, .7, 1.2], [.4, -.05, .65, 1.65, .65, 1.15], [2.3, .03, .2, 1.55, .7, 1.05],
    [-2.2, .7, -.4, 1.35, 1.05, 1.1], [-.4, 1.15, -.6, 1.5, 1.4, 1.2], [1.45, .95, -.45, 1.35, 1.2, 1.1], [3.2, .35, -.3, 1.05, .8, .9],
    [-1.05, .5, 1.1, 1.3, .9, 1.05], [1.05, .6, 1.1, 1.25, .95, 1.1],
  ],
  cauliflower: [
    [-1.6, .05, .1, 1.05, .8, 1], [.1, -.05, .3, 1.3, .75, 1.15], [1.5, .2, .15, 1, .9, .9],
    [-1.4, 1.1, -.15, 1.2, 1.0, 1], [.45, 1.35, .3, 1.2, 1.12, 1.05], [1.7, 1.75, -.1, 1.1, .86, .9],
    [-.75, 2.15, -.2, 1.15, .87, 1.05], [-2.15, .45, .3, 1.05, .65, .95],
  ],
  cotton: [
    [-.85, .1, -.05, 1.1, 1, 1], [.8, .2, -.1, 1.2, 1.1, 1.05], [.05, 1.1, -.25, 1.1, 1.2, 1], [.1, .2, .8, 1.2, .85, 1.1],
  ],
  bank: [
    [-5.5, 0, -.2, 1.4, 1.0, 1.5], [-4, .7, -.4, 1.4, 1.3, 1.4], [-2.5, .15, 0, 1.6, 1.0, 1.6], [-1, 1.2, -.2, 1.6, 1.55, 1.6],
    [.7, .55, .15, 1.65, 1.15, 1.55], [2.3, 1.2, -.15, 1.35, 1.4, 1.4], [3.8, .3, 0, 1.35, 1.1, 1.35], [5.1, -.1, .3, 1.25, .8, 1.2],
    [-3.25, -.35, .85, 1.35, .5, 1], [-.2, -.35, 1, 1.65, .55, 1.2], [2.6, -.3, .85, 1.5, .5, 1.1], [4.5, -.3, .85, 1.1, .45, .8],
  ],
  atmospheric: [
    [-4.5, 0, 0, 2.4, .32, 1.2], [-2.1, .12, -.5, 2.25, .4, 1.15], [.3, .05, -.25, 2.5, .38, 1.3],
    [2.8, -.08, .1, 2.25, .3, 1.05], [4.8, -.12, .2, 1.8, .24, .8], [-.7, -.15, 1, 2.1, .25, 1.2],
  ],
};
const PROMINENT_CENTERS: Vec3[] = [
  [-43, 23, -15], [25, 25, -49], [-8, 24, 38], [70, 27, 22], [-30, 34, -155],
  [6, 24, -81], [-112, 28, -48], [22, 25, 84], [-95, 29, -112], [112, 35, -125],
];

export function createCloudClusters(count = world.quality.high.clouds): CloudCluster[] {
  const random = seededRandom(119);
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => {
    const archetype = ARCHETYPES[index % ARCHETYPES.length];
    const azimuth = (index % 2 ? -1 : 1) * (.15 + random() * .85);
    const density = 1.04 + random() * .12;
    const size = (archetype === 'atmospheric' ? 1.7 : archetype === 'cauliflower' ? 1.18 : 1.4) + random() * .35;
    const distantScale = index >= 8 && (archetype === 'bank' || archetype === 'atmospheric') ? 3.8 + random() * 2.4 : 1;
    const stretch: Vec3 = [size * distantScale * (.92 + random() * .23), size * Math.sqrt(distantScale) * (.94 + random() * .16), size * Math.sqrt(distantScale) * (1.02 + random() * .3)];
    const angle = index * 2.399;
    const distance = 85 + random() * 55;
    const center: Vec3 = index < PROMINENT_CENTERS.length ? [...PROMINENT_CENTERS[index]] : [Math.cos(angle) * distance - 15, 27 + random() * 9, Math.sin(angle) * distance - 35];
    if (archetype === 'atmospheric') center[1] += 3;
    if (distantScale > 1) { center[1] += 24; center[2] -= 110; }
    const cosine = Math.cos(azimuth);
    const sine = Math.sin(azimuth);
    const layer = archetype === 'atmospheric' ? 2 : index % 3;
    return { archetype, center, azimuth, density, layer, speed: world.environment.cloudSpeed * [2.1, 1.55, 1.1][layer], response: 0, targeted: false, interaction: [0, 0, 0],
      puffs: PUFF_GRAPHS[archetype].map(([x, y, z, sx, sy, sz]) => {
        const spreadX = (x + (random()-.5)*.3) * stretch[0] / density;
        const spreadZ = (z + (random()-.5)*.3) * stretch[2] / density;
        return { offset: [spreadX * cosine - spreadZ * sine, y * stretch[1], spreadX * sine + spreadZ * cosine], scale: [sx * stretch[0], sy * stretch[1], sz * stretch[2]] };
      }) };
  });
}

export function cloudInstanceRanges(clusters: readonly CloudCluster[]): CloudInstanceRange[] {
  let start = 0;
  return clusters.map(cluster => { const range = { start, count: cluster.puffs.length }; start += range.count; return range; });
}

export function cloudInstanceCount(clusters: readonly CloudCluster[], activeCount = clusters.length) {
  let count = 0;
  for (let index = 0; index < Math.min(clusters.length, Math.max(0, Math.floor(activeCount))); index++) count += clusters[index].puffs.length;
  return count;
}

const travel = new Vector3();
/** Recycle only beyond the distant sky fade; every visible cloud travels with the wind. */
export function cloudOrigin(cluster: CloudCluster, elapsed: number, output: Vector3) {
  windDisplacement(elapsed, travel);
  const speed = cluster.speed / (world.environment.cloudSpeed * 2.1);
  const unwrapped = cluster.center[0] + travel.x * speed;
  const x = ((unwrapped + 520) % 1040 + 1040) % 1040 - 520;
  const z = cluster.center[2] + travel.z * speed - (unwrapped - x) * (.23 / .48);
  return output.set(x, cluster.center[1], z);
}

export function cloudVisibility(cluster: CloudCluster, elapsed: number) {
  cloudOrigin(cluster, elapsed, travel);
  const edge = Math.max(0, Math.min(1, (Math.abs(travel.x) - 400) / 120));
  return 1 - edge * edge * (3 - 2 * edge);
}

export function cloudOriginX(cluster: CloudCluster, elapsed: number) { return cloudOrigin(cluster, elapsed, travel).x; }

export function advanceCloudPress(clusters: CloudCluster[], selected: number, delta: number, reduced: boolean) {
  const blend = reduced ? 1 : 1 - Math.exp(-7 * Math.min(.05, Math.max(0, delta)));
  for (let index = 0; index < clusters.length; index++) {
    const cluster = clusters[index];
    cluster.targeted = index === selected;
    cluster.response += ((cluster.targeted ? 1 : 0) - cluster.response) * blend;
  }
}

export function cloudPuffTransform(cluster: CloudCluster, puff: CloudPuff, elapsed: number, _response: number, output: PuffTransform) {
  cloudOrigin(cluster, elapsed, output.position);
  output.position.x += puff.offset[0]; output.position.y += puff.offset[1]; output.position.z += puff.offset[2];
  output.scale.fromArray(puff.scale);
  return output;
}

/** Smooth density unions erase intersecting ellipsoid boundaries before meshing. */
export function cloudDensity(cluster: CloudCluster, x: number, y: number, z: number) {
  let field = 0;
  for (const puff of cluster.puffs) {
    const dx = (x - puff.offset[0]) / puff.scale[0];
    const dy = (y - puff.offset[1]) / puff.scale[1];
    const dz = (z - puff.offset[2]) / puff.scale[2];
    const radius = dx * dx + dy * dy + dz * dz;
    if (radius < 5) field += Math.exp(-2.2 * radius);
  }
  // Correlated relief belongs to the volume, so the outline and shading agree.
  const coarse = Math.sin(x * 2.2 + Math.sin(z * 1.1)) * Math.sin(y * 2.4 + z * .7);
  const fine = Math.sin(x * 5.1 + y * 1.3) * Math.sin(z * 4.7 - y * 3.8);
  return field - .22 + coarse * .023 + fine * .009;
}

export function cloudBounds(cluster: CloudCluster) {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const puff of cluster.puffs) for (let axis = 0; axis < 3; axis++) {
    min.setComponent(axis, Math.min(min.getComponent(axis), puff.offset[axis] - puff.scale[axis] * 1.65));
    max.setComponent(axis, Math.max(max.getComponent(axis), puff.offset[axis] + puff.scale[axis] * 1.65));
  }
  return { min, max };
}

export function cloudDeformation(cluster: CloudCluster, point: Vector3, normal: Vector3, output: Vector3) {
  const distance = (point.x - cluster.interaction[0]) ** 2 + (point.y - cluster.interaction[1]) ** 2 + (point.z - cluster.interaction[2]) ** 2;
  return output.copy(point).addScaledVector(normal, -.55 * cluster.response * Math.exp(-distance / 5.2));
}

const origin = new Vector3();
const sample = new Vector3();
const boundsCache = new WeakMap<CloudCluster, { puffs: CloudPuff[]; min: Vector3; max: Vector3 }>();

// A resting density surface owns pointer input while its small local dimple moves.
export function rayCloudDistance(ray: Ray, cluster: CloudCluster, elapsed: number, _response = cluster.response): number | null {
  void _response; // Ownership stays on the resting surface while the local dimple moves.
  cloudOrigin(cluster, elapsed, origin);
  let bounds = boundsCache.get(cluster);
  if (!bounds || bounds.puffs !== cluster.puffs) { bounds = { ...cloudBounds(cluster), puffs: cluster.puffs }; boundsCache.set(cluster, bounds); }
  let entrance = 0; let exit = Infinity;
  for (let axis = 0; axis < 3; axis++) {
    const direction = ray.direction.getComponent(axis);
    const local = ray.origin.getComponent(axis) - origin.getComponent(axis);
    if (Math.abs(direction) < 1e-8) {
      if (local < bounds.min.getComponent(axis) || local > bounds.max.getComponent(axis)) return null;
      continue;
    }
    const a = (bounds.min.getComponent(axis) - local) / direction;
    const b = (bounds.max.getComponent(axis) - local) / direction;
    entrance = Math.max(entrance, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
  }
  if (exit < entrance) return null;
  for (let distance = entrance; distance <= exit; distance += .16) {
    ray.at(distance, sample).sub(origin);
    if (cloudDensity(cluster, sample.x, sample.y, sample.z) >= -.012) return distance;
  }
  return null;
}

export function updateCloudResponses(clusters: CloudCluster[], ray: Ray | null, elapsed: number, delta: number, activeCount: number, paused: boolean) {
  if (paused) return 0;
  let selected = -1;
  let nearest = Infinity;
  const active = Math.min(clusters.length, Math.max(0, Math.floor(activeCount)));
  if (ray) for (let index = 0; index < active; index++) {
    const distance = rayCloudDistance(ray, clusters[index], elapsed);
    if (distance !== null && distance < nearest) { nearest = distance; selected = index; }
  }
  let entries = 0;
  const blend = 1 - Math.exp(-7 * Math.min(.05, Math.max(0, delta)));
  for (let index = 0; index < clusters.length; index++) {
    const cluster = clusters[index];
    const target = index === selected;
    if (target && ray) {
      ray.at(nearest, sample); cloudOrigin(cluster, elapsed, origin); sample.sub(origin);
      if (!cluster.targeted && cluster.response < .01) cluster.interaction = sample.toArray() as Vec3;
      else for (let axis = 0; axis < 3; axis++) cluster.interaction[axis] += (sample.getComponent(axis) - cluster.interaction[axis]) * blend;
      if (!cluster.targeted) entries++;
    }
    cluster.targeted = target;
    cluster.response += ((target ? 1 : 0) - cluster.response) * blend;
  }
  return entries;
}
