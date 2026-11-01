// Mission 2/3 proposals. Not registered in missions.ts by design (task 04).
// Bots create isolated, fully simulated worlds with these definitions.
// Production integration must register mapIds and definitions in missions.ts.
import { STATE_VERSION, TICK_HZ, emptyGoods } from './defs';
import { lineCells, place, spawnWagon } from './commands';
import { seedRng } from './rng';
import { generateValley, type ValleySpec } from './terrain';
import type { MissionDef } from './missions';
import type { World } from './network';
import type { GoodMap, SimState } from './types';

export type ProposedMissionId = 'm2' | 'm3';

// Wide, legible horizontal river; the sole starting crossing is at x=51.
// Keep hills away from the logistics spine so no mandatory edge exceeds 14%.
export const M2_VALLEY: ValleySpec = {
  w: 96, h: 72, seed: 2402, waterLevel: 10, spacing: 12,
  riverY: [36, 36, 36, 36, 36, 36, 36, 36, 36],
  riverHalfWidth: [2, 2, 2, 2, 2, 2, 2, 2, 2],
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
    id: 'm2', mapId: 'valley-m2', seed: M2_VALLEY.seed,
    coins: 160, wagons: 4,
    buildings: [
      { type: 'woodcutter', x: 20, y: 25, facing: 0, stock: { wood: 6 } },
      { type: 'sawmill', x: 32, y: 27, facing: 0, stock: { planks: 6 } },
      { type: 'stable', x: 46, y: 27, facing: 0 },
      { type: 'bakery', x: 57, y: 27, facing: 0, stock: { bread: 4 } },
      { type: 'farm', x: 22, y: 46, facing: 2, stock: { grain: 6 } },
      { type: 'mill', x: 43, y: 44, facing: 2, stock: { flour: 4 } },
      { type: 'castle', x: 66, y: 43, facing: 2 },
    ],
    roads: [
      [[21, 30], [72, 30]],
      [[21, 27], [21, 30]],
      [[33, 29], [33, 30]],
      [[47, 29], [47, 30]],
      [[58, 29], [58, 30]],
      [[23, 42], [70, 42]],
      [[23, 42], [23, 45]],
      [[44, 42], [44, 43]],
      // Includes FOUR water cells: x=51, y=34..37. One-lane WOOD bridge.
      [[51, 30], [51, 42]],
    ],
    contract: { wood: 0, planks: 24, grain: 0, flour: 0, bread: 16 },
    deadlineMin: 11, star3Min: 7, star2Min: 9,
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
    deadlineMin: 12, star3Min: 8, star2Min: 10,
  },
};

// Deterministic, visible to the UI through state.rain (20s to 700s).
// Do not fake a MUD_SLOW wagon status: no such status exists in the current sim.
export const M3_RAIN = [{ start: 20 * TICK_HZ, end: 700 * TICK_HZ }];

// Stand-alone factory only for the proposal's bots: it uses the real sim commands,
// production, dispatcher and step(). It does NOT mutate MISSIONS or terrainFor().
export function createProposedWorld(id: ProposedMissionId, seedOverride?: number): World {
  const def = PROPOSED_MISSIONS[id];
  const seed = seedOverride ?? def.seed;
  const valley = id === 'm2' ? M2_VALLEY : M3_VALLEY;
  const terrain = generateValley({ ...valley, seed });
  const n = terrain.w * terrain.h;
  const state: SimState = {
    version: STATE_VERSION, mapId: def.mapId, seed, tick: 0,
    rng: seedRng(seed),
    coins: def.coins,
    roads: Array<number>(n).fill(0),
    netVersion: 1,
    traffic: Array<number>(n).fill(0),
    buildings: [], wagons: [], nextId: 1,
    rain: id === 'm3' ? M3_RAIN.map((r) => ({ ...r })) : [],
    mission: { id: def.id, contract: null, result: 'running', endTick: -1 },
    ledger: { produced: emptyGoods(), consumed: emptyGoods(), destroyed: emptyGoods() },
  };
  const world: World = { terrain, state, cache: null, scratch: null };

  for (const p of def.buildings) {
    const placed = place(world, p.type, p.x, p.y, p.facing, true);
    if (!placed.ok) {
      throw new Error(`${id}: cannot place ${p.type} at (${p.x},${p.y}): ${JSON.stringify(placed.err)}`);
    }
    const building = state.buildings[state.buildings.length - 1]!;
    if (p.stock) {
      for (const [good, qty] of Object.entries(p.stock) as [keyof GoodMap, number][]) {
        building.stock[good] += qty;
        state.ledger.produced[good] += qty;
      }
    }
  }

  // IMPORTANT: unlike the existing m1 initializer, keep water cells. An authored
  // bridge is a road ON water and must exist before the first simulation tick.
  for (const pts of def.roads) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!, b = pts[i]!;
      const start = a[1] * terrain.w + a[0], end = b[1] * terrain.w + b[0];
      for (const cell of lineCells(terrain.w, start, end)) {
        state.roads[cell] = 1;
      }
    }
  }
  state.netVersion++;

  const stable = state.buildings.find((b) => b.type === 'stable');
  if (!stable) throw new Error(`${id}: stable missing`);
  for (let i = 0; i < def.wagons; i++) spawnWagon(world, stable.id);

  const castle = state.buildings.find((b) => b.type === 'castle');
  if (!castle || !def.contract) throw new Error(`${id}: contract/castle missing`);
  state.mission.contract = {
    need: { ...def.contract }, castle: castle.id,
    deadlineTick: def.deadlineMin * 60 * TICK_HZ,
    star3Tick: def.star3Min * 60 * TICK_HZ,
    star2Tick: def.star2Min * 60 * TICK_HZ,
  };
  return world;
}
