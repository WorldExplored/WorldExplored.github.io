import { Vector3 } from 'three';

export const FLYPAST_INTERVAL = 9_000;
export const FLYPAST_DURATION = 150;
export const FLYPAST_FIRST = 240;
export const FLYPAST_COUNT = 20;

/** A migrating flock crosses the whole horizon; no member participates in local nesting. */
export function sampleBirdFlypast(seconds: number, hour: number, index: number, position = new Vector3()) {
  const cycle = Math.max(0, Math.floor((seconds - FLYPAST_FIRST) / FLYPAST_INTERVAL));
  const age = seconds - FLYPAST_FIRST - cycle * FLYPAST_INTERVAL;
  const active = hour >= 7 && hour < 19 && age >= 0 && age <= FLYPAST_DURATION;
  const angle = .27 + (cycle % 5) * 1.17;
  const dx = Math.cos(angle), dz = Math.sin(angle), side = index % 2 ? -1 : 1;
  const rank = Math.ceil(index / 2), behind = rank * 7.5;
  const cross = side * rank * 5.8 + Math.sin(age * .045 + index * 2.17) * .65;
  const travel = -500 + age * 7.3 - behind;
  position.set(-16 + dx * travel - dz * cross, 61 + (cycle % 3) * 7 + Math.sin(index * 1.81) * 1.6 + Math.sin(age * .22 + index) * .25, -56 + dz * travel + dx * cross);
  return { active, position, heading: Math.atan2(-dx, -dz), phase: age * 6.8 + index * 1.37, age };
}
