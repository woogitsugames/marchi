// Seeded random command fuzzer for the simulation. Shared by tests/fuzz.test.ts and tools/fuzz.ts.
// Everything here is deterministic: a fuzz seed fully defines the command sequence. Commands are
// generated lazily from the live state (so they hit real roads / buildings) and recorded as
// concrete commands, which can then be replayed and shrunk without the generator.
import {
  BUILDINGS, applyCommand, checkInvariants, createWorld, deserialize, hasEdge, lineCells, serialize,
  stateHash, step, unexplainedStalls, wagonEta, type BuildingType, type Command, type World,
} from '../src/sim/index';
import { nextFloat, nextInt, seedRng, type RngState } from '../src/sim/rng';

export interface TimedCommand { tick: number; cmd: Command }

export interface Scenario {
  mission: string;
  /** Coins override applied right after createWorld (null = mission default). */
  coins: number | null;
  /** Number of ticks to simulate. */
  ticks: number;
  /** Tick at which a save/load clone is taken and run side by side (-1 = none). */
  saveAt: number;
  commands: TimedCommand[];
}

export type FailureKind = 'invariant' | 'stall' | 'nan' | 'stuck' | 'savediverge' | 'rerundiverge' | 'exception';

export interface Failure { kind: FailureKind; tick: number; detail: string }

export interface RunStats {
  ticks: number;
  commandsOk: number;
  commandsRejected: number;
  maxWagons: number;
  /** Per-tick step() cost in ms, split by dispatch ticks. Only filled when timing=true. */
  stepMs: number[];
  dispatchMs: number[];
}

export interface RunOptions {
  /** Wagon with a job that neither moves nor changes status this long is reported as stuck. */
  stuckTicks?: number;
  /** Re-run the scenario from scratch and compare hashes (determinism). */
  rerun?: boolean;
  timing?: boolean;
  /** Which checks to run every tick. */
  checkStalls?: boolean;
  /**
   * Ticks after a successful `place` during which the new producer may still report IDLE
   * (its status is only computed by the next dispatch, see review F-04). 0 = strict.
   */
  placeGraceTicks?: number;
}

export const DEFAULT_PLACE_GRACE = 5;

export const DEFAULT_STUCK_TICKS = 5 * 60 * 10; // 5 sim-minutes

// --- generation --------------------------------------------------------------

const PLACEABLE: BuildingType[] = [
  'woodcutter', 'sawmill', 'farm', 'mill', 'bakery', 'warehouse', 'stable',
  // free valley chains (D-29); locked below their rank in 'sandbox', see the 'sandbox@5' pseudo-mission
  'fisher', 'quarry', 'charcoalBurner', 'malthouse', 'brewery',
];

function pick<T>(rng: RngState, xs: readonly T[]): T | undefined {
  if (xs.length === 0) return undefined;
  return xs[nextInt(rng, 0, xs.length - 1)];
}

function roadCells(w: World): number[] {
  const out: number[] = [];
  const r = w.state.roads;
  for (let i = 0; i < r.length; i++) if (r[i]) out.push(i);
  return out;
}

/** One random, plausible command for the current state. */
export function genCommand(w: World, rng: RngState): Command {
  const W = w.terrain.w, H = w.terrain.h;
  const roll = nextFloat(rng);
  const roads = roadCells(w);
  const surface = (nextFloat(rng) < 0.25 ? 2 : 1) as 1 | 2;
  const clampX = (x: number) => Math.max(0, Math.min(W - 1, x));
  const clampY = (y: number) => Math.max(0, Math.min(H - 1, y));
  if (roll < 0.25) {
    // road from an existing road cell to somewhere near
    const a = pick(rng, roads) ?? nextInt(rng, 0, W * H - 1);
    const ax = a % W, ay = (a - ax) / W;
    const b = clampY(ay + nextInt(rng, -14, 14)) * W + clampX(ax + nextInt(rng, -14, 14));
    return { t: 'road', cells: lineCells(W, a, b), surface };
  }
  if (roll < 0.37) {
    // river crossing between the two bank roads, often diagonal (multi-span bridges)
    const x1 = nextInt(rng, 6, W - 7);
    const x2 = clampX(x1 + nextInt(rng, -10, 10));
    const a = 24 * W + x1, b = 44 * W + x2;
    const pre = lineCells(W, 24 * W + clampX(x1 - nextInt(rng, 0, 3)), a);
    const cells = [...pre.slice(0, -1), ...lineCells(W, a, b)];
    return { t: 'road', cells, surface };
  }
  if (roll < 0.55) {
    // demolish: road / bridge cell / building
    const r2 = nextFloat(rng);
    if (r2 < 0.55 || w.state.buildings.length === 0) {
      return { t: 'demolish', cell: pick(rng, roads) ?? 0 };
    }
    if (r2 < 0.8) {
      const bridges = roads.filter((c) => w.terrain.water[c] === 1);
      return { t: 'demolish', cell: pick(rng, bridges) ?? pick(rng, roads) ?? 0 };
    }
    const b = pick(rng, w.state.buildings)!;
    return { t: 'demolish', cell: (b.y + nextInt(rng, 0, b.h - 1)) * W + b.x + nextInt(rng, 0, b.w - 1) };
  }
  if (roll < 0.78) {
    const stables = w.state.buildings.filter((b) => b.type === 'stable');
    const s = pick(rng, stables);
    return { t: 'buyWagon', stable: s ? s.id : -1 };
  }
  // place a building with its gate on an existing road cell
  const type = pick(rng, PLACEABLE)!;
  const def = BUILDINGS[type];
  const g = pick(rng, roads) ?? nextInt(rng, 0, W * H - 1);
  const gx = g % W, gy = (g - gx) / W;
  const facing = nextInt(rng, 0, 3);
  let x: number, y: number;
  switch (facing) {
    case 0: x = gx - (def.w >> 1); y = gy - def.h; break;
    case 1: x = gx - def.w; y = gy - (def.h >> 1); break;
    case 2: x = gx - (def.w >> 1); y = gy + 1; break;
    default: x = gx + 1; y = gy - (def.h >> 1); break;
  }
  return { t: 'place', type, x, y, facing };
}

/** Generate a scenario by running the sim and drawing commands from the live state. */
/** Missions the short fuzz in `npm test` uses (kept stable so its seeds keep their scenarios). */
export const DEFAULT_FUZZ_MISSIONS = ['m1', 'sandbox'];
/** Every playable map: the long mode (`tools/fuzz.ts`) fuzzes all of them by default. */
export const ALL_FUZZ_MISSIONS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12', 'm13', 'sandbox'];

export function generateScenario(
  fuzzSeed: number,
  opts: { ticks: number; minCmds?: number; maxCmds?: number; missions?: readonly string[] },
): Scenario {
  const rng = seedRng(fuzzSeed ^ 0x5eed);
  const pool = opts.missions ?? DEFAULT_FUZZ_MISSIONS;
  // one draw, same as before: with the default pool f < 0.5 picks m1, otherwise sandbox
  const mission = pool[Math.min(pool.length - 1, Math.floor(nextFloat(rng) * pool.length))]!;
  const coins = nextFloat(rng) < 0.6 ? 4000 : null;
  const n = nextInt(rng, opts.minCmds ?? 8, opts.maxCmds ?? 40);
  const ticks: number[] = [];
  for (let i = 0; i < n; i++) ticks.push(nextInt(rng, 0, Math.floor(opts.ticks * 0.85)));
  ticks.sort((a, b) => a - b);
  const saveAt = nextInt(rng, 1, opts.ticks - 1);
  const w = makeWorld(mission, coins);
  const commands: TimedCommand[] = [];
  let k = 0;
  for (let t = 0; t < opts.ticks && k < ticks.length; t++) {
    while (k < ticks.length && ticks[k] === t) {
      const cmd = genCommand(w, rng);
      commands.push({ tick: w.state.tick, cmd }); // absolute (= t from a fresh world; a snapshot starts later)
      applyCommand(w, cmd);
      k++;
    }
    step(w);
  }
  return { mission, coins, ticks: opts.ticks, saveAt, commands };
}

/** Named start states (serialized SimState) a scenario may use as `mission`, e.g. a late free valley (tools/fuzz-late.ts). */
export const SNAPSHOTS = new Map<string, string>();

/**
 * `mission` may carry a rank suffix, e.g. 'sandbox@5': the free valley with every rank up to 5
 * already reached (all chains unlocked), so the fuzzer can place the new buildings.
 */
export function makeWorld(mission: string, coins: number | null): World {
  const snap = SNAPSHOTS.get(mission);
  if (snap !== undefined) {
    const w = deserialize(snap);
    if (coins !== null) w.state.coins = coins;
    return w;
  }
  const at = mission.indexOf('@');
  const w = createWorld(at < 0 ? mission : mission.slice(0, at));
  if (at >= 0) {
    const t = w.state.town;
    t.rank = Math.min(t.rankTicks.length - 1, Number(mission.slice(at + 1)));
    for (let i = 0; i <= t.rank; i++) t.rankTicks[i] = 0;
  }
  if (coins !== null) w.state.coins = coins;
  return w;
}

// --- checks ----------------------------------------------------------------

/** Finds NaN / Infinity in numbers of a value (deep). JSON.stringify would silently turn them into null. */
export function nonFinitePaths(v: unknown, path = '$', out: string[] = [], limit = 5): string[] {
  if (out.length >= limit) return out;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) out.push(`${path}=${v}`);
  } else if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) nonFinitePaths(v[i], `${path}[${i}]`, out, limit);
  } else if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) nonFinitePaths((v as Record<string, unknown>)[k], `${path}.${k}`, out, limit);
  } else if (v === undefined) {
    out.push(`${path}=undefined`);
  }
  return out;
}

/** Plain BFS over drivable edges (does not touch any sim cache that influences results). */
export function reachable(w: World, from: number, to: number): boolean {
  if (from === to) return true;
  if (!w.state.roads[from] || !w.state.roads[to]) return false;
  const W = w.terrain.w, H = w.terrain.h;
  const seen = new Uint8Array(W * H);
  const q = [from];
  seen[from] = 1;
  while (q.length) {
    const c = q.pop()!;
    const cx = c % W, cy = (c - cx) / W;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, y = cy + dy;
      if ((dx === 0 && dy === 0) || x < 0 || y < 0 || x >= W || y >= H) continue;
      const n = y * W + x;
      if (seen[n] || !hasEdge(w, c, n)) continue;
      if (n === to) return true;
      seen[n] = 1;
      q.push(n);
    }
  }
  return false;
}

interface Track { sig: string; since: number }

function wagonSig(wg: World['state']['wagons'][number]): string {
  const j = wg.job;
  return `${wg.at}|${wg.next}|${wg.edgeT}|${wg.busyTicks}|${wg.status.k}|${j ? j.id + j.phase + j.to : '-'}`;
}

/** A wagon with a job that has not moved nor changed state for `stuckTicks` and has no legit excuse. */
function stuckWagons(w: World, tracks: Map<number, Track>, stuckTicks: number): string[] {
  const out: string[] = [];
  const st = w.state;
  for (const wg of st.wagons) {
    const sig = wagonSig(wg);
    const tr = tracks.get(wg.id);
    if (!tr || tr.sig !== sig) { tracks.set(wg.id, { sig, since: st.tick }); continue; }
    if (!wg.job || st.tick - tr.since < stuckTicks) continue;
    if (wg.status.k === 'NO_ROUTE') {
      // legit when the target really is cut off; a bug when the route exists
      const tid = wg.status.target;
      if (tid < 0) continue;
      const tb = st.buildings.find((b) => b.id === tid);
      if (!tb || !reachable(w, wg.at, tb.gate)) continue;
      out.push(`wagon ${wg.id} NO_ROUTE to ${tid} for ${st.tick - tr.since} ticks although a route exists`);
      continue;
    }
    out.push(`wagon ${wg.id} stuck as ${JSON.stringify(wg.status)} at ${wg.at} for ${st.tick - tr.since} ticks (job ${JSON.stringify(wg.job)})`);
  }
  return out;
}

function quickNonFinite(w: World): string[] {
  const st = w.state;
  const out: string[] = [];
  if (!Number.isFinite(st.coins)) out.push(`coins=${st.coins}`);
  nonFinitePaths(st.wagons, '$.wagons', out);
  nonFinitePaths(st.buildings, '$.buildings', out);
  return out;
}

// --- running ---------------------------------------------------------------

function applyAt(w: World, cmds: TimedCommand[], idx: { i: number }, stats: RunStats | null, placed?: Map<number, number>): void {
  const t = w.state.tick;
  while (idx.i < cmds.length && cmds[idx.i]!.tick === t) {
    const cmd = cmds[idx.i]!.cmd;
    const r = applyCommand(w, cmd);
    if (r.ok && cmd.t === 'place' && placed) placed.set(w.state.buildings[w.state.buildings.length - 1]!.id, t);
    if (stats) { if (r.ok) stats.commandsOk++; else stats.commandsRejected++; }
    idx.i++;
  }
}

/** Replay a scenario with every check. Returns the first failure (or null) and run stats. */
export function runScenario(sc: Scenario, opts: RunOptions = {}): { failure: Failure | null; stats: RunStats; hash: string } {
  const stuckTicks = opts.stuckTicks ?? DEFAULT_STUCK_TICKS;
  const checkStalls = opts.checkStalls ?? true;
  const grace = opts.placeGraceTicks ?? DEFAULT_PLACE_GRACE;
  const placed = new Map<number, number>();
  const stats: RunStats = { ticks: 0, commandsOk: 0, commandsRejected: 0, maxWagons: 0, stepMs: [], dispatchMs: [] };
  const cmds = [...sc.commands].sort((a, b) => a.tick - b.tick);
  const w = makeWorld(sc.mission, sc.coins);
  const idx = { i: 0 };
  let clone: World | null = null;
  const cidx = { i: 0 };
  const tracks = new Map<number, Track>();
  const fail = (kind: FailureKind, detail: string) => ({ failure: { kind, tick: w.state.tick, detail }, stats, hash: stateHash(w) });
  try {
    for (let t = 0; t < sc.ticks; t++) {
      if (t === sc.saveAt) {
        clone = deserialize(serialize(w));
        cidx.i = idx.i;
        if (stateHash(clone) !== stateHash(w)) return fail('savediverge', 'hash differs right after load');
      }
      applyAt(w, cmds, idx, stats, placed);
      if (clone) applyAt(clone, cmds, cidx, null);
      if (opts.timing) {
        const dispatchTick = w.state.tick % 5 === 0;
        const s = performance.now();
        step(w);
        (dispatchTick ? stats.dispatchMs : stats.stepMs).push(performance.now() - s);
      } else step(w);
      if (clone) {
        // the clone also gets UI-style reads between ticks; they must not change the result (F-02)
        const q = clone.state.wagons.find((x) => x.job && x.job.phase === 'pickup');
        if (q) wagonEta(clone, q.id);
        step(clone);
      }
      stats.ticks++;
      if (w.state.wagons.length > stats.maxWagons) stats.maxWagons = w.state.wagons.length;
      const inv = checkInvariants(w);
      if (inv.length) return fail('invariant', inv.join('; '));
      if (checkStalls) {
        const u = unexplainedStalls(w).filter((m) => {
          const id = /^producer (\d+) /.exec(m);
          if (!id) return true;
          const at = placed.get(Number(id[1]));
          return at === undefined || w.state.tick - at > grace;
        });
        if (u.length) return fail('stall', u.join('; '));
      }
      const nf = quickNonFinite(w);
      if (nf.length) return fail('nan', nf.join('; '));
      if (t % 100 === 0) {
        const full = nonFinitePaths(w.state);
        if (full.length) return fail('nan', full.join('; '));
        const s = stuckWagons(w, tracks, stuckTicks);
        if (s.length) return fail('stuck', s.join('; '));
      } else {
        // keep tracks fresh cheaply
        for (const wg of w.state.wagons) {
          const sig = wagonSig(wg);
          const tr = tracks.get(wg.id);
          if (!tr || tr.sig !== sig) tracks.set(wg.id, { sig, since: w.state.tick });
        }
      }
      if (clone && (t % 250 === 0 || t === sc.ticks - 1) && stateHash(clone) !== stateHash(w)) {
        return fail('savediverge', `save/load at tick ${sc.saveAt} diverged by tick ${w.state.tick}`);
      }
    }
  } catch (e) {
    return fail('exception', String((e as Error).stack ?? e).split('\n').slice(0, 4).join(' | '));
  }
  const hash = stateHash(w);
  if (opts.rerun) {
    const r2 = runScenario({ ...sc, saveAt: -1 }, { ...opts, rerun: false, timing: false });
    if (r2.hash !== hash && !r2.failure) {
      return { failure: { kind: 'rerundiverge', tick: sc.ticks, detail: `rerun hash ${r2.hash} != ${hash}` }, stats, hash };
    }
  }
  return { failure: null, stats, hash };
}

// --- shrinking -------------------------------------------------------------

/**
 * Delta-debugging style shrink: drop chunks of commands, then single commands, then cut ticks,
 * keeping the scenario only while it still fails with the same kind.
 */
export function shrink(sc: Scenario, kind: FailureKind, opts: RunOptions = {}, log?: (s: string) => void): Scenario {
  const fails = (s: Scenario) => {
    const r = runScenario(s, { ...opts, rerun: kind === 'rerundiverge' });
    return r.failure && r.failure.kind === kind ? r.failure : null;
  };
  let cur = { ...sc, commands: [...sc.commands] };
  let f = fails(cur);
  if (!f) return cur;
  // cut ticks to just after the failure
  cur.ticks = Math.min(cur.ticks, f.tick + 1);
  cur.commands = cur.commands.filter((c) => c.tick < cur.ticks);
  if (cur.saveAt >= cur.ticks) cur.saveAt = -1;
  let chunk = Math.max(1, cur.commands.length >> 1);
  while (chunk >= 1) {
    let changed = false;
    for (let i = 0; i < cur.commands.length; ) {
      const cand = { ...cur, commands: [...cur.commands.slice(0, i), ...cur.commands.slice(i + chunk)] };
      const cf = fails(cand);
      if (cf) {
        cur = cand;
        cur.ticks = Math.min(cur.ticks, cf.tick + 1);
        changed = true;
        log?.(`  shrink: ${cur.commands.length} commands, ${cur.ticks} ticks`);
      } else i += chunk;
    }
    if (!changed) chunk >>= 1;
  }
  // without the save/load clone if it does not matter
  if (cur.saveAt >= 0 && kind !== 'savediverge') {
    const cand = { ...cur, saveAt: -1 };
    if (fails(cand)) cur = cand;
  }
  // smaller coin override is not needed for reproduction; keep it
  f = fails(cur);
  if (f) cur.ticks = f.tick + 1;
  return cur;
}
