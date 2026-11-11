// Dead-end letter audit (D-613, D-635): plays the XVI / XVII bot strategies and seeded random-command games
// (tools/fuzz-lib generateScenario, missions I-XVII; a building outside the mission's build list is dropped, as the
// build tool offers only the list) and reads `deadEnd()` every game second, as the app does. A letter
// is a false alarm when the game is won afterwards, or when the letter clears later (the order was winnable after all).
// Prints per mission: games, games with a letter (by kind), won after a letter, letters that cleared.
//   npx tsx tools/dead-end-scan.ts [--runs 200] [--ticks 6000] [--seed 1] [--missions m16,m17] [--mission-coins]
// (--mission-coins: every game starts with the mission's own silver; by default 60 % of games get 4000)
import { TICK_HZ, applyCommand, createWorld, missionBuildable, step, type Command, type World } from '../src/sim/index';
import { deadEnd } from '../src/ui/deadEnd';
import { ALL_FUZZ_MISSIONS, generateScenario, makeWorld } from './fuzz-lib';
import { M16_EXTRA, M16_STRATEGIES } from './bot-m16';
import { M17_EXTRA, M17_STRATEGIES } from './bot-m17';

const args = process.argv.slice(2);
const opt = (n: string, d: number): number => { const i = args.indexOf('--' + n); return i >= 0 ? Number(args[i + 1]) : d; };
const runs = opt('runs', 200), ticks = opt('ticks', 6000), seed0 = opt('seed', 1);

interface Row { games: number; letters: Record<string, number>; wonAfter: number; cleared: number }
const rows = new Map<string, Row>();
const row = (m: string): Row => { let r = rows.get(m); if (!r) rows.set(m, (r = { games: 0, letters: {}, wonAfter: 0, cleared: 0 })); return r; };

/** One game: `next(w)` gives the commands for this tick; deadEnd is read every second. */
function play(label: string, w: World, limit: number, next: (w: World) => Command[], tag = ''): void {
  const r = row(label);
  r.games++;
  let first: string | null = null, cleared = false, at = 0, gone = 0, what = '';
  for (let t = 0; t < limit && w.state.mission.result === 'running'; t++) {
    for (const c of next(w)) applyCommand(w, c);
    step(w);
    if (w.state.tick % TICK_HZ !== 0) continue;
    const d = deadEnd(w);
    if (d && !first) { first = d.k; at = w.state.tick; what = JSON.stringify(d); }
    if (!d && first && !cleared) { cleared = true; gone = w.state.tick; }
  }
  if (!first) return;
  r.letters[first] = (r.letters[first] ?? 0) + 1;
  if (w.state.mission.result === 'won') r.wonAfter++;
  if (cleared) r.cleared++;
  if (cleared || w.state.mission.result === 'won') {
    console.log(`  false alarm ${label}${tag}: letter at ${at / TICK_HZ} s ${what}, ${cleared ? `cleared at ${gone / TICK_HZ} s` : 'won'}`);
  }
}

const bots: [string, readonly { name: string; steps: [number, (w: World) => Command[]][] }[]][] = [
  ['m16', [...M16_STRATEGIES, ...M16_EXTRA]], ['m17', [...M17_STRATEGIES, ...M17_EXTRA]],
];
for (const [m, list] of bots) {
  for (const s of list) {
    play(`bot ${m}`, createWorld(m), 20 * 60 * TICK_HZ, (w) => s.steps.filter(([sec]) => w.state.tick === sec * TICK_HZ).flatMap(([, f]) => f(w)));
  }
}
const mi = args.indexOf('--missions');
const missions = mi >= 0 ? args[mi + 1]!.split(',') : ALL_FUZZ_MISSIONS.filter((m) => m !== 'sandbox');
const ownCoins = args.includes('--mission-coins');
for (let i = 0; i < runs; i++) {
  const sc = generateScenario(seed0 + i, { ticks, missions });
  const can = missionBuildable(sc.mission);
  const cmds = [...sc.commands].filter(({ cmd }) => cmd.t !== 'place' || can === 'ranked' || can.includes(cmd.type)).sort((a, b) => a.tick - b.tick);
  let k = 0;
  play(`fuzz ${sc.mission}`, makeWorld(sc.mission, ownCoins ? null : sc.coins), sc.ticks, (w) => {
    const out: Command[] = [];
    while (k < cmds.length && cmds[k]!.tick === w.state.tick) out.push(cmds[k++]!.cmd);
    return out;
  }, ` (scenario seed ${seed0 + i})`);
}
let letters = 0, bad = 0;
for (const [m, r] of [...rows].sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }))) {
  const n = Object.values(r.letters).reduce((a, b) => a + b, 0);
  letters += n; bad += r.wonAfter + r.cleared;
  console.log(`${m.padEnd(10)} games ${String(r.games).padStart(3)}  letters ${n} ${JSON.stringify(r.letters)}  won after ${r.wonAfter}  cleared ${r.cleared}`);
}
console.log(`SUMMARY letters=${letters} falseAlarms=${bad}`);
if (bad) process.exitCode = 1;
