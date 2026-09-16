import test from 'node:test';
import assert from 'node:assert/strict';
import { act, create } from '@react-three/test-renderer';
import { InstancedMesh, MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from 'three';
import { createSeaweedGeometry, createSeaweedLayout, SEAWEED_COVES, SEAWEED_REACH, Seaweed } from '../src/components/world/Seaweed';
import { createLandscapePlan, distanceToSegment, landDistance, terrainHeight } from '../src/components/world/terrain';
import { coastExposure } from '../src/components/world/waves';
import { createSceneRuntime, type QualityTier } from '../src/content/world';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('seaweed occupies five sparse sheltered beds with seabed roots and structural clearance', () => {
  const plan = createLandscapePlan();
  const sites = createSeaweedLayout(plan);
  assert.deepEqual(sites, createSeaweedLayout(plan));
  assert.ok(sites.length >= 50 && sites.length <= 100);
  assert.equal(new Set(sites.map(site => site.cove)).size, 5);
  for (const site of sites) {
    const distance = landDistance(site.x, site.z);
    assert.ok(distance < -1.5 && distance > -5);
    assert.ok(coastExposure(site.x, site.z, distance) <= 0.3);
    assert.ok(Math.abs(site.y - terrainHeight(site.x, site.z) + 0.025) < 1e-10);
    assert.ok(site.y + site.height <= -0.32 + 1e-10);
    const cove = SEAWEED_COVES[site.cove];
    assert.ok(Math.hypot(site.x - cove.x, site.z - cove.z) <= cove.radius);
    for (const item of [...plan.structures, ...plan.rocks]) assert.ok(Math.hypot(site.x - item.x, site.z - item.z) > item.radius + SEAWEED_REACH + 0.59);
    for (const path of plan.paths.filter(item => item.bridge)) for (let index = 1; index < path.points.length; index++) {
      assert.ok(distanceToSegment(site.x, site.z, path.points[index - 1], path.points[index]) > path.width / 2 + SEAWEED_REACH + 0.74);
    }
  }
});

test('every blade stays submerged and inside its reserved footprint through slow sway', () => {
  const geometries = [0, 1, 2].map(createSeaweedGeometry);
  try {
    for (const site of createSeaweedLayout()) {
      const vertices = geometries[site.variant].getAttribute('position');
      const phase = site.x * 0.73 + site.z * 0.41;
      for (let time = 0; time <= 120; time += 4) for (let index = 0; index < vertices.count; index++) {
        const y = vertices.getY(index);
        const dx = vertices.getX(index) + (Math.sin(time * 0.44 + phase) * 0.065 + Math.sin(time * 0.23 - phase) * 0.025) * y * y;
        const dz = vertices.getZ(index) + Math.cos(time * 0.31 + phase) * 0.055 * y * y;
        assert.ok(Number.isFinite(dx + dz + y));
        assert.ok(Math.hypot(dx, dz) * site.width < SEAWEED_REACH);
        assert.ok(site.y + y * site.height < -0.25);
        if (y === 0) assert.equal(Math.hypot(dx, dz), 0, 'roots do not slide on the seabed');
      }
    }
  } finally { geometries.forEach(geometry => geometry.dispose()); }
});

test('quality and reduced motion retain seaweed resources without pointer interception', async () => {
  const runtime = { current: createSceneRuntime() };
  const render = (quality: QualityTier = 'high', paused = false) => <Seaweed runtime={runtime} quality={quality} paused={paused} />;
  const renderer = await create(render());
  const meshes: InstancedMesh[] = [];
  renderer.scene.instance.traverse(object => { if (object instanceof InstancedMesh) meshes.push(object); });
  const geometry = meshes.map(mesh => mesh.geometry);
  const materials = meshes.map(mesh => mesh.material);
  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '' } as WebGLProgramParametersWithUniforms;
  (meshes[0].material as MeshStandardMaterial).onBeforeCompile(shader, {} as never);
  try {
    assert.equal(meshes.length, 3);
    for (const [quality, population] of [['high', 80], ['medium', 61], ['low', 41]] as const) {
      await renderer.update(render(quality));
      assert.equal(meshes.reduce((sum, mesh) => sum + mesh.count, 0), population);
      assert.deepEqual(meshes.map(mesh => mesh.geometry), geometry);
      assert.deepEqual(meshes.map(mesh => mesh.material), materials);
      for (const mesh of meshes) { const hits: unknown[] = []; mesh.raycast({} as never, hits as never); assert.equal(hits.length, 0); }
    }
    runtime.current.elapsed = 12;
    await act(async () => { await renderer.advanceFrames(1, 1 / 60); });
    assert.equal(shader.uniforms.seaweedTime.value, 12);
    await renderer.update(render('high', true));
    runtime.current.elapsed = 1000;
    await act(async () => { await renderer.advanceFrames(60, 1 / 60); });
    assert.equal(shader.uniforms.seaweedTime.value, 12);
  } finally { await renderer.unmount(); }
});
