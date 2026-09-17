import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { create } from '@react-three/test-renderer';
import { Box3, DoubleSide, Matrix4, Mesh, InstancedMesh, MeshBasicMaterial, Object3D, Raycaster, Triangle, Vector3 } from 'three';
import { CityLife } from '../src/components/world/CityLife';
import { buildCityArchitecture } from '../src/components/world/CityArchitecture';
import { CITY_BASE_Y, cityBuildings, cityLocalToWorld, cityRoofMounts, createCityTransitRoute } from '../src/components/world/city';
import { terrainMeshHeight } from '../src/components/world/terrain';
import { createSceneRuntime } from '../src/content/world';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const output = process.env.SERVICE_GEOMETRY_AUDIT;
test('full 22-second service geometry cycle: building clearance, mounts and guide contact', async () => {
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const architecture = cityBuildings.map(building => {
    const meshes: Mesh[] = [];
    const bounds: Box3[] = [];
    const transform = new Object3D();
    buildCityArchitecture(building, (g, f, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, yaw = 0) => {
      transform.position.set(x, y, z);
      transform.scale.set(sx, sy, sz);
      transform.rotation.set(0, yaw, 0);
      transform.updateMatrix();
      g.applyMatrix4(transform.matrix);
      g.computeBoundingBox();
      const mesh = new Mesh(g, material);
      mesh.updateMatrixWorld();
      meshes.push(mesh);
      bounds.push(g.boundingBox!.clone());
    });
    transform.position.set(building.x, CITY_BASE_Y, building.z);
    transform.scale.set(1, 1, 1);
    transform.rotation.set(0, building.rotation, 0);
    transform.updateMatrix();
    return { building, meshes, bounds, inverse: transform.matrix.clone().invert() };
  });
  const runtime = { current: createSceneRuntime() };
  const renderer = await create(createElement(CityLife, { runtime, paused: false, quality: 'high', route: createCityTransitRoute() }));
  const root = renderer.scene.instance;
  const pods = root.getObjectByName('city-maintenance-pods')! as InstancedMesh;
  const frames = root.getObjectByName('city-articulated-solar-frames')! as InstancedMesh;
  const cells = root.getObjectByName('city-articulated-solar-cells')! as InstancedMesh;
  const guides = root.getObjectByName('city-aqua-infrastructure-lift-guides-docks-brackets-platforms-conduits-and-dock-stripes')! as Mesh;
  const lifts = architecture.filter(a => ['residence-west', 'residence-east'].includes(a.building.id));
  const gp = guides.geometry.attributes.position;
  const liftBoxes = lifts.map((a, index) => Array.from({ length: 3 }, (_, part) => { const box = new Box3(); for (let n = (index * 3 + part) * 36; n < (index * 3 + part + 1) * 36; n++)
    box.expandByPoint(new Vector3().fromBufferAttribute(gp, n).applyMatrix4(a.inverse)); return box; }));
  const issues: Array<Record<string, unknown>> = [];
  let minimumBuildingClearance = Infinity, minimumPanelClearance = Infinity;
  const guideContact = [true, true], nearestGuideDistance = [Infinity, Infinity], lowestPodBottom = [Infinity, Infinity];
  const matrix = new Matrix4(), local = new Matrix4(), ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
  try {
    for (let step = 0; step <= 440; step++) {
      const time = step * .05;
      runtime.current.elapsed = time;
      await renderer.advanceFrames(1, .05);
      root.updateMatrixWorld(true);
      for (let index = 0; index < 2; index++) {
        pods.getMatrixAt(index, matrix);
        matrix.premultiply(pods.matrixWorld);
        const v = pods.geometry.attributes.position;
        for (const a of architecture) {
          local.multiplyMatrices(a.inverse, matrix);
          const box = new Box3();
          for (let n = 0; n < v.count; n++)
            box.expandByPoint(new Vector3().fromBufferAttribute(v, n).applyMatrix4(local));
          for (const [part, b] of a.bounds.entries()) {
            const dx = Math.max(b.min.x - box.max.x, box.min.x - b.max.x, 0), dy = Math.max(b.min.y - box.max.y, box.min.y - b.max.y, 0), dz = Math.max(b.min.z - box.max.z, box.min.z - b.max.z, 0);
            minimumBuildingClearance = Math.min(minimumBuildingClearance, Math.hypot(dx, dy, dz));
            if (box.intersectsBox(b) && issues.filter(i => i.kind === 'building-overlap').length < 6)
              issues.push({ kind: 'building-overlap', time, lift: index, building: a.building.id, part });
          }
        }
        local.multiplyMatrices(lifts[index].inverse, matrix);
        const points = Array.from({ length: v.count }, (_, n) => new Vector3().fromBufferAttribute(v, n).applyMatrix4(local));
        for (const p of points)
          lowestPodBottom[index] = Math.min(lowestPodBottom[index], p.y);
        for (const guide of liftBoxes[index].slice(0, 2)) {
          let connected = false;
          for (const p of points)
            nearestGuideDistance[index] = Math.min(nearestGuideDistance[index], guide.distanceToPoint(p));
          for (let n = 0; n < points.length; n += 3)
            if (guide.intersectsTriangle(new Triangle(points[n], points[n + 1], points[n + 2])))
              connected = true;
          guideContact[index] &&= connected;
        }
      }
      for (const [index, mount] of cityRoofMounts.entries()) {
        const a = architecture.find(a => a.building.id === mount.building)!;
        for (const mesh of [frames, cells]) {
          mesh.getMatrixAt(index, matrix);
          matrix.premultiply(mesh.matrixWorld);
          local.multiplyMatrices(a.inverse, matrix);
          const p = mesh.geometry.attributes.position;
          for (let n = 0; n < p.count; n++) {
            const point = new Vector3().fromBufferAttribute(p, n).applyMatrix4(local);
            ray.ray.origin.set(point.x, a.building.height + 1, point.z);
            const roof = ray.intersectObjects(a.meshes, false)[0];
            if (!roof) {
              if (!issues.some(i => i.kind === 'panel-outside-roof' && i.building === mount.building))
                issues.push({ kind: 'panel-outside-roof', time, building: mount.building });
              continue;
            }
            minimumPanelClearance = Math.min(minimumPanelClearance, point.y - roof.point.y);
          }
        }
      }
    }
    for (const [index, a] of lifts.entries()) {
      const dock = liftBoxes[index][2];
      if (!guideContact[index])
        issues.push({ kind: 'pod-detached-from-guides', building: a.building.id, nearestSampledVertexToGuide: nearestGuideDistance[index], contactAtEverySample: false });
      const gap = lowestPodBottom[index] - dock.max.y;
      if (gap > .005)
        issues.push({ kind: 'pod-floats-over-dock', building: a.building.id, gap });
      for (const guide of liftBoxes[index].slice(0, 2))
        assert.ok(guide.intersectsBox(dock), 'guide root contacts dock');
      const world = cityLocalToWorld(a.building, [0, dock.min.y, -a.building.depth / 2 - .75]);
      assert.ok(Math.abs(world[1] - terrainMeshHeight(world[0], world[2])) < .005, 'dock rests on actual terrain');
    }
    for (const mount of cityRoofMounts) {
      const support = root.getObjectByName('solar-roof-supports')! as Mesh;
      const a = architecture.find(a => a.building.id === mount.building)!;
      const box = new Box3(), vertex = new Vector3(), positions=support.geometry.attributes.position;
      for(let i=0;i<positions.count;i++) {vertex.fromBufferAttribute(positions,i).applyMatrix4(support.matrixWorld);if(Math.hypot(vertex.x-mount.world[0],vertex.z-mount.world[2])<.1)box.expandByPoint(vertex);}
      assert.ok(!box.isEmpty(),'Merged support geometry includes each roof mount');
      const center = box.getCenter(new Vector3()).applyMatrix4(a.inverse);
      ray.ray.origin.set(center.x, a.building.height + 1, center.z);
      const roof = ray.intersectObjects(a.meshes, false)[0];
      const gap = box.min.y - CITY_BASE_Y - roof.point.y;
      if (gap > .005)
        issues.push({ kind: 'solar-pedestal-detached-from-roof', building: mount.building, gap });
    }
    const station = architecture.find(a => a.building.id === 'transit-garden')!;
    const lights = root.getObjectByName('city-station-arrival-lights')! as Mesh;
    const lightPositions = lights.geometry.attributes.position;
    const up = new Raycaster(new Vector3(), new Vector3(0, 1, 0));
    for (let i = 0; i < lightPositions.count; i++) {
      const point = new Vector3().fromBufferAttribute(lightPositions, i).applyMatrix4(station.inverse);
      up.ray.origin.copy(point);
      const ceiling = up.intersectObjects(station.meshes, false)[0];
      assert.ok(ceiling && ceiling.distance < .12, 'station light hangers reach the raised canopy');
      assert.ok(point.y > 4.2, 'arrival lights leave full platform headroom');
    }
    const report = { duration: 22, samples: 441, minimumBuildingClearance, minimumPanelClearance, nearestGuideDistance, lowestPodBottom, issues };
    if (output)
      writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    assert.ok(minimumPanelClearance > .015, 'rotating panels clear actual roof');
    assert.equal(issues.length, 0, JSON.stringify(issues));
  }
  finally {
    await renderer.unmount();
    architecture.forEach(a => a.meshes.forEach(m => m.geometry.dispose()));
    material.dispose();
  }
});
