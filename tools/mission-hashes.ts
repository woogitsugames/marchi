// Final state hash and outcome of every authored mission strategy (tools/balance.ts plans m1-m6,
// tools/bot-missions-7-9.ts and tools/bot-missions-10-12.ts). Diff two checkouts' output to prove a change
// leaves missions untouched (research night 6).  npx tsx tools/mission-hashes.ts
import { plans, runStrategy } from './balance';
import { STRATEGIES as S79, runProposed as run79 } from './bot-missions-7-9';
import { STRATEGIES as S1012, WRONG_FIXES, runProposed as run1012 } from './bot-missions-10-12';

for (const id of Object.keys(plans)) for (const s of plans[id]!) {
  const r = runStrategy(id, s);
  console.log(`${id} | ${s.name} | ${r.result} ${r.minutes.toFixed(2)} | ${r.seals} | ${r.hash}`);
}
for (const id of ['m7', 'm8', 'm9'] as const) for (const s of S79[id]) {
  const r = run79(id, s);
  console.log(`${id} | ${s.name} | ${r.result} ${r.minutes.toFixed(2)} | ${r.seals} | ${r.hash}`);
}
for (const id of ['m10', 'm11', 'm12'] as const) for (const s of [...S1012[id], ...WRONG_FIXES[id]]) {
  const r = run1012(id, s);
  console.log(`${id} | ${s.name} | ${r.result} ${r.minutes.toFixed(2)} | ${r.seals} | ${r.hash}`);
}
