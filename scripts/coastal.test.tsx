import test from 'node:test';
import assert from 'node:assert/strict';
import { create, act } from '@react-three/test-renderer';
import { Matrix4, Vector3, type InstancedMesh, type Mesh } from 'three';
import { CoastalLife, createFishHomes } from '../src/components/world/CoastalLife';
import { createSceneRuntime, type QualityTier } from '../src/content/world';
import { landDistance } from '../src/components/world/terrain';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('shallow fish stay in water, react locally, and freeze under reduced motion', async () => {
  const runtime = { current: createSceneRuntime() };
  const render = (quality: QualityTier = 'high', paused = false) => <CoastalLife runtime={runtime} paused={paused} quality={quality} />;
  const renderer = await create(render());
  const fish = renderer.scene.instance.getObjectByName('shallow-water-fish') as InstancedMesh;
  const bridges = renderer.scene.instance.getObjectByName('coastal-bridge-rails') as Mesh;
  const homes = createFishHomes(); const matrix = new Matrix4(); const point = new Vector3();
  const position = (index: number) => { fish.getMatrixAt(index, matrix); return point.setFromMatrixPosition(matrix).clone(); };
  const advance = async (count: number) => { await act(async () => { for (let i = 0; i < count; i++) await renderer.advanceFrames(1, 1 / 60); }); };
  try {
    assert.ok(homes.length >= 20);
    assert.ok(Array.from(bridges.geometry.attributes.position.array).every(Number.isFinite));
    await advance(1); const before = homes.map((_, index) => position(index));
    runtime.current.pointerActive = true; runtime.current.pointerWorld = [homes[0][0] + .3, 0, homes[0][1] + .2];
    await advance(120);
    assert.ok(position(0).distanceTo(before[0]) > .5);
    homes.forEach(([x,z],index) => {
      const current = position(index); assert.ok(landDistance(current.x,current.z) < -.64);
      assert.ok(current.distanceTo(before[index]) < 2.3);
      if (Math.hypot(x-runtime.current.pointerWorld[0],z-runtime.current.pointerWorld[2])>3) assert.ok(current.distanceTo(before[index])<1e-6);
    });
    await renderer.update(render('low',true)); await advance(1); const frozen = Array.from(fish.instanceMatrix.array);
    runtime.current.pointerWorld = [0,0,0]; await advance(180); assert.deepEqual(Array.from(fish.instanceMatrix.array),frozen);
    assert.equal(fish.count,Math.ceil(homes.length*.5));
    const geometry=fish.geometry;const material=fish.material;
    await renderer.update(render('medium')); await advance(1); assert.equal(fish.geometry,geometry);assert.equal(fish.material,material);
    runtime.current.pointerActive=false;await advance(300); assert.ok(position(0).distanceTo(before[0])<.001);
  } finally { await renderer.unmount(); }
});
