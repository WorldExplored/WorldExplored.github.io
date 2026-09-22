import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { AudioControl } from '../src/components/AudioControl';
import { audio, isApprovedAudioSource } from '../src/content/audio';
import { AudioPlaylist, AUDIO_PREFERENCES_KEY, adjacentTrack, readAudioPreferences, shuffledOrder } from '../src/components/audioPlaylist';

class TestMedia extends EventTarget {
  src = ''; volume = 1; muted = false; paused = true; calls = 0; loads = 0;
  mode: 'success' | 'failure' | 'blocked' | 'pending' = 'success';
  get currentSrc() { return this.src; }
  getAttribute(name: string) { return name === 'src' && this.src ? this.src : null; }
  removeAttribute(name: string) { if (name === 'src') this.src = ''; }
  load() { this.loads++; }
  pause() { this.paused = true; }
  play() { this.calls++; this.paused = false; if (this.mode === 'failure') return Promise.reject(new Error('media unavailable')); if (this.mode === 'blocked') return Promise.reject(new DOMException('gesture required', 'NotAllowedError')); if (this.mode === 'success') this.dispatchEvent(new Event('playing')); return Promise.resolve(); }
  emit(name: string) { this.dispatchEvent(new Event(name)); }
}
function setup(reducedMotion = false, stored: string | null = null) {
  const media = new TestMedia(); let now = 0, id = 0; const timers = new Map<number, { at: number; run: () => void }>(); const saved = new Map<string, string>(); if (stored) saved.set(AUDIO_PREFERENCES_KEY, stored);
  const player = new AudioPlaylist(media as unknown as HTMLAudioElement, audio.playlist, () => {}, { random: () => .3, reducedMotion: () => reducedMotion, storage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => { saved.set(key, value); } }, now: () => now,
    schedule: (run, delay) => { const next = ++id; timers.set(next, { at: now + delay, run }); return next as unknown as ReturnType<typeof setTimeout>; }, cancel: handle => { timers.delete(handle as unknown as number); } });
  function tick(ms: number) { const end = now + ms; let guard = 0; while (true) { const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; assert.ok(++guard < 10000); now = next[1].at; timers.delete(next[0]); next[1].run(); } now = end; }
  return { media, player, tick, timers, saved };
}

test('audio renders no remote source, autoplay or embedded player before an intentional gesture', () => {
  const html = renderToStaticMarkup(<AudioControl />);
  assert.match(html, /Play music/); assert.match(html, /<audio preload="none"/);
  assert.doesNotMatch(html, /<iframe|<script|src=|autoPlay|autoplay|https:|crossorigin/i);
  const setupResult = setup(); assert.equal(setupResult.media.calls, 0); assert.equal(setupResult.media.src, ''); assert.equal(setupResult.timers.size, 0); setupResult.player.dispose();
});

test('all five tracks require creator-hosted audio and matching primary license evidence', () => {
  assert.ok(audio.playlist.length >= 5); assert.equal(new Set(audio.playlist.map(track => track.id)).size, audio.playlist.length);
  assert.ok(audio.playlist.some(track => track.title === 'Firefly'));
  for (const track of audio.playlist) { assert.ok(isApprovedAudioSource(track)); assert.equal(new URL(track.playbackUrl).origin, new URL(track.creatorUrl).origin); assert.equal(track.license.evidenceUrl, track.sourceUrl); assert.equal(track.license.label, 'CC BY 4.0'); }
  const source = audio.playlist[0];
  assert.equal(isApprovedAudioSource({ ...source, playbackUrl: 'https://example.com/music.mp3' }), false);
  assert.equal(isApprovedAudioSource({ ...source, license: { ...source.license, evidenceUrl: 'https://www.youtube.com/watch?v=123' } }), false);
  assert.equal(isApprovedAudioSource({ ...source, sourceUrl: 'https://www.scottbuckley.com.au/library/not-this-track/' }), false);
  assert.equal(renderToStaticMarkup(<AudioControl playlist={null} />), '');
  assert.equal(renderToStaticMarkup(<AudioControl playlist={[{ ...source, playbackUrl: 'http://example.com/music.mp3' }]} />), '');
});

test('shuffled continuous playback visits every track once per cycle and never repeats consecutively', () => {
  for (let seed = 1; seed < 30; seed++) { let value = seed; const order = shuffledOrder(5, () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 2 ** 32; }); assert.deepEqual([...order].sort(), [0,1,2,3,4]); assert.notEqual(adjacentTrack(order, order[4], 1, new Set()), order[4]); }
  const { player, media, tick } = setup(); player.play(); const sequence = [player.snapshot.index];
  for (let index = 0; index < 16; index++) { tick(500); media.emit('ended'); sequence.push(player.snapshot.index); assert.equal(player.snapshot.state, 'playing'); }
  for (let index = 1; index < sequence.length; index++) assert.notEqual(sequence[index], sequence[index - 1]);
  assert.equal(new Set(sequence.slice(0,5)).size,5); assert.deepEqual(sequence.slice(0,5), sequence.slice(5,10));
  const selected = player.snapshot.index; player.move(-1); tick(250); const previous = player.snapshot.index; assert.notEqual(previous, selected); player.move(1); tick(250); assert.equal(player.snapshot.index, selected);
  player.pause(); player.move(1); assert.equal(player.snapshot.state, 'paused'); assert.equal(media.src, ''); const calls = media.calls; media.emit('ended'); assert.equal(media.calls, calls); player.dispose();
});

test('gentle transitions ramp volume, while reduced motion transitions immediately', () => {
  const { player, media, tick } = setup(); player.play(); assert.equal(media.volume, 0); tick(200); assert.ok(media.volume > 0 && media.volume < .25); tick(250); assert.equal(media.volume, .25);
  const first = player.snapshot.index; player.move(1); tick(100); assert.equal(player.snapshot.index, first); assert.ok(media.volume < .25); tick(150); assert.notEqual(player.snapshot.index, first); tick(450); assert.equal(media.volume, .25); player.dispose();
  const reduced = setup(true); reduced.player.play(); assert.equal(reduced.media.volume, .25); const current = reduced.player.snapshot.index; reduced.player.move(1); assert.notEqual(reduced.player.snapshot.index, current); assert.equal(reduced.media.volume, .25); reduced.player.dispose();
  const css = readFileSync(new URL('../src/components/AudioControl.css', import.meta.url), 'utf8'); assert.match(css, /prefers-reduced-motion: reduce/); assert.match(css, /min-height: 44px/);
});

test('unavailable tracks skip once, all failures stop, and user retry starts a new bounded attempt', async () => {
  const { player, media, tick, timers } = setup(true); media.mode = 'failure'; player.play();
  for (let index = 0; index < audio.playlist.length + 2; index++) { await Promise.resolve(); tick(0); }
  assert.equal(player.snapshot.state, 'unavailable'); assert.equal(media.calls, audio.playlist.length); assert.equal(timers.size, 0);
  const calls = media.calls; tick(120000); media.emit('ended'); media.emit('error'); assert.equal(media.calls, calls);
  media.mode = 'success'; player.play(); assert.equal(player.snapshot.state, 'playing'); assert.equal(media.calls, calls + 1); media.emit('ended'); assert.equal(player.snapshot.state, 'playing'); player.dispose();
});

test('stalled loads time out and stale play rejections cannot restart paused playback', async () => {
  const { player, media, tick } = setup(true); media.mode = 'pending'; player.play(); const original = player.snapshot.index; tick(20001); assert.notEqual(player.snapshot.index, original); player.pause(); const calls = media.calls; tick(60000); media.emit('error'); media.emit('ended'); assert.equal(media.calls, calls); player.dispose();
  const blocked = setup(); blocked.media.mode = 'blocked'; blocked.player.play(); await Promise.resolve(); assert.equal(blocked.player.snapshot.state, 'ready'); assert.equal(blocked.media.calls, 1); assert.equal(blocked.timers.size, 0); blocked.media.mode = 'success'; blocked.player.play(); assert.equal(blocked.player.snapshot.state, 'playing'); blocked.player.dispose();
  const stale = setup(); stale.media.mode = 'failure'; stale.player.play(); stale.player.pause(); await Promise.resolve(); stale.tick(0); assert.equal(stale.player.snapshot.state, 'paused'); assert.equal(stale.media.calls, 1); stale.player.dispose();
});

test('volume and mute preferences persist, tolerate unavailable storage and survive closing', () => {
  const { player, media, saved } = setup(false, JSON.stringify({ volume: .73, muted: true })); assert.equal(media.volume, .73); assert.equal(media.muted, true);
  player.play(); player.setPreferences({ volume: .44, muted: false }); player.close(); assert.equal(player.snapshot.volume, .44); assert.equal(player.snapshot.muted, false); assert.equal(media.src, ''); assert.deepEqual(JSON.parse(saved.get(AUDIO_PREFERENCES_KEY)!), { volume: .44, muted: false }); player.dispose();
  assert.deepEqual(readAudioPreferences({ getItem: () => { throw Error('denied'); } }), { volume: .25, muted: false });
  assert.deepEqual(readAudioPreferences({ getItem: () => '{bad' }), { volume: .25, muted: false }); assert.deepEqual(readAudioPreferences({ getItem: () => '{"volume":9,"muted":"true"}' }), { volume: 1, muted: false });
});

test('default browser timers never receive the playlist instance as their host receiver', context => {
  const pending = new Set<number>(); let next = 0, scheduled = 0, cancelled = 0;
  context.mock.method(globalThis, 'setTimeout', function (this: unknown, callback: () => void, delay?: number) {
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    assert.equal(typeof callback, 'function'); assert.ok(Number.isFinite(delay));
    const handle = ++next; pending.add(handle); scheduled++; return handle as unknown as ReturnType<typeof setTimeout>;
  });
  context.mock.method(globalThis, 'clearTimeout', function (this: unknown, handle: ReturnType<typeof setTimeout>) {
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    pending.delete(handle as unknown as number); cancelled++;
  });
  const media = new TestMedia();
  // Deliberately use the production timer defaults, unlike the deterministic scheduler fixtures.
  const player = new AudioPlaylist(media as unknown as HTMLAudioElement, audio.playlist, () => {}, { now: () => 0 });
  try {
    assert.doesNotThrow(() => player.play());
    assert.equal(player.snapshot.state, 'playing');
    assert.ok(scheduled >= 2, 'loading watchdog and fade both use native timer wrappers');
    assert.doesNotThrow(() => player.move(1));
    assert.doesNotThrow(() => player.pause());
    assert.equal(pending.size, 0);
    assert.ok(cancelled >= 2, 'watchdog and transition timers are cancelled through the host wrapper');
  } finally { player.dispose(); }
});

import { EnvironmentalAudioControl, subscribeToTechnologySounds } from '../src/components/EnvironmentalAudioControl';
import { CoastalAudio, coastalSoundScene, loopSamples, proximity, TECHNOLOGY_SOUND_EVENT } from '../src/components/world/coastalAudio';

class SoundParam {
  value=0;automation:Array<{method:string;value:number;time:number}>=[];
  setTargetAtTime(value:number){this.value=value;}
  setValueAtTime(value:number,time:number){this.value=value;this.automation.push({method:'set',value,time});}
  linearRampToValueAtTime(value:number,time:number){this.value=value;this.automation.push({method:'linear',value,time});}
  exponentialRampToValueAtTime(value:number,time:number){this.value=value;this.automation.push({method:'exponential',value,time});}
}
class SoundNode extends EventTarget {
  gain=new SoundParam();frequency=new SoundParam();Q=new SoundParam();pan=new SoundParam();playbackRate=new SoundParam();loop=false;buffer:unknown;type='';started=false;stopped=false;onended: (()=>void)|null=null;
  connections:unknown[]=[];disconnects=0;startTimes:Array<number|undefined>=[];stopTimes:Array<number|undefined>=[];
  connect(node:unknown){this.connections.push(node);return node;}
  disconnect(){this.disconnects++;}start(time?:number){this.started=true;this.startTimes.push(time);}stop(time?:number){this.stopped=true;this.stopTimes.push(time);}
  end(){this.onended?.();this.dispatchEvent(new Event('ended'));}
}
class SoundContext {
  currentTime=0;state:AudioContextState='suspended';destination=new SoundNode();sources:SoundNode[]=[];gains:SoundNode[]=[];oscillators:SoundNode[]=[];panners:SoundNode[]=[];resumes=0;closed=false;
  createGain(){const node=new SoundNode();this.gains.push(node);return node;}
  createBufferSource(){const node=new SoundNode();this.sources.push(node);return node;}
  createBiquadFilter(){return new SoundNode();}createStereoPanner(){const node=new SoundNode();this.panners.push(node);return node;}
  createOscillator(){const node=new SoundNode();this.oscillators.push(node);return node;}
  createBuffer(){return {copyToChannel(){}};}
  decodeAudioData(){return Promise.resolve({getChannelData:()=>new Float32Array(800),sampleRate:100,duration:8});}
  resume(){this.resumes++;this.state='running';return Promise.resolve();}close(){this.closed=true;this.state='closed';return Promise.resolve();}
}

test('recorded coast starts only on a gesture, positions its layers, and rings the muted-aware bell independently',async t=>{
  const html=renderToStaticMarkup(<EnvironmentalAudioControl/>);assert.match(html,/Enable ambience/);assert.doesNotMatch(html,/Pause ambience/);assert.doesNotMatch(html,/src=|autoplay|<audio|<iframe/);
  const callbacks:Array<()=>void>=[];t.mock.method(globalThis,'setInterval',(callback:()=>void)=>{callbacks.push(callback);return 1 as unknown as ReturnType<typeof setInterval>;});t.mock.method(globalThis,'clearInterval',()=>{});
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{value:{hidden:false},configurable:true});
  t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else Reflect.deleteProperty(globalThis,'document');});
  const urls:string[]=[];t.mock.method(globalThis,'fetch',async (url:unknown)=>{urls.push(String(url));return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)} as Response;});
  const context=new SoundContext(),engine=new CoastalAudio({volume:.4,muted:false},context as unknown as AudioContext);
  try {
    assert.equal(context.sources.length,0);assert.equal(urls.length,0);
    await engine.start();assert.equal(context.sources.filter(s=>s.loop&&s.started).length,5);assert.equal(context.resumes,1);
    assert.ok(urls.every(url=>url.startsWith('/audio/coast/')));assert.equal(new Set(urls).size,5);
    const far=context.gains.map(n=>n.gain.value);coastalSoundScene.listener=[-16.2,1.4,-70];coastalSoundScene.ferry=[-16.2,1.4,-70];coastalSoundScene.ferrySpeed=1.8;callbacks[0]();
    assert.ok(context.gains.some((n,i)=>n.gain.value>far[i]+.05),'Fountain and moving ferry grow nearby');
    engine.pause();assert.equal(context.gains[1].gain.value,0);
    assert.equal(await engine.bell(),true);assert.equal(engine.bellCount,1);assert.equal(context.sources.at(-1)!.loop,false);
    assert.equal(await engine.bell(),false,'Rapid strikes are bounded');
    engine.setPreferences({volume:.4,muted:true});assert.equal(context.gains[0].gain.value,0);
    context.currentTime=1;assert.equal(await engine.bell(),true,'Bell uses the same muted master');
    await engine.start();assert.equal(context.sources.filter(s=>s.loop).length,5,'Resume reuses every loop');
  }finally{engine.dispose();assert.ok(context.sources.every(s=>s.stopped));assert.ok(context.closed);}
});

test('failed initial sample download creates no partial duplicate loops on retry',async t=>{
  let fail=true;t.mock.method(globalThis,'fetch',async (url:unknown)=>({ok:!(fail&&String(url).includes('gull')),arrayBuffer:async()=>new ArrayBuffer(1)}) as Response);
  t.mock.method(globalThis,'setInterval',()=>1 as unknown as ReturnType<typeof setInterval>);t.mock.method(globalThis,'clearInterval',()=>{});
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{value:{hidden:false},configurable:true});
  const context=new SoundContext(),engine=new CoastalAudio({volume:.3,muted:false},context as unknown as AudioContext);
  try{await assert.rejects(engine.start());assert.equal(context.sources.length,0);fail=false;await engine.start();assert.equal(context.sources.filter(s=>s.loop).length,5);}finally{engine.dispose();if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else Reflect.deleteProperty(globalThis,'document');}
});

test('loop overlap preserves a continuous splice and proximity falls smoothly with distance',()=>{
  const data=Float32Array.from({length:1000},(_,i)=>Math.sin(i*.07));const loop=loopSamples(data,100);
  assert.equal(loop.length,900);assert.ok(Math.abs(loop.at(-1)!-loop[0])<.08);assert.ok(loop.every(Number.isFinite));
  assert.equal(proximity([0,0,0],[0,0,0],8),1);assert.equal(proximity([8,0,0],[0,0,0],8),.5);assert.ok(proximity([80,0,0],[0,0,0],8)<.01);
});


test('technology sound never opens or resumes audio and the listener unregisters cleanly',()=>{
  const target=new EventTarget(),context=new SoundContext();
  let engine:CoastalAudio|null=null;
  const unsubscribe=subscribeToTechnologySounds(target,()=>engine);
  const event=()=>new CustomEvent(TECHNOLOGY_SOUND_EVENT,{detail:{kind:'hover',position:[0,0,0]}});
  const previous=coastalSoundScene.listener;coastalSoundScene.listener=[0,0,0];
  try{
    target.dispatchEvent(event());assert.equal(context.resumes,0);assert.equal(context.oscillators.length,0);
    engine=new CoastalAudio({volume:.4,muted:false},context as unknown as AudioContext);
    target.dispatchEvent(event());assert.equal(context.oscillators.length,0,'a suspended context is not resumed by a hover');assert.equal(context.resumes,0);
    context.state='running';target.dispatchEvent(event());assert.equal(context.oscillators.length,1);
    unsubscribe();context.currentTime=1;target.dispatchEvent(event());assert.equal(context.oscillators.length,1,'unmounted listeners cannot create another sound');
  }finally{unsubscribe();engine?.dispose();coastalSoundScene.listener=previous;}
});

test('technology voices attenuate by distance, pan spatially, share mute and obey a bounded envelope',()=>{
  const context=new SoundContext(),engine=new CoastalAudio({volume:.42,muted:true},context as unknown as AudioContext);
  const previous=coastalSoundScene.listener;coastalSoundScene.listener=[0,0,0];context.state='running';
  try{
    engine.technology({kind:'activate',position:[80,0,0]});assert.equal(context.oscillators.length,0,'far-away infrastructure is inaudible and allocates no nodes');
    engine.technology({kind:'arrival',position:[8,0,0]});assert.equal(context.oscillators.length,1);
    const oscillator=context.oscillators[0],gain=oscillator.connections[0] as SoundNode,pan=gain.connections[0] as SoundNode;
    assert.equal(pan.connections[0],engine.master);assert.equal(context.gains[0].gain.value,0,'every technology voice passes through muted master');
    assert.equal(gain.gain.automation.find(point=>point.method==='linear')!.value,.075*.5);assert.equal(pan.pan.value,.4);
    assert.deepEqual(oscillator.frequency.automation.map(point=>point.value),[740,740*1.33]);assert.ok(oscillator.stopTimes[0]!<=.50);
    assert.equal(gain.gain.automation[0].value,0);assert.equal(gain.gain.automation.at(-1)!.value,.0001);
    engine.technology({kind:'hover',position:[0,0,0]});assert.equal(context.oscillators.length,1,'repeated events inside180ms are bounded');
    engine.setPreferences({volume:.42,muted:false});assert.equal(context.gains[0].gain.value,.42);
    context.currentTime=.2;engine.technology({kind:'hover',position:[0,0,0]});assert.equal(context.oscillators.length,2);
    const hoverGain=context.oscillators[1].connections[0] as SoundNode;
    assert.equal(hoverGain.gain.automation.find(point=>point.method==='linear')!.value,.035);assert.ok(context.oscillators[1].stopTimes[0]!-.2<=.121);
    context.currentTime=.4;engine.technology({kind:'servo',position:[-20,0,0]});assert.equal(context.panners.at(-1)!.pan.value,-.75);assert.equal(context.oscillators.at(-1)!.type,'triangle');
    context.state='suspended';context.currentTime=2;engine.technology({kind:'hover',position:[0,0,0]});assert.equal(context.oscillators.length,3);assert.equal(context.resumes,0);
  }finally{engine.dispose();coastalSoundScene.listener=previous;}
});

test('technology cleanup disconnects completed voices and immediately stops active voices on disposal',()=>{
  const context=new SoundContext(),engine=new CoastalAudio({volume:.3,muted:false},context as unknown as AudioContext);
  const previous=coastalSoundScene.listener;coastalSoundScene.listener=[0,0,0];context.state='running';
  try{
    engine.technology({kind:'servo',position:[0,0,0]});
    const ended=context.oscillators[0],endedGain=ended.connections[0] as SoundNode,endedPan=endedGain.connections[0] as SoundNode;
    ended.end();assert.equal(ended.disconnects,1);assert.equal(endedGain.disconnects,1);assert.equal(endedPan.disconnects,1);assert.equal(ended.onended,null);
    context.currentTime=1;engine.technology({kind:'arrival',position:[0,0,0]});
    const active=context.oscillators[1],activeGain=active.connections[0] as SoundNode,activePan=activeGain.connections[0] as SoundNode;
    engine.dispose();assert.deepEqual(active.stopTimes,[1.28,undefined],'disposal supersedes the scheduled end with an immediate stop');
    assert.equal(active.disconnects,1);assert.equal(activeGain.disconnects,1);assert.equal(activePan.disconnects,1);assert.equal(active.onended,null);assert.equal(ended.disconnects,1,'already ended voice is no longer retained');
    context.currentTime=2;engine.technology({kind:'hover',position:[0,0,0]});assert.equal(context.oscillators.length,2);assert.equal(context.closed,true);
  }finally{coastalSoundScene.listener=previous;}
});
