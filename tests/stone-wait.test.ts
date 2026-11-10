// D-420: a held wooden span whose stone bridge only waits for stone a standing quarry is digging (or wagons already
// bring) is a calm pin with the wait, not the red card with a grey "Wyłóż most kamieniem". A quarry that does not dig
// keeps the red card (its own stall is the cause). Synthetic statuses on a real valley (as dead-cards.test.ts).
import { BUILDINGS, TICK_HZ, applyCommand, createWorld, cycleTicks, net, suggestLinkToStable, type Building, type World } from '../src/sim/index';
import { readFileSync } from 'node:fs';
import { HELD_SPAN_TICKS, cureFor, paveCheck, paveSpanFor, paveStoneHaul, paveStoneWait, quarryForPave, rankStalls } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

function heldPost(): { w: World; post: Building; quarry: Building; need: number } {
  const w = createWorld('sandbox');
  w.state.town.rank = 5;
  w.state.coins = 100000;
  const post = w.state.buildings.find((b) => b.type === 'tradePost')!;
  const sug = suggestLinkToStable(w, post.id);
  assert(!!sug, 'a road to the trading post');
  assert(applyCommand(w, { t: 'road', surface: 1, cells: sug!.cells }).ok, 'road');
  const sp = net(w).span;
  let span = -1;
  for (let i = 0; i < sp.length && span < 0; i++) if (sp[i]! >= 0) span = sp[i]!;
  assert(span >= 0, 'the road crosses the river on a wooden span');
  const stable = w.state.buildings.find((b) => b.type === 'stable')!;
  const wh = w.state.buildings.find((b) => b.type === 'warehouse')!;
  assert(applyCommand(w, { t: 'buyWagon', stable: stable.id }).ok, 'buy a wagon');
  const wg = w.state.wagons.at(-1)!;
  w.state.tick += HELD_SPAN_TICKS + TICK_HZ;
  wg.job = { id: 1, good: 'bread', qty: 1, from: wh.id, to: post.id, phase: 'dropoff' };
  wg.status = { k: 'BRIDGE_JAM', span, blocker: -1, since: w.state.tick - HELD_SPAN_TICKS - 1 };
  for (const b of w.state.buildings) if (b.type === 'warehouse' || b.type === 'castle') b.stock.stone = 0;
  // a quarry stands (a copy of the woodcutter as a quarry: no stone yet, digging its first unit)
  const quarry: Building = { ...structuredClone(w.state.buildings.find((b) => b.type === 'woodcutter')!), id: 9999, type: 'quarry', progress: 0 };
  w.state.buildings.push(quarry);
  const h = paveSpanFor(w, post)!;
  const ok = paveCheck(w, h);
  assert(!ok.ok && ok.err.k === 'NO_STONE', `no stone: ${JSON.stringify(ok)}`);
  return { w, post, quarry, need: !ok.ok && ok.err.k === 'NO_STONE' ? ok.err.need : 0 };
}

const entry = (w: World, id: number) => rankStalls(w).find((e) => e.id === id);

test('stone wait: a quarry digging the stone -> calm pin with the dig time, cure stays pave (D-420)', () => {
  const { w, post, quarry, need } = heldPost();
  const cycle = cycleTicks(w, 'quarry', BUILDINGS.quarry.recipe!.ticks);
  quarry.progress = 30;
  const sw = paveStoneWait(w, post);
  assert(!!sw, 'a stone wait');
  eq(sw!.short, need, 'all stone missing');
  eq(sw!.digTicks, cycle - 30 + (need - 1) * cycle, 'the rest of this cycle, then one cycle per unit');
  const e = entry(w, post.id);
  assert(!!e && e.minor && !e.crit, `calm pin: ${JSON.stringify(e)}`);
  eq(cureFor(w, post.id), 'pave', 'the sheet still owns the span (calm hint, no grey button)');
  eq(quarryForPave(w, post), -1, 'no quarry offer: one stands');
});

test('stone wait: stone already dug (at the quarry, on the way) -> calm, no dig time (D-420)', () => {
  const { w, post, quarry, need } = heldPost();
  quarry.stock.stone = need - 1;
  w.state.buildings.find((b) => b.type === 'warehouse')!.incoming.stone = 1;
  const sw = paveStoneWait(w, post);
  eq(JSON.stringify(sw), JSON.stringify({ short: need, incoming: 1, atQuarry: need - 1, digTicks: 0 }), 'all of it dug');
  assert(entry(w, post.id)!.minor, 'calm pin');
});

test('stone wait: a quarry that does not dig, stone in store, a mission -> no wait (D-420)', () => {
  const a = heldPost();
  a.quarry.progress = -1;
  eq(paveStoneWait(a.w, a.post), null, 'idle quarry, nothing dug: the red card stays');
  const e = entry(a.w, a.post.id);
  assert(!!e && e.crit && !e.minor, 'red card');
  const b = heldPost();
  b.w.state.buildings.find((q) => q.type === 'warehouse')!.stock.stone = b.need;
  eq(paveStoneWait(b.w, b.post), null, 'stone in store: the live button');
  assert(entry(b.w, b.post.id)!.crit, 'red card with a live cure');
  const m = createWorld('m1');
  eq(paveStoneWait(m, m.state.buildings[0]!), null, 'mission');
});

test('stone wait: a quarry whose full yard waits for a booked wagon still digs -> calm, not a grey button (D-430)', () => {
  // valley seed 1314 card-30, 96:01-101:22: the quarry's 8 stone booked by wagons for the trading post (WAITING_PICKUP,
  // progress -1), 1 stone short in the granaries — the red trading-post card's only cure was the grey stone button
  const { w, post, quarry, need } = heldPost();
  const cycle = cycleTicks(w, 'quarry', BUILDINGS.quarry.recipe!.ticks);
  quarry.progress = -1;
  quarry.stock.stone = 8;
  quarry.reservedOut.stone = 8;
  quarry.status = { k: 'WAITING_PICKUP', good: 'stone', wagon: w.state.wagons[0]!.id };
  const sw = paveStoneWait(w, post);
  assert(!!sw, 'a stone wait');
  eq(sw!.atQuarry, 0, 'the yard is booked for elsewhere');
  eq(sw!.digTicks, need * cycle, 'one whole cycle per missing unit (the pickup is not guessed)');
  const e = entry(w, post.id);
  assert(!!e && e.minor && !e.crit, `calm pin: ${JSON.stringify(e)}`);
  // a full yard with no wagon booked (OUTPUT_FULL) is the quarry's own stall: the red card stays
  quarry.status = { k: 'OUTPUT_FULL', good: 'stone', cause: 'NO_WAGON', blockedBy: -1 };
  eq(paveStoneWait(w, post), null, 'a quarry stalled on its own yard: no wait');
});

test('stone wait: a quarry whose yard a wagon is already driving to (WAGON_DUE) still digs -> calm (D-591)', () => {
  // valley seed 1310 card-60, 110:44-110:45: the quarry's 8 stone not booked yet, wagon 7 on its way (progress -1)
  const { w, post, quarry, need } = heldPost();
  const cycle = cycleTicks(w, 'quarry', BUILDINGS.quarry.recipe!.ticks);
  quarry.progress = -1;
  quarry.stock.stone = need - 1;
  quarry.status = { k: 'WAGON_DUE', good: 'stone', wagon: w.state.wagons[0]!.id, at: w.state.tick + 50 };
  const sw = paveStoneWait(w, post);
  assert(!!sw, 'a stone wait');
  eq(sw!.atQuarry, need - 1, 'the dug stone lies there');
  eq(sw!.digTicks, cycle, 'the last unit one cycle after the pickup');
  assert(entry(w, post.id)!.minor, 'calm pin');
  eq(paveStoneHaul(w, post), -1, 'no haul cure: a wagon comes');
});

test('stone wait: dug stone in a quarry yard no wagon collects -> red card with "Kup wóz", not the grey stone button (D-591)', () => {
  // valley seeds 1310 / 1317 card-60, 110:37-110:45: OUTPUT_FULL.NO_WAGON, 8 of 9 stone at the quarry, every wagon
  // busy — the trading post's only cure was the grey "Wyłóż most kamieniem" for 9-11 s
  const { w, post, quarry, need } = heldPost();
  quarry.progress = -1;
  quarry.stock.stone = need - 1;
  quarry.status = { k: 'OUTPUT_FULL', good: 'stone', cause: 'NO_WAGON', blockedBy: -1 };
  eq(paveStoneWait(w, post), null, 'no calm wait: the quarry cannot dig the rest');
  eq(paveStoneHaul(w, post), quarry.id, 'the stone waits for a wagon at this quarry');
  const e = entry(w, post.id);
  assert(!!e && e.crit, 'red card: something to do');
  eq(cureFor(w, post.id), 'wagon', 'the cure is a wagon (the rail lights it, the sheet offers it)');
  eq(quarryForPave(w, post), -1, 'no quarry offer');
  // all of the yard booked already (WAITING_PICKUP) is D-430's calm wait, not this cure
  quarry.reservedOut.stone = need - 1;
  quarry.status = { k: 'WAITING_PICKUP', good: 'stone', wagon: w.state.wagons[0]!.id };
  eq(paveStoneHaul(w, post), -1, 'booked: no haul cure');
  eq(cureFor(w, post.id), 'pave', 'the calm stone wait again');
});

test('stone wait: the HUD card and the sheet name the missing wagon (D-591)', () => {
  const src = (f: string): string => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  assert(/haul \? 'cause\.stoneWagon'/.test(src('ui/hud.ts')), 'card reason: the stone waits for a free wagon');
  assert(/paveStoneHaul\(world, b\) >= 0[\s\S]{0,300}t\('fix\.stoneWagon'/.test(src('ui/panels.ts')), 'sheet hint beside "Kup wóz"');
});
