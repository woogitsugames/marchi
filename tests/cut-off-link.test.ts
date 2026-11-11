// D-410: a free-valley building cut off later whose gate no road can reach any more (later neighbours boxed it in)
// gets "Rozbierz" — never a red card whose sheet offers nothing. The box is synthetic: the ground around the gate is
// raised past the steepest grade a road may climb, so the gap finder (suggestLinkToStable) finds no link.
import { TICK_HZ, createWorld, explainBuilding, reachable, suggestLinkToStable, type Building, type BuildingStatus, type World } from '../src/sim/index';
import { place } from '../src/sim/commands';
import { cureFor, cutOffNoLink, cutOffRefund, gapSuggestion, gapTarget } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

function boxed(type: 'brewery' | 'malthouse', mission = false): { w: World; b: Building; stable: Building } {
  const w = createWorld(mission ? 'm1' : 'sandbox');
  if (!mission) w.state.town.rank = 5;
  const stable = w.state.buildings.find((q) => q.type === 'stable')!;
  const r = place(w, type, 20, 40, 2, true);
  assert(r.ok, `place ${type}: ${JSON.stringify(r)}`);
  const b = w.state.buildings.at(-1)!;
  assert(!reachable(w, stable.gate, b.gate), 'off the network');
  assert(!!suggestLinkToStable(w, b.id), 'a link exists before the box');
  // (the terrain is shared between worlds of one map: raise a copy)
  (w as { terrain: World['terrain'] }).terrain = { ...w.terrain, cellH: w.terrain.cellH.slice() };
  const W = w.terrain.w, gx = b.gate % W, gy = Math.floor(b.gate / W);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) w.terrain.cellH[(gy + dy) * W + gx + dx] = w.terrain.cellH[b.gate]! + 50;
  w.state.netVersion++;
  return { w, b, stable };
}

const fullYard: BuildingStatus = { k: 'OUTPUT_FULL', cause: 'NO_DESTINATION', blockedBy: -1 } as BuildingStatus;

test('cut-off link: a producer cut off with no road left gets "Rozbierz", not an empty sheet (D-410)', () => {
  const { w, b } = boxed('brewery');
  assert(!suggestLinkToStable(w, b.id), 'no link once boxed in');
  b.status = fullYard; b.stalledTicks = 120 * TICK_HZ; b.placedTick = 0; w.state.tick = 600 * TICK_HZ;
  const chain = explainBuilding(w, b.id, 5, true);
  eq(gapTarget(w, chain), b.id, 'the gap finder still names it');
  eq(cutOffNoLink(w, chain), b.id, 'but no link is left');
  eq(cureFor(w, b.id), 'demolish', 'the cure: take it back');
  eq(cutOffRefund(w, b.id), 30, 'half the price back');
});

test('cut-off link: a consumer cut off with no road left gets "Rozbierz" too (D-410, mirror of D-394)', () => {
  const { w, b } = boxed('malthouse');
  const st = { k: 'NO_INPUT', good: 'grain', cause: 'UNREACHABLE', blockedBy: -1 } as BuildingStatus;
  b.status = st; b.stalledTicks = 120 * TICK_HZ;
  eq(cutOffNoLink(w, [{ kind: 'building', id: b.id, status: st }]), b.id, 'cut off, no link');
  eq(cureFor(w, b.id), 'demolish', 'the cure: take it back');
});

test('cut-off link: a workshop whose own gate lost its road (NO_ROAD) with no link left gets "Rozbierz" (D-634)', () => {
  // valley seed 1321 card-10, 64:41-64:49: a malthouse NO_ROAD, the gap finder had nothing to offer
  const { w, b } = boxed('malthouse');
  const st = { k: 'NO_ROAD' } as BuildingStatus;
  b.status = st; b.stalledTicks = 120 * TICK_HZ;
  eq(cutOffNoLink(w, [{ kind: 'building', id: b.id, status: st }]), b.id, 'no road, no link');
  eq(cureFor(w, b.id), 'demolish', 'the cure: take it back');
  const free = createWorld('sandbox');
  free.state.town.rank = 5;
  place(free, 'malthouse', 20, 40, 2, true);
  const c = free.state.buildings.at(-1)!;
  c.status = st; c.stalledTicks = 120 * TICK_HZ;
  eq(cutOffNoLink(free, [{ kind: 'building', id: c.id, status: st }]), -1, 'a link exists: the road');
  eq(cureFor(free, c.id), 'road', 'the gap finder road');
});

test('cut-off link: with a link to build the cure stays the road; a mission keeps the road (D-410)', () => {
  const w = createWorld('sandbox');
  w.state.town.rank = 5;
  place(w, 'brewery', 20, 40, 2, true);
  const b = w.state.buildings.at(-1)!;
  b.status = fullYard; b.stalledTicks = 120 * TICK_HZ;
  eq(cutOffNoLink(w, explainBuilding(w, b.id, 5, true)), -1, 'a link exists');
  eq(cureFor(w, b.id), 'road', 'the gap finder road (D-173)');
  const m = boxed('brewery', true);
  m.b.status = fullYard; m.b.stalledTicks = 120 * TICK_HZ;
  eq(cutOffNoLink(m.w, explainBuilding(m.w, m.b.id, 5, true)), -1, 'not in a mission');
});

test('cut-off link: a new game with the same building id, network version and count asks again (D-593)', () => {
  // the boxed brewery of game A, then the same brewery in a fresh game B whose counters happen to match
  const a = boxed('brewery');
  a.b.status = fullYard; a.b.stalledTicks = 120 * TICK_HZ;
  eq(cutOffNoLink(a.w, explainBuilding(a.w, a.b.id, 5, true)), a.b.id, 'game A: no link');
  const w = createWorld('sandbox');
  w.state.town.rank = 5;
  place(w, 'brewery', 20, 40, 2, true);
  const b = w.state.buildings.at(-1)!;
  eq(b.id, a.b.id, 'same id');
  w.state.netVersion = a.w.state.netVersion;
  eq(w.state.buildings.length, a.w.state.buildings.length, 'same count');
  b.status = fullYard; b.stalledTicks = 120 * TICK_HZ;
  eq(cutOffNoLink(w, explainBuilding(w, b.id, 5, true)), -1, 'game B: a link exists — not the answer of game A');
  eq(cureFor(w, b.id), 'road', 'the road, not "Rozbierz"');
});

test('cut-off link: the gap road of a new game is its own, not the cached road of the last game (D-593)', () => {
  // two valley games, the same brewery id at another site; the counters match, the roads must not
  const make = (x: number, y: number): { w: World; id: number } => {
    const w = createWorld('sandbox');
    w.state.town.rank = 5;
    assert(place(w, 'brewery', x, y, 2, true).ok, 'place');
    return { w, id: w.state.buildings.at(-1)!.id };
  };
  const a = make(20, 40), b = make(24, 44);
  eq(a.id, b.id, 'same id');
  eq(a.w.state.netVersion, b.w.state.netVersion, 'same network version');
  const ra = gapSuggestion(a.w, a.id), rb = gapSuggestion(b.w, b.id);
  assert(!!ra && !!rb, 'both have a road');
  eq(JSON.stringify(rb!.cells), JSON.stringify(suggestLinkToStable(b.w, b.id)!.cells), 'game B: its own road');
  assert(JSON.stringify(ra!.cells) !== JSON.stringify(rb!.cells), 'the two roads differ');
});
