import { Ray, Vector3 } from 'three';
import { world, type Vec3 } from '../../content/world';
import { seededRandom } from './terrain';

export type CloudArchetype = 'layered' | 'cauliflower' | 'cotton' | 'bank' | 'atmospheric';
export interface CloudPuff { offset: Vec3; scale: Vec3 }
export interface CloudCluster { archetype: CloudArchetype; center: Vec3; azimuth: number; density: number; speed: number; puffs: CloudPuff[]; response: number; targeted: boolean }
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
    [-1.05, 1.2, -.15, 1.15, 1.15, 1], [.55, 1.3, .3, 1.15, 1.3, 1.05], [1.1, 2.45, -.1, .9, 1.05, .9],
    [-.25, 2.7, -.2, 1.1, 1.2, 1.05], [-.5, 3.75, -.3, .85, .9, .85],
  ],
  cotton: [
    [-.85, .1, -.05, 1.1, 1, 1], [.8, .2, -.1, 1.2, 1.1, 1.05], [.05, 1.1, -.25, 1.1, 1.2, 1], [.1, .2, .8, 1.2, .85, 1.1],
  ],
  bank: [
    [-5.5, 0, -.2, 1.4, .65, 1], [-4, .4, -.4, 1.4, .95, 1], [-2.5, .05, 0, 1.6, .7, 1.2], [-1, .5, -.2, 1.6, 1.1, 1.15],
    [.7, .15, .15, 1.65, .8, 1.2], [2.3, .5, -.15, 1.35, .95, 1], [3.8, .1, 0, 1.35, .75, .9], [5.1, -.15, .3, 1.25, .55, .9],
    [-3.25, -.35, .85, 1.35, .5, 1], [-.2, -.35, 1, 1.65, .55, 1.2], [2.6, -.3, .85, 1.5, .5, 1.1], [4.5, -.3, .85, 1.1, .45, .8],
  ],
  atmospheric: [
    [-4.5, 0, 0, 2.4, .32, 1.2], [-2.1, .12, -.5, 2.25, .4, 1.15], [.3, .05, -.25, 2.5, .38, 1.3],
    [2.8, -.08, .1, 2.25, .3, 1.05], [4.8, -.12, .2, 1.8, .24, .8], [-.7, -.15, 1, 2.1, .25, 1.2],
  ],
};
const PROMINENT_CENTERS: Vec3[] = [
  [-38, 19, -7], [19, 21, -25], [-8, 18, 13], [53, 23, -59], [-18, 26, -106],
  [7, 19, -47], [-69, 22, -65], [47, 17, 17], [-47, 24, -87], [65, 27, -116],
];

export function createCloudClusters(count = world.quality.high.clouds): CloudCluster[] {
  const random = seededRandom(119);
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => {
    const archetype = ARCHETYPES[index % ARCHETYPES.length];
    const azimuth = (index % 2 ? -1 : 1) * (.15 + random() * .85);
    const density = .86 + random() * .25;
    const size = (archetype === 'atmospheric' ? 1.55 : archetype === 'cauliflower' ? .95 : 1.15) + random() * .4;
    const stretch: Vec3 = [size * (.92 + random() * .23), size * (.88 + random() * .2), size * (.85 + random() * .3)];
    const center: Vec3 = index < PROMINENT_CENTERS.length ? [...PROMINENT_CENTERS[index]] : [-92 + random() * 184, 19 + random() * 8, -115 + random() * 110];
    const cosine = Math.cos(azimuth);
    const sine = Math.sin(azimuth);
    return { archetype, center, azimuth, density, speed: world.environment.cloudSpeed * (.22 + random() * .85), response: 0, targeted: false,
      puffs: PUFF_GRAPHS[archetype].map(([x, y, z, sx, sy, sz]) => {
        const spreadX = x * stretch[0] / density;
        const spreadZ = z * stretch[2] / density;
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

export function cloudOriginX(cluster: CloudCluster, elapsed: number) {
  return cluster.center[0] + 18 * Math.sin(elapsed * cluster.speed / 18);
}

export function cloudPuffTransform(cluster: CloudCluster, puff: CloudPuff, elapsed: number, response: number, output: PuffTransform) {
  const amount = Math.min(1, Math.max(0, response));
  output.position.set(cloudOriginX(cluster, elapsed) + puff.offset[0] * (1 - amount * .035), cluster.center[1] + puff.offset[1] * (1 - amount * .08), cluster.center[2] + puff.offset[2]);
  output.scale.set(puff.scale[0] * (1 - amount * .025), puff.scale[1] * (1 - amount * .10), puff.scale[2] * (1 - amount * .02));
  return output;
}

// The interaction volume is the union of the exact axis-aligned ellipsoids drawn by the renderer.
export function rayCloudDistance(ray: Ray, cluster: CloudCluster, elapsed: number, response = cluster.response): number | null {
  let nearest = Infinity;
  const originX = cloudOriginX(cluster, elapsed);
  const amount = Math.min(1, Math.max(0, response));
  for (const puff of cluster.puffs) {
    const x = originX + puff.offset[0] * (1 - amount * .035);
    const y = cluster.center[1] + puff.offset[1] * (1 - amount * .08);
    const z = cluster.center[2] + puff.offset[2];
    const sx = puff.scale[0] * (1 - amount * .025);
    const sy = puff.scale[1] * (1 - amount * .10);
    const sz = puff.scale[2] * (1 - amount * .02);
    const ox = (ray.origin.x - x) / sx;
    const oy = (ray.origin.y - y) / sy;
    const oz = (ray.origin.z - z) / sz;
    const dx = ray.direction.x / sx;
    const dy = ray.direction.y / sy;
    const dz = ray.direction.z / sz;
    const a = dx * dx + dy * dy + dz * dz;
    const b = ox * dx + oy * dy + oz * dz;
    const c = ox * ox + oy * oy + oz * oz - 1;
    const determinant = b * b - a * c;
    if (determinant < 0 || a === 0) continue;
    const root = Math.sqrt(determinant);
    const entrance = (-b - root) / a;
    const exit = (-b + root) / a;
    if (exit >= 0) nearest = Math.min(nearest, Math.max(0, entrance));
  }
  return Number.isFinite(nearest) ? nearest : null;
}

export function updateCloudResponses(clusters: CloudCluster[], ray: Ray | null, elapsed: number, delta: number, activeCount: number, paused: boolean) {
  if (paused) return 0;
  let selected = -1;
  let nearest = Infinity;
  const active = Math.min(clusters.length, Math.max(0, Math.floor(activeCount)));
  if (ray) for (let index = 0; index < active; index++) {
    const cluster = clusters[index];
    const actual = rayCloudDistance(ray, cluster, elapsed);
    const resting = cluster.response > .01 ? rayCloudDistance(ray, cluster, elapsed, 0) : null;
    const distance = actual === null ? resting : resting === null ? actual : Math.min(actual, resting);
    if (distance !== null && distance < nearest) { nearest = distance; selected = index; }
  }
  let entries = 0;
  const blend = 1 - Math.exp(-7 * Math.min(.05, Math.max(0, delta)));
  for (let index = 0; index < clusters.length; index++) {
    const cluster = clusters[index];
    const target = index === selected;
    if (target && !cluster.targeted) entries++;
    cluster.targeted = target;
    cluster.response += ((target ? 1 : 0) - cluster.response) * blend;
  }
  return entries;
}
