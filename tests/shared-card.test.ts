// The "one producer for two workshops" card (research 2026-11-04, P5): in missions IX and X the shared woodcutter
// reaches the worst-stall card as critical and its cure is building another producer; elsewhere nothing changes.
// D-110: only after the workshop has waited 30 s for its input (not from the first second).
import { MISSIONS, TICK_HZ, createWorld, stateHash, step } from '../src/sim/index';
import { SHARED_CARD_WAIT_TICKS, cureFor, inputWaitTicks, rankStalls, sampleInputWaits, sharedOneCard, sharedOneProducer } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

for (const id of ['m9', 'm10']) {
  test(`shared card: ${id} shows the single woodcutter on the card after 30 s of waiting, within 3 minutes, cure = producer`, () => {
    const w = createWorld(id);
    let seen = -1;
    while (w.state.tick < 3 * 60 * TICK_HZ && seen < 0) {
      step(w);
      sampleInputWaits(w);
      if (w.state.tick % TICK_HZ) continue;
      // never before the wait: the shared state alone does not reach the card or its cure
      for (const q of w.state.buildings) {
        if (!sharedOneProducer(w, q) || inputWaitTicks(w, q) >= SHARED_CARD_WAIT_TICKS) continue;
        assert(!sharedOneCard(w, q), `${q.type} card before 30 s`);
        assert(cureFor(w, q.id) !== 'producer', `${q.type}: producer cure at ${w.state.tick / TICK_HZ} s, waited ${inputWaitTicks(w, q) / TICK_HZ} s`);
      }
      const top = rankStalls(w)[0];
      const b = top ? w.state.buildings.find((q) => q.id === top.id)! : null;
      if (b && sharedOneCard(w, b)) {
        assert(inputWaitTicks(w, b) >= SHARED_CARD_WAIT_TICKS, 'waited 30 s');
        const h = stateHash(w);
        eq(top!.crit, true, 'critical');
        eq(cureFor(w, b.id), 'producer', 'the cure is a second producer');
        eq(w.state.buildings.find((q) => q.id === sharedOneProducer(w, b)!.producer)!.type, 'woodcutter', 'the shared one is the woodcutter');
        eq(stateHash(w), h, 'read-only');
        seen = w.state.tick / TICK_HZ;
      }
    }
    assert(seen >= 30 && seen <= 180, `card seen at ${seen} s`);
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

test('shared card: a world that was never sampled (no wait log) shows no shared card', () => {
  const w = createWorld('m9');
  for (let i = 0; i < 90 * TICK_HZ; i++) step(w);
  for (const b of w.state.buildings) assert(!sharedOneCard(w, b), `${b.type} without a wait log`);
});
