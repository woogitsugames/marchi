// Mission XVI forecast error (D-313): every 10 s, what the whole-order forecast (contractForecast via forecastFor) and
// each castle's forecast (castleForecast) say, against what the run would do from that moment with no further player
// action (a copy of the state played on passively — the forecast cannot know a wagon bought later).
//   npx tsx tools/m16-forecast-error.ts [--table] [--json]
// Prints per strategy the worst error (s, + = forecast late/pessimistic, − = early/optimistic) from 1:00 on, and with
// --table every sample.
import { TICK_HZ, applyCommand, castleForecast, deserialize, newPaceLog, samplePace, serialize, step, type World } from '../src/sim/index';
import { forecastFor, paceCard } from '../src/ui/paceCard';
import { castlesOf, eastFirst, northFirst, wagon } from './bot-m16';
import { eyePlayer, probe, run } from './balance-night6';

export interface Sample {
  t: number;
  /** whole order: forecast finish / passive actual (ticks; −1 none). */
  whole: number; wholeAct: number;
  /** per castle [east, north]: forecast finish / passive actual. */
  castle: [number, number]; castleAct: [number, number];
  /** The haul card (D-307) shows at this sample. */
  haul: boolean;
}

function passive(w: World): { end: number; done: [number, number] } {
  const c = deserialize(serialize(w));
  while (c.state.mission.result === 'running' && c.state.tick < 20 * 60 * TICK_HZ) step(c);
  const m = c.state.mission;
  return { end: m.result === 'won' ? m.endTick : -1, done: [m.contract!.tranches[0]!.doneTick, m.extraContracts![0]!.tranches[0]!.doneTick] };
}

export function measure(player: (w: World) => void, every = 10): { samples: Sample[]; end: number; seals: number } {
  const log = newPaceLog();
  const samples: Sample[] = [];
  probe.onTick = (w) => {
    samplePace(log, w);
    if (w.state.tick % (every * TICK_HZ) || w.state.mission.result !== 'running') return;
    const f = forecastFor(w, log);
    const [e, n] = castlesOf(w);
    const fe = castleForecast(w, log, e), fn = castleForecast(w, log, n);
    const p = passive(w);
    samples.push({
      t: w.state.tick,
      whole: f && f.ready ? f.finishTick : -1, wholeAct: p.end,
      castle: [fe && !fe.done ? fe.finishTick : -1, fn && !fn.done ? fn.finishTick : -1],
      castleAct: [fe && !fe.done ? p.done[0] : -1, fn && !fn.done ? p.done[1] : -1],
      haul: paceCard(w, f, log)?.k === 'haul',
    });
  };
  const r = run('m16', 'measure', player);
  probe.onTick = null;
  return { samples, end: Math.round(r.minutes * 60 * TICK_HZ), seals: r.seals };
}

const at = (steps: [number, (w: World) => ReturnType<typeof eastFirst>][]) => (w: World): void => {
  for (const [s, f] of steps) if (w.state.tick === s * TICK_HZ) for (const c of f(w)) applyIt(w, c);
};
const applyIt = (w: World, c: Parameters<typeof applyCommand>[1]): void => { applyCommand(w, c); };

export const STRATS: [string, () => (w: World) => void][] = [
  ['nothing (even)', () => at([])],
  ['east first @0:00', () => at([[0, eastFirst]])],
  ['east first @1:00', () => at([[60, eastFirst]])],
  ['east first @1:30', () => at([[90, eastFirst]])],
  ['north first @0:00', () => at([[0, northFirst]])],
  ['+1 wagon @0:30', () => at([[30, wagon]])],
  ['east first + 1 wagon @0:30', () => at([[0, eastFirst], [30, wagon]])],
  ['eye+ 10 s', () => eyePlayer(10, true, {}, {})],
  ['eye+ 30 s', () => eyePlayer(30, true, {}, {})],
  ['eye+ 60 s', () => eyePlayer(60, true, {}, {})],
];

const clock = (t: number): string => {
  if (t < 0) return '  -  ';
  const s = Math.round(t / TICK_HZ);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const err = (f: number, a: number): number | null => (f < 0 || a < 0 ? null : (f - a) / TICK_HZ);

/** Worst |error| (signed) over samples with t >= from. */
export function worst(samples: Sample[], pick: (s: Sample) => number | null, from: number, to = Infinity): number | null {
  let w: number | null = null;
  for (const s of samples) {
    if (s.t < from || s.t > to) continue;
    const e = pick(s);
    if (e !== null && (w === null || Math.abs(e) > Math.abs(w))) w = e;
  }
  return w;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const table = process.argv.includes('--table');
  const json: Record<string, unknown> = {};
  const fmt = (v: number | null): string => (v === null ? '   -' : `${v > 0 ? '+' : ''}${v.toFixed(0)}`).padStart(5);
  console.log('strategy                      end   seals | whole 1:00+ 2:00+ haul | east 0:10+ 1:00+ | north 0:10+ 1:00+');
  for (const [name, mk] of STRATS) {
    const r = measure(mk());
    json[name] = r;
    const W = (s: Sample): number | null => err(s.whole, s.wholeAct);
    const E = (s: Sample): number | null => err(s.castle[0], s.castleAct[0]);
    const N = (s: Sample): number | null => err(s.castle[1], s.castleAct[1]);
    const m1 = 60 * TICK_HZ, m2 = 120 * TICK_HZ, s10 = 10 * TICK_HZ;
    console.log(`${name.padEnd(28)} ${clock(r.end)} ${r.seals}    |  ${fmt(worst(r.samples, W, m1))} ${fmt(worst(r.samples, W, m2))} ${fmt(worst(r.samples, (s) => (s.haul ? W(s) : null), 0))} |  ${fmt(worst(r.samples, E, s10))} ${fmt(worst(r.samples, E, m1))} |  ${fmt(worst(r.samples, N, s10))} ${fmt(worst(r.samples, N, m1))}`);
    if (table) for (const s of r.samples) {
      console.log(`   ${clock(s.t)}  whole ${clock(s.whole)} / ${clock(s.wholeAct)} ${fmt(W(s))}   east ${clock(s.castle[0])} / ${clock(s.castleAct[0])} ${fmt(E(s))}   north ${clock(s.castle[1])} / ${clock(s.castleAct[1])} ${fmt(N(s))}${s.haul ? '  haul' : ''}`);
    }
  }
  if (process.argv.includes('--json')) console.log(JSON.stringify(json));
}
