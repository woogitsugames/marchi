// Mission definitions: map spec, pre-placed buildings and roads, contract.
import { STATE_VERSION, TICK_HZ, emptyGoods } from './defs';
import { lineCells, place, spawnWagon } from './commands';
import { nextInt, seedRng } from './rng';
import { generateValley, type ValleySpec } from './terrain';
import { M2_VALLEY, M3_VALLEY, PROPOSED_MISSIONS } from './missions-proposed';
import type { World } from './network';
import type { BuildingType, GoodMap, RainSpell, SimState, Terrain } from './types';

export const VALLEY_W = 96;
export const VALLEY_H = 72;

export function valleySpec(seed: number): ValleySpec {
  return {
    w: VALLEY_W,
    h: VALLEY_H,
    seed,
    waterLevel: 10,
    spacing: 12,
    riverY: [29, 31, 34, 35.5, 35, 34, 35.5, 38, 40],
    riverHalfWidth: [2.2, 2.0, 1.8, 1.45, 1.35, 1.6, 2.0, 2.2, 2.4],
    hills: [
      { x: 78, y: 54, r: 18, h: 5 },
      { x: 8, y: 60, r: 14, h: 4 },
    ],
    northRidge: 9,
    southRidge: 64,
    forestNorthOf: 21,
    fields: [
      { x: 10, y: 44, w: 8, h: 12 },
      { x: 22, y: 50, w: 10, h: 8 },
    ],
  };
}

/** Map id -> valley spec for a seed. */
const MAP_SPECS: Record<string, (seed: number) => ValleySpec> = {
  valley1: valleySpec,
  'valley-m2': (seed) => ({ ...M2_VALLEY, seed }),
  'valley-m3': (seed) => ({ ...M3_VALLEY, seed }),
};

const terrainCache = new Map<string, Terrain>();

export function terrainFor(mapId: string, seed: number): Terrain {
  const key = mapId + ':' + seed;
  let t = terrainCache.get(key);
  if (!t) {
    const spec = MAP_SPECS[mapId];
    if (!spec) throw new Error('unknown map ' + mapId);
    t = generateValley(spec(seed));
    terrainCache.set(key, t);
  }
  return t;
}

interface Placement { type: BuildingType; x: number; y: number; facing: number; stock?: Partial<GoodMap> }

export interface MissionDef {
  id: string;
  mapId: string;
  seed: number;
  coins: number;
  wagons: number;
  buildings: Placement[];
  /** Road polylines as waypoint lists [x,y][]. */
  roads: [number, number][][];
  contract: GoodMap | null;
  deadlineMin: number;
  star3Min: number;
  star2Min: number;
  /** Fixed weather instead of the seeded rain schedule. */
  rain?: RainSpell[];
  /** Authored roads keep their water cells (pre-built bridges). */
  roadsOverWater?: boolean;
}

export const MISSIONS: Record<string, MissionDef> = {
  m1: {
    id: 'm1',
    mapId: 'valley1',
    seed: 1301,
    coins: 180,
    wagons: 2,
    buildings: [
      { type: 'woodcutter', x: 14, y: 13, facing: 0, stock: { wood: 2 } },
      { type: 'sawmill', x: 28, y: 20, facing: 0 },
      { type: 'stable', x: 46, y: 21, facing: 0 },
      { type: 'farm', x: 18, y: 46, facing: 2, stock: { grain: 3 } },
      { type: 'mill', x: 42, y: 37, facing: 0 },
      { type: 'bakery', x: 54, y: 46, facing: 2 },
      { type: 'warehouse', x: 62, y: 46, facing: 2 },
      { type: 'castle', x: 77, y: 50, facing: 3 },
    ],
    roads: [
      [[15, 15], [15, 24], [56, 24]],
      [[29, 22], [29, 24]],
      [[47, 23], [47, 24]],
      [[12, 44], [70, 44], [72, 46], [72, 52], [76, 52]],
      [[19, 45], [19, 44]],
      [[43, 39], [43, 44]],
    ],
    contract: { wood: 0, planks: 30, grain: 0, flour: 0, bread: 20 },
    deadlineMin: 12,
    star3Min: 7,
    star2Min: 9,
  },
  sandbox: {
    id: 'sandbox',
    mapId: 'valley1',
    seed: 1301,
    coins: 600,
    wagons: 4,
    buildings: [],
    roads: [],
    contract: null,
    deadlineMin: 0,
    star3Min: 0,
    star2Min: 0,
  },
};
MISSIONS.m2 = PROPOSED_MISSIONS.m2;
MISSIONS.m3 = PROPOSED_MISSIONS.m3;
MISSIONS.sandbox!.buildings = MISSIONS.m1!.buildings;
MISSIONS.sandbox!.roads = MISSIONS.m1!.roads;

function rainSpells(rng: SimState['rng']): RainSpell[] {
  const out: RainSpell[] = [];
  let t = nextInt(rng, 150, 240) * TICK_HZ;
  for (let i = 0; i < 12; i++) {
    const len = nextInt(rng, 60, 130) * TICK_HZ;
    out.push({ start: t, end: t + len });
    t += len + nextInt(rng, 150, 330) * TICK_HZ;
  }
  return out;
}

export function buildMission(missionId: string, seedOverride?: number): { terrain: Terrain; state: SimState } {
  const def = MISSIONS[missionId];
  if (!def) throw new Error('unknown mission ' + missionId);
  const seed = seedOverride ?? def.seed;
  const terrain = terrainFor(def.mapId, seed);
  const rng = seedRng(seed);
  const n = terrain.w * terrain.h;
  const state: SimState = {
    version: STATE_VERSION,
    mapId: def.mapId,
    seed,
    tick: 0,
    rng,
    coins: def.coins,
    roads: new Array(n).fill(0),
    netVersion: 1,
    traffic: new Array(n).fill(0),
    buildings: [],
    wagons: [],
    nextId: 1,
    rain: [],
    mission: { id: def.id, contract: null, result: 'running', endTick: -1 },
    ledger: { produced: emptyGoods(), consumed: emptyGoods(), destroyed: emptyGoods(), stallSeconds: {} },
  };
  state.rain = rainSpells(state.rng);
  if (def.rain) state.rain = def.rain.map((r) => ({ ...r }));
  const world: World = { terrain, state, cache: null, scratch: null };
  for (const p of def.buildings) {
    const r = place(world, p.type, p.x, p.y, p.facing, true);
    if (!r.ok) throw new Error(`mission ${def.id}: cannot place ${p.type} at ${p.x},${p.y}: ${JSON.stringify(r.err)}`);
    const b = state.buildings[state.buildings.length - 1]!;
    if (p.stock) {
      for (const [g, v] of Object.entries(p.stock) as [keyof GoodMap, number][]) {
        b.stock[g] += v;
        state.ledger.produced[g] += v; // initial stock counts as produced (conservation)
      }
    }
  }
  for (const poly of def.roads) {
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1]!, b = poly[i]!;
      for (const c of lineCells(terrain.w, a[1] * terrain.w + a[0], b[1] * terrain.w + b[0])) {
        if (!state.roads[c] && (def.roadsOverWater || !terrain.water[c])) state.roads[c] = 1;
      }
    }
  }
  state.netVersion++;
  const stable = state.buildings.find((b) => b.type === 'stable');
  if (stable) for (let i = 0; i < def.wagons; i++) spawnWagon(world, stable.id);
  const castle = state.buildings.find((b) => b.type === 'castle');
  if (def.contract && castle) {
    state.mission.contract = {
      need: { ...def.contract },
      castle: castle.id,
      deadlineTick: def.deadlineMin * 60 * TICK_HZ,
      star3Tick: def.star3Min * 60 * TICK_HZ,
      star2Tick: def.star2Min * 60 * TICK_HZ,
    };
  }
  return { terrain, state };
}
