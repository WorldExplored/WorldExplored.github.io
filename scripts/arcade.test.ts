import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BREAKOUT, brickRect, flagMine, hideMemoryMismatch, mineNeighbors, newBreakout, newMemory, newMines, newSnake, revealMemory, revealMine, shuffled, snakeFood, stepBreakout, stepSnake, turnSnake, type MemoryState, type MineState, type SnakeState } from '../src/components/arcade/gameLogic';

function seeded(seed: number) { return () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; }; }

test('Snake queues perpendicular turns without reversing the current or queued heading', () => {
  const game = { ...newSnake(), status: 'playing' as const };
  assert.equal(turnSnake(game, 'left'), game);
  const first = turnSnake(game, 'up');
  assert.equal(turnSnake(first, 'down'), first);
  const second = turnSnake(first, 'left');
  assert.deepEqual(second.turns, ['up', 'left']);
  assert.equal(turnSnake(second, 'down'), second);
  const moved = stepSnake(second);
  assert.deepEqual(moved.body[0], { x: 8, y: 7 });
  assert.deepEqual(stepSnake(moved).body[0], { x: 7, y: 7 });
});

test('Snake consumes food, grows exactly one segment, and never spawns inside itself', () => {
  const game = { ...newSnake(), food: { x: 9, y: 8 }, status: 'playing' as const };
  const next = stepSnake(game, seeded(5));
  assert.equal(next.body.length, game.body.length + 1);
  assert.equal(next.score, 10);
  assert.ok(!next.body.some(p => p.x === next.food?.x && p.y === next.food?.y));
  assert.equal(game.body.length, 3);
});

test('Snake allows the departing tail cell but ends on a body or wall collision', () => {
  const game: SnakeState = { size: 4, body: [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }], direction: 'right', turns: [], food: { x: 3, y: 3 }, score: 0, status: 'playing' };
  assert.equal(stepSnake(game).status, 'playing');
  assert.equal(stepSnake({ ...game, direction: 'down' }).status, 'lost');
  assert.equal(stepSnake({ ...game, body: [{ x: 0, y: 0 }], direction: 'left' }).status, 'lost');
});

test('Snake wins on the last free cell and does not move after the game ends', () => {
  const game: SnakeState = { size: 2, body: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], direction: 'right', turns: [], food: { x: 1, y: 0 }, score: 0, status: 'playing' };
  const next = stepSnake(game);
  assert.equal(next.status, 'won');
  assert.equal(next.food, null);
  assert.equal(snakeFood(next.body, 2), null);
  assert.equal(stepSnake(next), next);
});

test('Minesweeper guarantees a safe opening and its neighboring water for every first square', () => {
  for (let index = 0; index < 36; index++) {
    const original = { ...newMines(), status: 'playing' as const };
    const next = revealMine(original, index, seeded(index + 1));
    assert.equal(next.planted, true);
    assert.equal(next.cells.filter(c => c.mine).length, 6);
    for (const safe of [index, ...mineNeighbors(index, 6)]) assert.equal(next.cells[safe].mine, false);
    assert.ok(next.cells[index].revealed);
    assert.equal(original.planted, false);
  }
});

test('Minesweeper flood reveal respects flags and counts all adjacent mines', () => {
  let game = { ...newMines(), status: 'playing' as const } as MineState;
  game = flagMine(game, 7);
  const next = revealMine(game, 0, seeded(31));
  assert.equal(next.cells[7].flagged, true);
  assert.equal(next.cells[7].revealed, false);
  assert.ok(next.cells.filter(c => c.revealed).length > 1);
  next.cells.forEach((cell, index) => assert.equal(cell.adjacent, mineNeighbors(index, 6).filter(i => next.cells[i].mine).length));
  assert.equal(revealMine(next, 7), next);
});

test('Minesweeper limits flags, supports unflagging, and ends correctly on a mine', () => {
  let game: MineState = { ...newMines(), status: 'playing' };
  for (let i = 0; i < 6; i++) game = flagMine(game, i);
  assert.equal(flagMine(game, 6), game);
  game = flagMine(game, 0);
  assert.equal(game.cells[0].flagged, false);
  game = revealMine(game, 0, seeded(7));
  const mine = game.cells.findIndex(c => c.mine && !c.flagged);
  const lost = revealMine(game, mine);
  assert.equal(lost.status, 'lost');
  assert.ok(lost.cells.filter(c => c.mine).every(c => c.revealed));
  assert.equal(flagMine(lost, 10), lost);
});

test('Minesweeper wins by revealing safe squares, without requiring flags', () => {
  let game: MineState = revealMine({ ...newMines(), status: 'playing' }, 15, seeded(4));
  for (let index = 0; index < 36; index++) if (!game.cells[index].mine) game = revealMine(game, index);
  assert.equal(game.status, 'won');
  assert.equal(game.cells.filter(c => c.revealed).length, 30);
  assert.equal(game.cells.filter(c => c.flagged).length, 0);
});

test('Memory shuffles an intact deck with exactly eight distinct pairs', () => {
  const a = newMemory(seeded(18)), b = newMemory(seeded(9));
  assert.notDeepEqual(a.cards, b.cards);
  for (let value = 0; value < 8; value++) assert.equal(a.cards.filter(c => c === value).length, 2);
  assert.deepEqual([...shuffled([0, 1, 2, 3], seeded(5))].sort(), [0, 1, 2, 3]);
});

test('Memory blocks a third reveal and resolves only a pending mismatched pair', () => {
  let game: MemoryState = { ...newMemory(seeded(11)), status: 'playing' };
  const mismatch = game.cards.findIndex(value => value !== game.cards[0]);
  game = revealMemory(game, 0);
  assert.equal(revealMemory(game, 0), game);
  game = revealMemory(game, mismatch);
  assert.equal(game.attempts, 1);
  assert.equal(revealMemory(game, 15), game);
  const resolved = hideMemoryMismatch(game);
  assert.deepEqual(resolved.open, []);
  assert.equal(hideMemoryMismatch(resolved), resolved);
});

test('Memory retains matched cards and wins after all eight matches', () => {
  let game: MemoryState = { ...newMemory(seeded(12)), status: 'playing' };
  for (let value = 0; value < 8; value++) {
    const pair = game.cards.map((v, i) => v === value ? i : -1).filter(i => i >= 0);
    game = revealMemory(revealMemory(game, pair[0]), pair[1]);
    assert.equal(revealMemory(game, pair[0]), game);
  }
  assert.equal(game.status, 'won');
  assert.equal(game.attempts, 8);
  assert.equal(game.matched.length, 16);
  assert.deepEqual(game.open, []);
});

test('Breakout reflects at the top and sides while preserving speed', () => {
  const base = { ...newBreakout(), status: 'playing' as const };
  const left = stepBreakout({ ...base, x: 7, y: 190, vx: -230, vy: 0 }, .02);
  assert.ok(left.x >= BREAKOUT.radius && left.vx > 0);
  const top = stepBreakout({ ...base, x: 200, y: 7, vx: 0, vy: -230 }, .02);
  assert.ok(top.y >= BREAKOUT.radius && top.vy > 0);
  assert.equal(Math.hypot(top.vx, top.vy), 230);
});

test('Breakout continuous substeps prevent tunneling through a tile at maximum speed', () => {
  const b = brickRect(24);
  const game = { ...newBreakout(), status: 'playing' as const, x: b.x + b.width / 2, y: b.y + b.height + 7, vx: 0, vy: -330 };
  const next = stepBreakout(game, .05);
  assert.equal(next.bricks[24], false);
  assert.equal(next.score, 25);
  assert.ok(next.vy > 0);
  assert.equal(game.bricks[24], true);
});

test('Breakout paddle angle follows impact location, while missed balls cost one life', () => {
  const base = { ...newBreakout(), status: 'playing' as const };
  const center = stepBreakout({ ...base, x: 200, y: 296, vx: 0, vy: 220 }, .02);
  assert.ok(center.vy < 0 && Math.abs(center.vx) < 1);
  const right = stepBreakout({ ...base, x: 226, y: 296, vx: 0, vy: 220 }, .02);
  assert.ok(right.vy < 0 && right.vx > 0);
  const missed = stepBreakout({ ...base, y: 347, x: 20, vy: 220 }, .05);
  assert.equal(missed.lives, 2);
  assert.equal(missed.y, 282);
  const lost = stepBreakout({ ...base, y: 347, lives: 1 }, .02);
  assert.equal(lost.status, 'lost');
});

test('Breakout has bounded catch-up, paddle limits, and a final-brick win', () => {
  const base = { ...newBreakout(), status: 'playing' as const };
  assert.deepEqual(stepBreakout(base, 2), stepBreakout(base, .05));
  assert.equal(stepBreakout(base, .01, 0, 1000).paddle, 358);
  assert.equal(stepBreakout(base, .01, 0, -100).paddle, 42);
  const b = brickRect(24), bricks = base.bricks.map((_, i) => i === 24);
  const won = stepBreakout({ ...base, bricks, x: b.x + 20, y: b.y + b.height + 7, vx: 0, vy: -230 }, .05);
  assert.equal(won.status, 'won');
  assert.equal(stepBreakout(won, .01), won);
});
