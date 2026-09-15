'use client';

// Three.js renderer and material objects are imperative resources owned by Fiber.
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo, type MutableRefObject } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Color, DataTexture, LinearFilter, PlaneGeometry, RGBAFormat, ShaderMaterial, Vector2, Vector3, Vector4 } from 'three';
import { landDistance } from './terrain';
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
  uniform sampler2D uCoast;
  uniform vec4 uCoastBounds;
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
    float a = p.x * .39 + p.y * .25 + uTime;
    float b = p.x * -.24 + p.y * .53 - uTime * .75;
    vec2 slope = cos(a) * vec2(.39,.25) * .055 + cos(b) * vec2(-.24,.53) * .035;
    vec3 n = normalize(vec3(-slope.x, 1., -slope.y));
    if (uDetail > .5) n.xz += vec2(sin(p.x * 5.7 + p.y * 3.1 + uTime * 1.2), cos(p.x * 3.4 - p.y * 5.2 - uTime)) * .006 * uDetail * (1. - smoothstep(25., 80., length(cameraPosition - vWorld)));
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
    vec2 coastUV = (p - uCoastBounds.xy) / uCoastBounds.zw;
    float coast = texture2D(uCoast, clamp(coastUV, 0., 1.)).r * 64. - 32.;
    if (any(lessThan(coastUV, vec2(0.))) || any(greaterThan(coastUV, vec2(1.)))) coast = -32.;
    float shallows = 1. - smoothstep(0., 7., -coast);
    vec3 color = mix(uDeep, uWater, .64 + broad);
    color = mix(color, vec3(.08,.72,.66), shallows * .78);
    float foam = exp(-pow((coast + .22 + sin(p.x * 1.1 + p.y * .9 + uTime) * .13) / .28, 2.));
    float localWake = 0.;
    if (age >= 0. && age < 2.8) localWake = exp(-pow((length(p-uRipple.xy)-age*2.1)/.7,2.)) * (1.-age/2.8);
    color += vec3(.50,.65,.56) * foam * (.20 + localWake * .34);
    color = mix(color, uHorizon, fresnel * .25) + caustic;
    float sheen = pow(max(dot(reflect(-normalize(vec3(-.4,.8,.25)),n), view),0.),24.);
    color += vec3(.35,.55,.6) * sheen * .23;
    float sun = pow(max(dot(reflect(-uSunDirection, n), view), 0.), 110.);
    color += uSunColor * sun * uSunIntensity * .14;
    float haze = smoothstep(uFogRange.x, uFogRange.y, length(cameraPosition - vWorld));
    color = mix(color, uFog, haze);
    gl_FragColor = vec4(color, mix(.985, .70, shallows));
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

function coastTexture() {
  const width = 512; const height = 640; const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    const distance = landDistance(-70 + col / (width - 1) * 140, -115 + row / (height - 1) * 160);
    const value = Math.round(Math.max(0, Math.min(1, (distance + 32) / 64)) * 255); const index = (row * width + col) * 4;
    data[index] = value; data[index + 1] = value; data[index + 2] = value; data[index + 3] = 255;
  }
  const texture = new DataTexture(data, width, height, RGBAFormat); texture.minFilter = LinearFilter; texture.magFilter = LinearFilter; texture.needsUpdate = true; return texture;
}

export function Water({ runtime, paused, quality }: EnvironmentProps) {
  const detail = world.quality[quality].waterDetail;
  const geometry = useMemo(() => {
    const segments = 96;
    return new PlaneGeometry(1600, 1600, segments, segments).rotateX(-Math.PI / 2);
  }, []);
  const material = useMemo(() => new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uCoast: { value: coastTexture() },
      uCoastBounds: { value: new Vector4(-70, -115, 140, 160) },
      uDetail: { value: 1 },
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
  }), []);
  useEffect(() => () => { geometry.dispose(); material.uniforms.uCoast.value.dispose(); material.dispose(); }, [geometry, material]);
  useEffect(() => { material.uniforms.uDetail.value = detail; }, [material, detail]);
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
