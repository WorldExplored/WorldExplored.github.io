import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { addGuidewayHardware } from '../src/components/world/CityGuideway';
import { createCityTransitRoute, CITY_TRACK_Y } from '../src/components/world/city';
import { FLIGHT_DURATION, FLIGHT_INTERVAL, makeSolarGlider, solarFlightPose } from '../src/components/world/SolarFlyover';
import { giantGrottoGeometry, makeMythicGrotto } from '../src/components/world/MythicGrotto';
import { MYTHIC_GROTTO, mythicalCaveClearance } from '../src/components/world/coastalCaveLayout';
import { terrainMeshHeight } from '../src/components/world/terrain';
import { marineFloorHeight } from '../src/components/world/reefHabitat';

test('guideway service hardware leaves the tyre corridor and station platform unobstructed',()=>{
  let count=0,vertices=0;
  addGuidewayHardware(createCityTransitRoute(),geometry=>{
    geometry.computeBoundingBox();const box=geometry.boundingBox!;
    assert.ok(box.max.y<CITY_TRACK_Y-.1,'hardware remains below the train guide rollers');
    const closest=new Vector3();box.clampPoint(new Vector3(-5,CITY_TRACK_Y,-68),closest);
    assert.ok(Math.hypot(closest.x+5,closest.z+68)>2.8,'station boarding corridor remains open');
    assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
    count++;vertices+=geometry.attributes.position.count;geometry.dispose();
  });
  assert.ok(count>300&&vertices<25000,'track details merge into existing finish batches');
});

test('the occasional solar glider crosses the sky continuously and disappears beyond the world',()=>{
  assert.equal(solarFlightPose(149,12).visible,false);
  assert.equal(solarFlightPose(160,2).visible,false);
  for(let event=0;event<3;event++){
    const start=150+event*FLIGHT_INTERVAL;
    let previous=solarFlightPose(start,12);
    assert.ok(Math.abs(previous.x)>350);
    for(let t=.1;t<FLIGHT_DURATION;t+=.1){
      const pose=solarFlightPose(start+t,12);
      assert.ok(pose.visible&&pose.y>57);
      assert.ok(Math.hypot(pose.x-previous.x,pose.y-previous.y,pose.z-previous.z)<.66,'smooth 6.4 m/s crossing, no teleport in view');
      previous=pose;
    }
    assert.ok(Math.abs(previous.x)>350);
    assert.equal(solarFlightPose(start+FLIGHT_DURATION,12).visible,false);
  }
  const glider=makeSolarGlider(),bounds=new Box3().setFromObject(glider);
  assert.ok(bounds.max.x-bounds.min.x>17&&bounds.max.z-bounds.min.z>8);
  assert.equal(glider.children.length,4);
  glider.children.forEach(child=>{const mesh=child as Mesh;mesh.geometry.dispose();(mesh.material as MeshStandardMaterial).dispose();});
});

test('the giant crab has a submerged roof, open entrance and a deep physical stone recess',()=>{
  const {root,body}=makeMythicGrotto();root.updateMatrixWorld(true);
  const bank=root.getObjectByName('sand-buried-angular-grotto') as Mesh;
  const bounds=new Box3().setFromObject(root),crabBounds=new Box3().setFromObject(body);
  assert.ok(bounds.max.y<-.5,'sand bank remains submerged');
  assert.ok(crabBounds.max.x-crabBounds.min.x>7,'mythical crab is much larger than the normal beach animals');
  assert.ok(mythicalCaveClearance(-55,-20)<-5&&mythicalCaveClearance(-35,-20)>0);
  const ray=new Raycaster(new Vector3(-55,MYTHIC_GROTTO.floor+1.5,-14),new Vector3(0,0,-1));
  const hit=ray.intersectObject(bank)[0];
  assert.ok(hit&&hit.distance>10,'no facade plane plugs the entrance before the recessed interior');
  const above=new Raycaster(new Vector3(-55,2,-22),new Vector3(0,-1,0));
  const roof=above.intersectObject(bank)[0],animal=above.intersectObject(body,true)[0];
  assert.ok(roof&&animal&&roof.distance<animal.distance,'roof conceals the resident from overhead views');
  let triangles=0;
  root.traverse(object=>{if(object instanceof Mesh){triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;assert.ok([...object.geometry.attributes.position.array].every(Number.isFinite));object.geometry.dispose();(object.material as MeshStandardMaterial).dispose();}});
  assert.ok(triangles<15000,'single rare habitat has a bounded mesh budget');
});


test('grotto roof and front have welded seams, with every open mesh edge buried in the real floor',()=>{
  const geometry=giantGrottoGeometry(),positions=geometry.getAttribute('position'),indices=geometry.index!,edges=new Map<string,number>();
  try {
    for(let triangle=0;triangle<indices.count;triangle+=3)for(let edge=0;edge<3;edge++){
      const a=indices.getX(triangle+edge),b=indices.getX(triangle+(edge+1)%3),key=[Math.min(a,b),Math.max(a,b)].join(':');
      edges.set(key,(edges.get(key)??0)+1);
    }
    let buriedEdges=0;
    for(const [key,count]of edges){
      assert.ok(count<=2,'No overlapping surface fans share an edge.');
      if(count!==1)continue;
      buriedEdges++;const [a,b]=key.split(':').map(Number);
      for(let sample=0;sample<=4;sample++){
        const t=sample/4,x=positions.getX(a)*(1-t)+positions.getX(b)*t+MYTHIC_GROTTO.x,z=positions.getZ(a)*(1-t)+positions.getZ(b)*t+MYTHIC_GROTTO.z;
        const y=positions.getY(a)*(1-t)+positions.getY(b)*t+MYTHIC_GROTTO.floor;
        const ground=Math.max(terrainMeshHeight(x,z),marineFloorHeight(x,z));
        assert.ok(y<ground+.015,`Exposed cave seam at ${x.toFixed(2)},${z.toFixed(2)}.`);
      }
    }
    assert.ok(buriedEdges>30&&buriedEdges<100,'Only the outside ground-connected perimeter is open.');
  }finally{geometry.dispose();}
});

test('solar cells lie within the real swept wing surface and the nose follows the flight path',()=>{
  const glider=makeSolarGlider(),material=new MeshBasicMaterial({side:DoubleSide});
  const airframe=new Mesh((glider.children[0]as Mesh).geometry,material),cells=(glider.children[2]as Mesh).geometry.getAttribute('position');airframe.updateMatrixWorld();
  const ray=new Raycaster(),direction=new Vector3(0,-1,0);let tested=0;
  try {
    for(let i=0;i<cells.count;i++){
      const x=cells.getX(i),y=cells.getY(i),z=cells.getZ(i);if(y<.02||Math.abs(x)<1)continue;
      ray.set(new Vector3(x,.2,z),direction);const hit=ray.intersectObject(airframe,false)[0];
      assert.ok(hit&&hit.point.y>.024&&hit.point.y<.037,'Every solar-panel corner is supported by the wing beneath it.');
      assert.ok(y-hit.point.y<.025,'Photovoltaic cells sit flush instead of floating over the wing.');tested++;
    }
    assert.ok(tested>200);
    for(let event=0;event<2;event++)for(let age=1;age<FLIGHT_DURATION-1;age+=2){
      const t=150+event*FLIGHT_INTERVAL+age,pose=solarFlightPose(t,12),next=solarFlightPose(t+.01,12);
      const travel=new Vector3(next.x-pose.x,0,next.z-pose.z).normalize(),nose=new Vector3(Math.sin(pose.yaw),0,-Math.cos(pose.yaw));
      assert.ok(travel.dot(nose)>.999999,'The glider does not skid sideways along its curved crossing.');
    }
  } finally {material.dispose();glider.children.forEach(child=>{const mesh=child as Mesh;mesh.geometry.dispose();(mesh.material as MeshStandardMaterial).dispose();});}
});
