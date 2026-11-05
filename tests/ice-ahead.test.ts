// Ice ahead (day 8c, D-109 follow-up): before the authored ice, when one more wagon would leave too little silver
// for the stone bridge on the crossed span, "Kup wóz" yields to paving that span (mission IV's "scan" player).
import { TICK_HZ, WAGON_PRICE, applyCommand, createWorld, stateHash, step } from '../src/sim/index';
import { cureFor, iceAheadSpan, iceBeforeWagon, paveCheck, paveSpanFor } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

test('ice ahead: IV — the wagon cure turns into the stone bridge once a wagon would cost it', () => {
  const w = createWorld('m4');
  const ice = iceAheadSpan(w);
  assert(!!ice, 'the span the ice will close is found');
  assert(ice!.cells.length > 0 && ice!.price > 0, 'it has cells and a price');
  eq(iceBeforeWagon(w), null, 'with full silver a wagon still leaves enough');
  const stable = w.state.buildings.find((b) => b.type === 'stable')!.id;
  // spend down to just above the bridge: one more wagon would leave too little
  while (w.state.coins - WAGON_PRICE >= ice!.price) assert(applyCommand(w, { t: 'buyWagon', stable }).ok, 'wagon');
  assert(w.state.coins >= ice!.price, 'the bridge is still affordable');
  let seen = false;
  while (w.state.tick < 170 * TICK_HZ && !seen) {
    step(w);
    for (const b of w.state.buildings) {
      if (cureFor(w, b.id) !== 'pave') continue;
      const hash = stateHash(w);
      const p = paveSpanFor(w, b);
      assert(!!p && !p.held && !!p.ice, 'the pave cure is the ice ahead');
      assert(paveCheck(w, p!).ok, 'the stone bridge can be laid');
      eq(stateHash(w), hash, 'read-only');
      seen = true;
      break;
    }
  }
  assert(seen, 'a wagon cure yielded to the span before the ice');
  // after the ice starts there is no "ahead" any more
  while (w.state.tick < 181 * TICK_HZ) step(w);
  eq(iceAheadSpan(w), null, 'no warning once the ice is on');
});

test('ice ahead: missions without authored ice never yield', () => {
  for (const id of ['m2', 'm3', 'm7']) eq(iceAheadSpan(createWorld(id)), null, id);
});

test('ice ahead: the span to pave lies on wooden deck cells over water (the deck ghost draws there, D-134)', () => {
  const w = createWorld('m4');
  const ice = iceAheadSpan(w);
  assert(!!ice, 'span found');
  for (const c of ice!.cells) {
    assert(w.terrain.water[c] === 1, `cell ${c} is water`);
    eq(w.state.roads[c], 1, `cell ${c} is a wooden (dirt-surface) bridge cell`);
  }
});
