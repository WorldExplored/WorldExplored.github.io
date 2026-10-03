import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Matrix4, Vector3 } from 'three';
import { createSeagrassMeadow } from '../src/components/world/SeagrassMeadow';
import { createManatees, createMeadowPlan, createMeadowScamperers, meadowFloor, meadowObstacleClearance, sampleManatee, sampleMeadowScamperer } from '../src/components/world/seagrassMeadowState';
import { SEAGRASS_MEADOW, seagrassMeadowClearance } from '../src/components/world/seagrassMeadowLayout';
import { manateeBodyGeometry, manateeHeadGeometry, manateeTailGeometry, manateeFlipperGeometry } from '../src/components/world/meadowAnatomy';
import { pelagicLaneClearance } from '../src/components/world/pelagicFishState';
import { marineFloorHeight } from '../src/components/world/reefHabitat';
import { coastalCaveClearance } from '../src/components/world/coastalCaveLayout';
import { harborWaterHeight } from '../src/components/world/waterSurface';
import { surfaceAnimals } from '../src/components/world/marineTraffic';

test('the meadow is short clustered seagrass rooted on the real floor with a clear cave approach',()=>{
  const plan=createMeadowPlan();assert.ok(plan.plants.length>4000&&plan.plants.length<=4400);assert.equal(plan.shells.length,42);
  const occupied=new Set<string>(),forms=new Set<number>();let xMin=Infinity,xMax=-Infinity,zMin=Infinity,zMax=-Infinity;
  for(const p of plan.plants){
    assert.ok(seagrassMeadowClearance(p.x,p.z,.1)<=0);assert.ok(coastalCaveClearance(p.x,p.z,.3)>0);assert.ok(p.z>-11);
    assert.ok(Math.abs(p.y+.02-marineFloorHeight(p.x,p.z))<1e-8);assert.ok(p.height>=.10&&p.height<.53);
    xMin=Math.min(xMin,p.x);xMax=Math.max(xMax,p.x);zMin=Math.min(zMin,p.z);zMax=Math.max(zMax,p.z);forms.add(p.form);occupied.add(`${Math.floor(p.x)},${Math.floor(p.z)}`);
  }
  assert.equal(forms.size,3);assert.ok(xMax-xMin>15&&zMax-zMin>11);assert.ok(occupied.size>110);
  assert.equal(meadowFloor(-55,-3),marineFloorHeight(-55,-3),'No extrapolated offshore island mesh lifts the roots.');
});

test('three manatees circle, graze and breathe with complete body, reef and shipping clearances',()=>{
  const states=createManatees(),last=states.map(s=>s.position.clone()),travel=states.map(()=>0),rest=states.map(()=>0),grazed=states.map(()=>0),breathed=states.map(()=>0);
  for(let time=0;time<=800;time+=.5){
    states.forEach((state,i)=>{
      sampleManatee(state,time);const move=state.position.distanceTo(last[i]);assert.ok(move<.36,'No position jumps between feeding, travel and breathing.');travel[i]+=move;
      if(move<.001)rest[i]++;if(state.graze>.65)grazed[i]++;if(state.breath>.98)breathed[i]++;
      assert.ok(state.position.z>-10,'The mythical crab keeps its entrance corridor.');assert.ok(meadowObstacleClearance(state.position.x,state.position.z,state.radius)>.1);
      assert.ok(state.position.y-.45*state.size>meadowFloor(state.position.x,state.position.z)+.04);
      const lane=pelagicLaneClearance(state.position.x,state.position.z);
      if(state.position.y+.46*state.size> -1.2)assert.ok(lane>state.radius+3.1,'Breathing stays outside the full surface hull sweep.');
      for(const other of states)if(other.index<i)assert.ok(state.position.distanceTo(other.position)>state.radius+other.radius+.25);
      last[i].copy(state.position);
    });
  }
  states.forEach((_,i)=>{assert.ok(travel[i]>70);assert.ok(rest[i]>40);assert.ok(grazed[i]>50);assert.ok(breathed[i]>4);});
});

test('manatee geometry has a broad paddle, attached flippers, a compact detailed muzzle and no buried rendered vertices',()=>{
  const anatomies=[manateeBodyGeometry(),manateeHeadGeometry(),manateeTailGeometry(),manateeFlipperGeometry(-1),manateeFlipperGeometry(1)];
  try{
    const bounds=anatomies.map(g=>{g.computeBoundingBox();return g.boundingBox!;});
    assert.ok(bounds[2].max.z-bounds[2].min.z>1.1,'The tail is a broad horizontal paddle.');assert.ok(bounds[2].max.y-bounds[2].min.y<.22);
    assert.ok(bounds[1].max.x<.76&&bounds[1].max.y<.3,'Small eyes and a blunt muzzle stay within the head envelope.');
    assert.ok(new Box3(bounds[1].min.clone().add(new Vector3(.74,.015,0)),bounds[1].max.clone().add(new Vector3(.74,.015,0))).intersectsBox(bounds[0]));
    assert.ok(anatomies.reduce((n,g)=>n+(g.index?.count??g.attributes.position.count)/3,0)<5500);
  }finally{anatomies.forEach(g=>g.dispose());}
  const life=createSeagrassMeadow(),matrix=new Matrix4(),point=new Vector3();
  try{
    for(let time=0;time<400;time+=23){
      life.update(time);
      for(const mesh of life.meshes.filter(m=>m.name.startsWith('manatee-'))){
        const vertices=mesh.geometry.getAttribute('position');
        for(let instance=0;instance<mesh.count;instance++){
          mesh.getMatrixAt(instance,matrix);
          for(let i=0;i<vertices.count;i+=9){point.fromBufferAttribute(vertices,i).applyMatrix4(matrix);assert.ok(point.y>marineFloorHeight(point.x,point.z)+.005,`${mesh.name} penetrates the floor at ${time}.`);}
        }
      }
    }
  }finally{life.dispose();}
});

test('small hermit crabs pause and scamper on the floor without intersecting manatees or one another',()=>{
  const crabs=createMeadowScamperers(),manatees=createManatees(),rests=new Set<number>(),runs=new Set<number>();assert.equal(crabs.length,12);
  for(let time=0;time<400;time+=.5){
    manatees.forEach(state=>sampleManatee(state,time));crabs.forEach(state=>sampleMeadowScamperer(state,time));
    crabs.forEach((crab,i)=>{
      (crab.moving?runs:rests).add(i);assert.ok(Math.abs(crab.position.y-meadowFloor(crab.position.x,crab.position.z)-.06*crab.size)<1e-7);
      for(const animal of manatees)assert.ok(Math.hypot(crab.position.x-animal.position.x,crab.position.z-animal.position.z)>animal.radius+.3*crab.size);
      for(const other of crabs)if(other.index<i)assert.ok(crab.position.distanceTo(other.position)>(crab.size+other.size)*.19);
    });
  }
  assert.equal(rests.size,12);assert.equal(runs.size,12);
});

test('surface algae cover multiple coasts and rooted shoreline pads follow waves without crossing shipping lanes',()=>{
  const life=createSeagrassMeadow(),matrix=new Matrix4(),point=new Vector3();
  try{
    const patches=life.plan.floating;assert.ok(patches.length>=18&&patches.length<=21);assert.ok(patches.filter(p=>p.radius>1).length>=3);
    assert.ok(Math.max(...patches.map(p=>p.x))-Math.min(...patches.map(p=>p.x))>130);assert.ok(Math.max(...patches.map(p=>p.z))-Math.min(...patches.map(p=>p.z))>130);
    patches.forEach(p=>assert.ok(pelagicLaneClearance(p.x,p.z)>p.radius+5));
    assert.ok(life.plan.lilies.length>=6);life.plan.lilies.forEach(p=>assert.ok(p.floor<-.5&&p.floor> -1.7));
    for(const time of[0,8.2,31]){
      life.update(time);
      for(const mesh of life.meshes.filter(m=>['floating-algae-fronds','shoreline-lily-pads'].includes(m.name)))for(let i=0;i<mesh.count;i++){
        mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);assert.ok(Math.abs(point.y-harborWaterHeight(point.x,point.z,time)-.02)<.002);assert.ok(pelagicLaneClearance(point.x,point.z)>4);
      }
    }
  }finally{life.dispose();}
});

test('the meadow has a bounded instance budget, freezes every animation, and retains both grazers on low quality',()=>{
  const life=createSeagrassMeadow(),before=surfaceAnimals.length;
  try{
    life.retain();assert.equal(surfaceAnimals.length,before+3);life.update(24);
    const matrices=life.meshes.map(m=>Array.from(m.instanceMatrix.array)),positions=life.manatees.map(m=>m.position.toArray()),geometries=life.meshes.map(m=>m.geometry),clock=life.waveTime.value;
    life.update(150,true);assert.deepEqual(life.manatees.map(m=>m.position.toArray()),positions);assert.deepEqual(life.meshes.map(m=>Array.from(m.instanceMatrix.array)),matrices);assert.equal(life.waveTime.value,clock);
    life.setQuality('low');assert.equal(life.meshes.find(m=>m.name==='manatee-barrel-bodies')!.count,2);assert.equal(life.meshes.find(m=>m.name==='meadow-hermit-crabs')!.count,7);assert.ok(life.meshes.filter(m=>m.name.startsWith('meadow-rooted-grass')).reduce((n,m)=>n+m.count,0)>2500);
    life.setQuality('high');assert.deepEqual(life.meshes.map(m=>m.geometry),geometries);assert.equal(life.meshes.length,17);
    const triangles=life.meshes.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3*m.count,0);assert.ok(triangles<160000,`Bounded complete meadow geometry: ${triangles}.`);
    assert.equal(SEAGRASS_MEADOW.x,-55);
  }finally{life.dispose();assert.equal(surfaceAnimals.length,before);}
});


test('surface plants and breathing follow the rendered wave clock while foraging keeps active time',()=>{
  const life=createSeagrassMeadow(),matrix=new Matrix4(),position=new Vector3();
  try{
    life.update(200,false,8);
    const swimmer=life.manatees[0],xz=[swimmer.position.x,swimmer.position.z],tail=swimmer.tail;
    assert.ok(swimmer.breath>.999,'This pose exercises a breathing animal at the surface.');
    for(const waterTime of[8,25,61]){
      life.update(200,false,waterTime);
      assert.deepEqual([swimmer.position.x,swimmer.position.z],xz);assert.equal(swimmer.tail,tail);assert.equal(swimmer.time,200);
      assert.ok(Math.abs(swimmer.position.y-harborWaterHeight(swimmer.position.x,swimmer.position.z,waterTime)+.16*swimmer.size)<1e-7);
      for(const mesh of life.meshes.filter(m=>['floating-algae-fronds','shoreline-lily-pads'].includes(m.name)))for(let i=0;i<mesh.count;i++){
        mesh.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);
        assert.ok(Math.abs(position.y-harborWaterHeight(position.x,position.z,waterTime)-.02)<.002,'Surface growth follows the same phase as the water mesh.');
      }
    }
    const before=life.meshes.map(m=>Array.from(m.instanceMatrix.array));life.update(230,true,200);
    assert.deepEqual(life.meshes.map(m=>Array.from(m.instanceMatrix.array)),before);
  }finally{life.dispose();}
});
