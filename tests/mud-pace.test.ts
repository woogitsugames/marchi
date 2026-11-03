// H4 (mud read as a pace, not a stall): the wagon card compares the current mud pace with the same edge
// paved. `wagonSlowdown` is a read-only view; a wagon slowed by mud keeps a driving status.
import { RAIN_COBBLE, RAIN_DIRT, SPEED_COBBLE, SPEED_DIRT, TICK_HZ, applyCommand, createWorld, isRaining, step, wagonSlowdown } from '../src/sim/index';
import { botPlan } from '../src/game/menuScene';
import { assert, test } from './harness';

/** The wagon statuses the card shows as a stall (src/ui/format.ts isWagonWait; i18n loads only under Vite). */
const WAITS = new Set(['BRIDGE_JAM', 'NO_ROUTE', 'BRIDGE_CLOSED']);

test('mud pace: cobbles beside it in the same rain and grade; a muddy wagon is driving, not stalled', () => {
  const w = createWorld('m1');
  for (const c of botPlan(w)) applyCommand(w, c);
  const ratio = (SPEED_COBBLE * RAIN_COBBLE) / (SPEED_DIRT * RAIN_DIRT);
  let samples = 0;
  while (w.state.tick < 300 * TICK_HZ && w.state.mission.result === 'running') {
    step(w);
    if (w.state.tick % TICK_HZ !== 0 || !isRaining(w.state)) continue;
    for (const q of w.state.wagons) {
      if (q.next < 0) continue;
      const s = wagonSlowdown(w, q.id);
      if (!s || !s.mud) continue;
      samples++;
      assert(s.factor < 0.6, `mud slows (${s.factor})`);
      assert(Math.abs(s.paved - s.factor * ratio) < 1e-9, `paved = mud pace × cobble/mud speed (${s.paved} vs ${s.factor})`);
      assert(s.paved > s.factor, 'cobbles are faster than mud');
      assert(!WAITS.has(q.status.k), `a muddy wagon is not a stall (${q.status.k})`);
    }
  }
  assert(samples > 20, `wagons drove through mud (${samples} samples)`);
});
