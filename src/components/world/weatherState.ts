import { Vector3 } from 'three';
import type { SceneRuntime, Vec3 } from '../../content/world';

export interface WeatherState {
  hour: number;
  daylight: number;
  dusk: number;
  night: number;
  storm: number;
  rain: number;
  wind: Vec3;
}

/** Weather and nesting use real active seconds; locomotion retains its bounded physics step. */
export function advanceSceneTime(runtime:Pick<SceneRuntime,'elapsed'|'activeElapsed'>,delta:number,paused:boolean){
  if(paused||!Number.isFinite(delta)||delta<=0)return;
  runtime.elapsed+=Math.min(delta,.05);
  runtime.activeElapsed+=delta;
}

export const WEATHER_CHANGE = 'aero-weather-change';
const easternClock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };

export function easternHour(date = new Date()) {
  const parts = easternClock.formatToParts(date);
  const value = (name: string) => Number(parts.find(part => part.type === name)?.value ?? 0);
  return value('hour') % 24 + value('minute') / 60 + value('second') / 3600;
}

export function daylightAt(hour: number, output = new Vector3()) {
  const phase = (hour - 6) * Math.PI / 12;
  return output.set(Math.cos(phase) * .55, Math.sin(phase) * .94, -.84).normalize();
}

export function daylightWeights(hour: number) {
  const elevation = Math.sin((hour - 6) * Math.PI / 12);
  const daylight = smooth((elevation + .07) / .30);
  const dusk = (1 - smooth(Math.abs(elevation) / .38)) * smooth((elevation + .23) / .23);
  const night = 1 - smooth((elevation + .13) / .20);
  return { daylight, dusk, night };
}

export const WIND_HOLD_SECONDS = 600;
export const WIND_TURN_SECONDS = 120;
const WIND_PERIOD = WIND_HOLD_SECONDS + WIND_TURN_SECONDS;
const windVelocities: Vec3[] = [];
const windOffsets: Vec3[] = [[0, 0, 0]];

function windVelocity(index: number) {
  while (windVelocities.length <= index) {
    const i = windVelocities.length;
    const heading = .48 + i * 1.37 + Math.sin(i * 1.19) * .23;
    const speed = .49 + random(i + 419) * .15;
    windVelocities.push([Math.cos(heading) * speed, 0, Math.sin(heading) * speed]);
  }
  return windVelocities[index];
}

/** Ten-minute prevailing winds turn gradually over two minutes, then hold again. */
export function windAt(seconds: number, output: Vec3 = [0, 0, 0]): Vec3 {
  const time = Math.max(0, seconds), index = Math.floor(time / WIND_PERIOD), age = time - index * WIND_PERIOD;
  const current = windVelocity(index), next = windVelocity(index + 1);
  const turn = smooth((age - WIND_HOLD_SECONDS) / WIND_TURN_SECONDS);
  output[0] = current[0] + (next[0] - current[0]) * turn;
  output[1] = 0;
  output[2] = current[2] + (next[2] - current[2]) * turn;
  return output;
}

/** Exact integral of the shared breeze; changing its heading never resets a cloud. */
export function windDisplacement(seconds: number, output = new Vector3()) {
  const time = Math.max(0, seconds), index = Math.floor(time / WIND_PERIOD), age = time - index * WIND_PERIOD;
  while (windOffsets.length <= index) {
    const i = windOffsets.length - 1, start = windOffsets[i], current = windVelocity(i), next = windVelocity(i + 1);
    windOffsets.push([start[0] + current[0] * WIND_PERIOD + (next[0] - current[0]) * WIND_TURN_SECONDS * .5, 0,
      start[2] + current[2] * WIND_PERIOD + (next[2] - current[2]) * WIND_TURN_SECONDS * .5]);
  }
  const current = windVelocity(index), next = windVelocity(index + 1), start = windOffsets[index];
  const t = clamp((age - WIND_HOLD_SECONDS) / WIND_TURN_SECONDS);
  const integral = WIND_TURN_SECONDS * (t * t * t - .5 * t * t * t * t);
  return output.set(start[0] + current[0] * age + (next[0] - current[0]) * integral, 0,
    start[2] + current[2] * age + (next[2] - current[2]) * integral);
}

function random(seed: number) { const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
export function stormSchedule(index: number) {
  return { arrival: 480 + Math.max(0, index) * 2400, rainSeconds: 300 + random(index + 819) * 300, approachSeconds: 110, departureSeconds: 130 };
}

export interface StormSample { arrival: number; rainSeconds: number; approachSeconds: number; departureSeconds: number; active: boolean; age: number; cover: number; rain: number; center: Vec3 }
export const STORM_ALTITUDE = 104;
export function createStormSample(): StormSample { return { arrival: 0, rainSeconds: 0, approachSeconds: 110, departureSeconds: 130, active: false, age: 0, cover: 0, rain: 0, center: [0, STORM_ALTITUDE, 0] }; }
const stormPosition=new Vector3(),stormAnchor=new Vector3();
export function stormAt(seconds: number, output = createStormSample()) {
  const index = Math.max(0, Math.floor((seconds - 480) / 2400));
  const arrival = 480 + index * 2400, rainSeconds = 300 + random(index + 819) * 300;
  const age = seconds - arrival, lifetime = 110 + rainSeconds + 130;
  const active = age >= 0 && age <= lifetime;
  const entering = smooth(age / 110), leaving = 1 - smooth((age - 110 - rainSeconds) / 130);
  const sampleTime = arrival + Math.max(0, Math.min(lifetime, age));
  windDisplacement(sampleTime, stormPosition);
  windDisplacement(arrival + 110 + rainSeconds * .5, stormAnchor); stormPosition.sub(stormAnchor);
  output.arrival = arrival; output.rainSeconds = rainSeconds; output.age = age; output.active = active;
  output.cover = active ? entering * leaving : 0;
  output.rain = active ? smooth((age - 110) / 28) * (1 - smooth((age - 110 - rainSeconds + 28) / 28)) : 0;
  output.center[0] = -24 + stormPosition.x; output.center[1] = STORM_ALTITUDE; output.center[2] = -42 + stormPosition.z;
  return output;
}

export function initialWeather(): WeatherState {
  const hour = easternHour();
  return { hour, ...daylightWeights(hour), storm: 0, rain: 0, wind: windAt(0) };
}

let override: number | null = null;
export function timeOverride() { return override; }
export function setTimeOverride(hour: number | null) {
  override = hour === null ? null : Math.max(0, Math.min(23.99, hour));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(WEATHER_CHANGE));
}
export function weatherQa() {
  if (typeof window === 'undefined' || !['localhost', '127.0.0.1'].includes(window.location.hostname)) return { time: null, storm: null };
  const query = new URLSearchParams(window.location.search);
  const hour = query.get('qaTime'); const storm = query.get('qaWeather');
  return { time: hour !== null && Number.isFinite(Number(hour)) ? Number(hour) : null, storm: storm === 'storm' ? 740 : storm === 'arrival' ? 525 : storm === 'departure' ? 1110 : null };
}
