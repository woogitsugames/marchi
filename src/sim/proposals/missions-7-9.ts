// Missions VII-IX (order 42), registered in missions.ts (MISSIONS.m7..m9).
// Own map ids valley-m7..m9 (saves name their map) over the mission II river, the original valley
// and the mission III valley; mission VIII builds cobbles with stone (MissionDef.roadStone, D-32).
// Type-only import from missions.ts: missions.ts will import this file to register VII-IX, and a
// value import (valleySpec) would run before VALLEY_W is initialised in that import cycle.
import type { MissionDef } from '../missions';
import type { ValleySpec } from '../terrain';
import { M2_VALLEY, M3_VALLEY } from '../missions-proposed';

export type Mission789Id = 'm7' | 'm8' | 'm9';

/** VII: proven river valley, with north-bank fish and a bridge to the southern castle. */
export const M7_VALLEY: ValleySpec = { ...M2_VALLEY, seed: M2_VALLEY.seed };
/** VIII: original valley (mapId valley-m8 = valleySpec(seed)), with the rocky quarry site at (57, 7) north of the lane. */
export const M8_SEED = 1301;
/** IX: proven dry logistics valley with two competing uses for wood. */
export const M9_VALLEY: ValleySpec = { ...M3_VALLEY, seed: M3_VALLEY.seed };

export const M7_FISHER_SITE = { x: 39, y: 30, facing: 2 } as const;
export const M7_DRY_SITE = { x: 30, y: 20, facing: 2 } as const;
export const M8_QUARRY_SITE = { x: 57, y: 7, facing: 0 } as const;
export const M8_FALSE_QUARRY_SITE = { x: 30, y: 28, facing: 0 } as const;
/** VIII's lesson (D-165): the dirt lane every crossing load uses, from the bakery gate to the castle gate (23 cells, 23 stone) — the stretch the mud card offers. */
export const M8_LANE = { y: 24, x1: 31, x2: 53 } as const;
export const M9_WOODCUTTER_SITE = { x: 12, y: 34, facing: 1 } as const;

/** Mission data; missions.ts assigns these to MISSIONS.m7..m9. */
export const PROPOSED_MISSIONS_7_9: Record<Mission789Id, MissionDef> = {
  m7: {
    id: 'm7', mapId: 'valley-m7', seed: M7_VALLEY.seed,
    coins: 180, wagons: 4,
    buildable: ['fisher'],
    // no authored fisher site (owner 2026-11-04, M7): the ghost starts on the nearest free bank by the existing
    // hut, so the pace card says "what" but the player still picks "where"
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
    id: 'm8', mapId: 'valley-m8', seed: M8_SEED,
    // Redesign (D-165): every load of the bread and plank chains crosses one dirt lane (x=31..53, y=24, 23 cells)
    // between the western hamlet (farm, bakery, sawmill) and the eastern end (mill, woodcutter, castle). The storm
    // turns it to mud; more wagons barely shorten that wait, cobbles (23 stone) make every crossing twice as fast.
    coins: 240, wagons: 7,
    buildable: ['quarry'],
    buildings: [
      { type: 'woodcutter', x: 45, y: 22, facing: 0, stock: { wood: 6 } },
      { type: 'sawmill', x: 30, y: 25, facing: 2, stock: { planks: 2 } },
      { type: 'stable', x: 41, y: 22, facing: 0 },
      { type: 'quarry', ...M8_QUARRY_SITE, stock: { stone: 8 } },
      // the stone yard by the quarry road and the village granary on the lane: each keeps at most 18 stone
      // (STONE_RESERVE), so the 23 the lane needs only fit in two
      { type: 'warehouse', x: 59, y: 18, facing: 3, stock: { stone: 8 } },
      { type: 'warehouse', x: 39, y: 25, facing: 2, stock: { stone: 8 } },
      { type: 'farm', x: 25, y: 21, facing: 0, stock: { grain: 6 } },
      { type: 'mill', x: 49, y: 22, facing: 0, stock: { flour: 2 } },
      { type: 'bakery', x: 29, y: 22, facing: 0, stock: { bread: 2 } },
      { type: 'castle', x: 51, y: 25, facing: 2 },
    ],
    roads: [
      [[26, 24], [58, 24]], // the lane: hamlet gates x=26..31, castle gate x=53
      [[58, 9], [58, 24]], // quarry road past the stone yard
    ],
    roadsOverWater: true,
    // Cobbles cost stone hauled into the granaries first (D-32).
    roadStone: true,
    // The storm breaks at 1:30 and lasts past the deadline.
    rain: [{ start: 900, end: 6600 }],
    contract: { planks: 40, bread: 40 },
    deadlineMin: 11, star3Min: 6.85, star2Min: 7.6,
  },
  m9: {
    id: 'm9', mapId: 'valley-m9', seed: M9_VALLEY.seed,
    coins: 220, wagons: 5,
    buildable: ['woodcutter'],
    siteHints: [{ type: 'woodcutter', ...M9_WOODCUTTER_SITE }],
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
    contract: { planks: 36, charcoal: 8, beer: 26 },
    deadlineMin: 13, star3Min: 9.2, star2Min: 10.8,
  },
};
export const M7_MISSION = PROPOSED_MISSIONS_7_9.m7;
export const M8_MISSION = PROPOSED_MISSIONS_7_9.m8;
export const M9_MISSION = PROPOSED_MISSIONS_7_9.m9;
