// Missions 2 and 3 (designed by GPT-6, order 04; see docs/missions/m2.md, m3.md).
// Registered in missions.ts.
import { TICK_HZ } from './defs';
import type { ValleySpec } from './terrain';
import type { MissionDef } from './missions';

export type ProposedMissionId = 'm2' | 'm3';

// Wide, legible horizontal river; the sole starting crossing is at x=51.
// Keep hills away from the logistics spine so no mandatory edge exceeds 14%.
export const M2_VALLEY: ValleySpec = {
  w: 96, h: 72, seed: 2402, waterLevel: 10, spacing: 12,
  riverY: [36, 36, 36, 36, 36, 36, 36, 36, 36],
  riverHalfWidth: [3.6, 3.6, 3.6, 3.6, 3.6, 3.6, 3.6, 3.6, 3.6],
  hills: [
    { x: 16, y: 60, r: 11, h: 3 },
    { x: 80, y: 60, r: 12, h: 3 },
  ],
  northRidge: 6, southRidge: 69, forestNorthOf: 22,
  fields: [{ x: 15, y: 49, w: 10, h: 10 }, { x: 28, y: 51, w: 10, h: 9 }],
};

// The river is scenic here: no bridge queues. The transport problem is mud.
export const M3_VALLEY: ValleySpec = {
  w: 96, h: 72, seed: 3303, waterLevel: 10, spacing: 12,
  riverY: [11, 11, 11, 11, 11, 11, 11, 11, 11],
  riverHalfWidth: [1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8],
  hills: [
    { x: 12, y: 62, r: 13, h: 3 },
    { x: 89, y: 61, r: 10, h: 2 },
  ],
  northRidge: 4, southRidge: 69, forestNorthOf: 25,
  fields: [{ x: 15, y: 47, w: 13, h: 14 }, { x: 29, y: 50, w: 9, h: 10 }],
};

export const PROPOSED_MISSIONS: Record<ProposedMissionId, MissionDef> = {
  m2: {
    // Every production chain crosses the river in both directions:
    // wood N->S, planks S->N, grain S->N, flour N->S, bread S->N.
    id: 'm2', mapId: 'valley-m2', seed: M2_VALLEY.seed,
    coins: 160, wagons: 7,
    buildings: [
      { type: 'woodcutter', x: 20, y: 25, facing: 0, stock: { wood: 4 } },
      { type: 'woodcutter', x: 26, y: 27, facing: 0 },
      { type: 'mill', x: 32, y: 27, facing: 0 },
      { type: 'stable', x: 46, y: 27, facing: 0 },
      { type: 'castle', x: 64, y: 25, facing: 0 },
      { type: 'sawmill', x: 32, y: 44, facing: 2 },
      { type: 'farm', x: 22, y: 46, facing: 2, stock: { grain: 4 } },
      { type: 'farm', x: 27, y: 46, facing: 2 },
      { type: 'bakery', x: 43, y: 44, facing: 2 },
      { type: 'bakery', x: 56, y: 44, facing: 2 },
    ],
    roads: [
      [[21, 30], [72, 30]],
      [[21, 27], [21, 30]],
      [[23, 42], [70, 42]],
      [[23, 42], [23, 45]],
      [[28, 42], [28, 45]],
      [[33, 42], [33, 43]],
      [[44, 42], [44, 43]],
      [[57, 42], [57, 43]],
      // The only crossing: a long one-lane wooden bridge at x=51.
      [[51, 30], [51, 42]],
    ],
    contract: { wood: 0, planks: 36, grain: 0, flour: 0, bread: 30 },
    // Measured with tools/balance.ts: no action 10.8 min (1 seal), 2nd wooden bridge 9.5 (2),
    // stone bridge 8.5 (3).
    deadlineMin: 12, star3Min: 8.75, star2Min: 9.75,
    rain: [],
    roadsOverWater: true,
  },
  m3: {
    id: 'm3', mapId: 'valley-m3', seed: M3_VALLEY.seed,
    coins: 270, wagons: 4,
    buildings: [
      { type: 'woodcutter', x: 14, y: 28, facing: 0, stock: { wood: 6 } },
      { type: 'sawmill', x: 32, y: 37, facing: 0, stock: { planks: 8 } },
      { type: 'stable', x: 46, y: 35, facing: 0 },
      { type: 'farm', x: 18, y: 48, facing: 2, stock: { grain: 6 } },
      { type: 'mill', x: 45, y: 43, facing: 2, stock: { flour: 4 } },
      { type: 'bakery', x: 64, y: 37, facing: 0, stock: { bread: 4 } },
      { type: 'castle', x: 80, y: 42, facing: 2 },
    ],
    roads: [
      [[15, 40], [84, 40]], // long dirt artery: the rain bottleneck
      [[15, 30], [15, 40]],
      [[33, 39], [33, 40]],
      [[47, 37], [47, 40]],
      [[19, 40], [19, 47]],
      [[46, 40], [46, 42]],
      [[65, 39], [65, 40]],
      [[82, 40], [82, 41]],
    ],
    contract: { wood: 0, planks: 24, grain: 0, flour: 0, bread: 16 },
    // Measured: no action 8.6 min (1 seal), 2 wagons 7.4 (2), cobble corridor 5.6 (3).
    deadlineMin: 11, star3Min: 6.25, star2Min: 8,
    rain: [{ start: 20 * TICK_HZ, end: 700 * TICK_HZ }],
  },
};

// Deterministic, visible to the UI through state.rain (20s to 700s).
// Do not fake a MUD_SLOW wagon status: no such status exists in the current sim.
export const M3_RAIN = PROPOSED_MISSIONS.m3.rain!;

