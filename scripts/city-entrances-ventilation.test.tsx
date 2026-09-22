import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { create } from '@react-three/test-renderer';
import { Box3, DoubleSide, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Object3D, Raycaster, Vector3 } from 'three';
import { buildCityArchitecture } from '../src/components/world/CityArchitecture';
import { CITY_VENTILATION_MOUNTS, CityVentilation, createCityVentilation } from '../src/components/world/CityVentilation';
import { CITY_BASE_Y, cityBuildings } from '../src/components/world/city';
import { createSceneRuntime } from '../src/content/world';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
function architecture(id: string) {
  const building = cityBuildings.find(item => item.id === id)!;
  const meshes: Mesh[] = [], pose = new Object3D();
  const material = new MeshBasicMaterial({ side: DoubleSide });
  buildCityArchitecture(building, (geometry, _finish, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, yaw = 0) => {
    pose.position.set(x, y, z); pose.scale.set(sx, sy, sz); pose.rotation.set(0, yaw, 0); pose.updateMatrix();
    geometry.applyMatrix4(pose.matrix); const mesh = new Mesh(geometry, material); mesh.updateMatrixWorld(); meshes.push(mesh);
  });
  return { meshes, dispose() { meshes.forEach(mesh => mesh.geometry.dispose()); material.dispose(); } };
}

test('all thirteen city buildings have legible, supported ground doors and physically open center aisles', () => {
  let count = 0;
  for (const building of cityBuildings) {
    const model = architecture(building.id);
    try {
      const doors = model.meshes.filter(mesh => mesh.geometry.userData.entranceDoor?.primary);
      const heads = doors.filter(mesh => mesh.geometry.userData.entranceDoor.role === 'head');
      assert.ok(heads.length, `${building.id} needs a real ground entrance`);
      for (const head of heads) {
        const { room, floor, x, z, opening, height } = head.geometry.userData.entranceDoor;
        const parts = doors.filter(mesh => mesh.geometry.userData.entranceDoor.room === room);
        for (const role of ['jamb', 'glazing', 'leaf-stile', 'leaf-rail', 'kick-panel', 'pull', 'hinge', 'threshold', 'canopy', 'entry-light']) {
          assert.ok(parts.some(mesh => mesh.geometry.userData.entranceDoor.role === role), `${room}: missing ${role}`);
        }
        // Raycasts cross actual shell, hardware and leaves, not just declared apertures.
        const ray = new Raycaster(new Vector3(), new Vector3(0, 0, -1), 0, .85);
        for (const offset of [-.30, -.20, -.10, 0, .10, .20, .30].map(fraction => fraction * opening)) for (const elevation of [.35, height * .49, height * .7]) {
          ray.ray.origin.set(x + offset, floor + elevation, z + .70);
          assert.equal(ray.intersectObjects(model.meshes, false).length, 0, `${room}: blocked entrance at ${offset}, ${elevation}`);
        }
        ray.set(new Vector3(x, floor + .1, z), new Vector3(0, -1, 0)); ray.far = .12;
        assert.ok(ray.intersectObjects(model.meshes).length, `${room}: floating threshold`);
        const leaf = parts.find(mesh => mesh.geometry.userData.entranceDoor.role === 'glazing')!;
        const bounds = new Box3().setFromObject(leaf);
        assert.ok(bounds.max.x - bounds.min.x > .18, `${room}: door appears edge-on from public path`);
        count++;
      }
    } finally { model.dispose(); }
  }
  assert.ok(count >= 19, 'Individual wings and rowhouses retain separate front doors');
});

test('station platform has a genuine guideway slot and an uninterrupted access-side boarding floor', () => {
  const model = architecture('transit-garden');
  try {
    const platform = model.meshes.filter(mesh => mesh.geometry.userData.floor?.name === 'station-boarding-platform');
    const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0), 0, .5);
    for (const z of [-1.3, -.6, 0, .6, 1.3]) {
      for (const x of [-1.05, -.5, 0, .5]) {
        ray.ray.origin.set(x, 2.4, z);
        assert.equal(ray.intersectObjects(platform).length, 0, 'Guideway/bogies need open space below train');
      }
      ray.ray.origin.set(-1.4, 2.4, z);
      if (Math.abs(z) > .6) assert.equal(ray.intersectObjects(platform).length, 0, 'Rear service pad clears the turning bogies');
      for (const x of [.63, 1, 1.55]) {
        ray.ray.origin.set(x, 2.4, z);
        const hit = ray.intersectObjects(platform)[0];
        assert.ok(hit && Math.abs(hit.point.y - 2.32) < 1e-5);
      }
    }
  } finally { model.dispose(); }
});

test('six guarded coolers sit on actual non-solar roof surfaces and share bounded resources', () => {
  const assembly = createCityVentilation();
  try {
    const casings = assembly.root.getObjectByName('city-cooling-casing') as InstancedMesh;
    const rotor = assembly.root.getObjectByName('city-cooling-rotor') as InstancedMesh;
    assert.equal(casings.count, 6); assert.equal(assembly.root.children.length, 5);
    const matrix = new Matrix4(), local = new Matrix4(), placement = new Object3D();
    for (const [index, mount] of CITY_VENTILATION_MOUNTS.entries()) {
      const building = cityBuildings.find(item => item.id === mount.building)!;
      const model = architecture(building.id);
      placement.position.set(building.x, CITY_BASE_Y, building.z); placement.rotation.set(0, building.rotation, 0); placement.updateMatrix();
      casings.getMatrixAt(index, matrix); local.multiplyMatrices(placement.matrix.clone().invert(), matrix);
      const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
      try {
        for (const x of [-.35, .35]) for (const z of [-.29, .29]) {
          const foot = new Vector3(x, 0, z).applyMatrix4(local);
          ray.ray.origin.copy(foot).add(new Vector3(0, .1, 0));
          const roof = ray.intersectObjects(model.meshes)[0];
          assert.ok(roof && Math.abs(foot.y - roof.point.y) < 1e-5, `${mount.building}: roof sleeper is unsupported`);
        }
      } finally { model.dispose(); }
    }
    rotor.geometry.computeBoundingBox();
    const bounds = rotor.geometry.boundingBox!;
    assert.ok(bounds.max.y + .55 < .617, 'Blades remain below safety grille');
    assert.ok(Math.hypot(bounds.max.x, bounds.max.z) < .43, 'Rotating swept envelope clears casing');
    const before = new Matrix4(); rotor.getMatrixAt(0, before); assembly.update(1.3); rotor.getMatrixAt(0, matrix); assert.notDeepEqual(matrix.elements, before.elements);
    const resources = assembly.root.children.map(item => (item as InstancedMesh).geometry.uuid);
    assembly.setQuality('low'); assert.equal(rotor.count, 2); assembly.setQuality('medium'); assert.equal(rotor.count, 4); assembly.setQuality('high'); assert.equal(rotor.count, 6);
    assert.deepEqual(assembly.root.children.map(item => (item as InstancedMesh).geometry.uuid), resources);
  } finally { assembly.release(); }
});

test('rooftop fan motion freezes when paused without rebuilding on quality changes', async () => {
  const runtime = { current: createSceneRuntime() };
  const renderer = await create(createElement(CityVentilation, { runtime, paused: false, quality: 'high' }));
  const rotor = renderer.scene.instance.getObjectByName('city-cooling-rotor') as InstancedMesh;
  const matrix = new Matrix4();
  try {
    runtime.current.elapsed = 2; await renderer.advanceFrames(1, .016); rotor.getMatrixAt(0, matrix); const before = matrix.clone();
    await renderer.update(createElement(CityVentilation, { runtime, paused: true, quality: 'low' }));
    runtime.current.elapsed = 5; await renderer.advanceFrames(1, .016); rotor.getMatrixAt(0, matrix);
    assert.deepEqual(matrix.elements, before.elements); assert.equal(rotor.count, 2);
    await renderer.update(createElement(CityVentilation, { runtime, paused: false, quality: 'medium' }));
    await renderer.advanceFrames(1, .016); rotor.getMatrixAt(0, matrix); assert.notDeepEqual(matrix.elements, before.elements); assert.equal(rotor.count, 4);
  } finally { await renderer.unmount(); }
});
