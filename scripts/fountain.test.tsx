import test from 'node:test';
import assert from 'node:assert/strict';
import { act, create } from '@react-three/test-renderer';
import { InstancedMesh, Matrix4, Mesh, MeshPhysicalMaterial, Raycaster, Vector3 } from 'three';
import { createSceneRuntime, type QualityTier } from '../src/content/world';
import { createGardenFountain, FOUNTAIN_SITE, fountainStreamPoint, GardenFountain } from '../src/components/world/GardenFountain';
import { terrainHeight } from '../src/components/world/terrain';

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});

test('fountain is an open pearl basin containing transparent water and six source-to-basin streams',()=>{
  const fountain=createGardenFountain();
  try {
    assert.equal(fountain.meshes.length,10);
    assert.equal(fountain.group.position.y,terrainHeight(FOUNTAIN_SITE.x,FOUNTAIN_SITE.z));
    const basin=fountain.meshes.find(mesh=>mesh.name==='fountain-open-stone-basin')!;
    const rayMesh=new Mesh(basin.geometry,basin.material);rayMesh.updateMatrixWorld();
    const ray=new Raycaster(new Vector3(0,2,0),new Vector3(0,-1,0));
    const floor=ray.intersectObject(rayMesh,false)[0];assert.ok(floor);assert.ok(Math.abs(floor.point.y-.08)<1e-5,'center is a real hollow basin, not a capped cylinder');
    ray.set(new Vector3(1.03,2,0),new Vector3(0,-1,0));const rim=ray.intersectObject(rayMesh,false)[0];assert.ok(rim);assert.ok(Math.abs(rim.point.y-.47)<1e-5);
    assert.equal(fountain.materials[0].roughness,.3);assert.equal(fountain.materials[0].metalness,.08);
    const water=fountain.meshes.find(mesh=>mesh.name==='fountain-transparent-water-surface')!.material as MeshPhysicalMaterial;
    assert.ok(water.transparent&&water.opacity<.75&&water.transmission===0&&water.clearcoat>.5&&water.ior===1.333);assert.ok(water.roughness<.2);
    const streams=fountain.meshes.find(mesh=>mesh.name==='fountain-six-returning-water-streams')!;
    assert.ok((streams.material as MeshPhysicalMaterial).transparent);
    for(let jet=0;jet<6;jet++)for(let sample=0;sample<=100;sample++) {
      const point=fountainStreamPoint(jet,sample/100);assert.ok(point.toArray().every(Number.isFinite));assert.ok(Math.hypot(point.x,point.z)<=.710001);assert.ok(point.y>=FOUNTAIN_SITE.waterHeight);
      if(sample===0)assert.ok(Math.abs(point.y-.37)<1e-9);
      if(sample===100)assert.ok(Math.abs(point.y-FOUNTAIN_SITE.waterHeight)<1e-9,'water returns to the surface inside the basin');
    }
    assert.ok(fountainStreamPoint(0,.5).y>.95,'jet has a clear curved arch');
    const hits:unknown[]=[];fountain.meshes.forEach(mesh=>mesh.raycast({} as never,hits as never));assert.equal(hits.length,0);
  } finally {fountain.dispose();}
});

test('five minutes of fountain motion remains within the basin and resources dispose exactly once',()=>{
  const fountain=createGardenFountain();const matrix=new Matrix4();const point=new Vector3();const disposed:number[]=[];
  const resources=[...fountain.meshes.map(mesh=>mesh.geometry),...fountain.materials];resources.forEach((resource,index)=>{disposed[index]=0;resource.addEventListener('dispose',()=>disposed[index]++);});
  for(let frame=0;frame<300*30;frame++) {
    const quality=(['high','medium','low'] as const)[Math.floor(frame/300)%3];fountain.step(1/30,quality);
    if(frame%30)continue;
    for(const mesh of fountain.meshes) {
      const positions=mesh.geometry.getAttribute('position');
      if(mesh instanceof InstancedMesh)for(let i=0;i<mesh.count;i++) {
        mesh.getMatrixAt(i,matrix);assert.ok(matrix.determinant()>0);
        for(let v=0;v<positions.count;v++) {point.fromBufferAttribute(positions,v).applyMatrix4(matrix);assert.ok(point.toArray().every(Number.isFinite));assert.ok(Math.hypot(point.x,point.z)<FOUNTAIN_SITE.innerRadius);assert.ok(point.y>FOUNTAIN_SITE.waterHeight-.03);}
      }
      else for(let v=0;v<positions.count;v++){point.fromBufferAttribute(positions,v);assert.ok(Math.hypot(point.x,point.z)<=1.16001);}
    }
  }
  const time=fountain.time.value;const matrices=fountain.meshes.filter(mesh=>mesh instanceof InstancedMesh).map(mesh=>Array.from(mesh.instanceMatrix.array));
  for(const quality of ['high','medium','low','high'] as const) {
    for(let frame=0;frame<30;frame++)fountain.step(1/30,quality,true);
    assert.deepEqual(fountain.meshes.filter(mesh=>mesh instanceof InstancedMesh).map(mesh=>Array.from(mesh.instanceMatrix.array)),matrices,'paused quality changes must preserve every allocated droplet and splash pose');
  }
  assert.equal(fountain.time.value,time);assert.deepEqual(fountain.meshes.filter(mesh=>mesh instanceof InstancedMesh).map(mesh=>Array.from(mesh.instanceMatrix.array)),matrices);
  fountain.dispose();fountain.dispose();assert.ok(disposed.every(count=>count===1));
});

test('component retains water and geometry across quality changes and freezes its shader clock',async()=>{
  const runtime={current:createSceneRuntime()};const render=(quality:QualityTier='high',paused=false)=><GardenFountain runtime={runtime} quality={quality} paused={paused}/>;
  const renderer=await create(render());const meshes:Mesh[]=[];renderer.scene.instance.traverse(object=>{if(object instanceof Mesh)meshes.push(object);});
  const geometries=meshes.map(mesh=>mesh.geometry);const materials=meshes.map(mesh=>mesh.material);
  const water=meshes.find(mesh=>mesh.name==='fountain-transparent-water-surface')!.material as MeshPhysicalMaterial;
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'} as never;water.onBeforeCompile(shader,{} as never);
  const uniform=(shader as {uniforms:{fountainTime:{value:number}}}).uniforms.fountainTime;
  try {
    await act(async()=>{await renderer.advanceFrames(3,1/30);});assert.ok(uniform.value>0);
    for(const quality of ['low','medium','high'] as const){await renderer.update(render(quality));await act(async()=>{await renderer.advanceFrames(1,1/30);});assert.deepEqual(meshes.map(mesh=>mesh.geometry),geometries);assert.deepEqual(meshes.map(mesh=>mesh.material),materials);}
    await renderer.update(render('high',true));const time=uniform.value;runtime.current.elapsed=9000;await act(async()=>{await renderer.advanceFrames(90,1/30);});assert.equal(uniform.value,time);
  } finally {await renderer.unmount();}
});
