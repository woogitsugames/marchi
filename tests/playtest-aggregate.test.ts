import { aggregate, parseCsv, twoCastles } from '../tools/playtest-aggregate';
import { RESULTS_COLUMNS } from '../src/game/playtest';
import { eq, test } from './harness';
import { readFileSync } from 'node:fs';

test('playtest aggregate handles quoted CSV, invalid setups, duplicate attempts and strict 30s', () => {
  const csv = readFileSync('tests/fixtures/playtest-aggregate.csv', 'utf8');
  const a=aggregate(parseCsv(csv)); const g=a.scenarios[0]!;
  eq(g.n_valid,3,'valid'); eq(g.n_invalid_preflight,1,'invalid'); eq(g.n_under_30,1,'threshold'); eq(g.median_time_capped_s,30,'median'); eq(a.problems[0]!.count,2,'issues');
});

test('playtest aggregate: S16 two castles and hypothesis H6 (correct <30 s AND east first before 1:30)', () => {
  const head = RESULTS_COLUMNS.join(',');
  const line = (o: Record<string, string>): string => RESULTS_COLUMNS.map((c) => o[c] ?? '').join(',');
  const base = { scenario_id: 'S16', preflight_ok: '1', invalid_setup: '0', assistance: '0', timeout: '0', cohort: 'onboarding', prior_training: '1' };
  const csv = [head,
    line({ ...base, participant_id: 'P01', correct: '1', time_s: '18', s16_castle_named: 'east', s16_switch_named: '1', s16_first_set_s: '41.0', s16_first_castle: 'east', s16_east_result: 'on_time' }),
    line({ ...base, participant_id: 'P02', correct: '1', time_s: '25', s16_castle_named: 'east', s16_switch_named: '1', s16_first_set_s: '95.0', s16_first_castle: 'east', s16_east_result: 'late' }),
    line({ ...base, participant_id: 'P03', correct: '0', time_s: '12', s16_castle_named: 'north', s16_switch_named: '1', s16_first_set_s: '20.0', s16_first_castle: 'north', s16_east_result: 'late' }),
    line({ ...base, participant_id: 'P04', correct: '1', time_s: '40', s16_castle_named: 'east', s16_switch_named: '0', s16_east_result: 'late' }),
    line({ ...base, participant_id: 'P01', correct: '0', time_s: '50' }), // a repeat: only the first trial counts
    line({ ...base, participant_id: 'P05', preflight_ok: '0', correct: '1', time_s: '5' }),
  ].join('\n');
  const a = aggregate(parseCsv(csv));
  const h = a.twoCastles!;
  eq(h.n_valid, 4, 'valid first trials');
  eq(h.n_named_east, 3, 'named east');
  eq(h.n_named_switch, 3, 'named the switch');
  eq(h.n_switch_east_by_90s, 1, 'east first before 1:30 (95 s is too late)');
  eq(h.n_switch_north, 1, 'wrong castle');
  eq(h.n_east_on_time, 1, 'east letter on time');
  eq(h.n_h6_pass, 1, 'H6 passes');
  eq(h.percent_h6_pass, 25, 'H6 share');
  eq(h.median_first_set_s, 41, 'median switch time');
  eq(twoCastles([]), null, 'no S16 rows, no block');
  eq(aggregate(parseCsv(readFileSync('tests/fixtures/playtest-aggregate.csv', 'utf8'))).twoCastles, null, 'older CSV without S16 columns');
});
