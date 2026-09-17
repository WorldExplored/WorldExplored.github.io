import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { create } from '@react-three/test-renderer';
import { Box3, DoubleSide, Matrix4, Mesh, InstancedMesh, MeshBasicMaterial, Object3D, Raycaster, Vector3 } from 'three';
import { CityLife } from '../src/components/world/CityLife';
import { buildCityArchitecture } from '../src/components/world/CityArchitecture';
import { CITY_BASE_Y, cityBuildings, cityLocalToWorld, cityRoofMounts, createCityTransitRoute } from '../src/components/world/city';
import { cityLiftPose, createCityLift } from '../src/components/world/CityLift';
import type { CityLiftPlan } from '../src/components/world/CityArchitecture';
import { createSceneRuntime } from '../src/content/world';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const output = process.env.SERVICE_GEOMETRY_AUDIT;
test('full 22-second solar geometry cycle: roof clearance, mounts and station headroom', async () => {
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
  const frames = root.getObjectByName('city-articulated-solar-frames')! as InstancedMesh;
  const cells = root.getObjectByName('city-articulated-solar-cells')! as InstancedMesh;
  const issues: Array<Record<string, unknown>> = [];
  let minimumPanelClearance = Infinity;
  const matrix = new Matrix4(), local = new Matrix4(), ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
  try {
    for (let step = 0; step <= 440; step++) {
      const time = step * .05;
      runtime.current.elapsed = time;
      await renderer.advanceFrames(1, .05);
      root.updateMatrixWorld(true);
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
    for (const mount of cityRoofMounts) {
      const support = root.getObjectByName('solar-roof-supports')! as Mesh;
      const a = architecture.find(a => a.building.id === mount.building)!;
      const positions=support.geometry.attributes.position;
      for (const x of [-mount.width*.3,mount.width*.3]) for(const z of [-mount.depth*.25,mount.depth*.25]) {
        const foot=cityLocalToWorld(a.building,[mount.local[0]+x,mount.local[1],mount.local[2]+z]);
        let bottom=Infinity;
        for(let i=0;i<positions.count;i++)if(Math.hypot(positions.getX(i)-foot[0],positions.getZ(i)-foot[2])<.15)bottom=Math.min(bottom,positions.getY(i));
        const localFoot=new Vector3(...foot).applyMatrix4(a.inverse);ray.ray.origin.set(localFoot.x,a.building.height+1,localFoot.z);
        const roof=ray.intersectObjects(a.meshes,false)[0];
        assert.ok(roof && Math.abs(bottom-CITY_BASE_Y-roof.point.y)<.03,`${mount.building}: every rack foot contacts its actual roof`);
      }
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
    const report = { duration: 22, samples: 441, minimumPanelClearance, issues };
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


test('enclosed lifts stop at every actual landing and keep doors closed between floors', () => {
  let count=0;
  for (const building of cityBuildings) {
    const plans: CityLiftPlan[]=[], landings: number[]=[];
    buildCityArchitecture(building, geometry=>{if(geometry.userData.liftLanding)landings.push(geometry.userData.liftLanding.floor);geometry.dispose();}, plan=>plans.push(plan));
    for(const plan of plans) {
      count++; const lift=createCityLift(plan);
      try {
        assert.deepEqual(plan.floors,landings,'A shared stop has one walking surface');
        const cabinFloor=lift.cabin.getObjectByName('lift-finished-floor') as Mesh;cabinFloor.geometry.computeBoundingBox();assert.ok(Math.abs(cabinFloor.geometry.boundingBox!.max.y)<.00001,'Cabin walking surface meets the landing without a step');
        for(const [index,floor] of plan.floors.entries()) {
          lift.update(index*8+1);
          assert.ok(Math.abs(lift.cabin.position.y-floor)<.00001,'Cabin floor aligns with the served landing');
          assert.equal(cityLiftPose(plan.floors,index*8+1).open,1);
        }
        for(let time=0;time<plan.floors.length*16;time+=.05) {
          const pose=cityLiftPose(plan.floors,time);
          assert.ok(pose.floor>=plan.floors[0] && pose.floor<=plan.floors.at(-1)!);
          if(!plan.floors.some(floor=>Math.abs(pose.floor-floor)<.00001))assert.equal(pose.open,0,'Doors remain closed during travel');
        }
        assert.ok(lift.cabin.children.length>=5,'Guarded cabin includes floor, frame, glazing and doors');
      } finally {lift.dispose();}
    }
  }
  assert.equal(count,9,'All nine multi-floor city buildings have integrated lifts');
});
