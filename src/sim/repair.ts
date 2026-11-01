// "Gap finder": the cheapest road (in silver) that would connect two road cells, so the
// "Why is it stalled?" panel can offer a concrete fix ("build a bridge here: 34 silver").
// Read-only: it never mutates the state. Uses the same rules as validateRoad (no building
// footprints, no cutting building corners, grade <= MAX_GRADE between consecutive cells).
import { COST_DIRT, COST_WOOD_BRIDGE, MAX_GRADE } from './defs';
import { DX, DY, grade, net, type World } from './network';

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

/** Convenience: fix for a building whose gate cannot be reached from its wagons' stable. */
export function suggestLinkToStable(world: World, buildingId: number): RoadSuggestion | null {
  const st = world.state;
  const b = st.buildings.find((x) => x.id === buildingId);
  const stable = st.buildings.find((x) => x.type === 'stable');
  if (!b || !stable || b.id === stable.id) return null;
  const s = suggestConnection(world, stable.gate, b.gate);
  return s && s.newCells.length > 0 ? s : null;
}
