import type { SectionId } from './profile';

export type Vec3 = [number, number, number];
export type QualityTier = 'high' | 'medium' | 'low';
export type LandmarkId = SectionId;
export interface CameraPose { position: Vec3; target: Vec3 }
export interface LandmarkConfig { id: LandmarkId; position: Vec3; label: Vec3; color: string }
export interface SceneRuntime {
  elapsed: number;
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
  colors: { grass: '#429a08', grassLight: '#79b619', grassDark: '#205d08', sand: '#ebf1d0', stone: '#c0d9cc', porcelain: '#f5fff4', cyan: '#56e4ee', glass: '#7ee6e7', gold: '#ddb858', ink: '#123a4a' },
  overview: { position: [33, 24, 65], target: [-3, 2, -10] } as CameraPose,
  mobileOverview: { position: [9, 30, 95], target: [-4, 1, -12] } as CameraPose,
  landmarks: [
    { id: 'work', position: [-8, 0, 0], label: [-8, 10, 0], color: '#a7ed61' },
    { id: 'research', position: [4, 0, -7], label: [4, 7.7, -7], color: '#65edff' },
    { id: 'purdue', position: [26, 0, -7], label: [26, 4.8, -7], color: '#ffe196' },
    { id: 'about', position: [-10, 0, 23], label: [-10, 5.6, 23], color: '#a6e65c' },
    { id: 'contact', position: [12, 0, 23], label: [12, 7, 23], color: '#72deff' },
    { id: 'building', position: [-76, 1.8, -36], label: [-76, 9.8, -36], color: '#bcffff' },
  ] as LandmarkConfig[],
  quality: {
    high: { dpr: 1.75, grass: 18000, clouds: 24, bubbles: 5, particles: 80, segments: 48, shadows: true, waterDetail: 1 },
    medium: { dpr: 1.35, grass: 10000, clouds: 16, bubbles: 3, particles: 40, segments: 32, shadows: true, waterDetail: 0.65 },
    low: { dpr: 1, grass: 4500, clouds: 10, bubbles: 2, particles: 18, segments: 24, shadows: false, waterDetail: 0.35 },
  },
  lighting: { skyTop: '#005cdd', horizon: '#87dbe9', sunPosition: [-34, 8, -80] as Vec3, sunIntensity: 2.4, sunColor: '#ffffff', ambientSky: '#c4eaff', ambientGround: '#83ab41', ambientIntensity: .75, fogColor: '#87dbe9', fogNear: 230, fogFar: 430, water: '#00b9d0', deepWater: '#006fa4', windowIllumination: 0.3, lampIntensity: 0.7, lampEnabled: true, cloudColor: '#ffffff' },
  environment: { cloudSpeed: 0.12, windSpeed: 0.7, waterSpeed: 0.55 },
};

export function createSceneRuntime(): SceneRuntime {
  return { elapsed: 0, pointer: [0, 0], pointerActive: false, pointerWorld: [0, 0, 0], cloudInteraction: 0, plantInteraction: 0, moving: false, hovered: null, ripple: { x: 0, z: 0, time: -100, serial: 0 }, dragCount: 0, dragging: false, frames: 0 };
}

export function motionPolicy(reduced: boolean, saveData: boolean, forcedColors: boolean) {
  const webgl = !saveData && !forcedColors;
  return { webgl, camera: webgl && !reduced, ambient: webgl && !reduced, physics: false };
}

export function lowerQuality(tier: QualityTier): QualityTier { return tier === 'high' ? 'medium' : 'low'; }
export function flightEase(progress: number) { const t = Math.max(0, Math.min(1, progress)); return t * t * (3 - 2 * t); }
export function landmarkFor(id: SectionId | '') { return world.landmarks.find(landmark => landmark.id === id); }
