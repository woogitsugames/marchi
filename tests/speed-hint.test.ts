// Speed hint (owner decision 7): one toast per critical stall while the player keeps ×4; never at ×1/×2,
// never twice for the same stall, never changes the speed.
import { TICK_HZ, createWorld } from '../src/sim/index';
import { SPEED_HINT_TICKS, SpeedHint } from '../src/ui/speedHint';
import type { StallEntry } from '../src/ui/stalls';
import { eq, test } from './harness';

test('speed hint: ×4 + a growing critical stall -> once per stall; ×1/×2 and fresh stalls -> never', () => {
  const w = createWorld('m1');
  const b = w.state.buildings.find((q) => q.type !== 'stable' && q.type !== 'castle')!;
  b.status = { k: 'NO_ROAD' };
  const entry = (ticks: number, crit = true): StallEntry[] => [{ id: b.id, ticks, crit, minor: false, score: ticks * 3 }];
  const h = new SpeedHint();
  eq(h.check(w, 4, entry(SPEED_HINT_TICKS - 1)), -1, 'too fresh');
  eq(h.check(w, 1, entry(SPEED_HINT_TICKS * 2)), -1, '×1: no hint');
  eq(h.check(w, 2, entry(SPEED_HINT_TICKS * 2)), -1, '×2: no hint');
  eq(h.check(w, 4, entry(SPEED_HINT_TICKS * 2, false)), -1, 'not critical: no hint');
  eq(h.check(w, 4, entry(SPEED_HINT_TICKS)), b.id, '×4 + grown critical stall: hint');
  eq(h.check(w, 4, entry(SPEED_HINT_TICKS + 10 * TICK_HZ)), -1, 'same stall: only once');
  b.status = { k: 'NO_WAGON', good: 'wood', cause: 'NONE_CAN_REACH' };
  eq(h.check(w, 4, entry(SPEED_HINT_TICKS * 3)), b.id, 'another cause at the same building: a new stall');
  h.reset();
  eq(h.check(w, 4, entry(SPEED_HINT_TICKS * 3)), b.id, 'reset (new mission): hinted again');
  w.state.mission.result = 'won';
  eq(h.check(w, 4, entry(SPEED_HINT_TICKS * 3)), -1, 'mission over: no hint');
});
