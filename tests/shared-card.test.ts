// The "one producer for two workshops" card (research 2026-11-04, P5): in missions IX and X the shared woodcutter
// reaches the worst-stall card as critical and its cure is building another producer; elsewhere nothing changes.
import { MISSIONS, TICK_HZ, createWorld, stateHash, step } from '../src/sim/index';
import { cureFor, rankStalls, sharedOneProducer } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

for (const id of ['m9', 'm10']) {
  test(`shared card: ${id} shows the single woodcutter on the card within 3 minutes, cure = producer`, () => {
    const w = createWorld(id);
    let seen = -1;
    while (w.state.tick < 3 * 60 * TICK_HZ && seen < 0) {
      step(w);
      if (w.state.tick % TICK_HZ) continue;
      const top = rankStalls(w)[0];
      const b = top ? w.state.buildings.find((q) => q.id === top.id)! : null;
      if (b && sharedOneProducer(w, b)) {
        const h = stateHash(w);
        eq(top!.crit, true, 'critical');
        eq(cureFor(w, b.id), 'producer', 'the cure is a second producer');
        eq(w.state.buildings.find((q) => q.id === sharedOneProducer(w, b)!.producer)!.type, 'woodcutter', 'the shared one is the woodcutter');
        eq(stateHash(w), h, 'read-only');
        seen = w.state.tick / TICK_HZ;
      }
    }
    assert(seen >= 0 && seen <= 180, `card seen at ${seen} s`);
  });
}

test('shared card: missions that cannot build the producer never offer it', () => {
  for (const id of Object.keys(MISSIONS)) {
    if (id === 'm9' || id === 'm10') continue;
    const w = createWorld(id);
    for (let s = 0; s < 240; s++) {
      for (let i = 0; i < TICK_HZ; i++) step(w);
      if (s % 10) continue;
      for (const b of w.state.buildings) {
        const sh = sharedOneProducer(w, b);
        assert(!sh, `${id}: ${b.type} at ${s} s offers a ${sh?.type}`);
      }
    }
  }
});
