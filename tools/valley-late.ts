// @ts-nocheck — research tool: reads fields that exist only with docs/research/2026-11-04-valley-late-proto.patch
// Free valley late game (research 2026-11-04, docs/research/2026-11-04-valley-late-game.md): what gives the
// player a bottleneck to diagnose after ~76 min? Measures 5 prototype designs with the valley-3h bots.
// NEEDS the prototype patch (it adds the LATE toggles to src/sim; all off by default):
//   git apply docs/research/2026-11-04-valley-late-proto.patch
//   npx tsx tools/valley-late.ts [player ...] [--seeds 1301,1302,1303] [--min 180] [--json out.json] [--full]
//   git checkout src/
// Players (each: the DECENT plan from tools/bot-sandbox.ts; "+eye" = from the first minute, every 30 s, a
// critical worst-stall card with cure "wagon" buys a wagon and cure "pave" paves the held span):
//   decent / decent+eye                 — today's valley (no design);
//   A upgrade / upgrade+eye / upgrade5  — "Rozbudowa targu" at R4: 2 500 silver + 48 stone delivered to the
//                                         castle (a crown works order), then recovery 10 s -> 7 s (5 s);
//   B bigorders / bigorders+eye         — orders player, from R4 orders x3 goods; renown = silver / 2 always;
//     orders-half                       — the same without x3 (proposal 1 of the valley-3h report alone);
//   C seasonal / seasonal+eye           — the season's two wanted goods pay 150 % (no state);
//   D trade / trade+eye / trade-stone   — OBSOLETE since the real trading post (D-170, state v9): these players add
//                                         a second post on top of the map's own; kept for the record only. A trade post south of the river (castle-type market #2, own
//                                         saturation, 150 % prices) buys from R4; the player builds the road
//                                         with a wooden bridge (trade-stone: stone bridge) once the plan is done;
//   E rankdemand / rankdemand+eye       — the town grows: recovery 10 s -> 8 s at R4, 6 s at R5 (no state).
//   clog probes (proposal 2): passive+eye, small+eye — run once without and once with the cure patch.
import { writeFileSync } from 'node:fs';
import * as sim from '../src/sim/index';
import { applyCommand, lineCells, TICK_HZ, validateRoad, type Command, type World } from '../src/sim/index';
import { MISSIONS } from '../src/sim/missions';
import { DECENT } from './bot-sandbox';
import { PLAYERS, runValley, summary, type Player, type RunOut } from './valley-3h';

type Late = {
  upgradeRecoverTicks: number; bigOrderRank: number; bigOrderQtyX: number; orderRenownHalf: boolean;
  seasonalDemand: boolean; seasonPct: number; rankRecover: number[] | null; postRank: number; postPct: number;
};
const LATE = (sim as unknown as { LATE?: Late }).LATE;
if (!LATE) {
  console.error('LATE toggles missing: git apply docs/research/2026-11-04-valley-late-proto.patch first');
  process.exit(2);
}

/** Set prototype flags (and optionally the map) for one run; returns the undo. */
function flags(p: Partial<Late>, post?: { x: number; y: number }): () => () => void {
  return () => {
    const keep = { ...LATE! };
    Object.assign(LATE!, p);
    if (post) MISSIONS.sandbox!.buildings.push({ type: 'castle', x: post.x, y: post.y, facing: 2 });
    return () => {
      Object.assign(LATE!, keep);
      if (post) MISSIONS.sandbox!.buildings.pop();
    };
  };
}

// --- A: market works (2 500 silver, then 48 stone to the castle as a crown works order) ---------
const WORKS_SILVER = 2500, WORKS_STONE = 48;
function buyWorks(w: World, _sec: number, done: boolean): Command[] {
  const st = w.state, ev = st.valleyEvents!;
  if (!done || st.town.rank < 4 || st.coins < WORKS_SILVER || (st.market.level ?? 0) > 0 || ev.orders.some((o) => (o.templateId as string) === 'market_works')) return [];
  st.coins -= WORKS_SILVER;
  st.valleyEvents = {
    ...ev,
    orders: [...ev.orders, {
      id: 'works-0', templateId: 'market_works' as never, accepted: true,
      need: { stone: WORKS_STONE }, delivered: { stone: 0 }, rewardSilver: 0, rewardRenown: 0,
    }],
  };
  return [];
}

// --- D: the trade post road (x = 39 from the castle road down to the post gate at y = 57) ----------
const POST = { x: 37, y: 58 };
function tradeRoad(stone: boolean): (w: World, sec: number, done: boolean) => Command[] {
  // per world (one closure serves every seed)
  const mem = new WeakMap<World, { built: number; path: number[] }>();
  return (w, _sec, done) => {
    const st = w.state, W = w.terrain.w;
    let m = mem.get(w);
    if (!m) { m = { built: 0, path: [] }; mem.set(w, m); }
    if (!done || st.town.rank < 4) return [];
    if (m.built === 0) {
      // the terrain differs per seed: the first column from the castle road to the post gate row that is legal
      for (const x of [39, 38, 40, 37, 36, 42, 35, 43, 34, 33]) {
        const cells = [...lineCells(W, 25 * W + x, 57 * W + x), ...(x === 39 ? [] : lineCells(W, 57 * W + x, 57 * W + 39).slice(1))];
        const v = validateRoad(w, cells, 1);
        if (!v.ok && v.err.k !== 'NO_COINS') continue;
        const r = applyCommand(w, { t: 'road', surface: 1, cells });
        if (r.ok) { m.built = 1; m.path = cells; }
        break;
      }
      return [];
    }
    if (stone && m.built === 1) {
      const r = applyCommand(w, { t: 'road', surface: 2, cells: m.path.filter((c) => w.terrain.water[c]) });
      if (r.ok) m.built = 2;
    }
    return [];
  };
}

const worksWatch = (w: World): string[] => {
  const st = w.state, o = st.valleyEvents!.orders.find((x) => (x.templateId as string) === 'market_works');
  return [...(o || (st.market.level ?? 0) > 0 ? ['works bought'] : []), ...((st.market.level ?? 0) > 0 ? ['works done'] : [])];
};
const tradeWatch = (w: World): string[] => {
  const st = w.state, W = w.terrain.w;
  const out: string[] = [];
  let road = false, bridge = false;
  for (let x = 30; x < 46; x++) if (st.roads[45 * W + x]) road = true;
  for (let y = 30; y < 42; y++) for (let x = 30; x < 46; x++) if (w.terrain.water[y * W + x] && st.roads[y * W + x] === 2) bridge = true;
  if (road) out.push('road');
  // `post` exists only with the prototype patch (docs/research/2026-11-04-valley-late-proto.patch)
  if ((st.market as { post?: unknown }).post) out.push('first post sale');
  if (bridge) out.push('stone bridge');
  return out;
};
const A = flags({});
Object.assign(PLAYERS, {
  'decent+eye': { plan: DECENT, eye: true, eyeAlways: true },
  upgrade: { plan: DECENT, extra: buyWorks, setup: A, watch: worksWatch },
  'upgrade+eye': { plan: DECENT, extra: buyWorks, setup: A, eye: true, eyeAlways: true, watch: worksWatch },
  upgrade5: { plan: DECENT, extra: buyWorks, setup: flags({ upgradeRecoverTicks: 5 * TICK_HZ }), watch: worksWatch },
  'orders-half': { plan: DECENT, orders: true, setup: flags({ orderRenownHalf: true }) },
  bigorders: { plan: DECENT, orders: true, setup: flags({ orderRenownHalf: true, bigOrderRank: 4 }) },
  'bigorders+eye': { plan: DECENT, orders: true, setup: flags({ orderRenownHalf: true, bigOrderRank: 4 }), eye: true, eyeAlways: true },
  seasonal: { plan: DECENT, setup: flags({ seasonalDemand: true }) },
  'seasonal+eye': { plan: DECENT, setup: flags({ seasonalDemand: true }), eye: true, eyeAlways: true },
  trade: { plan: DECENT, extra: tradeRoad(false), setup: flags({ postRank: 4 }, POST), watch: tradeWatch },
  'trade+eye': { plan: DECENT, extra: tradeRoad(false), setup: flags({ postRank: 4 }, POST), eye: true, eyeAlways: true, watch: tradeWatch },
  'trade-stone': { plan: DECENT, extra: tradeRoad(true), setup: flags({ postRank: 4 }, POST), watch: tradeWatch },
  'trade-stone+eye': { plan: DECENT, extra: tradeRoad(true), setup: flags({ postRank: 4 }, POST), eye: true, eyeAlways: true, watch: tradeWatch },
  rankdemand: { plan: DECENT, setup: flags({ rankRecover: [100, 100, 100, 100, 80, 60] }) },
  'rankdemand+eye': { plan: DECENT, setup: flags({ rankRecover: [100, 100, 100, 100, 80, 60] }), eye: true, eyeAlways: true },
  'passive+eye': { plan: [], eye: true, eyeAlways: true },
  'small+eye': { plan: PLAYERS.small!.plan, eye: true, eyeAlways: true },
});

/** The fleet player: once the plan is done, every minute with no idle wagon and >= 30 silver buys one wagon. */
const fleet = (w: World, sec: number, done: boolean): Command[] =>
  done && sec % 60 === 0 && w.state.coins >= 30 && !w.state.wagons.some((x) => x.status.k === 'IDLE')
    ? [{ t: 'buyWagon', stable: w.state.buildings.find((b) => b.type === 'stable')!.id }] : [];
Object.assign(PLAYERS, {
  'trade125': { plan: DECENT, extra: tradeRoad(false), setup: flags({ postRank: 4, postPct: 125 }, POST), watch: tradeWatch },
  'trade125+eye': { plan: DECENT, extra: tradeRoad(false), setup: flags({ postRank: 4, postPct: 125 }, POST), eye: true, eyeAlways: true, watch: tradeWatch },
});
/** The builder: once the plan is done, the east road and N more farms (grain: 4 farms feed 2 mills + 2 malthouses). */
function farms(n: number): (w: World, sec: number, done: boolean) => Command[] {
  const mem = new WeakMap<World, number>();
  return (w, _sec, done) => {
    if (!done) return [];
    const k = mem.get(w) ?? 0, W = w.terrain.w;
    const steps: Command[] = [
      { t: 'road', surface: 1, cells: lineCells(W, 24 * W + 72, 24 * W + 82) },
      { t: 'place', type: 'farm', x: 75, y: 25, facing: 2 },
      { t: 'place', type: 'farm', x: 79, y: 25, facing: 2 },
    ].slice(0, n + 1) as Command[];
    if (k >= steps.length) return [];
    const r = applyCommand(w, steps[k]!);
    if (r.ok) mem.set(w, k + 1);
    else if (r.err.k !== 'NO_COINS') { console.log('farms step failed', JSON.stringify(r.err)); mem.set(w, k + 1); }
    return [];
  };
}
const both = (a: Player['extra'], b: Player['extra']): Player['extra'] => (w, sec, done) => [...(a?.(w, sec, done) ?? []), ...(b?.(w, sec, done) ?? [])];
/** Counterfactual R5 renown threshold (in memory; game 17 000 since D-170) around another player's setup. */
function r5(base: string, renown: number): Player {
  const p = PLAYERS[base]!;
  return { ...p, setup: () => { const undo = p.setup?.(); const keep = sim.RANKS[5]!.renown; (sim.RANKS[5] as { renown: number }).renown = renown; return () => { (sim.RANKS[5] as { renown: number }).renown = keep; undo?.(); }; } };
}
Object.assign(PLAYERS, {
  'trade125-r5x16k': r5('trade125', 16000),
  'trade125-r5x17k': r5('trade125', 17000),
  'upgrade-r5x15.5k': r5('upgrade', 15500),
  'decent+farm': { plan: DECENT, extra: farms(1) },
  'decent+2farms': { plan: DECENT, extra: farms(2) },
  'trade+2farms': { ...PLAYERS.trade!, extra: both(PLAYERS.trade!.extra, farms(2)) },
  'upgrade+2farms': { ...PLAYERS.upgrade!, extra: both(PLAYERS.upgrade!.extra, farms(2)) },
});
for (const n of Object.keys(PLAYERS)) {
  const p = PLAYERS[n]!;
  if (n.includes('+fleet') || p.plan.length === 0) continue;
  const ex = p.extra;
  PLAYERS[`${n}+fleet`] = { ...p, extra: ex ? (w, sec, done) => [...ex(w, sec, done), ...fleet(w, sec, done)] : fleet };
}

// the D players (trade*) are obsolete since the real trading post (D-170): they would add a second post to the map
const LATE_LIST = ['decent', 'decent+eye', 'upgrade', 'upgrade+eye', 'upgrade5', 'orders', 'orders-half', 'bigorders', 'bigorders+eye',
  'seasonal', 'seasonal+eye', 'rankdemand', 'rankdemand+eye',
  'decent+fleet', 'upgrade+fleet', 'bigorders+fleet', 'seasonal+fleet', 'rankdemand+fleet'];

const f1 = (n: number): string => n.toFixed(1);
const avg = (a: number[]): number => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const pct = (a: number, b: number): string => (b ? Math.round((100 * a) / b) + '%' : '—');

function table(name: string, runs: RunOut[]): string[] {
  const out: string[] = [];
  const ranks = [1, 2, 3, 4, 5].map((i) => {
    const v = runs.map((r) => r.rankMin[i] ?? -1);
    return v.some((x) => x < 0) ? (v.every((x) => x < 0) ? '—' : `${f1(avg(v.filter((x) => x >= 0)))}*`) : f1(avg(v));
  });
  const eyes = runs.map((r) => r.bands.reduce((a, b) => a + b.eyeBuys, 0));
  out.push(`| ${name} | ${ranks.join(' | ')} | ${Math.round(avg(runs.map((r) => r.earned)))} | ${Math.round(avg(runs.map((r) => r.coins)))} | ${f1(avg(runs.map((r) => r.wagons)))} | ${f1(avg(eyes))} |`);
  return out;
}

function bandsTable(name: string, runs: RunOut[]): string[] {
  const out: string[] = [];
  const nb = runs[0]!.bands.length;
  for (let i = 0; i < nb; i++) {
    const bs = runs.map((r) => r.bands[i]!);
    const s = bs.reduce((a, b) => a + b.samples, 0);
    const sum = (k: 'crit' | 'real' | 'realCure' | 'critCure'): number => bs.reduce((a, b) => a + b[k], 0);
    const top: Record<string, number> = {}, cures: Record<string, number> = {};
    for (const b of bs) {
      for (const [k, v] of Object.entries(b.top)) top[k] = (top[k] ?? 0) + v;
      for (const [k, v] of Object.entries(b.cures)) cures[k] = (cures[k] ?? 0) + v;
    }
    const topS = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${pct(v, s)}`).join(', ');
    const cureS = Object.entries(cures).filter(([k]) => k !== 'none').sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} ${pct(v, s)}`).join(', ') || '—';
    const steps = avg(bs.map((b) => b.steps.length));
    const ws = bs.reduce((acc, b) => { for (const [k, v] of Object.entries(b.wagonStates)) acc[k] = (acc[k] ?? 0) + v; return acc; }, {} as Record<string, number>);
    const wt = Object.values(ws).reduce((a, c) => a + c, 0);
    const iw: Record<string, number> = {};
    for (const b of bs) for (const [k, v] of Object.entries(b.inputWaits)) iw[k] = (iw[k] ?? 0) + v;
    const iwS = Object.entries(iw).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} ${(v / s).toFixed(2)}`).join(', ') || '—';
    out.push(`| ${name} | ${bs[0]!.from}–${bs[0]!.to} | ${f1(avg(bs.map((b) => b.perMin)))} | ${f1(steps)} | ${pct(sum('crit'), s)} | ${pct(sum('real'), s)} | ${pct(sum('realCure'), s)} | ${pct(ws.idle ?? 0, wt)} | ${pct(ws.held ?? 0, wt)} | ${topS} | ${cureS} | ${iwS} |`);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (k: string): string | undefined => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const minutes = Number(opt('--min') ?? 180);
  const seeds = (opt('--seeds') ?? '1301,1302,1303').split(',').map(Number);
  const json = opt('--json');
  const full = args.includes('--full');
  const names = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1]!.startsWith('--')));
  const list = names.length ? names : LATE_LIST;
  const all: Record<string, RunOut[]> = {};
  for (const n of list) {
    all[n] = [];
    for (const s of seeds) {
      const r = runValley(n, s, minutes);
      all[n].push(r);
      if (full) console.log(summary(r) + '\n');
      if (r.violations.length) console.log(`VIOLATIONS ${n} ${s}: ${r.violations.slice(0, 3).join(' | ')}`);
    }
    const keys = [...new Set(all[n].flatMap((r) => Object.keys(r.marks)))];
    if (keys.length) console.log(`${n} marks: ${keys.map((k) => `${k} ${all[n]!.map((r) => (r.marks[k] === undefined ? '—' : String(r.marks[k]))).join('/')}`).join('; ')}`);
  }
  console.log(`seeds ${seeds.join(',')}, ${minutes} min; ranks = mean minute (* = not every seed)`);
  console.log('| player | R1 (8–12) | R2 (20–30) | R3 (40–50) | R4 (70–90) | R5 (105–135) | silver | coins | wagons | eye acts |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const n of list) console.log(table(n, all[n]!).join('\n'));
  console.log('\n| player | band | sr/min | steps | crit | real | real+cure | wagons idle | held | worst card (share) | cure offered | input waits (consumers) |');
  console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|');
  for (const n of list) console.log(bandsTable(n, all[n]!).join('\n'));
  if (json) writeFileSync(json, JSON.stringify(all));
}
