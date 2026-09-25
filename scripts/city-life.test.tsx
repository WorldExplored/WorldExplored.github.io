import assert from 'node:assert/strict';
import test from 'node:test';
import { StrictMode } from 'react';
import { create } from '@react-three/test-renderer';
import { InstancedMesh, Mesh, Vector3 } from 'three';
import { CityLife } from '../src/components/world/CityLife';
import { cityStationActivity, cityTransitDistance, CITY_STATION_DWELL, CITY_TRANSIT_RAMP, createCityTransitRoute, writeCityTransitPose } from '../src/components/world/city';
import { cityDocks, cityFerryDistance, createCityInfrastructureObstacles, cityTurbines, createCityFerryRoute, FERRY_DWELL, writeCityFerryPose } from '../src/components/world/cityInfrastructure';
import { landDistance, terrainHeight } from '../src/components/world/terrain';
import { createSceneRuntime, type QualityTier } from '../src/content/world';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('train dwells at the real station, smoothly departs and anticipates the next arrival', () => {
  const route = createCityTransitRoute(); const position = new Vector3(); const tangent = new Vector3();
  for (let second = 0; second < CITY_STATION_DWELL; second += .25) {
    assert.equal(cityTransitDistance(route, second), 0);
    writeCityTransitPose(route, second, 0, position, tangent);
    assert.ok(Math.hypot(position.x + 5, position.z + 68) < .3);
  }
  const velocity = (time: number) => (cityTransitDistance(route, time + .001) - cityTransitDistance(route, time)) / .001;
  const start = CITY_STATION_DWELL;
  assert.ok(velocity(start) < .001);
  assert.ok(velocity(start + CITY_TRANSIT_RAMP / 2) > route.speed * .49);
  assert.ok(Math.abs(velocity(start + CITY_TRANSIT_RAMP + 2) - route.speed) < .001);
  assert.ok(velocity(route.duration - .01) < .001);
  assert.ok(cityStationActivity(route, route.duration - 4) > cityStationActivity(route, route.duration - 10));
  assert.equal(cityStationActivity(route, 40), 0);
  const before = new Vector3(); const after = new Vector3();
  writeCityTransitPose(route, route.duration - .001, 0, before, tangent);
  writeCityTransitPose(route, route.duration + .001, 0, after, tangent);
  assert.ok(before.distanceTo(after) < .0001, 'Station dwell closes the route without a position jump.');
});

test('water taxi follows a continuous navigable loop with two actual dock dwells', () => {
  const route = createCityFerryRoute(); const point = new Vector3(); const tangent = new Vector3(); const previous = new Vector3();
  for (let index = 0; index <= 2000; index++) {
    const time = index / 2000 * route.duration;
    writeCityFerryPose(route, time, point, tangent);
    assert.ok(point.toArray().every(Number.isFinite));
    assert.ok(landDistance(point.x, point.z) < -1.5, 'The entire hull clears actual coast, including the turning arcs.');
    assert.ok(Math.abs(tangent.length() - 1) < 1e-6);
    if (index) assert.ok(previous.distanceTo(point) <= route.speed * route.duration / 2000 * 1.01);
    previous.copy(point);
  }
  for (let second = .1; second < FERRY_DWELL; second += .2) {
    assert.equal(cityFerryDistance(route, second), 0);
    assert.equal(cityFerryDistance(route, route.firstDuration + second), route.firstLength);
  }
  writeCityFerryPose(route, 0, point, tangent); assert.ok(point.distanceTo(new Vector3(-14, .17, -60)) < .01);
  writeCityFerryPose(route, route.firstDuration, point, tangent); assert.ok(point.distanceTo(new Vector3(-8, .17, -25.5)) < .06);
  writeCityFerryPose(route, Number.NaN, point, tangent); assert.ok(point.toArray().every(Number.isFinite));
  for (const dock of cityDocks) {
    assert.ok(landDistance(dock.x, dock.z + (dock.id === 'city' ? -1 : 1) * dock.length / 2) > 0, 'A dock connects to real dry land.');
  }
  for (const turbine of cityTurbines) assert.ok(landDistance(turbine.x, turbine.z) > 2);
  const obstacles = createCityInfrastructureObstacles();
  assert.equal(obstacles.length, 5);
  assert.ok(obstacles.every(obstacle => Number.isFinite(obstacle.base) && obstacle.height > 0));
  assert.ok(terrainHeight(-16.2, -70) > .4, 'The public fountain has a real city garden floor.');
});

test('tier changes retain every resource while pausing freezes all operating infrastructure', async () => {
  const runtime = { current: createSceneRuntime() }; const route = createCityTransitRoute();
  const render = (quality: QualityTier = 'high', paused = false) => <StrictMode><CityLife runtime={runtime} quality={quality} paused={paused} route={route} /></StrictMode>;
  const renderer = await create(render()); const root = renderer.scene.instance;
  const meshes: Mesh[] = []; root.traverse(object => { if ((object as Mesh).isMesh) meshes.push(object as Mesh); });
  const resources = new Set(meshes.flatMap(mesh => [mesh.geometry, ...(Array.isArray(mesh.material) ? mesh.material : [mesh.material])]));
  const disposed = new Map([...resources].map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource)! + 1));
  const snapshot = () => {
    const result: number[] = [];
    root.traverse(object => { result.push(...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray()); if ((object as InstancedMesh).isInstancedMesh) result.push(...(object as InstancedMesh).instanceMatrix.array); });
    return result;
  };
  const initial = snapshot(); runtime.current.elapsed = 13;
  await renderer.advanceFrames(1, 1 / 60);
  assert.notDeepEqual(snapshot(), initial, 'Multiple operating systems are visible within the first 15 seconds.');
  const turbine0 = root.getObjectByName('city-wind-turbine-0')!; const turbine1 = root.getObjectByName('city-wind-turbine-1')!;
  for (const index of [0, 1]) {
    const yaw = root.getObjectByName(`city-wind-turbine-nacelle-yaw-${index}`)!;
    assert.equal(yaw.children.length, 0, 'Finish meshes are batched across the yaw pivots.');
  }
  const steel = root.getObjectByName('city-wind-turbine-steel-hardware') as InstancedMesh;
  const dark = root.getObjectByName('city-wind-turbine-dark-hardware') as InstancedMesh;
  const gearboxes = root.getObjectByName('city-wind-turbine-gearboxes') as InstancedMesh;
  const rearCovers = root.getObjectByName('city-wind-turbine-rear-covers') as InstancedMesh;
  const blades = root.getObjectByName('city-sculpted-turbine-blades') as InstancedMesh;
  assert.deepEqual(steel.geometry.userData.parts, ['yaw-carrier', 'rotor-shaft', 'service-fasteners', 'service-hinge-left', 'service-hinge-right']);
  assert.deepEqual(dark.geometry.userData.parts, ['service-door', 'bearing-cap']);
  assert.equal(steel.count, 2); assert.equal(dark.count, 2); assert.equal(gearboxes.count, 2); assert.equal(rearCovers.count, 2);
  blades.geometry.computeBoundingBox();
  assert.ok(blades.geometry.boundingBox!.max.y < 2.4, 'Rotor radius stays below the 2.4m clearance limit.');
  assert.notEqual(turbine0.rotation.z, turbine1.rotation.z);
  const pausedState = snapshot();
  for (const quality of ['low', 'medium', 'high', 'low', 'high'] as const) {
    await renderer.update(render(quality, true)); runtime.current.elapsed += 20;
    await renderer.advanceFrames(2, 1 / 60);
    assert.deepEqual(snapshot(), pausedState);
    assert.equal(root.getObjectByName('city-water-taxi')!.visible, quality !== 'low');
    assert.equal(root.getObjectByName('city-maintenance-pods'), undefined, 'Detached service pods are replaced by building-owned cabins.');
    assert.ok(turbine0.visible && turbine1.visible);
    assert.ok([...disposed.values()].every(count => count === 0));
    for (const mesh of meshes) assert.ok(root.getObjectByName(mesh.name) === mesh, mesh.name);
  }
  await renderer.update(render('high')); await renderer.advanceFrames(1, 1 / 60); assert.notDeepEqual(snapshot(), pausedState);
  await renderer.unmount(); await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok([...disposed.values()].every(count => count === 1));
});
