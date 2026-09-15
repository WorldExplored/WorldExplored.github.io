import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { create, act } from '@react-three/test-renderer';
import { InstancedMesh, Matrix4, Vector3, type Mesh } from 'three';
import { CoastalLife, createFishHomes } from '../src/components/world/CoastalLife';
import { createSceneRuntime, type QualityTier } from '../src/content/world';
import { landDistance, terrainHeight } from '../src/components/world/terrain';
import { createFishSchools, createSchoolFish, FISH_PER_SCHOOL, SCHOOL_COUNT, stepSchoolFish, type FishDisturbance } from '../src/components/world/fishSchools';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const quiet = (): FishDisturbance => ({ camera: new Vector3(200, 40, 200), pointer: null, ripple: { x: 0, z: 0, serial: 0 } });

test('loose schools remain in safe water with aligned neighbors and continuous rare jumps', () => {
  const fish = createSchoolFish(); const disturbance = quiet(); const previous = new Vector3(); const schools = createFishSchools();
  assert.equal(schools.length, 9); assert.equal(fish.length, 72); assert.equal(new Set(schools.map(school => school.phase)).size, 9);
  let aligned = 0; let comparisons = 0; let jumpingFrames = 0;
  for (let frame = 0; frame < 60 * 130; frame++) {
    fish.forEach(item => {
      previous.copy(item.position); stepSchoolFish(item, 1 / 60, disturbance, 'high');
      assert.ok(landDistance(item.position.x, item.position.z) < -1.0);
      assert.ok(item.position.y > terrainHeight(item.position.x, item.position.z) + .12);
      assert.ok(item.position.distanceTo(previous) < .045, `pose discontinuity ${item.schoolIndex}/${item.member}`);
      assert.ok(item.position.y < .36);
      if (item.position.y > 0) jumpingFrames++;
      if (frame % 30 === 0 && item.member > 0) {
        const leader = fish[item.schoolIndex]; comparisons++;
        if (Math.cos(item.heading - leader.heading) > .8) aligned++;
        assert.ok(item.position.distanceTo(leader.position) < 5.2);
      }
    });
  }
  assert.ok(aligned / comparisons > .9); assert.ok(jumpingFrames > 0); assert.ok(jumpingFrames < fish.length * 130 * 60 * .005);
});

test('a new local ripple scatters schools then they gently rejoin their formation', () => {
  const disturbed = createSchoolFish(); const baseline = createSchoolFish(); const disturbance = quiet(); const control = quiet();
  const origin = disturbed[0].position.clone(); disturbance.ripple = { x: origin.x + .2, z: origin.z, serial: 1 };
  let peak = 0; let firstResponse = 0;
  for (let frame = 0; frame < 60 * 16; frame++) {
    disturbed.forEach((fish, index) => {
      stepSchoolFish(fish, 1 / 60, disturbance, 'medium'); stepSchoolFish(baseline[index], 1 / 60, control, 'medium');
      assert.ok(landDistance(fish.position.x, fish.position.z) < -1);
    });
    const separation = disturbed[0].position.distanceTo(baseline[0].position); peak = Math.max(peak, separation); if (frame === 1) firstResponse = separation;
  }
  assert.ok(firstResponse > .03); assert.ok(peak > .6); assert.ok(disturbed[0].position.distanceTo(baseline[0].position) < .003);
  for (let index = 0; index < baseline.length; index++) if (Math.hypot(baseline[index].school.island.x - origin.x, baseline[index].school.island.z - origin.z) > 80) assert.ok(disturbed[index].position.distanceTo(baseline[index].position) < 1e-8);
  const before = disturbed[0].position.clone(); disturbance.pointer = [before.x + .1, 0, before.z];
  for (let frame = 0; frame < 120; frame++) stepSchoolFish(disturbed[0], 1 / 60, disturbance, 'medium');
  assert.ok(disturbed[0].scatterOut > .1);
  disturbance.pointer = null; disturbance.camera.copy(disturbed[0].position).add(new Vector3(.1, 1, 0));
  for (let frame = 0; frame < 120; frame++) stepSchoolFish(disturbed[0], 1 / 60, disturbance, 'medium');
  assert.ok(disturbed[0].scatterOut > .1);
});

test('school tiers retain every school, preserve bridge resources, and freeze independently of runtime time', async () => {
  const runtime = { current: createSceneRuntime() }; const render = (quality: QualityTier = 'high', paused = false) => <CoastalLife runtime={runtime} paused={paused} quality={quality}/>;
  const renderer = await create(render()); const meshes: InstancedMesh[] = [];
  renderer.scene.instance.traverse(object => { if (object instanceof InstancedMesh) meshes.push(object); });
  const bodies = meshes.filter(mesh => /^shallow-water-fish/.test(mesh.name));
  const bridges = renderer.scene.instance.getObjectByName('coastal-bridge-rails') as Mesh;
  const geometry = meshes.map(mesh => mesh.geometry); const material = meshes.map(mesh => mesh.material); const matrix = new Matrix4();
  const advance = async (count: number) => act(async () => { for (let frame = 0; frame < count; frame++) await renderer.advanceFrames(1, 1 / 60); });
  try {
    assert.equal(createFishHomes().length, 72); assert.ok(Array.from(bridges.geometry.attributes.position.array).every(Number.isFinite));
    await advance(1);
    for (const mesh of meshes) { mesh.getMatrixAt(0, matrix); assert.ok(matrix.determinant() > 0); const hits: unknown[] = []; mesh.raycast({} as never, hits as never); assert.equal(hits.length, 0); }
    for (const quality of ['high', 'medium', 'low'] as const) {
      await renderer.update(render(quality)); await advance(1); assert.equal(bodies.reduce((total, mesh) => total + mesh.count, 0), FISH_PER_SCHOOL[quality] * SCHOOL_COUNT);
      assert.ok(bodies.every(mesh => mesh.count >= 9)); assert.deepEqual(meshes.map(mesh => mesh.geometry), geometry); assert.deepEqual(meshes.map(mesh => mesh.material), material);
    }
    await renderer.update(render('high', true)); await advance(1); const frozen = meshes.map(mesh => Array.from(mesh.instanceMatrix.array));
    runtime.current.elapsed = 5000; runtime.current.ripple = { x: 0, z: 0, serial: 100, time: 5000 }; runtime.current.pointerActive = true;
    await advance(180); assert.deepEqual(meshes.map(mesh => Array.from(mesh.instanceMatrix.array)), frozen);
    const source = readFileSync(new URL('../src/components/world/CoastalLife.tsx', import.meta.url), 'utf8'); assert.doesNotMatch(source, /onPointer|onClick|onWheel/);
  } finally { await renderer.unmount(); }
});
