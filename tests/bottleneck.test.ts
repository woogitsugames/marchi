// "Wąskie gardło" (D-171, spec docs/specs/2026-11-04-valley-trade-post.md §3): the free valley's bottleneck card
// from UI-side samples (one per sim second, 3-minute window). Synthetic statuses on a real valley; the state is
// never written by the sampler.
import { TICK_HZ, createWorld, inputGoods, stateHash, step, type Building, type BuildingStatus, type World } from '../src/sim/index';
import { place } from '../src/sim/commands';
import {
  NECK_WINDOW, bottleneckCard, bottleneckFor, resetBottleneck, sampleBottleneck,
} from '../src/ui/bottleneck';
import { cureFor, producerCure, sampleInputWaits } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

const waitGrain: BuildingStatus = { k: 'WAITING_DELIVERY', good: 'grain', wagon: 1 };
const waitFlour: BuildingStatus = { k: 'WAITING_DELIVERY', good: 'flour', wagon: 1 };
const working: BuildingStatus = { k: 'WORKING' };

/** A valley at rank 3 with a farm, three mills and two bakeries (placed as map buildings, no silver). */
function valley(): { w: World; farm: Building; mills: Building[]; bakeries: Building[] } {
  const w = createWorld('sandbox');
  w.state.town.rank = 3;
  const put = (type: Parameters<typeof place>[1], x: number, y: number): Building => {
    const r = place(w, type, x, y, 2, true);
    assert(r.ok, `place ${type} at ${x},${y}: ${JSON.stringify(r)}`);
    return w.state.buildings.at(-1)!;
  };
  const farm = put('farm', 55, 25);
  const mills = [put('mill', 58, 25), put('mill', 52, 25), put('mill', 49, 25)];
  const bakeries = [put('bakery', 44, 25), put('bakery', 40, 25)];
  resetBottleneck(w);
  return { w, farm, mills, bakeries };
}

/** n sim seconds of synthetic statuses: `set` runs before each sample (the tick moves on by one second). */
function seconds(w: World, n: number, set: (sec: number) => void): void {
  for (let i = 0; i < n; i++) {
    w.state.tick += TICK_HZ;
    // every workshop works unless the case says otherwise
    for (const b of w.state.buildings) if (inputGoods(b.type).length) b.status = working;
    set(i);
    sampleBottleneck(w);
  }
}

test('bottleneck: no card until the window is full; at a mean of 1.49 none, at 1.50 the grain card with cure producer', () => {
  const { w, mills, bakeries } = valley();
  for (const b of bakeries) b.status = working;
  // 1.5 waiting mills on average: two in odd seconds, one in even ones
  const half = (i: number) => { mills[0]!.status = waitGrain; mills[1]!.status = i % 2 ? waitGrain : working; mills[2]!.status = working; };
  seconds(w, NECK_WINDOW - 1, half);
  eq(bottleneckCard(w), null, 'window not full');
  seconds(w, 1, () => half(1));
  const c = bottleneckCard(w);
  assert(!!c, 'card at 1.50');
  eq(`${c!.kind} ${c!.good} ${c!.cure} ${c!.build} ${c!.consumers} ${c!.meanX100}`, 'good grain producer farm 3 150', 'grain, build a farm');
  // just under: one second of the window without the second mill waiting -> 269 / 180
  const { w: w2, mills: m2 } = valley();
  // the second mill waits in the odd seconds but the first one: 89 seconds -> (180 + 89) / 180
  seconds(w2, NECK_WINDOW, (i) => { m2[0]!.status = waitGrain; m2[1]!.status = i % 2 === 1 && i !== 1 ? waitGrain : working; m2[2]!.status = working; });
  eq(bottleneckCard(w2), null, 'mean 1.49: no card');
});

test('bottleneck: hysteresis — a shown card stays down to 1.10 and goes below', () => {
  const { w, mills } = valley();
  seconds(w, NECK_WINDOW, () => { mills[0]!.status = waitGrain; mills[1]!.status = waitGrain; mills[2]!.status = working; });
  eq(bottleneckCard(w)?.good, 'grain', 'shown at 2.0');
  // 1.2 on average: still shown (would not appear at 1.2)
  seconds(w, NECK_WINDOW, (i) => { mills[0]!.status = waitGrain; mills[1]!.status = i % 5 === 0 ? waitGrain : working; });
  eq(bottleneckCard(w)?.good, 'grain', 'kept at 1.2');
  seconds(w, NECK_WINDOW, () => { mills[0]!.status = waitGrain; mills[1]!.status = working; });
  eq(bottleneckCard(w), null, 'gone at 1.0');
});

test('bottleneck: fewer than two consumers, or a producer the rank does not allow -> no card', () => {
  const { w, mills } = valley();
  w.state.buildings = w.state.buildings.filter((b) => b.id !== mills[1]!.id && b.id !== mills[2]!.id);
  seconds(w, NECK_WINDOW, () => { mills[0]!.status = waitGrain; });
  eq(bottleneckCard(w), null, 'one mill');
  // malt: malthouse is a rank-3 building; at rank 2 the card cannot ask for it
  const v = valley();
  v.w.state.town.rank = 2;
  const put = (x: number) => { place(v.w, 'brewery', x, 30, 2, true); return v.w.state.buildings.at(-1)!; };
  const breweries = [put(60), put(64)];
  resetBottleneck(v.w);
  seconds(v.w, NECK_WINDOW, () => { for (const b of breweries) b.status = { k: 'WAITING_DELIVERY', good: 'malt', wagon: 1 }; });
  eq(bottleneckCard(v.w), null, 'malthouse locked at rank 2');
});

test('bottleneck: bakeries wait for flour because the mills wait for grain -> the card names grain', () => {
  const { w, mills, bakeries } = valley();
  seconds(w, NECK_WINDOW, () => {
    for (const b of bakeries) b.status = waitFlour;
    mills[0]!.status = waitGrain; mills[1]!.status = waitGrain; mills[2]!.status = working;
  });
  eq(bottleneckCard(w)?.good, 'grain', 'grain, not flour (2 of 3 mills hungry)');
});

test('bottleneck: the fleet rule from rank 2 (every wagon on the road for 3 minutes); never below', () => {
  const { w } = valley();
  const busy = () => { for (const q of w.state.wagons) q.status = { k: 'TO_PICKUP' } as never; };
  seconds(w, NECK_WINDOW, busy);
  const c = bottleneckCard(w);
  eq(`${c?.kind} ${c?.cure}`, 'fleet wagon', 'fleet card');
  eq(c?.focus, w.state.buildings.find((b) => b.type === 'stable')!.id, 'eye on the stable');
  const v = valley();
  v.w.state.town.rank = 1;
  seconds(v.w, NECK_WINDOW, () => { for (const q of v.w.state.wagons) q.status = { k: 'TO_PICKUP' } as never; });
  eq(bottleneckCard(v.w), null, 'not at rank 1');
});

test('bottleneck: a waiting mill gets the producer cure on its sheet; reading never changes the state hash', () => {
  const { w, farm, mills } = valley();
  seconds(w, NECK_WINDOW, () => { mills[0]!.status = waitGrain; mills[1]!.status = waitGrain; });
  for (let i = 0; i < 3; i++) sampleInputWaits(w);
  const c = bottleneckCard(w)!;
  eq(bottleneckFor(w, mills[0]!)?.good, 'grain', 'mill waits for the card good');
  eq(bottleneckFor(w, mills[2]!), null, 'a working mill: no cure');
  eq(cureFor(w, mills[0]!.id), 'producer', 'cure producer');
  const pc = producerCure(w, mills[0]!);
  eq(`${pc?.source} ${pc?.type} ${pc?.producer}`, `neck farm ${farm.id}`, 'build a farm next to the farm');
  eq(c.near, farm.id, 'nearest producer');
  // the sampler and the card only read: a real run with them every tick hashes like one without
  const run = (probe: boolean): string => {
    const q = createWorld('sandbox');
    for (let i = 0; i < 5 * 60 * TICK_HZ; i++) {
      step(q);
      if (probe) { sampleInputWaits(q); bottleneckCard(q); for (const m of q.state.buildings) cureFor(q, m.id); }
    }
    return stateHash(q);
  };
  eq(run(true), run(false), 'same hash with the probe');
});

test('bottleneck: never in a mission (the D-110 card keeps its own rule)', () => {
  const w = createWorld('m9');
  for (let i = 0; i < NECK_WINDOW + 5; i++) { w.state.tick += TICK_HZ; for (const b of w.state.buildings) if (b.type === 'sawmill') b.status = { k: 'WAITING_DELIVERY', good: 'wood', wagon: 1 }; sampleBottleneck(w); }
  eq(bottleneckCard(w), null, 'mission IX: no bottleneck card');
});
