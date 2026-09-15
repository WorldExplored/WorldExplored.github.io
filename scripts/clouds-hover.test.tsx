import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { create, act, type ReactThreeTest } from '@react-three/test-renderer';
import { Group, Object3D, Ray, Vector3, type Mesh } from 'three';
import { Landmark, LANDMARK_HIT_BOUNDS, LANDMARK_HOVER_GRACE_MS } from '../src/components/world/Landmark';
import { cloudInstanceCount, cloudInstanceRanges, cloudPuffTransform, createCloudClusters, rayCloudDistance, updateCloudResponses } from '../src/components/world/clouds';
import { createSceneRuntime, world, type LandmarkId, type SceneRuntime } from '../src/content/world';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('the first ten clouds include five distinct graphs, profiles, depths and poses', () => {
  const clusters = createCloudClusters();
  assert.deepEqual(createCloudClusters(), clusters, 'Cloud placement is deterministic.');
  const first = clusters.slice(0, 10);
  assert.equal(new Set(first.map(cluster => cluster.archetype)).size, 5);
  assert.equal(new Set(first.map(cluster => cluster.puffs.length)).size, 5, 'Different families use different graphs, not one rescaled puff arrangement.');
  assert.equal(new Set(first.map(cluster => cluster.azimuth)).size, 10);
  assert.equal(new Set(first.map(cluster => cluster.speed)).size, 10);
  assert.equal(new Set(first.map(cluster => cluster.density)).size, 10);
  assert.ok(Math.max(...first.map(cluster => cluster.center[2])) - Math.min(...first.map(cluster => cluster.center[2])) > 120);
  for (const cluster of first) assert.ok(cluster.center[1] >= 16 && cluster.center[1] <= 27);
  const profiles = first.slice(0, 5).map(cluster => {
    const width = Math.max(...cluster.puffs.map(puff => puff.offset[0] + puff.scale[0])) - Math.min(...cluster.puffs.map(puff => puff.offset[0] - puff.scale[0]));
    const height = Math.max(...cluster.puffs.map(puff => puff.offset[1] + puff.scale[1])) - Math.min(...cluster.puffs.map(puff => puff.offset[1] - puff.scale[1]));
    return { archetype: cluster.archetype, ratio: width / height };
  });
  assert.ok(profiles.find(item => item.archetype === 'cauliflower')!.ratio < 1.2);
  assert.ok(profiles.find(item => item.archetype === 'bank')!.ratio > 2.5);
  assert.ok(profiles.find(item => item.archetype === 'atmospheric')!.ratio > 8);
});

test('cloud instance ranges pack variable puff counts without overlaps at every tier', () => {
  const clusters = createCloudClusters();
  const ranges = cloudInstanceRanges(clusters);
  let end = 0;
  ranges.forEach((range, index) => { assert.equal(range.start, end); assert.equal(range.count, clusters[index].puffs.length); end += range.count; });
  assert.equal(end, cloudInstanceCount(clusters));
  for (const tier of Object.values(world.quality)) {
    assert.equal(cloudInstanceCount(clusters, tier.clouds), clusters.slice(0, tier.clouds).reduce((sum, cloud) => sum + cloud.puffs.length, 0));
    assert.equal(new Set(clusters.slice(0, tier.clouds).map(cloud => cloud.archetype)).size, 5, 'Every quality tier retains every silhouette.');
  }
  assert.equal(cloudInstanceCount(clusters, 0), 0);
  assert.equal(cloudInstanceCount(clusters, -5), 0);
  assert.equal(cloudInstanceCount(clusters, clusters.length + 10), end);
});

test('rendered cloud ellipsoids match ray ownership at bounded drift and compression', () => {
  const output = { position: new Vector3(), scale: new Vector3() };
  const ray = new Ray(new Vector3(), new Vector3(0, 0, -1));
  for (const cloud of createCloudClusters()) for (const elapsed of [0, 825, 5000]) for (const response of [0, .5, 1]) for (const puff of cloud.puffs) {
    cloudPuffTransform(cloud, puff, elapsed, response, output);
    assert.ok(output.scale.x <= puff.scale[0] && output.scale.y <= puff.scale[1] && output.scale.z <= puff.scale[2], 'Interaction compresses rather than enlarging puffs.');
    ray.origin.copy(output.position).add(new Vector3(output.scale.x * .95, 0, output.scale.z + 2));
    assert.notEqual(rayCloudDistance(ray, cloud, elapsed, response), null);
  }
});

test('resting edges retain one cloud owner throughout deformation and release smoothly', () => {
  const cloud = createCloudClusters(1)[0];
  cloud.center = [0, 20, 0];
  cloud.puffs = [{ offset: [0, 0, 0], scale: [2, 1, 1] }];
  const ray = new Ray(new Vector3(1.99, 20, 5), new Vector3(0, 0, -1));
  let entries = 0;
  let previous = 0;
  for (let frame = 0; frame < 240; frame++) {
    entries += updateCloudResponses([cloud], ray, 0, 1 / 60, 1, false);
    assert.ok(cloud.response >= previous && cloud.response - previous < .12);
    previous = cloud.response;
  }
  assert.equal(entries, 1);
  assert.equal(cloud.targeted, true);
  assert.equal(rayCloudDistance(ray, cloud, 0), null, 'The resting-volume union retains ownership after the puff compresses away from the ray.');
  for (let frame = 0; frame < 160; frame++) {
    updateCloudResponses([cloud], null, 0, 1 / 60, 1, false);
    assert.ok(cloud.response <= previous && previous - cloud.response < .12);
    previous = cloud.response;
  }
  assert.ok(cloud.response < 1e-7);
  const clouds = createCloudClusters(2);
  clouds.forEach((item, index) => { item.center = [0, 20, index === 0 ? -20 : 0]; item.puffs = [{ offset: [0, 0, 0], scale: [2, 1, 1] }]; });
  updateCloudResponses(clouds, new Ray(new Vector3(0, 20, 10), new Vector3(0, 0, -1)), 0, 1 / 60, 2, false);
  assert.deepEqual(clouds.map(item => item.targeted), [false, true], 'The closest rendered cloud wins even when it comes later in the array.');
});

function observedRuntime() {
  const runtime = createSceneRuntime();
  let hovered: SceneRuntime['hovered'] = null;
  const changes: SceneRuntime['hovered'][] = [];
  Object.defineProperty(runtime, 'hovered', { get: () => hovered, set: value => { if (value !== hovered) changes.push(value); hovered = value; }, enumerable: true });
  return { current: runtime, changes };
}

async function fixture(id: LandmarkId) {
  const config = world.landmarks.find(item => item.id === id)!;
  const runtime = observedRuntime();
  const navigations: LandmarkId[] = [];
  const renderer = await create(<Landmark config={config} runtime={runtime} paused={false} onNavigate={value => navigations.push(value)}>
    <mesh name="visual-child-a" position={[-.5, 1.5, 0]}><sphereGeometry args={[.7, 8, 6]} /><meshBasicMaterial /></mesh>
    <mesh name="visual-child-b" position={[.5, 2.5, 0]}><sphereGeometry args={[.7, 8, 6]} /><meshBasicMaterial /></mesh>
  </Landmark>);
  const proxy = renderer.scene.findByProps({ name: `landmark-hit-${id}` });
  return { renderer, runtime, navigations, proxy, config };
}

async function advance(renderer: ReactThreeTest.Renderer) { await act(async () => { await renderer.advanceFrames(1, 1 / 60); }); }

for (const config of world.landmarks) test(`${config.id}: a pointer held for three real seconds appears once with zero hover toggles`, async t => {
  const f = await fixture(config.id);
  t.after(() => f.renderer.unmount());
  const mesh = f.proxy.instance as Mesh;
  mesh.updateMatrixWorld(true);
  const initialMatrix = mesh.matrixWorld.clone();
  const bounds = LANDMARK_HIT_BOUNDS[config.id];
  const geometry = mesh.geometry;
  geometry.computeBoundingBox();
  assert.ok(Math.abs(geometry.boundingBox!.max.x - bounds.radius) < 1e-6);
  assert.ok(Math.abs(mesh.position.y + geometry.boundingBox!.max.y - bounds.top) < 1e-6);
  assert.ok(Math.abs(mesh.position.y + geometry.boundingBox!.min.y - bounds.floor) < 1e-6);
  const children = ['visual-child-a', 'visual-child-b'].map(name => f.renderer.scene.findByProps({ name }));
  for (const child of children) assert.equal(child.props.onPointerOut, undefined, 'Visual children do not own hover exits.');
  await f.renderer.fireEvent(f.proxy, 'pointerOver', { pointerType: 'mouse' });
  const start = performance.now();
  let movements = 0;
  while (performance.now() - start < 3050) {
    await wait(40);
    const child = children[movements % 2];
    // Cross moving child surfaces while the fixed proxy remains the event owner.
    (child.instance as Mesh).position.x = Math.sin(movements) * .6;
    await f.renderer.fireEvent(f.proxy, 'pointerMove', { pointerType: 'mouse', object: child.instance, eventObject: mesh });
    f.runtime.current.elapsed += .04;
    await advance(f.renderer);
    mesh.updateMatrixWorld(true);
    assert.deepEqual(mesh.matrixWorld.elements, initialMatrix.elements);
    assert.equal(f.runtime.current.hovered, config.id);
    movements++;
  }
  assert.ok(performance.now() - start >= 3000);
  assert.ok(movements > 50);
  assert.deepEqual(f.runtime.changes, [config.id], 'Exactly one appearance and no hide/show toggles.');
});

test('hover exit grace survives child gaps and reentry, then clears on an actual leave', async t => {
  const f = await fixture('work');
  t.after(() => f.renderer.unmount());
  await f.renderer.fireEvent(f.proxy, 'pointerOver', { pointerType: 'mouse' });
  await f.renderer.fireEvent(f.proxy, 'pointerOut', { pointerType: 'mouse' });
  await wait(60);
  assert.equal(f.runtime.current.hovered, 'work');
  await f.renderer.fireEvent(f.proxy, 'pointerOver', { pointerType: 'mouse' });
  await wait(LANDMARK_HOVER_GRACE_MS + 30);
  assert.deepEqual(f.runtime.changes, ['work']);
  await f.renderer.fireEvent(f.proxy, 'pointerOut', { pointerType: 'mouse' });
  await wait(LANDMARK_HOVER_GRACE_MS + 30);
  assert.deepEqual(f.runtime.changes, ['work', null]);
});

test('touch never leaves a sticky hover and completed drags cannot navigate', async t => {
  const f = await fixture('contact');
  t.after(() => f.renderer.unmount());
  await f.renderer.fireEvent(f.proxy, 'pointerOver', { pointerType: 'mouse' });
  await f.renderer.fireEvent(f.proxy, 'pointerOver', { pointerType: 'touch' });
  await f.renderer.fireEvent(f.proxy, 'pointerDown', { pointerType: 'touch' });
  await f.renderer.fireEvent(f.proxy, 'click', { delta: 0 });
  assert.equal(f.runtime.current.hovered, null);
  assert.deepEqual(f.navigations, ['contact']);
  await f.renderer.fireEvent(f.proxy, 'click', { delta: 9 });
  f.runtime.current.dragging = true;
  await f.renderer.fireEvent(f.proxy, 'click', { delta: 0 });
  f.runtime.current.dragging = false;
  await f.renderer.fireEvent(f.proxy, 'pointerDown', { pointerType: 'mouse' });
  f.runtime.current.dragCount++;
  await f.renderer.fireEvent(f.proxy, 'click', { delta: 0 });
  assert.deepEqual(f.navigations, ['contact']);
});

test('unmount cancels delayed exits without clearing later hover ownership', async () => {
  const f = await fixture('research');
  await f.renderer.fireEvent(f.proxy, 'pointerOver', { pointerType: 'mouse' });
  await f.renderer.fireEvent(f.proxy, 'pointerOut', { pointerType: 'mouse' });
  await f.renderer.unmount();
  assert.equal(f.runtime.current.hovered, null);
  f.runtime.current.hovered = 'research';
  await wait(LANDMARK_HOVER_GRACE_MS + 30);
  assert.equal(f.runtime.current.hovered, 'research', 'The unmounted owner has no pending timer.');
});


test('About retains its hover boundary while delegating sculpture drag and tap ownership', async t => {
  const f = await fixture('about');
  t.after(() => f.renderer.unmount());
  const sculpture = new Group();
  sculpture.name = 'reflective-object';
  const surface = new Object3D();
  sculpture.add(surface);
  let stops = 0;
  const event = { pointerType: 'mouse', intersections: [{ object: surface }], stopPropagation: () => { stops++; } };
  await f.renderer.fireEvent(f.proxy, 'pointerOver', event);
  await f.renderer.fireEvent(f.proxy, 'pointerDown', event);
  f.runtime.current.dragging = true;
  await f.renderer.fireEvent(f.proxy, 'pointerMove', event);
  f.runtime.current.dragging = false;
  await f.renderer.fireEvent(f.proxy, 'click', { ...event, delta: 0 });
  assert.equal(stops, 0, 'The sculpture receives events through the transparent About proxy.');
  assert.deepEqual(f.navigations, [], 'Sculpture taps cannot accidentally open About.');
  assert.deepEqual(f.runtime.changes, ['about'], 'Delegation does not cut holes into hover ownership.');
  await f.renderer.fireEvent(f.proxy, 'pointerMove', { pointerType: 'mouse' });
  await f.renderer.fireEvent(f.proxy, 'pointerDown', { pointerType: 'mouse' });
  await f.renderer.fireEvent(f.proxy, 'click', { delta: 0 });
  assert.deepEqual(f.navigations, ['about'], 'The rest of the About boundary remains navigable.');
});
