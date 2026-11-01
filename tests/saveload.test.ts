import { applyCommand, checkInvariants, createWorld, deserialize, serialize, stateHash, step } from '../src/sim/index';
import { bridgeA, stableId } from '../tools/bot';
import { assert, eq, test } from './harness';

test('save/load in the middle of a delivery: identical continuation, no duplication', () => {
  const w = createWorld('m1');
  applyCommand(w, bridgeA(w));
  applyCommand(w, { t: 'buyWagon', stable: stableId(w) });
  // run until some wagon carries cargo
  while (!w.state.wagons.some((q) => q.cargoQty > 0 && q.next >= 0)) step(w);
  const saved = serialize(w);
  const w2 = deserialize(saved);
  eq(stateHash(w2), stateHash(w), 'hash right after load');
  // the restored world must not have extra goods
  eq(checkInvariants(w2).length, 0, 'invariants after load');
  for (let i = 0; i < 2500; i++) {
    step(w); step(w2);
    if (i % 50 === 0) {
      const v = checkInvariants(w2);
      assert(v.length === 0, v.join('; '));
    }
  }
  eq(stateHash(w2), stateHash(w), 'hash after 2500 more ticks');
});

test('save is plain JSON (no NaN/undefined/Infinity)', () => {
  const w = createWorld('m1');
  applyCommand(w, bridgeA(w));
  for (let i = 0; i < 600; i++) step(w);
  const s = serialize(w);
  assert(!/NaN|Infinity|undefined/.test(s), 'clean json');
});
