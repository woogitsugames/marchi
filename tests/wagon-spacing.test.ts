// Drawn spacing between wagons (D-35): render-only, never touches the sim.
import { step, stateHash, type World } from '../src/sim/index';
import { DRAW_GAP, MAX_DRAW_LAG, wagonDrawLag } from '../src/render/wagonSpacing';
import { applyCommand, createWorld } from '../src/sim/index';
import { bridgeA, stableId } from '../tools/bot';
import { benchWorld } from '../tools/bench';
import { assert, eq, test } from './harness';

/** Same-direction pairs on one edge closer than the gap, by sim position and by drawn position. */
function overlaps(world: World, lag: Map<number, number>): { sim: number; drawn: number; maxLag: number } {
  const n = world.terrain.w * world.terrain.h;
  const byEdge = new Map<number, { t: number; d: number }[]>();
  let maxLag = 0;
  for (const w of world.state.wagons) {
    if (w.next < 0) continue;
    const l = lag.get(w.id) ?? 0;
    assert(Number.isFinite(l) && l >= 0, `lag of wagon ${w.id} is ${l}`);
    maxLag = Math.max(maxLag, l);
    const k = w.at * n + w.next;
    const list = byEdge.get(k) ?? [];
    list.push({ t: w.edgeT, d: w.edgeT - l });
    byEdge.set(k, list);
  }
  let sim = 0, drawn = 0;
  for (const list of byEdge.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      if (Math.abs(list[i]!.t - list[j]!.t) < DRAW_GAP - 1e-9) sim++;
      if (Math.abs(list[i]!.d - list[j]!.d) < DRAW_GAP - 1e-9) drawn++;
    }
  }
  return { sim, drawn, maxLag };
}

function measure(w: World, ticks: number): { sim: number; drawn: number; maxLag: number } {
  let sim = 0, drawn = 0, maxLag = 0;
  for (let i = 0; i < ticks; i++) {
    step(w);
    if (i % 10) continue;
    const o = overlaps(w, wagonDrawLag(w));
    sim += o.sim; drawn += o.drawn; maxLag = Math.max(maxLag, o.maxLag);
  }
  return { sim, drawn, maxLag };
}

test('mission traffic (m1 bot fleet, m2): wagons going the same way are never drawn on top of each other', () => {
  const m1 = createWorld('m1');
  applyCommand(m1, bridgeA(m1));
  for (let i = 0; i < 4; i++) applyCommand(m1, { t: 'buyWagon', stable: stableId(m1) });
  for (const [name, w] of [['m1', m1], ['m2', createWorld('m2')]] as const) {
    const r = measure(w, 5000);
    assert(r.sim > 0, `${name}: the sim does bunch wagons (the case being fixed)`);
    eq(r.drawn, 0, `${name}: drawn overlaps`);
    assert(r.maxLag <= MAX_DRAW_LAG + 1e-9, `${name}: lag within the cap`);
    console.log(`     ${name}: sim overlaps sampled ${r.sim}, drawn ${r.drawn}, max lag ${r.maxLag.toFixed(1)} m`);
  }
});

// The bench is deliberately overloaded (two one-lane bridges for 120 wagons): dozens of wagons share a few
// 4 m cells, more than a capped lag can spread. The view then still stacks some of them.
test('120-wagon jam: fewer drawn overlaps, lag stays capped', () => {
  const r = measure(benchWorld(120), 3000);
  assert(r.maxLag <= MAX_DRAW_LAG + 1e-9, 'lag within the cap');
  assert(r.drawn < r.sim, `drawn ${r.drawn} vs sim ${r.sim}`);
  console.log(`     bench 120: sim overlaps sampled ${r.sim}, drawn ${r.drawn} (${((r.drawn / r.sim) * 100).toFixed(1)} %), max lag ${r.maxLag.toFixed(1)} m`);
});

test('drawn spacing is read-only: the simulation hash does not change', () => {
  const a = benchWorld(60), b = benchWorld(60);
  for (let i = 0; i < 1500; i++) {
    wagonDrawLag(b);
    step(a); step(b);
  }
  eq(stateHash(b), stateHash(a), 'same hash');
});
