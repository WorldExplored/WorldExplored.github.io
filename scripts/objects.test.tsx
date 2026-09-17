import test from 'node:test';
import assert from 'node:assert/strict';
import { useEffect } from 'react';
import { useThree, type RootState } from '@react-three/fiber';
import { act, create, type ReactThreeTest } from '@react-three/test-renderer';
import { type BufferGeometry, type Mesh, type MeshPhysicalMaterial, DoubleSide, Raycaster, Vector3 } from 'three';
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

test('all eight landmarks have finite geometry and localized lighting at every quality tier', async () => {
  for (const quality of ['high', 'medium', 'low'] as QualityTier[]) {
    const runtime = { current: createSceneRuntime() };
    const ids: LandmarkId[] = ['work', 'experience', 'research', 'purdue', 'history', 'about', 'contact', 'building'];
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
      assert.ok(triangles < 125000 && calls < 250, `${triangles} triangles, ${calls} calls exceed the architecture budget`);
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
      assert.ok(contactMaterials.some((material, index) => material.emissiveIntensity < frozen[index]), 'Reduced motion still acknowledges hover exit without animated transforms.');
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

test('landmarks fit their planting footprints and preserve the intended hierarchy', async () => {
  const runtime = { current: createSceneRuntime() };
  const limits: Record<LandmarkId, number> = { work: 5.5, experience: 5.4, research: 3.8, purdue: 3.05, history: 7, about: 3.5, contact: 3.2, building: 2.4 };
  const heightLimits: Record<LandmarkId, number> = { work: 11.6, experience: 7.8, research: 7, purdue: 4.3, history: 8.8, about: 5, contact: 6.5, building: 7.8 };
  const bounds: Record<string, { radius: number; width: number; depth: number; top: number; bottom: number; triangles: number }> = {};
  for (const landmark of world.landmarks) {
    const renderer = await create(<LandmarkModel id={landmark.id} runtime={runtime} active={false} paused={false} quality="high" />);
    try {
      renderer.scene.instance.updateMatrixWorld(true);
      const point = new Vector3();
      const min = new Vector3(Infinity, Infinity, Infinity);
      const max = new Vector3(-Infinity, -Infinity, -Infinity);
      let radius = 0;
      let triangles = 0;
      for (const node of renderer.scene.findAll(item => item.instance.type === 'Mesh')) {
        const mesh = node.instance as Mesh;
        if (mesh.name === 'signal-light-sweep') continue;
        const positions = mesh.geometry.attributes.position;
        triangles += (mesh.geometry.index?.count ?? positions.count) / 3;
        for (let index = 0; index < positions.count; index++) {
          point.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld);
          min.min(point);
          max.max(point);
          radius = Math.max(radius, Math.hypot(point.x, point.z));
        }
      }
      const limit = limits[landmark.id];
      assert.ok(radius <= limit, `${landmark.id} radius ${radius} exceeds ${limit}`);
      assert.ok(Math.abs(min.y - 0.8) < 0.06, `${landmark.id} must meet the island floor`);
      assert.ok(max.y <= heightLimits[landmark.id], `${landmark.id} exceeds its camera envelope`);
      bounds[landmark.id] = { radius, width: max.x - min.x, depth: max.z - min.z, top: max.y, bottom: min.y, triangles };
    } finally { await renderer.unmount(); }
  }
  assert.ok(bounds.purdue.top <= 4.3);
  assert.ok(bounds.work.radius > bounds.research.radius && bounds.research.radius > bounds.purdue.radius);
  assert.ok(bounds.work.top > bounds.research.top && bounds.research.top > bounds.purdue.top);
  assert.ok(bounds.work.triangles > bounds.research.triangles && bounds.research.triangles > bounds.purdue.triangles);
  console.log(JSON.stringify({ landmarkBounds: bounds }));
});

test('architecture separates diffuse natural finishes, satin metal and clear glazing', async () => {
  const runtime = { current: createSceneRuntime() };
  const renderer = await create(<group>{world.landmarks.map(({ id }) => <LandmarkModel key={id} id={id} runtime={runtime} active={false} paused={false} quality="low" />)}</group>);
  try {
    let glass=0,wood=0,fabric=0,metal=0,stone=0;
    for(const node of renderer.scene.findAll(item=>item.instance.type==='Mesh')) {
      const mesh=node.instance as Mesh,material=mesh.material as MeshPhysicalMaterial;
      if(mesh.name==='signal-light-sweep')continue;
      assert.ok(Number.isFinite(material.roughness)&&material.roughness>=0&&material.roughness<=1);
      if(mesh.name.endsWith('-wood')){wood++;assert.ok(material.roughness>=.7&&material.metalness===0);}
      if(mesh.name.endsWith('-fabric')){fabric++;assert.ok(material.roughness>=.9&&material.metalness===0);}
      if(material.name==='satin-aluminum-trim'||mesh.name.endsWith('-metal')){metal++;assert.ok(material.metalness>=.5&&material.roughness>=.35);}
      if(material.name==='limestone-foundation'){stone++;assert.ok(material.roughness>=.8&&material.clearcoat<=.1);}
      if(material.name==='matte-roof-planting')assert.ok(material.roughness>=.8&&material.clearcoat===0);
      if(material.transparent){glass++;assert.ok(material.opacity>=.15&&material.opacity<=.45);assert.equal(material.depthWrite,false);assert.equal(mesh.castShadow,false);}
    }
    assert.ok(glass>=6&&wood>=5&&fabric>=5&&metal>=5&&stone>=5,'All five furnished landmarks preserve visibly different finish families.');
  } finally { await renderer.unmount(); }
});

test('quality, selection, and pause changes preserve every architectural resource until unmount', async () => {
  const runtime = { current: createSceneRuntime() };
  const render = (quality: QualityTier, active = false, paused = false) => <group>{world.landmarks.map(({ id }) => <LandmarkModel key={id} id={id} runtime={runtime} active={active} paused={paused} quality={quality} />)}</group>;
  const renderer = await create(render('high'));
  const snapshot = () => renderer.scene.findAll(node => node.instance.type === 'Mesh').map(node => {
    const mesh = node.instance as Mesh;
    return { mesh, geometry: mesh.geometry, material: mesh.material as MeshPhysicalMaterial };
  });
  const original = snapshot();
  const resources = new Set(original.flatMap(({ geometry, material }) => [geometry, material]));
  const disposals = new Map([...resources].map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => disposals.set(resource, disposals.get(resource)! + 1));
  try {
    for (const quality of ['low', 'medium', 'high', 'low'] as QualityTier[]) {
      for (const [active, paused] of [[true, false], [false, true], [false, false]]) {
        await renderer.update(render(quality, active, paused));
        await advance(renderer, 1);
        const current = snapshot();
        assert.equal(current.length, original.length);
        for (let index = 0; index < original.length; index++) {
          assert.equal(current[index].mesh, original[index].mesh);
          assert.equal(current[index].geometry, original[index].geometry);
          assert.equal(current[index].material, original[index].material);
        }
        assert.ok([...disposals.values()].every(count => count === 0), 'Live resources cannot be disposed during quality or navigation updates.');
      }
    }
  } finally { await renderer.unmount(); }
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok([...disposals.values()].every(count => count === 1), 'Owned resources must be released exactly once on unmount.');
});

test('the garden gallery preserves the existing sculpture volume', async () => {
  const runtime = { current: createSceneRuntime() };
  const renderer = await create(<LandmarkModel id="about" runtime={runtime} active={false} paused={false} quality="high" />);
  try {
    renderer.scene.instance.updateMatrixWorld(true);
    const center = new Vector3(0, 2.5, 0);
    const point = new Vector3();
    for (const node of renderer.scene.findAll(item => item.instance.type === 'Mesh')) {
      const mesh = node.instance as Mesh;
      const positions = mesh.geometry.attributes.position;
      for (let index = 0; index < positions.count; index++) {
        point.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld);
        assert.ok(point.distanceTo(center) > 0.97, 'Architecture must leave room for every sculpture orientation.');
      }
    }
  } finally { await renderer.unmount(); }
});

test('the lighthouse beam remains westward, freezes when paused, and darkens when disabled', async () => {
  const runtime = { current: createSceneRuntime() };
  const enabled = world.lighting.lampEnabled;
  world.lighting.lampEnabled = true;
  const render = (paused = false) => <LandmarkModel id="building" runtime={runtime} active paused={paused} quality="high" />;
  const renderer = await create(render());
  try {
    const beam = renderer.scene.findByProps({ name: 'signal-light-sweep' }).instance as Mesh<BufferGeometry, MeshPhysicalMaterial>;
    const direction = new Vector3();
    for (let second = 0; second <= 180; second += 3) {
      runtime.current.elapsed = second;
      await advance(renderer, 1);
      assert.ok(Math.abs(beam.rotation.y) <= Math.PI * 35 / 180 + 1e-8);
      direction.set(-1, 0, 0).applyEuler(beam.rotation);
      assert.ok(direction.x <= -Math.cos(Math.PI * 35 / 180) + 1e-8, 'The beam cannot sweep toward the eastern islands.');
    }
    assert.ok(beam.material.opacity > 0.02);
    await renderer.update(render(true));
    const rotation = beam.rotation.toArray();
    const opacity = beam.material.opacity;
    runtime.current.elapsed += 30;
    await advance(renderer, 60);
    assert.deepEqual(beam.rotation.toArray(), rotation);
    assert.equal(beam.material.opacity, opacity);
    world.lighting.lampEnabled = false;
    await renderer.update(render());
    await advance(renderer, 1);
    assert.equal(beam.material.emissiveIntensity, 0);
    assert.equal(beam.material.opacity, 0);
    for (const node of renderer.scene.findAll(item => item.instance.type === 'Mesh')) {
      const material = (node.instance as Mesh).material as MeshPhysicalMaterial;
      if (material.emissive.getHex() !== 0) assert.equal(material.emissiveIntensity, 0);
    }
  } finally {
    await renderer.unmount();
    world.lighting.lampEnabled = enabled;
  }
});

test('occupied building volumes have continuous exterior walls, roofs, floors and doors', async () => {
  const runtime={current:createSceneRuntime()};
  const rooms: Partial<Record<LandmarkId, number[][]>>={work:[[-2.875,2.2,0],[0,2,0],[2.875,3.9,0]],research:[[-1.215,1.9,0],[1.68,1.8,1.1],[1.58,2,-.73]],purdue:[[0,1.8,0]],about:[[0,2,-1.7],[-1.95,2,0]],contact:[[0,2,0]]};
  for(const [id,centers] of Object.entries(rooms)){
    const renderer=await create(<LandmarkModel id={id as LandmarkId} runtime={runtime} active={false} paused quality="high"/>);
    try{
      renderer.scene.instance.updateMatrixWorld(true);
      const shells=renderer.scene.findAll(item=>item.instance.type==='Mesh').map(node=>node.instance as Mesh).filter(mesh=>{
        for(let parent=mesh.parent;parent;parent=parent.parent)if(parent.name.endsWith('-operating-assembly'))return false;
        return true;
      });
      for(const center of centers!){
        const origin=new Vector3(...center);
        const directions=[new Vector3(0,1,0),new Vector3(0,-1,0)];
        for(let i=0;i<24;i++)for(const pitch of [-.2,0,.2])directions.push(new Vector3(Math.cos(i*Math.PI/12),pitch,Math.sin(i*Math.PI/12)).normalize());
        for(const direction of directions){
          const ray=new Raycaster(origin,direction,.01,12);
          assert.ok(ray.intersectObjects(shells,false).length>0,`${id} room ${center} opens to outside along ${direction.toArray()}`);
        }
      }
    }finally{await renderer.unmount();}
  }
});
