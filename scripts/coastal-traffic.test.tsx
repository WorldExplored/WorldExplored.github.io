import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMesh, Mesh, Vector3 } from 'three';
import { createAeroBoat, createCoastalTraffic, createVisitorPier, VISITOR_PIER_HEAD, VISITOR_PIER_SHORE } from '../src/components/world/CoastalTraffic';
import { createVesselState, stepVessel, vesselOccupants, writeVesselPose, VISITOR_BERTH, VISITOR_DWELL, type MarineOccupant } from '../src/components/world/marineTraffic';
import { createCityFerryRoute, writeCityFerryPose } from '../src/components/world/cityInfrastructure';
import { cityBuildings, createCityTransitRoute } from '../src/components/world/city';
import { createDolphinState, stepDolphin } from '../src/components/world/dolphinRoutes';
import { landDistance, terrainMeshHeight } from '../src/components/world/terrain';

const horizontal = (a: Vector3, b: Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

test('every boat route clears the coast at the full hull radius, including the visitor landing', () => {
  const point = new Vector3();
  for (let index = 0; index < 3; index++) {
    const state = createVesselState(index);
    for (let sample = 0; sample <= 4000; sample++) {
      state.route.curve.getPointAt(sample / 4000, point);
      assert.ok(-landDistance(point.x, point.z) > state.radius + 1.5, `route ${index} has a navigable hull envelope`);
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        assert.ok(landDistance(point.x + Math.cos(angle) * state.radius, point.z + Math.sin(angle) * state.radius) < -.5);
      }
    }
  }
  const visitor = createVesselState(2); visitor.distance = visitor.route.berth; writeVesselPose(visitor);
  assert.ok(visitor.position.distanceTo(VISITOR_BERTH) < .00001);
  assert.ok(Math.abs(visitor.heading - Math.PI / 2) < .002, 'the boat lies parallel to the boarding platform');
});

test('fleet and scheduled ferry remain separated over repeated visits and lower frame rates', () => {
  const ferry = createCityFerryRoute(), position = new Vector3(), tangent = new Vector3();
  for (const dt of [.05, .1]) {
    const fleet = [0, 1, 2].map(createVesselState), travel = [0, 0, 0];
    let visits = 0, priorDwell = 0;
    for (let frame = 0; frame < 1200 / dt; frame++) {
      const time = frame * dt + (dt === .1 ? 31 : 0);
      for (const boat of fleet) {
        const before = boat.distance;
        stepVessel(boat, dt, time, fleet, []);
        travel[boat.index] += (boat.distance - before + boat.route.length) % boat.route.length;
      }
      writeCityFerryPose(ferry, time, position, tangent);
      for (let i = 0; i < fleet.length; i++) {
        assert.ok(horizontal(fleet[i].position, position) > fleet[i].radius + 1.5 + .5, 'the scheduled ferry has a clear lane');
        for (let j = i + 1; j < fleet.length; j++) {
          assert.ok(horizontal(fleet[i].position, fleet[j].position) > fleet[i].radius + fleet[j].radius + .5);
        }
      }
      if (!priorDwell && fleet[2].dwell) visits++;
      priorDwell = fleet[2].dwell;
    }
    assert.ok(visits >= 2, 'yielding never deadlocks a visitor before its landing');
    for (let index = 0; index < 3; index++) assert.ok(travel[index] > fleet[index].route.length * 2);
  }
});

test('visitor arrives gently, holds the exact berth for 32 active seconds, and accelerates away', () => {
  for (const dt of [1 / 60, .1, .5]) {
    const boat = createVesselState(2);
    boat.distance = boat.route.berth - 4; boat.speed = boat.route.speed; writeVesselPose(boat);
    let arrivalSpeed = 0;
    for (let frame = 0; frame < 5000 && !boat.dwell; frame++) {
      arrivalSpeed = boat.speed;
      stepVessel(boat, dt, frame * dt, [], []);
    }
    assert.equal(boat.dwell, VISITOR_DWELL);
    assert.ok(arrivalSpeed < .35, 'the final approach slows before touching the berth');
    assert.ok(boat.position.distanceTo(VISITOR_BERTH) < .00001);
    const docked = boat.position.clone();
    for (let elapsed = 0; elapsed < 31; elapsed += .5) stepVessel(boat, .5, 0, [], []);
    assert.equal(boat.dwell, 1);
    assert.ok(boat.position.equals(docked));
    stepVessel(boat, 1, 0, [], []);
    assert.equal(boat.dwell, 0); assert.equal(boat.departed, true); assert.equal(boat.speed, 0);
    for (let frame = 0; frame < 1200 && boat.speed === 0; frame++) stepVessel(boat, .05, frame * .05, [], []);
    assert.ok(boat.speed > 0 && boat.speed < .03, 'departure accelerates after yielding to the ferry');
    assert.ok(boat.distance > boat.route.berth);
  }
});

test('surface animals stop boats while submerged swimmers can pass beneath the hull', () => {
  const boat = createVesselState(0);
  const animal: MarineOccupant = { position: boat.route.curve.getPointAt((boat.distance + 10) / boat.route.length), radius: .9 };
  for (let frame = 0; frame < 500; frame++) {
    stepVessel(boat, .05, frame * .05, [], [animal]);
    assert.ok(horizontal(boat.position, animal.position) > boat.radius + animal.radius + .5);
  }
  assert.equal(boat.speed, 0);
  const before = boat.distance; animal.position.y = -2;
  for (let frame = 0; frame < 100; frame++) stepVessel(boat, .05, frame * .05 + 25, [], [animal]);
  assert.ok(boat.distance > before + 3);
});

test('live dolphins and offshore sharks stay outside the hull envelope or dive below it', () => {
  const fleet = [0, 1, 2].map(createVesselState);
  const animals = [createDolphinState(0), createDolphinState(1), createDolphinState(2), createDolphinState(3), createDolphinState(0, true), createDolphinState(1, true)];
  const occupants = animals.map(animal => ({ position: animal.position, radius: animal.shark ? 1.1 : .65 }));
  vesselOccupants.push(...fleet);
  try {
    for (let frame = 0; frame < 12000; frame++) {
      const time = frame * .05;
      for (const animal of animals) stepDolphin(animal, .05, false, time);
      for (const boat of fleet) stepVessel(boat, .05, time, fleet, occupants);
      for (const animal of occupants) for (const boat of fleet) {
        assert.ok(animal.position.y < -.8 || horizontal(boat.position, animal.position) > boat.radius + animal.radius, 'surface wildlife never occupies a hull');
      }
    }
  } finally {
    for (const boat of fleet) vesselOccupants.splice(vesselOccupants.indexOf(boat), 1);
  }
});

test('visitor fade is smooth and separate wakes stop at the berth without shader changes', () => {
  const visitor = createVesselState(2), boat = createAeroBoat(2);
  const materials = Object.values(boat.materials), versions = materials.map(material => material.version);
  try {
    visitor.distance = 0; writeVesselPose(visitor); assert.equal(visitor.opacity, 0);
    visitor.distance = 17.5; writeVesselPose(visitor); assert.ok(Math.abs(visitor.opacity - .5) < .00001);
    visitor.distance = visitor.route.length - 22.5; writeVesselPose(visitor); assert.ok(Math.abs(visitor.opacity - .5) < .00001);
    visitor.distance = visitor.route.length; writeVesselPose(visitor); assert.equal(visitor.opacity, 0);
    for (let frame = 0; frame < 100; frame++) boat.update(frame / 60, frame / 100, .8, 1.35);
    assert.ok(boat.wakeRoot.visible);
    assert.ok(boat.wakeRoot.parent === null, 'wake water plane is independent of the rolling hull');
    boat.update(2, 1, .8, 0); assert.equal(boat.wakeRoot.visible, false);
    assert.deepEqual(materials.map(material => material.version), versions);
    assert.ok(materials.every(material => material.transparent));
    assert.ok(boat.root.getObjectByName('starboard-boarding-step'));
    for (const value of [NaN, Infinity, -1, 0]) {
      const before = visitor.position.clone(); stepVessel(visitor, value, 0); assert.ok(visitor.position.equals(before));
    }
  } finally { boat.dispose(); }
});

test('visitor pier reaches dry land and clears houses, train supports and the existing ferry', () => {
  const pier = createVisitorPier(), ferry = createCityFerryRoute(), track = createCityTransitRoute();
  const point = new Vector3();
  try {
    assert.ok(landDistance(VISITOR_PIER_SHORE.x, VISITOR_PIER_SHORE.z) > 2);
    const deck = pier.root.getObjectByName('visitor-pier-boardwalk') as Mesh;
    const vertices = deck.geometry.getAttribute('position');
    let nearGround = false;
    for (let i = 0; i < vertices.count; i++) {
      point.fromBufferAttribute(vertices, i);
      if (point.z < VISITOR_PIER_SHORE.z + .2) nearGround ||= Math.abs(point.y - terrainMeshHeight(point.x, point.z)) < .22;
    }
    assert.ok(nearGround, 'shore approach joins the sampled terrain grade');
    for (const building of cityBuildings) {
      assert.ok(Math.hypot(building.x - VISITOR_PIER_SHORE.x, building.z - VISITOR_PIER_SHORE.z) > building.radius + .2);
    }
    for (let support = 0; support < 32; support++) {
      track.curve.getPointAt(support / 32, point);
      if (point.z > VISITOR_PIER_SHORE.z && point.z < VISITOR_PIER_HEAD.z) assert.ok(Math.abs(point.x + 24) > 1.1);
    }
    for (let i = 0; i <= 2000; i++) {
      ferry.curve.getPointAt(i / 2000, point);
      const nearestX = Math.max(-27.3, Math.min(-20.7, point.x));
      const nearestZ = Math.max(VISITOR_PIER_HEAD.z - .575, Math.min(VISITOR_PIER_HEAD.z + .575, point.z));
      assert.ok(Math.hypot(point.x - nearestX, point.z - nearestZ) > 2);
    }
  } finally { pier.dispose(); }
});

test('effect replay retains traffic resources, pause freezes motion, and final cleanup disposes once', async () => {
  const traffic = createCoastalTraffic(), geometries = new Set<Mesh['geometry']>(), materials = new Set<Mesh['material']>();
  let geometryDisposals = 0, materialDisposals = 0;
  for (const root of [traffic.pier.root, ...traffic.fleet.flatMap(({ boat }) => [boat.root, boat.wakeRoot])]) root.traverse(object => {
    if (object instanceof Mesh) { geometries.add(object.geometry); materials.add(object.material); }
  });
  for (const geometry of geometries) geometry.addEventListener('dispose', () => geometryDisposals++);
  for (const material of materials) {
    assert.ok(!Array.isArray(material)); material.addEventListener('dispose', () => materialDisposals++);
  }
  traffic.attach(); traffic.attach(); assert.equal(vesselOccupants.length, 3);
  traffic.detach(); assert.equal(vesselOccupants.length, 0);
  traffic.attach(); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(geometryDisposals, 0); assert.equal(materialDisposals, 0);
  traffic.update(.05, 2, 0, false, 'high');
  const snapshot = traffic.fleet.map(({ state, boat }) => [state.distance, ...boat.root.position.toArray(), ...boat.root.rotation.toArray()]);
  traffic.update(.05, 2, 0, true, 'low');
  assert.deepEqual(traffic.fleet.map(({ state, boat }) => [state.distance, ...boat.root.position.toArray(), ...boat.root.rotation.toArray()]), snapshot);
  traffic.detach(); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(vesselOccupants.length, 0);
  assert.equal(geometryDisposals, geometries.size); assert.equal(materialDisposals, materials.size);
  assert.ok(geometries.size < 75, 'all fittings and wakes remain within the fleet draw budget');
});


test('the berth inspection hook is local only and uses the real docking state', async () => {
  for (const hostname of ['localhost', '127.0.0.1', 'worldexplored.github.io', 'localhost.example.com']) {
    const traffic = createCoastalTraffic({ hostname, search: '?qaVessel=berth' });
    const visitor = traffic.fleet[2].state;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      assert.equal(visitor.dwell, 32);
      assert.ok(visitor.position.distanceTo(VISITOR_BERTH) < .00001);
    } else {
      assert.equal(visitor.dwell, 0);
      assert.ok(visitor.position.distanceTo(VISITOR_BERTH) > 70);
    }
    traffic.detach();
  }
  await new Promise(resolve => setTimeout(resolve, 5));
});


test('visitor pier algae stays attached to wet post faces within a small instance budget', () => {
  const pier = createVisitorPier();
  try {
    assert.ok(pier.algaeSites.length >= 20 && pier.algaeSites.length <= 60);
    let triangles = 0, batches = 0;
    pier.root.traverse(object => {
      if (object instanceof InstancedMesh) {
        batches++; triangles += object.geometry.index!.count / 3 * object.count;
      }
    });
    assert.equal(batches, 3); assert.ok(triangles < 5000);
    for (const site of pier.algaeSites) {
      const { post } = site;
      const face = post.bottomRadius + (post.topRadius - post.bottomRadius) * (site.y - post.bottom) / (post.top - post.bottom);
      assert.ok(Math.abs(Math.hypot(site.x - post.x, site.z - post.z) - face) < .00001);
      assert.ok(site.y > terrainMeshHeight(site.x, site.z) + .04);
      assert.ok(site.y + site.height * 1.04 <= -.30 + .00001);
    }
  } finally { pier.dispose(); }
});

test('visitor has a full second deck at distinct scale while launches have different hull forms', async()=>{
  const {Box3}=await import('three');const boats=[0,1,2].map(createAeroBoat);
  try{
    const sizes=boats.map(boat=>new Box3().setFromObject(boat.root).getSize(new Vector3()));
    assert.ok(sizes[2].z>11.5&&sizes[2].z>sizes[0].z*3);
    assert.ok(sizes[2].y>4,'visitor includes a standing-height upper saloon');
    assert.ok(boats[2].root.getObjectByName('upper-saloon-glazing'));
    assert.ok(boats[0].root.getObjectByName('swept-hydrofoil-hull'));
    assert.ok(boats[1].root.getObjectByName('survey-mast'));
    assert.ok(sizes[1].x>sizes[0].x,'survey launch is broader than the hydrofoil');
  }finally{boats.forEach(boat=>boat.dispose());}
});
