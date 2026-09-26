import assert from 'node:assert/strict';
import test from 'node:test';
import { world } from '../src/content/world';
import { cityBuildings } from '../src/components/world/city';
import { createCirculationGraph } from '../src/components/world/circulation';
import { createArcadeHall, ARCADE_PLAN } from '../src/components/world/ArcadeHall';
import { createCityPathEdging } from '../src/components/world/CityPathEdges';
import { VISITOR_PIER_SHORE, VISITOR_PIER_HEAD } from '../src/components/world/CoastalTraffic';
import { landDistance, terrainMeshHeight } from '../src/components/world/terrain';

const arcade = world.landmarks.find(item => item.id === 'arcade')!;

test('city fronts and their longer entry walks align with the straight central streets', () => {
  for (const building of cityBuildings) assert.equal(building.rotation, building.family === 'public-station' ? Math.PI / 2 : 0);
  const graph = createCirculationGraph();
  for (const id of ['town-main-street-west', 'town-main-street-east', 'town-waterfront-route', 'office-west-street', 'residence-east-street', 'arcade-street', 'city-park-walk']) {
    const edge = graph.edges.find(item => item.id === id)!;
    for (let i = 1; i < edge.points.length; i++) {
      const a = edge.points[i - 1], b = edge.points[i];
      assert.ok(Math.abs(a.x - b.x) < 1e-8 || Math.abs(a.z - b.z) < 1e-8, `${id}: avoid a diagonal shortcut`);
    }
  }
  const park = graph.edges.find(edge => edge.id === 'city-park-walk')!;
  const distance = park.points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.x - park.points[i].x, point.z - park.points[i].z), 0);
  assert.ok(distance < 4, 'The fountain has a direct waterfront connection, without wrapping around the houses');
});

test('front-left arcade has dry shoreline clearance, grounded foundations and a separate visitor pier', () => {
  assert.ok(arcade.position[0] < -24 && arcade.position[2] > -77, 'Arcade is visible ahead of the western city block');
  for (let i = 0; i < ARCADE_PLAN.length; i++) {
    const a = ARCADE_PLAN[i], b = ARCADE_PLAN[(i + 1) % ARCADE_PLAN.length];
    for (let step = 0; step <= 40; step++) {
      const t = step / 40, x = arcade.position[0] + a[0] + (b[0] - a[0]) * t, z = arcade.position[2] + a[1] + (b[1] - a[1]) * t;
      assert.ok(landDistance(x, z) > 1, `Arcade exterior overhangs the beach at ${x},${z}`);
    }
  }
  const shell = createArcadeHall();
  try {
    const vertices = shell.base.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const ground = terrainMeshHeight(arcade.position[0] + vertices.getX(i), arcade.position[2] + vertices.getZ(i));
      assert.ok(ground > .76 && ground < 1.045, 'Ground meets the foundation without reaching the room floor');
    }
  } finally { Object.values(shell).forEach(geometry => geometry.dispose()); }
  const graph = createCirculationGraph(), dock = graph.nodes.find(node => node.id === 'visitor-dock-shore')!;
  assert.deepEqual([dock.x, dock.z], [VISITOR_PIER_SHORE.x, VISITOR_PIER_SHORE.z]);
  for (const p of [VISITOR_PIER_SHORE, VISITOR_PIER_HEAD]) {
    const dx = Math.max(0, Math.abs(p.x - arcade.position[0]) - 3.48), dz = Math.max(0, Math.abs(p.z - (arcade.position[2] - .25)) - 2.78);
    assert.ok(Math.hypot(dx, dz) > 1.4, 'Pier clears the arcade shell and its threshold');
  }
});

test('the new arcade approach receives pebble edges while the entrance and pier connection stay open', () => {
  const sites = createCityPathEdging(), graph = createCirculationGraph();
  const approach = graph.edges.find(edge => edge.id === 'arcade-street')!, z = approach.points[0].z;
  for (const side of [-1, 1]) {
    const edging = sites.filter(site => site.x > arcade.position[0] + .6 && site.x < -25.3 && (site.z - z) * side > .45 && (site.z - z) * side < .72);
    assert.ok(edging.length > 5, `The arcade approach is edged on side ${side}`);
  }
  const door = graph.nodes.find(node => node.id === 'arcade')!;
  assert.ok(sites.every(site => Math.hypot(site.x - door.x, site.z - door.z) > .55), 'Pebbles never fill the doorway');
});
