import { aggregate, parseCsv } from '../tools/playtest-aggregate';
import { eq, test } from './harness';
import { readFileSync } from 'node:fs';

test('playtest aggregate handles quoted CSV, invalid setups, duplicate attempts and strict 30s', () => {
  const csv = readFileSync('tests/fixtures/playtest-aggregate.csv', 'utf8');
  const a=aggregate(parseCsv(csv)); const g=a.scenarios[0]!;
  eq(g.n_valid,3,'valid'); eq(g.n_invalid_preflight,1,'invalid'); eq(g.n_under_30,1,'threshold'); eq(g.median_time_capped_s,30,'median'); eq(a.problems[0]!.count,2,'issues');
});
