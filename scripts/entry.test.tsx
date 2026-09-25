import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorldEntry } from '../src/components/WorldEntry';
import { WorldMusic } from '../src/components/WorldMusic';
import { EnvironmentalAudioControl } from '../src/components/EnvironmentalAudioControl';
import { profile } from '../src/content/profile';
import { loadYouTubePlayer } from '../src/components/youtubePlayer';

test('entry presents an accessible intentional sound choice without loading media', () => {
  let entered = false;
  const html = renderToStaticMarkup(<WorldEntry onEnter={() => { entered = true; }} />);
  assert.match(html, /<dialog[^>]*aria-labelledby="world-entry-title"/);
  assert.match(html, /type="checkbox" checked=""/);
  assert.match(html, /Enter the world/);
  assert.doesNotMatch(html, /<iframe|<audio|<script|https:/);
  assert.equal(entered, false);
  assert.match(renderToStaticMarkup(<EnvironmentalAudioControl visible={false}><WorldMusic /></EnvironmentalAudioControl>), /data-settings-open="false"/);
});

test('Sound settings retain a prepared music host and honest playback controls', () => {
  assert.deepEqual(profile.soundtrack.tracks.map(track => track.videoId), ['tjlvmb8SGEs', 'P15Ldd_lSEM']);
  const html = renderToStaticMarkup(<WorldMusic />);
  assert.doesNotMatch(html, /<iframe|<script|<audio|autoplay=|world-music__/);
  assert.match(html, /data-music-state="preparing"/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /sound-music__player/);
  const settings = renderToStaticMarkup(<EnvironmentalAudioControl visible={false}><WorldMusic /></EnvironmentalAudioControl>);
  assert.match(settings, /is-collapsed/); assert.match(settings, /inert=""/);
  assert.doesNotMatch(settings, /<details/);
  assert.match(settings, /aria-controls="world-settings"/);
  assert.doesNotMatch(html, /Listen on YouTube|checked=""/);
  const direct = renderToStaticMarkup(<WorldMusic tracks={[{title:'Test',artist:'Test',playbackUrl:'/audio/test.mp3'}]} />);
  assert.match(direct, /aria-label="Music"/);
  assert.doesNotMatch(direct, /<iframe|<audio|checked=""/);
});

test('YouTube loading coalesces requests, retries a failed script, and restores an existing ready callback', async () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let priorReady = 0;
  const browser = { onYouTubeIframeAPIReady: () => { priorReady++; }, YT: undefined as unknown };
  const scripts: Array<{ src?: string; async?: boolean; onerror?: () => void; removed?: boolean; remove: () => void }> = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement() { const script = { remove() { script.removed = true; }, removed: false }; return script; },
    head: { appendChild(script: typeof scripts[number]) { scripts.push(script); } },
  } });
  try {
    const first = loadYouTubePlayer(), second = loadYouTubePlayer();
    assert.equal(first, second); assert.equal(scripts.length, 1);
    assert.equal(scripts[0].src, 'https://www.youtube.com/iframe_api');
    const rejected = assert.rejects(first, /unavailable/); scripts[0].onerror!(); await rejected;
    assert.equal(scripts[0].removed, true);
    const retry = loadYouTubePlayer(); assert.equal(scripts.length, 2);
    browser.YT = { Player: class {} }; browser.onYouTubeIframeAPIReady();
    assert.equal(await retry, browser.YT); assert.equal(priorReady, 1);
    assert.equal(await loadYouTubePlayer(), browser.YT); assert.equal(scripts.length, 2);
  } finally {
    if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor); else Reflect.deleteProperty(globalThis, 'window');
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor); else Reflect.deleteProperty(globalThis, 'document');
  }
});
