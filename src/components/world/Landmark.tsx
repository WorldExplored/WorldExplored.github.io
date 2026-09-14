'use client';

/* Three.js frame callbacks mutate scene objects and the shared runtime ref, outside React rendering. */
/* eslint-disable react-hooks/immutability */

import { useFrame } from '@react-three/fiber';
import { useRef, type MutableRefObject, type ReactNode } from 'react';
import { Group, Mesh, MeshBasicMaterial } from 'three';
import { world, type LandmarkConfig, type LandmarkId, type SceneRuntime } from '@/content/world';

export function Landmark({ config, runtime, paused, onNavigate, children }: { config: LandmarkConfig; runtime: MutableRefObject<SceneRuntime>; paused: boolean; onNavigate: (id: LandmarkId) => void; children: ReactNode }) {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (paused) return;
    const active = runtime.current.hovered === config.id;
    if (group.current) group.current.scale.setScalar(group.current.scale.x + ((active ? 1.015 : 1) - group.current.scale.x) * Math.min(1, delta * 9));
    if (ring.current) {
      const material = ring.current.material as MeshBasicMaterial;
      material.opacity += ((active ? 0.65 : 0.16) - material.opacity) * Math.min(1, delta * 8);
      ring.current.rotation.z = runtime.current.elapsed * 0.08;
    }
  });
  return <group name={`landmark-${config.id}`} position={config.position}
    onPointerOver={event => { event.stopPropagation(); runtime.current.hovered = config.id; }}
    onPointerOut={() => { if (runtime.current.hovered === config.id) runtime.current.hovered = null; }}
    onClick={event => { event.stopPropagation(); if (event.delta < 6) onNavigate(config.id); }}>
    <group ref={group}>{children}</group>
    <mesh ref={ring} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[config.id === 'building' ? 1.7 : 3.45, config.id === 'building' ? 1.75 : 3.5, world.quality.high.segments]} />
      <meshBasicMaterial color={config.color} transparent opacity={0.16} depthWrite={false} />
    </mesh>
  </group>;
}
