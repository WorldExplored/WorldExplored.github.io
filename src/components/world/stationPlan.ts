import { Vector3 } from 'three';
import { terrainBaseMeshHeight } from './terrain';

export const STATION_ACCESS = Object.freeze({ x: -5, width: 1.3, bottomZ: -73.8, landingStartZ: -74.45, topLandingZ: -70.1, platformZ: -69.6, platformY: 3.12, railHeight: .82, railRadius: .035, steps: 15 });
export interface StationStairSection { from: number; to: number; top: number; kind: 'bottom-landing' | 'step' | 'top-landing' }

export function stationAccessPlan() {
  const { x, width, bottomZ, landingStartZ, topLandingZ, platformZ, platformY, steps } = STATION_ACCESS;
  const bottomY = terrainBaseMeshHeight(x, bottomZ) + .07;
  const rise = (platformY - bottomY) / steps;
  const run = (topLandingZ - bottomZ) / steps;
  const sections: StationStairSection[] = [
    { from: landingStartZ, to: bottomZ, top: bottomY, kind: 'bottom-landing' },
    ...Array.from({ length: steps }, (_, index): StationStairSection => ({ from: bottomZ + index * run, to: bottomZ + (index + 1) * run, top: bottomY + (index + 1) * rise, kind: 'step' })),
    { from: topLandingZ, to: platformZ, top: platformY, kind: 'top-landing' },
  ];
  // Handrails join landing-height extensions with the line through tread noses.
  const railPoints = [new Vector3(x, bottomY + STATION_ACCESS.railHeight, landingStartZ), ...sections.filter(section => section.kind === 'step').map(section => new Vector3(x, section.top + STATION_ACCESS.railHeight, section.from)), new Vector3(x, platformY + STATION_ACCESS.railHeight, topLandingZ), new Vector3(x, platformY + STATION_ACCESS.railHeight, platformZ)];
  return { x, width, bottom: { x, y: bottomY, z: bottomZ }, top: { x, y: platformY, z: platformZ }, rise, run, sections, railPoints };
}
