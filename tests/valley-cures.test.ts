// Research valley-ranks-2-3 (2026-11-05), fixes F2-F4: a placement never cuts a diagonal road step (D-172), a producer
// cut off from the network gets the road cure (D-173), "Kup wóz" only when a market takes another load (D-174), and
// the rank card skips a building the ghost finds no site for (D-175).
import { BUILDINGS, MARKET, capacityOf, createWorld, gateCell, stateHash, validatePlace, type BuildingType, type World } from '../src/sim/index';
import { calmWhy, cureFor, cutOffProducer, gapTarget, granaryLoads } from '../src/ui/stalls';
import { rankCard } from '../src/ui/paceCard';
import { buildSite, siteExists } from '../src/ui/site';
import { assert, eq, test } from './harness';

/** A free flat site for `type` with a one-cell free ring around it (top-left), scanning from the castle outward. */
function freeSite(w: World, type: BuildingType): { x: number; y: number } {
  const def = BUILDINGS[type], W = w.terrain.w;
  for (let y = 4; y < w.terrain.h - def.h - 4; y++) {
    for (let x = 4; x < W - def.w - 4; x++) {
      if (!validatePlace(w, type, x, y, 0, true).ok) continue;
      // the ring (and the cells the test puts roads on) must be dry, free land
      let ok = true;
      for (let yy = y - 2; yy <= y + def.h + 1 && ok; yy++) for (let xx = x - 2; xx <= x + def.w + 1 && ok; xx++) {
        const i = yy * W + xx;
        if (w.terrain.water[i] || w.state.roads[i] || Math.abs(w.terrain.cellH[i]! - w.terrain.cellH[y * W + x]!) > 0.5) ok = false;
      }
      if (ok && !w.state.buildings.some((b) => b.x < x + def.w + 3 && x < b.x + b.w + 3 && b.y < y + def.h + 3 && y < b.y + b.h + 3)) return { x, y };
    }
  }
  throw new Error('no free site');
}

test('placement refuses a footprint on the corner of a diagonal road step (D-172), not when the detour is a road', () => {
  const w = createWorld('sandbox');
  const { x, y } = freeSite(w, 'farm');
  const W = w.terrain.w;
  // a diagonal step from (x, y-1) down-left to (x-1, y): its corners are (x-1, y-1) and (x, y), the farm's top-left
  w.state.roads[(y - 1) * W + x] = 1;
  w.state.roads[y * W + x - 1] = 1;
  w.state.netVersion++;
  const r = validatePlace(w, 'farm', x, y, 0, true);
  assert(!r.ok && r.err.k === 'BLOCKED' && r.err.cell === y * W + x, `blocked at the corner (${JSON.stringify(r)})`);
  // a footprint one cell to the right leaves both corners free
  const r2 = validatePlace(w, 'farm', x + 1, y, 0, true);
  assert(r2.ok || (r2.err.k === 'BLOCKED' && r2.err.cell !== y * W + x + 1 && r2.err.cell !== y * W + x), `no cut one cell right (${JSON.stringify(r2)})`);
  // the other corner is a road: the orthogonal detour survives, the farm may stand
  w.state.roads[(y - 1) * W + x - 1] = 1;
  w.state.netVersion++;
  const r3 = validatePlace(w, 'farm', x, y, 0, true);
  assert(r3.ok, `detour by road: placeable (${JSON.stringify(r3)})`);
  // the build ghost never offers a cutting site
  const w2 = createWorld('sandbox');
  const castle = w2.state.buildings.find((b) => b.type === 'castle')!;
  const s = buildSite(w2, 'farm', castle.id);
  assert(!!s, 'a ghost site by the castle');
  eq(validatePlace(w2, 'farm', s!.x, s!.y, s!.facing).ok, true, 'the ghost site validates');
});

test('a producer cut off from the stable network, refused by an empty granary, gets the road cure (D-173)', () => {
  const w = createWorld('sandbox');
  const { x, y } = freeSite(w, 'farm');
  const before = w.state.buildings.length;
  const r = validatePlace(w, 'farm', x, y, 0, true);
  assert(r.ok, 'site');
  // place without the command (no link road): the farm's gate is a lone road cell
  const def = BUILDINGS.farm, gate = gateCell(w, x, y, def.w, def.h, 0);
  w.state.roads[gate] = 1;
  w.state.buildings.push({
    id: w.state.nextId++, type: 'farm', x, y, w: def.w, h: def.h, gate, facing: 0,
    stock: { ...w.state.buildings[0]!.stock }, reservedOut: { ...w.state.buildings[0]!.reservedOut }, incoming: { ...w.state.buildings[0]!.incoming },
    progress: -1, status: { k: 'IDLE' } as never, stalledTicks: 0, capOverride: -1, placedTick: -1,
  });
  for (const g of Object.keys(w.state.buildings[before]!.stock)) {
    (w.state.buildings[before]!.stock as Record<string, number>)[g] = 0;
    (w.state.buildings[before]!.reservedOut as Record<string, number>)[g] = 0;
    (w.state.buildings[before]!.incoming as Record<string, number>)[g] = 0;
  }
  w.state.netVersion++;
  const farm = w.state.buildings[before]!;
  const wh = w.state.buildings.find((b) => b.type === 'warehouse') ?? w.state.buildings.find((b) => b.type === 'castle')!;
  farm.status = { k: 'OUTPUT_FULL', good: 'grain', cause: 'NO_DESTINATION', blockedBy: wh.id };
  farm.stalledTicks = 600;
  const chain = [{ kind: 'building' as const, id: farm.id, status: farm.status }, { kind: 'building' as const, id: wh.id, status: { k: 'IDLE' } as never }];
  eq(cutOffProducer(w, chain), farm.id, 'the cut-off farm');
  eq(gapTarget(w, chain), farm.id, 'the gap finder links the farm');
  eq(cureFor(w, farm.id), 'road', 'the cure is a road');
});

test('a full granary needs a wagon only while a market takes another load (D-174)', () => {
  const w = createWorld('sandbox');
  const st = w.state;
  assert(st.market.open, 'the valley market is open');
  let wh = st.buildings.find((b) => b.type === 'warehouse');
  if (!wh) {
    const castle = st.buildings.find((b) => b.type === 'castle')!;
    const s = buildSite(w, 'warehouse', castle.id)!;
    st.coins += 1000;
    const r = validatePlace(w, 'warehouse', s.x, s.y, s.facing);
    assert(r.ok, 'granary site');
    w.state.buildings.push({ ...JSON.parse(JSON.stringify(castle)), id: st.nextId++, type: 'warehouse', x: s.x, y: s.y, status: { k: 'IDLE' }, stalledTicks: 0 });
    wh = st.buildings[st.buildings.length - 1]!;
  }
  const castle = st.buildings.find((b) => b.type === 'castle')!;
  const cap = capacityOf('bread');
  wh.stock.bread = cap * 2;
  wh.reservedOut.bread = 0;
  eq(granaryLoads(w, wh.id), 'wagon', 'room in flight, fair price: a wagon empties it');
  castle.incoming.bread = MARKET.inflightPerGood - cap + 1;
  const h = stateHash(w);
  eq(granaryLoads(w, wh.id), 'saturated', 'the castle has no room in flight for another load');
  eq(stateHash(w), h, 'read-only');
  castle.incoming.bread = 0;
  st.market.saturation.bread = MARKET.cap;
  eq(granaryLoads(w, wh.id), 'saturated', 'price on the floor');
  wh.status = { k: 'STORAGE_FULL' } as never;
  wh.stalledTicks = 600;
  eq(cureFor(w, wh.id), null, 'no Kup wóz, no granary');
  eq(calmWhy(w, wh), 'marketFull', 'the calm reason');
  st.market.saturation.bread = 0;
  eq(cureFor(w, wh.id) === 'wagon' || cureFor(w, wh.id) === null, true, 'unsaturated: the old cure path');
});

test('the rank card skips a building with no site by the castle (D-175, seed 1304 quarry)', () => {
  const setup = (seed: number): World => {
    const w = createWorld('sandbox', seed);
    w.state.town.rank = 2;
    w.state.coins = 2000;
    for (const g of ['wood', 'grain', 'flour', 'bread', 'fish'] as const) w.state.ledger.sold[g] = 1;
    // five goods sold (farm..fisher done), rank 3 needs six: the next on the card is the quarry
    return w;
  };
  const w4 = setup(1304);
  const castle4 = w4.state.buildings.find((b) => b.type === 'castle')!;
  eq(siteExists(w4, 'quarry', castle4.id), false, 'seed 1304: no rock by the castle');
  const rc4 = rankCard(w4);
  assert(!rc4 || rc4.type !== 'quarry', `seed 1304: no quarry card (${rc4?.type ?? 'none'})`);
  const w1 = setup(1301);
  const castle1 = w1.state.buildings.find((b) => b.type === 'castle')!;
  eq(siteExists(w1, 'quarry', castle1.id), true, 'seed 1301: rock by the castle');
  eq(rankCard(w1)?.type, 'quarry', 'seed 1301: the quarry card');
  // silver short: the site still counts (the card shows how much is missing)
  w1.state.coins = 0;
  eq(siteExists(w1, 'quarry', castle1.id), buildSite(w1, 'quarry', castle1.id, true) !== null, 'silver aside');
});
