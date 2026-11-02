// Seasons wired into the free valley (D-33): the live hooks agree with the calendar, only a world
// whose mission sets `seasons` feels them, and every effect is gentle and reversible.
import {
  BUILDINGS, GOODS, MISSIONS, RAIN_DIRT, SPEED_COBBLE, SPEED_DIRT, SPEED_WOOD_BRIDGE, TICK_HZ,
  applyCommand, checkInvariants, createWorld, deserialize, lineCells, missionSeasons, serialize, stateHash, step,
  unexplainedStalls, wagonSlowdown, worldFromState, type World,
} from '../src/sim/index';
import { cellSpeed, edgeCosts, net } from '../src/sim/network';
import {
  SEASON_TICKS, YEAR_TICKS, bridgeIceUntil, cycleTicks, cycleTicksAt, effectsAt, seasonIceUntilAt, thawAt,
  yieldPercentAt,
} from '../src/sim/seasons';
import { quoteCents, sellAt, unitCents } from '../src/sim/town';
import { assert, eq, test } from './harness';

const minute = 60 * TICK_HZ;
const WINTER = 3 * SEASON_TICKS, AUTUMN = 2 * SEASON_TICKS, SUMMER = SEASON_TICKS;
const col = (w: World, x: number, y1: number, y2: number) => lineCells(w.terrain.w, y1 * w.terrain.w + x, y2 * w.terrain.w + x);

function runChecked(w: World, until: number, each?: (w: World) => void): void {
  while (w.state.tick < until) {
    step(w);
    const v = checkInvariants(w);
    if (v.length) throw new Error(`tick ${w.state.tick}: ${v.join('; ')}`);
    const u = unexplainedStalls(w);
    if (u.length) throw new Error(`tick ${w.state.tick}: ${u.join('; ')}`);
    each?.(w);
  }
}

test('seasons live: the allocation-free hooks agree with effectsAt over two years', () => {
  const ticks: number[] = [];
  for (let t = 0; t < 2 * YEAR_TICKS; t += 37) ticks.push(t);
  for (let k = 0; k <= 8; k++) for (const d of [-1, 0, 1]) if (k * SEASON_TICKS + d >= 0) ticks.push(k * SEASON_TICKS + d);
  for (const off of [4, 8]) for (const d of [-1, 0, 1]) ticks.push(off * minute + d, YEAR_TICKS + off * minute + d);
  for (const off of [48, 50, 54, 56]) for (const d of [-1, 0, 1]) ticks.push(off * minute + d, YEAR_TICKS + off * minute + d);
  for (const t of ticks) {
    const e = effectsAt(t);
    eq(yieldPercentAt('farm', t), e.farmYieldPercent, `farm @${t}`);
    eq(yieldPercentAt('fisher', t), e.fisherYieldPercent, `fisher @${t}`);
    eq(yieldPercentAt('mill', t), 100, `mill @${t}`);
    eq(thawAt(t), e.dirtSpeedMultiplier !== 1, `thaw @${t}`);
    eq(seasonIceUntilAt(t), e.closedBridgeUntilTick ?? -1, `ice @${t}`);
  }
});

test('seasons live: only the free valley runs the calendar (data flag, derived into the world)', () => {
  eq(missionSeasons('sandbox'), true, 'sandbox has seasons');
  for (const id of Object.keys(MISSIONS)) {
    if (id === 'sandbox') continue;
    eq(missionSeasons(id), false, `${id} has no seasons`);
    eq(createWorld(id).seasons, false, `${id} world without seasons`);
  }
  const sb = createWorld('sandbox');
  eq(sb.seasons, true, 'createWorld copies the flag');
  // a saved free valley (any state version that loads) gets seasons at the date its tick implies
  sb.state.tick = WINTER + 3 * minute + 5;
  const loaded = worldFromState(JSON.parse(serialize(sb)));
  eq(loaded.seasons, true, 'worldFromState derives the flag');
  eq(bridgeIceUntil(loaded), WINTER + 5 * minute, 'midwinter save: bridge closed at once until the window ends');
  eq(worldFromState(JSON.parse(serialize(createWorld('m4')))).seasons, false, 'a contract save stays without seasons');
});

test('seasons live: farm and fisher cycles stretch in winter, shorten in summer, recipes stay whole', () => {
  const farm = BUILDINGS.farm.recipe!.ticks, fisher = BUILDINGS.fisher.recipe!.ticks;
  eq(cycleTicksAt(farm, 100), farm, 'neutral');
  eq(cycleTicksAt(farm, 60), Math.floor((farm * 100 + 59) / 60), 'winter = ceil(ticks / 0.6)');
  assert(cycleTicksAt(farm, 60) * 60 >= farm * 100 && (cycleTicksAt(farm, 60) - 1) * 60 < farm * 100, 'integer ceil');
  assert(cycleTicksAt(farm, 120) * 120 >= farm * 100 && (cycleTicksAt(farm, 120) - 1) * 120 < farm * 100, 'summer ceil');
  eq(cycleTicksAt(fisher, 50), fisher * 2, 'fisher half speed');

  // measured on a real farm: one full cycle from progress 0 at each season (and without seasons)
  const cycleOf = (id: string, tick: number): number => {
    const w = createWorld(id);
    const f = w.state.buildings.find((b) => b.type === 'farm')!;
    w.state.tick = tick;
    f.stock.grain = 0;
    f.progress = 0;
    let n = 0;
    while (f.progress >= 0 && n < 10 * farm) { step(w); n++; if (f.progress === 0) break; }
    return n;
  };
  eq(cycleOf('lab', WINTER + 10), farm, 'lab (no seasons): normal cycle in "winter"');
  const sb = createWorld('sandbox');
  sb.state.tick = WINTER;
  eq(cycleTicks(sb, 'farm', farm), cycleTicksAt(farm, 60), 'sandbox winter cycle');
  sb.state.tick = SUMMER;
  eq(cycleTicks(sb, 'farm', farm), cycleTicksAt(farm, 120), 'sandbox summer cycle');
  eq(cycleTicks(sb, 'mill', BUILDINGS.mill.recipe!.ticks), BUILDINGS.mill.recipe!.ticks, 'other producers unchanged');
});

test('seasons live: a cycle interrupted by a season change completes exactly once', () => {
  const w = createWorld('lab');
  w.seasons = true;
  const f = w.state.buildings.find((b) => b.type === 'farm')!;
  const farm = BUILDINGS.farm.recipe!.ticks;
  // winter cycle well past the spring length when spring begins: it must finish on the next tick
  w.state.tick = YEAR_TICKS - 5;
  w.state.ledger.produced.grain -= f.stock.grain; // keep conservation while emptying the farm
  f.stock.grain = 0;
  f.progress = farm + 20;
  const before = w.state.ledger.produced.grain;
  step(w); // tick YEAR-5: progress farm+21 < winter cycle
  eq(w.state.ledger.produced.grain, before, 'still winter: not done');
  while (w.state.tick < YEAR_TICKS) step(w);
  step(w); // first spring tick: progress >= the spring cycle -> done once
  eq(w.state.ledger.produced.grain, before + 1, 'one grain at the season change');
  eq(checkInvariants(w).length, 0, 'conservation');
});

test('seasons live: thaw slows only land dirt, once with rain, with its own cost tables', () => {
  const w = createWorld('lab');
  w.seasons = true;
  assert(applyCommand(w, { t: 'road', surface: 1, cells: col(w, 41, 24, 44) }).ok, 'wooden bridge');
  const c = net(w);
  let dirt = -1, bridge = -1;
  for (let i = 0; i < w.state.roads.length; i++) {
    if (w.state.roads[i] === 1 && !w.terrain.water[i] && c.occupied[i] === -1 && dirt < 0) dirt = i;
    if (w.state.roads[i] === 1 && w.terrain.water[i] && bridge < 0) bridge = i;
  }
  assert(dirt >= 0 && bridge >= 0, 'cells found');
  eq(cellSpeed(w, dirt, false, true), SPEED_DIRT * RAIN_DIRT, 'thaw dirt');
  eq(cellSpeed(w, dirt, true, true), SPEED_DIRT * RAIN_DIRT, 'rain + thaw: dirt factor once');
  eq(cellSpeed(w, bridge, false, true), SPEED_WOOD_BRIDGE, 'thaw leaves wooden bridges');
  w.state.roads[dirt] = 2;
  eq(cellSpeed(w, dirt, false, true), SPEED_COBBLE, 'thaw leaves cobble');
  w.state.roads[dirt] = 1;
  const dry = edgeCosts(w, false, false), thaw = edgeCosts(w, false, false, true), rain = edgeCosts(w, false, true);
  assert(dry !== thaw && thaw !== rain, 'separate cached tables');
  let slower = 0, bridgeSame = true;
  for (let k = 0; k < dry.length; k++) {
    if (dry[k] === Infinity) continue;
    if (thaw[k]! > dry[k]!) slower++;
    if (thaw[k]! < dry[k]!) throw new Error('thaw made an edge faster');
  }
  for (let d = 0; d < 8; d++) {
    const k = bridge * 8 + d;
    if (dry[k] !== Infinity && c.span[bridge] >= 0) {
      // an edge between two bridge cells is pure wooden span: thaw must not touch it
      const DXY = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]][d]!;
      const nb = bridge + DXY[1]! * w.terrain.w + DXY[0]!;
      if (w.terrain.water[nb] && thaw[k] !== dry[k]) bridgeSame = false;
    }
  }
  assert(slower > 0, 'dirt edges slower in thaw');
  assert(bridgeSame, 'bridge-to-bridge edges unchanged');
  eq(edgeCosts(w, false, false, true), thaw, 'cached');

  // a wagon on a dirt track during the thaw reads it as thaw mud (not rain, not a stall)
  w.state.rain = [];
  w.state.tick = 4 * minute;
  let seen = false;
  runChecked(w, 4 * minute + 90 * TICK_HZ, (x) => {
    for (const q of x.state.wagons) {
      if (q.next < 0) continue;
      const s = wagonSlowdown(x, q.id);
      if (s && s.surface === 'dirt') { assert(s.thaw && s.mud && !s.raining, 'thaw mud'); seen = true; }
    }
  });
  assert(seen, 'a wagon drove on dirt during the thaw');
});

test('seasons live: winter ice closes wooden spans for two short windows, keeps cargo, reopens', () => {
  const w = createWorld('lab');
  w.seasons = true;
  assert(applyCommand(w, { t: 'road', surface: 1, cells: col(w, 41, 24, 44) }).ok, 'wooden bridge');
  w.state.rain = [];
  w.state.tick = WINTER + 2 * minute;
  const end1 = WINTER + 5 * minute;
  let closed = 0, after = 0, crossedAfter = false;
  const span = net(w).span;
  runChecked(w, end1 + 2 * minute, (x) => {
    const t = x.state.tick;
    for (const q of x.state.wagons) {
      if (q.status.k === 'BRIDGE_CLOSED') {
        // statuses are set during the step that ends at tick t, i.e. at t - 1: the last closed tick is end1
        if (t > end1) after++;
        else { closed++; eq(q.status.until, end1, 'reopens at the window end'); }
      }
      if (t > end1 && q.at >= 0 && span[q.at]! >= 0) crossedAfter = true;
    }
  });
  assert(closed > 0, 'a wagon waited at the iced bridge');
  eq(after, 0, 'nobody waits after the thaw');
  assert(crossedAfter, 'wagons cross again after the window');
  eq(w.state.ice.length, 0, 'nothing written into state.ice');
});

test('seasons live: the valley fair pays +25 % per unit (rounded down) for its good only; plain autumn pays nothing extra (D-54)', () => {
  const sb = createWorld('sandbox');
  const castle = sb.state.buildings.find((b) => b.type === 'castle')!;
  for (const qty of [1, 6, 30]) {
    let want = 0, sat = sb.state.market.saturation.beer;
    for (let i = 0; i < qty; i++) {
      const base = quoteCents({ market: { ...sb.state.market, saturation: { ...sb.state.market.saturation, beer: sat } } }, 'beer', 1);
      want += Math.floor((base * 125) / 100);
      sat = Math.min(24, sat + 1);
    }
    eq(quoteCents(sb.state, 'beer', qty, 125), want, `quote ${qty}`);
  }
  eq(unitCents(sb.state, 'wood', 100), unitCents(sb.state, 'wood'), 'default is no fair');
  const sell = (tick: number, g: 'beer' | 'bread', fair = true): number => {
    const w = createWorld('sandbox');
    w.state.tick = tick;
    if (fair) w.state.valleyEvents!.fair = { id: 'fair-2', good: 'beer', season: 'autumn', startTick: AUTUMN, endTick: AUTUMN + SEASON_TICKS, pricePercent: 125 };
    const c = w.state.buildings.find((b) => b.id === castle.id)!;
    c.stock[g] = 6;
    return sellAt(w, c, g) * 100 + w.state.market.cents;
  };
  const fresh = createWorld('sandbox').state;
  eq(sell(AUTUMN + 10, 'beer'), quoteCents(fresh, 'beer', 6, 125), 'beer in autumn: the fair quote');
  eq(sell(10, 'beer'), quoteCents(fresh, 'beer', 6), 'beer in spring: the plain quote');
  assert(sell(AUTUMN + 10, 'beer') > sell(10, 'beer') * 1.24, 'about +25 %');
  eq(sell(AUTUMN + 10, 'bread'), sell(10, 'bread'), 'bread unchanged in autumn');
  eq(sell(WINTER + 10, 'beer'), sell(10, 'beer'), 'fair over: plain price');
  eq(sell(AUTUMN + 10, 'beer', false), quoteCents(fresh, 'beer', 6), 'autumn without a fair: no old beer bonus');
  const lab = createWorld('lab');
  lab.state.tick = AUTUMN + 10;
  for (const g of GOODS) eq(unitCents(lab.state, g), unitCents(lab.state, g, 100), 'no seasons, no fair');
});

test('seasons live: a free valley through winter is deterministic and save/load midwinter continues identically', () => {
  const run = (cut: number | null): string => {
    let w = createWorld('sandbox');
    w.state.tick = WINTER + 2 * minute;
    w.state.rain = [];
    const end = WINTER + 7 * minute;
    while (w.state.tick < end) {
      if (w.state.tick === WINTER + 2 * minute + 20) applyCommand(w, { t: 'buyWagon', stable: w.state.buildings.find((b) => b.type === 'stable')!.id });
      step(w);
      if (cut !== null && w.state.tick === cut) w = deserialize(serialize(w));
    }
    eq(checkInvariants(w).length, 0, 'invariants');
    return stateHash(w);
  };
  const a = run(null), b = run(null), c = run(WINTER + 4 * minute);
  eq(a, b, 'same run, same hash');
  eq(a, c, 'save/load inside the ice window continues identically');
});
