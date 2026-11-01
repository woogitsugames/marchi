// Missions IV-VI (session 2): ice on the crossing, a contract in tranches, a cramped granary.
// Each mission teaches one new stall cause; see docs/missions/m4.md, m5.md, m6.md.
import { TICK_HZ } from './defs';
import type { MissionDef } from './missions';
import { M4_MISSION } from './proposals/m4';

/** Mission clock 03:00-08:00: wooden bridges closed by drifting ice. */
export const M4_ICE = { start: 180 * TICK_HZ, end: 480 * TICK_HZ } as const;

const z = { wood: 0, planks: 0, grain: 0, flour: 0, bread: 0 };

export const S2_MISSIONS: Record<'m4' | 'm5' | 'm6', MissionDef> = {
  m4: {
    ...M4_MISSION,
    mapId: 'valley-m4',
    // Measured with tools/balance.ts m4: no action 11.7 min (1 seal), stone bridge late 8.1 (2),
    // stone bridge before the ice 6.4 (3).
    contract: { wood: 0, planks: 48, grain: 0, flour: 0, bread: 20 },
    deadlineMin: 12.5, star3Min: 7, star2Min: 9.5,
    ice: [{ start: M4_ICE.start, end: M4_ICE.end }],
  },
  m5: {
    // Fair: three letters with their own deadlines. The castle only orders what the current letter
    // asks for, so between letters producers fill up; a granary connected to the road keeps them working.
    id: 'm5', mapId: 'valley-m5', seed: 3303,
    coins: 200, wagons: 5,
    buildings: [
      { type: 'woodcutter', x: 14, y: 28, facing: 0, stock: { wood: 4 } },
      { type: 'woodcutter', x: 12, y: 34, facing: 1 },
      { type: 'sawmill', x: 32, y: 37, facing: 0, stock: { planks: 4 } },
      { type: 'stable', x: 46, y: 35, facing: 0 },
      { type: 'farm', x: 18, y: 48, facing: 2, stock: { grain: 4 } },
      { type: 'mill', x: 45, y: 43, facing: 2, stock: { flour: 2 } },
      { type: 'bakery', x: 56, y: 37, facing: 0, stock: { bread: 4 } },
      // The granary next to the sawmill stands two road cells short of the artery.
      { type: 'warehouse', x: 36, y: 35, facing: 0 },
      { type: 'castle', x: 60, y: 42, facing: 2 },
    ],
    roads: [
      [[15, 40], [66, 40]],
      [[15, 30], [15, 40]],
      [[33, 39], [33, 40]],
      [[47, 37], [47, 40]],
      [[19, 40], [19, 47]],
      [[46, 40], [46, 42]],
      [[57, 39], [57, 40]],
      [[62, 40], [62, 41]],
    ],
    contract: { ...z, planks: 42, bread: 24 },
    tranches: [
      { need: { ...z, planks: 6, bread: 6 }, dueMin: 3 },
      { need: { ...z, bread: 18 }, dueMin: 5.5 },
      { need: { ...z, planks: 36 }, dueMin: 11 },
    ],
    // Measured with tools/balance.ts m5 (see docs/missions/m5.md).
    deadlineMin: 11, star3Min: 8.5, star2Min: 9.3,
    rain: [],
  },
  m6: {
    // Cramped granary: three farms out-produce the single mill and fill the small granary (20 units)
    // with grain. Between the two letters the sawmill has nowhere to put its planks and stops.
    // The large granary across the road is not connected yet.
    id: 'm6', mapId: 'valley-m6', seed: 3303,
    coins: 160, wagons: 10,
    buildings: [
      { type: 'woodcutter', x: 14, y: 28, facing: 0, stock: { wood: 4 } },
      { type: 'woodcutter', x: 12, y: 34, facing: 1 },
      { type: 'sawmill', x: 32, y: 37, facing: 0, stock: { planks: 4 } },
      { type: 'warehouse', x: 24, y: 42, facing: 2, cap: 12 },
      { type: 'warehouse', x: 36, y: 35, facing: 0 },
      { type: 'stable', x: 46, y: 35, facing: 0 },
      { type: 'farm', x: 18, y: 48, facing: 2, stock: { grain: 6 } },
      { type: 'farm', x: 28, y: 48, facing: 2, stock: { grain: 6 } },
      { type: 'farm', x: 38, y: 48, facing: 2, stock: { grain: 6 } },
      { type: 'mill', x: 45, y: 43, facing: 2, stock: { flour: 2 } },
      { type: 'bakery', x: 56, y: 37, facing: 0, stock: { bread: 4 } },
      { type: 'castle', x: 60, y: 42, facing: 2 },
    ],
    roads: [
      [[15, 40], [66, 40]],
      [[15, 30], [15, 40]],
      [[33, 39], [33, 40]],
      [[25, 40], [25, 41]],
      [[47, 37], [47, 40]],
      [[19, 40], [19, 47]],
      [[29, 40], [29, 47]],
      [[39, 40], [39, 47]],
      [[46, 40], [46, 42]],
      [[57, 39], [57, 40]],
      [[62, 40], [62, 41]],
    ],
    contract: { ...z, planks: 60, bread: 24 },
    tranches: [
      { need: { ...z, bread: 24 }, dueMin: 6 },
      { need: { ...z, planks: 60 }, dueMin: 11 },
    ],
    // Measured with tools/balance.ts m6 (see docs/missions/m6.md): margins are thin, re-run after sim changes.
    deadlineMin: 11, star3Min: 8.45, star2Min: 8.85,
    rain: [],
  },
};
