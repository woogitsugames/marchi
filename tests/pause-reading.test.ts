// D-672 (owner 2026-11-11): a command applied in pause refreshes what cards and sheets read at once, while the sim
// stands. `pausedReading` takes the dispatcher's reading again on a copy; the real world keeps its tick and hash.
import { TICK_HZ, applyCommand, buildingById, createWorld, deserialize, pausedReading, serialize, stateHash, step, type World } from '../src/sim/index';
import { cureFor, gapSuggestion, rankStalls, sampleInputWaits, sharedOneCard } from '../src/ui/stalls';
import { memoryWorld, readingAfterCommand } from '../src/ui/readWorld';
import { run } from '../tools/sandbox-first30';
import { assert, eq, test } from './harness';

const statuses = (w: World): string => JSON.stringify(w.state.buildings.map((b) => [b.id, b.status]));

test('D-672: seed 1321 card-10 73:10 — the brewery\'s road built in pause: the card reads the new road at once', () => {
  let checked = false;
  run('card-10', { plan: null, eye: 10, events: false, game: true, onSecond: (w) => {
    // the look at 73:10 has just laid the road to the cut-off brewery; the game is "paused" here (no step yet)
    if (w.state.tick !== (73 * 60 + 10) * TICK_HZ) return;
    const brewery = buildingById(w, 2298)!;
    eq(brewery.type, 'brewery', 'the brewery of the backlog case');
    const stale = rankStalls(w)[0]!;
    // the old reading: a red "unreachable" card with nothing to press (the bug the reading copy fixes)
    eq(stale.id, brewery.id, 'the paused state still names the brewery');
    eq(brewery.status.k === 'NO_INPUT' && brewery.status.cause, 'UNREACHABLE', 'stale status');
    eq(cureFor(w, brewery.id), null, 'nothing to press');
    const hash = stateHash(w), tick = w.state.tick;
    const r = readingAfterCommand(w);
    eq(stateHash(w), hash, 'the real world is untouched');
    eq(w.state.tick, tick, 'no tick in pause');
    eq(r.state.tick, tick, 'the reading is at the same tick');
    eq(buildingById(r, 2298)!.status.k, 'WAITING_DELIVERY', 'the reading: malt on its way');
    const top = rankStalls(r)[0];
    assert(!top || top.id !== brewery.id, 'no red brewery card in the reading');
    assert(!top || top.minor || cureFor(r, top.id) !== null, 'the reading\'s red card has something to press');
    // the reading is what the next tick shows (73:10 is a dispatch tick)
    const next = deserialize(serialize(w));
    step(next);
    eq(statuses(r), statuses(next), 'same statuses as after the next tick');
    checked = true;
  } }, 1321, 73.2);
  assert(checked, 'reached 73:10');
});

test('D-672: a road built in pause (IV, cut-off granary) — reading copy, real world untouched, hash and replay unchanged', () => {
  const w = createWorld('m4');
  w.state.coins = 4000;
  const runTo = (sec: number): void => { while (w.state.tick < sec * TICK_HZ) { step(w); sampleInputWaits(w); } };
  runTo(90.5);
  assert(applyCommand(w, { t: 'demolish', cell: 3795 }).ok, 'artery cell taken back');
  runTo(120);
  // paused: lay the cell back
  const before = statuses(w);
  const wh = w.state.buildings.find((q) => q.type === 'warehouse')!;
  const s = gapSuggestion(w, wh.id);
  assert(!!s, 'the gap finder links the granary');
  assert(applyCommand(w, { t: 'road', surface: 1, cells: s!.cells }).ok, 'road in pause');
  const hash = stateHash(w);
  const r = pausedReading(w);
  eq(stateHash(w), hash, 'pausedReading leaves the world as it was');
  eq(statuses(w), before, 'the paused world keeps its old statuses (the sim did not step)');
  assert(statuses(r) !== before, 'the reading has taken the statuses again');
  // replay: the same commands without any reading give the same hash
  const a = deserialize(serialize(w)), b = deserialize(serialize(w));
  pausedReading(a); pausedReading(a);
  for (let i = 0; i < 30 * TICK_HZ; i++) { step(a); step(b); }
  eq(stateHash(a), stateHash(b), 'readings never reach the sim');
});

test('D-672: the reading copy shares the real world\'s UI memory (X: the 30 s shared card stays up)', () => {
  const w = createWorld('m10');
  let shown = -1;
  while (w.state.tick < 3 * 60 * TICK_HZ && shown < 0) {
    step(w); sampleInputWaits(w);
    if (w.state.tick % TICK_HZ) continue;
    for (const b of w.state.buildings) if (sharedOneCard(w, b)) shown = b.id;
  }
  assert(shown >= 0, 'the shared card came up');
  const r = readingAfterCommand(w);
  eq(memoryWorld(r), w, 'memory of the real world');
  const b = buildingById(r, shown)!;
  if (b.status.k === 'NO_INPUT' || b.status.k === 'WAITING_DELIVERY' || b.status.k === 'NO_WAGON' || b.status.k === 'WAGON_DUE') {
    assert(!!sharedOneCard(r, b), 'the input wait log is read through the copy');
  }
  eq(memoryWorld(w), w, 'a real world is its own memory');
});
