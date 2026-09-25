'use client';

/* Three.js frame callbacks mutate scene objects and the shared runtime ref, outside React rendering. */
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { BackSide, Color, Vector3, Vector2, Raycaster, type DirectionalLight } from 'three';
import { world, type SceneRuntime, type QualityTier, type WorldProps } from '@/content/world';
import { SURFACES_READY } from './surfaceMaterials';
import { CameraDirector } from './CameraDirector';
import { intersectTerrainRay } from './cameraControls';
import { Landmark } from './Landmark';
import { LandmarkModel } from './LandmarkModels';
import { AmbientSystem } from './AmbientSystem';
import { CityVentilation } from './CityVentilation';
import { EcoCity } from './EcoCity';
import { ReefLife } from './ReefLife';
import { MarineVisitors } from './MarineVisitors';
import { DolphinLife } from './DolphinLife';
import { ReefHabitat } from './ReefHabitatScene';
import { CoastalLife } from './CoastalLife';
import { Flora } from './Flora';
import { HistoryFlowerBorder } from './CivicLandmarks';
import { Wildlife } from './Wildlife';
import { ShoreImpacts } from './ShoreImpacts';
import { LighthouseAccess } from './LighthouseAccess';
import { Bridges } from './Bridges';
import { GardenRover } from './GardenRover';
import { DockEcology } from './DockEcology';
import { Seaweed } from './Seaweed';
import { BenthicLife } from './BenthicLife';
import { CityPathEdges } from './CityPathEdges';
import { Water } from './Water';
import { QualityController } from './QualityController';
import { ReflectiveObject } from './ReflectiveObject';
import { NatureResponses } from './NatureResponses';

function SceneClock({ runtime, paused }: { runtime: MutableRefObject<SceneRuntime>; paused: boolean }) {
  useFrame((_, delta) => {
    runtime.current.frames++;
    if (!paused) runtime.current.elapsed += Math.min(delta, 0.05);
  }, -2);
  return null;
}

export function daylightDirectionAt(elapsed: number, result = new Vector3()) {
  const phase=elapsed*Math.PI/720;
  return result.set(-.54+Math.sin(phase)*.18,.42+Math.cos(phase*.72)*.08,-.78+Math.sin(phase*.43)*.08).normalize();
}

function Sky({runtime}:{runtime:MutableRefObject<SceneRuntime>}) {
  const uniforms = useMemo(() => ({ top: { value: new Color(world.lighting.skyTop) }, bottom: { value: new Color(world.lighting.horizon) }, sun: { value: new Vector3(...world.lighting.sunPosition).normalize() } }), []);
  const colors=useMemo(()=>({morning:new Color('#167adf'),noon:new Color('#005cdd'),horizon:new Color(world.lighting.horizon),bright:new Color('#a5e9ef')}),[]);
  useFrame(()=>{uniforms.sun.value.fromArray(runtime.current.sunDirection);const lift=Math.max(0,Math.min(1,(uniforms.sun.value.y-.28)/.32));uniforms.top.value.copy(colors.morning).lerp(colors.noon,lift);uniforms.bottom.value.copy(colors.horizon).lerp(colors.bright,lift*.32);});
  return <mesh><sphereGeometry args={[900, 32, 24]} /><shaderMaterial side={BackSide} depthWrite={false} uniforms={uniforms}
    vertexShader={'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}' }
    fragmentShader={'uniform vec3 top;uniform vec3 bottom;uniform vec3 sun;varying vec3 direction;void main(){vec3 ray=normalize(direction);float h=ray.y;float light=max(dot(ray,sun),0.);vec3 sky=mix(bottom,top,smoothstep(-.02,.13,h));sky+=vec3(1.,.98,.9)*(pow(light,14000.)*2.5+pow(light,450.)*.06);gl_FragColor=vec4(sky,1.);\n #include <colorspace_fragment>\n}'} />
  </mesh>;
}

function Daylight({runtime,shadows}:{runtime:MutableRefObject<SceneRuntime>;shadows:boolean}){
  const light = useRef<DirectionalLight>(null);
  const direction = useMemo(() => new Vector3(), []);
  useFrame(({ camera, controls }) => {
    daylightDirectionAt(runtime.current.elapsed, direction); runtime.current.sunDirection = direction.toArray();
    if (!light.current) return;
    const target = (controls as unknown as { target?: Vector3 } | null)?.target;
    const extent = target ? Math.max(14, Math.min(95, camera.position.distanceTo(target) * .8)) : 80;
    const texel = extent / 1024;
    light.current.target.position.set(Math.round((target?.x ?? -6) / texel) * texel, 1, Math.round((target?.z ?? -24) / texel) * texel);
    light.current.position.copy(direction).multiplyScalar(260).add(light.current.target.position);
    light.current.target.updateMatrixWorld();
    const shadow = light.current.shadow.camera;
    shadow.left = shadow.bottom = -extent; shadow.right = shadow.top = extent;
    shadow.near = 130; shadow.far = 390; shadow.updateProjectionMatrix();
  });
  return <directionalLight ref={light} position={new Vector3(...runtime.current.sunDirection).multiplyScalar(260)} intensity={world.lighting.sunIntensity} color={world.lighting.sunColor} castShadow={shadows} shadow-mapSize={[2048,2048]} shadow-camera-left={-52} shadow-camera-right={76} shadow-camera-top={42} shadow-camera-bottom={-20} shadow-camera-near={105} shadow-camera-far={330} shadow-normalBias={.025} shadow-bias={-.00015}/>;
}

function Labels({ runtime, mobile }: { runtime: MutableRefObject<SceneRuntime>; mobile: boolean }) {
  const { size, camera } = useThree();
  const labels = useRef<{ element: HTMLElement; point: Vector3; id: string }[]>([]);
  const point = useMemo(() => new Vector3(), []);
  const sculpture = useRef<HTMLElement | null>(null);
  const identity = useRef<HTMLElement | null>(null);
  useEffect(() => {
    sculpture.current = document.querySelector('[data-sculpture-control]');
    identity.current = document.querySelector('[data-world-identity]');
    labels.current = world.landmarks.flatMap(landmark => {
      const element = document.querySelector<HTMLElement>(`[data-landmark="${landmark.id}"]`);
      return element ? [{ element, point: new Vector3(...landmark.label), id: landmark.id }] : [];
    });
    return () => labels.current.forEach(({ element }) => { element.style.removeProperty('transform'); element.style.removeProperty('opacity'); });
  }, []);
  useFrame(() => {
    if (identity.current) {
      const x = runtime.current.pointerActive ? runtime.current.pointer[0] * 5 : 0;
      const y = runtime.current.pointerActive ? runtime.current.pointer[1] * -3 : 0;
      identity.current.style.transform = `perspective(900px) rotateY(-4deg) translate3d(${x}px,${y}px,0)`;
    }
    if (mobile) return;
    if (sculpture.current) {
      point.set(-10, 2.5, 23).project(camera);
      sculpture.current.style.transform = `translate3d(${(point.x * .5 + .5) * size.width}px,${(-point.y * .5 + .5) * size.height}px,0) translate(-50%,-50%)`;
    }
    for (const label of labels.current) {
      point.copy(label.point).project(camera);
      const x = (point.x * 0.5 + 0.5) * size.width;
      const y = (-point.y * 0.5 + 0.5) * size.height;
      label.element.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-100%)`;
      label.element.style.visibility = point.z > 1 || Math.abs(point.x) > 1.1 ? 'hidden' : '';
      label.element.style.opacity = '';
      label.element.dataset.hovered = String(runtime.current.hovered === label.id);
    }
  });
  return null;
}

function PointerGround({ runtime }: { runtime: MutableRefObject<SceneRuntime> }) {
  const math = useMemo(() => ({ ray: new Raycaster(), pointer: new Vector2(), hit: new Vector3() }), []);
  useFrame(({ camera }) => {
    const state = runtime.current;
    if (!state.pointerActive) { state.pointerWorld[0] = 10000; state.pointerWorld[2] = 10000; return; }
    math.pointer.fromArray(state.pointer);
    math.ray.setFromCamera(math.pointer, camera);
    const hit = intersectTerrainRay(math.ray.ray, math.hit) ? math.hit : null;
    state.pointerWorld[0] = hit ? hit.x : 10000;
    state.pointerWorld[1] = 0;
    state.pointerWorld[2] = hit ? hit.z : 10000;
  }, -1);
  return null;
}

export function AeroWorld(props: WorldProps & { runtime: MutableRefObject<SceneRuntime>; tier: QualityTier; onTier: (tier: QualityTier) => void; stage?: number; onPlantsReady?: () => void }) {
  const { runtime, tier, onTier, paused, mobile, destination, onNavigate } = props;
  const stopped = paused;
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => { const refresh = () => invalidate(); window.addEventListener(SURFACES_READY, refresh); return () => window.removeEventListener(SURFACES_READY, refresh); }, [invalidate]);
  const stage = props.stage ?? 5;
  const reflections = useMemo(() => (<Environment frames={1} resolution={128}>
      <Lightformer position={[0, 10, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[20, 20, 1]} intensity={.65} color="#c2e9ff" />
      <Lightformer position={[-12, 8, 10]} scale={[7, 18, 1]} intensity={1.5} color="#ffffff" />
      <Lightformer position={[14, 3, -8]} rotation={[0, Math.PI, 0]} scale={[15, 10, 1]} intensity={.7} color="#128fae" />
    </Environment>), []);
  return <>
    <SceneClock runtime={runtime} paused={stopped} />
    <Sky runtime={runtime} />
    <fog attach="fog" args={[world.lighting.fogColor, world.lighting.fogNear, world.lighting.fogFar]} />
    <hemisphereLight args={[world.lighting.ambientSky, world.lighting.ambientGround, world.lighting.ambientIntensity]} />
    <Daylight runtime={runtime} shadows={world.quality[tier].shadows}/>
    {reflections}

    {stage >= 1 && <EcoCity runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 3 && <CoastalLife runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 3 && <ReefHabitat runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 4 && <MarineVisitors runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 3 && <DolphinLife runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 3 && <ReefLife runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 3 && <CityVentilation runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 3 && <DockEcology />}
    {stage >= 3 && <Seaweed runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 3 && <BenthicLife quality={tier} />}
    {stage >= 3 && <CityPathEdges />}
    {stage >= 4 && <HistoryFlowerBorder />}
    {stage >= 4 && <Flora runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 4 && <Wildlife runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 5 && <GardenRover runtime={runtime} paused={stopped} quality={tier} active={false} />}
    {stage >= 5 && <ShoreImpacts runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 5 && <NatureResponses runtime={runtime} paused={stopped}/>}
    <Bridges />
    <LighthouseAccess />
    <Water runtime={runtime} paused={stopped} quality={tier} />
    <AmbientSystem onPlantsReady={props.onPlantsReady} stage={stage} runtime={runtime} paused={stopped} quality={tier} />
    {world.landmarks.map(config => <Landmark key={config.id} config={config} runtime={runtime} paused={stopped} onNavigate={onNavigate}><LandmarkModel id={config.id} active={destination === config.id} runtime={runtime} paused={stopped} quality={tier} /></Landmark>)}
    <ReflectiveObject position={[-10, 2.5, 23]} runtime={runtime} paused={stopped} quality={tier} command={props.rotationCommand} />
    <PointerGround runtime={runtime} />
    <CameraDirector {...props} />
    <Labels runtime={runtime} mobile={mobile} />
    <QualityController mobile={mobile} runtime={runtime} tier={tier} onTier={onTier} paused={stopped} />
  </>;
}
