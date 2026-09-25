import test from 'node:test';
import assert from 'node:assert/strict';
import { useEffect } from 'react';
import { create, act, type ReactThreeTest } from '@react-three/test-renderer';
import { useThree, type RootState } from '@react-three/fiber';
import { PerspectiveCamera, Ray, TOUCH, Vector3 } from 'three';
import { OrbitControls } from 'three-stdlib';
import { CameraDirector } from '../src/components/world/CameraDirector';
import { CAMERA_LIMITS, CAMERA_WORLD_BOUNDS, CAMERA_TARGET_BOUNDS, normalizedWheelZoom, cameraObstacles, clipCameraTravel, constrainCameraPose, focusPose, intersectTerrainRay, zoomTowardPoint } from '../src/components/world/cameraControls';
import { terrainHeight, terrainMeshHeight } from '../src/components/world/terrain';
import { createSceneRuntime, world, type LandmarkId } from '../src/content/world';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function assertSafe(position: Vector3, target: Vector3, obstacles = cameraObstacles()) {
  const offset = position.clone().sub(target);
  const polar = Math.atan2(Math.hypot(offset.x, offset.z), offset.y);
  assert.ok(offset.length() >= CAMERA_LIMITS.minDistance - 1e-6 && offset.length() <= CAMERA_LIMITS.maxDistance + 1e-6, `Distance ${offset.length()} is bounded.`);
  assert.ok(polar >= CAMERA_LIMITS.minPolarAngle - 1e-6 && polar <= CAMERA_LIMITS.maxPolarAngle + 1e-6, `Polar angle ${polar} is bounded.`);
  assert.ok(position.y >= Math.max(CAMERA_LIMITS.minY, terrainMeshHeight(position.x, position.z) + 1.15) - 1e-6, 'The near plane clears terrain and water.');
  for (const obstacle of obstacles) {
    assert.ok(position.y >= obstacle.top - 1e-6 || Math.hypot(position.x - obstacle.x, position.z - obstacle.z) >= obstacle.radius - 1e-6, 'The camera clears every structural obstacle.');
  }
}

test('camera bounds hold for extreme orbit, pan and zoom poses', () => {
  const obstacles = cameraObstacles();
  for (let index = 0; index < 1200; index++) {
    const position = new Vector3(Math.sin(index * 7.31) * 130, Math.cos(index * 1.17) * 120, Math.sin(index * 3.21) * 170);
    const target = new Vector3(Math.cos(index * 2.8) * 100, Math.sin(index * .19) * 40, Math.cos(index * 1.9) * 150);
    constrainCameraPose(position, target, obstacles);
    assertSafe(position, target);
    assert.ok(target.x >= -110 && target.x <= 80 && target.z >= -120 && target.z <= 60);
  }
});

test('fast travel cannot tunnel through structure envelopes', () => {
  const from = new Vector3(-12, 4, 0);
  const to = new Vector3(12, 4, 0);
  clipCameraTravel(from, to, [{ x: 0, z: 0, radius: 3, top: 7 }]);
  assert.ok(to.x < -3 && to.x > -3.1);
  const over = new Vector3(12, 9, 0);
  clipCameraTravel(new Vector3(-12, 9, 0), over, [{ x: 0, z: 0, radius: 3, top: 7 }]);
  assert.equal(over.x, 12);
});

test('wheel zoom preserves the terrain point under the cursor until a safety bound is reached', () => {
  const camera = new PerspectiveCamera(43, 1.6, .1, 500);
  camera.position.set(23, 15, 34);
  const target = new Vector3(0, 3, -7);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  const ray = new Ray(camera.position.clone(), new Vector3(2, 0, 9).sub(camera.position).normalize());
  const hit = new Vector3();
  assert.ok(intersectTerrainRay(ray, hit));
  assert.ok(Math.abs(hit.y - Math.max(0, terrainMeshHeight(hit.x, hit.z))) < .001);
  const before = hit.clone().project(camera);
  zoomTowardPoint(camera.position, target, hit, .82);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  const after = hit.clone().project(camera);
  assert.ok(Math.hypot(before.x - after.x, before.y - after.y) < 1e-10);
  zoomTowardPoint(camera.position, target, hit, .0001);
  assert.ok(Math.abs(camera.position.distanceTo(target) - CAMERA_LIMITS.minDistance) < 1e-8);
  zoomTowardPoint(camera.position, target, hit, 1e5);
  assert.ok(Math.abs(camera.position.distanceTo(target) - CAMERA_LIMITS.maxDistance) < 1e-8);
});

test('each destination fits left of desktop content and above the mobile sheet', () => {
  for (const mobile of [false, true]) for (const landmark of world.landmarks) {
    const aspect = mobile ? 390 / 844 : 1440 / 900;
    const pose = focusPose(landmark.id, mobile, aspect);
    const camera = new PerspectiveCamera(43, aspect, .1, 500);
    camera.position.fromArray(pose.position);
    const target = new Vector3(...pose.target);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    assertSafe(camera.position, target);
    const center = new Vector3(...landmark.position);
    center.y += terrainHeight(center.x, center.z) + ({ work: 6, experience: 5, research: 4, purdue: 3, history: 6, about: 4, contact: 4, arcade: 4.6, building: 6 }[landmark.id]) * .45;
    center.project(camera);
    if (mobile) assert.ok(center.y > .34 && center.y < .9, `${landmark.id} projects above the sheet (${center.y}).`);
    else assert.ok(center.x < -.25 && center.x > -.65, `${landmark.id} remains left of the panel (${center.x}).`);
  }
});

class MockSurface extends EventTarget {
  style = { touchAction: 'pan-y' };
  wheelListeners = new Set<EventListenerOrEventListenerObject>();
  addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) { if (type === 'wheel' && callback) this.wheelListeners.add(callback); super.addEventListener(type, callback, options); }
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) { if (type === 'wheel' && callback) this.wheelListeners.delete(callback); super.removeEventListener(type, callback, options); }
  clientWidth = 1440;
  clientHeight = 900;
  ownerDocument: MockSurface = this;
  defaultView: MockSurface | null = null;
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
  releasePointerCapture() {}
}

function pointer(surface: MockSurface, type: string, x: number, y: number, pointerId = 1, pointerType = 'mouse', options: { button?: number; shiftKey?: boolean } = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { clientX: x, clientY: y, pageX: x, pageY: y, pointerId, pointerType, button: 0, ...options });
  if (type === 'pointercancel' && surface.ownerDocument !== surface) surface.ownerDocument.dispatchEvent(event);
  surface.dispatchEvent(event);
}

async function advance(renderer: ReactThreeTest.Renderer, frames: number) {
  await act(async () => { for (let frame = 0; frame < frames; frame++) await renderer.advanceFrames(1, 1 / 60); });
}

async function fixture(paused = false, interactive = false) {
  let root: (() => RootState) | undefined;
  const canvas = new MockSurface();
  const document = new MockSurface();
  canvas.ownerDocument = document;
  document.defaultView = document;
  const runtime = { current: createSceneRuntime() };
  const arrivals: string[] = [];
  const onArrive = (id: LandmarkId | '', serial: number) => arrivals.push(`${id}:${serial}`);
  function Probe() {
    const get = useThree(state => state.get);
    useEffect(() => { root = get; Object.assign(get().gl, { domElement: canvas }); }, [get]);
    return null;
  }
  const render = (destination: LandmarkId | '' = 'work', flight = 1, panelOpen = false, stopped = paused) => <><Probe />{interactive && <group name="reflective-object" position={[-8, 3.5, 0]}><mesh><sphereGeometry args={[2, 16, 12]} /><meshBasicMaterial /></mesh></group>}<CameraDirector destination={destination} flight={flight} panelOpen={panelOpen} paused={stopped} mobile={false} runtime={runtime} onArrive={onArrive} /></>;
  // Supply the same ESM Three camera used by controls; the Node test renderer loads Three through CJS.
  const camera = new PerspectiveCamera(43, 1440 / 900, .1, 500);
  camera.position.fromArray(world.overview.position);
  const renderer = await create(render(), { width: 1440, height: 900, camera });
  assert.ok(root);
  return { renderer, render, canvas, document, runtime, arrivals, root, controls: () => root!().controls as unknown as OrbitControls };
}

test('orbit and zoom remain free after focusing with content open, and scroll cannot restore a route', async t => {
  const f = await fixture(true);
  t.after(() => f.renderer.unmount());
  await advance(f.renderer, 1);
  assert.deepEqual(f.arrivals, ['work:1']);
  await f.renderer.update(f.render('work', 1, true));
  const focused = f.root().camera.position.clone();
  pointer(f.canvas, 'pointerdown', 700, 500);
  pointer(f.document, 'pointermove', 950, 530);
  pointer(f.document, 'pointerup', 950, 530);
  await advance(f.renderer, 1);
  assert.ok(f.root().camera.position.distanceTo(focused) > 3, 'A deliberate orbit works while reduced motion and a panel are active.');
  const adjusted = f.root().camera.position.clone();
  Object.assign(f.runtime.current, { scroll: 1 });
  f.runtime.current.pointer = [1, -1];
  await f.renderer.update(f.render('work', 1, false));
  await advance(f.renderer, 80);
  assert.ok(f.root().camera.position.distanceTo(adjusted) < 1e-7, 'Panel state and old scroll data cannot overwrite the view.');
  assert.deepEqual(f.arrivals, ['work:1']);
  const distance = f.controls().getDistance();
  const wheel = new Event('wheel', { cancelable: true });
  Object.assign(wheel, { clientX: 700, clientY: 600, deltaY: -150, deltaMode: 0 });
  f.canvas.dispatchEvent(wheel);
  await advance(f.renderer, 1);
  assert.ok(f.controls().getDistance() < distance, 'Wheel zoom remains available in reduced motion.');
});

test('a gesture interrupts focus once and a subsequent destination still arrives once', async t => {
  const f = await fixture();
  t.after(() => f.renderer.unmount());
  await advance(f.renderer, 12);
  pointer(f.canvas, 'pointerdown', 700, 500);
  pointer(f.document, 'pointermove', 820, 500);
  pointer(f.document, 'pointerup', 820, 500);
  await advance(f.renderer, 90);
  assert.deepEqual(f.arrivals, ['work:1']);
  const position = f.root().camera.position.clone();
  await f.renderer.update(f.render('research', 2, true));
  assert.ok(f.root().camera.position.distanceTo(position) < 1e-7);
  await advance(f.renderer, 48);
  assert.deepEqual(f.arrivals, ['work:1', 'research:2']);
  assertSafe(f.root().camera.position, f.controls().target);
});

test('two-finger spreading zooms in and cancellation leaves single-finger orbit usable', async t => {
  const f = await fixture(true);
  t.after(() => f.renderer.unmount());
  await advance(f.renderer, 1);
  assert.equal(f.controls().touches.TWO, TOUCH.DOLLY_PAN);
  assert.equal(f.canvas.style.touchAction, 'none');
  const distance = f.controls().getDistance();
  pointer(f.canvas, 'pointerdown', 600, 500, 1, 'touch');
  pointer(f.canvas, 'pointerdown', 800, 500, 2, 'touch');
  pointer(f.document, 'pointermove', 550, 500, 1, 'touch');
  pointer(f.document, 'pointermove', 850, 500, 2, 'touch');
  assert.ok(f.controls().getDistance() < distance, 'Spreading fingers approaches the world.');
  pointer(f.canvas, 'pointercancel', 550, 500, 1, 'touch');
  pointer(f.canvas, 'pointercancel', 850, 500, 2, 'touch');
  const before = f.root().camera.position.clone();
  pointer(f.canvas, 'pointerdown', 700, 500, 3, 'touch');
  pointer(f.document, 'pointermove', 850, 500, 3, 'touch');
  pointer(f.document, 'pointerup', 850, 500, 3, 'touch');
  assert.ok(f.root().camera.position.distanceTo(before) > 1);
  await f.renderer.unmount();
  assert.equal(f.canvas.style.touchAction, 'pan-y');
});

test('sculpture gestures do not also orbit, and empty-world dragging resumes after release', async t => {
  const f = await fixture(true, true);
  t.after(() => f.renderer.unmount());
  await advance(f.renderer, 1);
  f.root().scene.updateMatrixWorld(true);
  f.root().camera.updateMatrixWorld();
  const point = new Vector3(-8, 3.5, 0).project(f.root().camera);
  const x = (point.x * .5 + .5) * f.canvas.clientWidth;
  const y = (-point.y * .5 + .5) * f.canvas.clientHeight;
  const before = f.root().camera.position.clone();
  pointer(f.canvas, 'pointerdown', x, y);
  assert.equal(f.controls().enabled, false, 'Object ownership is decided before the drag threshold.');
  f.runtime.current.dragging = true;
  pointer(f.document, 'pointermove', x + 160, y);
  await advance(f.renderer, 1);
  assert.ok(f.root().camera.position.distanceTo(before) < 1e-7);
  f.runtime.current.dragging = false;
  pointer(f.document, 'pointerup', x + 160, y);
  pointer(f.canvas, 'pointerdown', 1350, 200);
  pointer(f.document, 'pointermove', 1130, 240);
  pointer(f.document, 'pointerup', 1130, 240);
  assert.ok(f.root().camera.position.distanceTo(before) > 1);
});

test('resizing reframes an untouched destination but preserves a deliberately adjusted pose', async t => {
  const f = await fixture(true);
  t.after(() => f.renderer.unmount());
  await advance(f.renderer, 1);
  await act(async () => { f.root().setSize(1100, 900); });
  await advance(f.renderer, 1);
  const expected = new Vector3(...focusPose('work', false, 1100 / 900).position);
  assert.ok(f.root().camera.position.distanceTo(expected) < 1e-7);
  pointer(f.canvas, 'pointerdown', 700, 500);
  pointer(f.document, 'pointermove', 920, 510);
  pointer(f.document, 'pointerup', 920, 510);
  await advance(f.renderer, 1);
  const adjusted = f.root().camera.position.clone();
  await act(async () => { f.root().setSize(1300, 800); });
  await advance(f.renderer, 1);
  assert.ok(f.root().camera.position.distanceTo(adjusted) < 1e-7);
  assert.deepEqual(f.arrivals, ['work:1']);
});


test('pointer parallax respects camera bounds and cannot accumulate orbit drift', async t => {
  const f = await fixture();
  t.after(() => f.renderer.unmount());
  await advance(f.renderer, 48);
  f.controls().target.set(-25, 0, 20);
  f.root().camera.position.set(-25, 3.5, 30);
  f.controls().update();
  const base = f.root().camera.position.clone();
  f.runtime.current.pointerActive = true;
  f.runtime.current.pointer = [.8, -1];
  await advance(f.renderer, 100);
  assertSafe(f.root().camera.position, f.controls().target);
  assert.ok(f.root().camera.position.distanceTo(base) < .4);
  f.runtime.current.pointerActive = false;
  await advance(f.renderer, 200);
  assert.ok(f.root().camera.position.distanceTo(base) < 1e-7, 'Parallax returns to the user view without shifting the orbit.');
});


test('overview keeps every primary structure inside the reviewed desktop and portrait widths', () => {
  const extents = { work: 4.93, experience: 4.4, research: 2.84, purdue: 1.16, history: 5.7, about: 1.66, contact: 1.76 };
  for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [390, 844]]) {
    const pose = focusPose('', width < 768, width / height);
    const camera = new PerspectiveCamera(43, width / height, .1, 500);
    camera.position.fromArray(pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld();
    for (const landmark of world.landmarks) {
      if (!(landmark.id in extents)) continue;
      const radius = extents[landmark.id as keyof typeof extents];
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const point = new Vector3(landmark.position[0] + Math.cos(angle) * radius, 2, landmark.position[2] + Math.sin(angle) * radius).project(camera);
        assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1, `${width}: ${landmark.id} remains visible`);
      }
    }
  }
});


test('portrait destination views retain the entrance and roof above the content panel', () => {
  const heights = { work: 11.25, experience: 5.9, research: 4.2, purdue: 3.25, history: 7.2, about: 3, contact: 5.44, arcade: 4.6, building: 7.8 };
  for (const landmark of world.landmarks) {
    const pose = focusPose(landmark.id, true, 390 / 844);
    const camera = new PerspectiveCamera(43, 390 / 844, .1, 500);
    camera.position.fromArray(pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld();
    assertSafe(camera.position, new Vector3(...pose.target));
    for (const height of [0, heights[landmark.id]]) {
      const point = new Vector3(landmark.position[0], terrainHeight(landmark.position[0], landmark.position[2]) + height, landmark.position[2]).project(camera);
      assert.ok(point.y > .34 && point.y < 1, `${landmark.id}: entrance and roof remain in the upper 33%`);
    }
  }
});


test('one wheel listener normalizes devices and eases pointer zoom without intercepting panel scroll', async t => {
  assert.equal(normalizedWheelZoom(-16, 0, 900), normalizedWheelZoom(-1, 1, 900));
  assert.equal(normalizedWheelZoom(-900, 0, 900), normalizedWheelZoom(-1, 2, 900));
  assert.equal(normalizedWheelZoom(Number.NaN, 0, 900), 0);
  const f = await fixture(); t.after(() => f.renderer.unmount()); await advance(f.renderer, 48);
  assert.equal(f.canvas.wheelListeners.size, 1);
  f.controls().target.set(0, 0, 0); f.root().camera.position.set(80, 45, 100); f.controls().update();
  const before = f.controls().getDistance();
  const wheel = new Event('wheel', { cancelable: true }); Object.assign(wheel, { clientX: 720, clientY: 450, deltaY: -150, deltaMode: 0 });
  f.canvas.dispatchEvent(wheel); assert.ok(wheel.defaultPrevented);
  assert.equal(f.controls().getDistance(), before, 'A wheel event queues motion rather than jumping immediately');
  await advance(f.renderer, 1); const first = f.controls().getDistance();
  assert.ok(first < before && first > before * Math.exp(-.165));
  await advance(f.renderer, 60);
  assert.ok(Math.abs(f.controls().getDistance() / before - Math.exp(-.165)) < .00001, 'One event is applied exactly once over its damping interval');
  const settled = f.root().camera.position.clone();
  const panelWheel = new Event('wheel', { cancelable: true }); Object.assign(panelWheel, { deltaY: 120 }); f.document.dispatchEvent(panelWheel);
  await advance(f.renderer, 30); assert.equal(panelWheel.defaultPrevented, false); assert.ok(f.root().camera.position.distanceTo(settled) < .00001);
  await f.renderer.unmount(); assert.equal(f.canvas.wheelListeners.size, 0);
});

test('right drag and Shift-left drag produce the same pan without rolling the horizon', async t => {
  const f = await fixture(true); t.after(() => f.renderer.unmount()); await advance(f.renderer, 1);
  const position = new Vector3(40, 25, 65), target = new Vector3(0, 2, 0);
  const poses: Vector3[] = [];
  for (const options of [{ button: 2 }, { button: 0, shiftKey: true }, { button: 2, shiftKey: true }]) {
    f.root().camera.position.copy(position); f.controls().target.copy(target); f.controls().update();
    pointer(f.canvas, 'pointerdown', 700, 500, 1, 'mouse', options); pointer(f.document, 'pointermove', 800, 560, 1, 'mouse', options); pointer(f.document, 'pointerup', 800, 560, 1, 'mouse', options);
    poses.push(f.root().camera.position.clone()); assert.ok(f.controls().target.distanceTo(target) > 1);
    const right = new Vector3().setFromMatrixColumn(f.root().camera.matrix, 0); assert.ok(Math.abs(right.y) < 1e-9);
  }
  assert.ok(poses[0].distanceTo(poses[1]) < 1e-8 && poses[0].distanceTo(poses[2]) < 1e-8);
});

test('touch baselines rebase on every finger-count change and blur releases gesture ownership', async t => {
  const f = await fixture(true); t.after(() => f.renderer.unmount()); await advance(f.renderer, 1);
  pointer(f.canvas, 'pointerdown', 650, 450, 1, 'touch'); pointer(f.document, 'pointermove', 680, 460, 1, 'touch');
  let pose = f.root().camera.position.clone();
  pointer(f.canvas, 'pointerdown', 850, 450, 2, 'touch'); pointer(f.document, 'pointermove', 850, 450, 2, 'touch');
  assert.ok(f.root().camera.position.distanceTo(pose) < 1e-7, 'Adding a second finger does not move the target');
  pointer(f.document, 'pointermove', 900, 460, 2, 'touch');
  pose = f.root().camera.position.clone(); pointer(f.document, 'pointerup', 900, 460, 2, 'touch'); pointer(f.document, 'pointermove', 680, 460, 1, 'touch');
  assert.ok(f.root().camera.position.distanceTo(pose) < 1e-7, 'Removing a finger preserves the remaining finger baseline');
  pointer(f.document, 'pointermove', 720, 460, 1, 'touch'); assert.ok(f.root().camera.position.distanceTo(pose) > .5);
  f.document.dispatchEvent(new Event('blur')); pose = f.root().camera.position.clone(); pointer(f.document, 'pointermove', 1000, 700, 1, 'touch');
  assert.ok(f.root().camera.position.distanceTo(pose) < 1e-7);
  pointer(f.canvas, 'pointerdown', 700, 450, 3, 'touch'); pointer(f.document, 'pointermove', 750, 450, 3, 'touch'); assert.ok(f.root().camera.position.distanceTo(pose) > .5);
});

test('prolonged mixed gestures stay bounded and every new overview flight recovers the camera', async t => {
  const f = await fixture(); t.after(() => f.renderer.unmount()); await advance(f.renderer, 48);
  const obstacles = cameraObstacles(); let serial = 1;
  for (let turn = 0; turn < 120; turn++) {
    const mode = turn % 3, options = mode === 1 ? { button: 2 } : mode === 2 ? { shiftKey: true } : {};
    pointer(f.canvas, 'pointerdown', 1340, 180, 1, 'mouse', options);
    pointer(f.document, 'pointermove', 1340 + Math.sin(turn * 1.7) * 380, 180 + Math.cos(turn * 2.3) * 150, 1, 'mouse', options);
    pointer(f.document, 'pointerup', 1340, 180, 1, 'mouse', options);
    const event = new Event('wheel', { cancelable: true }); Object.assign(event, { clientX: 900, clientY: 320, deltaY: Math.sin(turn * 3) * 600, deltaMode: turn % 11 === 0 ? 1 : 0 }); f.canvas.dispatchEvent(event);
    await advance(f.renderer, 4);
    const camera = f.root().camera, target = f.controls().target;
    assertSafe(camera.position, target, obstacles);
    assert.ok(camera.position.x >= CAMERA_WORLD_BOUNDS.minX && camera.position.x <= CAMERA_WORLD_BOUNDS.maxX);
    assert.ok(camera.position.z >= CAMERA_WORLD_BOUNDS.minZ && camera.position.z <= CAMERA_WORLD_BOUNDS.maxZ && camera.position.y <= CAMERA_WORLD_BOUNDS.maxY);
    assert.ok(target.x >= CAMERA_TARGET_BOUNDS.minX && target.x <= CAMERA_TARGET_BOUNDS.maxX && target.z >= CAMERA_TARGET_BOUNDS.minZ && target.z <= CAMERA_TARGET_BOUNDS.maxZ);
    assert.ok(Math.abs(new Vector3().setFromMatrixColumn(camera.matrix, 0).y) < 1e-8);
    if (turn % 15 === 14) {
      const id = world.landmarks[(turn / 15 | 0) % world.landmarks.length].id;
      await f.renderer.update(f.render(id, ++serial, true)); await advance(f.renderer, 48);
      await f.renderer.update(f.render('', ++serial)); await advance(f.renderer, 48);
      const expected = focusPose('', false, 1440 / 900);
      assert.ok(camera.position.distanceTo(new Vector3(...expected.position)) < 1e-6);
      assert.ok(target.distanceTo(new Vector3(...expected.target)) < 1e-6);
    }
  }
  await f.renderer.update(f.render('', ++serial)); await advance(f.renderer, 48);
  assert.ok(f.root().camera.position.distanceTo(new Vector3(...focusPose('', false, 1440 / 900).position)) < 1e-6);
  assert.equal(f.canvas.wheelListeners.size, 1, 'Destination changes never accumulate wheel handlers');
});


test('overview recovery cancels a held gesture and pending wheel motion', async t => {
  const f = await fixture(); t.after(() => f.renderer.unmount()); await advance(f.renderer, 48);
  pointer(f.canvas, 'pointerdown', 1340, 180, 1, 'touch'); pointer(f.document, 'pointermove', 1200, 250, 1, 'touch');
  const wheel = new Event('wheel', { cancelable: true }); Object.assign(wheel, { clientX: 900, clientY: 400, deltaY: -250, deltaMode: 0 }); f.canvas.dispatchEvent(wheel);
  await f.renderer.update(f.render('', 2));
  pointer(f.document, 'pointermove', 500, 800, 1, 'touch'); await advance(f.renderer, 60);
  const pose = focusPose('', false, 1440 / 900);
  assert.ok(f.root().camera.position.distanceTo(new Vector3(...pose.position)) < 1e-6);
  assert.ok(f.controls().target.distanceTo(new Vector3(...pose.target)) < 1e-6);
  assert.deepEqual(f.arrivals, ['work:1', ':2']);
});


test('static obstacle envelopes are reused and remain immutable across destination flights', () => {
  const obstacles = cameraObstacles();
  assert.equal(cameraObstacles(), obstacles);
  assert.ok(Object.isFrozen(obstacles));
  assert.ok(obstacles.every(Object.isFrozen));
  focusPose('work', false, 1.6); focusPose('research', true, .5);
  assert.equal(cameraObstacles(), obstacles);
});

test('decorative trees are permeable and cannot trap close zoom', () => {
  const obstacles = cameraObstacles();
  assert.ok(!obstacles.some(obstacle => Math.abs(obstacle.x + 4) < .01 && Math.abs(obstacle.z + 85) < .01), 'The city tree is not a hard camera obstacle.');
  assert.equal(CAMERA_LIMITS.minDistance, 5.5);
});

test('pointer rays intersect the rendered graded triangles rather than the analytic surface between vertices', () => {
  const x = -11.08, z = -63.72;
  const renderedHeight = terrainMeshHeight(x, z);
  assert.ok(Math.abs(renderedHeight - terrainHeight(x, z)) > .1, 'The crossing exercises a real grade interpolation difference');
  const hit = new Vector3(); const ray = new Ray(new Vector3(x, 12, z), new Vector3(0, -1, 0));
  assert.ok(intersectTerrainRay(ray, hit));
  assert.ok(Math.abs(hit.y - renderedHeight) < .0001);
  assert.equal(hit.x, x); assert.equal(hit.z, z);
});
