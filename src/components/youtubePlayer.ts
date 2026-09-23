export interface YouTubePlayer {
  playVideo(): void;
  unMute(): void;
  loadVideoById(videoId: string): void;
  getCurrentTime(): number;
  pauseVideo(): void;
  setVolume(value: number): void;
  setLoop(value: boolean): void;
  destroy(): void;
  getIframe(): HTMLIFrameElement;
}
interface YouTubeOptions {
  width: number;
  height: number;
  videoId: string;
  host: string;
  playerVars: Record<string, string | number>;
  events: {
    onReady: (event: { target: YouTubePlayer }) => void;
    onError: (event: { data: number }) => void;
    onStateChange: (event: { data: number }) => void;
    onAutoplayBlocked: () => void;
  };
}
interface YouTubeAPI { Player: new (element: HTMLElement, options: YouTubeOptions) => YouTubePlayer }
declare global { interface Window { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void } }
let pending: Promise<YouTubeAPI> | undefined;

/** Prepare the official player without playing, so entry can use a direct gesture. */
export function loadYouTubePlayer(): Promise<YouTubeAPI> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;
  pending = new Promise<YouTubeAPI>((resolve, reject) => {
    const script = document.createElement('script');
    let finished = false;
    const previous = window.onYouTubeIframeAPIReady;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true; clearTimeout(timeout);
      window.onYouTubeIframeAPIReady = previous;
      if (error || !window.YT?.Player) { pending = undefined; script.remove(); reject(error ?? new Error('YouTube unavailable')); }
      else resolve(window.YT);
    };
    const timeout = setTimeout(() => finish(new Error('YouTube timed out')), 15000);
    window.onYouTubeIframeAPIReady = () => { finish(); previous?.(); };
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => finish(new Error('YouTube unavailable'));
    document.head.appendChild(script);
  });
  return pending;
}
