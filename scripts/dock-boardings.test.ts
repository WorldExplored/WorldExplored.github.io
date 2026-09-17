import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, Raycaster, Vector3 } from 'three';
import { createCityLife, dockBoardingPlan, dockBoardingExtension, DOCK_BOARDING_HEIGHT, DOCK_STAIR_COUNT } from '../src/components/world/CityLife';
import { createCityTransitRoute } from '../src/components/world/city';
import { createCityFerryRoute, FERRY_DWELL } from '../src/components/world/cityInfrastructure';

test('both piers descend through four supported steps to the actual ferry threshold',()=>{
  const city=createCityLife(createCityTransitRoute());city.root.updateMatrixWorld(true);
  const pier=city.root.getObjectByName('city-public-infrastructure') as Mesh;
  const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
  try{
    for(const plan of dockBoardingPlan()){
      const rise=(plan.dock.y-DOCK_BOARDING_HEIGHT)/DOCK_STAIR_COUNT;
      assert.ok(rise>0&&rise<=.16);assert.ok(Math.abs(plan.stairEnd-plan.stairStart)/DOCK_STAIR_COUNT>=.30);
      for(let step=0;step<DOCK_STAIR_COUNT;step++){
        const z=plan.stairStart+(plan.stairEnd-plan.stairStart)*(step+.5)/DOCK_STAIR_COUNT;
        ray.ray.origin.set(plan.dock.x,4,z);const hits=ray.intersectObject(pier);
        assert.ok(hits.length);assert.ok(Math.abs(hits[0].point.y-(plan.dock.y-rise*(step+1)))<1e-5);
      }
      const wetEnd=plan.dock.z+Math.sign(plan.stairEnd-plan.stairStart)*plan.dock.length/2;
      ray.ray.origin.set(plan.dock.x,4,(plan.stairEnd+wetEnd)/2);
      assert.ok(Math.abs(ray.intersectObject(pier)[0].point.y-DOCK_BOARDING_HEIGHT)<1e-5);
    }
  }finally{city.retain()();}
});

test('deployed gangways join both aft thresholds and retract before vessel movement',()=>{
  const city=createCityLife(createCityTransitRoute()),route=createCityFerryRoute();
  try{
    for(const plan of dockBoardingPlan()){
      const arrival=plan.index===0?0:route.firstDuration;city.update(arrival+2,createCityTransitRoute());city.root.updateMatrixWorld(true);
      const ferry=city.root.getObjectByName('city-water-taxi')!;
      const gangway=city.root.getObjectByName(`city-${plan.dock.id}-boarding-gangway`) as Mesh;
      assert.ok(gangway.visible);assert.equal(gangway.morphTargetInfluences![0],0);
      const vertices=gangway.geometry.getAttribute('position');
      for(const index of [2,3]){
        const world=new Vector3().fromBufferAttribute(vertices,index),local=ferry.worldToLocal(world.clone());
        assert.ok(Math.abs(world.y-DOCK_BOARDING_HEIGHT)<1e-6);
        assert.ok(Math.abs(local.z+1.04)<1e-5,'boarding edge is 2cm aft of the threshold');
        assert.ok(Math.abs(local.x)<=.251);assert.ok(Math.abs(local.y-(.26+.055/2))<1e-5);
      }
      const paused=gangway.morphTargetInfluences![0];city.update(arrival+3.6,createCityTransitRoute(),undefined,true);assert.equal(gangway.morphTargetInfluences![0],paused);
      for(const elapsed of [arrival,arrival+FERRY_DWELL-.15,arrival+FERRY_DWELL,arrival+FERRY_DWELL+1])assert.equal(dockBoardingExtension(elapsed,plan.index,route.duration,route.firstDuration),0);
      city.update(arrival+FERRY_DWELL,createCityTransitRoute());assert.equal(gangway.visible,false);
    }
  }finally{city.retain()();}
});
