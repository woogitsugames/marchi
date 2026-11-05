// Robustness sweep (research 2026-11-06, docs/research/2026-11-06-robustness.md). Headless, read-only use of the sim.
//   npx tsx tools/robustness.ts [missions|valley|fixtures|all] [--valley-min 150] [--fixture-min 12]
// missions: the best authored strategy of every contract mission I-XIII, played to the end with checkInvariants +
//   unexplainedStalls every tick and a journal of commands; then the journal is replayed with a full save -> load
//   (makeEnvelope -> JSON text -> parseSave (gate) -> migrate -> deserialize) at 1/4, 1/2 and 3/4 of the run, and the
//   state hash is compared to the uninterrupted run every sim minute and at the end.
// valley: the same for the free valley under the DECENT plan + every royal order + every merchant, save -> load right
//   after each rank 0..5 is reached (and once in each winter ice window, the trading post open at rank 4+).
// fixtures: every tests/fixtures save (v6, v7, v8) and synthesized v1..v5 saves migrate to the current version and play
//   on N minutes with invariants every tick.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STATE_VERSION, TICK_HZ, applyCommand, effectsAt, checkInvariants, createWorld, deserialize, sandboxStatus, stateHash, step,
  stoneAvailable, unexplainedStalls, type Command, type World,
} from '../src/sim/index';
import { migrate } from '../src/platform/save';
import { makeEnvelope, parseSave } from '../src/platform/saveGate';
import { plans } from './balance';
import { STRATEGIES as S79 } from './bot-missions-7-9';
import { STRATEGIES as S1012 } from './bot-missions-10-12';
import { M13_STRATEGIES } from './bot-m13';
import { DECENT, type BotStep } from './bot-sandbox';

/** A player: commands for this tick, before step() (may keep its own state in the closure). */
export type Driver = (w: World) => Command[];
export interface Timed { tick: number; cmd: Command }

/** Full load path of the game: envelope, JSON text, gate, migrations, deserialize. */
export function saveLoad(w: World): World {
  const text = JSON.stringify(makeEnvelope('robust', w.state, 0));
  const v = parseSave(text);
  if (!v.ok) throw new Error('gate refused own save: ' + v.errors.map((e) => `${e.code}@${e.path} ${e.detail}`).join('; '));
  return deserialize(JSON.stringify(migrate(v.envelope).state));
}

/** Number of authored strategies of a mission (index -1 = the last, the winning one). */
export function strategyCount(id: string): number {
  if (plans[id]) return plans[id]!.length;
  if (id === 'm7' || id === 'm8' || id === 'm9') return S79[id].length;
  if (id === 'm10' || id === 'm11' || id === 'm12') return S1012[id].length;
  return M13_STRATEGIES.length;
}

export function missionDriver(id: string, k = -1): Driver {
  const at = <T>(xs: readonly T[]): T => xs[k < 0 ? xs.length + k : k]!;
  if (plans[id]) {
    const s = at(plans[id]!);
    return (w) => (w.state.tick === s.at * TICK_HZ ? s.cmds(w) : []);
  }
  if (id === 'm7' || id === 'm8' || id === 'm9') {
    const s = at(S79[id]);
    let setup = false, done = false;
    return (w) => {
      const out: Command[] = [];
      if (s.setup && !setup && w.state.tick >= s.setup.after * TICK_HZ) { out.push(...s.setup.cmds(w)); setup = true; }
      if (!done && w.state.tick >= s.after * TICK_HZ && (s.whenStone === undefined || stoneAvailable(w) >= s.whenStone)) {
        out.push(...s.cmds(w)); done = true;
      }
      return out;
    };
  }
  if (id === 'm10' || id === 'm11' || id === 'm12') {
    const s = at(S1012[id]);
    let done = false;
    return (w) => {
      if (done || w.state.tick < s.after * TICK_HZ) return [];
      done = true;
      return s.cmds(w);
    };
  }
  if (id === 'm13') {
    const s = at(M13_STRATEGIES);
    return (w) => {
      const out: Command[] = [];
      const stable = w.state.buildings.find((b) => b.type === 'stable')!.id;
      for (const [sec, n] of s.buys) if (w.state.tick === sec * TICK_HZ) for (let i = 0; i < n; i++) out.push({ t: 'buyWagon', stable });
      return out;
    };
  }
  throw new Error('no driver for ' + id);
}

/** DECENT (tools/bot-sandbox.ts semantics: one step per second, waits on NO_COINS / NO_STONE) + every order + merchant. */
export function valleyDriver(plan: readonly BotStep[] = DECENT, events = true): Driver {
  let k = 0;
  return (w) => {
    if (w.state.tick % TICK_HZ !== 0) return [];
    const out: Command[] = [];
    if (events && w.state.valleyEvents) {
      const ev = w.state.valleyEvents;
      for (const o of ev.orders) if (!o.accepted) out.push({ t: 'orderAccept', id: o.id });
      if (ev.merchant) out.push({ t: 'merchantSell', id: ev.merchant.id });
    }
    if (k < plan.length) {
      const s = plan[k]!;
      if ((s.rank ?? 0) <= sandboxStatus(w).rank && (s.after ?? 0) * TICK_HZ <= w.state.tick) {
        // probe on a clone so a refused multi-command step is never half applied
        const probe = deserialize(JSON.stringify(w.state));
        let ok = true, skip = false;
        for (const c of s.cmds(probe)) {
          const r = applyCommand(probe, c);
          if (!r.ok) { ok = false; if (r.err.k !== 'NO_COINS' && r.err.k !== 'NO_STONE') skip = true; break; }
        }
        if (ok) { out.push(...s.cmds(w)); k++; } else if (skip) k++;
      }
    }
    return out;
  };
}

export interface RunReport {
  name: string; ticks: number; result: string; hash: string; journal: number; violations: string[];
  cmdErrors: string[]; saveTicks: number[]; diverged: string | null; ms: number; extra: string;
}

/**
 * Reference run (driver, invariants every tick, journal + per-minute hashes) and a journal replay with save -> load
 * at each tick of `saveAt(refWorld)` (ticks chosen from the reference run). Stops at `maxTicks` or the mission end.
 */
export function verifyRun(name: string, make: () => World, driver: Driver, maxTicks: number,
  pickSaves: (w: World, tick: number) => boolean, extra?: (w: World) => string): RunReport {
  const t0 = performance.now();
  const w = make();
  const journal: Timed[] = [];
  const hashes = new Map<number, string>();
  const violations: string[] = [];
  const cmdErrors: string[] = [];
  const saveTicks: number[] = [];
  hashes.set(0, stateHash(w));
  while (w.state.tick < maxTicks && w.state.mission.result === 'running') {
    if (pickSaves(w, w.state.tick) && w.state.tick > 0) saveTicks.push(w.state.tick);
    for (const cmd of driver(w)) {
      journal.push({ tick: w.state.tick, cmd });
      const r = applyCommand(w, cmd);
      if (!r.ok && r.err.k !== 'NO_SURPLUS' && cmdErrors.length < 10) cmdErrors.push(`${w.state.tick}: ${cmd.t} ${r.err.k}`);
    }
    step(w);
    const v = [...checkInvariants(w), ...unexplainedStalls(w)];
    if (v.length && violations.length < 10) violations.push(`tick ${w.state.tick}: ${v.slice(0, 3).join('; ')}`);
    if (w.state.tick % (60 * TICK_HZ) === 0) hashes.set(w.state.tick, stateHash(w));
  }
  const endTick = w.state.tick;
  const finalHash = stateHash(w);
  // replay with save/load
  let r = make();
  let j = 0, diverged: string | null = null;
  const saves = new Set(saveTicks);
  while (r.state.tick < endTick) {
    if (saves.has(r.state.tick)) r = saveLoad(r);
    while (j < journal.length && journal[j]!.tick === r.state.tick) applyCommand(r, journal[j++]!.cmd);
    step(r);
    const h = hashes.get(r.state.tick);
    if (h !== undefined && h !== stateHash(r)) { diverged = `tick ${r.state.tick} (saves at ${saveTicks.join(',')})`; break; }
  }
  if (!diverged && stateHash(r) !== finalHash) diverged = 'final hash';
  return {
    name, ticks: endTick, result: w.state.mission.result, hash: finalHash, journal: journal.length, violations, cmdErrors,
    saveTicks, diverged, ms: performance.now() - t0, extra: extra ? extra(w) : '',
  };
}

export const MISSION_IDS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12', 'm13'];

export function verifyMission(id: string, k = -1): RunReport {
  // length of the reference run first (cheap, no checks), to place saves at 1/4, 1/2, 3/4 (+ inside an ice window)
  const probe = createWorld(id);
  const d0 = missionDriver(id, k);
  while (probe.state.mission.result === 'running' && probe.state.tick < 4 * 3600 * TICK_HZ) {
    for (const c of d0(probe)) applyCommand(probe, c);
    step(probe);
  }
  const end = probe.state.tick;
  const marks = new Set([Math.floor(end / 4), Math.floor(end / 2), Math.floor((3 * end) / 4)]);
  const ice = probe.state.ice[0];
  if (ice && ice.start + 7 < end) marks.add(ice.start + 7);
  return verifyRun(k < 0 ? id : `${id}#${k}`, () => createWorld(id), missionDriver(id, k), end + 1, (_w, t) => marks.has(t),
    (w) => `seals=${w.state.mission.result}`);
}

export function verifyValley(minutes: number): RunReport {
  let lastRank = -1;
  let winterMark = -1;
  return verifyRun('sandbox', () => createWorld('sandbox'), valleyDriver(), minutes * 60 * TICK_HZ,
    (w, t) => {
      const rank = sandboxStatus(w).rank;
      let hit = false;
      if (rank !== lastRank) { lastRank = rank; winterMark = t + 37; } // just after reaching the rank (and at start)
      if (t === winterMark) hit = true;
      // inside every winter ice window (bridges closed) once
      for (const win of [...w.state.ice, ...effectsAt(t).iceWindows]) if (t === win.start + 11) hit = true;
      // and in the spring thaw (mud), once
      const thaw = effectsAt(t).thawWindow;
      if (thaw && t === thaw.start + 13) hit = true;
      return hit;
    },
    (w) => {
      const st = sandboxStatus(w);
      const tp = w.state.tradePost;
      return `rank=${st.rank} rankMin=${st.rankTicks.map((x) => (x < 0 ? '-' : (x / TICK_HZ / 60).toFixed(0))).join('/')} wagons=${w.state.wagons.length} ` +
        `post sold=${tp ? Object.values(tp.sold).reduce((a, b) => a + b, 0) : 'none'} earned=${tp ? (tp.earnedCents / 100).toFixed(0) : '-'}`;
    });
}

// --- fixtures --------------------------------------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));

export function fixtureFiles(): string[] {
  const dir = join(here, '..', 'tests', 'fixtures');
  return readdirSync(dir).filter((f) => /^save-v\d+.*\.json$/.test(f)).map((f) => join(dir, f));
}

/** Gate + migrate an envelope text, then play `minutes` with invariants every tick. */
export function playMigrated(text: string, minutes: number, driver?: Driver): { from: number; violations: string[]; hash: string; ticks: number } {
  const v = parseSave(text);
  if (!v.ok) throw new Error('gate: ' + v.errors.map((e) => `${e.code}@${e.path} ${e.detail}`).join('; '));
  const from = v.envelope.stateVersion;
  const out = migrate(v.envelope);
  if (out.stateVersion !== STATE_VERSION) throw new Error('not migrated');
  const w = deserialize(JSON.stringify(out.state));
  const violations: string[] = [];
  const v0 = [...checkInvariants(w), ...unexplainedStalls(w)];
  if (v0.length) violations.push('after migration: ' + v0.join('; '));
  const end = w.state.tick + minutes * 60 * TICK_HZ;
  while (w.state.tick < end && w.state.mission.result === 'running') {
    if (driver) for (const c of driver(w)) applyCommand(w, c);
    step(w);
    const v1 = [...checkInvariants(w), ...unexplainedStalls(w)];
    if (v1.length && violations.length < 10) violations.push(`tick ${w.state.tick}: ${v1.slice(0, 3).join('; ')}`);
  }
  return { from, violations, hash: stateHash(w), ticks: w.state.tick };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (n: string, d: number) => { const i = args.indexOf('--' + n); return i >= 0 ? Number(args[i + 1]) : d; };
  const what = args.find((a) => !a.startsWith('--') && isNaN(Number(a))) ?? 'all';
  let bad = 0;
  const print = (r: RunReport) => {
    const ok = !r.violations.length && !r.diverged;
    if (!ok) bad++;
    console.log(`${r.name.padEnd(8)} ${r.result.padEnd(7)} ${(r.ticks / TICK_HZ / 60).toFixed(1).padStart(6)} min journal=${r.journal} hash=${r.hash} ` +
      `saves@${r.saveTicks.join(',')} ${r.diverged ? 'DIVERGED ' + r.diverged : 'bit-identical'} ${r.extra} ${(r.ms / 1000).toFixed(1)}s` +
      (r.cmdErrors.length ? ` cmdErr=${r.cmdErrors.join('|')}` : '') + (r.violations.length ? '\n   VIOLATIONS ' + r.violations.join('\n   ') : ''));
  };
  if (what === 'missions' || what === 'all') for (const id of MISSION_IDS) for (let k = 0; k < strategyCount(id); k++) print(verifyMission(id, k));
  if (what === 'valley' || what === 'all') print(verifyValley(opt('valley-min', 150)));
  if (what === 'fixtures' || what === 'all') {
    for (const f of fixtureFiles()) {
      const r = playMigrated(readFileSync(f, 'utf8'), opt('fixture-min', 12));
      if (r.violations.length) bad++;
      console.log(`fixture ${f.split('/').pop()} v${r.from} -> v${STATE_VERSION} ${(r.ticks / TICK_HZ / 60).toFixed(1)} min ${r.violations.length ? 'VIOLATIONS ' + r.violations.join(' | ') : 'clean'}`);
    }
  }
  console.log(bad ? `FAILED ${bad}` : 'ALL CLEAN');
  process.exit(bad ? 1 : 0);
}
