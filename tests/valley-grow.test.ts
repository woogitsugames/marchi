// The grow card in the free valley (D-192, research valley-ranks-2-3 F1): from rank 1, when the next rank lacks only
// renown (D-264: or flow), the calm slot names one more producer of a standing chain, keeping the chain's ratios, never for a saturated
// end good, never a building the ghost has no site for. A player who follows only the cards places what it names.
import { BUILDINGS, MARKET, MISSIONS, TICK_HZ, applyCommand, createWorld, stateHash, step, suggestLinkToStable, type BuildingType, type World } from '../src/sim/index';
import { sandboxStatus } from '../src/sim/town';
import { FLEET_FREE_KEEP, growCard, paceCard, sampleFleet } from '../src/ui/paceCard';
import { bottleneckCard } from '../src/ui/bottleneck';
import { rankStalls, sampleInputWaits } from '../src/ui/stalls';
import { buildSite, siteExists } from '../src/ui/site';
import { assert, eq, test } from './harness';

const count = (w: World, t: BuildingType): number => w.state.buildings.filter((b) => b.type === t).length;

/** The card-only player of tools/sandbox-first30.ts (card-30): presses every pace card's cure at the ghost. */
function follow(w: World, minutes: number, onGrow: (w: World) => void): string[] {
  const placed: string[] = [];
  const stable = w.state.buildings.find((b) => b.type === 'stable')!.id;
  while (w.state.tick < minutes * 60 * TICK_HZ) {
    step(w);
    sampleInputWaits(w);
    sampleFleet(w);
    if (w.state.tick % (30 * TICK_HZ)) continue;
    const ranked = rankStalls(w);
    if (ranked.length && !ranked[0]!.minor) {
      // the worst stall's road cure (a fresh building's access road), as the sheet's gap finder
      const link = suggestLinkToStable(w, ranked[0]!.id);
      if (link && link.cells.length) applyCommand(w, { t: 'road', surface: 1, cells: link.cells });
      continue;
    }
    const pc = paceCard(w, null);
    if (!pc) continue;
    if (pc.k === 'fleet') { applyCommand(w, { t: 'buyWagon', stable }); continue; }
    if (pc.k !== 'rank' && pc.k !== 'grow') continue;
    if (pc.k === 'grow') onGrow(w);
    const s = buildSite(w, pc.type, pc.producer);
    if (!s) continue;
    const before = w.state.buildings.length;
    if (!applyCommand(w, { t: 'place', type: pc.type, x: s.x, y: s.y, facing: s.facing }).ok) continue;
    placed.push(`${pc.k}:${pc.type}`);
    const link = suggestLinkToStable(w, w.state.buildings[before]!.id);
    if (link && link.cells.length) applyCommand(w, { t: 'road', surface: 1, cells: link.cells });
  }
  return placed;
}

test('valley grow card: renown or flow missing, ratios kept, fresh end good, a site, silver with the reserve', () => {
  const w = createWorld('sandbox');
  let checked = 0;
  const placed = follow(w, 45, (w) => {
    const g = growCard(w)!;
    const sb = sandboxStatus(w);
    assert(sb.rank >= 1 && !!sb.next, 'from rank 1');
    assert(sb.goodsSold >= sb.next!.goods, 'goods met');
    // D-264: renown or flow short; the card says which (flow whenever it is short)
    assert(sb.renown < sb.next!.renown || sb.bestFlow < sb.next!.flow, 'renown or flow missing');
    eq(g.short, sb.bestFlow < sb.next!.flow ? 'flow' : 'renown', 'names what is short');
    eq(g.rank, sb.next!.rank, 'names the next rank');
    assert(w.state.coins >= BUILDINGS[g.type].price + FLEET_FREE_KEEP, 'affordable with the reserve');
    // a standing chain, or (D-265) a good never sold when every standing chain is saturated
    assert(count(w, g.type) > 0 || g.type === 'mill' || g.type === 'bakery' || g.type === 'sawmill' || w.state.ledger.sold[g.good] === 0, 'a standing chain or a fresh good');
    if (g.type === 'farm') assert(count(w, 'farm') <= count(w, 'mill'), 'farm <= mill');
    if (g.type === 'mill') assert(count(w, 'mill') < count(w, 'farm'), 'mill < farm');
    if (g.type === 'bakery') assert(count(w, 'bakery') < count(w, 'mill'), 'bakery < mill');
    if (g.type === 'woodcutter') assert(count(w, 'woodcutter') <= count(w, 'sawmill'), 'woodcutter <= sawmill');
    if (g.type === 'sawmill') assert(count(w, 'sawmill') < count(w, 'woodcutter'), 'sawmill < woodcutter');
    assert(w.state.market.saturation[g.good] < MARKET.cap / 2, `${g.good} not saturated`);
    assert(siteExists(w, g.type, g.producer), 'a site by the card subject (the castle, D-266: or a neighbour)');
    eq(bottleneckCard(w), null, 'never over the bottleneck card');
    const hash = stateHash(w);
    growCard(w); paceCard(w, null);
    eq(stateHash(w), hash, 'read-only');
    checked++;
  });
  assert(checked > 0, `the card showed (${placed.join(',')})`);
  assert(placed.some((p) => p.startsWith('grow:')), `the player placed a grow building (${placed.join(',')})`);
  const sb = sandboxStatus(w);
  assert(sb.rank >= 2, `rank 2 within 45 min with the card (rank ${sb.rank})`);
});

test('valley grow card: a saturated end good closes its chain', () => {
  const w = createWorld('sandbox');
  let done = false;
  follow(w, 40, (w) => {
    if (done) return;
    done = true;
    const g = growCard(w)!;
    const keep = w.state.market.saturation[g.good];
    w.state.market.saturation[g.good] = MARKET.cap / 2;
    const h = growCard(w);
    assert(!h || h.good !== g.good, `no card for a saturated ${g.good} (${h?.type})`);
    w.state.market.saturation[g.good] = keep;
    eq(growCard(w)?.type, g.type, 'back once the price recovers');
  });
  assert(done, 'a grow card within 40 min');
});

test('valley grow card: never with a contract, never in a fresh valley', () => {
  eq(growCard(createWorld('sandbox')), null, 'rank 0: the rank card is the one');
  for (const id of Object.keys(MISSIONS)) {
    if (id === 'sandbox') continue;
    const w = createWorld(id as never);
    for (let i = 0; i < 30 * TICK_HZ; i++) step(w);
    eq(growCard(w), null, `no grow card in ${id}`);
    assert(paceCard(w, null)?.k !== 'grow', `pace card is not the grow kind in ${id}`);
  }
});

// D-251: the rank-5 chains grow too — the charcoal burner on its own, the malthouse no sooner than a brewery, the
// brewery only behind a spare malthouse. Staged at rank 4 with every good sold and the flow reached.
test('valley grow card: charcoal burner and malthouse/brewery chains keep their ratios (D-251)', () => {
  const w = createWorld('sandbox');
  const st = w.state;
  st.town.rank = 4;
  st.town.bestFlow = 999;
  st.coins = 5000;
  for (const g of ['wood', 'planks', 'grain', 'flour', 'bread', 'fish', 'stone', 'charcoal', 'malt', 'beer'] as const) st.ledger.sold[g] = 1;
  const castle = st.buildings.find((b) => b.type === 'castle')!;
  const place = (type: BuildingType): void => {
    const s = buildSite(w, type, castle.id)!;
    assert(!!s && applyCommand(w, { t: 'place', type, x: s.x, y: s.y, facing: s.facing }).ok, `${type} placed`);
  };
  const seen: string[] = [];
  for (const t of ['farm', 'mill', 'bakery', 'fisher', 'charcoalBurner', 'malthouse'] as const) if (!count(w, t)) place(t);
  for (let i = 0; i < 8; i++) {
    const g = growCard(w);
    if (!g) break;
    if (g.type === 'malthouse') assert(count(w, 'malthouse') <= count(w, 'brewery'), 'malthouse <= brewery');
    if (g.type === 'brewery') assert(count(w, 'brewery') < count(w, 'malthouse'), 'brewery < malthouse');
    seen.push(g.type);
    place(g.type);
  }
  assert(seen.includes('charcoalBurner'), `the charcoal burner grows (${seen.join(',')})`);
  assert(seen.includes('brewery'), `the brewery grows behind the malthouse (${seen.join(',')})`);
});
