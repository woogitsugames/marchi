// Final state hash and outcome of every authored mission strategy (tools/balance.ts plans m1-m6,
// tools/bot-missions-7-9.ts, tools/bot-missions-10-12.ts and the XIII-XV bots). Diff two checkouts' output to prove
// a change leaves missions untouched (research night 6). Hashes are taken with `version: 0` (tools/golden-hash.ts),
// so a state-version bump with an identity migration (v10, D-288) keeps every row literal.
//   npx tsx tools/mission-hashes.ts
import { plans, runStrategy } from './balance';
import { STRATEGIES as S79, runProposed as run79 } from './bot-missions-7-9';
import { STRATEGIES as S1012, WRONG_FIXES, runProposed as run1012 } from './bot-missions-10-12';
import { M13_EXTRA, M13_STRATEGIES, runM13 } from './bot-m13';
import { M14_EXTRA, M14_STRATEGIES, runSiteBot } from './bot-m14';
import { M15_EXTRA, M15_STRATEGIES } from './bot-m15';
import { M17_EXTRA, M17_STRATEGIES, runM17 } from './bot-m17';

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
for (const s of [...M13_STRATEGIES, ...M13_EXTRA]) {
  const r = runM13(s);
  console.log(`m13 | ${s.name} | ${r.result} ${r.minutes.toFixed(2)} | ${r.seals} | ${r.hash}`);
}
for (const [id, list] of [['m14', [...M14_STRATEGIES, ...M14_EXTRA]], ['m15', [...M15_STRATEGIES, ...M15_EXTRA]]] as const) for (const s of list) {
  const r = runSiteBot(id, s);
  console.log(`${id} | ${s.name} | ${r.result} ${r.minutes.toFixed(2)} | ${r.seals} | ${r.hash}`);
}
// mission XVII (D-356): appended after the 71 rows of I-XV, so their diff stays literal
for (const s of [...M17_STRATEGIES, ...M17_EXTRA]) {
  const r = runM17(s);
  console.log(`m17 | ${s.name} | ${r.result} ${r.minutes.toFixed(2)} | ${r.seals} | ${r.hash}`);
}
