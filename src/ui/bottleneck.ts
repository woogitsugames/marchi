// "Wąskie gardło" — the free valley's bottleneck card (D-171, spec docs/specs/2026-11-04-valley-trade-post.md §3,
// rule measured with tools/valley-bottleneck.ts). Once the valley runs without stalls, the card in the calm slot names
// the input that most workshops wait for over three minutes, and the cure: one more producer of it (or, when the
// whole fleet has been on the road all that time, one more wagon). UI only: samples live outside the state (like
// D-110), one per sim second, in a WeakMap per world; nothing here writes the sim state.
import {
  GOODS, TICK_HZ, canPlace, findPath, inputGoods, marketOpen, outputGoods, pathTime, producerOf, rankGated,
  type Building, type BuildingType, type Good, type World,
} from '../sim/index';
import { inputWaitTicks, waitsForInput } from './stalls';

export const NECK_WINDOW = 180; // samples, one per sim second
export const NECK_SHOW_X100 = 150; // mean waiting consumers x100 to show
export const NECK_HIDE_X100 = 110; // a shown good stays until the mean drops below this
export const NECK_MIN_CONSUMERS = 2;
export const NECK_FLEET_RANK = 2;

export interface BottleneckCard {
  kind: 'good' | 'fleet';
  good: Good | null; // null for 'fleet'
  /** Mean waiting consumers x100 over the window, and consumers of the good on the map. */
  meanX100: number;
  consumers: number;
  cure: 'producer' | 'wagon';
  /** Building type to build (producerOf(good)), and the producer to build next to (id) — the one nearest by road to `focus`. */
  build: BuildingType | null;
  near: number;
  /** The consumer that has waited longest (inputWaitTicks) — the eye button's target; for 'fleet': the stable. */
  focus: number;
}

type GoodNums = Record<Good, number>;
interface Log {
  /** Samples taken; ring index = n % NECK_WINDOW. */
  n: number;
  /** Tick of the last sample (a load or a new world restarts the log). */
  tick: number;
  wait: Record<Good, number[]>;
  noWagon: Record<Good, number[]>;
  starved: Record<Good, number[]>;
  sumW: GoodNums;
  sumN: GoodNums;
  sumS: GoodNums;
  /** 1 when no wagon stood idle in that second. */
  busy: number[];
  sumBusy: number;
  /** The good of the card shown last (hysteresis), and the card cache. */
  shown: Good | null;
  cardTick: number;
  card: BottleneckCard | null;
}

const logs = new WeakMap<World, Log>();
const zeros = (): GoodNums => Object.fromEntries(GOODS.map((g) => [g, 0])) as GoodNums;
const rings = (): Record<Good, number[]> => Object.fromEntries(GOODS.map((g) => [g, new Array<number>(NECK_WINDOW).fill(0)])) as Record<Good, number[]>;

function freshLog(tick: number): Log {
  return {
    n: 0, tick, wait: rings(), noWagon: rings(), starved: rings(), sumW: zeros(), sumN: zeros(), sumS: zeros(),
    busy: new Array<number>(NECK_WINDOW).fill(0), sumBusy: 0, shown: null, cardTick: -1, card: null,
  };
}

/** The card exists only in the free valley with its market open. */
function valley(world: World): boolean {
  return rankGated(world) && marketOpen(world);
}

/** Once per sim second (from sampleInputWaits, every tick): waiting consumers per input good, the fleet's idle wagons. */
export function sampleBottleneck(world: World): void {
  const st = world.state;
  if (!valley(world) || st.tick % TICK_HZ !== 0) return;
  let log = logs.get(world);
  if (!log || st.tick < log.tick || st.tick > log.tick + TICK_HZ) { log = freshLog(st.tick); logs.set(world, log); }
  if (log.n > 0 && st.tick === log.tick) return;
  log.tick = st.tick;
  const i = log.n % NECK_WINDOW;
  const cw = zeros(), cn = zeros(), cs = zeros();
  for (const b of st.buildings) {
    if (!waitsForInput(b)) continue;
    const g = (b.status as { good: Good }).good;
    cw[g]++;
    if (b.status.k === 'NO_WAGON') cn[g]++;
    // this consumer is itself a producer that waits for its input: its output's shortage lies further up
    for (const o of outputGoods(b.type)) cs[o]++;
  }
  for (const g of GOODS) {
    log.sumW[g] += cw[g] - log.wait[g][i]!; log.wait[g][i] = cw[g];
    log.sumN[g] += cn[g] - log.noWagon[g][i]!; log.noWagon[g][i] = cn[g];
    log.sumS[g] += cs[g] - log.starved[g][i]!; log.starved[g][i] = cs[g];
  }
  const busy = st.wagons.some((w) => w.status.k === 'IDLE') ? 0 : 1;
  log.sumBusy += busy - log.busy[i]!; log.busy[i] = busy;
  log.n++;
}

function consumersOf(world: World, g: Good): Building[] {
  return world.state.buildings.filter((b) => inputGoods(b.type).includes(g));
}

/** The producer of g nearest by road to `to` (loaded travel time); -1 when there is none. */
function nearestProducer(world: World, g: Good, to: Building): number {
  let best = -1, bestT = Infinity;
  for (const p of world.state.buildings) {
    if (!outputGoods(p.type).includes(g)) continue;
    const path = findPath(world, p.gate, to.gate, true);
    const tt = path ? pathTime(world, p.gate, path, true) : Infinity;
    if (best < 0 || tt < bestT) { best = p.id; bestT = tt; }
  }
  return best;
}

function computeCard(world: World, log: Log): BottleneckCard | null {
  if (log.n < NECK_WINDOW) { log.shown = null; return null; }
  const st = world.state;
  let best: { g: Good; mean: number; consumers: Building[]; cure: 'producer' | 'wagon'; type: BuildingType } | null = null;
  for (const g of GOODS) {
    const mean = Math.floor((log.sumW[g] * 100) / NECK_WINDOW);
    if (mean < (log.shown === g ? NECK_HIDE_X100 : NECK_SHOW_X100)) continue;
    const consumers = consumersOf(world, g);
    if (consumers.length < NECK_MIN_CONSUMERS) continue;
    const type = producerOf(g);
    if (!type || !canPlace(world, type).ok) continue;
    // further up the chain: half of the good's producers (on average) wait for their own input themselves
    const producers = st.buildings.filter((b) => outputGoods(b.type).includes(g)).length;
    if (producers > 0 && log.sumS[g] * 2 >= producers * NECK_WINDOW) continue;
    const cure = log.sumN[g] * 2 >= log.sumW[g] ? 'wagon' : 'producer';
    if (!best || mean > best.mean) best = { g, mean, consumers, cure, type };
  }
  log.shown = best?.g ?? null;
  if (best) {
    // the eye: the consumer that has waited longest for the good (inputWaitTicks), else the first one waiting
    let focus: Building | null = null, longest = -1;
    for (const b of best.consumers) {
      if (!waitsForInput(b) || (b.status as { good: Good }).good !== best.g) continue;
      const w = inputWaitTicks(world, b);
      if (w > longest) { longest = w; focus = b; }
    }
    focus ??= best.consumers[0]!;
    return {
      kind: 'good', good: best.g, meanX100: best.mean, consumers: best.consumers.length, cure: best.cure,
      build: best.type, near: nearestProducer(world, best.g, focus), focus: focus.id,
    };
  }
  // the fleet: from rank 2, not one wagon stood idle in any second of the window
  if (st.town.rank >= NECK_FLEET_RANK && log.sumBusy >= NECK_WINDOW) {
    const stable = st.buildings.find((b) => b.type === 'stable');
    if (stable) return { kind: 'fleet', good: null, meanX100: 0, consumers: 0, cure: 'wagon', build: null, near: -1, focus: stable.id };
  }
  return null;
}

/** The card right now (cached per tick), or null: window not full, nothing over the threshold, not the free valley. */
export function bottleneckCard(world: World): BottleneckCard | null {
  if (!valley(world)) return null;
  const log = logs.get(world);
  if (!log) return null;
  if (log.cardTick !== world.state.tick) {
    log.cardTick = world.state.tick;
    log.card = computeCard(world, log);
  }
  return log.card;
}

/** The card's cure for this building's own sheet: b waits for the card's good (null otherwise, and for the fleet card). */
export function bottleneckFor(world: World, b: Building): BottleneckCard | null {
  const c = bottleneckCard(world);
  if (!c || c.kind !== 'good' || c.cure !== 'producer' || !waitsForInput(b)) return null;
  return (b.status as { good: Good }).good === c.good ? c : null;
}

/** "n of m workshops wait": the mean waiting consumers, rounded, at least one. */
export function neckWaiting(c: BottleneckCard): number {
  return Math.max(1, Math.round(c.meanX100 / 100));
}

/** A short key of the card for caches (cureFor). */
export function bottleneckKey(world: World): string {
  const c = bottleneckCard(world);
  return c ? `${c.kind}:${c.good ?? ''}:${c.cure}:${c.near}` : '';
}

/** Test hook: forget the samples of a world. */
export function resetBottleneck(world: World): void {
  logs.delete(world);
}
