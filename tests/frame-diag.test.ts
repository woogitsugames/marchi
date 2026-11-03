// ?diag=1 frame-time collector (src/game/frameDiag.ts): percentiles, histogram, buckets, ring window.
import { DIAG_BINS, FrameDiag } from '../src/game/frameDiag';
import { assert, eq, test } from './harness';

test('frame diag: percentiles and histogram of a known distribution', () => {
  const d = new FrameDiag(1000);
  // 90 frames at 16 ms, 9 at 30 ms, 1 at 120 ms
  for (let i = 0; i < 90; i++) d.record('x4', 16, 1, 5);
  for (let i = 0; i < 9; i++) d.record('x4', 30, 2, 6);
  d.record('x4', 120, 3, 7);
  const r = d.bucket('x4')!;
  eq(r.frames, 100, 'frames');
  eq(r.frameMs.p50, 16, 'p50');
  eq(r.frameMs.p95, 30, 'p95');
  eq(r.frameMs.p99, 30, 'p99');
  eq(r.frameMs.max, 120, 'max');
  eq(r.jank, 1, 'one frame over 33.4 ms');
  eq(r.seconds, 1.8, 'seconds');
  eq(r.simMsP95, 2, 'sim p95');
  eq(r.hist.reduce((a, [, n]) => a + n, 0), 100, 'histogram holds every frame');
  eq(r.hist[r.hist.length - 1]![0], null, 'last bin is open-ended (JSON has no Infinity)');
  eq(r.hist.length, DIAG_BINS.length, 'bins');
});

test('frame diag: buckets are separate and the ring keeps only the last frames', () => {
  const d = new FrameDiag(10);
  for (let i = 0; i < 50; i++) d.record('pause', 100, 0, 1);
  for (let i = 0; i < 10; i++) d.record('pause', 10, 0, 1);
  d.record('x1', 20, 0, 1);
  const p = d.bucket('pause')!;
  eq(p.window, 10, 'ring size');
  eq(p.frameMs.p99, 10, 'old frames left the ring');
  eq(p.frames, 60, 'histogram counts every frame');
  eq(p.jank, 50, 'jank since reset');
  const rep = d.report({ cls: 'fold-open' });
  eq(rep.buckets.map((b) => b.key).join(','), 'pause,x1', 'sorted bucket keys');
  assert(JSON.parse(JSON.stringify(rep)).meta.cls === 'fold-open', 'report is plain JSON');
  d.reset();
  eq(d.bucket('pause'), null, 'reset');
});
