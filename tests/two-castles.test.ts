// Mission XVI "Dwa zamki" (research 2026-11-07, in the game since D-288): two castle orders in one mission, the
// castleFirst command (D-289), the seal rule (one set, minus one per castle late on its own deadline), the seal
// ladder, determinism with save/load mid-mission, the save gate and replay reports.
import {
  MISSIONS, STATE_VERSION, TICK_HZ, applyCommand, checkInvariants, createWorld, deserialize, findPath, serialize, stars,
  stateHash, step, type World,
} from '../src/sim/index';
import { M16_MISSION } from '../src/sim/proposals/m16';
import { contractsOf, runningContractOf } from '../src/sim/contract';
import { buildReport, createRecorder, parseReport, recordTick, replay, type TimedCmd } from '../src/sim/replay';
import { gateState, makeEnvelope, parseSave } from '../src/platform/saveGate';
import { migrate } from '../src/platform/save';
import { M16_EXTRA, M16_STRATEGIES, castlesOf, runM16 } from '../tools/bot-m16';
import { assert, eq, test } from './harness';

const min = (m: number): number => Math.round(m * 60 * TICK_HZ);
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

test('m16: registered, two castles on the dry valley, the east castle holds the main contract', () => {
  eq(MISSIONS.m16, M16_MISSION, 'm16 registered');
  const w = createWorld('m16');
  const m = w.state.mission;
  eq(w.state.mapId, 'valley-m3', 'reuses the dry valley');
  eq(checkInvariants(w).length, 0, 'initial goods conserved');
  const castles = w.state.buildings.filter((b) => b.type === 'castle');
  eq(castles.length, 2, 'two castles');
  const [east, north] = castlesOf(w);
  eq(east, castles[0]!.id, 'east castle (first in the list) holds the main contract');
  eq(north, castles[1]!.id, 'north castle holds the extra order');
  eq(castles[0]!.x > castles[1]!.x && castles[1]!.y < castles[0]!.y, true, 'east is east, north is north');
  eq(m.contract!.need.planks, 24, 'east wants 24 planks');
  eq(m.contract!.tranches.length, 1, 'east: one tranche');
  eq(m.contract!.tranches[0]!.deadlineTick, min(5), 'east due by 5:00');
  eq(m.contract!.deadlineTick, min(12), 'the mission ends at 12:00');
  eq(m.contract!.star3Tick, min(7 + 5 / 60), '3 seals by 7:05');
  eq(m.contract!.star2Tick, min(9), '2 seals by 9:00');
  eq(m.extraContracts!.length, 1, 'one further order');
  eq(m.extraContracts![0]!.need.planks, 30, 'north wants 30 planks');
  eq(m.extraContracts![0]!.tranches[0]!.deadlineTick, min(9), 'north due by 9:00');
  assert(!('firstCastle' in m), 'no castle first at the start (even split by fill)');
  for (const b of w.state.buildings) for (const c of castles) {
    if (b !== c) assert(findPath(w, b.gate, c.gate, true), `${b.type} reaches castle ${c.id}`);
  }
  eq(contractsOf(m).length, 2, 'contractsOf lists both');
  eq(runningContractOf(m, north), m.extraContracts![0]!, 'the north castle runs its own order');
});

test('m16: every other mission keeps a single castle order and no new keys', () => {
  for (const id of Object.keys(MISSIONS)) {
    if (id === 'm16') continue;
    const m = createWorld(id).state.mission;
    assert(!('extraContracts' in m) && !('firstCastle' in m), `${id}: no two-castle keys`);
  }
});

test('m16: castleFirst sets, moves and clears the switch; refused elsewhere and for non-castles', () => {
  const w = createWorld('m16');
  const [east, north] = castlesOf(w);
  const before = serialize(w);
  eq(applyCommand(w, { t: 'castleFirst', castle: east }).ok, true, 'east first');
  eq(w.state.mission.firstCastle, east, 'set');
  eq(applyCommand(w, { t: 'castleFirst', castle: north }).ok, true, 'north first');
  eq(w.state.mission.firstCastle, north, 'moved: the other castle loses the mark');
  eq(applyCommand(w, { t: 'castleFirst', castle: -1 }).ok, true, 'cleared');
  eq(serialize(w), before, 'a cleared switch serializes exactly like one never touched');
  const stable = w.state.buildings.find((b) => b.type === 'stable')!.id;
  eq(applyCommand(w, { t: 'castleFirst', castle: stable }).ok, false, 'a stable is no castle');
  eq(applyCommand(w, { t: 'castleFirst', castle: 9999 }).ok, false, 'unknown id');
  eq(applyCommand(w, { t: 'castleFirst', castle: 1.5 }).ok, false, 'not an integer');
  const m15 = createWorld('m15');
  const c15 = m15.state.mission.contract!.castle;
  eq(applyCommand(m15, { t: 'castleFirst', castle: c15 }).ok, false, 'refused in a one-castle mission');
  assert(!('firstCastle' in m15.state.mission), 'm15 untouched');
  const sb = createWorld('sandbox');
  eq(applyCommand(sb, { t: 'castleFirst', castle: -1 }).ok, false, 'refused in the free valley');
});

test('m16: seal ladder nothing 1 / east first 2 / east first + 1 wagon 3; the wrong fixes stay at 1', () => {
  const ladder = M16_STRATEGIES.map((s) => runM16(s));
  for (const r of ladder) {
    eq([...r.commandErrors, ...r.invariantErrors].join('; '), '', `${r.strategy}: clean (invariants and stall reasons every 10 s)`);
    eq(r.result, 'won', r.strategy);
  }
  eq(ladder.map((r) => r.seals).join('/'), '1/2/3', 'ladder');
  eq(ladder[0]!.late, 'E', 'nothing: the east castle is late (even split)');
  eq(ladder[1]!.late, '', 'east first: both on time');
  assert(ladder[1]!.minutes > 7 + 5 / 60, 'the switch alone misses three seals');
  assert(ladder[2]!.minutes <= 7 + 5 / 60 - 15 / 60, 'switch + wagon keeps >= 15 s to three seals');
  const extra = new Map(M16_EXTRA.map((s) => [s.name, runM16(s)]));
  const seals = (n: string): number => extra.get(n)!.seals;
  eq(seals('north first @0:00 (wrong castle)'), 1, 'the wrong castle first: 1');
  eq(seals('+1 wagon @0:30, no switch (wrong fix)'), 1, 'a wagon without the switch: 1');
  eq(seals('east first @2:00 (too late)'), 1, 'the switch at 2:00 is too late: 1');
  eq(seals('east first @1:30'), 2, 'the switch at 1:30 still saves the east letter');
});

test('m16: the north castle late on its own deadline costs a seal (one set, minus one per late castle)', () => {
  const w = createWorld('m16');
  const m = w.state.mission;
  // the east order complete in time, the north one marked late: base seals minus one
  m.result = 'won'; m.endTick = min(6);
  m.extraContracts![0]!.tranches[0]!.missed = true;
  eq(stars(w), 2, '3 by the clock, minus the late north letter');
  m.contract!.tranches[0]!.missed = true;
  eq(stars(w), 1, 'both late: never below one seal for a won mission');
});

test('m16: same commands => same hash; save -> gate -> migrate -> load at 1:00, 3:00 and 5:30 continues bit-identically', () => {
  const strat = M16_STRATEGIES[2]!;
  const ref = runM16(strat);
  eq(runM16(strat).hash, ref.hash, 'deterministic');
  const reload = (w: World): World => {
    const env = makeEnvelope('auto', w.state, 0);
    const v = parseSave(JSON.stringify(env));
    assert(v.ok, 'gate accepts a mission XVI save: ' + (v.ok ? '' : v.errors.map((e) => `${e.code}@${e.path}`).join(', ')));
    const out = migrate(v.ok ? v.envelope : env);
    eq(out.stateVersion, STATE_VERSION, 'current version');
    return deserialize(JSON.stringify(out.state));
  };
  for (const at of [min(1), min(3), min(5.5)]) {
    const r = runM16(strat, at, reload);
    eq(r.hash, ref.hash, `save/load at tick ${at}`);
    eq(r.seals, 3, 'same outcome');
  }
  // with the switch moved to the north castle after a save (state carries firstCastle across the load)
  const w = createWorld('m16');
  applyCommand(w, { t: 'castleFirst', castle: castlesOf(w)[1] });
  for (let i = 0; i < min(2); i++) step(w);
  const copy = deserialize(serialize(w));
  for (let i = 0; i < min(2); i++) { step(w); step(copy); }
  eq(stateHash(copy), stateHash(w), 'firstCastle survives serialize/deserialize');
});

test('m16: the save gate checks extraContracts and firstCastle', () => {
  const w = createWorld('m16');
  applyCommand(w, { t: 'castleFirst', castle: castlesOf(w)[0] });
  for (let i = 0; i < min(1); i++) step(w);
  const base = JSON.parse(serialize(w)) as J;
  const gate = (f: (s: J) => void): ReturnType<typeof gateState> => {
    const s = JSON.parse(JSON.stringify(base)) as J;
    f(s);
    return gateState(s, STATE_VERSION);
  };
  const rejects = (f: (s: J) => void, code: string, what: string): void => {
    const r = gate(f);
    assert(!r.ok && r.errors.some((e) => e.code === code), `${what}: expected ${code}, got ${r.ok ? 'ok' : r.errors.map((e) => `${e.code}@${e.path}`).join(', ')}`);
  };
  eq(gate(() => {}).ok, true, 'a real mission XVI state passes');
  const [east, north] = castlesOf(w);
  const stable = w.state.buildings.find((b) => b.type === 'stable')!.id;
  rejects((s) => { s.mission.firstCastle = stable; }, 'DANGLING_REF', 'firstCastle on the stable');
  rejects((s) => { s.mission.firstCastle = 'east'; }, 'BAD_TYPE', 'firstCastle not a number');
  rejects((s) => { delete s.mission.extraContracts; }, 'INCONSISTENT', 'firstCastle without two orders');
  rejects((s) => { s.mission.extraContracts[0].castle = east; }, 'INCONSISTENT', 'one castle with two orders');
  rejects((s) => { s.mission.extraContracts[0].castle = stable; }, 'DANGLING_REF', 'an order on the stable');
  rejects((s) => { s.mission.extraContracts[0].tranches.push({ ...s.mission.extraContracts[0].tranches[0] }); }, 'OUT_OF_RANGE', 'two tranches');
  rejects((s) => { s.mission.extraContracts = []; }, 'OUT_OF_RANGE', 'empty list');
  rejects((s) => { s.mission.extraContracts = {}; }, 'BAD_TYPE', 'not a list');
  rejects((s) => { s.mission.extraContracts[0].need.planks = -3; }, 'OUT_OF_RANGE', 'negative need');
  rejects((s) => { s.mission.extraContracts[0].tranches[0].missed = 'no'; }, 'BAD_TYPE', 'missed not boolean');
  eq(gate((s) => { s.mission.firstCastle = north; }).ok, true, 'the north castle first is fine');
  const m15 = JSON.parse(serialize(createWorld('m15'))) as J;
  m15.mission.firstCastle = m15.mission.contract.castle;
  const r15 = gateState(m15, STATE_VERSION);
  assert(!r15.ok && r15.errors.some((e) => e.code === 'INCONSISTENT'), 'firstCastle in a one-castle mission is rejected');
});

test('m16: a replay report with castleFirst replays hash for hash', () => {
  const w = createWorld('m16');
  const rec = createRecorder(w);
  const journal: TimedCmd[] = [];
  const plan: [number, () => Parameters<typeof applyCommand>[1]][] = [
    [min(0.2), () => ({ t: 'castleFirst', castle: castlesOf(w)[0] })],
    [min(0.5), () => ({ t: 'buyWagon', stable: w.state.buildings.find((b) => b.type === 'stable')!.id })],
    [min(3), () => ({ t: 'castleFirst', castle: -1 })],
  ];
  while (w.state.tick < min(6)) {
    for (const [at, f] of plan) if (w.state.tick === at) { const cmd = f(); applyCommand(w, cmd); journal.push({ tick: at, cmd }); }
    step(w);
    recordTick(rec, w);
  }
  const rep = buildReport(rec, journal, w, '0.1.0');
  assert(rep.ok, 'report builds: ' + (rep.ok ? '' : rep.errors.join('; ')));
  if (!rep.ok) return;
  eq(rep.value.journal.filter((e) => e.cmd.t === 'castleFirst').length, 2, 'castleFirst kept in the journal');
  const res = replay(rep.value);
  eq(res.ok, true, 'replays bit-identically');
  const bad = parseReport({ ...rep.value, journal: [{ tick: 0, cmd: { t: 'castleFirst', castle: -2 } }] });
  eq(bad.ok, false, 'castle -2 is not a valid report field');
});
