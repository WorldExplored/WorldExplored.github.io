import { CatmullRomCurve3, Vector3 } from 'three';
import { transitLegDistance } from './city';
import { terrainHeight } from './terrain';

export const cityTurbines = Object.freeze([
  Object.freeze({ x: -32, z: -85, height: 8.4, phase: .3, rate: .75 }),
  Object.freeze({ x: 16, z: -84, height: 7.5, phase: 1.9, rate: .57 }),
]);

// Decks bridge the coast from dry land to navigable water, rather than floating inland.
export const cityDocks = Object.freeze([
  Object.freeze({ id: 'city', x: -12, z: -61.5, length: 7, width: 1.3, y: 1.06 }),
  Object.freeze({ id: 'garden', x: -8, z: -21.5, length: 6, width: 1.3, y: 1.06 }),
]);

export const cityInfrastructureFootprints = Object.freeze([
  ...cityTurbines.map(turbine => Object.freeze({ id: `turbine-${turbine.x}`, x: turbine.x, z: turbine.z, radius: 2.45, height: turbine.height + 2.5 })),
  Object.freeze({ id: 'garden-fountain', x: -16.2, z: -70, radius: 1.3, height: 1.6 }),
  ...cityDocks.map(dock => Object.freeze({ id: `${dock.id}-dock`, x: dock.x, z: dock.z, radius: 4.3, height: 1.65 })),
]);

// Compute terrain bases lazily so landscape planning can import the footprint data safely.
export function createCityInfrastructureObstacles() {
  return cityInfrastructureFootprints.map(site => ({ ...site, base: site.id.endsWith('-dock') ? 0 : terrainHeight(site.x, site.z) }));
}

export interface CityFerryRoute { curve: CatmullRomCurve3; length: number; station: number; firstLength: number; firstDuration: number; duration: number; speed: number }
export const FERRY_DWELL = 4;
export const FERRY_RAMP = 3;

export function createCityFerryRoute(): CityFerryRoute {
  const points = [[-14, -60], [-16, -54], [-16, -39], [-11, -27], [-8, -25.5], [-5.5, -28], [-9, -42], [-14, -55]];
  const curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, .17, z)), true, 'centripetal');
  curve.arcLengthDivisions = 600; curve.updateArcLengths();
  const point = new Vector3(); let station = 0; let nearest = Infinity;
  for (let index = 0; index < 1000; index++) {
    curve.getPointAt(index / 1000, point);
    const distance = Math.hypot(point.x + 8, point.z + 25.5);
    if (distance < nearest) { station = index / 1000; nearest = distance; }
  }
  const length = curve.getLength(); const speed = 1.8; const firstLength = length * station;
  return { curve, length, station, firstLength, speed, firstDuration: firstLength / speed + FERRY_DWELL + FERRY_RAMP, duration: length / speed + 2 * (FERRY_DWELL + FERRY_RAMP) };
}

export function cityFerryDistance(route: CityFerryRoute, elapsed: number) {
  const time = Number.isFinite(elapsed) ? elapsed : 0;
  const phase = ((time % route.duration) + route.duration) % route.duration;
  if (phase < route.firstDuration) return transitLegDistance(phase - FERRY_DWELL, route.firstLength, route.speed, FERRY_RAMP);
  return route.firstLength + transitLegDistance(phase - route.firstDuration - FERRY_DWELL, route.length - route.firstLength, route.speed, FERRY_RAMP);
}

export function writeCityFerryPose(route: CityFerryRoute, elapsed: number, position: Vector3, tangent: Vector3) {
  const distance = cityFerryDistance(route, elapsed);
  const progress = distance / route.length;
  route.curve.getPointAt(progress, position);
  route.curve.getPointAt((progress + .0001) % 1, tangent);
  tangent.sub(position).normalize();
}
