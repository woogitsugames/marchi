// Session-2 sim mechanics: ice windows (BRIDGE_CLOSED), contract tranches (waybill), per-building
// granary capacity, and the STATE_VERSION 2 -> 3 save migration.
import {
  applyCommand, checkInvariants, createWorld, deserialize, explainBuilding, explainWagon, lineCells, serialize,
  stateHash, stars, step, unexplainedStalls, STATE_VERSION, type World,
} from '../src/sim/index';
import { activeTranche, contractTarget, iceUntil, storeCapOf } from '../src/sim/contract';
import { migrate, type SaveEnvelope } from '../src/platform/save';
import { assert, eq, test } from './harness';

const col = (w: World, x: number, y1: number, y2: number) => lineCells(w.terrain.w, y1 * w.terrain.w + x, y2 * w.terrain.w + x);

function runChecked(w: World, until: number): void {
  while (w.state.tick < until && w.state.mission.result === 'running') {
    step(w);
    const v = checkInvariants(w);
    if (v.length) throw new Error(`tick ${w.state.tick}: ${v.join('; ')}`);
    const u = unexplainedStalls(w);
    if (u.length) throw new Error(`tick ${w.state.tick}: ${u.join('; ')}`);
  }
}

test('ice: window boundaries are [start, end)', () => {
  const st = { ice: [{ start: 100, end: 200 }], tick: 99 };
  eq(iceUntil(st), -1, 'before');
  st.tick = 100; eq(iceUntil(st), 200, 'first closed tick');
  st.tick = 199; eq(iceUntil(st), 200, 'last closed tick');
  st.tick = 200; eq(iceUntil(st), -1, 'thawed');
});

test('ice: BRIDGE_CLOSED is a terminal reason in explainWagon and reachable from explainBuilding', () => {
  const w = createWorld('m4');
  const ice = w.state.ice[0]!;
  let wagonChain = false, buildingChain = false;
  while (w.state.tick < ice.end) {
    step(w);
    if (w.state.tick < ice.start + 50) continue;
    for (const q of w.state.wagons) {
      if (q.status.k !== 'BRIDGE_CLOSED') continue;
      const c = explainWagon(w, q.id);
      if (c.length === 1 && c[0]!.status.k === 'BRIDGE_CLOSED') wagonChain = true;
    }
    for (const b of w.state.buildings) {
      if (explainBuilding(w, b.id).some((l) => l.kind === 'wagon' && l.status.k === 'BRIDGE_CLOSED')) buildingChain = true;
    }
    if (wagonChain && buildingChain) break;
  }
  assert(wagonChain, 'wagon chain ends at BRIDGE_CLOSED');
  assert(buildingChain, 'a building chain leads to the iced wagon');
});

test('ice: wagons are never stopped on the bridge, invariants and stall reasons hold through the window', () => {
  const w = createWorld('m4');
  runChecked(w, w.state.ice[0]!.end + 300);
});

test('ice: routing takes a stone detour instead of waiting for the thaw', () => {
  const w = createWorld('m4');
  w.state.coins = 1000;
  // second crossing in stone, east of the wooden one
  assert(applyCommand(w, { t: 'road', surface: 2, cells: col(w, 63, 30, 42) }).ok, 'stone bridge x=63');
  const ice = w.state.ice[0]!;
  runChecked(w, ice.start + 200);
  const stoneCells = new Set(col(w, 63, 32, 39));
  let crossedStone = false;
  while (w.state.tick < ice.end - 100) {
    step(w);
    if (w.state.wagons.some((q) => stoneCells.has(q.at))) crossedStone = true;
  }
  assert(crossedStone, 'wagons crossed the stone bridge while the wooden one was iced');
});

test('ice: save/load in the middle of the window continues identically', () => {
  const w = createWorld('m4');
  runChecked(w, w.state.ice[0]!.start + 400);
  assert(w.state.wagons.some((q) => q.status.k === 'BRIDGE_CLOSED'), 'someone waits at the ice');
  const w2 = deserialize(serialize(w));
  for (let i = 0; i < 3000; i++) { step(w); step(w2); }
  eq(stateHash(w2), stateHash(w), 'hash after 3000 ticks');
});

test('tranches: the castle orders only the letter currently due; the waybill records completion', () => {
  const w = createWorld('m5');
  const c = w.state.mission.contract!;
  eq(c.tranches.length, 3, 'three letters');
  eq(activeTranche(c), 0, 'first letter active');
  eq(contractTarget(c, 'planks'), 6, 'castle wants only the first letter of planks');
  const castle = w.state.buildings.find((b) => b.id === c.castle)!;
  while (c.tranches[0]!.doneTick < 0) {
    step(w);
    assert(castle.stock.planks + castle.incoming.planks <= 6, 'no planks beyond letter 1 before it is complete');
  }
  eq(activeTranche(c), 1, 'second letter active');
  eq(contractTarget(c, 'planks'), 6, 'letter 2 asks no planks');
  eq(contractTarget(c, 'bread'), 24, 'letter 2 bread is cumulative');
  runChecked(w, 20000);
  eq(w.state.mission.result, 'won', 'won');
  assert(c.tranches.every((t) => t.doneTick >= 0), 'all letters done');
  for (let i = 1; i < 3; i++) assert(c.tranches[i]!.doneTick >= c.tranches[i - 1]!.doneTick, 'in order');
});

test('tranches: a late letter costs one seal, never below 1', () => {
  const w = createWorld('m5');
  const c = w.state.mission.contract!;
  c.tranches[0]!.deadlineTick = 10; // impossible: letter 1 will be late
  runChecked(w, 20000);
  eq(w.state.mission.result, 'won', 'still won');
  assert(c.tranches[0]!.missed, 'letter 1 missed');
  const base = w.state.mission.endTick <= c.star3Tick ? 3 : w.state.mission.endTick <= c.star2Tick ? 2 : 1;
  eq(stars(w), Math.max(1, base - c.tranches.filter((t) => t.missed).length), 'seal penalty');
});

test('granary capacity per building: the small granary fills at 12 and blocks the sawmill (m6)', () => {
  const w = createWorld('m6');
  const small = w.state.buildings.find((b) => b.type === 'warehouse' && b.capOverride === 12)!;
  const big = w.state.buildings.find((b) => b.type === 'warehouse' && b.capOverride === -1)!;
  eq(storeCapOf(small), 12, 'override');
  eq(storeCapOf(big), 60, 'default');
  let full = false, chain = false;
  while (w.state.mission.result === 'running' && !(full && chain)) {
    step(w);
    let sum = 0;
    for (const g of ['wood', 'planks', 'grain', 'flour', 'bread'] as const) sum += small.stock[g];
    assert(sum <= 12, 'never above capacity');
    if (small.status.k === 'STORAGE_FULL') full = true;
    const saw = w.state.buildings.find((b) => b.type === 'sawmill')!;
    const ch = explainBuilding(w, saw.id);
    if (ch[0]!.status.k === 'OUTPUT_FULL' && ch.some((l) => l.id === small.id && l.status.k === 'STORAGE_FULL')) chain = true;
  }
  assert(full, 'small granary reported STORAGE_FULL');
  assert(chain, 'sawmill OUTPUT_FULL chain points at the full granary');
});

test('unconnected granary: an overflowing producer points at it (NO_ROAD) instead of nowhere', () => {
  const w = createWorld('m5');
  const saw = w.state.buildings.find((b) => b.type === 'sawmill')!;
  let seen = false;
  while (w.state.tick < 6000 && !seen) {
    step(w);
    const ch = explainBuilding(w, saw.id);
    if (ch[0]!.status.k === 'OUTPUT_FULL' && ch[1]?.status.k === 'NO_ROAD') seen = true;
  }
  assert(seen, 'sawmill -> granary (NO_ROAD) chain');
});

test(`save migration v2 -> v${STATE_VERSION}: ice, tranches and capOverride are added without mutating the save`, () => {
  const w = createWorld('m2');
  for (let i = 0; i < 300; i++) step(w);
  const v3 = JSON.parse(serialize(w)) as Record<string, unknown>;
  // build a v2 state by removing the v3 fields
  const v2 = JSON.parse(JSON.stringify(v3)) as Record<string, any>;
  v2.version = 2;
  delete v2.ice;
  for (const b of v2.buildings) delete b.capOverride;
  delete v2.mission.contract.tranches;
  // and the v4 fields (market, town, income ledger, placedTick): a contract mission never trades,
  // so the migration's defaults equal the fresh state
  delete v2.market;
  delete v2.town;
  delete v2.ledger.silverEarned;
  delete v2.ledger.sold;
  for (const b of v2.buildings) delete b.placedTick;
  const frozen = JSON.stringify(v2);
  // cast: the envelope format grows with save hardening; migrate() only reads stateVersion and state
  const env = { format: 1, stateVersion: 2, slot: 'auto', savedAt: 0, missionId: 'm2', tick: 300, state: v2 } as unknown as SaveEnvelope;
  const out = migrate(env);
  eq(JSON.stringify(v2), frozen, 'input not mutated');
  eq(out.stateVersion, STATE_VERSION, 'migrated to current');
  eq(JSON.stringify(out.state), JSON.stringify(v3), 'identical to a fresh state');
  const w2 = deserialize(JSON.stringify(out.state));
  for (let i = 0; i < 600; i++) { step(w); step(w2); }
  eq(stateHash(w2), stateHash(w), 'migrated save continues identically');
});

test('mission clocks are whole ticks for every mission', () => {
  for (const id of ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']) {
    const c = createWorld(id).state.mission.contract!;
    for (const t of [c.deadlineTick, c.star3Tick, c.star2Tick, ...c.tranches.map((x) => x.deadlineTick)]) {
      assert(Number.isInteger(t), `${id}: ${t} is not an integer tick`);
    }
  }
});
