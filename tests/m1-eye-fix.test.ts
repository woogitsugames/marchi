// first-10-minutes-b, item 5: can a new player finish mission I only by tapping the worst-stall card and
// then the sheet's fix button? Headless mirror of what buildingSheet offers (src/ui/panels.ts): the road /
// bridge fix when the chain's root is a missing link, otherwise the cure for the sheet's own building.
// Read-only use of the UI helpers; commands go through applyCommand like the app's enqueue.
import { TICK_HZ, applyCommand, buildingById, createWorld, explainBuilding, step, suggestLinkToStable, type World } from '../src/sim/index';
import { isStall } from '../src/ui/stallKinds';
import { cureFor, gapTarget, rankStalls } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

/** One "eye -> Naprawa" tap pair on the worst stall; returns what the fix did ('' when the sheet had none). */
function eyeFix(w: World): string {
  const top = rankStalls(w)[0];
  if (!top) return '';
  const b = buildingById(w, top.id)!;
  const chain = explainBuilding(w, b.id, 5, true);
  const target = gapTarget(w, chain.length ? chain : [{ kind: 'building', id: b.id, status: b.status }]);
  if (target >= 0) {
    const s = suggestLinkToStable(w, target);
    return s && applyCommand(w, { t: 'road', surface: 1, cells: s.cells }).ok ? 'road' : '';
  }
  if (!(isStall(b.status) || b.status.k === 'NO_INPUT')) return '';
  if (cureFor(w, b.id) !== 'wagon') return '';
  const stable = w.state.buildings.find((q) => q.type === 'stable')!;
  return applyCommand(w, { t: 'buyWagon', stable: stable.id }).ok ? 'wagon' : '';
}

function play(reactSec: number): { result: string; min: number; fixes: Record<string, number> } {
  const w = createWorld('m1');
  const fixes: Record<string, number> = { road: 0, wagon: 0 };
  while (w.state.mission.result === 'running') {
    step(w);
    if (w.state.tick % (reactSec * TICK_HZ) === 0) {
      const f = eyeFix(w);
      if (f) fixes[f]!++;
    }
  }
  return { result: w.state.mission.result, min: w.state.tick / TICK_HZ / 60, fixes };
}

test('m1: the "eye -> Naprawa" path alone wins mission I (a tap pair every 10 s or 30 s)', () => {
  for (const react of [10, 30]) {
    const r = play(react);
    eq(r.result, 'won', `react ${react} s: won (${r.min.toFixed(2)} min, fixes ${JSON.stringify(r.fixes)})`);
    assert(r.fixes.road! >= 1, 'the first fix is the missing crossing');
    assert(r.fixes.wagon! >= 3, `wagons bought from the sheet (${r.fixes.wagon})`);
  }
});
