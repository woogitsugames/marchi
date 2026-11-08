// D-390/D-391: a card never names a building the build tool cannot place, and never leaves a grey cure as the only
// way out. The bottleneck card's ghost falls back to another anchor with a site a road reaches (or the card goes);
// a full-yard producer is no shortage; the pave cure without stone or quarry offers the quarry; the granary cure
// opens by an anchor with a site. Synthetic statuses on a real valley (as bottleneck.test.ts).
import {
  TICK_HZ, applyCommand, createWorld, inputGoods, net, suggestLinkToStable,
  type Building, type BuildingStatus, type World,
} from '../src/sim/index';
import { place } from '../src/sim/commands';
import { NECK_WINDOW, bottleneckCard, resetBottleneck, sampleBottleneck } from '../src/ui/bottleneck';
import { siteAnchor, siteExists } from '../src/ui/site';
import { HELD_SPAN_TICKS, cureFor, granaryAnchor, producerCure, quarryForPave } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

const waitGrain: BuildingStatus = { k: 'WAITING_DELIVERY', good: 'grain', wagon: 1 };
const working: BuildingStatus = { k: 'WORKING' };

function valley(): { w: World; farm: Building; mills: Building[] } {
  const w = createWorld('sandbox');
  w.state.town.rank = 3;
  const put = (type: Parameters<typeof place>[1], x: number, y: number): Building => {
    const r = place(w, type, x, y, 2, true);
    assert(r.ok, `place ${type} at ${x},${y}: ${JSON.stringify(r)}`);
    return w.state.buildings.at(-1)!;
  };
  const farm = put('farm', 55, 25);
  const mills = [put('mill', 58, 25), put('mill', 52, 25), put('mill', 49, 25)];
  resetBottleneck(w);
  return { w, farm, mills };
}

function seconds(w: World, n: number, set: (sec: number) => void): void {
  for (let i = 0; i < n; i++) {
    w.state.tick += TICK_HZ;
    for (const b of w.state.buildings) if (inputGoods(b.type).length) b.status = working;
    set(i);
    sampleBottleneck(w);
  }
}

/** This world's own water layer (the terrain is shared by every world of the same map: never write it). */
function ownWater(w: World): number[] {
  w.terrain = { ...w.terrain, water: [...w.terrain.water] };
  return w.terrain.water;
}

/** Every free cell of the map under water: no site anywhere. */
function drownAll(w: World): void {
  const water = ownWater(w), occ = net(w).occupied;
  for (let i = 0; i < water.length; i++) if (occ[i] === -1) water[i] = 1;
}

/** Water on every cell within `r` of building b's footprint that no building stands on: no site there. */
function drown(w: World, b: Building, r: number): void {
  const W = w.terrain.w, occ = net(w).occupied;
  ownWater(w);
  for (let y = Math.max(0, b.y - r); y < Math.min(w.terrain.h, b.y + b.h + r); y++) {
    for (let x = Math.max(0, b.x - r); x < Math.min(W, b.x + b.w + r); x++) if (occ[y * W + x] === -1) w.terrain.water[y * W + x] = 1;
  }
}

test('dead cards: the grain card opens its ghost by another anchor when the farm has no site (D-390)', () => {
  const { w, farm, mills } = valley();
  drown(w, farm, 12);
  eq(siteExists(w, 'farm', farm.id), false, 'no farm site by the farm');
  seconds(w, NECK_WINDOW, () => { mills[0]!.status = waitGrain; mills[1]!.status = waitGrain; });
  const c = bottleneckCard(w);
  assert(!!c && c.good === 'grain' && c.cure === 'producer', `grain card: ${JSON.stringify(c)}`);
  assert(c!.near !== farm.id && c!.near >= 0, 'another anchor than the farm');
  assert(siteExists(w, 'farm', c!.near), 'the anchor has a farm site');
  // the sheet's "Postaw: farm" carries the type, whatever building the ghost opens by
  const pc = producerCure(w, mills[0]!);
  eq(`${pc?.type} ${pc?.producer}`, `farm ${c!.near}`, 'sheet cure: a farm by the anchor');
});

test('dead cards: no farm site anywhere the ghost looks -> no grain card (D-175, D-390)', () => {
  const { w, mills } = valley();
  drownAll(w);
  eq(siteAnchor(w, 'farm', w.state.buildings.map((b) => b.id)), -1, 'no anchor');
  seconds(w, NECK_WINDOW, () => { mills[0]!.status = waitGrain; mills[1]!.status = waitGrain; });
  const c = bottleneckCard(w);
  assert(!c || c.good !== 'grain', `no grain card: ${JSON.stringify(c)}`);
  eq(cureFor(w, mills[0]!.id) === 'producer', false, 'the mill sheet offers no producer');
});

test('dead cards: producers sitting on a full yard half the window -> no shortage card (D-390)', () => {
  const { w, farm, mills } = valley();
  const full: BuildingStatus = { k: 'OUTPUT_FULL', cause: 'NO_DESTINATION', good: 'grain', blockedBy: -1 } as BuildingStatus;
  seconds(w, NECK_WINDOW, () => { mills[0]!.status = waitGrain; mills[1]!.status = waitGrain; farm.status = full; });
  const c = bottleneckCard(w);
  assert(!c || c.good !== 'grain', `no grain card with the farm full: ${JSON.stringify(c)}`);
  // and back: the farm at work again for a whole window -> the card returns
  seconds(w, NECK_WINDOW, () => { mills[0]!.status = waitGrain; mills[1]!.status = waitGrain; farm.status = working; });
  eq(bottleneckCard(w)?.good, 'grain', 'grain card with the farm working');
});

test('dead cards: a held wooden span with no stone and no quarry offers the quarry (D-390)', () => {
  const w = createWorld('sandbox');
  w.state.town.rank = 5;
  w.state.coins = 100000;
  const post = w.state.buildings.find((b) => b.type === 'tradePost')!;
  const sug = suggestLinkToStable(w, post.id);
  assert(!!sug, 'a road to the trading post');
  const r = applyCommand(w, { t: 'road', surface: 1, cells: sug!.cells });
  assert(r.ok, `road: ${JSON.stringify(r)}`);
  const sp = net(w).span;
  let span = -1;
  for (let i = 0; i < sp.length && span < 0; i++) if (sp[i]! >= 0) span = sp[i]!;
  assert(span >= 0, 'the road crosses the river on a wooden span');
  const stable = w.state.buildings.find((b) => b.type === 'stable')!;
  const wh = w.state.buildings.find((b) => b.type === 'warehouse')!;
  assert(applyCommand(w, { t: 'buyWagon', stable: stable.id }).ok, 'buy a wagon');
  const wg = w.state.wagons.at(-1)!;
  w.state.tick += HELD_SPAN_TICKS + TICK_HZ;
  wg.job = { id: 1, good: 'bread', qty: 1, from: wh.id, to: post.id, phase: 'dropoff' };
  wg.status = { k: 'BRIDGE_JAM', span, blocker: -1, since: w.state.tick - HELD_SPAN_TICKS - 1 };
  for (const b of w.state.buildings) if (b.type === 'warehouse') b.stock.stone = 0;
  eq(cureFor(w, post.id), 'pave', 'the post sheet: pave the span');
  const qa = quarryForPave(w, post);
  assert(qa >= 0, 'no stone, no quarry: the quarry is offered');
  assert(siteExists(w, 'quarry', qa), 'by an anchor with a quarry site');
  // with a quarry standing the stone button stays (the sheet tells where the stone is)
  w.state.buildings.push({ ...w.state.buildings.find((b) => b.type === 'woodcutter')!, id: 9999, type: 'quarry' });
  eq(quarryForPave(w, post), -1, 'a quarry stands: no quarry offer');
  // never in a mission
  const m = createWorld('m1');
  eq(quarryForPave(m, m.state.buildings[0]!), -1, 'mission');
});

test('dead cards: the granary cure opens by an anchor with a site; none -> no granary cure (D-391)', () => {
  // (siteExists keeps its answer until the network or the building count changes: a fresh valley per terrain)
  const v1 = valley();
  const wh1 = v1.w.state.buildings.find((b) => b.type === 'warehouse')!;
  eq(granaryAnchor(v1.w, v1.farm, wh1.id), v1.farm.id, 'by the building itself while it has a site');
  const v2 = valley();
  const wh2 = v2.w.state.buildings.find((b) => b.type === 'warehouse')!;
  drown(v2.w, v2.farm, 12);
  const a = granaryAnchor(v2.w, v2.farm, wh2.id);
  assert(a !== v2.farm.id, 'another anchor when the farm has no granary site');
  if (a >= 0) assert(siteExists(v2.w, 'warehouse', a), 'that anchor has a site');
  const v3 = valley();
  drownAll(v3.w);
  eq(granaryAnchor(v3.w, v3.farm, v3.w.state.buildings.find((b) => b.type === 'warehouse')!.id), -1, 'no site anywhere');
});
