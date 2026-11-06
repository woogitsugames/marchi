// The fleet cue in the free valley (owner 2026-11-05, D-140): no contract, so no forecast and no seal, but a yard that
// waits for pickup while the whole fleet was on the road the last minute still gets "Kup wóz" — with a silver reserve
// for the next building. Driven like a mission-I graduate: the research's minimal build order, wagons only from the cue.
import { TICK_HZ, WAGON_PRICE, applyCommand, createWorld, stateHash, step } from '../src/sim/index';
import { sandboxStatus } from '../src/sim/town';
import { FLEET_FREE_KEEP, fleetCueFor, paceCard, sampleFleet } from '../src/ui/paceCard';
import { MIN } from '../tools/sandbox-first30';
import { assert, eq, test } from './harness';

test('valley fleet cue: appears without a contract, keeps the reserve, buys wagons that pay', () => {
  const w = createWorld('sandbox');
  const stable = w.state.buildings.find((b) => b.type === 'stable')!.id;
  const done = new Set<number>();
  let cues = 0;
  while (w.state.tick < 20 * 60 * TICK_HZ) {
    step(w);
    sampleFleet(w);
    const st = w.state;
    MIN.forEach((s, i) => {
      if (done.has(i)) return;
      if ((s.after !== undefined && st.tick < s.after * TICK_HZ) || (s.rank !== undefined && st.town.rank < s.rank)) return;
      for (const c of s.cmds(w)) applyCommand(w, c);
      done.add(i);
    });
    if (st.tick % (10 * TICK_HZ)) continue;
    const pc = paceCard(w, null);
    if (!pc) continue;
    assert(pc.k === 'fleet' || pc.k === 'rank' || pc.k === 'grow', `without a contract only the fleet, rank and grow kinds exist (${pc.k})`);
    if (pc.k !== 'fleet') continue;
    assert(st.coins >= WAGON_PRICE + FLEET_FREE_KEEP, `reserve kept (${st.coins} silver)`);
    eq(pc.seals, -1, 'no seal in the valley');
    const b = st.buildings.find((q) => q.id === pc.producer)!;
    assert(!!fleetCueFor(w, null, b), "the yard's own sheet offers it too");
    const hash = stateHash(w);
    paceCard(w, null);
    eq(stateHash(w), hash, 'read-only');
    if (applyCommand(w, { t: 'buyWagon', stable }).ok) cues++;
  }
  assert(cues >= 1, `the cue bought at least one wagon in 20 minutes (${cues})`);
  assert(sandboxStatus(w).rank >= 1, 'rank 1 within 20 minutes');
});
