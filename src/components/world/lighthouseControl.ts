import { WEATHER_CHANGE } from './weatherState';

export type LighthouseMode = 'auto' | 'on' | 'off';
export const LIGHTHOUSE_RISE = 7;
export const LIGHTHOUSE_LANTERN_Y = 6 + LIGHTHOUSE_RISE;
let mode: LighthouseMode = 'auto';
export function lighthouseMode() { return mode; }
export function setLighthouseMode(value: LighthouseMode) {
  mode = value;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(WEATHER_CHANGE));
}
export function lighthouseBrightness(night: number) {
  return mode === 'on' ? 1 : mode === 'off' ? 0 : Math.max(0, Math.min(1, night));
}

export function nightLightingLevel(weather: {night:number;dusk?:number}) { return Math.max(weather.night, (weather.dusk??0)*.7); }
