// One-off: writes tests/fixtures/save-v8-sandbox.json — a real state-v8 free valley save (DECENT plan, 40 min),
// generated on the base before the trading post (state v9, D-170). Kept for the record; rerunning it on v9 code
// would write a v9 save, so it refuses to.
// npx tsx tools/make-fixture-v8.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STATE_VERSION, type World } from '../src/sim/index';
import { makeEnvelope } from '../src/platform/saveGate';
import { DECENT, runSandbox } from './bot-sandbox';

if (STATE_VERSION !== 8) throw new Error(`state version is ${STATE_VERSION}, this fixture must be v8`);
let world: World | null = null;
const r = runSandbox(DECENT, 40, { checkEvery: 600, onTick: (w) => { world = w; } });
if (r.violations.length) throw new Error(r.violations.join('\n'));
const env = makeEnvelope('valley1', world!.state, 1762300000000);
const out = fileURLToPath(new URL('../tests/fixtures/save-v8-sandbox.json', import.meta.url));
writeFileSync(out, JSON.stringify(env));
console.log(`wrote ${out}: tick ${env.tick}, rank ${r.rank}, buildings ${r.buildings}, wagons ${r.wagons}`);
