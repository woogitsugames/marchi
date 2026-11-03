// Regression (review F-02): read-only helpers called between ticks (the UI asks for wagon ETAs every
// frame) must not change what the next step() computes. wagonEta -> findPath -> dijkstra used to fill
// the per-tick bridge-penalty cache (world.queue) with pre-step data, which the step then reused.
import { busyOutOfReach, createWorld, explainBuilding, granaryRelief, heldWagon, outputSurplus, stateHash, step, wagonEta, type World } from '../src/sim/index';
import { cureFor, gapTarget, rankStalls } from '../src/ui/stalls';
import { benchWorld } from '../tools/bench';
import { test } from './harness';

test('UI reads between ticks (wagonEta) do not change the simulation', () => {
  const a = benchWorld(120), b = benchWorld(120);
  for (let t = 0; t < 2000; t++) {
    // one ETA of a wagon heading to a pickup is enough: it runs a full path search
    const q = b.state.wagons.find((x) => x.job && x.job.phase === 'pickup') ?? b.state.wagons[0]!;
    wagonEta(b, q.id);
    step(a);
    step(b);
    if (t % 50 === 0 || t === 1999) {
      if (stateHash(a) !== stateHash(b)) throw new Error(`diverged by tick ${a.state.tick}`);
    }
  }
});

// Diagnosis audit 2026-11-03: the player-view reads behind the HUD card and the "Dlaczego stoi?" sheet
// (ranking, cures, player chains and the helpers they call) run between ticks every frame. Same rule.

function playerReads(w: World): void {
  rankStalls(w);
  for (const b of w.state.buildings) {
    explainBuilding(w, b.id, 5, true);
    cureFor(w, b.id);
    gapTarget(w, explainBuilding(w, b.id, 5, true));
    outputSurplus(w, b.id);
    heldWagon(w, b.gate);
    granaryRelief(w, b.id);
    busyOutOfReach(w, b.id);
  }
}

test('player diagnosis reads between ticks do not change the simulation (m1, m4, m6, m12)', () => {
  for (const id of ['m1', 'm4', 'm6', 'm12']) {
    const a = createWorld(id), b = createWorld(id);
    for (let t = 0; t < 6000 && a.state.mission.result === 'running'; t++) {
      if (t % 50 === 0) playerReads(b);
      step(a);
      step(b);
    }
    if (stateHash(a) !== stateHash(b)) throw new Error(`${id}: diverged by tick ${a.state.tick}`);
  }
});
