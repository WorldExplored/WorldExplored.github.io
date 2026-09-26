'use client';

/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BackSide, Color, Vector3, type DirectionalLight, type HemisphereLight, type ShaderMaterial } from 'three';
import { world, type SceneRuntime } from '../../content/world';
import { daylightAt, daylightWeights, easternHour, initialWeather, timeOverride, weatherQa, windAt, stormAt, createStormSample, WEATHER_CHANGE, type WeatherState } from './weatherState';

const horizonColors = {
  day: new Color('#94c9d9'), night: new Color('#344c68'),
  dusk: new Color('#e8b18e'), storm: new Color('#859ba8'),
};
/** Shared by sky, distant haze and water: no pale seam along the ocean horizon. */
export function setSkyHorizon(output: Color, weather: Pick<WeatherState, 'daylight' | 'dusk' | 'storm'>) {
  return output.copy(horizonColors.night).lerp(horizonColors.day, weather.daylight)
    .lerp(horizonColors.dusk, weather.dusk * .9).lerp(horizonColors.storm, weather.storm * .76 * weather.daylight);
}

export function nightEnvironmentLevels(daylight: number, storm: number, output = { hemisphere: 0, environment: 0 }) {
  output.hemisphere = .31 + daylight * .26 + storm * .035;
  output.environment = Math.max(.18, .22 + daylight * .52 - storm * .12);
  return output;
}

export const skyFragmentShader = `uniform vec3 top;uniform vec3 bottom;uniform vec3 sun;uniform vec3 sunColor;uniform float sunStrength;uniform float dusk;varying vec3 direction;
  void main(){
    vec3 ray=normalize(direction);float alignment=max(dot(ray,sun),0.);
    vec3 sky=mix(bottom,top,smoothstep(.005,.48,ray.y));
    // The disk and the one directional light use the exact same world vector.
    // Preserve a crisp sunset even when the daylight weight is almost zero.
    float lowSun=1.-smoothstep(.22,.65,sun.y);
    float disk=smoothstep(cos(.019),cos(.013),alignment);
    float aboveHorizon=smoothstep(-.008,.003,ray.y);
    float aureole=pow(alignment,180.)*.13;
    sky+=sunColor*pow(alignment,24.)*dusk*.045*aboveHorizon;
    sky=mix(sky,sunColor*1.15,clamp((disk+aureole)*sunStrength*lowSun*aboveHorizon,0.,1.));
    gl_FragColor=vec4(sky,1.);\n#include <colorspace_fragment>\n}`;

export function Sky({ runtime }: { runtime: MutableRefObject<SceneRuntime> }) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ top: { value: new Color() }, bottom: { value: new Color() }, sunColor: { value: new Color() }, sun: { value: new Vector3() }, sunStrength: { value: 1 }, dusk: { value: 0 } }), []);
  const palette = useMemo(() => ({ day: new Color('#087bd8'), night: new Color('#111e39'), dusk: new Color('#66538f'), gold: new Color('#edb38b'), overcast: new Color('#728a9e') }), []);
  useFrame(() => {
    const weather = runtime.current.weather;
    const current = material.current?.uniforms;
    if (!current) return;
    current.sun.value.fromArray(runtime.current.sunDirection);
    current.top.value.copy(palette.night).lerp(palette.day, weather.daylight).lerp(palette.dusk, weather.dusk * .67).lerp(palette.overcast, weather.storm * .74 * weather.daylight);
    setSkyHorizon(current.bottom.value, weather);
    current.sunColor.value.set('#fff6d3').lerp(palette.gold, weather.dusk);
    current.sunStrength.value = 1 - weather.storm * .96;
    current.dusk.value = weather.dusk;
  });
  return <mesh name="world-sky" raycast={() => undefined}><sphereGeometry args={[900, 32, 24]}/><shaderMaterial ref={material} side={BackSide} depthWrite={false} uniforms={uniforms}
    vertexShader={'varying vec3 direction;void main(){direction=(modelMatrix*vec4(position,1.)).xyz-cameraPosition;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}' }
    fragmentShader={skyFragmentShader}/></mesh>;
}

export function WeatherLighting({ runtime, shadows, paused }: { runtime: MutableRefObject<SceneRuntime>; shadows: boolean; paused: boolean }) {
  const light = useRef<DirectionalLight>(null);
  const ambient = useRef<HemisphereLight>(null);
  const stormSample = useMemo(() => createStormSample(), []);
  const levels = useMemo(() => ({ hemisphere: 0, environment: 0 }), []);
  const direction = useMemo(() => new Vector3(), []);
  const colors = useMemo(() => ({ white: new Color('#fff8df'), sunset: new Color('#ffc58a'), day: new Color('#9fcbdc'), night: new Color('#829bc9'), overcast: new Color('#bdcbd9') }), []);
  const qa = useMemo(() => weatherQa(), []);
  const clock = useRef({ at: -Infinity, hour: 12 });
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refresh = () => invalidate();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener(WEATHER_CHANGE, refresh);
    return () => { window.clearInterval(timer); window.removeEventListener(WEATHER_CHANGE, refresh); };
  }, [invalidate]);
  useFrame(({ camera, controls, scene }) => {
    const weather = runtime.current.weather ?? (runtime.current.weather = initialWeather());
    const now=Date.now();
    if (now - clock.current.at > 15000) clock.current = { at: now, hour: easternHour() };
    weather.hour = timeOverride() ?? qa.time ?? clock.current.hour;
    Object.assign(weather, daylightWeights(weather.hour));
    const weatherTime=qa.storm ?? runtime.current.activeElapsed;
    const storm = stormAt(weatherTime,stormSample);
    weather.storm = storm.cover; weather.rain = paused ? 0 : storm.rain;
    windAt(weatherTime, weather.wind);
    daylightAt(weather.hour, direction); direction.toArray(runtime.current.sunDirection);
    nightEnvironmentLevels(weather.daylight, weather.storm, levels);
    if (ambient.current) {
      ambient.current.color.copy(colors.night).lerp(colors.day, weather.daylight).lerp(colors.overcast, weather.storm * .6);
      ambient.current.intensity = levels.hemisphere;
    }
    scene.environmentIntensity = levels.environment;
    if (scene.fog) setSkyHorizon(scene.fog.color, weather);
    if (!light.current) return;
    light.current.intensity = (2.55 * weather.daylight + .45 * weather.dusk) * (1 - weather.storm * .79);
    light.current.color.copy(colors.white).lerp(colors.sunset, weather.dusk);
    light.current.castShadow = shadows && direction.y > .035 && weather.storm < .96;
    const target = (controls as unknown as { target?: Vector3 } | null)?.target;
    const extent = target ? Math.max(14, Math.min(95, camera.position.distanceTo(target) * .8)) : 80;
    const texel = extent / 1024;
    light.current.target.position.set(Math.round((target?.x ?? -6) / texel) * texel, 1, Math.round((target?.z ?? -24) / texel) * texel);
    light.current.position.copy(direction).multiplyScalar(260).add(light.current.target.position);
    light.current.target.updateMatrixWorld();
    const shadow = light.current.shadow.camera;
    shadow.left = shadow.bottom = -extent; shadow.right = shadow.top = extent;
    shadow.near = 130; shadow.far = 390; shadow.updateProjectionMatrix();
  }, -1.5);
  return <>
    <hemisphereLight ref={ambient} args={[world.lighting.ambientSky, '#36594b', .55]}/>
    <directionalLight name="sunlight" ref={light} position={[-80, 180, -100]} intensity={2.55} color="#fff8df" castShadow={shadows} shadow-mapSize={[2048, 2048]} shadow-normalBias={.025} shadow-bias={-.00015}/>
  </>;
}
