// Mission XVII "Drewno na dwa listy" (D-356..D-359): two castles want different goods made from one woodcutter's wood.
// The chainFirst command (the castle first with its whole supply chain), the chain lift in the dispatcher, the new
// stall reason NO_INPUT.CHAIN_FIRST, the castle card's chain line (castleChainRival), the seal ladder of the three
// strategies (nothing / castle leg only / whole chain), determinism with save/load mid-mission and the save gate.
import {
  MISSIONS, STATE_VERSION, TICK_HZ, applyCommand, castleChainRival, castleForecast, chainLift, chainShops, checkInvariants, createWorld,
  deserialize, explainBuilding, newPaceLog, serialize, stateHash, step, type World,
} from '../src/sim/index';
import { M17_MISSION } from '../src/sim/proposals/m17';
import { gateState } from '../src/platform/saveGate';
import { cleanCommand } from '../src/sim/replay';
import { M17_EXTRA, M17_STRATEGIES, castlesOf, eastChain, runM17 } from '../tools/bot-m17';
import { castlesOf as castlesOf16 } from '../tools/bot-m16';
import { pl } from '../src/i18n/pl';
import { en } from '../src/i18n/en';
import { assert, eq, test } from './harness';

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const min = (m: number): number => Math.round(m * 60 * TICK_HZ);
const typeId = (w: World, t: string): number => w.state.buildings.find((b) => b.type === t)!.id;

test('m17: registered after XVI, two castles, one woodcutter for the sawmill and the charcoal burner', () => {
  eq(MISSIONS.m17, M17_MISSION, 'm17 registered');
  eq(M17_MISSION.chainPriority, true, 'the mission offers the chain switch');
  const w = createWorld('m17');
  eq(w.state.buildings.filter((b) => b.type === 'woodcutter').length, 1, 'one woodcutter');
  const m = w.state.mission;
  const [east, north] = castlesOf(w);
  eq(m.contract!.need.planks, 24, 'east: 24 planks');
  eq(m.extraContracts![0]!.need.charcoal, 6, 'north: 6 charcoal');
  eq(m.contract!.tranches[0]!.deadlineTick, min(5.5), 'east due 5:30');
  eq(m.extraContracts![0]!.tranches[0]!.deadlineTick, min(8), 'north due 8:00');
  assert(east !== north && !('firstCastle' in m) && !('chainFirst' in m), 'nobody first at the start');
});

test('m17: chainFirst sets the castle and the chain; castleFirst drops the chain; -1 clears both; refused elsewhere', () => {
  const w = createWorld('m17');
  const [east, north] = castlesOf(w);
  const before = serialize(w);
  eq(applyCommand(w, { t: 'chainFirst', castle: east }).ok, true, 'east chain first');
  eq(w.state.mission.firstCastle, east, 'castle set');
  eq(w.state.mission.chainFirst, true, 'chain set');
  eq(applyCommand(w, { t: 'castleFirst', castle: north }).ok, true, 'north castle leg');
  eq(w.state.mission.firstCastle, north, 'moved');
  assert(!('chainFirst' in w.state.mission), 'the castle leg switch drops the chain');
  eq(applyCommand(w, { t: 'chainFirst', castle: north }).ok, true, 'north chain');
  eq(applyCommand(w, { t: 'chainFirst', castle: -1 }).ok, true, 'cleared');
  eq(serialize(w), before, 'a cleared switch serializes exactly like one never touched');
  eq(applyCommand(w, { t: 'chainFirst', castle: typeId(w, 'stable') }).ok, false, 'a stable is no castle');
  eq(applyCommand(w, { t: 'chainFirst', castle: 2.5 }).ok, false, 'not an integer');
  const m16 = createWorld('m16');
  eq(applyCommand(m16, { t: 'chainFirst', castle: castlesOf16(m16)[0] }).ok, false, 'refused in XVI (no chainPriority)');
  assert(!('firstCastle' in m16.state.mission), 'm16 untouched');
  const m15 = createWorld('m15');
  eq(applyCommand(m15, { t: 'chainFirst', castle: m15.state.mission.contract!.castle }).ok, false, 'refused in a one-castle mission');
  // replay reports carry the command (allowlisted, type-checked)
  const c = cleanCommand({ t: 'chainFirst', castle: east }, true);
  assert(c.ok && c.value.t === 'chainFirst', 'chainFirst is a replayable command');
});

test('m17: the seal ladder — nothing 2, the castle leg only no better, the whole chain 3 (D-357)', () => {
  const [nothing, leg, chain] = M17_STRATEGIES.map((s) => runM17(s));
  for (const r of [nothing!, leg!, chain!]) {
    eq(r.result, 'won', `${r.strategy}: won`);
    eq(r.commandErrors.length + r.invariantErrors.length, 0, `${r.strategy}: clean (${[...r.commandErrors, ...r.invariantErrors].join('; ')})`);
  }
  eq(nothing!.seals, 2, 'nothing: 2 seals');
  eq(nothing!.late, 'E', 'nothing: the east letter is late');
  eq(leg!.seals, 2, 'castle leg only: 2 seals');
  eq(leg!.late, 'E', 'castle leg only: the east letter still late (planks lack wood, not wagons)');
  assert(leg!.minutes >= nothing!.minutes && leg!.eastDone >= nothing!.eastDone, 'the castle leg switch does not help');
  eq(chain!.seals, 3, 'whole chain: 3 seals');
  eq(chain!.late, '', 'whole chain: both letters on time');
  assert(chain!.eastDone < nothing!.eastDone - 2, `the chain brings the planks minutes earlier (${chain!.eastDone} vs ${nothing!.eastDone})`);
  const extra = Object.fromEntries(M17_EXTRA.map((s) => [s.name, runM17(s)]));
  eq(extra['east chain first @2:00']!.seals, 3, 'decision window: the chain at 2:00 still saves the east letter');
  eq(extra['east chain first @3:00']!.late, 'E', 'at 3:00 it is too late');
  eq(extra['north chain first @0:00 (wrong castle)']!.seals, 1, 'the wrong castle first: 1 seal');
  eq(extra['+2 wagons @0:30, no switch']!.seals, 2, 'wagons do not fix it');
});

test('m17: CHAIN_FIRST — the burner waits while the wood goes to the sawmill for the east castle; explained to the root', () => {
  const w = createWorld('m17');
  const [east] = castlesOf(w);
  const saw = typeId(w, 'sawmill'), burner = typeId(w, 'charcoalBurner');
  applyCommand(w, { t: 'chainFirst', castle: east });
  eq(chainLift(w).join(), String(saw), 'the sawmill is lifted at the start');
  eq(chainShops(w).join(), [typeId(w, 'woodcutter'), saw].sort((a, b) => a - b).join(), 'the east chain: the woodcutter and the sawmill');
  let seen = 0, liftEnded = -1;
  while (w.state.mission.result === 'running' && w.state.tick < min(6)) {
    step(w);
    const s = w.state.buildings.find((b) => b.id === burner)!.status;
    if (s.k === 'NO_INPUT' && s.cause === 'CHAIN_FIRST') {
      seen++;
      eq(s.blockedBy, saw, 'blocked by the sawmill');
      const chain = explainBuilding(w, burner);
      eq(chain[0]!.id, burner, 'the chain starts at the burner');
      if (chain[1]) eq(chain[1].id, saw, 'and goes on to the sawmill');
    }
    if (liftEnded < 0 && chainLift(w).length === 0) liftEnded = w.state.tick;
    if (w.state.tick % 50 === 0) eq(checkInvariants(w).length, 0, 'invariants');
  }
  assert(seen > 10 * TICK_HZ, `the burner read CHAIN_FIRST for a while (${seen / TICK_HZ} s)`);
  assert(liftEnded > 0 && liftEnded < min(2), `the lift ends once the sawmill holds the wood for the order (${liftEnded / TICK_HZ} s)`);
  for (const k of ['status.NO_INPUT.CHAIN_FIRST', 'cause.NO_INPUT.CHAIN_FIRST', 'status.NO_INPUT.CHAIN_FIRST.to'] as const) {
    assert(pl[k] && en[k], `${k} in pl and en`);
  }
  // no chain switch: the cause never appears (every other mission and the even split)
  const v = createWorld('m17');
  for (let i = 0; i < min(4); i++) {
    step(v);
    for (const b of v.state.buildings) assert(!(b.status.k === 'NO_INPUT' && b.status.cause === 'CHAIN_FIRST'), 'no CHAIN_FIRST without the switch');
  }
});

test('m17: the castle card line — a castle\'s producer stands idle while the other chain takes the wood; never in XVI', () => {
  const w = createWorld('m17');
  const [east, north] = castlesOf(w);
  const saw = typeId(w, 'sawmill'), burner = typeId(w, 'charcoalBurner');
  let eastLines = 0, northLines = 0;
  applyCommand(w, { t: 'chainFirst', castle: east });
  while (w.state.mission.result === 'running' && w.state.tick < min(5)) {
    step(w);
    if (w.state.tick % 10) continue;
    const rn = castleChainRival(w, north);
    if (rn) { northLines++; eq(rn.producer, burner, 'north: its burner'); eq(rn.rival, saw, 'the sawmill takes the wood'); eq(rn.castle, east, 'for the east castle'); eq(rn.input, 'wood', 'wood'); eq(rn.good, 'planks', 'planks'); }
    const re = castleChainRival(w, east);
    if (re) { eastLines++; eq(re.producer, saw, 'east: its sawmill'); }
  }
  assert(northLines > 0, `the north castle card names the east chain (${northLines} samples)`);
  void eastLines;
  const v = createWorld('m16');
  for (let i = 0; i < min(4); i++) {
    step(v);
    if (i % 20) continue;
    for (const c of castlesOf16(v)) eq(castleChainRival(v, c), null, 'XVI: one good, one producer — no chain line');
  }
});

test('m17: the castle forecast splits the shared wood — late at the even split, on time first with the chain', () => {
  const w = createWorld('m17');
  const [east] = castlesOf(w);
  const log = newPaceLog();
  for (let i = 0; i < min(0.5); i++) step(w);
  const fc = castleForecast(w, log, east)!;
  assert(fc.finishTick > fc.dueTick, `even split: forecast late (${fc.finishTick / 600} > ${fc.dueTick / 600})`);
  assert(fc.firstTick >= 0 && fc.firstTick <= fc.dueTick, `first with the chain: on time (${fc.firstTick / 600})`);
});

test('m17: determinism — every ladder run twice and through save/load at 2:00 gives the same hash', () => {
  for (const s of [...M17_STRATEGIES, M17_EXTRA.find((x) => x.name === 'east chain first, back to even @3:00')!]) {
    const a = runM17(s), b = runM17(s);
    eq(a.hash, b.hash, `${s.name}: same hash twice`);
    const c = runM17(s, min(2), (w) => deserialize(serialize(w)));
    eq(c.hash, a.hash, `${s.name}: save/load at 2:00 changes nothing`);
  }
  // the chain state survives a save
  const w = createWorld('m17');
  for (const cmd of eastChain(w)) applyCommand(w, cmd);
  for (let i = 0; i < min(1); i++) step(w);
  eq(stateHash(deserialize(serialize(w))), stateHash(w), 'chainFirst survives serialize/deserialize');
});

test('m17: the save gate checks chainFirst', () => {
  const w = createWorld('m17');
  applyCommand(w, { t: 'chainFirst', castle: castlesOf(w)[0] });
  for (let i = 0; i < min(1); i++) step(w);
  const base = JSON.parse(serialize(w)) as J;
  const gate = (f: (s: J) => void): ReturnType<typeof gateState> => {
    const s = JSON.parse(JSON.stringify(base)) as J;
    f(s);
    return gateState(s, STATE_VERSION);
  };
  eq(gate(() => {}).ok, true, 'a real mission XVII state passes');
  const bad = (f: (s: J) => void, code: string, what: string): void => {
    const r = gate(f);
    assert(!r.ok && r.errors.some((e) => e.code === code), `${what}: expected ${code}`);
  };
  bad((s) => { s.mission.chainFirst = false; }, 'BAD_TYPE', 'chainFirst false');
  bad((s) => { s.mission.chainFirst = 1; }, 'BAD_TYPE', 'chainFirst 1');
  bad((s) => { delete s.mission.firstCastle; }, 'INCONSISTENT', 'a chain without a castle first');
});

test('m17: appended to the menu as XVII after XVI (no renumbering)', async () => {
  const { readFileSync } = await import('node:fs');
  const menu = readFileSync(new URL('../src/ui/menu.ts', import.meta.url), 'utf8');
  assert(/MENU_MISSIONS = \[[^\]]*'m15', 'm16', 'm17'\] as const/.test(menu) && /'XV', 'XVI', 'XVII'\]/.test(menu), 'appended as XVII');
});
