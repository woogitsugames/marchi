// Mission VIII ladder (redesign, D-165): passive, wagons only k = 1..max, the lesson (cobbles) + k wagons,
// and the "reasonable player" (eye / eye+ every 10/30/60 s, scan, letter) from tools/balance-night6.ts.
//   npx tsx tools/m8-ladder.ts [--quick]
import { MISSIONS, TICK_HZ, applyCommand, createWorld, lineCells, stoneAvailable, type Command, type World } from '../src/sim/index';
import { LESSON, eyePlayer, run, stableOf, type Row } from './balance-night6';

type Player = (w: World) => void;

/** k wagons at 0:00, then `fix` from second `at`, retried every second until it applies. */
export function lessonPlayer(k: number, at: number, fix: ((w: World) => Command[]) | null, acts: Record<string, number>): Player {
  let done = fix === null;
  return (w) => {
    const t = w.state.tick;
    if (t === 0) for (let i = 0; i < k; i++) if (applyCommand(w, { t: 'buyWagon', stable: stableOf(w) }).ok) acts.wagon = (acts.wagon ?? 0) + 1;
    if (done || t < at * TICK_HZ || t % TICK_HZ) return;
    const cmds = fix!(w);
    if (applyCommand(w, cmds[0]!).ok) { for (const c of cmds.slice(1)) applyCommand(w, c); acts.fix = t / TICK_HZ; done = true; }
  };
}

const fmt = (s: number): string => (s >= 0 ? '+' : '-') + Math.abs(Math.round(s)) + 's';
export function line(r: Row): string {
  return `${r.strat.padEnd(26)} ${r.result.padEnd(4)} ${r.minutes.toFixed(2).padStart(6)} min  ${r.seals}*  to3 ${fmt(r.m3).padStart(6)} to2 ${fmt(r.m2).padStart(6)}  coins ${r.coins} wagons ${r.wagons} ${JSON.stringify(r.actions)}`;
}

export function ladder(id = 'm8', quick = false): Row[] {
  const out: Row[] = [];
  out.push(run(id, 'passive', () => {}));
  const maxK = Math.floor(MISSIONS[id]!.coins / 30);
  for (let k = 1; k <= Math.min(maxK, quick ? 4 : 14); k++) {
    const a: Record<string, number> = {};
    out.push(run(id, `wagons-${k}`, lessonPlayer(k, 0, null, a), a));
  }
  for (const k of [0, 1, 2, 3]) {
    const a: Record<string, number> = {};
    out.push(run(id, `lesson+${k}w`, lessonPlayer(k, 0, LESSON[id]!, a), a));
  }
  for (const react of [10, 30, 60]) for (const hints of [false, true]) {
    const a: Record<string, number> = {}, seen: Record<string, number> = {};
    out.push(run(id, `${hints ? 'eye+' : 'eye'}-${react}s`, eyePlayer(react, hints, a, seen), a, seen));
  }
  {
    const a: Record<string, number> = {}, seen: Record<string, number> = {};
    out.push(run(id, 'scan+-30s', eyePlayer(30, true, a, seen, undefined, true), a, seen));
  }
  {
    const a: Record<string, number> = {}, seen: Record<string, number> = {};
    out.push(run(id, 'letter@1:00+eye+-30s', eyePlayer(30, true, a, seen, LESSON[id]!), a, seen));
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const d = MISSIONS.m8!;
  console.log(`m8 star3 ${d.star3Min} star2 ${d.star2Min} deadline ${d.deadlineMin} coins ${d.coins} wagons ${d.wagons}`);
  for (const r of ladder('m8', process.argv.includes('--quick'))) {
    console.log(line(r));
    if (r.seen) console.log('    ' + Object.entries(r.seen).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${v}x ${k}`).join(' | '));
  }
}
void lineCells; void stoneAvailable; void createWorld;
