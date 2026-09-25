'use client';

/* Three.js frame callbacks and pointer handlers mutate scene objects outside React rendering. */
/* eslint-disable react-hooks/immutability */

import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useRef, type MutableRefObject, type ReactNode } from 'react';
import { Mesh, MeshBasicMaterial, type Object3D } from 'three';
import { FOOTPRINT_RADII } from './terrain';
import { emitTechnologySound } from './coastalAudio';
import { world, type LandmarkConfig, type LandmarkId, type SceneRuntime } from '@/content/world';

export const LANDMARK_HOVER_GRACE_MS = 120;
export const LANDMARK_HIT_BOUNDS: Record<LandmarkId, { radius: number; floor: number; top: number }> = {
  work: { radius: FOOTPRINT_RADII.work, floor: .8, top: 11.6 },
  experience: { radius: FOOTPRINT_RADII.experience, floor: .8, top: 7.8 },
  research: { radius: FOOTPRINT_RADII.research, floor: .8, top: 8.5 },
  purdue: { radius: FOOTPRINT_RADII.purdue, floor: .8, top: 4.8 },
  history: { radius: FOOTPRINT_RADII.history, floor: .8, top: 8.8 },
  about: { radius: FOOTPRINT_RADII.about, floor: .8, top: 5 },
  contact: { radius: FOOTPRINT_RADII.contact, floor: .8, top: 6.5 },
  arcade: { radius: FOOTPRINT_RADII.arcade, floor: .8, top: 5.6 },
  building: { radius: FOOTPRINT_RADII.building, floor: .8, top: 7.8 },
};

function intersectsSculpture(event: { intersections?: { object: Object3D }[] }) {
  for (const hit of event.intersections ?? []) {
    for (let object: Object3D | null = hit.object; object; object = object.parent) if (object.name === 'reflective-object') return true;
  }
  return false;
}

export function Landmark({ config, runtime, paused, onNavigate, children }: { config: LandmarkConfig; runtime: MutableRefObject<SceneRuntime>; paused: boolean; onNavigate: (id: LandmarkId) => void; children: ReactNode }) {
  const ring = useRef<Mesh>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dragCount = useRef(runtime.current.dragCount);
  const invalidate = useThree(state => state.invalidate);
  const bounds = LANDMARK_HIT_BOUNDS[config.id];
  const cancelExit = () => { clearTimeout(exitTimer.current); exitTimer.current = undefined; };
  const clearHover = () => {
    if (runtime.current.hovered === config.id) { runtime.current.hovered = null; invalidate(); }
  };
  const delegates = (event: { intersections?: { object: Object3D }[] }) => (config.id === 'about' && intersectsSculpture(event));
  const enter = (event: ThreeEvent<PointerEvent>) => {
    if (!delegates(event)) event.stopPropagation();
    cancelExit();
    if (event.pointerType === 'touch') { clearHover(); return; }
    if (!runtime.current.dragging && runtime.current.hovered !== config.id) { runtime.current.hovered = config.id; emitTechnologySound('hover', config.position); invalidate(); }
  };
  useEffect(() => () => {
    clearTimeout(exitTimer.current);
    if (runtime.current.hovered === config.id) runtime.current.hovered = null;
  }, [config.id, runtime]);
  useFrame((_, delta) => {
    if (!ring.current) return;
    const active = runtime.current.hovered === config.id;
    const material = ring.current.material as MeshBasicMaterial;
    material.opacity += ((active ? .65 : .16) - material.opacity) * (paused ? 1 : Math.min(1, delta * 8));
  });
  return <group name={`landmark-${config.id}`} position={config.position}
      onPointerOver={enter}
      onPointerMove={enter}
      onPointerOut={event => {
        if (!delegates(event)) event.stopPropagation();
        cancelExit();
        if (event.pointerType === 'touch') { clearHover(); return; }
        exitTimer.current = setTimeout(clearHover, LANDMARK_HOVER_GRACE_MS);
      }}
      onPointerDown={event => { if (!delegates(event)) event.stopPropagation(); dragCount.current = runtime.current.dragCount; if (event.pointerType === 'touch') { cancelExit(); clearHover(); } }}
      onClick={event => {
        // The About boundary retains hover while the sculpture owns its nested drag/tap.
        if (delegates(event)) return;
        event.stopPropagation();
        if (event.delta < 6 && !runtime.current.dragging && dragCount.current === runtime.current.dragCount) { emitTechnologySound('activate', config.position); onNavigate(config.id); }
      }}>
    {config.id === 'building' && <mesh name="lighthouse-navigation-hit" position={[0,4.1,0]}>
      <cylinderGeometry args={[1.4,1.4,7,20]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false}/>
    </mesh>}
    <group name={`landmark-model-${config.id}`} rotation={[0, config.rotationY ?? 0, 0]}>{children}</group>
    <mesh ref={ring} raycast={() => {}} position={[0, bounds.floor + .04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[bounds.radius - .05, bounds.radius, world.quality.high.segments]} />
      <meshBasicMaterial color={config.color} transparent opacity={.16} depthWrite={false} />
    </mesh>


  </group>;
}
