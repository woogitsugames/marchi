// Missions X-XII (order 49). Data only: no new simulation mechanics.
// Import MissionDef as a type to avoid the missions.ts <-> proposals module cycle.
import type { MissionDef } from '../missions';
import { M3_VALLEY } from '../missions-proposed';

export type Mission101112Id = 'm10' | 'm11' | 'm12';

// The dry logistics valley is deliberately shared. Existing mapId 'valley-m3' avoids
// a new terrain alias and uses the exact tested M3 terrain specification.
export const M101112_VALLEY = M3_VALLEY;
export const M10_SECOND_WOODCUTTER = { x: 12, y: 34, facing: 1 } as const;
export const M12_GRANARY_LINK = { x: 37, y1: 38, y2: 39 } as const;

/** Mission X: a sawmill and a charcoal burner contest one woodcutter's timber. */
export const PROPOSED_MISSIONS_10_12: Record<Mission101112Id, MissionDef> = {
  m10: {
    id: 'm10', mapId: 'valley-m3', seed: M3_VALLEY.seed,
    coins: 210, wagons: 4, buildable: ['woodcutter'],
    buildings: [
      { type: 'woodcutter', x: 14, y: 28, facing: 0, stock: { wood: 4 } },
      { type: 'charcoalBurner', x: 26, y: 37, facing: 0 },
      { type: 'sawmill', x: 32, y: 37, facing: 0, stock: { planks: 4 } },
      { type: 'stable', x: 46, y: 35, facing: 0 },
      { type: 'castle', x: 74, y: 42, facing: 2 },
    ],
    roads: [
      [[15, 40], [86, 40]],
      [[15, 30], [15, 40]],
      [[27, 39], [27, 40]],
      [[33, 39], [33, 40]],
      [[47, 37], [47, 40]],
      [[76, 40], [76, 41]],
    ],
    contract: { planks: 54, charcoal: 10 },
    deadlineMin: 12, star3Min: 7.5, star2Min: 9.5, rain: [],
  },
  m11: {
    id: 'm11', mapId: 'valley-m3', seed: M3_VALLEY.seed,
    coins: 180, wagons: 3, buildable: [],
    buildings: [
      { type: 'farm', x: 18, y: 48, facing: 2, stock: { grain: 6 } },
      { type: 'stable', x: 46, y: 35, facing: 0 },
      { type: 'brewery', x: 56, y: 37, facing: 0, stock: { beer: 2 } },
      // The 62-cell grain journey forces competing trips with only three wagons.
      { type: 'malthouse', x: 80, y: 37, facing: 0 },
      { type: 'castle', x: 74, y: 42, facing: 2 },
    ],
    roads: [
      [[15, 40], [87, 40]],
      [[19, 40], [19, 47]],
      [[47, 37], [47, 40]],
      [[57, 39], [57, 40]],
      [[76, 40], [76, 41]],
      [[81, 39], [81, 40]],
    ],
    contract: { beer: 26 },
    deadlineMin: 12, star3Min: 10.5, star2Min: 11.3, rain: [],
  },
  m12: {
    id: 'm12', mapId: 'valley-m3', seed: M3_VALLEY.seed,
    coins: 210, wagons: 8, buildable: ['warehouse'],
    buildings: [
      { type: 'warehouse', x: 24, y: 42, facing: 2, cap: 12, stock: { grain: 12 } },
      // The larger, empty granary is two road cells away from the trunk.
      { type: 'warehouse', x: 36, y: 35, facing: 0 },
      { type: 'stable', x: 46, y: 35, facing: 0 },
      { type: 'farm', x: 18, y: 48, facing: 2, stock: { grain: 6 } },
      { type: 'farm', x: 28, y: 48, facing: 2, stock: { grain: 6 } },
      { type: 'farm', x: 38, y: 48, facing: 2, stock: { grain: 6 } },
      { type: 'mill', x: 45, y: 43, facing: 2, stock: { flour: 2 } },
      { type: 'malthouse', x: 53, y: 43, facing: 2, stock: { malt: 8 } },
      { type: 'bakery', x: 56, y: 37, facing: 0, stock: { bread: 4 } },
      { type: 'brewery', x: 66, y: 37, facing: 0, stock: { beer: 12 } },
      { type: 'castle', x: 78, y: 42, facing: 2 },
    ],
    roads: [
      [[15, 40], [86, 40]],
      [[19, 40], [19, 47]],
      [[25, 40], [25, 41]],
      [[29, 40], [29, 47]],
      [[39, 40], [39, 47]],
      [[47, 37], [47, 40]],
      [[46, 40], [46, 42]],
      [[54, 40], [54, 42]],
      [[57, 39], [57, 40]],
      [[67, 39], [67, 40]],
      [[80, 40], [80, 41]],
    ],
    // Only the current letter is ordered by the castle. Beer and malt buffers therefore
    // saturate during the first bread delivery. The small granary starts full.
    contract: { bread: 40, beer: 48 },
    tranches: [
      { need: { bread: 32 }, dueMin: 6 },
      { need: { bread: 8, beer: 12 }, dueMin: 9 },
      { need: { beer: 36 }, dueMin: 12 },
    ],
    deadlineMin: 12, star3Min: 9.5, star2Min: 10.5, rain: [],
  },
};

export const M10_MISSION = PROPOSED_MISSIONS_10_12.m10;
export const M11_MISSION = PROPOSED_MISSIONS_10_12.m11;
export const M12_MISSION = PROPOSED_MISSIONS_10_12.m12;
