// Road network: derived caches, edge validity, travel times, bridge spans, pathfinding.
import {
  MAX_GRADE, RAIN_COBBLE, RAIN_DIRT, RAIN_WOOD_BRIDGE, SLOPE_K_DOWN, SLOPE_K_EMPTY, SLOPE_K_LOADED,
  SPEED_COBBLE, SPEED_DIRT, SPEED_STONE_BRIDGE, SPEED_WOOD_BRIDGE, TICK_HZ,
} from './defs';
import { bridgeIceUntil, thawing } from './seasons';
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
  /** Lazily built edge travel times per (loaded, rain, thaw) variant, index cell*8+dir, Infinity = no edge. */
  costs: (Float64Array | null)[];
  /**
   * Lazily built connected-component label per cell over `edgeMask` (-1 off the road network), see
   * `reachable`. Labels are the minimal cell index of each component.
   */
  comp: Int32Array | null;
  /** Lazily built road adjacency for `dijkstra`, see `adjacency`. */
  adj?: Adjacency | null;
}

/**
 * Compressed neighbour lists over `edgeMask` (D-337): for cell u, entries adjStart[u]..adjStart[u+1]-1
 * in direction order 0..7, each with the neighbour cell and the cost-table index of the forward edge
 * u -> v (u*8+d) and of the reverse edge v -> u (v*8+OPP[d]). A direction is listed when either edge
 * exists; a missing one still reads Infinity from the cost table, so the search sees exactly the edges
 * the full 8-direction scan saw, in the same order.
 */
interface Adjacency {
  start: Int32Array;
  node: Int32Array;
  fwd: Int32Array;
  rev: Int32Array;
}

function adjacency(world: World, c: NetCache): Adjacency {
  if (c.adj) return c.adj;
  const w = world.terrain.w, h = world.terrain.h, n = w * h, mask = c.edgeMask;
  const start = new Int32Array(n + 1);
  const node: number[] = [], fwd: number[] = [], rev: number[] = [];
  for (let u = 0; u < n; u++) {
    start[u] = node.length;
    const ux = u % w, uy = (u - ux) / w;
    for (let d = 0; d < 8; d++) {
      const vx = ux + DX[d]!, vy = uy + DY[d]!;
      if (vx < 0 || vy < 0 || vx >= w || vy >= h) continue;
      const v = vy * w + vx;
      if (!mask[u * 8 + d] && !mask[v * 8 + OPP[d]!]) continue;
      node.push(v); fwd.push(u * 8 + d); rev.push(v * 8 + OPP[d]!);
    }
  }
  start[n] = node.length;
  c.adj = { start, node: Int32Array.from(node), fwd: Int32Array.from(fwd), rev: Int32Array.from(rev) };
  return c.adj;
}

/** Opposite direction index for DX/DY. */
export const OPP = [2, 3, 0, 1, 6, 7, 4, 5];

export interface World {
  terrain: Terrain;
  state: SimState;
  cache: NetCache | null;
  /**
   * The seasonal calendar runs in this world (free valley, D-33). Derived from the mission definition
   * when the world is built or loaded, like the terrain; never saved. Missing = false.
   */
  seasons?: boolean;
  /** Derived per-tick bridge queue penalties (seconds per span). Not saved; recomputed from state. */
  queue?: { tick: number; ver: number; penalty: Map<number, number> } | null;
  /** Scratch buffers for pathfinding (reused). */
  scratch: PathScratch | null;
  /**
   * Recycled dist/prev arrays for non-scratch Dijkstra results (`releaseDistMap`). Derived, never saved;
   * a released map's arrays are overwritten by a later `dijkstra` call.
   */
  distPool?: { dist: Float64Array[]; prev: Int32Array[] };
  /** Memoized full Dijkstra results across ticks (`dijkstraMemo`). Derived, never saved. */
  distMemo?: DistMemo | null;
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
  world.cache = { ver: st.netVersion, occupied, gateOf, span, edgeMask: new Uint8Array(n * 8), costs: [null, null, null, null, null, null, null, null], comp: null };
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

/**
 * Edge cost table for a (loaded, rain, thaw) variant, cached until the network changes. Thaw has its
 * own variants (it slows only land dirt roads, rain also slows cobble and wooden bridges).
 */
export function edgeCosts(world: World, loaded: boolean, rain: boolean, thaw = false): Float64Array {
  const c = net(world);
  const k = (loaded ? 1 : 0) + (rain ? 2 : 0) + (thaw ? 4 : 0);
  let tab = c.costs[k];
  if (tab) return tab;
  const w = world.terrain.w, n = w * world.terrain.h;
  tab = new Float64Array(n * 8).fill(Infinity);
  for (let i = 0; i < n; i++) {
    if (!world.state.roads[i]) continue;
    const x = i % w, y = (i - x) / w;
    for (let d = 0; d < 8; d++) {
      if (!c.edgeMask[i * 8 + d]) continue;
      tab[i * 8 + d] = edgeTime(world, i, (y + DY[d]!) * w + x + DX[d]!, loaded, rain, thaw);
    }
  }
  c.costs[k] = tab;
  return tab;
}

/**
 * Is there any drivable path a -> b? Same answer as `dijkstra(world, a, ...).dist[b] < Infinity` for
 * every direction, load, weather and queue/ice state: edges are symmetric (`hasEdge` is), every edge
 * in `edgeMask` has a finite cost (bridge queue and ice only add finite seconds), and a start off the
 * roads reaches nothing. Component labels are computed once per network version. If one-way edges or
 * impassable-but-present edges ever appear, this must become a directed search.
 */
export function reachable(world: World, a: number, b: number): boolean {
  const comp = components(world);
  return comp[a]! !== -1 && comp[a] === comp[b];
}

function components(world: World): Int32Array {
  const c = net(world);
  if (c.comp) return c.comp;
  const w = world.terrain.w, n = w * world.terrain.h;
  const roads = world.state.roads, mask = c.edgeMask;
  const comp = new Int32Array(n).fill(-1);
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    if (comp[i] !== -1 || !roads[i]) continue;
    comp[i] = i;
    stack.push(i);
    while (stack.length) {
      const u = stack.pop()!;
      const ux = u % w, uy = (u - ux) / w;
      for (let d = 0; d < 8; d++) {
        if (!mask[u * 8 + d]) continue;
        const v = (uy + DY[d]!) * w + ux + DX[d]!;
        if (comp[v] === -1) { comp[v] = i; stack.push(v); }
      }
    }
  }
  c.comp = comp;
  return comp;
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

/**
 * Speed (m/s) on a cell. `thaw` (spring, free valley) turns land dirt roads to mud like rain does;
 * when both apply the dirt factor counts once. Cobble and both bridge kinds ignore the thaw.
 */
export function cellSpeed(world: World, c: number, rain: boolean, thaw = false): number {
  const surf = world.state.roads[c];
  const water = world.terrain.water[c] === 1;
  if (water) return surf === 2 ? SPEED_STONE_BRIDGE : SPEED_WOOD_BRIDGE * (rain ? RAIN_WOOD_BRIDGE : 1);
  if (surf === 2) return SPEED_COBBLE * (rain ? RAIN_COBBLE : 1);
  return SPEED_DIRT * (rain || thaw ? RAIN_DIRT : 1);
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
export function edgeSpeedAt(world: World, a: number, b: number, frac: number, loaded: boolean, rain: boolean, thaw = false): number {
  const v = frac < 0.5 ? cellSpeed(world, a, rain, thaw) : cellSpeed(world, b, rain, thaw);
  return v * slopeFactor(grade(world.terrain, a, b), loaded);
}

/** Travel time in seconds for the whole edge a -> b. */
export function edgeTime(world: World, a: number, b: number, loaded: boolean, rain: boolean, thaw = false): number {
  const len = edgeLength(world.terrain, a, b);
  const sf = slopeFactor(grade(world.terrain, a, b), loaded);
  return (len * 0.5) / (cellSpeed(world, a, rain, thaw) * sf) + (len * 0.5) / (cellSpeed(world, b, rain, thaw) * sf);
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

/** Keep at most this many spare dist/prev pairs per world (a dispatch uses up to ~30). */
const DIST_POOL_MAX = 64;

/**
 * Hand a `dijkstra` result (reuse=false) back for recycling. The caller must not read `m` afterwards:
 * the next `dijkstra` call overwrites its arrays.
 */
export function releaseDistMap(world: World, m: DistMap): void {
  const p = world.distPool ?? (world.distPool = { dist: [], prev: [] });
  if (p.dist.length < DIST_POOL_MAX) { p.dist.push(m.dist); p.prev.push(m.prev); }
}

/**
 * Dijkstra over road cells from `start`. reverse=false: dist[x] = time start -> x.
 * reverse=true: dist[x] = time x -> start. Stops early when `stopAt` is settled.
 */
export function dijkstra(world: World, start: number, reverse: boolean, loaded: boolean, stopAt = -1, reuse = false): DistMap {
  const n = world.terrain.w * world.terrain.h;
  const sc = scratch(world);
  // reuse=true: results live in shared scratch buffers (valid until the next reuse call) — no allocation
  // reuse=false: own arrays, recycled from `releaseDistMap` when available (same contents after fill)
  const pool = reuse ? undefined : world.distPool;
  let pd = pool?.dist.pop(), pp = pool?.prev.pop();
  if (pd && pd.length !== n) pd = undefined;
  if (pp && pp.length !== n) pp = undefined;
  const dist = reuse ? sc.dist : pd ?? new Float64Array(n);
  const prev = reuse ? sc.prev : pp ?? new Int32Array(n);
  search(world, sc, start, reverse, loaded, stopAt, dist, prev);
  return { dist, prev };
}

/** The search itself, into `dist` / `prev` (filled here: Infinity / -1 before the start). */
function search(world: World, sc: PathScratch, start: number, reverse: boolean, loaded: boolean, stopAt: number, dist: Float64Array, prev: Int32Array): void {
  dist.fill(Infinity);
  prev.fill(-1);
  if (!world.state.roads[start]) return;
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
  const costs = edgeCosts(world, loaded, rain, thawing(world));
  const pen = spanPenalties(world);
  const nc = net(world);
  const spanOf = nc.span;
  const adj = adjacency(world, nc);
  const aStart = adj.start, aNode = adj.node, aCost = reverse ? adj.rev : adj.fwd;
  const until = bridgeIceUntil(world);
  const iceLeft = until >= 0 ? (until - world.state.tick) / TICK_HZ : 0;
  const spans = pen.size > 0 || iceLeft > 0;
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
    const du = dist[u]!;
    for (let k = aStart[u]!, end = aStart[u + 1]!; k < end; k++) {
      const v = aNode[k]!;
      if (done[v] === mark) continue;
      let cost = costs[aCost[k]!]!;
      if (cost === Infinity) continue;
      if (spans) {
        // entering a span: forward u -> v, reverse the real move is v -> u
        const from = reverse ? v : u, to = reverse ? u : v;
        const sp = spanOf[to]!;
        if (sp >= 0 && spanOf[from] !== sp) {
          cost += pen.get(sp) ?? 0;
          // Ice: wait at the bridgehead until the thaw. Forward searches know the arrival time
          // (dist[u]); reverse searches do not and charge the whole remaining window.
          if (iceLeft > 0) cost += reverse ? iceLeft : Math.max(0, iceLeft - du);
        }
      }
      const nd = du + cost;
      if (nd < dist[v]!) {
        dist[v] = nd;
        prev[v] = u;
        push(v, nd);
      }
    }
  }
}

/**
 * Everything a full `dijkstra` result depends on besides (start, reverse, loaded): the network
 * (edge mask and cost tables live in the `NetCache` object, rebuilt on every netVersion), rain and
 * thaw (cost table variant) and the bridge queue penalties (by content). Bridge ice makes the result
 * tick-dependent, so nothing is memoized while it lasts.
 */
interface DistMemo {
  net: NetCache;
  rain: boolean;
  thaw: boolean;
  /** Penalties as sorted "span:seconds" pairs, see `penaltyKey`. */
  pen: string;
  /** The `spanPenalties` map `pen` was read from (same object = same content, no re-read needed). */
  penMap: Map<number, number>;
  /** Distance arrays by start*4 + reverse*2 + loaded (only `dist`: no memo reader walks `prev`). */
  maps: Map<number, Float64Array>;
  /** Arrays of flushed generations, reused for new entries. */
  spare: Float64Array[];
}

/** Keep at most this many memoized maps (55 KB each on a 96x72 map); beyond it callers compute their own. */
const DIST_MEMO_MAX = 64;

function penaltyKey(pen: Map<number, number>): string {
  if (pen.size === 0) return '';
  const spans = [...pen.keys()].sort((a, b) => a - b);
  let s = '';
  for (const sp of spans) s += sp + ':' + pen.get(sp) + ';';
  return s;
}

/**
 * The distances `dijkstra(world, start, reverse, loaded).dist` would return (full search, no stopAt), memoized while
 * the network, weather and bridge queues stay the same — most dispatch ticks repeat the previous one's
 * searches exactly (D-336). Returns null when the result cannot be memoized (bridge ice) or the memo is
 * full; the caller then runs `dijkstra` itself. The returned map is read-only, must never be released,
 * and must not be kept across calls that may change the world (a later call may recycle its arrays).
 */
export function dijkstraMemo(world: World, start: number, reverse: boolean, loaded: boolean): Float64Array | null {
  const st = world.state;
  // the same inputs `dijkstra` reads, read at the same moment (penalties are cached per tick)
  const until = bridgeIceUntil(world);
  if (until >= 0 && until - st.tick > 0) { flushMemo(world); return null; }
  const c = net(world), rain = isRaining(st), thaw = thawing(world), penMap = spanPenalties(world);
  let memo = world.distMemo;
  if (!memo || memo.net !== c || memo.rain !== rain || memo.thaw !== thaw || (memo.penMap !== penMap && memo.pen !== penaltyKey(penMap))) {
    const spare = flushMemo(world);
    memo = world.distMemo = { net: c, rain, thaw, pen: penaltyKey(penMap), penMap, maps: new Map(), spare };
  }
  memo.penMap = penMap;
  const key = start * 4 + (reverse ? 2 : 0) + (loaded ? 1 : 0);
  let m = memo.maps.get(key);
  if (m) return m;
  if (memo.maps.size >= DIST_MEMO_MAX) return null;
  const n = world.terrain.w * world.terrain.h;
  let out = memo.spare.pop();
  if (!out || out.length !== n) out = new Float64Array(n);
  // distances straight into the memo array; `prev` goes to the shared scratch (nobody reads it)
  search(world, scratch(world), start, reverse, loaded, -1, out, scratch(world).prev);
  memo.maps.set(key, out);
  return out;
}

/** Drop the memo and return its arrays for reuse (no memoized map is held across a context change). */
function flushMemo(world: World): Float64Array[] {
  const memo = world.distMemo;
  if (!memo) return [];
  for (const m of memo.maps.values()) memo.spare.push(m);
  world.distMemo = null;
  return memo.spare;
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
  const rain = isRaining(world.state), thaw = thawing(world);
  let t = 0, a = from;
  for (const b of path) {
    t += edgeTime(world, a, b, loaded, rain, thaw);
    a = b;
  }
  return t;
}
