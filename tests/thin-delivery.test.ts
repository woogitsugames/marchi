// Mission X (D-43): "wood on the way" in a thin load names the shortage at the source; read-only, no hash change.
import { STRATEGIES } from '../tools/bot-missions-10-12';
import { supplyRun } from '../tools/supply-readability';
import { assert, test } from './harness';

test('mission X: the thin-load note explains most "wood on the way" waits when nothing is done, fewer once fixed; hashes unchanged', () => {
  const [nothing, , right] = STRATEGIES.m10;
  const a = supplyRun(nothing!), c = supplyRun(right!);
  for (const r of [a, c]) assert(r.hashSame, `${r.strategy}: reading the note must not change the run`);
  const share = (r: typeof a) => r.onTheWayExplained / Math.max(1, r.onTheWay);
  assert(share(a) >= 0.5, `nothing: ${(share(a) * 100).toFixed(1)} % of "on the way" explained`);
  assert(share(c) < share(a), 'the right fix (second woodcutter) shows the shortage less often');
});
