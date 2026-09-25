export type GameStatus = 'ready' | 'playing' | 'won' | 'lost';
export type Point = { x: number; y: number };
export type Direction = 'up' | 'right' | 'down' | 'left';
const vectors: Record<Direction, Point> = { up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 } };
const opposite: Record<Direction, Direction> = { up: 'down', right: 'left', down: 'up', left: 'right' };
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export function shuffled<T>(values: readonly T[], random = Math.random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export interface SnakeState { size: number; body: Point[]; direction: Direction; turns: Direction[]; food: Point | null; score: number; status: GameStatus }
export function snakeFood(body: Point[], size: number, random = Math.random): Point | null {
  const free: Point[] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!body.some(p => same(p, { x, y }))) free.push({ x, y });
  return free[Math.min(free.length - 1, Math.floor(random() * free.length))] ?? null;
}
export function newSnake(size = 16): SnakeState {
  const center = Math.floor(size / 2);
  return { size, body: [{ x: center, y: center }, { x: center - 1, y: center }, { x: center - 2, y: center }], direction: 'right', turns: [], food: { x: center + 3, y: center }, score: 0, status: 'ready' };
}
export function turnSnake(state: SnakeState, direction: Direction): SnakeState {
  const previous = state.turns.at(-1) ?? state.direction;
  if (state.status !== 'playing' || state.turns.length >= 2 || direction === previous || direction === opposite[previous]) return state;
  return { ...state, turns: [...state.turns, direction] };
}
export function stepSnake(state: SnakeState, random = Math.random): SnakeState {
  if (state.status !== 'playing') return state;
  const direction = state.turns[0] ?? state.direction;
  const vector = vectors[direction];
  const head = { x: state.body[0].x + vector.x, y: state.body[0].y + vector.y };
  const eating = state.food !== null && same(head, state.food);
  const occupied = eating ? state.body : state.body.slice(0, -1);
  if (head.x < 0 || head.y < 0 || head.x >= state.size || head.y >= state.size || occupied.some(p => same(p, head))) return { ...state, status: 'lost' };
  const body = [head, ...state.body];
  if (!eating) body.pop();
  const food = eating ? snakeFood(body, state.size, random) : state.food;
  return { ...state, body, direction, turns: state.turns.slice(1), food, score: state.score + (eating ? 10 : 0), status: food ? 'playing' : 'won' };
}
export interface MineCell { mine: boolean; revealed: boolean; flagged: boolean; adjacent: number }
export interface MineState { size: number; mineCount: number; planted: boolean; cells: MineCell[]; status: GameStatus }
export function newMines(size = 6, mineCount = 6): MineState {
  return { size, mineCount, planted: false, cells: Array.from({ length: size * size }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 })), status: 'ready' };
}
export function mineNeighbors(index: number, size: number): number[] {
  const result: number[] = [], x = index % size, y = Math.floor(index / size);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && x + dx >= 0 && x + dx < size && y + dy >= 0 && y + dy < size) result.push((y + dy) * size + x + dx);
  return result;
}
export function flagMine(state: MineState, index: number): MineState {
  const cell = state.cells[index];
  if (!cell || cell.revealed || state.status !== 'playing') return state;
  if (!cell.flagged && state.cells.filter(c => c.flagged).length >= state.mineCount) return state;
  return { ...state, cells: state.cells.map((c, i) => i === index ? { ...c, flagged: !c.flagged } : c) };
}
export function revealMine(state: MineState, index: number, random = Math.random): MineState {
  if (state.status !== 'playing' || !state.cells[index] || state.cells[index].flagged || state.cells[index].revealed) return state;
  const cells = state.cells.map(c => ({ ...c }));
  if (!state.planted) {
    const safe = new Set([index, ...mineNeighbors(index, state.size)]);
    const candidates = shuffled(cells.map((_, i) => i).filter(i => !safe.has(i)), random);
    for (const i of candidates.slice(0, state.mineCount)) cells[i].mine = true;
    cells.forEach((c, i) => { c.adjacent = mineNeighbors(i, state.size).filter(n => cells[n].mine).length; });
  }
  if (cells[index].mine) return { ...state, planted: true, status: 'lost', cells: cells.map(c => ({ ...c, revealed: c.revealed || c.mine })) };
  const queue = [index];
  while (queue.length) {
    const i = queue.pop()!, cell = cells[i];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    if (!cell.adjacent) queue.push(...mineNeighbors(i, state.size));
  }
  const won = cells.every(c => c.mine || c.revealed);
  return { ...state, planted: true, cells, status: won ? 'won' : 'playing' };
}
export interface MemoryState { cards: number[]; open: number[]; matched: number[]; attempts: number; status: GameStatus }
export function newMemory(random = Math.random): MemoryState {
  return { cards: shuffled(Array.from({ length: 16 }, (_, i) => i % 8), random), open: [], matched: [], attempts: 0, status: 'ready' };
}
export function revealMemory(state: MemoryState, index: number): MemoryState {
  if (state.status !== 'playing' || index < 0 || index >= state.cards.length || state.open.length >= 2 || state.open.includes(index) || state.matched.includes(index)) return state;
  const open = [...state.open, index];
  if (open.length === 1) return { ...state, open };
  const matched = state.cards[open[0]] === state.cards[open[1]] ? [...state.matched, ...open] : state.matched;
  return { ...state, matched, open: matched.length > state.matched.length ? [] : open, attempts: state.attempts + 1, status: matched.length === state.cards.length ? 'won' : 'playing' };
}
export function hideMemoryMismatch(state: MemoryState): MemoryState {
  return state.open.length === 2 ? { ...state, open: [] } : state;
}
export const BREAKOUT = { width: 400, height: 340, paddleWidth: 76, paddleY: 304, radius: 6, columns: 7, rows: 4, brickWidth: 44, brickHeight: 15, gap: 7, left: 25, top: 35 };
export interface BreakoutState { x: number; y: number; vx: number; vy: number; paddle: number; bricks: boolean[]; lives: number; score: number; status: GameStatus }
export function newBreakout(): BreakoutState {
  return { x: 200, y: 282, vx: 116, vy: -202, paddle: 200, bricks: Array(28).fill(true), lives: 3, score: 0, status: 'ready' };
}
export function brickRect(index: number) {
  return { x: BREAKOUT.left + (index % BREAKOUT.columns) * (BREAKOUT.brickWidth + BREAKOUT.gap), y: BREAKOUT.top + Math.floor(index / BREAKOUT.columns) * (BREAKOUT.brickHeight + BREAKOUT.gap), width: BREAKOUT.brickWidth, height: BREAKOUT.brickHeight };
}
export function clampPaddle(x: number) { return Math.max(BREAKOUT.paddleWidth / 2 + 4, Math.min(BREAKOUT.width - BREAKOUT.paddleWidth / 2 - 4, x)); }
export function stepBreakout(state: BreakoutState, seconds: number, direction = 0, target?: number): BreakoutState {
  if (state.status !== 'playing') return state;
  const next = { ...state, bricks: [...state.bricks] };
  const dt = Math.max(0, Math.min(seconds, .05)), steps = Math.max(1, Math.ceil(dt * 300)), h = dt / steps;
  for (let step = 0; step < steps; step++) {
    next.paddle = clampPaddle(target ?? (next.paddle + direction * 335 * h));
    const oldX = next.x, oldY = next.y;
    next.x += next.vx * h; next.y += next.vy * h;
    const r = BREAKOUT.radius;
    if (next.x < r) { next.x = r; next.vx = Math.abs(next.vx); }
    if (next.x > BREAKOUT.width - r) { next.x = BREAKOUT.width - r; next.vx = -Math.abs(next.vx); }
    if (next.y < r) { next.y = r; next.vy = Math.abs(next.vy); }
    if (next.vy > 0 && oldY + r <= BREAKOUT.paddleY && next.y + r >= BREAKOUT.paddleY && next.x + r >= next.paddle - BREAKOUT.paddleWidth / 2 && next.x - r <= next.paddle + BREAKOUT.paddleWidth / 2) {
      const offset = Math.max(-1, Math.min(1, (next.x - next.paddle) / (BREAKOUT.paddleWidth / 2)));
      const speed = Math.min(330, Math.hypot(next.vx, next.vy) + 3);
      const angle = offset * 1.04;
      next.vx = speed * Math.sin(angle); next.vy = -speed * Math.cos(angle); next.y = BREAKOUT.paddleY - r;
    }
    for (let i = 0; i < next.bricks.length; i++) {
      if (!next.bricks[i]) continue;
      const b = brickRect(i), cx = Math.max(b.x, Math.min(b.x + b.width, next.x)), cy = Math.max(b.y, Math.min(b.y + b.height, next.y));
      if ((next.x - cx) ** 2 + (next.y - cy) ** 2 > r * r) continue;
      next.bricks[i] = false; next.score += 25;
      if (oldY + r <= b.y || oldY - r >= b.y + b.height) { next.vy *= -1; next.y = oldY; }
      else { next.vx *= -1; next.x = oldX; }
      break;
    }
    if (next.bricks.every(value => !value)) { next.status = 'won'; break; }
    if (next.y - r > BREAKOUT.height) {
      next.lives--;
      if (!next.lives) next.status = 'lost';
      next.x = next.paddle; next.y = 282; next.vx = next.lives % 2 ? 116 : -116; next.vy = -202;
      break;
    }
  }
  return next;
}
