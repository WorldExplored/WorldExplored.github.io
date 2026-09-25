import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, Vector3 } from 'three';
import { createMarineVisitors } from '../src/components/world/MarineVisitors';
import { OCTOPUS_ROUTE, visitorClear } from '../src/components/world/marineVisitorState';
import { landDistance, terrainMeshHeight } from '../src/components/world/terrain';
import { marineFloorHeight, reefHabitatContains } from '../src/components/world/reefHabitat';

test('stonefish, octopuses and nesting turtles retain clear, bounded habitats for a complete ten-minute cycle',()=>{
  const life=createMarineVisitors();
  const initial=life.states.map(state=>state.position.clone());
  const travel=life.states.map(()=>0);
  const reefTravel=life.states.map(()=>0),openTravel=life.states.map(()=>0);
  try{
    assert.equal(life.states.filter(state=>state.kind==='stonefish').length,2);
    assert.equal(life.states.filter(state=>state.kind==='octopus').length,2);
    assert.equal(life.states.filter(state=>state.kind==='turtle').length,3);
    for(let frame=0;frame<12000;frame++){
      const before=life.states.map(state=>state.position.clone());
      life.update(.05);
      life.states.forEach((state,index)=>{
        const movement=Math.hypot(state.position.x-before[index].x,state.position.z-before[index].z);travel[index]+=movement;
        assert.ok(movement<.035,'horizontal motion is continuous, including target changes');
        if(state.kind==='octopus'&&movement>.0001){
          if(reefHabitatContains(state.position.x,state.position.z))reefTravel[index]+=movement;else openTravel[index]+=movement;
          const tangent=Math.atan2(before[index].z-state.position.z,state.position.x-before[index].x);
          assert.ok(Math.abs(Math.atan2(Math.sin(state.heading-tangent),Math.cos(state.heading-tangent)))<.2,'mantle faces its travel tangent');
        }
        if(frame%20)return;
        const radius=state.kind==='octopus'?state.size*.85:state.kind==='stonefish'?.33:.58;
        assert.ok(visitorClear(state.kind,state.position.x,state.position.z,radius),`${state.kind} remains clear`);
        if(state.kind==='turtle'){
          assert.ok(landDistance(state.position.x,state.position.z)>.75+radius);
          assert.ok(state.position.distanceTo(state.home)<2.3,'nest remains guarded');
          assert.ok(Math.abs(state.position.y-terrainMeshHeight(state.position.x,state.position.z)-.005)<1e-6);
          assert.ok(Math.hypot(state.position.x-state.nest.x,state.position.z-state.nest.z)>1.01,'guardian never steps onto eggs');
        }else{
          assert.ok(Math.abs(state.position.y-marineFloorHeight(state.position.x,state.position.z)-.075)<1e-6);
        }
      });
    }
    life.states.forEach((state,index)=>{
      assert.ok(travel[index]>(state.kind==='octopus'?100:state.kind==='stonefish'?.3:.2),`${state.kind} actually relocates`);
      if(state.kind==='octopus'){
        assert.ok(state.innerVisits>=1&&state.outerVisits>=1,'octopus reaches both far ends of the reef route');
        assert.ok(reefTravel[index]>30&&openTravel[index]>60,'octopus crosses both reef shelves and their open-water passage');
        assert.ok(Math.abs(initial[index].z-(state.index%2?-56:-25))<.001);
      }
    });
    const snapshot=life.states.map(state=>[state.time,...state.position.toArray(),state.heading]);
    life.update(8,true);
    assert.deepEqual(life.states.map(state=>[state.time,...state.position.toArray(),state.heading]),snapshot,'pause freezes every visitor');
  }finally{life.dispose();}
});

test('the complete coarse octopus route clears coral, kelp and floor at the larger arm radius',()=>{
  let reefDistance=0,openDistance=0;
  for(let segment=1;segment<OCTOPUS_ROUTE.length;segment++){
    const [ax,az]=OCTOPUS_ROUTE[segment-1],[bx,bz]=OCTOPUS_ROUTE[segment];
    const length=Math.hypot(bx-ax,bz-az),steps=Math.ceil(length/.05);
    for(let step=0;step<=steps;step++){
      const t=step/steps,x=ax+(bx-ax)*t,z=az+(bz-az)*t;
      assert.ok(visitorClear('octopus',x,z,.74*.85),`octopus swept arm clears ${x},${z}`);
      if(step<steps){if(reefHabitatContains(x,z))reefDistance+=length/steps;else openDistance+=length/steps;}
    }
  }
  assert.ok(reefDistance>20&&openDistance>30,'course enters both reef shelves and crosses the intervening sea');
  assert.ok(OCTOPUS_ROUTE[0][1]>-26&&OCTOPUS_ROUTE.at(-1)![1]<-55,'both exits are far apart');
});

test('recognizable anatomy, nest eggs, quality tiers and shared resources',()=>{
  const life=createMarineVisitors();
  const meshes:Mesh[]=[];
  life.root.traverse(object=>{if(object instanceof Mesh)meshes.push(object);});
  const geometries=new Set(meshes.map(mesh=>mesh.geometry));
  const materials=new Set(meshes.flatMap(mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material]));
  let disposals=0;
  let materialDisposals=0;
  geometries.forEach(geometry=>geometry.addEventListener('dispose',()=>{disposals++;}));
  materials.forEach(material=>material.addEventListener('dispose',()=>{materialDisposals++;}));
  try{
    assert.ok(meshes.length<150);
    assert.ok(geometries.size<25,'repeated animals reuse geometry');
    for(const state of life.states){
      const animal=life.root.getObjectByName(`${state.kind}-${state.index}`)!;
      const size=new Box3().setFromObject(animal).getSize(new Vector3());
      assert.ok(size.x<1.7&&size.y<1.2&&size.z<1.5,'anatomy remains at wildlife scale');
      if(state.kind==='octopus')assert.equal(animal.children.filter(child=>child.name.startsWith('octopus-arm-')).length,8);
      if(state.kind==='turtle'){
        const nest=life.root.getObjectByName(`guarded-turtle-nest-${state.index}`)!;
        nest.updateMatrixWorld(true);
        assert.equal(nest.children.filter(child=>child.name==='small-turtle-egg').length,5);
        assert.ok(Math.hypot(state.nest.x-state.home.x,state.nest.z-state.home.z)>1.2,'clutch sits beside the resting turtle');
        assert.ok(visitorClear('turtle',state.nest.x,state.nest.z,.44),'nest patch clears the entire rim');
        assert.ok(Math.abs(nest.position.y-terrainMeshHeight(state.nest.x,state.nest.z)+.025)<1e-6);
        const rim=nest.getObjectByName('partly-buried-sand-rim') as Mesh;
        const rimBox=new Box3().setFromObject(rim),floor=terrainMeshHeight(state.nest.x,state.nest.z);
        assert.ok(rimBox.min.y<floor&&rimBox.max.y<floor+.035,'sand rim is partly buried');
        for(const child of nest.children.filter(child=>child.name==='small-turtle-egg')){
          const eggBox=new Box3().setFromObject(child);
          assert.ok(eggBox.max.y>floor+.14,'eggs rise visibly above the sand');
        }
        animal.traverse(child=>{if(child instanceof Mesh)assert.ok(child.castShadow,'shell and flippers cast actual sun shadows');});
      }
    }
    const scutes=life.root.getObjectByName('shell-scutes') as Mesh;
    assert.equal(scutes.geometry.userData.plateCount,7,'connected hexagonal scutes replace isolated dots');
    const scuteNormals=scutes.geometry.getAttribute('normal');
    for(let i=0;i<scuteNormals.count;i++)assert.ok(scuteNormals.getY(i)>.85,'shell plates face upward along the dome');
    const arm=life.root.getObjectByName('tapered-tendril') as Mesh;
    const vertices=arm.geometry.getAttribute('position'),ring=7;
    const radiusAt=(start:number,cx:number,cy:number,cz:number)=>Math.max(...Array.from({length:ring},(_,i)=>Math.hypot(vertices.getX(start+i)-cx,vertices.getY(start+i)-cy,vertices.getZ(start+i)-cz)));
    assert.ok(radiusAt(vertices.count-ring,.48,.12,.31)<radiusAt(0,.12,.07,0)*.25,'eight arms taper into curled tips');
    life.setQuality('low');assert.equal(life.root.children.filter(child=>child.name.includes('octopus-')&&child.visible).length,1);
    life.setQuality('medium');assert.equal(life.root.children.filter(child=>child.name.includes('octopus-')&&child.visible).length,2);
    life.setQuality('high');assert.equal(life.root.children.filter(child=>child.name.includes('octopus-')&&child.visible).length,2);
  }finally{life.dispose();}
  assert.equal(disposals,geometries.size,'all shared geometries are released once');
  assert.ok(materials.size<17);
  assert.equal(materialDisposals,materials.size,'all shared materials are released once');
});

test('turtle shells and flippers follow the beach grade and retain a tight contact shadow',()=>{
  const life=createMarineVisitors(),point=new Vector3();
  try{
    for(let phase=0;phase<5;phase++){
      for(let frame=0;frame<1200;frame++)life.update(.05);
      for(const state of life.states.filter(state=>state.kind==='turtle')){
        const animal=life.root.getObjectByName(`turtle-${state.index}`)!;animal.updateMatrixWorld(true);
        let lowest=Infinity;
        animal.traverse(object=>{
          if(!(object instanceof Mesh)||!['arched-sea-turtle-shell','pale-plastron','sea-turtle-head','four-swimming-flippers'].includes(object.name))return;
          const positions=object.geometry.getAttribute('position');
          for(let i=0;i<positions.count;i++){
            point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);
            lowest=Math.min(lowest,point.y-terrainMeshHeight(point.x,point.z));
          }
        });
        assert.ok(lowest>-.025&&lowest<.08,`actual turtle support touches sand (${lowest})`);
      }
      for(const shadow of life.root.children.filter(child=>child.name==='turtle-contact-shadow')){
        const floor=terrainMeshHeight(shadow.position.x,shadow.position.z);
        assert.ok(shadow.position.y>floor&&shadow.position.y<floor+.025);
      }
    }
  }finally{life.dispose();}
});
