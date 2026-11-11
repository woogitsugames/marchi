// "Gap finder": the cheapest road (in silver) that would connect two road cells, so the
// "Why is it stalled?" panel can offer a concrete fix ("build a bridge here: 34 silver").
// Read-only: it never mutates the state. Uses the same rules as validateRoad (no building
// footprints, no cutting building corners, grade <= MAX_GRADE between consecutive cells).
import { COST_DIRT, COST_WOOD_BRIDGE, MAX_GRADE, inputGoods, outputGoods } from './defs';
import { DX, DY, dijkstra, grade, net, type World } from './network';
import type { Building } from './types';
import { contractsOf } from './contract';

export interface RoadSuggestion {
  /** Full contiguous cell path from `from` to `to`, existing road cells included (pass to a road command). */
  cells: number[];
  /** Silver for the new cells (dirt track, wooden bridge over water). */
  cost: number;
  /** Cells that are new (not yet road), for highlighting. */
  newCells: number[];
  /** Number of new water cells (a bridge). */
  bridgeCells: number;
}

/** Tiny cost for reusing existing road so the cheapest-in-silver path also prefers short detours. */
const EXISTING_ROAD = 0.01;

/**
 * Cheapest dirt road (wooden bridge over water) connecting road cell `from` to road cell `to`.
 * Returns null when no buildable connection exists. Dijkstra over the whole grid (6912 cells), so
 * call it on demand (when a panel opens), not every tick.
 */
export function suggestConnection(world: World, from: number, to: number): RoadSuggestion | null {
  const t = world.terrain, st = world.state, c = net(world);
  const W = t.w, H = t.h, n = W * H;
  if (from < 0 || to < 0 || from >= n || to >= n) return null;
  const cellCost = (i: number): number =>
    st.roads[i] ? EXISTING_ROAD : t.water[i] ? COST_WOOD_BRIDGE : COST_DIRT;
  const passable = (i: number): boolean => c.occupied[i] === -1;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  // simple binary heap
  const hn: number[] = [], hk: number[] = [];
  const push = (node: number, key: number): void => {
    let i = hn.length; hn.push(node); hk.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hk[p]! < key || (hk[p] === key && hn[p]! < node)) break;
      hn[i] = hn[p]!; hk[i] = hk[p]!; i = p;
    }
    hn[i] = node; hk[i] = key;
  };
  const pop = (): number => {
    const top = hn[0]!;
    const ln = hn.pop()!, lk = hk.pop()!;
    if (hn.length > 0) {
      let i = 0;
      for (;;) {
        let ch = 2 * i + 1;
        if (ch >= hn.length) break;
        if (ch + 1 < hn.length && (hk[ch + 1]! < hk[ch]! || (hk[ch + 1] === hk[ch] && hn[ch + 1]! < hn[ch]!))) ch++;
        if (lk < hk[ch]! || (lk === hk[ch] && ln <= hn[ch]!)) break;
        hn[i] = hn[ch]!; hk[i] = hk[ch]!; i = ch;
      }
      hn[i] = ln; hk[i] = lk;
    }
    return top;
  };
  dist[from] = 0;
  push(from, 0);
  while (hn.length > 0) {
    const u = pop();
    if (done[u]) continue;
    done[u] = 1;
    if (u === to) break;
    const ux = u % W, uy = (u - ux) / W;
    for (let d = 0; d < 8; d++) {
      const vx = ux + DX[d]!, vy = uy + DY[d]!;
      if (vx < 0 || vy < 0 || vx >= W || vy >= H) continue;
      const v = vy * W + vx;
      if (done[v] || !passable(v)) continue;
      if (d >= 4 && (c.occupied[uy * W + vx] !== -1 || c.occupied[vy * W + ux] !== -1)) continue;
      if (Math.abs(grade(t, u, v)) > MAX_GRADE + 1e-9) continue;
      const nd = dist[u]! + cellCost(v);
      if (nd < dist[v]!) { dist[v] = nd; prev[v] = u; push(v, nd); }
    }
  }
  if (dist[to] === Infinity) return null;
  const cells: number[] = [];
  for (let x = to; x !== -1; x = prev[x]!) cells.push(x);
  cells.reverse();
  const newCells = cells.filter((i) => !st.roads[i]);
  let cost = 0, bridgeCells = 0;
  for (const i of newCells) {
    if (t.water[i]) { cost += COST_WOOD_BRIDGE; bridgeCells++; } else cost += COST_DIRT;
  }
  return { cells, cost, newCells, bridgeCells };
}

/**
 * D-713: when `suggestConnection(from, to)` finds nothing, the building whose footprint closes the way: the same road
 * rules, but a cell of a building `removable` accepts is passable at a high price (taking it back is the last resort),
 * so the cheapest such path crosses as few buildings as it can. The first such building from `from`, or -1 (a
 * connection exists, or none even through the removable buildings). Read-only; a whole-grid Dijkstra.
 */
export function blockingBuilding(world: World, from: number, to: number, removable: (id: number) => boolean): number {
  const t = world.terrain, st = world.state, c = net(world);
  const W = t.w, H = t.h, n = W * H;
  if (from < 0 || to < 0 || from >= n || to >= n) return -1;
  const THROUGH = 1000;
  const open = (i: number): boolean => c.occupied[i] === -1 || removable(c.occupied[i]!);
  const cellCost = (i: number): number =>
    (c.occupied[i] !== -1 ? THROUGH : 0) + (st.roads[i] ? EXISTING_ROAD : t.water[i] ? COST_WOOD_BRIDGE : COST_DIRT);
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const heap = new Heap();
  dist[from] = 0;
  heap.push(from, 0);
  while (heap.size > 0) {
    const u = heap.pop();
    if (done[u]) continue;
    done[u] = 1;
    if (u === to) break;
    const ux = u % W, uy = (u - ux) / W;
    for (let d = 0; d < 8; d++) {
      const vx = ux + DX[d]!, vy = uy + DY[d]!;
      if (vx < 0 || vy < 0 || vx >= W || vy >= H) continue;
      const v = vy * W + vx;
      if (done[v] || !open(v)) continue;
      // never past a building's corner (as suggestConnection): the path goes through the building, which is named
      if (d >= 4 && (c.occupied[uy * W + vx] !== -1 || c.occupied[vy * W + ux] !== -1)) continue;
      if (Math.abs(grade(t, u, v)) > MAX_GRADE + 1e-9) continue;
      const nd = dist[u]! + cellCost(v);
      if (nd < dist[v]!) { dist[v] = nd; prev[v] = u; heap.push(v, nd); }
    }
  }
  if (dist[to] === Infinity) return -1;
  const cells: number[] = [];
  for (let x = to; x !== -1; x = prev[x]!) cells.push(x);
  cells.reverse();
  for (const i of cells) if (c.occupied[i] !== -1) return c.occupied[i]!;
  return -1;
}

/** Min-heap of (node, key), ties broken by the lower node index (deterministic order). */
class Heap {
  private hn: number[] = [];
  private hk: number[] = [];
  get size(): number { return this.hn.length; }
  push(node: number, key: number): void {
    const hn = this.hn, hk = this.hk;
    let i = hn.length; hn.push(node); hk.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hk[p]! < key || (hk[p] === key && hn[p]! < node)) break;
      hn[i] = hn[p]!; hk[i] = hk[p]!; i = p;
    }
    hn[i] = node; hk[i] = key;
  }
  pop(): number {
    const hn = this.hn, hk = this.hk;
    const top = hn[0]!;
    const ln = hn.pop()!, lk = hk.pop()!;
    if (hn.length > 0) {
      let i = 0;
      for (;;) {
        let ch = 2 * i + 1;
        if (ch >= hn.length) break;
        if (ch + 1 < hn.length && (hk[ch + 1]! < hk[ch]! || (hk[ch + 1] === hk[ch] && hn[ch + 1]! < hn[ch]!))) ch++;
        if (lk < hk[ch]! || (lk === hk[ch] && ln <= hn[ch]!)) break;
        hn[i] = hn[ch]!; hk[i] = hk[ch]!; i = ch;
      }
      hn[i] = ln; hk[i] = lk;
    }
    return top;
  }
}

/** Tie-breaker inside one silver price: a diagonal step onto a new cell costs this much more than a straight one. */
const DIAGONAL_NEW = 0.001;

/**
 * The building that has to reach `b` once it is linked — the side the new road should leave the network on
 * (research 2026-11-04, P2): for a granary the producer whose full yard waits for it (OUTPUT_FULL, longest stall);
 * for a workshop a supplier of its input; otherwise a customer of its output (another workshop, or the castle when
 * the contract orders it). Only buildings the stable's wagons reach count; none -> the stable itself.
 */
function linkAnchor(world: World, b: Pick<Building, 'id' | 'type'>, onNet: (cell: number) => boolean): Building | null {
  const st = world.state;
  const others = st.buildings.filter((q) => q.id !== b.id && q.type !== 'stable' && onNet(q.gate));
  const best = (list: Building[]): Building | null => {
    let out: Building | null = null;
    for (const q of list) if (!out || q.stalledTicks > out.stalledTicks || (q.stalledTicks === out.stalledTicks && q.id < out.id)) out = q;
    return out;
  };
  if (b.type === 'warehouse') {
    const full = others.filter((q) => q.status.k === 'OUTPUT_FULL');
    if (full.length) return best(full);
    return best(others.filter((q) => outputGoods(q.type).length > 0));
  }
  const ins = inputGoods(b.type);
  if (ins.length) {
    const sup = others.filter((q) => outputGoods(q.type).some((g) => ins.includes(g)) || (q.type === 'warehouse' && ins.some((g) => q.stock[g] > 0)));
    if (sup.length) return best(sup);
  }
  const outs = outputGoods(b.type);
  const orders = contractsOf(st.mission);
  const cus = others.filter((q) => inputGoods(q.type).some((g) => outs.includes(g)) ||
    (q.type === 'castle' && orders.some((k) => k.castle === q.id && outs.some((g) => k.need[g] > 0))));
  return best(cus);
}

/**
 * Fix for a building whose gate cannot be reached from its wagons' stable: the cheapest new road (in silver)
 * from the stable's road network to its gate. Among equally cheap links it leaves the network where the building
 * that has to reach the target arrives first (`linkAnchor`, drive time on the existing roads), and within one
 * link prefers straight steps to diagonal shortcuts — the old stable-side choice sent the granary link of
 * missions V/VI diagonally toward the stable, away from the sawmill that fills it (research 2026-11-04, P2).
 * Read-only; three whole-grid Dijkstras, so call it on demand (panels cache it per network version).
 */
export function suggestLinkToStable(world: World, buildingId: number): RoadSuggestion | null {
  const b = world.state.buildings.find((x) => x.id === buildingId);
  return b ? linkToStable(world, b, null) : null;
}

/**
 * The same link for a building not yet placed (the build ghost, BACKLOG P3 day 9h): the footprint blocks the
 * search as the placed building would, and the gate cell counts as road (`place` lays it), so the estimate is
 * the link the sheet offers once the building stands — as long as nothing else changes in between.
 */
export function suggestLinkForSite(world: World, type: Building['type'], gate: number, footprint: readonly number[]): RoadSuggestion | null {
  return linkToStable(world, { id: -1, type, gate }, new Set(footprint));
}

function linkToStable(world: World, b: Pick<Building, 'id' | 'type' | 'gate'>, foot: Set<number> | null): RoadSuggestion | null {
  const st = world.state, t = world.terrain, c = net(world);
  const stable = st.buildings.find((x) => x.type === 'stable');
  if (!stable || b.id === stable.id || !st.roads[stable.gate]) return null;
  // a ghost's gate is laid as road on placement; its footprint is a building
  const road = (i: number): boolean => !!st.roads[i] || (foot !== null && i === b.gate);
  const blocked = (i: number): boolean => c.occupied[i] !== -1 || (foot !== null && foot.has(i));
  const W = t.w, H = t.h, n = W * H;
  // the stable's network (loaded wagons: a link that only an empty wagon could use would not deliver)
  const fromStable = dijkstra(world, stable.gate, false, true).dist;
  const onNet = (i: number): boolean => fromStable[i]! < Infinity;
  if (onNet(b.gate)) return null;
  const anchor = linkAnchor(world, b, onNet);
  const fromAnchor = anchor ? dijkstra(world, anchor.gate, false, true).dist : fromStable;
  // grid Dijkstra from the target's gate outward; network cells are terminals (not expanded)
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const heap = new Heap();
  dist[b.gate] = 0;
  heap.push(b.gate, 0);
  let bestEnd = -1, bestSilver = Infinity, bestDiag = Infinity, bestDrive = Infinity;
  while (heap.size > 0) {
    const u = heap.pop();
    if (done[u]) continue;
    done[u] = 1;
    // every price above the cheapest link found is settled after it: stop there
    if (Math.floor(dist[u]! + 1e-9) > bestSilver) break;
    if (onNet(u)) {
      // lexicographic: silver, then diagonal new steps (the fraction of the key), then drive time from the anchor
      const silver = Math.floor(dist[u]! + 1e-9), diag = Math.round((dist[u]! - silver) / DIAGONAL_NEW), drive = fromAnchor[u]!;
      if (silver < bestSilver || (silver === bestSilver && (diag < bestDiag || (diag === bestDiag && drive < bestDrive)))) {
        bestEnd = u; bestSilver = silver; bestDiag = diag; bestDrive = drive;
      }
      continue;
    }
    const ux = u % W, uy = (u - ux) / W;
    for (let d = 0; d < 8; d++) {
      const vx = ux + DX[d]!, vy = uy + DY[d]!;
      if (vx < 0 || vy < 0 || vx >= W || vy >= H) continue;
      const v = vy * W + vx;
      if (done[v] || blocked(v)) continue;
      if (d >= 4 && (blocked(uy * W + vx) || blocked(vy * W + ux))) continue;
      if (Math.abs(grade(t, u, v)) > MAX_GRADE + 1e-9) continue;
      const step = road(v) ? 0 : (t.water[v] ? COST_WOOD_BRIDGE : COST_DIRT) + (d >= 4 ? DIAGONAL_NEW : 0);
      const nd = dist[u]! + step;
      if (nd < dist[v]!) { dist[v] = nd; prev[v] = u; heap.push(v, nd); }
    }
  }
  if (bestEnd < 0) return null;
  // network end first, the target's gate last (a contiguous path for the road command)
  const cells: number[] = [];
  for (let x = bestEnd; x !== -1; x = prev[x]!) cells.push(x);
  const newCells = cells.filter((i) => !road(i));
  if (!newCells.length) return null;
  let cost = 0, bridgeCells = 0;
  for (const i of newCells) {
    if (t.water[i]) { cost += COST_WOOD_BRIDGE; bridgeCells++; } else cost += COST_DIRT;
  }
  return { cells, cost, newCells, bridgeCells };
}
