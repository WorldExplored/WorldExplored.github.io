import { Vector3 } from 'three';
import { seededRandom } from './terrain';
import { getReefHabitat, reefFloorHeight, reefHabitatContains, reefFerryClearance } from './reefHabitat';

export const REEF_FISH_COUNTS = { high: 210, medium: 135, low: 75 } as const;
export const REEF_FISH_RADIUS = .14;
const CELL = 3;
type Obstacle = { x: number; y: number; z: number; radius: number; height: number };
const ferryClearCells = new Map<string, boolean>();
function outsideFerry(x: number, z: number) {
  const cx = Math.floor(x), cz = Math.floor(z), key = `${cx},${cz}`;
  if (!ferryClearCells.has(key)) ferryClearCells.set(key, reefFerryClearance(cx + .5, cz + .5) > 3.4);
  return ferryClearCells.get(key)!;
}
let obstacleGrid: Map<string, Obstacle[]> | undefined;
function obstacles() {
  if (obstacleGrid) return obstacleGrid;
  obstacleGrid = new Map();
  const habitat = getReefHabitat();
  for (const obstacle of [...habitat.colonies, ...habitat.rocks]) {
    const radius = obstacle.radius + REEF_FISH_RADIUS;
    for (let x = Math.floor((obstacle.x - radius) / CELL); x <= Math.floor((obstacle.x + radius) / CELL); x++) {
      for (let z = Math.floor((obstacle.z - radius) / CELL); z <= Math.floor((obstacle.z + radius) / CELL); z++) {
        const key = `${x},${z}`, list = obstacleGrid.get(key) ?? [];
        list.push(obstacle); obstacleGrid.set(key, list);
      }
    }
  }
  return obstacleGrid;
}
/** The same cylinders bound rendered coral and rock geometry; fish also keep clear of the sand. */
export function reefFishPositionClear(x: number, y: number, z: number, padding = 0) {
  const radius = REEF_FISH_RADIUS + padding;
  if (!outsideFerry(x, z) || !reefHabitatContains(x, z, radius + .5) || y < reefFloorHeight(x, z) + radius + .22 || y > -.75) return false;
  for (const obstacle of obstacles().get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
    if (y + radius > obstacle.y && y - radius < obstacle.y + obstacle.height && Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius + radius) return false;
  }
  return true;
}
export interface ReefFishState {
  index: number; position: Vector3; target: Vector3; heading: number; pitch: number;
  speed: number; tail: number; time: number; targetAge: number; reaction: number;
  random: () => number;
}
function selectTarget(state: ReefFishState, spread = 5, escapeHeading?: number) {
  for (let attempt = 0; attempt < 35; attempt++) {
    const angle = escapeHeading === undefined ? state.random() * Math.PI * 2 : escapeHeading + (state.random() - .5) * 1.8;
    const distance = 1.5 + state.random() * spread;
    const x = state.position.x + Math.cos(angle) * distance, z = state.position.z + Math.sin(angle) * distance;
    const floor = reefFloorHeight(x, z), y = Math.max(floor + .6, Math.min(-1.1, state.position.y + (state.random() - .5) * 2));
    if (!reefFishPositionClear(x, y, z, .15)) continue;
    // Reject targets across a coral wall instead of steering fish through its branches.
    let clear = true;
    for (let t = .12; t <= 1; t += .12) {
      if (!reefFishPositionClear(state.position.x + (x - state.position.x) * t, state.position.y + (y - state.position.y) * t, state.position.z + (z - state.position.z) * t)) { clear = false; break; }
    }
    if (clear) { state.target.set(x, y, z); state.targetAge = 0; return; }
  }
  state.target.copy(state.position); state.targetAge = 5;
}
export function createReefFishState(index: number): ReefFishState {
  const random = seededRandom(89171 + index * 997), position = new Vector3();
  for (let attempt = 0; attempt < 10000; attempt++) {
    // Interleave western and eastern residents so every quality tier keeps both reef arms alive.
    const x = index % 3 === 0 ? -76 + random() * 46 : -30 + random() * 57, z = -66 + random() * 45;
    const y = Math.min(-1.05, reefFloorHeight(x, z) + .55 + random() * 1.5);
    if (reefFishPositionClear(x, y, z, .2)) { position.set(x, y, z); break; }
  }
  const state: ReefFishState = { index, position, target: position.clone(), heading: random() * Math.PI * 2, pitch: 0, speed: 0, tail: 0, time: 0, targetAge: 0, reaction: 0, random };
  selectTarget(state); return state;
}
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
/** A tap prompts nearby fish to dart away, then resume their individual foraging routes. */
export function interactWithReefFish(states: ReefFishState[], index: number) {
  const source = states[index]; if (!source) return 0;
  let affected = 0;
  for (const fish of states) {
    if (fish.position.distanceTo(source.position) > 3.2) continue;
    fish.reaction = 2 + fish.random();
    const away = fish === source ? -fish.heading + Math.PI : Math.atan2(fish.position.z - source.position.z, fish.position.x - source.position.x);
    selectTarget(fish, 3, away);
    affected++;
  }
  return affected;
}
export function stepReefFish(states: ReefFishState[], delta: number, paused = false, count = states.length) {
  if (paused) return;
  const dt = Math.min(.05, Math.max(0, delta));
  if (!dt) return;
  const neighbours = new Map<string, ReefFishState[]>();
  for (let i = 0; i < count; i++) {
    const fish = states[i], key = `${Math.floor(fish.position.x)},${Math.floor(fish.position.z)}`;
    const cell = neighbours.get(key) ?? []; cell.push(fish); neighbours.set(key, cell);
  }
  for (let i = 0; i < count; i++) {
    const fish = states[i], p = fish.position;
    fish.time += dt; fish.targetAge += dt; fish.reaction = Math.max(0, fish.reaction - dt);
    if (fish.targetAge > 7 + i % 4 || p.distanceToSquared(fish.target) < .35) selectTarget(fish);
    let dx = fish.target.x - p.x, dz = fish.target.z - p.z;
    const cx = Math.floor(p.x), cz = Math.floor(p.z);
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
      for (const other of neighbours.get(`${cx + ox},${cz + oz}`) ?? []) {
        if (other === fish) continue;
        const distance = p.distanceToSquared(other.position);
        if (distance < .36 && distance > .0001) { dx += (p.x - other.position.x) / distance * .28; dz += (p.z - other.position.z) / distance * .28; }
      }
    }
    const turn = wrap(Math.atan2(-dz, dx) - fish.heading);
    fish.heading += Math.max(-1.9 * dt, Math.min(1.9 * dt, turn));
    const desiredSpeed = (fish.reaction ? .95 : .35 + (i % 7) * .04) * Math.max(.1, Math.cos(turn));
    fish.speed += (desiredSpeed - fish.speed) * Math.min(1, dt * 3.5);
    const nx = p.x + Math.cos(fish.heading) * fish.speed * dt, nz = p.z - Math.sin(fish.heading) * fish.speed * dt;
    const dy = Math.max(-.26 * dt, Math.min(.26 * dt, (fish.target.y - p.y) * dt * .7));
    // Look ahead before moving; braking keeps the body outside geometry even at low frame rates.
    const look = .32 + fish.speed * .35;
    const lx = p.x + Math.cos(fish.heading) * look, lz = p.z - Math.sin(fish.heading) * look;
    let neighboursClear = true;
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
      for (const other of neighbours.get(`${cx + ox},${cz + oz}`) ?? []) {
        if (other === fish) continue;
        const nextDistance = (nx - other.position.x) ** 2 + (p.y + dy - other.position.y) ** 2 + (nz - other.position.z) ** 2;
        if (nextDistance < .22 ** 2 && nextDistance < p.distanceToSquared(other.position)) neighboursClear = false;
      }
    }
    if (neighboursClear && reefFishPositionClear(nx, p.y + dy, nz) && reefFishPositionClear(lx, p.y + dy, lz)) {
      p.set(nx, p.y + dy, nz);
      fish.pitch += (Math.atan2(dy / dt, Math.max(.1, fish.speed)) - fish.pitch) * dt * 3;
    } else { fish.speed *= Math.max(0, 1 - dt * 12); if (fish.targetAge > 1.3) selectTarget(fish, 2); }
    fish.tail = Math.sin(fish.time * (10 + fish.speed * 8) + i * 1.31) * (.15 + fish.speed * .2);
  }
}
