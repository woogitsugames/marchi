// Sim cost night (D-336..D-338): the neighbour-list Dijkstra, the cross-tick distance memo and the rule-A
// search skip are pure optimisations. The reference below is the pre-D-337 8-direction search, verbatim
// in behaviour; the memo must return exactly what a fresh search returns at every tick.
import { createWorld, step, TICK_HZ, type World } from '../src/sim/index';
import { DX, DY, OPP, dijkstra, dijkstraMemo, edgeCosts, isRaining, net, spanPenalties } from '../src/sim/network';
import { bridgeIceUntil, thawing } from '../src/sim/seasons';
import { nextInt, seedRng } from '../src/sim/rng';
import { benchWorld } from '../tools/bench';
import { assert, eq, test } from './harness';

/** The search as it was before the neighbour lists (full 8-direction scan, same heap, same tie rules). */
function reference(world: World, start: number, reverse: boolean, loaded: boolean, stopAt = -1): { dist: Float64Array; prev: Int32Array } {
  const w = world.terrain.w, h = world.terrain.h, n = w * h;
  const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
  if (!world.state.roads[start]) return { dist, prev };
  const hn: number[] = [], hk: number[] = [];
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
  const costs = edgeCosts(world, loaded, isRaining(world.state), thawing(world));
  const pen = spanPenalties(world);
  const spanOf = net(world).span;
  const until = bridgeIceUntil(world);
  const iceLeft = until >= 0 ? (until - world.state.tick) / TICK_HZ : 0;
  const done = new Uint8Array(n);
  dist[start] = 0;
  push(start, 0);
  while (size > 0) {
    const key = hk[0]!;
    const u = pop();
    if (done[u]) continue;
    if (key > dist[u]!) continue;
    done[u] = 1;
    if (u === stopAt) break;
    const ux = u % w, uy = (u - ux) / w;
    for (let d = 0; d < 8; d++) {
      const vx = ux + DX[d]!, vy = uy + DY[d]!;
      if (vx < 0 || vy < 0 || vx >= w || vy >= h) continue;
      const v = vy * w + vx;
      if (done[v]) continue;
      let cost = reverse ? costs[v * 8 + OPP[d]!]! : costs[u * 8 + d]!;
      if (cost === Infinity) continue;
      if (pen.size > 0 || iceLeft > 0) {
        const from = reverse ? v : u, to = reverse ? u : v;
        const sp = spanOf[to]!;
        if (sp >= 0 && spanOf[from] !== sp) {
          cost += pen.get(sp) ?? 0;
          if (iceLeft > 0) cost += reverse ? iceLeft : Math.max(0, iceLeft - dist[u]!);
        }
      }
      const nd = dist[u]! + cost;
      if (nd < dist[v]!) { dist[v] = nd; prev[v] = u; push(v, nd); }
    }
  }
  return { dist, prev };
}

function same(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}

test('neighbour-list Dijkstra equals the 8-direction reference on randomized networks (rain, queues, ice, stopAt)', () => {
  const rng = seedRng(20261107);
  for (let k = 0; k < 6; k++) {
    const w = createWorld('lab');
    const { w: W, h: H } = w.terrain;
    const roads = w.state.roads;
    for (let s = nextInt(rng, 8, 40); s > 0; s--) {
      let x = nextInt(rng, 0, W - 1), y = nextInt(rng, 0, H - 1);
      const dx = nextInt(rng, -1, 1), dy = nextInt(rng, -1, 1), len = nextInt(rng, 3, 40), surf = nextInt(rng, 1, 2);
      for (let i = 0; i < len && x >= 0 && y >= 0 && x < W && y < H; i++, x += dx, y += dy) roads[y * W + x] = surf;
    }
    w.state.netVersion++;
    if (k % 2 === 1) w.state.rain = [{ start: 0, end: 1e9 }];
    if (k % 3 === 2) w.state.ice = [{ start: 0, end: 900 }];
    const spans = [...new Set(Array.from(net(w).span).filter((s) => s >= 0))];
    w.queue = { tick: w.state.tick, ver: w.state.netVersion, penalty: new Map(spans.filter((_, i) => i % 2 === 0).map((s) => [s, 9 + nextInt(rng, 0, 8)])) };
    const roadCells: number[] = [];
    for (let i = 0; i < W * H; i++) if (roads[i]) roadCells.push(i);
    const starts = w.state.buildings.map((b) => b.gate);
    for (let s = 0; s < 6; s++) starts.push(roadCells[nextInt(rng, 0, roadCells.length - 1)]!);
    starts.push(nextInt(rng, 0, W * H - 1));
    for (const s of starts) for (const reverse of [false, true]) for (const loaded of [false, true]) {
      const stopAt = nextInt(rng, 0, 3) === 0 ? roadCells[nextInt(rng, 0, roadCells.length - 1)]! : -1;
      const got = dijkstra(w, s, reverse, loaded, stopAt, true), ref = reference(w, s, reverse, loaded, stopAt);
      assert(same(got.dist, ref.dist) && same(got.prev, ref.prev), `net ${k} start ${s} reverse=${reverse} loaded=${loaded} stopAt=${stopAt}`);
    }
  }
});

test('distance memo returns exactly a fresh search at every dispatch tick (queues, rain, ice, network change)', () => {
  const w = benchWorld(50);
  const gates = () => [...new Set(w.state.buildings.map((b) => b.gate))];
  let hits = 0, declined = 0;
  const check = (label: string) => {
    for (const g of gates()) for (const [reverse, loaded] of [[false, true], [true, false], [true, true]] as const) {
      const m = dijkstraMemo(w, g, reverse, loaded);
      if (!m) { declined++; continue; }
      hits++;
      assert(same(m, reference(w, g, reverse, loaded).dist), `${label} tick ${w.state.tick} gate ${g} reverse=${reverse} loaded=${loaded}`);
    }
  };
  for (let i = 0; i < 1200; i++) {
    if (i === 400) w.state.rain = [{ start: w.state.tick, end: w.state.tick + 200 }];
    if (i === 700) w.state.ice = [{ start: w.state.tick, end: w.state.tick + 100 }];
    if (i === 1000) { // cut a band of roads, as a demolish would
      const W = w.terrain.w;
      for (let y = 40; y < 44; y++) for (let x = 0; x < W; x++) w.state.roads[y * W + x] = 0;
      w.state.netVersion++;
    }
    step(w);
    if (i % 25 === 0) check('bench50');
  }
  assert(hits > 0 && declined > 0, `memo used (${hits}) and declined under ice (${declined})`);
  eq(w.distMemo !== undefined, true, 'memo built');
});

test('D-471: searches reset only the cells the last search wrote — whole arrays still equal a fresh search across network growth and cuts', () => {
  // one world, so the shared scratch pair and the memo arrays carry cells written under an earlier network
  const rng = seedRng(20261110);
  const w = createWorld('lab');
  const { w: W, h: H } = w.terrain;
  const roads = w.state.roads;
  for (let round = 0; round < 8; round++) {
    if (round % 3 === 2) { // cut: clear a random band (written cells of the old network are now off the roads)
      const y0 = nextInt(rng, 0, H - 6);
      for (let y = y0; y < y0 + 5; y++) for (let x = 0; x < W; x++) roads[y * W + x] = 0;
    } else { // growth: more random roads (more cells than the previous lists held)
      for (let s = nextInt(rng, 10, 40); s > 0; s--) {
        let x = nextInt(rng, 0, W - 1), y = nextInt(rng, 0, H - 1);
        const dx = nextInt(rng, -1, 1), dy = nextInt(rng, -1, 1), len = nextInt(rng, 3, 50);
        for (let i = 0; i < len && x >= 0 && y >= 0 && x < W && y < H; i++, x += dx, y += dy) roads[y * W + x] = nextInt(rng, 1, 2);
      }
    }
    w.state.netVersion++;
    const roadCells: number[] = [];
    for (let i = 0; i < W * H; i++) if (roads[i]) roadCells.push(i);
    const starts = [...w.state.buildings.map((b) => b.gate), nextInt(rng, 0, W * H - 1)];
    for (let s = 0; s < 5; s++) starts.push(roadCells[nextInt(rng, 0, roadCells.length - 1)]!);
    for (const s of starts) for (const reverse of [false, true]) for (const loaded of [false, true]) {
      const stopAt = nextInt(rng, 0, 2) === 0 ? roadCells[nextInt(rng, 0, roadCells.length - 1)]! : -1;
      const ref = reference(w, s, reverse, loaded, stopAt);
      const got = dijkstra(w, s, reverse, loaded, stopAt, true);
      assert(same(got.dist, ref.dist) && same(got.prev, ref.prev), `scratch round ${round} start ${s} reverse=${reverse} loaded=${loaded} stopAt=${stopAt}`);
      const m = dijkstraMemo(w, s, reverse, loaded);
      assert(m !== null && same(m, reference(w, s, reverse, loaded).dist), `memo round ${round} start ${s} reverse=${reverse} loaded=${loaded}`);
    }
  }
});
