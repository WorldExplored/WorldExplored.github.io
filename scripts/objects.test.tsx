import test from 'node:test';
import assert from 'node:assert/strict';
import { useEffect } from 'react';
import { useThree, type RootState } from '@react-three/fiber';
import { act, create, type ReactThreeTest } from '@react-three/test-renderer';
import { type Mesh, type MeshPhysicalMaterial, DoubleSide } from 'three';
import { ReflectiveObject, type RotationCommand } from '../src/components/world/ReflectiveObject';
import { LandmarkModel } from '../src/components/world/LandmarkModels';
import { createSceneRuntime, world, type LandmarkId, type QualityTier } from '../src/content/world';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
type Renderer = ReactThreeTest.Renderer;

function Probe({ capture }: { capture: (state: RootState) => void }) {
  const get = useThree(state => state.get);
  useEffect(() => capture(get()), [capture, get]);
  return null;
}

async function advance(renderer: Renderer, frames: number, delta = 1 / 60) {
  await act(async () => {
    for (let frame = 0; frame < frames; frame++) await renderer.advanceFrames(1, delta);
  });
}

async function fixture() {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const surface = new EventTarget();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: surface });
  const runtime = { current: createSceneRuntime() };
  let state: RootState | undefined;
  const capture = (next: RootState) => { state = next; };
  const render = (paused = false, command?: RotationCommand) => <><Probe capture={capture} /><ReflectiveObject runtime={runtime} paused={paused} quality="high" command={command} /></>;
  const renderer = await create(render());
  assert.ok(state);
  const style = state.gl.domElement.style;
  Object.defineProperty(style, 'setProperty', { configurable: true, value: (key: string, value: string) => { Reflect.set(style, key, value); } });
  const captured = new Set<number>();
  const target = {
    setPointerCapture: (id: number) => { captured.add(id); },
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => { captured.delete(id); },
  };
  const event = { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100, timeStamp: 100, target };
  const root = renderer.scene.findByProps({ name: 'reflective-object' });
  const rotation = renderer.scene.findByProps({ name: 'reflective-object-rotation' }).instance.rotation;
  return { renderer, render, runtime, captured, root, rotation, event, surface, async cleanup() {
    await renderer.unmount();
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else Reflect.deleteProperty(globalThis, 'window');
  } };
}

test('reflective dragging has a threshold, stable bounds, damped momentum, and fixed size', async () => {
  for (const fps of [24, 60, 120]) {
    const f = await fixture();
    try {
      const position = f.root.instance.position.toArray();
      await f.renderer.fireEvent(f.root, 'pointerDown', f.event);
      assert.equal(f.runtime.current.dragging, false);
      assert.equal(f.captured.size, 1);
      await f.renderer.fireEvent(f.root, 'pointerMove', { ...f.event, clientX: 103 });
      assert.equal(f.runtime.current.dragging, false);
      await f.renderer.fireEvent(f.root, 'pointerMove', { ...f.event, clientX: 220, clientY: 240, timeStamp: 116 });
      assert.equal(f.runtime.current.dragging, true);
      assert.ok(Math.abs(f.rotation.x) <= 0.8);
      await f.renderer.fireEvent(f.root, 'pointerUp', { ...f.event, clientX: 220, clientY: 240, timeStamp: 120 });
      assert.equal(f.runtime.current.dragging, false);
      assert.equal(f.runtime.current.dragCount, 1);
      assert.equal(f.captured.size, 0);
      await f.renderer.fireEvent(f.root, 'lostPointerCapture', f.event);
      const releasedYaw = f.rotation.y;
      await advance(f.renderer, 1, 1 / fps);
      assert.notEqual(f.rotation.y, releasedYaw);
      assert.ok(Math.abs(f.rotation.y - releasedYaw) <= 3 / fps + 1e-8);
      await advance(f.renderer, fps * 4, 1 / fps);
      const settledYaw = f.rotation.y;
      await advance(f.renderer, fps, 1 / fps);
      assert.ok(Math.abs(f.rotation.y - settledYaw) < 0.001);
      assert.ok(f.rotation.toArray().slice(0, 3).every(Number.isFinite));
      assert.ok(Math.abs(f.rotation.x) <= 0.8 && Math.abs(f.rotation.y) <= Math.PI);
      assert.deepEqual(f.root.instance.position.toArray(), position);
      assert.deepEqual(f.root.instance.scale.toArray(), [1, 1, 1]);
    } finally { await f.cleanup(); }
  }
});

test('pause, cancellation and blur release captures without committing a drag', async () => {
  const f = await fixture();
  try {
    for (const cancellation of ['pointerCancel', 'lostPointerCapture', 'blur', 'pause']) {
      await f.renderer.update(f.render());
      await f.renderer.fireEvent(f.root, 'pointerDown', f.event);
      await f.renderer.fireEvent(f.root, 'pointerMove', { ...f.event, clientX: 150, timeStamp: 116 });
      assert.equal(f.runtime.current.dragging, true);
      if (cancellation === 'blur') f.surface.dispatchEvent(new Event('blur'));
      else if (cancellation === 'pause') await f.renderer.update(f.render(true));
      else await f.renderer.fireEvent(f.root, cancellation, f.event);
      assert.equal(f.captured.size, 0);
      assert.equal(f.runtime.current.dragging, false);
      assert.equal(f.runtime.current.dragCount, 0);
      const rotation = f.rotation.toArray();
      await advance(f.renderer, 120);
      assert.deepEqual(f.rotation.toArray(), rotation);
    }
  } finally { await f.cleanup(); }
});

test('touch keeps scrolling uncaptured and keyboard commands remain bounded and resettable', async () => {
  const f = await fixture();
  try {
    const original = f.rotation.toArray();
    const touch = { ...f.event, pointerType: 'touch' };
    await f.renderer.fireEvent(f.root, 'pointerDown', touch);
    await f.renderer.fireEvent(f.root, 'pointerMove', { ...touch, clientY: 200 });
    await f.renderer.fireEvent(f.root, 'pointerUp', { ...touch, clientY: 200 });
    assert.equal(f.captured.size, 0);
    assert.equal(f.runtime.current.dragCount, 0);
    assert.deepEqual(f.rotation.toArray(), original);
    await f.renderer.update(f.render(false, { serial: 1, yaw: 100, pitch: -100 }));
    assert.ok(Math.abs(f.rotation.y - Number(original[1])) <= 0.3 + 1e-8);
    assert.ok(Math.abs(f.rotation.x - Number(original[0])) <= 0.3 + 1e-8);
    const commanded = f.rotation.toArray();
    await f.renderer.update(f.render(false, { serial: 1, yaw: 0.3 }));
    assert.deepEqual(f.rotation.toArray(), commanded);
    await f.renderer.update(f.render(false, { serial: 2, reset: true }));
    assert.deepEqual(f.rotation.toArray(), original);
    await f.renderer.update(f.render(true, { serial: 3, yaw: 0.3 }));
    assert.deepEqual(f.rotation.toArray(), original);
  } finally { await f.cleanup(); }
});

test('all six landmarks have finite geometry and localized lighting at every quality tier', async () => {
  for (const quality of ['high', 'medium', 'low'] as QualityTier[]) {
    const runtime = { current: createSceneRuntime() };
    const ids: LandmarkId[] = ['work', 'research', 'purdue', 'about', 'contact', 'building'];
    const render = (paused = false) => <group>{ids.map(id => <group key={id} name={`model-${id}`}><LandmarkModel id={id} runtime={runtime} active={false} paused={paused} quality={quality} /></group>)}</group>;
    const renderer = await create(render());
    try {
      const meshes = renderer.scene.findAll(node => node.instance.type === 'Mesh').map(node => node.instance as Mesh);
      let triangles = 0;
      let calls = 0;
      for (const mesh of meshes) {
        assert.ok(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite));
        triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
        const material = mesh.material as MeshPhysicalMaterial;
        calls += material.transparent && material.side === DoubleSide && !material.forceSinglePass ? 2 : 1;
      }
      assert.ok(triangles < 180000 && calls < 140);
      const contact = renderer.scene.findByProps({ name: 'model-contact' });
      const contactMaterials = contact.findAll(node => node.instance.type === 'Mesh').map(node => (node.instance as Mesh).material as MeshPhysicalMaterial);
      const unrelated = renderer.scene.findByProps({ name: 'model-work' }).findAll(node => node.instance.type === 'Mesh').map(node => (node.instance as Mesh).material as MeshPhysicalMaterial);
      await advance(renderer, 120);
      const before = contactMaterials.map(material => material.emissiveIntensity);
      const untouched = unrelated.map(material => material.emissiveIntensity);
      runtime.current.hovered = 'contact';
      await advance(renderer, 30);
      assert.ok(contactMaterials.some((material, index) => material.emissiveIntensity > before[index] + 0.1));
      assert.ok(unrelated.every((material, index) => Math.abs(material.emissiveIntensity - untouched[index]) < 0.0001));
      await renderer.update(render(true));
      const frozen = contactMaterials.map(material => material.emissiveIntensity);
      runtime.current.hovered = null;
      await advance(renderer, 60);
      assert.deepEqual(contactMaterials.map(material => material.emissiveIntensity), frozen);
      console.log(JSON.stringify({ quality, meshes: meshes.length, colorCalls: calls, triangles, windowIllumination: world.lighting.windowIllumination }));
    } finally { await renderer.unmount(); }
  }
});

test('disabled lamp illumination stays off during selection', async () => {
  const enabled = world.lighting.lampEnabled;
  world.lighting.lampEnabled = false;
  const runtime = { current: createSceneRuntime() };
  runtime.current.hovered = 'building';
  let renderer: Renderer | undefined;
  try {
    renderer = await create(<LandmarkModel id="building" runtime={runtime} active paused={false} quality="low" />);
    await advance(renderer, 120);
    for (const node of renderer.scene.findAll(item => item.instance.type === 'Mesh')) {
      const material = (node.instance as Mesh).material as MeshPhysicalMaterial;
      if (material.emissive.getHex() !== 0) assert.ok(material.emissiveIntensity === 0 || material.opacity === 0);
    }
  } finally {
    await renderer?.unmount();
    world.lighting.lampEnabled = enabled;
  }
});
