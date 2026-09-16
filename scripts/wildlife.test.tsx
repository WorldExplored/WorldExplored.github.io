import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { create, act } from '@react-three/test-renderer';
import { InstancedMesh, Matrix4, Vector3 } from 'three';
import { Wildlife, createWildlife, writeGullPose } from '../src/components/world/Wildlife';
import { createCrabRoutes, createCrabStates, createGullPerches, createGullStates, startGullTakeoff, stepCrab, stepGull, validCrabPosition, WILDLIFE_COUNTS, writeCrabPosition, gullFlightFloor, type GullMode } from '../src/components/world/wildlifeState';
import { cameraObstacles } from '../src/components/world/cameraControls';
import { createLandscapePlan, terrainHeight } from '../src/components/world/terrain';
import { createSceneRuntime, type QualityTier } from '../src/content/world';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const distantCamera = new Vector3(200, 200, 200);

test('gulls have varied phases, continuous complete behaviour cycles, and safe flight heights', () => {
  const birds = createGullStates(); assert.equal(birds.length, 18); assert.equal(new Set(birds.map(bird => bird.phase)).size, 18);
  assert.ok(createGullPerches().some(perch => perch.id === 'beacon-balcony-rail'));
  const modes = new Set<GullMode>(); const previous = new Vector3();
  for (let frame = 0; frame < 60 * 160; frame++) {
    for (const bird of birds) {
      previous.copy(bird.position); stepGull(bird, 1 / 60, distantCamera, null); modes.add(bird.mode);
      assert.ok(bird.position.distanceTo(previous) < .4, `${bird.index}: ${bird.mode} discontinuity`);
      assert.ok(Number.isFinite(bird.position.length())); assert.ok(bird.position.x > -110 && bird.position.x < 55 && bird.position.z > -115 && bird.position.z < 60);
      assert.ok(bird.position.y > terrainHeight(bird.position.x, bird.position.z) + .05);
      if (['gliding', 'flapping', 'circling'].includes(bird.mode)) assert.ok(bird.position.y > 8);
      if (bird.mode === 'perched') assert.ok(bird.position.distanceTo(bird.perch.position) < 1e-8);
    }
  }
  assert.deepEqual([...modes].sort(), ['approach', 'circling', 'flapping', 'gliding', 'perched', 'takeoff']);
});

test('takeoff starts at the present perch and paused gulls freeze all state', () => {
  const bird = createGullStates()[0]; assert.equal(bird.mode, 'perched'); const origin = bird.position.clone();
  stepGull(bird, 1 / 60, distantCamera, origin.toArray()); assert.equal(bird.mode, 'takeoff'); assert.ok(bird.position.equals(origin));
  for (let frame = 0; frame < 180; frame++) stepGull(bird, 1 / 60, distantCamera, null);
  assert.ok(bird.position.y > origin.y + 1); assert.ok(Math.hypot(bird.position.x - origin.x, bird.position.z - origin.z) < .001);
  const snapshot = JSON.stringify(bird); stepGull(bird, 10, origin, origin.toArray(), true); assert.equal(JSON.stringify(bird), snapshot);
  startGullTakeoff(bird); assert.ok(bird.start.equals(bird.position));
});

test('all crab routes remain on gently sloping exposed coast with structure and path clearance', () => {
  const plan = createLandscapePlan(); const routes = createCrabRoutes(plan); const point = new Vector3(); assert.equal(routes.length, 10);
  for (const route of routes) for (let index = 0; index <= 100; index++) {
    writeCrabPosition(route, index / 50 - 1, point); assert.ok(validCrabPosition(point, plan)); assert.ok(Math.abs(point.y - terrainHeight(point.x, point.z) - .11) < 1e-8);
  }
  const crab = createCrabStates()[0]; const start = crab.position.clone();
  for (let frame = 0; frame < 300; frame++) stepCrab(crab, 1 / 60, distantCamera, [start.x + .2, 0, start.z]);
  assert.ok(['Fleeing','Hiding'].includes(crab.mode)); assert.ok(validCrabPosition(crab.position, plan)); assert.ok(crab.position.distanceTo(start) > .05);
  const snapshot = JSON.stringify(crab); for (let frame = 0; frame < 100; frame++) stepCrab(crab, 1 / 60, distantCamera, null, true); assert.equal(JSON.stringify(crab), snapshot);
});

test('wildlife tiers reuse geometry, have articulated silhouettes, freeze and never claim pointer input', async () => {
  const runtime = { current: createSceneRuntime() }; const render = (quality: QualityTier = 'high', paused = false) => <Wildlife runtime={runtime} quality={quality} paused={paused} />;
  const renderer = await create(render());
  const meshes: InstancedMesh[] = []; renderer.scene.instance.traverse(object => { if (object instanceof InstancedMesh) meshes.push(object); });
  const body = meshes.find(mesh => mesh.name === 'gull-bodies')!; const wings = meshes.find(mesh => mesh.name === 'gull-articulated-primaries')!; const crabs = meshes.find(mesh => mesh.name === 'crab-shells')!;
  const geometry = wings.geometry; const matrix = new Matrix4(); const position = new Vector3();
  const advance = async (frames: number) => act(async () => { for (let frame = 0; frame < frames; frame++) await renderer.advanceFrames(1, 1 / 60); });
  try {
    await advance(1); assert.equal(body.count, 18); assert.equal(crabs.count, 10); assert.ok(wings.geometry.attributes.position.count > 500);
    for (const mesh of meshes) { mesh.getMatrixAt(0, matrix); assert.ok(matrix.determinant() > 0); const hits: unknown[] = []; mesh.raycast({} as never, hits as never); assert.equal(hits.length, 0); }
    body.getMatrixAt(1, matrix); position.setFromMatrixPosition(matrix); await advance(30); body.getMatrixAt(1, matrix); assert.ok(position.distanceTo(new Vector3().setFromMatrixPosition(matrix)) > .1);
    for (const tier of ['medium', 'low'] as const) { await renderer.update(render(tier)); await advance(1); assert.equal(body.count, WILDLIFE_COUNTS[tier].gulls); assert.equal(crabs.count, WILDLIFE_COUNTS[tier].crabs); assert.equal(wings.geometry, geometry); }
    await renderer.update(render('high', true)); await advance(1); const frozen = meshes.map(mesh => Array.from(mesh.instanceMatrix.array)); await advance(90); assert.deepEqual(meshes.map(mesh => Array.from(mesh.instanceMatrix.array)), frozen);
    const source = readFileSync(new URL('../src/components/world/Wildlife.tsx', import.meta.url), 'utf8'); assert.doesNotMatch(source, /onPointer|onClick|onWheel/);
  } finally { await renderer.unmount(); }
});


test('five-minute flock keeps clear flight corridors and exclusive perches through disturbances', () => {
  const birds=createGullStates(), obstacles=cameraObstacles();
  const modes=new Set<string>(); let minimumSeparation=Infinity, landed=0;
  const residentOrigin=birds[0].position.clone();
  for(let frame=0;frame<60*300;frame++){
    for(const bird of birds){
      const previous=bird.position.clone();const before=bird.mode;
      const threat=frame===60*150&&bird.index===0?bird.position.toArray():null;
      stepGull(bird,1/60,distantCamera,threat);modes.add(bird.mode);
      assert.ok(bird.position.distanceTo(previous)<.06,`${bird.index} moved abruptly`);
      assert.ok([...bird.position.toArray(),...bird.velocity.toArray()].every(Number.isFinite));
      assert.ok(bird.age<=bird.duration+.02||!['approach','takeoff'].includes(bird.mode));
      if(before!=='perched'&&bird.mode==='perched')landed++;
      if(['approach','perched'].includes(bird.mode))assert.equal(bird.perch.owner,bird.index);
      if(frame<60*150&&bird.index===0)assert.ok(bird.position.equals(residentOrigin));
      const landingColumn=['approach','takeoff','perched'].includes(bird.mode)&&Math.hypot(bird.position.x-bird.perch.position.x,bird.position.z-bird.perch.position.z)<.12;
      if(landingColumn)assert.ok(bird.position.y>=bird.perch.position.y-.001);
      else if(frame%10===0)assert.ok(bird.position.y>=gullFlightFloor(bird.position.x,bird.position.z,obstacles),`${bird.index} below safe flight envelope`);
    }
    for(let a=0;a<birds.length;a++)for(let b=a+1;b<birds.length;b++)minimumSeparation=Math.min(minimumSeparation,birds[a].position.distanceTo(birds[b].position));
    const occupied=birds.filter(b=>['perched','approach'].includes(b.mode)).map(b=>b.perch.id);assert.equal(new Set(occupied).size,occupied.length);
  }
  assert.ok(minimumSeparation>1.5,`flock separation ${minimumSeparation}`);assert.ok(landed>=3);
  assert.ok(modes.has('takeoff')&&modes.has('approach'));assert.equal(birds[0].mode,'perched');
});

test('crabs latch retreats, cap acceleration and turning, and recover after repeated threats', () => {
  const crabs=createCrabStates(),plan=createLandscapePlan();const modes=new Set<string>();
  const retreats=new Map<number,number>();
  for(let frame=0;frame<60*90;frame++)for(const [index,crab] of crabs.entries()){
    const previous=crab.position.clone(),speed=crab.speed,heading=crab.heading;
    // Alternate the pointer across each animal, then withdraw long enough for recovery.
    const exposed=frame<240||(frame>=1800&&frame<2040);
    const pointer=exposed?[crab.position.x+(frame%2?.3:-.3),crab.position.y,crab.position.z]:null;
    const before=crab.mode;stepCrab(crab,1/60,distantCamera,pointer);modes.add(crab.mode);
    if(before!=='Alert'&&crab.mode==='Alert')retreats.set(index,crab.retreat);
    if(['Alert','Fleeing','Hiding'].includes(crab.mode))assert.equal(crab.retreat,retreats.get(index));
    assert.ok(Math.abs(crab.speed-speed)<=.85/60+.00001,`${index} acceleration exceeded`);
    assert.ok(Math.abs(crab.heading-heading)<=1.5/60+.00001);
    assert.ok(crab.position.distanceTo(previous)<.014,`${index} abrupt movement`);
    if(frame%15===0)assert.ok(validCrabPosition(crab.position,plan));
  }
  assert.deepEqual([...modes].sort(),['Alert','Fleeing','Hiding','Idle','Returning','Walking']);
  assert.ok(crabs.every(crab=>['Idle','Walking'].includes(crab.mode)));
  for(let a=0;a<crabs.length;a++)for(let b=a+1;b<crabs.length;b++)assert.ok(crabs[a].position.distanceTo(crabs[b].position)>.75);
});


test('resident gull meshes fold above the rail and clear the actual lighthouse shaft and lantern', () => {
  const life=createWildlife(),bird=life.gulls[0],matrix=new Matrix4(),point=new Vector3();
  let checked=0;
  for(let frame=0;frame<60*150;frame++){
    stepGull(bird,1/60,distantCamera,frame===60*20?bird.position.toArray():null);
    if(frame%15)continue;writeGullPose(life,bird,0);
    for(const mesh of life.meshes.filter(mesh=>mesh.name.startsWith('gull-'))){
      mesh.getMatrixAt(0,matrix);const positions=mesh.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){
        point.fromBufferAttribute(positions,i).applyMatrix4(matrix);
        const y=point.y-1.8,radius=Math.hypot(point.x+76,point.z+36);
        const wall=y>=5.46&&y<=6.50?.58:y>=1.02&&y<=5.26?.87-.44*(y-1.02)/4.24+.045*Math.sin(Math.PI*(y-1.02)/4.24):0;
        assert.ok(radius>=wall-.015,`${mesh.name} enters lighthouse at ${point.toArray()}`);
        if(bird.mode==='perched'&&/wings|primaries/.test(mesh.name))assert.ok(point.y>bird.perch.position.y-.15,'folded feathers hang into balcony');
        checked++;
      }
    }
  }
  assert.ok(checked>100000);
  life.meshes.forEach(mesh=>{mesh.geometry.dispose();mesh.dispose();});life.materials.forEach(material=>material.dispose());
});
