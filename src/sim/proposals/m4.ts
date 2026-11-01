// Mission IV proposal only. Not registered in missions.ts (order 12).
// Intentionally reuses the proven M2 valley generator so the acceptance bot can
// register just the mission at runtime, without modifying any existing sim file.
// When integrated permanently, create a 'valley-m4' map spec alias in missions.ts.
import type { MissionDef } from '../missions';
import type { ValleySpec } from '../terrain';
import { M2_VALLEY } from '../missions-proposed';

/** The river and its bridge grade are identical to the proven M2 geography. */
export const M4_VALLEY: ValleySpec = {
  ...M2_VALLEY,
  // Preserve the seed to keep all building footprints and bridge grades known.
  seed: M2_VALLEY.seed,
};

export const M4_BRIDGE = { x: 51, northY: 30, southY: 42 } as const;

/**
 * North: wood supply + wagons.
 * South: sawmill, optional wood buffer in the existing warehouse, full bread
 * chain, and castle. One original wooden river crossing at x=51.
 */
export const M4_MISSION: MissionDef = {
  id: 'm4',
  // This intentionally matches the existing MAP_SPECS key; see comment above.
  mapId: 'valley-m2',
  seed: M4_VALLEY.seed,
  coins: 180,
  wagons: 6,
  buildings: [
    { type: 'woodcutter', x: 20, y: 25, facing: 0, stock: { wood: 8 } },
    { type: 'woodcutter', x: 26, y: 27, facing: 0, stock: { wood: 8 } },
    { type: 'stable', x: 46, y: 27, facing: 0 },
    { type: 'sawmill', x: 32, y: 44, facing: 2, stock: { wood: 4, planks: 6 } },
    { type: 'warehouse', x: 40, y: 44, facing: 2 },
    { type: 'mill', x: 47, y: 44, facing: 2, stock: { grain: 5, flour: 3 } },
    { type: 'bakery', x: 56, y: 44, facing: 2, stock: { flour: 3, bread: 4 } },
    { type: 'castle', x: 74, y: 44, facing: 2 },
    { type: 'farm', x: 22, y: 46, facing: 2, stock: { grain: 6 } },
    { type: 'farm', x: 27, y: 46, facing: 2, stock: { grain: 4 } },
  ],
  roads: [
    [[21, 30], [70, 30]], // north
    [[21, 27], [21, 30]], // first woodcutter
    [[27, 29], [27, 30]], // second woodcutter
    [[47, 29], [47, 30]], // stable
    [[23, 42], [83, 42]], // south
    [[23, 42], [23, 45]], // farm 1
    [[28, 42], [28, 45]], // farm 2
    [[33, 42], [33, 43]], // sawmill
    [[41, 42], [41, 43]], // warehouse
    [[48, 42], [48, 43]], // mill
    [[57, 42], [57, 43]], // bakery
    [[76, 42], [76, 43]], // castle
    [[M4_BRIDGE.x, M4_BRIDGE.northY], [M4_BRIDGE.x, M4_BRIDGE.southY]],
  ],
  contract: { wood: 0, planks: 36, grain: 0, flour: 0, bread: 20 },
  deadlineMin: 11.5,
  star3Min: 6.5,
  star2Min: 9,
  rain: [], // Do not introduce the M3 mud lesson.
  roadsOverWater: true,
};
