import { Vector3 } from 'three';
import type { QualityTier } from '../../content/world';
import { ISLANDS, islandContour, landDistance, seededRandom, terrainHeight, type Island } from './terrain';

export const SCHOOL_COUNT = 9;
export const FISH_PER_SCHOOL = { high: 8, medium: 5, low: 3 } satisfies Record<QualityTier, number>;
export interface FishSchool { island: Island; angle: number; phase: number; speed: number }
export interface SchoolFish {
  school: FishSchool; schoolIndex: number; member: number; variant: number; position: Vector3; heading: number;
  time: number; scatterAlong: number; scatterOut: number; velocityAlong: number; velocityOut: number;
  lastRipple: number; jumpAge: number; nextJump: number; jumpPitch: number; glint: number;
}
export interface FishDisturbance { camera: Vector3; pointer: readonly number[] | null; ripple: { x: number; z: number; serial: number } }
const TAU = Math.PI * 2;

export function writeShorePoint(island: Island, angle: number, band: number, point: Vector3) {
  const radius = islandContour(island, angle) + band / Math.min(island.rx, island.rz);
  const x = island.x + Math.cos(angle) * island.rx * radius; const z = island.z + Math.sin(angle) * island.rz * radius;
  return point.set(x, -.24, z);
}
export function createFishSchools(): FishSchool[] {
  const random = seededRandom(81153); const schools: FishSchool[] = []; const point = new Vector3();
  const ownership = [0, 1, 2, 0, 1, 4, 0, 1, 4];
  for (const islandIndex of ownership) {
    const island = ISLANDS[islandIndex];
    for (let attempt = 0; attempt < 600; attempt++) {
      const angle = random() * TAU;
      if (schools.some(school => school.island === island && Math.abs(Math.atan2(Math.sin(angle - school.angle), Math.cos(angle - school.angle))) < .70)) continue;
      let safe = true;
      // Validate the full route, staggered formation, and outward scatter envelope.
      const extent = .19 + 2.8 / Math.min(island.rx, island.rz);
      for (let sample = 0; sample <= 48 && safe; sample++) for (const band of [1.35, 2.6, 4.0]) {
        writeShorePoint(island, angle + (sample / 24 - 1) * extent, band, point);
        if (landDistance(point.x, point.z) > -1.0 || terrainHeight(point.x, point.z) > -.39) { safe = false; break; }
      }
      if (safe) { schools.push({ island, angle, phase: random() * TAU, speed: .09 + random() * .035 }); break; }
    }
  }
  if (schools.length !== SCHOOL_COUNT) throw new Error('The shoreline has insufficient clear water for fish schools.');
  return schools;
}
function formationAngle(fish: SchoolFish, time: number) {
  const radius = Math.min(fish.school.island.rx, fish.school.island.rz);
  const followTime = time - fish.member * .17;
  return fish.school.angle + .13 * Math.sin(followTime * fish.school.speed + fish.school.phase)
    + .035 * Math.sin(followTime * fish.school.speed * .57 + fish.school.phase * 2)
    + ((fish.member % 4 - 1.5) * .38 + Math.sin(time * .43 + fish.member * 2.39) * .055 + fish.scatterAlong) / radius;
}
function pose(fish: SchoolFish) {
  const angle = formationAngle(fish, fish.time); const band = 1.55 + Math.floor(fish.member / 4) * .55 + (fish.member % 2) * .18 + fish.scatterOut;
  writeShorePoint(fish.school.island, angle, band, fish.position);
  const wave = Math.sin(fish.time * .9 + fish.member * 2.39 + fish.school.phase) * .035;
  fish.position.y = Math.max(terrainHeight(fish.position.x, fish.position.z) + .14, -.24 + wave);
  fish.jumpPitch = 0;
  if (fish.jumpAge >= 0) {
    const progress = Math.min(1, fish.jumpAge / 1.15);
    fish.position.y += Math.sin(progress * Math.PI) ** 2 * .55;
    fish.jumpPitch = Math.sin(progress * TAU) * -.65;
  }
  fish.glint = Math.pow(Math.max(0, Math.sin(fish.time * .73 + fish.school.phase + fish.member * 2.17)), 32);
}
export function createSchoolFish(): SchoolFish[] {
  const schools = createFishSchools();
  return Array.from({ length: SCHOOL_COUNT * FISH_PER_SCHOOL.high }, (_, index) => {
    const schoolIndex = index % SCHOOL_COUNT; const member = Math.floor(index / SCHOOL_COUNT);
    const fish: SchoolFish = { school: schools[schoolIndex], schoolIndex, member, variant: schoolIndex % 3, position: new Vector3(), heading: 0, time: 0, scatterAlong: 0, scatterOut: 0, velocityAlong: 0, velocityOut: 0, lastRipple: 0, jumpAge: -1, nextJump: 17 + index * 1.91, jumpPitch: 0, glint: 0 };
    pose(fish);
    const angle = formationAngle(fish, 0); const speed = Math.cos(fish.school.phase) * .13 + Math.cos(fish.school.phase * 2) * .035 * .57;
    fish.heading = Math.atan2(-Math.cos(angle) * fish.school.island.rz * speed, -Math.sin(angle) * fish.school.island.rx * speed);
    return fish;
  });
}
function disturb(fish: SchoolFish, x: number, z: number, strength: number) {
  const dx = fish.position.x - x; const dz = fish.position.z - z; const distance = Math.hypot(dx, dz);
  if (distance > 4.6) return;
  const tangentX = -Math.sin(fish.school.angle); const tangentZ = Math.cos(fish.school.angle);
  const side = dx * tangentX + dz * tangentZ > 0 ? 1 : -1;
  const response = (1 - distance / 4.6) * strength;
  fish.velocityAlong += side * response * (1.15 + fish.member % 3 * .17);
  fish.velocityOut += response * .65;
}

export function stepSchoolFish(fish: SchoolFish, delta: number, disturbance: FishDisturbance, quality: QualityTier, paused = false) {
  if (paused) return;
  const dt = Math.min(.05, Math.max(0, delta)); const previousX = fish.position.x; const previousZ = fish.position.z;
  fish.time += dt;
  if (disturbance.ripple.serial !== fish.lastRipple) {
    if (disturbance.ripple.serial > fish.lastRipple) disturb(fish, disturbance.ripple.x, disturbance.ripple.z, 3.5);
    fish.lastRipple = disturbance.ripple.serial;
  }
  if (disturbance.pointer) disturb(fish, disturbance.pointer[0], disturbance.pointer[2], dt * 4);
  if (disturbance.camera.y < 5) disturb(fish, disturbance.camera.x, disturbance.camera.z, dt * 3);
  fish.velocityAlong += -fish.scatterAlong * 1.8 * dt; fish.velocityOut += -fish.scatterOut * 1.8 * dt;
  fish.velocityAlong *= Math.exp(-2.3 * dt); fish.velocityOut *= Math.exp(-2.3 * dt);
  fish.scatterAlong = Math.max(-1.9, Math.min(1.9, fish.scatterAlong + fish.velocityAlong * dt));
  fish.scatterOut = Math.max(0, Math.min(1.4, fish.scatterOut + fish.velocityOut * dt));
  if (fish.jumpAge >= 0) { fish.jumpAge += dt; if (fish.jumpAge > 1.15) fish.jumpAge = -1; }
  else if (quality === 'high' && (fish.member * SCHOOL_COUNT + fish.schoolIndex) % 19 === 0 && fish.time > fish.nextJump && fish.scatterOut < .03) {
    fish.jumpAge = 0; fish.nextJump = fish.time + 48 + fish.schoolIndex * 3;
  }
  pose(fish);
  const dx = fish.position.x - previousX; const dz = fish.position.z - previousZ;
  if (Math.hypot(dx, dz) > .00002) {
    const heading = Math.atan2(-dz, dx);
    fish.heading += Math.atan2(Math.sin(heading - fish.heading), Math.cos(heading - fish.heading)) * (1 - Math.exp(-4 * dt));
  }
}
