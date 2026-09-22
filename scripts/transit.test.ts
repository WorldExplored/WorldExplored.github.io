import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Matrix4, Mesh, MeshPhysicalMaterial, Object3D, Triangle, Vector3, type BufferGeometry } from 'three';
import { world } from '../src/content/world';
import { buildCityArchitecture, type CityFinish } from '../src/components/world/CityArchitecture';
import { makeHistoryMuseum } from '../src/components/world/CivicLandmarks';
import { makeCityCarriage } from '../src/components/world/CityMonorail';
import { CITY_CARRIAGE_HALF_LENGTH, CITY_CARRIAGE_HALF_WIDTH, CITY_TRACK_Y, cityBuildings, createCityTransitRoute, writeCityTransitPose } from '../src/components/world/city';
import { terrainHeight } from '../src/components/world/terrain';

function obstacleBounds() {
  const bounds: Array<{ id: string; box: Box3 }> = [];
  const local = new Object3D(), placement = new Object3D();
  for (const building of cityBuildings.filter(item => item.family !== 'public-station')) {
    placement.position.set(building.x, terrainHeight(building.x, building.z), building.z); placement.rotation.y = building.rotation; placement.updateMatrix();
    buildCityArchitecture(building, (geometry, _finish, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, yaw = 0) => {
      local.position.set(x, y, z); local.scale.set(sx, sy, sz); local.rotation.y = yaw; local.updateMatrix();
      geometry.applyMatrix4(local.matrix).applyMatrix4(placement.matrix); geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      if (box.max.y > CITY_TRACK_Y - .4 && box.min.y < CITY_TRACK_Y + 1.25) bounds.push({ id: building.id, box: box.clone() });
      geometry.dispose();
    }, undefined, () => {});
  }
  const history = world.landmarks.find(item => item.id === 'history')!;
  placement.position.set(...history.position); placement.position.y += terrainHeight(history.position[0], history.position[2]); placement.rotation.y = history.rotationY!; placement.updateMatrix();
  for (const geometry of Object.values(makeHistoryMuseum()) as BufferGeometry[]) {
    geometry.applyMatrix4(placement.matrix); geometry.computeBoundingBox();
    bounds.push({ id: 'history', box: geometry.boundingBox!.clone() }); geometry.dispose();
  }
  return bounds;
}

function isInside(x: number, z: number, loop: Vector3[]) {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i], b = loop[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

test('the complete train swept envelope clears every city shell and rotated History geometry', () => {
  const route = createCityTransitRoute(), bounds = obstacleBounds();
  // A circumscribed disk also covers carriage overhang as it rotates on every tight bend.
  const radius = Math.hypot(CITY_CARRIAGE_HALF_WIDTH, CITY_CARRIAGE_HALF_LENGTH);
  let clearance = Infinity, historyClearance = Infinity, bodyClearance = Infinity;
  const tangent = new Vector3();
  const segmentDistance = (p: number[], a: number[], b: number[]) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
  };
  const loop = route.curve.getSpacedPoints(12000);
  for (const [sample, point] of loop.entries()) {
    route.curve.getTangentAt(sample / 12000, tangent);
    const car = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([side, end]) => [point.x + tangent.z * side * CITY_CARRIAGE_HALF_WIDTH + tangent.x * end * CITY_CARRIAGE_HALF_LENGTH, point.z - tangent.x * side * CITY_CARRIAGE_HALF_WIDTH + tangent.z * end * CITY_CARRIAGE_HALF_LENGTH]);
    for (const { id, box } of bounds) {
      const distance = Math.hypot(Math.max(box.min.x - point.x, 0, point.x - box.max.x), Math.max(box.min.z - point.z, 0, point.z - box.max.z)) - radius;
      clearance = Math.min(clearance, distance);
      if (distance < bodyClearance) {
        const shell = [[box.min.x, box.min.z], [box.max.x, box.min.z], [box.max.x, box.max.z], [box.min.x, box.max.z]];
        for (let edge = 0; edge < 4; edge++) for (let vertex = 0; vertex < 4; vertex++) {
          bodyClearance = Math.min(bodyClearance, segmentDistance(car[vertex], shell[edge], shell[(edge + 1) % 4]), segmentDistance(shell[vertex], car[edge], car[(edge + 1) % 4]));
        }
      }
      if (id === 'history') historyClearance = Math.min(historyClearance, distance);
      assert.ok(distance > .1, `${id} intersects the swept carriage at ${point.toArray()}: ${distance}`);
    }
    for (const side of [-1, 0, 1]) assert.ok(terrainHeight(point.x + side * .48, point.z) < CITY_TRACK_Y - .4, 'Beam remains above the coast, with grounded piers below');
  }
  for (const building of cityBuildings.filter(item => item.family !== 'public-station')) assert.ok(isInside(building.x, building.z, loop), `${building.id} belongs inside the loop`);
  for (const { box } of bounds.filter(item => item.id === 'history')) for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) assert.ok(isInside(x, z, loop), 'All rotated History parts are inside the loop');
  assert.ok(historyClearance > 1.5, `History minimum clearance ${historyClearance}`);
  assert.ok(bodyClearance > .35, `True carriage body clearance ${bodyClearance}`);
  console.info(`Oriented carriage clearance: ${bodyClearance.toFixed(3)}m; Transit minimum swept clearance: ${clearance.toFixed(3)}m; History: ${historyClearance.toFixed(3)}m; ${loop.length} loop samples`);
});

test('carriage floor matches station height, running gear contacts the beam, and detailed geometry stays bounded', () => {
  const finishes: CityFinish[] = ['porcelain', 'glass', 'aqua', 'garden', 'window', 'stone', 'wood', 'fabric', 'metal'];
  const materials = Object.fromEntries(finishes.map(finish => [finish, new MeshPhysicalMaterial()])) as Record<CityFinish, MeshPhysicalMaterial>;
  const car = makeCityCarriage(materials), route = createCityTransitRoute(), position = new Vector3(), tangent = new Vector3();
  try {
    writeCityTransitPose(route, 2, 0, position, tangent);
    assert.ok(Math.abs(position.y + car.userData.boardingFloor - 3.16) < 1e-9);
    assert.ok(Math.hypot(position.x + 5, position.z + 68) < .01);
    assert.ok(Math.abs(tangent.z) < .01, 'Front boarding car aligns with the platform');
    assert.ok(car.children.length <= 7, 'Detailed train uses bounded finish batches');
    const bounds = new Box3().setFromObject(car);
    assert.ok(bounds.min.x >= -CITY_CARRIAGE_HALF_WIDTH && bounds.max.x <= CITY_CARRIAGE_HALF_WIDTH);
    assert.ok(bounds.min.z >= -CITY_CARRIAGE_HALF_LENGTH - 1e-6 && bounds.max.z <= CITY_CARRIAGE_HALF_LENGTH + 1e-6);
    const hardware = car.getObjectByName('monorail-metal') as Mesh;
    assert.ok(hardware.geometry.getAttribute('position').count > 1000, 'Batched undercarriage includes individual tyre and guide-roller geometry');
    assert.ok(Math.abs(position.y - .08 - .07 - (CITY_TRACK_Y + .03)) < 1e-9, 'Running tyres meet beam top');
    for (const mesh of car.children as Mesh[]) assert.ok(Array.from(mesh.geometry.getAttribute('position').array).every(Number.isFinite));
  } finally { for (const mesh of car.children as Mesh[]) mesh.geometry.dispose(); Object.values(materials).forEach(material => material.dispose()); }
});


test('all carriage parts clear the actual station platform, lobby and canopy supports throughout arrival and departure', () => {
  const materials = Object.fromEntries(['porcelain', 'glass', 'aqua', 'garden', 'window', 'stone', 'wood', 'fabric', 'metal'].map(finish => [finish, new MeshPhysicalMaterial()])) as Record<CityFinish, MeshPhysicalMaterial>;
  const carriage = makeCityCarriage(materials);
  const bounds = (carriage.userData.collisionBounds as Array<{ min: number[]; max: number[] }>).map(part => new Box3(new Vector3().fromArray(part.min), new Vector3().fromArray(part.max)));
  const station = cityBuildings.find(building => building.id === 'transit-garden')!;
  const local = new Object3D(), placement = new Object3D(), poses = new Object3D(), inverse = new Matrix4(), triangle = new Triangle();
  placement.position.set(station.x, terrainHeight(station.x, station.z), station.z); placement.rotation.y = station.rotation; placement.updateMatrix();
  const stationParts: BufferGeometry[] = [];
  buildCityArchitecture(station, (geometry, _finish, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, yaw = 0) => {
    local.position.set(x, y, z); local.scale.set(sx, sy, sz); local.rotation.y = yaw; local.updateMatrix();
    geometry.applyMatrix4(local.matrix).applyMatrix4(placement.matrix); geometry.computeBoundingBox();
    if (geometry.boundingBox!.max.y > 2.78 && geometry.boundingBox!.min.y < 4.06) {
      const plain = geometry.index ? geometry.toNonIndexed() : geometry; stationParts.push(plain);
      if (plain !== geometry) geometry.dispose();
    } else geometry.dispose();
  }, undefined, () => {});
  const route = createCityTransitRoute(), point = new Vector3(), tangent = new Vector3();
  try {
    for (let step = 0; step < 2400; step++) {
      const progress = step / 2400;
      route.curve.getPointAt(progress, point); point.y += .18;
      if (Math.hypot(point.x + 5, point.z + 68) > 4) continue;
      route.curve.getTangentAt(progress, tangent);
      poses.position.copy(point); poses.rotation.y = Math.atan2(tangent.x, tangent.z); poses.updateMatrix(); inverse.copy(poses.matrix).invert();
      for (const geometry of stationParts) {
        const vertices = geometry.getAttribute('position');
        for (let index = 0; index < vertices.count; index += 3) {
          triangle.a.fromBufferAttribute(vertices, index).applyMatrix4(inverse);
          triangle.b.fromBufferAttribute(vertices, index + 1).applyMatrix4(inverse);
          triangle.c.fromBufferAttribute(vertices, index + 2).applyMatrix4(inverse);
          assert.ok(!bounds.some(part => part.intersectsTriangle(triangle)), `A carriage part crosses station geometry at ${point.toArray()}`);
        }
      }
    }
  } finally {
    stationParts.forEach(geometry => geometry.dispose());
    for (const mesh of carriage.children as Mesh[]) mesh.geometry.dispose();
    Object.values(materials).forEach(material => material.dispose());
  }
});
