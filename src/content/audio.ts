export type AudioPlaybackState = 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'unavailable';
export interface LicensedAudioSource {
  id: string;
  provider: 'creator';
  playbackUrl: string;
  title: string;
  creator: string;
  sourceUrl: string;
  creatorUrl: string;
  license: { label: string; url: string; evidenceUrl: string };
  verifiedAt: string;
}
const creatorUrl = 'https://www.scottbuckley.com.au/';
function track(id: string, title: string, path: string): LicensedAudioSource {
  const sourceUrl = `${creatorUrl}library/${id}/`;
  return { id, title, provider: 'creator', creator: 'Scott Buckley', creatorUrl, sourceUrl,
    playbackUrl: `${creatorUrl}${path}`, verifiedAt: '2026-09-16',
    license: { label: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/', evidenceUrl: sourceUrl } };
}
export const audio: { playlist: readonly LicensedAudioSource[]; labels: Record<AudioPlaybackState, string>; ui: Record<string, string> } = {
  playlist: [
    track('firefly', 'Firefly', 'wp-content/audio/sb_firefly.mp3'),
    track('reparateur', 'Reparateur', 'wp-content/audio/sb_reparateur.mp3'),
    track('electric-dreams', 'Electric Dreams', 'library/wp-content/uploads/2020/09/sb_electricdreams.mp3'),
    track('meanwhile', 'Meanwhile', 'library/wp-content/uploads/2025/01/Meanwhile.mp3'),
    track('hymn-to-the-dawn', 'Hymn to the Dawn', 'library/wp-content/uploads/2022/11/HymnToTheDawn.mp3'),
  ],
  labels: { loading: 'Loading', ready: 'Ready', playing: 'Playing', paused: 'Paused', buffering: 'Buffering', ended: 'Finished', unavailable: 'Tracks unavailable' },
  ui: { label: 'Music', play: 'Play music', pause: 'Pause music', mute: 'Mute', unmute: 'Unmute',
    close: 'Close music', player: 'Music player', by: 'by', muted: 'Muted', previous: 'Previous track', next: 'Next track',
    volume: 'Volume', source: 'Track and license', retry: 'Retry music', retryHint: 'The soundtrack could not load. Try again when your connection is ready.',
    attribution: 'released under', unchanged: 'Original recording', },
};
export function isApprovedAudioSource(source: LicensedAudioSource | null): source is LicensedAudioSource {
  if (!source || source.provider !== 'creator' || !/^[a-z0-9-]+$/.test(source.id) || !source.title || !source.creator || !source.license.label || !/^\d{4}-\d{2}-\d{2}$/.test(source.verifiedAt)) return false;
  try {
    const playback = new URL(source.playbackUrl), creator = new URL(source.creatorUrl), page = new URL(source.sourceUrl), evidence = new URL(source.license.evidenceUrl);
    return playback.protocol === 'https:' && playback.origin === creator.origin && playback.pathname.endsWith('.mp3')
      && page.protocol === 'https:' && page.origin === creator.origin && page.pathname === `/library/${source.id}/`
      && evidence.href === page.href && new URL(source.license.url).protocol === 'https:';
  } catch { return false; }
}
