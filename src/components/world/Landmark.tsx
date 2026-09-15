'use client';

/* Three.js frame callbacks and pointer handlers mutate scene objects outside React rendering. */
/* eslint-disable react-hooks/immutability */

import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useRef, type MutableRefObject, type ReactNode } from 'react';
import { Mesh, MeshBasicMaterial, type Object3D } from 'three';
import { world, type LandmarkConfig, type LandmarkId, type SceneRuntime } from '@/content/world';

export const LANDMARK_HOVER_GRACE_MS = 120;
export const LANDMARK_HIT_BOUNDS: Record<LandmarkId, { radius: number; floor: number; top: number }> = {
  work: { radius: 5.5, floor: .8, top: 6.5 },
  research: { radius: 3.8, floor: .8, top: 4.8 },
  purdue: { radius: 1.8, floor: .8, top: 2.8 },
  about: { radius: 3.5, floor: .8, top: 4.2 },
  contact: { radius: 3.2, floor: .8, top: 4.2 },
  building: { radius: 2.4, floor: .8, top: 7.5 },
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
  const delegates = (event: { intersections?: { object: Object3D }[] }) => config.id === 'about' && intersectsSculpture(event);
  const enter = (event: ThreeEvent<PointerEvent>) => {
    if (!delegates(event)) event.stopPropagation();
    cancelExit();
    if (event.pointerType === 'touch') { clearHover(); return; }
    if (!runtime.current.dragging && runtime.current.hovered !== config.id) { runtime.current.hovered = config.id; invalidate(); }
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
  return <group name={`landmark-${config.id}`} position={config.position}>
    <group name={`landmark-model-${config.id}`}>{children}</group>
    <mesh ref={ring} position={[0, .08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[bounds.radius - .05, bounds.radius, world.quality.high.segments]} />
      <meshBasicMaterial color={config.color} transparent opacity={.16} depthWrite={false} />
    </mesh>
    <mesh name={`landmark-hit-${config.id}`} position={[0, (bounds.floor + bounds.top) / 2, 0]}
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
        if (event.delta < 6 && !runtime.current.dragging && dragCount.current === runtime.current.dragCount) onNavigate(config.id);
      }}>
      <cylinderGeometry args={[bounds.radius, bounds.radius, bounds.top - bounds.floor, 32, 1]} />
      <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
    </mesh>
  </group>;
}
