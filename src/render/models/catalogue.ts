/**
 * The prebaked model catalogue's contents (D-331): every model function call the game makes with a fixed argument
 * set, in one place. `tools/bake-models.ts` runs it under `recordModels` and writes what was built; models not
 * listed here (cargo loads per quantity, the yard props, plinths) are built on the device as before.
 */
import { bridgeEndParts, bridgeParts } from './bridges';
import { buildingModel, BUILDING_KINDS, castleUpgradeParts, tradePostClosedParts, tradePostOpenParts } from './buildings';
import { CARGO_GOODS, cargoUnitParts } from './cargo';
import { RIG_VARIANT, WORKER_KINDS, workerRig } from './people';
import { treeBillboard, treeParts, TREE_KINDS, TREE_VARIANTS } from './trees';
import { wagonLod1, wagonModel } from './wagon';

export function buildCatalogue(): void {
  for (const k of TREE_KINDS) for (let v = 0; v < TREE_VARIANTS; v++) treeParts(k, v);
  for (const k of TREE_KINDS) treeBillboard(k);
  for (const t of BUILDING_KINDS) buildingModel(t);
  castleUpgradeParts();
  tradePostClosedParts();
  tradePostOpenParts();
  wagonModel('near');
  wagonModel('mid');
  wagonLod1();
  for (const k of WORKER_KINDS) workerRig(k, RIG_VARIANT[k]);
  for (const g of CARGO_GOODS) cargoUnitParts(g);
  for (const k of ['wood', 'stone'] as const) { bridgeParts(k); bridgeEndParts(k); }
}
