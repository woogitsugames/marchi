// Runs tools/balance-night6.ts --no-search under a DISPATCH2 variant: npx tsx tools/dispatch2-bal.ts '{"ruleA":false}'
import { DISPATCH2 } from '../src/sim/logistics';
Object.assign(DISPATCH2, JSON.parse(process.argv[2] ?? '{}'));
process.argv = [process.argv[0]!, new URL('./balance-night6.ts', import.meta.url).pathname, ...'m1 m2 m3 m4 m5 m6 m7 m8 m9 m10 m11 m12 m13'.split(' '), '--no-search'];
await import('./balance-night6');
