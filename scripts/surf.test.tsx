import test from 'node:test';
import assert from 'node:assert/strict';
import { create, act } from '@react-three/test-renderer';
import { Matrix4, Vector3, type InstancedMesh, type Mesh, type ShaderMaterial } from 'three';
import { coastExposure, coastNormal, shoreAlong, shoreBreakup, shorelineCrestTime, shorelinePhase, shorelineWash, shorelineWave } from '../src/components/world/waves';
import { rockImpactPosition, createShoreDrops, createShoreImpactSites, createShoreImpactSystem, shoreDropPose, ShoreImpacts, SHORE_DROPS_PER_SITE, updateShoreImpacts } from '../src/components/world/ShoreImpacts';
import { Water } from '../src/components/world/Water';
import { createSceneRuntime, world, type QualityTier } from '../src/content/world';
import { createLandscapePlan, landDistance } from '../src/components/world/terrain';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('surf crests travel toward land and arrival wash drains completely between sets', () => {
  const x = -10; const z = 20;
  const peaks = [0, 1].map(time => {
    const expected = (Math.PI * 2 - time * 1.45 - shoreAlong(x, z)) / 1.32;
    let maximum = -Infinity; let peak = 0;
    for (let sea = expected - .35; sea < expected + .35; sea += .005) {
      const value = shorelineWave(-sea, x, z, time, 1).crest;
      if (value > maximum) { maximum = value; peak = sea; }
    }
    assert.ok(Math.abs(peak - expected) < .02, 'The peak follows the incoming phase, rather than a stationary coast outline.');
    return peak;
  });
  assert.ok(peaks[0] - peaks[1] > 1, 'The crest advances landward by over one metre in one water-time second.');
  const wash = Array.from({ length: 600 }, (_, index) => shorelineWave(-.2, x, z, index * .04, 1).foam);
  assert.ok(Math.max(...wash) > .2); assert.ok(Math.min(...wash) < 1e-5, 'Foam is absent between arrivals.');
  assert.equal(shorelineWave(-30, x, z, 1, 1).crest, 0);
  assert.equal(shorelineWave(-30, x, z, 1, 1).foam, 0);
});

test('wave sets have complete spatial gaps, different masks and curled leading edges', () => {
  const first: number[] = []; const second: number[] = [];
  for (let x = -40; x <= 40; x += 1) { first.push(shoreBreakup(x, 20, 1)); second.push(shoreBreakup(x, 20, 1, true)); }
  assert.ok(first.filter(value => value === 0).length >= 12, 'The front cannot create an unbroken island outline.');
  assert.ok(first.filter(value => value > .7).length >= 12);
  assert.notDeepEqual(first, second, 'The longer swell uses an independent breakup pattern.');
  const curl = Array.from({ length: 200 }, (_, index) => shorelineWave(-2, -10, 20, index * .025, 1).curl);
  assert.ok(Math.min(...curl) < -.1 && Math.max(...curl) > .1, 'The normal field turns through each advancing crest.');
});

test('shared coast samples shelter a channel even when it faces the prevailing swell', () => {
  const cove = { x: -6.4231056423666715, z: 9.724251718859353 };
  const open = { x: -79.48301239012659, z: -31.32654804217352 };
  const coveNormal = coastNormal(cove.x, cove.z);
  assert.ok(coveNormal.x * -.72 + coveNormal.z * .69 > .8, 'Both cases face the incoming wind; the channel is sheltered by land.');
  assert.ok(Math.abs(landDistance(cove.x, cove.z)) < .01 && Math.abs(landDistance(open.x, open.z)) < .01);
  assert.ok(coastExposure(open.x, open.z) > .9);
  assert.ok(coastExposure(cove.x, cove.z) < .2);
});

test('impact sites follow exposed headlands, include the distant beacon and keep drop arcs in water', () => {
  const sites = createShoreImpactSites(); const drops = createShoreDrops(sites); const position = new Vector3();
  assert.deepEqual(createShoreImpactSites(), sites); assert.ok(sites.length >= 4 && sites.length <= 8);
  assert.ok(sites.every(site=>site.rock.startsWith('coast-rock-')));
  assert.ok(new Set(sites.map(site => site.start)).size === sites.length);
  sites.forEach(site => { assert.ok(landDistance(site.x, site.z) < .06); assert.ok(site.exposure > .28); assert.ok(site.period >= 7 && site.period < 25);assert.ok(site.energy>.6); });
  for (const drop of drops) {
    const site = sites[drop.site];
    let peak = 0; let sawDescending = false; let previousY = -Infinity;
    for (let age = 0; age <= 1.6; age += .015) {
      const size = shoreDropPose(site, drop, age, position);
      if (size > 0) {
        peak = Math.max(peak, position.y); sawDescending ||= position.y < previousY; previousY = position.y;
        assert.ok(landDistance(position.x, position.z) < -.1, 'Rebounding droplets land back in the sea.');
      }
    }
    assert.ok(peak > .35 && peak < 2.4); assert.ok(sawDescending);
    assert.equal(shoreDropPose(site, drop, 2, position), 0); assert.ok(position.y < 0);
  }
});

test('pooled shore spray is substantial at crest arrivals and leaves calm intervals', () => {
  const system = createShoreImpactSystem(); const matrix = new Matrix4(); const scale = new Vector3(); const counts: number[] = [];
  for (let time = 0; time < 16; time += .05) {
    updateShoreImpacts(system, time, 'high'); let visible = 0;
    for (let index = 0; index < system.mesh.count; index++) { system.mesh.getMatrixAt(index, matrix); scale.setFromMatrixScale(matrix); if (scale.x > .002) visible++; }
    counts.push(visible);
  }
  assert.ok(Math.max(...counts) >= 72, 'The exposed lighthouse has multiple detailed spray fans during the opening.');
  assert.ok(counts.filter(count => count === 0).length > counts.length * .65, 'There is no continuous spray.');
  assert.ok(Math.max(...counts) <= SHORE_DROPS_PER_SITE * 4, 'Only local rock faces emit; there is no continuous island-wide spray.');
  assert.equal(system.mesh.raycast.length, 0);
  system.dispose();
});

test('impact resources and active particle poses survive quality changes and reduced-motion pause', async () => {
  const runtime = { current: createSceneRuntime() };
  const render = (quality: QualityTier = 'high', paused = false) => <ShoreImpacts runtime={runtime} paused={paused} quality={quality} />;
  const renderer = await create(render()); const mesh = renderer.scene.instance.getObjectByName('breaking-shore-droplets') as InstancedMesh;
  const geometry = mesh.geometry; const material = mesh.material;
  let geometryDisposals = 0; let materialDisposals = 0;
  geometry.addEventListener('dispose', () => geometryDisposals++);
  assert.ok(!Array.isArray(material)); if (Array.isArray(material)) return;
  material.addEventListener('dispose', () => materialDisposals++);
  const advance = async () => { await act(async () => { await renderer.advanceFrames(1, 1 / 60); }); };
  try {
    const probe = createShoreImpactSystem(); const probeMatrix = new Matrix4(); const probeScale = new Vector3();
    let activeTime = -1;
    for (let time = 0; time < 30 && activeTime < 0; time += .025) {
      updateShoreImpacts(probe, time, 'high');
      for (let index = 0; index < probe.mesh.count; index++) {
        probe.mesh.getMatrixAt(index, probeMatrix);
        if (probeScale.setFromMatrixScale(probeMatrix).x > .002) { activeTime = time; break; }
      }
    }
    probe.dispose(); assert.ok(activeTime >= 0, 'An authored rock impact occurs during the audit window.');
    runtime.current.elapsed = activeTime; await advance();
    const matrix = new Matrix4(); const scale = new Vector3(); let visible = 0;
    for (let index = 0; index < mesh.count; index++) { mesh.getMatrixAt(index, matrix); if (scale.setFromMatrixScale(matrix).x > .002) visible++; }
    assert.ok(visible > 0, 'Pause is tested during an active splash.');
    const frozen = Array.from(mesh.instanceMatrix.array);
    await renderer.update(render('high', true)); runtime.current.elapsed = 200; await advance();
    assert.deepEqual(Array.from(mesh.instanceMatrix.array), frozen);
    for (const [quality, count] of [['low', 0], ['medium', Math.min(4*SHORE_DROPS_PER_SITE,mesh.instanceMatrix.count)], ['high', mesh.instanceMatrix.count]] as const) {
      await renderer.update(render(quality, true)); await advance();
      assert.equal(mesh.count, count); assert.equal(mesh.geometry, geometry); assert.equal(mesh.material, material);
      assert.deepEqual(Array.from(mesh.instanceMatrix.array), frozen);
    }
    assert.equal(geometryDisposals + materialDisposals, 0);
  } finally { await renderer.unmount(); }
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1);
});

test('water retains coast texture, geometry and material while quality changes, with the beacon inside the field', async () => {
  const runtime = { current: createSceneRuntime() };
  const render = (quality: QualityTier = 'high') => <Water runtime={runtime} paused={false} quality={quality} />;
  const renderer = await create(render()); const water = renderer.scene.findByType('Mesh').instance as Mesh;
  const material = water.material as ShaderMaterial; const geometry = water.geometry; const texture = material.uniforms.uCoast.value;
  try {
    const bounds = material.uniforms.uCoastBounds.value;
    assert.ok(-82 > bounds.x && -70 < bounds.x + bounds.z && -42 > bounds.y && -30 < bounds.y + bounds.w);
    for (const quality of ['low', 'medium', 'high'] as const) {
      await renderer.update(render(quality)); assert.equal(water.geometry, geometry); assert.equal(water.material, material); assert.equal(material.uniforms.uCoast.value, texture);
    }
  } finally { await renderer.unmount(); }
});


test('direct rock responses start in visible water beyond the modeled rock footprint', () => {
  for (const rock of createLandscapePlan().rocks) {
    const point = rockImpactPosition(rock, 7);
    assert.ok(Math.hypot(point.x-rock.x, point.z-rock.z) > rock.radius);
    assert.ok(landDistance(point.x, point.z) < 0, rock.id);
    assert.ok(Math.hypot(point.x-rock.x, point.z-rock.z) < rock.radius+2.2);
  }
});


test('rock spray and wet sand share the actual advancing wave clock', () => {
  const sites=createShoreImpactSites();
  assert.equal(sites.filter(site=>site.island==='beacon').length,3);
  for(const site of sites){
    const distance=landDistance(site.x,site.z);
    for(let cycle=0;cycle<12;cycle++){
      const time=(site.start+site.period*cycle)*world.environment.waterSpeed;
      assert.ok(Math.abs(Math.sin(shorelinePhase(distance,site.x,site.z,time)))<1e-10,'every spray set starts on a visible primary crest');
    }
    for(let cycle=-3;cycle<4;cycle++)assert.ok(Math.abs(shorelinePhase(distance,site.x,site.z,shorelineCrestTime(distance,site.x,site.z,cycle))-cycle*Math.PI*2)<1e-10);
  }
  const wash=Array.from({length:400},(_,i)=>shorelineWash(-.2,-10,20,i*.04,1));
  assert.ok(Math.min(...wash)<.001&&Math.max(...wash)>.2);
});

test('impact foam fans expand seaward with reusable geometry and no complete rings',()=>{
  const system=createShoreImpactSystem(),matrix=new Matrix4(),vertex=new Vector3();
  const geometry=system.foam.geometry,material=system.foam.material;
  let geometryDisposals=0,materialDisposals=0;geometry.addEventListener('dispose',()=>geometryDisposals++);
  system.foamMaterial.addEventListener('dispose',()=>materialDisposals++);
  try{
    assert.ok(system.foamGeometry.parameters.thetaLength<Math.PI,'foam fans do not draw complete circles around rocks');
    let visible=0;
    for(let time=0;time<16;time+=.13){
      updateShoreImpacts(system,time,'high');
      for(let index=0;index<system.foam.count;index++)if(system.foamFades.getX(index)>.01){
        visible++;system.foam.getMatrixAt(index,matrix);
        for(let v=0;v<geometry.attributes.position.count;v++){vertex.fromBufferAttribute(geometry.attributes.position,v).applyMatrix4(matrix);assert.ok(landDistance(vertex.x,vertex.z)<-.15,'foam stays on the water side of the cliff');}
      }
    }
    assert.ok(visible>20);
    const frozen=Array.from(system.foam.instanceMatrix.array),fade=Array.from(system.foamFades.array);
    for(const quality of ['low','medium','high'] as const){updateShoreImpacts(system,200,quality,true);assert.deepEqual(Array.from(system.foam.instanceMatrix.array),frozen);assert.deepEqual(Array.from(system.foamFades.array),fade);}
    assert.equal(system.foam.geometry,geometry);assert.equal(system.foam.material,material);
    assert.equal(system.mesh.geometry.index!.count/3*system.mesh.instanceMatrix.count+geometry.index!.count/3*system.foam.instanceMatrix.count,12744,'two pooled draws stay within their fixed triangle budget');
  }finally{system.dispose();}
  assert.equal(geometryDisposals,1);assert.equal(materialDisposals,1);
});
