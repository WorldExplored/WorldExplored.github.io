import { shuffled, type GameStatus } from './gameLogic';

export const PONG = { width: 400, height: 320, paddleHeight: 68, radius: 6, left: 21, right: 379, winningScore: 5 };
export interface PongState { x: number; y: number; vx: number; vy: number; paddle: number; opponent: number; score: number; opponentScore: number; serve: number; time: number; status: GameStatus }
export function newPong(): PongState {
  return { x: 200, y: 160, vx: -172, vy: 91, paddle: 160, opponent: 160, score: 0, opponentScore: 0, serve: .8, time: 0, status: 'ready' };
}
const clampPong = (y: number) => Math.max(PONG.paddleHeight / 2 + 4, Math.min(PONG.height - PONG.paddleHeight / 2 - 4, y));
export function stepPong(state: PongState, seconds: number, direction = 0, target?: number): PongState {
  if (state.status !== 'playing') return state;
  const next = { ...state };
  const dt = Math.max(0, Math.min(seconds, .05)), steps = Math.max(1, Math.ceil(dt * 300)), h = dt / steps;
  for (let i = 0; i < steps; i++) {
    next.time += h;
    next.paddle = clampPong(target ?? (next.paddle + direction * 280 * h));
    const aim = next.vx > 0 ? next.y + Math.sin(next.time * 1.7) * 17 : 160;
    next.opponent = clampPong(next.opponent + Math.max(-145 * h, Math.min(145 * h, aim - next.opponent)));
    if (next.serve > 0) { next.serve = Math.max(0, next.serve - h); continue; }
    const oldX = next.x;
    next.x += next.vx * h; next.y += next.vy * h;
    if (next.y < PONG.radius) { next.y = PONG.radius; next.vy = Math.abs(next.vy); }
    if (next.y > PONG.height - PONG.radius) { next.y = PONG.height - PONG.radius; next.vy = -Math.abs(next.vy); }
    for (const side of [-1, 1]) {
      const plane = side < 0 ? PONG.left + PONG.radius : PONG.right - PONG.radius;
      const paddle = side < 0 ? next.paddle : next.opponent;
      if (Math.sign(next.vx) !== side || (side < 0 ? oldX < plane || next.x > plane : oldX > plane || next.x < plane) || Math.abs(next.y - paddle) > PONG.paddleHeight / 2 + PONG.radius) continue;
      const offset = Math.max(-1, Math.min(1, (next.y - paddle) / (PONG.paddleHeight / 2)));
      const speed = Math.min(325, Math.hypot(next.vx, next.vy) + 10);
      next.vx = -side * speed * Math.cos(offset * 1.02); next.vy = speed * Math.sin(offset * 1.02); next.x = plane;
    }
    if (next.x < -PONG.radius || next.x > PONG.width + PONG.radius) {
      const playerWon = next.x > PONG.width;
      if (playerWon) next.score++; else next.opponentScore++;
      if (next.score === PONG.winningScore) next.status = 'won';
      else if (next.opponentScore === PONG.winningScore) next.status = 'lost';
      next.x = 200; next.y = 160; next.serve = 1.1;
      next.vx = playerWon ? 172 : -172; next.vy = (next.score + next.opponentScore) % 2 ? -91 : 91;
      break;
    }
  }
  return next;
}

export const BLOCKS = { columns: 10, rows: 18 };
export const BLOCK_COLORS = ['#075c9c', '#13a3ad', '#84b63b', '#d4a529', '#7861aa', '#259673', '#f09263'];
const SHAPES = [
  [[0, 1], [1, 1], [2, 1], [3, 1]],
  [[1, 0], [2, 0], [1, 1], [2, 1]],
  [[1, 0], [0, 1], [1, 1], [2, 1]],
  [[1, 0], [2, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[2, 0], [0, 1], [1, 1], [2, 1]],
] as const;
export interface BlockPiece { kind: number; rotation: number; x: number; y: number }
export interface BlocksState { board: number[]; piece: BlockPiece; queue: number[]; score: number; lines: number; fall: number; status: GameStatus }
export function blockCells(piece: BlockPiece) {
  return SHAPES[piece.kind].map(([px, py]) => {
    let x: number = px, y: number = py;
    if (piece.kind !== 1) for (let i = 0; i < piece.rotation % 4; i++) [x, y] = [(piece.kind === 0 ? 3 : 2) - y, x];
    return { x: x + piece.x, y: y + piece.y };
  });
}
export function blocksFit(board: number[], piece: BlockPiece) {
  return blockCells(piece).every(({ x, y }) => x >= 0 && x < BLOCKS.columns && y >= 0 && y < BLOCKS.rows && board[y * BLOCKS.columns + x] === 0);
}
function bag(random: () => number) { return shuffled([0, 1, 2, 3, 4, 5, 6], random); }
export function newBlocks(random = Math.random): BlocksState {
  const queue = [...bag(random), ...bag(random)];
  return { board: Array(BLOCKS.columns * BLOCKS.rows).fill(0), piece: { kind: queue.shift()!, rotation: 0, x: 3, y: 0 }, queue, score: 0, lines: 0, fall: 0, status: 'ready' };
}
export function moveBlocks(state: BlocksState, dx: number): BlocksState {
  if (state.status !== 'playing') return state;
  const piece = { ...state.piece, x: state.piece.x + dx };
  return blocksFit(state.board, piece) ? { ...state, piece } : state;
}
export function rotateBlocks(state: BlocksState): BlocksState {
  if (state.status !== 'playing') return state;
  for (const dx of [0, -1, 1, -2, 2]) {
    const piece = { ...state.piece, x: state.piece.x + dx, rotation: (state.piece.rotation + 1) % 4 };
    if (blocksFit(state.board, piece)) return { ...state, piece };
  }
  return state;
}
function lockBlocks(state: BlocksState, random: () => number): BlocksState {
  const board = [...state.board];
  for (const { x, y } of blockCells(state.piece)) board[y * BLOCKS.columns + x] = state.piece.kind + 1;
  const rows = Array.from({ length: BLOCKS.rows }, (_, y) => board.slice(y * BLOCKS.columns, (y + 1) * BLOCKS.columns));
  const remaining = rows.filter(row => row.some(cell => cell === 0));
  const cleared = BLOCKS.rows - remaining.length;
  while (remaining.length < BLOCKS.rows) remaining.unshift(Array(BLOCKS.columns).fill(0));
  const queue = state.queue.length < 7 ? [...state.queue, ...bag(random)] : [...state.queue];
  const piece = { kind: queue.shift()!, rotation: 0, x: 3, y: 0 };
  const flattened = remaining.flat();
  return { ...state, board: flattened, piece, queue, fall: 0, lines: state.lines + cleared, score: state.score + [0, 100, 300, 500, 800][cleared] * (1 + Math.floor(state.lines / 8)), status: blocksFit(flattened, piece) ? 'playing' : 'lost' };
}
export function dropBlocks(state: BlocksState, hard = false, random = Math.random): BlocksState {
  if (state.status !== 'playing') return state;
  let piece = { ...state.piece }, distance = 0;
  while (blocksFit(state.board, { ...piece, y: piece.y + 1 })) {
    piece = { ...piece, y: piece.y + 1 }; distance++;
    if (!hard) return { ...state, piece, fall: 0, score: state.score + 1 };
  }
  return lockBlocks({ ...state, piece, score: state.score + distance * 2 }, random);
}
export function blocksGhost(state: BlocksState) {
  let piece = { ...state.piece };
  while (blocksFit(state.board, { ...piece, y: piece.y + 1 })) piece = { ...piece, y: piece.y + 1 };
  return piece;
}
export function stepBlocks(state: BlocksState, seconds: number, random = Math.random): BlocksState {
  if (state.status !== 'playing') return state;
  const fall = state.fall + Math.max(0, Math.min(.05, seconds));
  const interval = Math.max(.14, .72 * .84 ** Math.floor(state.lines / 8));
  if (fall < interval) return { ...state, fall };
  const piece = { ...state.piece, y: state.piece.y + 1 };
  return blocksFit(state.board, piece) ? { ...state, piece, fall: 0 } : lockBlocks(state, random);
}
