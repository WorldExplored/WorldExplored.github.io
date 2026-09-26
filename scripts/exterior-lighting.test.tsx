import test from 'node:test';
import assert from 'node:assert/strict';
import { Light, Mesh, MeshStandardMaterial, ShaderLib, Vector3, type WebGLProgramParametersWithUniforms } from 'three';
import { createExteriorLighting, exteriorIlluminance, exteriorLampSites } from '../src/components/world/ExteriorLighting';
import { applyBakedRoomLighting, createRoomLighting } from '../src/components/world/RoomLighting';
import { cityBuildings } from '../src/components/world/city';
import { terrainMeshHeight } from '../src/components/world/terrain';
import { world } from '../src/content/world';

test('every building has a visible entry source and fitted local pools without additional lights', () => {
  const lighting = createExteriorLighting(), sites = exteriorLampSites();
  try {
    for (const building of [...world.landmarks, ...cityBuildings]) assert.ok(sites.some(site => site.building === building.id), `${building.id} needs an actual fixture`);
    assert.equal(sites.length, 23); assert.equal(lighting.root.children.length, 3);
    assert.ok(!lighting.root.children.some(child => child instanceof Light));
    let triangles = 0;
    for (const object of lighting.root.children) {
      const mesh = object as Mesh;
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
    }
    assert.ok(triangles < 6000);
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
    assert.ok(shader.fragmentShader.includes('vec3(.105,.14,.135)'));
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
  assert.equal(geometries, 3); assert.equal(materials, 3);
  lighting.dispose(); assert.equal(geometries, 3); assert.equal(materials, 3);
});
