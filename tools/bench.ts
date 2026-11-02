// Stress scenario: many consumers fed from stocked granaries across the river, so most wagons drive.
import { applyCommand, createWorld, BUILDINGS, type BuildingType, type World } from '../src/sim/index';
import { place } from '../src/sim/commands';
import { bridgeA, bridgeB, polyline, stableId } from './bot';

const check = (r: { ok: boolean }) => { if (!r.ok) throw new Error('bench road failed: ' + JSON.stringify(r)); };

export function benchWorld(wagons: number): World {
  const w = createWorld('lab');
  w.state.coins = 1e7;
  applyCommand(w, bridgeA(w));
  applyCommand(w, bridgeB(w));
  // extra roads: a north row and a south row to hang buildings on
  check(applyCommand(w, { t: 'road', surface: 2, cells: polyline(w, [[16, 28], [90, 28]]) }));
  check(applyCommand(w, { t: 'road', surface: 2, cells: polyline(w, [[4, 60], [66, 60]]) }));
  check(applyCommand(w, { t: 'road', surface: 1, cells: polyline(w, [[17, 24], [17, 28]]) }));
  check(applyCommand(w, { t: 'road', surface: 1, cells: polyline(w, [[30, 44], [30, 60]]) }));
  const consumers: BuildingType[] = ['sawmill', 'mill', 'bakery'];
  let k = 0;
  // consumers north of row 28 (facing south onto it), granaries south of row 60 (facing north)
  for (let x = 18; x + 3 < 90; x += 4) {
    const type = consumers[k++ % 3]!;
    place(w, type, x, 28 - BUILDINGS[type].h - 1 + 0, 0, true);
  }
  for (let x = 4; x + 3 < 66; x += 4) place(w, 'warehouse', x, 61 + 1, 2, true);
  for (const b of w.state.buildings) {
    if (b.type !== 'warehouse') continue;
    for (const g of ['wood', 'grain', 'flour'] as const) { b.stock[g] += 12; w.state.ledger.produced[g] += 12; }
  }
  w.state.netVersion++;
  while (w.state.wagons.length < wagons) applyCommand(w, { t: 'buyWagon', stable: stableId(w) });
  return w;
}
