// D-185: the ?fixture= playtest setups (src/game/fixtures.ts) reach their stall by playing the real sim from the
// mission start: one test per fixture checks the status the protocol's preflight needs, the invariants, and that
// the run is the same every time (stop tick + state hash), also through the app's GameLoop path.
import { GameLoop } from '../src/game/loop';
import { FIXTURE_IDS, FIXTURE_VERSION, checkFixture, fixtureMission, runFixture, simDriver, type FixtureId } from '../src/game/fixtures';
import { applyCommand, checkInvariants, createWorld, hashState, unexplainedStalls, type World } from '../src/sim/index';
import { deadEnd } from '../src/ui/deadEnd';
import { calmWhy, rankStalls } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

/**
 * What docs/playtest/PROTOCOL.md §3 tells the moderator (stop time, wagonId/openId of the subject). A sim change
 * that moves these must update that table and bump FIXTURE_VERSION, so results of different setups never mix.
 */
const DOCUMENTED: Record<FixtureId, { tick: number; kind: 'building' | 'wagon'; id: number }> = {
  'bridge-cut-in-transit': { tick: 394, kind: 'wagon', id: 12 },
  'all-busy': { tick: 1595, kind: 'building', id: 9 },
  'bridge-jam': { tick: 982, kind: 'wagon', id: 11 },
  'warehouse-full': { tick: 1310, kind: 'building', id: 4 },
};

function build(id: FixtureId): { w: World; out: ReturnType<typeof runFixture> } {
  const w = createWorld(fixtureMission(id));
  return { w, out: runFixture(id, simDriver(w)) };
}

/** The app's path: commands into the loop's journal, ticks through GameLoop.tickOnce. */
function buildViaLoop(id: FixtureId): { w: World; journal: GameLoop['journal'] } {
  const w = createWorld(fixtureMission(id));
  const loop = new GameLoop(w);
  runFixture(id, {
    world: () => w,
    command: (cmd) => { const r = applyCommand(w, cmd); loop.journal.push({ tick: w.state.tick, cmd }); return r; },
    tick: () => loop.tickOnce(),
  });
  return { w, journal: loop.journal };
}

function common(id: FixtureId): World {
  const { w, out } = build(id);
  assert(out.ok, `${id} invalid: ${out.problem}`);
  eq(out.version, FIXTURE_VERSION, 'version');
  eq(w.state.mission.id, fixtureMission(id), 'mission');
  eq(w.state.mission.result, 'running', 'mission still running');
  eq(checkInvariants(w).join('; '), '', 'invariants');
  eq(unexplainedStalls(w).join('; '), '', 'every stall explained');
  eq(deadEnd(w), null, 'no dead-end letter');
  // deterministic: a second run stops at the same tick with the same state, and so does the app's loop path
  const again = build(id);
  eq(again.out.tick, out.tick, 'same stop tick');
  eq(hashState(again.w.state), hashState(w.state), 'same state hash');
  const viaLoop = buildViaLoop(id);
  eq(hashState(viaLoop.w.state), hashState(w.state), 'GameLoop path, same hash');
  // the journal replays: same commands at the same ticks on a fresh world give the same state
  const r = createWorld(fixtureMission(id));
  const replay = new GameLoop(r);
  for (const tc of viaLoop.journal) replay.schedule(tc.tick, tc.cmd);
  while (r.state.tick < out.tick) replay.tickOnce();
  eq(hashState(r.state), hashState(w.state), 'journal replay, same hash');
  const doc = DOCUMENTED[id];
  eq(`${out.tick} ${out.focus?.kind} ${out.focus?.id}`, `${doc.tick} ${doc.kind} ${doc.id}`, 'documented in PROTOCOL.md (update it and FIXTURE_VERSION)');
  console.log(`     ${id}: ${(out.tick / 10).toFixed(1)} s, focus ${out.focus?.kind} ${out.focus?.id}, hash ${hashState(w.state)}`);
  return w;
}

test('fixture bridge-cut-in-transit: a loaded wagon stands in NO_ROUTE before the cut bridge', () => {
  const w = common('bridge-cut-in-transit');
  const { out } = build('bridge-cut-in-transit');
  const q = w.state.wagons.find((o) => o.id === out.focus!.id)!;
  eq(q.status.k, 'NO_ROUTE', 'wagon status');
  assert(q.job && q.cargoQty > 0, 'carries cargo on a job');
  // exactly one bridge cell is gone on the x = 51 crossing
  const W = w.terrain.w;
  let cut = 0;
  for (let y = 30; y <= 42; y++) if (w.terrain.water[y * W + 51] === 1 && w.state.roads[y * W + 51] === 0) cut++;
  eq(cut, 1, 'one bridge cell demolished');
});

test('fixture all-busy: a workshop waits NO_WAGON/ALL_BUSY for a reachable input', () => {
  const w = common('all-busy');
  const { out } = build('all-busy');
  const b = w.state.buildings.find((o) => o.id === out.focus!.id)!;
  eq(b.status.k, 'NO_WAGON', 'status');
  eq((b.status as { cause: string }).cause, 'ALL_BUSY', 'cause');
  assert(w.state.wagons.every((q) => q.job), 'every wagon has a job');
  eq(w.state.wagons.length, 7, 'the dealt fleet, no wagon sold');
});

test('fixture bridge-jam: a wagon queues at the wooden bridge behind a real blocker', () => {
  const w = common('bridge-jam');
  const { out } = build('bridge-jam');
  const q = w.state.wagons.find((o) => o.id === out.focus!.id)!;
  eq(q.status.k, 'BRIDGE_JAM', 'status');
  const s = q.status as { blocker: number; since: number };
  assert(w.state.wagons.some((o) => o.id === s.blocker), 'blocker exists');
  assert(w.state.tick - s.since >= 20, 'queued at least 2 s');
});

test('fixture warehouse-full: mission VI small granary STORAGE_FULL 12/12 by itself, the worst-stall card names it', () => {
  const w = common('warehouse-full');
  const { out } = build('warehouse-full');
  const b = w.state.buildings.find((o) => o.id === out.focus!.id)!;
  eq(b.type, 'warehouse', 'subject');
  eq(b.capOverride, 12, 'the small granary');
  eq(b.status.k, 'STORAGE_FULL', 'status');
  const stock = Object.values(b.stock).reduce((a, x) => a + x, 0);
  eq(stock, 12, 'its own stock fills it');
  eq(calmWhy(w, b), null, 'a real stall, not a calm full');
  // D-197: no commands at all, no road cut: mission VI as dealt
  eq(w.state.wagons.length, 10, 'the dealt fleet');
  const W = w.terrain.w;
  const fresh = createWorld('m6');
  let changed = 0;
  for (let c = 0; c < W * w.terrain.h; c++) if (fresh.state.roads[c] !== w.state.roads[c]) changed++;
  eq(changed, 0, 'roads as dealt');
  // the cause chain: the sawmill's full yard waits for this granary, and the HUD's worst-stall card is the granary
  const saw = w.state.buildings.find((o) => o.type === 'sawmill')!;
  eq(saw.status.k, 'OUTPUT_FULL', 'sawmill yard full');
  eq((saw.status as { blockedBy: number }).blockedBy, b.id, 'sawmill blocked by the small granary');
  const top = rankStalls(w)[0]!;
  eq(top.id, b.id, 'worst-stall card');
  assert(top.crit && !top.minor, 'a critical card');
  // the first letter (24 bread by 06:00) is still open: the full store hurts now
  eq(w.state.mission.contract!.tranches![0]!.doneTick, -1, 'first letter open');
});

test('fixture checks: a fresh mission fails every check (no false preflight)', () => {
  for (const id of FIXTURE_IDS) {
    const w = createWorld(fixtureMission(id));
    assert(checkFixture(id, w, null) !== null, `${id}: fresh world must not pass`);
    const b = w.state.buildings[0]!;
    assert(checkFixture(id, w, { kind: 'building', id: b.id }) !== null, `${id}: fresh building must not pass`);
    assert(checkFixture(id, w, { kind: 'wagon', id: w.state.wagons[0]!.id }) !== null, `${id}: fresh wagon must not pass`);
  }
});
