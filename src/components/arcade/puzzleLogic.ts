import type { Direction, GameStatus } from './gameLogic';

export interface TileState { tiles: number[]; moves: number; status: GameStatus }
export function slideTile(state: TileState, index: number): TileState {
  if (state.status !== 'playing' || index < 0 || index > 15) return state;
  const blank = state.tiles.indexOf(0);
  if (Math.abs(index % 4 - blank % 4) + Math.abs(Math.floor(index / 4) - Math.floor(blank / 4)) !== 1) return state;
  const tiles = state.tiles.slice(); [tiles[blank], tiles[index]] = [tiles[index], 0];
  return { tiles, moves: state.moves + 1, status: tiles.every((tile, i) => tile === (i + 1) % 16) ? 'won' : 'playing' };
}
export function newTiles(random = Math.random): TileState {
  let state: TileState = { tiles: Array.from({ length: 16 }, (_, i) => (i + 1) % 16), moves: 0, status: 'playing' };
  let previous = -1;
  for (let i = 0; i < 180; i++) {
    const blank = state.tiles.indexOf(0), neighbors = [blank - 4, blank + 4, blank - 1, blank + 1].filter(index => index >= 0 && index < 16 && index !== previous && Math.abs(index % 4 - blank % 4) + Math.abs(Math.floor(index / 4) - Math.floor(blank / 4)) === 1);
    previous = blank;
    state = slideTile({ ...state, status: 'playing' }, neighbors[Math.min(neighbors.length - 1, Math.floor(random() * neighbors.length))]);
  }
  if (state.tiles.every((tile, i) => tile === (i + 1) % 16)) state = slideTile({ ...state, status: 'playing' }, 14);
  return { ...state, moves: 0, status: 'ready' };
}
export function moveTileBlank(state: TileState, direction: Direction) {
  const blank = state.tiles.indexOf(0), offset = { up: -4, down: 4, left: -1, right: 1 }[direction];
  return slideTile(state, blank + offset);
}

export const LILY = { width: 9, rows: 7, homes: [1, 4, 7], seconds: 32 } as const;
export const LILY_LANES = [
  { row: 1, kind: 'raft', speed: -.48, spacing: 4.1, length: 2.8, offset: .6 },
  { row: 2, kind: 'boat', speed: .78, spacing: 4.6, length: 1.35, offset: 2.3 },
  { row: 4, kind: 'boat', speed: -.66, spacing: 4.4, length: 1.25, offset: -.2 },
  { row: 5, kind: 'raft', speed: .43, spacing: 4.0, length: 2.8, offset: 1.4 },
] as const;
export interface LilyState { x: number; row: number; time: number; remaining: number; lives: number; homes: number[]; status: GameStatus }
export function newLily(): LilyState { return { x: 4.5, row: 6, time: 0, remaining: LILY.seconds, lives: 3, homes: [], status: 'ready' }; }
export function lilyObjects(row: number, time: number) {
  const lane = LILY_LANES.find(lane => lane.row === row);
  if (!lane) return [];
  const start = ((lane.offset + time * lane.speed) % lane.spacing + lane.spacing) % lane.spacing;
  return [-1, 0, 1, 2, 3].map(i => ({ x: start + i * lane.spacing, length: lane.length, kind: lane.kind })).filter(item => item.x + item.length / 2 > -.5 && item.x - item.length / 2 < 9.5);
}
function missLily(state: LilyState): LilyState {
  return { ...state, x: 4.5, row: 6, lives: state.lives - 1, remaining: LILY.seconds, status: state.lives <= 1 ? 'lost' : 'playing' };
}
function resolveLily(state: LilyState): LilyState {
  if (state.x < .22 || state.x > 8.78 || state.remaining <= 0) return missLily(state);
  if (state.row === 0) {
    const home = LILY.homes.find(home => Math.abs(state.x - (home + .5)) < .48 && !state.homes.includes(home));
    if (home === undefined) return missLily(state);
    const homes = [...state.homes, home];
    return { ...state, homes, x: 4.5, row: 6, remaining: LILY.seconds, status: homes.length === 3 ? 'won' : 'playing' };
  }
  const lane = LILY_LANES.find(lane => lane.row === state.row);
  if (!lane) return state;
  const onObject = lilyObjects(state.row, state.time).some(item => Math.abs(state.x - item.x) < item.length / 2 + (lane.kind === 'boat' ? .19 : -.08));
  return (lane.kind === 'boat' ? onObject : !onObject) ? missLily(state) : state;
}
export function hopLily(state: LilyState, direction: Direction): LilyState {
  if (state.status !== 'playing') return state;
  const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const row = Math.max(0, Math.min(6, state.row + (direction === 'up' ? -1 : direction === 'down' ? 1 : 0)));
  return resolveLily({ ...state, x: Math.max(.5, Math.min(8.5, state.x + dx)), row });
}
export function stepLily(state: LilyState, delta: number): LilyState {
  if (state.status !== 'playing' || !Number.isFinite(delta) || delta <= 0) return state;
  let next = state, remaining = Math.min(delta, .1);
  while (remaining > 1e-8 && next.status === 'playing') {
    const dt = Math.min(remaining, 1 / 60), lane = LILY_LANES.find(lane => lane.row === next.row);
    next = resolveLily({ ...next, x: next.x + (lane?.kind === 'raft' ? lane.speed * dt : 0), time: next.time + dt, remaining: next.remaining - dt });
    remaining -= dt;
  }
  return next;
}
