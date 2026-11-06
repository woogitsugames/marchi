// The free valley's saturation test (D-174), shared by the grow card (D-192) and the bottleneck card (D-171, D-268).
// Pure read of the sim state; nothing here writes it.
import { MARKET, capacityOf, outputGoods, type BuildingType, type Good, type World } from '../sim/index';
import { granaryLoads } from './stallKinds';

/** Which consumer a producer feeds inside one grow chain (farm -> mill -> bakery, woodcutter -> sawmill, malt -> beer). */
export const GROW_FEEDS: Partial<Record<BuildingType, BuildingType>> = { farm: 'mill', mill: 'bakery', woodcutter: 'sawmill', malthouse: 'brewery' };

/**
 * The good does not fetch a fair price any more (D-174): its saturation reached half the cap, or a full granary holds
 * a load of it that no market takes. More of the same would only fill the granaries.
 */
export function goodSaturated(world: World, good: Good): boolean {
  const st = world.state;
  if (st.market.saturation[good] >= MARKET.cap / 2) return true;
  return st.buildings.some((b) => b.type === 'warehouse' && b.status.k === 'STORAGE_FULL' &&
    b.stock[good] >= capacityOf(good) && granaryLoads(world, b.id) === 'saturated');
}

/**
 * The end good of the chain a building of `type` works in (D-268): its own output, or — while the building it feeds
 * (GROW_FEEDS) stands — that building's chain end (a mill by a bakery ends in bread). null for a type without output.
 */
export function chainEndGood(world: World, type: BuildingType): Good | null {
  const st = world.state;
  let t = type;
  for (let i = 0; i < 4; i++) {
    const next = GROW_FEEDS[t];
    if (!next || !st.buildings.some((b) => b.type === next)) break;
    t = next;
  }
  return outputGoods(t)[0] ?? null;
}
