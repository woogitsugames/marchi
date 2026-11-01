// Read-only helpers that turn state into explanations: cause chains, ETAs, time of day.
import { DAY_TICKS, LOAD_TICKS, START_DAY_FRACTION, TICK_HZ, UNLOAD_TICKS } from './defs';
import { buildingById } from './logistics';
import { cellSpeed, edgeLength, edgeSpeedAt, findPath, grade, isRaining, pathTime, slopeFactor, type World } from './network';
import type { BuildingStatus, Wagon, WagonStatus } from './types';

export type ReasonLink =
  | { kind: 'building'; id: number; status: BuildingStatus }
  | { kind: 'wagon'; id: number; status: WagonStatus };

function wagonById(world: World, id: number): Wagon | null {
  for (const w of world.state.wagons) if (w.id === id) return w;
  return null;
}

/** Follow the cause of a building's state upstream, e.g. bakery -> mill -> farm (no road). */
export function explainBuilding(world: World, id: number, maxDepth = 5): ReasonLink[] {
  const chain: ReasonLink[] = [];
  const seen = new Set<string>();
  let cur: { kind: 'building' | 'wagon'; id: number } | null = { kind: 'building', id };
  while (cur && chain.length < maxDepth) {
    const key = cur.kind + cur.id;
    if (seen.has(key)) break;
    seen.add(key);
    if (cur.kind === 'building') {
      const b = buildingById(world, cur.id);
      if (!b) break;
      chain.push({ kind: 'building', id: b.id, status: b.status });
      cur = nextFromBuilding(b.status);
    } else {
      const w = wagonById(world, cur.id);
      if (!w) break;
      chain.push({ kind: 'wagon', id: w.id, status: w.status });
      cur = nextFromWagon(w.status);
    }
  }
  return chain;
}

export function explainWagon(world: World, id: number, maxDepth = 4): ReasonLink[] {
  const w = wagonById(world, id);
  if (!w) return [];
  const first: ReasonLink = { kind: 'wagon', id, status: w.status };
  const nxt = nextFromWagon(w.status);
  if (!nxt) return [first];
  const rest = nxt.kind === 'building' ? explainBuilding(world, nxt.id, maxDepth - 1) : explainWagon(world, nxt.id, maxDepth - 1);
  return [first, ...rest.filter((r) => !(r.kind === 'wagon' && r.id === id))];
}

function nextFromBuilding(s: BuildingStatus): { kind: 'building' | 'wagon'; id: number } | null {
  switch (s.k) {
    case 'NO_INPUT': return s.blockedBy >= 0 ? { kind: 'building', id: s.blockedBy } : null;
    case 'WAITING_DELIVERY': return { kind: 'wagon', id: s.wagon };
    case 'WAITING_PICKUP': return { kind: 'wagon', id: s.wagon };
    case 'OUTPUT_FULL': return s.blockedBy >= 0 ? { kind: 'building', id: s.blockedBy } : null;
    default: return null;
  }
}

function nextFromWagon(s: WagonStatus): { kind: 'building' | 'wagon'; id: number } | null {
  if (s.k === 'BRIDGE_JAM') return { kind: 'wagon', id: s.blocker };
  if (s.k === 'NO_ROUTE' && s.target >= 0) return { kind: 'building', id: s.target };
  return null;
}

export interface Eta {
  /** Seconds until the wagon reaches its current destination node. */
  toDest: number;
  /** Seconds until the current job is delivered (or toDest when there is no job). */
  toFinish: number;
  /** Building the wagon is heading to (-1 home/none). */
  destBuilding: number;
}

/** Estimated times for a wagon at current conditions; null when it has no route. */
export function wagonEta(world: World, wagonId: number): Eta | null {
  const w = wagonById(world, wagonId);
  if (!w) return null;
  if (w.status.k === 'NO_ROUTE') return null;
  const rain = isRaining(world.state);
  const loaded = w.cargoQty > 0;
  let t = w.busyTicks / TICK_HZ;
  let node = w.at;
  if (w.next >= 0) {
    const len = edgeLength(world.terrain, w.at, w.next);
    t += (len - w.edgeT) / edgeSpeedAt(world, w.at, w.next, 0.5, loaded, rain);
    node = w.next;
  }
  if (w.dest >= 0 && node !== w.dest) {
    const p = w.pathVer === world.state.netVersion && w.path.length > 0 && w.path[w.path.length - 1] === w.dest
      ? w.path : findPath(world, node, w.dest, loaded);
    if (!p) return null;
    t += pathTime(world, node, p, loaded);
  }
  const toDest = t;
  let toFinish = t;
  let destBuilding = -1;
  const j = w.job;
  if (j) {
    destBuilding = j.phase === 'pickup' ? j.from : j.to;
    if (j.phase === 'pickup') {
      const from = buildingById(world, j.from), to = buildingById(world, j.to);
      if (from && to) {
        const p = findPath(world, from.gate, to.gate, true);
        if (p) toFinish += (w.busyTicks > 0 ? 0 : LOAD_TICKS / TICK_HZ) + pathTime(world, from.gate, p, true) + UNLOAD_TICKS / TICK_HZ;
      }
    } else if (w.busyTicks === 0) {
      toFinish += UNLOAD_TICKS / TICK_HZ;
    }
  }
  return { toDest, toFinish, destBuilding };
}

/** 0..1, 0 = midnight, 0.25 = dawn-ish, 0.5 = noon. */
export function timeOfDay(world: World): number {
  const f = START_DAY_FRACTION + world.state.tick / DAY_TICKS;
  return f - Math.floor(f);
}

export interface Slowdown {
  /** Surface under the wagon right now. */
  surface: 'dirt' | 'cobble' | 'woodBridge' | 'stoneBridge';
  raining: boolean;
  /** True when rain turns the current dirt track into mud. */
  mud: boolean;
  /** Current speed divided by the dry, flat speed of the same surface (1 = no slowdown). */
  factor: number;
  /** Grade of the current edge, positive uphill. */
  grade: number;
}

/**
 * Why a moving wagon is slow (mud, slope), for the wagon card. Moving slowly is not a stall,
 * so this is not a WagonStatus — it is an explanation the UI shows next to the ETA.
 */
export function wagonSlowdown(world: World, wagonId: number): Slowdown | null {
  const w = wagonById(world, wagonId);
  if (!w) return null;
  const a = w.at, b = w.next >= 0 ? w.next : w.at;
  const cell = w.next >= 0 && w.edgeT / Math.max(1e-6, edgeLength(world.terrain, a, b)) >= 0.5 ? b : a;
  const water = world.terrain.water[cell] === 1;
  const cobble = world.state.roads[cell] === 2;
  const surface = water ? (cobble ? 'stoneBridge' : 'woodBridge') : cobble ? 'cobble' : 'dirt';
  const raining = isRaining(world.state);
  const g = a !== b ? grade(world.terrain, a, b) : 0;
  const dry = cellSpeed(world, cell, false);
  const now = cellSpeed(world, cell, raining) * slopeFactor(g, w.cargoQty > 0);
  return { surface, raining, mud: raining && surface === 'dirt', factor: now / dry, grade: g };
}
