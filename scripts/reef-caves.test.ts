import assert from 'node:assert/strict';
import test from 'node:test';
import { DoubleSide, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Raycaster, Vector3 } from 'three';
import { caveGroundLocal, caveVisitorPose, caveWorldPoint, createReefCaveSites } from '../src/components/world/reefCaveState';
import { coastalBankCaveGeometry, createCaveEelGeometry, createReefCaves } from '../src/components/world/ReefCaves';
import { reefSeafloorGeometry } from '../src/components/world/ReefHabitatScene';
import { getReefHabitat, marineFloorHeight } from '../src/components/world/reefHabitat';
import { COASTAL_CAVE_LAYOUT, coastalCaveFloor } from '../src/components/world/coastalCaveLayout';
import { archipelagoGeometry, terrainBaseHeight, terrainMeshHeight } from '../src/components/world/terrain';

const angleDistance=(a:number,b:number)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));

test('coastal mouths reveal recessed interiors through the actual island and seabed meshes',()=>{
  const sites=createReefCaveSites(),material=new MeshStandardMaterial({side:DoubleSide});
  const terrain=new Mesh(archipelagoGeometry(),material),floor=new Mesh(reefSeafloorGeometry(),material);
  terrain.updateMatrixWorld();floor.updateMatrixWorld();
  assert.equal(sites.filter(site=>site.kind==='bank').length,4);
  assert.equal(sites.filter(site=>site.kind==='overhang').length,0);
  try{
    for(const site of sites.filter(site=>site.kind==='bank')){
      const geometry=coastalBankCaveGeometry(site),mesh=new Mesh(geometry,material);
      mesh.position.set(site.x,site.y,site.z);mesh.rotation.y=site.yaw;mesh.scale.setScalar(site.scale);mesh.updateMatrixWorld();
      try{
        assert.ok(geometry.userData.recessDepth>2,'interior extends into the coastal bank');
        assert.ok(geometry.userData.mouthWidth>2,'entrance has room for the resident eel to turn');
        const vertices=geometry.attributes.position;
        for(const value of vertices.array)assert.ok(Number.isFinite(value));
        const {nx,nz}=geometry.userData.shelfGrid as {nx:number;nz:number};
        for(let row=0;row<=nz;row++)for(const col of [0,nx]){
          const index=row*(nx+1)+col,x=vertices.getX(index),z=vertices.getZ(index);
          assert.ok(vertices.getY(index)<=caveGroundLocal(site,x,z)+.014,'outer skirts meet or bury into the existing coastal slope');
        }
        let highest=-Infinity;
        for(let i=0;i<vertices.count;i++)highest=Math.max(highest,vertices.getY(i)*site.scale+site.y);
        assert.ok(highest<-.4,'the rock shelf never becomes a sandy dome above water');
        assert.ok(geometry.boundingBox!.max.x-geometry.boundingBox!.min.x<6.8,'the opening stays in a modest coastal shelf, not a broad semicircular block');
        for(const [distance,cameraHeight,recess,lift] of [[18,3,1,.65],[18,3.5,1,.65],[18,4,1,.65],[24,4,1,.65],[30,4,1,.65]]){
          const c=caveWorldPoint(site,0,distance),inside=caveWorldPoint(site,0,-recess);
          const origin=new Vector3(c.x,cameraHeight,c.z),target=new Vector3(inside.x,marineFloorHeight(inside.x,inside.z)+lift,inside.z);
          const length=origin.distanceTo(target),ray=new Raycaster(origin,target.clone().sub(origin).normalize());
          for(const [name,object] of [['original island',terrain],['original reef apron',floor],['new cave bank',mesh]] as const){
            const hit=ray.intersectObject(object)[0];
            assert.ok(!hit||hit.distance>length+.1,`${name} must not plug the above-water view into cave ${site.form}`);
          }
          const back=ray.intersectObject(mesh)[0];
          assert.ok(back&&back.distance<length+2,'a recessed stone interior remains visible beyond the entrance');
        }
      }finally{geometry.dispose();}
    }
  }finally{terrain.geometry.dispose();floor.geometry.dispose();material.dispose();}
});

test('complete ten-minute animal cycles remain below boats and clear of the integrated reef',()=>{
  const sites=createReefCaveSites(),habitat=getReefHabitat();
  const blockers=[...habitat.rocks,...habitat.colonies,...habitat.kelp.map(plant=>({...plant,radius:plant.width*.55}))];
  for(const site of sites){
    const nearby=blockers.filter(blocker=>Math.hypot(blocker.x-site.x,blocker.z-site.z)<blocker.radius+8*site.scale);
    for(let index=0;index<=3;index++){
      let exits=0,rests=0,previous=caveVisitorPose(site,index,0);
      for(let time=0;time<600;time+=.1){
        const pose=caveVisitorPose(site,index,time);
        assert.ok(pose.y>marineFloorHeight(pose.x,pose.z)+.15&&pose.y< -1.6,'all residents stay below the .45m boat draft');
        assert.ok(Math.hypot(pose.x-previous.x,pose.y-previous.y,pose.z-previous.z)<.08,'no route teleport');
        for(const blocker of nearby)assert.ok(Math.hypot(blocker.x-pose.x,blocker.z-pose.z)>blocker.radius+.09,'resident route clears the filtered reef habitat');
        if(!pose.swimming&&!previous.swimming)assert.ok(angleDistance(pose.heading,previous.heading)<.07,'resting animals turn gradually within the recess');
        if(Math.hypot(pose.x-site.x,pose.z-site.z)>site.scale*3)exits++;
        if(!pose.swimming)rests++;
        previous=pose;
      }
      assert.ok(exits>100&&rests>100,'visitors leave and return to a real home');
    }
  }
});

test('the animated eel body, including its turning tail, fits inside every coastal tunnel',()=>{
  const material=new MeshStandardMaterial({side:DoubleSide}),eel=createCaveEelGeometry(),transform=new Object3D(),point=new Vector3();
  try{
    for(const site of createReefCaveSites().filter(site=>site.kind==='bank')){
      const geometry=coastalBankCaveGeometry(site),cave=new Mesh(geometry,material);
      cave.position.set(site.x,site.y,site.z);cave.rotation.y=site.yaw;cave.scale.setScalar(site.scale);cave.updateMatrixWorld();
      try{
        for(let time=0;time<site.period;time+=.4){
          const pose=caveVisitorPose(site,0,time);transform.position.set(pose.x,pose.y,pose.z);transform.rotation.set(0,pose.heading,pose.pitch,'YXZ');transform.scale.setScalar(site.scale);transform.updateMatrix();
          for(let vertex=0;vertex<eel.attributes.position.count;vertex+=2){
            point.fromBufferAttribute(eel.attributes.position,vertex);
            point.z+=Math.sin(time*3.3+point.x*11+pose.x)*(-point.x/.88)**2*.095;
            point.applyMatrix4(transform.matrix);
            assert.ok(point.y>marineFloorHeight(point.x,point.z)+.15,'tail follows the sloping floor');
            const length=point.distanceTo(transform.position),ray=new Raycaster(transform.position,point.clone().sub(transform.position).normalize(),.001,length);
            assert.equal(ray.intersectObject(cave).length,0,`eel clips cave ${site.form} at ${time.toFixed(1)}s`);
          }
        }
      }finally{geometry.dispose();}
    }
  }finally{eel.dispose();material.dispose();}
});

test('four embedded coastal banks retain nine draws, resources, and pause behavior',()=>{
  const caves=createReefCaves();
  try{
    const meshes:Mesh[]=[];caves.root.traverse(object=>{if(object instanceof Mesh)meshes.push(object);});
    assert.equal(meshes.length,9);
    const geometry=meshes.map(mesh=>mesh.geometry);let triangles=0;
    for(const mesh of meshes)triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3*(mesh instanceof InstancedMesh?mesh.count:1);
    assert.ok(triangles<14000,`${triangles} cave triangles`);
    const moving=meshes.filter(mesh=>mesh instanceof InstancedMesh) as InstancedMesh[];
    caves.update(32);const matrices=moving.map(mesh=>mesh.instanceMatrix.array.slice());
    caves.update(70,true);moving.forEach((mesh,index)=>assert.deepEqual(mesh.instanceMatrix.array,matrices[index]));
    caves.setQuality('low');assert.equal((caves.root.getObjectByName('cave-minnow-bodies') as InstancedMesh).count,4);
    assert.deepEqual(meshes.map(mesh=>mesh.geometry),geometry);
    caves.update(71);assert.notDeepEqual(moving[0].instanceMatrix.array,matrices[0]);
  }finally{caves.dispose();}
});


test('expanded cave entrances cut a local floor into the coast without moving the surrounding bank',()=>{
  const widths=new Set<number>();
  for(const site of createReefCaveSites()){
    const geometry=coastalBankCaveGeometry(site);
    try{widths.add(geometry.userData.mouthWidth);assert.ok(geometry.userData.mouthWidth>2.7,'wide entrances remain readable from above water');}
    finally{geometry.dispose();}
    const inside=caveWorldPoint(site,0,-1.3),outside=caveWorldPoint(site,5,-1.3);
    assert.ok(terrainMeshHeight(inside.x,inside.z)<terrainBaseHeight(inside.x,inside.z)-.2,'the original shore slope is genuinely recessed');
    assert.ok(terrainMeshHeight(inside.x,inside.z)<=-2.2,'the rendered floor stays below the visible tunnel interior');
    assert.equal(coastalCaveFloor(outside.x,outside.z,-1),-1,'surrounding coast remains unchanged');
    assert.ok(COASTAL_CAVE_LAYOUT.some(layout=>Math.hypot(site.x-layout.x,site.z-layout.z)<.001));
  }
  assert.equal(widths.size,4,'each mouth has a distinct span and silhouette');
});
