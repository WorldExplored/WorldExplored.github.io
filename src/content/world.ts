import type { SectionId } from './profile';

export type Vec3 = [number, number, number];
export type QualityTier = 'high' | 'medium' | 'low';
export type LandmarkId = SectionId;
export interface CameraPose { position: Vec3; target: Vec3 }
export interface LandmarkConfig { id: LandmarkId; position: Vec3; label: Vec3; camera: CameraPose; color: string }
export interface SceneRuntime {
  elapsed: number;
  scroll: number;
  pointer: [number, number];
  pointerActive: boolean;
  pointerWorld: Vec3;
  cloudInteraction: number;
  plantInteraction: number;
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
  rotationCommand?: { serial: number; yaw?: number; pitch?: number; reset?: boolean };
  mobile: boolean;
  onNavigate: (id: SectionId) => void;
  onArrive: (id: SectionId | '', flight: number) => void;
  onReady: () => void;
  onFailure: () => void;
}

export const world = {
  flightSeconds: 0.8,
  colors: { grass: '#347315', grassLight: '#78ab24', grassDark: '#306b17', sand: '#f2dfaa', stone: '#c0d9cc', porcelain: '#f5fff4', cyan: '#56e4ee', glass: '#7ee6e7', gold: '#ddb858', ink: '#123a4a' },
  overview: { position: [13, 14, 30], target: [0, 5, -3] } as CameraPose,
  mobileOverview: { position: [17, 19, 37], target: [0, 2, -3] } as CameraPose,
  landmarks: [
    { id: 'work', position: [-8, 0, 0], label: [-8, 5, 0], camera: { position: [4, 8.5, 17], target: [-1.5, 2.8, 0] }, color: '#a7ed61' },
    { id: 'research', position: [0, 0, 6], label: [0, 3, 6], camera: { position: [12, 7, 21], target: [6, 2, 6] }, color: '#65edff' },
    { id: 'purdue', position: [9, 0, -2], label: [9, 5, -2], camera: { position: [22, 8, 14], target: [15, 2.5, -2] }, color: '#ffe196' },
    { id: 'about', position: [-6, 0, 12], label: [-6, 3.5, 12], camera: { position: [6, 7, 25], target: [0, 2.5, 12] }, color: '#a6e65c' },
    { id: 'contact', position: [14, 0, 7], label: [14, 3.5, 7], camera: { position: [25, 7, 20], target: [19, 2, 7] }, color: '#72deff' },
    { id: 'building', position: [1, 0, -42], label: [1, 5.8, -42], camera: { position: [12, 8, -23], target: [7, 3, -42] }, color: '#bcffff' },
  ] as LandmarkConfig[],
  islands: [
    { center: [-8, -0.25, 0] as Vec3, radius: [6.3, 4.7] as [number, number], height: 1.15 },
    { center: [9, -0.25, -2] as Vec3, radius: [5.8, 4.5] as [number, number], height: 1.15 },
    { center: [1, -0.25, -42] as Vec3, radius: [3, 2.6] as [number, number], height: 0.8 },
    { center: [-6, -0.4, 12] as Vec3, radius: [7.5, 4] as [number, number], height: 1.35 },
    { center: [14, -0.45, 7] as Vec3, radius: [5, 3.5] as [number, number], height: 1.2 },
  ],
  quality: {
    high: { dpr: 1.75, grass: 2000, clouds: 24, bubbles: 5, particles: 80, segments: 48, shadows: true, waterDetail: 1 },
    medium: { dpr: 1.35, grass: 1100, clouds: 16, bubbles: 3, particles: 40, segments: 32, shadows: true, waterDetail: 0.65 },
    low: { dpr: 1, grass: 450, clouds: 10, bubbles: 2, particles: 18, segments: 24, shadows: false, waterDetail: 0.35 },
  },
  lighting: { skyTop: '#006bd6', horizon: '#87dbe9', sunPosition: [-12, 24, 12] as Vec3, sunIntensity: 2.05, sunColor: '#fff3ce', ambientSky: '#c4eaff', ambientGround: '#568b28', ambientIntensity: 1.0, fogColor: '#87dbe9', fogNear: 110, fogFar: 190, water: '#00b9d0', deepWater: '#006fa4', windowIllumination: 0.3, lampIntensity: 0.7, lampEnabled: true, cloudColor: '#ffffff' },
  environment: { cloudSpeed: 0.12, windSpeed: 0.7, waterSpeed: 0.55 },
};

export function createSceneRuntime(): SceneRuntime {
  return { elapsed: 0, scroll: 0, pointer: [0, 0], pointerActive: false, pointerWorld: [0, 0, 0], cloudInteraction: 0, plantInteraction: 0, moving: false, hovered: null, ripple: { x: 0, z: 0, time: -100, serial: 0 }, dragCount: 0, dragging: false, frames: 0 };
}

export function motionPolicy(reduced: boolean, saveData: boolean, forcedColors: boolean) {
  const webgl = !saveData && !forcedColors;
  return { webgl, camera: webgl && !reduced, ambient: webgl && !reduced, physics: false };
}

export function lowerQuality(tier: QualityTier): QualityTier { return tier === 'high' ? 'medium' : 'low'; }
export function flightEase(progress: number) { const t = Math.max(0, Math.min(1, progress)); return t * t * (3 - 2 * t); }
export function landmarkFor(id: SectionId | '') { return world.landmarks.find(landmark => landmark.id === id); }
