import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, InstancedMesh, Mesh, Vector3 } from 'three';
import { createDolphinCourse, createDolphinState, dolphinCoastClearance, dolphinFerryClearance, stepDolphin } from '../src/components/world/dolphinRoutes';
import { createDolphinLife, dolphinBodyGeometry } from '../src/components/world/DolphinLife';
import { harborWaterHeight } from '../src/components/world/waterSurface';

const angularDistance = (a: number,b: number) => Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
test('twenty-minute dolphin journeys visit reef and both coasts without land, pier or ferry intersections',()=>{
  for(let index=0;index<3;index++) {
    const state=createDolphinState(index), previous=state.position.clone();
    let heading=state.heading,pitch=state.pitch,reef=0,main=0,city=0,underFerry=0;
    for(let frame=0;frame<72000;frame++) {
      const contact=stepDolphin(state,1/60);
      assert.ok(state.position.distanceTo(previous)*60<2.8,'bounded velocity, including course replanning');
      assert.ok(angularDistance(state.heading,heading)*60<1.1,'continuous steering');
      assert.ok(Math.abs(state.pitch-pitch)*60<6,'smooth dive and breach pitch');
      // At the steepest takeoff/recovery the tail projects downward, so use its full half-length.
      const underside=state.position.y-.13*Math.abs(Math.cos(state.pitch))-.60*Math.abs(Math.sin(state.pitch));
      assert.ok(underside>-1.7,'entire dolphin clears the top of the reef');
      if(frame%12===0) {
        assert.ok(dolphinCoastClearance(state.position.x,state.position.z)>2.25);
        const ferry=dolphinFerryClearance(state.position.x,state.position.z);
        if(ferry<2) {underFerry++;assert.ok(state.position.y<-.8 && !state.breach,'ferry crossings remain below the hull');}
        if(state.position.z>-54&&state.position.z<-28&&Math.abs(state.position.x)<28)reef++;
        if(state.position.z>28)main++;
        if(state.position.z<-99)city++;
      }
      if(contact) assert.ok(Math.abs(state.splash.y-harborWaterHeight(state.splash.x,state.splash.z,state.time))<.004);
      previous.copy(state.position);heading=state.heading;pitch=state.pitch;
    }
    assert.ok(state.lap>=1 && reef>50 && main>50 && city>50 && underFerry>1);
    assert.ok(state.contacts>35&&state.contacts<95,'independently varied occasional water contacts');
    const snapshot={time:state.time,distance:state.distance,position:state.position.toArray(),contacts:state.contacts};
    stepDolphin(state,5,true);
    assert.deepEqual({time:state.time,distance:state.distance,position:state.position.toArray(),contacts:state.contacts},snapshot);
  }
});
test('successive seeded courses differ while their join and tangent stay continuous',()=>{
  for(let index=0;index<3;index++) {
    const first=createDolphinCourse(index),second=createDolphinCourse(index,1);
    assert.notDeepEqual(first.curve.points.map(p=>p.toArray()),second.curve.points.map(p=>p.toArray()));
    assert.ok(first.curve.getPoint(0).distanceTo(second.curve.getPoint(0))<1e-9);
    assert.ok(first.curve.getTangent(0).distanceTo(second.curve.getTangent(0))<1e-9);
    for(let lap=0;lap<8;lap++)for(const p of createDolphinCourse(index,lap).curve.getPoints(1800))assert.ok(dolphinCoastClearance(p.x,p.z)>2.25);
  }
  const clockwise=createDolphinCourse(0).curve.getTangent(0),anticlockwise=createDolphinCourse(1).curve.getTangent(0);
  assert.ok(clockwise.dot(anticlockwise)<-.95,'neighbours do not form a same-direction parade');
});
test('dolphin anatomy is smaller than the two-unit ferry and uses outward normals with bounded resources',()=>{
  const geometry=dolphinBodyGeometry(),positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
  let outward=0;
  for(let i=21;i<positions.count-21;i++)outward+=positions.getY(i)*normals.getY(i)+positions.getZ(i)*normals.getZ(i);
  assert.ok(outward>0); geometry.dispose();
  const life=createDolphinLife();let draws=0,triangles=0;
  try {
    life.root.traverse(object=>{if(object instanceof Mesh){draws++;triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3*(object instanceof InstancedMesh?object.count:1);}});
    assert.ok(draws<=35,`${draws} draws`);assert.ok(triangles<30000,`${triangles} triangles`);
    const dolphins=life.root.children.filter(o=>o.name==='bottlenose-dolphin');assert.equal(dolphins.length,3);
    for(const animal of dolphins){
      const size=new Box3().setFromObject(animal).getSize(new Vector3());assert.ok(Math.max(size.x,size.z)<1.23);
      for(const name of ['horizontal-tail-flukes','eyes-mouth-and-blowhole','separated-lower-jaw'])assert.ok(animal.getObjectByName(name));
    }
    life.setQuality('low');assert.equal(life.root.children.filter(o=>o.name==='offshore-shark'&&o.visible).length,1);
    life.setQuality('high');assert.equal(life.root.children.filter(o=>o.name==='offshore-shark'&&o.visible).length,2);
    life.update(.05); const positions=dolphins.map(o=>o.position.toArray());life.update(5,true);assert.deepEqual(dolphins.map(o=>o.position.toArray()),positions);
  }finally{life.dispose();}
});
test('offshore sharks remain seaward with smaller bodies and pause with the world',()=>{
  for(let index=0;index<2;index++){
    const state=createDolphinState(index,true),previous=state.position.clone();
    for(let frame=0;frame<36000;frame++){
      assert.equal(stepDolphin(state,1/60),false);
      assert.ok(state.position.distanceTo(previous)*60<.7);
      if(frame%60===0)assert.ok(dolphinCoastClearance(state.position.x,state.position.z)>4);
      const surface=harborWaterHeight(state.position.x,state.position.z,state.time);
      assert.ok(surface-state.position.y>=.269&&surface-state.position.y<=.411);
      assert.ok(state.position.y+.52*.28<surface-.1,'whole back remains submerged');
      assert.ok(state.position.y+.52*.98>surface+.08,'dorsal tip is visible above the waves');
      previous.copy(state.position);
    }
    const position=state.position.clone(),time=state.time;stepDolphin(state,2,true);assert.equal(state.time,time);assert.deepEqual(state.position,position);
  }
});
