'use client';

/* Three.js controls and frame callbacks mutate scene objects outside React rendering. */
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree, type RootState } from '@react-three/fiber';
import { MOUSE, Plane, Raycaster, TOUCH, Vector2, Vector3, type Intersection, type Object3D } from 'three';
import { OrbitControls } from 'three-stdlib';
import { flightEase, world, type SceneRuntime, type WorldProps } from '@/content/world';
import { CAMERA_LIMITS, cameraObstacles, clipCameraTravel, constrainCameraPose, focusPose, intersectTerrainRay, zoomTowardPoint } from './cameraControls';

type Props = Pick<WorldProps, 'destination' | 'flight' | 'mobile' | 'onArrive' | 'panelOpen' | 'paused'> & { runtime: MutableRefObject<SceneRuntime> };

export function CameraDirector({ destination, flight, mobile, onArrive, paused, runtime }: Props) {
  const { camera, gl, scene, invalidate, size, get, set } = useThree();
  const controls = useMemo(() => new OrbitControls(camera), [camera]);
  const obstacles = useMemo(() => cameraObstacles(), []);
  const vectors = useMemo(() => ({ start: new Vector3(), startLook: new Vector3(), end: new Vector3(), endLook: new Vector3(), previous: new Vector3(), accepted: camera.position.clone(), parallaxMotion: new Vector2(), saved: new Vector3(), savedLook: new Vector3(), parallax: new Vector3(), desired: new Vector3(), right: new Vector3(), up: new Vector3(), hit: new Vector3(), pointer: new Vector2(), raycaster: new Raycaster(), plane: new Plane() }), [camera]);
  const transition = useRef({ elapsed: 0, active: false, id: destination, serial: flight });
  const input = useRef({ moved: false, active: false, blocked: false });
  const latest = useRef({ mobile, paused, aspect: size.width / size.height, onArrive });
  useEffect(() => { latest.current = { mobile, paused, aspect: size.width / size.height, onArrive }; }, [mobile, paused, size.width, size.height, onArrive]);

  const actions = useMemo(() => {
    const stripParallax = () => {
      camera.position.sub(vectors.parallax);
      vectors.parallax.set(0, 0, 0);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();
    };
    const settle = () => {
      vectors.saved.copy(camera.position);
      vectors.savedLook.copy(controls.target);
      controls.enableDamping = false;
      controls.update();
      camera.position.copy(vectors.saved);
      controls.target.copy(vectors.savedLook);
      controls.update();
      controls.enableDamping = !latest.current.paused;
    };
    const arrive = () => {
      const state = transition.current;
      if (!state.active) return;
      state.active = false;
      runtime.current.moving = false;
      latest.current.onArrive(state.id, state.serial);
    };
    const beginInput = () => {
      stripParallax();
      input.current.moved = true;
      arrive();
      invalidate();
    };
    return { stripParallax, settle, arrive, beginInput };
  }, [camera, controls, invalidate, runtime, vectors]);

  useEffect(() => {
    Object.assign(controls, CAMERA_LIMITS, { enableDamping: !latest.current.paused, dampingFactor: .12, rotateSpeed: .55, panSpeed: .75, zoomSpeed: .85, screenSpacePanning: false, zoomToCursor: true });
    controls.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };
    controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };
    controls.target.fromArray((latest.current.mobile ? world.mobileOverview : world.overview).target);
    controls.update();
    const previousControls = get().controls;
    set({ controls: controls as unknown as RootState['controls'] });
    const onChange = () => {
      if (!transition.current.active) clipCameraTravel(vectors.accepted, camera.position, obstacles);
      constrainCameraPose(camera.position, controls.target, obstacles);
      vectors.accepted.copy(camera.position);
      camera.lookAt(controls.target);
      invalidate();
    };
    const onStart = () => { input.current.active = true; actions.beginInput(); };
    const onEnd = () => { input.current.active = false; invalidate(); };
    controls.addEventListener('change', onChange);
    controls.addEventListener('start', onStart);
    controls.addEventListener('end', onEnd);
    const element = gl.domElement;
    const document = element.ownerDocument;
    // The test renderer has no DOM owner; the same controls still accept deliberate commands.
    if (!document?.addEventListener) return () => {
      controls.removeEventListener('change', onChange);
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
      set({ controls: previousControls });
    };
    const previousTouchAction = element.style.touchAction;
    const pointers = new Set<number>();
    const hits: Intersection[] = [];
    const pickRay = (event: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      vectors.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      camera.updateMatrixWorld();
      vectors.raycaster.setFromCamera(vectors.pointer, camera);
    };
    const onPointerDown = (event: PointerEvent) => {
      pickRay(event);
      if (pointers.size === 0) {
        const objects: Object3D[] = [];
        for (const item of world.landmarks) {
          const object = scene.getObjectByName(`landmark-${item.id}`);
          if (object) objects.push(object);
        }
        const sculpture = scene.getObjectByName('reflective-object');
        if (sculpture) objects.push(sculpture);
        hits.length = 0;
        vectors.raycaster.intersectObjects(objects, true, hits);
        const groundHit = intersectTerrainRay(vectors.raycaster.ray, vectors.hit);
        input.current.blocked = runtime.current.dragging || Boolean(hits[0] && (!groundHit || hits[0].distance < vectors.raycaster.ray.origin.distanceTo(vectors.hit) + .2));
      }
      pointers.add(event.pointerId);
      controls.enabled = !input.current.blocked;
      if (controls.enabled) actions.stripParallax();
    };
    const onPointerMove = () => { if (input.current.active) actions.stripParallax(); };
    const onPointerEnd = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size === 0) {
        input.current.blocked = false;
        input.current.active = false;
        controls.enabled = true;
      }
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (runtime.current.dragging) return;
      pickRay(event);
      if (!intersectTerrainRay(vectors.raycaster.ray, vectors.hit)) {
        camera.getWorldDirection(vectors.desired);
        vectors.plane.setFromNormalAndCoplanarPoint(vectors.desired, controls.target);
        if (!vectors.raycaster.ray.intersectPlane(vectors.plane, vectors.hit)) return;
      }
      actions.beginInput();
      actions.settle();
      vectors.previous.copy(camera.position);
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      zoomTowardPoint(camera.position, controls.target, vectors.hit, Math.exp(Math.max(-.28, Math.min(.28, pixels * .0011))));
      clipCameraTravel(vectors.previous, camera.position, obstacles);
      constrainCameraPose(camera.position, controls.target, obstacles);
      controls.update();
      invalidate();
    };
    const cancelPointers = () => {
      // Feed each owned pointer through the controls' supported cancellation listener.
      for (const pointerId of pointers) element.dispatchEvent(new PointerEvent('pointercancel', { pointerId, bubbles: false }));
      pointers.clear();
      input.current.active = false;
      input.current.blocked = false;
      controls.enabled = true;
      actions.stripParallax();
      actions.settle();
    };
    element.addEventListener('pointerdown', onPointerDown, true);
    element.addEventListener('wheel', onWheel, { capture: true, passive: false });
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerEnd, true);
    document.addEventListener('pointercancel', onPointerEnd, true);
    document.defaultView?.addEventListener('blur', cancelPointers);
    controls.connect(element);
    return () => {
      cancelPointers();
      element.removeEventListener('pointerdown', onPointerDown, true);
      element.removeEventListener('wheel', onWheel, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', onPointerEnd, true);
      document.removeEventListener('pointercancel', onPointerEnd, true);
      document.defaultView?.removeEventListener('blur', cancelPointers);
      controls.removeEventListener('change', onChange);
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
      controls.dispose();
      element.style.touchAction = previousTouchAction;
      set({ controls: previousControls });
    };
  }, [actions, camera, controls, get, gl, invalidate, obstacles, runtime, scene, set, vectors]);

  useEffect(() => {
    actions.stripParallax();
    actions.settle();
    const pose = focusPose(destination, latest.current.mobile, latest.current.aspect);
    vectors.start.copy(camera.position);
    vectors.startLook.copy(controls.target);
    vectors.end.fromArray(pose.position);
    vectors.endLook.fromArray(pose.target);
    transition.current = { elapsed: 0, active: true, id: destination, serial: flight };
    input.current.moved = false;
    runtime.current.moving = true;
    invalidate();
  }, [actions, camera, controls, destination, flight, invalidate, runtime, vectors]);

  useEffect(() => {
    if (input.current.moved) return;
    const pose = focusPose(transition.current.id, mobile, size.width / size.height);
    vectors.end.fromArray(pose.position);
    vectors.endLook.fromArray(pose.target);
    if (!transition.current.active) {
      actions.stripParallax();
      camera.position.copy(vectors.end);
      controls.target.copy(vectors.endLook);
      controls.update();
    }
    invalidate();
  }, [actions, camera, controls, invalidate, mobile, size.width, size.height, vectors]);

  useEffect(() => {
    actions.stripParallax();
    actions.settle();
    invalidate();
  }, [actions, paused, invalidate]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, .05);
    actions.stripParallax();
    vectors.previous.copy(camera.position);
    const state = transition.current;
    if (state.active) {
      state.elapsed = paused ? world.flightSeconds : state.elapsed + dt;
      const t = flightEase(state.elapsed / world.flightSeconds);
      camera.position.lerpVectors(vectors.start, vectors.end, t);
      controls.target.lerpVectors(vectors.startLook, vectors.endLook, t);
      constrainCameraPose(camera.position, controls.target, obstacles);
      controls.update();
      camera.updateMatrixWorld();
      if (t >= 1) actions.arrive();
      else invalidate();
      return;
    }
    controls.enabled = !input.current.blocked && !runtime.current.dragging;
    if (controls.enabled) {
      controls.dampingFactor = 1 - Math.exp(-10 * dt);
      controls.update();
      clipCameraTravel(vectors.previous, camera.position, obstacles);
      constrainCameraPose(camera.position, controls.target, obstacles);
    }
    camera.lookAt(controls.target);
    runtime.current.moving = input.current.active || vectors.previous.distanceToSquared(camera.position) > .00001;
    vectors.accepted.copy(camera.position);
    const parallaxEnabled = !paused && !runtime.current.dragging && !input.current.active && runtime.current.pointerActive;
    vectors.pointer.set(parallaxEnabled ? runtime.current.pointer[0] : 0, parallaxEnabled ? runtime.current.pointer[1] : 0);
    vectors.parallaxMotion.lerp(vectors.pointer, paused ? 1 : 1 - Math.exp(-8 * dt));
    if (!paused && !runtime.current.dragging && !input.current.active) {
      camera.updateMatrixWorld();
      vectors.right.setFromMatrixColumn(camera.matrix, 0);
      vectors.up.setFromMatrixColumn(camera.matrix, 1);
      vectors.parallax.copy(vectors.right).multiplyScalar(vectors.parallaxMotion.x * (mobile ? .12 : .32)).addScaledVector(vectors.up, vectors.parallaxMotion.y * .16);
      vectors.saved.copy(camera.position);
      camera.position.add(vectors.parallax);
      clipCameraTravel(vectors.saved, camera.position, obstacles);
      constrainCameraPose(camera.position, controls.target, obstacles);
      vectors.parallax.copy(camera.position).sub(vectors.saved);
      camera.lookAt(controls.target);
    }
    camera.updateMatrixWorld();
  }, -1);
  return null;
}
