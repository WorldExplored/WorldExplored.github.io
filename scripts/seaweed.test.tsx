import test from 'node:test';
import assert from 'node:assert/strict';
import { act, create } from '@react-three/test-renderer';
import { InstancedMesh, MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from 'three';
import { createSeaweedGeometry, createSeaweedLayout, SEAWEED_COVES, SEAWEED_REACH, SEAWEED_FORMS, Seaweed } from '../src/components/world/Seaweed';
import { createLandscapePlan, distanceToSegment, landDistance, terrainMeshHeight, ISLANDS } from '../src/components/world/terrain';
import { coastExposure } from '../src/components/world/waves';
import { createSceneRuntime, type QualityTier } from '../src/content/world';
import { createDockWeedGeometry, createDockWeedSites, dockEcologyPoles } from '../src/components/world/DockEcology';
import { coastalCaveClearance } from '../src/components/world/coastalCaveLayout';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('dock algae begin on wet pile faces and remain below the water surface',()=>{
  const poles=dockEcologyPoles(),sites=createDockWeedSites(poles);
  assert.deepEqual(sites,createDockWeedSites(poles));
  assert.equal(poles.length,12);
  assert.ok(sites.length>150&&sites.length<220);
  const geometries=[0,1,2].map(createDockWeedGeometry);
  try{
    for(const pole of poles){
      const attached=sites.filter(site=>site.pole===pole.id);assert.ok(attached.length>=9);
      assert.ok(Math.max(...attached.map(site=>site.y))-Math.min(...attached.map(site=>site.y))>Math.min(.16,(-.38-pole.bottom)*.45));
      if(pole.id.startsWith('lighthouse'))assert.ok(pole.radius>.08);
    }
    for(const site of sites){
      const pole=poles.find(item=>item.id===site.pole)!;
      assert.ok(Math.abs(Math.hypot(site.x-pole.x,site.z-pole.z)-pole.radius)<1e-10);
      assert.ok(site.y>pole.bottom&&site.y+site.height<-.13);
      const positions=geometries[site.variant].getAttribute('position');
      for(let i=0;i<positions.count;i++)assert.ok(site.y+positions.getY(i)*site.height<-.1);
      assert.equal(positions.getY(0),0);
    }
  }finally{geometries.forEach(geometry=>geometry.dispose());}
});

test('seaweed occupies dense irregular sheltered beds with seabed roots and structural clearance', () => {
  const plan = createLandscapePlan();
  const sites = createSeaweedLayout(plan);
  assert.deepEqual(sites, createSeaweedLayout(plan));
  assert.ok(sites.length >= 4400 && sites.length <= 4800);
  assert.equal(new Set(sites.map(site => site.cove)).size, SEAWEED_COVES.length + ISLANDS.length);
  for (const site of sites) {
    const distance = landDistance(site.x, site.z);
    assert.ok(coastalCaveClearance(site.x, site.z, SEAWEED_REACH) > 0, 'foliage clears cave banks and swimming approaches');
    assert.ok(distance < -1.5 && distance > -5);
    assert.ok(coastExposure(site.x, site.z, distance) <= (site.cove < 0 ? .7 : .3));
    assert.ok(Math.abs(site.y - terrainMeshHeight(site.x, site.z) + 0.025) < 1e-10);
    assert.ok(site.y + site.height <= -0.32 + 1e-10);
    const cove = SEAWEED_COVES[site.cove];
    if(cove) assert.ok(Math.hypot(site.x - cove.x, site.z - cove.z) <= cove.radius);
    for (const item of [...plan.structures, ...plan.rocks]) assert.ok(Math.hypot(site.x - item.x, site.z - item.z) > item.radius + SEAWEED_REACH + 0.59);
    for (const path of plan.paths.filter(item => item.bridge)) for (let index = 1; index < path.points.length; index++) {
      assert.ok(distanceToSegment(site.x, site.z, path.points[index - 1], path.points[index]) > path.width / 2 + SEAWEED_REACH + 0.74);
    }
  }
});

test('every blade stays submerged and inside its reserved footprint through slow sway', () => {
  const geometries = SEAWEED_FORMS.map((_, variant) => createSeaweedGeometry(variant));
  try {
    for (const site of createSeaweedLayout()) {
      const vertices = geometries[site.variant].getAttribute('position');
      const phase = site.x * 0.73 + site.z * 0.41;
      for (let time = 0; time <= 120; time += 4) for (let index = 0; index < vertices.count; index++) {
        const y = vertices.getY(index);
        const dx = vertices.getX(index) + (Math.sin(time * 0.44 + phase) * 0.065 + Math.sin(time * 0.23 - phase) * 0.025) * y * y;
        const dz = vertices.getZ(index) + Math.cos(time * 0.31 + phase) * 0.055 * y * y;
        assert.ok(Number.isFinite(dx + dz + y));
        assert.ok(Math.hypot(dx, dz) * site.width < SEAWEED_REACH);
        assert.ok(site.y + y * site.height < -0.25);
        if (y === 0) assert.equal(Math.hypot(dx, dz), 0, 'roots do not slide on the seabed');
      }
    }
  } finally { geometries.forEach(geometry => geometry.dispose()); }
});

test('quality and reduced motion retain seaweed resources without pointer interception', async () => {
  const runtime = { current: createSceneRuntime() };
  const render = (quality: QualityTier = 'high', paused = false) => <Seaweed runtime={runtime} quality={quality} paused={paused} />;
  const renderer = await create(render());
  const meshes: InstancedMesh[] = [];
  renderer.scene.instance.traverse(object => { if (object instanceof InstancedMesh) meshes.push(object); });
  const geometry = meshes.map(mesh => mesh.geometry);
  const materials = meshes.map(mesh => mesh.material);
  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '' } as WebGLProgramParametersWithUniforms;
  (meshes[0].material as MeshStandardMaterial).onBeforeCompile(shader, {} as never);
  try {
    assert.equal(meshes.length, SEAWEED_FORMS.length);
    for (const [quality, population] of [['high', 1], ['medium', .75], ['low', .5]] as const) {
      await renderer.update(render(quality));
      const sites = createSeaweedLayout();
      assert.equal(meshes.reduce((sum, mesh) => sum + mesh.count, 0), SEAWEED_FORMS.reduce((sum, _, variant) => sum + Math.ceil(sites.filter(site => site.variant === variant).length * population), 0));
      meshes.forEach((mesh,i)=>{assert.ok(mesh.geometry.index!.count<=geometry[i].index!.count);if(quality==='high')assert.equal(mesh.geometry,geometry[i]);});
      assert.deepEqual(meshes.map(mesh => mesh.material), materials);
      for (const mesh of meshes) { const hits: unknown[] = []; mesh.raycast({} as never, hits as never); assert.equal(hits.length, 0); }
    }
    runtime.current.elapsed = 12;
    await act(async () => { await renderer.advanceFrames(1, 1 / 60); });
    assert.equal(shader.uniforms.seaweedTime.value, 12);
    await renderer.update(render('high', true));
    runtime.current.elapsed = 1000;
    await act(async () => { await renderer.advanceFrames(60, 1 / 60); });
    assert.equal(shader.uniforms.seaweedTime.value, 12);
  } finally { await renderer.unmount(); }
});


test('beds mix silhouettes, sizes and colors locally rather than separating them by row', () => {
  const sites = createSeaweedLayout();
  for(let cove=0;cove<SEAWEED_COVES.length;cove++) {
    const bed=sites.filter(site=>site.cove===cove);
    // Cave banks can trim a meadow to a small remnant. Require six silhouettes
    // there; full beds (at least eight roots per form) retain all eight.
    const minimumForms = bed.length >= SEAWEED_FORMS.length * 8 ? SEAWEED_FORMS.length : 6;
    assert.ok(new Set(bed.map(site=>site.variant)).size >= minimumForms, `cove ${cove} mixes plant silhouettes`);
    assert.ok(Math.max(...bed.map(site=>site.width))-Math.min(...bed.map(site=>site.width))>.4);
    assert.ok(Math.max(...bed.map(site=>site.tint))-Math.min(...bed.map(site=>site.tint))>.8);
    const distances=bed.map(site=>Math.min(...bed.filter(other=>other!==site).map(other=>Math.hypot(other.x-site.x,other.z-site.z))));
    assert.ok(distances.filter(distance=>distance<.45).length/bed.length>.78,'most roots belong to overlapping clumps');
    // Exclusions can leave a compact bed without isolated edge roots. Check spacing
    // variation across its middle half instead of requiring one distant outlier.
    const spacing = [...distances].sort((a, b) => a - b);
    const quartileSpread = spacing[Math.floor(spacing.length * .75)] - spacing[Math.floor(spacing.length * .25)];
    assert.ok(quartileSpread > spacing[Math.floor(spacing.length * .5)] * .1, `cove ${cove} has varied density throughout its clumps`);
  }
  const beds=sites.filter(site=>site.cove>=0);
  const mixed=beds.filter(site=>new Set(sites.filter(other=>Math.hypot(other.x-site.x,other.z-site.z)<1).map(other=>other.variant)).size>=4);
  assert.ok(mixed.length/beds.length>.8,'most one-metre patches contain at least four silhouettes');
  const geometries=SEAWEED_FORMS.map((_,variant)=>createSeaweedGeometry(variant));
  try {
    assert.equal(new Set(geometries.map(geometry=>geometry.userData.form)).size,8);
    assert.equal(new Set(geometries.map(geometry=>Array.from(geometry.getAttribute('position').array).join(','))).size,8);
    const triangles=sites.reduce((sum,site)=>sum+geometries[site.variant].index!.count/3,0);
    assert.ok(triangles<1600000, `bounded instanced foliage triangles: ${triangles}`);
  } finally {geometries.forEach(geometry=>geometry.dispose());}
});


test('stray seaweed covers every island and remains represented in low quality prefixes',()=>{
  const sites=createSeaweedLayout(),low=SEAWEED_FORMS.flatMap((_,variant)=>{
    const batch=sites.filter(site=>site.variant===variant);return batch.slice(0,Math.ceil(batch.length*.5));
  });
  for(let island=0;island<ISLANDS.length;island++){
    assert.ok(sites.filter(site=>site.cove===-1-island).length>=80);
    assert.ok(low.filter(site=>site.cove===-1-island).length>=15);
  }
});
