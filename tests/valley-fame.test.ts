// The free valley's fame gap (research 2026-11-07-valley-fame-gap, D-264..D-267): the grow card also covers a rank
// held on silver flow, names a good never sold when every standing chain is saturated, lets the malthouse grow on its
// own malt before the brewery is allowed, and its ghost (and the rank card's) opens only where a road can reach it.
import { GOODS, MARKET, applyCommand, createWorld, stateHash, type BuildingType, type Good, type World } from '../src/sim/index';
import { growCard, paceCard, rankCard } from '../src/ui/paceCard';
import { buildSite, siteExists, siteLinked } from '../src/ui/site';
import { assert, eq, test } from './harness';

const count = (w: World, t: BuildingType): number => w.state.buildings.filter((b) => b.type === t).length;

/** A valley at `rank` with the goods sold, silver to spend, and the given producers placed by the castle. */
function staged(rank: number, sold: readonly Good[], types: readonly BuildingType[]): World {
  const w = createWorld('sandbox');
  const st = w.state;
  st.town.rank = rank;
  st.coins = 5000;
  for (const g of sold) st.ledger.sold[g] = 1;
  const castle = st.buildings.find((b) => b.type === 'castle')!;
  for (const type of types) {
    if (count(w, type)) continue;
    const s = buildSite(w, type, castle.id)!;
    assert(!!s && applyCommand(w, { t: 'place', type, x: s.x, y: s.y, facing: s.facing }).ok, `${type} placed`);
  }
  return w;
}
const saturate = (w: World, keep: readonly Good[]): void => {
  for (const g of GOODS) if (!keep.includes(g)) w.state.market.saturation[g] = MARKET.cap;
};
const RANK3_GOODS: Good[] = ['wood', 'planks', 'grain', 'flour', 'bread', 'fish', 'stone'];

test('valley fame: the grow card covers a rank held on flow alone and says so (D-264)', () => {
  const w = staged(3, RANK3_GOODS, ['farm', 'mill', 'bakery', 'fisher']);
  const st = w.state;
  st.town.renown = 8000; // rank 4 needs 7200
  st.town.bestFlow = 100; // ...and 120 silver a minute
  const hash = stateHash(w);
  const g = growCard(w);
  assert(!!g, 'a grow card while only the flow is short');
  eq(g!.short, 'flow', 'it names the flow');
  eq(g!.flow, 100, 'best flow');
  eq(g!.flowNeed, 120, 'flow the next rank needs');
  eq(paceCard(w, null)?.k, 'grow', 'it takes the calm slot');
  eq(stateHash(w), hash, 'read-only');
  st.town.bestFlow = 999;
  eq(growCard(w), null, 'nothing once renown and flow are met');
  st.town.renown = 5000;
  eq(growCard(w)?.short, 'renown', 'renown alone short: the renown text');
});

test('valley fame: every standing chain saturated — the grow card names a good never sold (D-265)', () => {
  const w = staged(3, RANK3_GOODS, ['farm', 'mill', 'bakery', 'fisher', 'sawmill']);
  w.state.town.renown = 4000;
  w.state.town.bestFlow = 999;
  saturate(w, ['charcoal', 'malt', 'beer']);
  const g = growCard(w);
  assert(!!g, 'a grow card');
  eq(g!.type, 'charcoalBurner', 'the rank order\'s next new producer (the woodcutter stands)');
  eq(w.state.ledger.sold[g!.good], 0, 'its good was never sold');
  w.state.market.saturation.bread = 0;
  assert(growCard(w)?.type !== 'charcoalBurner', 'a fresh standing chain comes first');
});

test('valley fame: the malthouse grows on its own malt until the brewery is allowed (D-267)', () => {
  const w = staged(3, [...RANK3_GOODS, 'charcoal', 'malt'], ['farm', 'mill', 'bakery', 'fisher', 'sawmill', 'charcoalBurner', 'malthouse']);
  w.state.town.renown = 4000;
  w.state.town.bestFlow = 999;
  saturate(w, ['malt', 'beer']);
  const g = growCard(w);
  eq(g?.type, 'malthouse', 'a second malthouse while the brewery is locked');
  w.state.town.rank = 4;
  w.state.ledger.sold.beer = 1;
  w.state.town.renown = 9000;
  const h = growCard(w);
  assert(h?.type !== 'malthouse', `with the brewery allowed the malthouse waits for it (${h?.type})`);
});

test('valley fame: the cards\' ghosts open where a road reaches them (D-266)', () => {
  const w = staged(3, RANK3_GOODS.slice(0, 6), ['farm', 'mill', 'bakery', 'fisher']);
  const pc = rankCard(w);
  assert(!!pc, 'a rank card');
  const s = buildSite(w, pc!.type, pc!.producer)!;
  assert(!!s && siteLinked(w, pc!.type, s), 'its ghost site is linked');
  assert(siteExists(w, pc!.type, pc!.producer), 'siteExists agrees');
  // no road the gap finder could join (the network gone, the stable's gate too): no site counts as linked
  const hash = stateHash(w);
  w.state.roads.fill(0);
  w.state.netVersion++;
  eq(siteLinked(w, pc!.type, s), false, 'a site with no network to join is not linked');
  assert(stateHash(w) !== hash, 'staged');
  const before = stateHash(w);
  siteLinked(w, 'farm', s);
  eq(stateHash(w), before, 'read-only');
});
