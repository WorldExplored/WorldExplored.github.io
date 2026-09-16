import { BRIDGES } from './bridgePlan';
import { createCityInfrastructureObstacles } from './cityInfrastructure';
import { MathUtils, Ray, Vector3 } from 'three';
import { landmarkFor, world, type CameraPose, type LandmarkId } from '../../content/world';
import { cityBuildings, createCityTransitRoute } from './city';
import { architectureFootprints, createLandscapePlan, terrainHeight } from './terrain';

export const CAMERA_LIMITS = { minDistance: 8, maxDistance: 220, minPolarAngle: .28, maxPolarAngle: 1.43, minY: 3.5 };
export interface CameraObstacle { x: number; z: number; radius: number; top: number }
const HEIGHTS: Record<LandmarkId, number> = { work: 11.6, research: 7, purdue: 4.3, about: 5, contact: 6.5, building: 7.8 };
const CLEARANCE = 1.15;

export function cameraObstacles(): CameraObstacle[] {
  return [
    ...BRIDGES.flatMap(bridge => bridge.samples.filter((_,i) => i % 4 === 0).map(({point}) => ({ x: point.x, z: point.z, radius: bridge.width/2 + CLEARANCE, top: point.y + bridge.railHeight + CLEARANCE }))),
    ...createCityInfrastructureObstacles().map(item => ({ x: item.x, z: item.z, radius: item.radius + CLEARANCE, top: item.base + item.height + CLEARANCE })),
    ...architectureFootprints().map(item => ({ x: item.x, z: item.z, radius: item.radius + CLEARANCE, top: terrainHeight(item.x, item.z) + HEIGHTS[item.id as LandmarkId] + CLEARANCE })),
    ...cityBuildings.map(item => ({ x: item.x, z: item.z, radius: item.radius + CLEARANCE, top: terrainHeight(item.x, item.z) + item.height + CLEARANCE })),
    ...createCityTransitRoute().curve.getPoints(100).map(point => ({ x: point.x, z: point.z, radius: 1.5, top: point.y + 2.2 })),
    ...createLandscapePlan().trees.map(item => ({ x: item.x, z: item.z, radius: item.radius + CLEARANCE, top: item.y + item.height + CLEARANCE })),
  ];
}

/** Keep the entire near plane clear of terrain and conservative structure envelopes. */
export function constrainCameraPose(position: Vector3, target: Vector3, obstacles: readonly CameraObstacle[]) {
  target.set(MathUtils.clamp(target.x, -110, 80), MathUtils.clamp(target.y, -20, 24), MathUtils.clamp(target.z, -120, 60));
  let dx = position.x - target.x;
  let dy = position.y - target.y;
  let dz = position.z - target.z;
  let radius = MathUtils.clamp(Math.hypot(dx, dy, dz), CAMERA_LIMITS.minDistance, CAMERA_LIMITS.maxDistance);
  const theta = Math.atan2(dx, dz);
  let phi = MathUtils.clamp(Math.atan2(Math.hypot(dx, dz), dy), CAMERA_LIMITS.minPolarAngle, CAMERA_LIMITS.maxPolarAngle);
  // Raising the orbit over an obstruction preserves the user's bearing and avoids wedging at corners.
  for (let iteration = 0; iteration < 5; iteration++) {
    const horizontal = radius * Math.sin(phi);
    position.set(target.x + horizontal * Math.sin(theta), target.y + radius * Math.cos(phi), target.z + horizontal * Math.cos(theta));
    let floor = Math.max(CAMERA_LIMITS.minY, terrainHeight(position.x, position.z) + CLEARANCE);
    for (const obstacle of obstacles) {
      if (Math.hypot(position.x - obstacle.x, position.z - obstacle.z) < obstacle.radius) floor = Math.max(floor, obstacle.top);
    }
    if (position.y >= floor) break;
    dy = floor - target.y + .001;
    radius = Math.max(radius, dy / Math.cos(CAMERA_LIMITS.minPolarAngle));
    phi = Math.max(CAMERA_LIMITS.minPolarAngle, Math.min(phi, Math.acos(MathUtils.clamp(dy / radius, -1, 1))));
  }
  dx = radius * Math.sin(phi) * Math.sin(theta);
  dz = radius * Math.sin(phi) * Math.cos(theta);
  position.set(target.x + dx, target.y + radius * Math.cos(phi), target.z + dz);
}

/** Clip a fast wheel/pan step before it can cross a structure between rendered frames. */
export function clipCameraTravel(from: Vector3, to: Vector3, obstacles: readonly CameraObstacle[]) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const a = dx * dx + dz * dz;
  if (a < 1e-10) return;
  let fraction = 1;
  for (const obstacle of obstacles) {
    const x = from.x - obstacle.x;
    const z = from.z - obstacle.z;
    const c = x * x + z * z - obstacle.radius * obstacle.radius;
    const b = 2 * (x * dx + z * dz);
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0 || c < 0) continue;
    const enter = Math.max(0, (-b - Math.sqrt(discriminant)) / (2 * a));
    const leave = Math.min(1, (-b + Math.sqrt(discriminant)) / (2 * a));
    if (enter > leave) continue;
    const firstBelow = dy < 0 ? Math.max(enter, (obstacle.top - from.y) / dy) : enter;
    if (firstBelow <= leave && from.y + dy * firstBelow < obstacle.top + 1e-6) fraction = Math.min(fraction, Math.max(0, firstBelow - .002));
  }
  to.set(from.x + dx * fraction, from.y + dy * fraction, from.z + dz * fraction);
}

export function intersectTerrainRay(ray: Ray, result: Vector3) {
  if (ray.direction.y >= -.015) return false;
  const far = Math.min(300, -ray.origin.y / ray.direction.y + 1.5);
  let near = 0;
  // Bracket the first visible surface, including steep shoreline transitions.
  for (let distance = 1.5; distance <= far + 1.5; distance += 1.5) {
    let end = Math.min(distance, far);
    ray.at(end, result);
    if (result.y <= Math.max(0, terrainHeight(result.x, result.z))) {
      for (let iteration = 0; iteration < 14; iteration++) {
        const middle = (near + end) / 2;
        ray.at(middle, result);
        if (result.y > Math.max(0, terrainHeight(result.x, result.z))) near = middle;
        else end = middle;
      }
      ray.at((near + end) / 2, result);
      return true;
    }
    near = end;
  }
  return false;
}

/** Scaling both camera and target about the hit preserves its screen position. */
export function zoomTowardPoint(position: Vector3, target: Vector3, point: Vector3, factor: number) {
  const distance = position.distanceTo(target);
  const scale = MathUtils.clamp(factor, CAMERA_LIMITS.minDistance / distance, CAMERA_LIMITS.maxDistance / distance);
  position.sub(point).multiplyScalar(scale).add(point);
  target.sub(point).multiplyScalar(scale).add(point);
}

export function focusPose(destination: LandmarkId | '', mobile: boolean, aspect: number): CameraPose {
  const landmark = landmarkFor(destination);
  const target = new Vector3();
  const position = new Vector3();
  const safeAspect = Math.max(.3, aspect);
  if (!landmark) {
    const overview = mobile ? world.mobileOverview : world.overview;
    target.fromArray(overview.target);
    const fit = Math.max(1, Math.min(mobile ? 2.4 : 1.55, (mobile ? .86 : 1.35) / safeAspect));
    position.fromArray(overview.position).sub(target).multiplyScalar(fit).add(target);
  } else {
    const footprint = architectureFootprints().find(item => item.id === destination)!;
    const tangent = Math.tan(43 * Math.PI / 360);
    const direction = new Vector3(mobile ? .25 : .32, mobile ? .38 : .3, .9).normalize().applyAxisAngle(new Vector3(0, 1, 0), landmark.rotationY ?? 0);
    const distance = mobile ? Math.min(60, Math.max(24, HEIGHTS[landmark.id] / (tangent * .52), (footprint.radius + 1.8) / (tangent * safeAspect))) : Math.max(23, footprint.radius * 4 + 10) * Math.max(1, 1.2 / safeAspect);
    target.fromArray(landmark.position);
    target.y = terrainHeight(target.x, target.z) + HEIGHTS[landmark.id] * .45;
    if (mobile) {
      const upY = Math.sqrt(1 - direction.y * direction.y);
      target.y -= distance * tangent * .59 / upY;
    } else {
      const right = new Vector3(direction.z, 0, -direction.x).normalize();
      target.addScaledVector(right, distance * tangent * safeAspect * .43);
    }
    position.copy(target).addScaledVector(direction, distance);
  }
  constrainCameraPose(position, target, cameraObstacles());
  return { position: position.toArray(), target: target.toArray() };
}
