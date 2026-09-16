'use client';

/* Frame callbacks mutate retained scene resources outside React rendering. */
/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree, type RootState } from '@react-three/fiber';
import { MathUtils, Plane, Raycaster, TOUCH, Vector2, Vector3, type Intersection, type Object3D, type PerspectiveCamera } from 'three';
import { flightEase, world, type SceneRuntime, type WorldProps } from '@/content/world';
import { CAMERA_LIMITS, cameraObstacles, clipCameraTravel, constrainCameraPose, focusPose, intersectTerrainRay, normalizedWheelZoom, zoomTowardPoint } from './cameraControls';

type Props = Pick<WorldProps, 'destination' | 'flight' | 'mobile' | 'onArrive' | 'panelOpen' | 'paused'> & { runtime: MutableRefObject<SceneRuntime> };
interface PointerSample { x: number; y: number; type: string; pan: boolean }

export function CameraDirector({ destination, flight, mobile, onArrive, paused, runtime }: Props) {
  const { camera, gl, scene, invalidate, size, get, set } = useThree();
  const obstacles = useMemo(() => cameraObstacles(), []);
  const vectors = useMemo(() => ({ start: new Vector3(), startLook: new Vector3(), end: new Vector3(), endLook: new Vector3(), previous: new Vector3(), motionFrom: new Vector3(), parallaxMotion: new Vector2(), saved: new Vector3(), parallax: new Vector3(), desired: new Vector3(), right: new Vector3(), up: new Vector3(), hit: new Vector3(), zoomAnchor: new Vector3(), pointer: new Vector2(), raycaster: new Raycaster(), plane: new Plane() }), []);
  const controls = useMemo(() => {
    const target = new Vector3();
    return {
      target, enabled: true, touches: { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN },
      getDistance: () => camera.position.distanceTo(target),
      update: () => { constrainCameraPose(camera.position, target, obstacles); camera.up.set(0, 1, 0); camera.lookAt(target); camera.updateMatrixWorld(); },
    };
  }, [camera, obstacles]);
  const transition = useRef({ elapsed: 0, active: false, id: destination, serial: flight });
  const input = useRef({ moved: false, active: false, blocked: false, pointers: new Map<number, PointerSample>(), orbitX: 0, orbitY: 0, panX: 0, panY: 0, zoom: 0 });
  const latest = useRef({ mobile, paused, aspect: size.width / size.height, onArrive });
  useEffect(() => { latest.current = { mobile, paused, aspect: size.width / size.height, onArrive }; }, [mobile, paused, size.width, size.height, onArrive]);

  const actions = useMemo(() => {
    const stripParallax = () => { camera.position.sub(vectors.parallax); vectors.parallax.set(0, 0, 0); camera.lookAt(controls.target); camera.updateMatrixWorld(); };
    const settle = () => { const state = input.current; state.orbitX = state.orbitY = state.panX = state.panY = state.zoom = 0; controls.update(); };
    const arrive = () => {
      const state = transition.current;
      if (!state.active) return;
      state.active = false; runtime.current.moving = false; latest.current.onArrive(state.id, state.serial);
    };
    const beginInput = () => { stripParallax(); input.current.moved = true; arrive(); invalidate(); };
    const applyMotion = (fraction: number) => {
      const state = input.current;
      if (!controls.enabled || runtime.current.dragging) return false;
      if (Math.abs(state.orbitX) + Math.abs(state.orbitY) + Math.abs(state.panX) + Math.abs(state.panY) + Math.abs(state.zoom) < 1e-6) { state.orbitX = state.orbitY = state.panX = state.panY = state.zoom = 0; return false; }
      stripParallax(); vectors.motionFrom.copy(camera.position);
      const dx = camera.position.x - controls.target.x, dy = camera.position.y - controls.target.y, dz = camera.position.z - controls.target.z;
      const radius = Math.hypot(dx, dy, dz);
      const theta = Math.atan2(dx, dz) - state.orbitX * fraction;
      const phi = MathUtils.clamp(Math.atan2(Math.hypot(dx, dz), dy) - state.orbitY * fraction, CAMERA_LIMITS.minPolarAngle, CAMERA_LIMITS.maxPolarAngle);
      camera.position.set(controls.target.x + radius * Math.sin(phi) * Math.sin(theta), controls.target.y + radius * Math.cos(phi), controls.target.z + radius * Math.sin(phi) * Math.cos(theta));
      camera.lookAt(controls.target); camera.updateMatrixWorld();
      vectors.right.setFromMatrixColumn(camera.matrix, 0); vectors.up.set(vectors.right.z, 0, -vectors.right.x);
      vectors.desired.copy(vectors.right).multiplyScalar(-state.panX * fraction).addScaledVector(vectors.up, state.panY * fraction);
      camera.position.add(vectors.desired); controls.target.add(vectors.desired);
      if (state.zoom) zoomTowardPoint(camera.position, controls.target, vectors.zoomAnchor, Math.exp(state.zoom * fraction));
      const remainder = 1 - fraction;
      state.orbitX *= remainder; state.orbitY *= remainder; state.panX *= remainder; state.panY *= remainder; state.zoom *= remainder;
      clipCameraTravel(vectors.motionFrom, camera.position, obstacles); controls.update(); invalidate(); return true;
    };
    return { stripParallax, settle, arrive, beginInput, applyMotion };
  }, [camera, controls, invalidate, obstacles, runtime, vectors]);

  useEffect(() => {
    controls.target.fromArray((latest.current.mobile ? world.mobileOverview : world.overview).target); controls.update();
    if (typeof performance !== 'undefined') performance.mark('world:camera-ready');
    const previousControls = get().controls;
    set({ controls: controls as unknown as RootState['controls'] });
    const element = gl.domElement, document = element.ownerDocument;
    if (!document?.addEventListener) return () => { set({ controls: previousControls }); };
    const previousTouchAction = element.style.touchAction;
    element.style.touchAction = 'none';
    const hits: Intersection[] = [], objects: Object3D[] = [];
    const pickRay = (x: number, y: number) => {
      const rect = element.getBoundingClientRect();
      vectors.pointer.set((x - rect.left) / Math.max(1, rect.width) * 2 - 1, -(y - rect.top) / Math.max(1, rect.height) * 2 + 1);
      camera.updateMatrixWorld(); vectors.raycaster.setFromCamera(vectors.pointer, camera);
    };
    const pickAnchor = (x: number, y: number) => {
      pickRay(x, y);
      if (!intersectTerrainRay(vectors.raycaster.ray, vectors.zoomAnchor)) {
        camera.getWorldDirection(vectors.desired); vectors.plane.setFromNormalAndCoplanarPoint(vectors.desired, controls.target);
        if (!vectors.raycaster.ray.intersectPlane(vectors.plane, vectors.zoomAnchor)) vectors.zoomAnchor.copy(controls.target);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' && event.button !== 0 && event.button !== 2) return;
      const state = input.current;
      actions.stripParallax(); actions.settle();
      if (state.pointers.size === 0) {
        objects.length = 0;
        for (const item of world.landmarks) { const object = scene.getObjectByName(`landmark-${item.id}`); if (object) objects.push(object); }
        const sculpture = scene.getObjectByName('reflective-object'); if (sculpture) objects.push(sculpture);
        scene.traverse(object => { if (object.userData.cameraInteraction) objects.push(object); });
        pickRay(event.clientX, event.clientY); hits.length = 0; vectors.raycaster.intersectObjects(objects, true, hits);
        const groundHit = intersectTerrainRay(vectors.raycaster.ray, vectors.hit);
        state.blocked = runtime.current.dragging || (event.button !== 2 && !event.shiftKey && Boolean(hits[0] && (!groundHit || hits[0].distance < vectors.raycaster.ray.origin.distanceTo(vectors.hit) + .2)));
      }
      state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType, pan: event.button === 2 || event.shiftKey });
      controls.enabled = !state.blocked;
      if (controls.enabled) { state.active = true; actions.beginInput(); }
    };
    const onPointerMove = (event: PointerEvent) => {
      const state = input.current, pointer = state.pointers.get(event.pointerId);
      if (!pointer) return;
      if (!controls.enabled || state.blocked || runtime.current.dragging) { pointer.x = event.clientX; pointer.y = event.clientY; return; }
      actions.beginInput();
      const first = state.pointers.values().next().value!;
      let dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      const distance = camera.position.distanceTo(controls.target);
      const units = 2 * distance * Math.tan(((camera as PerspectiveCamera).fov ?? 43) * Math.PI / 360) / Math.max(1, element.clientHeight);
      if (pointer.type === 'touch' && state.pointers.size >= 2) {
        let second: PointerSample | undefined;
        for (const sample of state.pointers.values()) if (sample !== first) { second = sample; break; }
        if (!second || (pointer !== first && pointer !== second)) { pointer.x = event.clientX; pointer.y = event.clientY; return; }
        const previousDistance = Math.hypot(first.x - second.x, first.y - second.y);
        const beforeX = (first.x + second.x) / 2, beforeY = (first.y + second.y) / 2;
        pointer.x = event.clientX; pointer.y = event.clientY;
        const centerX = (first.x + second.x) / 2, centerY = (first.y + second.y) / 2;
        dx = centerX - beforeX; dy = centerY - beforeY;
        const nextDistance = Math.hypot(first.x - second.x, first.y - second.y);
        if (previousDistance > 4 && nextDistance > 4) { pickAnchor(centerX, centerY); state.zoom = MathUtils.clamp(state.zoom + Math.log(previousDistance / nextDistance), -1, 1); }
        state.panX += dx * units; state.panY += dy * units;
      } else {
        pointer.x = event.clientX; pointer.y = event.clientY;
        if (pointer.pan) { state.panX += dx * units * .85; state.panY += dy * units * .85; }
        else { state.orbitX += dx / Math.max(1, element.clientHeight) * Math.PI * 1.1; state.orbitY += dy / Math.max(1, element.clientHeight) * Math.PI * 1.1; }
      }
      actions.applyMotion(latest.current.paused ? 1 : .35);
    };
    const onPointerEnd = (event: PointerEvent) => {
      const state = input.current;
      if (!state.pointers.delete(event.pointerId)) return;
      // A remaining touch already has its current coordinates; discard old two-finger inertia.
      if (state.pointers.size || event.type === 'pointercancel') actions.settle();
      if (!state.pointers.size) { state.blocked = false; state.active = false; controls.enabled = true; }
      invalidate();
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (runtime.current.dragging || input.current.blocked) return;
      const amount = normalizedWheelZoom(event.deltaY, event.deltaMode, element.clientHeight);
      if (!amount) return;
      actions.beginInput(); pickAnchor(event.clientX, event.clientY);
      input.current.zoom = MathUtils.clamp(input.current.zoom + amount, -1, 1);
      if (latest.current.paused) actions.applyMotion(1);
      invalidate();
    };
    const cancelPointers = () => { input.current.pointers.clear(); input.current.active = input.current.blocked = false; controls.enabled = true; actions.stripParallax(); actions.settle(); };
    const contextMenu = (event: Event) => event.preventDefault();
    // This controller alone owns canvas input. Panel events never reach these listeners.
    element.addEventListener('pointerdown', onPointerDown, true);
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('contextmenu', contextMenu);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerEnd, true);
    document.addEventListener('pointercancel', onPointerEnd, true);
    element.addEventListener('pointercancel', onPointerEnd);
    document.defaultView?.addEventListener('blur', cancelPointers);
    return () => {
      cancelPointers(); element.style.touchAction = previousTouchAction;
      element.removeEventListener('pointerdown', onPointerDown, true); element.removeEventListener('wheel', onWheel); element.removeEventListener('contextmenu', contextMenu);
      document.removeEventListener('pointermove', onPointerMove, true); document.removeEventListener('pointerup', onPointerEnd, true); document.removeEventListener('pointercancel', onPointerEnd, true); element.removeEventListener('pointercancel', onPointerEnd);
      document.defaultView?.removeEventListener('blur', cancelPointers); set({ controls: previousControls });
    };
  }, [actions, camera, controls, get, gl, invalidate, runtime, scene, set, vectors]);

  useEffect(() => {
    actions.stripParallax(); actions.settle();
    // An explicit destination/recovery also ends any gesture that was still held.
    input.current.pointers.clear(); input.current.active = input.current.blocked = false; controls.enabled = true;
    const pose = focusPose(destination, latest.current.mobile, latest.current.aspect);
    vectors.start.copy(camera.position); vectors.startLook.copy(controls.target); vectors.end.fromArray(pose.position); vectors.endLook.fromArray(pose.target);
    transition.current = { elapsed: 0, active: true, id: destination, serial: flight };
    input.current.moved = false; runtime.current.moving = true; invalidate();
  }, [actions, camera, controls, destination, flight, invalidate, runtime, vectors]);
  useEffect(() => {
    if (input.current.moved) return;
    const pose = focusPose(transition.current.id, mobile, size.width / size.height);
    vectors.end.fromArray(pose.position); vectors.endLook.fromArray(pose.target);
    if (!transition.current.active) { actions.stripParallax(); camera.position.copy(vectors.end); controls.target.copy(vectors.endLook); controls.update(); }
    invalidate();
  }, [actions, camera, controls, invalidate, mobile, size.width, size.height, vectors]);
  useEffect(() => { actions.stripParallax(); actions.settle(); invalidate(); }, [actions, paused, invalidate]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, .05);
    actions.stripParallax(); vectors.previous.copy(camera.position);
    const state = transition.current;
    if (state.active) {
      state.elapsed = paused ? world.flightSeconds : state.elapsed + dt;
      const t = flightEase(state.elapsed / world.flightSeconds);
      camera.position.lerpVectors(vectors.start, vectors.end, t); controls.target.lerpVectors(vectors.startLook, vectors.endLook, t); controls.update();
      if (t >= 1) actions.arrive(); else invalidate();
      return;
    }
    controls.enabled = !input.current.blocked && !runtime.current.dragging;
    const moving = actions.applyMotion(paused ? 1 : 1 - Math.exp(-18 * dt));
    controls.update();
    runtime.current.moving = input.current.active || moving || vectors.previous.distanceToSquared(camera.position) > .00001;
    const parallaxEnabled = !paused && !runtime.current.dragging && !input.current.active && !moving && runtime.current.pointerActive;
    vectors.pointer.set(parallaxEnabled ? runtime.current.pointer[0] : 0, parallaxEnabled ? runtime.current.pointer[1] : 0);
    vectors.parallaxMotion.lerp(vectors.pointer, paused ? 1 : 1 - Math.exp(-8 * dt));
    if (!paused && !runtime.current.dragging && !input.current.active && !moving) {
      camera.updateMatrixWorld(); vectors.right.setFromMatrixColumn(camera.matrix, 0); vectors.up.setFromMatrixColumn(camera.matrix, 1);
      vectors.parallax.copy(vectors.right).multiplyScalar(vectors.parallaxMotion.x * (mobile ? .12 : .32)).addScaledVector(vectors.up, vectors.parallaxMotion.y * .16);
      vectors.saved.copy(camera.position); camera.position.add(vectors.parallax); clipCameraTravel(vectors.saved, camera.position, obstacles); controls.update();
      vectors.parallax.copy(camera.position).sub(vectors.saved);
    }
    camera.updateMatrixWorld();
  }, -1);
  return null;
}
