import { CatmullRomCurve3, Vector3 } from 'three';
import { createCityFerryRoute, writeCityFerryPose } from './cityInfrastructure';
import { landDistance } from './terrain';

export interface MarineOccupant { position: Vector3; radius: number }
export const surfaceAnimals: MarineOccupant[] = [];
export const vesselOccupants: MarineOccupant[] = [];
export const VISITOR_BERTH = new Vector3(-24, 0, -54);
export const VISITOR_DWELL = 32;
export const VESSEL_ACCELERATION = .42;
const points = [
  [[-54, -19], [-46, 18], [-20, 49], [23, 47], [49, 10], [51, -25], [22, -35], [-18, -35]],
  [[-76, -14], [-91, -20], [-97, -42], [-85, -60], [-66, -58], [-59, -38], [-65, -19]],
  [[-230, -53], [-130, -53], [-76, -65], [-42, -58], [-32, -54], [-24, -54], [-16, -54], [-5, -53], [34, -47], [94, -50], [240, -49]],
];

export function createVesselRoute(index: number) {
  const curve = new CatmullRomCurve3(points[index].map(([x, z]) => new Vector3(x, 0, z)), index < 2, 'centripetal');
  curve.arcLengthDivisions = 1600;
  curve.updateArcLengths();
  const length = curve.getLength(), point = new Vector3();
  let berth = 0;
  if (index === 2) {
    // Refine the arc distance to the actual control point, rather than snapping
    // to a nearby sample and leaving a gap at the boarding platform.
    let low = 0, high = 1;
    for (let i = 0; i < 45; i++) {
      const a = low + (high - low) / 3, b = high - (high - low) / 3;
      const da = curve.getPointAt(a, point).distanceToSquared(VISITOR_BERTH);
      const db = curve.getPointAt(b, point).distanceToSquared(VISITOR_BERTH);
      if (da < db) high = b; else low = a;
    }
    berth = (low + high) * .5 * length;
  }
  return { curve, length, berth, speed: index === 2 ? 1.35 : index === 1 ? .75 : 1.05 };
}

export interface VesselState extends MarineOccupant {
  index: number;
  route: ReturnType<typeof createVesselRoute>;
  distance: number;
  dwell: number;
  departed: boolean;
  heading: number;
  opacity: number;
  speed: number;
  checkIn: number;
  yielding: boolean;
}

export function createVesselState(index: number): VesselState {
  const route = createVesselRoute(index);
  const state: VesselState = {
    index, route, position: new Vector3(), radius: index === 2 ? 3.25 : 1.6,
    distance: index === 2 ? route.berth - 75 : index === 1 ? route.length * .4 : route.length * .13,
    dwell: 0, departed: false, heading: 0, opacity: 1, speed: 0, checkIn: 0, yielding: false,
  };
  writeVesselPose(state);
  return state;
}

const tangent = new Vector3(), candidate = new Vector3(), future = new Vector3(), otherFuture = new Vector3();
const ferryPosition = new Vector3(), ferryTangent = new Vector3();
const ferryRoute = createCityFerryRoute();
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp01(n); return t * t * (3 - 2 * t); };
function routeProgress(state: VesselState, distance: number) {
  return state.index === 2 ? clamp01(distance / state.route.length) : ((distance % state.route.length) + state.route.length) % state.route.length / state.route.length;
}

export function writeVesselPose(state: VesselState) {
  const progress = routeProgress(state, state.distance);
  state.route.curve.getPointAt(progress, state.position);
  const offset = progress < .9999 ? .0001 : -.0001;
  state.route.curve.getPointAt(progress + offset, tangent);
  tangent.sub(state.position).multiplyScalar(Math.sign(offset));
  state.heading = Math.atan2(tangent.x, tangent.z);
  state.opacity = state.index === 2 ? Math.min(smooth(state.distance / 35), smooth((state.route.length - state.distance) / 45)) : 1;
}

export function vesselClearance(x: number, z: number, radius = 0) {
  let clear = Infinity;
  for (const boat of vesselOccupants) {
    if ('opacity' in boat && (boat as VesselState).opacity < .02) continue;
    clear = Math.min(clear, Math.hypot(x - boat.position.x, z - boat.position.z) - boat.radius - radius);
  }
  return clear;
}

function horizontalDistance(a: Vector3, b: Vector3) { return Math.hypot(a.x - b.x, a.z - b.z); }
function travelAt(speed: number, maximum: number, time: number) {
  const ramp = Math.min(time, Math.max(0, maximum - speed) / VESSEL_ACCELERATION);
  return speed * ramp + .5 * VESSEL_ACCELERATION * ramp * ramp + maximum * (time - ramp);
}
function futurePosition(state: VesselState, seconds: number, output: Vector3) {
  const duration = Math.max(0, seconds - state.dwell);
  let distance = state.distance + travelAt(state.speed, state.route.speed, duration);
  if (state.index === 2 && !state.departed && state.dwell === 0) distance = Math.min(distance, state.route.berth);
  return state.route.curve.getPointAt(routeProgress(state, distance), output);
}
function isVessel(other: MarineOccupant): other is VesselState { return 'route' in other; }

function crossingOccupied(state: VesselState, time: number, traffic: readonly MarineOccupant[], animals: readonly MarineOccupant[]) {
  // Forecast before entering the ferry lane. The scheduled ferry has priority;
  // the smaller launches also have priority over the visiting passenger boat.
  for (let seconds = 0; seconds <= 16; seconds += .75) {
    futurePosition(state, seconds, future);
    writeCityFerryPose(ferryRoute, time + seconds, ferryPosition, ferryTangent);
    if (horizontalDistance(future, ferryPosition) < state.radius + 1.5 + 1.3) return true;
    for (const other of traffic) {
      if (other === state || other.position.y < -.8) continue;
      if (isVessel(other) && other.index > state.index) continue;
      const position = isVessel(other) ? futurePosition(other, seconds, otherFuture) : other.position;
      if (horizontalDistance(future, position) < state.radius + other.radius + 1.1) return true;
    }
    // Animals are treated as stationary obstacles until their own navigation
    // moves them clear. Deep swimmers do not block a surface route.
    for (const animal of animals) {
      if (animal.position.y > -.8 && horizontalDistance(future, animal.position) < state.radius + animal.radius + 1.2) return true;
    }
  }
  return false;
}

export function stepVessel(state: VesselState, delta: number, time: number, traffic: readonly MarineOccupant[] = vesselOccupants, animals: readonly MarineOccupant[] = surfaceAnimals) {
  if (!Number.isFinite(delta) || delta <= 0) return;
  // The scene suspends updates while paused. Real active seconds are used for
  // the berth, independent of frame rate; movement is substepped after a stall.
  let remaining = Math.min(delta, 1);
  if (state.dwell > 0) {
    if (delta < state.dwell) { state.dwell -= delta; return; }
    remaining = Math.min(delta - state.dwell, 1);
    state.dwell = 0;
    state.departed = true;
    state.checkIn = 0;
  }
  const clock = Number.isFinite(time) ? time : 0;
  while (remaining > .000001) {
    const dt = Math.min(remaining, .05);
    state.checkIn -= dt;
    if (state.checkIn <= 0) {
      state.yielding = crossingOccupied(state, clock, traffic, animals);
      state.checkIn = .25;
    }
    const toBerth = state.route.berth - state.distance;
    const braking = state.index === 2 && !state.departed ? Math.sqrt(Math.max(0, 2 * VESSEL_ACCELERATION * toBerth)) : state.route.speed;
    const target = state.yielding ? 0 : Math.min(state.route.speed, braking);
    const nextSpeed = state.speed + Math.max(-VESSEL_ACCELERATION * dt, Math.min(VESSEL_ACCELERATION * dt, target - state.speed));
    let next = state.distance + (state.speed + nextSpeed) * .5 * dt;
    state.route.curve.getPointAt(routeProgress(state, next), candidate);
    let blocked = -landDistance(candidate.x, candidate.z) < state.radius + .5;
    writeCityFerryPose(ferryRoute, clock, ferryPosition, ferryTangent);
    if (horizontalDistance(candidate, ferryPosition) < state.radius + 1.5 + .45) blocked = true;
    for (const other of traffic) {
      if (other !== state && other.position.y > -.8 && horizontalDistance(candidate, other.position) < state.radius + other.radius + .5) blocked = true;
    }
    for (const animal of animals) {
      if (animal.position.y > -.8 && horizontalDistance(candidate, animal.position) < state.radius + animal.radius + .65) blocked = true;
    }
    state.speed = blocked ? 0 : nextSpeed;
    if (!blocked) {
      if (state.index === 2 && !state.departed && next >= state.route.berth) {
        state.distance = state.route.berth;
        state.dwell = VISITOR_DWELL;
        state.speed = 0;
        writeVesselPose(state);
        return;
      }
      if (next >= state.route.length) { next %= state.route.length; state.departed = false; }
      state.distance = next;
    }
    remaining -= dt;
    writeVesselPose(state);
  }
}
