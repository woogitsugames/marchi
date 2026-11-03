// StallRanking (frame-cost item 3): the per-tick cache of rankStalls returns exactly what a fresh
// rankStalls would, every tick and on frames without a tick, and recomputes only when the state moved.
import { StallRanking, rankStalls } from '../src/ui/stalls';
import { DECENT, runSandbox } from '../tools/bot-sandbox';
import { assert, eq, test } from './harness';

test('stall ranking cache: identical to rankStalls, recomputed once per tick', () => {
  const r = new StallRanking();
  let ticks = 0, nonEmpty = 0;
  runSandbox(DECENT, 12, {
    checkEvery: 1000,
    onTick: (w) => {
      ticks++;
      const before = r.computed;
      // three frames per tick: one recompute, then cache hits with the same array
      const a = r.get(w), b = r.get(w), c = r.get(w);
      eq(r.computed, before + 1, 'one recompute per tick');
      assert(a === b && b === c, 'same array on frames without a tick');
      eq(JSON.stringify(a), JSON.stringify(rankStalls(w)), `identical ranking at tick ${w.state.tick}`);
      if (a.length) nonEmpty++;
      // a calm stall (surplus, room in another granary, a filled order, a customer still taking it) is never waxed
      for (const e of a) assert(!(e.minor && e.crit), `minor and critical at once: #${e.id}`);
      // a command applied in pause bumps the version; invalidate() forces a recompute
      r.get(w, 1);
      eq(r.computed, before + 2, 'version change recomputes');
      r.invalidate();
      r.get(w, 1);
      eq(r.computed, before + 3, 'invalidate recomputes');
    },
  });
  assert(ticks > 1000, 'ran ticks');
  assert(nonEmpty > 0, 'saw stalls to rank');
});
