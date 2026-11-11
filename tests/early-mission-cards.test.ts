// Early missions (I-IX) stall-card hunt (D-650..D-654): every red card offers something to press. A granary cut off
// from a producer that is still on the stable's roads gets the road (D-650); the stable's own road taken back gets
// a link (D-651); a castle behind a workshop whose input wagon stands at the ice gets the stone bridge (D-652); a
// building whose delivery wagon has no road is a red card (D-653) whose sheet links the stranded wagon (D-654).
import { TICK_HZ, applyCommand, buildingById, createWorld, explainBuilding, reachable, step, type Building, type World } from '../src/sim/index';
import { cureFor, gapSuggestion, gapTarget, heldSpanFor, producerCure, rankStalls, routeLostFor, sampleInputWaits } from '../src/ui/stalls';
import { pl, PENDING_KEYS } from '../src/i18n/pl';
import { en } from '../src/i18n/en';
import { assert, eq, test } from './harness';

const typeOf = (w: World, t: string, n = 0): Building => w.state.buildings.filter((b) => b.type === t)[n]!;
const runTo = (w: World, sec: number): void => { while (w.state.tick < sec * TICK_HZ) { step(w); sampleInputWaits(w); } };
const chainOf = (w: World, id: number) => {
  const b = buildingById(w, id)!;
  const c = explainBuilding(w, id, 5, true);
  return c.length ? c : [{ kind: 'building' as const, id, status: b.status }];
};
function demolish(w: World, cell: number): void {
  const r = applyCommand(w, { t: 'demolish', cell });
  assert(r.ok, `demolish ${cell}: ${JSON.stringify(r)}`);
}

test('D-650: IV — a producer whose granary was cut from the stable\'s roads gets the road to the granary', () => {
  const w = createWorld('m4');
  w.state.coins = 4000;
  runTo(w, 90.5);
  demolish(w, 3795); // the artery cell between the stable's half (woodcutters, stable) and the sawmill's
  runTo(w, 120);
  const wc = w.state.buildings.find((b) => b.type === 'woodcutter' && b.status.k === 'OUTPUT_FULL' && b.status.cause === 'NO_DESTINATION');
  assert(!!wc, 'a woodcutter has a full yard with nowhere to go');
  const wh = typeOf(w, 'warehouse');
  eq(wc!.status.k === 'OUTPUT_FULL' && wc!.status.blockedBy, wh.id, 'the sim names the cut-off granary');
  const stable = typeOf(w, 'stable');
  assert(reachable(w, wc!.gate, stable.gate) && !reachable(w, wc!.gate, wh.gate), 'producer on the stable\'s piece, granary off it');
  eq(cureFor(w, wc!.id), 'road', 'cure: the road (was nothing to press for up to 8 min)');
  eq(gapTarget(w, chainOf(w, wc!.id)), wh.id, 'the gap finder links the granary');
  const s = gapSuggestion(w, wh.id);
  assert(!!s && s.newCells.includes(3795), `the link lays the cell taken back: ${JSON.stringify(s?.newCells)}`);
  assert(applyCommand(w, { t: 'road', surface: 1, cells: s!.cells }).ok, 'the fix is buildable');
  assert(reachable(w, wc!.gate, wh.gate), 'joined');
});

test('D-651: III and IX — the stable\'s own road taken back: the sheet links the stable', () => {
  for (const m of ['m3', 'm9']) {
    const w = createWorld(m);
    w.state.coins = 4000;
    runTo(w, 20);
    const stable = typeOf(w, 'stable');
    // the road cell in front of the gate (the gate cell itself cannot be taken back)
    const W = w.terrain.w;
    for (const d of [1, -1, W, -W]) if (w.state.roads[stable.gate + d] && w.state.buildings.every((b) => b.gate !== stable.gate + d)) demolish(w, stable.gate + d);
    runTo(w, 60);
    eq(stable.status.k, 'NO_ROAD', `${m}: the stable reads NO_ROAD`);
    const top = rankStalls(w).find((r) => r.id === stable.id);
    assert(!!top && top.crit, `${m}: the stable is a red card`);
    eq(gapTarget(w, chainOf(w, stable.id)), stable.id, `${m}: the gap finder targets the stable`);
    const s = gapSuggestion(w, stable.id);
    assert(!!s && s.cells[0] === stable.gate && s.newCells.length > 0, `${m}: a road from the stable's gate (was none): ${JSON.stringify(s?.newCells)}`);
    assert(applyCommand(w, { t: 'road', surface: 1, cells: s!.cells }).ok, `${m}: the fix is buildable`);
    runTo(w, 62);
    assert(stable.status.k !== 'NO_ROAD', `${m}: the stable is back on the roads (${JSON.stringify(stable.status)})`);
  }
});

test('D-652: IV — a castle short of planks behind the sawmill whose wood stands at the ice gets the stone bridge', () => {
  const w = createWorld('m4');
  w.state.coins = 4000;
  // fuzz scenario seed 2 (tools/fuzz-lib): the artery cut, a second wooden crossing west of the first, a stub
  runTo(w, 90.5);
  demolish(w, 3795);
  const roads: [number, number[]][] = [
    [164.2, [2332, 2333, 2429, 2525, 2621, 2717, 2813, 2909, 3005, 3101, 3197, 3293, 3390, 3486, 3582, 3678, 3774, 3870, 3966, 4062, 4158, 4254]],
    [164.6, [4115, 4114, 4113, 4112, 4111, 4110, 4109]],
    [393.2, [2942, 3037, 3133, 3228]],
  ];
  for (const [at, cells] of roads) { runTo(w, at); applyCommand(w, { t: 'road', surface: 1, cells }); }
  runTo(w, 410);
  eq(cureFor(w, typeOf(w, 'castle').id), null, 'before 20 s at the ice: the wait (HELD_SPAN_TICKS)');
  runTo(w, 416);
  const castle = typeOf(w, 'castle'), saw = typeOf(w, 'sawmill');
  assert(castle.status.k === 'NO_INPUT' && castle.status.cause === 'NONE_AVAILABLE' && castle.status.blockedBy === saw.id, `castle waits for the sawmill: ${JSON.stringify(castle.status)}`);
  assert(saw.status.k === 'WAITING_DELIVERY', `the sawmill waits for wood: ${JSON.stringify(saw.status)}`);
  const held = heldSpanFor(w, castle);
  assert(!!held && held.kind === 'BRIDGE_CLOSED', 'the castle is held by the sawmill\'s wagon at the ice');
  eq(cureFor(w, castle.id), 'pave', 'cure: the stone bridge (was nothing to press for up to 87 s)');
  // only NONE_AVAILABLE follows the producer: a contest names a rival consumer, not a producer
  const fake = { ...castle, status: { k: 'NO_INPUT' as const, good: 'planks' as const, cause: 'CONTESTED' as const, blockedBy: saw.id } };
  eq(heldSpanFor(w, fake), null, 'a contest does not follow blockedBy');
});

test('D-653/D-654: VII — the fish wagon cut off from the castle is a red card, the sheet links it, then the fisher', () => {
  const w = createWorld('m7');
  w.state.coins = 4000;
  runTo(w, 35.2);
  const fisher = typeOf(w, 'fisher');
  demolish(w, 3795); // the fisher itself, while its wagon loads
  runTo(w, 76.9);
  demolish(w, 2902); // the road beyond the wagon
  runTo(w, 100);
  eq(w.state.buildings.some((b) => b.id === fisher.id), false, 'the fisher is gone');
  const castle = typeOf(w, 'castle');
  eq(castle.status.k, 'WAITING_DELIVERY', 'the castle only "waits for the delivery" (no stall in the sim)');
  const lost = routeLostFor(w, castle);
  assert(!!lost, 'its wagon has no road');
  const r = rankStalls(w).find((e) => e.id === castle.id);
  assert(!!r && r.crit && !r.minor && rankStalls(w)[0]!.id === castle.id, 'the castle heads the HUD as a red card (was no card at all)');
  eq(cureFor(w, castle.id), 'road', 'cure: the road');
  const tgt = gapTarget(w, chainOf(w, castle.id));
  assert(tgt >= 0, 'the gap finder has a target');
  const s = gapSuggestion(w, tgt);
  assert(!!s && s.newCells.length > 0, `a road for the stranded wagon (D-654): ${JSON.stringify(s)}`);
  assert(applyCommand(w, { t: 'road', surface: 1, cells: s!.cells }).ok, 'the fix is buildable');
  let t = 0;
  while (castle.stock.fish === 0 && t++ < 120 * TICK_HZ) { step(w); sampleInputWaits(w); }
  assert(castle.stock.fish > 0, 'the wagon delivers its fish');
  runTo(w, w.state.tick / TICK_HZ + 25);
  eq(routeLostFor(w, castle), null, 'no route-lost card any more');
  const pc = producerCure(w, castle);
  assert(!!pc && pc.type === 'fisher' && pc.source === 'missing', `then the castle offers a new fisher (D-615): ${JSON.stringify(pc)} ${JSON.stringify(castle.status)}`);
});

test('D-653: cause.routeLost is in pl and en, pending for the other languages', () => {
  assert(pl['cause.routeLost'].includes('{wagon}') && en['cause.routeLost'].includes('{wagon}'), 'both name the wagon');
  assert((PENDING_KEYS as readonly string[]).includes('cause.routeLost'), 'pending');
});
