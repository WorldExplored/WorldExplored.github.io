'use client';

/* Three.js frame callbacks mutate scene objects and the shared runtime ref, outside React rendering. */
/* eslint-disable react-hooks/immutability */

import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { BackSide, Color, DirectionalLight, Vector3 } from 'three';
import { world, type SceneRuntime, type QualityTier, type WorldProps } from '@/content/world';
import { CameraDirector } from './CameraDirector';
import { Landmark } from './Landmark';
import { LandmarkModel } from './LandmarkModels';
import { AmbientSystem } from './AmbientSystem';
import { Water } from './Water';
import { InteractionField } from './InteractionField';
import { QualityController } from './QualityController';

function SceneClock({ runtime, paused }: { runtime: MutableRefObject<SceneRuntime>; paused: boolean }) {
  useFrame((_, delta) => {
    runtime.current.frames++;
    if (!paused) runtime.current.elapsed += Math.min(delta, 0.05);
  }, -2);
  return null;
}

function Sky() {
  const uniforms = useMemo(() => ({ top: { value: new Color(world.colors.sky) }, bottom: { value: new Color(world.colors.horizon) } }), []);
  return <mesh><sphereGeometry args={[140, 24, 16]} /><shaderMaterial side={BackSide} depthWrite={false} uniforms={uniforms}
    vertexShader={'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}' }
    fragmentShader={'uniform vec3 top;uniform vec3 bottom;varying vec3 direction;void main(){float h=normalize(direction).y;gl_FragColor=vec4(mix(bottom,top,smoothstep(-.08,.28,h)),1.);\n #include <colorspace_fragment>\n}'} />
  </mesh>;
}

function Labels({ runtime, mobile }: { runtime: MutableRefObject<SceneRuntime>; mobile: boolean }) {
  const { size, camera } = useThree();
  const labels = useRef<{ element: HTMLElement; point: Vector3; id: string }[]>([]);
  const point = useMemo(() => new Vector3(), []);
  useEffect(() => {
    labels.current = world.landmarks.flatMap(landmark => {
      const element = document.querySelector<HTMLElement>(`[data-landmark="${landmark.id}"]`);
      return element ? [{ element, point: new Vector3(...landmark.label), id: landmark.id }] : [];
    });
    return () => labels.current.forEach(({ element }) => { element.style.removeProperty('transform'); element.style.removeProperty('opacity'); });
  }, []);
  useFrame(() => {
    if (mobile) return;
    for (const label of labels.current) {
      point.copy(label.point).project(camera);
      const x = (point.x * 0.5 + 0.5) * size.width;
      const y = (-point.y * 0.5 + 0.5) * size.height;
      label.element.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-100%)`;
      label.element.style.opacity = point.z > 1 || Math.abs(point.x) > 1.1 ? '0' : '1';
      label.element.dataset.hovered = String(runtime.current.hovered === label.id);
    }
  });
  return null;
}

export function AeroWorld(props: WorldProps & { runtime: MutableRefObject<SceneRuntime>; tier: QualityTier; onTier: (tier: QualityTier) => void }) {
  const { runtime, tier, onTier, paused, panelOpen, mobile, destination, onNavigate } = props;
  const sun = useRef<DirectionalLight>(null);
  const stopped = paused || panelOpen;
  useFrame(({ camera }) => { if (!stopped && sun.current) sun.current.intensity = 1.8 + camera.position.x * 0.006; });
  return <>
    <SceneClock runtime={runtime} paused={stopped} />
    <Sky />
    <fog attach="fog" args={[world.colors.horizon, world.environment.fogNear, world.environment.fogFar]} />
    <hemisphereLight args={['#d3f7ff', '#456b31', 1.25]} />
    <directionalLight ref={sun} position={world.environment.sun} intensity={1.9} color="#fff8dc" castShadow={world.quality[tier].shadows} shadow-mapSize={[1024, 1024]} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-camera-far={70} shadow-normalBias={0.08} shadow-bias={-0.0001} />
    <Environment frames={1} resolution={128}>
      <Lightformer position={[0, 10, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[20, 20, 1]} intensity={2} color="#edffff" />
      <Lightformer position={[-12, 8, 10]} scale={[7, 18, 1]} intensity={2.4} color="#ffffff" />
      <Lightformer position={[14, 3, -8]} rotation={[0, Math.PI, 0]} scale={[15, 10, 1]} intensity={2} color="#45c9ef" />
    </Environment>
    <Water runtime={runtime} paused={stopped} quality={tier} />
    <AmbientSystem runtime={runtime} paused={stopped} quality={tier} />
    {world.landmarks.map(config => <Landmark key={config.id} config={config} runtime={runtime} paused={stopped} onNavigate={onNavigate}><LandmarkModel id={config.id} active={destination === config.id} runtime={runtime} paused={stopped} quality={tier} /></Landmark>)}
    <Suspense fallback={null}><InteractionField runtime={runtime} paused={stopped} mobile={mobile} /></Suspense>
    <CameraDirector {...props} />
    <Labels runtime={runtime} mobile={mobile} />
    <QualityController mobile={mobile} runtime={runtime} tier={tier} onTier={onTier} paused={stopped} />
  </>;
}
