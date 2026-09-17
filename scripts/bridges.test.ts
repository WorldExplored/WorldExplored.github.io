import test from 'node:test';
import assert from 'node:assert/strict';
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { BRIDGES, bridgeHeightAt } from '../src/components/world/bridgePlan';
import { createBridges } from '../src/components/world/Bridges';
import { architectureFootprints, archipelagoGeometry, terrainHeight, terrainMeshHeight } from '../src/components/world/terrain';
import { world } from '../src/content/world';

const insideLanding = (x:number,z:number,bridge:typeof BRIDGES[number]) => bridge.landings.some(p=>Math.hypot(x-p.x,z-p.z)<=p.radius+.03);
test('actual bridge deck vertices clear final terrain triangles and every landmark footprint', () => {
  const terrain = new Mesh(archipelagoGeometry(),new MeshBasicMaterial({side:DoubleSide}));terrain.updateMatrixWorld();
  const ray = new Raycaster(new Vector3(),new Vector3(0,-1,0));
  const bridges=createBridges();
  try {
    for(const bridge of BRIDGES){
      const mesh=bridges.root.getObjectByName(`bridge-${bridge.id}-deck`) as Mesh;
      const vertices=mesh.geometry.attributes.position;
      for(let i=0;i<vertices.count;i++){
        const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i);
        for(const solid of architectureFootprints())assert.ok(Math.hypot(x-solid.x,z-solid.z)>solid.radius+.08,`${bridge.id} enters ${solid.id}`);
        if(insideLanding(x,z,bridge))continue;
        ray.ray.origin.set(x,100,z);const ground=ray.intersectObject(terrain)[0]?.point.y??-5;
        assert.ok(y>ground+.015,`${bridge.id} deck ${i} (${x},${y},${z}) intersects ground ${ground}`);
        assert.ok(y>.7);
      }
      for(const side of [-1,1]){
        const rail=bridges.root.getObjectByName(`bridge-${bridge.id}-rail-${side}`) as Mesh;
        const points=rail.geometry.attributes.position;
        for(let i=0;i<points.count;i++){
          const separation=points.getY(i)-bridgeHeightAt(bridge,points.getX(i),points.getZ(i));
          assert.ok(Math.abs(separation-bridge.railHeight)<.065,`${bridge.id} detached rail ${separation}`);
        }
      }
      for(const landing of bridge.landings){
        // The approach is now the graded ground itself, meeting the pad top.
        const sample=bridge.samples[landing===bridge.landings[0]?0:96],side=sample.normal;
        for(const offset of [-.45,0,.45])assert.ok(Math.abs(terrainMeshHeight(landing.x+side.x*offset,landing.z+side.z*offset)-landing.top)<.005,`${bridge.id}: ground does not meet landing width`);
      }
      for(const [i,landing] of bridge.landings.entries()){
        mesh.geometry.computeBoundingBox();
        const endpoint=bridge.samples[i?96:0].point;
        assert.equal(endpoint.y,landing.top);assert.ok(Math.hypot(endpoint.x-landing.x,endpoint.z-landing.z)<1e-8);
      }
    }
    bridges.root.traverse(object=>{
      if(!(object instanceof Mesh)||!object.name.includes('-support-'))return;
      const box=object.geometry.boundingBox;object.geometry.computeBoundingBox();const b=box??object.geometry.boundingBox!;
      const center=b.getCenter(new Vector3());
      assert.ok(b.min.y<=terrainHeight(center.x,center.z));
      for(const solid of architectureFootprints())assert.ok(Math.hypot(center.x-solid.x,center.z-solid.z)>solid.radius+.2);
    });
  }finally{bridges.dispose();terrain.geometry.dispose();(terrain.material as MeshBasicMaterial).dispose();}
});
test('Purdue faces its separated arrival plaza',()=>{
  const config=world.landmarks.find(p=>p.id==='purdue')!;const landing=BRIDGES.find(p=>p.id==='purdue')!.landings[1];
  const approach=new Vector3(landing.x-config.position[0],0,landing.z-config.position[2]).normalize();
  assert.ok(approach.dot(new Vector3(Math.sin(config.rotationY??0),0,Math.cos(config.rotationY??0)))>.99);
  assert.ok(Math.hypot(landing.x-config.position[0],landing.z-config.position[2])>landing.radius+2.8);
});

test('bridge mouths contain one walkable surface with no competing ground or round cap',()=>{
  const material=new MeshBasicMaterial({side:DoubleSide}),ground=new Mesh(archipelagoGeometry(),material),bridges=createBridges();ground.updateMatrixWorld();bridges.root.updateMatrixWorld(true);
  const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
  try{
    assert.ok(bridges.root.children.every(mesh=>!mesh.name.includes('landing-cap')));
    for(const bridge of BRIDGES)for(const end of [false,true])for(const index of [1,3,5,7]){
      const sample=bridge.samples[end?bridge.samples.length-1-index:index];
      for(const across of [-.35,0,.35]){
        ray.ray.origin.copy(sample.point).addScaledVector(sample.normal,across).setY(30);
        const terrain=ray.intersectObject(ground)[0];
        assert.ok(!terrain||terrain.point.y<sample.point.y-.03,'Terrain is cut beneath the bridge mouth');
        const deck=bridges.root.getObjectByName(`bridge-${bridge.id}-deck`)!;deck.raycast=Mesh.prototype.raycast;
        const hit=ray.intersectObject(deck)[0];assert.ok(hit&&Math.abs(hit.point.y-sample.point.y)<.001,'The connected deck owns the walking surface');
      }
    }
  }finally{ground.geometry.dispose();material.dispose();bridges.dispose();}
});
