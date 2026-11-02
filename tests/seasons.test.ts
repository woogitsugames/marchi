import { assert, eq, test } from './harness';
import { RAIN_DIRT, TICK_HZ } from '../src/sim/defs';
import {
  AUTUMN_FAIR_GOOD, YEAR_TICKS, SEASON_TICKS, SEASON_WARNING_TICKS,
  effectsAt, nextChange, seasonAt,
} from '../src/sim/seasons';

const minute = 60 * TICK_HZ;
const spring = 0, summer = SEASON_TICKS, autumn = 2 * SEASON_TICKS, winter = 3 * SEASON_TICKS;

test('seasons: exact boundaries, cycle repeats without drift', () => {
  eq(SEASON_TICKS, 15 * minute, 'one season is 15 simulated minutes');
  eq(YEAR_TICKS, 4 * SEASON_TICKS, 'four seasons to a year');
  eq(seasonAt(spring), 'spring', 'starts in spring');
  eq(seasonAt(summer - 1), 'spring', 'spring last tick');
  eq(seasonAt(summer), 'summer', 'summer start inclusive');
  eq(seasonAt(autumn - 1), 'summer', 'summer last tick');
  eq(seasonAt(autumn), 'autumn', 'autumn start inclusive');
  eq(seasonAt(winter - 1), 'autumn', 'autumn last tick');
  eq(seasonAt(winter), 'winter', 'winter start inclusive');
  eq(seasonAt(YEAR_TICKS - 1), 'winter', 'winter last tick');
  eq(seasonAt(YEAR_TICKS), 'spring', 'next year begins in spring');
  eq(seasonAt(12 * YEAR_TICKS + winter), 'winter', 'many years later');
});

test('seasons: rejects invalid or inexact simulation ticks', () => {
  for (const tick of [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER]) {
    for (const fn of [seasonAt, effectsAt, nextChange]) {
      let threw = false;
      try { fn(tick); } catch (error) { threw = error instanceof RangeError; }
      assert(threw, fn.name + ' rejects ' + String(tick));
    }
  }
  eq(seasonAt(0), 'spring', 'valid tick still works');
});

test('seasons: throughput percentages are neutral outside their seasons and stay positive', () => {
  const values = [
    { tick: spring, season: 'spring', farm: 100, fish: 100 },
    { tick: summer, season: 'summer', farm: 120, fish: 100 },
    { tick: autumn, season: 'autumn', farm: 100, fish: 100 },
    { tick: winter, season: 'winter', farm: 60, fish: 50 },
    { tick: YEAR_TICKS, season: 'spring', farm: 100, fish: 100 },
  ] as const;
  for (const v of values) {
    const effect = effectsAt(v.tick);
    eq(effect.season, v.season, 'correct season effect');
    eq(effect.farmYieldPercent, v.farm, 'farm throughput percentage');
    eq(effect.fisherYieldPercent, v.fish, 'fisher throughput percentage');
    assert(effect.farmYieldPercent > 0 && effect.fisherYieldPercent > 0, 'no hard shutdown');
  }
});

test('seasons: spring thaw slows dirt only for one half-open interval', () => {
  const offset = 5 * YEAR_TICKS;
  const before = effectsAt(offset + 4 * minute - 1);
  const start = effectsAt(offset + 4 * minute);
  const end = effectsAt(offset + 8 * minute - 1);
  const after = effectsAt(offset + 8 * minute);
  eq(before.dirtSpeedMultiplier, 1, 'no slowdown before thaw');
  eq(start.dirtSpeedMultiplier, RAIN_DIRT, 'dirt slowdown equals rain tuning');
  eq(end.dirtSpeedMultiplier, 0.55, 'last thaw tick');
  eq(after.dirtSpeedMultiplier, 1, 'thaw ends exclusively');
  eq(start.thawWindow?.start, offset + 4 * minute, 'absolute thaw start');
  eq(start.thawWindow?.end, offset + 8 * minute, 'absolute thaw end');
  eq(effectsAt(summer).thawWindow, null, 'no thaw in summer');
});

test('seasons: two separate short winter ice windows, always reopening', () => {
  const offset = 2 * YEAR_TICKS;
  const start = offset + winter;
  const windows = effectsAt(start).iceWindows;
  eq(windows.length, 2, 'two ice intervals');
  eq(windows[0]!.start, start + 3 * minute, 'first bridge closure begins later');
  eq(windows[0]!.end, start + 5 * minute, 'first closure end');
  eq(windows[1]!.start, start + 9 * minute, 'second closure start');
  eq(windows[1]!.end, start + 11 * minute, 'second closure end');
  for (const [i, win] of windows.entries()) {
    eq(effectsAt(win.start - 1).closedBridgeUntilTick, null, 'window ' + i + ' not premature');
    eq(effectsAt(win.start).closedBridgeUntilTick, win.end, 'window ' + i + ' start inclusive');
    eq(effectsAt(win.end - 1).closedBridgeUntilTick, win.end, 'window ' + i + ' last tick');
    eq(effectsAt(win.end).closedBridgeUntilTick, null, 'window ' + i + ' end exclusive');
    assert(win.start < win.end, 'ice duration positive');
  }
  eq(effectsAt(start + 6 * minute).closedBridgeUntilTick, null, 'bridge opens between intervals');
  eq(effectsAt(offset + YEAR_TICKS).iceWindows.length, 0, 'no ice in spring');
});

test('seasons: fair affects exactly one product at +25% and only in autumn', () => {
  eq(AUTUMN_FAIR_GOOD, 'beer', 'single fair product');
  for (const t of [spring, summer, winter, YEAR_TICKS]) {
    eq(effectsAt(t).fair, null, 'no fair outside autumn');
  }
  eq(effectsAt(autumn).fair?.good, 'beer', 'beer fair');
  eq(effectsAt(autumn).fair?.pricePercent, 125, 'quarter bonus');
  eq(effectsAt(autumn + SEASON_TICKS - 1).fair?.pricePercent, 125, 'fair until last tick');
});

test('seasons: next change is strictly future and announced two minutes early', () => {
  eq(SEASON_WARNING_TICKS, 2 * minute, 'two-minute lead');
  const first = nextChange(0);
  eq(first.kind, 'thaw-start', 'first event is thaw start');
  eq(first.atTick, 4 * minute, 'first event position');
  eq(first.announced, false, 'no premature banner');
  eq(nextChange(2 * minute - 1).announced, false, 'one tick before notice');
  eq(nextChange(2 * minute).announced, true, 'notice begins at exact tick');
  eq(nextChange(4 * minute - 1).kind, 'thaw-start', 'next event up to boundary');
  eq(nextChange(4 * minute).kind, 'thaw-end', 'changes after transition');
  eq(nextChange(8 * minute).kind, 'season', 'next season is next event');
  eq(nextChange(summer - 1).nextSeason, 'summer', 'season change destination');
  eq(nextChange(summer).nextSeason, 'autumn', 'summer began, autumn now next');
  eq(nextChange(YEAR_TICKS - 1).nextSeason, 'spring', 'year end wraps');
  eq(nextChange(YEAR_TICKS).kind, 'thaw-start', 'new-year thaw schedule');
});

test('seasons: ice closure warning and thawing are visible as distinct future events', () => {
  const firstIce = winter + 3 * minute;
  eq(nextChange(winter).kind, 'ice-start', 'first winter event is freeze');
  eq(nextChange(firstIce - SEASON_WARNING_TICKS - 1).announced, false, 'ice not announced too early');
  const notice = nextChange(firstIce - SEASON_WARNING_TICKS);
  eq(notice.kind, 'ice-start', 'ice closing event');
  eq(notice.announced, true, 'bridge closure warned before it happens');
  eq(notice.ticksUntil, SEASON_WARNING_TICKS, 'full two-minute lead');
  eq(nextChange(firstIce).kind, 'ice-end', 'thaw next after ice starts');
  eq(nextChange(winter + 5 * minute).kind, 'ice-start', 'another freeze in winter');
  eq(nextChange(winter + 9 * minute).kind, 'ice-end', 'second reopen');
  eq(nextChange(winter + 11 * minute).kind, 'season', 'spring comes after ice');
});

test('seasons: pure read, repeatable across years, returned windows are independent', () => {
  const tick = winter + 4 * minute;
  const before = JSON.stringify(effectsAt(tick));
  const later = effectsAt(tick + YEAR_TICKS);
  eq(later.closedBridgeUntilTick, effectsAt(tick).closedBridgeUntilTick! + YEAR_TICKS, 'winter ice shifts by one year');
  eq(JSON.stringify(effectsAt(tick)), before, 'repeatable output');
  const mutated = effectsAt(tick);
  // A caller may prepare separate state data without altering the module's outputs.
  (mutated.iceWindows as { start: number; end: number }[])[0]!.start = -100;
  eq(JSON.stringify(effectsAt(tick)), before, 'no hidden shared mutable windows');
  eq(nextChange(tick).atTick, winter + 5 * minute, 'query order does not matter');
});
