import test from 'node:test';
import assert from 'node:assert/strict';
import { createBenthicLife, BENTHIC_KINDS } from '../src/components/world/BenthicLife';
import { createCityPathEdges, cityEdgeClear } from '../src/components/world/CityPathEdges';
import { getReefHabitat, reefFloorHeight, reefRockSurfaceHeight } from '../src/components/world/reefHabitat';
import { createReefFishState, REEF_FISH_COUNTS, reefFishPositionClear } from '../src/components/world/reefFishState';
import { groundRouteAt, terrainMeshHeight } from '../src/components/world/terrain';
import { routeCityWalk } from '../src/components/world/circulation';

test('seafloor invertebrates attach to rock ledges or actual sand and retain every species at low quality', () => {
  const life = createBenthicLife(), plan = getReefHabitat();
  try {
    assert.equal(new Set(life.sites.map(site => site.kind)).size, BENTHIC_KINDS.length);
    assert.ok(life.sites.filter(site => site.x < -35).length > 35, 'western triangle carries benthic life');
    for (const site of life.sites) {
      assert.ok(site.y < -1.8);
      assert.ok(Math.abs(site.normal.length() - 1) < .00001 && site.normal.y > .6);
      if (site.host < 0) {
        assert.ok(Math.abs(site.y - reefFloorHeight(site.x, site.z) - .095) < 1e-6);
        assert.ok(plan.rocks.every(rock => Math.hypot(rock.x - site.x, rock.z - site.z) >= rock.radius + .4));
      } else {
        assert.ok(plan.rocks[site.host].patch<200,'tiny mineral chips do not create full benthic colonies');
        assert.ok(Math.abs(site.y - reefRockSurfaceHeight(plan.rocks[site.host], site.x, site.z) - .012) < 1e-6);
      }
    }
    const geometry = life.batches.map(batch => batch.geometry);
    const triangles = life.batches.reduce((sum, batch) => sum + batch.geometry.index!.count / 3 * batch.count, 0);
    assert.ok(triangles < 350000, `bounded benthic geometry: ${triangles}`);
    for (const tier of ['low', 'medium', 'high'] as const) {
      life.setQuality(tier);
      assert.deepEqual(life.batches.map(batch => batch.geometry), geometry);
      assert.ok(life.batches.every(batch => batch.mesh.count > 0));
    }
  } finally { life.dispose(); }
});

test('pebble edging lies outside walkways with grounded stones and open junctions', () => {
  const edges = createCityPathEdges();
  try {
    assert.ok(edges.sites.length > 900 && edges.sites.length < 2500);
    for (const site of edges.sites) {
      assert.ok(cityEdgeClear(site.x, site.z), 'clear of actual building entrances and foundations');
      const distance = groundRouteAt(site.x, site.z).distance;
      assert.ok(distance >= .055 && distance <= .20, 'only the outer boundary of the complete path union gets pebbles');
      assert.ok(Math.abs(site.y - terrainMeshHeight(site.x, site.z)) < 1e-6 && site.y > .42);
    }
    assert.equal(edges.root.children.length, 1, 'one instanced draw for all city path edges');
    assert.deepEqual(routeCityWalk({ x: -9, z: -74 }, { x: -6, z: -74 }), [{ x: -9, z: -74 }, { x: -6, z: -74 }], 'clear approaches remain straight');
  } finally { edges.dispose(); }
});

test('every fish quality tier populates both the old reef and western lighthouse arm', () => {
  const states = Array.from({ length: REEF_FISH_COUNTS.high }, (_, index) => createReefFishState(index));
  for (const count of Object.values(REEF_FISH_COUNTS)) {
    const fish = states.slice(0, count);
    assert.ok(fish.filter(fish => fish.position.x < -35).length > count * .2);
    assert.ok(fish.filter(fish => fish.position.x > -25).length > count * .4);
    for (const { position } of fish) assert.ok(reefFishPositionClear(position.x, position.y, position.z));
  }
});
