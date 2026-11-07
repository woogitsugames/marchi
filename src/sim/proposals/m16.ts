// Mission XVI "Dwa zamki" (research 2026-11-07, docs/research/2026-11-07-two-castles.md, design A; in the game since
// D-288, owner 2026-11-07). Two castles want planks from ONE sawmill: the east castle 24 by 5:00, the north castle 30
// by 9:00. The dispatcher splits the planks by fill (both castles grow evenly, so the early one is late); the lever
// is the "this castle first" switch on the castle card (the castleFirst command, D-289), set early.
// The map reuses the dry valley of missions III and X-XV (mapId 'valley-m3'), no rain, no bridges.
// Import MissionDef as a type to avoid the missions.ts <-> proposals module cycle.
import type { MissionDef } from '../missions';
import { M3_VALLEY } from '../missions-proposed';

export const M16_MISSION: MissionDef = {
  id: 'm16', mapId: 'valley-m3', seed: M3_VALLEY.seed,
  coins: 60, wagons: 4,
  buildings: [
    { type: 'woodcutter', x: 17, y: 37, facing: 0, stock: { wood: 4 } },
    { type: 'woodcutter', x: 22, y: 37, facing: 0, stock: { wood: 4 } },
    { type: 'sawmill', x: 38, y: 42, facing: 2, stock: { wood: 4 } },
    { type: 'stable', x: 46, y: 35, facing: 0 },
    // the castles in order of `castles` below: the east castle holds the main contract
    { type: 'castle', x: 84, y: 42, facing: 2 },
    { type: 'castle', x: 62, y: 27, facing: 0 },
  ],
  roads: [
    [[15, 40], [88, 40]],
    [[18, 39], [18, 40]],
    [[23, 39], [23, 40]],
    [[47, 37], [47, 40]],
    [[86, 40], [86, 41]],
    [[39, 40], [39, 41]],
    [[64, 31], [64, 40]],
  ],
  contract: { planks: 24 },
  castles: [
    { need: { planks: 24 }, dueMin: 5 },
    { need: { planks: 30 }, dueMin: 9 },
  ],
  // working thresholds (owner 2026-11-07): 3 seals by 7:05, 2 by 9:00, the mission ends at 12:00
  deadlineMin: 12, star3Min: 7 + 5 / 60, star2Min: 9, rain: [],
};
