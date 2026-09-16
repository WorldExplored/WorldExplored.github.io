import test from 'node:test';
import assert from 'node:assert/strict';
import { create, act } from '@react-three/test-renderer';
import { InstancedMesh, Matrix4, Vector3 } from 'three';
import { CoastalLife, createFishBodyGeometry, createFishTailGeometry } from '../src/components/world/CoastalLife';
import { FISH_SPECIES, createSchoolFish, fishBridgeClearance, fishFloor, stepSchoolFish, visibleFishCount, type FishDisturbance } from '../src/components/world/fishSchools';
import { landDistance, terrainHeight } from '../src/components/world/terrain';
import { createSceneRuntime } from '../src/content/world';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const quiet = (): FishDisturbance => ({ camera: new Vector3(200,40,200), pointer: null, ripple: {x:0,z:0,serial:0} });

test('four fish anatomies have distinct unscaled body profiles, fin topology and color patterns', () => {
  const bodies = FISH_SPECIES.map((_,index) => createFishBodyGeometry(index));
  const tails = FISH_SPECIES.map((_,index) => createFishTailGeometry(index));
  try {
    const sizes = bodies.map(body => body.boundingBox!.getSize(new Vector3()));
    assert.ok(sizes[1].x / sizes[1].y > 2.8, 'silver fish is a long spindle');
    assert.ok(sizes[2].y > sizes[2].x, 'amber fish has a deep disk and tall sails');
    assert.ok(sizes[0].x / sizes[0].y < 1.3, 'reef fish has rounded proportions');
    assert.ok(sizes[3].z > sizes[3].y * 1.4, 'bottom fish has broad lateral anatomy');
    assert.equal(new Set(bodies.map(body => JSON.stringify(body.userData.profile))).size, 4);
    assert.equal(new Set(tails.map(tail => tail.userData.topology)).size, 4);
    const bottom = bodies[3].userData.profile as number[][];
    assert.ok(bottom[4][2] > bottom[1][2] * 1.4, 'bottom fish is broad-headed, not a stretched sphere');
    bodies.forEach((body,index) => {
      assert.equal(body.userData.species, FISH_SPECIES[index].id);
      const position = body.getAttribute('position'); const colors = body.getAttribute('color');
      assert.ok(Array.from(position.array).every(Number.isFinite));
      assert.ok(new Set(Array.from(colors.array)).size > 8, 'body has an actual vertex-color pattern');
    });
  } finally { [...bodies,...tails].forEach(geometry => geometry.dispose()); }
});

test('species occupy distinct depths and populations and preserve bounded deterministic escape for five minutes', () => {
  const fish = createSchoolFish(); const mirror = createSchoolFish(); const disturbance = quiet(); const previous = new Vector3();
  assert.deepEqual(['high','medium','low'].map(tier => visibleFishCount(tier as 'high'|'medium'|'low')), [72,44,26]);
  const leaders = FISH_SPECIES.map((_,variant) => fish.find(item => item.variant === variant)!);
  assert.ok(leaders[0].position.y > leaders[1].position.y && leaders[1].position.y > leaders[2].position.y);
  assert.ok(leaders[3].position.y < leaders[2].position.y);
  let maximumSpeed = 0; const responses = new Set<number>();
  for (let frame = 0; frame < 300 * 30; frame++) {
    const active = leaders[Math.floor(frame / 150) % leaders.length];
    if (frame % 150 === 0) disturbance.ripple = {x:active.position.x + .3,z:active.position.z,serial:disturbance.ripple.serial+1};
    disturbance.pointer = frame % 300 < 75 ? [active.position.x+.2,0,active.position.z] : null;
    fish.forEach((item,index) => {
      const kind = FISH_SPECIES[item.variant]; previous.copy(item.position); const heading = item.heading;
      stepSchoolFish(item,1/30,disturbance,'medium'); stepSchoolFish(mirror[index],1/30,disturbance,'medium');
      assert.deepEqual(item.position.toArray(),mirror[index].position.toArray());
      assert.ok(item.position.toArray().every(Number.isFinite));
      maximumSpeed = Math.max(maximumSpeed,item.position.distanceTo(previous)*30);
      assert.ok(Math.abs(item.heading-heading) <= kind.turnRate/30+1e-9);
      assert.ok(Math.abs(item.bank) <= .22);
      assert.ok(item.position.y + kind.halfHeight <= -.27 + 1e-9, 'full fish remains below the lowest sea surface');
      assert.ok(item.position.y - kind.halfHeight >= fishFloor(item.position.x,item.position.z,kind.radius)+.129);
      assert.ok(landDistance(item.position.x,item.position.z) < -(kind.radius+1));
      if (frame % 30 === 0) assert.ok(fishBridgeClearance(item.position.x,item.position.z) > kind.radius+.3);
      if (item.scatterOut > .15) responses.add(item.variant);
    });
  }
  assert.ok(maximumSpeed < 6, `bounded maximum speed ${maximumSpeed}`);
  assert.equal(responses.size,4,'all species respond to disturbance');
  const impulses = leaders.map(item => { const copy = createSchoolFish().find(f => f.schoolIndex===item.schoolIndex && f.member===0)!; const d=quiet();d.ripple={x:copy.position.x+.2,z:copy.position.z,serial:1};stepSchoolFish(copy,1/60,d,'medium');return [copy.velocityAlong,copy.velocityOut]; });
  assert.equal(new Set(impulses.map(value=>JSON.stringify(value))).size,4,'escape impulses are species specific');
});

test('articulated body, tail and pectoral instances stay above the seabed throughout complete routes', async () => {
  const runtime = {current:createSceneRuntime()}; const renderer = await create(<CoastalLife runtime={runtime} quality="medium" paused={false}/>);
  const meshes: InstancedMesh[] = []; renderer.scene.instance.traverse(object=>{if(object instanceof InstancedMesh && !object.name.endsWith('glints'))meshes.push(object);});
  const matrix = new Matrix4(); const vertex = new Vector3();
  try {
    for (let second=0;second<150;second++) {
      await act(async()=>{for(let frame=0;frame<30;frame++)await renderer.advanceFrames(1,1/30);});
      for(const mesh of meshes) {
        const positions=mesh.geometry.getAttribute('position');
        for(let instance=0;instance<mesh.count;instance++) {
          mesh.getMatrixAt(instance,matrix); assert.ok(matrix.determinant()>0);
          for(let i=0;i<positions.count;i++) {
            vertex.fromBufferAttribute(positions,i).applyMatrix4(matrix);
            assert.ok(vertex.y > terrainHeight(vertex.x,vertex.z)+.035, `${mesh.name} clips seabed at ${vertex.toArray()}`);
            assert.ok(vertex.y < -.233, `${mesh.name} emerges without a deliberate coastal breach`);
          }
        }
      }
    }
  } finally { await renderer.unmount(); }
});
