// F10 (mission VII: a slow supply is invisible) and F3 (mission IX: the shared wood hides behind
// other stalls), docs/research/2026-11-02-seasons-m7-9.md, D-38. Both are read-only diagnosis:
// contractForecast over a UI-owned pace log, sharedInput on a consumer's card. No state change.
import {
  PACE_MIN_TICKS, PACE_SAMPLE_TICKS, applyCommand, PACE_WINDOW_TICKS, TICK_HZ, contractForecast, createWorld, hashState, newPaceLog,
  samplePace, sharedInput, step, trancheForecast, trancheNeed,
} from '../src/sim/index';
import { M9_WOODCUTTER_SITE } from '../src/sim/proposals/missions-7-9';
import { STRATEGIES } from '../tools/bot-missions-7-9';
import { forecastRun, sharedRun } from '../tools/pace-readability';
import { assert, eq, test } from './harness';

test('F10: pace log samples every 10 s, keeps two minutes, restarts on an earlier tick', () => {
  const w = createWorld('m7');
  const log = newPaceLog();
  for (let i = 0; i < 200 * TICK_HZ; i++) { step(w); samplePace(log, w); }
  eq(log.ticks.length, PACE_WINDOW_TICKS / PACE_SAMPLE_TICKS + 1, 'window of samples');
  eq(log.ticks[log.ticks.length - 1]! - log.ticks[0]!, PACE_WINDOW_TICKS, 'span is the window');
  eq(log.firstTick, 1, 'the long-run sample stays');
  const fresh = createWorld('m7');
  step(fresh);
  samplePace(log, fresh);
  eq(log.ticks.length, 1, 'a load / restart starts a new log');
  eq(log.firstTick, 1, 'and a new long-run sample');
});

test('F10: no forecast before a minute of samples; never in the free valley', () => {
  const w = createWorld('m7');
  const log = newPaceLog();
  for (let i = 0; i < PACE_MIN_TICKS; i++) { step(w); samplePace(log, w); }
  const early = contractForecast(w, log)!;
  assert(early && !early.ready && early.seals === -1, 'not ready before a full minute of samples');
  for (let i = 0; i < 30 * TICK_HZ; i++) { step(w); samplePace(log, w); }
  const f = contractForecast(w, log)!;
  assert(f.ready, 'ready after a minute');
  eq(f.goods.length, 1, 'mission VII orders fish only');
  eq(f.goods[0]!.good, 'fish', 'fish');
  eq(f.goods[0]!.producers, 1, 'one fisher at the start');
  assert(Math.abs(f.goods[0]!.capPerMin - 60 / 9) < 1e-9, `one fisher at most 6.7 fish/min (${f.goods[0]!.capPerMin})`);
  const v = createWorld('sandbox');
  const vl = newPaceLog();
  for (let i = 0; i < 100 * TICK_HZ; i++) { step(v); samplePace(vl, v); }
  eq(contractForecast(v, vl), null, 'no contract, no forecast');
});

test('F10: mission VII forecast names the seals each bot strategy earns (no false "late")', () => {
  const [none, late, right] = STRATEGIES.m7.map((s) => forecastRun('m7', s));
  for (const r of [none!, late!, right!]) eq(r.falseLate, 0, `${r.strategy}: never says late on a won run`);
  // no action: one seal at 10.90 min, the waybill says so from the first minute on
  eq(none!.seals, 1, 'no action earns one seal');
  assert(none!.sealsRight / none!.samples >= 0.95, `no action: seals right ${none!.sealsRight}/${none!.samples}`);
  assert(none!.medianErrSec <= 30, `no action: median error ${none!.medianErrSec} s`);
  // the right fix: three seals, and the forecast says three throughout
  eq(right!.seals, 3, 'the right fix earns three seals');
  assert(right!.sealsRight / right!.samples >= 0.95, `fix: seals right ${right!.sealsRight}/${right!.samples}`);
  // a late fix: two minutes after it the forecast has caught up most of the time
  assert(late!.sealsRightSettled / late!.settled >= 0.6, `late fix settled: ${late!.sealsRightSettled}/${late!.settled}`);
});

test('F10/F3: reading the forecast and the shared input every tick leaves m7 and m9 hashes unchanged', () => {
  for (const id of ['m7', 'm9'] as const) {
    for (const s of STRATEGIES[id]) {
      const read = forecastRun(id, s, true), quiet = forecastRun(id, s, false);
      eq(read.hash, quiet.hash, `${id} ${s.name}`);
    }
  }
  // and a single call does not touch the state
  const w = createWorld('m9');
  const log = newPaceLog();
  for (let i = 0; i < 150 * TICK_HZ; i++) { step(w); samplePace(log, w); }
  const h = hashState(w.state);
  contractForecast(w, log);
  for (const b of w.state.buildings) sharedInput(w, b.id);
  eq(hashState(w.state), h, 'pure reads');
});

test('F3: mission IX shows the shared wood on a consumer card most of the time; rival always the other kind', () => {
  for (const s of STRATEGIES.m9) {
    const r = sharedRun(s);
    eq(r.wrongRival, 0, `${r.strategy}: rival is the other kind of wood customer`);
    assert(r.anyBefore / r.seconds < 0.08, `${r.strategy}: CONTESTED alone is rare (${r.anyBefore} s)`);
    assert(r.idleAfter / r.idle >= 0.75, `${r.strategy}: shown in ${r.idleAfter}/${r.idle} not-working seconds`);
  }
  const none = sharedRun(STRATEGIES.m9[0]!);
  assert(none.anyAfter / none.seconds >= 0.8, `no action: lesson visible ${none.anyAfter}/${none.seconds} s`);
});

test('F3: one supplier for two customers is named; a second woodcutter removes that line', () => {
  const w = createWorld('m9');
  let seen = false;
  for (let i = 0; i < 300 * TICK_HZ && !seen; i++) {
    step(w);
    const saw = w.state.buildings.find((b) => b.type === 'sawmill')!;
    const s = sharedInput(w, saw.id);
    if (s) {
      eq(s.good, 'wood', 'wood is shared');
      eq(s.producers, 1, 'one woodcutter');
      eq(s.consumers, 2, 'sawmill and charcoal burner');
      eq(w.state.buildings.find((b) => b.id === s.producer)?.type, 'woodcutter', 'the producer is the woodcutter');
      seen = true;
    }
  }
  assert(seen, 'the sawmill card shows the shared wood within five minutes');
  // the fix: a second woodcutter makes it two suppliers (the card drops "one supplier for two")
  const r = applyCommand(w, { t: 'place', type: 'woodcutter', ...M9_WOODCUTTER_SITE });
  assert(r.ok, 'second woodcutter placed');
  let two = false;
  for (let i = 0; i < 120 * TICK_HZ && !two; i++) {
    step(w);
    for (const b of w.state.buildings) {
      const s = sharedInput(w, b.id);
      if (s) { eq(s.producers, 2, 'two woodcutters now'); two = true; }
    }
  }
  assert(two, 'still shared after the fix, now with two suppliers');
  // a building that is working or waits for a pickup never gets the line
  for (const b of w.state.buildings) {
    if (b.status.k === 'WORKING' || b.status.k === 'WAITING_PICKUP') eq(sharedInput(w, b.id), null, b.type);
  }
  // mission VII: one fisher, one kind of customer (the castle): never shared
  const m7 = createWorld('m7');
  for (let i = 0; i < 120 * TICK_HZ; i++) {
    step(m7);
    for (const b of m7.state.buildings) eq(sharedInput(m7, b.id), null, 'm7 has no shared input');
  }
});

// BACKLOG P3 (D-78): an order in tranches is forecast tranche by tranche — the castle must hold the sum of the
// tranches up to the one now due; the whole order's seals stay, `aim` is not offered for a part.
test('D-78: tranche forecast covers the cumulative need of the tranche now due', () => {
  const w = createWorld('m5');
  const c = w.state.mission.contract!;
  eq(c.tranches.length, 3, 'mission V has three tranches');
  const n0 = trancheNeed(w, 0)!, n1 = trancheNeed(w, 1)!, n2 = trancheNeed(w, 2)!;
  eq(`${n0.planks}/${n0.bread}`, '6/6', 'first tranche');
  eq(`${n1.planks}/${n1.bread}`, '6/24', 'up to the second');
  eq(`${n2.planks}/${n2.bread}`, `${c.need.planks}/${c.need.bread}`, 'the last one is the whole order');
  eq(trancheNeed(w, 3), null, 'no fourth tranche');
  const log = newPaceLog();
  const before = hashState(w.state);
  for (let i = 0; i < PACE_MIN_TICKS + 20 * TICK_HZ; i++) { step(w); samplePace(log, w); }
  const f = contractForecast(w, log, n1)!;
  assert(!!f, 'a forecast');
  eq(f.goods.map((g) => `${g.good}:${g.need}`).join(','), 'planks:6,bread:24', 'goods of the part with their cumulative need');
  eq(f.aim, null, 'no aim for a part');
  if (f.ready) assert(f.finishTick > w.state.tick, 'finishes in the future');
  const again = createWorld('m5');
  eq(hashState(again.state), before, 'the same start');
});

test('D-78: tranche forecasts on m5 / m6 without a player action never say "late" (every tranche is met)', () => {
  for (const id of ['m5', 'm6']) {
    const w = createWorld(id);
    const log = newPaceLog();
    let shown = 0, falseLate = 0;
    while (w.state.mission.result === 'running' && w.state.tick < 700 * TICK_HZ) {
      for (let i = 0; i < 10 * TICK_HZ; i++) { step(w); samplePace(log, w); }
      const f = trancheForecast(w, log);
      if (!f?.ready) continue;
      const c = w.state.mission.contract!;
      const x = c.tranches.find((t) => t.doneTick < 0)!;
      shown++;
      if (f.finishTick > (x.missed ? c.deadlineTick : x.deadlineTick)) falseLate++;
    }
    const c = w.state.mission.contract!;
    assert(c.tranches.every((t) => t.doneTick >= 0 && !t.missed), `${id}: every tranche met`);
    assert(shown >= 20, `${id}: the forecast is shown (${shown} samples)`);
    eq(falseLate, 0, `${id}: no false "late"`);
  }
});
