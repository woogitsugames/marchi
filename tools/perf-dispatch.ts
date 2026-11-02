// Dispatch-tick spike profiler: npx tsx tools/perf-dispatch.ts [scenario ...]
// scenarios: bench50 bench100 bench200 m1 m5 m9 sandbox (default: all)
// Does NOT touch src/: it copies src/ + tools/ to a temp dir, patches timers into the COPY of
// logistics.ts / network.ts / sim.ts (same logic, only performance.now() around it) and runs the
// scenarios there. `PERF_VERIFY=1` additionally checks that patched and original sims end in the
// same state hash (the patch must not change behaviour).
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function patch(file: string, subs: [string | RegExp, string][], optional = false): void {
  let s = readFileSync(file, 'utf8');
  for (const [a, b] of subs) {
    const next = typeof a === 'string' ? s.split(a).join(b) : s.replace(a, b);
    if (next === s && optional) continue;
    if (next === s) throw new Error(`patch miss in ${file}: ${String(a)}`);
    s = next;
  }
  writeFileSync(file, s);
}

function build(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(join(root, 'src'), join(dir, 'src'), { recursive: true });
  cpSync(join(root, 'tools'), join(dir, 'tools'), { recursive: true });
  for (const f of ['tsconfig.json', 'tsconfig.sim.json', 'package.json']) if (existsSync(join(root, f))) cpSync(join(root, f), join(dir, f));
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'));
  const P = 'const __P = (globalThis as any).__P;\n';
  patch(join(dir, 'src/sim/sim.ts'), [
    ['export function step(world: World): void {',
      P + 'export function step(world: World): void {\n  __P.begin(world.state.tick); const __t0 = performance.now();\n  stepI(world);\n  __P.end(performance.now() - __t0);\n}\nfunction stepI(world: World): void {'],
    ['  stepWagons(world);', '  __P.m0(); stepWagons(world); __P.m("wagons");'],
    ['dispatch(world);', '{ __P.m0(); dispatch(world); __P.m("dispatch"); }'],
    ['  checkMission(world);\n  stepTown(world);', '  __P.m0(); checkMission(world); stepTown(world); __P.m("mission+town");'],
  ]);
  patch(join(dir, 'src/sim/network.ts'), [
    ['export function findPath(', P + 'export function findPath(world: World, from: number, to: number, loaded: boolean): number[] | null {\n  const t0 = performance.now();\n  const r = findPathI(world, from, to, loaded);\n  __P.fp(performance.now() - t0);\n  return r;\n}\nfunction findPathI('],
  ]);
  patch(join(dir, 'src/sim/logistics.ts'), [
    ['export function dispatch(world: World): void {',
      P + 'export function dispatch(world: World): void {\n  __P.d0();\n  dispatchI(world);\n  __P.m("diagnose");\n}\nfunction dispatchI(world: World): void {\n  __P.m0();'],
    ['const sourcesOf = ', '__P.m("demands");\n  const sourcesOf = '],
    ['  // --- market (free valley)', '  __P.m("assign");\n  // --- market (free valley)'],
    ['  // --- surplus:', '  __P.m("market");\n  // --- surplus:'],
    ['  diagnose(world, unmet, pushFail, dc);', '  __P.m("surplus");\n  diagnose(world, unmet, pushFail, dc);'],
    ['m = dijkstra(this.world, node, false, true);', 'm = __P.dj(0, node, () => dijkstra(this.world, node, false, true));'],
    ['m = dijkstra(this.world, node, true, false);', 'm = __P.dj(1, node, () => dijkstra(this.world, node, true, false));'],
    ['wagon.pathVer = -1; // replan at the next node', 'wagon.pathVer = -1; __P.jobs++;'],
  ]);
  // count assign-phase Dijkstras run with no free wagon (pre-fix code only; after fix A there are none)
  patch(join(dir, 'src/sim/logistics.ts'), [
    ['const t = dc.from(s.gate).dist[d.b.gate]!;', '__P.fz0 = free.length === 0; const t = dc.from(s.gate).dist[d.b.gate]!; __P.fz0 = false;'],
  ], true);
  const variants = (process.env.PERF_VARIANT ?? '').split(',');
  // Both candidate fixes are in src/ since 2026-11-02 (releaseDistMap, reachable); the variants
  // below only patch an older checkout that does not have them yet.
  const srcNet = readFileSync(join(dir, 'src/sim/network.ts'), 'utf8');
  if (variants.includes('pool') && srcNet.includes('releaseDistMap')) console.error('PERF_VARIANT pool: already in src/, ignored');
  else if (variants.includes('pool')) {
    // candidate fix A: recycle the per-dispatch distance maps (no behaviour change, only allocation)
    patch(join(dir, 'src/sim/network.ts'), [
      ['const dist = reuse ? sc.dist.fill(Infinity) : new Float64Array(n).fill(Infinity);', 'const dist = reuse ? sc.dist.fill(Infinity) : takeF64(n).fill(Infinity);'],
      ['const prev = reuse ? sc.prev.fill(-1) : new Int32Array(n).fill(-1);', 'const prev = reuse ? sc.prev.fill(-1) : takeI32(n).fill(-1);'],
      ['export interface DistMap {', 'const poolF: Float64Array[] = [], poolI: Int32Array[] = [];\nfunction takeF64(n: number): Float64Array { const a = poolF.pop(); return a && a.length === n ? a : new Float64Array(n); }\nfunction takeI32(n: number): Int32Array { const a = poolI.pop(); return a && a.length === n ? a : new Int32Array(n); }\nexport function releaseMap(m: DistMap): void { poolF.push(m.dist); poolI.push(m.prev); }\nexport interface DistMap {'],
    ]);
    patch(join(dir, 'src/sim/logistics.ts'), [
      ["dijkstra, hasEdge,", "releaseMap, dijkstra, hasEdge,"],
      ['  constructor(private world: World) {}', '  constructor(private world: World) {}\n  release(): void { for (const m of this.fwd.values()) releaseMap(m); for (const m of this.rev.values()) releaseMap(m); this.fwd.clear(); this.rev.clear(); }'],
      ['  diagnose(world, unmet, pushFail, dc);', '  diagnose(world, unmet, pushFail, dc);\n  dc.release();'],
    ]);
  }
  if (variants.includes('free0') && srcNet.includes('export function reachable(')) console.error('PERF_VARIANT free0: already in src/, ignored');
  else if (variants.includes('free0')) {
    // candidate fix B: with no free wagon only reachability matters (nothing can be assigned), so
    // answer it from connected-component labels (built once per netVersion) instead of a full Dijkstra
    patch(join(dir, 'src/sim/network.ts'), [
      ['export interface DistMap {', `const compCache = new WeakMap<object, Int32Array>();
export function reachable(world: World, a: number, b: number): boolean {
  const c = net(world);
  let comp = compCache.get(c);
  if (!comp) {
    const w = world.terrain.w, n = w * world.terrain.h;
    comp = new Int32Array(n).fill(-1);
    const stack: number[] = [];
    for (let i = 0; i < n; i++) {
      if (comp[i] !== -1 || !world.state.roads[i]) continue;
      comp[i] = i; stack.push(i);
      while (stack.length) {
        const u = stack.pop()!;
        const ux = u % w, uy = (u - ux) / w;
        for (let d = 0; d < 8; d++) {
          if (!c.edgeMask[u * 8 + d]) continue;
          const v = (uy + DY[d]!) * w + ux + DX[d]!;
          if (comp[v] === -1) { comp[v] = i; stack.push(v); }
        }
      }
    }
    compCache.set(c, comp);
  }
  return comp[a] !== -1 && comp[a] === comp[b];
}
export interface DistMap {`],
    ]);
    const chk = (expr: string, real: string): string => process.env.PERF_CHECK
      ? `(() => { const r = ${expr}; if ((r < Infinity) !== (${real} < Infinity)) throw new Error('reachability mismatch'); return r; })()` : expr;
    patch(join(dir, 'src/sim/logistics.ts'), [
      ["dijkstra, hasEdge,", "reachable, dijkstra, hasEdge,"],
      ['__P.fz0 = free.length === 0; const t = dc.from(s.gate).dist[d.b.gate]!; __P.fz0 = false;',
        'const t = free.length === 0 ? (' + chk('(reachable(world, s.gate, d.b.gate) ? 0 : Infinity)', 'dc.from(s.gate).dist[d.b.gate]!') + ') : dc.from(s.gate).dist[d.b.gate]!;'],
      ['const fwd = dc.from(b.gate);', 'const fwd = free.length === 0 ? null : dc.from(b.gate);'],
      ['const t = fwd.dist[wh.gate]!;', 'const t = fwd === null ? (' + chk('(reachable(world, b.gate, wh.gate) ? 0 : Infinity)', 'dc.from(b.gate).dist[wh.gate]!') + ') : fwd.dist[wh.gate]!;'],
    ]);
  }
}

// ---------------------------------------------------------------- measurement (runs in the copy)
interface Rec { djFree0: number; djPh: Record<string, number>; djSame: number; tick: number; total: number; ph: Record<string, number>; dj: number; djN: number; djFwd: number; djRev: number; fp: number; fpN: number; jobs: number; disp: boolean }
const pct = (a: number[], p: number): number => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))]! : 0; };
const f2 = (x: number): string => x.toFixed(2);

function installProbe(): { recs: Rec[]; reset: () => void } {
  const recs: Rec[] = [];
  let cur: Rec | null = null, last = 0, inDisp = false;
  const P = {
    jobs: 0,
    begin(tick: number) { cur = { djFree0: 0, djPh: {}, djSame: 0, tick, total: 0, ph: {}, dj: 0, djN: 0, djFwd: 0, djRev: 0, fp: 0, fpN: 0, jobs: 0, disp: false }; P.jobs = 0; },
    end(ms: number) { if (cur) { cur.total = ms; cur.jobs = P.jobs; recs.push(cur); } cur = null; },
    m0() { last = performance.now(); },
    phase: 'demands', fz0: false,
    last: new Map<string, number>(),
    m(name: string) { P.phase = ({ demands: 'assign', assign: 'market', market: 'surplus', surplus: 'diagnose' } as Record<string, string>)[name] ?? P.phase; const n = performance.now(); if (cur) { const key = inDisp ? 'd.' + name : name; cur.ph[key] = (cur.ph[key] ?? 0) + (n - last); } last = n; if (name === 'dispatch') inDisp = false; },
    d0() { inDisp = true; if (cur) cur.disp = true; },
    dj(dir: 0 | 1, node: number, f: () => unknown) {
      const t0 = performance.now(); const r = f() as { dist: Float64Array };
      if (cur) {
        cur.dj += performance.now() - t0; cur.djN++; if (dir) cur.djRev++; else cur.djFwd++;
        if (P.fz0 && P.phase === 'assign') cur.djFree0++;
        cur.djPh[P.phase] = (cur.djPh[P.phase] ?? 0) + 1;
        // identical result vs the same (start, direction) in the previous dispatch => a cross-dispatch cache would hit
        let sum = 0, cnt = 0; for (let i = 0; i < r.dist.length; i++) { const v = r.dist[i]!; if (v !== Infinity) { sum += v; cnt++; } }
        const key = `${dir}:${node}`, ck = sum * 31 + cnt;
        if (P.last.get(key) === ck) cur.djSame++;
        P.last.set(key, ck);
      }
      return r;
    },

    fp(ms: number) { if (cur) { cur.fp += ms; cur.fpN++; } },
  };
  (globalThis as any).__P = P;
  return { recs, reset: () => { recs.length = 0; } };
}

async function main(): Promise<void> {
  const probe = installProbe();
  const sim = await import(join(process.cwd(), 'src/sim/index.ts'));
  const { benchWorld } = await import(join(process.cwd(), 'tools/bench.ts'));
  const { plans, runStrategy } = await import(join(process.cwd(), 'tools/balance.ts'));
  const { runSandbox, DECENT } = await import(join(process.cwd(), 'tools/bot-sandbox.ts'));
  const { runProposed, STRATEGIES } = await import(join(process.cwd(), 'tools/bot-missions-7-9.ts'));
  const TICK_HZ: number = sim.TICK_HZ;
  const want = process.argv.slice(2);
  const all = ['bench50', 'bench100', 'bench200', 'm1', 'm5', 'm9', 'sandbox'];
  const scen = want.length ? want : all;
  const rows: string[] = [], phRows: string[] = [], fnRows: string[] = [];
  const PH = ['d.demands', 'd.assign', 'd.market', 'd.surplus', 'd.diagnose'];
  const RUNS = Number(process.env.PERF_RUNS ?? 3);
  for (const name of scen) {
    const pooled: Rec[] = [];
    let wagons = 0, cells = 0, buildings = 0, warm = 0;
    for (let run = 0; run < RUNS; run++) {
    probe.reset();
    if (name.startsWith('bench')) {
      const w = benchWorld(Number(name.slice(5)));
      for (let i = 0; i < 60 * TICK_HZ; i++) sim.step(w);
      warm = probe.recs.length; // drop warm-up
      for (let i = 0; i < 4 * 60 * TICK_HZ; i++) sim.step(w);
      wagons = w.state.wagons.length; cells = w.terrain.w * w.terrain.h; buildings = w.state.buildings.length;
    } else if (name === 'm1') { runStrategy('m1', plans.m1![2]!); }
    else if (name === 'm5') { runStrategy('m5', plans.m5![4]!); }
    else if (name === 'm9') { runProposed('m9', STRATEGIES.m9[2]!); }
    else if (name === 'sandbox') { runSandbox(DECENT, 60, { checkEvery: 1000 }); }
    pooled.push(...probe.recs.slice(warm));
    }
    const rs = pooled;
    const D = rs.filter((r) => r.disp), N = rs.filter((r) => !r.disp);
    const dt = D.map((r) => r.total), nt = N.map((r) => r.total);
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const frac = (g: (r: Rec) => number) => f2(avg(D.map(g)));
    rows.push(`| ${name} | ${rs.length} | ${D.length} | ${f2(pct(dt, 0.5))} / ${f2(pct(dt, 0.95))} / ${f2(pct(dt, 0.99))} / ${f2(Math.max(...dt))} | ${f2(pct(nt, 0.5))} / ${f2(pct(nt, 0.95))} / ${f2(Math.max(...nt))} | ${frac((r) => r.dj)} (${(avg(D.map((r) => r.dj)) / avg(dt) * 100).toFixed(0)}%) | ${f2(avg(D.map((r) => r.djN)))} / ${Math.max(...D.map((r) => r.djN))} | ${f2(avg(D.map((r) => r.djFwd)))} / ${f2(avg(D.map((r) => r.djRev)))} | ${['assign', 'market', 'surplus', 'diagnose'].map((k) => f2(avg(D.map((r) => r.djPh[k] ?? 0)))).join(' / ')} | ${(D.reduce((a, r) => a + r.djSame, 0) / Math.max(1, D.reduce((a, r) => a + r.djN, 0)) * 100).toFixed(0)}% | ${f2(avg(D.map((r) => r.djFree0)))} | ${frac((r) => r.fp)} / ${f2(avg(D.map((r) => r.fpN)))} | ${f2(avg(D.map((r) => r.jobs)))} / ${Math.max(...D.map((r) => r.jobs))} | ${f2(avg(dt) * 1)} |`);
    const cell = (k: string) => { const v = D.map((r) => r.ph[k] ?? 0); return `${f2(pct(v, 0.5))} / ${f2(pct(v, 0.95))} / ${f2(Math.max(...v))}`; };
    const dsum = D.map((r) => PH.reduce((a, k) => a + (r.ph[k] ?? 0), 0));
    phRows.push(`| ${name} | ${PH.map(cell).join(' | ')} | ${f2(pct(dsum, 0.5))} / ${f2(pct(dsum, 0.95))} / ${f2(Math.max(...dsum))} | ${cell('wagons')} |`);
    // worst 3 dispatch ticks: what made them slow
    const worst = [...D].sort((a, b) => b.total - a.total).slice(0, 3);
    for (const r of worst) fnRows.push(`| ${name} | ${r.tick} | ${f2(r.total)} | ${f2(PH.reduce((a, k) => a + (r.ph[k] ?? 0), 0))} | ${f2(r.dj)} (${r.djN}) | ${f2(r.fp)} (${r.fpN}) | ${r.jobs} | ${f2(r.ph['wagons'] ?? 0)} |`);
    if (name.startsWith('bench')) rows[rows.length - 1] += ` wagons=${wagons} cells=${cells} buildings=${buildings}`;
  }
  console.log('## per scenario (dispatch ticks; ms p50 / p95 / max)');
  console.log('| scenario | ticks | dispatch ticks | dispatch-tick total p50/p95/p99/max | other ticks total | dijkstra ms avg (share) | dijkstra calls avg / max | fwd / rev avg | calls per phase assign/market/surplus/diagnose | same result as previous dispatch | assign-phase calls with 0 free wagons | findPath ms / calls (same tick) | jobs assigned avg / max | avg ms |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  console.log(rows.join('\n'));
  console.log('\n## phases inside dispatch (ms p50 / p95 / max)');
  console.log('| scenario | demands+sort | assign loop (cand. search + pickWagon) | market | surplus push | diagnose | dispatch total | stepWagons (same tick) |');
  console.log('|---|---|---|---|---|---|---|---|');
  console.log(phRows.join('\n'));
  console.log('\n## worst 3 dispatch ticks per scenario');
  console.log('| scenario | tick | step ms | dispatch ms | dijkstra ms (n) | findPath ms (n) | jobs | stepWagons ms |');
  console.log('|---|---|---|---|---|---|---|---|');
  console.log(fnRows.join('\n'));
  if (process.env.PERF_HASHES) {
    // state-hash digest over many scenarios: must be identical for the original sim and any variant
    const out: string[] = [];
    const mix = (h: string) => out.push(h);
    for (const n of [50, 100, 200]) { const w = benchWorld(n); for (let i = 1; i <= 3000; i++) { sim.step(w); if (i % 500 === 0) mix(sim.stateHash(w)); } }
    for (const id of Object.keys(plans)) for (const st of plans[id]) {
      const w = sim.createWorld(id);
      while (w.state.mission.result === 'running') {
        if (w.state.tick === st.at * TICK_HZ) for (const c of st.cmds(w)) sim.applyCommand(w, c);
        sim.step(w);
        if (w.state.tick % 600 === 0) mix(sim.stateHash(w));
      }
      mix(sim.stateHash(w));
    }
    runSandbox(DECENT, 60, { checkEvery: 1000, onTick: (w: any) => { if (w.state.tick % 3000 === 0) mix(sim.stateHash(w)); } });
    const { hashString } = await import(join(process.cwd(), 'src/sim/hash.ts'));
    console.log(`DIGEST ${out.length} hashes ${hashString(out.join(','))}`);
    // missions VII-IX (bot-missions-7-9 strategies, same command timing as runProposed): separate
    // digest so the line above stays comparable with the 2026-11-02 research baseline
    const { withProposal } = await import(join(process.cwd(), 'tools/bot-missions-7-9.ts'));
    const out2: string[] = [];
    for (const id of Object.keys(STRATEGIES)) for (const s of STRATEGIES[id]) {
      withProposal(id, () => {
        const w = sim.createWorld(id);
        let setupDone = false, executed = false;
        while (w.state.mission.result === 'running' && w.state.tick <= 25 * 60 * TICK_HZ) {
          if (s.setup && !setupDone && w.state.tick >= s.setup.after * TICK_HZ) { for (const c of s.setup.cmds(w)) sim.applyCommand(w, c); setupDone = true; }
          if (!executed && w.state.tick >= s.after * TICK_HZ && (s.whenStone === undefined || sim.stoneAvailable(w) >= s.whenStone)) { for (const c of s.cmds(w)) sim.applyCommand(w, c); executed = true; }
          sim.step(w);
          if (w.state.tick % 600 === 0) out2.push(sim.stateHash(w));
        }
        out2.push(sim.stateHash(w));
      });
    }
    console.log(`DIGEST789 ${out2.length} hashes ${hashString(out2.join(','))}`);
  }
}

if (process.env.PERF_DISPATCH_CHILD) {
  main().catch((e) => { console.error(e); process.exit(1); });
} else {
  const dir = process.env.PERF_DIR ?? join(tmpdir(), 'marchia-perf-dispatch');
  build(dir);
  const r = spawnSync('npx', ['tsx', 'tools/perf-dispatch.ts', ...process.argv.slice(2)], { cwd: dir, stdio: 'inherit', env: { ...process.env, PERF_DISPATCH_CHILD: '1' } });
  process.exit(r.status ?? 1);
}
