import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMesh, Mesh, Vector3 } from 'three';
import { createCityFerryRoute } from '../src/components/world/cityInfrastructure';
import { getReefHabitat, reefFloorHeight, reefHabitatContains } from '../src/components/world/reefHabitat';
import { createReefContactShade, createReefHabitat, reefCoralGeometry, reefSeafloorGeometry } from '../src/components/world/ReefHabitatScene';
import { landDistance, terrainBaseHeight } from '../src/components/world/terrain';

test('the channel habitat is broad, irregular, seabed seated and leaves the full ferry route unobstructed',()=>{
  const plan=getReefHabitat();assert.equal(plan,getReefHabitat());
  assert.ok(plan.colonies.length>220);assert.ok(plan.rocks.length>80);assert.ok(plan.plants.length>350);
  let area=0;for(let x=-40;x<40;x+=.5)for(let z=-65;z<-20;z+=.5)if(reefHabitatContains(x,z))area+=.25;
  assert.ok(area>1200,`${area} square meters`);
  const xs=plan.colonies.map(p=>p.x),zs=plan.colonies.map(p=>p.z);
  assert.ok(Math.max(...xs)-Math.min(...xs)>50);assert.ok(Math.max(...zs)-Math.min(...zs)>27);
  const route=createCityFerryRoute();const ferry=Array.from({length:1200},(_,i)=>route.curve.getPointAt(i/1200));
  for(const entry of [...plan.colonies,...plan.rocks]) {
    assert.ok(reefHabitatContains(entry.x,entry.z,entry.radius));
    assert.ok(entry.y<reefFloorHeight(entry.x,entry.z));
    assert.ok(entry.y+entry.height<-1.8);
    assert.ok(Math.min(...ferry.map(p=>Math.hypot(p.x-entry.x,p.z-entry.z)))>entry.radius+3.5);
  }
  for(const entry of plan.colonies)assert.ok(plan.rocks.every(rock=>Math.hypot(entry.x-rock.x,entry.z-rock.z)>entry.radius+rock.radius*.78));
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

test('five coral forms and retained tier coverage fit a finite shared geometry budget',()=>{
  const forms=[0,1,2,3,4].map(reefCoralGeometry);assert.equal(new Set(forms.map(g=>g.userData.form)).size,5);forms.forEach(g=>g.dispose());
  const habitat=createReefHabitat();let triangles=0,draws=0;
  try {
    habitat.root.traverse(object=>{
      if(!(object instanceof Mesh))return;
      draws++;for(const value of object.geometry.getAttribute('position').array)assert.ok(Number.isFinite(value));
      triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3*(object instanceof InstancedMesh?object.count:1);
    });
    assert.equal(draws,14);assert.ok(triangles<600000,`${triangles} triangles`);
    const batches=habitat.root.children.filter(child=>child instanceof InstancedMesh&&child.name!=='reef-soft-contact-shading') as InstancedMesh[];
    const high=batches.map(batch=>batch.count);
    for(const tier of ['low','medium','high'] as const){
      habitat.setQuality(tier);batches.forEach((batch,i)=>{assert.equal(batch.count,Math.ceil(high[i]*(tier==='high'?1:tier==='medium'?.76:.52)));assert.ok(batch.count>0);});
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
