import { CatmullRomCurve3, Vector3 } from 'three';

export type CityArchetype = 'residential' | 'garden-office' | 'dome' | 'pavilion' | 'transit-hall';
export type CityFamily = 'terraced-apartments' | 'narrow-mixed-use' | 'split-wings' | 'rounded-housing' | 'courtyard-block' | 'arched-apartments' | 'greenhouse-residences' | 'split-level-homes' | 'waterfront-rowhouses' | 'winter-glasshouse' | 'civic-gallery' | 'stacked-maisonettes' | 'public-station';
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
  family: CityFamily;
}

export const CITY_BASE_Y = .8;
const layouts: Array<[string, CityArchetype, number, number, number, number, number, number]> = [
  ['residence-west', 'residential', -19, -83.5, 4.6, 3, 9.8, 0],
  ['residence-garden', 'residential', -9, -87, 5, 3, 12, 0],
  ['residence-east', 'residential', 2, -86, 4.1, 2.8, 10.4, 0],
  ['residence-cove', 'residential', 12, -81.5, 4, 2.8, 8.6, 0],
  ['office-west', 'garden-office', -26, -84, 4.5, 3.8, 6.8, 0],
  ['office-courtyard', 'garden-office', -14, -77.75, 5, 4, 7.8, 0],
  ['office-park', 'garden-office', -3, -78, 5, 3.6, 8.8, 0],
  ['office-east', 'garden-office', 7, -75, 4, 3.4, 6.2, 0],
  ['waterfront-west', 'pavilion', -21, -72, 5.2, 3.6, 3.4, 0],
  ['winter-garden', 'dome', -11, -69.5, 6, 4, 3.6, 0],
  ['waterfront-gallery', 'pavilion', 0, -69, 4.8, 3.2, 3.3, 0],
  ['waterfront-east', 'dome', 8, -68, 4.2, 3.4, 4.6, 0],
  ['transit-garden', 'transit-hall', -5, -68, 3.2, 2.8, 4.8, Math.PI / 2],
];

const families: readonly CityFamily[] = ['terraced-apartments', 'narrow-mixed-use', 'split-wings', 'rounded-housing', 'courtyard-block', 'arched-apartments', 'greenhouse-residences', 'split-level-homes', 'waterfront-rowhouses', 'winter-glasshouse', 'civic-gallery', 'stacked-maisonettes', 'public-station'];

export const cityBuildings: readonly Readonly<CityBuilding>[] = Object.freeze(layouts.map(([id, archetype, x, z, width, depth, height, rotation], index) => Object.freeze({
  id, archetype, family: families[index], x, z, width, depth, height, rotation, radius: Math.hypot(width / 2, depth / 2) + .65,
})));

export type CityPoint = readonly [number, number, number];
export function cityLocalToWorld(building: Readonly<CityBuilding>, point: CityPoint): CityPoint {
  const [x, y, z] = point; const c = Math.cos(building.rotation); const s = Math.sin(building.rotation);
  return [building.x + x * c + z * s, CITY_BASE_Y + y, building.z - x * s + z * c];
}

// These are the actual open doorway thresholds, shared by architecture and circulation.
export const cityEntrances = Object.freeze(cityBuildings.map(building => {
  const local: CityPoint = building.family === 'public-station' ? [1.6, 2.32, 0] : [0, .33, building.depth / 2 + .08];
  return Object.freeze({ building: building.id, local, world: cityLocalToWorld(building, local), width: building.family === 'public-station' ? 1.1 : .86, yaw: building.rotation + (building.family === 'public-station' ? Math.PI / 2 : 0) });
}));

export function cityEntranceLocal(building: Readonly<CityBuilding>): CityPoint {
  return cityEntrances.find(entrance => entrance.building === building.id)!.local;
}
export function cityEntranceWorld(building: Readonly<CityBuilding>) {
  const [x, y, z] = cityLocalToWorld(building, cityEntranceLocal(building));
  return { x, y, z };
}

export const citySecondaryEntrances = Object.freeze(cityBuildings.filter(building => building.family === 'public-station').map(building => {
  const local: CityPoint = [-.82, .33, building.depth / 2 - .05];
  return Object.freeze({ building: building.id, local, world: cityLocalToWorld(building, local), width: .86, yaw: building.rotation });
}));

// Equipment sits on deliberately flat service roofs; curved and planted roofs have no panels.
export const cityRoofMounts = Object.freeze(cityBuildings.filter(building => ['terraced-apartments', 'narrow-mixed-use', 'courtyard-block'].includes(building.family)).map(building => {
  const local: CityPoint = [building.family === 'terraced-apartments' ? -.42 : 0, building.height - .2, -.35];
  return Object.freeze({ building: building.id, local, world: cityLocalToWorld(building, local), yaw: building.rotation, width: building.width * .46, depth: building.depth * .4 });
}));

export interface CityTransitRoute { curve: CatmullRomCurve3; length: number; speed: number; duration: number; station: number }

export const CITY_STATION_DWELL = 5;
export const CITY_TRACK_Y = 2.82;
export const CITY_CARRIAGE_HALF_WIDTH = .48;
export const CITY_CARRIAGE_HALF_LENGTH = .85;
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
  // The eastern coast wraps outside the complete rotated History shell and canopy.
  // The station throat follows the narrow gap between the winter garden and civic gallery.
  const points = [[-35, -70], [-24, -63], [-14, -63], [-9, -63.5], [-7, -65.5], [-6.7, -67], [-5.8, -68], [-5, -68], [-4.2, -68], [-3.6, -66.5], [-2.3, -63], [10, -62], [24, -62], [32, -68], [32, -79], [22, -90], [7, -95], [-12, -95], [-29, -89], [-36, -80]];
  const curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, CITY_TRACK_Y, z)), true, 'centripetal');
  curve.arcLengthDivisions = 2400;
  curve.updateArcLengths();
  const length = curve.getLength(); const point = new Vector3(); let station = 0; let closest = Infinity;
  for (let index = 0; index < 12000; index++) {
    curve.getPointAt(index / 12000, point);
    const distance = Math.hypot(point.x + 5, point.z + 68);
    if (distance < closest) { station = index / 12000; closest = distance; }
  }
  // Refine the stop independently of arc-length sampling so its doorway stays square to the platform.
  let low = station - 1 / 12000, high = station + 1 / 12000;
  const stationError = (u: number) => { curve.getPointAt(u, point); return Math.hypot(point.x + 5, point.z + 68); };
  for (let step = 0; step < 30; step++) {
    const a = low + (high - low) / 3, b = high - (high - low) / 3;
    if (stationError(a) < stationError(b)) high = b; else low = a;
  }
  station = (low + high) / 2;
  return { curve, length, speed: .9, station, duration: length / .9 + CITY_STATION_DWELL + CITY_TRANSIT_RAMP };
}

export function writeCityTransitPose(route: CityTransitRoute, elapsed: number, carriage: number, position: Vector3, tangent: Vector3) {
  const time = Number.isFinite(elapsed) ? elapsed : 0;
  const progress = ((cityTransitDistance(route, time) - carriage * 1.85) / route.length + route.station + 1) % 1;
  route.curve.getPointAt(progress, position);
  route.curve.getTangentAt(progress, tangent);
  position.y += .18;
}
