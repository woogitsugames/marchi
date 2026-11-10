// D-451 (readability audit): the HUD card and the sheet must name the same cause. A free-valley granary "full" of
// loads on the way whose own loads no market takes now read "zapełnia się — wozy już wiozą tu towar" on the card while
// the sheet's title said "Spichlerz pełny — rynek nasycony" and its hint "Sprzedaj inny towar"; a producer refused by
// such a granary read "nowy spichlerz dopiero przyjmuje ładunki" under the same saturated-market sheet. A saturated
// market now outranks both D-393 waits in calmWhy (the sheet already put it first). Synthetic statuses on a real
// valley (as card-pace.test.ts).
import { GOODS, MARKET, TICK_HZ, createWorld, type Building, type BuildingStatus, type World } from '../src/sim/index';
import { place } from '../src/sim/commands';
import { granaryLoads, statusKey } from '../src/ui/stallKinds';
import { calmWhy, cureFor, freshGranary, granaryFilling, rankStalls } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

function valley(): { w: World; put: (type: Parameters<typeof place>[1], x: number, y: number) => Building } {
  const w = createWorld('sandbox');
  w.state.town.rank = 3;
  const put = (type: Parameters<typeof place>[1], x: number, y: number): Building => {
    const r = place(w, type, x, y, 2, true);
    assert(r.ok, `place ${type} at ${x},${y}: ${JSON.stringify(r)}`);
    return w.state.buildings.at(-1)!;
  };
  return { w, put };
}

function granary(w: World): Building {
  return w.state.buildings.find((b) => b.type === 'warehouse')!;
}

function fill(b: Building, bread: number, incoming: number): void {
  for (const g of GOODS) { b.stock[g] = 0; b.incoming[g] = 0; b.reservedOut[g] = 0; }
  b.stock.bread = bread;
  b.incoming.bread = incoming;
  b.status = { k: 'STORAGE_FULL' } as BuildingStatus;
  b.stalledTicks = 60 * TICK_HZ;
}

test('read cards: a filling granary whose loads no market takes reads "market full", as its sheet (D-451)', () => {
  const { w } = valley();
  const g = granary(w);
  fill(g, 30, 30);
  w.state.market.saturation.bread = MARKET.cap;
  eq(granaryLoads(w, g.id), 'saturated', 'the market takes no more bread');
  assert(granaryFilling(w, g.id), 'still filling by the D-393 test');
  eq(calmWhy(w, g), 'marketFull', 'the card names the market, as the sheet title and hint do');
  eq(cureFor(w, g.id), null, 'no cure either way');
  assert(rankStalls(w).find((e) => e.id === g.id)?.minor === true, 'still a calm pin');
  // a market that takes the bread again: the D-393 reading returns
  w.state.market.saturation.bread = 0;
  if (granaryLoads(w, g.id) !== 'wagon') eq(calmWhy(w, g), 'filling', 'unsaturated: filling');
});

test('read cards: a yard refused by a saturated granary reads "market full", not "a fresh granary fills" (D-451)', () => {
  const { w, put } = valley();
  const full = granary(w);
  fill(full, 60, 0);
  w.state.market.saturation.bread = MARKET.cap;
  const fresh = put('warehouse', 60, 30);
  fill(fresh, 0, 6);
  fresh.stock.stone = 0;
  const bakery = w.state.buildings.find((b) => b.type === 'bakery') ?? put('bakery', 49, 25);
  bakery.status = { k: 'OUTPUT_FULL', good: 'bread', cause: 'NO_DESTINATION', blockedBy: full.id } as BuildingStatus;
  bakery.stalledTicks = 60 * TICK_HZ;
  eq(granaryLoads(w, full.id), 'saturated', 'the refusing granary is saturated');
  eq(freshGranary(w, bakery), fresh.id, 'a fresh granary fills (D-393)');
  eq(calmWhy(w, bakery), 'marketFull', 'the market is the root, as the sheet says');
});

test('read cards: a filling granary\'s sheet title says it fills, not "full" (D-454)', () => {
  const { w } = valley();
  const g = granary(w);
  fill(g, 0, 0);
  g.stock.stone = 11;
  g.incoming.stone = 49; // road stone: no market load (granaryLoads skips it)
  assert(granaryFilling(w, g.id), 'filling');
  eq(calmWhy(w, g), 'filling', 'the card: filling');
  eq(statusKey(g.status, w, g.id), 'status.STORAGE_FULL.filling', 'the title agrees with the card');
  g.stock.stone = 60;
  g.incoming.stone = 0;
  eq(statusKey(g.status, w, g.id), 'status.STORAGE_FULL', 'really full: the plain title');
});
