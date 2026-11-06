// D-235: the free-valley build tutorial's step logic, headless, on a real free valley. The UI only gathers
// observations; these tests drive nextBuildStep with what the World says (hut placed, road joined) and with the
// card-side observations a player produces (picking, card open, diagnosis opened).
import { applyCommand, createWorld, step, suggestConnection, validatePlace, type World } from '../src/sim/index';
import { STALL_WAIT_MS, hutConnected, hutIds, hutStalled, newHut, nextBuildStep, type BuildObs, type BuildStep } from '../src/ui/tutorialBuildSteps';
import { assert, eq, test } from './harness';

const base: BuildObs = { hut: null, picking: false, connected: false, hutOpen: false, sheetOpen: false, stalled: false, whyShown: false, whyOpened: false, whyDone: false, since: 0 };
const o = (p: Partial<BuildObs>): BuildObs => ({ ...base, ...p });

/** A legal woodcutter site in the northern forest that is not already on a road (the gate needs a new track). */
function placeHut(w: World): { x: number; y: number } {
  for (let y = 4; y < 20; y++) for (let x = 22; x < 44; x++) {
    if (!validatePlace(w, 'woodcutter', x, y, 0).ok) continue;
    const r = applyCommand(w, { t: 'place', type: 'woodcutter', x, y, facing: 0 });
    if (!r.ok) continue;
    const hut = w.state.buildings[w.state.buildings.length - 1]!;
    if (!hutConnected(w, hut)) return { x, y };
    applyCommand(w, { t: 'demolish', cell: y * w.terrain.w + x });
  }
  throw new Error('no free woodcutter site');
}

test('build tutorial: the offer waits for "Show me"; picking, placing and the road advance by state', () => {
  eq(nextBuildStep(0, o({ hut: 7, connected: true })), 0, 'the offer never advances by itself');
  eq(nextBuildStep(1, o({})), 1, 'nothing picked');
  eq(nextBuildStep(1, o({ picking: true })), 2, 'woodcutter picked -> place it');
  eq(nextBuildStep(2, o({})), 1, 'build tool put away before placing -> pick again');
  eq(nextBuildStep(2, o({ hut: 7 })), 7, 'placed cut off -> watch it stall');
  eq(nextBuildStep(2, o({ hut: 7, whyDone: true })), 3, 'diagnosis already read -> road');
  eq(nextBuildStep(3, o({ hut: 7, connected: true })), 4, 'joined -> open its card');
  eq(nextBuildStep(4, o({ hut: 7, connected: true, hutOpen: true, sheetOpen: true })), 5, 'card open -> why');
  eq(nextBuildStep(4, o({ hut: 7, connected: true, hutOpen: true, sheetOpen: true, whyDone: true })), 6, 'why already read -> coda');
});

test('build tutorial: early actions skip ahead, a removed hut never leaves a dead step', () => {
  eq(nextBuildStep(1, o({ hut: 7 })), 7, 'placed before the note asked (cut off: watch it stall)');
  eq(nextBuildStep(1, o({ hut: 7, connected: true })), 4, 'placed on a road (or joined already)');
  for (const s of [3, 4, 5, 7] as BuildStep[]) eq(nextBuildStep(s, o({ hut: null })), 1, `hut gone at step ${s} -> pick again`);
  eq(nextBuildStep(4, o({ hut: 7, connected: false })), 3, 'road removed -> road again');
});

test('build tutorial (D-259): the cut-off hut stalls for real, its cause is read, then the road', () => {
  const cut = { hut: 7, connected: false, hutOpen: true, sheetOpen: true };
  eq(nextBuildStep(7, o({ ...cut, since: 5000 })), 7, 'working, yard filling: wait (×4 ringed)');
  eq(nextBuildStep(7, o({ ...cut, stalled: true, whyShown: true })), 5, 'stalled, card open -> why');
  eq(nextBuildStep(7, o({ ...cut, hutOpen: false, sheetOpen: false, stalled: true })), 3, 'stalled, card closed -> road');
  eq(nextBuildStep(7, o({ ...cut, since: STALL_WAIT_MS + 1 })), 3, 'never sped up -> road after the wait');
  eq(nextBuildStep(7, o({ ...cut, connected: true })), 4, 'joined early -> open its card');
  const st = { ...cut, stalled: true, whyShown: true };
  eq(nextBuildStep(3, o(st)), 5, 'card reopened at the road step, still unread -> why');
  eq(nextBuildStep(5, o({ ...st, since: 9000 })), 5, 'wait for the player');
  eq(nextBuildStep(5, o({ ...st, whyOpened: true })), 3, 'read -> join it');
  eq(nextBuildStep(5, o({ ...st, hutOpen: false })), 3, 'card closed -> road');
  eq(nextBuildStep(5, o({ ...st, whyShown: false, since: 2000 })), 3, 'no way in -> road');
  eq(nextBuildStep(5, o({ ...st, connected: true, whyOpened: true })), 6, 'joined while reading -> coda');
  eq(nextBuildStep(3, o({ ...st, whyDone: true })), 3, 'never asked twice');
  eq(nextBuildStep(4, o({ ...st, connected: true, whyDone: true })), 6, 'after the road: straight to the coda');
});

test('build tutorial (D-259) on a real valley: a cut-off hut stalls within 80 s of game time', () => {
  const w = createWorld('sandbox');
  const baseline = hutIds(w);
  placeHut(w);
  const hut = newHut(w, baseline)!;
  let at = -1;
  for (let i = 0; i < 1200 && at < 0; i++) { step(w); if (hutStalled(hut)) at = i; }
  assert(at > 0 && at <= 900, `stalled at tick ${at}`);
  eq(hut.status.k, 'NO_ROAD', 'the cause is the missing road');
});

test('build tutorial: "why" only when the hut stalls; the coda ends on close or by time', () => {
  const card = { hut: 7, connected: true, hutOpen: true, sheetOpen: true };
  eq(nextBuildStep(5, o({ ...card, stalled: false })), 6, 'hut at work: no why step');
  eq(nextBuildStep(5, o({ ...card, stalled: true, whyShown: true, since: 9000 })), 5, 'stalled with a way in: wait for the player');
  eq(nextBuildStep(5, o({ ...card, stalled: true, whyShown: false, since: 2000 })), 6, 'no link on the card: pass over');
  eq(nextBuildStep(5, o({ ...card, stalled: true, whyShown: true, whyOpened: true })), 6, 'diagnosis opened');
  eq(nextBuildStep(5, o({ ...card, hutOpen: false, sheetOpen: false, stalled: true })), 6, 'card closed');
  eq(nextBuildStep(6, o({ ...card, since: 1000 })), 6, 'coda shown');
  eq(nextBuildStep(6, o({ ...card, sheetOpen: false, since: 3000 })), 'done', 'card closed after reading');
  eq(nextBuildStep(6, o({ ...card, since: 13_000 })), 'done', 'time');
});

test('build tutorial on a real free valley: new hut found, a route by any road counts', () => {
  const w = createWorld('sandbox');
  const baseline = hutIds(w);
  assert(baseline.length >= 1, 'the valley starts with a woodcutter');
  eq(newHut(w, baseline), null, 'the starting hut is not "new"');
  placeHut(w);
  const hut = newHut(w, baseline);
  assert(hut, 'the placed hut is found');
  assert(!hutConnected(w, hut), 'not joined yet');
  eq(nextBuildStep(1, o({ hut: hut.id, connected: false })), 7, 'cut off: watch it stall first (D-259)');
  eq(nextBuildStep(1, o({ hut: hut.id, connected: false, whyDone: true })), 3, 'then the road');
  // join it the way a player might: the cheapest track to the old woodcutter's road (not the castle itself)
  const old = w.state.buildings.find((b) => b.id === baseline[0])!;
  const s = suggestConnection(w, hut.gate, old.gate);
  assert(s, 'a route exists');
  const r = applyCommand(w, { t: 'road', surface: 1, cells: s.cells });
  assert(r.ok, `road: ${!r.ok ? r.err.k : ''}`);
  for (let i = 0; i < 10; i++) step(w);
  assert(hutConnected(w, hut), 'joined through the existing network counts');
  // demolish (undo) -> the tutorial asks to pick again
  applyCommand(w, { t: 'demolish', cell: hut.y * w.terrain.w + hut.x });
  eq(newHut(w, baseline), null, 'demolished hut is gone');
});
