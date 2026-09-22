import { Vector3 } from 'three';
import { harborWaterHeight } from './waterSurface';
import { landDistance, seededRandom, terrainHeight } from './terrain';

export const REEF_CENTER = { x: 3, z: -43 };
export const MARINE_COUNTS = { high: 72, medium: 44, low: 24 } as const;
export interface MarinePose { position: Vector3; heading: number; pitch: number; tail: number; breach: boolean }
export interface MarineState extends MarinePose { index: number; shark: boolean; time: number; splash: Vector3; splashAge: number; contacts: number }
const TAU = Math.PI * 2;

/** Two parallel loops stay east of the complete ferry corridor, including its hull width. */
export function marinePose(index: number, shark: boolean, time: number, pose: MarinePose) {
  const rate = shark ? .047 : .12;
  const angle = time * rate + index * .62;
  const rx = shark ? 9 : 5.3;
  const rz = shark ? 16 : 8.2;
  const x = (shark ? 56 : 3.7) + Math.cos(angle) * rx;
  const z = (shark ? -47 : -43) + Math.sin(angle) * rz;
  const dx = -Math.sin(angle) * rx * rate, dz = Math.cos(angle) * rz * rate;
  const phase = ((time - (12 + index * 17)) % 67 + 67) % 67;
  const progress = phase / 4.8;
  const breach = !shark && phase < 4.8;
  // A zero-slope takeoff and recovery give one continuous arch; pitch follows its tangent.
  const lift = breach ? 3.05 * Math.sin(Math.PI * progress) ** 2 : 0;
  const vertical = breach ? 3.05 * Math.PI / 4.8 * Math.sin(TAU * progress) : 0;
  const y = (shark ? -.5 : -1.45) + .06 * Math.sin(time * .6 + index) + lift;
  pose.position.set(x, y, z);
  pose.heading = Math.atan2(-dz, dx);
  pose.pitch = Math.atan2(vertical + .036 * Math.cos(time * .6 + index), Math.hypot(dx, dz));
  pose.tail = Math.sin(time * (shark ? 3.8 : 4.8) + index) * .19;
  pose.breach = breach;
  return pose;
}
export function createMarineState(index: number, shark = false): MarineState {
  const state: MarineState = { index, shark, time: 0, position: new Vector3(), heading: 0, pitch: 0, tail: 0, breach: false, splash: new Vector3(), splashAge: 100, contacts: 0 };
  marinePose(index, shark, 0, state); return state;
}
export function stepMarine(state: MarineState, delta: number, paused = false, waterTime?: number) {
  if (paused) return false;
  const dt = Math.min(.05, Math.max(0, delta));
  const x = state.position.x, y = state.position.y, z = state.position.z;
  const surfaceTime = waterTime ?? state.time + dt;
  const previousSurface = y - harborWaterHeight(x, z, surfaceTime - dt);
  state.time += dt; state.splashAge += dt; marinePose(state.index, state.shark, state.time, state);
  const surface = state.position.y - harborWaterHeight(state.position.x, state.position.z, surfaceTime);
  if (!state.shark && previousSurface * surface < 0) {
    const fraction = previousSurface / (previousSurface - surface);
    state.splash.set(x + (state.position.x - x) * fraction, 0, z + (state.position.z - z) * fraction);
    state.splash.y = harborWaterHeight(state.splash.x, state.splash.z, surfaceTime - dt + dt * fraction);
    state.splashAge = 0; state.contacts++; return true;
  }
  return false;
}

export interface CoralSite { x: number; z: number; floor: number; scale: number; rotation: number; form: number; color: number }
export function createCoralSites(): CoralSite[] {
  const random = seededRandom(260922), sites: CoralSite[] = [];
  for (let attempt = 0; sites.length < 78 && attempt < 2000; attempt++) {
    const i = sites.length;
    const cluster = i % 6, angle = random() * TAU, radius = Math.sqrt(random()) * 2.3;
    const x = 1 + (cluster % 2) * 5.2 + Math.cos(angle) * radius;
    const z = -36 - Math.floor(cluster / 2) * 5.5 + Math.sin(angle) * radius;
    const floor = terrainHeight(x, z);
    if (landDistance(x, z) > -4 || floor > -4.5 || sites.some(site => Math.hypot(site.x - x, site.z - z) < .45)) continue;
    sites.push({ x, z, floor, scale: Math.min(.6 + random() * .7, (-2.6 - floor - 1.16) / 1.05), rotation: random() * TAU, form: i % 3, color: i % 6 });
  }
  return sites;
}
export function writeReefFish(index: number, time: number, pose: MarinePose) {
  const school = index % 3, member = Math.floor(index / 3), phase = time * .21 + member * .16 + school * 2;
  const rx = 2.5 + (member % 3) * .22, rz = 1.8 + (member % 4) * .18;
  pose.position.set(2 + school * 1.9 + Math.cos(phase) * rx, -1.8 - (member % 5) * .13 + .06 * Math.sin(time + index), -36 - school * 6 + Math.sin(phase) * rz);
  pose.heading = Math.atan2(-Math.cos(phase) * rz, -Math.sin(phase) * rx);
  pose.pitch = 0; pose.tail = Math.sin(time * 8 + index) * .28; pose.breach = false; return pose;
}
