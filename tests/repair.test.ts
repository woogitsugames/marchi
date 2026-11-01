import { applyCommand, createWorld, findPath, step, suggestLinkToStable } from '../src/sim/index';
import { assert, eq, test } from './harness';

test('gap finder: m1 without a bridge suggests an affordable bridge that really connects stable and castle', () => {
  const w = createWorld('m1');
  const castle = w.state.buildings.find((b) => b.type === 'castle')!;
  const stable = w.state.buildings.find((b) => b.type === 'stable')!;
  eq(findPath(w, stable.gate, castle.gate, false), null, 'not connected at start');
  const s = suggestLinkToStable(w, castle.id);
  assert(s !== null, 'a suggestion exists');
  assert(s!.bridgeCells > 0, 'it includes a bridge');
  assert(s!.cost <= w.state.coins, `affordable (${s!.cost} <= ${w.state.coins})`);
  const r = applyCommand(w, { t: 'road', surface: 1, cells: s!.cells });
  assert(r.ok, 'the suggested road is valid: ' + JSON.stringify(r));
  if (r.ok) eq(r.cost, s!.cost, 'predicted cost = charged cost');
  assert(findPath(w, stable.gate, castle.gate, false) !== null, 'connected after building');
  for (let i = 0; i < 50; i++) step(w);
});

test('gap finder: nothing to suggest when already connected', () => {
  const w = createWorld('m2');
  const castle = w.state.buildings.find((b) => b.type === 'castle')!;
  eq(suggestLinkToStable(w, castle.id), null, 'm2 is connected from the start');
});
