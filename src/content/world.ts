import type { SectionId } from './profile';

export type Vec3 = [number, number, number];
export type QualityTier = 'high' | 'medium' | 'low';
export type LandmarkId = 'work' | 'research' | 'purdue' | 'building';
export interface CameraPose { position: Vec3; target: Vec3 }
export interface LandmarkConfig { id: LandmarkId; position: Vec3; label: Vec3; camera: CameraPose; color: string }
export interface SceneRuntime {
  elapsed: number;
  scroll: number;
  pointer: [number, number];
  moving: boolean;
  hovered: LandmarkId | null;
  ripple: { x: number; z: number; time: number; serial: number };
  dragCount: number;
  dragging: boolean;
  frames: number;
}
export interface WorldProps {
  destination: SectionId | '';
  flight: number;
  paused: boolean;
  panelOpen: boolean;
  free: boolean;
  mobile: boolean;
  onNavigate: (id: SectionId) => void;
  onArrive: (id: SectionId | '', flight: number) => void;
  onReady: () => void;
  onFailure: () => void;
}

export const world = {
  flightSeconds: 0.8,
  colors: { sky: '#0875cf', horizon: '#b8edf7', water: '#03afc7', deepWater: '#00568e', grass: '#347315', grassLight: '#78ab24', grassDark: '#306b17', sand: '#f2dfaa', stone: '#c0d9cc', porcelain: '#f5fff4', cyan: '#56e4ee', glass: '#7ee6e7', gold: '#ddb858', ink: '#123a4a' },
  overview: { position: [13, 14, 30], target: [0, 5, -3] } as CameraPose,
  mobileOverview: { position: [17, 19, 37], target: [0, 2, -3] } as CameraPose,
  landmarks: [
    { id: 'work', position: [-8, 0, 0], label: [-8, 1.2, 3.5], camera: { position: [0, 8.5, 14], target: [-8, 2.4, 0] }, color: '#a7ed61' },
    { id: 'research', position: [0, 0, 6], label: [0, 0.2, 9], camera: { position: [8, 6.5, 18], target: [0, 1.5, 6] }, color: '#65edff' },
    { id: 'purdue', position: [9, 0, -2], label: [10, 1.2, 1.2], camera: { position: [19, 8, 10], target: [9, 2, -2] }, color: '#ffe196' },
    { id: 'building', position: [1, 0, -17], label: [1, 5.4, -17], camera: { position: [10, 8, -3], target: [1, 2.5, -17] }, color: '#bcffff' },
  ] as LandmarkConfig[],
  islands: [
    { center: [-8, -0.25, 0] as Vec3, radius: [6.3, 4.7] as [number, number], height: 1.15 },
    { center: [9, -0.25, -2] as Vec3, radius: [5.8, 4.5] as [number, number], height: 1.15 },
    { center: [1, -0.25, -17] as Vec3, radius: [3, 2.6] as [number, number], height: 0.8 },
    { center: [-11, -0.4, 15] as Vec3, radius: [7.5, 4] as [number, number], height: 1.35 },
    { center: [16, -0.45, 12] as Vec3, radius: [5, 3.5] as [number, number], height: 1.2 },
  ],
  quality: {
    high: { dpr: 1.75, grass: 2000, clouds: 24, bubbles: 26, particles: 80, segments: 48, shadows: true, waterDetail: 1 },
    medium: { dpr: 1.35, grass: 1100, clouds: 16, bubbles: 18, particles: 40, segments: 32, shadows: true, waterDetail: 0.65 },
    low: { dpr: 1, grass: 450, clouds: 10, bubbles: 10, particles: 18, segments: 24, shadows: false, waterDetail: 0.35 },
  },
  environment: { sun: [-12, 24, 12] as Vec3, fogNear: 38, fogFar: 105, cloudSpeed: 0.12, windSpeed: 0.7, waterSpeed: 0.55, bubbleBounds: { min: [-17, 1.4, 4] as Vec3, max: [17, 8.5, 17] as Vec3 }, tactileBubbles: 6 },
};

export function createSceneRuntime(): SceneRuntime {
  return { elapsed: 0, scroll: 0, pointer: [0, 0], moving: false, hovered: null, ripple: { x: 0, z: 0, time: -100, serial: 0 }, dragCount: 0, dragging: false, frames: 0 };
}

export function motionPolicy(reduced: boolean, saveData: boolean, forcedColors: boolean, manualStatic: boolean) {
  const staticScene = reduced || saveData || forcedColors || manualStatic;
  return { webgl: !staticScene, camera: !staticScene, ambient: !staticScene, physics: !staticScene };
}

export function lowerQuality(tier: QualityTier): QualityTier { return tier === 'high' ? 'medium' : 'low'; }
export function flightEase(progress: number) { const t = Math.max(0, Math.min(1, progress)); return t * t * (3 - 2 * t); }
export function landmarkFor(id: SectionId | '') { return world.landmarks.find(landmark => landmark.id === id); }
