import { Vector3 } from 'three';
import type { QualityTier } from '../../content/world';
import { createLandscapePlan, distanceToSegment, ISLANDS, islandContour, landDistance, seededRandom, terrainHeight, terrainSlope, type Island, type LandscapePlan } from './terrain';

export const WILDLIFE_COUNTS = { high: { gulls: 18, crabs: 10 }, medium: { gulls: 10, crabs: 6 }, low: { gulls: 6, crabs: 0 } } satisfies Record<QualityTier, { gulls: number; crabs: number }>;
export type GullMode = 'gliding' | 'flapping' | 'circling' | 'approach' | 'perched' | 'takeoff';
export interface GullPerch { id: string; position: Vector3 }
export interface GullState {
  index: number; position: Vector3; velocity: Vector3; anchor: Vector3; perch: GullPerch;
  fold: number; flap: number; mode: GullMode; age: number; time: number; phase: number; radius: number; speed: number; heading: number;
  start: Vector3; startVelocity: Vector3; end: Vector3; endVelocity: Vector3; duration: number; landing: boolean;
}
const TAU = Math.PI * 2;
const ease = (t: number) => t * t * (3 - 2 * t);

export function createGullPerches(plan = createLandscapePlan()): GullPerch[] {
  const perches = plan.rocks.filter(rock => rock.y + rock.scale[1] > .3).map(rock => ({ id: rock.id, position: new Vector3(rock.x, rock.y + rock.scale[1] * .9 + .23, rock.z) }));
  // The terminal railing posts are shared with CoastalLife's bridge geometry.
  perches.push({ id: 'garden-bridge-rail', position: new Vector3(-9.35, 1.72, 20) });
  perches.push({ id: 'beacon-balcony-rail', position: new Vector3(-74.91, 7.89, -36) });
  perches.push({ id: 'city-residence-roof', position: new Vector3(-18.94, 10.65, -82.9) });
  return perches;
}

function orbit(state: GullState, time: number, point: Vector3, velocity: Vector3) {
  const angle = time * state.speed + state.phase;
  const heightWave = Math.sin(angle * 2 + state.phase);
  point.set(state.anchor.x + Math.cos(angle) * state.radius, state.anchor.y + heightWave * 1.4, state.anchor.z + Math.sin(angle) * state.radius * .68);
  velocity.set(-Math.sin(angle) * state.radius * state.speed, Math.cos(angle * 2 + state.phase) * 2.8 * state.speed, Math.cos(angle) * state.radius * .68 * state.speed);
}

export function createGullStates(perches = createGullPerches()): GullState[] {
  const random = seededRandom(96213);
  const starts = [[-10, 9.5, 15], [10, 14, -12], [-24, 14, -15], [18, 10, 28], [-14, 11, 31], [-76, 15, -36], [-7, 20, -78], [10, 23, -85], [-22, 20, -73]];
  return Array.from({ length: 18 }, (_, index) => {
    const home = starts[index % starts.length]; const phase = random() * TAU; const radius = 5 + random() * 9;
    const anchor = new Vector3(home[0] - Math.cos(phase) * radius, home[1], home[2] - Math.sin(phase) * radius * .68);
    const state: GullState = { fold: 0, flap: index % 3 === 0 ? 1 : 0, index, position: new Vector3(), velocity: new Vector3(), anchor, perch: perches.reduce((nearest, candidate) => candidate.position.distanceToSquared(anchor) < nearest.position.distanceToSquared(anchor) ? candidate : nearest), mode: index % 3 === 0 ? 'flapping' : index % 3 === 1 ? 'gliding' : 'circling', age: random() * 7, time: 0, phase, radius, speed: .11 + random() * .07, heading: 0, start: new Vector3(), startVelocity: new Vector3(), end: new Vector3(), endVelocity: new Vector3(), duration: 0, landing: false };
    orbit(state, 0, state.position, state.velocity);
    if (index >= 12 && index % 3 === 0) { state.mode = 'perched'; state.fold = 1; state.position.copy(state.perch.position); state.velocity.set(0, 0, 0); }
    state.heading = Math.atan2(-state.velocity.x, -state.velocity.z);
    return state;
  });
}

function beginSegment(state: GullState, mode: GullMode, duration: number) {
  state.start.copy(state.position); state.startVelocity.copy(state.velocity); state.mode = mode; state.age = 0; state.duration = duration;
}
function segment(state: GullState) {
  const t = Math.min(1, state.age / state.duration); const t2 = t * t; const t3 = t2 * t; const duration = state.duration;
  state.position.copy(state.start).multiplyScalar(2 * t3 - 3 * t2 + 1).addScaledVector(state.startVelocity, (t3 - 2 * t2 + t) * duration).addScaledVector(state.end, -2 * t3 + 3 * t2).addScaledVector(state.endVelocity, (t3 - t2) * duration);
  state.velocity.copy(state.start).multiplyScalar((6 * t2 - 6 * t) / duration).addScaledVector(state.startVelocity, 3 * t2 - 4 * t + 1).addScaledVector(state.end, (-6 * t2 + 6 * t) / duration).addScaledVector(state.endVelocity, 3 * t2 - 2 * t);
}
export function startGullTakeoff(state: GullState) {
  beginSegment(state, 'takeoff', 4.5);
  state.end.copy(state.position); state.end.y = Math.max(15, state.position.y + 7); state.endVelocity.set(0, 0, 0); state.landing = false;
}

/** Integrate from the present pose; proximity never resets a bird to a route origin. */
export function stepGull(state: GullState, delta: number, camera: Vector3, pointer: readonly number[] | null, paused = false) {
  if (paused) return;
  const dt = Math.min(.05, Math.max(0, delta)); state.time += dt; state.age += dt;
  state.fold += ((state.mode === 'perched' ? 1 : 0) - state.fold) * (1 - Math.exp(-3 * dt));
  state.flap += ((state.mode === 'flapping' || state.mode === 'takeoff' ? 1 : 0) - state.flap) * (1 - Math.exp(-2.5 * dt));
  if (state.mode === 'perched') {
    const pointerClose = pointer && Math.hypot(state.position.x - pointer[0], state.position.z - pointer[2]) < 2.8;
    if (state.age > 9 + state.index * .7 || camera.distanceToSquared(state.position) < 30 || pointerClose) startGullTakeoff(state);
    return;
  }
  if (state.mode === 'approach' || state.mode === 'takeoff') {
    segment(state);
    if (state.age >= state.duration) {
      if (state.mode === 'approach') {
        if (!state.landing) { beginSegment(state, 'approach', 5.5); state.end.copy(state.perch.position); state.endVelocity.set(0, 0, 0); state.landing = true; }
        else { state.mode = 'perched'; state.age = 0; state.velocity.set(0, 0, 0); }
      } else if (!state.landing) {
        beginSegment(state, 'takeoff', 7); orbit(state, state.time + 7, state.end, state.endVelocity); state.landing = true;
      } else { state.mode = 'gliding'; state.age = 0; state.landing = false; }
    }
  } else {
    orbit(state, state.time, state.position, state.velocity);
    if (state.age > 9 + state.index % 5 * 1.3) {
      if (state.mode === 'circling') {
        beginSegment(state, 'approach', 9); state.end.copy(state.perch.position); state.end.y = Math.max(15, state.perch.position.y + 7); state.endVelocity.set(0, 0, 0); state.landing = false;
      } else { state.mode = state.mode === 'gliding' ? 'flapping' : 'circling'; state.age = 0; }
    }
  }
  if (state.velocity.x * state.velocity.x + state.velocity.z * state.velocity.z > .001) {
    const heading = Math.atan2(-state.velocity.x, -state.velocity.z);
    state.heading += Math.atan2(Math.sin(heading - state.heading), Math.cos(heading - state.heading)) * (1 - Math.exp(-5 * dt));
  }
}

export interface CrabRoute { island: Island; angle: number; extent: number; band: number; phase: number }
export function writeCrabPosition(route: CrabRoute, progress: number, point: Vector3) {
  const angle = route.angle + progress * route.extent;
  const r = islandContour(route.island, angle) - route.band / Math.min(route.island.rx, route.island.rz);
  const x = route.island.x + Math.cos(angle) * route.island.rx * r; const z = route.island.z + Math.sin(angle) * route.island.rz * r;
  return point.set(x, terrainHeight(x, z) + .11, z);
}
export function validCrabPosition(point: Vector3, plan: LandscapePlan) {
  const distance = landDistance(point.x, point.z);
  return distance > .85 && distance < 1.75 && terrainHeight(point.x, point.z) > .16 && terrainSlope(point.x, point.z) < .65
    && [...plan.structures, ...plan.rocks].every(item => Math.hypot(point.x - item.x, point.z - item.z) > item.radius + .6)
    && plan.paths.every(path => path.points.slice(1).every((b, index) => distanceToSegment(point.x, point.z, path.points[index], b) > path.width / 2 + .65));
}
export function createCrabRoutes(plan = createLandscapePlan()): CrabRoute[] {
  const random = seededRandom(5778); const routes: CrabRoute[] = []; const point = new Vector3();
  for (let attempt = 0; routes.length < 10 && attempt < 1000; attempt++) {
    const island = ISLANDS[attempt % 3];
    const route = { island, angle: random() * TAU, extent: .05 + random() * .035, band: 1.15 + random() * .25, phase: random() * TAU };
    if (Array.from({ length: 41 }, (_, index) => validCrabPosition(writeCrabPosition(route, index / 20 - 1, point), plan)).every(Boolean)) routes.push(route);
  }
  return routes;
}
export interface CrabState { route: CrabRoute; position: Vector3; time: number; progress: number; heading: number; scuttle: number; gait: number }
export function createCrabStates() { return createCrabRoutes().map(route => ({ route, position: writeCrabPosition(route, Math.sin(route.phase), new Vector3()), time: 0, progress: Math.sin(route.phase), heading: route.angle, scuttle: 0, gait: 0 })); }
export function stepCrab(state: CrabState, delta: number, camera: Vector3, pointer: readonly number[] | null, paused = false) {
  if (paused) return;
  const dt = Math.min(.05, Math.max(0, delta)); state.time += dt;
  const close = camera.distanceToSquared(state.position) < 15 || Boolean(pointer && Math.hypot(pointer[0] - state.position.x, pointer[2] - state.position.z) < 2);
  state.scuttle += ((close ? 1 : 0) - state.scuttle) * (1 - Math.exp(-3 * dt));
  const cycle = state.time * .26 + state.route.phase; const travel = Math.sin(cycle);
  // Flatten the ends into short rests, then reverse the sideways gait.
  const idle = Math.abs(travel) > .88; const ambient = Math.sign(travel) * ease(Math.min(1, Math.abs(travel) / .88));
  let target = ambient;
  if (close) {
    const threatX = pointer ? pointer[0] : camera.x; const threatZ = pointer ? pointer[2] : camera.z;
    const tangentX = -Math.sin(state.route.angle); const tangentZ = Math.cos(state.route.angle);
    target = (state.position.x - threatX) * tangentX + (state.position.z - threatZ) * tangentZ > 0 ? 1 : -1;
  }
  const previous = state.progress; state.progress += (target - state.progress) * (1 - Math.exp(-(close ? 5 : 1.4) * dt));
  writeCrabPosition(state.route, state.progress, state.position);
  state.heading = -(state.route.angle + state.progress * state.route.extent);
  state.gait += Math.abs(state.progress - previous) * 24;
  if (idle && !close && Math.abs(state.progress - target) < .001) state.gait += (Math.round(state.gait / Math.PI) * Math.PI - state.gait) * (1 - Math.exp(-4 * dt));
}
