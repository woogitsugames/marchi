import { applyCommand, createWorld, lineCells, step, stars, checkInvariants, type Command, type World } from '../src/sim/index';
import { assert, eq, test } from './harness';

const col = (w: World, x: number, y1: number, y2: number) => lineCells(w.terrain.w, y1 * w.terrain.w + x, y2 * w.terrain.w + x);
const row = (w: World, y: number, x1: number, x2: number) => lineCells(w.terrain.w, y * w.terrain.w + x1, y * w.terrain.w + x2);

function play(id: string, at: number, cmds: (w: World) => Command[]): World {
  const w = createWorld(id);
  while (w.state.mission.result === 'running') {
    if (w.state.tick === at) for (const c of cmds(w)) assert(applyCommand(w, c).ok, `${id}: command ${c.t} failed`);
    step(w);
    if (w.state.tick % 50 === 0) { const v = checkInvariants(w); assert(v.length === 0, v.join('; ')); }
  }
  return w;
}

test('mission 2: the bridge is the lesson (no action = 1 seal, stone bridge = 3 seals)', () => {
  eq(stars(play('m2', 0, () => [])), 1, 'seals without fixing the bridge');
  const fixed = play('m2', 450, (w) => [{ t: 'road', surface: 2, cells: col(w, 51, 30, 42) }]);
  eq(fixed.state.mission.result, 'won', 'won with stone bridge');
  assert(stars(fixed) >= 2, 'stone bridge earns at least 2 seals');
});

test('mission 3: rain is in the data and cobbles are the fix', () => {
  const w0 = createWorld('m3');
  assert(w0.state.rain.length === 1 && w0.state.rain[0]!.end - w0.state.rain[0]!.start > 6000, 'long rain spell');
  eq(stars(play('m3', 0, () => [])), 1, 'seals without paving');
  const paved = play('m3', 250, (w) => [{ t: 'road', surface: 2, cells: row(w, 40, 32, 80) }]);
  assert(stars(paved) >= 2, 'paving earns at least 2 seals');
});

// --- Missions IV-VI (session 2). Seal ladders come from tools/balance.ts (expect fields). ---
import { plans, runStrategy } from '../tools/balance';

for (const id of ['m4', 'm5', 'm6']) {
  test(`mission ${id.slice(1)}: no action = 1 seal, partial fix = 2, the lesson's fix = 3 (5-12 min)`, () => {
    for (const s of plans[id]!.filter((p) => p.expect !== undefined)) {
      const r = runStrategy(id, s);
      eq(r.errors.length, 0, `${id} ${s.name}: commands accepted (${r.errors.join(',')})`);
      eq(r.result, 'won', `${id} ${s.name}: won`);
      eq(r.seals, s.expect!, `${id} ${s.name}: seals`);
      assert(r.minutes >= 5 && r.minutes <= 12, `${id} ${s.name}: ${r.minutes.toFixed(2)} min within 5-12`);
    }
  });
}

test('mission 4: the ice closes the wooden bridge, wagons wait with BRIDGE_CLOSED and keep their jobs', () => {
  const w = createWorld('m4');
  const ice = w.state.ice[0]!;
  let closedSeen = 0, jobsKept = true;
  while (w.state.tick < ice.end + 600) {
    step(w);
    for (const q of w.state.wagons) {
      if (q.status.k !== 'BRIDGE_CLOSED') continue;
      closedSeen++;
      assert(w.state.tick >= ice.start && w.state.tick < ice.end + 1, `closed only inside the window (tick ${w.state.tick})`);
      eq(q.status.until, ice.end, 'until = thaw tick');
      if (q.cargoQty > 0 && !q.job) jobsKept = false;
    }
    if (w.state.tick % 25 === 0) {
      const v = checkInvariants(w);
      assert(v.length === 0, v.join('; '));
    }
  }
  assert(closedSeen > 0, 'some wagon waited at the iced bridge');
  assert(jobsKept, 'loaded wagons keep their jobs');
  assert(!w.state.wagons.some((q) => q.status.k === 'BRIDGE_CLOSED'), 'all moving again after the thaw');
});
