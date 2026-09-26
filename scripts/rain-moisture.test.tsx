import test from 'node:test';
import assert from 'node:assert/strict';
import { Raycaster, Vector3 } from 'three';
import { advanceCloudMoisture, advanceCloudPress, canSqueezeCloud, cloudBounds, cloudDensity, cloudRainYield, createCloudClusters, createCloudRainSource, MAX_CLOUDS } from '../src/components/world/clouds';
import { makeClouds, writeCloudMatrices } from '../src/components/world/CloudSurface';
import { createRain, RainSimulation, RAIN_GRAVITY } from '../src/components/world/Rain';

const pointSource = (x: number, y: number, z: number) => ({ sample(output: Float64Array) { output[0] = x; output[1] = y; output[2] = z; } });

test('dry white clouds cannot capture pressure; moist gray clouds yield and gradually empty', () => {
  const clouds = createCloudClusters(5), wet = clouds[0], dry = clouds[2];
  assert.ok(canSqueezeCloud(wet)); assert.equal(canSqueezeCloud(dry), false);
  advanceCloudPress(clouds, 2, .1, false); assert.equal(dry.response, 0); assert.equal(cloudRainYield(dry), 0);
  let maximum = 0;
  for (let i = 0; i < 180; i++) {
    advanceCloudPress(clouds, 0, .1, false); advanceCloudMoisture(clouds, 0, .1); maximum = Math.max(maximum, cloudRainYield(wet));
  }
  assert.ok(maximum > .4); assert.equal(canSqueezeCloud(wet), false); assert.equal(cloudRainYield(wet), 0);
  const empty = wet.moisture;
  for (let i = 0; i < 1800; i++) advanceCloudMoisture(clouds, -1, .1);
  assert.ok(wet.moisture > empty); assert.ok(canSqueezeCloud(wet)); assert.ok(clouds.every(cloud => cloud.moisture <= cloud.capacity));
});

test('moisture uniform matches each cloud and dry bodies do not block camera rays', () => {
  const clusters = createCloudClusters(1), resources = makeClouds(false, clusters), cloud = clusters[0];
  try {
    cloud.center = [0, 20, 0]; const puff = cloud.puffs[0];
    const ray = new Raycaster(new Vector3(puff.offset[0], 20 + puff.offset[1], puff.offset[2] + 20), new Vector3(0, 0, -1));
    const hits: Parameters<typeof resources.mesh.raycast>[1] = [];
    writeCloudMatrices(resources, 0); resources.mesh.raycast(ray, hits); assert.equal(hits.length, 1);
    cloud.moisture = .1; writeCloudMatrices(resources, 0); hits.length = 0; resources.mesh.raycast(ray, hits);
    assert.equal(hits.length, 0); assert.equal(resources.material.uniforms.uMoisture.value[0], .1);
    for (const name of ['uOrigins', 'uTouches', 'uVisibility', 'uMoisture']) assert.equal(resources.material.uniforms[name].value.length, MAX_CLOUDS);
  } finally { resources.dispose(); }
});

test('cloud emission samples its actual lower density surface across all silhouettes', () => {
  const target = new Float64Array(3);
  for (const cloud of createCloudClusters(10)) {
    const source = createCloudRainSource(cloud); source.origin.set(12, 40, -9);
    for (let i = 0; i < 50; i++) {
      source.sample(target, i);
      assert.ok(cloudDensity(cloud, target[0] - 12, target[1] - 40, target[2] + 9) <= .01);
      assert.ok(cloudDensity(cloud, target[0] - 12, target[1] - 40 + .09, target[2] + 9) > 0);
    }
  }
});

test('drops begin under the cloud, accelerate with gravity, and hit water only after travelling', () => {
  for (const fps of [10, 60]) {
    const rain = new RainSimulation(600, 90, () => -5), source = pointSource(5, 24, -12);
    for (let frame = 1; frame <= fps; frame++) { const time = frame / fps; rain.emit(source, 120, 1 / fps, time, [.5, 0, .25]); rain.advance(time); }
    assert.ok(rain.live > 110); assert.equal(rain.waterHits, 0);
    for (let i = 0; i < rain.capacity; i++) if (rain.active[i]) {
      const offset = i * 4, age = 1 - rain.origins[offset + 3];
      const y = rain.origins[offset + 1] - .65 * age - RAIN_GRAVITY / 2 * age * age;
      assert.ok(y > 18, 'No particle instantly fills the lower rain column.');
      assert.ok(rain.landing[offset] > 5 && rain.landing[offset + 2] > -12, 'Droplets inherit the coastal wind.');
    }
    rain.advance(5); assert.equal(rain.live, 0); assert.equal(rain.waterHits, rain.emitted);
    assert.ok(rain.shapes.some(value => value > 0)); assert.equal(rain.groundHits, 0);
  }
});

test('land impacts converge on sampled slope and accumulate temporary ground puddles', () => {
  const height = (x: number, z: number) => 2 + x * .08 - z * .04;
  const rain = new RainSimulation(500, 90, height), source = pointSource(2, 19, -4);
  rain.emit(source, 800, .15, .15, [.6, 0, .3]);
  for (let i = 0; i < rain.capacity; i++) if (rain.active[i]) {
    const offset = i * 4, flight = rain.motion[offset + 2];
    assert.ok(Math.abs(rain.landing[offset + 1] - height(rain.landing[offset], rain.landing[offset + 2])) < .0001);
    assert.ok(Math.abs(19 - .65 * flight - RAIN_GRAVITY / 2 * flight * flight - rain.landing[offset + 1]) < .00001);
  }
  rain.advance(4); assert.equal(rain.groundHits, rain.emitted); assert.equal(rain.waterHits, 0);
  const pools = [];
  for (let i = rain.waterSlots; i < rain.impactCapacity; i++) if (rain.shapes[i * 4 + 1]) pools.push(i);
  assert.ok(pools.length >= 1 && pools.length <= 3, 'Nearby droplets feed existing puddles.');
  for (const i of pools) {
    assert.ok(rain.shapes[i * 4] > .29 && rain.shapes[i * 4] <= .620001);
    assert.ok(rain.shapes[i * 4 + 1] >= 11 && rain.shapes[i * 4 + 1] <= 20);
    assert.ok(Math.abs(rain.slopes[i * 2] - .08) < .00001);
    assert.ok(Math.abs(rain.slopes[i * 2 + 1] + .04) < .00001);
  }
});

test('two retained instanced batches freeze in reduced motion and never exceed their pools', () => {
  const rain = createRain({ capacity: 90, impacts: 30, sampleHeight: () => -5 });
  const origin = rain.geometry.getAttribute('aBirth').array, impact = rain.impactGeometry.getAttribute('aImpact').array;
  try {
    rain.simulation.emit(pointSource(0, 12, 0), 20000, 3, 0, [.5, 0, .2]);
    assert.equal(rain.simulation.live, 90); rain.update(.2, false);
    const time = rain.material.uniforms.uTime.value;
    rain.update(200, true); assert.equal(rain.material.uniforms.uTime.value, time); assert.equal(rain.simulation.waterHits, 0);
    rain.update(5, false); assert.equal(rain.simulation.waterHits, 90);
    assert.equal(rain.geometry.getAttribute('aBirth').array, origin); assert.equal(rain.impactGeometry.getAttribute('aImpact').array, impact);
    assert.equal(rain.root.children.length, 2); assert.equal(rain.geometry.instanceCount, 90); assert.equal(rain.impactGeometry.instanceCount, 30);
    assert.ok([...origin, ...impact].every(Number.isFinite));
  } finally { rain.dispose(); }
});

test('36 clouds add altitude variation without exceeding the prior cloud triangle budget', () => {
  const resources = makeClouds(false);
  try {
    assert.equal(resources.clusters.length, 36);
    assert.ok(resources.geometry.index!.count / 3 <= 136816);
    assert.ok(resources.clusters.filter(cloud => cloud.center[1] > 70).length <= 7);
    assert.ok(resources.clusters.filter(cloud => cloud.center[1] < 40).length >= 20);
    assert.ok(resources.clusters.some(cloud => cloudBounds(cloud).max.x - cloudBounds(cloud).min.x > 95));
  } finally { resources.dispose(); }
});


test('a depleted white cloud stops emitting while its earlier droplets finish falling', () => {
  const clouds = createCloudClusters(1), cloud = clouds[0], source = createCloudRainSource(cloud);
  const rain = new RainSimulation(900, 240, () => 1);
  cloud.moisture = .9; source.origin.set(0, 18, 0);
  let time = 0;
  while (canSqueezeCloud(cloud) && time < 20) {
    time += 1 / 60; advanceCloudMoisture(clouds, 0, 1 / 60); advanceCloudPress(clouds, 0, 1 / 60, false);
    rain.emit(source, 310 * cloudRainYield(cloud), 1 / 60, time, [.5, 0, .2]); rain.advance(time);
  }
  assert.equal(canSqueezeCloud(cloud), false); assert.equal(cloudRainYield(cloud), 0);
  assert.ok(rain.live > 0, 'drops that left the cloud earlier still have flight time');
  const emitted = rain.emitted, landed = rain.groundHits;
  for (let frame = 1; frame <= 240; frame++) {
    rain.emit(source, 310 * cloudRainYield(cloud), 1 / 60, time + frame / 60, [.5, 0, .2]);
    rain.advance(time + frame / 60);
  }
  assert.equal(rain.emitted, emitted); assert.equal(rain.live, 0);
  assert.ok(rain.groundHits > landed, 'the remaining drops become genuine delayed impacts');
});
