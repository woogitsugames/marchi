// Open bugs reproduced by shrunk fuzz cases. Each test asserts the *correct* behaviour, so it fails
// while the bug is open. When a fix lands, flip the JSON status to 'fixed' (then `npm test` runs it).
import { runScenario } from '../../tools/fuzz-lib';
import { loadRegressions } from '../regressions/load';
import { assert, test } from '../harness';

for (const r of loadRegressions().filter((x) => x.status === 'known-failing')) {
  test(`[${r.review ?? '-'}] ${r.name}: ${r.note.slice(0, 90)}`, () => {
    const res = runScenario(r.scenario, { ...r.options });
    assert(!res.failure, `${res.failure?.kind} @${res.failure?.tick}: ${res.failure?.detail.slice(0, 400)}`);
  });
}
