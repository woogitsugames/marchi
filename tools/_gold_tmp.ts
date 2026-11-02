import { readFileSync } from 'node:fs';
import { hashString } from '../src/sim/hash';
const base = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as Record<string, string[]>;
const out: Record<string, string> = {};
for (const [k, snaps] of Object.entries(base)) out[k] = hashString(snaps[snaps.length - 1]!.replace('{"version":4,', '{"version":0,'));
console.log(JSON.stringify(out, null, 2));
