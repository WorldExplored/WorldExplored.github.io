import assert from 'node:assert/strict';
import test from 'node:test';
import { Matrix4, Mesh, MeshBasicMaterial, Object3D, Raycaster, Vector3 } from 'three';
import { buildCityArchitecture } from '../src/components/world/CityArchitecture';
import { buildCityInterior } from '../src/components/world/CityInteriors';
import { cityBuildings, type CityBuilding } from '../src/components/world/city';

function fixture(building: Readonly<CityBuilding>, width: number, depth: number, variant: number, height: number) {
  const meshes: Mesh[] = [], material = new MeshBasicMaterial(), object = new Object3D(), matrix = new Matrix4();
  buildCityInterior(building, (geometry, finish, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rotation = 0) => {
    object.position.set(x, y, z); object.scale.set(sx, sy, sz); object.rotation.y = rotation; object.updateMatrix(); matrix.copy(object.matrix);
    geometry.applyMatrix4(matrix); geometry.userData.finish = finish;
    const mesh = new Mesh(geometry, material); mesh.updateMatrixWorld(); meshes.push(mesh);
  }, 0, 0, 0, width, depth, variant, height);
  return { meshes, dispose() { meshes.forEach(mesh => mesh.geometry.dispose()); material.dispose(); } };
}

test('every generated room layout fits its finished floor, including curved rooms, and leaves a continuous clear aisle', () => {
  let checked = 0, triangles = 0;
  for (const building of cityBuildings) {
    const rooms = buildCityArchitecture(building, geometry => geometry.dispose());
    for (const [variant, room] of rooms.entries()) {
      const item = fixture(building, room.width, room.depth, variant, room.height);
      try {
        for (const mesh of item.meshes) {
          const p = mesh.geometry.attributes.position; triangles += (mesh.geometry.index?.count ?? p.count) / 3;
          for (let i = 0; i < p.count; i++) {
            const [x, y, z] = [p.getX(i), p.getY(i), p.getZ(i)];
            const name = `${building.id} ${variant} ${mesh.geometry.userData.furniture.name}`;
            assert.ok([x, y, z].every(Number.isFinite), name);
            assert.ok(Math.abs(x) <= room.width / 2 + 1e-5 && Math.abs(z) <= room.depth / 2 + 1e-5, `${name} exceeds floor (${x},${z})`);
            assert.ok(y >= -1e-5 && y <= room.height + 1e-5, `${name} height ${y}`);
            if (building.family === 'rounded-housing') assert.ok((x / (room.width / 1.65)) ** 2 + (z / (room.depth / 1.5)) ** 2 <= 1, `${name} crosses curved glazing`);
          }
          mesh.geometry.computeBoundingBox();
          if (mesh.geometry.userData.furniture.name !== 'ceiling-diffuser') {
            const box = mesh.geometry.boundingBox!;
            assert.ok(box.max.x <= -.319 || box.min.x >= .319, `${building.id} ${mesh.geometry.userData.furniture.name} occupies access aisle`);
          }
        }
        // Probe the full doorway-to-lift walk rather than trusting placement metadata.
        const ray = new Raycaster(new Vector3(0, .65, room.depth / 2 + .01), new Vector3(0, 0, -1), 0, room.depth + .02);
        assert.equal(ray.intersectObjects(item.meshes, false).length, 0, `${building.id} clear walk`);
        checked++;
      } finally { item.dispose(); }
    }
  }
  assert.ok(checked >= 40);
  assert.ok(triangles < 100000, `${triangles} nearby interior triangles`);
});

test('homes include physically layered bedding, domestic fixtures and varied arrangements rather than repeated office desks', () => {
  const building = cityBuildings.find(value => value.family === 'terraced-apartments')!;
  const profiles = new Set<string>(), names = new Set<string>();
  for (let variant = 0; variant < 10; variant++) {
    const item = fixture(building, 3.2, 2.4, variant, 1.8);
    try {
      profiles.add(JSON.stringify(item.meshes.map(mesh => { mesh.geometry.computeBoundingBox(); return [mesh.geometry.userData.furniture.name, mesh.geometry.boundingBox!.getCenter(new Vector3()).toArray(), mesh.geometry.userData.finish]; })));
      for (const mesh of item.meshes) names.add(mesh.geometry.userData.furniture.name);
      const bedding = item.meshes.filter(mesh => ['mattress', 'folded-duvet', 'pillow'].includes(mesh.geometry.userData.furniture.name));
      if (bedding.length) {
        assert.equal(bedding.length, 3);
        const duvet = bedding.find(mesh => mesh.geometry.userData.furniture.name === 'folded-duvet')!;
        const p = duvet.geometry.attributes.position, levels = new Set<number>();
        for (let i = 0; i < p.count; i++) levels.add(Math.round(p.getY(i) * 10000));
        assert.ok(levels.size > 30, 'cloth has shaped folds rather than another flat box');
      }
      assert.ok(!item.meshes.some(mesh => mesh.geometry.userData.furniture.name === 'workshop-monitor'));
    } finally { item.dispose(); }
  }
  assert.ok(profiles.size >= 8, 'room schemes vary with both orientation and furnishing recipe');
  for (const name of ['mattress', 'pillow', 'folded-duvet', 'wardrobe-carcass', 'lamp-shade', 'book-pages', 'sofa-seat', 'woven-rug', 'kitchen-cabinet', 'curved-faucet', 'dining-tabletop']) assert.ok(names.has(name), name);
});

test('public interiors retain their building purpose and avoid beds in civic or transit spaces', () => {
  const expected = new Map([['civic-gallery', 'gallery-sculpture'], ['winter-glasshouse', 'raised-growing-bed'], ['public-station', 'waiting-perch-seat'], ['arched-apartments', 'workshop-monitor']]);
  for (const [family, name] of expected) {
    const item = fixture(cityBuildings.find(value => value.family === family)!, 2.5, 2.2, 0, 1.8);
    try { assert.ok(item.meshes.some(mesh => mesh.geometry.userData.furniture.name === name)); assert.ok(!item.meshes.some(mesh => mesh.geometry.userData.furniture.name === 'mattress')); }
    finally { item.dispose(); }
  }
});


test('upholstery has rectangular cushion faces and room-specific textile colors within existing finish batches', () => {
  const building = cityBuildings.find(value => value.family === 'terraced-apartments')!;
  const colors = new Set<string>();
  for (let variant = 0; variant < 10; variant++) {
    const item = fixture(building, 3.2, 2.4, variant, 1.8);
    try {
      for (const mesh of item.meshes) {
        if (mesh.geometry.userData.finish === 'fabric') {
          const color = mesh.geometry.getAttribute('color');
          assert.equal(color.count, mesh.geometry.getAttribute('position').count);
          colors.add([color.getX(0), color.getY(0), color.getZ(0)].map(n => n.toFixed(3)).join(','));
        }
        if (['mattress', 'sofa-seat', 'pillow'].includes(mesh.geometry.userData.furniture.name)) {
          const normals = mesh.geometry.getAttribute('normal'); let flatTop = 0;
          for (let i = 0; i < normals.count; i++) if (normals.getY(i) > .9999) flatTop++;
          assert.ok(flatTop >= 6, 'cushion has a broad planar top inside rounded edges');
          assert.notEqual(mesh.geometry.type, 'SphereGeometry');
        }
      }
    } finally { item.dispose(); }
  }
  assert.ok(colors.size >= 10, 'base upholstery and lighter borders vary across seeded room schemes');
});
