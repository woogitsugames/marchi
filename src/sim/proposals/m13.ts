// Mission XIII "Pierwsze piętro łańcucha" (BACKLOG P4, night 6, D-102). Data only: no new simulation mechanics.
// The raw goods already lie in the granary and every workshop stands idle next to the road, but the march has one
// wagon for the whole map: the stalls read NO_WAGON / ALL_BUSY and the cure is buying wagons at the stable.
// Import MissionDef as a type to avoid the missions.ts <-> proposals module cycle.
import type { MissionDef } from '../missions';
import { M3_VALLEY } from '../missions-proposed';

export const M13_MISSION: MissionDef = {
  // The dry valley of missions III and X-XII (existing map id, no new terrain alias); no rain, no bridges.
  id: 'm13', mapId: 'valley-m3', seed: M3_VALLEY.seed,
  coins: 150, wagons: 1, buildable: [],
  buildings: [
    // The granary holds every raw unit the order needs (and a little more): nothing waits on a field or a forest.
    { type: 'warehouse', x: 24, y: 42, facing: 2, stock: { wood: 14, grain: 10 } },
    { type: 'sawmill', x: 32, y: 37, facing: 0 },
    { type: 'mill', x: 45, y: 43, facing: 2 },
    { type: 'bakery', x: 56, y: 37, facing: 0 },
    // The stable sits mid-map, so a bought wagon starts work at once.
    { type: 'stable', x: 46, y: 35, facing: 0 },
    { type: 'castle', x: 74, y: 42, facing: 2 },
  ],
  roads: [
    [[24, 40], [80, 40]],
    [[25, 40], [25, 41]],
    [[33, 39], [33, 40]],
    [[46, 40], [46, 42]],
    [[47, 37], [47, 40]],
    [[57, 39], [57, 40]],
    [[76, 40], [76, 41]],
  ],
  contract: { planks: 24, bread: 16 },
  // Measured with tools/bot-m13.ts (D-102): nothing loses at 10:00 with the planks in and no bread; one wagon at
  // 0:20 wins 7.61 (2 seals); three at 0:20 wins 5.06, at 1:00 4.94 (3 seals); two at 0:20 5.79 and one at 1:30 8.77.
  deadlineMin: 10, star3Min: 5.5, star2Min: 8, rain: [],
};
