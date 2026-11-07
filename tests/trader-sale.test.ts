// The trader's sale gesture at the open trading post (D-323): the sale is read from tradePost.recent (pure, no sim
// state added), the gesture is calm and returns exactly to the idle loop.
import { TRADER_SALE, type WorkerPose, traderSalePose, workerPose } from '../src/render/models/people';
import { SALE_FRESH_S, freshPostSale, lastPostSaleTick } from '../src/render/postSale';
import { applyCommand, createWorld, lineCells, stateHash, step, TICK_HZ, type World } from '../src/sim/index';
import { assert, eq, test } from './harness';

test('trader sale: newest sale tick read from the post, -1 without one', () => {
  eq(lastPostSaleTick({}), -1, 'no post');
  const tp = { building: 1, saturation: {} as never, sold: {} as never, earnedCents: 0, recent: [] as { tick: number; good: 'grain'; qty: number; cents: number }[] };
  eq(lastPostSaleTick({ tradePost: tp }), -1, 'nothing sold');
  tp.recent.push({ tick: 40, good: 'grain', qty: 4, cents: 100 }, { tick: 95, good: 'grain', qty: 2, cents: 50 });
  eq(lastPostSaleTick({ tradePost: tp }), 95, 'newest last');
});

test('trader sale: a new, recent sale starts the gesture; the first look, old and repeated sales do not', () => {
  assert(freshPostSale(-1, 100, 101), 'first sale ever, one tick ago');
  assert(freshPostSale(80, 100, 100 + SALE_FRESH_S * TICK_HZ), 'new sale at the freshness limit');
  assert(!freshPostSale(100, 100, 101), 'same sale seen again');
  assert(!freshPostSale(-2, 100, 101), 'fresh view: the first look only records');
  assert(!freshPostSale(80, 100, 101 + SALE_FRESH_S * TICK_HZ), 'old sale revealed by a load');
  assert(!freshPostSale(80, 300, 200), 'sale from the future (another save)');
  assert(!freshPostSale(100, -1, 200), 'world without sales swapped in');
});

test('trader sale: reading the cue leaves the sim state untouched', () => {
  const world: World = createWorld('sandbox');
  for (let i = 0; i < 50; i++) step(world);
  const before = JSON.stringify(world.state);
  const s = lastPostSaleTick(world.state);
  freshPostSale(-1, s, world.state.tick);
  eq(JSON.stringify(world.state), before, 'state unchanged');
});

test('trader sale: the gesture leans over the counter, raises, bends to the box and ends on the idle pose', () => {
  const p: WorkerPose = { bend: 0, arm: 0, lift: 0 }, idle: WorkerPose = { bend: 0, arm: 0, lift: 0 };
  const at = (age: number, t = 3.1) => { workerPose('trader', t, true, p); workerPose('trader', t, true, idle); traderSalePose(age, p); return { ...p }; };
  const D = Math.PI / 180;
  const reach = at(0.7), weigh = at(1.45), drop = at(2.3);
  assert(reach.bend > 18 * D && reach.arm < 0, `reach: leaning over, arms out (${reach.bend}, ${reach.arm})`);
  assert(weigh.bend < 8 * D && weigh.arm < -30 * D, `weigh: upright, hands raised (${weigh.bend}, ${weigh.arm})`);
  assert(drop.bend > 18 * D && drop.arm > 40 * D, `drop: bent to the box (${drop.bend}, ${drop.arm})`);
  for (const age of [-0.1, TRADER_SALE, TRADER_SALE + 1]) {
    const q = at(age);
    eq(q.bend, idle.bend, `idle bend outside the gesture (${age})`);
    eq(q.arm, idle.arm, `idle arm outside the gesture (${age})`);
  }
  // calm: no jump between 60 fps frames anywhere in the gesture (< 3.5° per frame, ~210°/s), and it eases into the idle pose
  let prev = at(0);
  assert(Math.abs(prev.bend - idle.bend) < 1e-9 && Math.abs(prev.arm - idle.arm) < 1e-9, 'starts on the idle pose');
  for (let a = 1 / 60; a <= TRADER_SALE + 1e-9; a += 1 / 60) {
    const q = at(a);
    assert(Math.abs(q.bend - prev.bend) < 3.5 * D && Math.abs(q.arm - prev.arm) < 3.5 * D, `smooth at ${a.toFixed(2)} s`);
    prev = q;
  }
});

test('trader sale: live trade at the post — every frame that sees a new wagon sale starts one gesture, hashes untouched', () => {
  // the open valley of tests/trade-post.test.ts: rank 4, a road from the castle to the post's gate, four wagons
  const W = 96, at = (x: number, y: number) => y * W + x;
  const mk = (): World => {
    const w = createWorld('sandbox');
    w.state.town.rank = 4;
    w.state.coins = 5000;
    eq(applyCommand(w, { t: 'road', surface: 1, cells: lineCells(W, at(39, 25), at(39, 57)) }).ok, true, 'road to the post');
    const stable = w.state.buildings.find((b) => b.type === 'stable')!;
    for (let i = 0; i < 4; i++) applyCommand(w, { t: 'buyWagon', stable: stable.id });
    return w;
  };
  const w = mk(), ref = mk();
  // the view samples the state once per frame: here every 2nd tick (×4 at 20 fps), as the buildings view does
  let seen = -2, gestures = 0, sales = 0, earned = 0;
  for (let i = 0; i < 5 * 60 * TICK_HZ; i++) {
    step(w); step(ref);
    if (w.state.tradePost!.earnedCents !== earned) { earned = w.state.tradePost!.earnedCents; sales++; }
    if (i % 2) continue;
    const s = lastPostSaleTick(w.state);
    if (freshPostSale(seen, s, w.state.tick)) gestures++;
    seen = s;
  }
  assert(sales > 0, 'wagons sold at the post');
  // two wagons unloading in one frame play one gesture; never more gestures than sales
  assert(gestures > 0 && gestures <= sales, `gestures ${gestures} for ${sales} sales`);
  eq(stateHash(w), stateHash(ref), 'reading the cue every frame changes nothing');
});
