// Free valley chains (D-29, docs/design/sandbox.md §3, S1/S5): data-driven goods, the fisher, quarry,
// charcoal burner, malthouse and brewery, per-good wagon loads, the new placement errors, the
// CONTESTED input cause, stone as building material, ranks 4-5, the v4 -> v5 save gate, and the
// promise that contract missions run exactly as in state v4.
import { migrate } from '../src/platform/save';
import { gateEnvelope, makeEnvelope, prepareLoad, type GateResult } from '../src/platform/saveGate';
import {
  BUILDINGS, GOODS, GOODS_V4, MARKET, RANKS, STATE_VERSION, STONE_COBBLE, STONE_RESERVE, TICK_HZ, WAGON_CAPACITY,
  applyCommand, capacityOf, castleLevel, checkInvariants, createWorld, deserialize, emptyGoods, explainBuilding,
  lineCells, serialize, stateHash, step, unexplainedStalls, validatePlace, validateRoad, type BuildingType, type Good,
  type World,
} from '../src/sim/index';
import { hashString } from '../src/sim/hash';
import { place } from '../src/sim/commands';
import { sandboxStatus, stepTown } from '../src/sim/town';
import { plans } from '../tools/balance';
import { DECENT, runSandbox } from '../tools/bot-sandbox';
import { generateScenario, makeWorld, runScenario } from '../tools/fuzz-lib';
import { freshValleyEvents } from '../src/sim/events';
import { assert, eq, test } from './harness';

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const NEW_GOODS: Good[] = ['fish', 'stone', 'charcoal', 'malt', 'beer'];
const NEW_TYPES: BuildingType[] = ['fisher', 'quarry', 'charcoalBurner', 'malthouse', 'brewery'];

/** The free valley with every rank up to `rank` reached (all of its unlocks open). */
function valley(rank: number): World {
  return makeWorld(`sandbox@${rank}`, null);
}
const cellAt = (w: World, x: number, y: number) => y * w.terrain.w + x;
const col = (w: World, x: number, y1: number, y2: number) => lineCells(w.terrain.w, cellAt(w, x, y1), cellAt(w, x, y2));
const row = (w: World, y: number, x1: number, x2: number) => lineCells(w.terrain.w, cellAt(w, x1, y), cellAt(w, x2, y));
const stableId = (w: World) => w.state.buildings.find((b) => b.type === 'stable')!.id;
const byType = (w: World, t: BuildingType) => w.state.buildings.filter((b) => b.type === t);

/** Put stone into the first granary as if it had been produced (keeps conservation). */
function giveStone(w: World, n: number): void {
  const wh = byType(w, 'warehouse')[0]!;
  wh.stock.stone += n;
  w.state.ledger.produced.stone += n;
}

function runChecked(w: World, ticks: number, each?: (w: World) => void): void {
  for (let i = 0; i < ticks; i++) {
    step(w);
    each?.(w);
    if (i % 10 === 0) {
      const v = [...checkInvariants(w), ...unexplainedStalls(w)];
      assert(v.length === 0, `tick ${w.state.tick}: ${v.join('; ')}`);
    }
  }
}

// --- S1: goods are data ---------------------------------------------------------------------------

test('goods are data: ten goods, every goods map of a fresh state has them all in GOODS order', () => {
  eq(GOODS.join(','), 'wood,planks,grain,flour,bread,fish,stone,charcoal,malt,beer', 'canonical order (append-only)');
  eq(GOODS.slice(0, GOODS_V4.length).join(','), GOODS_V4.join(','), 'v4 goods first');
  eq(Object.keys(emptyGoods()).join(','), GOODS.join(','), 'emptyGoods key order');
  const order = GOODS.join(',');
  for (const id of ['m1', 'm5', 'sandbox']) {
    const st = createWorld(id).state;
    const maps: [string, object][] = [
      ['ledger.produced', st.ledger.produced], ['ledger.consumed', st.ledger.consumed], ['ledger.destroyed', st.ledger.destroyed],
      ['ledger.sold', st.ledger.sold], ['market.saturation', st.market.saturation],
      ...st.buildings.flatMap((b) => [[`b${b.id}.stock`, b.stock], [`b${b.id}.reservedOut`, b.reservedOut], [`b${b.id}.incoming`, b.incoming]] as [string, object][]),
    ];
    if (st.mission.contract) {
      maps.push(['contract.need', st.mission.contract.need]);
      for (const t of st.mission.contract.tranches) maps.push(['tranche.need', t.need]);
    }
    for (const [name, m] of maps) eq(Object.keys(m).join(','), order, `${id} ${name}`);
  }
  for (const g of GOODS) assert(MARKET.base[g] > 0, `market price for ${g}`);
  eq([MARKET.base.fish, MARKET.base.stone, MARKET.base.charcoal, MARKET.base.malt, MARKET.base.beer].join(','), '3,2,4,4,9', 'new base prices');
  eq(rankOfType('fisher') + ',' + rankOfType('quarry') + ',' + rankOfType('charcoalBurner') + ',' + rankOfType('malthouse') + ',' + rankOfType('brewery'),
    '2,2,3,3,4', 'unlock table');
});

function rankOfType(t: BuildingType): number {
  return RANKS.findIndex((r) => r.unlocks.includes(t));
}

test('recipes of the new buildings match the design table (sizes, inputs, outputs, cycle)', () => {
  const want: Record<string, string> = {
    fisher: '2x2 -> 1 fish / 9 s',
    quarry: '3x2 -> 1 stone / 12 s',
    charcoalBurner: '2x2 2 wood -> 1 charcoal / 20 s',
    malthouse: '2x2 2 grain -> 1 malt / 12 s',
    brewery: '3x2 1 malt -> 2 beer / 16 s',
  };
  for (const t of NEW_TYPES) {
    const d = BUILDINGS[t], r = d.recipe!;
    const ins = GOODS.filter((g) => (r.inputs[g] ?? 0) > 0).map((g) => `${r.inputs[g]} ${g}`).join(' + ');
    const outs = GOODS.filter((g) => (r.outputs[g] ?? 0) > 0).map((g) => `${r.outputs[g]} ${g}`).join(' + ');
    eq(`${d.w}x${d.h}${ins ? ' ' + ins : ''} -> ${outs} / ${r.ticks / TICK_HZ} s`, want[t]!, t);
  }
});

// --- per-good wagon loads ---------------------------------------------------------------------------

test('per-good wagon capacity: stone travels 4 to a load, everything else 6', () => {
  for (const g of GOODS) eq(capacityOf(g), g === 'stone' ? 4 : WAGON_CAPACITY, `capacity ${g}`);
  const w = valley(2);
  assert(applyCommand(w, { t: 'road', surface: 1, cells: col(w, 58, 10, 23) }).ok, 'road to the ridge');
  assert(place(w, 'quarry', 57, 7, 0, true).ok, 'quarry');
  const q = byType(w, 'quarry')[0]!;
  q.stock.stone = 8; w.state.ledger.produced.stone += 8;
  let maxStone = 0, otherFull = 0;
  runChecked(w, 4 * 60 * TICK_HZ, (x) => {
    for (const wg of x.state.wagons) {
      if (wg.cargoGood === 'stone') maxStone = Math.max(maxStone, wg.cargoQty);
      else if (wg.cargoGood && wg.cargoQty === 6) otherFull++;
    }
  });
  eq(maxStone, 4, 'a stone load is 4');
  assert(otherFull > 0, 'planks still travel 6 to a load');
  const wh = byType(w, 'warehouse')[0]!;
  assert(wh.stock.stone > 0 && wh.stock.stone + wh.incoming.stone <= STONE_RESERVE, `granary keeps a stone reserve: ${wh.stock.stone}`);
});

// --- placement -------------------------------------------------------------------------------------

test('placement: fisher needs water next to it (NOT_NEAR_WATER), quarry needs rock (NOT_ON_ROCK); validation is pure', () => {
  const w = valley(3);
  w.state.coins = 1000;
  const h0 = stateHash(w);
  const err = (t: BuildingType, x: number, y: number, f: number) => { const r = validatePlace(w, t, x, y, f); return r.ok ? 'ok' : r.err.k; };
  eq(err('fisher', 30, 30, 2), 'NOT_NEAR_WATER', 'fisher on dry land');
  eq(err('fisher', 44, 32, 2), 'ok', 'fisher on the bank');
  eq(err('quarry', 30, 9, 0), 'NOT_ON_ROCK', 'quarry on the plain');
  eq(err('quarry', 57, 7, 0), 'ok', 'quarry under the ridge');
  eq(err('quarry', 70, 55, 0), 'ok', 'quarry on the east hill');
  eq(err('charcoalBurner', 18, 25, 2), 'ok', 'charcoal burner anywhere flat');
  eq(err('fisher', 44, 34, 2), 'BLOCKED', 'still not in the water');
  eq(stateHash(w), h0, 'validatePlace does not change the state');
  // the command agrees with the validator and changes nothing on refusal
  const r = applyCommand(w, { t: 'place', type: 'fisher', x: 30, y: 30, facing: 2 });
  assert(!r.ok && r.err.k === 'NOT_NEAR_WATER', 'place refused');
  eq(stateHash(w), h0, 'refused place changes nothing');
  assert(applyCommand(w, { t: 'place', type: 'fisher', x: 44, y: 32, facing: 2 }).ok, 'fisher placed');
  // the rank gate comes first in the free valley
  const low = valley(1);
  low.state.coins = 1000;
  const lr = validatePlace(low, 'fisher', 44, 32, 2);
  assert(!lr.ok && lr.err.k === 'LOCKED' && lr.err.rank === 2, 'fisher locked below rank 2');
  // contract missions have no rank gate, but the site rule still holds
  const m1 = createWorld('lab');
  const mr = validatePlace(m1, 'quarry', 30, 9, 0);
  assert(!mr.ok && mr.err.k === 'NOT_ON_ROCK', 'site rule outside the valley too');
});

// --- CONTESTED --------------------------------------------------------------------------------------

test('one woodcutter, a sawmill and a charcoal burner: wood is shared fairly and the loser reads CONTESTED{sawmill}', () => {
  const w = valley(3);
  assert(place(w, 'charcoalBurner', 18, 25, 2, true).ok, 'charcoal burner');
  w.state.coins = 1000;
  for (let i = 0; i < 3; i++) assert(applyCommand(w, { t: 'buyWagon', stable: stableId(w) }).ok, 'wagon');
  const saw = byType(w, 'sawmill')[0]!, burner = byType(w, 'charcoalBurner')[0]!;
  let contested = 0, chainOk = false, sawContested = 0;
  runChecked(w, 15 * 60 * TICK_HZ, (x) => {
    const s = burner.status;
    if (s.k === 'NO_INPUT' && s.cause === 'CONTESTED') {
      contested++;
      eq(s.good, 'wood', 'contested good');
      eq(s.blockedBy, saw.id, 'blocked by the sawmill');
      const chain = explainBuilding(x, burner.id);
      if (chain.length >= 2 && chain[1]!.kind === 'building' && chain[1]!.id === saw.id) chainOk = true;
    }
    const ss = saw.status;
    if (ss.k === 'NO_INPUT' && ss.cause === 'CONTESTED') sawContested++;
  });
  assert(contested > 0, 'the charcoal burner saw the competition');
  assert(chainOk, 'the cause chain leads to the sawmill');
  const st = w.state;
  const woodToSaw = st.ledger.produced.planks / 2, woodToBurner = st.ledger.produced.charcoal * 2;
  const share = woodToBurner / (woodToSaw + woodToBurner);
  assert(share >= 0.35 && share <= 0.65, `fair split: burner got ${(share * 100).toFixed(0)} % of the wood (saw ${woodToSaw}, burner ${woodToBurner}; saw contested ${sawContested})`);
});

test('consumers of the same kind never read CONTESTED (two mills share grain as before)', () => {
  const w = createWorld('lab');
  w.state.coins = 2000;
  assert(applyCommand(w, { t: 'place', type: 'mill', x: 30, y: 37, facing: 0 }).ok, 'second mill');
  assert(applyCommand(w, { t: 'road', surface: 1, cells: col(w, 31, 39, 43) }).ok, 'road');
  runChecked(w, 6 * 60 * TICK_HZ, (x) => {
    for (const b of x.state.buildings) assert(!(b.status.k === 'NO_INPUT' && b.status.cause === 'CONTESTED'), `building ${b.id} ${b.type} contested`);
  });
});

// --- long chain -------------------------------------------------------------------------------------

test('farm -> malthouse -> brewery runs headless: beer is made, the brewery waits upstream on the malthouse', () => {
  const w = valley(4);
  for (const [t, x] of [['farm', 21], ['malthouse', 25], ['brewery', 32]] as const) assert(place(w, t, x, 25, 2, true).ok, t);
  w.state.coins = 1000;
  for (let i = 0; i < 2; i++) assert(applyCommand(w, { t: 'buyWagon', stable: stableId(w) }).ok, 'wagon');
  const malt = byType(w, 'malthouse')[0]!, brew = byType(w, 'brewery')[0]!;
  let upstream = false;
  runChecked(w, 12 * 60 * TICK_HZ, () => {
    if (brew.status.k === 'WAITING_UPSTREAM' && brew.status.from === malt.id) upstream = true;
  });
  assert(upstream, 'brewery waited on the malthouse (WAITING_UPSTREAM)');
  assert(w.state.ledger.produced.malt > 0 && w.state.ledger.produced.beer > 0, `malt ${w.state.ledger.produced.malt}, beer ${w.state.ledger.produced.beer}`);
  assert(w.state.ledger.sold.beer > 0, 'beer sold at the castle market');
});

// --- stone as building material ---------------------------------------------------------------------

test('cobbles need stone in the granaries (NO_STONE{need, have}); building consumes it, conservation holds', () => {
  const w = valley(2);
  w.state.coins = 2000;
  const cells = row(w, 24, 30, 39); // 10 dirt cells
  const need = cells.length * STONE_COBBLE;
  const r0 = applyCommand(w, { t: 'road', surface: 2, cells });
  assert(!r0.ok && r0.err.k === 'NO_STONE' && r0.err.need === need && r0.err.have === 0, `NO_STONE: ${JSON.stringify(r0)}`);
  giveStone(w, need - 1);
  const r1 = validateRoad(w, cells, 2);
  assert(!r1.ok && r1.err.k === 'NO_STONE' && r1.err.have === need - 1, 'one short');
  giveStone(w, 3);
  const coins = w.state.coins, consumed = w.state.ledger.consumed.stone;
  const r2 = applyCommand(w, { t: 'road', surface: 2, cells });
  assert(r2.ok && r2.stone === need, `cobbled: ${JSON.stringify(r2)}`);
  eq(w.state.coins, coins - r2.cost, 'silver paid');
  eq(w.state.ledger.consumed.stone, consumed + need, 'stone consumed');
  eq(byType(w, 'warehouse')[0]!.stock.stone, 2, 'two stone left');
  eq(checkInvariants(w).length, 0, 'conservation');
  // already cobbled cells cost nothing more; dirt roads never need stone
  const again = validateRoad(w, cells, 2);
  assert(again.ok && !again.stone, 'no stone for cobbled cells');
  // stone bridges cost more stone per cell; missions build with silver alone
  const m = createWorld('m3');
  const mr = validateRoad(m, row(m, 40, 32, 80), 2);
  assert(mr.ok && !mr.stone, 'mission III cobble corridor: silver only');
});

// --- ranks 4-5 --------------------------------------------------------------------------------------

test('ranks 4 and 5 need 7 / 9 distinct goods; the brewery unlocks at 4, the castle upgrade at 5', () => {
  eq(RANKS.length, 6, 'six ranks');
  eq(RANKS[4]!.goods, 7, 'rank 4 goods');
  eq(RANKS[5]!.goods, 9, 'rank 5 goods');
  eq(RANKS[5]!.unlocks.length, 0, 'rank 5 is cosmetic');
  const w = valley(3);
  const st = w.state;
  const sell = (g: Good) => { st.ledger.produced[g] += 1; st.ledger.consumed[g] += 1; st.ledger.sold[g] += 1; };
  for (const g of ['wood', 'planks', 'grain', 'flour', 'bread', 'fish'] as Good[]) sell(g);
  st.town.renown = RANKS[5]!.renown;
  st.town.bestFlow = RANKS[5]!.flow;
  const br = validatePlace(w, 'brewery', 32, 25, 2);
  assert(!br.ok && br.err.k === 'LOCKED' && br.err.rank === 4, 'brewery locked at rank 3');
  stepTown(w);
  eq(st.town.rank, 3, 'six goods are not enough for rank 4');
  sell('stone');
  stepTown(w);
  eq(st.town.rank, 4, 'seven goods: rank 4');
  eq(castleLevel(st), 0, 'plain castle');
  st.coins = 1000;
  assert(validatePlace(w, 'brewery', 32, 25, 2).ok, 'brewery open at rank 4');
  sell('charcoal');
  stepTown(w);
  eq(st.town.rank, 4, 'eight goods: still rank 4');
  sell('malt');
  stepTown(w);
  eq(st.town.rank, 5, 'nine goods: rank 5');
  eq(castleLevel(st), 1, 'castle upgraded');
  const s = sandboxStatus(w);
  eq(s.castleLevel, 1, 'status castle level');
  eq(s.next, null, 'top rank');
  eq(s.rankTicks.length, 6, 'rank ticks');
  eq(s.locked.length, 0, 'everything unlocked');
});

test('decent bot plays 90 valley minutes: ranks 3-4 on time, all ten goods sold, invariants every 5 ticks', () => {
  const r = runSandbox(DECENT, 90, { checkEvery: 5 });
  assert(r.violations.length === 0, r.violations.slice(0, 3).join('\n'));
  const m = r.rankMin;
  // rank 1 at renown 120 (owner 2026-11-05, D-168): a card-only player ~8 min, the decent bot ~7
  assert(m[1]! >= 5.5 && m[1]! <= 9, `rank 1 at ${m[1]}`);
  assert(m[2]! >= 20 && m[2]! <= 30, `rank 2 at ${m[2]}`);
  assert(m[3]! >= 40 && m[3]! <= 50, `rank 3 at ${m[3]}`);
  assert(m[4]! >= 70 && m[4]! <= 90, `rank 4 at ${m[4]}`);
  for (const g of GOODS) assert((r.sold[g] ?? 0) > 0, `sold some ${g}: ${JSON.stringify(r.sold)}`);
});

// --- determinism and saves ------------------------------------------------------------------------

function chainsWorld(): World {
  const w = valley(4);
  w.state.coins = 3000;
  const cmds = [
    { t: 'road', surface: 1, cells: col(w, 45, 25, 30) },
    { t: 'place', type: 'fisher', x: 44, y: 32, facing: 2 },
    { t: 'road', surface: 1, cells: col(w, 58, 10, 23) },
    { t: 'place', type: 'quarry', x: 57, y: 7, facing: 0 },
    { t: 'place', type: 'charcoalBurner', x: 18, y: 25, facing: 2 },
    { t: 'place', type: 'farm', x: 21, y: 25, facing: 2 },
    { t: 'place', type: 'malthouse', x: 25, y: 25, facing: 2 },
    { t: 'place', type: 'brewery', x: 32, y: 25, facing: 2 },
    ...Array.from({ length: 4 }, () => ({ t: 'buyWagon', stable: stableId(w) })),
  ] as const;
  for (const c of cmds) assert(applyCommand(w, c as never).ok, `cmd ${JSON.stringify(c).slice(0, 60)}`);
  return w;
}

test('determinism with ten goods: same commands, same hash; save/load mid-chain continues identically', () => {
  const a = chainsWorld(), b = chainsWorld();
  for (let i = 0; i < 3000; i++) { step(a); step(b); }
  eq(stateHash(a), stateHash(b), 'same hash after 5 min');
  assert(a.state.wagons.some((x) => x.cargoGood !== null), 'goods in flight at the save');
  const c = deserialize(serialize(a));
  for (let i = 0; i < 3000; i++) { step(a); step(c); }
  eq(stateHash(c), stateHash(a), 'save/load continuation');
  const used = GOODS.filter((g) => a.state.ledger.produced[g] > 0);
  eq(used.join(','), 'wood,planks,grain,fish,stone,charcoal,malt,beer', 'goods made (no mill or bakery here)');
  eq(checkInvariants(a).length, 0, 'conservation over ten goods');
});

function gateV5(f: (s: J) => void, version = STATE_VERSION): GateResult {
  const w = chainsWorld();
  // the sample must hold a stone wagon (the load-limit case below): from 3:00 on, the first tick one is on the road
  // (the dispatcher's own timing decides when, D-156; bounded so a fleet without stone fails loudly)
  for (let i = 0; i < 1800 || (i < 6000 && !w.state.wagons.some((x) => x.cargoGood === 'stone')); i++) step(w);
  const env = JSON.parse(JSON.stringify(makeEnvelope('valley1', w.state, 0))) as J;
  env.stateVersion = version;
  env.state.version = version;
  f(env.state);
  return gateEnvelope(env);
}

test('save gate v5: all ten goods required, per-good load limits, six ranks; v4 saves keep five goods and four ranks', () => {
  assert(gateV5(() => {}).ok, 'valid v5 save');
  const bad: [string, (s: J) => void, string][] = [
    ['fish missing in a v5 stock', (s) => { delete s.buildings[0].stock.fish; }, 'BAD_TYPE'],
    ['beer missing in v5 ledger', (s) => { delete s.ledger.produced.beer; }, 'BAD_TYPE'],
    ['stone saturation above cap', (s) => { s.market.saturation.stone = MARKET.cap + 1; }, 'OUT_OF_RANGE'],
    ['rank above 5', (s) => { s.town.rank = 6; }, 'OUT_OF_RANGE'],
    ['four rank ticks in v5', (s) => { s.town.rankTicks = s.town.rankTicks.slice(0, 4); }, 'BAD_TYPE'],
    ['unknown good', (s) => { const wg = s.wagons.find((x: J) => x.cargoGood); wg.cargoGood = 'gold'; }, 'BAD_TYPE'],
  ];
  for (const [what, f, code] of bad) {
    const r = gateV5(f);
    assert(!r.ok && r.errors.some((e) => e.code === code), `${what}: expected ${code}, got ${r.ok ? 'ok' : r.errors.map((e) => e.code + '@' + e.path).join(', ')}`);
  }
  // a stone wagon may not carry 6
  const st = gateV5((s) => {
    const wg = s.wagons.find((x: J) => x.cargoGood === 'stone');
    assert(wg, 'the sample holds a stone wagon');
    wg.cargoQty = 6; if (wg.job) wg.job.qty = 6;
  });
  assert(!st.ok, 'stone load of 6 rejected');
  // v4: the new goods did not exist, so fish cargo is unknown, and 6 rank ticks are too many
  const w = createWorld('sandbox');
  for (let i = 0; i < 1200; i++) step(w);
  const v4 = JSON.parse(JSON.stringify(makeEnvelope('auto', w.state, 0))) as J;
  v4.stateVersion = 4; v4.state.version = 4;
  const strip = (m: J) => { for (const g of NEW_GOODS) delete m[g]; };
  for (const b of v4.state.buildings) { strip(b.stock); strip(b.reservedOut); strip(b.incoming); }
  for (const k of ['produced', 'consumed', 'destroyed', 'sold']) strip(v4.state.ledger[k]);
  strip(v4.state.market.saturation);
  v4.state.town.rankTicks = v4.state.town.rankTicks.slice(0, 4);
  const ok4 = prepareLoad(v4);
  assert(ok4.ok, `valid v4 save: ${ok4.ok ? '' : ok4.errors.map((e) => e.code + '@' + e.path + ' ' + e.detail).join('; ')}`);
  const six = JSON.parse(JSON.stringify(v4)) as J;
  six.state.town.rankTicks.push(-1, -1);
  assert(!gateEnvelope(six).ok, 'v4 with six rank ticks rejected');
  // ... and it migrates to a state that runs exactly like the fresh one
  if (ok4.ok) {
    const out = migrate(ok4.envelope).state;
    w.state.valleyEvents = freshValleyEvents(); // migrated saves start the valley events empty (D-54)
    eq(JSON.stringify(out), serialize(w), 'v4 -> v5 byte-identical to a fresh v5 state (key order)');
  }
});

// --- contract missions behave exactly as in state v4 -------------------------------------------------

/** Final state of each balance strategy, as a v4 state: new goods, ranks 4-5, mission.roadStone and the v7 fleet numbers stripped, version 0. */
function v4View(st: unknown): string {
  const legacy = new Set<string>(GOODS_V4);
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === 'object') {
      const o = v as J;
      const goodsMap = 'wood' in o && 'planks' in o && 'bread' in o;
      const out: J = {};
      for (const k of Object.keys(o)) if (!goodsMap || legacy.has(k)) out[k] = strip(o[k]);
      if (Array.isArray(out.rankTicks)) out.rankTicks = out.rankTicks.slice(0, 4);
      if ('version' in out && 'mapId' in out) out.version = 0;
      if ('result' in out && 'endTick' in out) delete out.roadStone; // state v6 (D-32)
      if ('nextId' in out) delete out.nextWagonN; // state v7 (D-44)
      if ('nextId' in out) delete out.valleyEvents; // state v8 (D-54), sandbox only
      if ('bridgeFrom' in out && 'odometer' in out) delete out.n; // state v7 wagon fleet number
      return out;
    }
    return v;
  };
  return JSON.stringify(strip(JSON.parse(JSON.stringify(st))));
}

/** Measured on the state-v4 build (commit 7590de8) with the same runs; see D-30. Deliberate re-baselines:
 *  D-44 (1) a bridge-held wagon root is charged per span in every world: m2 nothing / buy 2 / 2nd wooden
 *  bridge and m4 nothing / buy 3 change (stall ledger only, state with the ledger stripped identical).
 *  D-156 (dispatcher 2, L1): exactly the 7 runs with >= 2 bought wagons change (m2 buy 2 / + stone bridge / + 2nd
 *  wooden bridge, m3 buy 2 / + cobbles, m4 buy 3, m5 buy 2): rule A acts only from the starting fleet + 2. With
 *  DISPATCH2.ruleA = false every previous value is reproduced. */
const V4_GOLDEN: Record<string, string> = {
  'm1|nothing (no crossing)': '8d93fdbf6cb41686',
  'm1|wooden bridge x=41 @0:10': 'f8a384c669d73b40',
  'm1|bridge + 2 wagons @0:10': 'bd62ca11c4911697',
  'm2|nothing': '4b902f1db0533e35',
  'm2|buy 2 wagons': '31cd5f247ea480d1',
  'm2|buy 2 + stone bridge @45s': 'bec204e835cff528',
  'm2|buy 2 + 2nd wooden bridge x=63 @45s': 'e809e71ab32bd247',
  'm3|nothing': 'd9640beb3a7098ee',
  'm3|buy 2 wagons': '40d2b6719d9fa74f',
  'm3|buy 2 + cobble corridor @25s': 'aaedeb84bd5305e1',
  'm4|nothing': 'da0f0d77de2bf9d3',
  'm4|buy 3 wagons @1:00': '7fcab2a387209e9b',
  'm4|stone bridge late @4:00 (iced)': 'e2757112d3f2eb80',
  'm4|stone bridge before ice @1:00': 'f778f455aa2c7f74',
  'm5|nothing': '55bf74afce0867e2',
  'm5|connect granary @0:30': '9b6cfdbfcc0b4aac',
  'm5|buy 1 wagon @0:30': 'fb40b4a93557fc07',
  'm5|buy 2 wagons @0:30': 'a1d4ed488a9b4973',
  'm5|connect granary + 1 wagon @0:30': '325439c3ced2433a',
  'm6|nothing': '9a30f6b421ab33c8',
  'm6|buy 1 wagon @0:30': '22ff871fcdea8b21',
  'm6|connect big granary @0:30': '512a225f01ede36b',
  'm6|build granary by the mill @0:30': '0cb7f5ed7c11f5d8',
  'm6|cut 3rd farm road @0:30': 'c391ae0d2563edd7',
  'm6|connect big granary late @5:00': '48254a3c49ee2c4a',
  'lab|none': 'ed6b8b4ddce1bc53',
};

test('missions I-VI and the lab run bit-identically to state v4 (golden hashes, new fields stripped)', () => {
  const bad: string[] = [];
  for (const id of ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'lab']) {
    // the first ("nothing") and the last strategy of each mission keep the suite fast; the full
    // table of V4_GOLDEN can be checked by running every strategy
    const all = plans[id] ?? [{ name: 'none', at: 0, cmds: () => [] }];
    for (const s of all.length > 2 ? [all[0]!, all[all.length - 1]!] : all) {
      const w = createWorld(id);
      while ((w.state.mission.result === 'running' || w.state.tick < 3000) && w.state.tick < 20 * 60 * TICK_HZ) {
        if (w.state.tick === s.at * TICK_HZ) for (const c of s.cmds(w)) applyCommand(w, c);
        step(w);
      }
      const key = `${id}|${s.name}`;
      const h = hashString(v4View(w.state));
      if (V4_GOLDEN[key] !== h) bad.push(`${key}: ${h} != ${V4_GOLDEN[key]}`);
    }
  }
  eq(bad.length, 0, 'mission runs changed:\n' + bad.join('\n'));
});

// --- fuzz smoke over the new buildings --------------------------------------------------------------

test('fuzz smoke: 8 seeded command sequences in the valley at rank 5 (every chain placeable) keep every invariant', () => {
  const fails: string[] = [];
  const placed = new Set<string>();
  for (let seed = 501; seed <= 508; seed++) {
    const sc = generateScenario(seed, { ticks: 3000, minCmds: 20, maxCmds: 50, missions: ['sandbox@5'] });
    const r = runScenario(sc, { rerun: true });
    if (r.failure) fails.push(`seed ${seed}: ${r.failure.kind} @${r.failure.tick} ${r.failure.detail.slice(0, 200)}`);
    const w = makeWorld(sc.mission, sc.coins);
    let k = 0;
    for (let t = 0; t < 3000 && k < sc.commands.length; t++) {
      while (k < sc.commands.length && sc.commands[k]!.tick === t) {
        const c = sc.commands[k++]!.cmd;
        if (applyCommand(w, c).ok && c.t === 'place') placed.add(c.type);
      }
      step(w);
    }
  }
  assert(fails.length === 0, `failures:\n${fails.join('\n')}`);
  const newPlaced = NEW_TYPES.filter((t) => placed.has(t));
  assert(newPlaced.length >= 3, `new buildings placed by the fuzzer: ${newPlaced.join(',')}`);
});
