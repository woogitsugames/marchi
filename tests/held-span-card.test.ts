// The held-span card (research 2026-11-04, P4): a wagon of a building's job held >= 20 s at a wooden span puts that
// building on the worst-stall card, critical, with "pave the bridge in stone" as the cure (missions II and IV).
import { TICK_HZ, applyCommand, createWorld, stateHash, step } from '../src/sim/index';
import { HELD_SPAN_TICKS, cureFor, heldSpanFor, paveCheck, rankStalls } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

for (const id of ['m2', 'm4']) {
  test(`held span: ${id} — the jammed bridge reaches the card and paving it in stone is accepted`, () => {
    const w = createWorld(id);
    w.state.coins += 1000; // the cure's price is not under test here
    let done = false;
    while (w.state.tick < 9 * 60 * TICK_HZ && !done) {
      step(w);
      if (w.state.tick % TICK_HZ) continue;
      for (const e of rankStalls(w)) {
        const b = w.state.buildings.find((q) => q.id === e.id)!;
        const h = heldSpanFor(w, b);
        if (!h) continue;
        const hash = stateHash(w);
        assert(h.heldTicks >= HELD_SPAN_TICKS, 'held at least 20 s');
        eq(e.crit, true, 'critical');
        eq(cureFor(w, b.id), 'pave', 'cure: pave');
        assert(paveCheck(w, h).ok, 'the stone bridge can be laid: ' + JSON.stringify(paveCheck(w, h)));
        eq(stateHash(w), hash, 'read-only');
        const r = applyCommand(w, { t: 'road', surface: 2, cells: h.cells });
        assert(r.ok, 'paving applies');
        for (const c of h.cells) eq(w.state.roads[c], 2, 'span is stone');
        done = true;
        break;
      }
    }
    assert(done, `${id}: a held span reached the card`);
  });
}
