// Contract pace forecast (finding F10): "at this pace the order is done in M:SS, worth N seals".
// A slower supply is not a stall (design/seasons.md §3), so no building carries a StallReason for
// it; the waybill and the castle card read this instead. Read-only on the state: the pace log is
// owned by the caller (the UI samples it every tick), never part of SimState, never hashed.
import { BUILDINGS, GOODS, LOAD_TICKS, TICK_HZ, UNLOAD_TICKS, outputGoods } from './defs';
import { contractsOf } from './contract';
import { wagonEta } from './diagnose';
import { buildingById } from './logistics';
import { findPath, pathTime, type World } from './network';
import { cycleTicks } from './seasons';
import type { BuildingType, Good, GoodMap } from './types';

/** One sample every 10 s of game time; the pace is measured over the last two minutes. */
export const PACE_SAMPLE_TICKS = 10 * TICK_HZ;
export const PACE_WINDOW_TICKS = 120 * TICK_HZ;
/** No forecast before one minute of samples (start-up stock and the first trips distort it). */
export const PACE_MIN_TICKS = 60 * TICK_HZ;

/**
 * Cumulative `ledger.produced` per good (GOODS order) at sampled ticks, oldest first, plus the
 * first sample ever taken (the long-run pace: a burst of stalls inside the window does not make
 * the forecast panic while the long run says otherwise).
 */
export interface PaceLog {
  ticks: number[];
  produced: number[][];
  firstTick: number;
  first: number[];
}

export function newPaceLog(): PaceLog {
  return { ticks: [], produced: [], firstTick: -1, first: [] };
}

/**
 * Record the ledger at most once per PACE_SAMPLE_TICKS and drop samples older than PACE_WINDOW_TICKS.
 * Mutates only `log`. A tick lower than the last sample (load, restart) starts the log afresh.
 */
export function samplePace(log: PaceLog, world: World): void {
  const tick = world.state.tick;
  const n = log.ticks.length;
  if (n > 0 && tick < log.ticks[n - 1]!) { log.ticks.length = 0; log.produced.length = 0; log.firstTick = -1; }
  const m = log.ticks.length;
  if (m > 0 && tick - log.ticks[m - 1]! < PACE_SAMPLE_TICKS) return;
  const p = world.state.ledger.produced;
  const row = GOODS.map((g) => p[g]);
  if (log.firstTick < 0) { log.firstTick = tick; log.first = row; }
  log.ticks.push(tick);
  log.produced.push(row);
  while (log.ticks.length > 1 && tick - log.ticks[0]! > PACE_WINDOW_TICKS) { log.ticks.shift(); log.produced.shift(); }
}

export interface GoodPace {
  good: Good;
  need: number;
  /** In the castle (capped at need). */
  have: number;
  /** Still to be made: need − castle stock − on the way − spare stock at producers (≥ 0). */
  toMake: number;
  /**
   * Made per minute (−1: not enough samples): the better of the last two minutes and the long run
   * since the log began, so a fix shows within the window and a passing dip does not.
   */
  perMin: number;
  /** Most the producers can make per minute at full work (season-adjusted). */
  capPerMin: number;
  producers: number;
  /** Type of the first producer (the card names it), null when nobody makes the good. */
  producerType: BuildingType | null;
  /** Lowest producer id, −1 when none. */
  producer: number;
  /** Ticks from now until this good is complete in the castle; −1 = cannot tell. */
  etaTicks: number;
}

export interface ContractForecast {
  /** The log spans PACE_MIN_TICKS and every unfinished good has a pace and a route. */
  ready: boolean;
  /** Tick at which the whole order would be in the castle at this pace (−1 when not ready). */
  finishTick: number;
  /** Seals that finish would earn (0 = after the deadline, −1 when not ready). */
  seals: number;
  goods: GoodPace[];
  /** Index in `goods` of the good that finishes last (−1 when none is pending). */
  bottleneck: number;
  /**
   * The next better outcome still in reach: by `byTick`, the bottleneck good needs `perMin`.
   * Null when the forecast already earns three seals or nothing better is reachable.
   */
  aim: { seals: number; byTick: number; perMin: number } | null;
}

/** Seconds → ticks of the quickest loaded trip from a producer to the castle, plus load/unload. */
function tripTicks(world: World, from: number, to: number): number {
  const p = findPath(world, from, to, true);
  if (!p) return -1;
  return Math.round(pathTime(world, from, p, true) * TICK_HZ) + LOAD_TICKS + UNLOAD_TICKS;
}

/** Ticks until the last wagon now bringing `g` to `castle` has unloaded (−1 if one has no route). */
function lastDelivery(world: World, castle: number, g: Good): number {
  let last = 0;
  for (const w of world.state.wagons) {
    if (!w.job || w.job.to !== castle || w.job.good !== g) continue;
    const e = wagonEta(world, w.id);
    if (!e) return -1;
    last = Math.max(last, Math.round(e.toFinish * TICK_HZ));
  }
  return last;
}

/** Input per unit of `g` in its producer's recipe (wood per plank = 1/2), 0 when not an input. */
function inputPerUnit(type: BuildingType | null, input: Good, g: Good): number {
  const r = type ? BUILDINGS[type].recipe : null;
  if (!r) return 0;
  return (r.inputs[input] ?? 0) / (r.outputs[g] ?? 1);
}

/**
 * Two ordered goods made from one raw input (mission IX: planks and charcoal from wood). Each one's
 * own pace is its share of that input *now*; once the other is done, the whole supply goes to it.
 * The pool's view: all the input both still need, at the input's measured pace, bounded below by
 * the good's own producers working flat out. −1 when the good shares no input with another order.
 */
function pooledTicks(goods: GoodPace[], lags: number[], i: number, perMinOf: (gi: number) => number): number {
  const gp = goods[i]!;
  const r = gp.producerType ? BUILDINGS[gp.producerType].recipe : null;
  if (!r || gp.capPerMin <= 0) return -1;
  let best = -1;
  for (let ri = 0; ri < GOODS.length; ri++) {
    const input = GOODS[ri]!;
    if (!(r.inputs[input] ?? 0)) continue;
    let demand = 0, shared = false, lag = lags[i]!;
    for (let k = 0; k < goods.length; k++) {
      const per = inputPerUnit(goods[k]!.producerType, input, goods[k]!.good);
      if (per <= 0 || goods[k]!.toMake <= 0) continue;
      if (k !== i) shared = true;
      demand += goods[k]!.toMake * per;
      lag = Math.max(lag, lags[k]!);
    }
    const pace = perMinOf(ri);
    if (!shared || pace <= 0 || lag < 0) continue;
    const pool = Math.round(demand * 60 * TICK_HZ / pace) + lag;
    const flatOut = Math.round(gp.toMake * 60 * TICK_HZ / gp.capPerMin) + lags[i]!;
    const t = Math.max(pool, flatOut);
    if (t > best) best = t;
  }
  return best;
}

function sealsAt(world: World, tick: number): number {
  const c = world.state.mission.contract!;
  const base = tick <= c.star3Tick ? 3 : tick <= c.star2Tick ? 2 : tick <= c.deadlineTick ? 1 : 0;
  if (base === 0) return 0;
  let missed = 0;
  for (const k of contractsOf(world.state.mission)) for (const t of k.tranches) if (t.missed) missed++;
  return Math.max(1, base - missed);
}

/** Everything the castle must hold once tranche `i` is complete (tranches add up in order). */
export function trancheNeed(world: World, i: number): GoodMap | null {
  const c = world.state.mission.contract;
  if (!c || i < 0 || i >= c.tranches.length) return null;
  const out = Object.fromEntries(GOODS.map((g) => [g, 0])) as GoodMap;
  for (let k = 0; k <= i; k++) for (const g of GOODS) out[g] += c.tranches[k]!.need[g];
  return out;
}

/**
 * Forecast of the running contract from the state and a pace log (see samplePace). Pure: reads
 * the world, never writes it. Null without a running contract. `need` narrows the order to a part
 * of it (a tranche: see trancheNeed); `finishTick` is then when that part is in the castle, and
 * `seals` / `aim` still describe the whole contract's clock (the caller compares with the tranche's
 * own deadline instead; `aim` is null).
 */
export function contractForecast(world: World, log: PaceLog, needOf: GoodMap | null = null): ContractForecast | null {
  const st = world.state;
  const c = st.mission.contract;
  if (!c || st.mission.result !== 'running') return null;
  const castle = buildingById(world, c.castle);
  if (!castle) return null;
  // two castles (D-290): the whole order is every castle's together (stock, promised goods, the farthest drive);
  // the finish is the last castle's whatever the split. One castle (or a narrowed order): the main castle alone.
  const castles = needOf || !st.mission.extraContracts ? [castle]
    : contractsOf(st.mission).map((k) => buildingById(world, k.castle)).filter((b): b is NonNullable<typeof b> => !!b);
  const needAll = (g: Good): number => (needOf ? needOf[g] : castles.length > 1 ? contractsOf(st.mission).reduce((a, k) => a + k.need[g], 0) : c.need[g]);
  const stockOf = (g: Good): number => castles.reduce((a, b) => a + b.stock[g], 0);
  const incomingOf = (g: Good): number => castles.reduce((a, b) => a + b.incoming[g], 0);
  const n = log.ticks.length;
  const span = n > 1 ? log.ticks[n - 1]! - log.ticks[0]! : 0;
  const enough = span >= PACE_MIN_TICKS;
  const perMinOf = (gi: number): number => {
    if (!enough) return -1;
    const now = log.produced[n - 1]![gi]!;
    let v = (now - log.produced[0]![gi]!) * 60 * TICK_HZ / span;
    const longSpan = log.ticks[n - 1]! - log.firstTick;
    if (longSpan > span) v = Math.max(v, (now - log.first[gi]!) * 60 * TICK_HZ / longSpan);
    return v;
  };
  const goods: GoodPace[] = [];
  const lags: number[] = [], shorts: number[] = [];
  for (let gi = 0; gi < GOODS.length; gi++) {
    const g = GOODS[gi]!;
    const need = needAll(g);
    if (need <= 0) continue;
    let spare = 0, producers = 0, producer = -1, cap = 0, lag = -1;
    let producerType: BuildingType | null = null;
    for (const p of st.buildings) {
      if (!outputGoods(p.type).includes(g)) continue;
      const r = BUILDINGS[p.type].recipe!;
      producers++;
      if (producer < 0) { producer = p.id; producerType = p.type; }
      spare += p.stock[g] - p.reservedOut[g];
      cap += (r.outputs[g] ?? 0) * 60 * TICK_HZ / cycleTicks(world, p.type, r.ticks);
      for (const q of castles) {
        const trip = tripTicks(world, p.gate, q.gate);
        if (trip >= 0 && (lag < 0 || trip < lag)) lag = trip;
      }
    }
    const short = need - stockOf(g);
    const toMake = Math.max(0, short - incomingOf(g) - spare);
    goods.push({ good: g, need, have: Math.min(stockOf(g), need), toMake, perMin: perMinOf(gi), capPerMin: cap, producers, producerType, producer, etaTicks: 0 });
    lags.push(lag);
    shorts.push(short);
  }
  let ready = enough, worst = -1, worstTicks = -1;
  for (let i = 0; i < goods.length; i++) {
    const gp = goods[i]!, short = shorts[i]!, lag = lags[i]!;
    let eta = 0;
    if (short > 0 && short <= incomingOf(gp.good)) {
      // everything still missing is promised: the last of those wagons decides
      eta = 0;
      for (const q of castles) { const e = lastDelivery(world, q.id, gp.good); eta = e < 0 || eta < 0 ? -1 : Math.max(eta, e); }
    } else if (short > 0) {
      // the last unit still has to be made (at the measured pace) and driven to the castle
      const make = gp.toMake === 0 ? 0 : gp.perMin > 0 ? gp.toMake * 60 * TICK_HZ / gp.perMin : -1;
      eta = make < 0 || lag < 0 ? -1 : Math.round(make) + lag;
      const pooled = gp.toMake > 0 && lag >= 0 ? pooledTicks(goods, lags, i, perMinOf) : -1;
      if (pooled >= 0 && (eta < 0 || pooled < eta)) eta = pooled;
    }
    gp.etaTicks = eta;
    if (eta < 0) ready = false;
    if (short > 0 && eta >= 0 && eta > worstTicks) { worstTicks = eta; worst = i; }
  }
  if (!ready || worst < 0) {
    return { ready: ready && worst >= 0, finishTick: -1, seals: -1, goods, bottleneck: worst, aim: null };
  }
  const finishTick = st.tick + worstTicks;
  const seals = sealsAt(world, finishTick);
  // the next better outcome: the pace the bottleneck needs to make the rest before that seal's tick
  let aim: ContractForecast['aim'] = null;
  const b = goods[worst]!;
  const lagB = b.etaTicks - (b.toMake === 0 || b.perMin <= 0 ? 0 : Math.round(b.toMake * 60 * TICK_HZ / b.perMin));
  for (const [s, byTick] of [[3, c.star3Tick], [2, c.star2Tick], [1, c.deadlineTick]] as const) {
    if (needOf || s <= seals) break;
    const room = byTick - st.tick - lagB;
    if (room > 0 && b.toMake > 0 && sealsAt(world, byTick) > seals) {
      aim = { seals: sealsAt(world, byTick), byTick, perMin: b.toMake * 60 * TICK_HZ / room };
      break;
    }
  }
  return { ready: true, finishTick, seals, goods, bottleneck: worst, aim };
}

/**
 * The forecast of the tranche now due (D-78), or null: no contract in tranches, all delivered, or the two-minute
 * pace window does not yet lie inside this tranche (since the start for the first). Before that the pace of the
 * tranche before (another good, a sawmill still idle) said "late" for a minute or more on runs that met every
 * tranche (m5, m6 without a player action: 18 and 14 false "late" samples in 10 s steps, none with the gate).
 */
export function trancheForecast(world: World, log: PaceLog): ContractForecast | null {
  const c = world.state.mission.contract;
  if (!c || world.state.mission.result !== 'running') return null;
  const cur = c.tranches.findIndex((x) => x.doneTick < 0);
  if (cur < 0) return null;
  if (world.state.tick - (cur > 0 ? c.tranches[cur - 1]!.doneTick : 0) < PACE_WINDOW_TICKS) return null;
  return contractForecast(world, log, trancheNeed(world, cur));
}

/**
 * Two castles (mission XVI, D-290): how the castle leg serves one castle. 'first' — it is marked first (castleFirst);
 * 'after' — the other castle is first and still short; 'even' — no castle first: the dispatcher splits by fill, so both
 * castles fill evenly and finish together.
 */
export type CastleShare = 'first' | 'after' | 'even';

export interface CastleForecast {
  castle: number;
  /** The castle's own deadline (its one tranche). */
  dueTick: number;
  share: CastleShare;
  /** The order is complete (finishTick = when it was). */
  done: boolean;
  /** Tick at which this castle's order would be complete at the current share (−1: cannot tell). */
  finishTick: number;
  /** The same if this castle were first (= finishTick when it is). */
  firstTick: number;
  /** The pace is measured (pace log); false: the producers' full-work capacity (the first minute). */
  measured: boolean;
}

/**
 * Forecast of one castle's order in a two-castle mission (D-290), or null (no such order, mission over). Pure read
 * of the state and the caller's pace log. The shared good's pace (measured, or for the first two minutes the producers'
 * capacity)
 * serves a pool: this castle's rest alone when it is first, the first castle's rest before it when the other is
 * first, and both rests when they fill evenly. Unlike `contractForecast` it is ready from the first tick — the
 * decision "which castle first" is worth most at 0:00.
 */
export function castleForecast(world: World, log: PaceLog, castleId: number): CastleForecast | null {
  const st = world.state, m = st.mission;
  if (!m.extraContracts || m.result !== 'running') return null;
  const orders = contractsOf(m);
  const c = orders.find((k) => k.castle === castleId);
  const castle = c ? buildingById(world, castleId) : null;
  if (!c || !castle) return null;
  const tr = c.tranches[0];
  const dueTick = tr ? tr.deadlineTick : c.deadlineTick;
  const first = m.firstCastle;
  const firstOrder = first !== undefined && first !== castleId ? orders.find((k) => k.castle === first) ?? null : null;
  const done = GOODS.every((g) => castle.stock[g] >= c.need[g]);
  const base = { castle: castleId, dueTick };
  if (done) {
    const at = tr && tr.doneTick >= 0 ? tr.doneTick : st.tick;
    return { ...base, share: first === castleId ? 'first' : firstOrder ? 'after' : 'even', done, finishTick: at, firstTick: at, measured: true };
  }
  const n = log.ticks.length;
  const span = n > 1 ? log.ticks[n - 1]! - log.ticks[0]! : 0;
  const rest = (k: typeof c, g: Good): number => {
    const b = buildingById(world, k.castle);
    return b ? Math.max(0, k.need[g] - b.stock[g] - b.incoming[g]) : 0;
  };
  let measured = true, share: CastleShare = first === castleId ? 'first' : 'even';
  let worst = 0, worstFirst = 0;
  for (let gi = 0; gi < GOODS.length; gi++) {
    const g = GOODS[gi]!;
    if (c.need[g] - castle.stock[g] <= 0) continue;
    let spare = 0, cap = 0, lag = -1;
    for (const p of st.buildings) {
      if (!outputGoods(p.type).includes(g)) continue;
      const r = BUILDINGS[p.type].recipe!;
      spare += p.stock[g] - p.reservedOut[g];
      cap += (r.outputs[g] ?? 0) * 60 * TICK_HZ / cycleTicks(world, p.type, r.ticks);
      const trip = tripTicks(world, p.gate, castle.gate);
      if (trip >= 0 && (lag < 0 || trip < lag)) lag = trip;
    }
    // the measured pace once the two-minute window is full (the better of the window and the long run, as in
    // contractForecast); before that the start-up stock and the first trips distort it, so the producers' capacity
    let pace = -1;
    if (span >= PACE_WINDOW_TICKS - PACE_SAMPLE_TICKS) {
      const now = log.produced[n - 1]![gi]!;
      pace = (now - log.produced[0]![gi]!) * 60 * TICK_HZ / span;
      const longSpan = log.ticks[n - 1]! - log.firstTick;
      if (longSpan > span) pace = Math.max(pace, (now - log.first[gi]!) * 60 * TICK_HZ / longSpan);
    }
    if (pace <= 0) { pace = cap; measured = false; }
    const own = rest(c, g);
    let pool = own;
    if (first !== castleId) {
      if (firstOrder && rest(firstOrder, g) > 0) { pool += rest(firstOrder, g); share = 'after'; }
      else if (!firstOrder) for (const k of orders) if (k !== c) pool += rest(k, g);
    }
    const arrive = lastDelivery(world, castleId, g);
    if (lag < 0 || pace <= 0 || arrive < 0) return { ...base, share, done, finishTick: -1, firstTick: -1, measured };
    const eta = (p: number): number => (own <= 0 ? arrive : Math.max(arrive, Math.round(Math.max(0, p - spare) * 60 * TICK_HZ / pace) + lag));
    worst = Math.max(worst, eta(pool));
    worstFirst = Math.max(worstFirst, eta(own));
  }
  return { ...base, share, done, finishTick: st.tick + worst, firstTick: st.tick + worstFirst, measured };
}
