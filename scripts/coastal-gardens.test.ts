import test from 'node:test';
import assert from 'node:assert/strict';
import { Frustum, Matrix4, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { createSeabedMeadows, createSeabedMeadowSites, SEABED_FORMS } from '../src/components/world/SeabedMeadows';
import { createIslandMeadowSites } from '../src/components/world/IslandMeadows';
import { meadowGeometry } from '../src/components/world/MeadowGeometry';
import { createFrontGardens, frontVineSites } from '../src/components/world/FrontGardens';
import { createFacadeGarden, vineHabit } from '../src/components/world/FacadeGarden';
import { createLandscapePlan, distanceToSegment, terrainMeshHeight, vegetationSuitability } from '../src/components/world/terrain';
import { coastalCaveClearance } from '../src/components/world/coastalCaveLayout';
import { getReefHabitat, marineFloorHeight } from '../src/components/world/reefHabitat';
import { createSeaweedGeometry, createSeaweedLayout, createForestKelpGeometry } from '../src/components/world/Seaweed';
import { createFloraSites, floraGeometry } from '../src/components/world/Flora';
import { world } from '../src/content/world';

const triangleCount=(geometry:Mesh['geometry'])=>(geometry.index?.count??geometry.attributes.position.count)/3;

test('meadows form broad continuous beds around both cities and keep cave approaches open',()=>{
  const sites=createSeabedMeadowSites(),habitat=getReefHabitat();
  assert.ok(sites.length>6000&&sites.length<6800);
  assert.ok(Array.from({length:16},(_,region)=>sites.filter(site=>site.region===region).length).filter(count=>count>100).length>=12);
  for(const site of sites){
    assert.ok(Math.abs(site.y-marineFloorHeight(site.x,site.z)+.03)<1e-8);
    assert.ok(site.y+site.height<-.35);
    assert.ok(coastalCaveClearance(site.x,site.z,.65)>0);
  }
  const near=samples(sites),occupied=new Set(sites.map(site=>`${Math.floor(site.x/3)},${Math.floor(site.z/3)}`));
  assert.ok(occupied.size>1000,'irregular beds still span over 9,000 square metres of banks and open seabed');
  assert.ok(near.filter(distance=>distance<1.4).length/near.length>.95,'neighboring crowns overlap into meadows');
  for(const site of [...habitat.rocks,...habitat.colonies,...habitat.plants,...habitat.kelp])assert.ok(coastalCaveClearance(site.x,site.z,site.radius)>0);
});
function samples(sites:{x:number;z:number}[]){return sites.filter((_,i)=>i%29===0).map(site=>Math.min(...sites.filter(other=>other!==site).map(other=>Math.hypot(other.x-site.x,other.z-site.z))));}

test('seabed growth forms uneven clumps with sparse recruits and genuinely different leaf anatomy',()=>{
  const sites=createSeabedMeadowSites();assert.deepEqual(sites,createSeabedMeadowSites());
  const spacing=samples(sites).sort((a,b)=>a-b);
  assert.ok(spacing[Math.floor(spacing.length*.25)]<.35,'close siblings form dense crowns');
  assert.ok(spacing[Math.floor(spacing.length*.95)]>.9,'sparse growth remains between patches');
  const cells=new Map<string,number>();for(const site of sites){const key=`${Math.floor(site.x/3)},${Math.floor(site.z/3)}`;cells.set(key,(cells.get(key)??0)+1);}
  const density=[...cells.values()].sort((a,b)=>a-b);
  assert.ok(density[Math.floor(density.length*.9)]>=density[Math.floor(density.length*.1)]*8,'density must vary strongly rather than jittering a planting grid');
  assert.ok(sites.filter(site=>site.cluster<0).length>250,'sparse recruits break up patch boundaries');
  assert.ok(Math.max(...sites.map(site=>site.height))/Math.min(...sites.map(site=>site.height))>6);
  const geometries=SEABED_FORMS.map((_,form)=>meadowGeometry(true,'near',form));
  try{
    assert.equal(new Set(geometries.map(geometry=>geometry.userData.blades)).size,4,'tufts, broad blades, branching ferns and fans have different leaf counts');
    assert.equal(new Set(geometries.map(geometry=>geometry.attributes.position.count)).size,4,'forms change anatomy, not just instance scale');
    assert.ok(new Set(sites.map(site=>site.form)).size===4);
    for(let region=0;region<16;region++){const local=sites.filter(site=>site.region===region);if(local.length>100)assert.equal(new Set(local.map(site=>site.form)).size,4);}
  }finally{geometries.forEach(geometry=>geometry.dispose());}
});

test('island understory follows actual ground and preserves complete walking clearance',()=>{
  const sites=createIslandMeadowSites(),plan=createLandscapePlan();assert.ok(sites.length>4500&&sites.length<4800);
  assert.ok(sites.filter(site=>site.region==='city').length>800);
  assert.ok(sites.filter(site=>site.region==='main').length>750);
  for(const site of sites){
    assert.ok(Math.abs(site.y-terrainMeshHeight(site.x,site.z)+.015)<1e-8);
    assert.ok(vegetationSuitability(site.x,site.z,.29,plan)>.069);
    for(const path of plan.paths)for(let i=1;i<path.points.length;i++)assert.ok(distanceToSegment(site.x,site.z,path.points[i-1],path.points[i])>path.width/2+.29);
  }
});

test('distant meadow geometry retains every blade and a real silhouette at half the triangles',()=>{
  for(const water of [false,true]){
    const near=meadowGeometry(water),far=meadowGeometry(water,'far');
    try{
      assert.equal(near.userData.blades,far.userData.blades);
      assert.equal(triangleCount(far),triangleCount(near)/2);
      for(const geometry of [near,far]){
        const p=geometry.attributes.position,index=geometry.index!,a=new Vector3(),b=new Vector3(),c=new Vector3();
        for(let i=0;i<index.count;i+=3){a.fromBufferAttribute(p,index.getX(i));b.fromBufferAttribute(p,index.getX(i+1));c.fromBufferAttribute(p,index.getX(i+2));assert.ok(b.sub(a).cross(c.sub(a)).length()>.00001,'far ribbons must not collapse to zero-width lines');}
      }
    }finally{near.dispose();far.dispose();}
  }
});

test('seabed chunks retain density through LOD and cull the opposite coast in a detail view',()=>{
  const scene=createSeabedMeadows();
  try{
    assert.equal(scene.batches.length,8*SEABED_FORMS.length);assert.equal(new Set(scene.batches.map(mesh=>mesh.geometry)).size,SEABED_FORMS.length);
    const population=scene.batches.map(mesh=>mesh.count),near=scene.batches[0].geometry;
    scene.setQuality('medium');const far=scene.batches[0].geometry;
    assert.ok(triangleCount(far)<triangleCount(near));assert.deepEqual(scene.batches.map(mesh=>mesh.count),population);
    scene.setQuality('high');assert.equal(scene.batches[0].geometry,near);scene.setQuality('medium');assert.equal(scene.batches[0].geometry,far);
    const visible=(position:number[],target:number[])=>{
      const camera=new PerspectiveCamera(45,16/9,.1,700);camera.position.fromArray(position);camera.lookAt(new Vector3(...target));camera.updateMatrixWorld();
      const frustum=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));scene.root.updateMatrixWorld(true);
      return scene.batches.filter(mesh=>frustum.intersectsObject(mesh)).reduce((sum,mesh)=>sum+mesh.count*triangleCount(mesh.geometry),0);
    };
    const total=scene.batches.reduce((sum,mesh)=>sum+mesh.count*triangleCount(mesh.geometry),0);
    const overview=visible(world.overview.position,world.overview.target),dock=visible([0,5,-49],[-8,-1,-62]);
    assert.ok(overview>0&&overview<=total);assert.ok(dock<total*.75,'the city dock view does not draw every distant seabed patch');
    console.log({seabedMediumTotal:total,overviewVisible:overview,cityDockVisible:dock});
  }finally{scene.dispose();}
});

test('main building vines grow from the soil against measured walls with five distinct habits',()=>{
  const sites=frontVineSites(),scene=createFrontGardens();
  try{
    assert.equal(sites.length,30);assert.equal(new Set(sites.map(site=>vineHabit(site.seed))).size,5);
    assert.equal(new Set(sites.map(site=>site.building)).size,5);assert.equal(scene.root.children.length,5);
    let triangles=0;scene.root.traverse(object=>{if(object instanceof Mesh)triangles+=triangleCount(object.geometry);});assert.ok(triangles<105000);
    for(const site of sites){
      assert.ok(Math.abs(site.y-terrainMeshHeight(site.x,site.z)+.015)<1e-8);
      const vine=createFacadeGarden(site),positions=vine.wood.attributes.position;
      // The main stem remains on the wall; outlying leaves may curl away from it.
      for(let i=0;i<19*5;i++)assert.ok(Math.abs(positions.getZ(i))<.065);
      Object.values(vine).forEach(geometry=>geometry.dispose());
    }
  }finally{scene.dispose();}
});

test('medium plant geometry remains below one million triangles without deleting meadow roots',()=>{
  const sea=createSeaweedLayout(),flora=createFloraSites(),reef=getReefHabitat(),shapes=new Map<string,Mesh['geometry']>();
  const geometry=(id:string,make:()=>Mesh['geometry'])=>{if(!shapes.has(id))shapes.set(id,make());return shapes.get(id)!;};
  try{
    const triangles=sea.reduce((sum,site)=>sum+triangleCount(geometry(`sea${site.variant}`,()=>createSeaweedGeometry(site.variant,0,'far')))*.75,0)
      +flora.reduce((sum,site)=>sum+triangleCount(geometry(`flora${site.kind}`,()=>floraGeometry(site.kind,'far')))*.7,0)
      +reef.plants.reduce((sum,site)=>sum+triangleCount(geometry(`sea${site.form}`,()=>createSeaweedGeometry(site.form,0,'far')))*.76,0)
      +reef.kelp.reduce((sum,site)=>sum+triangleCount(geometry(`kelp${site.form}`,()=>createForestKelpGeometry(site.form,'far')))*.76,0)
      +createSeabedMeadowSites().reduce((sum,site)=>sum+triangleCount(geometry(`water${site.form}`,()=>meadowGeometry(true,'far',site.form))),0)
      +createIslandMeadowSites().reduce((sum,site)=>sum+triangleCount(geometry(`ground${site.form}`,()=>meadowGeometry(false,'far',site.form))),0)+100000+10000;
    assert.ok(triangles<1000000,`${triangles} medium foliage triangles including the main wall vines and dock growth`);
  }finally{shapes.forEach(geometry=>geometry.dispose());}
});
