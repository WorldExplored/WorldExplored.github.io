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
  let reefDistance=0,openDistance=0,innerDistance=0,outerDistance=0;
  for(let segment=1;segment<OCTOPUS_ROUTE.length;segment++){
    const [ax,az]=OCTOPUS_ROUTE[segment-1],[bx,bz]=OCTOPUS_ROUTE[segment];
    const length=Math.hypot(bx-ax,bz-az),steps=Math.ceil(length/.05);
    for(let step=0;step<=steps;step++){
      const t=step/steps,x=ax+(bx-ax)*t,z=az+(bz-az)*t;
      assert.ok(visitorClear('octopus',x,z,.74*.85));
      if(step<steps){
        if(reefHabitatContains(x,z)){
          reefDistance+=length/steps;
          if(x<11&&z>-32)innerDistance+=length/steps;
          if(x>16&&z<-45)outerDistance+=length/steps;
        }else openDistance+=length/steps;
      }
    }
  }
  assert.ok(reefDistance>12&&openDistance>30);
  assert.ok(innerDistance>3&&outerDistance>5,'the route still visits both reef shelves around the expanded city');
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
    assert.ok(geometries.size<=43,'marine geometry remains shared across individual animals');
    for(const state of life.states){
      const animal=life.root.getObjectByName(`${state.kind}-${state.index}`)!;
      const size=new Box3().setFromObject(animal).getSize(new Vector3());
      assert.ok(size.x<1.7&&size.y<1.2&&size.z<1.5);
      if(state.kind==='octopus'){
        assert.equal(animal.children.filter(child=>child.name.startsWith('octopus-arm-')).length,8);
        assert.equal(animal.children.filter(child=>child.name==='inset-octopus-eye').length,2);
        assert.equal(animal.getObjectByName('octopus-eye-rim'),undefined);
        const mantle=(animal.getObjectByName('octopus-mantle') as Mesh).geometry;mantle.computeBoundingBox();
        const dimensions=mantle.boundingBox!.getSize(new Vector3());assert.ok(dimensions.x>dimensions.y*1.7&&dimensions.x<dimensions.y*2.6);
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
  assert.deepEqual(['crawling-octopus','sea-snake','squid'].map(kind=>states.filter(s=>s.kind===kind).length),[4,1,5]);
  for(let frame=0;frame<3600;frame++){
    const before=states.map(s=>s.position.clone());stepMarineResidents(states,.05);
    states.forEach((state,index)=>{
      const distance=state.position.distanceTo(before[index]);assert.ok(distance<.10,'small continuous movement, even at target changes');
      if(state.moving&&distance>.0001){moved.add(`${state.kind}-${state.index}`);if(state.kind==='squid'){squidFast=Math.max(squidFast,distance/.05);squidSlow=Math.min(squidSlow,distance/.05);}}
      else rested.add(`${state.kind}-${state.index}`);
      if(frame%20===0){assert.ok(residentPositionClear(state.position.x,state.position.z,state.radius));assert.ok(state.position.y< -1.2,'residents stay below boat draft');}
    });
  }
  assert.equal(moved.size,10);assert.equal(rested.size,10);assert.ok(squidFast>squidSlow*4);
  const snapshot=states.map(s=>[...s.position.toArray(),s.time]);stepMarineResidents(states,10,true);assert.deepEqual(states.map(s=>[...s.position.toArray(),s.time]),snapshot);
});

test('rare whale stays beyond islands and vessel routes, breaches and breathes through reusable pools',async()=>{
  const {createMarineResidents}=await import('../src/components/world/MarineResidents');
  const {sampleOffshoreWhale,offshoreWhaleClear,WHALE_RADIUS}=await import('../src/components/world/marineResidentState');
  const {createVesselRoute,surfaceAnimals,vesselOccupants}=await import('../src/components/world/marineTraffic');
  const routes=[0,1,2].map(createVesselRoute),point=new Vector3();let breaches=0;
  for(let time=0;time<1800;time+=3){
    const pose=sampleOffshoreWhale(time);if(pose.breaching)breaches++;
    for(let angle=0;angle<Math.PI*2;angle+=Math.PI/4)assert.ok(offshoreWhaleClear(pose.position.x+Math.cos(angle)*WHALE_RADIUS,pose.position.z+Math.sin(angle)*WHALE_RADIUS),'the complete animal stays in deep dark offshore water');
    for(const route of routes)for(let step=0;step<=100;step++){route.curve.getPointAt(step/100,point);if(pose.visible)assert.ok(Math.hypot(point.x-pose.position.x,point.z-pose.position.z)>25,'the complete whale only surfaces clear of the outbound shipping lane');}
  }
  assert.ok(breaches>=3&&breaches<9,'breaches occupy a small fraction of the offshore cycle');
  const count=surfaceAnimals.length,life=createMarineResidents(),geometry=life.spray.geometry,matrix=life.spray.instanceMatrix;
  try{
    assert.equal(surfaceAnimals.length,count+1);
    life.update(0,false,223.85);assert.ok(life.whale.visible&&life.whale.position.y>3);
    life.update(0,false,225.7);assert.ok(life.spray.count>60&&life.foam.visible,'large breach produces a pooled particle splash');
    life.update(0,false,62.8);assert.ok(life.spray.count>15&&!life.foam.visible,'blowhole produces its own mist plume');
    assert.ok(life.spray.renderOrder>3&&life.foam.renderOrder>3,'surface particles remain visible above the transparent ocean');
    const before=life.whale.position.clone();life.update(15,true,400);assert.deepEqual(life.whale.position,before);
    vesselOccupants.push({position:life.whale.position.clone(),radius:3});life.update(0,false,62.8);assert.equal(life.whale.visible,false,'unexpected vessels suppress nearby surfacing');vesselOccupants.pop();
    for(const tier of ['low','medium','high']as const)life.setQuality(tier);
    assert.equal(life.spray.geometry,geometry);assert.equal(life.spray.instanceMatrix,matrix);
    const meshes:Mesh[]=[];life.root.traverse(object=>{if(object instanceof Mesh)meshes.push(object);});
    assert.equal(meshes.length,10,'ten residents and whale use ten shared draws');
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


test('turtles vary local shell and paddle proportions while keeping their shared anatomy sealed',()=>{
  const life=createMarineVisitors();
  try{
    const shells:Mesh[]=[],widths:number[]=[],paddles:number[]=[];
    for(let i=0;i<3;i++){
      const animal=life.root.getObjectByName(`turtle-${i}`)!;
      const shell=animal.getObjectByName('arched-sea-turtle-shell') as Mesh,belly=animal.getObjectByName('pale-plastron') as Mesh;
      const scutes=animal.getObjectByName('shell-scutes') as Mesh;
      shells.push(shell);widths.push(shell.scale.z);
      assert.equal(shell.scale.z,belly.scale.z);assert.equal(shell.scale.z,scutes.scale.z);
      const limbs=animal.children.filter(limb=>limb.name==='four-swimming-flippers');
      for(const limb of limbs){
        const q=((limb.position.x+.08)/.65)**2+(limb.position.z/(.46*shell.scale.z))**2;
        assert.ok(q<.9,'all varied flippers keep their roots beneath the shell');
      }
      paddles.push(Math.abs(limbs[0].scale.z));
    }
    assert.equal(new Set(shells.map(shell=>(shell.material as MeshStandardMaterial).color.getHex())).size,3);
    assert.equal(new Set(widths).size,3);assert.equal(new Set(paddles).size,3);
    assert.equal(new Set(shells.map(shell=>shell.geometry)).size,1,'variation reuses the complete sealed shell');
  }finally{life.dispose();}
});

test('one scarce sea snake swims above the floor in bursts, coast, then pause with restrained axial motion',async()=>{
  const {createMarineResidents}=await import('../src/components/world/MarineResidents');
  const life=createMarineResidents(),snakes=life.states.filter(state=>state.kind==='sea-snake');
  const records=snakes.map(()=>({burst:0,coast:0,rest:0,fast:0,slow:Infinity}));
  try{
    assert.equal(snakes.length,1);
    for(let frame=0;frame<6000;frame++){
      const before=snakes.map(s=>s.position.clone());life.update(.05);
      snakes.forEach((state,i)=>{
        const r=records[i],speed=Math.hypot(state.position.x-before[i].x,state.position.z-before[i].z)/.05;
        assert.ok(state.position.y>marineFloorHeight(state.position.x,state.position.z)+.45,'the whole snake swims clear of the floor');
        assert.ok(state.position.y<-1.4,'it remains below boat hulls');
        if(!state.moving)r.rest++;else if(state.jet>.6){r.burst++;r.fast=Math.max(r.fast,speed);}else if(state.jet<.03&&speed>.015){r.coast++;r.slow=Math.min(r.slow,speed);}
      });
    }
    for(const r of records){assert.ok(r.burst>40&&r.coast>40&&r.rest>100);assert.ok(r.fast>r.slow*3);}
    const bodies=life.root.getObjectByName('banded-sea-snakes') as InstancedMesh;
    assert.equal(bodies.geometry.getAttribute('aStroke').count,1);assert.equal(bodies.geometry.getAttribute('aPropulsion').count,1);
    const geometry=bodies.geometry;for(const tier of ['low','medium','high']as const)life.setQuality(tier);assert.equal(bodies.geometry,geometry);
  }finally{life.dispose();}
});

test('whale anatomy has a broad head, long pectorals, horizontal notched flukes and a conservative body envelope',async()=>{
  const {createMarineResidents}=await import('../src/components/world/MarineResidents');
  const {WHALE_RADIUS}=await import('../src/components/world/marineResidentState');
  const life=createMarineResidents(),point=new Vector3();
  try{
    life.whale.position.set(0,0,0);life.whale.rotation.set(0,0,0);life.whale.updateMatrixWorld(true);
    const body=life.whale.getObjectByName('humpback-streamlined-body') as Mesh;
    const vertices=body.geometry.getAttribute('position');let headWidth=0,headHeight=0;
    for(let i=0;i<vertices.count;i++)if(vertices.getX(i)>2.6&&vertices.getX(i)<2.9){headWidth=Math.max(headWidth,Math.abs(vertices.getZ(i)));headHeight=Math.max(headHeight,Math.abs(vertices.getY(i)));}
    assert.ok(headWidth>headHeight*1.25,'rostrum stays broad and flattened instead of a pointed fish snout');
    const fin=life.whale.getObjectByName('whale-left-pectoral') as Mesh;fin.geometry.computeBoundingBox();
    assert.ok(fin.geometry.boundingBox!.max.z>3,'long pectoral fins distinguish the humpback');
    const fluke=life.whale.getObjectByName('whale-horizontal-flukes') as Mesh;fluke.geometry.computeBoundingBox();
    const span=fluke.geometry.boundingBox!.getSize(new Vector3());assert.ok(span.z>4.5&&span.y<.3);
    life.whale.traverse(object=>{if(object instanceof Mesh){const p=object.geometry.getAttribute('position');for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(object.matrixWorld);assert.ok(point.length()<WHALE_RADIUS,'every body, flipper and fluke vertex fits the collision sphere');}}});
  }finally{life.dispose();}
});

test('offshore breaches accelerate downward under gravity and roam every side of the islands',async()=>{
  const {sampleOffshoreWhale,WHALE_BREACH_AT,WHALE_GRAVITY,whaleRoutePoint,whaleLaneClearance,WHALE_RADIUS}=await import('../src/components/world/marineResidentState');
  const quadrants=new Set<string>(),events:Vector3[]=[];
  for(let time=0;time<3600;time+=7){const p=whaleRoutePoint(time);quadrants.add(`${p.x>-25}:${p.z>-40}`);const pose=sampleOffshoreWhale(time);if(pose.visible)assert.ok(whaleLaneClearance(p.x,p.z)>WHALE_RADIUS+20);}
  assert.equal(quadrants.size,4);
  for(let cycle=0;cycle<6;cycle++){const t=cycle*600+WHALE_BREACH_AT+(cycle%3)*31+1.85;events.push(sampleOffshoreWhale(t).position);}
  for(let i=1;i<events.length;i++)assert.ok(events[i].distanceTo(events[i-1])>100,'successive breaches are not anchored to one patch of water');
  const h=.01;
  for(let age=.1;age<4.3;age+=.1){const t=WHALE_BREACH_AT+age,a=sampleOffshoreWhale(t-h),b=sampleOffshoreWhale(t),c=sampleOffshoreWhale(t+h);assert.ok(Math.abs((c.position.y-2*b.position.y+a.position.y)/(h*h)+WHALE_GRAVITY)<1e-5);}
});

test('cephalopods have species-specific limbs and independent mantle, arm and skin variation',async()=>{
  const {createMarineResidents,OCTOPUS_VARIATIONS,SQUID_VARIATIONS}=await import('../src/components/world/MarineResidents');
  const life=createMarineResidents();
  try{
    for(const variations of [OCTOPUS_VARIATIONS,SQUID_VARIATIONS]){
      assert.equal(new Set(variations.map(v=>v.color)).size,variations.length);
      assert.equal(new Set(variations.map(v=>v.arms)).size,variations.length);
      assert.equal(new Set(variations.map(v=>v.mantle.join(','))).size,variations.length);
    }
    const squid=life.root.getObjectByName('reef-darting-squid') as InstancedMesh;
    assert.equal(squid.geometry.userData.armCount,8);assert.equal(squid.geometry.userData.feedingTentacles,2);
    assert.equal(squid.geometry.getAttribute('aMorph').count,5);
    const body=life.root.getObjectByName('resident-octopus-bodies') as InstancedMesh;
    assert.equal(body.geometry.getAttribute('aMorph').count,4);assert.equal(body.geometry.getAttribute('aPattern').count,4);
    const snake=life.states.find(state=>state.kind==='sea-snake')!;assert.ok(snake.size>1,'the one scarce snake has a readable two-metre body');
    for(const state of life.states)if(state.kind==='squid')assert.ok(state.radius>=state.size*1.3,'elongated squid tentacles participate in route clearance');
  }finally{life.dispose();}
});
