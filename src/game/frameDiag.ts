// Frame-time diagnostics for `?diag=1` (BACKLOG P2): what a foldable actually spends per frame in the real game,
// as JSON to paste into docs/PERF.md. Frames are bucketed by game speed ("pause" is the reference: same view,
// no ticks), so one session gives the reference and the measurement without any switch. Each bucket keeps the
// last `capacity` frames in fixed typed rings (no allocation per frame) for percentiles, plus a histogram of every
// frame since the last reset. No DOM, no three: unit-tested headless (tests/frame-diag.test.ts).

/** Histogram upper bounds in ms (a frame of 16.7 ms is one 60 Hz vsync; 33.4 is a dropped one). */
export const DIAG_BINS: readonly number[] = [8.4, 11.2, 16.7, 20, 25, 33.4, 50, 100, Infinity];

export interface DiagBucketReport {
  key: string;
  frames: number;
  seconds: number;
  /** Over the last `window` frames (the ring). */
  window: number;
  frameMs: { p50: number; p95: number; p99: number; max: number; mean: number };
  simMsP95: number;
  viewMsP95: number;
  /** Frames over 33.4 ms (two vsyncs at 60 Hz) since the reset, and their share. */
  jank: number;
  jankShare: number;
  /** [upper bound ms (null = no bound), count] since the reset. */
  hist: [number | null, number][];
}

export interface DiagReport {
  format: 'marchia.frame-diag.v1';
  buckets: DiagBucketReport[];
  meta: Record<string, unknown>;
}

interface Bucket {
  key: string;
  frame: Float32Array;
  sim: Float32Array;
  view: Float32Array;
  head: number;
  filled: number;
  frames: number;
  ms: number;
  hist: Uint32Array;
}

const round = (x: number, d = 2): number => {
  const f = d === 3 ? 1000 : d === 1 ? 10 : 100;
  return Math.round(x * f) / f;
};

/** p-th quantile (0..1) of the first `n` values of a sorted array (nearest rank). */
function quantile(sorted: Float32Array, n: number, p: number): number {
  if (n === 0) return 0;
  return sorted[Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1))]!;
}

export class FrameDiag {
  private buckets = new Map<string, Bucket>();
  private scratch: Float32Array;

  constructor(readonly capacity = 120 * 120) {
    this.scratch = new Float32Array(capacity);
  }

  /** One rendered frame: its wall time and the CPU spent in the sim (loop.advance) and the view (view.frame). */
  record(key: string, frameMs: number, simMs: number, viewMs: number): void {
    let b = this.buckets.get(key);
    if (!b) {
      const c = this.capacity;
      b = { key, frame: new Float32Array(c), sim: new Float32Array(c), view: new Float32Array(c), head: 0, filled: 0, frames: 0, ms: 0, hist: new Uint32Array(DIAG_BINS.length) };
      this.buckets.set(key, b);
    }
    b.frame[b.head] = frameMs;
    b.sim[b.head] = simMs;
    b.view[b.head] = viewMs;
    b.head = (b.head + 1) % this.capacity;
    if (b.filled < this.capacity) b.filled++;
    b.frames++;
    b.ms += frameMs;
    let i = 0;
    while (frameMs > DIAG_BINS[i]!) i++;
    b.hist[i]!++;
  }

  reset(): void {
    this.buckets.clear();
  }

  private p95(src: Float32Array, n: number): number {
    const s = this.scratch.subarray(0, n);
    s.set(src.subarray(0, n));
    s.sort();
    return quantile(s, n, 0.95);
  }

  bucket(key: string): DiagBucketReport | null {
    const b = this.buckets.get(key);
    if (!b) return null;
    const n = b.filled;
    const s = this.scratch.subarray(0, n);
    s.set(b.frame.subarray(0, n));
    s.sort();
    let sum = 0;
    for (let i = 0; i < n; i++) sum += s[i]!;
    const frameMs = {
      p50: round(quantile(s, n, 0.5)), p95: round(quantile(s, n, 0.95)), p99: round(quantile(s, n, 0.99)),
      max: round(n ? s[n - 1]! : 0), mean: round(n ? sum / n : 0),
    };
    const jank = b.hist.reduce((a, c, i) => a + (DIAG_BINS[i]! > 33.4 ? c : 0), 0);
    return {
      key: b.key, frames: b.frames, seconds: round(b.ms / 1000, 1), window: n, frameMs,
      simMsP95: round(this.p95(b.sim, n), 3), viewMsP95: round(this.p95(b.view, n), 3),
      jank, jankShare: round(b.frames ? jank / b.frames : 0, 3),
      hist: DIAG_BINS.map((le, i) => [Number.isFinite(le) ? le : null, b.hist[i]!] as [number | null, number]),
    };
  }

  report(meta: Record<string, unknown> = {}): DiagReport {
    const keys = [...this.buckets.keys()].sort();
    return { format: 'marchia.frame-diag.v1', buckets: keys.map((k) => this.bucket(k)!), meta };
  }
}
