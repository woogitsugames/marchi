// Dispatch spike fixes (docs/research/2026-11-02-dispatch-spike.md): with no free wagon the
// dispatcher answers "is a source reachable" from connected-component labels (A), and Dijkstra
// results are recycled between dispatches (B). Both must be pure optimisations.
import { createWorld, stateHash, step, type World } from '../src/sim/index';
import { dispatch } from '../src/sim/logistics';
import { dijkstra, net, reachable, releaseDistMap } from '../src/sim/network';
import { nextInt, seedRng } from '../src/sim/rng';
import { benchWorld } from '../tools/bench';
import { assert, eq, test } from './harness';

/** Compare `reachable(start, x)` with every Dijkstra variant from `start`, for all cells x. */
function checkStart(w: World, start: number, label: string): void {
  const n = w.terrain.w * w.terrain.h;
  for (const reverse of [false, true]) {
    for (const loaded of [false, true]) {
      const m = dijkstra(w, start, reverse, loaded);
      for (let x = 0; x < n; x++) {
        if (reachable(w, start, x) !== m.dist[x]! < Infinity) {
          throw new Error(`${label}: start ${start} cell ${x} reverse=${reverse} loaded=${loaded}: reachable=${reachable(w, start, x)} dist=${m.dist[x]}`);
        }
      }
      releaseDistMap(w, m);
    }
  }
}

test('reachable() from component labels equals Dijkstra on randomized networks (seeded)', () => {
  const rng = seedRng(20261102);
  for (let net_ = 0; net_ < 6; net_++) {
    const w = createWorld('lab');
    const { w: W, h: H } = w.terrain;
    const roads = w.state.roads;
    // random strokes: straight and diagonal runs, crossing water (bridges) and buildings at will
    const strokes = nextInt(rng, 8, 40);
    for (let s = 0; s < strokes; s++) {
      let x = nextInt(rng, 0, W - 1), y = nextInt(rng, 0, H - 1);
      const dx = nextInt(rng, -1, 1), dy = nextInt(rng, -1, 1), len = nextInt(rng, 3, 40), surf = nextInt(rng, 1, 2);
      for (let k = 0; k < len && x >= 0 && y >= 0 && x < W && y < H; k++, x += dx, y += dy) roads[y * W + x] = surf;
    }
    // a few isolated single cells (a component of one, no edges)
    for (let s = 0; s < 5; s++) roads[nextInt(rng, 0, W * H - 1)] = 1;
    w.state.netVersion++;
    // rain on half of the networks; a fake bridge queue on every span (finite seconds, like real jams)
    if (net_ % 2 === 1) w.state.rain = [{ start: 0, end: 1e9 }];
    const spans = new Set(Array.from(net(w).span).filter((s) => s >= 0));
    w.queue = { tick: w.state.tick, ver: w.state.netVersion, penalty: new Map([...spans].map((s) => [s, 37])) };
    const roadCells: number[] = [];
    for (let i = 0; i < W * H; i++) if (roads[i]) roadCells.push(i);
    const starts = [...w.state.buildings.map((b) => b.gate)];
    for (let s = 0; s < 8; s++) starts.push(roadCells[nextInt(rng, 0, roadCells.length - 1)]!);
    starts.push(nextInt(rng, 0, W * H - 1)); // possibly off the roads
    for (const s of starts) checkStart(w, s, 'net ' + net_);
  }
});

test('reachable() equals Dijkstra between all gates on the bench and through network commands', () => {
  const w = benchWorld(50);
  const gates = (): number[] => w.state.buildings.map((b) => b.gate);
  for (let i = 0; i < 600; i++) step(w);
  for (const g of gates()) checkStart(w, g, 'bench50 t600');
  // cut the network: wipe a band of road cells (as demolish would), then compare again
  const W = w.terrain.w;
  for (let y = 40; y < 50; y++) for (let x = 0; x < W; x++) w.state.roads[y * W + x] = 0;
  w.state.netVersion++;
  for (const g of gates()) checkStart(w, g, 'bench50 cut');
});

test('recycled distance maps give the same Dijkstra results as fresh ones', () => {
  const w = benchWorld(50);
  for (let i = 0; i < 300; i++) step(w);
  const [a, b] = w.state.buildings.map((x) => x.gate);
  const fresh = dijkstra(w, a!, false, true);
  const ref = { dist: Array.from(fresh.dist), prev: Array.from(fresh.prev) };
  releaseDistMap(w, fresh);
  releaseDistMap(w, dijkstra(w, b!, true, false)); // dirty the pooled arrays with another search
  const again = dijkstra(w, a!, false, true);
  eq(JSON.stringify(Array.from(again.dist)), JSON.stringify(ref.dist), 'dist');
  eq(JSON.stringify(Array.from(again.prev)), JSON.stringify(ref.prev), 'prev');
});

test('no free wagon: an unreachable source stays NO_INPUT/UNREACHABLE (not ALL_BUSY), cut-off granary named', () => {
  // M1 untouched: the river splits the sawmill (north) from the castle (south)
  const w = createWorld('m1');
  const st = w.state;
  const by = (t: string) => st.buildings.find((b) => b.type === t)!;
  const saw = by('sawmill'), castle = by('castle'), mill = by('mill'), farm = by('farm');
  assert(!reachable(w, saw.gate, castle.gate), 'sawmill cut off from the castle');
  assert(reachable(w, farm.gate, mill.gate), 'farm reaches the mill');
  saw.stock.planks = 6; st.ledger.produced.planks += 6;
  for (const wg of st.wagons) wg.busyTicks = 1000; // every wagon busy: free.length === 0
  dispatch(w);
  const cs = castle.status;
  assert(cs.k === 'NO_INPUT' && cs.cause === 'UNREACHABLE' && cs.good === 'planks' && cs.blockedBy === saw.id,
    'castle: ' + JSON.stringify(cs));
  const ms = mill.status;
  assert(ms.k === 'NO_WAGON' && ms.cause === 'ALL_BUSY' && ms.good === 'grain', 'mill: ' + JSON.stringify(ms));
  eq(st.wagons.every((x) => x.job === null), true, 'nothing assigned');

  // M5 untouched: the granary is cut off; a full woodcutter with no free wagon blames it (NO_DESTINATION)
  const w5 = createWorld('m5');
  const wc = w5.state.buildings.find((b) => b.type === 'woodcutter')!;
  const wh = w5.state.buildings.find((b) => b.type === 'warehouse')!;
  assert(!reachable(w5, wc.gate, wh.gate), 'granary cut off');
  w5.state.ledger.produced.wood += 8 - wc.stock.wood;
  wc.stock.wood = 8; wc.progress = -1;
  for (const wg of w5.state.wagons) wg.busyTicks = 1000;
  dispatch(w5);
  const s5 = wc.status;
  assert(s5.k === 'OUTPUT_FULL' && s5.cause === 'NO_DESTINATION' && s5.blockedBy === wh.id, 'woodcutter: ' + JSON.stringify(s5));
});

test('dispatch fixes keep bench state hashes (recorded from the pre-fix sim)', () => {
  const want: Record<number, string[]> = {
    50: ['713e69f3eaab8c43', 'cf024b6683c4bd09', '17316fd2cad6fa32', '8bf0c61d32a766fd', 'c310bdf5af98fcab', 'a7908b09085a6c60'],
    100: ['c648427c162563da', '06ff93fcb7698806', 'dff63db526b16d36', '2190c401abbe7f49', 'ab1282712910a464', '17f1e2a72d8ad006'],
  };
  for (const n of [50, 100]) {
    const w = benchWorld(n);
    const got: string[] = [];
    for (let i = 1; i <= 3000; i++) { step(w); if (i % 500 === 0) got.push(stateHash(w)); }
    eq(got.join(','), want[n]!.join(','), 'bench' + n);
  }
});
