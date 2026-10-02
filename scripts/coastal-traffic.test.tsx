import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import { createAeroBoat, createCoastalTraffic, createVisitorPier, VISITOR_PIER_HEAD, VISITOR_PIER_SHORE } from '../src/components/world/CoastalTraffic';
import { createVesselState, stepVessel, vesselHullClearance, vesselPointClearance, vesselCoastClearance, vesselDockClearance, vesselOccupants, writeVesselPose, SURVEY_BERTH, SURVEY_DWELL, VISITOR_BERTH, VISITOR_DWELL, type MarineOccupant } from '../src/components/world/marineTraffic';
import { HARBOR_OBSTACLES, CITY_PIER_JUNCTION, createCityFerryRoute, writeCityFerryPose } from '../src/components/world/cityInfrastructure';
import { createDolphinState, stepDolphin } from '../src/components/world/dolphinRoutes';
import { landDistance, terrainMeshHeight } from '../src/components/world/terrain';

const horizontal = (a: Vector3, b: Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

test('every boat route clears the coast at the complete oriented hull envelope, including the visitor landing', () => {
  for (let index = 0; index < 3; index++) {
    const state = createVesselState(index);
    for (let sample = 0; sample <= 4000; sample++) {
      state.distance=state.route.length*sample/4000;writeVesselPose(state);
      assert.ok(vesselCoastClearance(state)>1.5,`route ${index} has a navigable complete hull envelope`);
    }
  }
  const visitor = createVesselState(2); visitor.distance = visitor.route.berth; writeVesselPose(visitor);
  assert.ok(visitor.position.distanceTo(VISITOR_BERTH) < .00001);
  assert.ok(Math.abs(visitor.heading - Math.PI / 2) < .002, 'the boat lies parallel to the boarding platform');
});

test('the navigation capsule encloses every boat mesh vertex and its boarding step',()=>{
  for(let index=0;index<3;index++){
    const boat=createAeroBoat(index),state=createVesselState(index);state.position.set(0,0,0);state.heading=0;boat.root.updateMatrixWorld(true);
    try{boat.root.traverse(object=>{if(!(object instanceof Mesh))return;const points=object.geometry.attributes.position;for(let i=0;i<points.count;i++){
      const point=new Vector3().fromBufferAttribute(points,i).applyMatrix4(object.matrixWorld);
      assert.ok(vesselPointClearance(state,point.x,point.z)<.001,`${index}/${object.name}: hull envelope must contain the rendered model`);
    }});}finally{boat.dispose();}
  }
});

test('fleet and scheduled ferry remain separated over repeated visits and lower frame rates', () => {
  const ferry = createCityFerryRoute(), position = new Vector3(), tangent = new Vector3();
  for (const dt of [.05, .1]) {
    const fleet = [1, 2].map(createVesselState), travel = [0, 0, 0];
    let visits = 0, surveyVisits = 0, priorDwell = 0, priorSurveyDwell = 0;
    for (let frame = 0; frame < 1200 / dt; frame++) {
      const time = frame * dt + (dt === .1 ? 31 : 0);
      for (const boat of fleet) {
        const before = boat.distance;
        stepVessel(boat, dt, time, fleet, []);
        travel[boat.index] += (boat.distance - before + boat.route.length) % boat.route.length;
      }
      writeCityFerryPose(ferry, time, position, tangent);
      for (let i = 0; i < fleet.length; i++) {
        assert.ok(vesselHullClearance(fleet[i],{position,radius:1.5})>.5,'the scheduled ferry has a clear lane around the complete hull');
        for (let j = i + 1; j < fleet.length; j++) {
          assert.ok(vesselHullClearance(fleet[i],fleet[j])>.5);
        }
      }
      for(const boat of fleet)assert.ok(vesselDockClearance(boat)>.025,'every moving hull clears all permanent piers, fenders and piles');
      assert.ok(!(fleet[0].dwell&&fleet[1].dwell),'adjacent visitor and survey boarding berths are reserved exclusively');
      if(!priorSurveyDwell&&fleet[0].dwell)surveyVisits++;
      priorSurveyDwell=fleet[0].dwell;
      if (!priorDwell && fleet[1].dwell) visits++;
      priorDwell = fleet[1].dwell;
    }
    assert.ok(visits >= 2 && surveyVisits >= 2, 'yielding never deadlocks either boat before its landing');
    for (const boat of fleet) assert.ok(travel[boat.index] > boat.route.length * 2);
  }
});

test('visitor arrives gently, holds the exact berth for 32 active seconds, and accelerates away', () => {
  for (const dt of [1 / 60, .1, .5]) {
    const boat = createVesselState(2);
    boat.distance = boat.route.berth - 4; boat.speed = 1.7; writeVesselPose(boat);
    let arrivalSpeed = 0;
    for (let frame = 0; frame < 5000 && !boat.dwell; frame++) {
      arrivalSpeed = boat.speed;
      stepVessel(boat, dt, frame * dt, [], []);
    }
    assert.equal(boat.dwell, VISITOR_DWELL);
    assert.ok(arrivalSpeed < .35, 'the final approach slows before touching the berth');
    assert.ok(boat.position.distanceTo(VISITOR_BERTH) < .00001);
    const docked = boat.position.clone();
    for (let elapsed = 0; elapsed < 31; elapsed += .5) stepVessel(boat, .5, 0, [], []);
    assert.equal(boat.dwell, 1);
    assert.ok(boat.position.equals(docked));
    stepVessel(boat, 1, 0, [], []);
    assert.equal(boat.dwell, 0); assert.equal(boat.departed, true); assert.equal(boat.speed, 0);
    for (let frame = 0; frame < 1200 && boat.speed === 0; frame++) stepVessel(boat, .05, frame * .05, [], []);
    assert.ok(boat.speed > 0 && boat.speed < .03, 'departure accelerates after yielding to the ferry');
    assert.ok(boat.distance > boat.route.berth);
  }
});

test('surface animals stop boats while submerged swimmers can pass beneath the hull', () => {
  const boat = createVesselState(0);
  const animal: MarineOccupant = { position: boat.route.curve.getPointAt((boat.distance + 10) / boat.route.length), radius: .9 };
  for (let frame = 0; frame < 500; frame++) {
    stepVessel(boat, .05, frame * .05, [], [animal]);
    assert.ok(horizontal(boat.position, animal.position) > boat.radius + animal.radius + .5);
  }
  assert.equal(boat.speed, 0);
  const before = boat.distance; animal.position.y = -2;
  for (let frame = 0; frame < 100; frame++) stepVessel(boat, .05, frame * .05 + 25, [], [animal]);
  assert.ok(boat.distance > before + 3);
});

test('live dolphins and offshore sharks stay outside the hull envelope or dive below it', () => {
  const fleet = [0, 1, 2].map(createVesselState);
  const animals = [createDolphinState(0), createDolphinState(1), createDolphinState(2), createDolphinState(3), createDolphinState(0, true), createDolphinState(1, true)];
  const occupants = animals.map(animal => ({ position: animal.position, radius: animal.shark ? 1.1 : .65 }));
  vesselOccupants.push(...fleet);
  try {
    for (let frame = 0; frame < 12000; frame++) {
      const time = frame * .05;
      for (const animal of animals) stepDolphin(animal, .05, false, time);
      for (const boat of fleet) stepVessel(boat, .05, time, fleet, occupants);
      for (const animal of occupants) for (const boat of fleet) {
        assert.ok(animal.position.y < -.8 || vesselHullClearance(boat,animal)>0, 'surface wildlife never occupies a hull');
      }
    }
  } finally {
    for (const boat of fleet) vesselOccupants.splice(vesselOccupants.indexOf(boat), 1);
  }
});

test('visitor fade is smooth and separate wakes stop at the berth without shader changes', () => {
  const visitor = createVesselState(2), boat = createAeroBoat(2);
  const materials = Object.values(boat.materials), versions = materials.map(material => material.version);
  try {
    visitor.distance = 0; writeVesselPose(visitor); assert.equal(visitor.opacity, 0);
    visitor.distance = 17.5; writeVesselPose(visitor); assert.ok(Math.abs(visitor.opacity - .5) < .00001);
    visitor.distance = visitor.route.length - 22.5; writeVesselPose(visitor); assert.ok(Math.abs(visitor.opacity - .5) < .00001);
    visitor.distance = visitor.route.length; writeVesselPose(visitor); assert.equal(visitor.opacity, 0);
    for (let frame = 0; frame < 100; frame++) boat.update(frame / 60, frame / 100, .8, 1.35);
    assert.ok(boat.wakeRoot.visible);
    assert.ok(boat.wakeRoot.parent === null, 'wake water plane is independent of the rolling hull');
    boat.update(2, 1, .8, 0); assert.equal(boat.wakeRoot.visible, false);
    assert.deepEqual(materials.map(material => material.version), versions);
    assert.ok(materials.every(material => material.transparent));
    assert.ok(boat.root.getObjectByName('starboard-boarding-step'));
    for (const value of [NaN, Infinity, -1, 0]) {
      const before = visitor.position.clone(); stepVessel(visitor, value, 0); assert.ok(visitor.position.equals(before));
    }
  } finally { boat.dispose(); }
});

test('the enlarged visitor boarding step meets the pier deck and fades only far offshore',()=>{
  const visitor=createVesselState(2),boat=createAeroBoat(2),pier=createVisitorPier();
  try{
    visitor.distance=visitor.route.berth;writeVesselPose(visitor);boat.root.position.copy(visitor.position);boat.root.position.y=.08;boat.root.rotation.y=visitor.heading;boat.root.updateMatrixWorld(true);
    const step=boat.partBounds['starboard-boarding-step'].clone().applyMatrix4(boat.root.matrixWorld);
    const deck=(pier.root.getObjectByName('visitor-pier-boardwalk') as Mesh).geometry.attributes.position;
    let edge=-Infinity,top=-Infinity;
    for(let i=0;i<deck.count;i++)if(deck.getX(i)<VISITOR_PIER_HEAD.x-2&&deck.getZ(i)>VISITOR_PIER_HEAD.z){edge=Math.max(edge,deck.getZ(i));top=Math.max(top,deck.getY(i));}
    assert.ok(step.min.z>edge+.15&&step.min.z<edge+.4,'the boat landing clears the fixed quay, with the telescoping gangway spanning the gap');
    assert.ok(Math.abs(step.max.y-top)<1e-5,'boat and pier boarding floors have equal height');
    assert.ok(step.min.x>VISITOR_PIER_HEAD.x-3.3&&step.max.x<VISITOR_PIER_HEAD.x+3.3);
    for(const distance of [10,visitor.route.length-10]){visitor.distance=distance;writeVesselPose(visitor);assert.ok(Math.abs(visitor.position.x)>300&&visitor.opacity<.25,'fade occurs well beyond the islands and harbor');}
  }finally{boat.dispose();pier.dispose();}
});

test('one connected city pier joins the existing shore stem without a second shore boardwalk', () => {
  const pier=createVisitorPier(),point=new Vector3();
  try{
    assert.ok(landDistance(VISITOR_PIER_SHORE.x,VISITOR_PIER_SHORE.z)>1.5);
    const deck=pier.root.getObjectByName('visitor-pier-boardwalk') as Mesh,vertices=deck.geometry.getAttribute('position');
    let connects=false,oldStem=false;
    for(let i=0;i<vertices.count;i++){
      point.fromBufferAttribute(vertices,i);
      connects ||= Math.abs(point.x-(CITY_PIER_JUNCTION.x-.6))<.12&&Math.abs(point.z-CITY_PIER_JUNCTION.z)<.85&&Math.abs(point.y-CITY_PIER_JUNCTION.y)<.04;
      oldStem ||= point.z<-54;
    }
    assert.ok(connects,'the west berth shares the taxi pier and its shore access');
    assert.equal(oldStem,false,'the obsolete second city shore boardwalk is removed');
  }finally{pier.dispose();}
});

test('effect replay retains traffic resources, pause freezes motion, and final cleanup disposes once', async () => {
  const traffic = createCoastalTraffic(), geometries = new Set<Mesh['geometry']>(), materials = new Set<Mesh['material']>();
  let geometryDisposals = 0, materialDisposals = 0;
  for (const root of [traffic.pier.root, ...traffic.fleet.flatMap(({ boat }) => [boat.root, boat.wakeRoot])]) root.traverse(object => {
    if (object instanceof Mesh) { geometries.add(object.geometry); materials.add(object.material); }
  });
  for (const geometry of geometries) geometry.addEventListener('dispose', () => geometryDisposals++);
  for (const material of materials) {
    assert.ok(!Array.isArray(material)); material.addEventListener('dispose', () => materialDisposals++);
  }
  traffic.attach(); traffic.attach(); assert.equal(vesselOccupants.length, 2);
  traffic.detach(); assert.equal(vesselOccupants.length, 0);
  traffic.attach(); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(geometryDisposals, 0); assert.equal(materialDisposals, 0);
  traffic.update(.05, 2, 0, false, 'high');
  const snapshot = traffic.fleet.map(({ state, boat }) => [state.distance, ...boat.root.position.toArray(), ...boat.root.rotation.toArray()]);
  traffic.update(.05, 2, 0, true, 'low');
  assert.deepEqual(traffic.fleet.map(({ state, boat }) => [state.distance, ...boat.root.position.toArray(), ...boat.root.rotation.toArray()]), snapshot);
  traffic.detach(); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(vesselOccupants.length, 0);
  assert.equal(geometryDisposals, geometries.size); assert.equal(materialDisposals, materials.size);
  assert.ok(geometries.size < 75, 'all fittings and wakes remain within the fleet draw budget');
});


test('the berth inspection hook is local only and uses the real docking state', async () => {
  for (const hostname of ['localhost', '127.0.0.1', 'worldexplored.github.io', 'localhost.example.com']) {
    const traffic = createCoastalTraffic({ hostname, search: '?qaVessel=berth' });
    const visitor = traffic.fleet.find(item=>item.state.index===2)!.state;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      assert.equal(visitor.dwell, 32);
      assert.ok(visitor.position.distanceTo(VISITOR_BERTH) < .00001);
    } else {
      assert.equal(visitor.dwell, 0);
      assert.ok(visitor.position.distanceTo(VISITOR_BERTH) > 70);
    }
    traffic.detach();
  }
  const surveyTraffic=createCoastalTraffic({hostname:'localhost',search:'?qaVessel=survey-berth'});
  const survey=surveyTraffic.fleet.find(item=>item.state.index===1)!.state;
  assert.equal(survey.dwell,SURVEY_DWELL);assert.ok(survey.position.distanceTo(SURVEY_BERTH)<1e-5);surveyTraffic.detach();
  await new Promise(resolve => setTimeout(resolve, 5));
});


test('visitor pier algae stays attached to wet post faces within a small instance budget', () => {
  const pier = createVisitorPier();
  try {
    assert.ok(pier.algaeSites.length >= 300 && pier.algaeSites.length <= 500);
    let triangles = 0, batches = 0;
    pier.root.traverse(object => {
      if (object instanceof Mesh && object.userData.dockGrowth) {
        batches++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
      }
    });
    assert.equal(batches, 1); assert.ok(triangles < 150000);
    for (const site of pier.algaeSites) {
      const { post } = site;
      const face = post.bottomRadius + (post.topRadius - post.bottomRadius) * (site.y - post.bottom) / (post.top - post.bottom);
      assert.ok(Math.abs(Math.hypot(site.x - post.x, site.z - post.z) - face) < .00001);
      assert.ok(site.y > terrainMeshHeight(site.x, site.z) + .04);
      assert.ok(site.y + site.height * 1.04 <= -.25 + .00001);
    }
  } finally { pier.dispose(); }
});

test('visitor has a full second deck at distinct scale while launches have different hull forms', async()=>{
  const {Box3}=await import('three');const boats=[0,1,2].map(createAeroBoat);
  try{
    const sizes=boats.map(boat=>new Box3().setFromObject(boat.root).getSize(new Vector3()));
    assert.ok(sizes[2].z>11.5&&sizes[2].z>sizes[0].z*3);
    assert.ok(sizes[2].y>4,'visitor includes a standing-height upper saloon');
    assert.ok(boats[2].root.getObjectByName('upper-saloon-glazing'));
    assert.ok(boats[0].root.getObjectByName('swept-hydrofoil-hull'));
    assert.ok(boats[1].root.getObjectByName('survey-mast'));
    assert.ok(sizes[1].x>sizes[0].x,'survey launch is broader than the hydrofoil');
  }finally{boats.forEach(boat=>boat.dispose());}
});

test('visitor has a clear full-height boarding aperture and guarded gangway only while docked',async()=>{
  const {Raycaster}=await import('three');
  const boat=createAeroBoat(2),pier=createVisitorPier(),visitor=createVesselState(2);
  try{
    // Probe the actual batched geometry rather than a doorway bounding box.
    boat.root.traverse(object=>{if(object instanceof Mesh)object.raycast=Mesh.prototype.raycast;});
    const ray=new Raycaster(new Vector3(2.7,1.3,-.925),new Vector3(-1,0,0),0,1.2);
    boat.update(0,1,0,0,'high',0);boat.root.updateMatrixWorld(true);
    assert.ok(ray.intersectObject(boat.root,true).length>0,'closed cabin door protects passengers underway');
    boat.update(1,1,0,0,'high',1);boat.root.updateMatrixWorld(true);
    for(const height of [.76,1.3,2.03])for(const z of [-1.35,-.925,-.5]){
      ray.ray.origin.set(2.7,height,z);
      assert.equal(ray.intersectObject(boat.root,true).length,0,`clear cabin aperture at ${height}/${z}`);
    }
    visitor.distance=visitor.route.berth;writeVesselPose(visitor);boat.root.position.copy(visitor.position);boat.root.position.y=.08;boat.root.rotation.y=visitor.heading;boat.root.updateMatrixWorld(true);
    pier.update(1);pier.root.updateMatrixWorld(true);
    const bridge=new Box3().setFromObject(pier.root.getObjectByName('visitor-telescoping-gangway')!);
    const step=boat.partBounds['starboard-boarding-step'].clone().applyMatrix4(boat.root.matrixWorld);
    assert.ok(bridge.intersectsBox(step),'deployed bridge physically overlaps the boat landing');
    assert.ok(bridge.min.x>step.min.x-.04&&bridge.max.x<step.max.x+.04,'whole walking width lands on the boarding step');
    pier.update(0);assert.equal(pier.root.getObjectByName('visitor-telescoping-gangway')!.visible,false);
    let draws=0;boat.root.traverse(object=>{if(object instanceof Mesh)draws++;});
    assert.ok(draws<=12,'static detail is merged by material and gate is separate');
    for(const name of ['passenger-safety-fittings','life-raft-canisters-and-luggage-racks','enclosed-waterjet-nozzles','recessed-waterjet-outlets'])assert.ok(boat.root.getObjectByName(name));
    assert.equal(boat.root.getObjectByName('electric-thruster-blades'),undefined);
  }finally{boat.dispose();pier.dispose();}
});

test('the operating fleet has one launch, one visitor and the separately modelled water taxi',async()=>{
  const traffic=createCoastalTraffic();
  try{assert.deepEqual(traffic.fleet.map(vessel=>vessel.state.index),[1,2]);}
  finally{traffic.detach();await new Promise(resolve=>setTimeout(resolve,5));}
});


test('the consolidated visitor and taxi pier decks intercept rain through the scene registry',async()=>{
  const {Group}=await import('three');
  const {createCityLife}=await import('../src/components/world/CityLife');
  const {createCityTransitRoute}=await import('../src/components/world/city');
  const {createRainCatchments}=await import('../src/components/world/rainCatchments');
  const {isRainCatchmentRoot}=await import('../src/components/world/RainRoofRegistry');
  const city=createCityLife(createCityTransitRoute()),pier=createVisitorPier(),scene=new Group();
  scene.add(city.root,pier.root);
  try{
    const roots:import('three').Object3D[]=[];scene.traverse(object=>{if(isRainCatchmentRoot(object))roots.push(object);});
    assert.equal(roots.length,2,'only the two connected static pier assemblies are registered');
    const catches=createRainCatchments(roots);
    for(const [x,z,height]of [[-12,-53,1.06],[-20,-52,1.06],[-28,-45.85,.56]]){
      assert.ok(Math.abs(catches.height(x,z)-height)<.005,`rain lands on the solid pier deck at ${x}/${z}`);
    }
    assert.equal(catches.height(-24,-55),-Infinity,'there is no invisible remnant of the removed visitor boardwalk');
  }finally{pier.dispose();city.retain()();}
});


test('static navigation envelopes contain the rendered dock, pile, fender and lighthouse access geometry',async()=>{
  const {createCityLife}=await import('../src/components/world/CityLife');
  const {createCityTransitRoute}=await import('../src/components/world/city');
  const {createLighthouseAccess}=await import('../src/components/world/LighthouseAccess');
  const pier=createVisitorPier(),city=createCityLife(createCityTransitRoute()),lighthouse=createLighthouseAccess(),point=new Vector3();
  try{
    const meshes=[...['visitor-pier-boardwalk','visitor-pier-seabed-piles','quay-soft-fenders'].map(name=>pier.root.getObjectByName(name) as Mesh),...lighthouse.root.children as Mesh[],city.root.getObjectByName('city-public-infrastructure') as Mesh];
    for(const mesh of meshes){
      const positions=mesh.geometry.getAttribute('position');
      for(let i=0;i<positions.count;i++){
        point.fromBufferAttribute(positions,i);
        if(mesh.name==='city-public-infrastructure'&&point.z<-58.1)continue;
        assert.ok(HARBOR_OBSTACLES.some(box=>point.x>=box.minX-1e-5&&point.x<=box.maxX+1e-5&&point.z>=box.minZ-1e-5&&point.z<=box.maxZ+1e-5),`${mesh.name} ${point.toArray()} must be inside a real static navigation obstacle`);
      }
    }
  }finally{pier.dispose();lighthouse.dispose();city.retain()();}
});

test('complete hulls clear all piers along every approach, turn and departure, including the ferry transom',async()=>{
  const {createCoastalFerry}=await import('../src/components/world/CoastalFerry');
  const ferry=createCoastalFerry(),point=new Vector3(),tangent=new Vector3();
  const taxi:MarineOccupant={position:new Vector3(),heading:0,radius:1.5,hullHalfSpan:.75,hullRadius:.72};
  try{
    ferry.root.position.set(0,0,0);ferry.root.rotation.set(0,0,0);ferry.root.updateMatrixWorld(true);
    ferry.root.traverse(object=>{
      if(!(object instanceof Mesh)||object.name.includes('wake'))return;
      const positions=object.geometry.getAttribute('position');
      for(let i=0;i<positions.count;i++){
        point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);
        assert.ok(vesselPointClearance(taxi,point.x,point.z)<.001,`${object.name} is contained by the ferry navigation envelope`);
      }
    });
    for(let i=0;i<=8000;i++){
      ferry.route.curve.getPointAt(i/8000,taxi.position);ferry.route.curve.getTangentAt(i/8000,tangent);taxi.heading=Math.atan2(tangent.x,tangent.z);
      assert.ok(vesselDockClearance(taxi)>.04,'the taxi keeps its entire transom and bow clear around the stem');
    }
    for(const index of [1,2]){
      const boat=createVesselState(index);
      for(let i=0;i<=8000;i++){
        boat.distance=boat.route.length*i/8000;writeVesselPose(boat);
        assert.ok(vesselDockClearance(boat)>.04,`vessel ${index} clears the fixed harbor along the complete swept route`);
        if(index===2&&Math.abs(boat.distance-boat.route.berth)<8.5)assert.ok(Math.abs(boat.heading-Math.PI/2)<.002,'visitor stays parallel until its entire stern passes the pier');
      }
    }
  }finally{ferry.dispose();}
});

test('quay rails meet through the elbow and both shoulders, and only occupied berths open their gates',()=>{
  const pier=createVisitorPier(),ray=new Raycaster();
  try{
    pier.root.traverse(object=>{if(object instanceof Mesh)object.raycast=Mesh.prototype.raycast;});
    pier.update(0,0);pier.root.updateMatrixWorld(true);
    const segments=[...pier.railingSegments,...pier.gateSegments];
    for(const segment of segments)for(const endpoint of [segment.a,segment.b]){
      const neighbors=segments.filter(other=>other.a.distanceTo(endpoint)<.001||other.b.distanceTo(endpoint)<.001).length;
      assert.equal(neighbors,Math.abs(endpoint.x+12.60)<.001?1:2,'only the joined city stem has open perimeter endpoints');
    }
    for(const {a,b}of pier.railingSegments){
      const tangent=b.clone().sub(a).setY(0).normalize(),normal=new Vector3(tangent.z,0,-tangent.x);
      for(const t of [.02,.5,.98]){
        const point=a.clone().lerp(b,t).add(new Vector3(0,1,0));ray.set(point.clone().addScaledVector(normal,.16),normal.clone().negate());ray.far=.32;
        assert.ok(ray.intersectObject(pier.root,true).length,'actual top rail remains continuous near each corner, not only in metadata');
      }
    }
    for(const [index,name]of ['visitor-quay-gate','survey-quay-gate'].entries()){
      const {a,b}=pier.gateSegments[index],normal=new Vector3(b.z-a.z,0,a.x-b.x).normalize(),point=a.clone().lerp(b,.5).add(new Vector3(0,1,0));
      pier.update(0,0);pier.root.updateMatrixWorld(true);ray.set(point.clone().addScaledVector(normal,.2),normal.clone().negate());ray.far=.4;
      assert.ok(ray.intersectObject(pier.root.getObjectByName(name)!,true).length,'empty quay gate closes the walking edge');
      pier.update(index===0?1:0,index===1?1:0);pier.root.updateMatrixWorld(true);
      assert.equal(ray.intersectObject(pier.root.getObjectByName(name)!,true).length,0,'boarding gate folds clear only for its own berth');
    }
  }finally{pier.dispose();}
});

test('survey launch has a usable cabin opening, a matched level gangway and genuine helm controls',()=>{
  const boat=createAeroBoat(1),pier=createVisitorPier(),survey=createVesselState(1);
  try{
    boat.root.traverse(object=>{if(object instanceof Mesh)object.raycast=Mesh.prototype.raycast;});
    const ray=new Raycaster(new Vector3(1.6,1.1,0),new Vector3(-1,0,0),0,1.55);
    boat.update(0,1,0,0,'high',0);boat.root.updateMatrixWorld(true);
    assert.ok(ray.intersectObject(boat.root,true).length,'closed cabin door secures the survey launch');
    boat.update(0,1,0,0,'high',1);boat.root.updateMatrixWorld(true);
    assert.equal(ray.intersectObject(boat.root,true).length,0,'doorway reaches the cabin aisle without crossing seats or posts');
    survey.distance=survey.route.berth;survey.dwell=SURVEY_DWELL;writeVesselPose(survey);
    assert.ok(survey.position.distanceTo(SURVEY_BERTH)<1e-5);assert.ok(Math.abs(survey.heading)<.002);
    boat.root.position.copy(survey.position).setY(.08);boat.root.rotation.y=survey.heading;boat.root.updateMatrixWorld(true);pier.update(0,1);pier.root.updateMatrixWorld(true);
    const step=boat.partBounds['survey-boarding-threshold'].clone().applyMatrix4(boat.root.matrixWorld),bridge=new Box3().setFromObject(pier.root.getObjectByName('survey-telescoping-gangway')!);
    assert.ok(bridge.intersectsBox(step));assert.ok(bridge.min.z>=step.min.z-.02&&bridge.max.z<=step.max.z+.02);
    assert.ok(Math.abs(step.max.y-.56)<1e-6);
    for(const name of ['helm-wheel-throttle-and-controls','helm-dial-and-map-screen','survey-chart-table-and-instruments'])assert.ok(boat.root.getObjectByName(name));
  }finally{boat.dispose();pier.dispose();}
});

test('city quay decks have one exact walking face across the stem, elbow and sloped joints',async()=>{
  const {createCityLife}=await import('../src/components/world/CityLife');
  const {createCityTransitRoute}=await import('../src/components/world/city');
  const pier=createVisitorPier(),city=createCityLife(createCityTransitRoute());
  try{
    const decks=[pier.root.getObjectByName('visitor-pier-boardwalk') as Mesh,city.root.getObjectByName('city-public-infrastructure') as Mesh];
    for(const mesh of decks){mesh.raycast=Mesh.prototype.raycast;mesh.updateMatrixWorld(true);}
    const probe=(x:number,z:number,top:number)=>{
      const hits=new Raycaster(new Vector3(x,4,z),new Vector3(0,-1,0)).intersectObjects(decks,false).filter(hit=>Math.abs(hit.point.y-top)<1e-5);
      assert.equal(hits.length,1,`one walking surface at ${x}/${z}, without duplicate coplanar deck faces`);
    };
    for(const x of [-12.68,-12.66,-12.64,-12.62,-12.59])probe(x,-52.137,1.06);
    for(const x of [-26.20,-26.17,-26.15,-26.12])probe(x,-52.213,1.06);
    for(const z of [-51.18,-51.165,-51.155,-51.13,-46.46,-46.43,-46.42,-46.40]){
      const top=z<=-51.16?1.06:z>=-46.425?.56:1.06+(z+51.16)/4.735*(.56-1.06);probe(-27.117,z,top);
    }
    const geometry=decks[0].geometry,p=geometry.attributes.position,n=geometry.attributes.normal;
    for(let i=0;i<n.count;i++)if(n.getY(i)>.7)assert.ok(n.getY(i)>.99,'deck normals remain planar across each molded panel');
    assert.ok(p.count<200,'joined continuous panels replace dozens of overlapping plank boxes');
  }finally{pier.dispose();city.retain()();}
});
