import test from 'node:test';
import assert from 'node:assert/strict';
import { Light, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShaderLib, Vector3, Raycaster, DoubleSide, Matrix4, type WebGLProgramParametersWithUniforms } from 'three';
import { createExteriorLighting, exteriorIlluminance, exteriorLampSites, streetLampSites } from '../src/components/world/ExteriorLighting';
import { applyBakedRoomLighting, createRoomLighting } from '../src/components/world/RoomLighting';
import { cityBuildings } from '../src/components/world/city';
import { terrainMeshHeight } from '../src/components/world/terrain';
import { world } from '../src/content/world';
import { buildCityArchitecture } from '../src/components/world/CityArchitecture';
import { makeComputeBuilding } from '../src/components/world/ComputeBuilding';
import { makeResearchBuilding } from '../src/components/world/ResearchInstitute';
import { makeExperienceStudio, makeHistoryMuseum } from '../src/components/world/CivicLandmarks';
import { makeCampusHall } from '../src/components/world/CampusHall';
import { makeGardenGallery } from '../src/components/world/GardenGallery';
import { makeReceptionTerminal } from '../src/components/world/ReceptionTerminal';
import { createArcadeHall } from '../src/components/world/ArcadeHall';
import { createLighthouseGeometry } from '../src/components/world/CoastalLighthouse';
import { createCityTransitRoute } from '../src/components/world/city';


test('every building has a visible entry source and fitted local pools without additional lights', () => {
  const lighting = createExteriorLighting(), sites = exteriorLampSites();
  try {
    for (const building of [...world.landmarks, ...cityBuildings]) assert.ok(sites.some(site => site.building === building.id), `${building.id} needs an actual fixture`);
    assert.equal(sites.length, 24); assert.equal(streetLampSites().length, 14); assert.equal(lighting.root.children.length, 4);
    assert.ok(!lighting.root.children.some(child => child instanceof Light));
    let triangles = 0;
    for (const object of lighting.root.children) {
      const mesh = object as Mesh;
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
    }
    assert.ok(triangles < 11000);
    const pools = lighting.root.getObjectByName('exterior-ground-light-pools') as Mesh;
    const positions = pools.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      assert.ok(Math.abs(positions.getY(i) - terrainMeshHeight(positions.getX(i), positions.getZ(i)) - .023) < .001, 'light pools follow the actual terrain and path grade');
    }
    const sources = lighting.root.getObjectByName('exterior-pearl-diffusers') as Mesh<never, MeshStandardMaterial>;
    lighting.update(0); assert.equal(sources.material.emissiveIntensity, 0); assert.equal(pools.visible, false);
    lighting.update(1); assert.ok(sources.material.emissiveIntensity > .5); assert.equal(pools.visible, true);
    assert.ok(sources.material.emissive.g > sources.material.emissive.r, 'source tint is pearl and mint instead of orange');
  } finally { lighting.dispose(); }
});

test('baked vegetation light is confined to the front of the actual entrance', () => {
  for (const lamp of exteriorLampSites()) {
    const forward = { x: Math.sin(lamp.yaw), z: Math.cos(lamp.yaw) };
    const front = exteriorIlluminance(lamp.x + forward.x * lamp.reach * .38, lamp.floor, lamp.z + forward.z * lamp.reach * .38, [lamp]);
    assert.ok(front > .3 && front <= .34);
    assert.equal(exteriorIlluminance(lamp.x - forward.x, lamp.floor, lamp.z - forward.z, [lamp]), 0, 'light does not leak through a wall');
    assert.equal(exteriorIlluminance(lamp.x + 8, lamp.floor, lamp.z + 8, [lamp]), 0);
    assert.equal(exteriorIlluminance(lamp.x, lamp.y + 1, lamp.z, [lamp]), 0);
  }
  assert.equal(exteriorIlluminance(-90, 0, 40), 0, 'unlit meadow and ocean receive no fixture illumination');
});

test('room bounce is modest pearl diffuse fill and transparent surfaces are excluded', () => {
  const opaque = applyBakedRoomLighting(new MeshStandardMaterial()), pane = new MeshStandardMaterial({ transparent: true });
  try {
    const before = pane.onBeforeCompile; applyBakedRoomLighting(pane, true); assert.equal(pane.onBeforeCompile, before);
    const shader = { uniforms: {}, vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader } as WebGLProgramParametersWithUniforms;
    opaque.onBeforeCompile(shader, {} as never);
    assert.ok(shader.fragmentShader.includes('vec3(.32,.42,.395)'));
    assert.equal(opaque.emissive.getHex(), 0);
    const empty = createRoomLighting([]);
    try { empty.update(1, new Vector3(), 1); assert.ok(empty.root.children.filter(child => child instanceof Light).every(light => light.intensity === 0)); }
    finally { empty.dispose(); }
  } finally { opaque.dispose(); pane.dispose(); }
});

test('fixture effects retain resources through Strict Mode replay and dispose once', async () => {
  const lighting = createExteriorLighting(), meshes = lighting.root.children as Mesh[];
  let geometries = 0, materials = 0;
  for (const mesh of meshes) {
    mesh.geometry.addEventListener('dispose', () => geometries++);
    (mesh.material as MeshStandardMaterial).addEventListener('dispose', () => materials++);
  }
  const release = lighting.retain(); release(); const finalRelease = lighting.retain();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(geometries, 0); assert.equal(materials, 0);
  finalRelease(); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(geometries, 4); assert.equal(materials, 4);
  lighting.dispose(); assert.equal(geometries, 4); assert.equal(materials, 4);
});

test('each city fixture touches its actual recessed canopy, including both row-house doors', () => {
  const material = new MeshBasicMaterial({ side: DoubleSide });
  try {
    for (const building of cityBuildings) {
      const canopies: Mesh[] = [];
      buildCityArchitecture(building, (geometry, _finish, x=0, y=0, z=0) => {
        if (geometry.userData.entranceDoor?.primary && geometry.userData.entranceDoor.role === 'canopy') {
          geometry.translate(x,y,z).rotateY(building.rotation).translate(building.x,.8,building.z);
          canopies.push(new Mesh(geometry, material));
        } else geometry.dispose();
      }, () => {}, () => {});
      try {
        const lamps = exteriorLampSites().filter(lamp => lamp.building === building.id);
        assert.equal(lamps.length, canopies.length, `${building.id} has one fixture per actual canopy`);
        for (const lamp of lamps) for (const across of [-.16, .16]) {
          const x = lamp.x + Math.cos(lamp.yaw) * across, z = lamp.z - Math.sin(lamp.yaw) * across;
          const hit = new Raycaster(new Vector3(x,lamp.y+.059,z),new Vector3(0,1,0)).intersectObjects(canopies,false)[0];
          assert.ok(hit && hit.distance < .002, `${lamp.id}: housing must touch the real canopy underside`);
        }
      } finally { canopies.forEach(mesh => mesh.geometry.dispose()); }
    }
  } finally { material.dispose(); }
});

test('main entry housings connect to a solid roof or a facade bracket', () => {
  const models = {work:makeComputeBuilding(),research:makeResearchBuilding(),experience:makeExperienceStudio(),history:makeHistoryMuseum(),purdue:makeCampusHall(),about:makeGardenGallery(),contact:makeReceptionTerminal(),arcade:createArcadeHall(),building:createLighthouseGeometry()};
  const material = new MeshBasicMaterial({side:DoubleSide});
  try {
    for (const [id, parts] of Object.entries(models)) {
      const landmark=world.landmarks.find(item=>item.id===id)!, matrix=new Matrix4().makeRotationY(landmark.rotationY??0).setPosition(...landmark.position);
      const meshes=Object.entries(parts).filter(([key])=>!/(glass|window|beam|hitbox|glazing)/i.test(key)).map(([,geometry])=>new Mesh(geometry.clone().applyMatrix4(matrix),material));
      try {
        for (const lamp of exteriorLampSites().filter(site=>site.building===id)) {
          const forward=new Vector3(Math.sin(lamp.yaw),0,Math.cos(lamp.yaw));
          const origin=new Vector3(lamp.x,lamp.y,lamp.z);
          if(lamp.mount==='canopy')origin.y+=.059;
          else origin.addScaledVector(forward,-.105);
          const hit=new Raycaster(origin,lamp.mount==='canopy'?new Vector3(0,1,0):forward.negate()).intersectObjects(meshes,false)[0];
          assert.ok(hit&&hit.distance<(lamp.mount==='canopy'?.002:lamp.bracket+.025),`${lamp.id}: support must meet actual architecture, distance ${hit?.distance}`);
        }
      } finally { meshes.forEach(mesh=>mesh.geometry.dispose()); }
    }
  } finally { material.dispose();Object.values(models).forEach(parts=>Object.values(parts).forEach(geometry=>geometry.dispose())); }
});

test('solar street lamp posts stand on land and clear the transit guideway', () => {
  const route=createCityTransitRoute(), point=new Vector3();
  for(const lamp of streetLampSites()) {
    const postX=lamp.x-Math.sin(lamp.yaw)*.6, postZ=lamp.z-Math.cos(lamp.yaw)*.6;
    assert.ok(lamp.floor>.25,`${lamp.id}: foot stands on dry ground`);
    assert.ok(Math.abs(lamp.floor-terrainMeshHeight(postX,postZ))<.001);
    for(const building of cityBuildings) {
      const dx=postX-building.x,dz=postZ-building.z,c=Math.cos(building.rotation),s=Math.sin(building.rotation);
      assert.ok(Math.abs(dx*c-dz*s)>building.width/2+.12||Math.abs(dx*s+dz*c)>building.depth/2+.12,`${lamp.id}: post cannot stand inside ${building.id}`);
    }
    for(let i=0;i<1000;i++) {
      route.curve.getPointAt(i/1000,point);
      assert.ok(Math.hypot(postX-point.x,postZ-point.z)>.75,`${lamp.id}: post clears the train and guideway`);
    }
  }
});
