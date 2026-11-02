// Data, causal diagnosis, and deterministic balance acceptance for missions X-XII.
import {
  MISSIONS, checkInvariants, createWorld, findPath, lineCells, missionBuildable,
} from '../src/sim/index';
import { M10_SECOND_WOODCUTTER, M12_GRANARY_LINK, PROPOSED_MISSIONS_10_12 } from '../src/sim/proposals/missions-10-12';
import { STRATEGIES, runProposed } from '../tools/bot-missions-10-12';
import { assert, eq, test } from './harness';

for (const id of ['m10', 'm11', 'm12'] as const) {
  test(id + ': proposal is registered, valley is valid, roads reach the castle', () => {
    eq(MISSIONS[id], PROPOSED_MISSIONS_10_12[id], 'identity matches registered proposal');
    const w = createWorld(id);
    eq(w.terrain.w, 96, 'map width');
    eq(w.terrain.h, 72, 'map height');
    eq(w.state.mapId, 'valley-m3', 'existing valley map');
    eq(w.state.mission.id, id, 'mission ID');
    eq(checkInvariants(w).length, 0, 'initial goods are conserved');
    const castle = w.state.buildings.find((b) => b.type === 'castle')!;
    assert(castle, 'castle exists');
    for (const b of w.state.buildings.filter((b) => b.type !== 'castle')) {
      if (id === 'm12' && b.type === 'warehouse' && b.x === 36) {
        assert(!findPath(w, b.gate, castle.gate, true), 'large granary initially disconnected');
      } else {
        assert(findPath(w, b.gate, castle.gate, true), b.type + ' can reach castle');
      }
    }
  });
}

test('m10: competing wood consumers and repair building are authored', () => {
  eq(missionBuildable('m10').join(','), 'woodcutter', 'only woodcutter can be built');
  const w = createWorld('m10');
  const kinds = w.state.buildings.map((b) => b.type);
  assert(kinds.includes('sawmill') && kinds.includes('charcoalBurner'), 'rival wood consumers');
  assert(!kinds.includes('malthouse') && !kinds.includes('brewery'), 'lesson stays focused on wood');
  assert(M10_SECOND_WOODCUTTER.x === 12 && M10_SECOND_WOODCUTTER.y === 34, 'repair site');
  const baseline = runProposed('m10', STRATEGIES.m10[0]!);
  assert(baseline.contestedSamples > 0, 'NO_INPUT.CONTESTED observed in the original problem');
});

test('m11: long farm-to-malthouse haul competes for the same wagons', () => {
  eq(missionBuildable('m11').length, 0, 'no building mechanic required');
  const w = createWorld('m11');
  const farm = w.state.buildings.find((b) => b.type === 'farm')!;
  const malt = w.state.buildings.find((b) => b.type === 'malthouse')!;
  const brewery = w.state.buildings.find((b) => b.type === 'brewery')!;
  assert(malt.x - farm.x >= 60, 'distant malthouse forces long grain journeys');
  assert(findPath(w, farm.gate, malt.gate, true), 'grain route exists');
  assert(findPath(w, malt.gate, brewery.gate, true), 'malt route exists');
  const baseline = runProposed('m11', STRATEGIES.m11[0]!);
  assert(baseline.waitingDeliverySamples > 0, 'WAITING_DELIVERY diagnosis recorded');
  assert(baseline.allBusySamples > 0, 'NO_WAGON.ALL_BUSY diagnosis recorded');
});

test('m12: full granary and connected alternative are different', () => {
  eq(missionBuildable('m12').join(','), 'warehouse', 'extra granaries allowed');
  const w = createWorld('m12');
  const granaries = w.state.buildings.filter((b) => b.type === 'warehouse');
  const small = granaries.find((b) => b.capOverride === 12)!;
  const big = granaries.find((b) => b.capOverride < 0)!;
  eq(small.stock.grain, 12, 'small granary begins full');
  assert(!findPath(w, big.gate, small.gate, true), 'large granary lacks road link');
  eq(M12_GRANARY_LINK.x, 37, 'planned repair road x');
  eq(lineCells(96, 38 * 96 + 37, 39 * 96 + 37).length, 2, 'two cells connect granary');
  const castle = w.state.buildings.find((b) => b.type === 'castle')!;
  eq(w.state.mission.contract!.tranches.length, 3, 'three ordered letters');
  const needs = w.state.mission.contract!.tranches.reduce((a, t) => ({
    beer: a.beer + t.need.beer, bread: a.bread + t.need.bread,
  }), { beer: 0, bread: 0 });
  eq(needs.beer, w.state.mission.contract!.need.beer, 'beer tranches sum to total');
  eq(needs.bread, w.state.mission.contract!.need.bread, 'bread tranches sum to total');
  assert(castle.stock.beer === 0 && castle.stock.bread === 0, 'castle waits for deliveries');
  const baseline = runProposed('m12', STRATEGIES.m12[0]!);
  assert(baseline.storageFullSamples > 0, 'STORAGE_FULL diagnosed on granary');
  assert(baseline.blockedMaltSamples > 0, 'malthouse OUTPUT_FULL points through explainBuilding to full granary');
});

for (const id of ['m10', 'm11', 'm12'] as const) {
  test(id + ': no action <=1 seal, the repair wins in 5-12 min, difference >=0.8 min', () => {
    const runs = STRATEGIES[id].map((s) => runProposed(id, s));
    console.log('BALANCE ' + id + ': ' + JSON.stringify(runs.map((x) => ({name:x.strategy,result:x.result,min:x.minutes,seals:x.seals,contested:x.contestedSamples,wait:x.waitingDeliverySamples,busy:x.allBusySamples,full:x.storageFullSamples,blockedMalt:x.blockedMaltSamples,warehouseMalt:x.peakWarehouseMalt,late:x.lateTranches,delivered:x.delivered}))));
    for (const r of runs) {
      eq(r.commandErrors.length, 0, r.strategy + ' commands: ' + r.commandErrors.join('; '));
      eq(r.invariantErrors.length, 0, r.strategy + ' invariants: ' + r.invariantErrors.join('; '));
    }
    assert(runs[0]!.seals <= 1, 'no action <=1 seal: ' + JSON.stringify(runs.map((x) => [x.minutes, x.seals, x.result])));
    eq(runs[2]!.result, 'won', 'correct fix must win');
    assert(runs[2]!.minutes >= 5 && runs[2]!.minutes <= 12, 'correct fix is 5-12min: ' + runs[2]!.minutes);
    assert(runs[1]!.minutes - runs[2]!.minutes >= 0.8,
      'partial vs correct >=0.8min: ' + runs.map((x) => x.minutes.toFixed(2)).join('/'));
    assert(runs[2]!.seals >= runs[1]!.seals, 'correct repair earns at least as many seals as partial');
  });
}
