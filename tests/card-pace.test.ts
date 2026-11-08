// D-392..D-394: the free valley's cards wait for the building they just had the player place. The bottleneck card
// counts a fresh producer as one workshop served; a granary "full" of loads still on the way is filling, not full,
// and a producer's full yard asks for no second granary while a fresh one takes its first loads; a consumer cut off
// from the stable gets the gap finder's road. Synthetic statuses on a real valley (as dead-cards.test.ts).
import {
  GOODS, TICK_HZ, createWorld, inputGoods, reachable,
  type Building, type BuildingStatus, type World,
} from '../src/sim/index';
import { place } from '../src/sim/commands';
import { NECK_WINDOW, bottleneckCard, resetBottleneck, sampleBottleneck } from '../src/ui/bottleneck';
import { buildSite } from '../src/ui/site';
import { calmWhy, cureFor, cutOffConsumer, freshGranary, gapTarget, granaryFilling, rankStalls } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

const waitGrain: BuildingStatus = { k: 'WAITING_DELIVERY', good: 'grain', wagon: 1 };
const working: BuildingStatus = { k: 'WORKING' };

function valley(): { w: World; put: (type: Parameters<typeof place>[1], x: number, y: number) => Building; mills: Building[] } {
  const w = createWorld('sandbox');
  w.state.town.rank = 3;
  const put = (type: Parameters<typeof place>[1], x: number, y: number): Building => {
    const r = place(w, type, x, y, 2, true);
    assert(r.ok, `place ${type} at ${x},${y}: ${JSON.stringify(r)}`);
    return w.state.buildings.at(-1)!;
  };
  put('farm', 55, 25);
  const mills = [put('mill', 58, 25), put('mill', 52, 25), put('mill', 49, 25)];
  resetBottleneck(w);
  return { w, put, mills };
}

function seconds(w: World, n: number, waiting: readonly Building[]): void {
  for (let i = 0; i < n; i++) {
    w.state.tick += TICK_HZ;
    for (const b of w.state.buildings) if (inputGoods(b.type).length) b.status = working;
    for (const b of waiting) b.status = waitGrain;
    sampleBottleneck(w);
  }
}

test('card pace: a fresh farm counts as one mill served until the window forgets it (D-392)', () => {
  const { w, put, mills } = valley();
  seconds(w, NECK_WINDOW, mills.slice(0, 2));
  eq(bottleneckCard(w)?.good ?? null, 'grain', 'two mills wait: the grain card');
  put('farm', 55, 20);
  seconds(w, 10, mills.slice(0, 2));
  eq(bottleneckCard(w), null, 'ten seconds after the farm: the card waits for it');
  seconds(w, NECK_WINDOW, mills);
  eq(bottleneckCard(w)?.good ?? null, 'grain', 'a window later the farm is no longer fresh; three mills wait');
  // a deep shortage still asks for the next one at once; the shown count is the plain mean, not the discounted one
  siteFarm(w);
  seconds(w, 10, mills);
  eq(bottleneckCard(w)?.good ?? null, 'grain', 'three mills, one fresh farm: still the card');
  assert(bottleneckCard(w)!.meanX100 >= 290, `plain mean: ${bottleneckCard(w)!.meanX100}`);
  siteFarm(w);
  seconds(w, 10, mills);
  eq(bottleneckCard(w), null, 'three mills, two fresh farms: the card waits');
});

/** One more building at the build tool's own site by the castle. */
function atSite(w: World, type: Parameters<typeof place>[1]): Building {
  const castle = w.state.buildings.find((b) => b.type === 'castle')!;
  const s = buildSite(w, type, castle.id);
  assert(!!s, `a ${type} site`);
  const r = place(w, type, s!.x, s!.y, s!.facing, true);
  assert(r.ok, `place ${type}: ${JSON.stringify(r)}`);
  return w.state.buildings.at(-1)!;
}
const siteFarm = (w: World): Building => atSite(w, 'farm');

function fill(b: Building, stock: number, incoming: number): void {
  for (const g of GOODS) { b.stock[g] = 0; b.incoming[g] = 0; }
  b.stock.stone = stock; // road stone: no market load (granaryLoads skips it)
  b.incoming.stone = incoming;
  b.status = { k: 'STORAGE_FULL' } as BuildingStatus;
  b.stalledTicks = 60 * TICK_HZ;
}

test('card pace: a granary full of loads on the way is filling — calm, no second granary (D-393)', () => {
  const { w } = valley();
  const g = atSite(w, 'warehouse');
  fill(g, 0, 60);
  assert(granaryFilling(w, g.id), 'filling');
  eq(calmWhy(w, g), 'filling', 'calm reason');
  eq(cureFor(w, g.id), null, 'no cure');
  assert(rankStalls(w).find((e) => e.id === g.id)?.minor === true, 'a calm pin, never the red card');
  fill(g, 60, 0);
  eq(granaryFilling(w, g.id), false, 'full of its own stock: really full');
  // missions keep the plain reading
  const m = createWorld('m1');
  const mg = m.state.buildings.find((b) => b.type === 'warehouse');
  if (mg) { fill(mg, 0, 60); eq(granaryFilling(m, mg.id), false, 'mission granary'); }
});

test('card pace: a full yard waits while a fresh granary takes its first loads (D-393)', () => {
  const { w } = valley();
  const full = atSite(w, 'warehouse');
  fill(full, 60, 0);
  const farm = w.state.buildings.find((b) => b.type === 'farm')!;
  farm.status = { k: 'OUTPUT_FULL', good: 'grain', cause: 'NO_DESTINATION', blockedBy: full.id } as BuildingStatus;
  farm.stalledTicks = 60 * TICK_HZ;
  for (const b of w.state.buildings) if (b.type === 'warehouse' && b.id !== full.id) fill(b, 60, 0);
  eq(freshGranary(w, farm), -1, 'no fresh granary');
  eq(cureFor(w, farm.id), 'granary', 'without one: another granary');
  const fresh = atSite(w, 'warehouse');
  fill(fresh, 6, 54);
  eq(freshGranary(w, farm), fresh.id, 'the fresh granary');
  eq(calmWhy(w, farm), 'granaryFilling', 'calm reason');
  assert(cureFor(w, farm.id) !== 'granary', 'no second granary while it fills');
  fill(fresh, 36, 24);
  eq(freshGranary(w, farm), -1, 'half full: it works');
});

test('card pace: a consumer cut off from the stable gets the road (D-394)', () => {
  const { w, put, mills } = valley();
  const stable = w.state.buildings.find((b) => b.type === 'stable')!;
  const lone = put('mill', 20, 40);
  assert(!reachable(w, stable.gate, lone.gate), 'the lone mill is off the network');
  const st: BuildingStatus = { k: 'NO_INPUT', good: 'grain', cause: 'UNREACHABLE', blockedBy: -1 } as BuildingStatus;
  lone.status = st;
  eq(cutOffConsumer(w, [{ kind: 'building', id: lone.id, status: st }]), lone.id, 'cut off');
  eq(gapTarget(w, [{ kind: 'building', id: lone.id, status: st }, { kind: 'building', id: mills[0]!.id, status: working }]), lone.id, 'gap finder target');
  mills[1]!.status = st;
  eq(cutOffConsumer(w, [{ kind: 'building', id: mills[1]!.id, status: st }]), reachable(w, stable.gate, mills[1]!.gate) ? -1 : mills[1]!.id, 'a linked one is not');
});
