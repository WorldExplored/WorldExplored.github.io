import test from 'node:test';
import assert from 'node:assert/strict';
import { create } from '@react-three/test-renderer';
import { Vector3, type Mesh, type ShaderMaterial } from 'three';
import { advanceSceneTime, easternHour, daylightAt, daylightWeights, stormAt, stormSchedule, windAt, windDisplacement } from '../src/components/world/weatherState';
import { createSceneRuntime, world } from '../src/content/world';
import { CloudSystem } from '../src/components/world/AmbientSystem';
import { advanceCloudPress, cloudBounds, cloudOrigin, cloudVisibility, createCloudClusters } from '../src/components/world/clouds';
import { createRain } from '../src/components/world/Rain';
import { makeClouds } from '../src/components/world/CloudSurface';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('Eastern clock follows winter, summer and both DST transitions', () => {
  assert.equal(easternHour(new Date('2026-01-10T17:00:00Z')), 12);
  assert.equal(easternHour(new Date('2026-07-10T16:00:00Z')), 12);
  assert.equal(easternHour(new Date('2026-03-08T06:59:00Z')), 1 + 59 / 60);
  assert.equal(easternHour(new Date('2026-03-08T07:00:00Z')), 3);
  assert.equal(easternHour(new Date('2026-11-01T05:30:00Z')), 1.5);
  assert.equal(easternHour(new Date('2026-11-01T06:30:00Z')), 1.5);
});

test('one solar direction passes through dawn, noon, sunset and night smoothly', () => {
  assert.ok(daylightAt(6).x < -.9); assert.ok(daylightAt(12).y > .9); assert.ok(daylightAt(18).x > .9); assert.ok(daylightAt(0).y < -.9);
  assert.equal(daylightWeights(12).daylight, 1); assert.equal(daylightWeights(0).night, 1);
  assert.ok(daylightWeights(18).dusk > .9);
  for (let hour = 0; hour < 24; hour += .01) assert.ok(daylightAt(hour).distanceTo(daylightAt(hour + .01)) < .004);
});

test('wind displacement differentiates to the same breeze used by rain', () => {
  for (let second = 0; second < 10000; second += 71) {
    const velocity = windDisplacement(second + .01).sub(windDisplacement(second)).multiplyScalar(100);
    assert.ok(velocity.distanceTo(new Vector3(...windAt(second))) < .0001);
    assert.ok(velocity.x > 0 && velocity.z > 0);
    for (const cloud of createCloudClusters(3)) {
      const start = cloudOrigin(cloud, second, new Vector3());
      const end = cloudOrigin(cloud, second + .01, new Vector3());
      if (end.distanceTo(start) < 1) assert.ok(end.sub(start).multiplyScalar(100).distanceTo(velocity.clone().multiplyScalar(cloud.speed / (world.environment.cloudSpeed * 2.1))) < .0001);
    }
  }
});

test('storm fronts have 5–10 minutes of rain and gradual wind-driven arrival/departure', () => {
  for (let index = 0; index < 30; index++) {
    const schedule = stormSchedule(index);
    assert.ok(schedule.rainSeconds >= 300 && schedule.rainSeconds <= 600);
    const start = schedule.arrival;
    assert.equal(stormAt(start - 1).cover, 0); assert.equal(stormAt(start).rain, 0);
    assert.ok(stormAt(start + 55).cover > .3 && stormAt(start + 55).cover < .7);
    assert.equal(stormAt(start + 160).rain, 1);
    const end = start + schedule.approachSeconds + schedule.rainSeconds + schedule.departureSeconds;
    assert.equal(stormAt(end).cover, 0); assert.equal(stormAt(end + 1).rain, 0);
    for (let time = start + 1; time < end; time += 37) {
      const a = stormAt(time), b = stormAt(time + .1);
      assert.ok(b.center[0] > a.center[0] && b.center[2] > a.center[2]);
      assert.ok(Math.abs(b.cover - a.cover) < .003);
    }
  }
});

test('the sky includes city-scale cloud banks and hides distant recycling', () => {
  const clouds = createCloudClusters();
  assert.ok(clouds.some(cloud => cloudBounds(cloud).max.x - cloudBounds(cloud).min.x > 95));
  for (const cloud of clouds) for (let seconds = 0; seconds < 9000; seconds += 29) {
    const a = cloudOrigin(cloud, seconds, new Vector3()), b = cloudOrigin(cloud, seconds + .05, new Vector3());
    if (a.distanceTo(b) > 1) assert.ok(cloudVisibility(cloud, seconds) < .001 && cloudVisibility(cloud, seconds + .05) < .001);
  }
});

test('squeezing has a damped response and reduced motion has a stable immediate release', () => {
  const clouds = createCloudClusters(2);
  advanceCloudPress(clouds, 0, 1 / 60, false); assert.ok(clouds[0].response > 0 && clouds[0].response < .2);
  advanceCloudPress(clouds, 1, 1 / 60, true); assert.equal(clouds[0].response, 0); assert.equal(clouds[1].response, 1);
  advanceCloudPress(clouds, -1, 1 / 60, true); assert.ok(clouds.every(cloud => !cloud.targeted && cloud.response === 0));
});

test('cloud pointer capture owns the gesture, emits rain and releases on cancellation', async () => {
  const runtime = { current: createSceneRuntime() };
  const renderer = await create(<CloudSystem runtime={runtime} paused={false} quality="low"/>);
  const cloud = renderer.scene.findByProps({ object: renderer.scene.children[0].children[0].instance });
  const target = { setPointerCapture: () => undefined, releasePointerCapture: () => undefined };
  try {
    await renderer.fireEvent(cloud, 'pointerDown', { faceIndex: 0, button: 0, shiftKey: false, pointerId: 7, point: new Vector3(-43, 23, -15), target, stopPropagation() {} });
    assert.equal(runtime.current.dragging, true);
    await renderer.advanceFrames(12, 1 / 60);
    const rain = renderer.scene.children[0].children[1].instance as Mesh;
    assert.equal(rain.visible, true); assert.ok((rain.material as ShaderMaterial).uniforms.uStrength.value > .5);
    await renderer.fireEvent(cloud, 'pointerCancel', {});
    assert.equal(runtime.current.dragging, false); assert.equal(rain.visible, false);
  } finally { await renderer.unmount(); }
});

test('rain geometry remains one draw with a fixed bounded population', () => {
  const rain = createRain(4400, 140, 52);
  assert.equal(rain.geometry.instanceCount, 4400);
  assert.equal(rain.geometry.getAttribute('position').count, 6);
  assert.equal(rain.geometry.getAttribute('aSeed').count, 4400);
  assert.equal(rain.material.depthWrite, false);
  rain.dispose();
});


test('rain duration is measured in active seconds at both 10 FPS and 60 FPS',()=>{
  for(const fps of [10,60]){
    const schedule=stormSchedule(0),runtime=createSceneRuntime();
    runtime.activeElapsed=schedule.arrival+schedule.approachSeconds;
    let rainStart=-1,rainEnd=-1;
    for(let frame=0;frame<Math.ceil((schedule.rainSeconds+5)*fps);frame++){
      advanceSceneTime(runtime,1/fps,false);
      if(stormAt(runtime.activeElapsed).rain>0){if(rainStart<0)rainStart=runtime.activeElapsed;rainEnd=runtime.activeElapsed;}
    }
    assert.ok(Math.abs((rainEnd-rainStart)-schedule.rainSeconds)<2/fps+.001);
    assert.ok(rainEnd-rainStart>=300-2/fps&&rainEnd-rainStart<=600);
    const active=runtime.activeElapsed,physics=runtime.elapsed;
    advanceSceneTime(runtime,1800,true);
    assert.equal(runtime.activeElapsed,active);assert.equal(runtime.elapsed,physics);
    advanceSceneTime(runtime,1/fps,false);
    assert.ok(Math.abs(runtime.activeElapsed-active-1/fps)<1e-9);
    if(fps===10)assert.ok(Math.abs(runtime.elapsed-(physics+.05))<1e-9,'locomotion keeps its bounded physics step');
  }
});

test('every storm front follows the integrated wind rather than an independent linear heading',()=>{
  for(let index=0;index<8;index++){
    const schedule=stormSchedule(index),middle=schedule.arrival+schedule.approachSeconds+schedule.rainSeconds*.5;
    assert.deepEqual(stormAt(middle).center,[-24,57,-42]);
    for(let seconds=schedule.arrival+1;seconds<schedule.arrival+schedule.approachSeconds+schedule.rainSeconds+schedule.departureSeconds-1;seconds+=39){
      const a=stormAt(seconds),b=stormAt(seconds+.01);
      const velocity=new Vector3(...b.center).sub(new Vector3(...a.center)).multiplyScalar(100);
      assert.ok(velocity.distanceTo(new Vector3(...windAt(seconds)))<.0001);
    }
  }
});

test('single-bank storm material fills every declared vector uniform slot', () => {
  const cloud=makeClouds(false,createCloudClusters(1));
  try {
    for(const [name,size] of [...cloud.material.vertexShader.matchAll(/uniform vec[34] (u\w+)\[(\d+)\]/g)].map(match=>[match[1],Number(match[2])] as const)) {
      const values=cloud.material.uniforms[name].value;
      assert.equal(values.length,size);
      for(let i=0;i<size;i++)assert.ok(values[i].toArray().every(Number.isFinite));
    }
  } finally {cloud.dispose();}
});
