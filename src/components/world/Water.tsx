'use client';

import { useEffect, useMemo, type MutableRefObject } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Color, PlaneGeometry, ShaderMaterial, Vector2, Vector3, Vector4 } from 'three';
import { world, type QualityTier, type SceneRuntime } from '../../content/world';

export interface EnvironmentProps {
  runtime: MutableRefObject<SceneRuntime>;
  paused: boolean;
  quality: QualityTier;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uDetail;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec3 p = position;
    float a = p.x * .39 + p.z * .25 + uTime;
    float b = p.x * -.24 + p.z * .53 - uTime * .75;
    float c = p.x * 1.2 + p.z * .71 + uTime * 1.3;
    p.y += sin(a) * .055 + sin(b) * .035;
    vec2 slope = cos(a) * vec2(.39,.25) * .055 + cos(b) * vec2(-.24,.53) * .035;
    if (uDetail > .5) {
      p.y += sin(c) * .013 * uDetail;
      slope += cos(c) * vec2(1.2,.71) * .013 * uDetail;
    }
    vNormal = normalize(vec3(-slope.x, 1., -slope.y));
    vWorld = (modelMatrix * vec4(p, 1.)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uDetail;
  uniform vec4 uRipple;
  uniform vec3 uWater;
  uniform vec3 uDeep;
  uniform vec3 uHorizon;
  uniform vec3 uFog;
  uniform vec2 uFogRange;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec2 p = vWorld.xz;
    vec3 view = normalize(cameraPosition - vWorld);
    vec3 n = vNormal;
    if (uDetail > .5) n.xz += vec2(sin(p.x * 5.7 + p.y * 3.1 + uTime * 1.2), cos(p.x * 3.4 - p.y * 5.2 - uTime)) * .017 * uDetail;
    float age = uRipple.z;
    if (age >= 0. && age < 2.8) {
      vec2 offset = p - uRipple.xy;
      float radius = length(offset);
      float wave = radius - age * 2.1;
      float spread = .5 + age * .22;
      float envelope = exp(-wave * wave / (spread * spread));
      float amplitude = .055 * pow(1. - age / 2.8, 2.) * smoothstep(0., .1, age);
      float slope = amplitude * envelope * (7.5 * cos(wave * 7.5) - 2. * wave / (spread * spread) * sin(wave * 7.5));
      n.xz -= offset / max(radius, .25) * slope;
    }
    n = normalize(n);
    float fresnel = pow(1. - max(dot(view, n), 0.), 3.);
    float caustic = 0.;
    {
      caustic = sin(p.x * 2.4 + sin(p.y * 2.1 + uTime * .3)) * sin(p.y * 2.3 - sin(p.x * 1.7 - uTime * .4));
      caustic = pow(max(caustic, 0.), 12.) * .055 * uDetail;
    }
    float broad = sin(p.x * .19 + p.y * .22) * .035;
    vec3 color = mix(uDeep, uWater, .78 + broad);
    color = mix(color, uHorizon, fresnel * .52) + caustic;
    float sun = pow(max(dot(reflect(-uSunDirection, n), view), 0.), 110.);
    color += uSunColor * sun * uSunIntensity * .35;
    float haze = smoothstep(uFogRange.x, uFogRange.y, length(cameraPosition - vWorld));
    color = mix(color, uFog, haze);
    gl_FragColor = vec4(color, 1.);
    #include <colorspace_fragment>
  }
`;

function updateWater(material: ShaderMaterial, state: SceneRuntime) {
  material.uniforms.uTime.value = state.elapsed * world.environment.waterSpeed;
  material.uniforms.uRipple.value.set(state.ripple.x, state.ripple.z, state.elapsed - state.ripple.time, state.ripple.serial);
}

function startRipple(state: SceneRuntime, x: number, z: number) {
  state.ripple.x = x;
  state.ripple.z = z;
  state.ripple.time = state.elapsed;
  state.ripple.serial++;
}

export function Water({ runtime, paused, quality }: EnvironmentProps) {
  const detail = world.quality[quality].waterDetail;
  const geometry = useMemo(() => {
    const segments = quality === 'high' ? 96 : quality === 'medium' ? 64 : 40;
    return new PlaneGeometry(480, 480, segments, segments).rotateX(-Math.PI / 2);
  }, [quality]);
  const material = useMemo(() => new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uDetail: { value: detail },
      uRipple: { value: new Vector4(0, 0, 100, 0) },
      uWater: { value: new Color(world.lighting.water) },
      uDeep: { value: new Color(world.lighting.deepWater) },
      uHorizon: { value: new Color(world.lighting.horizon) },
      uFog: { value: new Color(world.lighting.fogColor) },
      uFogRange: { value: new Vector2(world.lighting.fogNear, world.lighting.fogFar) },
      uSunDirection: { value: new Vector3(...world.lighting.sunPosition).normalize() },
      uSunColor: { value: new Color(world.lighting.sunColor) },
      uSunIntensity: { value: world.lighting.sunIntensity },
    },
  }), [detail]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame(() => {
    if (paused) return;
    updateWater(material, runtime.current);
  });
  function ripple(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    if (paused || event.delta > 5) return;
    startRipple(runtime.current, event.point.x, event.point.z);
  }
  return <mesh geometry={geometry} material={material} onClick={ripple} receiveShadow />;
}
