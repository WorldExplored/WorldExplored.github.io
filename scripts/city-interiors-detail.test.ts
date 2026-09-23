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

test('every domestic room has wall-aligned, normally proportioned bedding and complementary storage', () => {
  const domestic = new Set(['terraced-apartments', 'narrow-mixed-use', 'split-wings', 'rounded-housing', 'greenhouse-residences', 'split-level-homes', 'waterfront-rowhouses', 'stacked-maisonettes']);
  for (const building of cityBuildings.filter(value => domestic.has(value.family))) {
    const rooms = buildCityArchitecture(building, geometry => geometry.dispose());
    for (const [variant, room] of rooms.entries()) {
      const item = fixture(building, room.width, room.depth, variant, room.height);
      try {
        const get = (name: string) => item.meshes.find(mesh => mesh.geometry.userData.furniture.name === name);
        const mattress = get('mattress'), head = get('headboard');
        assert.ok(mattress && head, `${building.id} floor ${variant} must contain a bed`);
        mattress.geometry.computeBoundingBox(); head.geometry.computeBoundingBox();
        const size = mattress.geometry.boundingBox!.getSize(new Vector3());
        assert.ok(size.x >= .66 && size.z / size.x <= 2.4 && size.z / size.x >= 1.3, `${building.id} room ${variant}: bed ${size.x.toFixed(2)}×${size.z.toFixed(2)} requires a wider room`);
        const headBox = head.geometry.boundingBox!;
        let rear = -room.depth / 2;
        if (building.family === 'rounded-housing') {
          const outerX = Math.max(Math.abs(headBox.min.x), Math.abs(headBox.max.x));
          rear = Math.max(rear, -room.depth / 1.5 * Math.sqrt(1 - (outerX / (room.width / 1.65)) ** 2));
        }
        assert.ok(headBox.min.z - rear >= -.001 && headBox.min.z - rear < .065, `${building.id} headboard drifts off the rear enclosure`);
        assert.ok(get('folded-duvet') && get('pillow') && get('headboard-reading-light'));
        assert.ok(get('wardrobe-carcass') || get('kitchen-cabinet'), `${building.id} has no domestic storage`);
        assert.ok(get('bedside-table') || get('dining-tabletop') || get('sofa-seat'), `${building.id} lacks a second occupied area`);
      } finally { item.dispose(); }
    }
  }
});

test('seating stays compact and the waterfront gallery is a furnished exhibition room', () => {
  for (const building of cityBuildings) {
    const rooms = buildCityArchitecture(building, geometry => geometry.dispose());
    for (const [variant, room] of rooms.entries()) {
      const item = fixture(building, room.width, room.depth, variant, room.height);
      try {
        for (const seat of item.meshes.filter(mesh => mesh.geometry.userData.furniture.name === 'sofa-seat')) {
          seat.geometry.computeBoundingBox(); const size = seat.geometry.boundingBox!.getSize(new Vector3());
          assert.ok(size.x <= .58 && size.z <= .95 && size.z / size.x <= 1.85, 'a sofa cannot stretch to fill a room strip');
        }
        if (building.family === 'civic-gallery') {
          const names = new Set(item.meshes.map(mesh => mesh.geometry.userData.furniture.name));
          for (const name of ['gallery-art-frame', 'gallery-art-print', 'gallery-plinth', 'gallery-sculpture', 'sofa-seat', 'dining-tabletop', 'book-pages', 'lamp-shade']) assert.ok(names.has(name), `gallery lacks ${name}`);
          assert.equal(item.meshes.filter(mesh => mesh.geometry.userData.furniture.name === 'gallery-art-frame').length, 2);
        }
      } finally { item.dispose(); }
    }
  }
});

test('workshop equipment remains on its actual capped desk surface', () => {
  const building = cityBuildings.find(value => value.family === 'arched-apartments')!;
  const item = fixture(building, 4.1, 2.6, 0, 1.8);
  try {
    const table = item.meshes.find(mesh => mesh.geometry.userData.furniture.name === 'dining-tabletop')!;
    const stand = item.meshes.find(mesh => mesh.geometry.userData.furniture.name === 'monitor-stand')!;
    table.geometry.computeBoundingBox(); stand.geometry.computeBoundingBox();
    const support = table.geometry.boundingBox!, equipment = stand.geometry.boundingBox!;
    assert.ok(equipment.min.x >= support.min.x && equipment.max.x <= support.max.x);
    assert.ok(equipment.min.z >= support.min.z && equipment.max.z <= support.max.z);
    assert.ok(equipment.min.y <= support.max.y && equipment.max.y > support.max.y);
  } finally { item.dispose(); }
});

test('office floors form complete grounded working and meeting areas with separated furniture footprints', () => {
  for (const building of cityBuildings.filter(value => ['courtyard-block', 'arched-apartments'].includes(value.family))) {
    const rooms = buildCityArchitecture(building, geometry => geometry.dispose());
    for (const [variant, room] of rooms.entries()) {
      const item = fixture(building, room.width, room.depth, variant, room.height);
      try {
        const find = (name: string) => item.meshes.find(mesh => mesh.geometry.userData.furniture.name === name);
        for (const name of ['task-chair-seat', 'task-chair-back', 'chair-caster', 'keyboard-base', 'computer-mouse', 'computer-tower', 'lamp-shade', 'office-bookshelf', 'office-book', 'file-cabinet', 'meeting-tabletop', 'sofa-seat', 'microwave-cabinet', 'fridge-door', 'oven-window']) assert.ok(find(name), `${building.id} floor ${variant} lacks ${name}`);
        const names = ['dining-tabletop', 'task-chair-seat', 'file-cabinet', 'sofa-seat', 'meeting-tabletop', 'kitchen-cabinet'] as const;
        const bounds = names.map(name => { const mesh = find(name)!; mesh.geometry.computeBoundingBox(); return mesh.geometry.boundingBox!; });
        for (let a = 0; a < bounds.length; a++) for (let b = a + 1; b < bounds.length; b++) {
          const overlapX = Math.min(bounds[a].max.x, bounds[b].max.x) - Math.max(bounds[a].min.x, bounds[b].min.x);
          const overlapZ = Math.min(bounds[a].max.z, bounds[b].max.z) - Math.max(bounds[a].min.z, bounds[b].min.z);
          assert.ok(overlapX <= 0 || overlapZ <= 0, `${building.id}: ${names[a]} intersects ${names[b]} in plan`);
        }
        for (const name of ['file-cabinet', 'computer-tower', 'chair-caster', 'meeting-table-foot']) {
          const mesh = find(name)!; mesh.geometry.computeBoundingBox();
          assert.ok(Math.abs(mesh.geometry.boundingBox!.min.y) < 1e-5, `${name} does not rest on the finished floor`);
        }
        const chair = find('task-chair-seat')!; chair.geometry.computeBoundingBox();
        const chairSize = chair.geometry.boundingBox!.getSize(new Vector3());
        assert.ok(chairSize.x > .38 && chairSize.z > .37, 'chair is not scaled down to fit leftover space');
      } finally { item.dispose(); }
    }
  }
});

test('kitchen appliances stay supported and ceiling fixtures touch the ceiling', () => {
  for (const building of cityBuildings) {
    const rooms = buildCityArchitecture(building, geometry => geometry.dispose());
    for (const [variant, room] of rooms.entries()) {
      const item = fixture(building, room.width, room.depth, variant, room.height);
      try {
        const find = (name: string) => item.meshes.find(mesh => mesh.geometry.userData.furniture.name === name);
        const ceiling = find('ceiling-diffuser')!; ceiling.geometry.computeBoundingBox();
        assert.ok(Math.abs(ceiling.geometry.boundingBox!.max.y - room.height) < 1e-5);
        const microwave = find('microwave-cabinet');
        if (microwave) {
          assert.ok(find('appliance-wall-bracket') && find('fridge-door') && find('oven-window') && find('hob-ring'));
          microwave.geometry.computeBoundingBox();
          assert.ok(microwave.geometry.boundingBox!.max.y <= room.height - .05);
        }
      } finally { item.dispose(); }
    }
  }
});
