// Test runner: npx tsx tests/run.ts [filter]. Prints SUMMARY last; exit code 1 on failure.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registry, setFile } from './harness';

const here = dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] ?? '';
const files = readdirSync(here).filter((f) => f.endsWith('.test.ts') && f.includes(filter)).sort();

let passed = 0, failed = 0;
const t0 = performance.now();
for (const f of files) {
  setFile(f);
  await import(join(here, f));
}
for (const tc of registry) {
  const s = performance.now();
  try {
    await tc.fn();
    passed++;
    console.log(`ok   ${tc.file} › ${tc.name} (${(performance.now() - s).toFixed(0)} ms)`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${tc.file} › ${tc.name}\n     ${(e as Error).stack?.split('\n').slice(0, 4).join('\n     ')}`);
  }
}
console.log(`SUMMARY passed=${passed} failed=${failed} files=${files.length} time=${((performance.now() - t0) / 1000).toFixed(1)}s`);
process.exit(failed > 0 || passed === 0 ? 1 : 0);
