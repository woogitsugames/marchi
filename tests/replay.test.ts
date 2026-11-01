import { GameLoop } from '../src/game/loop';
import { decodeReportText, encodeReportText, CODEC_PREFIX } from '../src/platform/reportCodec';
import { createWorld, MISSIONS, type Command, type CommandResult, type World } from '../src/sim/index';
import {
  buildReport, cleanCommand, createRecorder, parseReport, parseReportText, recordTick, replay, REPORT_LIMITS,
  type ReplayReport,
} from '../src/sim/replay';
import { bridgeA, bridgeB, polyline, stableId } from '../tools/bot';
import { assert, eq, test } from './harness';

interface Session { report: ReplayReport; results: { tick: number; cmd: Command; r: CommandResult }[] }

/** m1 plan: bridge, wagons, a second crossing right before the 600 checkpoint, a short road, a demolish. */
function m1Plan(w: World): { tick: number; cmd: Command }[] {
  return [
    { tick: 0, cmd: bridgeA(w) },
    { tick: 5, cmd: { t: 'buyWagon', stable: stableId(w) } },
    { tick: 400, cmd: { t: 'buyWagon', stable: stableId(w) } },
    { tick: 590, cmd: bridgeB(w) },
    { tick: 1000, cmd: { t: 'road', surface: 1, cells: polyline(w, [[30, 30], [34, 30]]) } },
    { tick: 1500, cmd: { t: 'demolish', cell: 30 * w.terrain.w + 34 } },
  ];
}

/** Drive the real GameLoop (journal + onTick) the way the app does, then build the report. */
function record(missionId: string, plan: (w: World) => { tick: number; cmd: Command }[], ticks: number, paused?: (w: World) => Command): Session {
  const w = createWorld(missionId);
  const loop = new GameLoop(w);
  const rec = createRecorder(w);
  const results: Session['results'] = [];
  loop.onTick = () => recordTick(rec, w);
  loop.onCommandResult = (cmd, r) => results.push({ tick: w.state.tick, cmd, r });
  for (const c of plan(w)) loop.schedule(c.tick, c.cmd);
  while (w.state.tick < ticks) loop.tickOnce();
  if (paused) { loop.speed = 0; loop.enqueue(paused(w)); loop.advance(16); }
  const built = buildReport(rec, loop.journal, w, '0.1.0');
  if (!built.ok) throw new Error('buildReport failed: ' + built.errors.join('; '));
  return { report: built.value, results };
}

let cached: Session | null = null;
function m1Session(): Session {
  cached ??= record('m1', m1Plan, 3000, (w) => ({ t: 'road', surface: 1, cells: polyline(w, [[30, 32], [33, 32]]) }));
  return cached;
}

const clone = (r: ReplayReport): ReplayReport => JSON.parse(JSON.stringify(r)) as ReplayReport;
const firstCpAfter = (r: ReplayReport, tick: number): number => r.checkpoints.find((c) => c.tick > tick)!.tick;

test('m1 session: every scripted command succeeds and the report has checkpoints every 600 ticks', () => {
  const { report, results } = m1Session();
  for (const x of results) assert(x.r.ok, `command ${x.cmd.t} at ${x.tick} failed: ${JSON.stringify(x.r)}`);
  eq(report.journal.length, 7, 'journal length');
  eq(report.checkpoints.map((c) => c.tick).join(','), '0,600,1200,1800,2400,3000', 'checkpoint ticks');
  eq(report.finalTick, 3000, 'finalTick');
  eq(report.journal[6]!.tick, 3000, 'paused command journaled at finalTick');
});

test('replay of a JSON roundtrip reproduces every checkpoint and the final hash', () => {
  const { report } = m1Session();
  const parsed = parseReportText(JSON.stringify(report));
  assert(parsed.ok, 'parse');
  const res = replay(parsed.value);
  assert(res.ok, 'replay ok: ' + JSON.stringify(res.firstDivergence));
  eq(res.finalHash, report.finalHash, 'final hash');
  eq(res.checkpoints.length, report.checkpoints.length, 'checkpoints compared');
  assert(res.checkpoints.every((c) => c.ok), 'all checkpoints ok');
});

test('codec roundtrip (deflate-raw + base64url) and plain-JSON passthrough', async () => {
  const { report } = m1Session();
  const json = JSON.stringify(report);
  const enc = await encodeReportText(json);
  assert(enc.startsWith(CODEC_PREFIX), 'compressed form in Node');
  assert(/^MR1\.[A-Za-z0-9_-]+$/.test(enc), 'base64url charset');
  assert(enc.length < json.length, `compressed smaller (${enc.length} vs ${json.length})`);
  const dec = await decodeReportText(enc);
  assert(dec.ok && dec.json === json, 'decode equals');
  const res = replay((parseReportText(dec.ok ? dec.json : '') as { ok: true; value: ReplayReport }).value);
  assert(res.ok, 'replay after codec');
  const plain = await decodeReportText('  ' + json + '\n');
  assert(plain.ok && plain.json === json, 'plain JSON accepted');
  for (const bad of ['', 'hello', 'MR1.@@@', 'MR1.A', 'MR1.' + 'A'.repeat(64)]) {
    const d = await decodeReportText(bad);
    assert(!d.ok, `garbage rejected: ${bad.slice(0, 12)}`);
  }
});

test('tampered reports diverge at the right checkpoint', () => {
  const base = m1Session().report;
  // changed seed -> already the initial state differs
  let r = clone(base); r.seed = base.seed + 1;
  eq(replay(r).firstDivergence?.tick, 0, 'seed');
  // changed road cell (tick 1000) -> the path is no longer contiguous, the command fails
  r = clone(base);
  const road = r.journal.find((e) => e.tick === 1000)!.cmd as Extract<Command, { t: 'road' }>;
  road.cells[2] = road.cells[2]! + 2 * 96;
  eq(replay(r).firstDivergence?.tick, firstCpAfter(base, 1000), 'changed cell');
  // shifted tick across a checkpoint (590 -> 610) -> visible at 600
  r = clone(base);
  r.journal.find((e) => e.tick === 590)!.tick = 610;
  eq(replay(r).firstDivergence?.tick, 600, 'shifted tick');
  // removed command (wagon bought at 400)
  r = clone(base);
  r.journal = r.journal.filter((e) => e.tick !== 400);
  eq(replay(r).firstDivergence?.tick, firstCpAfter(base, 400), 'removed command');
  // removed paused command at finalTick -> only finalHash can catch it
  r = clone(base);
  r.journal.pop();
  const res = replay(r);
  eq(res.firstDivergence?.tick, base.finalTick, 'final paused command');
  assert(res.checkpoints.every((c) => c.ok) && !res.finalOk, 'checkpoints ok, final mismatch');
  // stopAtFirst ends early
  r = clone(base); r.seed = 7;
  eq(replay(r, { stopAtFirst: true }).checkpoints.length, 1, 'stopAtFirst');
});

test('replay refuses unknown mission and other state versions without throwing', () => {
  const base = m1Session().report;
  let r = clone(base); r.missionId = 'nope';
  assert(replay(r).error !== null && !replay(r).ok, 'unknown mission');
  r = clone(base); r.stateVersion = base.stateVersion + 1;
  assert(replay(r).error !== null, 'state version');
});

test('parseReport rejects hostile input and never throws', () => {
  const base = m1Session().report;
  const bad: unknown[] = [
    null, 42, 'x', [], { ...base, extra: 1 }, { ...base, version: 2 }, { ...base, seed: '1' }, { ...base, seed: 1.5 },
    { ...base, game: 'Jan Kowalski <jan@example.com>' }, { ...base, missionId: '../../etc' },
    { ...base, finalTick: -1 }, { ...base, finalTick: REPORT_LIMITS.finalTick + 1 }, { ...base, finalHash: 'zz' },
    { ...base, journal: {} }, { ...base, checkpoints: 'a' },
    { ...base, journal: new Array(REPORT_LIMITS.journal + 1).fill({ tick: 0, cmd: { t: 'demolish', cell: 1 } }) },
    { ...base, checkpoints: new Array(REPORT_LIMITS.checkpoints + 1).fill({ tick: 0, hash: '0'.repeat(16) }) },
    { ...base, journal: [{ tick: 0, cmd: { t: 'demolish', cell: 1, name: 'Jan' } }] },
    { ...base, journal: [{ tick: 0, cmd: { t: 'demolish', cell: 1 }, device: 'Pixel' }] },
    { ...base, journal: [{ tick: 0, cmd: { t: 'demolish', cell: '1' } }] },
    { ...base, journal: [{ tick: 0, cmd: { t: 'demolish', cell: -1 } }] },
    { ...base, journal: [{ tick: 0, cmd: { t: 'demolish' } }] },
    { ...base, journal: [{ tick: 0, cmd: { t: 'eval', code: 'x' } }] },
    { ...base, journal: [{ tick: 0, cmd: { t: 'toString' } }] },
    { ...base, journal: [{ tick: 0, cmd: { t: 'place', type: 'tavern', x: 1, y: 1, facing: 0 } }] },
    { ...base, journal: [{ tick: 0, cmd: { t: 'place', type: 'farm', x: 1, y: 1, facing: 4 } }] },
    { ...base, journal: [{ tick: 0, cmd: { t: 'road', surface: 3, cells: [1, 2] } }] },
    { ...base, journal: [{ tick: 0, cmd: { t: 'road', surface: 1, cells: [] } }] },
    { ...base, journal: [{ tick: 0, cmd: { t: 'road', surface: 1, cells: new Array(REPORT_LIMITS.roadCells + 1).fill(1) } }] },
    { ...base, journal: [{ tick: 0, cmd: { t: 'road', surface: 1, cells: [1, 'a'] } }] },
    { ...base, journal: [{ tick: 9, cmd: { t: 'demolish', cell: 1 } }, { tick: 3, cmd: { t: 'demolish', cell: 1 } }] },
    { ...base, journal: [{ tick: base.finalTick + 1, cmd: { t: 'demolish', cell: 1 } }] },
    { ...base, checkpoints: [{ tick: 5, hash: '0'.repeat(16) }, { tick: 5, hash: '0'.repeat(16) }] },
    { ...base, checkpoints: [{ tick: 0, hash: '0'.repeat(16), note: 'hi' }] },
  ];
  for (let i = 0; i < bad.length; i++) {
    const r = parseReport(bad[i]);
    assert(!r.ok, `hostile input #${i} accepted`);
  }
  for (const text of ['', '{', '{"__proto__":{"x":1}}', 'null', 'x'.repeat(REPORT_LIMITS.textBytes + 1)]) {
    assert(!parseReportText(text).ok, `text rejected: ${text.slice(0, 20)}`);
  }
  // __proto__ given as an own JSON key must count as an unknown key
  assert(!parseReportText(JSON.stringify(base).replace('{', '{"__proto__":{},')).ok, '__proto__ key');
  assert(parseReport(clone(base)).ok, 'clean report still parses');
});

test('allowlist: extra command fields never reach the report', () => {
  const w = createWorld('m1');
  const loop = new GameLoop(w);
  const rec = createRecorder(w);
  loop.onTick = () => recordTick(rec, w);
  const dirty = { t: 'buyWagon', stable: stableId(w), name: 'Jan Kowalski', device: 'Pixel 9', note: 'free text' };
  loop.schedule(0, dirty as unknown as Command);
  for (let i = 0; i < 20; i++) loop.tickOnce();
  const built = buildReport(rec, loop.journal, w, 'Jan\'s phone');
  assert(built.ok, 'report built');
  const text = JSON.stringify(built.value);
  for (const s of ['Jan', 'Pixel', 'free text', 'name', 'device', 'note']) assert(!text.includes(s), `leaked "${s}"`);
  eq(built.value.game, 'unknown', 'invalid game string replaced');
  eq(JSON.stringify(built.value.journal[0]!.cmd), JSON.stringify({ t: 'buyWagon', stable: stableId(w) }), 'clean cmd');
  assert(replay(built.value).ok, 'stripped report still replays');
  // strict mode (parser) rejects the same object
  assert(!cleanCommand(dirty, true).ok, 'strict rejects extra keys');
  // a malformed cmd makes buildReport fail instead of emitting it
  const bad = buildReport(rec, [{ tick: 0, cmd: { t: 'demolish', cell: 'x' } as unknown as Command }], w, '0.1.0');
  assert(!bad.ok, 'malformed journal entry refused');
});

test('report from a session loaded mid-game is refused (not replayable from tick 0)', () => {
  const w = createWorld('m1');
  for (let i = 0; i < 10; i++) { w.state.tick++; }
  const rec = createRecorder(w);
  assert(!buildReport(rec, [], w, '0.1.0').ok, 'refused');
});

for (const id of ['m2', 'm3', 'm4', 'm5', 'm6']) {
  if (!MISSIONS[id]) continue;
  test(`${id}: recorded session replays identically, tampering is detected`, () => {
    const plan = (w: World) => {
      const stable = w.state.buildings.find((b) => b.type === 'stable');
      const cmds: { tick: number; cmd: Command }[] = [];
      if (stable) { cmds.push({ tick: 3, cmd: { t: 'buyWagon', stable: stable.id } }); cmds.push({ tick: 700, cmd: { t: 'buyWagon', stable: stable.id } }); }
      cmds.push({ tick: 650, cmd: { t: 'demolish', cell: 0 } });
      return cmds;
    };
    const { report } = record(id, plan, 1500);
    const parsed = parseReportText(JSON.stringify(report));
    assert(parsed.ok, `${id} report parses`);
    const res = replay(parsed.value);
    assert(res.ok, `${id} replay ok`);
    const r = clone(report); r.seed = report.seed + 1;
    assert(!replay(r).ok, `${id} seed tamper detected`);
  });
}
