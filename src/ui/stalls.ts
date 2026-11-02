// Ranking of the stalls on the map for the HUD (D-43): the "worst stall" card, the alarm seal that
// cycles through them, the red / brass pins and the tool that cures the worst one. Read-only:
// statuses, stalledTicks and the cause chains come from the sim; nothing here writes state.
import { explainBuilding, outputCustomer, seasonalSupplier, type Building, type World } from '../sim/index';
import { isCritical, isStall } from './stallKinds';

/** 2 s: no pin or card for a short hiccup. */
export const MIN_STALL_TICKS = 20;

/** Weight of a stall in the ranking: critical (nothing on the way to fix it) beats a long wait. */
const W_CRIT = 3, W_NORMAL = 1, W_MINOR = 0.25;

/** The tool that fixes the root of a stall chain (the HUD highlights that tool card). */
export type Cure = 'wagon' | 'road' | null;

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
 * the season): a minor pin, never the critical one. outputCustomer runs a path search, so the answer
 * is kept per building until its status, the road network or the second changes.
 */
const calmCache = new Map<number, { key: string; calm: boolean }>();
export function calmStall(world: World, b: Building, sig: string): boolean {
  const key = `${sig}|${world.state.netVersion}|${world.state.buildings.length}|${Math.floor(world.state.tick / 10)}`;
  const c = calmCache.get(b.id);
  if (c && c.key === key) return c.calm;
  const calm = outputCustomer(world, b.id) >= 0 || seasonalSupplier(world, b.id) !== null;
  calmCache.set(b.id, { key, calm });
  return calm;
}

/** Buildings with a stall worth a pin, worst first (stalledTicks × criticality). */
export function rankStalls(world: World): StallEntry[] {
  const out: StallEntry[] = [];
  for (const b of world.state.buildings) {
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

let cureCache: { key: string; cure: Cure } | null = null;
/**
 * What the player can buy or build against the root of a building's stall chain: a wagon when the
 * root waits for a free wagon, a road when it lacks one. Cached per status and network version.
 */
export function cureFor(world: World, id: number): Cure {
  const b = world.state.buildings.find((q) => q.id === id);
  if (!b) return null;
  const key = `${id}|${JSON.stringify(b.status)}|${world.state.netVersion}|${world.state.wagons.length}|${Math.floor(world.state.tick / 20)}`;
  if (cureCache?.key === key) return cureCache.cure;
  const chain = explainBuilding(world, id, 5, true);
  let cure: Cure = null;
  for (let i = chain.length - 1; i >= 0 && !cure; i--) {
    const l = chain[i]!;
    if (l.kind === 'building') {
      const s = l.status;
      if (s.k === 'NO_ROAD' || (s.k === 'NO_INPUT' && s.cause === 'UNREACHABLE') || (s.k === 'NO_WAGON' && s.cause === 'NONE_CAN_REACH')) cure = 'road';
      else if ((s.k === 'NO_WAGON' && s.cause === 'ALL_BUSY') || (s.k === 'OUTPUT_FULL' && s.cause === 'NO_WAGON')) cure = 'wagon';
    } else if (l.status.k === 'NO_ROUTE') cure = 'road';
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
