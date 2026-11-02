// Mission 7 standalone balance bot. npx tsx tools/bot-m7.ts
import { printResults } from './bot-missions-7-9';

const results = printResults('m7');
if (results.some((r) => r.commandErrors.length || r.invariantErrors.length ||
    r.result !== 'won' || r.seals === 0)) {
  process.exitCode = 1;
}
