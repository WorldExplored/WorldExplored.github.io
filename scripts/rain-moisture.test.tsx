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
    assert.ok(rain.shapes[i * 4 + 1] >= 7 && rain.shapes[i * 4 + 1] <= 13);
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

test('roof triangles stop descending rain and temporary puddles fully evaporate', async()=>{
  const {BoxGeometry,Mesh,MeshStandardMaterial,Group}=await import('three');
  const {createRainCatchments}=await import('../src/components/world/rainCatchments');
  const root=new Group(),roof=new Mesh(new BoxGeometry(8,.2,6),new MeshStandardMaterial());
  roof.position.set(3,8,-2);roof.rotation.z=.08;root.add(roof);
  const catchments=createRainCatchments([root]);
  assert.ok(catchments.triangles>0);assert.ok(catchments.height(3,-2)>8);
  assert.equal(catchments.height(20,-2),-Infinity,'no invisible roof outside the actual triangles');
  const rain=createRain({capacity:150,impacts:30,sampleHeight:(x,z)=>Math.max(1,catchments.height(x,z))});
  try{
    rain.simulation.emit(pointSource(3,24,-2),300,.15,.15,[.05,0,.02]);
    for(let i=0;i<rain.simulation.capacity;i++)if(rain.simulation.active[i])assert.ok(rain.simulation.landing[i*4+1]>8,'drops hit the roof before floors beneath');
    rain.update(4,false);assert.equal(rain.simulation.live,0);assert.ok(rain.simulation.groundHits>0);assert.ok(rain.root.visible);
    rain.update(18,false);assert.equal(rain.root.visible,false,'all drop and puddle batches disappear after the last impact dries');
  }finally{rain.dispose();roof.geometry.dispose();roof.material.dispose();}
});

test('cloud families stay in consistent atmospheric shelves',()=>{
  const clouds=createCloudClusters();
  for(const family of new Set(clouds.map(cloud=>cloud.archetype))){
    const group=clouds.filter(cloud=>cloud.archetype===family);
    assert.equal(new Set(group.map(cloud=>cloud.layer)).size,1);
    assert.ok(Math.max(...group.map(cloud=>cloud.center[1]))-Math.min(...group.map(cloud=>cloud.center[1]))<3.3);
  }
});

test('rain catches roofs above furniture and ignores invisible or decorative subtrees', async()=>{
  const {BoxGeometry,Mesh,MeshStandardMaterial,Group}=await import('three');
  const {createRainCatchments}=await import('../src/components/world/rainCatchments');
  const root=new Group(),geometry=new BoxGeometry(2,.2,2),material=new MeshStandardMaterial();
  const roof=new Mesh(geometry,material);roof.position.y=5;root.add(roof);
  const interior=new Mesh(geometry,material);interior.geometry=new BoxGeometry(2,.2,2);interior.geometry.userData.floors=[];interior.position.set(3,7,0);root.add(interior);
  const vines=new Mesh(geometry,material);vines.name='eco-city-test-garden';vines.position.set(6,8,0);root.add(vines);
  const mechanisms=new Group();mechanisms.name='work-operating-assembly';mechanisms.position.set(9,9,0);mechanisms.add(new Mesh(geometry,material));root.add(mechanisms);
  const hidden=new Group();hidden.visible=false;hidden.position.set(12,10,0);hidden.add(new Mesh(geometry,material));root.add(hidden);
  try{
    const catches=createRainCatchments([root]);
    assert.ok(Math.abs(catches.height(0,0)-5.1)<1e-5);
    for(const x of [3,6,9,12])assert.equal(catches.height(x,0),-Infinity,'Decorative or hidden geometry cannot create an invisible rain shelter');
    assert.equal(catches.triangles,2,'Only the two actual upward roof triangles enter the spatial index');
  }finally{geometry.dispose();interior.geometry.dispose();material.dispose();}
});

test('pruned catchments retain every actual room roof and both bridge decks', async()=>{
  const {createElement}=await import('react');
  const {create}=await import('@react-three/test-renderer');
  const {world,createSceneRuntime}=await import('../src/content/world');
  const {LandmarkModel}=await import('../src/components/world/LandmarkModels');
  const {EcoCity}=await import('../src/components/world/EcoCity');
  const {createBridges}=await import('../src/components/world/Bridges');
  const {BRIDGES}=await import('../src/components/world/bridgePlan');
  const {mainRoomLamps}=await import('../src/components/world/RoomLighting');
  const {createRainCatchments}=await import('../src/components/world/rainCatchments');
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const props={runtime:{current:createSceneRuntime()},active:false,paused:true,quality:'high' as const};
  const buildings=world.landmarks.map(site=>createElement('group',{key:site.id,name:`landmark-model-${site.id}`,position:site.position,rotation:[0,site.rotationY??0,0]},createElement(LandmarkModel,{...props,id:site.id})));
  const renderer=await create(createElement('group',null,...buildings,createElement(EcoCity,props))),bridges=createBridges();
  try{
    const roots:import('three').Object3D[]=[bridges.root],rooms=[...mainRoomLamps];
    renderer.scene.instance.traverse(object=>{
      if(object.name.startsWith('landmark-model-')||object.name.startsWith('city-building-'))roots.push(object);
      if(object.name==='interior-light-fixtures')rooms.push(...object.userData.rooms);
    });
    const catches=createRainCatchments(roots);
    assert.ok(rooms.length>50,'Actual city room coverage is included');
    for(const room of rooms)assert.ok(catches.height(room.x,room.z)>=room.ceiling-.005,`Missing weather roof at ${room.x},${room.z}`);
    for(const bridge of BRIDGES)for(let i=1;i<bridge.samples.length;i++){
      const point=bridge.samples[i-1].point.clone().lerp(bridge.samples[i].point,.5);
      assert.ok(catches.height(point.x,point.z)>=point.y-.005,`${bridge.id}: bridge deck no longer catches rain`);
    }
    assert.ok(catches.triangles<70000,'Furniture and vines must not double the rain query budget');
  }finally{bridges.dispose();await renderer.unmount();}
});
