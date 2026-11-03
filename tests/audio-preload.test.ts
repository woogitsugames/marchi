// AudioEngine with a minimal fake Web Audio + fetch: one-shots preload after the unlock gesture,
// and a play that arrives while its buffer is still decoding is queued, not dropped.
import { AudioEngine } from '../src/audio/audio';
import { SOUNDS, type SoundId } from '../src/audio/sounds';
import { assert, eq, test } from './harness';

interface Deferred { url: string; resolve: () => void }

class FakeParam {
  value = 0;
  setValueAtTime(v: number): void { this.value = v; }
  linearRampToValueAtTime(v: number): void { this.value = v; }
  setTargetAtTime(v: number): void { this.value = v; }
  cancelScheduledValues(): void {}
}
class FakeNode {
  gain = new FakeParam();
  pan = new FakeParam();
  connect(): void {}
  disconnect(): void {}
}
class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  playbackRate = new FakeParam();
  onended: (() => void) | null = null;
  started = 0;
  static all: FakeSource[] = [];
  constructor() { super(); FakeSource.all.push(this); }
  start(): void { this.started++; }
  stop(): void {}
}

function install(decodes: Deferred[], clock: { now: number }): () => void {
  const g = globalThis as Record<string, unknown>;
  const saved = { window: g.window, document: g.document, fetch: g.fetch, now: performance.now };
  class FakeContext {
    state = 'suspended';
    currentTime = 0;
    destination = new FakeNode();
    createGain(): FakeNode { return new FakeNode(); }
    createStereoPanner(): FakeNode { return new FakeNode(); }
    createBufferSource(): FakeSource { return new FakeSource(); }
    async resume(): Promise<void> { this.state = 'running'; }
    async close(): Promise<void> { this.state = 'closed'; }
    decodeAudioData(bytes: ArrayBuffer): Promise<unknown> {
      const url = new TextDecoder().decode(bytes);
      return new Promise((resolve) => decodes.push({ url, resolve: () => resolve({ duration: 1, url }) }));
    }
  }
  g.window = { AudioContext: FakeContext };
  g.document = {
    hidden: false,
    addEventListener(): void {}, removeEventListener(): void {},
    createElement: () => ({ canPlayType: () => 'probably' }),
  };
  g.fetch = async (url: string) => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode(url).buffer });
  performance.now = () => clock.now;
  return () => {
    g.window = saved.window; g.document = saved.document; g.fetch = saved.fetch;
    performance.now = saved.now;
  };
}

const flush = async (): Promise<void> => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
/** Resolve every queued decode (the preload loop then queues the next one). */
async function drain(decodes: Deferred[]): Promise<void> {
  for (let guard = 0; guard < 200; guard++) {
    await flush();
    const d = decodes.shift();
    if (!d) return;
    d.resolve();
  }
}

test('one-shots preload after unlock; loops stay on demand', async () => {
  const decodes: Deferred[] = [], clock = { now: 0 };
  const restore = install(decodes, clock);
  try {
    const engine = new AudioEngine();
    const fetched: string[] = [];
    const prior = globalThis.fetch;
    globalThis.fetch = (async (url: string) => { fetched.push(url); return prior(url); }) as typeof fetch;
    eq(await engine.init(), true, 'fake context unlocks');
    await drain(decodes);
    const oneShots = (Object.keys(SOUNDS) as SoundId[]).filter((id) => !SOUNDS[id].loop);
    eq(fetched.length, oneShots.length, 'every one-shot fetched once, no loop');
    assert(fetched.every((u) => !u.includes('/ambient/') && !u.includes('cart-')), 'no ambience/cart loop preloaded');
    engine.dispose();
  } finally { restore(); }
});

test('a play during a slow first decode is queued (coalesced), late but not dropped', async () => {
  const decodes: Deferred[] = [], clock = { now: 0 };
  const restore = install(decodes, clock);
  try {
    const engine = new AudioEngine();
    eq(await engine.init(), true, 'unlocked');
    FakeSource.all = [];
    // The preload has not reached stall.alert yet; ask for it twice before anything decodes.
    const first = engine.play('stall.alert');
    await flush();
    (engine as unknown as { cooldowns: Map<string, number> }).cooldowns.clear();
    const second = await engine.play('stall.alert', { gain: 0.5 });
    eq(second, null, 'second request coalesces into the pending one');
    clock.now = 1500; // slower than the old 850 ms cut-off
    await drain(decodes);
    const handle = await first;
    assert(handle !== null, 'the queued play sounds once the buffer arrives');
    eq(FakeSource.all.filter((s) => s.started > 0).length, 1, 'exactly one voice started');
    engine.dispose();
  } finally { restore(); }
});

test('a queued play that is many seconds stale is dropped', async () => {
  const decodes: Deferred[] = [], clock = { now: 0 };
  const restore = install(decodes, clock);
  try {
    const engine = new AudioEngine();
    eq(await engine.init(), true, 'unlocked');
    FakeSource.all = [];
    const late = engine.play('ui.error');
    clock.now = 6000;
    await drain(decodes);
    eq(await late, null, 'stale one-shot dropped');
    eq(FakeSource.all.filter((s) => s.started > 0).length, 0, 'no voice');
    engine.dispose();
  } finally { restore(); }
});
