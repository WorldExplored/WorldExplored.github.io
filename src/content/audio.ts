export type AudioPlaybackState = 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'unavailable';

export interface LicensedAudioSource {
  provider: 'creator';
  videoId: string;
  playbackUrl: string;
  title: string;
  creator: string;
  sourceUrl: string;
  creatorUrl: string;
  license: { label: string; url: string; evidenceUrl: string };
  embedding: { permitted: true; verifiedAt: string; evidenceUrl: string };
}

export const audio: { source: LicensedAudioSource | null; labels: Record<AudioPlaybackState, string>; ui: Record<string, string> } = {
  source: {
    provider: 'creator',
    videoId: 'PiPyx9sBCi8',
    playbackUrl: 'https://www.scottbuckley.com.au/wp-content/audio/sb_firefly.mp3',
    title: 'Firefly',
    creator: 'Scott Buckley',
    sourceUrl: 'https://www.youtube.com/watch?v=PiPyx9sBCi8',
    creatorUrl: 'https://www.scottbuckley.com.au/',
    license: {
      label: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
      evidenceUrl: 'https://www.scottbuckley.com.au/library/firefly/',
    },
    embedding: {
      permitted: true,
      verifiedAt: '2026-09-14',
      evidenceUrl: 'https://www.youtube-nocookie.com/embed/PiPyx9sBCi8',
    },
  },
  labels: { loading: 'Loading', ready: 'Ready', playing: 'Playing', paused: 'Paused', buffering: 'Buffering', ended: 'Finished', unavailable: 'Unavailable' },
  ui: {
    label: 'Music', play: 'Play music', pause: 'Pause music', mute: 'Mute', unmute: 'Unmute',
    youtube: 'YouTube', close: 'Close music', player: 'Music player', by: 'by', muted: 'Muted',
  },
};

export function isApprovedAudioSource(source: LicensedAudioSource | null): source is LicensedAudioSource {
  if (!source || source.provider !== 'creator' || !/^[\w-]{11}$/.test(source.videoId) || !source.embedding.permitted) return false;
  if (!source.title || !source.creator || !source.license.label || !/^\d{4}-\d{2}-\d{2}$/.test(source.embedding.verifiedAt)) return false;
  try {
    const playback = new URL(source.playbackUrl);
    const creator = new URL(source.creatorUrl);
    const watch = new URL(source.sourceUrl);
    const evidence = new URL(source.embedding.evidenceUrl);
    return playback.protocol === 'https:' && playback.origin === creator.origin && playback.pathname.endsWith('.mp3') && watch.origin === 'https://www.youtube.com' && watch.pathname === '/watch' && watch.searchParams.get('v') === source.videoId
      && ['https://www.youtube.com', 'https://www.youtube-nocookie.com'].includes(evidence.origin) && evidence.pathname === `/embed/${source.videoId}`
      && [source.creatorUrl, source.license.url, source.license.evidenceUrl].every(url => new URL(url).protocol === 'https:');
  } catch { return false; }
}
