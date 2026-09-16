import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create } from '@react-three/test-renderer';
import { InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from 'three';
import { createSceneRuntime } from '../src/content/world';
import { CityLife, createCityLife } from '../src/components/world/CityLife';
import { createTownInteractionState, TOWN_ACTIONS } from '../src/components/world/townInteractionState';
import { TownActionButton, TownInteractions, townInteractionSites, TOWN_BUOY_SITE } from '../src/components/world/TownInteractions';
import { createTownMechanisms, harborWaterHeight } from '../src/components/world/TownMechanisms';
import { createGardenFountain, fountainStreamPoint, FOUNTAIN_SITE } from '../src/components/world/GardenFountain';
import { cityBuildings, cityRoofMounts, createCityTransitRoute } from '../src/components/world/city';
import { createCityFerryRoute } from '../src/components/world/cityInfrastructure';
import { landDistance } from '../src/components/world/terrain';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('six bounded interactions toggle, cycle, expire, and reset without queued motion', () => {
  const controls = createTownInteractionState(); let updates = 0;
  const unsubscribe = controls.subscribe(() => updates++);
  for (const id of TOWN_ACTIONS) controls.activate(id);
  controls.advance(1 / 60, true);
  for (const id of TOWN_ACTIONS) assert.equal(controls.states[id].amount, 1, 'Reduced motion acknowledges activation immediately');
  assert.equal(controls.pattern, 1); controls.activate('fountain'); assert.equal(controls.pattern, 2); controls.activate('fountain'); assert.equal(controls.pattern, 0);
  controls.activate('greenhouse'); assert.equal(controls.states.greenhouse.active, false);
  for (let index = 0; index < 1400; index++) controls.advance(1 / 60, false);
  for (const id of TOWN_ACTIONS) assert.deepEqual(controls.states[id], { active: false, amount: 0, remaining: 0 });
  assert.ok(updates < 20, 'Animation never sends frame-rate React notifications');
  for (const id of TOWN_ACTIONS) controls.activate(id);
  controls.reset(); assert.equal(controls.pattern, 0);
  for (const id of TOWN_ACTIONS) assert.deepEqual(controls.states[id], { active: false, amount: 0, remaining: 0 });
  unsubscribe();
});

test('all three fountain patterns change actual tube geometry, droplets and impact positions inside the basin', () => {
  const fountain = createGardenFountain(); const point = new Vector3(); const matrix = new Matrix4();
  const streams = fountain.meshes.find(mesh => mesh.name === 'fountain-six-returning-water-streams')!;
  const drops = fountain.meshes.find(mesh => mesh.name === 'fountain-flowing-droplets') as InstancedMesh;
  const patterns = new Set(); const apex: number[] = []; const hits: number[] = [];
  try {
    for (const pattern of [0, 1, 2] as const) {
      fountain.setPattern(pattern); fountain.step(.02, 'high', true); patterns.add(streams.geometry);
      apex.push(fountainStreamPoint(0, .5, point, pattern).y);
      hits.push(fountainStreamPoint(0, 1, point, pattern).x);
      for (let jet = 0; jet < 6; jet++) for (let index = 0; index <= 100; index++) {
        fountainStreamPoint(jet, index / 100, point, pattern);
        assert.ok(point.y >= FOUNTAIN_SITE.waterHeight - 1e-8); assert.ok(Math.hypot(point.x, point.z) < .72);
      }
      for (let index = 0; index < drops.count; index++) {
        drops.getMatrixAt(index, matrix); point.setFromMatrixPosition(matrix);
        const expected = fountainStreamPoint(index % 6, (Math.floor(index / 6) / 12 + index * .031) % 1, new Vector3(), pattern);
        assert.ok(point.distanceTo(expected) < 1e-6, 'Paused droplets move immediately onto the selected real trajectory');
      }
    }
    assert.equal(patterns.size, 3); assert.equal(new Set(apex).size, 3); assert.equal(new Set(hits).size, 3);
    fountain.setPattern(0); assert.equal(streams.geometry, [...patterns][0], 'Pattern cycling reuses geometry');
  } finally { fountain.dispose(); }
});

test('existing panels and turbine respond while new louvers, route inlay and buoy bell move and reset', () => {
  const controls = createTownInteractionState(); const route = createCityTransitRoute(); const city = createCityLife(route);
  const root = city.root; const panel = root.getObjectByName('city-articulated-solar-frames') as InstancedMesh;
  const before = Array.from(panel.instanceMatrix.array); const time = 7;
  const louvers = root.getObjectByName('greenhouse-louver-blades') as InstancedMesh;
  const closedLouvers = Array.from(louvers.instanceMatrix.array);
  try {
    for (const id of TOWN_ACTIONS) controls.activate(id);
    controls.advance(1 / 60, true); city.update(time, route, controls, true);
    assert.notDeepEqual(Array.from(panel.instanceMatrix.array), before);
    assert.equal(root.getObjectByName('city-wind-turbine-0')!.rotation.y, .32);
    assert.equal(root.getObjectByName('greenhouse-louver-0')!.rotation.x, -1.02);
    assert.notDeepEqual(Array.from(louvers.instanceMatrix.array), closedLouvers, 'The batched visible blades rotate with their hinges');
    assert.equal(root.getObjectByName('harbor-buoy-bell')!.rotation.z, .28);
    assert.equal(root.getObjectByName('station-illuminated-transit-route')!.visible, true);
    controls.reset(); city.update(time, route, controls, true);
    assert.equal(root.getObjectByName('city-wind-turbine-0')!.rotation.y, 0);
    assert.equal(Math.abs(root.getObjectByName('greenhouse-louver-0')!.rotation.x), 0);
    assert.deepEqual(Array.from(louvers.instanceMatrix.array), closedLouvers);
    assert.equal(root.getObjectByName('harbor-buoy-bell')!.rotation.z, 0);
    assert.equal(root.getObjectByName('station-illuminated-transit-route')!.visible, false);
  } finally { city.retain()(); }
});

test('full solar response retains roof clearance and buoy stays offshore outside the ferry lane', () => {
  const controls = createTownInteractionState(); const route = createCityTransitRoute(); const city = createCityLife(route);
  controls.activate('solar'); const matrix = new Matrix4(); const point = new Vector3();
  try {
    for (let frame = 0; frame < 150; frame++) {
      controls.advance(1 / 30, false); city.update(frame / 30, route, controls);
      for (const name of ['city-articulated-solar-frames', 'city-articulated-solar-cells']) {
        const mesh = city.root.getObjectByName(name) as InstancedMesh;
        for (let index = 0; index < mesh.count; index++) {
          const mount = cityRoofMounts[index]; const building = cityBuildings.find(item => item.id === mount.building)!;
          mesh.getMatrixAt(index, matrix); const position = mesh.geometry.getAttribute('position');
          for (let vertex = 0; vertex < position.count; vertex++) {
            point.fromBufferAttribute(position, vertex).applyMatrix4(matrix);
            assert.ok(point.y > mount.world[1] - .02 + .025, 'Every moving vertex clears the roof');
            const dx = point.x - building.x; const dz = point.z - building.z;
            const x = dx * Math.cos(building.rotation) - dz * Math.sin(building.rotation);
            const z = dx * Math.sin(building.rotation) + dz * Math.cos(building.rotation);
            assert.ok(Math.abs(x) < building.width / 2 && Math.abs(z) < building.depth / 2, 'Sun-facing panel remains inside its roof');
          }
        }
      }
    }
    assert.ok(landDistance(TOWN_BUOY_SITE.x, TOWN_BUOY_SITE.z) < -1);
    const ferry = createCityFerryRoute();
    for (let index = 0; index < 1000; index++) { ferry.curve.getPointAt(index / 1000, point); assert.ok(Math.hypot(point.x - TOWN_BUOY_SITE.x, point.z - TOWN_BUOY_SITE.z) > 2); }
    const mechanisms = createTownMechanisms(route);
    for (let second = 0; second < 60; second += .2) { mechanisms.update(second, controls, false); assert.equal(mechanisms.buoy.position.y, harborWaterHeight(TOWN_BUOY_SITE.x, TOWN_BUOY_SITE.z, second)); }
    mechanisms.dispose();
  } finally { city.retain()(); }
});

test('stable generous hitboxes survive long mixed activation, paused and quality changes; drag clicks do not activate', async () => {
  const runtime = { current: createSceneRuntime() }; const route = createCityTransitRoute();
  const renderer = await create(<CityLife runtime={runtime} paused={false} quality="high" route={route} />);
  const root = renderer.scene.instance;
  const boxes = TOWN_ACTIONS.map(id => root.getObjectByName(`town-hitbox-${id}`) as Mesh);
  root.updateMatrixWorld(true);
  const ray = new Raycaster(); const origin = new Vector3(); const direction = new Vector3();
  for (const box of boxes) {
    box.getWorldPosition(origin); origin.y += 10; box.getWorldPosition(direction).sub(origin).normalize(); ray.set(origin, direction);
    assert.ok(ray.intersectObject(box).length, 'Render-disabled proxy remains available to camera and pointer ray tests');
  }
  const poses = boxes.map(box => box.matrixWorld.clone()); const geometries = boxes.map(box => box.geometry);
  try {
    for (let index = 0; index < 120; index++) {
      const id = TOWN_ACTIONS[index % TOWN_ACTIONS.length]; const target = renderer.scene.findByProps({ name: `town-hitbox-${id}` });
      await act(async () => { await renderer.fireEvent(target, 'click', { button: 0, delta: 0, stopPropagation() {} }); });
      runtime.current.elapsed += .3;
      await renderer.advanceFrames(3, .1);
      if (index % 10 === 0) await renderer.update(<CityLife runtime={runtime} paused={index % 20 === 0} quality={index % 30 === 0 ? 'low' : 'high'} route={route} />);
      root.updateMatrixWorld(true);
      boxes.forEach((box, i) => { assert.deepEqual(box.matrixWorld, poses[i]); assert.equal(box.geometry, geometries[i]); assert.equal(box.userData.cameraInteraction, true); });
    }
  } finally { await renderer.unmount(); }
  const controls = createTownInteractionState(); const proxy = await create(<TownInteractions controls={controls} />);
  try {
    const target = proxy.scene.findByProps({ name: 'town-hitbox-station' });
    await proxy.fireEvent(target, 'click', { button: 0, delta: 20, stopPropagation() {} }); assert.equal(controls.states.station.active, false);
    await proxy.fireEvent(target, 'click', { button: 2, delta: 0, stopPropagation() {} }); assert.equal(controls.states.station.active, false);
    await act(async () => { await proxy.fireEvent(target, 'click', { button: 0, delta: 0, stopPropagation() {} }); }); assert.equal(controls.states.station.active, true);
  } finally { await proxy.unmount(); }
});

test('every native keyboard button has an object label and is visually hidden until focus', () => {
  for (const site of townInteractionSites()) {
    const markup = renderToStaticMarkup(<TownActionButton label={site.label} active={false} onActivate={() => {}} />);
    assert.match(markup, /<button type="button"/); assert.match(markup, /aria-pressed="false"/); assert.ok(markup.includes(`aria-label="${site.label}"`));
    assert.match(markup, /opacity:0/); assert.match(markup, /min-height:44px/); assert.doesNotMatch(markup, /tabindex="-1"|aria-hidden="true"|disabled/);
  }
});

test('demand rendering receives immediate activation and wall-clock reset without intervening frames', () => {
  let now = 0; let nextId = 0;
  const pending = new Map<number, { callback: () => void; due: number }>();
  const controls = createTownInteractionState({ set(callback, delay) { const id = ++nextId; pending.set(id, { callback, due: now + delay }); return id; }, clear(id) { pending.delete(id as number); } });
  const advanceClock = (delta: number) => { now += delta; for (const [id, timer] of pending) if (timer.due <= now) { pending.delete(id); timer.callback(); } };
  let invalidations = 0; const stop = controls.subscribe(() => invalidations++);
  let release = controls.retain();
  const mechanisms = createTownMechanisms(createCityTransitRoute());
  try {
    controls.activate('greenhouse'); controls.activate('station'); controls.activate('fountain');
    assert.equal(invalidations, 3, 'Each user action requests the paused canvas to render');
    controls.advance(0, true); mechanisms.update(0, controls, true);
    assert.equal(mechanisms.louvers[0].rotation.x, -1.02); assert.equal(mechanisms.routeLight.visible, true); assert.equal(controls.pattern, 1);
    release(); release = controls.retain(); advanceClock(0);
    assert.equal(pending.size, 3, 'Strict Mode replay retains pending resets');
    advanceClock(21000); // No useFrame calls happen during this quiet demand interval.
    assert.equal(invalidations, 6, 'Wall-clock resets request their own render');
    assert.equal(controls.pattern, 0);
    controls.advance(0, true); mechanisms.update(0, controls, true);
    assert.equal(Math.abs(mechanisms.louvers[0].rotation.x), 0); assert.equal(mechanisms.routeLight.visible, false);
    controls.activate('buoy'); release(); advanceClock(0); assert.equal(pending.size, 0, 'Unmount cancels every pending action deadline');
  } finally { stop(); controls.dispose(); mechanisms.dispose(); }
});
