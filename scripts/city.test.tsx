import assert from 'node:assert/strict';
import test from 'node:test';
import { StrictMode } from 'react';
import { create } from '@react-three/test-renderer';
import { PerspectiveCamera, Vector3, type BufferGeometry, type Material, type Mesh, type Object3D } from 'three';
import { EcoCity } from '../src/components/world/EcoCity';
import { CITY_BASE_Y, cityBuildings, createCityTransitRoute, writeCityTransitPose } from '../src/components/world/city';
import { landDistance, terrainBaseHeight } from '../src/components/world/terrain';
import { createSceneRuntime, type QualityTier } from '../src/content/world';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

async function fixture(strict = false) {
  const runtime = { current: createSceneRuntime() };
  const render = (quality: QualityTier = 'high', paused = false) => strict
    ? <StrictMode><EcoCity runtime={runtime} quality={quality} paused={paused} /></StrictMode>
    : <EcoCity runtime={runtime} quality={quality} paused={paused} />;
  const renderer = await create(render());
  return { renderer, runtime, render, scene: renderer.scene.instance };
}

function meshesIn(scene: Object3D) {
  const meshes: Mesh[] = [];
  scene.traverse(object => { if ((object as Mesh).isMesh) meshes.push(object as Mesh); });
  return meshes;
}

test('city exclusion footprints remain on the ungraded island bearing plateau', () => {
  assert.equal(new Set(cityBuildings.map(building => building.id)).size, cityBuildings.length);
  assert.equal(new Set(cityBuildings.map(building => building.archetype)).size, 5);
  assert.ok(Object.isFrozen(cityBuildings));
  for (const building of cityBuildings) {
    assert.ok(Object.isFrozen(building));
    assert.ok(building.height >= 3 && building.height <= 12);
    assert.ok(building.x >= -27 && building.x <= 15 && building.z >= -88 && building.z <= -68);
    // Exclusion circles include graded approaches; actual foundation and floor
    // faces are checked against rendered ground in circulation.test.ts.
    for (let index = 0; index < 128; index++) {
      const angle = index / 128 * Math.PI * 2;
      const x = building.x + Math.cos(angle) * building.radius;
      const z = building.z + Math.sin(angle) * building.radius;
      assert.ok(landDistance(x, z) >= 1.4, `${building.id} must clear the coastal slope.`);
      assert.ok(Math.abs(terrainBaseHeight(x, z) - CITY_BASE_Y) < 1e-6, `${building.id} must retain its ungraded bearing plateau.`);
    }
  }
});

test('all visible building vertices obey the exported collision footprints and height limits', async () => {
  const item = await fixture();
  try {
    const seen = new Set<string>();
    const counts = new Map<string, number>();
    const byId = new Map(cityBuildings.map(building => [building.id, building]));
    for (const mesh of meshesIn(item.scene)) {
      const positions = mesh.geometry.attributes.position;
      const normals = mesh.geometry.attributes.normal;
      assert.ok(Array.from(positions.array).every(Number.isFinite));
      assert.ok(Array.from(normals.array).every(Number.isFinite));
      const ranges = mesh.geometry.userData.buildingRanges as Array<{ building: string; start: number; count: number }> | undefined;
      for (const range of ranges ?? []) {
        const building = byId.get(range.building)!;
        seen.add(building.id); counts.set(building.id, (counts.get(building.id) ?? 0) + range.count);
        for (let index = range.start; index < range.start + range.count; index++) {
          assert.ok(Math.hypot(positions.getX(index) - building.x, positions.getZ(index) - building.z) <= building.radius + .001, building.id);
          assert.ok(positions.getY(index) >= CITY_BASE_Y - .002, building.id);
          assert.ok(positions.getY(index) <= CITY_BASE_Y + building.height + .002, `${building.id} exceeds its collision height.`);
        }
      }
    }
    assert.equal(seen.size, cityBuildings.length);
    assert.ok([...counts.values()].every(count => count > 1000), 'Each archetype includes inspectable architectural detail.');
    for (const building of cityBuildings) {
      const owner=item.scene.getObjectByName(`city-building-${building.id}`)!;
      assert.ok(owner, 'Each building owns its visible geometry.');
      assert.ok(owner.children.filter(mesh=>mesh.name.startsWith('eco-city-')).length<=9, 'At most one batch per finish per building.');
      const garden = owner.children.find(child => child.name === `eco-city-${building.id}-garden`) as Mesh | undefined;
      if (garden) {
        const colors = garden.geometry.getAttribute('color');
        assert.equal(colors.count, garden.geometry.getAttribute('position').count);
        assert.ok(Array.from(colors.array).every(Number.isFinite));
        if (building.family !== 'public-station') {
          const shades = new Set<string>();
          for (let i = 0; i < colors.count; i++) shades.add(`${colors.getX(i).toFixed(3)},${colors.getY(i).toFixed(3)},${colors.getZ(i).toFixed(3)}`);
          assert.ok(shades.size >= 3, 'leaf greens and purple fruit survive the single garden batch');
        }
      }
    }
    let drawCalls = 0;
    item.scene.traverseVisible(object => {
      const mesh = object as Mesh; if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) drawCalls += mesh.geometry.groups.filter(group => mesh.material instanceof Array && mesh.material[group.materialIndex ?? 0]?.visible).length;
      else if (mesh.material.visible) drawCalls++;
    });
    // Lift cabins and hover boundaries remain bounded; four ferry photovoltaic fittings add four draws.
    // Invisible picking proxies and hidden focus outlines submit no GPU draws.
    assert.ok(drawCalls <= 227, `Town architecture, water and six working controls use ${drawCalls} rendered draws (budget 227, including three shared room-light batches).`);
  } finally { await item.renderer.unmount(); }
});

test('the monorail has a closed smooth route with continuous spacing and finite transforms', () => {
  const route = createCityTransitRoute();
  const position = new Vector3(); const tangent = new Vector3();
  const before = new Vector3(); const after = new Vector3(); const previous = new Vector3(); const rear = new Vector3();
  const period = route.duration;
  route.curve.getPointAt(0, before); route.curve.getPointAt(1, after);
  assert.ok(before.distanceTo(after) < 1e-10);
  writeCityTransitPose(route, period - .001, 0, before, tangent);
  const incoming = tangent.clone();
  writeCityTransitPose(route, period + .001, 0, after, tangent);
  assert.ok(before.distanceTo(after) < .003, 'Loop completion cannot teleport the carriage.');
  assert.ok(incoming.dot(tangent) > .999, 'The route direction is continuous through the seam.');
  for (let step = 0; step < 800; step++) {
    const time = step / 800 * period;
    writeCityTransitPose(route, time, 0, position, tangent);
    writeCityTransitPose(route, time, 1, rear, tangent);
    assert.ok([...position.toArray(), ...tangent.toArray()].every(Number.isFinite));
    assert.ok(Math.abs(tangent.length() - 1) < 1e-6);
    assert.ok(position.distanceTo(rear) > 1.45 && position.distanceTo(rear) < 1.9, 'Carriages maintain usable separation around every bend.');
    if (step) assert.ok(position.distanceTo(previous) < route.speed * period / 800 * 1.05);
    previous.copy(position);
  }
  writeCityTransitPose(route, Number.NaN, 0, position, tangent);
  assert.ok(position.toArray().every(Number.isFinite));
});

test('quality, selection and pause preserve architecture and dispose mounted resources exactly once', async () => {
  const item = await fixture(true);
  const resources = new Map<string, { object: BufferGeometry | Material; disposals: number }>();
  const original = meshesIn(item.scene);
  for (const mesh of original) for (const object of [mesh.geometry, ...(Array.isArray(mesh.material) ? mesh.material : [mesh.material])]) {
    if (resources.has(object.uuid)) continue;
    const record = { object, disposals: 0 }; resources.set(object.uuid, record); object.addEventListener('dispose', () => record.disposals++);
  }
  const front = item.scene.getObjectByName('city-monorail-front')!;
  item.runtime.current.elapsed = 10;
  await item.renderer.advanceFrames(1, 1 / 60);
  const frozen = front.position.clone();
  const rotation = front.quaternion.clone();
  for (const quality of ['low', 'medium', 'high', 'low', 'high'] as const) {
    await item.renderer.update(item.render(quality, true));
    item.runtime.current.elapsed += 20;
    item.runtime.current.hovered = 'work';
    await item.renderer.advanceFrames(3, 1 / 60);
    assert.ok(front.position.equals(frozen));
    assert.ok(front.quaternion.equals(rotation));
    assert.deepEqual(meshesIn(item.scene), original);
    assert.ok([...resources.values()].every(record => record.disposals === 0));
  }
  await item.renderer.update(item.render('high', false));
  await item.renderer.advanceFrames(1, 1 / 60);
  assert.ok(front.position.distanceTo(frozen) > 1);
  await item.renderer.unmount();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok([...resources.values()].every(record => record.disposals === 1));
});

test('decorative city buildings do not intercept navigation or change their lighting on hover',async()=>{
  const item=await fixture();
  try{
    const building=cityBuildings[0],owner=item.renderer.scene.find(node=>node.instance.name===`city-building-${building.id}`);
    const materials=meshesIn(owner.instance).map(mesh=>mesh.material as import('three').MeshPhysicalMaterial);
    const glow=materials.map(material=>material.emissiveIntensity);
    for(const handler of ['onPointerOver','onPointerMove','onPointerOut','onClick'])assert.equal(owner.props[handler],undefined);
    await item.renderer.advanceFrames(30,1/60);
    assert.deepEqual(materials.map(material=>material.emissiveIntensity),glow);
    assert.equal(item.runtime.current.hovered,null);
  }finally{await item.renderer.unmount();}
});


test('city furniture constructs only near the camera, retains shells, and uses stable LOD hysteresis', async () => {
  const camera=new PerspectiveCamera(43,1.6,.1,500);camera.position.set(42,29,76);
  const runtime={current:createSceneRuntime()};
  const render=(quality:QualityTier='high')=><EcoCity runtime={runtime} quality={quality} paused />;
  const renderer=await create(render(),{camera});const root=renderer.scene.instance;
  const interiors=()=>{const result:Object3D[]=[];root.traverse(object=>{if(object.type==='Group'&&object.name.startsWith('city-interior-'))result.push(object);});return result;};
  const building=cityBuildings[0],shell=root.getObjectByName(`city-building-${building.id}`)!;
  const structure=meshesIn(shell);
  try {
    await renderer.advanceFrames(3,1/60);
    assert.equal(interiors().length,0,'Overview does not allocate or render room furniture');
    assert.ok(structure.length>0 && structure.every(mesh=>mesh.visible),'Shell and circulation stay present before furniture loads');
    camera.position.set(building.x,5,building.z+10);
    await renderer.advanceFrames(1,1/60);
    assert.equal(interiors().length,1,'Only one nearest interior is built per frame');
    await renderer.advanceFrames(20,1/60);
    const interior=root.getObjectByName(`city-interior-${building.id}`)!;
    assert.ok(interior?.visible && meshesIn(interior).length>=4,'Approaching constructs occupied furniture batches');
    assert.ok(structure.every(mesh=>meshesIn(shell).includes(mesh)),'Loading does not rebuild walls, doors, floors, landings or lift');
    const batches=meshesIn(interior),disposals=new Map(batches.map(mesh=>[mesh.geometry,0]));
    for(const geometry of disposals.keys())geometry.addEventListener('dispose',()=>disposals.set(geometry,disposals.get(geometry)!+1));
    camera.position.set(building.x,5,building.z+62);await renderer.advanceFrames(1,1/60);
    assert.equal(interior.visible,true,'Visible high-tier rooms survive the 55–70m hysteresis band');
    camera.position.set(building.x,5,building.z+74);await renderer.advanceFrames(1,1/60);
    assert.equal(interior.visible,false,'Far detail stops submitting draws');
    camera.position.set(building.x,5,building.z+62);await renderer.advanceFrames(1,1/60);
    assert.equal(interior.visible,false,'Hidden rooms do not flicker back on inside the exit band');
    camera.position.set(building.x,5,building.z+50);await renderer.advanceFrames(1,1/60);
    assert.equal(interior.visible,true);assert.deepEqual(meshesIn(interior),batches,'Reapproach reuses the same GPU resources');
    await renderer.update(render('low'));await renderer.advanceFrames(1,1/60);
    assert.equal(interior.visible,false,'Mobile detail has a smaller visibility radius');
    camera.position.set(building.x,5,building.z+20);await renderer.advanceFrames(1,1/60);
    assert.equal(interior.visible,true,'Mobile close views retain complete rooms');
    assert.ok([...disposals.values()].every(count=>count===0));
    await renderer.unmount();await new Promise(resolve=>setTimeout(resolve,10));
    assert.ok([...disposals.values()].every(count=>count===1),'Deferred furniture is disposed once with the city');
  } catch(error) {await renderer.unmount();throw error;}
});
