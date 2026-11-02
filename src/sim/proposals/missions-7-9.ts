// Mission design proposals VII-IX (order 42).
// Deliberately NOT registered in missions.ts. Tests and bots register locally.
// Reuse existing map IDs so integration needs only three MissionDef registrations.
import type { MissionDef } from '../missions';
import { valleySpec } from '../missions';
import type { ValleySpec } from '../terrain';
import { M2_VALLEY, M3_VALLEY } from '../missions-proposed';

export type Mission789Id = 'm7' | 'm8' | 'm9';

/** VII: proven river valley, with north-bank fish and a bridge to the southern castle. */
export const M7_VALLEY: ValleySpec = { ...M2_VALLEY, seed: M2_VALLEY.seed };
/** VIII: original valley, with the tested rocky quarry site at (57, 7). */
export const M8_VALLEY: ValleySpec = valleySpec(1301);
/** IX: proven dry logistics valley with two competing uses for wood. */
export const M9_VALLEY: ValleySpec = { ...M3_VALLEY, seed: M3_VALLEY.seed };

export const M7_FISHER_SITE = { x: 39, y: 30, facing: 2 } as const;
export const M7_DRY_SITE = { x: 30, y: 20, facing: 2 } as const;
export const M8_QUARRY_SITE = { x: 57, y: 7, facing: 0 } as const;
export const M8_FALSE_QUARRY_SITE = { x: 30, y: 28, facing: 0 } as const;
export const M9_WOODCUTTER_SITE = { x: 12, y: 34, facing: 1 } as const;

/** Standalone data: add three assignments to MISSIONS when accepted for release. */
export const PROPOSED_MISSIONS_7_9: Record<Mission789Id, MissionDef> = {
  m7: {
    id: 'm7', mapId: 'valley-m2', seed: M7_VALLEY.seed,
    coins: 180, wagons: 4,
    buildable: ['fisher'],
    buildings: [
      // One existing hut is able to fulfil the letter, but only very slowly.
      { type: 'fisher', x: 22, y: 30, facing: 2, stock: { fish: 6 } },
      { type: 'stable', x: 46, y: 26, facing: 0 },
      { type: 'castle', x: 74, y: 44, facing: 2 },
    ],
    roads: [
      [[18, 29], [75, 29]],
      [[18, 42], [84, 42]],
      [[51, 29], [51, 42]], // the sole wooden crossing
    ],
    roadsOverWater: true,
    rain: [],
    contract: { fish: 54 },
    deadlineMin: 12, star3Min: 7.5, star2Min: 9.5,
  },
  m8: {
    id: 'm8', mapId: 'valley1', seed: M8_VALLEY.seed,
    coins: 410, wagons: 6,
    buildable: ['quarry'],
    buildings: [
      { type: 'woodcutter', x: 14, y: 13, facing: 0, stock: { wood: 5 } },
      { type: 'sawmill', x: 28, y: 20, facing: 0, stock: { planks: 4 } },
      { type: 'stable', x: 46, y: 21, facing: 0 },
      { type: 'quarry', ...M8_QUARRY_SITE, stock: { stone: 4 } },
      { type: 'warehouse', x: 62, y: 20, facing: 0 },
      { type: 'farm', x: 18, y: 46, facing: 2, stock: { grain: 5 } },
      { type: 'mill', x: 42, y: 37, facing: 0, stock: { flour: 3 } },
      { type: 'bakery', x: 54, y: 46, facing: 2, stock: { bread: 4 } },
      { type: 'castle', x: 77, y: 50, facing: 3 },
    ],
    roads: [
      [[15, 15], [15, 24], [63, 24]],
      [[29, 22], [29, 24]],
      [[58, 9], [58, 24]], // quarry to the north trunk
      [[63, 22], [63, 24]], // building-stone granary
      [[41, 24], [41, 44]], // wooden bridge built before rain
      [[12, 44], [70, 44], [72, 46], [72, 52], [76, 52]],
      [[19, 44], [19, 45]],
      [[43, 39], [43, 44]],
    ],
    roadsOverWater: true,
    // The storm makes the southern dirt road expensive in wagon time.
    rain: [{ start: 1000, end: 7200 }],
    contract: { planks: 30, bread: 20 },
    deadlineMin: 13, star3Min: 8, star2Min: 10.5,
  },
  m9: {
    id: 'm9', mapId: 'valley-m3', seed: M9_VALLEY.seed,
    coins: 220, wagons: 5,
    buildable: ['woodcutter'],
    buildings: [
      { type: 'woodcutter', x: 14, y: 28, facing: 0, stock: { wood: 4 } },
      { type: 'charcoalBurner', x: 26, y: 37, facing: 0 },
      { type: 'sawmill', x: 32, y: 37, facing: 0, stock: { planks: 4 } },
      { type: 'stable', x: 46, y: 35, facing: 0 },
      { type: 'farm', x: 18, y: 48, facing: 2, stock: { grain: 6 } },
      { type: 'malthouse', x: 44, y: 44, facing: 2, stock: { malt: 2 } },
      { type: 'brewery', x: 56, y: 37, facing: 0, stock: { beer: 2 } },
      { type: 'castle', x: 74, y: 42, facing: 2 },
    ],
    roads: [
      [[15, 40], [86, 40]],
      [[15, 30], [15, 40]],
      [[27, 39], [27, 40]],
      [[33, 39], [33, 40]],
      [[47, 37], [47, 40]],
      [[19, 40], [19, 47]],
      [[45, 40], [45, 43]],
      [[57, 39], [57, 40]],
      [[76, 40], [76, 41]],
    ],
    rain: [],
    contract: { planks: 44, charcoal: 8, beer: 26 },
    deadlineMin: 13, star3Min: 8, star2Min: 10.5,
  },
};
export const M7_MISSION = PROPOSED_MISSIONS_7_9.m7;
export const M8_MISSION = PROPOSED_MISSIONS_7_9.m8;
export const M9_MISSION = PROPOSED_MISSIONS_7_9.m9;
