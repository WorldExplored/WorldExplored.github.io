import test from 'node:test';
import assert from 'node:assert/strict';
import { act, create } from '@react-three/test-renderer';
import { Mesh, Vector3 } from 'three';
import { GardenRover, ROVER_ACCELERATION, ROVER_HALF_LENGTH, ROVER_HALF_WIDTH, ROVER_SPEED, ROVER_TURN_SPEED, createRoverRoute, createRoverState, roverClearance, roverWheelPosition, sampleRoverRoute, stepRover } from '../src/components/world/GardenRover';
import { createLandscapePlan, distanceToSegment, terrainMeshHeight } from '../src/components/world/terrain';
import { createSceneRuntime, type QualityTier } from '../src/content/world';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('five-minute garden service cycles keep bounded speed, acceleration, turns and exact docking', () => {
  for (const fps of [24, 60, 120]) {
    const route = createRoverRoute(), state = createRoverState(route), modes = new Set<string>();
    let previousMode = state.mode;
    for (let frame = 0; frame < fps * 300; frame++) {
      const old = { position: state.position.clone(), speed: state.speed, heading: state.heading, distance: state.distance };
      stepRover(state, route, 1 / fps); modes.add(state.mode);
      assert.ok(Number.isFinite(state.position.length()));
      assert.ok(state.speed <= ROVER_SPEED + 1e-9);
      assert.ok(Math.abs(state.speed - old.speed) <= ROVER_ACCELERATION / fps + 1e-6);
      assert.ok(Math.abs(state.heading - old.heading) <= ROVER_TURN_SPEED / fps + 1e-9);
      assert.ok(state.position.distanceTo(old.position) < .48 / fps + 1e-6);
      assert.ok(state.distance >= 0 && state.distance <= route.length);
      assert.ok(Math.abs(state.position.y - terrainMeshHeight(state.position.x, state.position.z) - .055) < 1e-8);
      if (state.mode === 'Idle' && previousMode === 'Return') assert.ok(state.position.distanceTo(sampleRoverRoute(route, 0)) < 1e-9);
      if (Math.abs(state.heading - old.heading) > .5 / fps) assert.ok(state.position.distanceTo(old.position) < 1e-8, 'Endpoint turns occur while stopped.');
      previousMode = state.mode;
    }
    assert.deepEqual([...modes].sort(), ['Idle', 'Return', 'Tend', 'Travel']);
    assert.ok(state.cycles >= 4);
    const frozen = JSON.stringify(state);
    stepRover(state, route, 30, true);
    assert.equal(JSON.stringify(state), frozen);
  }
});

test('the whole swept chassis and turning circles clear obstacles and fit the existing garden path', () => {
  const plan = createLandscapePlan(), route = createRoverRoute(plan), state = createRoverState(route);
  for (let distance = 0; distance <= route.length; distance += .1) {
    sampleRoverRoute(route, distance, state.position);
    assert.ok(roverClearance(state.position.x, state.position.z, plan));
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
      state.heading = angle;
      for (const x of [-ROVER_HALF_WIDTH, ROVER_HALF_WIDTH]) for (const z of [-ROVER_HALF_LENGTH, ROVER_HALF_LENGTH]) {
        const cx = state.position.x + x * Math.cos(angle) + z * Math.sin(angle);
        const cz = state.position.z - x * Math.sin(angle) + z * Math.cos(angle);
        let clearance = Infinity;
        for (let i = 1; i < route.points.length; i++) clearance = Math.min(clearance, distanceToSegment(cx, cz, route.points[i - 1], route.points[i]));
        // Endpoint corners may extend longitudinally past the trimmed service route.
        if (distance > .6 && distance < route.length - .6) assert.ok(clearance < route.width / 2 + .01);
        for (const item of [...plan.structures, ...plan.rocks, ...plan.trees]) assert.ok(Math.hypot(cx - item.x, cz - item.z) > item.radius + .1);
        assert.ok(Math.abs(terrainMeshHeight(cx, cz) - (state.position.y - .055)) < .18);
      }
    }
    for (const x of [-.29, .29]) for (const z of [-.24, .24]) {
      const wheel = roverWheelPosition(state, x, z);
      assert.ok(Math.abs(wheel.y - .13 - terrainMeshHeight(wheel.x, wheel.z) - .055) < 1e-8);
    }
  }
});

test('rendered body corners stay above terrain; wheels, dock, pause and retained resources remain coherent', async () => {
  const runtime = { current: createSceneRuntime() };
  const render = (paused = false, quality: QualityTier = 'high') => <GardenRover active={false} runtime={runtime} paused={paused} quality={quality} />;
  const renderer = await create(render());
  const vehicle = renderer.scene.findByProps({ name: 'garden-rover-vehicle' }).instance;
  const dock = renderer.scene.findByProps({ name: 'garden-rover-dock' }).instance;
  const meshes: Mesh[] = [];
  renderer.scene.instance.traverse(object => { if ((object as Mesh).isMesh) meshes.push(object as Mesh); });
  assert.equal(meshes.length, 16);
  const resources = meshes.map(mesh => [mesh.geometry, mesh.material]);
  const advance = async (frames: number) => act(async () => { for (let frame = 0; frame < frames; frame++) await renderer.advanceFrames(1, .05); });
  try {
    await advance(1);
    assert.ok(vehicle.position.distanceTo(dock.position) < 1e-8);
    renderer.scene.instance.updateWorldMatrix(true, true);
    const arm = renderer.scene.findByProps({ name: 'garden-rover-charge-arm' }).instance;
    const chassis = renderer.scene.findByProps({ name: 'garden-rover-chassis' }).instance;
    const connector = new Vector3(0, .355, .43).applyMatrix4(arm.matrixWorld);
    const bumper = new Vector3(0, .33, .38).applyMatrix4(chassis.matrixWorld);
    assert.ok(connector.distanceTo(bumper) < .055, `The recharge contact ${connector.toArray()} must meet bumper ${bumper.toArray()}.`);
    for (let section = 0; section < 120; section++) {
      await advance(20); vehicle.updateWorldMatrix(true, true);
      vehicle.traverse(object => {
        if (!(object as Mesh).isMesh) return;
        const positions = (object as Mesh).geometry.attributes.position;
        for (let index = 0; index < positions.count; index++) {
          const point = new Vector3().fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
          assert.ok(point.y >= terrainMeshHeight(point.x, point.z) + .015, `${object.name || 'body'} intersects ground`);
        }
      });
    }
    for (const quality of ['medium', 'low', 'high'] as const) { await renderer.update(render(false, quality)); await advance(1); }
    assert.deepEqual(meshes.map(mesh => [mesh.geometry, mesh.material]), resources);
    await renderer.update(render(true)); await advance(1);
    vehicle.updateWorldMatrix(true, true);
    const frozen = vehicle.matrixWorld.elements.slice();
    await advance(50); vehicle.updateWorldMatrix(true, true);
    assert.deepEqual(vehicle.matrixWorld.elements, frozen);
    for (const mesh of meshes) { const hits: unknown[] = []; mesh.raycast({} as never, hits as never); assert.equal(hits.length, 0); }
  } finally { await renderer.unmount(); }
});
