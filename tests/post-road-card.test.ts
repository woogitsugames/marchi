// D-245 (BACKLOG P2 from D-233): in the free valley from rank 4, full granaries the saturated castle will not empty read
// calm "rynek nasycony"; when the open trading post across the river would take their loads but has no road, the
// granary's sheet and a calm-slot card lead to the post's road (the gap finder's link with the bridge).
import { MARKET, applyCommand, capacityOf, createWorld, linkedToStable, reachable, stateHash, suggestLinkToStable, tradePostOf, validatePlace, type Building, type World } from '../src/sim/index';
import { cureFor, marketSaturated, postWouldTake } from '../src/ui/stalls';
import { paceCard, postCard, rankCard } from '../src/ui/paceCard';
import { buildSite } from '../src/ui/site';
import { assert, eq, test } from './harness';

/** A free valley at rank 4 with one full granary of bread the castle will not take (no room in flight). */
function saturatedValley(): { w: World; wh: Building; post: Building } {
  const w = createWorld('sandbox');
  const st = w.state;
  st.town.rank = 4;
  const castle = st.buildings.find((b) => b.type === 'castle')!;
  const s = buildSite(w, 'warehouse', castle.id)!;
  assert(validatePlace(w, 'warehouse', s.x, s.y, s.facing).ok, 'granary site');
  // the granary shares the castle's gate (test setup, as valley-cures D-174): on the castle's road component
  st.buildings.push({ ...JSON.parse(JSON.stringify(castle)), id: st.nextId++, type: 'warehouse', x: s.x, y: s.y, status: { k: 'STORAGE_FULL' }, stalledTicks: 600 });
  const wh = st.buildings[st.buildings.length - 1]!;
  const cap = capacityOf('bread');
  wh.stock.bread = cap * 2;
  wh.reservedOut.bread = 0;
  castle.incoming.bread = MARKET.inflightPerGood - cap + 1;
  const post = tradePostOf(w)!;
  assert(!!post && !linkedToStable(w, post), 'the post stands without a road');
  return { w, wh, post };
}

test('a saturated granary leads to the unlinked trading post that would take its loads (D-245)', () => {
  const { w, wh, post } = saturatedValley();
  const h = stateHash(w);
  eq(marketSaturated(w, wh), true, 'still "rynek nasycony" (calm, no clay)');
  eq(cureFor(w, wh.id), null, 'no Kup wóz (D-233)');
  eq(postWouldTake(w, wh.id), post.id, 'the post would take the bread');
  const c = postCard(w);
  assert(!!c && c.k === 'post' && c.producer === post.id && c.good === 'bread' && c.granaries === 1, `post card (${JSON.stringify(c)})`);
  eq(c!.bridge, true, 'the link crosses the river');
  eq(c!.cost, suggestLinkToStable(w, post.id)!.cost, 'the gap finder link');
  // the rank card (goods still missing, fleet enough) keeps its place; otherwise the post card takes the slot
  if (!rankCard(w)) eq(paceCard(w, null)?.k, 'post', 'the calm slot shows the post card');
  eq(stateHash(w), h, 'read-only');
});

test('the post card goes away when it would not help (D-245)', () => {
  {
    const { w, wh } = saturatedValley();
    w.state.town.rank = 3;
    eq(postWouldTake(w, wh.id), -1, 'post closed before rank 4');
    eq(postCard(w), null, 'no card before rank 4');
  }
  {
    const { w, wh, post } = saturatedValley();
    post.incoming.bread = MARKET.inflightPerGood;
    eq(postWouldTake(w, wh.id), -1, 'the post has no room in flight for bread');
  }
  {
    const { w, wh } = saturatedValley();
    w.state.buildings.find((b) => b.type === 'castle')!.incoming.bread = 0;
    eq(postWouldTake(w, wh.id), -1, 'the castle takes the load: a wagon is the cure, not the post');
  }
  {
    const { w, wh } = saturatedValley();
    wh.status = { k: 'IDLE' } as never;
    eq(postCard(w), null, 'a granary not full: no card');
  }
  {
    const { w, wh, post } = saturatedValley();
    w.state.coins += 5000;
    const link = suggestLinkToStable(w, post.id)!;
    const r = applyCommand(w, { t: 'road', surface: 1, cells: link.cells });
    assert(r.ok, `the gap finder road builds (${JSON.stringify(r)})`);
    assert(reachable(w, wh.gate, post.gate), 'the granary now reaches the post');
    eq(postWouldTake(w, wh.id), -1, 'connected: the granary is no longer stuck on the post');
    eq(postCard(w), null, 'connected: the card is gone for good');
  }
});

test('the post card never appears in a mission (D-245)', () => {
  for (const id of ['m1', 'm6', 'm12'] as const) {
    const w = createWorld(id);
    eq(postCard(w), null, `${id}: no post card`);
  }
});
