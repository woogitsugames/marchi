// Replan spike measurement: npx tsx tools/perf-replan.ts [runs=5] [intervalSec=10] [cmdsPerBurst=1]
// Steady state, then a network command (road / bridge / place / demolish) every N seconds.
// Per-tick ms is split into ticks right after a netVersion change and all other ticks;
// replans per tick are counted as wagons whose pathVer jumped to the current netVersion.
import { applyCommand, step, TICK_HZ, type World } from '../src/sim/index';
import { place, validatePlace, validateRoad } from '../src/sim/commands';
import { benchWorld } from './bench';
import { polyline } from './bot';

const runs = Number(process.argv[2] ?? 5);
const every = Number(process.argv[3] ?? 10) * TICK_HZ;
const SEC = 60 * TICK_HZ;

const pct = (a: number[], p: number): number => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))]! : 0; };
const med = (a: number[]): number => pct(a, 0.5);

interface Res { calm: number[]; after: number[]; cmd: number[]; replans: number[]; replansPost: number[]; wagonsReplanned: number[]; calmRep: number[]; msPerReplan: number[] }

interface Plan { bridge: number[]; spur: number[]; site: [number, number] }

/** Pick commands that are valid on this map (found on a scratch world, same terrain and roads). */
function plan(w: World): Plan {
  let bridge: number[] | null = null;
  for (let x = 62; x < 92 && !bridge; x++) {
    const c = polyline(w, [[x, 23], [x, 45]]);
    if (validateRoad(w, c, 1).ok) bridge = c;
  }
  let spur: number[] | null = null;
  for (let x = 1; x < 94 && !spur; x++) {
    const c = polyline(w, [[x, 29], [x, 36]]);
    if (c.every((q) => !w.state.roads[q]) && validateRoad(w, c, 1).ok) spur = c;
  }
  let site: [number, number] | null = null;
  for (let y = 46; y < 58 && !site; y++) for (let x = 2; x < 90 && !site; x += 3) if (validatePlace(w, 'warehouse', x, y, 0, true).ok) site = [x, y];
  if (!bridge || !spur || !site) throw new Error('no valid scenario commands');
  return { bridge, spur, site };
}

/** 7-step cycle of network commands; the demolish steps try cells until one is free of wagons. */
function command(w: World, p: Plan, i: number): boolean {
  switch (i % 7) {
    case 0: return applyCommand(w, { t: 'road', surface: 1, cells: p.bridge }).ok;
    case 1: return applyCommand(w, { t: 'road', surface: 1, cells: p.spur }).ok;
    case 2: return place(w, 'warehouse', p.site[0], p.site[1], 0, true).ok;
    case 3: return applyCommand(w, { t: 'road', surface: 2, cells: p.spur }).ok;
    case 4: for (const c of [...p.spur].reverse()) if (applyCommand(w, { t: 'demolish', cell: c }).ok) return true; return false;
    case 5: for (const c of p.bridge) if (applyCommand(w, { t: 'demolish', cell: c }).ok) return true; return false;
    default: return applyCommand(w, { t: 'road', surface: 1, cells: p.bridge }).ok;
  }
}

function run(n: number): Res & { failed: string[] } {
  const w = benchWorld(n);
  for (let i = 0; i < SEC; i++) step(w);
  const r: Res & { failed: string[] } = { calm: [], after: [], cmd: [], replans: [], replansPost: [], wagonsReplanned: [], calmRep: [], msPerReplan: [], failed: [] };
  const p = plan(w);
  let ci = 0, sinceCmd = 1e9, burst: number[] = [];
  const total = 5 * SEC;
  for (let i = 0; i < total; i++) {
    if (i % every === 0) {
      const t0 = performance.now();
      const ok = command(w, p, ci++);
      if (!ok) r.failed.push(String(ci - 1)); else { r.cmd.push(performance.now() - t0); sinceCmd = 0; burst = []; }
    }
    const pv = w.state.wagons.map((q) => q.pathVer);
    const t0 = performance.now();
    step(w);
    const dt = performance.now() - t0;
    const nv = w.state.netVersion;
    let rep = 0;
    for (let k = 0; k < pv.length; k++) if (pv[k] !== nv && w.state.wagons[k]!.pathVer === nv) rep++;
    if (sinceCmd === 0) { r.after.push(dt); r.replans.push(rep); }
    else if (sinceCmd < 10) { r.after.push(dt); r.replansPost.push(rep); } // ticks 2..10 of the replan wave
    else { r.calm.push(dt); r.calmRep.push(rep); }
    if (rep > 0 && dt < 15) r.msPerReplan.push(dt / rep);
    if (sinceCmd < 10) burst.push(rep);
    if (sinceCmd === 9) r.wagonsReplanned.push(burst.reduce((a, b) => a + b, 0));
    sinceCmd++;
  }
  return r;
}

console.log(`assumption: cloud container, node ${process.version}, ${runs} runs; command every ${every / TICK_HZ}s; mobile ~4-6x slower`);
console.log('| wagons | ms/replan (tick-level) | calm ticks with replan / max replans | calm p50 | calm p99 | calm max | cmd-tick max (1st tick) | wave p99 (ticks 1..10) | wave max | replans 1st tick med/max | replans in 10 ticks med | cmd apply ms med | failed cmds |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const n of [50, 100, 200]) {
  const all: (Res & { failed: string[] })[] = [];
  for (let k = 0; k < runs; k++) all.push(run(n));
  const f = (g: (r: Res) => number): string => med(all.map(g)).toFixed(2);
  const first = (r: Res) => r.after.filter((_, i) => i % 10 === 0); // first tick of each wave
  const rep = all.flatMap((r) => r.replans);
  const cr = all.flatMap((r) => r.calmRep);
  console.log(`| ${n} | ${f((r) => pct(r.msPerReplan, 0.5))} | ${(cr.filter((x) => x > 0).length / cr.length * 100).toFixed(0)}% / ${Math.max(...cr)} | ${f((r) => pct(r.calm, 0.5))} | ${f((r) => pct(r.calm, 0.99))} | ${f((r) => Math.max(...r.calm))} | ${f((r) => Math.max(...first(r)))} | ${f((r) => pct(r.after, 0.99))} | ${f((r) => Math.max(...r.after))} | ${med(rep)}/${Math.max(...rep)} | ${f((r) => med(r.wagonsReplanned))} | ${f((r) => med(r.cmd))} | ${all[0]!.failed.length} |`);
}
