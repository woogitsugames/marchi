// Runner for tests that reproduce open bugs: npx tsx tests/known-failing/run.ts [filter]
// Not part of `npm test`. Prints which known bugs still reproduce (FAIL = bug still open) and
// exits 0 either way; a test that starts PASSING is flagged so its status can be flipped.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registry, setFile } from '../harness';

const here = dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] ?? '';
const files = readdirSync(here).filter((f) => f.endsWith('.test.ts') && f.includes(filter)).sort();
for (const f of files) {
  setFile(f);
  await import(join(here, f));
}
let open = 0, nowPassing = 0;
for (const tc of registry) {
  try {
    await tc.fn();
    nowPassing++;
    console.log(`PASS (bug fixed? flip status) ${tc.file} › ${tc.name}`);
  } catch (e) {
    open++;
    console.log(`FAIL (open bug) ${tc.file} › ${tc.name}\n     ${(e as Error).message.split('\n')[0]!.slice(0, 300)}`);
  }
}
console.log(`KNOWN-FAILING open=${open} nowPassing=${nowPassing}`);
