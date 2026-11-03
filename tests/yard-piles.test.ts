// Yard piles (owner decision 15, D-71): every producer model has a yard spot for its output, and one full
// wagon load set there stays on the building's own footprint. Render-only data; no sim involved.
import { Box3, Matrix4, Vector3 } from 'three';
import { BUILDINGS, GOODS, createWorld, outputGoods, type BuildingType } from '../src/sim/index';
import { BUILDING_KINDS, buildingModel, type BuildingKind } from '../src/render/models/buildings';
import { CARGO_GOODS, type CargoGood, cargoFor, cargoSlots, cargoUnitParts, yardPileLocal } from '../src/render/models/cargo';
import { yardPileGood } from '../src/render/wagonsView';
import { assert, eq, test } from './harness';

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
// The store / contract piles (D-79: warehouse, castle) may show any good, so every load is checked there; the
// spots of one building must not overlap each other either.
test('yard piles: no clipping into the model, clear of the gate road and the footprint edge', () => {
  let spots = 0;
  for (const kind of BUILDING_KINDS) {
    if (!(kind in BUILDINGS)) continue;
    const out = outputGoods(kind as BuildingType);
    const m = buildingModel(kind as BuildingKind);
    const cases: { spot: { at: Vector3; yaw: number }; g: CargoGood; i: number }[] = [];
    if (out.length && m.yard) cases.push({ spot: m.yard, g: cargoFor(out[0]!), i: -1 });
    (m.piles ?? []).forEach((spot, i) => { for (const g of CARGO_GOODS) if (g !== 'crate') cases.push({ spot, g, i }); });
    const footprints: Box3[] = [];
    for (const { spot, g, i } of cases) {
    spots++;
    const base = new Matrix4().makeRotationY(spot.yaw).setPosition(spot.at.x, 0, spot.at.z).multiply(yardPileLocal(g));
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
    const hitBox = new Box3();
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
          if (p.y > 0.06 && boxes.some((bx) => bx.containsPoint(p))) { hits++; hitBox.expandByPoint(p); }
        }
      }
    }
    assert(hits === 0, `${kind}: ${hits} model points inside the ${g} pile (pile ${pile.min.toArray().map((v) => v.toFixed(2))}..${pile.max.toArray().map((v) => v.toFixed(2))}, hits ${hitBox.min.toArray().map((v) => v.toFixed(2))}..${hitBox.max.toArray().map((v) => v.toFixed(2))})`);
    if (i >= 0) {
      for (let k = 0; k < footprints.length; k++) {
        if (k === i || !footprints[k]) continue;
        assert(!footprints[k]!.intersectsBox(pile), `${kind}: piles ${k} and ${i} overlap (${g})`);
      }
      footprints[i] = footprints[i] ? footprints[i]!.union(pile) : pile.clone();
    }
    }
  }
  assert(spots >= 10 + 5 * 10, `spots checked (${spots})`);
});

// D-79: what each spot shows — producer output, the contract castle's goods by share delivered, a store's largest stocks.
test('yard piles: castle piles follow the order, warehouse piles its two largest stocks', () => {
  const w = createWorld('m1');
  const c = w.state.mission.contract!;
  const castle = w.state.buildings.find((b) => b.id === c.castle)!;
  castle.stock.planks = 15;
  const p0 = { ...yardPileGood(w, castle, 0)! }, p1 = { ...yardPileGood(w, castle, 1)! };
  eq(`${p0.good}:${p0.frac}`, 'planks:0.5', 'first ordered good, half delivered');
  eq(`${p1.good}:${p1.frac}`, 'bread:0', 'second ordered good, nothing yet');
  eq(yardPileGood(w, castle, 2), null, 'a two-good order has no third pile');
  castle.stock.planks = 0;
  const store = w.state.buildings.find((b) => b.type === 'warehouse');
  if (store) {
    for (const g of GOODS) store.stock[g] = 0;
    store.stock.flour = 3; store.stock.wood = 7; store.stock.grain = 3;
    eq(yardPileGood(w, store, 0)!.good, 'wood', 'largest stock first');
    eq(yardPileGood(w, store, 1)!.good, 'grain', 'a tie goes in goods order');
    for (const g of GOODS) store.stock[g] = 0;
    eq(yardPileGood(w, store, 0), null, 'an empty store shows nothing');
  }
  const prod = w.state.buildings.find((b) => b.type === 'sawmill')!;
  eq(yardPileGood(w, prod, -1)!.good, 'planks', 'a producer shows its output');
});
