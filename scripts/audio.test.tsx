import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { AudioControl } from '../src/components/AudioControl';
import { audio, isApprovedAudioSource } from '../src/content/audio';

test('audio has no source or autoplay before intentional activation', () => {
  const html = renderToStaticMarkup(<AudioControl />);
  assert.match(html, /Play music/);
  assert.match(html, /<audio preload="none"/);
  assert.doesNotMatch(html, /<iframe|<script|src=|autoPlay|autoplay|https:/);
});

test('missing or mismatched source permission renders no control', () => {
  assert.ok(audio.source);
  assert.equal(renderToStaticMarkup(<AudioControl source={null} />), '');
  assert.equal(renderToStaticMarkup(<AudioControl source={{ ...audio.source, sourceUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' }} />), '');
});

test('audio requires matching creator, track, license and YouTube evidence', () => {
  assert.ok(audio.source);
  assert.ok(isApprovedAudioSource(audio.source));
  assert.equal(isApprovedAudioSource({ ...audio.source, videoId: '../bad-id' }), false);
  assert.equal(isApprovedAudioSource({ ...audio.source, license: { ...audio.source.license, evidenceUrl: 'http://example.com/license' } }), false);
  assert.equal(isApprovedAudioSource({ ...audio.source, embedding: { ...audio.source.embedding, evidenceUrl: 'https://example.com/embed/PiPyx9sBCi8' } }), false);
});

test('native playback uses the secure creator-published audio file', () => {
  assert.ok(audio.source);
  const playback = new URL(audio.source.playbackUrl);
  assert.equal(playback.origin, new URL(audio.source.creatorUrl).origin);
  assert.equal(playback.pathname, '/wp-content/audio/sb_firefly.mp3');
  assert.equal(isApprovedAudioSource({ ...audio.source, playbackUrl: 'http://www.scottbuckley.com.au/track.mp3' }), false);
  assert.equal(isApprovedAudioSource({ ...audio.source, playbackUrl: 'https://example.com/track.mp3' }), false);
});
