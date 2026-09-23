import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, Vector3, Matrix4, InstancedMesh } from 'three';
import { createCoastalFerry, ferryPontoonGeometry } from '../src/components/world/CoastalFerry';
import { createCityFerryRoute, FERRY_DWELL, cityFerryDistance } from '../src/components/world/cityInfrastructure';
import { treeBranches, treeFoliageGeometry, treeWoodGeometry } from '../src/components/world/TreeGeometry';
import { makeHistoryMuseum } from '../src/components/world/CivicLandmarks';
import { createFacadeGarden } from '../src/components/world/FacadeGarden';
import { tuftGeometry } from '../src/components/world/AmbientSystem';
import { createShoreDetails } from '../src/components/world/ShoreDetails';
import { createLandscapePlan, terrainMeshHeight, distanceToSegment, islandAt, ISLANDS } from '../src/components/world/terrain';
import { createSeaweedGeometry } from '../src/components/world/Seaweed';

test('ferry hull displaces water and fittings remain on one rigid vessel hierarchy',()=>{
  const ferry=createCoastalFerry();
  try{
    const hull=ferry.root.getObjectByName('ferry-twin-displacement-hulls') as Mesh;
    hull.geometry.computeBoundingBox();const bounds=hull.geometry.boundingBox!;
    assert.ok(bounds.min.y+ferry.root.position.y<-.08,'keel is immersed');
    assert.ok(bounds.max.y+ferry.root.position.y>.4,'hull meets deck underside');
    const expected=['ferry-supported-curved-canopy','ferry-cabin-glazing','ferry-seats-and-helm','ferry-mounted-fenders','ferry-port-navigation-light','ferry-starboard-navigation-light','ferry-electric-drive-and-dock-cleats'];
    for(const name of expected){const mesh=ferry.root.getObjectByName(name);assert.ok(mesh);assert.equal(mesh.parent,ferry.root);}
    ferry.root.traverse(node=>{if(node instanceof Mesh){assert.notEqual(node.geometry.type,'SphereGeometry');for(const value of node.geometry.getAttribute('position').array)assert.ok(Number.isFinite(value));}});
    const origin=ferry.root.position.clone();for(let t=0;t<FERRY_DWELL;t+=.1){const pose=ferry.update(t);assert.ok(pose.position.distanceTo(origin)<1e-8);assert.equal(pose.speed,0);}
    const previous=ferry.root.position.clone();let moving=false;
    for(let t=FERRY_DWELL;t<ferry.route.duration;t+=1/60){
      const pose=ferry.update(t);assert.ok(pose.position.distanceTo(previous)<.033);assert.ok(Math.abs(pose.position.y-.17)<1e-8);
      assert.ok(pose.speed<=ferry.route.speed+.001);moving ||=pose.speed>1.5;previous.copy(pose.position);
    }
    assert.ok(moving);ferry.update(18);const transforms:string[]=[];ferry.root.traverse(node=>transforms.push(JSON.stringify([node.position,node.quaternion,node.scale])));
    ferry.update(200,true);const paused:string[]=[];ferry.root.traverse(node=>paused.push(JSON.stringify([node.position,node.quaternion,node.scale])));assert.deepEqual(paused,transforms);assert.equal(ferry.root.userData.speed,0);
  }finally{ferry.dispose();}
});

test('ferry bow narrows and dock speed settles continuously at both stations',()=>{
  const geometry=ferryPontoonGeometry(),positions=geometry.getAttribute('position');
  const widthAt=(minimum:number,maximum:number)=>{let result=0;for(let i=0;i<positions.count;i++)if(positions.getZ(i)>=minimum&&positions.getZ(i)<=maximum)result=Math.max(result,Math.abs(positions.getX(i)));return result;};
  assert.ok(widthAt(1.1,1.3)<widthAt(-.4,.4)*.4);geometry.dispose();
  const route=createCityFerryRoute();for(const t of [0,route.firstDuration])assert.ok(Math.abs(cityFerryDistance(route,t+.1)-cityFerryDistance(route,t))<1e-9);
});

test('botanical assets have different crown envelopes, raised leaf midribs and distinct submerged forms',()=>{
  const envelopes=[0,1,2].map(form=>treeBranches(form).map(branch=>branch.tip.toArray()));assert.notDeepEqual(envelopes[0],envelopes[1]);assert.notDeepEqual(envelopes[1],envelopes[2]);
  const foliage=treeFoliageGeometry();const vertices=foliage.getAttribute('position');
  assert.ok(vertices.count<1200,'shared crown geometry remains within the previous draw budget');
  for(let leaf=0;leaf<64;leaf++){
    const edgeA=new Vector3().fromBufferAttribute(vertices,leaf*15+6),rib=new Vector3().fromBufferAttribute(vertices,leaf*15+7),edgeB=new Vector3().fromBufferAttribute(vertices,leaf*15+8);
    assert.ok(rib.distanceTo(edgeA.clone().lerp(edgeB,.5))>.02,'leaf has cupped depth');
  }
  foliage.dispose();[0,1,2].forEach(form=>{const wood=treeWoodGeometry(form);wood.computeBoundingBox();assert.ok(wood.boundingBox!.min.y<0);wood.dispose();});
  const seaweed=[0,1,2].map(createSeaweedGeometry);assert.equal(new Set(seaweed.map(g=>g.userData.form)).size,3);seaweed.forEach(g=>g.dispose());
});


test('organic vines have cupped leaves, ground roots and no rectangular trellis', () => {
  const garden = createFacadeGarden({ width: .9, height: 2.1, seed: 7 });
  try {
    garden.planter.computeBoundingBox();
    assert.equal(garden.trellis.attributes.position.count,0);
    assert.ok(garden.planter.boundingBox!.max.x-garden.planter.boundingBox!.min.x<.34,'root mound is not a full-width planter box');
    assert.ok(Math.abs(garden.planter.boundingBox!.min.y) < 1e-6);
    const leaves = garden.foliage.attributes.position;
    garden.foliage.computeBoundingBox();
    assert.ok(garden.foliage.boundingBox!.max.y > 1.8);
    assert.ok(garden.foliage.boundingBox!.max.x - garden.foliage.boundingBox!.min.x > .7);
    for (let i = 0; i < leaves.count; i++) assert.ok(Number.isFinite(leaves.getX(i)) && Number.isFinite(leaves.getY(i)) && Number.isFinite(leaves.getZ(i)));
    assert.ok(garden.foliage.boundingBox!.max.z - garden.foliage.boundingBox!.min.z > .1, 'leaves have depth rather than a flat wall decal');
    assert.ok(garden.fruit.attributes.position.count > 100);
  } finally { Object.values(garden).forEach(geometry => geometry.dispose()); }
});

test('History detailing provides actual artifacts, drainage and grounded facade gardens', () => {
  const geometry = makeHistoryMuseum();
  try {
    const names = ['details', 'exhibits', 'exhibitFrames', 'planting', 'plantingWood', 'plantingBeds'] as const;
    let triangles = 0;
    for (const name of names) {
      const mesh = geometry[name]; mesh.computeBoundingBox();
      assert.ok(mesh.attributes.position.count > 12);
      for (const value of mesh.attributes.position.array) assert.ok(Number.isFinite(value));
      triangles += (mesh.index?.count ?? mesh.attributes.position.count) / 3;
    }
    assert.ok(Math.abs(geometry.plantingBeds.boundingBox!.min.y - 1.01) < 1e-5);
    assert.ok(geometry.exhibits.boundingBox!.min.y > 4.85, 'artifacts stand on gallery case plinths');
    assert.ok(triangles < 30000, `History added ${triangles} triangles`);
  } finally { Object.values(geometry).forEach(value => value.dispose()); }
});


test('vine seeds vary canopy outlines and stems begin at the actual planting ground',()=>{
  const gardens=[3,8,13,26].map(seed=>createFacadeGarden({width:.8,height:5,seed}));
  try {
    const outlines=gardens.map(garden=>{
      garden.wood.computeBoundingBox();assert.ok(garden.wood.boundingBox!.min.y<.015);
      const positions=garden.foliage.attributes.position,slices=Array.from({length:8},()=>[Infinity,-Infinity]);
      for(let i=0;i<positions.count;i++){
        const index=Math.max(0,Math.min(7,Math.floor(positions.getY(i)/5*8)));slices[index][0]=Math.min(slices[index][0],positions.getX(i));slices[index][1]=Math.max(slices[index][1],positions.getX(i));
      }
      const widths=slices.map(([min,max])=>max-min).filter(Number.isFinite);
      assert.ok(Math.max(...widths)-Math.min(...widths)>.12,'vine branches form a changing silhouette');return slices;
    });
    assert.equal(new Set(outlines.map(outline=>JSON.stringify(outline))).size,4);
  } finally {gardens.forEach(garden=>Object.values(garden).forEach(geometry=>geometry.dispose()));}
});

test('fine grass tufts have mixed blade heights and retain their reserved footprint',()=>{
  const geometry=tuftGeometry(),vertices=geometry.attributes.position;
  try {
    assert.equal(vertices.count,70);const heights=[];
    for(let blade=0;blade<10;blade++)heights.push(vertices.getY(blade*7+6));
    assert.equal(new Set(heights).size,10);assert.ok(Math.max(...heights)-Math.min(...heights)>.28);
    for(let i=0;i<vertices.count;i++)assert.ok(Math.hypot(vertices.getX(i),vertices.getZ(i))<.5);
    assert.ok(geometry.index!.count/3<=50);
  } finally {geometry.dispose();}
});

test('mineral, shell and wrack patches span every island, rooted to the beach and clear of circulation',()=>{
  const plan=createLandscapePlan(),shore=createShoreDetails(plan),matrix=new Matrix4(),position=new Vector3();let triangles=0;
  try {
    assert.equal(shore.root.children.length,6);
    for(const object of shore.root.children){
      const batch=object as InstancedMesh,regions=new Set<string>();
      assert.ok(batch.count>=28);triangles+=batch.count*(batch.geometry.index?.count??batch.geometry.attributes.position.count)/3;
      for(let i=0;i<batch.count;i++){
        batch.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);regions.add(islandAt(position.x,position.z).island.id);
        const offset=batch.name==='beached-driftwood'?.04:.005;
        assert.ok(Math.abs(position.y-terrainMeshHeight(position.x,position.z)-offset)<.00002);
        for(const path of plan.paths)for(let segment=1;segment<path.points.length;segment++)assert.ok(distanceToSegment(position.x,position.z,path.points[segment-1],path.points[segment])>path.width/2+.6999);
      }
      assert.equal(regions.size,ISLANDS.length);
    }
    assert.ok(triangles<100000,`${triangles} strandline triangles`);
  } finally {shore.dispose();}
});
