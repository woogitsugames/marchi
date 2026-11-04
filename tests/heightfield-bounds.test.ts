// Heightfield.bounds() (render-only): the wagon view culls a rig before sampling the ground when its frustum box
// for every y in [min, max] is off screen (research 2026-11-04 "Poprawki" #2). Every drawn height must lie inside.
import { createWorld } from '../src/sim/index';
import { MISSIONS } from '../src/sim/missions';
import { CELL, Heightfield } from '../src/render/heightfield';
import { assert, test } from './harness';

test('heightfield bounds contain every sampled ground height (all missions)', () => {
  for (const id of Object.keys(MISSIONS)) {
    const hf = new Heightfield(createWorld(id).terrain);
    const { min, max } = hf.bounds();
    let lo = Infinity, hi = -Infinity;
    const step = CELL / 3;
    for (let z = -CELL; z <= hf.sizeZ + CELL; z += step) {
      for (let x = -CELL; x <= hf.sizeX + CELL; x += step) {
        const h = hf.height(x, z);
        if (h < lo) lo = h;
        if (h > hi) hi = h;
      }
    }
    assert(lo >= min && hi <= max, `${id}: heights ${lo.toFixed(2)}..${hi.toFixed(2)} outside bounds ${min.toFixed(2)}..${max.toFixed(2)}`);
  }
});
