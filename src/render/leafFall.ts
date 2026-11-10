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

/**
 * Green of the deciduous crowns (D-303, D-540), 0 … 2: 0 is the late-autumn palette of the art direction (rust, ochre),
 * 1 the young spring green, 2 the darker, muted summer green. It rises 0 → 1 with the returning leaves (15–55 % of
 * spring, the mirror of `bareAt`, so a card comes back already green), matures 1 → 2 over the first 35 % of summer,
 * holds through summer, and in autumn turns 2 → 0 over its first 60 % (through the yellow-green of 1, as leaves lose
 * their green) so the crowns are rust when they start to fall (60 %). Winter 0 (bare anyway). Warm crowns are then an
 * autumn-only sign; the contract missions (no seasons) keep 0. Derived from the tick alone, like `bareAt`.
 */
export function springAt(tick: number): number {
  const s = Math.floor(tick / SEASON_TICKS) % 4, f = (tick % SEASON_TICKS) / SEASON_TICKS;
  if (s === 0) return smooth(0.15, 0.55, f);
  if (s === 1) return 1 + smooth(0, 0.35, f);
  if (s === 2) return 2 * (1 - smooth(0, 0.6, f));
  return 0;
}
