// Ranking of the stalls on the map for the HUD (D-43): the "worst stall" card, the alarm seal that
// cycles through them, the red / brass pins and the tool that cures the worst one. Read-only:
// statuses, stalledTicks and the cause chains come from the sim; nothing here writes state.
import { TICK_HZ, busyOutOfReach, canSurface, net, validateRoad, buildingById, contractFilled, explainBuilding, granaryRelief, missionBuildable, outputCustomer, outputSurplus, seasonalSupplier, sharedInput, stoneInStore, type Building, type BuildingType, type ReasonLink, type World } from '../sim/index';
import { isCritical, isStall } from './stallKinds';

/** 2 s: no pin or card for a short hiccup. */
export const MIN_STALL_TICKS = 20;

/** Weight of a stall in the ranking: critical (nothing on the way to fix it) beats a long wait. */
const W_CRIT = 3, W_NORMAL = 1, W_MINOR = 0.25;

/** The tool that fixes the root of a stall chain (the HUD highlights that tool card). */
export type Cure = 'wagon' | 'road' | 'granary' | 'producer' | 'pave' | null;

export interface StallEntry {
  id: number;
  ticks: number;
  crit: boolean;
  /** Resolves by itself: output waiting for a pickup or a customer that still takes it, a season. */
  minor: boolean;
  score: number;
}

/**
 * A stall that resolves by itself (output waits for a customer that still takes it, input slowed by
 * the season, a surplus nobody needs right now, a full granary next to one with room, the rest of a filled
 * order — audit 2026-11-03 fixes 1, 3, 6): a minor pin, never the
 * critical one. outputCustomer runs a path search, so the answer is kept per building until its
 * status, the road network or the second changes.
 */
const calmCache = new Map<number, { key: string; calm: boolean }>();
export function calmStall(world: World, b: Building, sig: string): boolean {
  const key = `${sig}|${world.state.netVersion}|${world.state.buildings.length}|${Math.floor(world.state.tick / 10)}`;
  const c = calmCache.get(b.id);
  if (c && c.key === key) return c.calm;
  const calm = outputCustomer(world, b.id) >= 0 || seasonalSupplier(world, b.id) !== null || outputSurplus(world, b.id) !== null ||
    granaryRelief(world, b.id)?.k === 'ROOM' || contractFilled(world, b.id) !== null || stoneInStore(world, b.id) > 0;
  calmCache.set(b.id, { key, calm });
  return calm;
}

/**
 * A stall with nothing to do about it, for the HUD card's wording (audit 2026-11-03): 'surplus' — a full
 * yard nobody needs right now (fix 1); 'storeRoom' — a full granary while another one has room (fix 3);
 * 'orderFilled' — the contract castle already holds this whole good (fix 6).
 * null: the status text says it right.
 */
export type CalmWhy = 'surplus' | 'storeRoom' | 'orderFilled' | 'stoneStored' | null;
export function calmWhy(world: World, b: Building): CalmWhy {
  if (outputSurplus(world, b.id) === 'SPARE') return 'surplus';
  if (granaryRelief(world, b.id)?.k === 'ROOM') return 'storeRoom';
  if (contractFilled(world, b.id)) return 'orderFilled';
  // D-95: the granary already holds stone to pave with (mission VIII's quarry)
  if (stoneInStore(world, b.id) > 0) return 'stoneStored';
  return null;
}

/**
 * The "Co to znaczy?" fold reads the calm variant of the codex entry for this link (D-98): a building
 * stall with a calm reason (surplus, filled order, granary with room, stone in store) — the same cases
 * the sheet's calm line names, so the fold never advises "Kup wóz" under it.
 */
export function codexCalm(world: World, l: ReasonLink): boolean {
  if (l.kind !== 'building') return false;
  const b = buildingById(world, l.id);
  return !!b && calmWhy(world, b) !== null;
}

/**
 * One producer feeds two (or more) workshops of this input, and the mission lets the player build another one
 * (research 2026-11-04, P5; missions IX, X): the cure is a second producer, not a wagon. sharedInput holds only
 * while the building waits for that input (NO_INPUT, NO_WAGON, WAITING_DELIVERY / _UPSTREAM). Pure read.
 */
export interface SharedOne { producer: number; type: BuildingType; consumers: number }
export function sharedOneProducer(world: World, b: Building): SharedOne | null {
  const sh = sharedInput(world, b.id);
  if (!sh || sh.producers !== 1 || sh.consumers < 2 || sh.producer < 0) return null;
  const p = buildingById(world, sh.producer);
  if (!p) return null;
  const can = missionBuildable(world.state.mission.id);
  if (can === 'ranked' || !can.includes(p.type)) return null;
  return { producer: p.id, type: p.type, consumers: sh.consumers };
}

/**
 * A wagon of this building's job (pickup here, or delivery here) has stood at a wooden span for 20 s or more —
 * a one-lane jam or ice (research 2026-11-04, P4; missions II, IV). The buildings behind it only "wait for a
 * delivery", which is no stall, so the jam never reached the card. Cure: pave that span in stone (no one-lane
 * rule, ice does not close it), when the surface is allowed here. `cells` is the span in drive order.
 */
export interface HeldSpan { wagon: number; kind: 'BRIDGE_JAM' | 'BRIDGE_CLOSED'; span: number; heldTicks: number; cells: number[] }
export const HELD_SPAN_TICKS = 20 * TICK_HZ;
export function heldSpanFor(world: World, b: Building): HeldSpan | null {
  const st = world.state;
  let best: HeldSpan | null = null;
  for (const w of st.wagons) {
    const s = w.status;
    if (s.k !== 'BRIDGE_JAM' && s.k !== 'BRIDGE_CLOSED') continue;
    const held = st.tick - s.since;
    if (held < HELD_SPAN_TICKS || !w.job) continue;
    if ((w.job.phase === 'pickup' ? w.job.from : w.job.to) !== b.id) continue;
    if (!best || held > best.heldTicks || (held === best.heldTicks && w.id < best.wagon)) {
      best = { wagon: w.id, kind: s.k, span: s.span, heldTicks: held, cells: [] };
    }
  }
  if (!best || !canSurface(world, 2).ok) return null;
  best.cells = spanCells(world, best.span);
  return best.cells.length ? best : null;
}

/** The cells of a span, ordered end to end (a contiguous list for the road command). */
function spanCells(world: World, span: number): number[] {
  const sp = net(world).span, W = world.terrain.w;
  const set: number[] = [];
  for (let i = 0; i < sp.length; i++) if (sp[i] === span) set.push(i);
  if (set.length < 2) return set;
  const near = (a: number, c: number): boolean => a !== c && Math.abs((a % W) - (c % W)) <= 1 && Math.abs(Math.floor(a / W) - Math.floor(c / W)) <= 1;
  // start at an end (a cell with one neighbour in the span), then walk
  const start = set.find((a) => set.filter((c) => near(a, c)).length <= 1) ?? set[0]!;
  const out = [start];
  const left = new Set(set.filter((c) => c !== start));
  while (left.size) {
    const cur = out[out.length - 1]!;
    let nx = -1;
    for (const c of left) if (near(cur, c) && (nx < 0 || c < nx)) nx = c;
    if (nx < 0) break;
    out.push(nx);
    left.delete(nx);
  }
  return out.length === set.length ? out : [];
}

/** Can the player pave this span now (silver, stone, rank)? The command's own check; read-only. */
export function paveCheck(world: World, h: HeldSpan): ReturnType<typeof validateRoad> {
  return validateRoad(world, h.cells, 2);
}

/**
 * A shared single producer outranks the long waits: its lesson state (CONTESTED) is too short-lived to reach the
 * card by duration (research P5), so it counts as critical from the first look, ahead of a 45 s stall.
 */
const SHARED_LEAD_TICKS = 45 * TICK_HZ;

/** Buildings with a stall worth a pin, worst first (stalledTicks × criticality). */
export function rankStalls(world: World): StallEntry[] {
  const out: StallEntry[] = [];
  for (const b of world.state.buildings) {
    if (sharedOneProducer(world, b)) {
      out.push({ id: b.id, ticks: b.stalledTicks, crit: true, minor: false, score: (b.stalledTicks + SHARED_LEAD_TICKS) * W_CRIT });
      continue;
    }
    const held = heldSpanFor(world, b);
    if (held) {
      out.push({ id: b.id, ticks: held.heldTicks, crit: true, minor: false, score: (held.heldTicks + SHARED_LEAD_TICKS) * W_CRIT });
      continue;
    }
    if (!isStall(b.status) && b.status.k !== 'NO_INPUT') continue;
    if (b.stalledTicks < MIN_STALL_TICKS) continue;
    const calm = calmStall(world, b, JSON.stringify(b.status));
    const crit = isCritical(b.status, b.stalledTicks, calm);
    const minor = b.status.k === 'WAITING_PICKUP' || calm;
    const w = crit ? W_CRIT : minor ? W_MINOR : W_NORMAL;
    out.push({ id: b.id, ticks: b.stalledTicks, crit, minor, score: b.stalledTicks * w });
  }
  // ties: lower id first, so the order (and the alarm seal's cycle) is stable between frames
  out.sort((a, b) => b.score - a.score || a.id - b.id);
  return out;
}

/**
 * Building whose missing link to the stable is the root of this chain, or -1 (the sheet's gap finder offers
 * the cheapest road from the stable to it). NO_WAGON.ALL_BUSY counts when no stable reaches any source of
 * the good (audit 2026-11-03, fix 5): the target is that source, as for NONE_CAN_REACH it is the consumer.
 */
export function gapTarget(world: World, chain: ReasonLink[]): number {
  const root = chain[chain.length - 1];
  if (!root) return -1;
  if (root.kind === 'building') {
    const s = root.status;
    if (s.k === 'NO_ROAD' || (s.k === 'NO_WAGON' && s.cause === 'NONE_CAN_REACH')) return root.id;
    if (s.k === 'NO_WAGON' && s.cause === 'ALL_BUSY') return busyOutOfReach(world, root.id);
    return -1;
  }
  if (root.status.k === 'NO_ROUTE' && root.status.target >= 0 && buildingById(world, root.status.target)) return root.status.target;
  return -1;
}

let cureCache: { key: string; cure: Cure } | null = null;
/**
 * What the player can buy or build against the root of a building's stall chain: a wagon when the
 * root waits for a free wagon, a road when it lacks one, a granary when its output has nowhere to go
 * (OUTPUT_FULL.NO_DESTINATION) or the granary is full with no other to link or fill. Nothing when the chain runs into a wagon held at a bridge (ice, a
 * one-lane jam: a new wagon would wait there too) or when the full output is a surplus nobody needs
 * (audit 2026-11-03, fixes 1-2). Cached per status and network version.
 */
export function cureFor(world: World, id: number): Cure {
  const b = world.state.buildings.find((q) => q.id === id);
  if (!b) return null;
  const key = `${id}|${JSON.stringify(b.status)}|${world.state.netVersion}|${world.state.wagons.length}|${Math.floor(world.state.tick / 20)}`;
  if (cureCache?.key === key) return cureCache.cure;
  if (sharedOneProducer(world, b)) {
    cureCache = { key, cure: 'producer' };
    return 'producer';
  }
  if (heldSpanFor(world, b)) {
    cureCache = { key, cure: 'pave' };
    return 'pave';
  }
  const chain = explainBuilding(world, id, 5, true);
  let cure: Cure = null;
  for (let i = chain.length - 1; i >= 0 && !cure; i--) {
    const l = chain[i]!;
    if (l.kind === 'building') {
      const s = l.status;
      if (s.k === 'NO_ROAD' || (s.k === 'NO_INPUT' && s.cause === 'UNREACHABLE') || (s.k === 'NO_WAGON' && s.cause === 'NONE_CAN_REACH')) cure = 'road';
      // every wagon busy, but none could reach a source of the good anyway: the road to it (fix 5)
      else if (s.k === 'NO_WAGON' && s.cause === 'ALL_BUSY') cure = busyOutOfReach(world, l.id) >= 0 ? 'road' : 'wagon';
      // (not when the granary already has paving stone, D-95: a new wagon would carry workshop inputs first)
      else if (s.k === 'OUTPUT_FULL' && s.cause === 'NO_WAGON' && outputSurplus(world, l.id) !== 'SPARE' && stoneInStore(world, l.id) === 0) cure = 'wagon';
      // only as the root: a full output whose customer still takes the good chains on to it (calm stall)
      // (not when the order of this good is complete: nothing needs it any more, fix 6)
      else if (s.k === 'OUTPUT_FULL' && s.cause === 'NO_DESTINATION' && i === chain.length - 1 && !contractFilled(world, l.id)) cure = 'granary';
      // a full granary with no other granary to link or fill: another granary (fix 3)
      else if (s.k === 'STORAGE_FULL' && i === chain.length - 1 && !granaryRelief(world, l.id)) cure = 'granary';
    } else if (l.status.k === 'NO_ROUTE') cure = 'road';
    else if (l.status.k === 'BRIDGE_CLOSED' || l.status.k === 'BRIDGE_JAM') break;
  }
  cureCache = { key, cure };
  return cure;
}

/**
 * rankStalls() once per sim tick instead of every frame (frame-cost research, item 3): the ranking only
 * changes when the state does — a tick, a command applied in pause (`version`: e.g. the loop's journal
 * length), a new world or a loaded save. `invalidate()` forces the next call to recompute (sheet or
 * selection changes, a language switch). The returned array is shared between calls: read it, never mutate it.
 */
export class StallRanking {
  private world: World | null = null;
  private state: object | null = null;
  private tick = -1;
  private net = -1;
  private count = -1;
  private version = -1;
  private cached: StallEntry[] = [];
  /** Recomputations since construction (tests, perf overlay). */
  computed = 0;

  get(world: World, version = 0): StallEntry[] {
    const st = world.state;
    if (world !== this.world || st !== this.state || st.tick !== this.tick || st.netVersion !== this.net ||
      st.buildings.length !== this.count || version !== this.version) {
      this.world = world; this.state = st; this.tick = st.tick; this.net = st.netVersion;
      this.count = st.buildings.length; this.version = version;
      this.cached = rankStalls(world);
      this.computed++;
    }
    return this.cached;
  }

  invalidate(): void {
    this.tick = -1;
  }
}
