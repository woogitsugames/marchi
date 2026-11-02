// Mission M12 standalone balance bot. npx tsx tools/bot-m12.ts
import { printResults } from './bot-missions-10-12';

const results = printResults('m12');
if (results.some((r) => r.commandErrors.length || r.invariantErrors.length) ||
    results[2]!.result !== 'won' || results[2]!.seals === 0) {
  process.exitCode = 1;
}
