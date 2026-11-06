// Mission XV ("Skład pod zamkiem", D-210) strategy runner in the real simulation (runner shared with XIV).
// Use: npx tsx tools/bot-m15.ts — prints every strategy; exit != 0 when the seal ladder breaks.
import type { Command, World } from '../src/sim/index';
import { M15_GRANARY_SITE, M15_WRONG_SITE } from '../src/sim/proposals/missions-14-15';
import { column, printSite, runSiteBot, wagons, type SiteStrategy } from './bot-m14';

/** The new granary by the castle (the lesson) or by the woodcutters (the tempting wrong site), with its road link. */
export const granaryByCastle = (w: World): Command[] =>
  [{ t: 'place', type: 'warehouse', ...M15_GRANARY_SITE }, column(w, M15_GRANARY_SITE.x + 1, 40, 41)];
export const granaryByWoods = (w: World): Command[] =>
  [{ t: 'place', type: 'warehouse', ...M15_WRONG_SITE }, column(w, M15_WRONG_SITE.x + 1, 40, 41)];

/** The seal ladder (tests): nothing, the lesson late, the lesson as soon as the woodcutters' card shows. */
export const M15_STRATEGIES: readonly SiteStrategy[] = [
  { name: 'nic / the woodcutters stand full', steps: [] },
  { name: 'czesciowa / granary by the castle late @2:00', steps: [[120, granaryByCastle]] },
  { name: 'wlasciwa / granary by the castle @0:45', steps: [[45, granaryByCastle]] },
];
/** Other plausible plays, printed for balance (not part of the ladder). */
export const M15_EXTRA: readonly SiteStrategy[] = [
  { name: 'two wagons @0:00', steps: [[0, wagons(2)]] },
  { name: 'granary by the woodcutters @0:45', steps: [[45, granaryByWoods]] },
  { name: 'granary by the woodcutters + 1 wagon @0:00', steps: [[0, wagons(1)], [0, granaryByWoods]] },
  { name: 'granary by the castle @0:00', steps: [[0, granaryByCastle]] },
  { name: 'granary by the castle @0:00 + 1 wagon', steps: [[0, wagons(1)], [0, granaryByCastle]] },
];

if (process.argv[1] && /bot-m15\.ts$/.test(process.argv[1])) {
  const ladder = M15_STRATEGIES.map((s) => runSiteBot('m15', s));
  ladder.forEach((r) => printSite('m15', r));
  console.log('--- other plays');
  M15_EXTRA.map((s) => runSiteBot('m15', s)).forEach((r) => printSite('m15', r));
  const ok = ladder.every((r) => !r.commandErrors.length && !r.invariantErrors.length) && ladder.map((r) => r.seals).join('/') === '1/2/3';
  if (!ok) process.exitCode = 1;
}
