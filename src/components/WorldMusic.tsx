'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { profile, type BackgroundMusicTrack } from '@/content/profile';
import { AudioPlaylist, type PlaylistSnapshot } from './audioPlaylist';
import { YouTubeMusic } from './YouTubeMusic';

export interface WorldMusicHandle { play: () => void }
/** Music controls live inside Sound settings; the entry gesture starts the retained transport. */
export function WorldMusic({ ref, tracks = profile.soundtrack.audioTracks }: { ref?: Ref<WorldMusicHandle>; tracks?: readonly BackgroundMusicTrack[] }) {
  if (!tracks.length) return <YouTubeMusic ref={ref} />;
  return <DirectWorldMusic ref={ref} tracks={tracks} />;
}

function DirectWorldMusic({ ref, tracks }: { ref?: Ref<WorldMusicHandle>; tracks: readonly BackgroundMusicTrack[] }) {
  const controller = useRef<AudioPlaylist | null>(null);
  const [snapshot, setSnapshot] = useState<PlaylistSnapshot>({ active: false, state: 'ready', index: 0, volume: .25, muted: false });
  function play() {
    if (!tracks.length) return;
    if (!controller.current) {
      const media = new Audio(); media.preload = 'none';
      let storage: Storage | undefined;
      try { storage = window.localStorage; } catch {}
      controller.current = new AudioPlaylist(media, tracks, setSnapshot, { storage, random: () => .999, reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches });
    }
    controller.current.setPreferences({ muted: false });
    controller.current.play();
  }
  useImperativeHandle(ref, () => ({ play }));
  useEffect(() => {
    return () => { controller.current?.dispose(); controller.current = null; };
  }, [tracks]);
  const playing = snapshot.active && ['playing', 'loading', 'buffering'].includes(snapshot.state);
  return <div className="sound-music" role="group" aria-label={profile.soundtrack.settings}>
      <label className="sound-setting"><span>{profile.soundtrack.settings}</span><input type="checkbox" aria-label={profile.soundtrack.settings} checked={playing} onChange={event => event.target.checked ? play() : controller.current?.pause()} /></label>
      <label className="ambience-control__volume"><span>{profile.soundtrack.volume}</span><input aria-label={profile.soundtrack.volume} type="range" min="0" max="1" step="0.01" value={snapshot.volume} onChange={event => controller.current?.setPreferences({ volume: Number(event.target.value) })} /></label>
      {snapshot.active && <span className="sound-track" role="status">{tracks[snapshot.index].title}{snapshot.state === 'unavailable' ? ` · ${profile.soundtrack.trackUnavailable}` : ''}</span>}

  </div>;
}
