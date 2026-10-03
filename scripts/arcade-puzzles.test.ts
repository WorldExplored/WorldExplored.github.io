import assert from 'node:assert/strict';
import test from 'node:test';
import { hopLily, lilyObjects, moveTileBlank, newLily, newTiles, slideTile, stepLily, type LilyState, type TileState } from '../src/components/arcade/puzzleLogic';

const playing = () => ({ ...newLily(), status: 'playing' as const });
test('every shuffled sliding puzzle is unsolved, unique and solvable', () => {
  let seed = 71;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let sample = 0; sample < 100; sample++) {
    const game = newTiles(random), numbered = game.tiles.filter(Boolean);
    let inversions = 0;
    for (let i = 0; i < numbered.length; i++) for (let j = i + 1; j < numbered.length; j++) if (numbered[i] > numbered[j]) inversions++;
    const blankRowFromBottom = 4 - Math.floor(game.tiles.indexOf(0) / 4);
    assert.equal((inversions + blankRowFromBottom) % 2, 1);
    assert.equal(new Set(game.tiles).size, 16);
    assert.ok(game.tiles.some((n, i) => n !== (i + 1) % 16));
    assert.equal(game.status, 'ready'); assert.equal(game.moves, 0);
    assert.equal(slideTile(game, 0), game, 'no input before Play');
  }
});
test('sliding respects adjacency, row edges, win and restart', () => {
  const state: TileState = { tiles: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,0,15], status: 'playing', moves: 4 };
  assert.equal(slideTile(state, 0), state);
  const won = slideTile(state, 15); assert.equal(won.status, 'won'); assert.equal(won.moves, 5);
  assert.equal(slideTile(won, 14), won);
  const edge = { ...state, tiles: [1,2,3,0,5,6,7,8,9,10,11,12,13,14,4,15] };
  assert.equal(moveTileBlank(edge, 'right'), edge);
});
test('river rafts carry the frog and collisions reset it without ending the clock', () => {
  const state = playing(), raft = lilyObjects(5, 0).find(item => item.x > .5 && item.x < 8)!;
  const carried = stepLily({ ...state, x: raft.x, row: 5 }, .1);
  assert.ok(carried.x > raft.x); assert.equal(carried.lives, 3);
  const boat = lilyObjects(4, 0).find(item => item.x > .5 && item.x < 8)!;
  const crash = stepLily({ ...state, x: boat.x, row: 4 }, .01);
  assert.equal(crash.lives, 2); assert.equal(crash.row, 6); assert.ok(crash.time > 0);
  const lost = stepLily({ ...state, lives: 1, remaining: .005 }, .01);
  assert.equal(lost.status, 'lost'); assert.equal(stepLily(lost, .1), lost);
});
test('only unoccupied home pads count, and three crossings win', () => {
  let state: LilyState = playing();
  for (const home of [1, 4, 7]) state = hopLily({ ...state, row: 1, x: home + .5 }, 'up');
  assert.equal(state.status, 'won'); assert.deepEqual(state.homes, [1, 4, 7]);
  const occupied = hopLily({ ...playing(), homes: [4], x: 4.5, row: 1 }, 'up');
  assert.equal(occupied.lives, 2); assert.deepEqual(occupied.homes, [4]);
  assert.equal(hopLily(newLily(), 'up').row, 6);
});
test('river simulation bounds long frame gaps and never changes terminal states', () => {
  const state = playing(), stepped = stepLily(state, 20);
  assert.ok(stepped.time <= .101); assert.ok(stepped.remaining > 31.8);
  assert.equal(stepLily(state, NaN), state);
  assert.equal(stepLily(state, -1), state);
  assert.equal(stepLily({ ...state, status: 'won' }, .1).status, 'won');
});
