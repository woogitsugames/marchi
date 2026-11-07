// Leaf fall of the deciduous trees in a seasonal world (D-260): how bare the crowns are at a tick, and the steps the
// far-tree atlas is baked at. Pure functions of the tick (render reads the sim's clock, never writes it).
import { SEASON_TICKS } from '../sim/index';

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * How bare the deciduous crowns are at a tick of a seasonal world (D-260), 0 in leaf … 1 bare: the leaves fall over
 * the last 40 % of autumn (6 game minutes, done when winter starts), the crowns stay bare all winter, and the leaves
 * come back over 15–55 % of spring (with the thaw). Summer 0. Derived from the tick alone, like the seasons.
 */
export function bareAt(tick: number): number {
  const s = Math.floor(tick / SEASON_TICKS) % 4, f = (tick % SEASON_TICKS) / SEASON_TICKS;
  if (s === 2) return smooth(0.6, 1, f);
  if (s === 3) return 1;
  if (s === 0) return 1 - smooth(0.15, 0.55, f);
  return 0;
}

/**
 * Bare level the far-card atlas is baked at (D-260): the eased bare factor in quarter steps, so a season change
 * re-bakes the atlas 4 times (into the same targets) instead of every frame; the near trees follow the exact factor.
 */
export function bareBakeLevel(bare: number): number {
  return Math.round(bare * 4) / 4;
}
