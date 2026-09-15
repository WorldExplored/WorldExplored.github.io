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

export interface CityTransitRoute { curve: CatmullRomCurve3; length: number; speed: number }

export function createCityTransitRoute(): CityTransitRoute {
  const points = [[-29, -69], [-20, -64.5], [-12, -64.5], [-6, -68], [-4, -68], [-2.8, -65.7], [3, -64.5], [14, -66.8], [19, -76], [12, -89], [-1, -92], [-14, -92], [-27, -87], [-33, -78]];
  const curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 3.4, z)), true, 'centripetal');
  curve.arcLengthDivisions = 800;
  curve.updateArcLengths();
  return { curve, length: curve.getLength(), speed: .9 };
}

export function writeCityTransitPose(route: CityTransitRoute, elapsed: number, carriage: number, position: Vector3, tangent: Vector3) {
  const time = Number.isFinite(elapsed) ? elapsed : 0;
  const progress = ((time * route.speed - carriage * 1.85) / route.length % 1 + 1) % 1;
  route.curve.getPointAt(progress, position);
  route.curve.getPointAt((progress + .0001) % 1, tangent);
  tangent.sub(position).normalize();
  position.y += .18;
}
