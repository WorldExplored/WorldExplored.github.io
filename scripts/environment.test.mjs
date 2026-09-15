import assert from 'node:assert/strict';
import test from 'node:test';
import React, { useEffect } from 'react';
import { create } from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import { Matrix4, Ray, SRGBColorSpace, Vector3 } from 'three';
import { AmbientSystem } from '../src/components/world/AmbientSystem.tsx';
import { architectureFootprints, canPlacePlant, createLandscapePlan, distanceToSegment, generatePlantPositions, meadowGeometry, shorelineZ, terrainHeight } from '../src/components/world/terrain.ts';
import { cloudPuffTransform, createCloudClusters, rayCloudDistance, updateCloudResponses } from '../src/components/world/clouds.ts';
import { createSceneRuntime, motionPolicy, world } from '../src/content/world.ts';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('continuous meadow preserves every architecture base and connects the paths on land', () => {
  const plan = createLandscapePlan();
  for (const footprint of architectureFootprints()) {
    for (let index = 0; index < 12; index++) {
      const angle = index * Math.PI / 6;
      assert.ok(Math.abs(terrainHeight(footprint.x + Math.cos(angle) * footprint.radius, footprint.z + Math.sin(angle) * footprint.radius) - .8) < 1e-6, footprint.id);
    }
  }
  for (const path of plan.paths) for (let index = 1; index < path.points.length; index++) {
    const a = path.points[index - 1];
    const b = path.points[index];
    for (let step = 0; step <= 20; step++) assert.ok(terrainHeight(a.x + (b.x - a.x) * step / 20, a.z + (b.z - a.z) * step / 20) > .4);
  }
  const geometry = meadowGeometry();
  try {
    assert.ok(Array.from(geometry.attributes.position.array).every(Number.isFinite));
    assert.ok(Array.from(geometry.attributes.normal.array).every(Number.isFinite));
    assert.equal(geometry.attributes.uv.count, geometry.attributes.position.count);
    assert.ok(Array.from(geometry.attributes.uv.array).every(Number.isFinite));
    assert.ok(geometry.index.count > 10000);
  } finally { geometry.dispose(); }
});

test('deterministic plants clear actual structures, paths, rocks, trees and shore with motion margin', () => {
  const plan = createLandscapePlan();
  const grass = generatePlantPositions(world.quality.high.grass, plan, 41);
  const flowers = generatePlantPositions(260, plan, 83);
  assert.deepEqual(grass, generatePlantPositions(world.quality.high.grass, plan, 41));
  assert.equal(grass.length, world.quality.high.grass);
  for (const plant of [...grass, ...flowers]) {
    assert.ok(canPlacePlant(plant.x, plant.z, plant.reach, plan));
    assert.ok(plant.reach >= .95);
    assert.ok(Math.abs(plant.y - terrainHeight(plant.x, plant.z) + .015) < 1e-9);
    for (const circle of [...plan.structures, ...plan.rocks, ...plan.trees]) assert.ok(Math.hypot(plant.x - circle.x, plant.z - circle.z) > circle.radius + plant.reach, circle.id);
    for (const path of plan.paths) for (let index = 1; index < path.points.length; index++) assert.ok(distanceToSegment(plant.x, plant.z, path.points[index - 1], path.points[index]) > path.width / 2 + plant.reach);
    assert.ok(plant.z + plant.reach < shorelineZ(plant.x) + .2);
  }
  for (const solid of [...plan.structures, ...plan.rocks, ...plan.trees]) assert.equal(canPlacePlant(solid.x, solid.z, .95, plan), false, solid.id);
  for (const path of plan.paths) assert.equal(canPlacePlant(path.points[0].x, path.points[0].z, .95, plan), false);
  assert.equal(canPlacePlant(0, shorelineZ(0) + 2, .95, plan), false);
});

test('every cloud puff has a matching ray volume through drift, wrapping and deformation', () => {
  const clusters = createCloudClusters();
  const output = { position: new Vector3(), scale: new Vector3() };
  const ray = new Ray(new Vector3(), new Vector3(0, 0, -1));
  for (const elapsed of [0, 357, 2400, 10000]) for (const response of [0, .5, 1]) for (const cluster of clusters) {
    for (const puff of cluster.puffs) {
      cloudPuffTransform(cluster, puff, elapsed, response, output);
      ray.origin.copy(output.position).addScaledVector(ray.direction, -30);
      assert.notEqual(rayCloudDistance(ray, cluster, elapsed, response), null);
      ray.origin.x += output.scale.x * .92;
      assert.notEqual(rayCloudDistance(ray, cluster, elapsed, response), null, 'A ray over the visible edge of a puff must hit its ellipsoid.');
    }
    ray.origin.set(10000, 10000, 10000);
    assert.equal(rayCloudDistance(ray, cluster, elapsed, response), null);
  }
});

test('all eligible clouds respond locally and return smoothly, while paused and reduced states freeze them', () => {
  const output = { position: new Vector3(), scale: new Vector3() };
  const ray = new Ray(new Vector3(), new Vector3(0, 0, -1));
  for (const target of createCloudClusters()) {
    const clusters = [target];
    cloudPuffTransform(target, target.puffs[0], 725, 0, output);
    ray.origin.copy(output.position).addScaledVector(ray.direction, -30);
    assert.equal(updateCloudResponses(clusters, ray, 725, 1 / 60, 1, false), 1);
    assert.ok(target.response > 0 && target.response < .12);
    for (let index = 0; index < 120; index++) updateCloudResponses(clusters, ray, 725, 1 / 60, 1, false);
    assert.ok(target.response > .99 && target.response <= 1);
    const frozen = target.response;
    updateCloudResponses(clusters, null, 750, 1, 1, true);
    assert.equal(target.response, frozen);
    assert.equal(motionPolicy(true, false, false).ambient, false);
    updateCloudResponses(clusters, null, 750, 1, 1, !motionPolicy(true, false, false).ambient);
    assert.equal(target.response, frozen);
    for (let index = 0; index < 160; index++) updateCloudResponses(clusters, null, 725, 1 / 60, 1, false);
    assert.ok(target.response < 1e-7);
    assert.equal(updateCloudResponses(clusters, ray, 725, 1 / 60, 0, false), 0, 'A hidden tier instance cannot react.');
  }
  const clusters = createCloudClusters();
  const first = clusters[0];
  cloudPuffTransform(first, first.puffs[0], 0, 0, output);
  ray.origin.copy(output.position).addScaledVector(ray.direction, -30);
  updateCloudResponses(clusters, ray, 0, 1 / 60, clusters.length, false);
  assert.equal(clusters.filter(cluster => cluster.targeted).length, 1, 'Only the nearest intersected cluster responds.');
});

async function fixture(quality = 'high') {
  const runtime = { current: createSceneRuntime() };
  let root;
  function Probe() { const get = useThree(state => state.get); useEffect(() => { root = get(); }, [get]); return null; }
  const render = (tier, paused = false) => React.createElement(React.Fragment, null, React.createElement(Probe), React.createElement(AmbientSystem, { runtime, paused, quality: tier }));
  const renderer = await create(render(quality), { camera: { position: world.overview.position, fov: 43 } });
  const frames = async count => { for (let index = 0; index < count; index++) await renderer.advanceFrames(1, 1 / 60); };
  return { runtime, renderer, render, frames, root, scene: renderer.scene.instance };
}

test('fine foliage stays inside the same exclusion footprints used for planting', async () => {
  const item = await fixture();
  try {
    const foliage = item.scene.getObjectByName('grove-foliage');
    const plan = createLandscapePlan();
    const matrix = new Matrix4();
    const vertex = new Vector3();
    const positions = foliage.geometry.attributes.position;
    for (let instance = 0; instance < foliage.count; instance++) {
      foliage.getMatrixAt(instance, matrix);
      for (let index = 0; index < positions.count; index++) {
        vertex.fromBufferAttribute(positions, index).applyMatrix4(matrix);
        assert.ok(plan.trees.some(tree => Math.hypot(vertex.x - tree.x, vertex.z - tree.z) <= tree.radius), 'A visible leaf must remain inside an excluded tree footprint.');
      }
    }
    const ground = item.scene.getObjectByName('continuous-meadow');
    assert.equal(ground.material.map.colorSpace, SRGBColorSpace);
    assert.ok(ground.material.color.g > ground.material.color.r);
    assert.ok(ground.material.envMapIntensity <= .1);
  } finally { await item.renderer.unmount(); }
});

test('tier changes retain all mounted geometry, materials and textures without disposing a live resource', async () => {
  const item = await fixture();
  const resources = new Map();
  item.scene.traverse(object => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const resource of [object.geometry, ...materials, ...materials.flatMap(material => material ? [material.map, material.bumpMap] : [])]) {
      if (resource && !resources.has(resource.uuid)) { const record = { resource, disposals: 0 }; resource.addEventListener('dispose', () => record.disposals++); resources.set(resource.uuid, record); }
    }
  });
  const grass = item.scene.getObjectByName('environment-grass');
  const clouds = item.scene.getObjectByName('environment-clouds');
  for (const tier of ['low', 'medium', 'high', 'low', 'high']) {
    await item.renderer.update(item.render(tier, true));
    assert.equal(item.scene.getObjectByName('environment-grass'), grass);
    assert.equal(item.scene.getObjectByName('environment-clouds'), clouds);
    assert.equal(grass.count, world.quality[tier].grass);
    assert.equal(clouds.count, world.quality[tier].clouds * 6);
    item.scene.traverse(object => {
      if (object.geometry) assert.ok(resources.has(object.geometry.uuid));
      if (object.material?.map) assert.ok(resources.has(object.material.map.uuid));
    });
    assert.ok([...resources.values()].every(record => record.disposals === 0));
  }
  await item.renderer.unmount();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok([...resources.values()].every(record => record.disposals === 1));
});

for (const quality of ['high', 'medium', 'low']) test(`local pointer and pause behavior at ${quality} quality`, async () => {
  const item = await fixture(quality);
  try {
    const grass = item.scene.getObjectByName('environment-grass');
    const clouds = item.scene.getObjectByName('environment-clouds');
    const matrix = new Matrix4();
    grass.getMatrixAt(0, matrix);
    const position = new Vector3().setFromMatrixPosition(matrix);
    item.runtime.current.pointerWorld = [position.x, position.y, position.z];
    item.root.camera.lookAt(position); item.root.camera.updateMatrixWorld();
    item.runtime.current.hovered = 'work';
    await item.frames(10);
    assert.equal(item.runtime.current.plantInteraction, 0);
    assert.equal(item.runtime.current.cloudInteraction, 0);
    assert.equal(grass.material.uniforms.uPointerStrength.value, 0);
    item.runtime.current.pointerActive = true;
    await item.frames(10);
    assert.equal(item.runtime.current.plantInteraction, 1);
    assert.ok(grass.material.uniforms.uPointerStrength.value > .5);
    const frozen = grass.material.uniforms.uPointerStrength.value;
    const frozenClouds = Array.from(clouds.instanceMatrix.array);
    await item.renderer.update(item.render(quality, true));
    item.runtime.current.pointerActive = false;
    item.runtime.current.elapsed = 50;
    await item.frames(20);
    assert.equal(grass.material.uniforms.uPointerStrength.value, frozen);
    assert.deepEqual(Array.from(clouds.instanceMatrix.array), frozenClouds);
    await item.renderer.update(item.render(quality, false));
    await item.frames(140);
    assert.ok(grass.material.uniforms.uPointerStrength.value < 1e-7);
    assert.equal(item.runtime.current.plantInteraction, 1);
  } finally { await item.renderer.unmount(); }
});
