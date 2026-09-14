import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { AudioControl } from '../src/components/AudioControl';
import { audio, isApprovedAudioSource, playbackStateFromYouTube, youtubeEmbedUrl } from '../src/content/audio';

test('audio stays silent and makes no player requests before intentional activation', () => {
  const html = renderToStaticMarkup(<AudioControl />);
  assert.match(html, /Play music/);
  assert.doesNotMatch(html, /<iframe|<script|<audio|youtube\.com|youtube-nocookie\.com/);
  assert.equal(renderToStaticMarkup(<AudioControl source={null} />), '');
});

test('audio source requires a matching video, license evidence and embedding evidence', () => {
  assert.ok(audio.source);
  assert.ok(isApprovedAudioSource(audio.source));
  assert.equal(isApprovedAudioSource({ ...audio.source, videoId: '../bad-id' }), false);
  assert.equal(isApprovedAudioSource({ ...audio.source, sourceUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' }), false);
  assert.equal(isApprovedAudioSource({ ...audio.source, license: { ...audio.source.license, evidenceUrl: 'http://example.com/license' } }), false);
  assert.equal(isApprovedAudioSource({ ...audio.source, embedding: { ...audio.source.embedding, evidenceUrl: 'https://example.com/embed/PiPyx9sBCi8' } }), false);
});

test('YouTube URL preserves intentional playback and binds the actual site origin', () => {
  const url = new URL(youtubeEmbedUrl('PiPyx9sBCi8', 'https://worldexplored.github.io/path'));
  assert.equal(url.origin, 'https://www.youtube-nocookie.com');
  assert.equal(url.pathname, '/embed/PiPyx9sBCi8');
  assert.equal(url.searchParams.get('autoplay'), '0');
  assert.equal(url.searchParams.get('controls'), '1');
  assert.equal(url.searchParams.get('origin'), 'https://worldexplored.github.io');
  assert.equal(new URL(youtubeEmbedUrl('PiPyx9sBCi8', 'http://localhost:3000')).searchParams.get('origin'), 'http://localhost:3000');
  assert.throws(() => youtubeEmbedUrl('../untrusted', 'https://worldexplored.github.io'));
  assert.throws(() => youtubeEmbedUrl('PiPyx9sBCi8', 'http://example.com'));
});

test('playback labels follow player events without claiming unknown states are playing', () => {
  assert.equal(playbackStateFromYouTube(1), 'playing');
  assert.equal(playbackStateFromYouTube(2), 'paused');
  assert.equal(playbackStateFromYouTube(3), 'buffering');
  assert.equal(playbackStateFromYouTube(0), 'ended');
  assert.equal(playbackStateFromYouTube(5), 'ready');
  assert.equal(playbackStateFromYouTube(-1), 'ready');
  assert.equal(playbackStateFromYouTube(99), 'ready');
});
