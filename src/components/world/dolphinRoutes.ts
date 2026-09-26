import { CatmullRomCurve3, Vector3 } from 'three';
import { cityDocks, createCityFerryRoute } from './cityInfrastructure';
import { landDistance, seededRandom } from './terrain';
import { harborWaterHeight } from './waterSurface';

import { vesselClearance } from './marineTraffic';

const TAU = Math.PI * 2;
// Both lobes return through the channel, then take different coasts of each island group.
const anchors = [[12,-42],[30,-47],[46,-58],[51,-79],[34,-104],[5,-114],[-27,-111],[-50,-97],[-56,-74],[-46,-51],[-28,-42],[-8,-39],[10,-34],[25,-33],[39,-24],[42,-5],[39,18],[27,36],[0,43],[-25,39],[-32,24],[-47,9],[-46,-14],[-32,-25],[-20,-33],[-4,-43]];
const ferrySamples = createCityFerryRoute().curve.getPoints(160);
export function dolphinFerryClearance(x: number, z: number) {
  let distance = Infinity;
  for (const point of ferrySamples) distance = Math.min(distance, Math.hypot(x - point.x, z - point.z));
  return distance;
}
export function dolphinCoastClearance(x: number, z: number) {
  return Math.min(-landDistance(x, z), ...cityDocks.map(dock => {
    const dx=Math.abs(x-dock.x)-dock.width/2,dz=Math.abs(z-dock.z)-dock.length/2;
    return Math.hypot(Math.max(dx,0),Math.max(dz,0))+Math.min(Math.max(dx,dz),0);
  }));
}
export function createDolphinCourse(index: number, lap = 0) {
  // A fourth dolphin stays in the lagoon, so the long island tours do not empty it.
  const loop = index === 3 ? Array.from({ length: 16 }, (_, n) => {
    const a = n / 16 * TAU;
    return [5 + Math.cos(a) * 20, -40 + Math.sin(a) * 7];
  }) : anchors;
  const random = seededRandom(13091 + index * 937 + lap * 7127);
  for (let attempt = 0; attempt < 40; attempt++) {
    const waypoints = index % 2 ? [loop[0], ...loop.slice(1).reverse()] : loop;
    const points = waypoints.map(([x,z], i) => {
      // Preserve the join and both neighbours for a continuous tangent when replanning.
      const spread = i < 3 || i >= loop.length - 2 ? 0 : index === 3 ? 1.4 : 4;
      return new Vector3(x + (random() - .5) * spread, 0, z + (random() - .5) * spread);
    });
    const curve = new CatmullRomCurve3(points, true, 'centripetal');
    curve.arcLengthDivisions = 1200; curve.updateArcLengths();
    if (curve.getPoints(1200).every(point => dolphinCoastClearance(point.x, point.z) > 2.3)) return { curve, length: curve.getLength() };
  }
  throw new Error('Dolphin course must clear the complete coastline and piers.');
}
export interface DolphinState {
  index: number; shark: boolean; time: number; lap: number; distance: number;
  course: ReturnType<typeof createDolphinCourse>; position: Vector3; heading: number; pitch: number; tail: number;
  jumpStart: number; jumpDuration: number; jumpHeight: number; nextJump: number; breach: boolean;
  random: () => number; splash: Vector3; splashAge: number; contacts: number;
}
export function createDolphinState(index: number, shark = false): DolphinState {
  const course = createDolphinCourse(index), random = seededRandom(441 + index * 819);
  const state: DolphinState = { index, shark, time: 0, lap: 0, distance: shark ? 0 : [0, .41, .72, .24][index % 4] * course.length, course, position: new Vector3(), heading: 0, pitch: 0, tail: 0, jumpStart: -100, jumpDuration: 2.6, jumpHeight: 1.55, nextJump: 4 + index * 4.5, breach: false, random, splash: new Vector3(), splashAge: 100, contacts: 0 };
  writePose(state); return state;
}
const tangent = new Vector3();
function writePose(state: DolphinState, waterTime = state.time) {
  const t = state.time;
  if (state.shark) {
    // Separate offshore territories keep the visible fins away from beaches and ferries.
    const rate = state.index ? -.017 : .019, a = t * rate + state.index * 2.1;
    const radius = 9 + Math.sin(t * .007), center = state.index ? -97 : 61;
    const x = center + Math.cos(a) * radius, z = -42 + Math.sin(a) * 23;
    const dx = -Math.sin(a) * radius * rate + Math.cos(a) * Math.cos(t * .007) * .007;
    const dz = Math.cos(a) * 23 * rate;
    // The body stays submerged as the dorsal fin rises and dips with the actual waves.
    const depth = .30 + .14 * (.5 + .5 * Math.sin(t * .037 + state.index * 2));
    state.position.set(x, harborWaterHeight(x, z, waterTime) - depth, z);
    state.heading = Math.atan2(-dz, dx); state.pitch = 0; state.tail = Math.sin(t * 2.4 + state.index) * .18; return;
  }
  const u = state.distance / state.course.length;
  state.course.curve.getPointAt(u, state.position); state.course.curve.getTangentAt(u, tangent);
  const phase = (t - state.jumpStart) / state.jumpDuration;
  state.breach = phase > 0 && phase < 1;
  const base = -.91 + .045 * Math.sin(t * .47 + state.index);
  const lift = state.breach ? state.jumpHeight * Math.sin(Math.PI * phase) ** 2 : 0;
  const dy = .02115 * Math.cos(t * .47 + state.index) + (state.breach ? state.jumpHeight * Math.PI / state.jumpDuration * Math.sin(TAU * phase) : 0);
  state.position.y = base + lift;
  state.heading = Math.atan2(-tangent.z, tangent.x);
  state.pitch = Math.atan2(dy, dolphinSpeed(state));
  state.tail = Math.sin(t * 6.1 + state.index * 1.8) * .21;
}
export function dolphinSpeed(state: DolphinState) { return .87 + state.index * .055 + .09 * Math.sin(state.time * .057 + state.index * 1.3); }
export function stepDolphin(state: DolphinState, delta: number, paused = false, waterTime?: number) {
  if (paused) return false;
  const dt = Math.min(.05, Math.max(0, delta));
  const px = state.position.x, py = state.position.y, pz = state.position.z;
  state.time += dt; state.splashAge += dt;
  if (!state.shark) {
    state.distance += dolphinSpeed(state) * dt;
    if (state.distance >= state.course.length) { state.distance -= state.course.length; state.course = createDolphinCourse(state.index, ++state.lap); }
    if (state.time >= state.nextJump) {
      const duration = 2.9 + state.random() * .7;
      const ahead = state.course.curve.getPointAt(((state.distance + dolphinSpeed(state) * duration) % state.course.length) / state.course.length);
      if (dolphinFerryClearance(px, pz) > 5 && dolphinFerryClearance(ahead.x, ahead.z) > 5 && vesselClearance(px,pz) > 9 && vesselClearance(ahead.x,ahead.z) > 9) {
        state.jumpStart = state.time; state.jumpDuration = duration; state.jumpHeight = 1.3 + state.random() * .5;
        state.nextJump = state.time + 12 + state.random() * 15 + state.index * 1.8;
      } else state.nextJump = state.time + 3;
    }
  }
  writePose(state, waterTime);
  // Dive below the hull envelope before crossing a live vessel lane.
  const clearance=vesselClearance(state.position.x,state.position.z);
  if(clearance<7) {
    const yieldDepth=Math.max(0,Math.min(1,(7-clearance)/4));
    state.position.y-=yieldDepth*(state.shark?1.8:2.4);
    if(yieldDepth>.1)state.breach=false;
  }
  const wt = waterTime ?? state.time;
  const before = py - harborWaterHeight(px, pz, wt - dt);
  const after = state.position.y - harborWaterHeight(state.position.x, state.position.z, wt);
  if (!state.shark && before * after < 0) {
    const alpha = before / (before - after);
    state.splash.set(px + (state.position.x - px) * alpha, 0, pz + (state.position.z - pz) * alpha);
    state.splash.y = harborWaterHeight(state.splash.x, state.splash.z, wt - dt + dt * alpha);
    state.splashAge = 0; state.contacts++; return true;
  }
  return false;
}
