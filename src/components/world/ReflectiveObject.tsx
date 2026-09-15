'use client';

import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Group, MathUtils, Mesh, MeshPhysicalMaterial, SphereGeometry, TorusGeometry } from 'three';
import { world, type QualityTier, type SceneRuntime, type Vec3 } from '@/content/world';

export interface RotationCommand {
  serial: number;
  yaw?: number;
  pitch?: number;
  reset?: boolean;
}

export interface ReflectiveObjectProps {
  runtime: MutableRefObject<SceneRuntime>;
  paused: boolean;
  quality: QualityTier;
  position?: Vec3;
  command?: RotationCommand;
}

interface CaptureTarget {
  hasPointerCapture: (id: number) => boolean;
  setPointerCapture: (id: number) => void;
  releasePointerCapture: (id: number) => void;
}

interface RotationDrag {
  id: number;
  target: CaptureTarget;
  originX: number;
  originY: number;
  x: number;
  y: number;
  time: number;
  deliberate: boolean;
}

const DEFAULT_POSITION: Vec3 = [-10, 2.5, 11];
const INITIAL_PITCH = 0.22;
const INITIAL_YAW = -0.3;
const PITCH_LIMIT = 0.8;
const SPEED_LIMIT = 3;

function boundedAngle(angle: number) {
  return MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI;
}

export function ReflectiveObject({ runtime: runtimeRef, paused, position = DEFAULT_POSITION, command }: ReflectiveObjectProps) {
  const { gl } = useThree();
  const objectRef = useRef<Group>(null);
  const shellRef = useRef<Mesh<SphereGeometry, MeshPhysicalMaterial>>(null);
  const motionRef = useRef({ pitch: INITIAL_PITCH, yaw: INITIAL_YAW, pitchSpeed: 0, yawSpeed: 0, glow: 0 });
  const dragRef = useRef<RotationDrag | null>(null);
  const tapRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const hoveredRef = useRef(false);
  const lastCommandRef = useRef(-1);
  const resources = useMemo(() => {
    const segments = world.quality.high.segments;
    return {
      shell: new SphereGeometry(0.66, segments, segments / 2).scale(0.85, 1.08, 0.85),
      orbit: new TorusGeometry(0.81, 0.058, 10, segments),
      inner: new TorusGeometry(0.68, 0.025, 8, segments),
      node: new SphereGeometry(0.105, 16, 12),
      blue: new MeshPhysicalMaterial({ color: '#087de0', emissive: '#279fff', emissiveIntensity: 0.04, metalness: 0.12, roughness: 0.105, clearcoat: 1, clearcoatRoughness: 0.055, envMapIntensity: 1.7 }),
      silver: new MeshPhysicalMaterial({ color: '#e7f6ff', metalness: 0.08, roughness: 0.09, clearcoat: 1, envMapIntensity: 1.7 }),
      white: new MeshPhysicalMaterial({ color: world.colors.porcelain, metalness: 0.06, roughness: 0.17, clearcoat: 1, clearcoatRoughness: 0.07 }),
      gold: new MeshPhysicalMaterial({ color: world.colors.gold, metalness: 0.55, roughness: 0.17, clearcoat: 1 }),
    };
  }, []);
  useEffect(() => () => Object.values(resources).forEach(resource => resource.dispose()), [resources]);

  const restoreCursor = useCallback(() => {
    if (gl.domElement.style.cursor === 'grab' || gl.domElement.style.cursor === 'grabbing') gl.domElement.style.setProperty('cursor', '');
  }, [gl]);

  const finishDrag = useCallback((release: boolean, time = 0) => {
    const drag = dragRef.current;
    tapRef.current = null;
    if (!release) {
      motionRef.current.pitchSpeed = 0;
      motionRef.current.yawSpeed = 0;
    }
    if (!drag) return;
    dragRef.current = null;
    if (drag.deliberate) {
      runtimeRef.current.dragging = false;
      if (release) runtimeRef.current.dragCount++;
    }
    if (!release || !drag.deliberate || time - drag.time > 120) {
      motionRef.current.pitchSpeed = 0;
      motionRef.current.yawSpeed = 0;
    }
    if (drag.target.hasPointerCapture(drag.id)) drag.target.releasePointerCapture(drag.id);
    restoreCursor();
  }, [restoreCursor, runtimeRef]);

  useEffect(() => {
    const cancel = () => { finishDrag(false); hoveredRef.current = false; restoreCursor(); };
    const lostCapture = () => { if (dragRef.current) cancel(); };
    const canvas = gl.domElement;
    window.addEventListener('blur', cancel);
    canvas.addEventListener('pointercancel', cancel);
    canvas.addEventListener('lostpointercapture', lostCapture);
    return () => {
      window.removeEventListener('blur', cancel);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('lostpointercapture', lostCapture);
      cancel();
    };
  }, [finishDrag, gl, restoreCursor]);

  useEffect(() => {
    if (!paused) return;
    finishDrag(false);
    hoveredRef.current = false;
    restoreCursor();
  }, [finishDrag, paused, restoreCursor]);

  // A semantic control can send bounded radian increments with a new serial, or reset the pose.
  useEffect(() => {
    if (!command || command.serial === lastCommandRef.current) return;
    lastCommandRef.current = command.serial;
    if (paused) return;
    finishDrag(false);
    const motion = motionRef.current;
    motion.pitch = command.reset ? INITIAL_PITCH : MathUtils.clamp(motion.pitch + MathUtils.clamp(command.pitch ?? 0, -0.3, 0.3), -PITCH_LIMIT, PITCH_LIMIT);
    motion.yaw = command.reset ? INITIAL_YAW : boundedAngle(motion.yaw + MathUtils.clamp(command.yaw ?? 0, -0.3, 0.3));
    motion.pitchSpeed = 0;
    motion.yawSpeed = 0;
    motion.glow = 0.25;
    objectRef.current?.rotation.set(motion.pitch, motion.yaw, 0);
  }, [command, finishDrag, paused]);

  useFrame((_, delta) => {
    if (paused || !objectRef.current) return;
    const motion = motionRef.current;
    const dt = Math.min(delta, 0.05);
    if (!dragRef.current) {
      motion.pitch = MathUtils.clamp(motion.pitch + motion.pitchSpeed * dt, -PITCH_LIMIT, PITCH_LIMIT);
      motion.yaw = boundedAngle(motion.yaw + motion.yawSpeed * dt);
      if (Math.abs(motion.pitch) >= PITCH_LIMIT) motion.pitchSpeed = 0;
      const decay = Math.exp(-5.5 * dt);
      motion.pitchSpeed *= decay;
      motion.yawSpeed *= decay;
      if (Math.abs(motion.pitchSpeed) < 0.0001) motion.pitchSpeed = 0;
      if (Math.abs(motion.yawSpeed) < 0.0001) motion.yawSpeed = 0;
    }
    objectRef.current.rotation.set(motion.pitch, motion.yaw, 0);
    motion.glow *= Math.exp(-5 * dt);
    if (shellRef.current) shellRef.current.material.emissiveIntensity = MathUtils.damp(shellRef.current.material.emissiveIntensity, 0.04 + (hoveredRef.current ? 0.12 : 0) + motion.glow, 14, dt);
  });

  function pointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    if (paused || dragRef.current || runtimeRef.current.dragging || event.button !== 0) return;
    if (event.pointerType === 'touch') {
      tapRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      return;
    }
    const target = event.target as unknown as CaptureTarget;
    target.setPointerCapture(event.pointerId);
    dragRef.current = { id: event.pointerId, target, originX: event.clientX, originY: event.clientY, x: event.clientX, y: event.clientY, time: event.timeStamp, deliberate: false };
    motionRef.current.pitchSpeed = 0;
    motionRef.current.yawSpeed = 0;
    gl.domElement.style.setProperty('cursor', 'grabbing');
  }

  function pointerMove(event: ThreeEvent<PointerEvent>) {
    const tap = tapRef.current;
    if (tap && tap.id === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8) tapRef.current = null;
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId || paused) return;
    event.stopPropagation();
    if (!drag.deliberate && Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY) > 4) {
      drag.deliberate = true;
      runtimeRef.current.dragging = true;
    }
    if (!drag.deliberate) return;
    const motion = motionRef.current;
    const x = MathUtils.clamp(event.clientX - drag.x, -120, 120) * 0.006;
    const y = MathUtils.clamp(event.clientY - drag.y, -120, 120) * 0.006;
    const seconds = Math.max(1 / 240, (event.timeStamp - drag.time) / 1000);
    motion.pitch = MathUtils.clamp(motion.pitch + y, -PITCH_LIMIT, PITCH_LIMIT);
    motion.yaw = boundedAngle(motion.yaw + x);
    motion.pitchSpeed = Math.abs(motion.pitch) === PITCH_LIMIT ? 0 : MathUtils.clamp(y / seconds, -SPEED_LIMIT, SPEED_LIMIT);
    motion.yawSpeed = MathUtils.clamp(x / seconds, -SPEED_LIMIT, SPEED_LIMIT);
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.time = event.timeStamp;
    objectRef.current?.rotation.set(motion.pitch, motion.yaw, 0);
  }

  function pointerUp(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    if (tapRef.current?.id === event.pointerId) {
      if (!paused) motionRef.current.glow = 0.3;
      tapRef.current = null;
    }
    if (dragRef.current?.id === event.pointerId) finishDrag(true, event.timeStamp);
  }

  return <group name="reflective-object" position={position} dispose={null} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
    onPointerCancel={() => finishDrag(false)} onLostPointerCapture={() => { if (dragRef.current) finishDrag(false); }} onClick={event => event.stopPropagation()}
    onPointerOver={event => { event.stopPropagation(); if (!paused && event.pointerType !== 'touch') { hoveredRef.current = true; if (!dragRef.current) gl.domElement.style.setProperty('cursor', 'grab'); } }}
    onPointerOut={() => { hoveredRef.current = false; if (!dragRef.current) restoreCursor(); }}>
    <group ref={objectRef} name="reflective-object-rotation" rotation={[INITIAL_PITCH, INITIAL_YAW, 0]}>
      <mesh ref={shellRef} geometry={resources.shell} material={resources.blue} castShadow />
      <group rotation={[0.7, 0.22, 0.18]}>
        <mesh geometry={resources.orbit} material={resources.silver} castShadow />
        <mesh geometry={resources.node} material={resources.white} position={[0.81, 0, 0]} />
        <mesh geometry={resources.node} material={resources.white} position={[-0.81, 0, 0]} />
      </group>
      <mesh geometry={resources.inner} material={resources.gold} rotation={[-0.6, 0.55, -0.2]} />
    </group>
  </group>;
}
