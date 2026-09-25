import assert from 'node:assert/strict';
import test from 'node:test';
import React, { useEffect } from 'react';
import { create } from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import { Matrix4, Ray, SRGBColorSpace, Vector3 } from 'three';
import { AmbientSystem } from '../src/components/world/AmbientSystem.tsx';
import { architectureFootprints, canPlacePlant, createLandscapePlan, distanceToSegment, generatePlantPositions, archipelagoGeometry, ISLANDS, islandContour, islandDistance, landDistance, pathGeometry, pathHeight, terrainBaseHeight, terrainHeight } from '../src/components/world/terrain.ts';
import { cloudOrigin, cloudVisibility, cloudPuffTransform, createCloudClusters, rayCloudDistance, updateCloudResponses } from '../src/components/world/clouds.ts';
import { makeResearchBuilding } from '../src/components/world/ResearchInstitute.tsx';
import { makeGardenGallery } from '../src/components/world/GardenGallery.tsx';
import { makeReceptionTerminal } from '../src/components/world/ReceptionTerminal.tsx';
import { makeComputeBuilding } from '../src/components/world/ComputeBuilding.tsx';
import { makeExperienceStudio, makeHistoryMuseum } from '../src/components/world/CivicLandmarks.tsx';
import { createArcadeHall } from '../src/components/world/ArcadeHall.tsx';
import { makeCampusHall } from '../src/components/world/CampusHall.tsx';
import { createSceneRuntime, motionPolicy, world } from '../src/content/world.ts';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('ungraded terrain bears actual architecture foundations and bridges cross real channels', () => {
  const plan = createLandscapePlan();
  // Final graded foundation contact and finished-floor clearance are sampled
  // against actual building faces in circulation.test.ts.
  const builders={work:makeComputeBuilding,experience:makeExperienceStudio,research:makeResearchBuilding,purdue:makeCampusHall,history:makeHistoryMuseum,about:makeGardenGallery,contact:makeReceptionTerminal,arcade:createArcadeHall};
  for (const footprint of architectureFootprints()) {
    if (footprint.id === 'building') {
      for(let i=0;i<12;i++)assert.ok(Math.abs(terrainBaseHeight(footprint.x+Math.cos(i*Math.PI/6)*footprint.radius,footprint.z+Math.sin(i*Math.PI/6)*footprint.radius)-2.6)<1e-6,'Lighthouse bearing');
      continue;
    }
    // Planting circles reserve motion/foliage clearance; bearing is measured on the
    // actual foundation. Slabs embed into small variations near the coast.
    const geometry=builders[footprint.id](),config=world.landmarks.find(p=>p.id===footprint.id),yaw=config.rotationY??0;
    try {
      const foundation=Object.values(geometry).find(g=>g.userData.floor?.kind==='foundation');
      foundation.computeBoundingBox();const bottom=foundation.boundingBox.min.y,p=foundation.attributes.position;
      for(let i=0;i<p.count;i++) {
        const x=footprint.x+p.getX(i)*Math.cos(yaw)+p.getZ(i)*Math.sin(yaw);
        const z=footprint.z-p.getX(i)*Math.sin(yaw)+p.getZ(i)*Math.cos(yaw);
        assert.ok(terrainBaseHeight(x,z)>=bottom-.001,`${footprint.id} foundation has no bearing at ${x},${z}`);
      }
    } finally { Object.values(geometry).forEach(g=>g.dispose()); }
  }
  for (const path of plan.paths.filter(path => !path.elevated)) for (let index = 1; index < path.points.length; index++) {
    const a = path.points[index - 1];
    const b = path.points[index];
    for (let step = 0; step <= 20; step++) assert.ok(pathHeight(path, a.x + (b.x - a.x) * step / 20, a.z + (b.z - a.z) * step / 20) > .4);
  }
  const geometry = archipelagoGeometry();
  try {
    assert.ok(Array.from(geometry.attributes.position.array).every(Number.isFinite));
    assert.ok(Array.from(geometry.attributes.normal.array).every(Number.isFinite));
    assert.equal(geometry.attributes.uv.count, geometry.attributes.position.count);
    assert.ok(Array.from(geometry.attributes.uv.array).every(Number.isFinite));
    assert.ok(geometry.index.count > 10000);
  } finally { geometry.dispose(); }
});

test('each curved path is one connected ribbon without separate segment seams', () => {
  const paths = createLandscapePlan().paths.filter(path => !path.elevated && !path.bridge);
  const geometry = pathGeometry(paths);
  try {
    const parents = Array.from({ length: geometry.attributes.position.count }, (_, index) => index);
    const root = index => { while (parents[index] !== index) index = parents[index]; return index; };
    const triangles = geometry.index.array;
    for (let index = 0; index < triangles.length; index += 3) {
      const a = root(triangles[index]);
      parents[root(triangles[index + 1])] = a;
      parents[root(triangles[index + 2])] = a;
    }
    assert.equal(new Set(parents.map((_, index) => root(index))).size, paths.length);
    assert.ok(Array.from(geometry.attributes.position.array).every(Number.isFinite));
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
    for (const circle of [...plan.structures, ...plan.rocks, ...plan.trees.map(tree => ({...tree, radius: tree.height * .15}))]) assert.ok(Math.hypot(plant.x - circle.x, plant.z - circle.z) > circle.radius + plant.reach, circle.id);
    for (const path of plan.paths) for (let index = 1; index < path.points.length; index++) assert.ok(distanceToSegment(plant.x, plant.z, path.points[index - 1], path.points[index]) > path.width / 2 + plant.reach);
    assert.ok(landDistance(plant.x, plant.z) > plant.reach + 1.1);
  }
  for (const solid of [...plan.structures, ...plan.rocks, ...plan.trees]) assert.equal(canPlacePlant(solid.x, solid.z, .95, plan), false, solid.id);
  for (const path of plan.paths) assert.equal(canPlacePlant(path.points[0].x, path.points[0].z, .95, plan), false);
  assert.equal(canPlacePlant(0, -45, .95, plan), false);
});

test('every cloud density nucleus remains ray-accessible through diagonal drift and deformation', () => {
  const clusters = createCloudClusters();
  const output = { position: new Vector3(), scale: new Vector3() };
  const ray = new Ray(new Vector3(), new Vector3(0, 0, -1));
  for (const elapsed of [0, 357, 2400, 10000]) for (const response of [0, .5, 1]) for (const cluster of clusters) {
    for (const puff of cluster.puffs) {
      cloudPuffTransform(cluster, puff, elapsed, response, output);
      ray.origin.copy(output.position).addScaledVector(ray.direction, -30);
      assert.notEqual(rayCloudDistance(ray, cluster, elapsed, response), null);

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
    const ground = item.scene.getObjectByName('archipelago-land');
    assert.equal(ground.material.map.colorSpace, SRGBColorSpace);
    assert.equal(ground.geometry.attributes.aTerrain.count, ground.geometry.attributes.position.count);
    assert.ok(ground.material.envMapIntensity <= .2);
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
    assert.equal(item.scene.getObjectByName('grove-foliage').material.userData.canopyWind.strength.value, tier === 'low' ? 0 : 1);
    assert.equal(clouds.geometry.drawRange.count, clouds.geometry.userData.cloudRanges[world.quality[tier].clouds - 1].start + clouds.geometry.userData.cloudRanges[world.quality[tier].clouds - 1].count);
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
    const canopyWind = item.scene.getObjectByName('grove-foliage').material.userData.canopyWind;
    const frozenCanopy = canopyWind.time.value;
    const frozen = grass.material.uniforms.uPointerStrength.value;
    const frozenClouds = clouds.material.uniforms.uOrigins.value.map(origin => origin.toArray());
    await item.renderer.update(item.render(quality, true));
    item.runtime.current.pointerActive = false;
    item.runtime.current.elapsed = 50;
    await item.frames(20);
    assert.equal(grass.material.uniforms.uPointerStrength.value, frozen);
    assert.equal(canopyWind.time.value, frozenCanopy);
    assert.deepEqual(clouds.material.uniforms.uOrigins.value.map(origin => origin.toArray()), frozenClouds);
    await item.renderer.update(item.render(quality, false));
    await item.frames(140);
    assert.ok(grass.material.uniforms.uPointerStrength.value < 1e-7);
    assert.equal(canopyWind.time.value, 50);
    assert.equal(item.runtime.current.plantInteraction, 1);
  } finally { await item.renderer.unmount(); }
});


test('organic shores and vegetation cover every suitable island without the former planting rectangle', () => {
  const plan = createLandscapePlan(); const plants = generatePlantPositions(18000, plan);
  for (const island of ISLANDS) {
    const radii = [];
    for (let sample = 0; sample < 192; sample++) {
      const angle = sample / 192 * Math.PI * 2; const contour = islandContour(island, angle);
      const x = island.x + Math.cos(angle) * island.rx * contour; const z = island.z + Math.sin(angle) * island.rz * contour;
      assert.ok(Math.abs(islandDistance(island, x, z)) < 1e-10, island.id); radii.push(contour);
    }
    assert.ok(Math.max(...radii) - Math.min(...radii) > .2);
    if (island.id !== 'beacon') assert.ok(plants.some(p => Math.hypot((p.x-island.x)/island.rx,(p.z-island.z)/island.rz)<.8), island.id);
  }
  assert.ok(plants.some(p => p.x > 29));
  // The west town beach is intentionally open sand; require planting inland of it.
  assert.ok(plants.some(p => p.x < -22 && p.z < -60));
  assert.ok(plants.some(p => p.z < -32)); assert.ok(plants.some(p => p.z > 22));
  for (const [x,z] of [[0,-45],[-27,-23],[18,15]]) assert.ok(landDistance(x,z)<0,'Open channels must remain water.');
});


test('cloud drift remains continuous across long sessions and former wrap boundaries', () => {
  const position = new Vector3(); const next = new Vector3();
  for (const cloud of createCloudClusters()) for (let time = 0; time <= 10000; time += 17) {
    cloudOrigin(cloud, time, position); cloudOrigin(cloud, time + .1, next);
    if (next.distanceTo(position) > .1) assert.ok(cloudVisibility(cloud, time) < .001 && cloudVisibility(cloud, time + .1) < .001);
    else assert.ok(next.x > position.x);
    assert.ok(Math.abs(position.x) <= 520);
  }
});
