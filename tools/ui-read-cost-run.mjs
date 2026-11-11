// Runs tools/ui-read-cost.ts through the esbuild bundle of tools/diagnosis-audit-run.mjs (i18n uses Vite's
// import.meta.glob, unavailable under tsx). Arguments go to the probe.
//   node tools/ui-read-cost-run.mjs [scenes...] [--no-digest] [--json out.json]
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
process.env.AUDIT_ENTRY = join(here, 'ui-read-cost.ts');
process.env.AUDIT_OUT_DIR ??= join(tmpdir(), 'ui-read-cost');
await import('./diagnosis-audit-run.mjs');
