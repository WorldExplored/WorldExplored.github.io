import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { create, act } from '@react-three/test-renderer';
import { InstancedMesh, Matrix4, Vector3 } from 'three';
import { Wildlife } from '../src/components/world/Wildlife';
import { createCrabRoutes, createCrabStates, createGullPerches, createGullStates, startGullTakeoff, stepCrab, stepGull, validCrabPosition, WILDLIFE_COUNTS, writeCrabPosition, type GullMode } from '../src/components/world/wildlifeState';
import { createLandscapePlan, terrainHeight } from '../src/components/world/terrain';
import { createSceneRuntime, type QualityTier } from '../src/content/world';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const distantCamera = new Vector3(200, 200, 200);

test('gulls have varied phases, continuous complete behaviour cycles, and safe flight heights', () => {
  const birds = createGullStates(); assert.equal(birds.length, 18); assert.equal(new Set(birds.map(bird => bird.phase)).size, 18);
  assert.ok(createGullPerches().some(perch => perch.id === 'beacon-balcony-rail'));
  const modes = new Set<GullMode>(); const previous = new Vector3();
  for (let frame = 0; frame < 60 * 160; frame++) {
    for (const bird of birds) {
      previous.copy(bird.position); stepGull(bird, 1 / 60, distantCamera, null); modes.add(bird.mode);
      assert.ok(bird.position.distanceTo(previous) < .4, `${bird.index}: ${bird.mode} discontinuity`);
      assert.ok(Number.isFinite(bird.position.length())); assert.ok(bird.position.x > -110 && bird.position.x < 55 && bird.position.z > -115 && bird.position.z < 60);
      assert.ok(bird.position.y > terrainHeight(bird.position.x, bird.position.z) + .05);
      if (['gliding', 'flapping', 'circling'].includes(bird.mode)) assert.ok(bird.position.y > 8);
      if (bird.mode === 'perched') assert.ok(bird.position.distanceTo(bird.perch.position) < 1e-8);
    }
  }
  assert.deepEqual([...modes].sort(), ['approach', 'circling', 'flapping', 'gliding', 'perched', 'takeoff']);
});

test('takeoff starts at the present perch and paused gulls freeze all state', () => {
  const bird = createGullStates()[12]; assert.equal(bird.mode, 'perched'); const origin = bird.position.clone();
  stepGull(bird, 1 / 60, distantCamera, [origin.x, 0, origin.z]); assert.equal(bird.mode, 'takeoff'); assert.ok(bird.position.equals(origin));
  for (let frame = 0; frame < 120; frame++) stepGull(bird, 1 / 60, distantCamera, null);
  assert.ok(bird.position.y > origin.y + 1); assert.ok(Math.hypot(bird.position.x - origin.x, bird.position.z - origin.z) < .001);
  const snapshot = JSON.stringify(bird); stepGull(bird, 10, origin, origin.toArray(), true); assert.equal(JSON.stringify(bird), snapshot);
  startGullTakeoff(bird); assert.ok(bird.start.equals(bird.position));
});

test('all crab routes remain on gently sloping exposed coast with structure and path clearance', () => {
  const plan = createLandscapePlan(); const routes = createCrabRoutes(plan); const point = new Vector3(); assert.equal(routes.length, 10);
  for (const route of routes) for (let index = 0; index <= 100; index++) {
    writeCrabPosition(route, index / 50 - 1, point); assert.ok(validCrabPosition(point, plan)); assert.ok(Math.abs(point.y - terrainHeight(point.x, point.z) - .11) < 1e-8);
  }
  const crab = createCrabStates()[0]; const start = crab.position.clone();
  for (let frame = 0; frame < 300; frame++) stepCrab(crab, 1 / 60, distantCamera, [start.x + .2, 0, start.z]);
  assert.ok(crab.scuttle > .9); assert.ok(validCrabPosition(crab.position, plan)); assert.ok(crab.position.distanceTo(start) > .05);
  const snapshot = JSON.stringify(crab); for (let frame = 0; frame < 100; frame++) stepCrab(crab, 1 / 60, distantCamera, null, true); assert.equal(JSON.stringify(crab), snapshot);
});

test('wildlife tiers reuse geometry, have articulated silhouettes, freeze and never claim pointer input', async () => {
  const runtime = { current: createSceneRuntime() }; const render = (quality: QualityTier = 'high', paused = false) => <Wildlife runtime={runtime} quality={quality} paused={paused} />;
  const renderer = await create(render());
  const meshes: InstancedMesh[] = []; renderer.scene.instance.traverse(object => { if (object instanceof InstancedMesh) meshes.push(object); });
  const body = meshes.find(mesh => mesh.name === 'gull-bodies')!; const wings = meshes.find(mesh => mesh.name === 'gull-articulated-primaries')!; const crabs = meshes.find(mesh => mesh.name === 'crab-shells')!;
  const geometry = wings.geometry; const matrix = new Matrix4(); const position = new Vector3();
  const advance = async (frames: number) => act(async () => { for (let frame = 0; frame < frames; frame++) await renderer.advanceFrames(1, 1 / 60); });
  try {
    await advance(1); assert.equal(body.count, 18); assert.equal(crabs.count, 10); assert.ok(wings.geometry.attributes.position.count > 500);
    for (const mesh of meshes) { mesh.getMatrixAt(0, matrix); assert.ok(matrix.determinant() > 0); const hits: unknown[] = []; mesh.raycast({} as never, hits as never); assert.equal(hits.length, 0); }
    body.getMatrixAt(0, matrix); position.setFromMatrixPosition(matrix); await advance(30); body.getMatrixAt(0, matrix); assert.ok(position.distanceTo(new Vector3().setFromMatrixPosition(matrix)) > .1);
    for (const tier of ['medium', 'low'] as const) { await renderer.update(render(tier)); await advance(1); assert.equal(body.count, WILDLIFE_COUNTS[tier].gulls); assert.equal(crabs.count, WILDLIFE_COUNTS[tier].crabs); assert.equal(wings.geometry, geometry); }
    await renderer.update(render('high', true)); await advance(1); const frozen = meshes.map(mesh => Array.from(mesh.instanceMatrix.array)); await advance(90); assert.deepEqual(meshes.map(mesh => Array.from(mesh.instanceMatrix.array)), frozen);
    const source = readFileSync(new URL('../src/components/world/Wildlife.tsx', import.meta.url), 'utf8'); assert.doesNotMatch(source, /onPointer|onClick|onWheel/);
  } finally { await renderer.unmount(); }
});
