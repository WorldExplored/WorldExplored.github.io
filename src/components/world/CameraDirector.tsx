'use client';

/* Three.js frame callbacks mutate scene objects and the shared runtime ref, outside React rendering. */
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, MathUtils } from 'three';
import { flightEase, landmarkFor, world, type SceneRuntime, type WorldProps } from '@/content/world';

type Props = Pick<WorldProps, 'destination' | 'flight' | 'mobile' | 'onArrive' | 'panelOpen' | 'paused'> & { runtime: MutableRefObject<SceneRuntime> };

export function CameraDirector({ destination, flight, mobile, onArrive, panelOpen, paused, runtime }: Props) {
  const { camera, invalidate, size } = useThree();
  const regress = useThree(state => state.performance.regress);
  const fit = mobile ? Math.max(1, Math.min(2.4, .95 / (size.width / size.height))) : Math.max(1, Math.min(1.55, 1.35 / (size.width / size.height)));
  const look = useRef(new Vector3(...(mobile ? world.mobileOverview : world.overview).target));
  const vectors = useMemo(() => ({ start: new Vector3(), startLook: new Vector3(), end: new Vector3(), endLook: new Vector3(), desired: new Vector3(), desiredLook: new Vector3(), offset: new Vector3() }), []);
  const transition = useRef({ elapsed: 0, active: false, id: destination, serial: flight });
  const handler = useRef(onArrive);
  useEffect(() => { handler.current = onArrive; }, [onArrive]);

  useEffect(() => {
    const overview = mobile ? world.mobileOverview : world.overview;
    const pose = landmarkFor(destination)?.camera ?? overview;
    vectors.start.copy(camera.position);
    vectors.startLook.copy(look.current);
    vectors.end.fromArray(pose.position);
    vectors.endLook.fromArray(pose.target);
    if (mobile && destination) {
      const anchor = landmarkFor(destination)?.position;
      if (anchor) {
        vectors.end.set(anchor[0] + 13, anchor[1] + 15, anchor[2] + 27);
        vectors.endLook.set(anchor[0], anchor[1] - 5, anchor[2]);
      }
    } else vectors.end.sub(vectors.endLook).multiplyScalar(fit).add(vectors.endLook);
    transition.current = { elapsed: 0, active: true, id: destination, serial: flight };
    runtime.current.moving = true;
    regress();
    invalidate();
  }, [destination, flight, mobile, camera, vectors, runtime, invalidate, regress, fit]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const state = transition.current;
    if (state.active) {
      state.elapsed = paused ? world.flightSeconds : state.elapsed + dt;
      const t = flightEase(state.elapsed / world.flightSeconds);
      camera.position.lerpVectors(vectors.start, vectors.end, t);
      look.current.lerpVectors(vectors.startLook, vectors.endLook, t);
      camera.lookAt(look.current);
      if (t >= 1) {
        state.active = false;
        runtime.current.moving = false;
        handler.current(state.id, state.serial);
      } else {
        regress();
        invalidate();
      }
      return;
    }
    if (panelOpen || paused || destination || runtime.current.dragging) return;
    const overview = mobile ? world.mobileOverview : world.overview;
    const progress = Math.min(1, runtime.current.scroll);
    const count = world.landmarks.length - 1;
    const step = progress * count;
    const index = Math.min(count - 1, Math.floor(step));
    const blend = flightEase(step - index);
    const first = world.landmarks[index].camera;
    const next = world.landmarks[index + 1].camera;
    vectors.desired.fromArray(first.position).lerp(vectors.end.fromArray(next.position), blend);
    vectors.desiredLook.fromArray(first.target).lerp(vectors.endLook.fromArray(next.target), blend);
    const routeWeight = Math.min(1, progress * 7);
    vectors.desired.lerp(vectors.start.fromArray(overview.position), 1 - routeWeight);
    vectors.desiredLook.lerp(vectors.startLook.fromArray(overview.target), 1 - routeWeight);
    if (mobile) vectors.desired.sub(vectors.desiredLook).multiplyScalar(fit * (1 + routeWeight * 0.15)).add(vectors.desiredLook);
    if (!mobile) vectors.desired.sub(vectors.desiredLook).multiplyScalar(fit).add(vectors.desiredLook);
    const amplitude = mobile ? 0.2 : 0.9;
    vectors.desired.x += runtime.current.pointer[0] * amplitude;
    vectors.desired.y += runtime.current.pointer[1] * 0.45;
    vectors.desiredLook.x += runtime.current.pointer[0] * 0.28;
    const distance = camera.position.distanceToSquared(vectors.desired);
    runtime.current.moving = distance > 0.025;
    if (distance > 0.1) regress();
    camera.position.lerp(vectors.desired, 1 - Math.exp(-3.5 * dt));
    look.current.lerp(vectors.desiredLook, 1 - Math.exp(-3.5 * dt));
    camera.position.y = MathUtils.clamp(camera.position.y, 5, 55);
    camera.lookAt(look.current);
  });
  return null;
}
