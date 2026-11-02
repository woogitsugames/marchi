// Drawn spacing between wagons (D-35) and the waiting row beside the stable (D-43): render-only, never
// touches the sim.
import { step, stateHash, type World } from '../src/sim/index';
import { DRAW_GAP, MAX_DRAW_LAG, PARK_PITCH, isParked, parkingBlocked, stableParking, stableSlots, wagonDrawLag } from '../src/render/wagonSpacing';
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

/** m1 with the bridge built and `n` extra wagons bought: they spawn at the stable gate with nothing to do. */
function idleFleet(n: number): World {
  const w = createWorld('m1');
  w.state.coins = 1e6; // test setup: buy a fleet bigger than the mission budget
  applyCommand(w, bridgeA(w));
  for (let i = 0; i < n; i++) applyCommand(w, { t: 'buyWagon', stable: stableId(w) });
  for (let i = 0; i < 3; i++) step(w);
  return w;
}

test('idle wagons at the stable are drawn in a row beside it: one place each, no overlap, horses to the road', () => {
  const w = idleFleet(14);
  const stable = w.state.buildings.find((b) => b.type === 'stable')!;
  const parked = w.state.wagons.filter((q) => isParked(q, new Set([stable.gate])));
  assert(parked.length >= 10, `${parked.length} wagons wait at the stable gate (the pile being fixed)`);
  const park = stableParking(w);
  const free = stableSlots(w, stable, parkingBlocked(w)).length;
  assert(free >= 12, `${free} waiting places beside the m1 stable`);
  eq(park.size, Math.min(parked.length, free), 'every waiting wagon has a place (as long as there is room)');
  const slots = [...park.values()];
  // the sim keeps them all on one node; drawn rigs (2.3 m wide, 7.4 m long, parallel) never overlap
  let minGap = Infinity;
  for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
    const a = slots[i]!, b = slots[j]!;
    const fx = Math.sin(a.heading), fz = Math.cos(a.heading);
    const along = Math.abs((b.x - a.x) * fx + (b.z - a.z) * fz), across = Math.abs((b.x - a.x) * fz - (b.z - a.z) * fx);
    assert(along >= 7.4 || across >= PARK_PITCH - 1e-9, `places ${i} and ${j} overlap (along ${along.toFixed(2)}, across ${across.toFixed(2)})`);
    minGap = Math.min(minGap, Math.hypot(b.x - a.x, b.z - a.z));
  }
  // horses face the gate side (the road): heading = the stable's facing (0 = south, +z)
  const o = [[0, 1], [1, 0], [0, -1], [-1, 0]][stable.facing]!;
  const blocked = parkingBlocked(w), C = w.terrain.cellSize;
  for (const s of slots) {
    assert(Math.abs(Math.sin(s.heading) - o[0]!) < 1e-9 && Math.abs(Math.cos(s.heading) - o[1]!) < 1e-9, 'horses face the road');
    // the bed and the horse stand on open ground: no road, gate, building, water
    for (const a of [-2, 1.7, 4]) {
      const x = s.x + Math.sin(s.heading) * a, z = s.z + Math.cos(s.heading) * a;
      eq(blocked[Math.floor(z / C) * w.terrain.w + Math.floor(x / C)], 0, 'open ground under the rig');
    }
    // beside the stable, not wandering off: within ~4 places of its flank
    const cx = (stable.x + stable.w / 2) * C, cz = (stable.y + stable.h / 2) * C;
    assert(Math.hypot(s.x - cx, s.z - cz) < 40, 'close to the stable');
  }
  // deterministic: the same state gives the same places, by wagon id
  const again = stableParking(idleFleet(14));
  for (const [id, s] of park) eq(JSON.stringify(again.get(id)), JSON.stringify(s), `place of wagon ${id}`);
  console.log(`     ${parked.length} wagons waiting at the gate -> ${new Set(slots.map((s) => `${s.x},${s.z}`)).size} distinct places, closest pair ${minGap.toFixed(1)} m apart`);
});

test('the stable waiting row is read-only: the simulation hash does not change', () => {
  const a = idleFleet(12), b = idleFleet(12);
  const cache = new Map();
  let seen = 0;
  for (let i = 0; i < 3000; i++) {
    seen = Math.max(seen, stableParking(b, cache).size);
    step(a); step(b);
  }
  assert(seen >= 10, `waiting row used (${seen})`);
  eq(stateHash(b), stateHash(a), 'same hash');
});
