// Mission 9 standalone balance bot. npx tsx tools/bot-m9.ts
import { printResults } from './bot-missions-7-9';

const results = printResults('m9');
if (results.some((r) => r.commandErrors.length || r.invariantErrors.length ||
    r.result !== 'won' || r.seals === 0)) {
  process.exitCode = 1;
}
