import test from 'node:test';
import assert from 'node:assert/strict';
import { create } from '@react-three/test-renderer';
import { MeshPhysicalMaterial, PerspectiveCamera, Vector3, InstancedMesh, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { Flora, createFloraSites, floraGeometry, FLOWER_KINDS } from '../src/components/world/Flora';
import { lighthouseEscarpmentSites } from '../src/components/world/LighthouseEscarpment';
import { BEACH_PALMS } from '../src/components/world/coastalBiome';
import { coastalRockGeometry } from '../src/components/world/coastalRocks';
import { terrainMeshHeight } from '../src/components/world/terrain';
import { createHistoryFlowerBorder } from '../src/components/world/CivicLandmarks';
import { createLandscapePlan, distanceToSegment, landDistance, terrainHeight } from '../src/components/world/terrain';
import { createSceneRuntime, world, type QualityTier } from '../src/content/world';
import { cameraObstacles, constrainCameraPose, focusPose } from '../src/components/world/cameraControls';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('clustered flora stays grounded and clears structures and circulation',()=>{
  const sites=createFloraSites();assert.deepEqual(sites,createFloraSites());assert.ok(sites.length>2000&&sites.length<2200);
  assert.equal(new Set(sites.map(s=>s.kind)).size,13);
  const city=sites.filter(site=>site.z<-58&&site.x<18);
  assert.ok(city.length>=450,'courtyards and parks form a visible planted city layer');
  assert.ok(new Set(city.map(site=>site.kind)).size>=5);
  const plan=createLandscapePlan();
  for(const site of sites){
    assert.ok(Math.abs(site.y-terrainHeight(site.x,site.z))<1e-9);
    const reach=site.reach;
    for(const circle of [...plan.structures,...plan.rocks,...plan.trees.map(tree=>({...tree,radius:tree.height*.15}))])assert.ok(Math.hypot(site.x-circle.x,site.z-circle.z)>circle.radius+reach-.001);
    for(const path of plan.paths)for(let i=1;i<path.points.length;i++)assert.ok(distanceToSegment(site.x,site.z,path.points[i-1],path.points[i])>path.width/2+reach-.001);
    if(site.kind==='reeds'||site.kind==='beach')assert.ok(landDistance(site.x,site.z)<3.81);
  }
});

test('the beacon has rooted tufts and History keeps its flower border outside walls and paths',()=>{
  const sites=createFloraSites();
  assert.ok(sites.filter(site=>Math.hypot(site.x+76,site.z+36)<7).length>=18);
  const material=new MeshPhysicalMaterial({vertexColors:true}),border=createHistoryFlowerBorder(material);
  try{
    const entries=Object.values(border.entries).flat();
    assert.ok(entries.length>=20);
    const landmark=world.landmarks.find(item=>item.id==='history')!,heading=landmark.rotationY??0;
    const paths=createLandscapePlan().paths.filter(path=>path.id?.startsWith('history-'));
    for(const site of entries){
      assert.ok(Math.abs(site.x)>5.8||site.z<-4.1);
      const x=landmark.position[0]+site.x*Math.cos(heading)+site.z*Math.sin(heading);
      const z=landmark.position[2]-site.x*Math.sin(heading)+site.z*Math.cos(heading);
      assert.ok(Math.abs(site.y-terrainHeight(x,z)+.02)<1e-9);
      for(const path of paths)for(let i=1;i<path.points.length;i++)assert.ok(distanceToSegment(x,z,path.points[i-1],path.points[i])>=path.width/2+.45-1e-9);
    }
  }finally{border.dispose();material.dispose();}
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
    batches.forEach((b,i)=>{assert.ok(b.geometry.index!.count <= (resources[i][0] as InstancedMesh['geometry']).index!.count);assert.equal(b.material,resources[i][1]);assert.ok(b.count>0&&b.count<=high[i]);});
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


test('five flower silhouettes and lush groundcover retain a bounded instanced mesh budget',()=>{
  const sites=createFloraSites(),kinds=[...new Set(sites.map(site=>site.kind))];
  const shapes=kinds.map(kind=>({kind,geometry:floraGeometry(kind)}));
  try{
    assert.equal(FLOWER_KINDS.length,5);
    assert.equal(new Set(shapes.filter(shape=>FLOWER_KINDS.includes(shape.kind)).map(shape=>shape.geometry.index!.count)).size,5);
    for(const kind of FLOWER_KINDS)assert.ok(sites.filter(site=>site.kind===kind).length>75);
    const triangles=shapes.reduce((total,shape)=>total+shape.geometry.index!.count/3*sites.filter(site=>site.kind===shape.kind).length,0);
    assert.ok(triangles<1500000,`Thirteen instanced plant meshes: ${triangles}`);
  }finally{shapes.forEach(shape=>shape.geometry.dispose());}
});


test('jagged beacon ledges embed their full bases without obstructing the landing path',()=>{
  const sites=lighthouseEscarpmentSites(),paths=createLandscapePlan().paths;
  assert.ok(sites.length>=12);
  sites.forEach((rock,index)=>{
    const geometry=coastalRockGeometry(index%6),p=geometry.getAttribute('position');
    try{
      for(let i=0;i<p.count;i++)if(p.getY(i)<.0001){
        const lx=p.getX(i)*rock.scale[0],lz=p.getZ(i)*rock.scale[2];
        const x=rock.x+lx*Math.cos(rock.rotation)+lz*Math.sin(rock.rotation),z=rock.z-lx*Math.sin(rock.rotation)+lz*Math.cos(rock.rotation);
        assert.ok(rock.y-.16<terrainMeshHeight(x,z),'ledge base rests below the beach');
      }
      for(const path of paths)for(let i=1;i<path.points.length;i++)assert.ok(distanceToSegment(rock.x,rock.z,path.points[i-1],path.points[i])>path.width/2+rock.radius+.27);
    }finally{geometry.dispose();}
  });
});


test('beach palms have curved trunks and attached feather crowns with camera clearance',()=>{
  const sites=createFloraSites().filter(site=>site.kind==='palm'),geometry=floraGeometry('palm');
  try{
    assert.equal(sites.length,3);const p=geometry.attributes.position;
    assert.ok(Math.max(...Array.from({length:p.count},(_,i)=>p.getY(i)))>3,'palms include a full trunk and arching crown');
    assert.ok(geometry.index!.count/3<1600,'three palms share one compact leaf-and-trunk mesh');
    for(const site of sites){
      assert.ok(BEACH_PALMS.some(palm=>palm.x===site.x&&palm.z===site.z));
      assert.ok(landDistance(site.x,site.z)>1.5&&landDistance(site.x,site.z)<3.3,'palms root on the beach rather than a lawn or water');
      assert.ok(cameraObstacles().some(obstacle=>obstacle.x===site.x&&obstacle.z===site.z&&obstacle.top>site.y+3*site.scale));
    }
  }finally{geometry.dispose();}
});


test('every foliage shader emits typed float arithmetic in the instanced vertex scaffold',async()=>{
  const runtime={current:createSceneRuntime()},renderer=await create(<Flora runtime={runtime} paused quality="high"/>);
  try{
    const batches=renderer.scene.instance.children[0].children as InstancedMesh[];
    assert.equal(batches.length,13);
    for(const batch of batches){
      const shader={uniforms:{},vertexShader:'precision highp float; attribute vec3 position; attribute mat4 instanceMatrix; void main(){\n#include <begin_vertex>\ngl_Position=vec4(transformed,1.);}',fragmentShader:''} as WebGLProgramParametersWithUniforms;
      (batch.material as MeshPhysicalMaterial).onBeforeCompile(shader,{} as WebGLRenderer);
      const source=shader.vertexShader.replace('#include <begin_vertex>','vec3 transformed=position;');
      assert.doesNotMatch(source,/\b(?:undefined|NaN|Infinity)\b/,batch.name);
      const scalarFactors=[...source.matchAll(/\*\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(?=[^\w.]|$)/g)];
      assert.ok(scalarFactors.length>=8,`all ${batch.name} displacement factors reach the shader scaffold`);
      for(const factor of scalarFactors)assert.match(factor[1],/[.eE]/,`${batch.name}: multiplying a GLSL float by integer literal ${factor[1]} does not compile`);
      assert.match(source,/position\.y\*position\.y\*(?:0\.160|1\.000)/);
      assert.ok(shader.uniforms.floraTime&&shader.uniforms.floraPointer&&shader.uniforms.floraStrength);
    }
  }finally{await renderer.unmount();}
});


test('distant high-quality foliage keeps every plant while reducing geometry and restores detail while paused',async()=>{
  const runtime={current:createSceneRuntime()},camera=new PerspectiveCamera();camera.position.set(0,8,12);
  const renderer=await create(<Flora runtime={runtime} paused quality="high"/>,{camera});
  try{
    const meshes:InstancedMesh[]=[];renderer.scene.instance.traverse(object=>{if(object instanceof InstancedMesh)meshes.push(object);});
    await renderer.advanceFrames(1,1/60);
    const original=meshes.map(mesh=>({geometry:mesh.geometry,count:mesh.count}));
    const triangles=()=>meshes.reduce((sum,mesh)=>sum+mesh.count*(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3,0),close=triangles();
    camera.position.y=30;await renderer.advanceFrames(1,1/60);
    assert.ok(triangles()<close*.55,'small overview plants do not render detailed petals and leaf folds');
    meshes.forEach((mesh,i)=>assert.equal(mesh.count,original[i].count,'LOD preserves the full plant population'));
    camera.position.y=8;await renderer.advanceFrames(1,1/60);
    meshes.forEach((mesh,i)=>assert.equal(mesh.geometry,original[i].geometry,'paused camera moves restore the cached close-up geometry'));
    assert.deepEqual(meshes.filter(mesh=>mesh.name.startsWith('flora-')&&mesh.castShadow).map(mesh=>mesh.name),['flora-palm'],'only palm crowns cast an additional foliage shadow; cliff rocks keep their existing shadows');
  }finally{await renderer.unmount();}
});
