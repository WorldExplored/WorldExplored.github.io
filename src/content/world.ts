import type { SectionId } from './profile';
import { Vector3 } from 'three';

export type Vec3 = [number, number, number];
export type QualityTier = 'high' | 'medium' | 'low';
export type LandmarkId = SectionId;
export interface CameraPose { position: Vec3; target: Vec3 }
export interface LandmarkConfig {
  rotationY?: number;
  id: LandmarkId; position: Vec3; label: Vec3; color: string }
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
  sunDirection: Vec3;
  nature: { x: number; y: number; z: number; kind: 'tree' | 'rock' | 'fish'; time: number; serial: number };
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
  colors: { grass: '#28863d', grassLight: '#64b443', grassDark: '#164f2c', sand: '#ebf1d0', stone: '#c0d9cc', porcelain: '#f5fff4', cyan: '#06abc1', glass: '#7ee6e7', gold: '#ddb858', ink: '#123a4a' },
  overview: { position: [42, 29, 76], target: [-4, 2, -17] } as CameraPose,
  mobileOverview: { position: [17, 36, 110], target: [-4, 1, -18] } as CameraPose,
  landmarks: [
    { id: 'work', position: [-8, 0, 0], label: [-8, 11.9, 0], color: '#a7ed61' },
    { id: 'experience', rotationY: .12, position: [-27, 0, -2], label: [-27, 8.2, -2], color: '#77edc2' },
    { id: 'research', position: [4, 0, -7], label: [4, 9.2, -7], color: '#65edff' },
    { id: 'purdue', rotationY: -Math.PI / 2, position: [26, 0, -7], label: [26, 5.3, -7], color: '#ffe196' },
    { id: 'history', rotationY: -.28, position: [21, 0, -72], label: [21, 9.2, -72], color: '#8ff0bc' },
    { id: 'about', position: [-10, 0, 23], label: [-10, 5.6, 23], color: '#a6e65c' },
    { id: 'contact', position: [12, 0, 23], label: [12, 7, 23], color: '#72deff' },
    { id: 'arcade', position: [-26, 0, -85], label: [-26, 5.3, -85], color: '#b5f66d' },
    { id: 'building', position: [-76, 1.8, -36], label: [-76, 9.8, -36], color: '#bcffff' },
  ] as LandmarkConfig[],
  quality: {
    high: { dpr: 1.75, grass: 18000, clouds: 24, bubbles: 5, particles: 80, segments: 48, shadows: true, waterDetail: 1 },
    medium: { dpr: 1.35, grass: 10000, clouds: 16, bubbles: 3, particles: 40, segments: 32, shadows: true, waterDetail: 0.65 },
    low: { dpr: 1, grass: 4500, clouds: 10, bubbles: 2, particles: 18, segments: 24, shadows: false, waterDetail: 0.35 },
  },
  lighting: { skyTop: '#005cdd', horizon: '#87dbe9', sunPosition: [-34, 8, -80] as Vec3, sunIntensity: 2.8, sunColor: '#ffffff', ambientSky: '#c4eaff', ambientGround: '#36594b', ambientIntensity: .55, fogColor: '#87dbe9', fogNear: 230, fogFar: 430, water: '#00a8bb', deepWater: '#034478', windowIllumination: 0.3, lampIntensity: 0.7, lampEnabled: true, cloudColor: '#ffffff' },
  environment: { cloudSpeed: 0.12, windSpeed: 0.7, waterSpeed: 0.55 },
};

export function createSceneRuntime(): SceneRuntime {
  const sun=new Vector3(...world.lighting.sunPosition).normalize();
  return { elapsed: 0, pointer: [0, 0], pointerActive: false, pointerWorld: [0, 0, 0], cloudInteraction: 0, plantInteraction: 0, moving: false, hovered: null, ripple: { x: 0, z: 0, time: -100, serial: 0 }, sunDirection: sun.toArray(), nature: { x: 0, y: 0, z: 0, kind: 'tree', time: -100, serial: 0 }, dragCount: 0, dragging: false, frames: 0 };
}

export function motionPolicy(reduced: boolean, saveData: boolean, forcedColors: boolean) {
  const webgl = !saveData && !forcedColors;
  return { webgl, camera: webgl && !reduced, ambient: webgl && !reduced, physics: false };
}

export function lowerQuality(tier: QualityTier): QualityTier { return tier === 'high' ? 'medium' : 'low'; }
export function flightEase(progress: number) { const t = Math.max(0, Math.min(1, progress)); return t * t * (3 - 2 * t); }
export function landmarkFor(id: SectionId | '') { return world.landmarks.find(landmark => landmark.id === id); }
