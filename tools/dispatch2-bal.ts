// Runs tools/balance-night6.ts --no-search under a RULES variant: npx tsx tools/dispatch2-bal.ts '{"a":0,"c":0}'
import { RULES } from '../src/sim/logistics';
Object.assign(RULES, JSON.parse(process.argv[2] ?? '{}'));
process.argv = [process.argv[0]!, new URL('./balance-night6.ts', import.meta.url).pathname, ...'m1 m2 m3 m4 m5 m6 m7 m8 m9 m10 m11 m12 m13'.split(' '), '--no-search'];
await import('./balance-night6');
