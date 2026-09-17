import test from 'node:test';
import assert from 'node:assert/strict';
import { create } from '@react-three/test-renderer';
import { Vector3, type InstancedMesh, type MeshPhysicalMaterial, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { Flora, createFloraSites } from '../src/components/world/Flora';
import { createLandscapePlan, distanceToSegment, landDistance, terrainHeight } from '../src/components/world/terrain';
import { createSceneRuntime, world, type QualityTier } from '../src/content/world';
import { cameraObstacles, constrainCameraPose, focusPose } from '../src/components/world/cameraControls';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('clustered flora stays grounded and clears structures and circulation',()=>{
  const sites=createFloraSites();assert.deepEqual(sites,createFloraSites());assert.ok(sites.length>180);
  assert.equal(new Set(sites.map(s=>s.kind)).size,8);
  const plan=createLandscapePlan();
  for(const site of sites){
    assert.ok(Math.abs(site.y-terrainHeight(site.x,site.z))<1e-9);
    const reach=site.kind==='broadleaf'?1.55:site.kind==='shrub'?1.3:site.kind==='flower'?1:.9;
    for(const circle of [...plan.structures,...plan.rocks,...plan.trees.map(tree=>({...tree,radius:tree.height*.15}))])assert.ok(Math.hypot(site.x-circle.x,site.z-circle.z)>circle.radius+reach-.001);
    for(const path of plan.paths)for(let i=1;i<path.points.length;i++)assert.ok(distanceToSegment(site.x,site.z,path.points[i-1],path.points[i])>path.width/2+reach-.001);
    if(site.kind==='reeds'||site.kind==='beach')assert.ok(landDistance(site.x,site.z)<3.81);
  }
});

test('flora retains resources across tiers and freezes wind and pointer response',async()=>{
  const runtime={current:createSceneRuntime()};const render=(quality:QualityTier='high',paused=false)=><Flora runtime={runtime} quality={quality} paused={paused}/>;
  const renderer=await create(render());
  try{
    const batches=renderer.scene.instance.children[0].children as InstancedMesh[];
    const high=batches.map(b=>b.count);const resources=batches.map(b=>[b.geometry,b.material]);
    const shader={uniforms:{},vertexShader:'#include <begin_vertex>'} as WebGLProgramParametersWithUniforms;
    (batches[0].material as MeshPhysicalMaterial).onBeforeCompile(shader,{} as WebGLRenderer);
    runtime.current.elapsed=5;await renderer.advanceFrames(1,1/60);assert.equal(shader.uniforms.floraTime.value,5);
    await renderer.update(render('medium'));await renderer.advanceFrames(1,1/60);batches.forEach((b,i)=>assert.ok(b.count<=high[i]));
    await renderer.update(render('low',true));runtime.current.elapsed=50;runtime.current.pointerActive=true;await renderer.advanceFrames(10,1/60);
    assert.equal(shader.uniforms.floraTime.value,5);assert.equal(shader.uniforms.floraStrength.value,0);
    batches.forEach((b,i)=>{assert.equal(b.geometry,resources[i][0]);assert.equal(b.material,resources[i][1]);assert.ok(b.count>0&&b.count<=high[i]);});
  }finally{await renderer.unmount();}
});

test('offshore beacon is distant and still reachable by free and destination camera',()=>{
  const beacon=world.landmarks.find(l=>l.id==='building')!;
  const previous=Math.hypot(-35+4,-23+5);const current=Math.hypot(beacon.position[0]+4,beacon.position[2]+5);
  assert.ok(current>=previous*1.8);
  assert.ok(landDistance((beacon.position[0]-4)/2,(beacon.position[2]-5)/2)<-10);
  for(const mobile of [false,true]){
    const pose=focusPose('building',mobile,mobile?390/844:1440/900);
    const p=new Vector3(...pose.position),t=new Vector3(...pose.target);constrainCameraPose(p,t,cameraObstacles());
    assert.ok(t.distanceTo(new Vector3(...beacon.position))<25);assert.ok(p.distanceTo(new Vector3(...beacon.position))<75);
    assert.ok(p.y>terrainHeight(p.x,p.z)+1);
  }
});
