export type AudioPlaybackState = 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'unavailable';

export interface YouTubeAudioSource {
  provider: 'youtube';
  videoId: string;
  title: string;
  creator: string;
  sourceUrl: string;
  creatorUrl: string;
  license: { label: string; url: string; evidenceUrl: string };
  embedding: { permitted: true; verifiedAt: string; evidenceUrl: string };
}

export const audio: { source: YouTubeAudioSource | null; labels: Record<AudioPlaybackState, string>; ui: Record<string, string> } = {
  source: {
    provider: 'youtube',
    videoId: 'PiPyx9sBCi8',
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
    close: 'Close music', player: 'Music player', by: 'by', muted: 'Muted',
  },
};

export function isApprovedAudioSource(source: YouTubeAudioSource | null): source is YouTubeAudioSource {
  if (!source || source.provider !== 'youtube' || !/^[\w-]{11}$/.test(source.videoId) || !source.embedding.permitted) return false;
  if (!source.title || !source.creator || !source.license.label || !/^\d{4}-\d{2}-\d{2}$/.test(source.embedding.verifiedAt)) return false;
  try {
    const watch = new URL(source.sourceUrl);
    const evidence = new URL(source.embedding.evidenceUrl);
    return watch.origin === 'https://www.youtube.com' && watch.pathname === '/watch' && watch.searchParams.get('v') === source.videoId
      && ['https://www.youtube.com', 'https://www.youtube-nocookie.com'].includes(evidence.origin) && evidence.pathname === `/embed/${source.videoId}`
      && [source.creatorUrl, source.license.url, source.license.evidenceUrl].every(url => new URL(url).protocol === 'https:');
  } catch { return false; }
}

export function playbackStateFromYouTube(state: number): AudioPlaybackState {
  switch (state) {
    case 0: return 'ended';
    case 1: return 'playing';
    case 2: return 'paused';
    case 3: return 'buffering';
    default: return 'ready';
  }
}

export function youtubeEmbedUrl(videoId: string, origin: string) {
  if (!/^[\w-]{11}$/.test(videoId)) throw new Error('Invalid YouTube video identifier.');
  const site = new URL(origin);
  if (site.protocol !== 'https:' && site.hostname !== 'localhost' && site.hostname !== '127.0.0.1') throw new Error('A secure site origin is required.');
  const url = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
  url.search = new URLSearchParams({ enablejsapi: '1', autoplay: '0', playsinline: '1', controls: '1', origin: site.origin }).toString();
  return url.toString();
}
