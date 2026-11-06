// The rank card in the free valley (owner 2026-11-05, D-152): no contract, the slot empty or calm, the next rank still
// lacks distinct goods sold -> the card names the next unbuilt producer of an unsold good (farm, mill, bakery, ...).
// Never with a contract; read-only. Driven like the fleet test: the research's minimal build order.
import { BUILDINGS, MISSIONS, TICK_HZ, applyCommand, createWorld, stateHash, step, suggestLinkToStable } from '../src/sim/index';
import { sandboxStatus } from '../src/sim/town';
import { buildSite } from '../src/ui/site';
import { paceCard, rankCard, sampleFleet } from '../src/ui/paceCard';
import { MIN } from '../tools/sandbox-first30';
import { assert, eq, test } from './harness';

test('valley rank card: a fresh valley names the farm, by the castle, read-only', () => {
  const w = createWorld('sandbox');
  const pc = paceCard(w, null);
  assert(!!pc && pc.k === 'rank', `a rank card in a fresh valley (${pc?.k ?? 'none'})`);
  if (!pc || pc.k !== 'rank') return;
  eq(pc.type, 'farm', 'the first producer is the farm');
  const castle = w.state.buildings.find((b) => b.type === 'castle')!;
  eq(pc.producer, castle.id, "the castle is the card's subject");
  assert(!!buildSite(w, pc.type, pc.producer), 'a site for the ghost by the castle');
  const hash = stateHash(w);
  for (let i = 0; i < 3; i++) paceCard(w, null);
  eq(stateHash(w), hash, 'read-only');
});

test('valley rank card: follows the build order and stops once the goods are sold', () => {
  const w = createWorld('sandbox');
  const done = new Set<number>();
  const seen = new Set<string>();
  while (w.state.tick < 20 * 60 * TICK_HZ) {
    step(w);
    sampleFleet(w);
    const st = w.state;
    MIN.forEach((s, i) => {
      if (done.has(i)) return;
      if ((s.after !== undefined && st.tick < s.after * TICK_HZ) || (s.rank !== undefined && st.town.rank < s.rank)) return;
      for (const c of s.cmds(w)) applyCommand(w, c);
      done.add(i);
    });
    if (st.tick % (10 * TICK_HZ)) continue;
    const rc = rankCard(w);
    const sb = sandboxStatus(w);
    if (!rc) continue;
    seen.add(rc.type);
    assert(!!sb.next && sb.goodsSold < sb.next.goods, 'only while the next rank lacks goods sold');
    assert(!st.buildings.some((b) => b.type === rc.type), `${rc.type} not built yet`);
    eq(st.ledger.sold[rc.good], 0, `${rc.good} not sold yet`);
    if (rc.type === 'mill') assert(st.buildings.some((b) => b.type === 'farm'), 'mill only once a farm stands');
    if (rc.type === 'bakery') assert(st.buildings.some((b) => b.type === 'mill'), 'bakery only once a mill stands');
    assert(BUILDINGS[rc.type].price > 0, 'priced');
  }
  assert(seen.has("farm"), `the card named the farm (${[...seen].join(',')})`);
});

test('valley rank card: never with a contract', () => {
  for (const id of Object.keys(MISSIONS)) {
    if (id === 'sandbox') continue;
    const w = createWorld(id as never);
    if (!w.state.mission.contract) continue;
    for (let i = 0; i < 30 * TICK_HZ; i++) step(w);
    eq(rankCard(w), null, `no rank card in ${id}`);
    const pc = paceCard(w, null);
    assert(!pc || pc.k !== 'rank', `pace card is not the rank kind in ${id}`);
  }
});

// D-152 follow-up (day 9f): a player who only follows the card. Whenever it is the rank kind and the silver is
// there, "Postaw: <name>" places that producer at the ghost the button opens (buildSite by the castle), and the
// placed building's own sheet fix — the missing road to it (gap finder) — is pressed too; a fleet card's "Kup wóz"
// likewise. The card must lead through farm -> mill -> bakery, each placement valid where the ghost stands.
test('valley rank card: a player following it places farm, mill and bakery at the ghost', () => {
  const w = createWorld('sandbox');
  const placed: string[] = [];
  const stable = w.state.buildings.find((b) => b.type === 'stable')!.id;
  const end = 45 * 60 * TICK_HZ;
  while (w.state.tick < end && placed.length < 3) {
    step(w);
    sampleFleet(w);
    if (w.state.tick % (10 * TICK_HZ)) continue;
    const pc = paceCard(w, null);
    if (pc?.k === 'fleet') { applyCommand(w, { t: 'buyWagon', stable }); continue; }
    if (pc?.k !== 'rank' || w.state.coins < BUILDINGS[pc.type].price) continue;
    const site = buildSite(w, pc.type, pc.producer);
    assert(!!site, `a ghost site for ${pc.type}`);
    if (!site) return;
    const before = w.state.buildings.length;
    const res = applyCommand(w, { t: 'place', type: pc.type, x: site.x, y: site.y, facing: site.facing });
    assert(res.ok, `${pc.type} placed at the ghost (${res.ok ? '' : res.err.k})`);
    if (!res.ok) return;
    const b = w.state.buildings[before]!;
    const link = suggestLinkToStable(w, b.id);
    if (link && link.cells.length && w.state.coins >= link.cost) applyCommand(w, { t: 'road', surface: 1, cells: link.cells });
    placed.push(pc.type);
  }
  eq(placed.join(','), 'farm,mill,bakery', `the card led through farm, mill, bakery by ${Math.round(w.state.tick / TICK_HZ / 60)} min`);
});

// D-250 (BACKLOG P2 D-245): from rank 3 the card also names the rank-5 goods' producers — charcoal burner, malthouse,
// brewery (once a malthouse stands) — each at a valid ghost by the castle, and goes away once the goods are sold.
test('valley rank card: names charcoal burner, malthouse, brewery for rank 5 (D-250)', () => {
  const w = createWorld('sandbox');
  const st = w.state;
  st.town.rank = 4;
  st.coins = 5000;
  for (const g of ['wood', 'planks', 'grain', 'flour', 'bread', 'fish', 'stone'] as const) st.ledger.sold[g] = 1;
  const castle = st.buildings.find((b) => b.type === 'castle')!;
  const place = (type: 'farm' | 'charcoalBurner' | 'malthouse' | 'brewery'): void => {
    const s = buildSite(w, type, castle.id);
    assert(!!s, `a ghost site for ${type}`);
    const r = applyCommand(w, { t: 'place', type, x: s!.x, y: s!.y, facing: s!.facing });
    assert(r.ok, `${type} placed at the ghost (${r.ok ? '' : r.err.k})`);
  };
  const order: string[] = [];
  const h0 = stateHash(w);
  const first = rankCard(w);
  eq(stateHash(w), h0, 'read-only');
  if (!st.buildings.some((b) => b.type === 'farm')) place('farm');
  for (let i = 0; i < 4; i++) {
    const rc = rankCard(w);
    if (!rc) break;
    eq(rc.rank, 5, 'aims at rank 5');
    eq(rc.goods, 9, 'rank 5 needs 9 goods');
    order.push(rc.type);
    place(rc.type as never);
  }
  eq(first?.type, 'charcoalBurner', 'the charcoal burner first');
  eq(order.join(','), 'charcoalBurner,malthouse,brewery', 'then the malthouse, then the brewery');
  eq(rankCard(w), null, 'nothing left to name');
  // the brewery waits for a malthouse; once two of the three goods are sold the card is gone
  const w2 = createWorld('sandbox');
  w2.state.town.rank = 4;
  for (const g of ['wood', 'planks', 'grain', 'flour', 'bread', 'fish', 'stone', 'charcoal'] as const) w2.state.ledger.sold[g] = 1;
  const rc2 = rankCard(w2);
  assert(!rc2 || rc2.type !== 'brewery', 'no brewery before a malthouse');
  w2.state.ledger.sold.malt = 1;
  eq(rankCard(w2), null, 'goods met: no rank card');
});
