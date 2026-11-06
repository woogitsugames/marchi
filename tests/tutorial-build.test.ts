// D-235: the free-valley build tutorial's step logic, headless, on a real free valley. The UI only gathers
// observations; these tests drive nextBuildStep with what the World says (hut placed, road joined) and with the
// card-side observations a player produces (picking, card open, diagnosis opened).
import { applyCommand, createWorld, step, suggestConnection, validatePlace, type World } from '../src/sim/index';
import { hutConnected, hutIds, newHut, nextBuildStep, type BuildObs, type BuildStep } from '../src/ui/tutorialBuildSteps';
import { assert, eq, test } from './harness';

const base: BuildObs = { hut: null, picking: false, connected: false, hutOpen: false, sheetOpen: false, stalled: false, whyShown: false, whyOpened: false, since: 0 };
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
  eq(nextBuildStep(2, o({ hut: 7 })), 3, 'placed -> road');
  eq(nextBuildStep(3, o({ hut: 7, connected: true })), 4, 'joined -> open its card');
  eq(nextBuildStep(4, o({ hut: 7, connected: true, hutOpen: true, sheetOpen: true })), 5, 'card open -> why');
});

test('build tutorial: early actions skip ahead, a removed hut never leaves a dead step', () => {
  eq(nextBuildStep(1, o({ hut: 7 })), 3, 'placed before the note asked');
  eq(nextBuildStep(1, o({ hut: 7, connected: true })), 4, 'placed on a road (or joined already)');
  for (const s of [3, 4, 5] as BuildStep[]) eq(nextBuildStep(s, o({ hut: null })), 1, `hut gone at step ${s} -> pick again`);
  eq(nextBuildStep(4, o({ hut: 7, connected: false })), 3, 'road removed -> road again');
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
  eq(nextBuildStep(1, o({ hut: hut.id, connected: false })), 3, 'step 3 asks for the road');
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
