import test from 'node:test';
import assert from 'node:assert/strict';
import { create } from '@react-three/test-renderer';
import { Box3, InstancedMesh, Mesh } from 'three';
import { newPong, stepPong, PONG, blockCells, blocksFit, blocksGhost, dropBlocks, moveBlocks, newBlocks, rotateBlocks, stepBlocks, type BlocksState } from '../src/components/arcade/retroLogic';
import { ArcadeHall, ARCADE_BOUNDS, ARCADE_PLAN, createArcadeHall, createArcadeInterior } from '../src/components/world/ArcadeHall';
import { createCityTransitRoute, cityBuildings } from '../src/components/world/city';
import { createSceneRuntime, world } from '../src/content/world';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const random = () => .314;

test('Pong reflects at walls and uses impact position to aim paddle returns', () => {
  const base = { ...newPong(), status: 'playing' as const, serve: 0 };
  const wall = stepPong({ ...base, y: 7, vy: -220, vx: 100 }, .03);
  assert.ok(wall.y >= PONG.radius && wall.vy > 0);
  const middle = stepPong({ ...base, x: 29, y: 160, vx: -250, vy: 0 }, .02);
  const edge = stepPong({ ...base, x: 29, y: 185, vx: -250, vy: 0 }, .02);
  assert.ok(middle.vx > 0 && Math.abs(middle.vy) < 1);
  assert.ok(edge.vx > 0 && edge.vy > 100);
});

test('Pong scores once, pauses the serve, and ends at five points', () => {
  const base = { ...newPong(), status: 'playing' as const, serve: 0 };
  const point = stepPong({ ...base, x: 407, vx: 220 }, .03);
  assert.equal(point.score, 1); assert.equal(point.x, 200); assert.ok(point.serve > 1);
  assert.equal(stepPong(point, .05).score, 1);
  assert.equal(stepPong({ ...base, x: 407, score: 4 }, .03).status, 'won');
  const lost = stepPong({ ...base, x: -7, opponentScore: 4, vx: -220 }, .03);
  assert.equal(lost.status, 'lost'); assert.equal(stepPong(lost, 1), lost);
});

test('Pong bounds catch-up, touchscreen targets and the opponent speed', () => {
  const game = { ...newPong(), status: 'playing' as const, serve: 0, y: 300, vx: 180 };
  assert.deepEqual(stepPong(game, 12), stepPong(game, .05));
  assert.equal(stepPong(game, .01, 0, -100).paddle, 38);
  assert.equal(stepPong(game, .01, 0, 1000).paddle, 282);
  assert.ok(Math.abs(stepPong(game, .05).opponent - game.opponent) <= 145 * .05 + .001);
});

test('falling blocks deal complete seven-piece bags and stay in bounds during rotation', () => {
  let game: BlocksState = { ...newBlocks(random), status: 'playing' };
  assert.equal(new Set([game.piece.kind, ...game.queue.slice(0, 6)]).size, 7);
  for (let kind = 0; kind < 7; kind++) {
    game = { ...game, piece: { kind, rotation: 0, x: 3, y: 4 } };
    const cells = blockCells(game.piece);
    for (let i = 0; i < 4; i++) game = rotateBlocks(game);
    assert.deepEqual(blockCells(game.piece), cells);
    for (let i = 0; i < 20; i++) game = moveBlocks(game, -1);
    for (let i = 0; i < 4; i++) { game = rotateBlocks(game); assert.ok(blocksFit(game.board, game.piece)); }
  }
});

test('falling blocks hard-drop to the ghost, lock once, and clear complete rows', () => {
  const board = Array(180).fill(0); for (let x = 0; x < 10; x++) if (x < 3 || x > 6) board[170 + x] = 4;
  const game: BlocksState = { ...newBlocks(random), board, piece: { kind: 0, rotation: 0, x: 3, y: 0 }, status: 'playing' };
  const ghost = blocksGhost(game);
  assert.equal(Math.max(...blockCells(ghost).map(cell => cell.y)), 17);
  const next = dropBlocks(game, true, random);
  assert.equal(next.lines, 1); assert.ok(next.board.every(cell => cell === 0)); assert.ok(next.score >= 100);
  assert.equal(game.board.filter(Boolean).length, 6, 'Original board is immutable.');
  assert.equal(next.piece.kind, game.queue[0]);
});

test('falling blocks reject occupied cells, stop on spawn collision and freeze after loss', () => {
  const game: BlocksState = { ...newBlocks(random), piece: { kind: 1, rotation: 0, x: 3, y: 16 }, status: 'playing' };
  for (let x = 3; x < 7; x++) { game.board[x] = 3; game.board[10 + x] = 3; }
  const lost = dropBlocks(game, false, random);
  assert.equal(lost.status, 'lost'); assert.equal(stepBlocks(lost, .05), lost); assert.equal(moveBlocks(lost, 1), lost);
  const fresh = { ...newBlocks(random), status: 'playing' as const };
  assert.deepEqual(stepBlocks(fresh, 10), stepBlocks(fresh, .05));
});

test('enlarged arcade has closed room geometry, inset floors and clearance from the monorail and neighboring buildings', () => {
  const shell = createArcadeHall(), interior = createArcadeInterior();
  try {
    const bounds = new Box3();
    for (const geometry of Object.values(shell)) { geometry.computeBoundingBox(); bounds.union(geometry.boundingBox!); }
    assert.ok(bounds.max.x <= ARCADE_BOUNDS.halfWidth + .001 && bounds.min.x >= -ARCADE_BOUNDS.halfWidth - .001);
    assert.ok(bounds.max.y <= ARCADE_BOUNDS.top + .001);
    assert.ok(bounds.min.z >= ARCADE_BOUNDS.back - .001);
    shell.base.computeBoundingBox(); assert.ok(shell.base.boundingBox!.max.x - shell.base.boundingBox!.min.x > 6.5);
    for (const geometry of Object.values(interior)) {
      for (const floor of geometry.userData.floors ?? []) {
        const positions = geometry.attributes.position, index = geometry.index;
        for (let i = floor.start; i < floor.start + floor.count; i++) {
          const vertex = index ? index.getX(i) : i;
          assert.ok(Math.abs(positions.getX(vertex)) <= 3.026);
          assert.ok(positions.getZ(vertex) >= -2.681 && positions.getZ(vertex) <= 2.081);
        }
      }
    }
    const route = createCityTransitRoute(), arcade = world.landmarks.find(item => item.id === 'arcade')!;
    for (let i = 0; i < 4000; i++) {
      const point = route.curve.getPointAt(i / 4000), x = point.x - arcade.position[0], z = point.z - arcade.position[2];
      const clearance = Math.min(...ARCADE_PLAN.map((a, j) => {
        const b = ARCADE_PLAN[(j + 1) % ARCADE_PLAN.length], dx = b[0] - a[0], dz = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
      }));
      assert.ok(clearance > 1.1, `Monorail clearance at ${point.x},${point.z}`);
    }
    for (const building of cityBuildings) {
      const halfX = Math.abs(Math.cos(building.rotation)) * building.width / 2 + Math.abs(Math.sin(building.rotation)) * building.depth / 2;
      const halfZ = Math.abs(Math.sin(building.rotation)) * building.width / 2 + Math.abs(Math.cos(building.rotation)) * building.depth / 2;
      const gapX = Math.abs(building.x - arcade.position[0]) - ARCADE_BOUNDS.halfWidth - halfX;
      const gapZ = Math.abs(building.z - (arcade.position[2] - .25)) - 2.78 - halfZ;
      assert.ok(Math.max(gapX, gapZ) > .55, `${building.id}: shell and walkway clearance`);
    }
  } finally { Object.values(shell).forEach(g => g.dispose()); Object.values(interior).forEach(g => g.dispose()); }
});

test('arcade marquee and cabinet pixels animate in one retained batch, with stable reduced motion', async () => {
  const runtime = { current: createSceneRuntime() };
  const renderer = await create(<ArcadeHall active={false} paused={false} quality="high" runtime={runtime}/>);
  try {
    const mesh = renderer.scene.instance.getObjectByName('arcade-marquee-lamps') as InstancedMesh;
    const geometry = mesh.geometry, material = mesh.material;
    await renderer.advanceFrames(1, .016); const before = mesh.instanceMatrix.array.slice();
    runtime.current.elapsed = 10; await renderer.advanceFrames(1, .016); assert.notDeepEqual(mesh.instanceMatrix.array, before);
    await renderer.update(<ArcadeHall active={false} paused quality="low" runtime={runtime}/>);
    await renderer.advanceFrames(1, .016); const frozen = mesh.instanceMatrix.array.slice();
    runtime.current.elapsed = 20; await renderer.advanceFrames(1, .016); assert.deepEqual(mesh.instanceMatrix.array, frozen);
    assert.equal(mesh.geometry, geometry); assert.equal(mesh.material, material);
    let triangles = 0, draws = 0;
    renderer.scene.instance.traverse(object => { if (object instanceof Mesh) { draws++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0) / 3 * (object instanceof InstancedMesh ? object.count : 1); } });
    assert.ok(draws <= 25); assert.ok(triangles <= 18000);
  } finally { await renderer.unmount(); }
});
