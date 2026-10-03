import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, InstancedMesh, Vector3 } from 'three';
import { createPelagicAnatomy } from '../src/components/world/pelagicFishModels';
import { createPelagicLife } from '../src/components/world/PelagicLife';
import { createPelagicFish, flyingVertical, FLYING_GRAVITY, PELAGIC_COUNTS, pelagicCoastClearance, pelagicFloor, pelagicLaneClearance, samplePelagicFish, updatePelagicFish } from '../src/components/world/pelagicFishState';
import { createVesselState, vesselOccupants, vesselPointClearance } from '../src/components/world/marineTraffic';
import { coastalCaveClearance, MYTHIC_GROTTO } from '../src/components/world/coastalCaveLayout';
import { getReefHabitat } from '../src/components/world/reefHabitat';
import { harborWaterHeight } from '../src/components/world/waterSurface';

const kinds=['marlin','flying','lionfish']as const;
test('marlin, flying fish and lionfish have distinct anatomical profiles and attached fin roots',()=>{
  const anatomies=kinds.map(createPelagicAnatomy);
  try {
    const shapes=anatomies.map(model=>model.body.boundingBox!.getSize(new Vector3()));
    const bodySurface=new Box3(),bodyPoint=new Vector3(),marlinPositions=anatomies[0].body.getAttribute('position');
    for(let i=0;i<marlinPositions.count;i++)if(Math.abs(marlinPositions.getZ(i))>.035)bodySurface.expandByPoint(bodyPoint.fromBufferAttribute(marlinPositions,i));
    const bodySize=bodySurface.getSize(new Vector3());
    assert.ok(shapes[0].x>2.3&&bodySize.x/bodySize.y>3.2,'Marlin body is streamlined, beneath its separate tall dorsal fin and long bill.');
    const bill=anatomies[0].body.getAttribute('position');let tips=0;
    for(let i=0;i<bill.count;i++)if(bill.getX(i)>1.5){tips++;assert.ok(Math.abs(bill.getZ(i))<.004,'Bill terminates in a narrow physical point.');}
    assert.ok(tips>=6);
    for(const fin of anatomies[1].fins){fin.computeBoundingBox();assert.ok(fin.boundingBox!.getSize(new Vector3()).z>.5,'Flying fish has long wing-like pectoral fins.');}
    assert.ok(shapes[2].y>.56,'Lionfish carries long dorsal spines above its body.');
    let triangleBudget=0;
    for(const model of anatomies){
      const body=model.body.getAttribute('position');let hingeDistance=Infinity;
      for(let i=0;i<body.count;i++)hingeDistance=Math.min(hingeDistance,Math.hypot(body.getX(i)-model.tailX,body.getY(i),body.getZ(i)));
      assert.ok(hingeDistance<.04,'The articulated tail pivot lies inside the actual peduncle.');
      for(const geometry of [model.body,model.tail,...model.fins]){
        assert.ok(Array.from(geometry.getAttribute('position').array).every(Number.isFinite));
        assert.equal(geometry.getAttribute('color').count,geometry.getAttribute('position').count);
        triangleBudget+=(geometry.index?.count??geometry.getAttribute('position').count)/3;
      }
      for(const fin of model.fins){const points=fin.getAttribute('position');let closest=Infinity;for(let i=0;i<points.count;i++)closest=Math.min(closest,Math.hypot(points.getX(i),points.getY(i),points.getZ(i)));assert.ok(closest<.005,'Fin membrane and supporting rays share their hinge.');}
    }
    assert.ok(triangleBudget<7000,'Three original anatomies share fewer than 7k triangles.');
  }finally{anatomies.forEach(model=>[model.body,model.tail,...model.fins].forEach(g=>g.dispose()));}
});

test('flying-fish climbs obey gravity, wings support a glide, and staggered reentry hits the moving sea once',()=>{
  for(const age of [.08,.22,.31,1.88,2.05]){
    const a=flyingVertical(age),b=flyingVertical(age+.0001);
    assert.ok(Math.abs((b.velocity-a.velocity)/.0001+FLYING_GRAVITY)<1e-7);
    assert.ok(Math.abs((b.height-a.height)/.0001-a.velocity)<.001);
  }
  for(const edge of [.42,1.77])assert.ok(Math.abs(flyingVertical(edge-1e-6).height-flyingVertical(edge+1e-6).height)<.00001);
  assert.ok(flyingVertical(1).spread===1&&Math.abs(flyingVertical(1).velocity)<.3,'Extended fins support a shallow glide.');
  const fish=createPelagicFish().filter(f=>f.species==='flying'),stages=new Set<string>();
  for(let frame=0;frame<19*60;frame++){
    updatePelagicFish(fish,frame/60);
    if(frame===13*60)fish.forEach(f=>stages.add(f.phase));
  }
  assert.ok(stages.size>=2,'School members do not all launch in the same frame.');
  assert.ok(new Set(fish.map(f=>f.event!.start.toFixed(3))).size===fish.length);
  for(const f of fish){
    assert.ok(f.event!.allowed&&f.contacts===1,'Each fish has one reentry per shared event.');
    assert.ok(Math.abs(f.splash.y-harborWaterHeight(f.splash.x,f.splash.z,f.event!.end))<.000001);
    assert.equal(f.phase,'swim');assert.ok(f.position.y<harborWaterHeight(f.position.x,f.position.z,f.time)-.6);
  }
});

test('whole routes keep fish clear of the coast, reef, cave shell and vessel lanes during flight',()=>{
  const fish=createPelagicFish();let flights=0,visibleMarlins=0,marlinSamples=0;
  for(let time=0;time<=600;time+=1.7)for(const f of fish){
    samplePelagicFish(f,time);
    const radius=f.species==='marlin'?1.7:f.species==='lionfish'?.55:f.species==='flying'?.56:.28;
    const height=f.species==='marlin'?.48:f.species==='lionfish'?.39:f.species==='flying'?.55:.065;
    assert.ok(pelagicCoastClearance(f.position.x,f.position.z)>radius+.25,`${f.species} has full-body shore clearance.`);
    assert.ok(f.position.y-height>pelagicFloor(f.position.x,f.position.z,radius)+.02,`${f.species}-${f.index} enters reef geometry at ${time}.`);
    if(f.species==='marlin'){
      marlinSamples++;
      if(pelagicCoastClearance(f.position.x,f.position.z)<22&&f.position.y> -1.15)visibleMarlins++;
      if(pelagicLaneClearance(f.position.x,f.position.z)<2)assert.ok(f.position.y+.48<-.98,'Marlin dorsal fin clears the hull draft.');
    }
    if(f.species==='lionfish'||f.species==='cave-silver')assert.ok(coastalCaveClearance(f.position.x,f.position.z,radius)>0);
    if(f.species==='cave-silver'){
      assert.ok(f.position.z>MYTHIC_GROTTO.z+3,'Shoal stays outside the buried crab cave.');
      assert.ok(Math.hypot(f.position.x-MYTHIC_GROTTO.x,f.position.z-MYTHIC_GROTTO.z)<11,'Cave fish remain near the entrance.');
    }
    if(f.species==='flying'&&['climb','glide','descent'].includes(f.phase)){flights++;assert.ok(pelagicLaneClearance(f.position.x,f.position.z)>5);}
  }
  assert.ok(visibleMarlins>marlinSamples*.3,'Marlin spend substantial time visibly cruising the island shelf.');
  assert.ok(flights>50,'Flight events happen on multiple parts of the island loop.');
});

test('submerged school members yield below nearby hulls without crossing the seabed',()=>{
  const fish=createPelagicFish().filter(f=>f.species==='flying'),boats=[0,1,2].map(createVesselState),start=vesselOccupants.length;
  vesselOccupants.push(...boats);let yielding=0;
  try{
    for(let time=0;time<300;time+=1){
      boats.forEach(boat=>{boat.route.curve.getPointAt(time/300,boat.position);const tangent=boat.route.curve.getTangentAt(time/300);boat.heading=Math.atan2(tangent.x,tangent.z);});
      for(const f of fish){samplePelagicFish(f,time);const near=boats.some(boat=>vesselPointClearance(boat,f.position.x,f.position.z,.4)<1);
        if(near){yielding++;assert.ok(f.position.y<-.98,'Fish swims beneath the hull envelope.');}
        assert.ok(f.position.y-.55>pelagicFloor(f.position.x,f.position.z,.56)+.02);
      }
    }
    assert.ok(yielding>5,'This check actually exercises nearby vessel encounters.');
  }finally{vesselOccupants.splice(start,boats.length);}
});

test('new fish use bounded shared batches, persist across tier changes, and freeze under reduced motion',()=>{
  const life=createPelagicLife();
  try{
    life.update(13.8);const identities=life.meshes.map(m=>m.geometry),snapshot=life.states.map(f=>f.position.toArray()),matrices=life.meshes.map(m=>Array.from(m.instanceMatrix.array));
    life.update(80,true);assert.deepEqual(life.states.map(f=>f.position.toArray()),snapshot);assert.deepEqual(life.meshes.map(m=>Array.from(m.instanceMatrix.array)),matrices);
    for(const tier of ['low','medium','high']as const){
      life.setQuality(tier);
      for(const kind of Object.keys(PELAGIC_COUNTS)as Array<keyof typeof PELAGIC_COUNTS>){const mesh=life.root.getObjectByName(`${kind}-bodies`)as InstancedMesh;assert.equal(mesh.count,PELAGIC_COUNTS[kind][tier]);}
      assert.deepEqual(life.meshes.map(m=>m.geometry),identities);
    }
    assert.equal(life.meshes.length,16);
    let triangles=0;life.meshes.forEach(mesh=>triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3*mesh.count);
    assert.ok(triangles<82000,'The full population has a bounded instanced geometry budget.');
    const bounds=new Box3().setFromObject(life.root);assert.ok(Number.isFinite(bounds.min.x));
  }finally{life.dispose();}
});


test('blocked optional hover habitat cannot abort world construction or expose uninitialized instances',()=>{
  const rock=getReefHabitat().rocks[0],saved={...rock};let life:ReturnType<typeof createPelagicLife>|undefined;
  try{
    // Close all hover water with a real collision obstacle, exercising the bounded exhausted-search branch.
    rock.x=0;rock.z=0;rock.radius=1000;rock.y=0;rock.height=5;
    life=createPelagicLife();life.update(18);
    assert.equal(life.states.filter(f=>f.species==='lionfish'||f.species==='cave-silver').length,0);
    for(const mesh of life.meshes.filter(m=>m.name.startsWith('lionfish-')||m.name.startsWith('cave-silver-')))assert.equal(mesh.count,0);
    assert.equal(life.states.filter(f=>f.species==='marlin').length,2);
  }finally{Object.assign(rock,saved);life?.dispose();}
});
