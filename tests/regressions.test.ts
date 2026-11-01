// Replays shrunk fuzz cases (tests/regressions/*.json). 'fixed' cases must run clean;
// 'known-failing' cases are open bugs and run in `npm run test:known-failing` instead.
import { runScenario } from '../tools/fuzz-lib';
import { loadRegressions } from './regressions/load';
import { assert, test } from './harness';

const all = loadRegressions();

test('regression files are well-formed', () => {
  assert(all.length > 0, 'at least one regression');
  for (const r of all) {
    assert(r.status === 'fixed' || r.status === 'known-failing', `${r.file}: status`);
    assert(Array.isArray(r.scenario.commands) && r.scenario.ticks > 0, `${r.file}: scenario`);
  }
});

for (const r of all.filter((x) => x.status === 'fixed')) {
  test(`regression ${r.name} stays fixed`, () => {
    const res = runScenario(r.scenario, { ...r.options, rerun: true });
    assert(!res.failure, `${r.file}: ${res.failure?.kind} @${res.failure?.tick}: ${res.failure?.detail}`);
  });
}
