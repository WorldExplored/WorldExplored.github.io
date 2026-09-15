import assert from 'node:assert/strict';
import test from 'node:test';
import { create } from '@react-three/test-renderer';
import { Vector3, type Mesh, type Object3D } from 'three';
import { createLandmarkMechanism, LandmarkMechanisms } from '../src/components/world/LandmarkMechanisms';
import { LANDMARK_HIT_BOUNDS } from '../src/components/world/Landmark';
import { createSceneRuntime, type LandmarkId } from '../src/content/world';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const ids: LandmarkId[] = ['work', 'research', 'purdue', 'about', 'contact', 'building'];
const moving: Record<LandmarkId, string[]> = {
  work: ['work-ring-mount-0', 'work-compute-wheel-0', 'work-compute-wheel-1', 'work-coolant-capsule-0', 'work-service-carriage'],
  research: ['research-articulated-solar-canopy-0', 'research-observation-instrument'],
  purdue: ['purdue-kinetic-gold-ring', 'purdue-travelling-route-light'],
  about: ['about-kinetic-canopy-0', 'about-water-ribbon'],
  contact: ['contact-articulated-signal-petal-0', 'contact-outward-signal-pulse'],
  building: ['lighthouse-rotating-fresnel-lens', 'lighthouse-weather-vane'],
};
const pose = (object: Object3D) => [...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray()];

test('every landmark operates multiple real mechanisms with independent periods and no whole-building scale', () => {
  const rates = new Set<string>();
  for (const id of ids) {
    const assembly = createLandmarkMechanism(id);
    try {
      const start = moving[id].map(name => pose(assembly.root.getObjectByName(name)!));
      assembly.update(7.1, 0, 1 / 60);
      moving[id].forEach((name, index) => {
        const object = assembly.root.getObjectByName(name)!;
        assert.notDeepEqual(pose(object), start[index], `${name} needs actual mechanical motion.`);
        assert.ok(pose(object).every(Number.isFinite));
        rates.add(object.quaternion.toArray().map(value => value.toFixed(4)).join(','));
      });
      assert.deepEqual(assembly.root.scale.toArray(), [1, 1, 1]);
      assert.deepEqual(assembly.root.position.toArray(), [0, 0, 0]);
    } finally { assembly.dispose(); }
  }
  assert.ok(rates.size >= 10, 'Landmarks cannot share one synchronized rotation.');
});

test('moving geometry stays inside the stable hover and planting envelope throughout operation', () => {
  const point = new Vector3();
  for (const id of ids) {
    const assembly = createLandmarkMechanism(id); const bounds = LANDMARK_HIT_BOUNDS[id];
    try {
      for (let step = 0; step <= 24; step++) {
        assembly.update(step * 9.37, step % 2, .1); assembly.root.updateMatrixWorld(true);
        assembly.root.traverse(object => {
          const mesh = object as Mesh;
          if (!mesh.isMesh) return;
          const positions = mesh.geometry.attributes.position;
          for (let index = 0; index < positions.count; index++) {
            point.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld);
            assert.ok(point.toArray().every(Number.isFinite), mesh.name);
            assert.ok(Math.hypot(point.x, point.z) <= bounds.radius, `${mesh.name} leaves its planting radius.`);
            assert.ok(point.y >= bounds.floor && point.y <= bounds.top, `${mesh.name} leaves its fixed hover height: ${point.y}.`);
            if (id === 'about') assert.ok(point.distanceTo(new Vector3(0, 2.5, 0)) > .97, 'The original sculpture keeps its entire gesture volume.');
          }
        });
      }
    } finally { assembly.dispose(); }
  }
});

test('hover and selection produce progressively stronger local mechanical responses', () => {
  for (const id of ids) {
    const idle = createLandmarkMechanism(id); const hover = createLandmarkMechanism(id); const selected = createLandmarkMechanism(id);
    try {
      for (let frame = 0; frame < 90; frame++) { idle.update(2, 0, 1 / 60); hover.update(2, .5, 1 / 60); selected.update(2, 1, 1 / 60); }
      assert.ok(hover.root.userData.response > .49);
      assert.ok(selected.root.userData.response > .99);
      const changed = moving[id].some(name => JSON.stringify(pose(idle.root.getObjectByName(name)!)) !== JSON.stringify(pose(hover.root.getObjectByName(name)!)));
      assert.ok(changed, `${id} hover must articulate geometry.`);
      assert.ok(moving[id].some(name => JSON.stringify(pose(hover.root.getObjectByName(name)!)) !== JSON.stringify(pose(selected.root.getObjectByName(name)!))), `${id} selection must strengthen articulation.`);
    } finally { idle.dispose(); hover.dispose(); selected.dispose(); }
  }
});

test('pause freezes mechanisms and interaction; subsequent renders preserve GPU resource identity', async () => {
  const runtime = { current: createSceneRuntime() };
  for (const id of ids) {
    const render = (paused = false, active = false) => <LandmarkMechanisms id={id} runtime={runtime} active={active} paused={paused} />;
    const renderer = await create(render());
    const root = renderer.scene.instance;
    const meshes: Mesh[] = []; root.traverse(object => { if ((object as Mesh).isMesh) meshes.push(object as Mesh); });
    const resources = new Set(meshes.flatMap(mesh => [mesh.geometry, ...(Array.isArray(mesh.material) ? mesh.material : [mesh.material])]));
    const disposed = new Map([...resources].map(resource => [resource, 0]));
    for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource)! + 1));
    runtime.current.elapsed = 3;
    await renderer.advanceFrames(1, 1 / 60);
    const before = moving[id].map(name => pose(root.getObjectByName(name)!));
    await renderer.update(render(true, true)); runtime.current.hovered = id; runtime.current.elapsed = 20;
    await renderer.advanceFrames(30, 1 / 60);
    moving[id].forEach((name, index) => assert.deepEqual(pose(root.getObjectByName(name)!), before[index]));
    for (let index = 0; index < 4; index++) await renderer.update(render(true, index % 2 === 0));
    assert.ok([...disposed.values()].every(count => count === 0));
    for (const mesh of meshes) assert.ok(root.getObjectById(mesh.id) === mesh);
    await renderer.update(render()); await renderer.advanceFrames(1, 1 / 60);
    assert.ok(moving[id].some((name, index) => JSON.stringify(pose(root.getObjectByName(name)!)) !== JSON.stringify(before[index])));
    await renderer.unmount();
    assert.ok([...disposed.values()].every(count => count === 1), `${id} resources dispose once at unmount.`);
    runtime.current.hovered = null;
  }
});
