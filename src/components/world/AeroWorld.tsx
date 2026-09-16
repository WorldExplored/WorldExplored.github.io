'use client';

/* Three.js frame callbacks mutate scene objects and the shared runtime ref, outside React rendering. */
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { BackSide, Color, Vector3, Vector2, Raycaster } from 'three';
import { world, type SceneRuntime, type QualityTier, type WorldProps } from '@/content/world';
import { CameraDirector } from './CameraDirector';
import { intersectTerrainRay } from './cameraControls';
import { Landmark } from './Landmark';
import { LandmarkModel } from './LandmarkModels';
import { AmbientSystem } from './AmbientSystem';
import { EcoCity } from './EcoCity';
import { CoastalLife } from './CoastalLife';
import { Flora } from './Flora';
import { Wildlife } from './Wildlife';
import { ShoreImpacts } from './ShoreImpacts';
import { Bridges } from './Bridges';
import { GardenRover } from './GardenRover';
import { Seaweed } from './Seaweed';
import { Water } from './Water';
import { QualityController } from './QualityController';
import { ReflectiveObject } from './ReflectiveObject';

function SceneClock({ runtime, paused }: { runtime: MutableRefObject<SceneRuntime>; paused: boolean }) {
  useFrame((_, delta) => {
    runtime.current.frames++;
    if (!paused) runtime.current.elapsed += Math.min(delta, 0.05);
  }, -2);
  return null;
}

function Sky() {
  const uniforms = useMemo(() => ({ top: { value: new Color(world.lighting.skyTop) }, bottom: { value: new Color(world.lighting.horizon) }, sun: { value: new Vector3(...world.lighting.sunPosition).normalize() } }), []);
  return <mesh><sphereGeometry args={[900, 32, 24]} /><shaderMaterial side={BackSide} depthWrite={false} uniforms={uniforms}
    vertexShader={'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}' }
    fragmentShader={'uniform vec3 top;uniform vec3 bottom;uniform vec3 sun;varying vec3 direction;void main(){vec3 ray=normalize(direction);float h=ray.y;float light=max(dot(ray,sun),0.);vec3 sky=mix(bottom,top,smoothstep(-.02,.13,h));sky+=vec3(1.,.98,.9)*(pow(light,14000.)*2.5+pow(light,450.)*.06);gl_FragColor=vec4(sky,1.);\n #include <colorspace_fragment>\n}'} />
  </mesh>;
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

function PointerGround({ runtime, paused }: { runtime: MutableRefObject<SceneRuntime>; paused: boolean }) {
  const math = useMemo(() => ({ ray: new Raycaster(), pointer: new Vector2(), hit: new Vector3() }), []);
  useFrame(({ camera }) => {
    const state = runtime.current;
    if (paused || !state.pointerActive) { state.pointerWorld[0] = 10000; state.pointerWorld[2] = 10000; return; }
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
  const stage = props.stage ?? 5;
  // Preserve sunlight direction while placing every island in front of the shadow camera.
  const sunlightPosition = useMemo(() => new Vector3(...world.lighting.sunPosition).multiplyScalar(3), []);
  const reflections = useMemo(() => (<Environment frames={1} resolution={128}>
      <Lightformer position={[0, 10, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[20, 20, 1]} intensity={2} color="#edffff" />
      <Lightformer position={[-12, 8, 10]} scale={[7, 18, 1]} intensity={2.4} color="#ffffff" />
      <Lightformer position={[14, 3, -8]} rotation={[0, Math.PI, 0]} scale={[15, 10, 1]} intensity={2} color="#45c9ef" />
    </Environment>), []);
  return <>
    <SceneClock runtime={runtime} paused={stopped} />
    <Sky />
    <fog attach="fog" args={[world.lighting.fogColor, world.lighting.fogNear, world.lighting.fogFar]} />
    <hemisphereLight args={[world.lighting.ambientSky, world.lighting.ambientGround, world.lighting.ambientIntensity]} />
    <directionalLight position={sunlightPosition} intensity={world.lighting.sunIntensity} color={world.lighting.sunColor} castShadow={world.quality[tier].shadows} shadow-mapSize={[2048, 2048]} shadow-camera-left={-55} shadow-camera-right={80} shadow-camera-top={45} shadow-camera-bottom={-22} shadow-camera-near={100} shadow-camera-far={340} shadow-normalBias={0.08} shadow-bias={-0.0001} />
    {reflections}

    {stage >= 1 && <EcoCity runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 3 && <CoastalLife runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 3 && <Seaweed runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 4 && <Flora runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 4 && <Wildlife runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 5 && <GardenRover runtime={runtime} paused={stopped} quality={tier} active={false} />}
    {stage >= 5 && <ShoreImpacts runtime={runtime} paused={stopped} quality={tier} />}
    <Bridges />
    <Water runtime={runtime} paused={stopped} quality={tier} />
    <AmbientSystem onPlantsReady={props.onPlantsReady} stage={stage} runtime={runtime} paused={stopped} quality={tier} />
    {world.landmarks.map(config => <Landmark key={config.id} config={config} runtime={runtime} paused={stopped} onNavigate={onNavigate}><LandmarkModel id={config.id} active={destination === config.id} runtime={runtime} paused={stopped} quality={tier} /></Landmark>)}
    <ReflectiveObject position={[-10, 2.5, 23]} runtime={runtime} paused={stopped} quality={tier} command={props.rotationCommand} />
    <PointerGround runtime={runtime} paused={stopped} />
    <CameraDirector {...props} />
    <Labels runtime={runtime} mobile={mobile} />
    <QualityController mobile={mobile} runtime={runtime} tier={tier} onTier={onTier} paused={stopped} />
  </>;
}
