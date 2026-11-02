// Dump mission states (m1-m6, lab) at checkpoints, with balance strategies, for bit-identity check.
import { writeFileSync, readFileSync } from 'node:fs';
import { applyCommand, createWorld, step, TICK_HZ } from '../src/sim/index';
import { plans } from './balance';
const OLD = new Set(['wood', 'planks', 'grain', 'flour', 'bread']);
function strip(v: any): any {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === 'object') {
    const isGM = 'wood' in v && 'bread' in v && 'planks' in v;
    const o: any = {};
    for (const k of Object.keys(v)) { if (isGM && !OLD.has(k)) continue; o[k] = strip(v[k]); }
    if ('rankTicks' in o && Array.isArray(o.rankTicks)) o.rankTicks = o.rankTicks.slice(0, 4);
    if ('version' in o && 'mapId' in o) o.version = 0;
    return o;
  }
  return v;
}
const out: Record<string, string[]> = {};
for (const id of ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'lab']) {
  const strats = plans[id] ?? [{ name: 'none', at: 0, cmds: () => [] }];
  for (const s of strats) {
    const w = createWorld(id);
    const snaps: string[] = [];
    while ((w.state.mission.result === 'running' || w.state.tick < 3000) && w.state.tick < 20 * 60 * TICK_HZ) {
      if (w.state.tick === s.at * TICK_HZ) for (const c of s.cmds(w)) applyCommand(w, c);
      step(w);
      if (w.state.tick % 1500 === 0) snaps.push(JSON.stringify(strip(JSON.parse(JSON.stringify(w.state)))));
    }
    snaps.push(JSON.stringify(strip(JSON.parse(JSON.stringify(w.state)))));
    out[id + '|' + s.name] = snaps;
  }
}
const f = process.argv[2]!;
if (process.argv[3] === 'compare') {
  const base = JSON.parse(readFileSync(f, 'utf8'));
  let bad = 0;
  for (const k of Object.keys(base)) {
    const a = base[k], b = out[k];
    if (!b || a.length !== b.length) { console.log('LEN DIFF', k); bad++; continue; }
    for (let i = 0; i < a.length; i++) if (a[i]!.replace('{"version":4,', '{"version":0,') !== b[i]) { console.log('DIFF', k, 'snap', i); bad++; break; }
  }
  console.log(bad ? `MISMATCH ${bad}` : `IDENTICAL ${Object.keys(base).length} runs`);
} else { writeFileSync(f, JSON.stringify(out)); console.log('saved', Object.keys(out).length); }
if (process.argv[3] === 'compare') {
  const base = JSON.parse(readFileSync(f, 'utf8'));
  const k = Object.keys(base)[0]!;
  const a: string = base[k][0], b: string = out[k]![0]!;
  let i = 0; while (a[i] === b[i]) i++;
  console.log(i, a.length, b.length, JSON.stringify(a.slice(Math.max(0,i - 300), i + 100))); console.log(JSON.stringify(b.slice(Math.max(0,i - 300), i + 100)));
}
