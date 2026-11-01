// Background music: the owner's own medieval score (see docs/ASSETS.md → Music).
// Streams through <audio> elements (never decoded into AudioBuffers — a 3-minute stereo track
// would cost ~60 MB of RAM decoded). Two elements crossfade; gameplay tracks are separated by
// short silences so the valley's ambience can breathe.

export type MusicMood = 'menu' | 'play' | 'rain' | 'won' | 'lost' | 'none';

const BASE = 'assets/music/';
const TRACKS: Record<Exclude<MusicMood, 'none'>, string[]> = {
  menu: ['menu-hush-before-sunrise', 'menu-first-light'],
  play: [
    'play-wheatmill-path', 'play-millpond-crossing', 'play-harvest-lane', 'play-wheatfield-lane',
    'play-granary-at-stonegate', 'play-oven-hearth-morning', 'play-bakers-hearth-glow', 'play-gleaning-at-dusk',
  ],
  rain: ['rain-drizzle-on-the-square', 'rain-on-cobblestone'],
  won: ['won-silver-pennant-fanfare'],
  lost: ['lost-frost-on-the-rooftops'],
};
/** Silence between gameplay tracks (ms). */
const GAP_MIN = 15000, GAP_MAX = 40000;
const FADE_MS = 2500;

export class MusicPlayer {
  private els: [HTMLAudioElement, HTMLAudioElement];
  private cur = 0;
  private mood: MusicMood = 'none';
  private volume = 0.55;
  private unlocked = false;
  private order: Record<string, number> = {};
  private gapTimer: number | null = null;
  private fadeRaf = 0;
  private hidden = false;

  constructor() {
    const mk = (): HTMLAudioElement => {
      const a = new Audio();
      a.preload = 'auto';
      a.addEventListener('ended', () => this.onEnded(a));
      return a;
    };
    this.els = [mk(), mk()];
    document.addEventListener('visibilitychange', () => {
      this.hidden = document.hidden;
      const a = this.els[this.cur];
      if (this.hidden) a.pause();
      else if (this.unlocked && this.mood !== 'none' && a.src && !a.ended) void a.play().catch(() => undefined);
    });
  }

  /** Opus-in-WebM support (Android WebView, iOS 17+). Without it the game stays silent instead of erroring. */
  readonly supported = typeof document !== 'undefined' && document.createElement('audio').canPlayType('audio/webm; codecs="opus"') !== '';

  /** Call from a trusted user gesture (first tap). */
  unlock(): void {
    if (this.unlocked || !this.supported) return;
    this.unlocked = true;
    if (this.mood !== 'none') this.startTrack(this.mood, true);
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.els[this.cur].volume = this.volume;
  }

  getVolume(): number { return this.volume; }

  /** Switch mood; same mood keeps the current track. */
  setMood(m: MusicMood): void {
    if (m === this.mood) return;
    this.mood = m;
    this.clearGap();
    if (m === 'none') { this.fadeTo(null); return; }
    if (this.unlocked) this.startTrack(m, false);
  }

  private pick(m: Exclude<MusicMood, 'none'>): string {
    const list = TRACKS[m];
    const i = (this.order[m] ?? Math.floor(Math.random() * list.length)) % list.length;
    this.order[m] = i + 1;
    return list[i]!;
  }

  private startTrack(m: MusicMood, immediate: boolean): void {
    if (m === 'none') return;
    const next = this.els[1 - this.cur]!;
    next.src = BASE + this.pick(m) + '.webm';
    next.loop = m === 'menu';
    next.volume = 0;
    next.currentTime = 0;
    if (!this.hidden) void next.play().catch(() => undefined);
    this.fadeTo(next, immediate);
  }

  /** Crossfade from the current element to `next` (or to silence). */
  private fadeTo(next: HTMLAudioElement | null, immediate = false): void {
    cancelAnimationFrame(this.fadeRaf);
    const prev = this.els[this.cur]!;
    if (next) this.cur = this.els.indexOf(next);
    const p0 = prev.volume, t0 = performance.now(), dur = immediate ? 400 : FADE_MS;
    const step = (t: number): void => {
      const k = Math.min(1, (t - t0) / dur);
      if (prev !== next) prev.volume = p0 * (1 - k);
      if (next) next.volume = this.volume * k;
      if (k < 1) this.fadeRaf = requestAnimationFrame(step);
      else if (prev !== next) { prev.pause(); }
    };
    this.fadeRaf = requestAnimationFrame(step);
  }

  private onEnded(a: HTMLAudioElement): void {
    if (a !== this.els[this.cur] || this.mood === 'none') return;
    if (this.mood === 'won' || this.mood === 'lost') return; // one-shot
    const mood = this.mood;
    this.clearGap();
    this.gapTimer = window.setTimeout(() => {
      this.gapTimer = null;
      if (this.mood === mood) this.startTrack(mood, false);
    }, GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN));
  }

  private clearGap(): void {
    if (this.gapTimer !== null) { clearTimeout(this.gapTimer); this.gapTimer = null; }
  }
}
