import { Vector3 } from 'three';
import type { QualityTier } from '../../content/world';
import { harborWaterHeight } from './waterSurface';
import { BRIDGES } from './bridgePlan';
import { ISLANDS, islandContour, landDistance, seededRandom, terrainHeight, type Island } from './terrain';

export const SCHOOL_COUNT = 9;
export type FishSpeciesId = 'reef' | 'silver' | 'sunfish' | 'bottom';
export interface FishSpecies {
  id: FishSpeciesId; population: Record<QualityTier, number>; band: number; depth: number; speed: number;
  turnRate: number; routeSpan: number; spacing: number; escape: number; escapeOut: number; recovery: number;
  tailRate: number; tailLength: number; halfHeight: number; radius: number; pattern: string;
}
export const FISH_SPECIES: readonly FishSpecies[] = [
  { id: 'reef', population: { high: 10, medium: 6, low: 4 }, band: 3.2, depth: .62, speed: .12, turnRate: 4.6, routeSpan: .105, spacing: .85, escape: 1.25, escapeOut: .75, recovery: 2.3, tailRate: 10, tailLength: .18, halfHeight: .22, radius: .48, pattern: 'three dark vertical bars and pale belly' },
  { id: 'silver', population: { high: 8, medium: 5, low: 3 }, band: 5.2, depth: .75, speed: .19, turnRate: 2.4, routeSpan: .18, spacing: 1.45, escape: 1.7, escapeOut: .35, recovery: 1.7, tailRate: 7.8, tailLength: .39, halfHeight: .20, radius: .76, pattern: 'silver flank with slate dorsal stripe' },
  { id: 'sunfish', population: { high: 7, medium: 4, low: 2 }, band: 3.8, depth: .9, speed: .075, turnRate: 1.9, routeSpan: .10, spacing: 1.05, escape: .75, escapeOut: .95, recovery: 1.8, tailRate: 5.5, tailLength: .23, halfHeight: .33, radius: .61, pattern: 'amber shoulders and yellow belly with dark fin tips' },
  { id: 'bottom', population: { high: 6, medium: 4, low: 2 }, band: 4.2, depth: 0, speed: .046, turnRate: 3.2, routeSpan: .07, spacing: 1.1, escape: .52, escapeOut: .23, recovery: 3, tailRate: 4.2, tailLength: .26, halfHeight: .19, radius: .64, pattern: 'mottled charcoal back and sand-colored edges' },
];
// Maximum members; actual tier populations belong to each species.
export const FISH_PER_SCHOOL = { high: 10, medium: 6, low: 4 } satisfies Record<QualityTier, number>;
export interface FishSchool { island: Island; angle: number; phase: number; speed: number; species: number }
export interface SchoolFish {
  school: FishSchool; schoolIndex: number; member: number; variant: number; position: Vector3; heading: number; bank: number;
  time: number; scatterAlong: number; scatterOut: number; velocityAlong: number; velocityOut: number;
  reentry: Vector3; lastRipple: number; jumpAge: number; nextJump: number; jumpPitch: number; glint: number;
}
export interface FishDisturbance { camera: Vector3; pointer: readonly number[] | null; ripple: { x: number; z: number; serial: number } }
const TAU = Math.PI * 2;

export function writeShorePoint(island: Island, angle: number, band: number, point: Vector3) {
  const radius = islandContour(island, angle) + band / Math.min(island.rx, island.rz);
  return point.set(island.x + Math.cos(angle) * island.rx * radius, -.6, island.z + Math.sin(angle) * island.rz * radius);
}
export function fishBridgeClearance(x: number, z: number) {
  let clearance = Infinity;
  for (const bridge of BRIDGES) for (let i = 0; i < bridge.samples.length; i += 4) {
    const p = bridge.samples[i].point;
    clearance = Math.min(clearance, Math.hypot(x - p.x, z - p.z) - bridge.width / 2 - .25);
  }
  return clearance;
}
export function createFishSchools(): FishSchool[] {
  const random = seededRandom(81153); const schools: FishSchool[] = []; const point = new Vector3();
  // Reef schools start beside the planted coves; silver schools use the outer channels.
  const ownership = ['main', 'garden', 'main', 'garden', 'main', 'garden', 'city', 'experience-meadow', 'garden'];
  const species = [0, 1, 2, 3, 0, 2, 1, 3, 0];
  const preferred = [4.8, 2.9, .45, 1.5, 1.0, .4, 1.2, 4.7, 3.7];
  for (let schoolIndex = 0; schoolIndex < SCHOOL_COUNT; schoolIndex++) {
    const island = ISLANDS.find(candidate => candidate.id === ownership[schoolIndex])!; const kind = FISH_SPECIES[species[schoolIndex]];
    for (let attempt = 0; attempt < 1200; attempt++) {
      const angle = attempt === 0 ? preferred[schoolIndex] : random() * TAU;
      if (schools.some(school => school.island === island && Math.abs(Math.atan2(Math.sin(angle - school.angle), Math.cos(angle - school.angle))) < .47)) continue;
      let safe = true;
      const extent = kind.routeSpan + .035 + (2.1 + 2 * kind.spacing) / Math.min(island.rx, island.rz);
      // Validate the entire route and disturbance envelope, including the full body radius.
      for (let sample = 0; sample <= 48 && safe; sample++) for (const offset of [0, .75, 1.5, 2.5, 3.5]) {
        writeShorePoint(island, angle + (sample / 24 - 1) * extent, kind.band + offset, point);
        if (landDistance(point.x, point.z) > -(kind.radius + 1.9) || fishBridgeClearance(point.x, point.z) < kind.radius + .4) { safe = false; break; }
      }
      if (safe) { schools.push({ island, angle, phase: random() * TAU, speed: kind.speed, species: species[schoolIndex] }); break; }
    }
  }
  if (schools.length !== SCHOOL_COUNT) throw new Error(`The shoreline has insufficient clear water for fish schools (${schools.length}/${SCHOOL_COUNT}: ${schools.map(school => school.island.id).join(', ')}).`);
  return schools;
}
function formationAngle(fish: SchoolFish, time: number) {
  const kind = FISH_SPECIES[fish.variant]; const radius = Math.min(fish.school.island.rx, fish.school.island.rz);
  const followTime = time - fish.member * (fish.variant === 1 ? .10 : .17);
  return fish.school.angle + kind.routeSpan * Math.sin(followTime * fish.school.speed + fish.school.phase)
    + .025 * Math.sin(followTime * fish.school.speed * .57 + fish.school.phase * 2)
    + ((fish.member % 4 - 1.5) * kind.spacing + Math.sin(time * .43 + fish.member * 2.39) * (fish.variant === 3 ? .012 : .035) + fish.scatterAlong) / radius;
}
export function fishFloor(x: number, z: number, radius: number) {
  return Math.max(terrainHeight(x, z), terrainHeight(x + radius, z), terrainHeight(x - radius, z), terrainHeight(x, z + radius), terrainHeight(x, z - radius));
}
function pose(fish: SchoolFish) {
  const kind = FISH_SPECIES[fish.variant];
  const angle = formationAngle(fish, fish.time);
  const row = Math.floor(fish.member / 4); const fan = fish.variant === 1 ? (fish.member % 4) * .09 : (fish.member % 2) * .18;
  const band = kind.band + row * .9 + fan + fish.scatterOut;
  writeShorePoint(fish.school.island, angle, band, fish.position);
  const floor = fishFloor(fish.position.x, fish.position.z, kind.radius);
  const bob = Math.sin(fish.time * .9 + fish.member * 2.39 + fish.school.phase) * .025;
  const desiredY = fish.variant === 3 ? floor + .32 + bob : -kind.depth + bob - fish.scatterOut * .09;
  fish.position.y = Math.max(floor + kind.halfHeight + .13, Math.min(-.27 - kind.halfHeight, desiredY));
  fish.jumpPitch = 0;
  // Only the streamlined coastal fish breach: reef and bottom fish dive or dart along their shelter.
  if (fish.jumpAge >= 0) {
    const progress = Math.min(1, fish.jumpAge / 1.5);
    fish.position.y += Math.sin(progress * Math.PI) ** 2 * 1.03;
    fish.jumpPitch = Math.sin(progress * TAU) * -.65;
  }
  fish.glint = fish.variant === 1 ? Math.pow(Math.max(0, Math.sin(fish.time * .73 + fish.school.phase + fish.member * 2.17)), 32) : 0;
}
export function createSchoolFish(): SchoolFish[] {
  const schools = createFishSchools(); const result: SchoolFish[] = [];
  // Member-first order keeps leaders at their school index and avoids losing entire schools at lower quality.
  for (let member = 0; member < FISH_PER_SCHOOL.high; member++) schools.forEach((school, schoolIndex) => {
    if (member >= FISH_SPECIES[school.species].population.high) return;
    const fish: SchoolFish = { school, schoolIndex, member, variant: school.species, position: new Vector3(), heading: 0, bank: 0, time: 0, scatterAlong: 0, scatterOut: 0, velocityAlong: 0, velocityOut: 0, reentry: new Vector3(), lastRipple: 0, jumpAge: -1, nextJump: 23 + schoolIndex * 1.91, jumpPitch: 0, glint: 0 };
    pose(fish); const start = fish.position.clone(); fish.time = .001; pose(fish);
    fish.heading = Math.atan2(start.z - fish.position.z, fish.position.x - start.x); fish.time = 0; pose(fish); result.push(fish);
  });
  return result;
}
export function visibleFishCount(quality: QualityTier) { return createFishSchools().reduce((count, school) => count + FISH_SPECIES[school.species].population[quality], 0); }
function disturb(fish: SchoolFish, x: number, z: number, strength: number) {
  const dx = fish.position.x - x; const dz = fish.position.z - z; const distance = Math.hypot(dx, dz);
  if (distance > 4.6) return;
  const kind = FISH_SPECIES[fish.variant];
  const side = dx * -Math.sin(fish.school.angle) + dz * Math.cos(fish.school.angle) > 0 ? 1 : -1;
  const response = (1 - distance / 4.6) * strength;
  fish.velocityAlong = Math.max(-2.1, Math.min(2.1, fish.velocityAlong + side * response * kind.escape));
  fish.velocityOut = Math.min(1.5, fish.velocityOut + response * kind.escapeOut);
}
export function stepSchoolFish(fish: SchoolFish, delta: number, disturbance: FishDisturbance, quality: QualityTier, paused = false) {
  if (paused) return false;
  const kind = FISH_SPECIES[fish.variant];
  const dt = Math.min(.05, Math.max(0, delta)); const previousX = fish.position.x; const previousY = fish.position.y; const previousZ = fish.position.z;
  fish.time += dt;
  if (disturbance.ripple.serial !== fish.lastRipple) {
    if (disturbance.ripple.serial > fish.lastRipple) disturb(fish, disturbance.ripple.x, disturbance.ripple.z, 3.5);
    fish.lastRipple = disturbance.ripple.serial;
  }
  if (disturbance.pointer) disturb(fish, disturbance.pointer[0], disturbance.pointer[2], dt * 4);
  if (disturbance.camera.y < 5) disturb(fish, disturbance.camera.x, disturbance.camera.z, dt * 3);
  fish.velocityAlong += -fish.scatterAlong * 1.8 * dt; fish.velocityOut += -fish.scatterOut * 1.8 * dt;
  fish.velocityAlong *= Math.exp(-kind.recovery * dt); fish.velocityOut *= Math.exp(-kind.recovery * dt);
  fish.scatterAlong = Math.max(-1.9, Math.min(1.9, fish.scatterAlong + fish.velocityAlong * dt));
  fish.scatterOut = Math.max(0, Math.min(1.2, fish.scatterOut + fish.velocityOut * dt));
  let reentered=false;
  if (fish.jumpAge >= 0) { fish.jumpAge += dt; if (fish.jumpAge > 1.5) {fish.jumpAge = -1;} }
  else if (quality === 'high' && fish.variant === 1 && fish.member === 0 && fish.time > fish.nextJump && fish.scatterOut < .03) {
    fish.jumpAge = 0; fish.nextJump = fish.time + 65 + fish.schoolIndex * 3;
  }
  pose(fish);
  const beforeSurface=previousY-harborWaterHeight(previousX,previousZ,fish.time-dt);
  const afterSurface=fish.position.y-harborWaterHeight(fish.position.x,fish.position.z,fish.time);
  if (fish.jumpAge > .75 && beforeSurface > 0 && afterSurface <= 0) {
    const t = beforeSurface / (beforeSurface - afterSurface);
    fish.reentry.set(previousX + (fish.position.x - previousX) * t, previousY+(fish.position.y-previousY)*t, previousZ + (fish.position.z - previousZ) * t);
    reentered = true;
  }
  const dx = fish.position.x - previousX; const dz = fish.position.z - previousZ;
  if (Math.hypot(dx, dz) > .00002) {
    const heading = Math.atan2(-dz, dx); const error = Math.atan2(Math.sin(heading - fish.heading), Math.cos(heading - fish.heading));
    const turn = Math.max(-kind.turnRate * dt, Math.min(kind.turnRate * dt, error * (1 - Math.exp(-kind.turnRate * dt))));
    fish.heading += turn;
    fish.bank += (Math.max(-.22, Math.min(.22, turn / Math.max(dt, .001) * -.12)) - fish.bank) * (1 - Math.exp(-3 * dt));
  }
  return reentered;
}
