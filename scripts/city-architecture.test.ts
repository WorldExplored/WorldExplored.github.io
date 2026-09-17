import assert from 'node:assert/strict';
import test from 'node:test';
import { DoubleSide, Mesh, MeshBasicMaterial, Object3D, Raycaster, Vector3 } from 'three';
import { buildCityArchitecture, type CityFinish } from '../src/components/world/CityArchitecture';
import { CITY_BASE_Y, cityBuildings, cityEntranceLocal, cityEntranceWorld, cityRoofMounts, type CityBuilding } from '../src/components/world/city';

function fixture(building: Readonly<CityBuilding>) {
  const meshes: Mesh[] = []; const finishes: CityFinish[] = [];
  const matrix = new Object3D();
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const rooms = buildCityArchitecture(building, (geometry, finish, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rotation = 0) => {
    matrix.position.set(x, y, z); matrix.scale.set(sx, sy, sz); matrix.rotation.set(0, rotation, 0); matrix.updateMatrix();
    geometry.applyMatrix4(matrix.matrix); const mesh = new Mesh(geometry, material); mesh.updateMatrixWorld(); meshes.push(mesh); finishes.push(finish);
  });
  return { meshes, finishes, rooms, dispose() { meshes.forEach(mesh => mesh.geometry.dispose()); material.dispose(); } };
}

test('thirteen distinct city families remain inside the original footprints and include room-scale detail', () => {
  assert.equal(cityBuildings.length, 13);
  assert.equal(new Set(cityBuildings.map(building => building.family)).size, 13);
  for (const building of cityBuildings) {
    const item = fixture(building);
    try {
      assert.ok(item.rooms.length >= 1, `${building.id} has a reachable room vignette`);
      assert.ok(item.finishes.includes('wood') && item.finishes.includes('fabric') && item.finishes.includes('metal'));
      for (const mesh of item.meshes) {
        const position = mesh.geometry.attributes.position;
        for (let n = 0; n < position.count; n++) {
          const [x, y, z] = [position.getX(n), position.getY(n), position.getZ(n)];
          assert.ok([x, y, z].every(Number.isFinite));
          assert.ok(Math.hypot(x, z) <= building.radius + .001, `${building.id} footprint`);
          assert.ok(y >= -.001 && y <= building.height + .001, `${building.id} height ${y}`);
        }
      }
    } finally { item.dispose(); }
  }
});

test('selected city windows reveal real occupied depth with no opaque facade backing', () => {
  const ray = new Raycaster();
  for (const building of cityBuildings) {
    const item = fixture(building);
    try {
      const opaque = item.meshes.filter((_, index) => item.finishes[index] !== 'window' && item.finishes[index] !== 'glass');
      const glazing = item.meshes.filter((_, index) => item.finishes[index] === 'window');
      for (const room of item.rooms) {
        assert.ok(room.depth >= 1 && room.width >= 1, `${building.id} furniture-scale room`);
        const origin = new Vector3(...room.window).add(new Vector3(0, 0, .5));
        ray.set(origin, new Vector3(origin.x, room.floor + .015, room.target[2]).sub(origin).normalize());
        const glass = ray.intersectObjects(glazing, false)[0];
        const interior = ray.intersectObjects(opaque, false)[0];
        assert.ok(glass && glass.distance < .8, `${building.id} visible transparent opening`);
        assert.ok(interior && interior.distance > glass.distance + .25, `${building.id} has depth behind glass, found ${interior?.distance}`);
        assert.ok(interior.distance < .5 + room.depth + .6, `${building.id} room has real rear geometry`);
        const inside = new Vector3(...room.target); inside.y = room.floor + 1.1;
        ray.set(inside, new Vector3(0, -1, 0));
        assert.ok(ray.intersectObjects(opaque, false).length > 0, `${building.id} occupied floor beneath room`);
      }
    } finally { item.dispose(); }
  }
});

test('adjacent buildings have different structural height profiles and facade depths', () => {
  const profiles = new Map<string, number[]>();
  for (const building of cityBuildings) {
    const item = fixture(building);
    try {
      const profile: number[] = [];
      // Scan actual roof/slab/wall geometry at world-scale height bands. Furniture cannot provide variety.
      for (let level = 0; level < 16; level++) {
        const low = .4 + level * .75; let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
        item.meshes.forEach((mesh, index) => {
          if (!['porcelain', 'stone', 'aqua', 'window'].includes(item.finishes[index])) return;
          const p = mesh.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) if (p.getY(i) >= low && p.getY(i) < low + .75) {
            minX = Math.min(minX, p.getX(i)); maxX = Math.max(maxX, p.getX(i)); minZ = Math.min(minZ, p.getZ(i)); maxZ = Math.max(maxZ, p.getZ(i));
          }
        });
        profile.push(Number.isFinite(minX) ? maxX - minX : 0, Number.isFinite(minZ) ? maxZ - minZ : 0);
      }
      profiles.set(building.id, profile);
    } finally { item.dispose(); }
  }
  let adjacent = 0;
  for (let i = 0; i < cityBuildings.length; i++) for (let j = i + 1; j < cityBuildings.length; j++) {
    const a = cityBuildings[i]; const b = cityBuildings[j];
    if (Math.hypot(a.x - b.x, a.z - b.z) > 12) continue;
    adjacent++;
    const difference = profiles.get(a.id)!.reduce((sum, width, index) => sum + Math.abs(width - profiles.get(b.id)![index]), 0);
    assert.ok(difference > 3.5, `${a.id} and ${b.id} repeat the same structural silhouette (${difference})`);
  }
  assert.ok(adjacent > 20);
});

test('entrances and equipment mounts are attached to actual thresholds and roofs', () => {
  const ray = new Raycaster();
  for (const building of cityBuildings) {
    const item = fixture(building);
    try {
      const local = cityEntranceLocal(building); const world = cityEntranceWorld(building);
      assert.ok(Math.abs(world.y - CITY_BASE_Y - local[1]) < 1e-9);
      // Sample a few centimeters inside the threshold edge to avoid the mathematical boundary.
      const inside = new Vector3(...local);
      if (building.family === 'public-station') inside.x -= .04; else inside.z -= .05;
      inside.y += .2; ray.set(inside, new Vector3(0, -1, 0));
      const floor = ray.intersectObjects(item.meshes, false)[0];
      assert.ok(floor && Math.abs(floor.point.y - local[1]) < .025, `${building.id} threshold touches a physical slab`);
      const mount = cityRoofMounts.find(value => value.building === building.id);
      if (mount) {
        ray.set(new Vector3(...mount.local).add(new Vector3(0, .1, 0)), new Vector3(0, -1, 0));
        const roof = ray.intersectObjects(item.meshes, false)[0];
        assert.ok(roof && Math.abs(roof.point.y - mount.local[1]) < .04, `${building.id} equipment mount reaches roof`);
      }
    } finally { item.dispose(); }
  }
});


test('station canopy provides full standing headroom across the boarding platform', () => {
  const building = cityBuildings.find(item => item.id === 'transit-garden')!;
  const item = fixture(building);
  try {
    const canopy = item.meshes.filter(mesh => { mesh.geometry.computeBoundingBox(); return mesh.geometry.boundingBox!.min.y > 4; });
    assert.equal(canopy.length, 1);
    const ray = new Raycaster(new Vector3(), new Vector3(0, 1, 0));
    for (let i = 0; i <= 12; i++) for (let j = 0; j <= 8; j++) {
      ray.ray.origin.set(-1.58 + i * 3.16 / 12, 2.32, -1.35 + j * 2.7 / 8);
      const roof = ray.intersectObjects(canopy, false)[0];
      assert.ok(roof && roof.distance >= 1.85, `Platform headroom ${roof?.distance}`);
    }
    // North stair portal and rail center both retain clear overhead space.
    for (const x of [0, 1.59]) {
      ray.ray.origin.set(x, 2.32, 0);
      assert.ok(ray.intersectObjects(canopy, false)[0].distance >= 1.85);
    }
  } finally { item.dispose(); }
});
