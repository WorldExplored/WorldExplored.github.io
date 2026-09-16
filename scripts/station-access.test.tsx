import assert from 'node:assert/strict';
import test from 'node:test';
import { StrictMode } from 'react';
import { create } from '@react-three/test-renderer';
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createStationAccess, stationAccessPlan, stationSectionGeometry, StationAccess, STATION_ACCESS } from '../src/components/world/StationAccess';
import { archipelagoGeometry, terrainMeshHeight } from '../src/components/world/terrain';
import { cityBuildings, cityEntranceWorld } from '../src/components/world/city';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('the measured station stair has consistent closed steps and exact landing endpoints', () => {
  const plan = stationAccessPlan(); const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
  const terrainMaterial = new MeshBasicMaterial({ side: DoubleSide });
  const stairMaterial = new MeshBasicMaterial();
  const terrain = new Mesh(archipelagoGeometry(), terrainMaterial); terrain.updateMatrixWorld();
  try {
    assert.deepEqual(plan.bottom, { x: -5, y: terrainMeshHeight(-5, -73.8) + .07, z: -73.8 });
    assert.deepEqual(plan.top, { x: -5, y: 3.12, z: -69.6 });
    assert.ok(plan.rise > .14 && plan.rise < .17);
    assert.ok(plan.run > .24 && plan.run < .29);
    assert.equal(plan.sections.filter(section => section.kind === 'step').length, 15);
    for (let index = 0; index < plan.sections.length; index++) {
      const section = plan.sections[index]; const geometry = stationSectionGeometry(section);
      const mesh = new Mesh(geometry, stairMaterial); mesh.updateMatrixWorld();
      try {
        if (index) assert.ok(Math.abs(section.from - plan.sections[index - 1].to) < 1e-10, 'Neighboring closed solids touch with no horizontal gap');
        if (index > 1 && section.kind === 'step') assert.ok(Math.abs(section.top - plan.sections[index - 1].top - plan.rise) < 1e-10);
        const vertices = geometry.attributes.position;
        for (let n = 0; n < vertices.count; n += 2) {
          const x = vertices.getX(n); const z = vertices.getZ(n);
          ray.ray.origin.set(x, 20, z);
          const actualTerrain = ray.intersectObject(terrain)[0]?.point.y;
          assert.notEqual(actualTerrain, undefined);
          assert.ok(Math.abs(vertices.getY(n) - actualTerrain!) < .002, `Foundation ${x},${z}: geometry ${vertices.getY(n)} vs terrain ${actualTerrain}`);
          assert.ok(vertices.getY(n + 1) > actualTerrain! + .025, 'No tread is buried');
        }
        for (const x of [-5.5, -5, -4.5]) {
          ray.ray.origin.set(x, 20, (section.from + section.to) / 2);
          const top = ray.intersectObject(mesh)[0];
          assert.ok(top && Math.abs(top.point.y - section.top) < 1e-5, 'Full tread width is solid and level');
        }
        const edges = new Map<string, number>(); const indices = geometry.index!;
        for (let n = 0; n < indices.count; n += 3) for (let edge = 0; edge < 3; edge++) {
          const ids = [indices.getX(n + edge), indices.getX(n + (edge + 1) % 3)].sort((a, b) => a - b); const key = ids.join(','); edges.set(key, (edges.get(key) ?? 0) + 1);
        }
        assert.ok([...edges.values()].every(count => count === 2), 'Each staircase section is a closed manifold solid');
      } finally { geometry.dispose(); }
    }
    const station = cityBuildings.find(building => building.id === 'transit-garden')!;
    assert.deepEqual(plan.top, cityEntranceWorld(station), 'Landing meets the actual exported station doorway');
  } finally { terrain.geometry.dispose(); terrainMaterial.dispose(); stairMaterial.dispose(); }
});

test('handrails physically meet every post and remain clear of the walking corridor', () => {
  const access = createStationAccess();
  try {
    const mesh = access.root.getObjectByName('city-station-continuous-handrails') as Mesh;
    const p = mesh.geometry.attributes.position;
    for (let n = 0; n < p.count; n++) assert.ok(Math.abs(p.getX(n) + 5) >= .56, 'Rails leave at least 1.12m of clear circulation');
    const records = mesh.geometry.userData.postEndpoints as Array<{ bottom: number[]; top: number[] }>;
    assert.ok(records.length >= 12);
    for (const record of records) {
      const bottom = new Vector3(...record.bottom); const top = new Vector3(...record.top);
      const section = access.plan.sections.find(candidate => Math.abs(candidate.from - bottom.z) < 1e-5) ?? access.plan.sections.at(-1)!;
      assert.ok(Math.abs(bottom.y - section.top) < 1e-6, 'Posts are mounted directly on a tread or landing');
      assert.ok(Math.abs(top.y - bottom.y - STATION_ACCESS.railHeight) < 1e-6);
      let nearTop = Infinity; let nearBottom = Infinity;
      for (let n = 0; n < p.count; n++) { const vertex = new Vector3().fromBufferAttribute(p, n); nearTop = Math.min(nearTop, vertex.distanceTo(top)); nearBottom = Math.min(nearBottom, vertex.distanceTo(bottom)); }
      assert.ok(nearTop < .04 && nearBottom < .04, 'Actual post/rail mesh vertices reach both endpoints');
    }
    for (const point of access.plan.railPoints) for (const side of [-1, 1]) {
      const center = point.clone().add(new Vector3(side * (access.plan.width / 2 - .025), 0, 0));
      let distance = Infinity;
      for (let n = 0; n < p.count; n++) distance = Math.min(distance, new Vector3().fromBufferAttribute(p, n).distanceTo(center));
      assert.ok(distance < .04, 'Closed rail joints reach every landing and stair transition');
    }
  } finally { access.dispose(); }
});

test('station access retains resources through Strict Mode and disposes once on unmount', async () => {
  const renderer = await create(<StrictMode><StationAccess /></StrictMode>);
  const records = new Map<string, { count: number }>();
  renderer.scene.instance.traverse(object => {
    if (!(object instanceof Mesh)) return;
    assert.equal(new Raycaster(new Vector3(-5, 10, -72), new Vector3(0, -1, 0)).intersectObject(object).length, 0);
    for (const resource of [object.geometry, object.material as MeshBasicMaterial]) if (!records.has(resource.uuid)) {
      const record = { count: 0 }; records.set(resource.uuid, record); resource.addEventListener('dispose', () => record.count++);
    }
  });
  await renderer.update(<StrictMode><StationAccess /></StrictMode>);
  assert.ok([...records.values()].every(record => record.count === 0));
  await renderer.unmount(); await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok([...records.values()].every(record => record.count === 1));
});
