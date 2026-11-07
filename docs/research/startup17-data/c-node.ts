import { readFileSync } from 'node:fs';
import { menuWorld } from '../../../src/game/menuScene';
import { buildingModel, type BuildingKind } from '../../../src/render/models/buildings';
const clock = () => Number(readFileSync('/proc/thread-self/schedstat', 'utf8').split(' ')[0]) / 1e6;
const all = [...new Set(menuWorld().state.buildings.map((b) => b.type as BuildingKind))];
const only = process.env.ONLY ? process.env.ONLY.split(',') as BuildingKind[] : all;
const t0 = clock(); for (const k of only) buildingModel(k); const t1 = clock();
console.log(JSON.stringify({ only: only.join(','), ms: +(t1 - t0).toFixed(1) }));
