import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMesh, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { createReefLife } from '../src/components/world/ReefLife';
import { createReefFishState, interactWithReefFish, REEF_FISH_COUNTS, reefFishPositionClear, stepReefFish } from '../src/components/world/reefFishState';
import { getReefHabitat, reefFerryClearance, reefFloorHeight, reefHabitatContains } from '../src/components/world/reefHabitat';

test('reef fish wander for five minutes without crossing habitat boundaries, coral, rock, sand or ferry', () => {
  const states = Array.from({ length: REEF_FISH_COUNTS.high }, (_, i) => createReefFishState(i));
  const origins = states.map(fish => fish.position.clone()), previous = origins.map(p => p.clone()), headings = states.map(fish => fish.heading);
  const traveled = states.map(() => 0), elevations = states.map(fish => [fish.position.y, fish.position.y]);
  const habitat = getReefHabitat();
  for (let frame = 0; frame < 6000; frame++) {
    if (frame % 240 === 0) interactWithReefFish(states, Math.floor(frame / 240) % states.length);
    stepReefFish(states, .05);
    for (let i = 0; i < states.length; i++) {
      const fish = states[i], p = fish.position, distance = p.distanceTo(previous[i]);
      assert.ok(Number.isFinite(p.x + p.y + p.z + fish.heading + fish.pitch + fish.tail));
      assert.ok(distance < .053, 'no teleport, bounded swimming speed');
      assert.ok(Math.abs(Math.atan2(Math.sin(fish.heading - headings[i]), Math.cos(fish.heading - headings[i]))) <= .095001);
      assert.ok(reefFishPositionClear(p.x, p.y, p.z));
      traveled[i] += distance; previous[i].copy(p); headings[i] = fish.heading;
      elevations[i][0] = Math.min(elevations[i][0], p.y); elevations[i][1] = Math.max(elevations[i][1], p.y);
      if (frame % 200 === 0) {
        assert.ok(reefHabitatContains(p.x, p.z, .5)); assert.ok(p.y > reefFloorHeight(p.x, p.z) + .35); assert.ok(reefFerryClearance(p.x, p.z) > 2.65);
        for (const obstacle of [...habitat.colonies, ...habitat.rocks]) {
          const verticalOverlap = p.y + .14 > obstacle.y && p.y - .14 < obstacle.y + obstacle.height;
          assert.ok(!verticalOverlap || Math.hypot(p.x-obstacle.x,p.z-obstacle.z) >= obstacle.radius + .14, 'actual rendered obstacle bounds');
        }
      }
    }
  }
  assert.ok(traveled.every(distance => distance > 12), `every fish roams, minimum traveled ${Math.min(...traveled)}`);
  assert.ok(elevations.filter(([low, high]) => high - low > .5).length > 120, 'individual depth variation');
  assert.ok(new Set(states.map(fish => `${Math.floor(fish.position.x / 5)},${Math.floor(fish.position.z / 5)}`)).size > 28, 'fish occupy the broad reef');
});

test('a tap makes a local group react then settle; paused simulation freezes targets and poses', () => {
  const states = Array.from({ length: 140 }, (_, i) => createReefFishState(i));
  const affected = interactWithReefFish(states, 50);
  assert.ok(affected >= 1 && affected < 40); assert.ok(states[50].reaction > 0);
  for (const fish of states) if (fish.position.distanceTo(states[50].position) > 3.2) assert.equal(fish.reaction, 0);
  const before = JSON.stringify(states); stepReefFish(states, 60, true); assert.equal(JSON.stringify(states), before);
  for (let frame = 0; frame < 100; frame++) stepReefFish(states, .05);
  assert.ok(states.every(fish => fish.reaction === 0));
});

test('fish use bounded shared geometry, visible anatomy, articulated tails and moving tap targets', () => {
  const life = createReefLife();
  try {
    let draws = 0, triangles = 0;
    life.root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      draws++; for (const value of object.geometry.getAttribute('position').array) assert.ok(Number.isFinite(value));
      triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3 * (object instanceof InstancedMesh ? object.count : 1);
    });
    assert.equal(draws, 5); assert.ok(triangles < 200000);
    const fish = life.root.getObjectByName('channel-reef-schools') as InstancedMesh;
    const tails = life.root.getObjectByName('articulated-reef-fish-tails') as InstancedMesh;
    const touch = life.root.getObjectByName('reef-fish-touch-targets') as InstancedMesh;
    assert.equal(touch.raycast, InstancedMesh.prototype.raycast);
    assert.ok(!(fish.material as MeshStandardMaterial).vertexColors || fish.geometry.hasAttribute('color'));
    assert.ok(life.root.getObjectByName('reef-fish-pectoral-fins')); assert.ok(life.root.getObjectByName('reef-fish-eyes-and-bars'));
    for (const tier of ['medium', 'low', 'high'] as const) { life.setQuality(tier); assert.equal(fish.count, REEF_FISH_COUNTS[tier]); assert.equal(touch.count, fish.count); }
    const originalTail = tails.instanceMatrix.array.slice(); life.update(.05); assert.notDeepEqual(tails.instanceMatrix.array, originalTail);
    const frozen = fish.instanceMatrix.array.slice(); life.update(20, true); assert.deepEqual(fish.instanceMatrix.array, frozen);
    assert.ok(life.interact(0) >= 1);
  } finally { life.dispose(); }
});


test('moving fish retain real raycaster hits across quality changes and long swims', () => {
  const life = createReefLife();
  try {
    const touch = life.root.getObjectByName('reef-fish-touch-targets') as InstancedMesh;
    const ray = new Raycaster(), down = new Vector3(0, -1, 0);
    for (const tier of ['low', 'high', 'medium'] as const) {
      life.setQuality(tier);
      for (let frame = 0; frame < 800; frame++) life.update(.05);
      life.root.updateMatrixWorld(true);
      for (const index of [0, 12, 35]) {
        const position = life.states[index].position;
        assert.ok(touch.boundingSphere!.center.distanceTo(position) + .4 < touch.boundingSphere!.radius);
        ray.set(position.clone().add(new Vector3(0, 12, 0)), down);
        const hits = ray.intersectObject(life.root, true);
        assert.ok(hits.some(hit => hit.object === touch && hit.instanceId === index), `real moving instance ${index} hit at ${tier}`);
        const hit = hits.find(hit => hit.object === touch && hit.instanceId === index)!;
        assert.ok(life.interact(hit.instanceId!) > 0);
        assert.ok(life.states[index].reaction > 0);
      }
    }
  } finally { life.dispose(); }
});
