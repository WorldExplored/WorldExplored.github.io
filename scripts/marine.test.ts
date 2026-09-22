import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMesh, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { createCoralSites, createMarineState, MARINE_COUNTS, stepMarine, writeReefFish } from '../src/components/world/marineState';
import { coralGeometry, createReefLife } from '../src/components/world/ReefLife';
import { createCityFerryRoute } from '../src/components/world/cityInfrastructure';
import { harborWaterHeight } from '../src/components/world/waterSurface';
import { landDistance, terrainHeight } from '../src/components/world/terrain';

const route = createCityFerryRoute();
const ferryCorridor = Array.from({ length: 400 }, (_, i) => route.curve.getPointAt(i / 400));
const clearance = (p: Vector3) => Math.min(...ferryCorridor.map(q => Math.hypot(q.x - p.x, q.z - p.z)));

test('five-minute dolphin and shark trajectories stay clear of land, reef, and the complete ferry route', () => {
  for (const shark of [false, true]) for (let index = 0; index < 2; index++) {
    const state = createMarineState(index, shark), previous = state.position.clone();
    let heading = state.heading, pitch = state.pitch, contacts = 0;
    for (let frame = 0; frame < 18000; frame++) {
      const touched = stepMarine(state, 1 / 60);
      assert.ok(state.position.distanceTo(previous) * 60 < 2.6, 'bounded three-dimensional speed');
      assert.ok(Math.abs(Math.atan2(Math.sin(state.heading - heading), Math.cos(state.heading - heading))) * 60 < .22, 'continuous bounded heading');
      assert.ok(Math.abs(state.pitch - pitch) * 60 < 5.1, 'pitch follows a smooth breach tangent');
      assert.ok(landDistance(state.position.x, state.position.z) < -4);
      assert.ok(state.position.y > terrainHeight(state.position.x, state.position.z) + 1.2);
      if (frame % 60 === 0) assert.ok(clearance(state.position) > 5.6, 'body radius and ferry hull have space');
      if (touched) {
        contacts++;
        assert.ok(!shark); assert.equal(state.splashAge, 0);
        assert.ok(Math.abs(state.splash.y - harborWaterHeight(state.splash.x, state.splash.z, state.time)) < .003, 'spray starts on the actual displaced water');
      }
      previous.copy(state.position); heading = state.heading; pitch = state.pitch;
    }
    assert.equal(contacts, state.contacts); assert.ok(shark ? contacts === 0 : contacts >= 8 && contacts <= 10);
    const frozen = JSON.stringify(state); stepMarine(state, 20, true); assert.equal(JSON.stringify(state), frozen);
  }
});

test('reef colonies are submerged, seabed-seated and outside the ferry lane; schooling fish stay over the reef', () => {
  const sites = createCoralSites(); assert.ok(sites.length >= 70);
  for (const site of sites) {
    assert.equal(site.floor, terrainHeight(site.x, site.z));
    assert.ok(site.floor + 1.16 + site.scale * 1.05 < -1.6);
    assert.ok(clearance(new Vector3(site.x, 0, site.z)) > 4);
  }
  const pose = createMarineState(0);
  for (let t = 0; t < 300; t += .7) for (let i = 0; i < MARINE_COUNTS.high; i++) {
    writeReefFish(i, t, pose);
    assert.ok(pose.position.y < -1.6 && pose.position.y > -2.5);
    assert.ok(landDistance(pose.position.x, pose.position.z) < -4);
    assert.ok(clearance(pose.position) > 4);
  }
});

test('marine anatomy and coral topology remain distinct, finite and shared within a bounded draw budget', () => {
  const forms = [0, 1, 2].map(coralGeometry);
  assert.equal(new Set(forms.map(geometry => geometry.userData.form)).size, 3); forms.forEach(geometry => geometry.dispose());
  const life = createReefLife(); let draws = 0, triangles = 0;
  try {
    life.root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      draws++; const geometry = object.geometry;
      for (const value of geometry.getAttribute('position').array) assert.ok(Number.isFinite(value));
      triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3 * (object instanceof InstancedMesh ? object.count : 1);
    });
    const dolphins = life.root.children.filter(child => child.name === 'bottlenose-dolphin'); assert.equal(dolphins.length, 2);
    for (const dolphin of dolphins) for (const part of ['long-bottlenose-rostrum', 'horizontal-tail-flukes', 'paired-eyes', 'swept-dorsal-fin']) assert.ok(dolphin.getObjectByName(part));
    const sharks = life.root.children.filter(child => child.name === 'offshore-shark'); assert.equal(sharks.length, 2);
    sharks.forEach(shark => assert.ok(shark.getObjectByName('vertical-caudal-fin')));
    assert.ok(draws <= 62, `${draws} draws`); assert.ok(triangles < 190000, `${triangles} triangles`);
    const fish = life.root.getObjectByName('channel-reef-schools') as InstancedMesh;
    assert.ok(!(fish.material as MeshStandardMaterial).vertexColors || fish.geometry.hasAttribute('color'), 'fish shader must not multiply colors by a missing vertex attribute');
    for (const tier of ['medium', 'low', 'high'] as const) { life.setQuality(tier); assert.equal(fish.count, MARINE_COUNTS[tier]); }
    life.update(.05); const matrix = fish.instanceMatrix.array.slice(); life.update(10, true); assert.deepEqual(fish.instanceMatrix.array, matrix);
  } finally { life.dispose(); }
});
