import assert from 'node:assert/strict';
import test from 'node:test';
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createCityLift } from '../src/components/world/CityLift';
import { buildCityArchitecture, type CityLiftPlan } from '../src/components/world/CityArchitecture';
import { cityBuildings } from '../src/components/world/city';
import { createCoastalFerry } from '../src/components/world/CoastalFerry';

test('lift floors have one exposed walking face and landings never extend through the cabin',()=>{
  const material=new MeshBasicMaterial({side:DoubleSide});
  for(const building of cityBuildings){
    const landings:Mesh[]=[],plans:CityLiftPlan[]=[];
    buildCityArchitecture(building,(geometry)=>{if(geometry.userData.liftLanding)landings.push(new Mesh(geometry,material));else geometry.dispose();},plan=>plans.push(plan));
    for(const plan of plans){
      const lift=createCityLift(plan);
      try {
        lift.update(0);lift.cabin.updateMatrixWorld(true);
        const floor=lift.cabin.getObjectByName('lift-finished-floor') as Mesh;
        const ray=new Raycaster(new Vector3(plan.x+.1,plan.floors[0]+.3,plan.z+.1),new Vector3(0,-1,0),0,.4);
        const hits=ray.intersectObject(lift.cabin,true);
        const walking=hits.filter(hit=>Math.abs(hit.point.y-plan.floors[0])<1e-5);
        assert.equal(walking.length,1,building.id);assert.equal(walking[0].object,floor);
        for(const landing of landings){
          const positions=landing.geometry.getAttribute('position');
          for(let i=0;i<positions.count;i++)assert.ok(positions.getZ(i)>=plan.z+.347-1e-5,`${building.id} landing crosses moving cabin`);
        }
      }finally{lift.dispose();}
    }
    landings.forEach(mesh=>mesh.geometry.dispose());
  }
  material.dispose();
});
test('aft photovoltaic modules bear on the canopy and leave the ferry boarding threshold clear',()=>{
  const ferry=createCoastalFerry();
  try {
    const cells=ferry.root.getObjectByName('ferry-aft-photovoltaic-cells') as Mesh;
    assert.ok(cells);cells.geometry.computeBoundingBox();const b=cells.geometry.boundingBox!;
    assert.ok(b.min.y>1.09&&b.max.y<1.12);assert.ok(b.min.z>-.74&&b.max.z<-.14);assert.ok(b.max.x<.5&&b.min.x>-.5);
    assert.ok(ferry.root.getObjectByName('ferry-aft-solar-supports'));assert.ok(ferry.root.getObjectByName('ferry-solar-power-conduit'));
    ferry.root.traverse(object=>{assert.notEqual(object.type,'DirectionalLight');assert.notEqual(object.type,'SpotLight');});
  }finally{ferry.dispose();}
});
