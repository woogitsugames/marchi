import { TICK_HZ } from '../src/sim/index';
import { runBot } from './bot';
const r = runBot({ log: true, checkEvery: 1 });
console.log(`RESULT ${r.result} at ${(r.endTick / TICK_HZ / 60).toFixed(2)} min, stars=${r.stars}, wagons=${r.wagons}, coins=${r.coins}`);
if (r.violations.length) console.log('VIOLATIONS\n' + r.violations.join('\n'));
process.exit(r.result === 'won' && r.violations.length === 0 ? 0 : 1);
