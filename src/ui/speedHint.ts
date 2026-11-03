// Speed hint (BACKLOG P3 "speed as a tool", owner decision 7, 2026-11-03): when the player keeps ×4 while a
// critical stall keeps growing, one toast suggests slowing down. Never changes the speed itself (a hidden
// speed change confuses). Once per stall: the same building with the same cause is not hinted again in this
// mission. Pure: no DOM, no i18n (the app shows the toast), so headless tests can drive it.
import { TICK_HZ, type World } from '../sim/index';
import type { StallEntry } from './stalls';

/** How long a critical stall must have grown (sim ticks) before the hint, i.e. ~15 s of real time at ×4. */
export const SPEED_HINT_TICKS = 60 * TICK_HZ;

export class SpeedHint {
  private seen = new Set<string>();

  /** New mission / loaded save: forget the hinted stalls. */
  reset(): void { this.seen.clear(); }

  /** Building id to hint about now, or -1. Call once per frame with the current ranking. */
  check(world: World, speed: number, stalls: readonly StallEntry[]): number {
    if (speed !== 4 || world.state.mission.result !== 'running') return -1;
    const w = stalls[0];
    if (!w || !w.crit || w.ticks < SPEED_HINT_TICKS) return -1;
    const b = world.state.buildings.find((q) => q.id === w.id);
    if (!b) return -1;
    const s = b.status as { k: string; cause?: string };
    const key = `${b.id}|${s.k}|${s.cause ?? ''}`;
    if (this.seen.has(key)) return -1;
    this.seen.add(key);
    return b.id;
  }
}
