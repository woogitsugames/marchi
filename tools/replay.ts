// Replay a "Copy report" bug report headless and compare state hashes.
//   npx tsx tools/replay.ts <report.json|report.txt|-> [--verbose]
// Accepts plain JSON or the compressed MR1.<base64url> clipboard form.
// Exit codes: 0 = all checkpoints and final hash match, 1 = divergence, 2 = invalid/unreplayable report.
import { readFileSync } from 'node:fs';
import { decodeReportText } from '../src/platform/reportCodec';
import { hashString } from '../src/sim/hash';
import { parseReportText, replay, type ReplayReport } from '../src/sim/replay';
import type { World } from '../src/sim/index';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const src = args.find((a) => !a.startsWith('-') || a === '-');
if (!src) {
  console.error('usage: npx tsx tools/replay.ts <report.json|-> [--verbose]');
  process.exit(2);
}

function readInput(path: string): string {
  try {
    return readFileSync(path === '-' ? 0 : path, 'utf8');
  } catch (e) {
    console.error(`cannot read ${path}: ${(e as Error).message}`);
    process.exit(2);
  }
}

/** Short, comparable digest of each top-level state section (to see which part diverged). */
function stateSummary(w: World): string[] {
  const st = w.state;
  const lines = [
    `tick=${st.tick} coins=${st.coins} buildings=${st.buildings.length} wagons=${st.wagons.length} ` +
      `netVersion=${st.netVersion} nextId=${st.nextId} mission=${st.mission.result} rng=${st.rng.join(',')}`,
  ];
  const sections = Object.keys(st).sort().map((k) => `${k}:${hashString(JSON.stringify((st as unknown as Record<string, unknown>)[k])).slice(0, 8)}`);
  lines.push('section digests: ' + sections.join(' '));
  for (const wg of st.wagons.slice(0, 30)) {
    lines.push(`  wagon ${wg.id} at=${wg.at} next=${wg.next} cargo=${wg.cargoGood ?? '-'}x${wg.cargoQty} status=${wg.status.k} job=${wg.job ? `${wg.job.phase} ${wg.job.from}->${wg.job.to}` : '-'}`);
  }
  if (st.wagons.length > 30) lines.push(`  ... ${st.wagons.length - 30} more wagons`);
  for (const b of st.buildings.slice(0, 30)) lines.push(`  building ${b.id} ${b.type} status=${b.status.k} progress=${b.progress}`);
  return lines;
}

function describeCmd(c: ReplayReport['journal'][number]['cmd']): string {
  return c.t === 'road' ? `road surface=${c.surface} cells=${c.cells.length} [${c.cells[0]}..${c.cells[c.cells.length - 1]}]` : JSON.stringify(c);
}

const decoded = await decodeReportText(readInput(src));
if (!decoded.ok) {
  console.error(`invalid report: ${decoded.error}`);
  process.exit(2);
}
const parsed = parseReportText(decoded.json);
if (!parsed.ok) {
  console.error('invalid report:\n  ' + parsed.errors.slice(0, 10).join('\n  '));
  process.exit(2);
}
const report = parsed.value;
console.log(`report v${report.version} game=${report.game} mission=${report.missionId} seed=${report.seed} ` +
  `stateVersion=${report.stateVersion} commands=${report.journal.length} checkpoints=${report.checkpoints.length} finalTick=${report.finalTick}`);

const res = replay(report, {
  onCommand: verbose ? (tick, cmd, r) => console.log(`  t=${tick} ${describeCmd(cmd)} -> ${r.ok ? 'ok' : 'ERR ' + r.err.k}`) : undefined,
  onCheckpoint: (cp) => console.log(`${cp.ok ? 'OK      ' : 'MISMATCH'} t=${cp.tick} expected=${cp.expected} actual=${cp.actual}`),
});
if (res.error) {
  console.error(`cannot replay: ${res.error}`);
  process.exit(2);
}
console.log(`${res.finalOk ? 'OK      ' : 'MISMATCH'} final t=${report.finalTick} expected=${report.finalHash} actual=${res.finalHash}`);

if (res.ok) {
  console.log('RESULT ok: replay is identical');
  process.exit(0);
}

const d = res.firstDivergence!;
const prevOk = [...res.checkpoints].reverse().find((c) => c.ok && c.tick < d.tick)?.tick ?? -1;
console.log(`RESULT divergence: first at t=${d.tick} (last matching checkpoint t=${prevOk < 0 ? 'none' : prevOk})`);
console.log(`  expected ${d.expected}\n  actual   ${d.actual}`);
const near = report.journal.filter((e) => e.tick >= Math.max(0, prevOk) && e.tick <= d.tick);
console.log(`commands applied in ticks [${Math.max(0, prevOk)}..${d.tick}]: ${near.length}`);
for (const e of near.slice(0, 40)) console.log(`  t=${e.tick} ${describeCmd(e.cmd)}`);
if (near.length > 40) console.log(`  ... ${near.length - 40} more`);
// State as this build sees it at the divergence (the expected state is not in the report;
// compare these digests with a run of the reporting build at the same tick).
replay(report, { untilTick: d.tick, onEnd: (w) => { console.log(`state here at t=${d.tick}:`); for (const l of stateSummary(w)) console.log('  ' + l); } });
process.exit(1);
