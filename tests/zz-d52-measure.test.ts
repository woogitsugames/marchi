// Temporary D-52 measurement harness; removed after recording baseline and tuned results.
import { test, assert } from './harness';
import { runBalanceSuite } from '../tools/balance-sandbox';

test('D52 measure baseline (6 policies x 3 seeds x 180 minutes)', () => {
  const data = runBalanceSuite(false);
  console.log('D52_BASELINE ' + JSON.stringify(data));
  assert(data.rows.length === 18, 'expected 18 baseline runs');
});
test('D52 measure in-memory proposed tuning (same 18 runs)', () => {
  const data = runBalanceSuite(true);
  console.log('D52_TUNED ' + JSON.stringify(data));
  assert(data.rows.length === 18, 'expected 18 tuned runs');
});
