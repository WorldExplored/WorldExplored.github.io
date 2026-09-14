'use client';

/* eslint-disable react-hooks/immutability -- Pointer handlers intentionally update the shared scene ref and the renderer's canvas cursor. */

import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { BallCollider, CuboidCollider, Physics, RigidBody, useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier';
import { Color, Plane, Ray, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { world, type SceneRuntime, type Vec3 } from '@/content/world';
import { bubbleDragVelocity, clampBubblePosition } from './bubblePhysics';

interface InteractionFieldProps {
  runtime: MutableRefObject<SceneRuntime>;
  paused: boolean;
  mobile: boolean;
}
interface BubbleSpec { position: Vec3; radius: number }
interface CaptureTarget {
  hasPointerCapture: (id: number) => boolean;
  setPointerCapture: (id: number) => void;
  releasePointerCapture: (id: number) => void;
}
interface Drag {
  index: number;
  body: RapierRigidBody;
  pointerId: number;
  target: CaptureTarget;
  time: number;
}

const bubbles: BubbleSpec[] = [
  { position: [-9, 3.8, 12], radius: 0.72 },
  { position: [-7, 6, 9.2], radius: 0.5 },
  { position: [-4.8, 2.4, 15], radius: 0.68 },
  { position: [10.8, 5.4, 11.8], radius: 0.86 },
  { position: [13, 2.8, 14.5], radius: 0.54 },
  { position: [7.5, 3.2, 9.5], radius: 0.62 },
].slice(0, world.environment.tactileBubbles) as BubbleSpec[];

function BubbleBodies({ runtime, paused, mobile }: InteractionFieldProps) {
  const { gl, camera, pointer } = useThree();
  const { rapier } = useRapier();
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  const drag = useRef<Drag | null>(null);
  const hovered = useRef(-1);
  const pointerInside = useRef(false);
  const elapsed = useRef(0);
  const scratch = useMemo(() => ({
    plane: new Plane(), ray: new Ray(), normal: new Vector3(), hit: new Vector3(),
    center: new Vector3(), offset: new Vector3(), previous: new Vector3(),
    velocity: new Vector3(), force: new Vector3(), nearest: new Vector3(),
  }), []);
  const assets = useMemo(() => ({
    geometry: new SphereGeometry(1, 32, 24),
    material: new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { tint: { value: new Color(world.colors.cyan) } },
      vertexShader: `
        varying vec3 worldNormal;
        varying vec3 worldPosition;
        void main() {
          vec4 positionWorld = modelMatrix * vec4(position, 1.0);
          worldPosition = positionWorld.xyz;
          worldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * positionWorld;
        }
      `,
      fragmentShader: `
        uniform vec3 tint;
        varying vec3 worldNormal;
        varying vec3 worldPosition;
        void main() {
          vec3 normal = normalize(worldNormal);
          vec3 view = normalize(cameraPosition - worldPosition);
          vec3 sunlight = normalize(vec3(-0.45, 0.8, 0.65));
          float rim = pow(1.0 - max(dot(normal, view), 0.0), 2.7);
          float shine = pow(max(dot(normal, normalize(sunlight + view)), 0.0), 100.0);
          float cap = smoothstep(0.93, 0.985, dot(normal, sunlight));
          vec3 color = mix(tint, vec3(1.0), rim * 0.65 + shine * 0.8);
          color += vec3(0.12, 0.15, 0.08) * cap;
          gl_FragColor = vec4(color, min(0.82, 0.055 + rim * 0.6 + shine * 0.75 + cap * 0.22));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }),
  }), []);

  const restoreCursor = useCallback(() => {
    const cursor = gl.domElement.style.cursor;
    if (cursor === 'grab' || cursor === 'grabbing') gl.domElement.style.cursor = '';
  }, [gl]);

  const finishDrag = useCallback((release: boolean, time = 0) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    runtime.current.dragging = false;
    if (current.body.isValid()) {
      current.body.setBodyType(rapier.RigidBodyType.Dynamic, true);
      if (!release || time - current.time > 150) scratch.velocity.set(0, 0, 0);
      current.body.setLinvel(scratch.velocity, release);
      if (!release) current.body.sleep();
    }
    if (current.target.hasPointerCapture(current.pointerId)) current.target.releasePointerCapture(current.pointerId);
    if (release) runtime.current.dragCount += 1;
    restoreCursor();
  }, [rapier, restoreCursor, runtime, scratch]);

  useEffect(() => {
    const canvas = gl.domElement;
    const enter = (event: PointerEvent) => { pointerInside.current = event.pointerType !== 'touch'; };
    const leave = () => { pointerInside.current = false; };
    const cancel = () => { pointerInside.current = false; finishDrag(false); };
    canvas.addEventListener('pointermove', enter);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('pointercancel', cancel);
    canvas.addEventListener('lostpointercapture', cancel);
    window.addEventListener('blur', cancel);
    return () => {
      canvas.removeEventListener('pointermove', enter);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('lostpointercapture', cancel);
      window.removeEventListener('blur', cancel);
      finishDrag(false);
      restoreCursor();
    };
  }, [finishDrag, gl, restoreCursor]);

  useEffect(() => {
    if (paused) {
      finishDrag(false);
      hovered.current = -1;
      pointerInside.current = false;
      restoreCursor();
    }
  }, [finishDrag, paused, restoreCursor]);

  useEffect(() => () => {
    assets.geometry.dispose();
    assets.material.dispose();
  }, [assets]);

  useBeforePhysicsStep(() => {
    if (paused) return;
    elapsed.current += 1 / 60;
    const repel = pointerInside.current && !mobile && !runtime.current.moving && !drag.current;
    if (repel) {
      scratch.hit.set(pointer.x, pointer.y, 0.5).unproject(camera);
      camera.getWorldPosition(scratch.ray.origin);
      scratch.ray.direction.copy(scratch.hit).sub(scratch.ray.origin).normalize();
    }
    for (let i = 0; i < bubbles.length; i += 1) {
      const body = bodies.current[i];
      if (!body || i === drag.current?.index || !body.isValid()) continue;
      const position = body.translation();
      const phase = elapsed.current * 0.7 + i * 1.9;
      scratch.force.set(
        Math.sin(phase * 0.61) * 0.075,
        (bubbles[i].position[1] + Math.sin(phase) * 0.45 - position.y) * 0.5,
        Math.cos(phase * 0.47) * 0.055,
      ).multiplyScalar(1 / 60);
      body.applyImpulse(scratch.force, false);
      if (repel) {
        scratch.center.set(position.x, position.y, position.z);
        scratch.ray.closestPointToPoint(scratch.center, scratch.nearest);
        scratch.force.copy(scratch.center).sub(scratch.nearest);
        const distance = scratch.force.length();
        const reach = bubbles[i].radius + 1.25;
        if (distance > 0.02 && distance < reach) {
          scratch.force.multiplyScalar((1 - distance / reach) * 0.013 / distance);
          body.applyImpulse(scratch.force, true);
        }
      }
    }
  });

  const startDrag = (event: ThreeEvent<PointerEvent>, index: number) => {
    event.stopPropagation();
    if (paused || mobile || event.pointerType === 'touch' || event.button !== 0 || drag.current) return;
    const body = bodies.current[index];
    if (!body) return;
    const position = body.translation();
    scratch.center.set(position.x, position.y, position.z);
    camera.getWorldDirection(scratch.normal);
    scratch.plane.setFromNormalAndCoplanarPoint(scratch.normal, scratch.center);
    if (!event.ray.intersectPlane(scratch.plane, scratch.hit)) return;
    scratch.offset.copy(scratch.center).sub(scratch.hit);
    scratch.previous.copy(scratch.center);
    scratch.velocity.set(0, 0, 0);
    const target = event.target as unknown as CaptureTarget;
    target.setPointerCapture(event.pointerId);
    drag.current = { index, body, pointerId: event.pointerId, target, time: event.timeStamp };
    body.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
    body.setNextKinematicTranslation(scratch.center);
    runtime.current.dragging = true;
    gl.domElement.style.cursor = 'grabbing';
  };

  const moveDrag = (event: ThreeEvent<PointerEvent>) => {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    event.stopPropagation();
    if (!event.ray.intersectPlane(scratch.plane, scratch.hit)) return;
    scratch.hit.add(scratch.offset);
    clampBubblePosition(scratch.hit, bubbles[current.index].radius, world.environment.bubbleBounds);
    bubbleDragVelocity(scratch.hit, scratch.previous, event.timeStamp - current.time, scratch.velocity);
    current.body.setNextKinematicTranslation(scratch.hit);
    scratch.previous.copy(scratch.hit);
    current.time = event.timeStamp;
  };

  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (event.pointerId === drag.current?.pointerId) finishDrag(true, event.timeStamp);
  };

  return <group name="tactile-bubbles" dispose={null}>
    {bubbles.map((bubble, index) => <RigidBody key={index} ref={body => { bodies.current[index] = body; }} position={bubble.position} colliders={false} linearDamping={1.2} enabledRotations={[false, false, false]} canSleep ccd>
      <BallCollider args={[bubble.radius]} mass={1} restitution={0.85} friction={0.05} />
      <mesh name={`tactile-bubble-${index + 1}`} geometry={assets.geometry} material={assets.material} scale={bubble.radius}
        onPointerDown={event => startDrag(event, index)} onPointerMove={moveDrag} onPointerUp={endDrag}
        onPointerCancel={() => finishDrag(false)} onLostPointerCapture={() => finishDrag(false)}
        onClick={event => event.stopPropagation()}
        onPointerOver={event => {
          event.stopPropagation();
          hovered.current = index;
          if (!paused && !mobile && event.pointerType !== 'touch' && !drag.current) gl.domElement.style.cursor = 'grab';
        }}
        onPointerOut={() => {
          if (hovered.current === index) hovered.current = -1;
          if (!drag.current) restoreCursor();
        }} />
    </RigidBody>)}
    <BubbleBounds />
  </group>;
}

function BubbleBounds() {
  const { min, max } = world.environment.bubbleBounds;
  const half: Vec3 = [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2];
  const center: Vec3 = [(max[0] + min[0]) / 2, (max[1] + min[1]) / 2, (max[2] + min[2]) / 2];
  return <RigidBody type="fixed" colliders={false} restitution={0.85} friction={0.05}>
    <CuboidCollider position={[min[0] - 0.5, center[1], center[2]]} args={[0.5, half[1] + 1, half[2] + 1]} />
    <CuboidCollider position={[max[0] + 0.5, center[1], center[2]]} args={[0.5, half[1] + 1, half[2] + 1]} />
    <CuboidCollider position={[center[0], min[1] - 0.5, center[2]]} args={[half[0] + 1, 0.5, half[2] + 1]} />
    <CuboidCollider position={[center[0], max[1] + 0.5, center[2]]} args={[half[0] + 1, 0.5, half[2] + 1]} />
    <CuboidCollider position={[center[0], center[1], min[2] - 0.5]} args={[half[0] + 1, half[1] + 1, 0.5]} />
    <CuboidCollider position={[center[0], center[1], max[2] + 0.5]} args={[half[0] + 1, half[1] + 1, 0.5]} />
  </RigidBody>;
}

export function InteractionField(props: InteractionFieldProps) {
  return <Physics gravity={[0, 0, 0]} timeStep={1 / 60} paused={props.paused} colliders={false}>
    <BubbleBodies {...props} />
  </Physics>;
}
