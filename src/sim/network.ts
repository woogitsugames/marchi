// Road network: derived caches, edge validity, travel times, bridge spans, pathfinding.
import {
  MAX_GRADE, RAIN_COBBLE, RAIN_DIRT, RAIN_WOOD_BRIDGE, SLOPE_K_DOWN, SLOPE_K_EMPTY, SLOPE_K_LOADED,
  SPEED_COBBLE, SPEED_DIRT, SPEED_STONE_BRIDGE, SPEED_WOOD_BRIDGE, TICK_HZ,
} from './defs';
import { iceUntil } from './contract';
import type { SimState, Terrain } from './types';

export const DX = [1, 0, -1, 0, 1, -1, -1, 1];
export const DY = [0, 1, 0, -1, 1, 1, -1, -1];

/** Derived data rebuilt when state.netVersion changes. Not part of the saved state. */
export interface NetCache {
  ver: number;
  /** cell -> building id occupying the footprint, -1 otherwise (gates are not occupied). */
  occupied: Int32Array;
  /** cell -> building id whose gate it is, -1 otherwise. */
  gateOf: Int32Array;
  /** cell -> wooden bridge span id (min cell index of the span), -1 otherwise. */
  span: Int32Array;
  /** cell*8+dir -> 1 when the edge cell -> neighbour(dir) is drivable. */
  edgeMask: Uint8Array;
  /** Lazily built edge travel times per (loaded, rain) variant, index cell*8+dir, Infinity = no edge. */
  costs: (Float64Array | null)[];
}

/** Opposite direction index for DX/DY. */
export const OPP = [2, 3, 0, 1, 6, 7, 4, 5];

export interface World {
  terrain: Terrain;
  state: SimState;
  cache: NetCache | null;
  /** Derived per-tick bridge queue penalties (seconds per span). Not saved; recomputed from state. */
  queue?: { tick: number; ver: number; penalty: Map<number, number> } | null;
  /** Scratch buffers for pathfinding (reused). */
  scratch: PathScratch | null;
}

export function net(world: World): NetCache {
  const st = world.state;
  if (world.cache && world.cache.ver === st.netVersion) return world.cache;
  const { w, h } = world.terrain;
  const n = w * h;
  const occupied = new Int32Array(n).fill(-1);
  const gateOf = new Int32Array(n).fill(-1);
  for (const b of st.buildings) {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) occupied[y * w + x] = b.id;
    gateOf[b.gate] = b.id;
  }
  const span = new Int32Array(n).fill(-1);
  const water = world.terrain.water;
  for (let i = 0; i < n; i++) {
    if (span[i] !== -1 || !water[i] || st.roads[i] !== 1) continue;
    // flood fill wooden bridge cells (8-neighbourhood: a diagonal bridge is one span, see review F-01); i is the minimal index of its span
    const stack = [i];
    span[i] = i;
    while (stack.length) {
      const c = stack.pop()!;
      const cx = c % w, cy = (c - cx) / w;
      for (let d = 0; d < 8; d++) {
        const nx = cx + DX[d]!, ny = cy + DY[d]!;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (span[j] === -1 && water[j] && st.roads[j] === 1) {
          span[j] = i;
          stack.push(j);
        }
      }
    }
  }
  world.cache = { ver: st.netVersion, occupied, gateOf, span, edgeMask: new Uint8Array(n * 8), costs: [null, null, null, null] };
  const mask = world.cache.edgeMask;
  for (let i = 0; i < n; i++) {
    if (!st.roads[i]) continue;
    const x = i % w, y = (i - x) / w;
    for (let d = 0; d < 8; d++) {
      const nx = x + DX[d]!, ny = y + DY[d]!;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (hasEdge(world, i, ny * w + nx)) mask[i * 8 + d] = 1;
    }
  }
  return world.cache;
}

/** Edge cost table for a (loaded, rain) variant, cached until the network changes. */
export function edgeCosts(world: World, loaded: boolean, rain: boolean): Float64Array {
  const c = net(world);
  const k = (loaded ? 1 : 0) + (rain ? 2 : 0);
  let tab = c.costs[k];
  if (tab) return tab;
  const w = world.terrain.w, n = w * world.terrain.h;
  tab = new Float64Array(n * 8).fill(Infinity);
  for (let i = 0; i < n; i++) {
    if (!world.state.roads[i]) continue;
    const x = i % w, y = (i - x) / w;
    for (let d = 0; d < 8; d++) {
      if (!c.edgeMask[i * 8 + d]) continue;
      tab[i * 8 + d] = edgeTime(world, i, (y + DY[d]!) * w + x + DX[d]!, loaded, rain);
    }
  }
  c.costs[k] = tab;
  return tab;
}

/** Expected extra seconds per wagon waiting at / crossing a one-lane bridge. */
export const QUEUE_SECONDS_WAITING = 9;
export const QUEUE_SECONDS_ON_SPAN = 4;

/**
 * Seconds a wagon should expect to lose entering each wooden one-lane span right now,
 * derived from wagons queued at it (BRIDGE_JAM) and wagons on it. Routing adds this when
 * a path enters a span, so a second bridge actually relieves the first.
 */
export function spanPenalties(world: World): Map<number, number> {
  const st = world.state;
  const q = world.queue;
  if (q && q.tick === st.tick && q.ver === st.netVersion) return q.penalty;
  const c = net(world);
  const penalty = new Map<number, number>();
  for (const wg of st.wagons) {
    let span = -1, secs = 0;
    if (wg.status.k === 'BRIDGE_JAM') { span = wg.status.span; secs = QUEUE_SECONDS_WAITING; }
    else if (wg.bridgeFrom >= 0) {
      span = c.span[wg.at]! >= 0 ? c.span[wg.at]! : wg.next >= 0 ? c.span[wg.next]! : -1;
      secs = QUEUE_SECONDS_ON_SPAN;
    }
    if (span >= 0) penalty.set(span, (penalty.get(span) ?? 0) + secs);
  }
  world.queue = { tick: st.tick, ver: st.netVersion, penalty };
  return penalty;
}

export function isRaining(st: SimState): boolean {
  for (const r of st.rain) if (st.tick >= r.start && st.tick < r.end) return true;
  return false;
}

export function cellSpeed(world: World, c: number, rain: boolean): number {
  const surf = world.state.roads[c];
  const water = world.terrain.water[c] === 1;
  if (water) return surf === 2 ? SPEED_STONE_BRIDGE : SPEED_WOOD_BRIDGE * (rain ? RAIN_WOOD_BRIDGE : 1);
  if (surf === 2) return SPEED_COBBLE * (rain ? RAIN_COBBLE : 1);
  return SPEED_DIRT * (rain ? RAIN_DIRT : 1);
}

/** Grade from a to b (positive uphill), using horizontal distance. */
export function grade(t: Terrain, a: number, b: number): number {
  const ax = a % t.w, ay = (a - ax) / t.w, bx = b % t.w, by = (b - bx) / t.w;
  const diag = ax !== bx && ay !== by;
  const horiz = t.cellSize * (diag ? Math.SQRT2 : 1);
  return (t.cellH[b]! - t.cellH[a]!) / horiz;
}

export function edgeLength(t: Terrain, a: number, b: number): number {
  const ax = a % t.w, ay = (a - ax) / t.w, bx = b % t.w, by = (b - bx) / t.w;
  const diag = ax !== bx && ay !== by;
  const horiz = t.cellSize * (diag ? Math.SQRT2 : 1);
  const dz = t.cellH[b]! - t.cellH[a]!;
  return Math.sqrt(horiz * horiz + dz * dz);
}

/** Is there a drivable edge a -> b (adjacent road cells, not cutting a building corner, not too steep)? */
export function hasEdge(world: World, a: number, b: number): boolean {
  const st = world.state, t = world.terrain;
  if (!st.roads[a] || !st.roads[b]) return false;
  const c = world.cache && world.cache.ver === st.netVersion ? world.cache : net(world);
  if (c.occupied[a] !== -1 || c.occupied[b] !== -1) return false;
  const ax = a % t.w, ay = (a - ax) / t.w, bx = b % t.w, by = (b - bx) / t.w;
  const ddx = bx - ax, ddy = by - ay;
  if (ddx < -1 || ddx > 1 || ddy < -1 || ddy > 1 || (ddx === 0 && ddy === 0)) return false;
  if (ddx !== 0 && ddy !== 0) {
    // diagonal: both orthogonal cells must be free of buildings
    if (c.occupied[ay * t.w + bx] !== -1 || c.occupied[by * t.w + ax] !== -1) return false;
  }
  return Math.abs(grade(t, a, b)) <= MAX_GRADE + 1e-9;
}

export function slopeFactor(g: number, loaded: boolean): number {
  if (g > 0) return 1 / (1 + (loaded ? SLOPE_K_LOADED : SLOPE_K_EMPTY) * g);
  return 1 / (1 - SLOPE_K_DOWN * g);
}

/** Speed (m/s) on the edge a -> b at fraction along it (blended half/half). */
export function edgeSpeedAt(world: World, a: number, b: number, frac: number, loaded: boolean, rain: boolean): number {
  const v = frac < 0.5 ? cellSpeed(world, a, rain) : cellSpeed(world, b, rain);
  return v * slopeFactor(grade(world.terrain, a, b), loaded);
}

/** Travel time in seconds for the whole edge a -> b. */
export function edgeTime(world: World, a: number, b: number, loaded: boolean, rain: boolean): number {
  const len = edgeLength(world.terrain, a, b);
  const sf = slopeFactor(grade(world.terrain, a, b), loaded);
  return (len * 0.5) / (cellSpeed(world, a, rain) * sf) + (len * 0.5) / (cellSpeed(world, b, rain) * sf);
}

// --- Pathfinding ------------------------------------------------------------

export interface PathScratch {
  dist: Float64Array;
  prev: Int32Array;
  heapNode: Int32Array;
  heapKey: Float64Array;
  stamp: Uint32Array;
  curStamp: number;
}

function scratch(world: World): PathScratch {
  const n = world.terrain.w * world.terrain.h;
  if (!world.scratch || world.scratch.dist.length !== n) {
    world.scratch = {
      dist: new Float64Array(n), prev: new Int32Array(n),
      heapNode: new Int32Array(n * 8 + 16), heapKey: new Float64Array(n * 8 + 16),
      stamp: new Uint32Array(n), curStamp: 0,
    };
  }
  return world.scratch;
}

export interface DistMap {
  /** Distances in seconds, Infinity when unreachable. */
  dist: Float64Array;
  prev: Int32Array;
}

/**
 * Dijkstra over road cells from `start`. reverse=false: dist[x] = time start -> x.
 * reverse=true: dist[x] = time x -> start. Stops early when `stopAt` is settled.
 */
export function dijkstra(world: World, start: number, reverse: boolean, loaded: boolean, stopAt = -1, reuse = false): DistMap {
  const t = world.terrain, w = t.w, h = t.h;
  const n = w * h;
  const sc = scratch(world);
  // reuse=true: results live in shared scratch buffers (valid until the next reuse call) — no allocation
  const dist = reuse ? sc.dist.fill(Infinity) : new Float64Array(n).fill(Infinity);
  const prev = reuse ? sc.prev.fill(-1) : new Int32Array(n).fill(-1);
  if (!world.state.roads[start]) return { dist, prev };
  const hn = sc.heapNode, hk = sc.heapKey;
  let size = 0;
  const push = (node: number, key: number) => {
    let i = size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hk[p]! < key || (hk[p] === key && hn[p]! < node)) break;
      hn[i] = hn[p]!; hk[i] = hk[p]!; i = p;
    }
    hn[i] = node; hk[i] = key;
  };
  const pop = (): number => {
    const top = hn[0]!;
    const ln = hn[--size]!, lk = hk[size]!;
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= size) break;
      if (c + 1 < size && (hk[c + 1]! < hk[c]! || (hk[c + 1] === hk[c] && hn[c + 1]! < hn[c]!))) c++;
      if (lk < hk[c]! || (lk === hk[c] && ln <= hn[c]!)) break;
      hn[i] = hn[c]!; hk[i] = hk[c]!; i = c;
    }
    hn[i] = ln; hk[i] = lk;
    return top;
  };
  const rain = isRaining(world.state);
  const costs = edgeCosts(world, loaded, rain);
  const pen = spanPenalties(world);
  const spanOf = net(world).span;
  const until = iceUntil(world.state);
  const iceLeft = until >= 0 ? (until - world.state.tick) / TICK_HZ : 0;
  dist[start] = 0;
  push(start, 0);
  sc.curStamp = (sc.curStamp + 1) >>> 0 || 1;
  const done = sc.stamp, mark = sc.curStamp;
  while (size > 0) {
    const key = hk[0]!;
    const u = pop();
    if (done[u] === mark) continue;
    if (key > dist[u]!) continue;
    done[u] = mark;
    if (u === stopAt) break;
    const ux = u % w, uy = (u - ux) / w;
    for (let d = 0; d < 8; d++) {
      const vx = ux + DX[d]!, vy = uy + DY[d]!;
      if (vx < 0 || vy < 0 || vx >= w || vy >= h) continue;
      const v = vy * w + vx;
      if (done[v] === mark) continue;
      let cost = reverse ? costs[v * 8 + OPP[d]!]! : costs[u * 8 + d]!;
      if (cost === Infinity) continue;
      if (pen.size > 0 || iceLeft > 0) {
        // entering a span: forward u -> v, reverse the real move is v -> u
        const from = reverse ? v : u, to = reverse ? u : v;
        const sp = spanOf[to]!;
        if (sp >= 0 && spanOf[from] !== sp) {
          cost += pen.get(sp) ?? 0;
          // Ice: wait at the bridgehead until the thaw. Forward searches know the arrival time
          // (dist[u]); reverse searches do not and charge the whole remaining window.
          if (iceLeft > 0) cost += reverse ? iceLeft : Math.max(0, iceLeft - dist[u]!);
        }
      }
      const nd = dist[u]! + cost;
      if (nd < dist[v]!) {
        dist[v] = nd;
        prev[v] = u;
        push(v, nd);
      }
    }
  }
  return { dist, prev };
}

/** Node list from `from` (exclusive) to `to` (inclusive), or null if unreachable. */
export function findPath(world: World, from: number, to: number, loaded: boolean): number[] | null {
  if (from === to) return [];
  const m = dijkstra(world, from, false, loaded, to, true);
  if (m.dist[to] === Infinity) return null;
  const out: number[] = [];
  for (let c = to; c !== from; c = m.prev[c]!) out.push(c);
  out.reverse();
  return out;
}

/** Time in seconds along a node path starting at `from`. */
export function pathTime(world: World, from: number, path: readonly number[], loaded: boolean): number {
  const rain = isRaining(world.state);
  let t = 0, a = from;
  for (const b of path) {
    t += edgeTime(world, a, b, loaded, rain);
    a = b;
  }
  return t;
}
