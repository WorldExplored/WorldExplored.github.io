'use client';

import { measureConstruction } from './renderDiagnostics';

// Three.js renderer and material objects are imperative resources owned by Fiber.
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo, type MutableRefObject } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Color, DataTexture, LinearFilter, PlaneGeometry, RGBAFormat, ShaderMaterial, Vector2, Vector3, Vector4 } from 'three';
import { landDistance } from './terrain';
import { waterOpticsGLSL } from './waterOptics';
import { coastExposure, shorelineWaveGLSL } from './waves';
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
    p.y += sin(a) * .055 + sin(b) * .035 + sin(p.x * .095 + p.z * .13 + uTime * .64) * .13;
    vec2 slope = cos(a) * vec2(.39,.25) * .055 + cos(b) * vec2(-.24,.53) * .035 + cos(p.x * .095 + p.z * .13 + uTime * .64) * vec2(.095,.13) * .13;
    vec2 headland=p.xz+vec2(76.,36.);
    float exposure=exp(-dot(headland,headland)/900.);
    float h1=p.x*.34+p.z*.21+uTime*.84,h2=p.x*-.22+p.z*.42-uTime*.66;
    float swell=sin(h1)*.18+sin(h2)*.08;
    p.y+=exposure*swell;
    slope+=exposure*(cos(h1)*vec2(.34,.21)*.18+cos(h2)*vec2(-.22,.42)*.08-2.*headland/900.*swell);
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
  uniform float uDaylight;
  uniform float uDusk;
  uniform float uStorm;
  varying vec3 vWorld;
  varying vec3 vNormal;
  ${shorelineWaveGLSL}
  ${waterOpticsGLSL}
  float seaHash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float seaNoise(vec2 p){ vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(seaHash(i),seaHash(i+vec2(1.,0.)),f.x),mix(seaHash(i+vec2(0.,1.)),seaHash(i+1.),f.x),f.y); }
  float surfaceField(vec2 p){
    mat2 rotate=mat2(.8,-.6,.6,.8);
    float h=seaNoise(p*.38+vec2(uTime*.16,-uTime*.11))*.6;
    h+=seaNoise(rotate*p*1.07+vec2(-uTime*.23,uTime*.17))*.26;
    h+=seaNoise(p*2.73+vec2(uTime*.31,uTime*.09))*.11;
    return h;
  }
  float causticCell(vec2 p){
    vec2 cell=floor(p),f=fract(p);float first=10.,second=10.;
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
      vec2 q=vec2(float(x),float(y));
      vec2 offset=.5+.3*sin(uTime*.24+6.283*vec2(seaHash(cell+q),seaHash(cell+q+17.)));
      float d=length(q+offset-f);
      if(d<first){second=first;first=d;}else second=min(second,d);
    }
    return 1.-smoothstep(.025,.085,second-first);
  }
  void main() {
    vec2 p = vWorld.xz;
    vec3 view = normalize(cameraPosition - vWorld);
    float a = p.x * .39 + p.y * .25 + uTime;
    float b = p.x * -.24 + p.y * .53 - uTime * .75;
    vec2 slope = cos(a) * vec2(.39,.25) * .055 + cos(b) * vec2(-.24,.53) * .035 + cos(p.x * .095 + p.y * .13 + uTime * .64) * vec2(.095,.13) * .13;
    vec2 headland=p+vec2(76.,36.);
    float headlandExposure=exp(-dot(headland,headland)/900.);
    float h1=p.x*.34+p.y*.21+uTime*.84,h2=p.x*-.22+p.y*.42-uTime*.66;
    slope+=headlandExposure*(cos(h1)*vec2(.34,.21)*.18+cos(h2)*vec2(-.22,.42)*.08-2.*headland/900.*(sin(h1)*.18+sin(h2)*.08));
    vec3 n = normalize(vec3(-slope.x, 1., -slope.y));
    float closeDetail=1.-smoothstep(35.,150.,length(cameraPosition-vWorld));
    float h=surfaceField(p);
    vec2 fineSlope=vec2(surfaceField(p+vec2(.08,0.))-h,surfaceField(p+vec2(0.,.08))-h)/.08;
    n.xz -= fineSlope*.23*(.2+closeDetail*uDetail);
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
    float broad = sin(p.x * .19 + p.y * .22) * .035;
    vec2 coastUV = (p - uCoastBounds.xy) / uCoastBounds.zw;
    vec4 coastSample = texture2D(uCoast, clamp(coastUV, 0., 1.));
    float coast = coastSample.r * 64. - 32.;
    if (any(lessThan(coastUV, vec2(0.))) || any(greaterThan(coastUV, vec2(1.)))) coast = -32. - length(p - clamp(p, uCoastBounds.xy, uCoastBounds.xy+uCoastBounds.zw));
    float outsideField = length(p - clamp(p, uCoastBounds.xy, uCoastBounds.xy+uCoastBounds.zw));
    float offshoreDistance = coastSample.b * 128. + outsideField;
    float depth = opticalDepth(p, offshoreDistance);
    // Color darkens across a broader shelf than the optical transparency transition.
    float shallows = exp(-pow(depth, .65) * .075);
    float offshore = 1. - exp(-offshoreDistance / 95.);
    vec3 color = mix(mix(uDeep, uWater, .5 + broad), vec3(.012,.065,.12), offshore * .86);
    color = mix(color, vec3(.035,.69,.66), shallows * .89);
    vec3 surf = shoreWave(coast, p, uTime, coastSample.g);
    vec2 texel = vec2(1./640.,1./640.);
    vec2 coastGradient = vec2(texture2D(uCoast,coastUV+vec2(texel.x,0.)).r-texture2D(uCoast,coastUV-vec2(texel.x,0.)).r,texture2D(uCoast,coastUV+vec2(0.,texel.y)).r-texture2D(uCoast,coastUV-vec2(0.,texel.y)).r);
    n.xz += coastGradient / max(.0001,length(coastGradient)) * surf.z * .58;
    n = normalize(n);
    float fresnel = pow(1. - max(dot(view, n), 0.), 3.);
    float foam = surf.y;
    float localWake = 0.;
    if (age >= 0. && age < 2.8) localWake = exp(-pow((length(p-uRipple.xy)-age*2.1)/.7,2.)) * (1.-age/2.8);
    color = mix(color,vec3(.88,.99,.96),foam*.78);
    color += vec3(.32,.52,.48)*surf.x*.19 + vec3(.3,.4,.37)*localWake*.13;
    float caustic = 0.;
    float causticNear = 1.-smoothstep(12.,38.,length(cameraPosition-vWorld));
    if (shallows*causticNear > .02) caustic = causticCell(p*3.9+vec2(seaNoise(p*1.4),seaNoise(p*1.7+3.))*1.8)*.008*shallows*causticNear*uDetail;
    color = mix(color, uHorizon*.36, fresnel * .32) + caustic;
    color *= .19 + uDaylight * .81;
    vec3 sunsetWater = mix(vec3(.16,.075,.25),vec3(.72,.41,.19),pow(max(dot(normalize(vec3(uSunDirection.x,0.,uSunDirection.z)),normalize(vec3(view.x,0.,view.z))),0.),3.));
    color = mix(color, sunsetWater, uDusk * (.24 + fresnel * .28));
    color = mix(color, color * vec3(.59,.69,.78), uStorm * .62);
    float sun = pow(max(dot(reflect(-uSunDirection, n), view), 0.), 110.);
    color += uSunColor * sun * uSunIntensity * .14;
    float haze = smoothstep(uFogRange.x, uFogRange.y, length(cameraPosition - vWorld));
    // Marine haze retains the deep-water color instead of bleaching the horizon.
    color = mix(color, uFog, haze * .28);
    float viewCosine = clamp(dot(view,n),0.,1.);
    float absorption = 1. - exp(-depth * .085 / max(.08,viewCosine));
    float grazingReflection = pow(1. - viewCosine,5.);
    gl_FragColor = vec4(color, clamp(absorption + (1. - absorption) * grazingReflection + foam * .24, .06, .995));
    #include <colorspace_fragment>
  }
`;

const waterSunset = new Color('#ffc58a');
const waterDayHorizon = new Color(world.lighting.horizon);
const waterDuskHorizon = new Color('#ddb4a9');
const waterDayFog = new Color('#245675');
const waterStormFog = new Color('#365767');
const waterDuskFog = new Color('#504f76');

function updateWater(material: ShaderMaterial, state: SceneRuntime, paused: boolean) {
  if (!paused) {
    material.uniforms.uTime.value = state.elapsed * world.environment.waterSpeed;
    material.uniforms.uRipple.value.set(state.ripple.x, state.ripple.z, state.elapsed - state.ripple.time, state.ripple.serial);
  }
  material.uniforms.uSunDirection.value.fromArray(state.sunDirection);
  const weather = state.weather;
  material.uniforms.uDaylight.value = weather?.daylight ?? 1;
  material.uniforms.uDusk.value = weather?.dusk ?? 0;
  material.uniforms.uStorm.value = weather?.storm ?? 0;
  material.uniforms.uSunIntensity.value = (weather?.daylight ?? 1) * world.lighting.sunIntensity * (1 - (weather?.storm ?? 0) * .9);
  material.uniforms.uSunColor.value.set('#fff8df').lerp(waterSunset, weather?.dusk ?? 0);
  material.uniforms.uHorizon.value.set('#293a5a').lerp(waterDayHorizon, weather?.daylight ?? 1).lerp(waterDuskHorizon, (weather?.dusk ?? 0) * .75);
  material.uniforms.uFog.value.set('#101d35').lerp(waterDayFog, weather?.daylight ?? 1).lerp(waterDuskFog, (weather?.dusk ?? 0) * .8).lerp(waterStormFog, (weather?.storm ?? 0) * .75 * (weather?.daylight ?? 1));
}

function startRipple(state: SceneRuntime, x: number, z: number) {
  state.ripple.x = x;
  state.ripple.z = z;
  state.ripple.time = state.elapsed;
  state.ripple.serial++;
}

function coastTexture() {
  const width = 96; const height = 96; const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    const x = -100 + col / (width - 1) * 180; const z = -120 + row / (height - 1) * 180;
    const distance = landDistance(x,z);
    const value = Math.round(Math.max(0, Math.min(1, (distance + 32) / 64)) * 255); const index = (row * width + col) * 4;
    data[index] = value; data[index + 1] = Math.round(coastExposure(x,z,distance)*255); data[index + 2] = Math.round(Math.max(0, Math.min(1, -distance / 128)) * 255); data[index + 3] = 255;
  }
  const texture = new DataTexture(data, width, height, RGBAFormat); texture.minFilter = LinearFilter; texture.magFilter = LinearFilter; texture.needsUpdate = true; return texture;
}

export function Water({ runtime, paused, quality }: EnvironmentProps) {
  const detail = world.quality[quality].waterDetail;
  const invalidate = useThree(state => state.invalidate);
  const geometry = useMemo(() => {
    const segments = 192;
    return new PlaneGeometry(1600, 1600, segments, segments).rotateX(-Math.PI / 2);
  }, []);
  const material = useMemo(() => new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uCoast: { value: measureConstruction('coast-field', () => coastTexture()) },
      uCoastBounds: { value: new Vector4(-100, -120, 180, 180) },
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
      uDaylight: { value: 1 }, uDusk: { value: 0 }, uStorm: { value: 0 },
    },
  }), []);
  useEffect(() => {
    if (typeof Image === 'undefined') return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(image, 0, 0);
      const texture = material.uniforms.uCoast.value as DataTexture;
      texture.image = { data: new Uint8Array(context.getImageData(0, 0, image.width, image.height).data), width: image.width, height: image.height };
      texture.needsUpdate = true; invalidate();
    };
    image.src = '/coast-field.png';
    return () => { cancelled = true; image.onload = null; };
  }, [material, invalidate]);
  useEffect(() => () => { geometry.dispose(); material.uniforms.uCoast.value.dispose(); material.dispose(); }, [geometry, material]);
  useEffect(() => { material.uniforms.uDetail.value = detail; }, [material, detail]);
  useFrame(() => {
    updateWater(material, runtime.current, paused);
  });
  function ripple(event: ThreeEvent<MouseEvent>) {
    if (paused || event.delta > 5) return;
    startRipple(runtime.current, event.point.x, event.point.z);
  }
  return <mesh renderOrder={3} geometry={geometry} material={material} onClick={ripple} receiveShadow />;
}
