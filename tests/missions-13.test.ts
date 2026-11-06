// Mission XIII "Pierwsze piętro łańcucha" (night 6, D-102): data, the stall it teaches, and the seal ladder.
import { MISSIONS, checkInvariants, createWorld, findPath, missionBuildable } from '../src/sim/index';
import { M13_MISSION } from '../src/sim/proposals/m13';
import { M13_EXTRA, M13_STRATEGIES, runM13 } from '../tools/bot-m13';
import { readFileSync } from 'node:fs';
import { assert, eq, test } from './harness';

test('m13: registered, appended after XII in the menu, one wagon, the raw goods already in the granary', () => {
  eq(MISSIONS.m13, M13_MISSION, 'registered');
  // the menu module needs the browser i18n loader: read its list as text
  const menu = readFileSync(new URL('../src/ui/menu.ts', import.meta.url), 'utf8');
  // XIV and XV follow it since D-210
  assert(/MENU_MISSIONS = \[[^\]]*'m12', 'm13'[,\]]/.test(menu) && /'XII', 'XIII'[,\]]/.test(menu), 'appended as XIII (D-102)');
  eq(missionBuildable('m13').length, 0, 'nothing to build: the cure is wagons');
  const w = createWorld('m13');
  eq(w.state.mapId, 'valley-m3', 'existing valley map');
  eq(w.state.wagons.length, 1, 'one wagon for the whole map');
  eq(checkInvariants(w).length, 0, 'initial goods are conserved');
  const granary = w.state.buildings.find((b) => b.type === 'warehouse')!;
  const need = w.state.mission.contract!.need;
  // planks: 2 per wood; bread: 2 per flour, 1 flour per grain
  assert(granary.stock.wood * 2 >= need.planks && granary.stock.grain * 2 >= need.bread, 'the granary holds every raw unit');
  const castle = w.state.buildings.find((b) => b.type === 'castle')!;
  for (const b of w.state.buildings) if (b !== castle) assert(findPath(w, b.gate, castle.gate, true), `${b.type} reaches the castle`);
  assert(w.state.coins >= 3 * 30, 'silver for three wagons');
});

test('m13: doing nothing fails and the stall reads NO_WAGON / ALL_BUSY; 1/2/3 seals are reachable', () => {
  const runs = M13_STRATEGIES.map(runM13);
  for (const r of runs) {
    eq(r.commandErrors.length, 0, r.strategy + ' commands: ' + r.commandErrors.join('; '));
    eq(r.invariantErrors.length, 0, r.strategy + ' invariants: ' + r.invariantErrors.join('; '));
  }
  eq(runs.map((r) => r.seals).join('/'), '0/2/3', 'nothing / one wagon early / three wagons early');
  eq(runs[0]!.result, 'lost', 'one wagon for the map loses');
  assert(runs[0]!.allBusySamples > 300 && runs[0]!.firstAllBusy <= 5, `ALL_BUSY shows at once and most of the game (${runs[0]!.allBusySamples} s)`);
  assert(runs[2]!.minutes >= 4 && runs[2]!.minutes <= 7, 'the right fix wins in 4-7 min: ' + runs[2]!.minutes.toFixed(2));
  assert(runs[1]!.minutes - runs[2]!.minutes >= 0.8, 'one wagon is clearly slower than three');
  const late = runM13(M13_EXTRA.find((s) => s.name.startsWith('one wagon late'))!);
  eq(late.seals, 1, 'a single wagon bought late earns one seal: ' + late.minutes.toFixed(2));
});
