// Free valley 3 h of game time at x4 through the real GameLoop (60 frames of 16.7 ms per real second, headless):
// heap after a forced GC, GC pauses, state size and every growing array / map in the state, every 10 game minutes.
// Research 2026-11-06 (docs/research/2026-11-06-robustness.md).
//   node --expose-gc --import tsx tools/valley-mem.ts [--min 180]
import { PerformanceObserver } from 'node:perf_hooks';
import { TICK_HZ, checkInvariants, createWorld, sandboxStatus, unexplainedStalls } from '../src/sim/index';
import { GameLoop } from '../src/game/loop';
import { rankStalls } from '../src/ui/stalls';
import { valleyDriver } from './robustness';

const args = process.argv.slice(2);
const mi = args.indexOf('--min');
const minutes = mi >= 0 ? Number(args[mi + 1]) : 180;
const gc = (globalThis as { gc?: () => void }).gc;
if (!gc) { console.error('run with node --expose-gc --import tsx'); process.exit(2); }

let gcCount = 0, gcMs = 0, gcMax = 0;
new PerformanceObserver((l) => { for (const e of l.getEntries()) { gcCount++; gcMs += e.duration; gcMax = Math.max(gcMax, e.duration); } })
  .observe({ entryTypes: ['gc'] });

/** Lengths of every array and key counts of every object in the state, by path (indices collapsed to []). */
function sizes(v: unknown, path: string, out: Map<string, number>): void {
  if (Array.isArray(v)) {
    out.set(path, Math.max(out.get(path) ?? 0, v.length));
    if (v.length && typeof v[0] === 'object') for (const x of v) sizes(x, path + '[]', out);
  } else if (v && typeof v === 'object') {
    const ks = Object.keys(v);
    out.set(path + '{}', Math.max(out.get(path + '{}') ?? 0, ks.length));
    for (const k of ks) sizes((v as Record<string, unknown>)[k], path + '.' + k, out);
  }
}

const w = createWorld('sandbox');
const loop = new GameLoop(w);
loop.speed = 4;
const driver = valleyDriver();
const FRAME = 1000 / 60;
const end = minutes * 60 * TICK_HZ;
let frames = 0, viol = 0, lastTick = -1, lastSample = -1, lastCheck = -1;
const frameMs: number[] = [];
let first: Map<string, number> | null = null;
gc();
const heap0 = process.memoryUsage().heapUsed;
console.log('min  heapMB  stateKB  wagons  rank  gc(n/ms/max)  frame p50/p99 ms  journal');
while (w.state.tick < end) {
  if (w.state.tick !== lastTick) { lastTick = w.state.tick; for (const c of driver(w)) loop.enqueue(c); }
  const t = performance.now();
  loop.advance(FRAME);
  // the HUD reads the worst stall a few times a second (read-only)
  if (frames % 15 === 0) rankStalls(w);
  frameMs.push(performance.now() - t);
  frames++;
  if (w.state.tick % 600 === 0 && lastCheck !== w.state.tick) { lastCheck = w.state.tick; const v = [...checkInvariants(w), ...unexplainedStalls(w)]; if (v.length) viol++; }
  if (w.state.tick % (10 * 60 * TICK_HZ) === 0 && lastSample !== w.state.tick) {
    lastSample = w.state.tick;
    await new Promise((r) => setImmediate(r)); // deliver the GC entries of this stretch before the forced GC
    const gcLine = `${gcCount}/${gcMs.toFixed(0)}/${gcMax.toFixed(1)}`;
    gc();
    const s = [...frameMs].sort((a, b) => a - b);
    const m = new Map<string, number>(); sizes(w.state, '$', m);
    if (!first) first = m;
    console.log(`${String(w.state.tick / TICK_HZ / 60).padStart(3)}  ${(process.memoryUsage().heapUsed / 2 ** 20).toFixed(1).padStart(6)}  ` +
      `${(JSON.stringify(w.state).length / 1024).toFixed(0).padStart(7)}  ${String(w.state.wagons.length).padStart(6)}  ${sandboxStatus(w).rank}     ` +
      `${gcLine}  ${s[s.length >> 1]!.toFixed(2)}/${s[Math.floor(s.length * 0.99)]!.toFixed(2)}  ${loop.journal.length}`);
    frameMs.length = 0;
    if (w.state.tick === end) {
      // growth table: paths whose size grew between the first sample and now (excluding per-entity copies)
      const grow = [...m].filter(([k, n]) => (first!.get(k) ?? 0) < n).map(([k, n]) => `${k}: ${first!.get(k) ?? 0} -> ${n}`);
      console.log('grown since minute 0:\n  ' + grow.join('\n  '));
    }
  }
}
gc();
console.log(`heap start ${(heap0 / 2 ** 20).toFixed(1)} MB, end ${(process.memoryUsage().heapUsed / 2 ** 20).toFixed(1)} MB; frames ${frames}; invariant samples failing ${viol}`);
