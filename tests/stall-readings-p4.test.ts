// P4 stall readings (D-710..D-713): a castle whose producer's input is already booked on a busy wagon is a calm pin
// naming that wagon (D-710); the first seconds of a wagon at a span, or ice that clears by itself where no stone
// bridge can be offered, read calm (D-711); a grey cure for silver in a contract mission says that no silver comes in
// and what will do instead (D-712); a delivery wagon whose road cannot be rebuilt names the building to take back (D-713).
import { TICK_HZ, applyCommand, blockingBuilding, buildingById, missionBuildable, step, type Building, type World } from '../src/sim/index';
import { briefHold, cureFor, gapSuggestion, gapTarget, heldSpanFor, inputDueUpstream, rankStalls, routeBlocker, routeLostFor, sampleInputWaits, silverShort } from '../src/ui/stalls';
import { createWorld, explainBuilding, net, reachable } from '../src/sim/index';
import { generateScenario, makeWorld } from '../tools/fuzz-lib';
import { pl, PENDING_KEYS } from '../src/i18n/pl';
import { en } from '../src/i18n/en';
import { assert, eq, test } from './harness';

/** A fuzz game (tools/fuzz-lib, as tools/dead-end-scan.ts plays it) up to `sec`; the commands of later ticks unplayed. */
function fuzzAt(mission: string, seed: number, sec: number, ownCoins = false): World {
  const sc = generateScenario(seed, { ticks: 9000, missions: [mission] });
  const can = missionBuildable(sc.mission);
  const cmds = [...sc.commands].filter(({ cmd }) => cmd.t !== 'place' || can === 'ranked' || can.includes(cmd.type)).sort((a, b) => a.tick - b.tick);
  const w = makeWorld(sc.mission, ownCoins ? null : sc.coins);
  let k = 0;
  while (w.state.tick < sec * TICK_HZ) {
    while (k < cmds.length && cmds[k]!.tick === w.state.tick) applyCommand(w, cmds[k++]!.cmd);
    step(w);
    sampleInputWaits(w);
  }
  return w;
}
const typeOf = (w: World, t: string): Building => w.state.buildings.find((b) => b.type === t)!;
const entry = (w: World, id: number) => rankStalls(w).find((e) => e.id === id);

test('D-710: I — the castle behind the bakery whose flour is booked on a busy wagon is a calm pin naming it', () => {
  const w = fuzzAt('m1', 58, 499);
  const castle = typeOf(w, 'castle'), bakery = typeOf(w, 'bakery');
  assert(castle.status.k === 'NO_INPUT' && castle.status.cause === 'NONE_AVAILABLE' && castle.status.blockedBy === bakery.id, `castle: ${JSON.stringify(castle.status)}`);
  assert(bakery.status.k === 'WAGON_DUE' && bakery.status.good === 'flour', `bakery: ${JSON.stringify(bakery.status)}`);
  eq(inputDueUpstream(w, castle), bakery.status.k === 'WAGON_DUE' ? bakery.status.wagon : -2, 'the booked wagon');
  const e = entry(w, castle.id);
  assert(!!e && e.minor && !e.crit, `a calm pin (was the red card with nothing to press for up to 35 s): ${JSON.stringify(e)}`);
  eq(cureFor(w, castle.id), null, 'nothing to buy');
  // only the producer's input: a building that is not short of anything reads none
  eq(inputDueUpstream(w, bakery), -1, 'the bakery itself is no NONE_AVAILABLE');
});

test('D-711: IV — a castle behind wood at the ice with no stone bridge to offer reads calm; long ice offers it at once', () => {
  // fuzz 27: the span the sawmill's wood waits at is no single walk (17 cells), so no stone bridge can be offered
  const w = fuzzAt('m4', 27, 393);
  const castle = typeOf(w, 'castle'), saw = typeOf(w, 'sawmill');
  eq(heldSpanFor(w, castle), null, 'no stone bridge to offer here');
  const h = briefHold(w, castle);
  assert(!!h && h.kind === 'BRIDGE_CLOSED', `the wagon at the ice: ${JSON.stringify(h)} ${JSON.stringify(saw.status)}`);
  const e = entry(w, castle.id);
  assert(!!e && e.minor && !e.crit, `calm (was red with nothing to press for up to 91 s): ${JSON.stringify(e)}`);
  // fuzz 41 (mission silver): the sawmill's own wood wagon at the ice, the span a walk — the stone bridge, at once
  const w2 = fuzzAt('m4', 41, 205, true);
  const saw2 = typeOf(w2, 'sawmill');
  const held = heldSpanFor(w2, saw2);
  assert(!!held && held.kind === 'BRIDGE_CLOSED' && held.cells.length > 0, `held under ice: ${JSON.stringify(held)}`);
  eq(cureFor(w2, saw2.id), 'pave', 'the stone bridge');
  eq(briefHold(w2, saw2), null, 'not the brief reading when the card applies');
});

test('D-711: a one-lane jam reads calm only in its first 20 s', () => {
  // II fuzz 1: the wagon booked for the bakery's flour stands in a one-lane jam on its way to the mill
  const w = fuzzAt('m2', 1, 101);
  const bakery = typeOf(w, 'bakery');
  assert(bakery.status.k === 'NO_INPUT' && bakery.status.cause === 'NONE_AVAILABLE', `bakery: ${JSON.stringify(bakery.status)}`);
  const e = entry(w, bakery.id);
  assert(!!e && e.minor, `a calm pin: ${JSON.stringify(e)}`);
  const h = briefHold(w, bakery);
  assert(!!h && h.kind === 'BRIDGE_JAM', `jam: ${JSON.stringify(h)} ${JSON.stringify(bakery.status)}`);
  // ...and the castle behind the bakery (castle <- bakery <- mill, whose grain is the jammed wagon's): calm too
  const castle = typeOf(w, 'castle');
  assert(castle.status.k === 'NO_INPUT' && castle.status.cause === 'NONE_AVAILABLE' && castle.status.blockedBy === bakery.id, `castle: ${JSON.stringify(castle.status)}`);
  const hc = briefHold(w, castle);
  assert(!!hc && hc.kind === 'BRIDGE_JAM', `two levels up: ${JSON.stringify(hc)}`);
  const ec = entry(w, castle.id);
  assert(!!ec && ec.minor, `the castle is a calm pin: ${JSON.stringify(ec)}`);
  const wg = w.state.wagons.find((q) => q.id === h!.wagon)!;
  assert(wg.status.k === 'BRIDGE_JAM' && w.state.tick - wg.status.since < 20 * TICK_HZ, 'within its first 20 s');
  // past 20 s with no stone bridge to offer (II has no cobbles) the jam is no longer the brief reading
  while (w.state.tick - (wg.status.k === 'BRIDGE_JAM' ? wg.status.since : w.state.tick) < 20 * TICK_HZ && wg.status.k === 'BRIDGE_JAM') { step(w); sampleInputWaits(w); }
  if (wg.status.k === 'BRIDGE_JAM') eq(briefHold(w, bakery)?.wagon === wg.id, false, 'that jam is no longer brief');
});

test('D-712: a grey cure for silver in a contract mission says no silver comes in, and what frees it', () => {
  // I fuzz 13 with the mission's silver: the mill waits for a wagon, 18 silver left
  const w = fuzzAt('m1', 13, 200, true);
  const mill = typeOf(w, 'mill');
  eq(cureFor(w, mill.id), 'wagon', 'cure: a wagon');
  assert(w.state.coins < 30, `silver short: ${w.state.coins}`);
  const s = silverShort(w, mill, 30 - w.state.coins, 'wagon');
  assert(!!s && s.noIncome && s.sell === 0 && !!s.free && s.free.ticks > 0, `no income, the first wagon to free: ${JSON.stringify(s)}`);
  // IV fuzz 41: the stone bridge short of silver under the ice — the ice clears by itself in 80 s
  const w2 = fuzzAt('m4', 41, 400, true);
  const saw = typeOf(w2, 'sawmill');
  eq(cureFor(w2, saw.id), 'pave', 'cure: the stone bridge');
  const s2 = silverShort(w2, saw, 50, 'pave');
  assert(!!s2 && s2.iceTicks === 80 * TICK_HZ && !s2.jam, `the ice clears in 80 s: ${JSON.stringify(s2)}`);
  // idle wagons whose refunds cover the shortfall: sell them (one wagon always kept)
  const w3 = createWorld('m1');
  w3.state.coins = 0;
  for (let i = 0; i < 2; i++) w3.state.coins += 30, applyCommand(w3, { t: 'buyWagon', stable: typeOf(w3, 'stable').id });
  const idle = w3.state.wagons.filter((q) => !q.job).length;
  assert(idle >= 3, `idle wagons: ${idle}`);
  eq(silverShort(w3, typeOf(w3, 'castle'), 20, 'wagon')?.sell, 2, 'two wagons sold cover 20 silver');
  eq(silverShort(w3, typeOf(w3, 'castle'), 200, 'wagon')?.sell, 0, 'no sale offer that would not cover it');
  // the free valley's market pays: the plain line stays
  const v = createWorld('sandbox');
  eq(silverShort(v, v.state.buildings[0]!, 10, 'wagon'), null, 'not where a market pays');
});

test('D-713: VII — a delivery wagon whose road cannot be rebuilt names the building to take back', () => {
  const w = createWorld('m7');
  w.state.coins = 4000;
  const runTo = (sec: number): void => { while (w.state.tick < sec * TICK_HZ) { step(w); sampleInputWaits(w); } };
  // D-653's game: the fisher taken down while its wagon loads, then the road beyond the wagon
  runTo(35.2); assert(applyCommand(w, { t: 'demolish', cell: 3795 }).ok, 'fisher down');
  runTo(76.9); assert(applyCommand(w, { t: 'demolish', cell: 2902 }).ok, 'road cell down');
  runTo(100);
  const castle = typeOf(w, 'castle');
  const lost = routeLostFor(w, castle);
  assert(!!lost, 'the wagon has no road');
  eq(routeBlocker(w, castle), -1, 'a road can still be built: no building to take back');
  // fixture: wall the wagon's road piece in with 1x1 workshops (a later player's buildings) — no road fits any more
  const wg = w.state.wagons.find((q) => q.id === lost!.wagon)!;
  const W = w.terrain.w, c = net(w), st = w.state;
  const piece = new Set<number>();
  for (let i = 0; i < st.roads.length; i++) if (st.roads[i] && reachable(w, wg.at, i)) piece.add(i);
  const ring = new Set<number>();
  for (const i of piece) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const j = i + dy * W + dx;
    if (!piece.has(j) && c.occupied[j] === -1 && !st.roads[j]) ring.add(j);
  }
  const proto = JSON.stringify(typeOf(w, 'stable'));
  let id = Math.max(...st.buildings.map((b) => b.id)) + 1;
  for (const j of ring) {
    const b = JSON.parse(proto) as Building;
    Object.assign(b, { id: id++, type: 'fisher', x: j % W, y: Math.floor(j / W), w: 1, h: 1, gate: j });
    st.buildings.push(b);
  }
  st.netVersion++;
  const chain = explainBuilding(w, castle.id, 5, true);
  const tgt = gapTarget(w, chain);
  assert(tgt < 0 || !gapSuggestion(w, tgt), 'no road can be built now');
  const blk = routeBlocker(w, castle);
  assert(blk >= 0 && buildingById(w, blk)!.type === 'fisher', `a walling building is named: ${blk}`);
  eq(cureFor(w, castle.id), 'demolish', 'cure: take it back');
  eq(blockingBuilding(w, wg.at, castle.gate, () => false), -1, 'nothing removable: nothing named');
  // taking it back opens the way: the gap finder has a road again
  const b = buildingById(w, blk)!;
  assert(applyCommand(w, { t: 'demolish', cell: b.y * W + b.x }).ok, 'demolish the named building');
  const tgt2 = gapTarget(w, explainBuilding(w, castle.id, 5, true));
  assert(tgt2 >= 0 && !!gapSuggestion(w, tgt2), 'a road fits again');
  eq(routeBlocker(w, castle), -1, 'and nothing to take back any more');
});

test('D-710..D-713: new keys in pl and en, pending for the other languages', () => {
  for (const k of ['cause.inputDue', 'fix.shortNoIncome', 'fix.shortSell', 'fix.shortWagonFree', 'fix.shortIce', 'fix.shortJam', 'fix.routeBlockedWhy'] as const) {
    assert(!!pl[k] && !!en[k], `${k} in pl and en`);
    assert((PENDING_KEYS as readonly string[]).includes(k), `${k} pending`);
  }
  assert(pl['cause.inputDue'].includes('{wagon}') && en['cause.inputDue'].includes('{who}'), 'the card names the wagon and the producer');
});
