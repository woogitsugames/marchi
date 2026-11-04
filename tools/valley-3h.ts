// Free valley over a long session (research day 8, docs/research/2026-11-04-valley-3h.md).
// Headless, read-only use of the sim and of the UI's stall ranking; no src/ change.
//   npx tsx tools/valley-3h.ts [plan ...] [--min 180] [--seeds 1301,1302,1303] [--json out.json]
// Plans (all ordinary player commands through applyCommand, waiting for silver / stone):
//   passive      — no command at all (the starter woodcutter + sawmill sell to the castle);
//   decent       — DECENT from tools/bot-sandbox.ts, ignores every event;
//   orders       — DECENT + accepts every royal order the moment it is offered;
//   merchant     — DECENT + sells to every travelling merchant (no orders);
//   eager        — DECENT + every order + every merchant (balance-sandbox --events);
//   small        — DECENT with the fleet capped at 6 wagons (buy steps beyond that dropped);
//   eye          — DECENT, then every 30 s: worst-stall card critical with cure "wagon" -> buy a wagon
//                  (the diagnosing player once the plan is exhausted; never more than one per look).
//   Probes and counterfactuals (see PLAYERS): passive+granary / +wagon / +2wagons, small+granary /
//   +2wagons, passive|small+wagon-on-red (a wagon whenever the red card is a granary clog), grow (beer
//   expansion), greedy (a wagon a minute after the plan), orders-r1x / -r0.5x / -r0x (order renown as a
//   multiple of its silver; game: 2), decent+market7 / +market5 (market recovery 10 s -> 7 / 5 s from
//   80 min). Counterfactuals change numbers in memory only (MARKET restored, renown adjusted per tick).
// The default list (no plan named) runs every entry of PLAYERS.
// Every 10 s it samples the HUD's worst-stall card (rankStalls()[0], its cure), wagon and building
// states; every minute coins / earned / renown / rank / wagons; per 30-min band the root-cause stall
// seconds (ledger.stallSeconds deltas), plan steps done, orders and merchant income.
import { writeFileSync } from 'node:fs';
import {
  applyCommand, checkInvariants, createWorld, MARKET, RANKS, sandboxStatus, seasonAt, step, TICK_HZ,
  type BuildingStatus, type Command, type World,
} from '../src/sim/index';
import { cureFor, rankStalls } from '../src/ui/stalls';
import { DECENT, type BotStep } from './bot-sandbox';

const BAND_MIN = 30;
const buyCmd = (w: World): Command => ({ t: 'buyWagon', stable: w.state.buildings.find((b) => b.type === 'stable')!.id });
const SAMPLE_TICKS = 10 * TICK_HZ;

type Player = {
  plan: readonly BotStep[]; orders?: boolean; merchant?: boolean; eye?: boolean;
  /** Extra commands, tried once per second (sec = sim second, planDone = the plan is exhausted). */
  extra?: (w: World, sec: number, planDone: boolean) => Command[];
  /** Counterfactual (in memory only): royal-order renown as a multiple of its silver (the game: 2). */
  orderRenownX?: number;
  /** Counterfactual (in memory only): from this minute on the market recovers one saturation unit every N s. */
  recover?: { fromMin: number; seconds: number };
};

function capFleet(plan: readonly BotStep[], max: number, start = 2): BotStep[] {
  let n = start;
  return plan.filter((s) => {
    if (s.name !== 'buy wagon') return true;
    if (n >= max) return false;
    n++;
    return true;
  });
}

function growPlan(): BotStep[] {
  const i = DECENT.findIndex((s) => s.name === 'brewery') + 1;
  const put = (name: string, type: 'farm' | 'malthouse' | 'brewery', x: number, y: number): BotStep => ({ name, cmds: () => [{ t: 'place', type, x, y, facing: 2 }] });
  const W = (w: World): number => w.terrain.w;
  return [
    ...DECENT.slice(0, i),
    put('second brewery', 'brewery', 42, 25),
    put('third malthouse', 'malthouse', 38, 25),
    { name: 'extend east road', cmds: (w) => [{ t: 'road', surface: 1, cells: Array.from({ length: 11 }, (_, k) => 24 * W(w) + 72 + k) }] },
    put('beer farm', 'farm', 75, 25),
    ...DECENT.slice(i),
    { name: 'buy wagon', cmds: (w) => [buyCmd(w)] }, { name: 'buy wagon', cmds: (w) => [buyCmd(w)] },
    { name: 'buy wagon', cmds: (w) => [buyCmd(w)] }, { name: 'buy wagon', cmds: (w) => [buyCmd(w)] },
  ];
}

/** From `fromSec` on, once a minute: the worst card is a critical granary clog -> buy one wagon. */
function wagonOnRed(fromSec: number): (w: World, sec: number) => Command[] {
  return (w, sec) => {
    if (sec < fromSec || sec % 60 !== 0 || w.state.coins < 30) return [];
    const top = rankStalls(w)[0];
    if (!top?.crit) return [];
    const b = w.state.buildings.find((x) => x.id === top.id)!;
    const clog = b.status.k === 'STORAGE_FULL' || (b.status.k === 'OUTPUT_FULL' && b.status.cause === 'NO_DESTINATION');
    return clog ? [buyCmd(w)] : [];
  };
}

export const PLAYERS: Record<string, Player> = {
  passive: { plan: [] },
  decent: { plan: DECENT },
  orders: { plan: DECENT, orders: true },
  merchant: { plan: DECENT, merchant: true },
  eager: { plan: DECENT, orders: true, merchant: true },
  small: { plan: capFleet(DECENT, 6) },
  eye: { plan: DECENT, eye: true },
  // what cures the passive valley's full granary? (one action at 40 min)
  'passive+granary': { plan: [], extra: (_w, sec) => (sec === 2400 ? [{ t: 'place', type: 'warehouse', x: 40, y: 25, facing: 2 }] : []) },
  'passive+wagon': { plan: [], extra: (w, sec) => (sec === 2400 ? [buyCmd(w)] : []) },
  'passive+2wagons': { plan: [], extra: (w, sec) => (sec === 2400 ? [buyCmd(w), buyCmd(w)] : []) },
  // the small fleet that answers its critical card at 60 min with one granary / with 2 more wagons
  'small+granary': { plan: capFleet(DECENT, 6), extra: (_w, sec) => (sec === 3600 ? [{ t: 'place', type: 'warehouse', x: 71, y: 25, facing: 2 }] : []) },
  'small+2wagons': { plan: capFleet(DECENT, 6), extra: (w, sec) => (sec === 3600 ? [buyCmd(w), buyCmd(w)] : []) },
  // the player who answers a red granary card with a wagon instead (what the card should say, see report)
  'passive+wagon-on-red': { plan: [], extra: wagonOnRed(2400) },
  'small+wagon-on-red': { plan: capFleet(DECENT, 6), extra: wagonOnRed(3600) },
  // the grower: DECENT plus the beer expansion of balance-sandbox's "beer" plan (how high can the flow go?)
  grow: { plan: growPlan() },
  // counterfactual "market works" bought at 80 min: saturation recovers every 7 s / 5 s instead of 10 s
  'decent+market7': { plan: DECENT, recover: { fromMin: 80, seconds: 7 } },
  'decent+market5': { plan: DECENT, recover: { fromMin: 80, seconds: 5 } },
  // the rich player: once the plan is done, one more wagon every minute while silver lasts
  greedy: { plan: DECENT, extra: (w, sec, done) => (done && sec % 60 === 0 && w.state.coins >= 30 ? [buyCmd(w)] : []) },
  // counterfactual order renown (orders player, every order accepted)
  'orders-r1x': { plan: DECENT, orders: true, orderRenownX: 1 },
  'orders-r0.5x': { plan: DECENT, orders: true, orderRenownX: 0.5 },
  'orders-r0x': { plan: DECENT, orders: true, orderRenownX: 0 },
};

function statusKey(s: BuildingStatus): string {
  const c = (s as { cause?: string }).cause;
  return c ? `${s.k}.${c}` : s.k;
}

const inc = (m: Record<string, number>, k: string, n = 1): void => { m[k] = (m[k] ?? 0) + n; };

export interface Band {
  from: number; to: number;
  earned: number; perMin: number; renownGain: number; orderRenown: number; merchantSilver: number;
  coinsEnd: number; wagonsEnd: number; buildingsEnd: number; rankEnd: number;
  steps: string[]; eyeBuys: number;
  samples: number;
  /** Samples with any pin / a critical worst card / a critical card whose cure is a button. */
  pin: number; crit: number; critCure: number;
  /** Worst card status (key) and cure counts. */
  top: Record<string, number>; cures: Record<string, number>;
  /** Root-cause stall seconds by status key (deltas of ledger.stallSeconds). */
  roots: Record<string, number>;
  /** Wagon-sample shares: idle / moving-loaded etc. */
  wagonStates: Record<string, number>;
  /** Building samples (producers only) WORKING vs not. */
  bWorking: number; bAll: number;
  ordersDone: number; ordersOffered: number;
  minCoinsSpendable: number;
}

export interface RunOut {
  player: string; seed: number; minutes: number;
  rankMin: number[]; earned: number; coins: number; renown: number; rank: number; wagons: number; buildings: number;
  ordersDone: number; orderSilver: number; merchantSilver: number;
  planDoneMin: number; stepsDone: number; stepsTotal: number;
  perMinute: { min: number; coins: number; earned: number; renown: number; rank: number; wagons: number; flow: number; season: string }[];
  bands: Band[];
  seasonPerMin: Record<string, number>;
  longestStall: { id: number; type: string; key: string; minutes: number; atMin: number }[];
  wagonHeldMax: { key: string; seconds: number }[];
  violations: string[];
}

function newBand(from: number): Band {
  return {
    from, to: from + BAND_MIN, earned: 0, perMin: 0, renownGain: 0, orderRenown: 0, merchantSilver: 0,
    coinsEnd: 0, wagonsEnd: 0, buildingsEnd: 0, rankEnd: 0, steps: [], eyeBuys: 0, samples: 0,
    pin: 0, crit: 0, critCure: 0, top: {}, cures: {}, roots: {}, wagonStates: {}, bWorking: 0, bAll: 0,
    ordersDone: 0, ordersOffered: 0, minCoinsSpendable: Infinity,
  };
}

const PRODUCERS = new Set(['woodcutter', 'sawmill', 'farm', 'mill', 'bakery', 'fisher', 'quarry', 'charcoalBurner', 'malthouse', 'brewery']);

export function runValley(name: string, seed: number, minutes: number): RunOut {
  const p = PLAYERS[name]!;
  const w: World = createWorld('sandbox', seed);
  const st = w.state;
  const stable = st.buildings.find((b) => b.type === 'stable')!.id;
  const end = minutes * 60 * TICK_HZ;
  const plan = p.plan;
  let k = 0, planDoneMin = plan.length === 0 ? 0 : -1;
  const violations: string[] = [];
  const perMinute: RunOut['perMinute'] = [];
  const bands: Band[] = [];
  let band = newBand(0);
  let bandEarned0 = 0, bandRenown0 = 0, bandOrderSilver0 = 0, bandMerchant0 = 0, bandOrdersDone0 = 0;
  let roots0: Record<string, number> = {};
  const seasonSilver: Record<string, number> = {}, seasonTicks: Record<string, number> = {};
  const seenOrders = new Set<string>();
  const longest = new Map<number, { minutes: number; key: string; atMin: number; type: string }>();
  const wagonHeld: Record<string, number> = {};

  const closeBand = (): void => {
    const ev = st.valleyEvents!;
    band.earned = st.ledger.silverEarned - bandEarned0;
    band.perMin = band.earned / BAND_MIN;
    band.renownGain = st.town.renown - bandRenown0;
    band.orderRenown = 2 * (ev.orderSilver - bandOrderSilver0);
    band.merchantSilver = ev.merchantSilver - bandMerchant0;
    band.ordersDone = ev.ordersDone - bandOrdersDone0;
    band.coinsEnd = st.coins; band.wagonsEnd = st.wagons.length; band.buildingsEnd = st.buildings.length; band.rankEnd = st.town.rank;
    const roots: Record<string, number> = {};
    for (const [key, s] of Object.entries(st.ledger.stallSeconds)) {
      const d = s - (roots0[key] ?? 0);
      if (d > 0) inc(roots, key.split(':').slice(2).join(':') || key, d);
    }
    band.roots = roots;
    roots0 = { ...st.ledger.stallSeconds };
    bandEarned0 = st.ledger.silverEarned; bandRenown0 = st.town.renown; bandOrderSilver0 = ev.orderSilver;
    bandMerchant0 = ev.merchantSilver; bandOrdersDone0 = ev.ordersDone;
    if (band.minCoinsSpendable === Infinity) band.minCoinsSpendable = st.coins;
    bands.push(band);
  };

  const recover0 = MARKET.recoverTicks;
  try {
  while (st.tick < end) {
    if (p.recover && st.tick === p.recover.fromMin * 60 * TICK_HZ) MARKET.recoverTicks = p.recover.seconds * TICK_HZ;
    if (st.tick % TICK_HZ === 0) {
      if (k < plan.length) {
        const s = plan[k]!;
        if ((s.rank ?? 0) <= st.town.rank && (s.after ?? 0) * TICK_HZ <= st.tick) {
          let ok = true, skip = false;
          for (const c of s.cmds(w)) {
            const r = applyCommand(w, c);
            if (!r.ok) {
              ok = false;
              if (r.err.k !== 'NO_COINS' && r.err.k !== 'NO_STONE') { violations.push(`step "${s.name}" failed: ${JSON.stringify(r.err)}`); skip = true; }
              break;
            }
          }
          if (ok) band.steps.push(`${(st.tick / TICK_HZ / 60).toFixed(1)} ${s.name}`);
          if (ok || skip) { k++; if (k === plan.length) planDoneMin = st.tick / TICK_HZ / 60; }
        }
      }
      if (p.extra) for (const c of p.extra(w, st.tick / TICK_HZ, k >= plan.length)) {
        const r = applyCommand(w, c);
        if (r.ok) band.steps.push(`${(st.tick / TICK_HZ / 60).toFixed(1)} extra ${c.t}`);
        else if (r.err.k !== 'NO_COINS') violations.push(`extra ${c.t} failed: ${JSON.stringify(r.err)}`);
      }
      const ev = st.valleyEvents!;
      for (const o of ev.orders) seenOrders.has(o.id) || (seenOrders.add(o.id), band.ordersOffered++);
      if (p.orders) for (const o of ev.orders) if (!o.accepted) applyCommand(w, { t: 'orderAccept', id: o.id });
      if (p.merchant && ev.merchant) applyCommand(w, { t: 'merchantSell', id: ev.merchant.id });
    }
    if (st.tick % SAMPLE_TICKS === 0 && st.tick > 0) {
      band.samples++;
      const ranked = rankStalls(w);
      if (ranked.length) band.pin++;
      const top = ranked[0];
      if (top) {
        const b = st.buildings.find((x) => x.id === top.id)!;
        const cure = cureFor(w, b.id);
        inc(band.top, `${b.type}:${statusKey(b.status)}${top.crit ? '!' : top.minor ? '~' : ''}`);
        inc(band.cures, cure ?? 'none');
        if (top.crit) { band.crit++; if (cure) band.critCure++; }
        if (p.eye && st.tick % (30 * TICK_HZ) === 0 && planDoneMin >= 0 && top.crit && cure === 'wagon' && st.coins >= 30) {
          const r = applyCommand(w, { t: 'buyWagon', stable } as Command);
          if (r.ok) { band.eyeBuys++; band.steps.push(`${(st.tick / TICK_HZ / 60).toFixed(1)} eye: wagon (${b.type} ${statusKey(b.status)})`); }
        }
      }
      for (const wg of st.wagons) {
        const s = wg.status.k;
        const key = s === 'IDLE' ? 'idle' : (s === 'BRIDGE_JAM' || s === 'NO_ROUTE' || s === 'BRIDGE_CLOSED') ? 'held' : wg.cargoQty > 0 ? 'loaded' : 'empty';
        inc(band.wagonStates, key);
        if (key === 'held') inc(wagonHeld, s, 10);
      }
      for (const b of st.buildings) {
        if (!PRODUCERS.has(b.type)) continue;
        band.bAll++;
        if (b.status.k === 'WORKING') band.bWorking++;
        if (b.stalledTicks > 0) {
          const m = b.stalledTicks / TICK_HZ / 60;
          const prev = longest.get(b.id);
          if (!prev || m > prev.minutes) longest.set(b.id, { minutes: m, key: statusKey(b.status), atMin: st.tick / TICK_HZ / 60, type: b.type });
        }
      }
      band.minCoinsSpendable = Math.min(band.minCoinsSpendable, st.coins);
    }
    const e0 = st.ledger.silverEarned;
    const os0 = st.valleyEvents!.orderSilver;
    const season = seasonAt(st.tick);
    step(w);
    if (p.orderRenownX !== undefined && st.valleyEvents!.orderSilver !== os0) {
      // counterfactual: the order paid 2 x silver renown; take back the difference and undo a rank it bought
      st.town.renown += Math.round((p.orderRenownX - 2) * (st.valleyEvents!.orderSilver - os0));
      while (st.town.rank > 0 && st.town.renown < RANKS[st.town.rank]!.renown) {
        st.town.rankTicks[st.town.rank] = -1;
        st.town.rank--;
      }
    }
    inc(seasonSilver, season, st.ledger.silverEarned - e0);
    inc(seasonTicks, season);
    if (st.tick % (60 * TICK_HZ) === 0) {
      const v = checkInvariants(w);
      if (v.length && violations.length < 20) violations.push(`tick ${st.tick}: ${v.join('; ')}`);
      const ss = sandboxStatus(w);
      perMinute.push({ min: st.tick / TICK_HZ / 60, coins: st.coins, earned: st.ledger.silverEarned, renown: st.town.renown, rank: st.town.rank, wagons: st.wagons.length, flow: ss.flowNow, season: seasonAt(st.tick - 1) });
    }
    if (st.tick % (BAND_MIN * 60 * TICK_HZ) === 0) { closeBand(); band = newBand(st.tick / TICK_HZ / 60); }
  }
  } finally { MARKET.recoverTicks = recover0; }
  const ev = st.valleyEvents!;
  const seasonPerMin: Record<string, number> = {};
  for (const s of Object.keys(seasonSilver)) seasonPerMin[s] = seasonSilver[s]! / (seasonTicks[s]! / TICK_HZ / 60);
  return {
    player: name, seed, minutes,
    rankMin: st.town.rankTicks.map((t) => (t < 0 ? -1 : t / TICK_HZ / 60)),
    earned: st.ledger.silverEarned, coins: st.coins, renown: st.town.renown, rank: st.town.rank,
    wagons: st.wagons.length, buildings: st.buildings.length,
    ordersDone: ev.ordersDone, orderSilver: ev.orderSilver, merchantSilver: ev.merchantSilver,
    planDoneMin, stepsDone: k, stepsTotal: plan.length, perMinute, bands, seasonPerMin,
    longestStall: [...longest.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.minutes - a.minutes).slice(0, 5),
    wagonHeldMax: Object.entries(wagonHeld).map(([key, seconds]) => ({ key, seconds })),
    violations,
  };
}

const f1 = (n: number): string => n.toFixed(1);
const pct = (a: number, b: number): string => (b ? Math.round((100 * a) / b) + '%' : '—');
const topN = (m: Record<string, number>, n: number, total?: number): string =>
  Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${total ? pct(v, total) : Math.round(v)}`).join(', ') || '—';

export function summary(r: RunOut): string {
  const out: string[] = [];
  out.push(`## ${r.player} seed ${r.seed} — ${r.minutes} min`);
  out.push(`ranks (min): ${r.rankMin.slice(1).map((m) => (m < 0 ? '—' : f1(m))).join(' / ')}; earned ${r.earned}, coins ${r.coins}, renown ${r.renown}, wagons ${r.wagons}, buildings ${r.buildings}`);
  out.push(`plan ${r.stepsDone}/${r.stepsTotal} done at ${r.planDoneMin < 0 ? '—' : f1(r.planDoneMin)} min; orders ${r.ordersDone} (${r.orderSilver} sr), merchant ${r.merchantSilver} sr; violations ${r.violations.length}`);
  out.push(`season sr/min: ${Object.entries(r.seasonPerMin).map(([s, v]) => `${s} ${f1(v)}`).join(', ')}`);
  out.push('| band | sr/min | renown+ | order renown | coins end | wagons | bld | rank | steps | pin | crit | crit+cure | WORKING | wagons idle/empty/loaded/held | top card | roots (s) |');
  out.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|');
  for (const b of r.bands) {
    const ws = b.wagonStates, wt = Object.values(ws).reduce((a, c) => a + c, 0);
    out.push(`| ${b.from}–${b.to} | ${f1(b.perMin)} | ${b.renownGain} | ${b.orderRenown} | ${b.coinsEnd} | ${b.wagonsEnd} | ${b.buildingsEnd} | ${b.rankEnd} | ${b.steps.length}${b.eyeBuys ? ` (+${b.eyeBuys} eye)` : ''} | ${pct(b.pin, b.samples)} | ${pct(b.crit, b.samples)} | ${pct(b.critCure, b.samples)} | ${pct(b.bWorking, b.bAll)} | ${pct(ws.idle ?? 0, wt)}/${pct(ws.empty ?? 0, wt)}/${pct(ws.loaded ?? 0, wt)}/${pct(ws.held ?? 0, wt)} | ${topN(b.top, 3, b.samples)} | ${topN(b.roots, 3)} |`);
  }
  out.push(`longest stalls: ${r.longestStall.map((s) => `${s.type}#${s.id} ${s.key} ${f1(s.minutes)} min (at ${f1(s.atMin)})`).join('; ')}`);
  out.push(`wagon held seconds: ${r.wagonHeldMax.map((h) => `${h.key} ${h.seconds}`).join(', ') || '—'}`);
  out.push(`silver curve (earned every 10 min): ${r.perMinute.filter((p) => p.min % 10 === 0).map((p) => p.earned).join(' ')}`);
  out.push(`coins every 10 min: ${r.perMinute.filter((p) => p.min % 10 === 0).map((p) => p.coins).join(' ')}`);
  out.push(`wagons every 10 min: ${r.perMinute.filter((p) => p.min % 10 === 0).map((p) => p.wagons).join(' ')}`);
  if (r.violations.length) out.push('VIOLATIONS: ' + r.violations.slice(0, 5).join(' | '));
  return out.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (k: string): string | undefined => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const minutes = Number(opt('--min') ?? 180);
  const seeds = (opt('--seeds') ?? '1301').split(',').map(Number);
  const json = opt('--json');
  const names = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1]!.startsWith('--')));
  const list = names.length ? names : Object.keys(PLAYERS);
  const all: RunOut[] = [];
  for (const n of list) for (const s of seeds) {
    const t0 = performance.now();
    const r = runValley(n, s, minutes);
    all.push(r);
    console.log(summary(r));
    console.log(`(${((performance.now() - t0) / 1000).toFixed(1)} s wall)\n`);
  }
  if (json) writeFileSync(json, JSON.stringify(all));
  if (all.some((r) => r.violations.length)) process.exitCode = 1;
}
