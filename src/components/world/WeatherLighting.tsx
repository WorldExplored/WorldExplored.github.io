'use client';

/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BackSide, Color, Vector3, type DirectionalLight, type HemisphereLight } from 'three';
import { world, type SceneRuntime } from '../../content/world';
import { daylightAt, daylightWeights, easternHour, initialWeather, timeOverride, weatherQa, windAt, stormAt, WEATHER_CHANGE } from './weatherState';

export function Sky({ runtime }: { runtime: MutableRefObject<SceneRuntime> }) {
  const uniforms = useMemo(() => ({ top: { value: new Color() }, bottom: { value: new Color() }, sunColor: { value: new Color() }, sun: { value: new Vector3() }, sunStrength: { value: 1 }, dusk: { value: 0 } }), []);
  const palette = useMemo(() => ({ day: new Color('#087bd8'), horizon: new Color('#a8e8eb'), night: new Color('#09152f'), nightHorizon: new Color('#28375b'), dusk: new Color('#66538f'), gold: new Color('#ffd09b'), overcast: new Color('#728a9e'), stormHorizon: new Color('#b2c4ca') }), []);
  useFrame(() => {
    const weather = runtime.current.weather;
    uniforms.sun.value.fromArray(runtime.current.sunDirection);
    uniforms.top.value.copy(palette.night).lerp(palette.day, weather.daylight).lerp(palette.dusk, weather.dusk * .67).lerp(palette.overcast, weather.storm * .74 * weather.daylight);
    uniforms.bottom.value.copy(palette.nightHorizon).lerp(palette.horizon, weather.daylight).lerp(palette.gold, weather.dusk * .9).lerp(palette.stormHorizon, weather.storm * .76 * weather.daylight);
    uniforms.sunColor.value.set('#fff6d3').lerp(palette.gold, weather.dusk);
    uniforms.sunStrength.value = (1 - weather.night) * (1 - weather.storm * .94);
    uniforms.dusk.value = weather.dusk;
  });
  return <mesh name="world-sky" raycast={() => undefined}><sphereGeometry args={[900, 32, 24]}/><shaderMaterial side={BackSide} depthWrite={false} uniforms={uniforms}
    vertexShader={'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}' }
    fragmentShader={`uniform vec3 top;uniform vec3 bottom;uniform vec3 sun;uniform vec3 sunColor;uniform float sunStrength;uniform float dusk;varying vec3 direction;
      void main(){vec3 ray=normalize(direction);float alignment=max(dot(ray,sun),0.);vec3 sky=mix(bottom,top,smoothstep(-.04,.48,ray.y));
      sky+=sunColor*sunStrength*(pow(alignment,12000.)*2.4+pow(alignment,55.)*(.055+dusk*.18));
      gl_FragColor=vec4(sky,1.);\n#include <colorspace_fragment>\n}`}/></mesh>;
}

export function WeatherLighting({ runtime, shadows, paused }: { runtime: MutableRefObject<SceneRuntime>; shadows: boolean; paused: boolean }) {
  const light = useRef<DirectionalLight>(null);
  const ambient = useRef<HemisphereLight>(null);
  const direction = useMemo(() => new Vector3(), []);
  const colors = useMemo(() => ({ white: new Color('#fff8df'), sunset: new Color('#ffc58a'), day: new Color('#c4eaff'), night: new Color('#829bc9'), overcast: new Color('#bdcbd9') }), []);
  const qa = useMemo(() => weatherQa(), []);
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
    weather.hour = timeOverride() ?? qa.time ?? easternHour();
    Object.assign(weather, daylightWeights(weather.hour));
    const weatherTime=qa.storm ?? runtime.current.activeElapsed;
    const storm = stormAt(weatherTime);
    weather.storm = storm.cover; weather.rain = paused ? 0 : storm.rain;
    windAt(weatherTime, weather.wind);
    daylightAt(weather.hour, direction); direction.toArray(runtime.current.sunDirection);
    if (ambient.current) {
      ambient.current.color.copy(colors.night).lerp(colors.day, weather.daylight).lerp(colors.overcast, weather.storm * .6);
      ambient.current.intensity = .26 + weather.daylight * .35 + weather.storm * .12;
    }
    scene.environmentIntensity = Math.max(.06, .10 + weather.daylight * .64 - weather.storm * .15);
    if (scene.fog) scene.fog.color.set('#293a5a').lerp(colors.day, weather.daylight).lerp(colors.sunset, weather.dusk * .67).lerp(colors.overcast, weather.storm * .75 * weather.daylight);
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
