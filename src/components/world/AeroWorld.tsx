'use client';

/* Three.js frame callbacks mutate scene objects and the shared runtime ref, outside React rendering. */
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { BackSide, Color, Vector3, Vector2, Raycaster, Plane } from 'three';
import { world, type SceneRuntime, type QualityTier, type WorldProps } from '@/content/world';
import { CameraDirector } from './CameraDirector';
import { Landmark } from './Landmark';
import { LandmarkModel } from './LandmarkModels';
import { AmbientSystem } from './AmbientSystem';
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
  const uniforms = useMemo(() => ({ top: { value: new Color(world.lighting.skyTop) }, bottom: { value: new Color(world.lighting.horizon) } }), []);
  return <mesh><sphereGeometry args={[140, 24, 16]} /><shaderMaterial side={BackSide} depthWrite={false} uniforms={uniforms}
    vertexShader={'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}' }
    fragmentShader={'uniform vec3 top;uniform vec3 bottom;varying vec3 direction;void main(){float h=normalize(direction).y;gl_FragColor=vec4(mix(bottom,top,smoothstep(-.08,.16,h)),1.);\n #include <colorspace_fragment>\n}'} />
  </mesh>;
}

function Labels({ runtime, mobile }: { runtime: MutableRefObject<SceneRuntime>; mobile: boolean }) {
  const { size, camera } = useThree();
  const labels = useRef<{ element: HTMLElement; point: Vector3; id: string }[]>([]);
  const point = useMemo(() => new Vector3(), []);
  const sculpture = useRef<HTMLElement | null>(null);
  useEffect(() => {
    sculpture.current = document.querySelector('[data-sculpture-control]');
    labels.current = world.landmarks.flatMap(landmark => {
      const element = document.querySelector<HTMLElement>(`[data-landmark="${landmark.id}"]`);
      return element ? [{ element, point: new Vector3(...landmark.label), id: landmark.id }] : [];
    });
    return () => labels.current.forEach(({ element }) => { element.style.removeProperty('transform'); element.style.removeProperty('opacity'); });
  }, []);
  useFrame(() => {
    if (mobile) return;
    if (sculpture.current) {
      point.set(-6, 2.5, 12).project(camera);
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
  const math = useMemo(() => ({ ray: new Raycaster(), pointer: new Vector2(), plane: new Plane(new Vector3(0, 1, 0), 0), hit: new Vector3() }), []);
  useFrame(({ camera }) => {
    const state = runtime.current;
    if (paused || !state.pointerActive) { state.pointerWorld[0] = 10000; state.pointerWorld[2] = 10000; return; }
    math.pointer.fromArray(state.pointer);
    math.ray.setFromCamera(math.pointer, camera);
    const hit = math.ray.ray.intersectPlane(math.plane, math.hit);
    state.pointerWorld[0] = hit ? hit.x : 10000;
    state.pointerWorld[1] = 0;
    state.pointerWorld[2] = hit ? hit.z : 10000;
  }, -1);
  return null;
}

function SurfaceAttachment({ destination, open, mobile }: Pick<WorldProps, 'destination' | 'mobile'> & { open: boolean }) {
  const { invalidate } = useThree();
  const target = useRef({ x: 0, y: 0 });
  const line = useRef<SVGPathElement | null>(null);
  const dot = useRef<SVGCircleElement | null>(null);
  const point = useMemo(() => new Vector3(), []);
  useEffect(() => {
    line.current = document.querySelector('[data-surface-line]');
    dot.current = document.querySelector('[data-surface-dot]');
    function measure() {
      if (!destination) return;
      const surface = document.querySelector<HTMLElement>(`#${destination} .surface`);
      const rect = surface?.getBoundingClientRect();
      if (rect) {
        target.current = mobile ? { x: rect.left + rect.width / 2, y: rect.top } : { x: rect.left + 1, y: rect.top + Math.min(150, rect.height / 2) };
        invalidate();
      }
    }
    const frame = requestAnimationFrame(measure);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    document.addEventListener('animationend', measure);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); document.removeEventListener('animationend', measure); };
  }, [destination, open, mobile, invalidate]);
  useFrame(({ camera, size }) => {
    const config = world.landmarks.find(item => item.id === destination);
    if (!config || !open || !line.current || !dot.current) { line.current?.setAttribute('d', ''); return; }
    point.fromArray(config.label).project(camera);
    const x = (point.x * .5 + .5) * size.width;
    const y = (-point.y * .5 + .5) * size.height;
    line.current.setAttribute('d', mobile ? `M${x},${y} L${target.current.x},${target.current.y - 20} L${target.current.x},${target.current.y}` : `M${x},${y} L${target.current.x - 25},${target.current.y} L${target.current.x},${target.current.y}`);
    dot.current.setAttribute('cx', String(x));
    dot.current.setAttribute('cy', String(y));
  });
  return null;
}

export function AeroWorld(props: WorldProps & { runtime: MutableRefObject<SceneRuntime>; tier: QualityTier; onTier: (tier: QualityTier) => void }) {
  const { runtime, tier, onTier, paused, panelOpen, mobile, destination, onNavigate } = props;
  const stopped = paused || panelOpen;
  return <>
    <SceneClock runtime={runtime} paused={stopped} />
    <Sky />
    <fog attach="fog" args={[world.lighting.fogColor, world.lighting.fogNear, world.lighting.fogFar]} />
    <hemisphereLight args={[world.lighting.ambientSky, world.lighting.ambientGround, world.lighting.ambientIntensity]} />
    <directionalLight position={world.lighting.sunPosition} intensity={world.lighting.sunIntensity} color={world.lighting.sunColor} castShadow={world.quality[tier].shadows} shadow-mapSize={[1024, 1024]} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-camera-far={70} shadow-normalBias={0.08} shadow-bias={-0.0001} />
    <Environment frames={1} resolution={128}>
      <Lightformer position={[0, 10, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[20, 20, 1]} intensity={2} color="#edffff" />
      <Lightformer position={[-12, 8, 10]} scale={[7, 18, 1]} intensity={2.4} color="#ffffff" />
      <Lightformer position={[14, 3, -8]} rotation={[0, Math.PI, 0]} scale={[15, 10, 1]} intensity={2} color="#45c9ef" />
    </Environment>
    <Water runtime={runtime} paused={stopped} quality={tier} />
    <AmbientSystem runtime={runtime} paused={stopped} quality={tier} />
    {world.landmarks.map(config => <Landmark key={config.id} config={config} runtime={runtime} paused={stopped} onNavigate={onNavigate}><LandmarkModel id={config.id} active={destination === config.id} runtime={runtime} paused={stopped} quality={tier} /></Landmark>)}
    <ReflectiveObject position={[-6, 2.5, 12]} runtime={runtime} paused={stopped} quality={tier} command={props.rotationCommand} />
    <PointerGround runtime={runtime} paused={stopped} />
    <SurfaceAttachment destination={destination} open={panelOpen} mobile={mobile} />
    <CameraDirector {...props} />
    <Labels runtime={runtime} mobile={mobile} />
    <QualityController mobile={mobile} runtime={runtime} tier={tier} onTier={onTier} paused={stopped} />
  </>;
}
