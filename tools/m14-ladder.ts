// Missions XIV-XV ladder (research 2026-11-06, docs/research/2026-11-06-missions-14-15.md; D-210/D-211), in the shape of
// tools/m8-ladder.ts: passive, wagons only k = 1..max, the lesson + k wagons, the wrong site + k wagons, and the
// "reasonable player" (eye / eye+ every 10/30/60 s, scan, letter) from tools/balance-night6.ts.
//   npx tsx tools/m14-ladder.ts [m14|m15] [--quick] [--map]
import { MISSIONS, TICK_HZ, createWorld, net, newPaceLog, samplePace, step, type Command, type World } from '../src/sim/index';
import { cureFor, rankStalls, sampleInputWaits } from '../src/ui/stalls';
import { forecastFor, paceCard, sampleFleet } from '../src/ui/paceCard';
import { LESSON, WRONG, eyePlayer, run, type Row } from './balance-night6';
import { lessonPlayer, line } from './m8-ladder';

export function ladder1415(id: string, quick = false): Row[] {
  const out: Row[] = [];
  out.push(run(id, 'passive', () => {}));
  const maxK = Math.floor(MISSIONS[id]!.coins / 30);
  for (let k = 1; k <= Math.min(maxK, quick ? 4 : 14); k++) {
    const a: Record<string, number> = {};
    out.push(run(id, `wagons-${k}`, lessonPlayer(k, 0, null, a), a));
  }
  for (const k of [0, 1, 2]) {
    const a: Record<string, number> = {};
    out.push(run(id, `lesson+${k}w`, lessonPlayer(k, 0, LESSON[id]!, a), a));
  }
  for (const k of [0, 1, 2]) {
    const a: Record<string, number> = {};
    out.push(run(id, `wrong+${k}w`, lessonPlayer(k, 0, WRONG[id]!, a), a));
  }
  for (const at of [30, 60, 120]) {
    const a: Record<string, number> = {};
    out.push(run(id, `lesson@${at}s`, lessonPlayer(0, at, LESSON[id]!, a), a));
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

function ascii(w: World): string {
  const t = w.terrain, st = w.state, c = net(w);
  const sym: Record<string, string> = { fisher: 'P', charcoalBurner: 'K', woodcutter: 'W', sawmill: 'S', stable: 'H', farm: 'F', mill: 'M', bakery: 'B', warehouse: 'G', castle: 'C', malthouse: 'L', brewery: 'R' };
  let out = '';
  for (let y = 25; y < 60; y++) {
    let row = String(y).padStart(3) + ' ';
    for (let x = 0; x < t.w; x++) {
      const i = y * t.w + x, b = c.occupied[i]!;
      if (b >= 0) row += sym[st.buildings.find((q) => q.id === b)!.type] ?? '?';
      else if (c.gateOf[i]! >= 0) row += '@';
      else if (st.roads[i]) row += '#';
      else if (t.field[i]) row += ',';
      else row += t.forest[i]! > 0.5 ? 'T' : '.';
    }
    out += row + '\n';
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}` && !process.argv.includes('--sweep') && !process.argv.includes('--cards')) {
  const ids = process.argv.slice(2).filter((a) => /^m\d+$/.test(a));
  for (const id of ids.length ? ids : ['m14', 'm15']) {
    const d = MISSIONS[id]!;
    if (process.argv.includes('--map')) {
      const w = createWorld(id);
      const fix = (c: Command[]): void => { for (const x of c) console.log(id, 'lesson cmd', JSON.stringify(x).slice(0, 80)); };
      fix(LESSON[id]!(w));
      console.log(ascii(w));
      continue;
    }
    console.log(`\n${id} star3 ${d.star3Min} star2 ${d.star2Min} deadline ${d.deadlineMin} coins ${d.coins} wagons ${d.wagons}`);
    for (const r of ladder1415(id, process.argv.includes('--quick'))) {
      console.log(line(r) + (r.late ? ` late ${r.late}` : ''));
      if (r.seen) console.log('    ' + Object.entries(r.seen).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${v}x ${k}`).join(' | '));
    }
  }
}

/** Robustness: the lesson (and the wrong fix) at every 10 s from 0:00 to 2:00, with k = 0..2 wagons bought at 0:00. */
export function sweep(id: string, fixes: Record<string, (w: World) => Command[]>): string[] {
  const out: string[] = [];
  for (const k of [0, 1, 2]) {
    const cells: string[] = [];
    for (let at = 0; at <= 120; at += 10) {
      const a: Record<string, number> = {};
      const r = run(id, 'sweep', lessonPlayer(k, at, fixes[id]!, a), a);
      cells.push(`${r.minutes.toFixed(2)}/${r.seals}`);
    }
    out.push(`k=${k}: ${cells.join(' ')}`);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--sweep')) {
  const ids = process.argv.slice(2).filter((a) => /^m\d+$/.test(a));
  for (const id of ids.length ? ids : ['m14', 'm15']) {
    console.log(`${id} lesson 0:00..2:00 step 10 s`); for (const l of sweep(id, LESSON)) console.log('  ' + l);
    console.log(`${id} wrong  0:00..2:00 step 10 s`); for (const l of sweep(id, WRONG)) console.log('  ' + l);
  }
}

/** What the HUD shows during the first `secs` seconds of doing nothing: the worst stall pin (with its cure) and the pace card. */
export function cards(id: string, secs = 200): string[] {
  const w = createWorld(id), log = newPaceLog(), out: string[] = [];
  let lastS = '', lastP = '';
  while (w.state.tick < secs * TICK_HZ) {
    step(w); sampleInputWaits(w); samplePace(log, w); sampleFleet(w);
    if (w.state.tick % TICK_HZ) continue;
    const r = rankStalls(w)[0], b = r ? w.state.buildings.find((q) => q.id === r.id)! : null;
    const st = b ? `${b.type}:${b.status.k}${'cause' in b.status ? '.' + b.status.cause : ''}${r!.minor ? '(calm)' : ''} cure=${cureFor(w, b.id)}` : '-';
    const pc = paceCard(w, forecastFor(w, log));
    const ps = pc ? `${pc.k}${'type' in pc ? ' ' + pc.type : ''}` : '-';
    if (st !== lastS) { out.push(`${w.state.tick / TICK_HZ}s stall ${st}`); lastS = st; }
    if (ps !== lastP) { out.push(`${w.state.tick / TICK_HZ}s pace ${ps}`); lastP = ps; }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--cards')) {
  const ids = process.argv.slice(2).filter((a) => /^m\d+$/.test(a));
  for (const id of ids.length ? ids : ['m14', 'm15']) { console.log(id); for (const l of cards(id)) console.log('  ' + l); }
}
