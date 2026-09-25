import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { create, act } from '@react-three/test-renderer';
import { InstancedMesh, Matrix4, Vector3 } from 'three';
import { Wildlife, createWildlife, writeGullPose } from '../src/components/world/Wildlife';
import { createCrabRoutes, createCrabStates, createGullPerches, createGullStates, startGullTakeoff, stepCrab, stepGull, validCrabPosition, WILDLIFE_COUNTS, writeCrabPosition, gullFlightFloor, GULL_TURN_RATE, GULL_MAX_PITCH, GULL_SEPARATION, type GullMode } from '../src/components/world/wildlifeState';
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
      assert.ok(Math.abs(bird.pitch)<=GULL_MAX_PITCH);
      if (bird.flight.airborne) assert.ok(bird.position.y > 15);
      if (bird.mode === 'perched') assert.ok(bird.position.distanceTo(bird.perch.position) < 1e-8);
    }
  }
  assert.deepEqual([...modes].sort(), ['approach', 'circling', 'flapping', 'gliding', 'hunting', 'perched', 'preening', 'takeoff']);
});

test('takeoff starts at the present perch and paused gulls freeze all state', () => {
  const bird = createGullStates()[0]; assert.equal(bird.mode, 'perched'); const origin = bird.position.clone();
  stepGull(bird, 1 / 60, distantCamera, origin.toArray()); assert.equal(bird.mode, 'takeoff'); assert.ok(bird.position.equals(origin));
  for (let frame = 0; frame < 180; frame++) stepGull(bird, 1 / 60, distantCamera, null);
  assert.ok(bird.position.y > origin.y + 1); assert.ok(Math.hypot(bird.position.x - origin.x, bird.position.z - origin.z) > 1,'takeoff travels forward while climbing');
  const snapshot = JSON.stringify(bird); stepGull(bird, 10, origin, origin.toArray(), true); assert.equal(JSON.stringify(bird), snapshot);
  const position=bird.position.clone();startGullTakeoff(bird);assert.ok(bird.position.equals(position),'an in-flight request cannot restart the trajectory');
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
    await advance(1); assert.equal(body.count, 18); assert.equal(crabs.count, 10); wings.geometry.computeBoundingBox();const featherBounds=wings.geometry.boundingBox!;assert.ok(featherBounds.max.x-featherBounds.min.x>.4);assert.ok(featherBounds.max.z-featherBounds.min.z>.2);assert.ok(featherBounds.max.y-featherBounds.min.y>.02);
    for (const mesh of meshes) { mesh.getMatrixAt(0, matrix); assert.ok(matrix.determinant() > 0); const hits: unknown[] = []; mesh.raycast({} as never, hits as never); assert.equal(hits.length, 0); }
    body.getMatrixAt(10, matrix); position.setFromMatrixPosition(matrix); await advance(30); body.getMatrixAt(10, matrix); assert.ok(position.distanceTo(new Vector3().setFromMatrixPosition(matrix)) > .1);
    for (const tier of ['medium', 'low'] as const) { await renderer.update(render(tier)); await advance(1); assert.equal(body.count, WILDLIFE_COUNTS[tier].gulls); assert.equal(crabs.count, WILDLIFE_COUNTS[tier].crabs); assert.equal(wings.geometry, geometry); }
    await renderer.update(render('high', true)); await advance(1); const frozen = meshes.map(mesh => Array.from(mesh.instanceMatrix.array)); await advance(90); assert.deepEqual(meshes.map(mesh => Array.from(mesh.instanceMatrix.array)), frozen);
    const source = readFileSync(new URL('../src/components/world/Wildlife.tsx', import.meta.url), 'utf8'); assert.doesNotMatch(source, /onPointer|onClick|onWheel/);
  } finally { await renderer.unmount(); }
});


test('ten-minute flock preserves whole-wing clearance, shared rest sites and bounded flight through disturbances', () => {
  const birds=createGullStates(), obstacles=cameraObstacles();
  const modes=new Set<string>(),owners=new Map<string,Set<number>>();let minimumSeparation=Infinity,landed=0,catches=0,escapes=0;
  const beaconOrigin=birds[0].position.clone();let beaconDepartures=0;
  for(let frame=0;frame<60*600;frame++){
    for(const bird of birds){
      const previous=bird.position.clone(),velocity=bird.velocity.clone(),before=bird.mode,previousHeading=bird.heading,previousPitch=bird.pitch,progress=bird.progress;
      const threat=frame===60*150&&bird.index===0?bird.position.toArray():null;
      stepGull(bird,1/60,distantCamera,threat);modes.add(bird.mode);
      assert.ok(Math.abs(bird.heading-previousHeading)<=GULL_TURN_RATE/60+1e-10,`${bird.index} exceeded bounded heading rate`);
      assert.ok(Math.abs(bird.pitch-previousPitch)<=.6/60+1e-10,'no sudden nose-up or nose-down turn');
      assert.ok(Math.abs(bird.pitch)<=GULL_MAX_PITCH);
      assert.ok(bird.position.distanceTo(previous)<.045,`${bird.index} moved abruptly`);
      if(frame>0)assert.ok(bird.velocity.distanceTo(velocity)*60<1.5,`${bird.index} acceleration is bounded`);
      assert.ok([...bird.position.toArray(),...bird.velocity.toArray()].every(Number.isFinite));
      assert.ok(bird.position.y>=Math.max(.3,terrainHeight(bird.position.x,bird.position.z)+.28),'clear terrain and water');
      if(['perched','preening','approach'].includes(bird.mode))assert.equal(bird.perch.owner,bird.index);
      if(!['perched','preening'].includes(before)&&bird.mode==='perched'){
        landed++;if(!owners.has(bird.perch.id))owners.set(bird.perch.id,new Set());owners.get(bird.perch.id)!.add(bird.index);
      }
      if(bird.index===0&&before==='perched'&&bird.mode==='takeoff')beaconDepartures++;
      if(bird.hunt&&progress<.5&&bird.progress>=.5){if(bird.caught)catches++;else escapes++;}
      if(frame%15===0&&bird.flight.airborne)assert.ok(bird.position.y>=gullFlightFloor(bird.position.x,bird.position.z,obstacles));
    }
    for(let a=0;a<birds.length;a++)for(let b=a+1;b<birds.length;b++)minimumSeparation=Math.min(minimumSeparation,birds[a].position.distanceTo(birds[b].position));
    const occupied=birds.filter(b=>['perched','preening','approach'].includes(b.mode)).map(b=>b.perch.id);assert.equal(new Set(occupied).size,occupied.length);
  }
  assert.ok(minimumSeparation>GULL_SEPARATION,`full-wing flock separation ${minimumSeparation}`);assert.ok(landed>60);
  assert.ok(beaconDepartures>5);assert.ok(owners.get('beacon-balcony-rail')!.size===2,'different birds use the balcony');
  assert.ok(owners.size>=5);assert.ok(birds[0].position.distanceTo(beaconOrigin)>0||birds[0].cycle>5);
  assert.ok(catches>5&&escapes>5,'seeded fair catch coin produces both visible outcomes');
  assert.ok(modes.has('preening')&&modes.has('hunting'));
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


test('shared balcony gull meshes fold above the rail and clear the actual lighthouse shaft and lantern', () => {
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
        assert.ok(radius>=wall-.015,`${mesh.name} enters lighthouse at ${point.toArray()} frame ${frame} ${bird.mode} fold ${bird.fold}`);
        if(bird.mode==='perched'&&/wings|primaries/.test(mesh.name))assert.ok(point.y>bird.perch.position.y-.15,'folded feathers hang into balcony');
        checked++;
      }
    }
  }
  assert.ok(checked>100000);
  life.meshes.forEach(mesh=>{mesh.geometry.dispose();mesh.dispose();});life.materials.forEach(material=>material.dispose());
});


test('nests are grounded on distinct rock perches, flight legs tuck behind the body, and prey is carried only after a catch',()=>{
  const life=createWildlife(),matrix=new Matrix4();
  const nests=life.group.getObjectByName('gull-woven-twig-nests') as InstancedMesh;
  assert.equal(nests.count,3);
  const bird=life.gulls[2];bird.mode='gliding';bird.legs=0;bird.fold=0;writeGullPose(life,bird,2);
  life.gullLegs.getMatrixAt(2,matrix);const legs=life.gullLegs.geometry.getAttribute('position'),point=new Vector3();let low=Infinity,back=-Infinity;
  for(let i=0;i<legs.count;i++){point.fromBufferAttribute(legs,i).applyMatrix4(matrix);low=Math.min(low,point.y);back=Math.max(back,point.z);}
  assert.ok(low>bird.position.y-.2,'folded ankle and toes do not dangle vertically');assert.ok(Number.isFinite(back));
  bird.preyVisible=true;bird.caught=true;writeGullPose(life,bird,2);life.gullPrey.getMatrixAt(2,matrix);
  point.setFromMatrixPosition(matrix);assert.ok(point.distanceTo(bird.position)<.7,'a caught fish follows the bill');
  bird.preyVisible=false;writeGullPose(life,bird,2);life.gullPrey.getMatrixAt(2,matrix);assert.ok(matrix.determinant()<1e-9,'prey disappears without a new mesh');
  life.meshes.forEach(mesh=>{mesh.geometry.dispose();mesh.dispose();});life.materials.forEach(material=>material.dispose());
});

test('delayed nest occupants retain exclusive sites while arriving gulls circle with whole-wing clearance',()=>{
  const birds=createGullStates(),occupants=birds.filter(bird=>bird.mode==='perched');
  let circles=0,minDistance=Infinity;
  for(let frame=0;frame<60*180;frame++){
    for(const visitor of birds){
      if(occupants.includes(visitor))continue;
      const previous=visitor.position.clone();stepGull(visitor,1/60,distantCamera,null);
      if(visitor.holding>0)circles++;
      if(!visitor.flight.airborne){
        assert.equal(visitor.perch.owner,occupants.find(bird=>bird.perch===visitor.perch)!.index);
        assert.ok(!['perched','preening','approach'].includes(visitor.mode));
      }
      assert.ok(visitor.position.distanceTo(previous)<.07,'holding routes have no positional teleport');
      assert.ok(visitor.position.y>terrainHeight(visitor.position.x,visitor.position.z)+.28);
    }
    for(let a=0;a<birds.length;a++)for(let b=a+1;b<birds.length;b++)minDistance=Math.min(minDistance,birds[a].position.distanceTo(birds[b].position));
  }
  assert.ok(circles>200);assert.ok(minDistance>GULL_SEPARATION,`occupied-site body clearance ${minDistance}`);
});

test('solid bill and shoulder coverts keep anatomy connected through folded, gliding and flapping poses',()=>{
  const life=createWildlife(),bird=life.gulls[4],matrix=new Matrix4(),bodyMatrix=new Matrix4(),point=new Vector3();
  try{
    const bill=life.gullBill.geometry;bill.computeBoundingBox();const dimensions=bill.boundingBox!.getSize(new Vector3());
    assert.ok(dimensions.y>.05&&dimensions.x>.07&&dimensions.z>.20,'the beak is a solid tapered volume');
    const normals=bill.getAttribute('normal');assert.ok(Array.from({length:normals.count},(_,i)=>normals.getY(i)).some(n=>n<-.2),'lower beak has a physical underside');
    for(let fold=0;fold<=1;fold+=.1)for(const flap of [0,.5,1]){
      bird.fold=fold;bird.flap=flap;bird.time=fold*3;writeGullPose(life,bird,4);life.gullBody.getMatrixAt(4,bodyMatrix);const inverse=bodyMatrix.clone().invert();
      for(const wing of [life.wing,life.leftWing]){
        wing.getMatrixAt(4,matrix);point.set(0,0,0).applyMatrix4(matrix).applyMatrix4(inverse);
        assert.ok(Math.abs(point.x)<.16&&Math.abs(point.y)<.12&&Math.abs(point.z)<.18,'shoulder hinge remains inside the body');
        // The new coverts include a continuous overlap on both sides of the hinge.
        wing.geometry.computeBoundingBox();const box=wing.geometry.boundingBox!;assert.ok(box.min.x<0&&box.max.x>0);
      }
    }
    for(const name of ['gull-grass-and-feather-lining','gull-egg-brown-speckles'])assert.equal((life.group.getObjectByName(name) as InstancedMesh).count,3);
  }finally{life.meshes.forEach(mesh=>{mesh.geometry.dispose();mesh.dispose();});life.materials.forEach(material=>material.dispose());}
});
