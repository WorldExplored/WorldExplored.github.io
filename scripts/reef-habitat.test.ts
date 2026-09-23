import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMesh, Mesh, Vector3, MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from 'three';
import { createCityFerryRoute } from '../src/components/world/cityInfrastructure';
import { getReefHabitat, reefFloorHeight, reefFloorVertexHeight, reefHabitatContains, reefFerryClearance, reefRockMesh, reefRockSurfaceHeight, marineFloorHeight, KELP_TOP, KELP_POCKET } from '../src/components/world/reefHabitat';
import { createReefContactShade, createReefHabitat, reefCoralGeometry, reefSeafloorGeometry } from '../src/components/world/ReefHabitatScene';
import { createForestKelpGeometry } from '../src/components/world/Seaweed';
import { reefFishPositionClear } from '../src/components/world/reefFishState';
import { landDistance, terrainBaseHeight, islandAt } from '../src/components/world/terrain';

test('connected large limestone ridges carry mixed coral growth and continue safely beneath the ferry',()=>{
  const plan=getReefHabitat();assert.equal(plan,getReefHabitat());
  let area=0;for(let x=-40;x<40;x+=.5)for(let z=-65;z<-20;z+=.5)if(reefHabitatContains(x,z))area+=.25;
  assert.ok(area>1200,`${area} square meters`);
  const large=plan.rocks.filter(rock=>rock.radius>2.7);
  assert.ok(large.length>=20,'substantial geological masses, not scattered pebbles');
  assert.ok(large.every(rock=>plan.rocks.some(other=>other!==rock&&Math.hypot(rock.x-other.x,rock.z-other.z)<(rock.radius+other.radius)*.85)),'ridge outcrops overlap into connected structures');
  assert.ok(Math.max(...plan.rocks.map(r=>r.height))>3,'metres of relief above the canyon floor');
  const beneathRoute=plan.rocks.filter(rock=>reefFerryClearance(rock.x,rock.z)<rock.radius+2);
  assert.ok(beneathRoute.length>6,'the middle remains a deep reef instead of a cleared strip');
  const route=createCityFerryRoute();const ferry=Array.from({length:1200},(_,i)=>route.curve.getPointAt(i/1200));
  for(const entry of [...plan.colonies,...plan.rocks]) {
    assert.ok(entry.height>0&&entry.radius>0);
    assert.ok(entry.y+entry.height<-1.8,'all physical formations remain under the shallow dolphin layer and ferry hull');
    const horizontal=Math.min(...ferry.map(p=>Math.hypot(p.x-entry.x,p.z-entry.z)));
    if(horizontal<entry.radius+1.2)assert.ok(entry.y+entry.height<-1.8,'depth clearance where ferry crosses reef');
  }
  for(const colony of plan.colonies) {
    const surface=Math.max(...plan.rocks.map(rock=>reefRockSurfaceHeight(rock,colony.x,colony.z)));
    assert.ok(Number.isFinite(surface));assert.ok(Math.abs(colony.y-(surface-.055))<1e-7,'coral grows directly on a rendered ledge');
  }
  assert.equal(new Set(plan.colonies.map(c=>c.form)).size,8);
  for(let patch=0;patch<6;patch++) {
    const local=plan.colonies.filter(c=>c.patch===patch);
    assert.ok(new Set(local.map(c=>c.color)).size>=8,'colors are mixed within every ridge');
    assert.ok(new Set(local.map(c=>c.form)).size>=7,'each ridge contains varied growth habits');
  }
});

test('rock collision cylinders bound every mesh vertex and ledge sampling matches rendered triangles',()=>{
  for(const rock of getReefHabitat().rocks) {
    const {positions:p}=reefRockMesh(rock.form),c=Math.cos(rock.rotation),s=Math.sin(rock.rotation);
    for(let i=0;i<p.length;i+=3){
      assert.ok(Math.hypot(p[i],p[i+2])<=1.00001);assert.ok(p[i+1]>=0&&p[i+1]<=1.00001);
      const x=rock.x+rock.radius*(c*p[i]+s*p[i+2]),z=rock.z+rock.radius*(-s*p[i]+c*p[i+2]);
      assert.ok(Math.abs(reefRockSurfaceHeight(rock,x,z)-(rock.y+p[i+1]*rock.height))<.00001);
    }
  }
});

test('rock silhouettes include broad shelves, split crowns, narrow buttresses and jagged peaks',()=>{
  const shape=(form:number)=>({x:0,y:0,z:0,radius:1,height:1,rotation:0,form,color:0,patch:0});
  const shelf=shape(0),crag=shape(1),buttress=reefRockMesh(2),peak=reefRockMesh(3);
  assert.ok(reefRockSurfaceHeight(shelf,.38,0)>.9,'shelf has an expansive flat crown');
  assert.ok(reefRockSurfaceHeight(crag,.25,0)>reefRockSurfaceHeight(crag,0,0)+.35,'split crag rises on either side of its saddle');
  const xs=buttress.positions.filter((_,i)=>i%3===0),zs=buttress.positions.filter((_,i)=>i%3===2);
  assert.ok((Math.max(...xs)-Math.min(...xs))/(Math.max(...zs)-Math.min(...zs))>2,'buttress has a long, narrow footprint');
  const crown=peak.positions.filter((_,i)=>i%3===1).slice(1,21);
  assert.ok(Math.max(...crown)-Math.min(...crown)>.3,'jagged crown has distinct peaks and clefts');
  const large=getReefHabitat().rocks.filter(r=>r.radius>2.7),ratios=large.map(r=>r.height/r.radius);
  assert.ok(Math.max(...ratios)>Math.min(...ratios)*2.7,'large structures vary substantially in proportions');
});

test('a continuous textured floor covers the complete channel and remains below the old shelf edge',()=>{
  for(let x=-40;x<=40;x+=.25)for(let z=-65;z<=-20;z+=.25) {
    const distance=landDistance(x,z),floor=reefFloorHeight(x,z);assert.ok(Number.isFinite(floor));
    if(distance> -6.9)assert.ok(floor<terrainBaseHeight(x,z)-.17);
    if(reefHabitatContains(x,z))assert.ok(floor<-2.7);
  }
  const geometry=reefSeafloorGeometry();geometry.computeBoundingBox();
  assert.ok(geometry.boundingBox!.containsPoint(new Vector3(-30,-5,-58)));
  assert.equal(geometry.getAttribute('uv').count,geometry.getAttribute('position').count);
  const p=geometry.getAttribute('position'),tri=geometry.index!;
  for(let i=0;i<tri.count;i+=3){const a=tri.getX(i),b=tri.getX(i+1),c=tri.getX(i+2);assert.ok((p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a))-(p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a))>0,'upward floor faces');}
  geometry.dispose();
});

test('eight coral forms and retained structural coverage fit a finite shared geometry budget',()=>{
  const forms=Array.from({length:8},(_,i)=>reefCoralGeometry(i));assert.equal(new Set(forms.map(g=>g.userData.form)).size,8);forms.forEach(g=>g.dispose());
  const habitat=createReefHabitat();let triangles=0,draws=0;
  try {
    habitat.root.traverse(object=>{
      if(!(object instanceof Mesh))return;
      draws++;for(const value of object.geometry.getAttribute('position').array)assert.ok(Number.isFinite(value));
      triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3*(object instanceof InstancedMesh?object.count:1);
    });
    assert.equal(draws,19);assert.ok(triangles<1500000,`${triangles} triangles`);
    const batches=habitat.root.children.filter(child=>child instanceof InstancedMesh&&child.name!=='reef-soft-contact-shading') as InstancedMesh[];
    const high=batches.map(batch=>batch.count);
    for(const tier of ['low','medium','high'] as const){
      habitat.setQuality(tier);batches.forEach((batch,i)=>{assert.equal(batch.count,Math.ceil(high[i]*(batch.name.startsWith('reef-weathered-')||tier==='high'?1:tier==='medium'?.76:.52)));assert.ok(batch.count>0);});
      const contact=habitat.root.getObjectByName('reef-soft-contact-shading') as InstancedMesh;
      let visible=0;for(let i=0;i<contact.count;i++){const values=contact.instanceMatrix.array;if(Math.hypot(values[i*16],values[i*16+1],values[i*16+2])>0)visible++;}
      assert.equal(visible,batches.filter(batch=>batch.name.startsWith('reef-colony-')||batch.name.startsWith('reef-weathered-')).reduce((sum,batch)=>sum+batch.count,0),'hidden colonies leave no contact shadows');
    }
  } finally {habitat.dispose();}
});

test('contact shading is a single finite terrain-conforming batch below the reef',()=>{
  const plan=getReefHabitat(),entries=[...plan.rocks,...plan.colonies],contact=createReefContactShade(entries);
  try{
    assert.equal(contact.mesh.count,entries.length);assert.equal(contact.material.depthWrite,false);assert.ok(contact.material.opacity<=.25);
    for(const name of ['contactA','contactB','contactC','contactD']) {
      const attribute=contact.geometry.getAttribute(name);assert.equal(attribute.count,entries.length);
      for(const value of attribute.array){assert.ok(Number.isFinite(value));assert.ok(value< -2.3);}
    }
  }finally{contact.geometry.dispose();contact.material.dispose();contact.mesh.dispose();}
});


test('lighthouse triangle has grounded rock belts, coral and seaweed across both western arms',()=>{
  const plan=getReefHabitat();
  for(const zone of [{x:-57,z:-48,r:14},{x:-52,z:-28,r:14},{x:-68,z:-38,r:12}]) {
    const rocks=plan.rocks.filter(rock=>Math.hypot(rock.x-zone.x,rock.z-zone.z)<zone.r);
    assert.ok(rocks.length>=12,`substantial structures near ${zone.x},${zone.z}`);
    assert.ok(rocks.filter(rock=>rock.radius>3.5).length>=3);
    assert.ok(plan.colonies.filter(c=>Math.hypot(c.x-zone.x,c.z-zone.z)<zone.r).length>80);
    assert.ok(plan.plants.filter(c=>Math.hypot(c.x-zone.x,c.z-zone.z)<zone.r).length>40);
  }
  for(const rock of plan.rocks) {
    const rendered=rock.patch>=200?marineFloorHeight(rock.x,rock.z):reefFloorHeight(rock.x,rock.z);
    assert.ok(rock.y<rendered&&rendered-rock.y<2.5,'each rock base is embedded in the actual rendered floor');
    const p=reefRockMesh(rock.form).positions,c=Math.cos(rock.rotation),s=Math.sin(rock.rotation);
    for(let i=0;i<p.length;i+=3)if(p[i+1]===0){
      const x=rock.x+rock.radius*(c*p[i]+s*p[i+2]),z=rock.z+rock.radius*(-s*p[i]+c*p[i+2]);
      assert.ok(rock.y<(rock.patch>=200?marineFloorHeight(x,z):reefFloorHeight(x,z)),'no perimeter vertex floats above a sloping canyon floor');
    }
  }
  const geometry=reefSeafloorGeometry(),position=geometry.getAttribute('position');
  for(let i=0;i<position.count;i++)assert.ok(Math.abs(position.getY(i)-reefFloorVertexHeight(position.getX(i),position.getZ(i)))<.00001);
  geometry.dispose();
  assert.ok(reefFloorHeight(-53,-39)>-8,'western shelf remains visible rather than dropping into deep offshore water');
  assert.ok(reefFloorHeight(-110,-120)<-20,'open ocean still deepens outside the archipelago');
});


test('short seagrass pockets and outliers grow on open canyon floors in all reef basins',()=>{
  const plan=getReefHabitat(),meadows=plan.plants.filter(plant=>plant.patch>=100);
  assert.ok(meadows.length>450);
  for(let basin=0;basin<4;basin++)assert.ok(meadows.filter(plant=>plant.patch===100+basin).length>60);
  for(const plant of meadows){
    assert.ok(Math.abs(plant.y-reefFloorHeight(plant.x,plant.z)+.035)<1e-8);
    assert.ok(plant.height<=.65,'short grass leaves room for reef fish above the beds');
    for(const rock of plan.rocks)assert.ok(reefRockSurfaceHeight(rock,plant.x,plant.z)<=plant.y+.14);
  }
});


test('shoal mineral talus has low slate, chips and boulders with mixed gray albedos',()=>{
  const rocks=getReefHabitat().rocks.filter(rock=>rock.patch>=200);
  assert.ok(rocks.length>=300);
  assert.ok(rocks.filter(rock=>rock.radius<.35).length>60);
  assert.ok(rocks.filter(rock=>rock.radius>.65&&rock.height>.45).length>15);
  assert.ok(rocks.filter(rock=>(rock.y+rock.height-marineFloorHeight(rock.x,rock.z))/rock.radius<.65).length>130,'low plates contrast with the tall canyon ridges');
  assert.equal(new Set(rocks.map(rock=>islandAt(rock.x,rock.z).island.id)).size,7);
  const habitat=createReefHabitat();
  try {
    const colors=new Set<string>();
    habitat.root.traverse(object=>{if(object instanceof InstancedMesh&&object.name.startsWith('reef-weathered-')){
      assert.ok(object.instanceColor);
      for(let i=0;i<object.count;i++)colors.add([object.instanceColor!.getX(i),object.instanceColor!.getY(i),object.instanceColor!.getZ(i)].join(','));
    }});
    assert.ok(colors.size>=6,'warm limestone, neutral stone and cool slate coexist in each shared rock batch');
  }finally{habitat.dispose();}
});

test('kelp forest roots in the deeper pocket, stays submerged through sway and pauses at all tiers',()=>{
  const plan=getReefHabitat(),habitat=createReefHabitat();
  const geometries=[0,1].map(createForestKelpGeometry);
  try {
    assert.ok(plan.kelp.length>=140);
    for(const plant of plan.kelp){
      assert.ok(Math.hypot((plant.x-KELP_POCKET.x)/KELP_POCKET.rx,(plant.z-KELP_POCKET.z)/KELP_POCKET.rz)<=1);
      assert.ok(Math.abs(plant.y-reefFloorHeight(plant.x,plant.z)+.025)<1e-9);
      assert.ok(plant.height>2.7&&plant.y+plant.height<=KELP_TOP+1e-8);
      const geometry=geometries[plant.form],position=geometry.attributes.position;
      for(let i=0;i<position.count;i++){
        assert.ok(plant.y+position.getY(i)*plant.height<=-2.4499,'all actual leaves remain below the minimum surface by over two metres');
        assert.ok(position.getY(i)>=0);
      }
      for(let time=0;time<80;time+=4)for(let ring=0;ring<=16;ring++){
        const i=ring*5,t=position.getY(i),phase=plant.x*.37+plant.z*.28;
        const x=position.getX(i)+(Math.sin(time*.31+phase)*.16+Math.sin(time*.53-phase)*.045)*t*t;
        const z=position.getZ(i)+Math.cos(time*.24+phase)*.13*t*t;
        assert.ok(Math.hypot(x,z)*plant.width<plant.width*.36,'swept woody stem fits the fish avoidance cylinder');
      }
      assert.equal(reefFishPositionClear(plant.x,plant.y+plant.height*.6,plant.z),false,'fish cannot swim through the stipe');
    }
    const mesh=habitat.root.getObjectByName('reef-kelp-forest-0') as InstancedMesh;
    const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:''} as WebGLProgramParametersWithUniforms;
    (mesh.material as MeshStandardMaterial).onBeforeCompile(shader,{} as never);
    habitat.update(12);assert.equal(shader.uniforms.kelpTime.value,12);habitat.update(80,true);assert.equal(shader.uniforms.kelpTime.value,12);
    for(const tier of ['high','medium','low'] as const){
      habitat.setQuality(tier);
      for(let form=0;form<2;form++){
        const batch=habitat.root.getObjectByName(`reef-kelp-forest-${form}`) as InstancedMesh;
        const visible=plan.kelp.filter(plant=>plant.form===form).slice(0,batch.count);
        assert.equal(new Set(visible.map(plant=>plant.patch)).size,7,'all kelp groves remain populated at every quality');
      }
    }
  }finally{geometries.forEach(geometry=>geometry.dispose());habitat.dispose();}
});

test('shared seabed contains broad shelves and a continuous deep kelp hollow',()=>{
  assert.ok(reefFloorHeight(-35,-34)<reefFloorHeight(-35,-22)-1.5);
  assert.ok(reefFloorHeight(-35,-34)<reefFloorHeight(-45,-34)-.8);
  let maximumSlope=0,maximumRelief=0;
  for(let x=-46;x<-24;x++)for(let z=-38;z<-21;z++){
    const h=reefFloorHeight(x,z);maximumSlope=Math.max(maximumSlope,Math.abs(h-reefFloorHeight(x+1,z)),Math.abs(h-reefFloorHeight(x,z+1)));
    maximumRelief=Math.max(maximumRelief,Math.abs(h-reefFloorHeight(x+6,z)));
  }
  assert.ok(maximumSlope<1,'continuous shelf transitions have no vertical seams');
  assert.ok(maximumRelief>1.1,'broad relief is visible beyond small sand ripples');
});
