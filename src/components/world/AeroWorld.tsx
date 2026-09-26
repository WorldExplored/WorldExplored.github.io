'use client';

/* Three.js frame callbacks mutate scene objects and the shared runtime ref, outside React rendering. */
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { Vector3, Vector2, Raycaster } from 'three';
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
import { ReefCaves } from './ReefCaves';
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
import { Sky, WeatherLighting } from './WeatherLighting';
import { advanceSceneTime, daylightAt } from './weatherState';
import { RoomLighting, mainRoomLamps } from './RoomLighting';
import { CoastalTraffic } from './CoastalTraffic';
import { FrontGardens } from './FrontGardens';
import { StormSystem } from './StormSystem';
import { RainRoofRegistry } from './RainRoofRegistry';
import { ExteriorLighting } from './ExteriorLighting';

function SceneClock({ runtime, paused }: { runtime: MutableRefObject<SceneRuntime>; paused: boolean }) {
  const firstFrame=useRef(true);
  useEffect(()=>{firstFrame.current=true;},[paused]);
  useFrame((_, delta) => {
    runtime.current.frames++;
    // Ignore the first delta after visibility/entry resumes, which may include time with no rendered frames.
    if(paused){firstFrame.current=true;return;}
    if(firstFrame.current){firstFrame.current=false;return;}
    advanceSceneTime(runtime.current,delta,false);
  }, -2);
  return null;
}

/** Direction for a clock hour, shared with water and the visible sun. */
export const daylightDirectionAt = daylightAt;

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
  const math = useMemo(() => ({ ray: new Raycaster(), pointer: new Vector2(10000,10000), hit: new Vector3(), camera: new Vector3(10000,10000,10000), matrix: new Float64Array(32) }), []);
  useFrame(({ camera }) => {
    const state = runtime.current;
    if (!state.pointerActive) { math.pointer.set(10000,10000); state.pointerWorld[0] = 10000; state.pointerWorld[2] = 10000; return; }
    let changed=math.pointer.x!==state.pointer[0]||math.pointer.y!==state.pointer[1]||!math.camera.equals(camera.position);
    for(let i=0;i<16;i++)if(math.matrix[i]!==camera.matrixWorld.elements[i]||math.matrix[i+16]!==camera.projectionMatrix.elements[i])changed=true;
    if(!changed)return;
    math.camera.copy(camera.position);math.matrix.set(camera.matrixWorld.elements);math.matrix.set(camera.projectionMatrix.elements,16);
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
    <WeatherLighting runtime={runtime} paused={stopped} shadows={world.quality[tier].shadows}/>
    {stage >= 1 && <StormSystem runtime={runtime} paused={stopped} quality={tier}/>}
    {reflections}

    {stage >= 1 && <ExteriorLighting runtime={runtime}/>}
    {stage >= 1 && <RoomLighting rooms={mainRoomLamps} runtime={runtime}/>}
    {stage >= 1 && <EcoCity runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 3 && <CoastalLife runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 3 && <ReefHabitat runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 3 && <ReefCaves runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 4 && <MarineVisitors runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 3 && <CoastalTraffic runtime={runtime} paused={stopped} quality={tier}/>}
    {stage >= 3 && <DolphinLife runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 3 && <ReefLife runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 3 && <CityVentilation runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 3 && <DockEcology />}
    {stage >= 3 && <Seaweed runtime={runtime} paused={stopped} quality={tier} />}
    {stage >= 3 && <BenthicLife quality={tier} />}
    {stage >= 3 && <CityPathEdges />}
    {stage >= 4 && <HistoryFlowerBorder />}
    {stage >= 4 && <FrontGardens/>}
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
    <RainRoofRegistry stage={stage}/>
    <PointerGround runtime={runtime} />
    <CameraDirector {...props} />
    <Labels runtime={runtime} mobile={mobile} />
    <QualityController mobile={mobile} runtime={runtime} tier={tier} onTier={onTier} paused={stopped} />
  </>;
}
