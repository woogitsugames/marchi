// Yard piles (owner decision 15, D-71): every producer model has a yard spot for its output, and one full
// wagon load set there stays on the building's own footprint. Render-only data; no sim involved.
import { Box3, Matrix4, Vector3 } from 'three';
import { BUILDINGS, outputGoods, type BuildingType } from '../src/sim/index';
import { BUILDING_KINDS, buildingModel, type BuildingKind } from '../src/render/models/buildings';
import { cargoFor, cargoSlots, cargoUnitParts, yardPileLocal } from '../src/render/models/cargo';
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

// Day-2 check (owner question from day 1): no wall, prop or rope of the model reaches into a pile unit, the pile
// keeps off the road that ends at the gate (its 2.2 m wagon lane, the last 2.5 m inside the footprint) and off the edge.
test('yard piles: no clipping into the model, clear of the gate road and the footprint edge', () => {
  for (const kind of BUILDING_KINDS) {
    if (!(kind in BUILDINGS)) continue;
    const out = outputGoods(kind as BuildingType);
    const m = buildingModel(kind as BuildingKind);
    if (!out.length || !m.yard) continue;
    const g = cargoFor(out[0]!);
    const base = new Matrix4().makeRotationY(m.yard.yaw).setPosition(m.yard.at.x, 0, m.yard.at.z).multiply(yardPileLocal(g));
    const unit = new Box3();
    for (const p of cargoUnitParts(g)) { p.geometry.computeBoundingBox(); unit.union(p.geometry.boundingBox!); }
    const boxes = cargoSlots(g).map((s) => unit.clone().applyMatrix4(new Matrix4().multiplyMatrices(base, s)).expandByScalar(0.03));
    const pile = new Box3();
    boxes.forEach((b) => pile.union(b));
    const hx = m.cells[0] * 2, hz = m.cells[1] * 2;
    const edge = Math.min(hx - Math.max(-pile.min.x, pile.max.x), hz - Math.max(-pile.min.z, pile.max.z));
    assert(edge >= 0.05, `${kind}: pile ${edge.toFixed(2)} m from the footprint edge`);
    const offRoad = pile.min.x >= m.gate.x + 1.1 || pile.max.x <= m.gate.x - 1.1 || pile.max.z <= m.gate.z - 2.5;
    assert(offRoad, `${kind}: pile off the gate road (x ${pile.min.x.toFixed(2)}..${pile.max.x.toFixed(2)}, gate ${m.gate.x})`);
    let hits = 0;
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), p = new Vector3();
    for (const part of m.parts) {
      const pos = part.geometry.getAttribute('position');
      const idx = part.geometry.index;
      const n = idx ? idx.count : pos.count;
      for (let i = 0; i < n; i += 3) {
        a.fromBufferAttribute(pos, idx ? idx.getX(i) : i);
        b.fromBufferAttribute(pos, idx ? idx.getX(i + 1) : i + 1);
        c.fromBufferAttribute(pos, idx ? idx.getX(i + 2) : i + 2);
        if (!pile.intersectsBox(new Box3().setFromPoints([a, b, c]))) continue;
        // sample the triangle every ~5 cm (ropes and rails are long, thin triangles); the ground (y < 6 cm) is free
        const N = Math.max(6, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / 0.05));
        for (let u = 0; u <= N; u++) for (let v = 0; v <= N - u; v++) {
          p.set(0, 0, 0).addScaledVector(a, u / N).addScaledVector(b, v / N).addScaledVector(c, (N - u - v) / N);
          if (p.y > 0.06 && boxes.some((bx) => bx.containsPoint(p))) hits++;
        }
      }
    }
    assert(hits === 0, `${kind}: ${hits} model points inside the ${g} pile`);
  }
});
