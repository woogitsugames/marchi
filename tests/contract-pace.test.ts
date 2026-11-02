// F10 (mission VII: a slow supply is invisible) and F3 (mission IX: the shared wood hides behind
// other stalls), docs/research/2026-11-02-seasons-m7-9.md, D-36. Both are read-only diagnosis:
// contractForecast over a UI-owned pace log, sharedInput on a consumer's card. No state change.
import {
  PACE_MIN_TICKS, PACE_SAMPLE_TICKS, applyCommand, PACE_WINDOW_TICKS, TICK_HZ, contractForecast, createWorld, hashState, newPaceLog,
  samplePace, sharedInput, step,
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
