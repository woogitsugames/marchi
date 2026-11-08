import { SOUNDS, type AudioChannel, type SoundId } from './sounds';

export interface AudioPosition { x: number; z: number }
export interface AudioCamera extends AudioPosition {
  /** Angle of the camera's right axis relative to the world X axis, radians. */
  yaw?: number;
}
export interface PlayOptions extends Partial<AudioPosition> {
  gain?: number;
  rate?: number;
}
export interface VoiceHandle { stop(fadeSeconds?: number): void }

type VolumeChannel = 'master' | AudioChannel;
interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  loop: boolean;
  started: number;
  stop: (fadeSeconds?: number) => void;
}
interface LoopState { voice: Voice; target: number }

const VOLUME_DEFAULTS: Readonly<Record<VolumeChannel, number>> = {
  master: 0.8, ambient: 0.55, sfx: 0.65, ui: 0.7,
};
/** Queued first plays older than this are dropped (the moment on screen has passed). */
const STALE_PLAY_MS = 4000;
const cap = (x: number, low = 0, high = 1): number => Number.isFinite(x) ? Math.max(low, Math.min(high, x)) : low;

/**
 * Web Audio only. Instantiate at boot, but call init() synchronously inside a real
 * pointer/keyboard gesture. No AudioContext, fetch, decode or playback happens before it.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private channels: Record<VolumeChannel, GainNode> | null = null;
  private readonly volumes: Record<VolumeChannel, number> = { ...VOLUME_DEFAULTS };
  private readonly buffers = new Map<SoundId, Promise<AudioBuffer | null>>();
  /** Ids whose buffer promise has settled (play can start without waiting). */
  private readonly decoded = new Set<SoundId>();
  /** One coalesced request per id while its buffer is still loading (latest options win). */
  private readonly pending = new Map<SoundId, PlayOptions>();
  private readonly voices = new Set<Voice>();
  private readonly loops = new Map<SoundId, LoopState>();
  private readonly loopTargets = new Map<SoundId, { level: number; rate: number }>();
  private readonly cooldowns = new Map<SoundId, number>();
  private camera: AudioCamera = { x: 0, z: 0, yaw: 0 };
  private alive = true;
  private unlocked = false;
  readonly maxVoices = 16;

  get ready(): boolean { return this.unlocked && this.context?.state === 'running'; }
  get activeVoiceCount(): number { return this.voices.size; }

  async init(): Promise<boolean> {
    if (!this.alive) return false;
    if (this.unlocked) {
      if (!this.context) return false;
      try { await this.context.resume(); } catch { return false; }
      return this.context.state === 'running';
    }
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    // Chromium exposes userActivation; Safari can omit it. Never bypass a known lock.
    if (navigator.userActivation && !navigator.userActivation.isActive) return false;
    const Constructor = window.AudioContext;
    if (!Constructor) return false;
    let context: AudioContext;
    try { context = new Constructor(); } catch { return false; }
    this.context = context;
    const master = context.createGain();
    master.gain.value = this.volumes.master;
    master.connect(context.destination);
    const ambient = context.createGain(), sfx = context.createGain(), ui = context.createGain();
    for (const [node, channel] of [[ambient, 'ambient'], [sfx, 'sfx'], [ui, 'ui']] as const) {
      node.gain.value = this.volumes[channel];
      node.connect(master);
    }
    this.channels = { master, ambient, sfx, ui };
    document.addEventListener('visibilitychange', this.onVisibility);
    try { await context.resume(); } catch { /* autoplay policy: no playback until another gesture */ }
    this.unlocked = context.state === 'running';
    if (this.unlocked) {
      for (const [id, { level }] of this.loopTargets) if (level > 0) void this.startLoop(id);
      void this.preloadOneShots();
    }
    return this.unlocked;
  }

  setVolume(channel: VolumeChannel, volume: number): void {
    const v = cap(volume);
    this.volumes[channel] = v;
    const ctx = this.context, node = this.channels?.[channel];
    if (ctx && node) node.gain.setTargetAtTime(channel === 'master' && document.hidden ? 0 : v, ctx.currentTime, 0.025);
  }

  getVolume(channel: VolumeChannel): number { return this.volumes[channel]; }

  setCamera(camera: AudioCamera): void {
    this.camera = { x: camera.x, z: camera.z, yaw: camera.yaw ?? 0 };
  }

  /** Positional transient. Returns null if locked, inaudible or voice-limited. */
  async play(id: SoundId, options: PlayOptions = {}): Promise<VoiceHandle | null> {
    const ctx = this.context, def = SOUNDS[id];
    if (!this.ready || !ctx || !this.channels) return null;
    const time = ctx.currentTime;
    if (time - (this.cooldowns.get(id) ?? -Infinity) < (def.cooldown ?? 0)) return null;
    const spatial = this.spatial(options, def.radius);
    if (spatial.gain < 0.008) return null;
    this.cooldowns.set(id, time);
    let spot = spatial;
    if (!this.decoded.has(id)) {
      // First use while the asset is still loading: queue one pending play per id instead of
      // dropping it (slow first decode used to silence rare sounds); later calls only update it.
      const queued = this.pending.has(id);
      this.pending.set(id, options);
      if (queued) return null;
      const requestedAt = performance.now();
      await this.getBuffer(id);
      const latest = this.pending.get(id) ?? options;
      this.pending.delete(id);
      // A one-shot that is many seconds late no longer matches what is on screen.
      if (!def.loop && performance.now() - requestedAt > STALE_PLAY_MS) return null;
      spot = this.spatial(latest, def.radius);
      options = latest;
    }
    const buffer = await this.getBuffer(id);
    if (!buffer || !this.ready || !this.alive || spot.gain < 0.008) return null;
    if (this.voices.size >= this.maxVoices) return null;
    const rate = cap(options.rate ?? 1, 0.5, 2);
    const voice = this.makeVoice(id, buffer, spot.gain * cap(options.gain ?? 1, 0, 3), rate,
      spot.pan, !!def.loop);
    return voice ? { stop: voice.stop } : null;
  }

  /**
   * Fetch and decode every one-shot (sfx + ui, ~300 kB) right after the unlock gesture, one at a
   * time so the first frames are not starved. Loops load on demand (ambience decodes to ~10 MB each).
   */
  async preloadOneShots(): Promise<number> {
    let count = 0;
    for (const id of Object.keys(SOUNDS) as SoundId[]) {
      if (!this.alive || !this.context) break;
      if (SOUNDS[id].loop) continue;
      if (await this.getBuffer(id)) count++;
    }
    return count;
  }

  /**
   * Aggregated loops: one voice per id, not one per wagon/building.
   * Target changes use gain crossfades; 0 stops the voice after a smooth release.
   */
  setLoopLevel(id: SoundId, level: number, rate = 1): void {
    if (!SOUNDS[id].loop || !this.alive) return;
    const l = cap(level), r = cap(rate, 0.6, 1.6);
    const prior = this.loopTargets.get(id);
    if (prior && Math.abs(prior.level - l) < 0.012 && Math.abs(prior.rate - r) < 0.025) return;
    this.loopTargets.set(id, { level: l, rate: r });
    const ctx = this.context;
    if (!this.ready || !ctx) return;
    const active = this.loops.get(id);
    if (active) {
      active.target = l;
      active.voice.source.playbackRate.setTargetAtTime(r, ctx.currentTime, 0.3);
      if (l <= 0) {
        this.loops.delete(id);
        active.voice.stop(1.4);
      } else {
        this.ramp(active.voice.gain.gain, l * SOUNDS[id].gain, 1.4);
      }
      return;
    }
    if (l === 0) return;
    void this.startLoop(id);
  }

  /** `iced`: the wooden bridges are iced — the river near the camera creaks instead of flowing (D-351). */
  setAmbience(kind: 'morning' | 'evening' | 'rain' | 'winter', riverLevel = 0, iced = false): void {
    this.setLoopLevel('ambient.morning', kind === 'morning' ? 0.72 : 0);
    this.setLoopLevel('ambient.evening', kind === 'evening' ? 0.72 : 0);
    this.setLoopLevel('ambient.rain', kind === 'rain' ? 0.79 : 0);
    this.setLoopLevel('ambient.winterWind', kind === 'winter' ? 0.72 : 0);
    this.setLoopLevel('ambient.river', iced ? 0 : cap(riverLevel) * 0.72);
    this.setLoopLevel('ambient.iceCreak', iced ? cap(riverLevel) * 0.72 : 0);
  }

  setTraffic(dirt: number, cobble: number, rate = 1): void {
    // Log compression preserves movement at 1 cart without clipping at 200 carts.
    const mix = (count: number): number => cap(Math.log1p(Math.max(0, count)) / Math.log1p(14));
    this.setLoopLevel('cart.dirt', mix(dirt) * 0.72, rate);
    this.setLoopLevel('cart.cobble', mix(cobble) * 0.63, rate);
  }

  dispose(): void {
    this.alive = false;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
    for (const voice of [...this.voices]) voice.stop(0.015);
    this.voices.clear();
    this.loops.clear();
    this.loopTargets.clear();
    this.buffers.clear();
    this.decoded.clear();
    this.pending.clear();
    const ctx = this.context;
    this.context = null;
    this.channels = null;
    this.unlocked = false;
    if (ctx) void ctx.close().catch(() => undefined);
  }

  private readonly onVisibility = (): void => {
    const ctx = this.context, master = this.channels?.master;
    if (!ctx || !master || !this.unlocked) return;
    master.gain.setTargetAtTime(document.hidden ? 0 : this.volumes.master, ctx.currentTime, 0.04);
    if (!document.hidden && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  };

  private async startLoop(id: SoundId): Promise<void> {
    const buffer = await this.getBuffer(id);
    const target = this.loopTargets.get(id);
    if (!buffer || !target || target.level <= 0 || this.loops.has(id) || !this.ready) return;
    if (this.voices.size >= this.maxVoices) return;
    const voice = this.makeVoice(id, buffer, 0, target.rate, 0, true);
    if (!voice) return;
    this.loops.set(id, { voice, target: target.level });
    this.ramp(voice.gain.gain, target.level * SOUNDS[id].gain, 1.5);
  }

  private makeVoice(id: SoundId, buffer: AudioBuffer, gain: number, rate: number, pan: number, loop: boolean): Voice | null {
    const ctx = this.context, bus = this.channels?.[SOUNDS[id].channel];
    if (!ctx || !bus) return null;
    const source = ctx.createBufferSource(), envelope = ctx.createGain();
    source.buffer = buffer;
    source.loop = loop;
    source.playbackRate.value = rate;
    if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = cap(pan, -1, 1);
      source.connect(envelope);
      envelope.connect(panner);
      panner.connect(bus);
    } else { source.connect(envelope); envelope.connect(bus); }
    const now = ctx.currentTime, duration = buffer.duration / rate;
    envelope.gain.value = 0;
    if (loop) envelope.gain.setValueAtTime(gain * SOUNDS[id].gain, now);
    else {
      const amplitude = gain * SOUNDS[id].gain;
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(amplitude, now + Math.min(0.008, duration / 4));
      envelope.gain.setValueAtTime(amplitude, now + Math.max(0.009, duration - 0.035));
      envelope.gain.linearRampToValueAtTime(0, now + duration);
    }
    let stopped = false;
    const voice: Voice = {
      source, gain: envelope, started: now, loop,
      stop: (fadeSeconds = 0.035) => {
        if (stopped) return;
        stopped = true;
        const t = ctx.currentTime, fade = Math.max(0.008, fadeSeconds);
        envelope.gain.cancelScheduledValues(t);
        envelope.gain.setTargetAtTime(0, t, fade / 5);
        try { source.stop(t + fade + 0.02); } catch { /* already ended */ }
      },
    };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      if (this.loops.get(id)?.voice === voice) this.loops.delete(id);
      source.disconnect(); envelope.disconnect();
    };
    try { source.start(now); } catch { this.voices.delete(voice); return null; }
    return voice;
  }

  private ramp(param: AudioParam, target: number, seconds: number): void {
    const now = this.context?.currentTime ?? 0;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + seconds);
  }

  private spatial(options: PlayOptions, radius = 65): { gain: number; pan: number } {
    if (options.x === undefined || options.z === undefined) return { gain: 1, pan: 0 };
    const dx = options.x - this.camera.x, dz = options.z - this.camera.z;
    const d = Math.hypot(dx, dz), falloff = cap(1 - d / radius);
    const yaw = this.camera.yaw ?? 0;
    return { gain: falloff * falloff, pan: d > 0.01 ? cap((dx * Math.cos(yaw) - dz * Math.sin(yaw)) / Math.max(12, d), -1, 1) : 0 };
  }

  private getBuffer(id: SoundId): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(id);
    if (cached) return cached;
    const promise = (async () => {
      const ctx = this.context;
      if (!ctx) return null;
      const def = SOUNDS[id];
      const probe = document.createElement('audio');
      const preferM4a = !probe.canPlayType('audio/ogg; codecs="vorbis"');
      for (const url of preferM4a ? [def.m4a, def.ogg] : [def.ogg, def.m4a]) {
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const bytes = await r.arrayBuffer();
          return await ctx.decodeAudioData(bytes);
        } catch { /* try the other codec; no unhandled promise */ }
      }
      console.warn(`[audio] Missing or undecodable asset: ${id}`);
      return null;
    })();
    this.buffers.set(id, promise);
    void promise.then(() => { if (this.buffers.get(id) === promise) this.decoded.add(id); });
    return promise;
  }
}
