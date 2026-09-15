import { Ray, Vector3 } from 'three';
import { world, type Vec3 } from '../../content/world';
import { seededRandom } from './terrain';

export interface CloudPuff { offset: Vec3; scale: Vec3 }
export interface CloudCluster { center: Vec3; speed: number; puffs: CloudPuff[]; response: number; targeted: boolean }
export interface PuffTransform { position: Vector3; scale: Vector3 }

export function createCloudClusters(count = world.quality.high.clouds): CloudCluster[] {
  const random = seededRandom(119);
  const shape: { offset: Vec3; scale: Vec3 }[] = [
    { offset: [-1.65, .15, 0], scale: [1.05, .88, .88] },
    { offset: [-.65, .62, .05], scale: [1.20, 1.10, .98] },
    { offset: [.42, .87, 0], scale: [1.22, 1.25, 1.00] },
    { offset: [1.6, .28, .12], scale: [.98, .82, .82] },
    { offset: [.65, -.06, .4], scale: [1.18, .65, .95] },
    { offset: [-.75, -.12, .35], scale: [1.12, .62, .9] },
  ];
  return Array.from({ length: count }, (_, index) => {
    const size = 1.1 + random() * .9;
    const center: Vec3 = [(index % 8 - 3.5) * 16 + (random() - .5) * 5, 13 + random() * 10, -27 - Math.floor(index / 8) * 38 - random() * 17];
    return { center, speed: world.environment.cloudSpeed * (.3 + random() * .7), response: 0, targeted: false,
      puffs: shape.map(puff => ({ offset: puff.offset.map(value => value * size) as Vec3, scale: puff.scale.map(value => value * size) as Vec3 })) };
  });
}

export function cloudOriginX(cluster: CloudCluster, elapsed: number) {
  return ((cluster.center[0] + elapsed * cluster.speed + 110) % 220 + 220) % 220 - 110;
}

export function cloudPuffTransform(cluster: CloudCluster, puff: CloudPuff, elapsed: number, response: number, output: PuffTransform) {
  output.position.set(cloudOriginX(cluster, elapsed) + puff.offset[0] * (1 + response * .10), cluster.center[1] + puff.offset[1] * (1 - response * .08), cluster.center[2] + puff.offset[2]);
  output.scale.set(puff.scale[0] * (1 + response * .025), puff.scale[1] * (1 - response * .10), puff.scale[2]);
  return output;
}

// A cluster's interaction volume is the union of the same ellipsoids used to draw its puffs.
export function rayCloudDistance(ray: Ray, cluster: CloudCluster, elapsed: number, response = cluster.response): number | null {
  let nearest = Infinity;
  const originX = cloudOriginX(cluster, elapsed);
  for (const puff of cluster.puffs) {
    const x = originX + puff.offset[0] * (1 + response * .10);
    const y = cluster.center[1] + puff.offset[1] * (1 - response * .08);
    const z = cluster.center[2] + puff.offset[2];
    const sx = puff.scale[0] * (1 + response * .025);
    const sy = puff.scale[1] * (1 - response * .10);
    const sz = puff.scale[2];
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
  if (ray) for (let index = 0; index < activeCount; index++) {
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
