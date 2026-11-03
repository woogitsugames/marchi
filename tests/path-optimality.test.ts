// findPath / dijkstra optimality (BACKLOG P2, "Szukacz przerwy" base): the heap Dijkstra with cached edge-cost
// tables, stamps and pooled buffers must give the same shortest times as a plain, independent reference — an
// O(V²) Dijkstra written from the spec (hasEdge + edgeTime + the bridge-queue penalty on entering a span) —
// for every start, direction, load and weather, and findPath must return a valid path of exactly that time.
import { createWorld, type World } from '../src/sim/index';
import { dijkstra, edgeTime, findPath, hasEdge, isRaining, net, pathTime, releaseDistMap, spanPenalties } from '../src/sim/network';
import { nextInt, seedRng } from '../src/sim/rng';
import { benchWorld } from '../tools/bench';
import { step } from '../src/sim/index';
import { assert, test } from './harness';

const DX = [1, 0, -1, 0, 1, -1, -1, 1];
const DY = [0, 1, 0, -1, 1, 1, -1, -1];

/** Reference: dist[x] = time start -> x (reverse: x -> start), O(V²) without a heap, caches or stamps. */
function reference(w: World, start: number, reverse: boolean, loaded: boolean): Float64Array {
  const { w: W, h: H } = w.terrain;
  const n = W * H;
  const rain = isRaining(w.state);
  const span = net(w).span;
  const pen = spanPenalties(w); // input of the spec (seconds per queued span), not part of the search
  const dist = new Float64Array(n).fill(Infinity);
  if (!w.state.roads[start]) return dist;
  const done = new Uint8Array(n);
  const open: number[] = [start];
  dist[start] = 0;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (dist[open[i]!]! < dist[open[bi]!]!) bi = i;
    const u = open[bi]!;
    open[bi] = open[open.length - 1]!;
    open.pop();
    if (done[u]) continue;
    done[u] = 1;
    const ux = u % W, uy = (u - ux) / W;
    for (let d = 0; d < 8; d++) {
      const vx = ux + DX[d]!, vy = uy + DY[d]!;
      if (vx < 0 || vy < 0 || vx >= W || vy >= H) continue;
      const v = vy * W + vx;
      if (done[v]) continue;
      const from = reverse ? v : u, to = reverse ? u : v; // the real direction of travel
      if (!hasEdge(w, from, to)) continue;
      let c = edgeTime(w, from, to, loaded, rain);
      const sp = span[to]!;
      if (sp >= 0 && span[from] !== sp) c += pen.get(sp) ?? 0;
      if (dist[u]! + c < dist[v]!) {
        if (dist[v] === Infinity) open.push(v);
        dist[v] = dist[u]! + c;
      }
    }
  }
  return dist;
}

const close = (a: number, b: number): boolean => (a === Infinity ? b === Infinity : Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)));

function penaltyAlong(w: World, from: number, path: readonly number[]): number {
  const span = net(w).span;
  const pen = spanPenalties(w);
  let s = 0, a = from;
  for (const b of path) {
    const sp = span[b]!;
    if (sp >= 0 && span[a] !== sp) s += pen.get(sp) ?? 0;
    a = b;
  }
  return s;
}

function check(w: World, starts: number[], targets: number[], label: string): number {
  const n = w.terrain.w * w.terrain.h;
  let compared = 0;
  for (const s of starts) {
    for (const reverse of [false, true]) {
      for (const loaded of [false, true]) {
        const ref = reference(w, s, reverse, loaded);
        const m = dijkstra(w, s, reverse, loaded);
        for (let x = 0; x < n; x++) {
          if (!close(m.dist[x]!, ref[x]!)) throw new Error(`${label}: start ${s} cell ${x} reverse=${reverse} loaded=${loaded}: dijkstra ${m.dist[x]} reference ${ref[x]}`);
        }
        releaseDistMap(w, m);
        if (reverse) continue;
        // findPath (shared scratch, early stop) against the reference, through targets in a dirty order
        for (const t of targets) {
          const p = findPath(w, s, t, loaded);
          if (ref[t] === Infinity) { assert(p === null || s === t, `${label}: path to unreachable ${t}`); continue; }
          assert(p !== null, `${label}: no path ${s} -> ${t} although the reference reaches it`);
          let a = s;
          for (const b of p!) { assert(hasEdge(w, a, b), `${label}: path ${s} -> ${t} uses a missing edge ${a}-${b}`); a = b; }
          assert(p!.length === 0 || p![p!.length - 1] === t, `${label}: path ends at ${t}`);
          const time = pathTime(w, s, p!, loaded) + penaltyAlong(w, s, p!);
          if (!close(time, ref[t]!)) throw new Error(`${label}: path ${s} -> ${t} loaded=${loaded} takes ${time}, optimum ${ref[t]}`);
          compared++;
        }
      }
    }
  }
  return compared;
}

test('dijkstra and findPath equal an independent O(V²) Dijkstra on randomized networks (rain, bridge queues)', () => {
  const rng = seedRng(20261103);
  let compared = 0;
  for (let k = 0; k < 5; k++) {
    const w = createWorld('lab');
    const { w: W, h: H } = w.terrain;
    const roads = w.state.roads;
    const strokes = nextInt(rng, 10, 36);
    for (let s = 0; s < strokes; s++) {
      let x = nextInt(rng, 0, W - 1), y = nextInt(rng, 0, H - 1);
      const dx = nextInt(rng, -1, 1), dy = nextInt(rng, -1, 1), len = nextInt(rng, 3, 40), surf = nextInt(rng, 1, 2);
      for (let i = 0; i < len && x >= 0 && y >= 0 && x < W && y < H; i++, x += dx, y += dy) roads[y * W + x] = surf;
    }
    w.state.netVersion++;
    if (k % 2 === 1) w.state.rain = [{ start: 0, end: 1e9 }];
    // a queue on some spans: routing must weigh a longer way round against the wait
    const spans = [...new Set(Array.from(net(w).span).filter((s) => s >= 0))];
    w.queue = { tick: w.state.tick, ver: w.state.netVersion, penalty: new Map(spans.filter((_, i) => i % 2 === k % 2).map((s) => [s, 9 + 13 * (k + 1)])) };
    const cells: number[] = [];
    for (let i = 0; i < W * H; i++) if (roads[i]) cells.push(i);
    const pick = (): number => cells[nextInt(rng, 0, cells.length - 1)]!;
    const starts = [...w.state.buildings.map((b) => b.gate), pick(), pick(), pick()];
    const targets = [...w.state.buildings.map((b) => b.gate)];
    for (let i = 0; i < 12; i++) targets.push(pick());
    compared += check(w, starts, targets, `net ${k}`);
  }
  assert(compared > 200, `too few reachable pairs compared (${compared})`);
});

test('dijkstra and findPath stay optimal on a live bench world (wagons on bridges, real queues)', () => {
  const w = benchWorld(50);
  for (let i = 0; i < 900; i++) step(w);
  const gates = w.state.buildings.map((b) => b.gate);
  const compared = check(w, gates.slice(0, 6), gates, 'bench50 t900');
  assert(compared > 20, `too few pairs (${compared})`);
});
