// Yard piles (owner decision 15, D-71): every producer model has a yard spot for its output, and one full
// wagon load set there stays on the building's own footprint. Render-only data; no sim involved.
import { Matrix4, Vector3 } from 'three';
import { BUILDINGS, outputGoods, type BuildingType } from '../src/sim/index';
import { BUILDING_KINDS, buildingModel, type BuildingKind } from '../src/render/models/buildings';
import { cargoFor, cargoSlots, yardPileLocal } from '../src/render/models/cargo';
import { assert, test } from './harness';

test('yard piles: each producer has a yard spot; a full load stays on its footprint', () => {
  let seen = 0;
  for (const kind of BUILDING_KINDS) {
    if (!(kind in BUILDINGS)) continue;
    const out = outputGoods(kind as BuildingType);
    if (!out.length) continue;
    const m = buildingModel(kind as BuildingKind);
    assert(!!m.yard, `${kind} has a yard spot`);
    if (!m.yard) continue;
    const g = cargoFor(out[0]!);
    const base = new Matrix4().makeRotationY(m.yard.yaw).setPosition(m.yard.at.x, 0, m.yard.at.z).multiply(yardPileLocal(g));
    const hx = (m.cells[0] * 4) / 2, hz = (m.cells[1] * 4) / 2;
    for (const s of cargoSlots(g)) {
      const p = new Vector3().applyMatrix4(new Matrix4().multiplyMatrices(base, s));
      assert(Math.abs(p.x) <= hx - 0.2 && Math.abs(p.z) <= hz - 0.2, `${kind}: ${g} unit at ${p.x.toFixed(2)},${p.z.toFixed(2)} inside ±${hx},±${hz}`);
      assert(p.y > -0.05 && p.y < 1.0, `${kind}: unit on the ground or one layer up (y ${p.y.toFixed(2)})`);
    }
    seen++;
  }
  assert(seen >= 10, `producers checked (${seen})`);
});
