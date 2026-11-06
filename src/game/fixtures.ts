// Playtest fixtures (docs/playtest/PROTOCOL.md, D-185): `?fixture=<id>&debug=1` starts a mission and plays
// the real simulation from tick 0 with the mission's own seed and a fixed command script until the stall the
// scenario is about holds, then pauses there. No state is edited by hand: every unit of goods, every
// reservation and every status comes out of step()/applyCommand(), so the ledger and invariants stay true.
// The stop tick is found by a predicate, but the run is deterministic, so it is the same tick every time
// (tests/playtest-fixtures.test.ts pins that). After the run checkFixture() validates the result; a failure is
// shown to the moderator as "invalid setup" (the protocol says such a case is not scored).
// Game code, not tools: the app imports it (D-51). Pure sim reads and commands only (no DOM).
import {
  TICK_HZ, applyCommand, busyOutOfReach, buildingById, checkInvariants, heldWagon, reachable, step, sumGoods,
  unexplainedStalls, type Building, type Command, type CommandResult, type Wagon, type World,
} from '../sim/index';
import { storeCapOf } from '../sim/contract';
import { calmWhy, rankStalls } from '../ui/stalls';

export const FIXTURE_IDS = ['bridge-cut-in-transit', 'all-busy', 'bridge-jam', 'warehouse-full'] as const;
export type FixtureId = (typeof FIXTURE_IDS)[number];
/** Bump when a script or a check changes: the moderator notes it with the results (PROTOCOL §3). */
export const FIXTURE_VERSION = 2;

export function isFixtureId(x: string | null | undefined): x is FixtureId {
  return (FIXTURE_IDS as readonly string[]).includes(x ?? '');
}

/** What the scenario is about: the card the protocol's preflight checks (and `openId`/`wagonId` open). */
export interface FixtureFocus { kind: 'building' | 'wagon'; id: number }

export interface FixtureOutcome {
  id: FixtureId;
  mission: FixtureMission;
  version: number;
  /** The validation passed; otherwise `problem` says why (English, for the moderator's log). */
  ok: boolean;
  problem: string | null;
  focus: FixtureFocus | null;
  tick: number;
}

/** How the fixture reaches the world: the app routes it through its GameLoop, the tests straight to the sim. */
export interface FixtureDriver {
  world(): World;
  command(cmd: Command): CommandResult;
  tick(): void;
}

/** Headless driver (tests, tools): applyCommand + step on one world. */
export function simDriver(w: World): FixtureDriver {
  return { world: () => w, command: (c) => applyCommand(w, c), tick: () => step(w) };
}

export type FixtureMission = 'm2' | 'm6';

/** S6 moved from mission I to mission VI (D-197, owner 2026-11-06): its granary fills by itself there. */
export function fixtureMission(id: FixtureId): FixtureMission {
  return id === 'warehouse-full' ? 'm6' : 'm2';
}

/** The predicate must hold this many ticks in a row before the run stops (no one-tick flickers). */
const HOLD_TICKS = TICK_HZ;
/** Mission II's only crossing: column x = 51, rows 30..42 (PROTOCOL S2). */
const isBridge = (w: World, c: number): boolean => w.terrain.water[c] === 1 && w.state.roads[c]! > 0;

interface Script {
  /** Commands before the first tick (all at tick 0). */
  start(w: World): Command[];
  /** Called every tick before the stop check; may return commands to apply now (the bridge cut). */
  during?(w: World): Command[];
  /** The subject when the scenario holds, else null. */
  holds(w: World): FixtureFocus | null;
  maxTicks: number;
}

/** A wagon carrying goods whose remaining route crosses the bridge, standing on dry land before it. */
function crossingWagon(w: World): { wagon: Wagon; cut: number } | null {
  for (const q of w.state.wagons) {
    if (!q.job || q.job.phase !== 'dropoff' || q.next < 0 || isBridge(w, q.at) || isBridge(w, q.next)) continue;
    const ahead = q.path.filter((c) => isBridge(w, c));
    // the span's middle cell on its route, if no wagon stands on or enters it
    const free = ahead.filter((c) => w.state.wagons.every((o) => o.at !== c && o.next !== c));
    if (ahead.length >= 3 && free.length) return { wagon: q, cut: free[free.length >> 1]! };
  }
  return null;
}

function scripts(id: FixtureId): Script {
  switch (id) {
    case 'bridge-cut-in-transit': {
      // S2: mission II plays itself; the first time a loaded wagon heads for the bridge, one free span cell
      // is demolished (the player's demolish command); 2 s later the wagon must stand in NO_ROUTE.
      let cutAt = -1, wagon = -1;
      return {
        start: () => [],
        during(w) {
          if (cutAt >= 0 || w.state.tick < 30 * TICK_HZ) return [];
          const c = crossingWagon(w);
          if (!c) return [];
          cutAt = w.state.tick;
          wagon = c.wagon.id;
          return [{ t: 'demolish', cell: c.cut }];
        },
        holds(w) {
          if (cutAt < 0 || w.state.tick - cutAt < 2 * TICK_HZ) return null;
          const q = w.state.wagons.find((o) => o.id === wagon);
          return q && q.status.k === 'NO_ROUTE' ? { kind: 'wagon', id: q.id } : null;
        },
        maxTicks: 240 * TICK_HZ,
      };
    }
    case 'all-busy':
      // S3: mission II as dealt (seven wagons) runs into a moment where every wagon has a job and a
      // workshop waits for a reachable input: no commands needed.
      return { start: () => [], holds: allBusy, maxTicks: 300 * TICK_HZ };
    case 'bridge-jam':
      // S4: mission II as dealt; the one-lane wooden bridge queues a wagon behind oncoming traffic.
      return {
        start: () => [],
        holds(w) {
          const q = w.state.wagons.find((o) => o.status.k === 'BRIDGE_JAM' && w.state.tick - o.status.since >= 2 * TICK_HZ);
          return q ? { kind: 'wagon', id: q.id } : null;
        },
        maxTicks: 300 * TICK_HZ,
      };
    case 'warehouse-full':
      // S6 (D-197): mission VI as dealt, no commands. Three farms out-grow the one mill and fill the small
      // granary (capacity 12) with grain; the large one is not on the road yet. The run stops once the small
      // granary's stock (not only loads on their way in) fills it, the sawmill's full yard waits for that
      // granary, and the HUD's worst-stall card names it (critical, not a calm full). About 2:20 of play,
      // before the first letter's bread is in: a full store is the root, no cut road or other building is.
      return { start: () => [], holds: smallGranaryFull, maxTicks: 400 * TICK_HZ };
  }
}

/** Mission VI's small granary (capOverride 12), if any. */
function smallGranary(w: World): Building | undefined {
  return w.state.buildings.find((b) => b.type === 'warehouse' && b.capOverride >= 0);
}

function smallGranaryFull(w: World): FixtureFocus | null {
  const g = smallGranary(w);
  if (!g || g.status.k !== 'STORAGE_FULL' || sumGoods(g.stock) < storeCapOf(g)) return null;
  if (!w.state.buildings.some((b) => b.type === 'sawmill' && b.status.k === 'OUTPUT_FULL' && b.status.blockedBy === g.id)) return null;
  const top = rankStalls(w)[0];
  return top && top.id === g.id && top.crit && !top.minor ? { kind: 'building', id: g.id } : null;
}

function allBusy(w: World): FixtureFocus | null {
  for (const b of w.state.buildings) {
    if (b.status.k !== 'NO_WAGON' || b.status.cause !== 'ALL_BUSY') continue;
    if (busyOutOfReach(w, b.id) !== -1 || heldWagon(w, b.gate) !== -1) continue;
    if (!reachableSource(w, b)) continue;
    return { kind: 'building', id: b.id };
  }
  return null;
}

/** A building holding spare units of the good `b` waits for, on the same roads. */
function reachableSource(w: World, b: Building): boolean {
  if (b.status.k !== 'NO_WAGON') return false;
  const g = b.status.good;
  return w.state.buildings.some((s) => s.id !== b.id && s.stock[g] - s.reservedOut[g] > 0 && reachable(w, s.gate, b.gate));
}

/**
 * Plays the fixture's script through `d` from the mission start until the scenario has held HOLD_TICKS ticks
 * in a row (or maxTicks), then validates. `d.world()` must be a fresh createWorld(fixtureMission(id)).
 */
export function runFixture(id: FixtureId, d: FixtureDriver): FixtureOutcome {
  const s = scripts(id);
  const w = d.world();
  const fail = (problem: string, focus: FixtureFocus | null = null): FixtureOutcome =>
    ({ id, mission: fixtureMission(id), version: FIXTURE_VERSION, ok: false, problem, focus, tick: w.state.tick });
  if (w.state.mission.id !== fixtureMission(id) || w.state.tick !== 0) return fail(`needs a fresh ${fixtureMission(id)}`);
  for (const c of s.start(w)) {
    const r = d.command(c);
    if (!r.ok) return fail(`start command ${c.t} refused: ${r.err.k}`);
  }
  let held = 0, focus: FixtureFocus | null = null;
  while (w.state.tick < s.maxTicks && w.state.mission.result === 'running') {
    for (const c of s.during?.(w) ?? []) {
      const r = d.command(c);
      if (!r.ok) return fail(`command ${c.t} refused: ${r.err.k}`);
    }
    d.tick();
    const f = s.holds(w);
    held = f && focus && f.kind === focus.kind && f.id === focus.id ? held + 1 : f ? 1 : 0;
    focus = f;
    if (held >= HOLD_TICKS) break;
  }
  if (held < HOLD_TICKS) return fail(`scenario not reached by tick ${w.state.tick} (${w.state.mission.result})`);
  const problem = checkFixture(id, w, focus);
  return problem ? fail(problem, focus) : { id, mission: fixtureMission(id), version: FIXTURE_VERSION, ok: true, problem: null, focus, tick: w.state.tick };
}

/**
 * The preflight of PROTOCOL §3 as code: null when the world shows the scenario, else what is wrong.
 * Also usable on a world the moderator prepared by hand.
 */
export function checkFixture(id: FixtureId, w: World, focus: FixtureFocus | null): string | null {
  const st = w.state;
  if (st.mission.id !== fixtureMission(id)) return `mission ${st.mission.id}, expected ${fixtureMission(id)}`;
  if (st.mission.result !== 'running') return `mission already ${st.mission.result}`;
  const inv = checkInvariants(w);
  if (inv.length) return `invariant: ${inv[0]}`;
  const unexplained = unexplainedStalls(w);
  if (unexplained.length) return `unexplained stall: ${unexplained[0]}`;
  if (!focus) return 'no subject';
  const wagon = focus.kind === 'wagon' ? st.wagons.find((q) => q.id === focus.id) : undefined;
  const b = focus.kind === 'building' ? buildingById(w, focus.id) : undefined;
  switch (id) {
    case 'bridge-cut-in-transit': {
      if (!wagon) return `wagon ${focus.id} missing`;
      if (wagon.status.k !== 'NO_ROUTE') return `wagon ${wagon.id} is ${wagon.status.k}, expected NO_ROUTE`;
      if (!wagon.job || wagon.cargoQty <= 0) return `wagon ${wagon.id} carries nothing`;
      const to = buildingById(w, wagon.job.to);
      if (!to) return `wagon ${wagon.id} has no destination`;
      if (reachable(w, wagon.at, to.gate)) return `destination ${to.id} still reachable`;
      return null;
    }
    case 'all-busy': {
      if (!b) return `building ${focus.id} missing`;
      if (b.status.k !== 'NO_WAGON' || b.status.cause !== 'ALL_BUSY') return `building ${b.id} is ${b.status.k}, expected NO_WAGON/ALL_BUSY`;
      if (st.wagons.some((q) => !q.job)) return 'a wagon is free';
      if (busyOutOfReach(w, b.id) !== -1) return 'the input lies out of the wagons\' reach';
      if (heldWagon(w, b.gate) !== -1) return 'the fleet is held at a bridge or cut off';
      if (!reachableSource(w, b)) return 'no reachable source of the input';
      return null;
    }
    case 'bridge-jam': {
      if (!wagon) return `wagon ${focus.id} missing`;
      if (wagon.status.k !== 'BRIDGE_JAM') return `wagon ${wagon.id} is ${wagon.status.k}, expected BRIDGE_JAM`;
      const blocker = wagon.status.blocker;
      if (!st.wagons.some((q) => q.id === blocker)) return `blocker ${blocker} missing`;
      return null;
    }
    case 'warehouse-full': {
      if (!b || b.type !== 'warehouse') return `building ${focus.id} is not a granary`;
      if (b.status.k !== 'STORAGE_FULL') return `granary is ${b.status.k}, expected STORAGE_FULL`;
      // a real full store: its own stock fills it (not only loads booked on their way in)
      if (sumGoods(b.stock) < storeCapOf(b)) return `granary stock ${sumGoods(b.stock)}/${storeCapOf(b)}`;
      if (calmWhy(w, b) !== null) return `granary is a calm full (${calmWhy(w, b)})`;
      if (!st.buildings.some((q) => q.status.k === 'OUTPUT_FULL' && q.status.blockedBy === b.id)) return 'no producer waits for the granary';
      const top = rankStalls(w)[0];
      if (!top || top.id !== b.id || !top.crit) return `worst-stall card shows ${top ? top.id : 'nothing'}, expected the granary ${b.id}`;
      return null;
    }
  }
}
