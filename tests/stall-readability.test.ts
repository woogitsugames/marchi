// Stall readability after the seasons / missions VII-IX playtest (docs/research/2026-11-02-seasons-m7-9.md):
// F1 a winter-slowed farm behind CONTESTED, F2 a full output whose customer still takes it, F4 where the
// missing road stone is, F7 one ledger row per frozen span. All read-only diagnosis except F7 (ledger).
import {
  DISPATCH_INTERVAL, SEASON_TICKS, TICK_HZ, applyCommand, buildingById, createWorld, explainBuilding, lineCells, outputCustomer, seasonAt,
  seasonalSupplier, step, stoneAvailable, type World,
} from '../src/sim/index';
import { DECENT, runSandbox } from '../tools/bot-sandbox';
import { makeWorld } from '../tools/fuzz-lib';
import { cureFor } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

const minute = 60 * TICK_HZ;
const WINTER = 3 * SEASON_TICKS;
const col = (w: World, x: number, y1: number, y2: number) => lineCells(w.terrain.w, y1 * w.terrain.w + x, y2 * w.terrain.w + x);
const row = (w: World, y: number, x1: number, x2: number) => lineCells(w.terrain.w, y * w.terrain.w + x1, y * w.terrain.w + x2);

test('F1: in winter a mill / malthouse whose grain is CONTESTED names the slowed farm; not in other seasons', () => {
  let winterHits = 0, otherHits = 0;
  // D-94: in the free valley workshops top up in loads of 4, so with the malthouse's own farms the decent
  // plan hardly contests grain any more; the malthouse without them shares the mills' farms, a real grain
  // contest that the winter slowdown turns into CONTESTED (and only in winter)
  const grainShort = DECENT.filter((s) => s.name !== 'farm for the malthouse' && s.name !== 'second malt farm');
  runSandbox(grainShort, 61, {
    checkEvery: 1000,
    onTick: (w) => {
      if (w.state.tick % 10) return;
      for (const b of w.state.buildings) {
        if (b.type !== 'mill' && b.type !== 'malthouse') continue;
        const r = seasonalSupplier(w, b.id);
        if (!r) continue;
        if (seasonAt(w.state.tick) !== 'winter') { otherHits++; continue; }
        if (b.status.k === 'NO_INPUT' && b.status.cause === 'CONTESTED') winterHits++;
        eq(buildingById(w, r.from)?.type, 'farm', 'the slowed supplier is a farm');
        assert(r.note.pct < 100, 'a slower farm');
      }
    },
  });
  assert(winterHits > 10, `winter CONTESTED explained by the farm (${winterHits} samples)`);
  eq(otherHits, 0, 'no seasonal supplier outside winter');
  // a contract mission never has seasons: the CONTESTED lesson of mission IX stays as it is
  const m9 = createWorld('m9');
  let contested = 0;
  for (let i = 0; i < 400; i++) {
    step(m9);
    for (const b of m9.state.buildings) {
      if (b.status.k === 'NO_INPUT' && b.status.cause === 'CONTESTED') { contested++; eq(seasonalSupplier(m9, b.id), null, 'm9 no season'); }
    }
  }
  assert(contested > 0, 'm9 shows CONTESTED early');
});

test('F2: OUTPUT_FULL.NO_DESTINATION with a customer that still takes the good chains to it (player view only)', () => {
  const w = createWorld('m9');
  let seen = 0;
  while (w.state.mission.result === 'running' && w.state.tick < 6 * minute) {
    step(w);
    for (const b of w.state.buildings) {
      const s = b.status;
      if (s.k !== 'OUTPUT_FULL' || s.cause !== 'NO_DESTINATION' || s.blockedBy >= 0) continue;
      const c = outputCustomer(w, b.id);
      assert(c >= 0, `m9 ${b.type}#${b.id} has a customer for its output`);
      const chain = explainBuilding(w, b.id, 5, true);
      eq(chain[0]!.kind === 'building' && chain[0]!.waits, 'CUSTOMER', 'first link waits for the customer');
      eq(chain[1]?.id, c, 'next link is the customer');
      // the sim's own chain (stall ledger) is unchanged: it stops at the full output
      eq(explainBuilding(w, b.id).length, 1, 'sim chain unchanged');
      seen++;
    }
  }
  assert(seen > 0, 'm9 has a temporarily full output with no granary');
  // a truly stranded output (no customer at all) stays a dead end
  const lab = createWorld('m9');
  const farm = lab.state.buildings.find((b) => b.type === 'farm')!;
  for (const b of lab.state.buildings) if (b.type === 'malthouse' || b.type === 'mill') b.type = 'stable';
  farm.status = { k: 'OUTPUT_FULL', good: 'grain', cause: 'NO_DESTINATION', blockedBy: -1 };
  eq(outputCustomer(lab, farm.id), -1, 'no consumer of grain -> stranded');
  eq(explainBuilding(lab, farm.id, 5, true).length, 1, 'stranded chain ends at the producer');
  // "Naprawa" (owner decision 2, 2026-11-03): a stranded output is cured by a granary
  eq(cureFor(lab, farm.id), 'granary', 'stranded output -> granary cure');
});

test('Naprawa: OUTPUT_FULL.NO_DESTINATION with a customer is not a granary cure (it chains to the customer)', () => {
  const w = createWorld('m9');
  let seen = 0;
  while (w.state.mission.result === 'running' && w.state.tick < 6 * minute) {
    step(w);
    for (const b of w.state.buildings) {
      const s = b.status;
      if (s.k !== 'OUTPUT_FULL' || s.cause !== 'NO_DESTINATION' || s.blockedBy >= 0) continue;
      if (outputCustomer(w, b.id) < 0) continue;
      assert(cureFor(w, b.id) !== 'granary', `m9 ${b.type}#${b.id}: no granary cure while a customer takes the good`);
      seen++;
    }
  }
  assert(seen > 0, 'm9 samples');
});

test('F4: NO_STONE says how much stone is on its way, waiting at the quarry, or that nobody quarries it', () => {
  const w = createWorld('m8');
  const cells = row(w, 44, 45, 56);
  const r0 = applyCommand(w, { t: 'road', surface: 2, cells });
  assert(!r0.ok && r0.err.k === 'NO_STONE', 'm8 at 0:00: no stone');
  if (!r0.ok && r0.err.k === 'NO_STONE') {
    eq(r0.err.have, 0, 'none in the granary');
    eq(r0.err.quarries, 1, 'one quarry');
  }
  let sawComing = false;
  while (w.state.tick < 3 * minute && stoneAvailable(w) < 12) {
    step(w);
    if (w.state.tick % TICK_HZ) continue;
    const r = applyCommand(w, { t: 'road', surface: 2, cells });
    if (!r.ok && r.err.k === 'NO_STONE') {
      const quarry = w.state.buildings.filter((b) => b.type === 'quarry').reduce((a, b) => a + b.stock.stone - b.reservedOut.stone, 0);
      const inc = w.state.buildings.filter((b) => b.type === 'warehouse' || b.type === 'castle').reduce((a, b) => a + b.incoming.stone, 0);
      eq(r.err.atQuarry, quarry, 'unreserved stone at the quarry');
      eq(r.err.incoming, inc, 'stone promised to granaries');
      if (r.err.incoming > 0) sawComing = true;
    } else if (r.ok) break;
  }
  assert(sawComing, 'stone was reported on its way before the road could be paved');
  // free valley at rank 2 (cobbles open) without a quarry: nobody mines stone
  const v = makeWorld('sandbox@2', null);
  const r1 = applyCommand(v, { t: 'road', surface: 2, cells: row(v, 24, 30, 33) });
  assert(!r1.ok && r1.err.k === 'NO_STONE' && r1.err.quarries === 0 && r1.err.incoming === 0 && r1.err.atQuarry === 0, `no quarry: ${JSON.stringify(r1)}`);
});

test('F7: a frozen wooden span is one ledger cause in a seasonal world (no per-wagon BRIDGE_CLOSED rows)', () => {
  const w = createWorld('lab');
  w.seasons = true;
  assert(applyCommand(w, { t: 'road', surface: 1, cells: col(w, 41, 24, 44) }).ok, 'wooden bridge');
  w.state.rain = [];
  w.state.tick = WINTER + 2 * minute;
  while (w.state.tick < WINTER + 6 * minute) step(w);
  const keys = Object.keys(w.state.ledger.stallSeconds);
  assert(keys.some((k) => k.startsWith('span:') && k.endsWith(':BRIDGE_CLOSED')), `span charged: ${keys.join(',')}`);
  eq(keys.filter((k) => k.startsWith('wagon:') && (k.endsWith(':BRIDGE_CLOSED') || k.endsWith(':BRIDGE_JAM'))).length, 0, `no per-wagon bridge rows: ${keys.join(',')}`);
});

test('F7 / D-44: contract letters charge a held bridge once per span (m2 jam, m4 ice), never per wagon', () => {
  const runs: { id: string; at: number; cmds: (w: World) => Parameters<typeof applyCommand>[1][] }[] = [
    { id: 'm2', at: 0, cmds: () => [] },
    { id: 'm4', at: 60, cmds: (w) => Array.from({ length: 3 }, () => ({ t: 'buyWagon' as const, stable: w.state.buildings.find((b) => b.type === 'stable')!.id })) },
  ];
  for (const r of runs) {
    const w = createWorld(r.id);
    while (w.state.mission.result === 'running') {
      if (w.state.tick === r.at * TICK_HZ) for (const c of r.cmds(w)) assert(applyCommand(w, c).ok, r.id + ' command');
      step(w);
    }
    const keys = Object.keys(w.state.ledger.stallSeconds);
    assert(keys.some((k) => k.startsWith('span:')), `${r.id}: span charged: ${keys.join(',')}`);
    eq(keys.filter((k) => k.startsWith('wagon:') && (k.endsWith(':BRIDGE_CLOSED') || k.endsWith(':BRIDGE_JAM'))).join(','), '', `${r.id}: no per-wagon bridge rows`);
  }
});

test('F5 / D-44: a supplier whose own delivery is held at a bridge is not "making it now" (m4 ice: castle <- sawmill <- iced wood wagon)', () => {
  const w = createWorld('m4');
  const held = (id: number): boolean => {
    const p = buildingById(w, id);
    if (!p || p.status.k !== 'WAITING_DELIVERY') return false;
    const wagonId = p.status.wagon;
    const k = w.state.wagons.find((x) => x.id === wagonId)?.status.k;
    return k === 'BRIDGE_CLOSED' || k === 'BRIDGE_JAM' || k === 'NO_ROUTE';
  };
  let blamed = 0, wrong = 0;
  while (w.state.mission.result === 'running') {
    step(w);
    if ((w.state.tick - 1) % DISPATCH_INTERVAL) continue; // statuses were just recomputed
    for (const b of w.state.buildings) {
      const s = b.status;
      // suppliers with a lower id got their status earlier in the same pass
      if (s.k === 'WAITING_UPSTREAM' && s.from < b.id && held(s.from)) wrong++;
      if (s.k === 'NO_INPUT' && s.cause === 'NONE_AVAILABLE' && held(s.blockedBy)) {
        const chain = explainBuilding(w, b.id);
        const last = chain[chain.length - 1]!;
        assert(last.kind === 'wagon' && (last.status.k === 'BRIDGE_CLOSED' || last.status.k === 'BRIDGE_JAM' || last.status.k === 'NO_ROUTE'),
          'chain ends at the held wagon: ' + chain.map((l) => l.kind + l.id + ':' + l.status.k).join(' > '));
        blamed++;
      }
    }
  }
  eq(wrong, 0, 'WAITING_UPSTREAM ("the supplier is making it now") from a supplier held at a bridge');
  assert(blamed > 20, `NO_INPUT blamed on the held supplier, chain to the bridge (${blamed} samples)`);
});
