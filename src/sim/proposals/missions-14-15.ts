// Missions XIV "Węgiel z lasu" and XV "Skład pod zamkiem" (research 2026-11-06, docs/research/2026-11-06-missions-14-15.md;
// in the game since D-210, owner 2026-11-06; thresholds D-211). Data only: no new simulation mechanics.
// Both maps reuse the dry valley of missions III and X-XIII (mapId 'valley-m3'), no rain, no bridges.
// Import MissionDef as a type to avoid the missions.ts <-> proposals module cycle.
import type { MissionDef } from '../missions';
import { M3_VALLEY } from '../missions-proposed';

export type Mission1415Id = 'm14' | 'm15';

/** XIV's lesson site: the second charcoal burner by the woodcutters (2 wood make 1 charcoal: the long road carries half). */
export const M14_BURNER_SITE = { x: 26, y: 42, facing: 2 } as const;
/** XIV's wrong site: the second burner next to the first one, by the castle (the long road carries twice the wood). */
export const M14_WRONG_SITE = { x: 76, y: 37, facing: 0 } as const;
/** XV's lesson site: the granary by the castle, where the wood of the second letter will be wanted. */
export const M15_GRANARY_SITE = { x: 64, y: 42, facing: 2 } as const;
/** XV's wrong site: the granary by the woodcutters (the wood is cut in time, but waits on the far end of the road). */
export const M15_WRONG_SITE = { x: 28, y: 42, facing: 2 } as const;

export const MISSIONS_14_15: Record<Mission1415Id, MissionDef> = {
  /**
   * XIV "Węgiel z lasu": a charcoal burner turns 2 wood into 1 charcoal. The woodcutters stand at the west end of
   * the valley, the only burner by the castle at the east end: every load of wood drives 45 cells to become half a
   * load of charcoal. One burner flat out is too slow for the order, so the pace card asks for a second one — and the
   * lesson is WHERE: by the forest the long road carries charcoal (half the loads, full wagons to the castle), next to
   * the first burner it carries twice the wood (and in small top-ups).
   */
  m14: {
    id: 'm14', mapId: 'valley-m3', seed: M3_VALLEY.seed,
    coins: 90, wagons: 4, buildable: ['charcoalBurner'],
    siteHints: [{ type: 'charcoalBurner', ...M14_BURNER_SITE }],
    buildings: [
      { type: 'woodcutter', x: 17, y: 37, facing: 0, stock: { wood: 6 } },
      { type: 'woodcutter', x: 22, y: 37, facing: 0, stock: { wood: 6 } },
      { type: 'stable', x: 46, y: 35, facing: 0 },
      { type: 'charcoalBurner', x: 32, y: 42, facing: 2, stock: { wood: 4 } },
      { type: 'castle', x: 84, y: 42, facing: 2 },
    ],
    roads: [
      [[15, 40], [88, 40]],
      [[18, 39], [18, 40]],
      [[23, 39], [23, 40]],
      [[47, 37], [47, 40]],
      [[33, 40], [33, 41]],
      [[86, 40], [86, 41]],
    ],
    contract: { charcoal: 30 },
    deadlineMin: 14, star3Min: 8.35, star2Min: 10.5, rain: [],
  },
  /**
   * XV "Skład pod zamkiem": the order comes in two letters, 30 grain first (the farm stands by the castle), then 40 wood
   * with a short deadline — and the three woodcutters stand at the far west end, next to a small granary already full
   * of fish nobody wants (a calm pin, D-212). With nowhere to put their wood the woodcutters stop during the first
   * letter (OUTPUT_FULL.NO_DESTINATION -> the full granary: the card asks for another granary). A granary lets them keep
   * cutting; by the castle the wood already waits where the second letter wants it, by the woodcutters it still has the
   * whole valley to cross once the letter opens.
   */
  m15: {
    id: 'm15', mapId: 'valley-m3', seed: M3_VALLEY.seed,
    coins: 80, wagons: 5, buildable: ['warehouse'],
    siteHints: [{ type: 'warehouse', ...M15_GRANARY_SITE }],
    buildings: [
      { type: 'woodcutter', x: 13, y: 37, facing: 0, stock: { wood: 4 } },
      { type: 'woodcutter', x: 17, y: 37, facing: 0, stock: { wood: 4 } },
      { type: 'woodcutter', x: 21, y: 37, facing: 0, stock: { wood: 4 } },
      { type: 'warehouse', x: 24, y: 42, facing: 2, cap: 12, stock: { fish: 12 } },
      { type: 'farm', x: 56, y: 48, facing: 2, stock: { grain: 4 } },
      { type: 'stable', x: 46, y: 35, facing: 0 },
      { type: 'castle', x: 74, y: 42, facing: 2 },
    ],
    roads: [
      [[14, 40], [80, 40]],
      [[14, 39], [14, 40]],
      [[18, 39], [18, 40]],
      [[22, 39], [22, 40]],
      [[25, 40], [25, 41]],
      [[57, 40], [57, 47]],
      [[47, 37], [47, 40]],
      [[76, 40], [76, 41]],
    ],
    contract: { grain: 30, wood: 40 },
    tranches: [
      { need: { grain: 30 }, dueMin: 5.5 },
      { need: { wood: 40 }, dueMin: 8.5 },
    ],
    deadlineMin: 12, star3Min: 7.4, star2Min: 8.6, rain: [],
  },
};
