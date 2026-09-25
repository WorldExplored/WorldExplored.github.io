import type { YouTubePlayer } from './youtubePlayer';

export type MusicState = 'preparing' | 'ready' | 'loading' | 'playing' | 'paused' | 'blocked' | 'unavailable';
interface TransportOptions {
  videos: readonly string[];
  now: () => number;
  settingsOpen: () => boolean;
  changed: (state: MusicState, index: number, error?: number) => void;
}

/** Playback intent survives iframe interruptions, navigation, and collapsed controls. */
export class YouTubeTransport {
  private player?: YouTubePlayer;
  private wanted = false;
  private blocked = false;
  private failed = new Set<number>();
  private retryAt = Infinity;
  private lastProgress = 0;
  private position = 0;
  private lastReload = -Infinity;
  index = 0;
  volume = 25;
  state: MusicState = 'preparing';
  constructor(private options: TransportOptions) {}
  private publish(state: MusicState, error?: number) {
    this.state = state;
    this.options.changed(state, this.index, error);
  }
  ready(player: YouTubePlayer) {
    this.player = player; player.setVolume(this.volume);
    this.lastProgress = this.options.now();
    if (this.wanted) { this.load(); this.resume(); } else this.publish('ready');
  }
  start() {
    this.wanted = true; this.blocked = false; this.failed.clear();
    this.lastProgress = this.options.now(); this.lastReload = -Infinity;
    this.resume();
  }
  pause() {
    this.wanted = false; this.retryAt = Infinity;
    this.player?.pauseVideo(); this.publish('paused');
  }
  setVolume(value: number) { this.volume = value; this.player?.setVolume(value); }
  select(index: number) {
    this.index = index; this.wanted = true; this.blocked = false; this.failed.clear();
    this.load();
  }
  private resume() {
    if (!this.wanted || this.blocked) return;
    this.retryAt = this.options.now() + 5000;
    this.player?.unMute(); this.player?.setVolume(this.volume); this.player?.playVideo();
    this.publish('loading');
  }
  private load(startSeconds = 0) {
    this.position = startSeconds; this.lastProgress = this.options.now(); this.retryAt = this.lastProgress + 5000;
    this.player?.unMute();
    this.player?.loadVideoById({ videoId: this.options.videos[this.index], startSeconds });
    this.publish('loading');
  }
  private advance() {
    for (let offset = 1; offset <= this.options.videos.length; offset++) {
      const next = (this.index + offset) % this.options.videos.length;
      if (!this.failed.has(next)) { this.index = next; this.load(); return; }
    }
    this.retryAt = Infinity; this.publish('unavailable');
  }
  onState(code: number) {
    if (code === 1) {
      if (!this.wanted) {
        if (this.options.settingsOpen()) this.wanted = true;
        else { this.player?.pauseVideo(); return; }
      }
      this.blocked = false; this.failed.clear(); this.lastProgress = this.options.now();
      this.retryAt = Infinity; this.publish('playing');
    } else if (code === 2) {
      // A pause from focused native controls is deliberate. Other interruptions retain playback intent.
      if (this.options.settingsOpen()) this.wanted = false;
      this.retryAt = this.wanted ? this.options.now() + 1500 : Infinity;
      this.publish(this.wanted ? 'loading' : 'paused');
    } else if (code === 0 && this.wanted) this.advance();
    else if ((code === 3 || code === -1 || code === 5) && this.wanted) this.publish('loading');
  }
  onBlocked() { this.blocked = true; this.retryAt = Infinity; this.publish('blocked'); }
  onError(code?: number) {
    if (this.wanted && this.player) {
      this.failed.add(this.index);
      if (this.failed.size < this.options.videos.length) { this.advance(); return; }
    }
    this.retryAt = Infinity; this.publish('unavailable', code);
  }
  tick() {
    if (!this.player || !this.wanted || this.blocked || this.state === 'unavailable') return;
    const now = this.options.now(), position = this.player.getCurrentTime();
    if (Math.abs(position - this.position) > .1) {
      this.position = position; this.lastProgress = now;
    }
    const code = this.player.getPlayerState();
    if (code === 0) { this.advance(); return; }
    if ((code === 2 || code === -1 || code === 5) && now >= this.retryAt) this.resume();
    // Recover a stalled stream at its current position, without replaying the song from the start.
    if (now - this.lastProgress > 25000 && now - this.lastReload > 30000) {
      this.lastReload = now; this.load(position);
    }
  }
  dispose() { this.wanted = false; this.player = undefined; }
}
