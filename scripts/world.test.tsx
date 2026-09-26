import test from 'node:test';
import assert from 'node:assert/strict';
import { useEffect, type MutableRefObject } from 'react';
import { create, act, type ReactThreeTest } from '@react-three/test-renderer';
import { useFrame, useThree, type RootState } from '@react-three/fiber';
import { Vector3, type Mesh, type ShaderMaterial, type PlaneGeometry } from 'three';
import { CameraDirector } from '../src/components/world/CameraDirector';
import { focusPose } from '../src/components/world/cameraControls';
import { Landmark } from '../src/components/world/Landmark';
import { Water } from '../src/components/world/Water';
import { QualityController } from '../src/components/world/QualityController';
import { createSceneRuntime, flightEase, lowerQuality, motionPolicy, world, type LandmarkId, type QualityTier } from '../src/content/world';
import type { SectionId } from '../src/content/profile';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type Renderer = ReactThreeTest.Renderer;
type GetRoot = () => RootState;

function RootProbe({ capture }: { capture: (get: GetRoot) => void }) {
  const get = useThree(state => state.get);
  useEffect(() => capture(get), [capture, get]);
  return null;
}

async function advance(renderer: Renderer, frames: number, delta = 1 / 60) {
  // Advance subscribers together; the test renderer otherwise batches frames per subscriber.
  await act(async () => {
    for (let frame = 0; frame < frames; frame++) await renderer.advanceFrames(1, delta);
  });
}

async function recoverPerformance() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
}

async function flightFixture(destination: SectionId, paused = false) {
  const runtime = { current: createSceneRuntime() };
  const arrivals: { id: SectionId | ''; serial: number }[] = [];
  let root: GetRoot | undefined;
  const capture = (get: GetRoot) => { root = get; };
  const onArrive = (id: SectionId | '', serial: number) => { arrivals.push({ id, serial }); };
  const render = (id: SectionId, serial: number, stopped = false) => <>
    <RootProbe capture={capture} />
    <CameraDirector destination={id} flight={serial} mobile={false} panelOpen={false} paused={stopped} runtime={runtime} onArrive={onArrive} />
  </>;
  const renderer = await create(render(destination, 1, paused), {
    width: 1440,
    height: 900,
    camera: { position: world.overview.position, fov: 43 },
    performance: { min: 0.7, max: 1, debounce: 15 },
  });
  assert.ok(root, 'The scene exposes its renderer state.');
  return { renderer, render, runtime, arrivals, getRoot: root };
}

test('camera arrives after 800 ms once, even after performance regression and recovery', async t => {
  const fixture = await flightFixture('work');
  t.after(() => fixture.renderer.unmount());
  assert.equal(world.flightSeconds, 0.8);
  await advance(fixture.renderer, 47);
  assert.deepEqual(fixture.arrivals, []);
  await advance(fixture.renderer, 1);
  assert.deepEqual(fixture.arrivals, [{ id: 'work', serial: 1 }]);
  const expected = new Vector3(...focusPose('work', false, 1440 / 900).position);
  assert.ok(fixture.getRoot().camera.position.distanceTo(expected) < 1e-8);
  assert.equal(fixture.runtime.current.moving, false);

  await recoverPerformance();
  assert.equal(fixture.getRoot().performance.current, 1);
  await act(async () => { fixture.getRoot().performance.regress(); });
  await recoverPerformance();
  await advance(fixture.renderer, 100);
  assert.deepEqual(fixture.arrivals, [{ id: 'work', serial: 1 }], 'Performance state changes cannot restart a completed flight.');
  assert.ok(fixture.getRoot().camera.position.distanceTo(expected) < 1e-8);
});

test('a new destination cancels the prior flight without a camera discontinuity', async t => {
  const fixture = await flightFixture('work');
  t.after(() => fixture.renderer.unmount());
  await advance(fixture.renderer, 20);
  const interruptedPosition = fixture.getRoot().camera.position.clone();
  await fixture.renderer.update(fixture.render('research', 2));
  assert.ok(fixture.getRoot().camera.position.distanceTo(interruptedPosition) < 1e-8);
  await advance(fixture.renderer, 47);
  assert.deepEqual(fixture.arrivals, []);
  await advance(fixture.renderer, 1);
  assert.deepEqual(fixture.arrivals, [{ id: 'research', serial: 2 }]);
  await recoverPerformance();
  await advance(fixture.renderer, 100);
  assert.deepEqual(fixture.arrivals, [{ id: 'research', serial: 2 }]);
});

test('paused navigation arrives immediately and keeps its pose frozen', async t => {
  const fixture = await flightFixture('purdue', true);
  t.after(() => fixture.renderer.unmount());
  await advance(fixture.renderer, 1);
  assert.deepEqual(fixture.arrivals, [{ id: 'purdue', serial: 1 }]);
  assert.equal(fixture.runtime.current.moving, false);
  const expected = new Vector3(...focusPose('purdue', false, 1440 / 900).position);
  assert.ok(fixture.getRoot().camera.position.distanceTo(expected) < 1e-8);
  const rotation = fixture.getRoot().camera.quaternion.clone();
  fixture.runtime.current.pointer = [1, -1];
  await recoverPerformance();
  await advance(fixture.renderer, 100);
  assert.deepEqual(fixture.arrivals, [{ id: 'purdue', serial: 1 }]);
  assert.ok(fixture.getRoot().camera.position.distanceTo(expected) < 1e-8);
  assert.ok(fixture.getRoot().camera.quaternion.toArray().every((value,index)=>Math.abs(value-rotation.toArray()[index])<1e-12), 'Paused rotation remains unchanged within floating-point normalization precision');
});

test('each landmark routes clicks to its semantic destination and ignores drags', async t => {
  const runtime = { current: createSceneRuntime() };
  const destinations: LandmarkId[] = [];
  const renderer = await create(<group>{world.landmarks.map(config => <Landmark key={config.id} config={config} runtime={runtime} paused={false} onNavigate={id => destinations.push(id)}><mesh><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial /></mesh></Landmark>)}</group>);
  t.after(() => renderer.unmount());
  for (const config of world.landmarks) {
    const landmark = renderer.scene.findByProps({ name: `landmark-${config.id}` });
    await renderer.fireEvent(landmark, 'pointerOver');
    assert.equal(runtime.current.hovered, config.id);
    await renderer.fireEvent(landmark, 'click', { delta: 0 });
    await renderer.fireEvent(landmark, 'click', { delta: 6 });
    await renderer.fireEvent(landmark, 'pointerOut');
      await new Promise(resolve => setTimeout(resolve, 140));
    assert.equal(runtime.current.hovered, null);
  }
  assert.deepEqual(destinations, world.landmarks.map(item => item.id));
});

test('water keeps finite geometry and ripple uniforms, ignores drags, and freezes while paused', async () => {
  for (const quality of ['high', 'medium', 'low'] as QualityTier[]) {
    const runtime = { current: createSceneRuntime() };
    const renderer = await create(<Water runtime={runtime} paused={false} quality={quality} />);
    try {
      const water = renderer.scene.findByType('Mesh');
      const mesh = water.instance as Mesh<PlaneGeometry, ShaderMaterial>;
      assert.ok(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite));
      runtime.current.elapsed = 3;
      await renderer.fireEvent(water, 'click', { delta: 0, point: new Vector3(3, 0, -4) });
      await advance(renderer, 1);
      assert.deepEqual(mesh.material.uniforms.uRipple.value.toArray(), [3, -4, 0, 1]);
      assert.equal(mesh.material.uniforms.uTime.value, 3 * world.environment.waterSpeed);
      runtime.current.elapsed = 3.5;
      await advance(renderer, 1);
      assert.deepEqual(mesh.material.uniforms.uRipple.value.toArray(), [3, -4, 0.5, 1]);
      await renderer.fireEvent(water, 'click', { delta: 6, point: new Vector3(100, 0, 100) });
      assert.equal(runtime.current.ripple.serial, 1);

      await renderer.update(<Water runtime={runtime} paused quality={quality} />);
      const frozenTime = mesh.material.uniforms.uTime.value;
      const frozenRipple = mesh.material.uniforms.uRipple.value.toArray();
      runtime.current.elapsed = 9;
      await advance(renderer, 10);
      await renderer.fireEvent(water, 'click', { delta: 0, point: new Vector3(7, 0, 8) });
      assert.equal(mesh.material.uniforms.uTime.value, frozenTime);
      assert.deepEqual(mesh.material.uniforms.uRipple.value.toArray(), frozenRipple);
      assert.equal(runtime.current.ripple.serial, 1);
      assert.ok(frozenRipple.every(Number.isFinite));
    } finally {
      await renderer.unmount();
    }
  }
});

test('automatic reduced motion keeps a stable world while data and forced colors use semantic fallback', () => {
  for (let mask = 0; mask < 8; mask++) {
    const [reduced, saveData, forced] = [1, 2, 4].map(bit => Boolean(mask & bit));
    const enabled = !saveData && !forced;
    assert.deepEqual(motionPolicy(reduced, saveData, forced), { webgl: enabled, camera: enabled && !reduced, ambient: enabled && !reduced, physics: false });
  }
});

test('camera easing stays bounded and quality downgrades stop at low', () => {
  assert.equal(flightEase(-1), 0);
  assert.equal(flightEase(0), 0);
  assert.equal(flightEase(0.5), 0.5);
  assert.equal(flightEase(1), 1);
  assert.equal(flightEase(2), 1);
  let previous = 0;
  for (let index = 0; index <= 100; index++) {
    const value = flightEase(index / 100);
    assert.ok(value >= previous && value <= 1);
    previous = value;
  }
  assert.equal(lowerQuality('high'), 'medium');
  assert.equal(lowerQuality('medium'), 'low');
  assert.equal(lowerQuality('low'), 'low');
});


function SampleClock({ clockRef }: { clockRef: MutableRefObject<number> }) {
  useFrame((_, delta) => { clockRef.current += delta * 1000; }, -10);
  return null;
}

test('healthy performance never forces low quality and declines respect the five-second gate', async t => {
  const previousRAF = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
  const previousCancelRAF = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame');
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: () => 1 });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: () => {} });
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { devicePixelRatio: 2, addEventListener() {}, removeEventListener() {}, location: { search: '' } } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { querySelector: () => null, hidden: false, addEventListener() {}, removeEventListener() {} } });
  const clock = { current: 1000 };
  t.mock.method(performance, 'now', () => clock.current);
  const runtime = { current: createSceneRuntime() };
  const changes: QualityTier[] = [];
  const onTier = (tier: QualityTier) => { changes.push(tier); };
  const render = (tier: QualityTier, paused = false) => <>
    <SampleClock clockRef={clock} />
    <QualityController runtime={runtime} tier={tier} paused={paused} mobile={false} onTier={onTier} />
  </>;
  let renderer: Renderer | undefined;
  try {
    renderer = await create(render('high'));
    runtime.current.elapsed = 60;
    await advance(renderer, 3600);
    assert.deepEqual(changes, [], 'Repeated healthy sample windows must not invoke a low-quality fallback.');

    // Hold scene time at each boundary while consecutive frame windows are measured.
    runtime.current.elapsed = 4.9;
    await advance(renderer, 180, 1 / 20);
    assert.deepEqual(changes, []);
    runtime.current.elapsed = 5;
    await advance(renderer, 180, 1 / 20);
    assert.deepEqual(changes, ['medium']);
    await renderer.update(render('medium'));
    runtime.current.elapsed = 9.9;
    await advance(renderer, 180, 1 / 20);
    assert.deepEqual(changes, ['medium']);
    runtime.current.elapsed = 10;
    await advance(renderer, 180, 1 / 20);
    assert.deepEqual(changes, ['medium', 'low']);
    await renderer.update(render('low', true));
    runtime.current.elapsed = 24;
    await advance(renderer, 180, 1 / 20);
    assert.deepEqual(changes, ['medium', 'low']);
  } finally {
    await renderer?.unmount();
    if (previousRAF) Object.defineProperty(globalThis, 'requestAnimationFrame', previousRAF); else Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
    if (previousCancelRAF) Object.defineProperty(globalThis, 'cancelAnimationFrame', previousCancelRAF); else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame');
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
