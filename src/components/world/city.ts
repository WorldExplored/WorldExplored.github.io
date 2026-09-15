import { CatmullRomCurve3, Vector3 } from 'three';

export type CityArchetype = 'residential' | 'garden-office' | 'dome' | 'pavilion' | 'transit-hall';
export interface CityBuilding {
  id: string;
  x: number;
  z: number;
  radius: number;
  height: number;
  width: number;
  depth: number;
  rotation: number;
  archetype: CityArchetype;
}

export const CITY_BASE_Y = .8;
const layouts: Array<[string, CityArchetype, number, number, number, number, number, number]> = [
  ['residence-west', 'residential', -19, -83.5, 4.6, 3, 9.8, -.16],
  ['residence-garden', 'residential', -9, -87, 5, 3, 12, .12],
  ['residence-east', 'residential', 2, -86, 4.1, 2.8, 10.4, -.22],
  ['residence-cove', 'residential', 12, -81.5, 4, 2.8, 8.6, .18],
  ['office-west', 'garden-office', -25, -77, 4.5, 3.8, 6.8, -.12],
  ['office-courtyard', 'garden-office', -14, -77.5, 5, 4, 7.8, .12],
  ['office-park', 'garden-office', -3, -78, 5, 3.6, 8.8, -.14],
  ['office-east', 'garden-office', 7, -75, 4, 3.4, 6.2, .18],
  ['waterfront-west', 'pavilion', -21, -72, 5.2, 3.6, 3.4, -.12],
  ['winter-garden', 'dome', -11, -69.5, 6, 4, 3.6, .08],
  ['waterfront-gallery', 'pavilion', 0, -69, 4.8, 3.2, 3.3, .08],
  ['waterfront-east', 'dome', 8, -68, 4.2, 3.4, 3.5, -.15],
  ['transit-garden', 'transit-hall', -5, -68, 3.2, 2.8, 4.2, Math.PI / 2],
];

export const cityBuildings: readonly Readonly<CityBuilding>[] = Object.freeze(layouts.map(([id, archetype, x, z, width, depth, height, rotation]) => Object.freeze({
  id, archetype, x, z, width, depth, height, rotation, radius: Math.hypot(width / 2, depth / 2) + .65,
})));

export interface CityTransitRoute { curve: CatmullRomCurve3; length: number; speed: number; duration: number; station: number }

export const CITY_STATION_DWELL = 5;
export const CITY_TRANSIT_RAMP = 6;

function rampDistance(time: number, speed: number, ramp: number) {
  return speed * (time / 2 - ramp * Math.sin(Math.PI * time / ramp) / (2 * Math.PI));
}

// Integrated cosine acceleration joins stationary platforms to full cruise without speed jumps.
export function transitLegDistance(time: number, length: number, speed: number, ramp: number) {
  const cruise = length / speed - ramp;
  if (time <= 0) return 0;
  if (time < ramp) return rampDistance(time, speed, ramp);
  if (time < ramp + cruise) return speed * ramp / 2 + (time - ramp) * speed;
  if (time < 2 * ramp + cruise) return length - rampDistance(2 * ramp + cruise - time, speed, ramp);
  return length;
}

export function cityTransitDistance(route: CityTransitRoute, elapsed: number) {
  const time = Number.isFinite(elapsed) ? elapsed : 0;
  const phase = ((time % route.duration) + route.duration) % route.duration;
  return transitLegDistance(phase - CITY_STATION_DWELL, route.length, route.speed, CITY_TRANSIT_RAMP);
}

export function cityStationActivity(route: CityTransitRoute, elapsed: number) {
  const phase = ((elapsed % route.duration) + route.duration) % route.duration;
  if (phase <= CITY_STATION_DWELL) return 1;
  if (phase < CITY_STATION_DWELL + 6) return 1 - (phase - CITY_STATION_DWELL) / 6;
  return Math.max(0, 1 - (route.duration - phase) / 12);
}

export function createCityTransitRoute(): CityTransitRoute {
  const points = [[-29, -69], [-20, -64.5], [-12, -64.5], [-6, -68], [-4, -68], [-2.8, -65.7], [3, -64.5], [14, -66.8], [19, -76], [12, -89], [-1, -92], [-14, -92], [-27, -87], [-33, -78]];
  const curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 3.4, z)), true, 'centripetal');
  curve.arcLengthDivisions = 800;
  curve.updateArcLengths();
  const length = curve.getLength(); const point = new Vector3(); let station = 0; let closest = Infinity;
  for (let index = 0; index < 1000; index++) {
    curve.getPointAt(index / 1000, point);
    const distance = Math.hypot(point.x + 5, point.z + 68);
    if (distance < closest) { station = index / 1000; closest = distance; }
  }
  return { curve, length, speed: .9, station, duration: length / .9 + CITY_STATION_DWELL + CITY_TRANSIT_RAMP };
}

export function writeCityTransitPose(route: CityTransitRoute, elapsed: number, carriage: number, position: Vector3, tangent: Vector3) {
  const time = Number.isFinite(elapsed) ? elapsed : 0;
  const progress = ((cityTransitDistance(route, time) - carriage * 1.85) / route.length + route.station + 1) % 1;
  route.curve.getPointAt(progress, position);
  route.curve.getPointAt((progress + .0001) % 1, tangent);
  tangent.sub(position).normalize();
  position.y += .18;
}
