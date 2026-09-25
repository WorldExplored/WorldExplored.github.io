'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { profile } from '@/content/profile';
import { BREAKOUT, brickRect, flagMine, hideMemoryMismatch, newBreakout, newMemory, newMines, newSnake, revealMemory, revealMine, stepBreakout, stepSnake, turnSnake, type Direction, type GameStatus } from './gameLogic';

import { PONG, BLOCKS, BLOCK_COLORS, blockCells, blocksGhost, dropBlocks, moveBlocks, newBlocks, newPong, rotateBlocks, stepBlocks, stepPong } from './retroLogic';

const copy = profile.arcade;
type GameId = keyof typeof copy.games;
const gameIds: GameId[] = ['snake', 'mines', 'breakout', 'memory', 'pong', 'blocks'];
const directionKeys: Record<string, Direction> = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left', w: 'up', d: 'right', s: 'down', a: 'left' };
function gridKeys(event: KeyboardEvent<HTMLDivElement>, columns: number) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
  const index = buttons.indexOf(event.target as HTMLButtonElement);
  const offset = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns } as Record<string, number>)[event.key];
  if (index < 0 || offset === undefined) return;
  event.preventDefault(); event.stopPropagation();
  const next = index + offset;
  if (next >= 0 && next < buttons.length && (Math.abs(offset) !== 1 || Math.floor(index / columns) === Math.floor(next / columns))) buttons[next].focus();
}
const symbols = ['☀', '≈', '❧', '◉', '◒', '✿', '⋊', '★'];

function usePause(status: GameStatus) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const pause = () => { if (status === 'playing') setPaused(true); };
    const visibility = () => { if (document.hidden) pause(); };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility); };
  }, [status]);
  return { paused, setPaused };
}
function GameShell({ id, status, paused, onPause, onPlay, onRestart, children, stats, controls, onKeyDown, onKeyUp }: {
  id: GameId; status: GameStatus; paused: boolean; onPause: () => void; onPlay: () => void; onRestart: () => void;
  children: ReactNode; stats: ReactNode; controls?: ReactNode; onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void; onKeyUp?: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const descriptionId = useId();
  const terminal = status === 'won' || status === 'lost';
  const boardRef = useRef<HTMLDivElement>(null);
  const begin = () => { onPlay(); boardRef.current?.focus(); };
  return <div className={`arcade-game arcade-${id}`} onKeyDown={onKeyDown} onKeyUp={onKeyUp} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null) && status === 'playing') onPause();
  }}>
    <div className="arcade-game-heading"><h3>{copy.games[id].name}</h3><button type="button" onClick={onRestart}>{copy.restart}</button></div>
    <p className="arcade-instructions" id={descriptionId}>{copy.games[id].instructions}</p>
    <div className="arcade-scoreboard">{stats}<button type="button" disabled={status !== 'playing'} onClick={paused ? begin : onPause}>{paused ? copy.resume : copy.pause}</button></div>
    <div className="arcade-board" tabIndex={0} ref={boardRef} aria-label={`${copy.games[id].name} ${copy.board}`} aria-describedby={descriptionId}>
      <div className="arcade-board-content" inert={paused || status !== 'playing' ? true : undefined}>{children}</div>
      {(paused || status !== 'playing') && <div className="arcade-overlay"><div className="arcade-overlay-card">
        <span className="arcade-overlay-symbol" aria-hidden="true">{status === 'won' ? '✦' : terminal ? '↻' : '◉'}</span>
        <strong role="status">{paused && !terminal ? copy.paused : copy[status === 'playing' ? 'paused' : status]}</strong>
        {paused && !terminal && <p>{copy.pauseHint}</p>}
        <button type="button" autoFocus={status === 'ready'} onClick={terminal ? onRestart : begin}>{terminal ? copy.restart : paused ? copy.resume : copy.play}</button>
      </div></div>}
    </div>
    {controls && <div className="arcade-game-controls">{controls}</div>}
    <p className="arcade-keyboard-hint">{copy.keyboardHint}</p>
  </div>;
}
function Stat({ label, value }: { label: string; value: number | string }) {
  return <span className="arcade-stat"><span>{label}</span><strong>{value}</strong></span>;
}
function Directions({ turn, disabled }: { turn: (direction: Direction) => void; disabled: boolean }) {
  return <div className="arcade-directions">{(['up', 'left', 'down', 'right'] as const).map(direction => <button type="button" disabled={disabled} key={direction} className={`arcade-direction-${direction}`} aria-label={copy[direction]} onClick={() => turn(direction)}>{({ up: '↑', left: '←', down: '↓', right: '→' })[direction]}</button>)}</div>;
}
function Snake() {
  const [game, setGame] = useState(newSnake);
  const { paused, setPaused } = usePause(game.status);
  useEffect(() => {
    if (paused || game.status !== 'playing') return;
    const interval = window.setInterval(() => setGame(current => stepSnake(current)), Math.max(90, 180 - game.score * .45));
    return () => window.clearInterval(interval);
  }, [paused, game.status, game.score]);
  const turn = (direction: Direction) => { if (!paused) setGame(current => turnSnake(current, direction)); };
  const restart = () => { setGame(newSnake()); setPaused(false); };
  return <GameShell id="snake" status={game.status} paused={paused} onPause={() => setPaused(true)} onPlay={() => { setGame(current => ({ ...current, status: 'playing' })); setPaused(false); }} onRestart={restart}
    stats={<Stat label={copy.score} value={game.score} />} onKeyDown={event => {
      const direction = directionKeys[event.key];
      if (direction && !event.altKey && !event.ctrlKey && !event.metaKey) { event.preventDefault(); event.stopPropagation(); turn(direction); }
    }} controls={<Directions turn={turn} disabled={paused || game.status !== 'playing'} />}>
    <svg className="arcade-snake-board" viewBox="0 0 320 320" aria-hidden="true">
      <rect width="320" height="320" fill="#d9f5e6" />
      {Array.from({ length: 17 }, (_, i) => <path key={i} d={`M${i * 20},0 V320 M0,${i * 20} H320`} stroke="#8dccbb" strokeOpacity=".4" />)}
      {game.food && <g transform={`translate(${game.food.x * 20 + 10} ${game.food.y * 20 + 10})`}><circle r="7" fill="#c48818" /><circle r="5.5" cy="-1" fill="#ffe589" /><circle r="1.7" cx="-2" cy="-3" fill="#fffbea" /></g>}
      {game.body.map((point, i) => <g key={`${point.x}-${point.y}`}><rect x={point.x * 20 + 1} y={point.y * 20 + 1} width="18" height="18" rx={i === 0 ? 7 : 5} fill={i === 0 ? '#064c88' : i % 2 ? '#21958a' : '#4dac64'} stroke="#efffdd" strokeWidth="1" />{i === 0 && <g transform={`translate(${point.x * 20 + 10} ${point.y * 20 + 10}) rotate(${({ right: 0, down: 90, left: 180, up: 270 })[game.direction]})`} fill="white"><circle cx="3" cy="-4" r="2" /><circle cx="3" cy="4" r="2" /></g>}</g>)}
    </svg>
  </GameShell>;
}
function Mines() {
  const [game, setGame] = useState(newMines);
  const [flagging, setFlagging] = useState(false);
  const { paused, setPaused } = usePause(game.status);
  const restart = () => { setGame(newMines()); setFlagging(false); setPaused(false); };
  return <GameShell id="mines" status={game.status} paused={paused} onPause={() => setPaused(true)} onPlay={() => { setGame(current => ({ ...current, status: 'playing' })); setPaused(false); }} onRestart={restart}
    stats={<Stat label={copy.flags} value={game.mineCount - game.cells.filter(c => c.flagged).length} />} controls={<div className="arcade-tap-mode" role="group" aria-label={copy.flagMode}><button type="button" aria-pressed={!flagging} onClick={() => setFlagging(false)}>{copy.reveal}</button><button type="button" aria-pressed={flagging} onClick={() => setFlagging(true)}>⚑ {copy.flag}</button></div>}>
    <div className="arcade-mine-grid" onKeyDown={event => gridKeys(event, 6)} role="group" aria-label={copy.games.mines.name}>{game.cells.map((cell, index) => <button type="button" key={index} className={`arcade-mine-cell ${cell.revealed ? 'is-revealed' : ''} ${cell.revealed && cell.mine ? 'is-mine' : ''}`} data-count={cell.adjacent || undefined}
      aria-label={`${Math.floor(index / game.size) + 1}, ${index % game.size + 1}: ${cell.flagged ? copy.flagged : cell.revealed ? cell.mine ? copy.mine : cell.adjacent ? `${cell.adjacent}` : copy.emptyCell : copy.hiddenCell}`}
      aria-disabled={cell.revealed} onClick={() => setGame(current => flagging ? flagMine(current, index) : revealMine(current, index))}
      onContextMenu={event => { event.preventDefault(); setGame(current => flagMine(current, index)); }}>
      {cell.flagged ? '⚑' : cell.revealed ? cell.mine ? '✹' : cell.adjacent || <span aria-hidden="true">·</span> : <span className="arcade-square-glint" aria-hidden="true" />}
    </button>)}</div>
  </GameShell>;
}
function Breakout() {
  const [game, setGame] = useState(newBreakout);
  const { paused, setPaused } = usePause(game.status);
  const held = useRef(new Set<string>());
  const target = useRef<number | undefined>(undefined);
  const pointerId = useRef<number | null>(null);
  useEffect(() => {
    if (paused || game.status !== 'playing') return;
    let frame = 0, previous = 0;
    const pressed = held.current;
    const tick = (now: number) => {
      if (previous) {
        const right = held.current.has('ArrowRight') || held.current.has('d');
        const left = held.current.has('ArrowLeft') || held.current.has('a');
        setGame(current => stepBreakout(current, (now - previous) / 1000, Number(right) - Number(left), target.current));
      }
      previous = now; frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); pressed.clear(); target.current = undefined; pointerId.current = null; };
  }, [paused, game.status]);
  const key = (event: KeyboardEvent<HTMLDivElement>, down: boolean) => {
    if (['ArrowRight', 'ArrowLeft', 'a', 'd'].includes(event.key) && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault(); event.stopPropagation(); target.current = undefined;
      if (down) held.current.add(event.key); else held.current.delete(event.key);
    }
  };
  const move = (element: SVGSVGElement, clientX: number) => {
    const rect = element.getBoundingClientRect();
    target.current = (clientX - rect.left) / rect.width * BREAKOUT.width;
  };
  const stop = () => { target.current = undefined; held.current.clear(); pointerId.current = null; setPaused(true); };
  const restart = () => { setGame(newBreakout()); setPaused(false); };
  return <GameShell id="breakout" status={game.status} paused={paused} onPause={stop} onPlay={() => { setGame(current => ({ ...current, status: 'playing' })); setPaused(false); }} onRestart={restart} onKeyDown={event => key(event, true)} onKeyUp={event => key(event, false)}
    stats={<><Stat label={copy.score} value={game.score} /><Stat label={copy.lives} value={game.lives} /></>}
    controls={<div className="arcade-paddle-controls">{(['left', 'right'] as const).map(direction => <button type="button" key={direction} disabled={paused || game.status !== 'playing'} aria-label={copy[direction]}
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); target.current = undefined; held.current.add(direction === 'left' ? 'a' : 'd'); }}
      onPointerUp={() => held.current.clear()} onPointerCancel={() => held.current.clear()} onLostPointerCapture={() => held.current.clear()}
      onClick={event => { if (event.detail === 0) setGame(current => ({ ...current, paddle: Math.max(42, Math.min(358, current.paddle + (direction === 'left' ? -36 : 36))) })); }}>
      {direction === 'left' ? '←' : '→'}</button>)}</div>}>
    <svg className="arcade-breakout-board" viewBox="0 0 400 340" aria-hidden="true" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pointerId.current = event.pointerId; move(event.currentTarget, event.clientX); }} onPointerMove={event => { if (pointerId.current === event.pointerId) move(event.currentTarget, event.clientX); }} onPointerUp={() => { pointerId.current = null; }} onPointerCancel={() => { pointerId.current = null; target.current = undefined; }}>
      <rect width="400" height="340" fill="#d4f1f6" /><path d="M0 251 Q80 205 160 244 T320 237 T400 239 V340 H0Z" fill="#7bd4cd" opacity=".45" /><path d="M0 288 Q75 251 190 286 T400 274 V340 H0Z" fill="#40b9cb" opacity=".35" />
      <circle cx="328" cy="158" r="30" fill="#f4fff4" opacity=".65" /><circle cx="328" cy="158" r="23" fill="#e9f4ba" opacity=".8" />
      {game.bricks.map((present, i) => { const b = brickRect(i); return present && <g key={i}><rect {...b} rx="4" fill={['#1262ad', '#12889d', '#4d9753', '#d6a43a'][Math.floor(i / 7)]} stroke="#f6ffff" /><path d={`M${b.x + 5} ${b.y + 4} H${b.x + b.width - 5}`} stroke="white" opacity=".55" /></g>; })}
      <rect x={game.paddle - BREAKOUT.paddleWidth / 2} y={BREAKOUT.paddleY} width={BREAKOUT.paddleWidth} height="12" rx="6" fill="#075686" stroke="#efffff" strokeWidth="2" />
      <path d={`M${game.paddle - 28} ${BREAKOUT.paddleY + 4} H${game.paddle + 28}`} stroke="#6cdeee" />
      <circle cx={game.x} cy={game.y} r={BREAKOUT.radius + 2} fill="#ffffff" /><circle cx={game.x} cy={game.y} r={BREAKOUT.radius} fill="#c58c17" /><circle cx={game.x - 1} cy={game.y - 2} r="3" fill="#ffeaa2" />
    </svg>
  </GameShell>;
}
function Memory() {
  const [game, setGame] = useState(newMemory);
  const { paused, setPaused } = usePause(game.status);
  useEffect(() => {
    if (paused || game.status !== 'playing' || game.open.length !== 2) return;
    const timer = window.setTimeout(() => setGame(current => hideMemoryMismatch(current)), 900);
    return () => window.clearTimeout(timer);
  }, [game.open, game.status, paused]);
  const restart = () => { setGame(newMemory()); setPaused(false); };
  return <GameShell id="memory" status={game.status} paused={paused} onPause={() => setPaused(true)} onPlay={() => { setGame(current => ({ ...current, status: 'playing' })); setPaused(false); }} onRestart={restart}
    stats={<><Stat label={copy.attempts} value={game.attempts} /><Stat label={copy.pairs} value={`${game.matched.length / 2} / 8`} /></>}>
    <div className="arcade-memory-grid" onKeyDown={event => gridKeys(event, 4)} role="group" aria-label={copy.games.memory.name}>{game.cards.map((value, index) => {
      const matched = game.matched.includes(index), visible = matched || game.open.includes(index);
      return <button type="button" key={index} className={`arcade-memory-card ${visible ? 'is-open' : ''} ${matched ? 'is-matched' : ''}`} data-symbol={value}
        aria-label={visible ? `${copy.symbols[value]}${matched ? ` · ${copy.matchedCard}` : ''}` : `${copy.hiddenCard} ${index + 1}`} aria-disabled={matched || game.open.includes(index) || game.open.length === 2}
        onClick={() => setGame(current => revealMemory(current, index))}><span aria-hidden="true">{visible ? symbols[value] : '✦'}</span></button>;
    })}</div>
  </GameShell>;
}
function Pong() {
  const [game, setGame] = useState(newPong);
  const { paused, setPaused } = usePause(game.status);
  const held = useRef(new Set<string>()), target = useRef<number | undefined>(undefined), pointer = useRef<number | null>(null);
  useEffect(() => {
    if (paused || game.status !== 'playing') return;
    let frame = 0, previous = 0;
    const keys = held.current;
    const tick = (now: number) => {
      if (previous) setGame(current => stepPong(current, (now - previous) / 1000, Number(keys.has('down')) - Number(keys.has('up')), target.current));
      previous = now; frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); keys.clear(); target.current = undefined; pointer.current = null; };
  }, [paused, game.status]);
  const stop = () => { held.current.clear(); target.current = undefined; pointer.current = null; setPaused(true); };
  const key = (event: KeyboardEvent<HTMLDivElement>, down: boolean) => {
    const direction = ({ ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' } as Record<string, string>)[event.key];
    if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault(); event.stopPropagation(); target.current = undefined;
    if (down) held.current.add(direction); else held.current.delete(direction);
  };
  const move = (element: SVGSVGElement, y: number) => { const rect = element.getBoundingClientRect(); target.current = (y - rect.top) / rect.height * PONG.height; };
  return <GameShell id="pong" status={game.status} paused={paused} onPause={stop} onPlay={() => { setGame(current => ({ ...current, status: 'playing' })); setPaused(false); }} onRestart={() => { setGame(newPong()); setPaused(false); }} onKeyDown={event => key(event, true)} onKeyUp={event => key(event, false)}
    stats={<><Stat label={copy.you} value={game.score}/><Stat label={copy.opponent} value={game.opponentScore}/></>}
    controls={<div className="arcade-paddle-controls">{(['up', 'down'] as const).map(direction => <button type="button" key={direction} aria-label={copy[direction]} disabled={paused || game.status !== 'playing'}
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); target.current = undefined; held.current.add(direction); }} onPointerUp={() => held.current.clear()} onPointerCancel={() => held.current.clear()} onLostPointerCapture={() => held.current.clear()}
      onClick={event => { if (event.detail === 0) setGame(current => ({ ...current, paddle: Math.max(38, Math.min(282, current.paddle + (direction === 'up' ? -28 : 28))) })); }}>{direction === 'up' ? '↑' : '↓'}</button>)}</div>}>
    <svg className="arcade-pong-board" viewBox="0 0 400 320" aria-hidden="true"
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pointer.current = event.pointerId; move(event.currentTarget, event.clientY); }} onPointerMove={event => { if (pointer.current === event.pointerId) move(event.currentTarget, event.clientY); }} onPointerUp={() => { pointer.current = null; }} onLostPointerCapture={() => { pointer.current = null; }} onPointerCancel={() => { pointer.current = null; target.current = undefined; }}>
      <rect width="400" height="320" fill="#d8f0e9"/><path d="M0 76 Q100 38 200 80 T400 71 V320 H0Z" fill="#a6e0d9"/><path d="M0 263 Q95 236 205 275 T400 252 V320 H0Z" fill="#66c3ce"/>
      <rect x="8" y="8" width="384" height="304" rx="24" fill="none" stroke="#f8ffed" strokeWidth="3"/><path d="M200 10V310" stroke="#effff0" strokeWidth="3" strokeDasharray="9 10"/><circle cx="200" cy="160" r="48" fill="none" stroke="#edfff0" strokeWidth="2"/>
      <rect x="12" y={game.paddle - 34} width="9" height="68" rx="4.5" fill="#075c9c" stroke="#fff" strokeWidth="2"/><rect x="379" y={game.opponent - 34} width="9" height="68" rx="4.5" fill="#52933f" stroke="#fff" strokeWidth="2"/>
      <circle cx={game.x} cy={game.y} r="8" fill="#ffffff"/><circle cx={game.x} cy={game.y} r="6" fill="#d2a21d"/><circle cx={game.x - 1.5} cy={game.y - 2} r="2.6" fill="#fff2b6"/>
      {game.serve > 0 && <circle cx="200" cy="160" r="15" fill="none" stroke="#4b93a4" strokeDasharray="3 4"/>}
    </svg>
  </GameShell>;
}
function Blocks() {
  const [game, setGame] = useState(newBlocks);
  const { paused, setPaused } = usePause(game.status);
  useEffect(() => {
    if (paused || game.status !== 'playing') return;
    const timer = window.setInterval(() => setGame(current => stepBlocks(current, .05)), 50);
    return () => window.clearInterval(timer);
  }, [paused, game.status]);
  const command = (action: 'left' | 'right' | 'down' | 'rotate' | 'drop') => {
    if (paused || game.status !== 'playing') return;
    setGame(current => action === 'left' ? moveBlocks(current, -1) : action === 'right' ? moveBlocks(current, 1) : action === 'rotate' ? rotateBlocks(current) : dropBlocks(current, action === 'drop'));
  };
  const ghost = blocksGhost(game);
  const block = (x: number, y: number, color: number, key: string, outline = false) => <g key={key}><rect x={x * 20 + 12} y={y * 20 + 13} width="18" height="18" rx="3" fill={outline ? 'none' : BLOCK_COLORS[color]} stroke={outline ? '#57959f' : '#efffff'} strokeWidth={outline ? 1 : 1.3} opacity={outline ? .65 : 1}/>{!outline && <path d={`M${x * 20 + 15} ${y * 20 + 17}h11`} stroke="#ffffff" opacity=".55"/>}</g>;
  return <GameShell id="blocks" status={game.status} paused={paused} onPause={() => setPaused(true)} onPlay={() => { setGame(current => ({ ...current, status: 'playing' })); setPaused(false); }} onRestart={() => { setGame(newBlocks()); setPaused(false); }}
    stats={<><Stat label={copy.score} value={game.score}/><Stat label={copy.lines} value={game.lines}/></>}
    onKeyDown={event => {
      if (paused || game.status !== 'playing' || (event.target as HTMLElement).closest('button')) return;
      const action = ({ ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowDown: 'down', s: 'down', ArrowUp: 'rotate', w: 'rotate', ' ': 'drop' } as Record<string, 'left' | 'right' | 'down' | 'rotate' | 'drop'>)[event.key];
      if (!action || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault(); event.stopPropagation(); if (!event.repeat || action !== 'drop') command(action);
    }}
    controls={<div className="arcade-block-controls">{(['left', 'rotate', 'right', 'down', 'drop'] as const).map(action => <button type="button" key={action} disabled={paused || game.status !== 'playing'} aria-label={copy[action]} onClick={() => command(action)}>{({ left: '←', right: '→', down: '↓', rotate: '↻', drop: copy.drop })[action]}</button>)}</div>}>
    <svg className="arcade-blocks-board" viewBox="0 0 330 386" aria-hidden="true">
      <rect width="330" height="386" fill="#d4f1ef"/><path d="M215 0H330V386H215Z" fill="#b6e1dd"/><rect x="9" y="10" width="204" height="364" rx="6" fill="#eaf8e8" stroke="#81b8b5"/>
      {Array.from({ length: BLOCKS.rows - 1 }, (_, y) => <path key={y} d={`M11 ${32 + y * 20}H211`} stroke="#bbdbce" strokeWidth=".6"/>)}
      {Array.from({ length: 9 }, (_, x) => <path key={x} d={`M${31 + x * 20} 12V372`} stroke="#bbdbce" strokeWidth=".6"/>)}
      {game.board.map((value, index) => value ? block(index % 10, Math.floor(index / 10), value - 1, `board-${index}`) : null)}
      {blockCells(ghost).map(({ x, y }, i) => block(x, y, game.piece.kind, `ghost-${i}`, true))}
      {blockCells(game.piece).map(({ x, y }, i) => block(x, y, game.piece.kind, `piece-${i}`))}
      <text x="272" y="39" textAnchor="middle" fill="#16546a" fontSize="15" fontFamily="inherit">{copy.next}</text>
      <rect x="225" y="53" width="94" height="80" rx="12" fill="#ecfbf4" stroke="#80b7b9"/>
      {blockCells({ kind: game.queue[0], rotation: 0, x: 0, y: 0 }).map(({ x, y }, i) => <rect key={i} x={239 + x * 16} y={76 + y * 16} width="15" height="15" rx="3" fill={BLOCK_COLORS[game.queue[0]]} stroke="#fff"/>)}
      <text x="272" y="170" textAnchor="middle" fill="#16546a" fontSize="14" fontFamily="inherit">{copy.level}</text><text x="272" y="200" textAnchor="middle" fill="#075c9c" fontSize="26" fontFamily="inherit">{Math.floor(game.lines / 8) + 1}</text>
      <path d="M242 356Q244 320 273 289Q299 318 300 356Z" fill="#61a875" opacity=".6"/><path d="M272 354V303M272 331L254 319M272 337L288 323" stroke="#247552" strokeWidth="3" fill="none"/>
      <circle cx="273" cy="259" r="18" fill="#effaf0" stroke="#83c7bf"/><circle cx="268" cy="252" r="5" fill="#fff"/>
    </svg>
  </GameShell>;
}

function Preview({ id }: { id: GameId }) {
  return <div className={`arcade-preview arcade-preview-${id}`} aria-hidden="true">{id === 'snake' ? <><i /><i /><i /><i /><i /><b>●</b></> : id === 'mines' ? <>{['', '1', '', '⚑', '', '2', '', '', ''].map((value, i) => <i key={i}>{value}</i>)}</> : id === 'breakout' ? <>{Array.from({ length: 9 }, (_, i) => <i key={i} />)}<b /><em /></> : id === 'pong' ? <><i/><i/><b/></> : id === 'blocks' ? <>{Array.from({ length: 12 }, (_, i) => <i key={i}/>)}</> : <>{['☀', '✦', '✦', '☀'].map((value, i) => <i key={i}>{value}</i>)}</>}</div>;
}
export function Arcade() {
  const [selected, setSelected] = useState<GameId | null>(null);
  const libraryRef = useRef<HTMLDivElement>(null);
  const lastSelected = useRef<GameId | null>(null);
  const back = () => { lastSelected.current = selected; setSelected(null); };
  useEffect(() => {
    if (selected === null && lastSelected.current) libraryRef.current?.querySelector<HTMLButtonElement>(`[data-game="${lastSelected.current}"]`)?.focus();
  }, [selected]);
  return <section className="arcade" aria-label={copy.title}>
    <div className="arcade-masthead">{!selected && <span>{copy.eyebrow}</span>}{selected && <button type="button" className="arcade-back" onClick={back}>← {copy.back}</button>}</div>
    {selected === null ? <><p className="arcade-intro">{copy.intro}</p><div className="arcade-library" ref={libraryRef}>{gameIds.map(id => <button type="button" className="arcade-cabinet" data-game={id} key={id} onClick={() => setSelected(id)}><Preview id={id} /><span className="arcade-cabinet-copy"><span className="arcade-genre">{copy.games[id].genre}</span><strong>{copy.games[id].name}</strong><span>{copy.games[id].description}</span><span className="arcade-play-label">{copy.play} <span aria-hidden="true">↗</span></span></span></button>)}</div></> : selected === 'snake' ? <Snake /> : selected === 'mines' ? <Mines /> : selected === 'breakout' ? <Breakout /> : selected === 'memory' ? <Memory /> : selected === 'pong' ? <Pong /> : <Blocks />}
  </section>;
}
