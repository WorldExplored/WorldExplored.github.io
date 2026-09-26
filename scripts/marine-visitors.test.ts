import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, InstancedMesh, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { createMarineVisitors } from '../src/components/world/MarineVisitors';
import { OCTOPUS_ROUTE, turtleHatchlingPose, turtleRouteClear, visitorClear } from '../src/components/world/marineVisitorState';
import { landDistance, terrainMeshHeight } from '../src/components/world/terrain';
import { marineFloorHeight, reefHabitatContains } from '../src/components/world/reefHabitat';
import { turtleCarapaceGeometry, turtlePlastronGeometry, turtleNestSandGeometry, turtleShellHeight } from '../src/components/world/turtleAnatomy';

test('stonefish and octopuses retain clear habitats and complete both reef crossings for ten minutes',()=>{
  const life=createMarineVisitors(),travel=life.states.map(()=>0),reefTravel=life.states.map(()=>0),openTravel=life.states.map(()=>0);
  let jetSlow=Infinity,jetFast=0;
  try{
    assert.deepEqual(['stonefish','octopus','turtle'].map(kind=>life.states.filter(state=>state.kind===kind).length),[2,2,3]);
    for(let frame=0;frame<12000;frame++){
      const before=life.states.map(state=>state.position.clone());life.update(.05);
      life.states.forEach((state,index)=>{
        const movement=Math.hypot(state.position.x-before[index].x,state.position.z-before[index].z);travel[index]+=movement;
        assert.ok(movement<.055,'horizontal motion stays continuous, including target changes');
        if(state.kind==='turtle')return;
        if(state.kind==='octopus'&&movement>.0001){
          jetSlow=Math.min(jetSlow,movement/.05);jetFast=Math.max(jetFast,movement/.05);
          if(reefHabitatContains(state.position.x,state.position.z))reefTravel[index]+=movement;else openTravel[index]+=movement;
          const tangent=Math.atan2(before[index].z-state.position.z,state.position.x-before[index].x);
          assert.ok(Math.abs(Math.atan2(Math.sin(state.heading-tangent),Math.cos(state.heading-tangent)))<.2);
        }
        if(frame%20)return;
        assert.ok(visitorClear(state.kind,state.position.x,state.position.z,state.kind==='octopus'?state.size*.85:.33));
        assert.ok(Math.abs(state.position.y-marineFloorHeight(state.position.x,state.position.z)-.075)<1e-6);
      });
    }
    life.states.forEach((state,index)=>{
      if(state.kind==='turtle')return;
      assert.ok(travel[index]>(state.kind==='octopus'?100:.3));
      if(state.kind==='octopus'){
        assert.ok(state.innerVisits>=1&&state.outerVisits>=1);
        assert.ok(reefTravel[index]>30&&openTravel[index]>60);
      }
    });
    assert.ok(jetFast>jetSlow*5,'octopus propulsion has a clear thrust and coast cadence');
    const snapshot=life.states.map(state=>[state.time,...state.position.toArray(),state.heading]);life.update(8,true);
    assert.deepEqual(life.states.map(state=>[state.time,...state.position.toArray(),state.heading]),snapshot);
  }finally{life.dispose();}
});

test('the entire octopus course clears coral, kelp and floor at the larger arm radius',()=>{
  let reefDistance=0,openDistance=0;
  for(let segment=1;segment<OCTOPUS_ROUTE.length;segment++){
    const [ax,az]=OCTOPUS_ROUTE[segment-1],[bx,bz]=OCTOPUS_ROUTE[segment];
    const length=Math.hypot(bx-ax,bz-az),steps=Math.ceil(length/.05);
    for(let step=0;step<=steps;step++){
      const t=step/steps,x=ax+(bx-ax)*t,z=az+(bz-az)*t;
      assert.ok(visitorClear('octopus',x,z,.74*.85));
      if(step<steps){if(reefHabitatContains(x,z))reefDistance+=length/steps;else openDistance+=length/steps;}
    }
  }
  assert.ok(reefDistance>20&&openDistance>30);
});

test('detailed animals and natural nests use shared geometry and release every resource',()=>{
  const life=createMarineVisitors(),meshes:Mesh[]=[];
  life.root.traverse(object=>{if(object instanceof Mesh)meshes.push(object);});
  const geometries=new Set(meshes.map(mesh=>mesh.geometry));
  const materials=new Set(meshes.flatMap(mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material]));
  let geometryDisposals=0,materialDisposals=0;
  geometries.forEach(geometry=>geometry.addEventListener('dispose',()=>{geometryDisposals++;}));
  materials.forEach(material=>material.addEventListener('dispose',()=>{materialDisposals++;}));
  try{
    const residentMeshes:Mesh[]=[];life.residents.root.traverse(object=>{if(object instanceof Mesh)residentMeshes.push(object);});
    assert.ok(meshes.length-residentMeshes.length<150,'hatchlings retain their existing batched draw budget');
    assert.equal(residentMeshes.length,10,'new residents, offshore whale and particles share ten draws');
    assert.ok(geometries.size<=42,'marine geometry remains shared across individual animals');
    for(const state of life.states){
      const animal=life.root.getObjectByName(`${state.kind}-${state.index}`)!;
      const size=new Box3().setFromObject(animal).getSize(new Vector3());
      assert.ok(size.x<1.7&&size.y<1.2&&size.z<1.5);
      if(state.kind==='octopus'){
        assert.equal(animal.children.filter(child=>child.name.startsWith('octopus-arm-')).length,8);
        assert.equal(animal.children.filter(child=>child.name==='inset-octopus-eye').length,2);
        assert.equal(animal.getObjectByName('octopus-eye-rim'),undefined);
        const mantle=(animal.getObjectByName('octopus-mantle') as Mesh).geometry;mantle.computeBoundingBox();
        const dimensions=mantle.boundingBox!.getSize(new Vector3());assert.ok(dimensions.x>dimensions.y*2.8);
      }
      if(state.kind==='turtle'){
        const nest=life.root.getObjectByName(`guarded-turtle-nest-${state.index}`)!;
        assert.ok(visitorClear('turtle',state.nest.x,state.nest.z,.44));
        for(const name of ['disturbed-nesting-sand','weathered-driftwood-fragments','dry-kelp-and-seagrass-wrack','scattered-broken-shells'])assert.ok(nest.getObjectByName(name));
        assert.equal(nest.getObjectByName('partly-buried-sand-rim'),undefined);
        const clutch=nest.getObjectByName('buried-round-turtle-eggs')!;
        assert.equal(clutch.children.length,6);
        const egg=clutch.children[0] as Mesh;egg.geometry.computeBoundingBox();const dimensions=egg.geometry.boundingBox!.getSize(new Vector3());
        assert.ok(Math.abs(dimensions.x-dimensions.y)<.004&&Math.abs(dimensions.z-dimensions.y)<.004,'turtle eggs are round, unlike elongated gull eggs');
        nest.updateMatrixWorld(true);const point=new Vector3();
        for(const object of nest.children){
          if(!(object instanceof Mesh))continue;const vertices=object.geometry.getAttribute('position');
          for(let i=0;i<vertices.count;i++){point.fromBufferAttribute(vertices,i).applyMatrix4(object.matrixWorld);const contact=point.y-terrainMeshHeight(point.x,point.z);assert.ok(contact>-.09&&contact<.10,'natural litter follows the beach grade');}
        }
      }
    }
    assert.equal((life.root.getObjectByName('shell-scutes') as Mesh).geometry.userData.plateCount,27);
    assert.equal((life.root.getObjectByName('turtle-hatchling-bodies') as InstancedMesh).count,18);
    assert.equal((life.root.getObjectByName('turtle-hatchling-paddling-flippers') as InstancedMesh).count,72);
    for(const tier of ['low','medium','high'] as const){life.setQuality(tier);assert.equal(life.root.children.filter(child=>child.name.startsWith('octopus-')&&child.visible).length,tier==='low'?1:2);}
  }finally{life.dispose();}
  assert.equal(geometryDisposals,geometries.size);assert.equal(materialDisposals,materials.size);
});

test('hour-long turtle lifecycle buries eggs, guards for 20–30 minutes, leaves, hatches later and sends every hatchling to sea',()=>{
  const life=createMarineVisitors(),point=new Vector3(),modes=new Set<string>();
  const turtles=life.states.filter(state=>state.kind==='turtle');
  const babySea=new Set<string>(),babyBeach=new Set<string>();
  try{
    for(const state of turtles){assert.ok(state.nursery!.guardSeconds>=1200&&state.nursery!.guardSeconds<=1800);assert.ok(state.nursery!.incubationSeconds>=600&&state.nursery!.incubationSeconds<=1200);}
    for(let seconds=0;seconds<=3600;seconds++){
      const before=turtles.map(state=>state.position.clone());life.seekTurtles(seconds);
      for(const [index,state] of turtles.entries()){
        const nursery=state.nursery!;modes.add(nursery.stage);
        assert.ok(state.position.distanceTo(before[index])<.25,'adult crawl and all stage boundaries remain continuous');
        assert.ok(state.position.y>=terrainMeshHeight(state.position.x,state.position.z));
        assert.ok(turtleRouteClear(state.position.x,state.position.z,.58),'adult clears actual rocks, trunks and structures');
        if(nursery.stage==='guarding'){
          assert.ok(state.position.distanceTo(state.home)<.01);
          assert.ok(Math.hypot(state.position.x-state.nest.x,state.position.z-state.nest.z)>1.2);
          assert.equal(nursery.eggsExposed,0,'guarded eggs stay buried');
        }
        for(let baby=0;baby<6;baby++){
          const pose=turtleHatchlingPose(state,baby,point);if(!pose.visible)continue;
          assert.ok(point.y>=terrainMeshHeight(point.x,point.z));
          assert.ok(turtleRouteClear(point.x,point.z,.14),'hatchling clears rocks and structures');
          if(landDistance(point.x,point.z)>.2)babyBeach.add(`${index}-${baby}`);
          if(landDistance(point.x,point.z)<-2.8)babySea.add(`${index}-${baby}`);
        }
      }
    }
    assert.deepEqual([...modes].sort(),['arriving','digging','guarding','hatching','incubating','leaving','resting-at-sea']);
    assert.equal(babyBeach.size,18);assert.equal(babySea.size,18,'every baby travels all the way into the sea');
  }finally{life.dispose();}
});

test('visible adult shells and flippers remain grounded through nesting and crawl phases',()=>{
  const life=createMarineVisitors(),point=new Vector3();
  try{
    for(const seconds of [0,120,155,170,190,260,1210,1270,1460,1650,1920]){
      life.seekTurtles(seconds);
      for(const state of life.states.filter(state=>state.kind==='turtle')){
        const animal=life.root.getObjectByName(`turtle-${state.index}`)!;if(!animal.visible||state.position.y<-.08)continue;animal.updateMatrixWorld(true);
        let lowest=Infinity;
        animal.traverse(object=>{
          if(!(object instanceof Mesh)||!['arched-sea-turtle-shell','pale-plastron','sea-turtle-head','four-swimming-flippers'].includes(object.name))return;
          const positions=object.geometry.getAttribute('position');for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);lowest=Math.min(lowest,point.y-terrainMeshHeight(point.x,point.z));}
        });
        assert.ok(lowest>-.035&&lowest<.11,`actual support meets sand (${state.index}, ${seconds}, ${lowest})`);
      }
    }
  }finally{life.dispose();}
});


test('nesting follows the uncapped active clock even when locomotion is rendering at 10 FPS',()=>{
  const life=createMarineVisitors();
  try{
    const turtle=life.states.find(state=>state.kind==='turtle'&&state.index===0)!;
    for(let frame=1;frame<12000;frame++)life.update(.1,false,frame/10);
    assert.equal(turtle.nursery!.stage,'guarding');
    assert.equal(turtle.time,1199.9);
    life.update(.1,false,1200);
    assert.equal(turtle.nursery!.stage,'leaving','a 20-minute guard finishes after 20 active minutes');
    life.update(.1,true,1800);assert.equal(turtle.time,1200,'hidden or reduced-motion scenes freeze the lifecycle');
  }finally{life.dispose();}
});


test('turtle shells are outward-facing, sealed to the plastron, with attached paddles and flush eyes',()=>{
  const material=new MeshStandardMaterial(),shell=turtleCarapaceGeometry(),belly=turtlePlastronGeometry(),soil=turtleNestSandGeometry();
  const life=createMarineVisitors();
  try{
    const upper=new Mesh(shell,material),lower=new Mesh(belly,material);upper.updateMatrixWorld();lower.updateMatrixWorld();
    assert.ok(new Raycaster(new Vector3(-.08,1,0),new Vector3(0,-1,0)).intersectObject(upper).length>0,'the actual front faces of the shell render from above');
    assert.ok(new Raycaster(new Vector3(-.08,-1,.04),new Vector3(0,1,0)).intersectObject(lower).length>0,'the underside faces outward');
    const shellRim=14*37+37,bellyRim=8*37;
    for(let i=0;i<=36;i++){
      const a=new Vector3().fromBufferAttribute(shell.attributes.position,shellRim+i),b=new Vector3().fromBufferAttribute(belly.attributes.position,bellyRim+i);
      assert.ok(a.distanceTo(b)<.003,'the carapace and plastron share the same perimeter');
    }
    const turtle=life.root.getObjectByName('turtle-0')!;
    for(const flipper of turtle.children.filter(object=>object.name==='four-swimming-flippers')){
      const q=((flipper.position.x+.08)/.65)**2+(flipper.position.z/.46)**2;
      assert.ok(q<.9&&flipper.position.y<turtleShellHeight(flipper.position.x,flipper.position.z),'every paddle root is inside the shell boundary');
      assert.ok(flipper.position.y>.119-.06*Math.sqrt(1-q),'paddles attach above the plastron');
    }
    const head=turtle.getObjectByName('sea-turtle-head') as Mesh,headMesh=new Mesh(head.geometry,material);headMesh.updateMatrixWorld();
    for(const eye of turtle.children.filter(object=>object.name==='turtle-eye')){
      const side=Math.sign(eye.position.z),origin=new Vector3(eye.position.x,eye.position.y,side);
      const hit=new Raycaster(origin,new Vector3(0,0,-side)).intersectObject(headMesh)[0];
      assert.ok(hit&&Math.abs(hit.point.z-eye.position.z)<.012,'tiny eyes meet the tapered head surface without stalks');
    }
    let low=Infinity,high=-Infinity;
    for(let i=0;i<soil.attributes.position.count;i++){low=Math.min(low,soil.attributes.position.getY(i));high=Math.max(high,soil.attributes.position.getY(i));}
    assert.ok(high-low<.03,'turtle nests are shallow disturbed sand, not a raised bird-nest ring');
    const sandMesh=new Mesh(soil,material);sandMesh.updateMatrixWorld();
    assert.ok(new Raycaster(new Vector3(.15,1,.1),new Vector3(0,-1,0)).intersectObject(sandMesh).length>0,'disturbed sand faces upward');
  }finally{life.dispose();shell.dispose();belly.dispose();soil.dispose();material.dispose();}
});

test('new marine residents forage with clear swept bodies, rests and distinct squid bursts',async()=>{
  const {createMarineResidentsState,stepMarineResidents,residentPositionClear}=await import('../src/components/world/marineResidentState');
  const states=createMarineResidentsState(),rested=new Set<string>(),moved=new Set<string>();let squidFast=0,squidSlow=Infinity;
  assert.deepEqual(['crawling-octopus','sea-snake','squid'].map(kind=>states.filter(s=>s.kind===kind).length),[4,3,5]);
  for(let frame=0;frame<3600;frame++){
    const before=states.map(s=>s.position.clone());stepMarineResidents(states,.05);
    states.forEach((state,index)=>{
      const distance=state.position.distanceTo(before[index]);assert.ok(distance<.10,'small continuous movement, even at target changes');
      if(state.moving&&distance>.0001){moved.add(`${state.kind}-${state.index}`);if(state.kind==='squid'){squidFast=Math.max(squidFast,distance/.05);squidSlow=Math.min(squidSlow,distance/.05);}}
      else rested.add(`${state.kind}-${state.index}`);
      if(frame%20===0){assert.ok(residentPositionClear(state.position.x,state.position.z,state.radius));assert.ok(state.position.y< -1.2,'residents stay below boat draft');}
    });
  }
  assert.equal(moved.size,12);assert.equal(rested.size,12);assert.ok(squidFast>squidSlow*4);
  const snapshot=states.map(s=>[...s.position.toArray(),s.time]);stepMarineResidents(states,10,true);assert.deepEqual(states.map(s=>[...s.position.toArray(),s.time]),snapshot);
});

test('rare whale stays beyond islands and vessel routes, breaches and breathes through reusable pools',async()=>{
  const {createMarineResidents}=await import('../src/components/world/MarineResidents');
  const {sampleOffshoreWhale,offshoreWhaleClear}=await import('../src/components/world/marineResidentState');
  const {createVesselRoute,surfaceAnimals,vesselOccupants}=await import('../src/components/world/marineTraffic');
  const routes=[0,1,2].map(createVesselRoute),point=new Vector3();let breaches=0;
  for(let time=0;time<1800;time+=3){
    const pose=sampleOffshoreWhale(time);if(pose.breaching)breaches++;
    for(let angle=0;angle<Math.PI*2;angle+=Math.PI/4)assert.ok(offshoreWhaleClear(pose.position.x+Math.cos(angle)*6,pose.position.z+Math.sin(angle)*6),'the complete animal stays in deep dark offshore water');
    for(const route of routes)for(let step=0;step<=100;step++){route.curve.getPointAt(step/100,point);assert.ok(Math.hypot(point.x-pose.position.x,point.z-pose.position.z)>25,'whale never crosses the boat routes');}
  }
  assert.ok(breaches>5&&breaches<16,'breaches occupy a small fraction of the offshore cycle');
  const count=surfaceAnimals.length,life=createMarineResidents(),geometry=life.spray.geometry,matrix=life.spray.instanceMatrix;
  try{
    assert.equal(surfaceAnimals.length,count+1);
    life.update(0,false,226);assert.ok(life.whale.visible&&life.whale.position.y>3);
    life.update(0,false,229.3);assert.ok(life.spray.count>60&&life.foam.visible,'large breach produces a pooled particle splash');
    life.update(0,false,62.8);assert.ok(life.spray.count>15&&!life.foam.visible,'blowhole produces its own mist plume');
    const before=life.whale.position.clone();life.update(15,true,400);assert.deepEqual(life.whale.position,before);
    vesselOccupants.push({position:life.whale.position.clone(),radius:3});life.update(0,false,62.8);assert.equal(life.whale.visible,false,'unexpected vessels suppress nearby surfacing');vesselOccupants.pop();
    for(const tier of ['low','medium','high']as const)life.setQuality(tier);
    assert.equal(life.spray.geometry,geometry);assert.equal(life.spray.instanceMatrix,matrix);
    const meshes:Mesh[]=[];life.root.traverse(object=>{if(object instanceof Mesh)meshes.push(object);});
    assert.equal(meshes.length,10,'twelve residents and whale use ten shared draws');
  }finally{life.dispose();}
  assert.equal(surfaceAnimals.length,count);
});

test('crabs have independent shell proportions, six colors and asymmetric claw forms',async()=>{
  const {crabVariation}=await import('../src/components/world/crabVariation');
  const traits=Array.from({length:15},(_,index)=>crabVariation(index));
  assert.equal(new Set(traits.map(t=>t.color)).size,6);
  assert.ok(Math.max(...traits.map(t=>t.size))/Math.min(...traits.map(t=>t.size))>1.5);
  assert.ok(Math.max(...traits.map(t=>t.width))-Math.min(...traits.map(t=>t.width))>.2);
  assert.ok(traits.some(t=>t.leftClaw/t.rightClaw>1.8));
  assert.deepEqual(crabVariation(4),crabVariation(4),'variation stays stable while animals move');
});
