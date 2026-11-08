// Mission XVII "Drewno na dwa listy" (research 2026-11-07, docs/research/2026-11-07-two-castles.md §3 C; owner approved
// 2026-11-08, D-356). Two castles want different goods made from ONE wood: the east castle planks (sawmill) early, the
// north castle charcoal (charcoal burner) late; the sawmill and the burner live on the same two woodcutters. Putting the
// east castle first on its castle leg only (castleFirst, D-289) does not help — the planks wait for wood, not for
// wagons; the lever is "the whole chain first" (chainFirst, D-356): wood goes to the sawmill first, as much as the east
// order still needs.
// The map reuses the dry valley of missions III and X-XVI (mapId 'valley-m3'), no rain, no bridges.
// Import MissionDef as a type to avoid the missions.ts <-> proposals module cycle.
import type { MissionDef } from '../missions';
import { M3_VALLEY } from '../missions-proposed';

export const M17_MISSION: MissionDef = {
  id: 'm17', mapId: 'valley-m3', seed: M3_VALLEY.seed,
  coins: 60, wagons: 6,
  buildings: [
    // one woodcutter for both workshops: wood, not wagons, is what the two chains share
    { type: 'woodcutter', x: 22, y: 37, facing: 0, stock: { wood: 4 } },
    { type: 'sawmill', x: 38, y: 42, facing: 2, stock: { wood: 4 } },
    { type: 'charcoalBurner', x: 52, y: 42, facing: 2, stock: { wood: 4 } },
    { type: 'stable', x: 46, y: 35, facing: 0 },
    // the castles in order of `castles` below: the east castle holds the main contract
    { type: 'castle', x: 84, y: 42, facing: 2 },
    { type: 'castle', x: 62, y: 27, facing: 0 },
  ],
  roads: [
    [[15, 40], [88, 40]],
    [[23, 39], [23, 40]],
    [[47, 37], [47, 40]],
    [[86, 40], [86, 41]],
    [[39, 40], [39, 41]],
    [[53, 40], [53, 41]],
    [[64, 31], [64, 40]],
  ],
  contract: { planks: 24 },
  castles: [
    { name: 'east', need: { planks: 24 }, dueMin: 5.5 },
    { name: 'north', need: { charcoal: 6 }, dueMin: 8 },
  ],
  chainPriority: true,
  // working thresholds, tuned with tools/bot-m17.ts (D-357)
  deadlineMin: 12, star3Min: 7.5, star2Min: 9.5, rain: [],
};
