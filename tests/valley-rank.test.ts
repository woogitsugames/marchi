// The rank card in the free valley (owner 2026-11-05, D-152): no contract, the slot empty or calm, the next rank still
// lacks distinct goods sold -> the card names the next unbuilt producer of an unsold good (farm, mill, bakery, ...).
// Never with a contract; read-only. Driven like the fleet test: the research's minimal build order.
import { BUILDINGS, MISSIONS, TICK_HZ, applyCommand, createWorld, stateHash, step } from '../src/sim/index';
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
  assert(seen.has("farm") && seen.size >= 2, `the card named producers (${[...seen].join(',')})`);
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
