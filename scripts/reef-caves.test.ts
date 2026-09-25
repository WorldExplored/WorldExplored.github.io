import assert from 'node:assert/strict';
import test from 'node:test';
import { DoubleSide, InstancedMesh, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { caveVisitorPose, createReefCaveSites } from '../src/components/world/reefCaveState';
import { createReefCaves, reefCaveGeometry } from '../src/components/world/ReefCaves';
import { getReefHabitat, marineFloorHeight } from '../src/components/world/reefHabitat';
import { landDistance } from '../src/components/world/terrain';

test('reef caves have real open mouths and complete solid roofs with visible interior surfaces',()=>{
  const material=new MeshStandardMaterial({side:DoubleSide});
  for(let form=0;form<3;form++){
    const geometry=reefCaveGeometry(form),mesh=new Mesh(geometry,material);mesh.updateMatrixWorld();
    try{
      assert.equal(geometry.userData.openTunnel,true);
      assert.equal(new Raycaster(new Vector3(0,.42,3),new Vector3(0,0,-1)).intersectObject(mesh).length,0,'a clear through-hole has no cap or dark disk');
      assert.ok(new Raycaster(new Vector3(0,.42,0),new Vector3(0,1,0)).intersectObject(mesh).length>=2,'an inner and outer rock roof surround the tunnel');
      const p=geometry.attributes.position;for(const value of p.array)assert.ok(Number.isFinite(value));
    }finally{geometry.dispose();}
  }
  material.dispose();
});

test('caves and complete ten-minute animal cycles remain grounded, underwater and clear of the reef',()=>{
  const sites=createReefCaveSites(),habitat=getReefHabitat();
  assert.equal(sites.length,3);assert.equal(new Set(sites.map(site=>site.scale)).size,3);
  const blockers=[...habitat.rocks,...habitat.colonies,...habitat.kelp.map(plant=>({...plant,radius:plant.width*.55}))];
  for(const site of sites){
    const nearby=blockers.filter(blocker=>Math.hypot(blocker.x-site.x,blocker.z-site.z)<blocker.radius+8*site.scale);
    assert.ok(site.y<marineFloorHeight(site.x,site.z));
    const geometry=reefCaveGeometry(site.form),vertices=geometry.attributes.position;
    for(let i=0;i<vertices.count;i++)if(vertices.getY(i)<.001){
      const lx=vertices.getX(i)*site.scale,lz=vertices.getZ(i)*site.scale;
      const x=site.x+lx*Math.cos(site.yaw)+lz*Math.sin(site.yaw),z=site.z-lx*Math.sin(site.yaw)+lz*Math.cos(site.yaw);
      assert.ok(site.y<marineFloorHeight(x,z)+.001,'each sidewall is seated below the visible sand');
    }
    geometry.dispose();
    for(const blocker of blockers)assert.ok(Math.hypot(blocker.x-site.x,blocker.z-site.z)>blocker.radius+2.2*site.scale);
    for(let index=0;index<=3;index++){
      let exits=0,rests=0,previous=caveVisitorPose(site,index,0);
      for(let time=0;time<600;time+=.1){
        const pose=caveVisitorPose(site,index,time);
        assert.ok(pose.y>marineFloorHeight(pose.x,pose.z)+.15&&pose.y< -1.8);
        assert.ok(landDistance(pose.x,pose.z)<-5);
        assert.ok(Math.hypot(pose.x-previous.x,pose.y-previous.y,pose.z-previous.z)<.075,'no route teleport');
        for(const blocker of nearby)assert.ok(Math.hypot(blocker.x-pose.x,blocker.z-pose.z)>blocker.radius+.09);
        if(Math.hypot(pose.x-site.x,pose.z-site.z)>site.scale*3)exits++;
        if(!pose.swimming)rests++;
        previous=pose;
      }
      assert.ok(exits>100&&rests>100,'visitors leave and return to a real home');
    }
  }
});

test('three caves and their visitors retain eight draws, resources, and pause behavior',()=>{
  const caves=createReefCaves();
  try{
    const meshes:Mesh[]=[];caves.root.traverse(object=>{if(object instanceof Mesh)meshes.push(object);});
    assert.equal(meshes.length,8);
    const geometry=meshes.map(mesh=>mesh.geometry);let triangles=0;
    for(const mesh of meshes)triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3*(mesh instanceof InstancedMesh?mesh.count:1);
    assert.ok(triangles<12000,`${triangles} cave triangles`);
    const moving=meshes.filter(mesh=>mesh instanceof InstancedMesh) as InstancedMesh[];
    caves.update(32);const matrices=moving.map(mesh=>mesh.instanceMatrix.array.slice());
    caves.update(70,true);moving.forEach((mesh,index)=>assert.deepEqual(mesh.instanceMatrix.array,matrices[index]));
    caves.setQuality('low');assert.equal((caves.root.getObjectByName('cave-minnow-bodies') as InstancedMesh).count,6);
    assert.deepEqual(meshes.map(mesh=>mesh.geometry),geometry);
    caves.update(71);assert.notDeepEqual(moving[0].instanceMatrix.array,matrices[0]);
  }finally{caves.dispose();}
});
