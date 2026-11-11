// UI reading cost budget (D-730..D-734): the stall cards' reading code must not redo work the state has not changed.
// Counts work (searches, map scans, formatter constructions), never time. The cost itself: tools/ui-read-cost.ts.
import { TICK_HZ, applyCommand, createWorld, jsonCopy, net, pausedReading, stateHash, step, type World } from '../src/sim/index';
import { dispatch } from '../src/sim/logistics';
import { heldSpanFor, rankStalls, readStats } from '../src/ui/stalls';
import { fmtDayTime, setFmtLang } from '../src/ui/fmt';
import { pluralize } from '../src/i18n/plural';
import { valleyDriver } from '../tools/robustness';
import { assert, eq, test } from './harness';

/** The reading before D-733: a JSON copy with cold caches, dispatched. */
function coldReading(w: World): World {
  const copy: World = { terrain: w.terrain, state: JSON.parse(JSON.stringify(w.state)), cache: null, scratch: null, seasons: w.seasons };
  dispatch(copy);
  return copy;
}

test('D-733: jsonCopy is JSON.parse(JSON.stringify(v)) for plain data', () => {
  const odd = { b: 1, a: [1, undefined, -0, NaN, Infinity, { z: undefined, y: -0 }], 2: 'two', 1: { k: [[]] }, f: () => 1, n: null, s: 'x' };
  eq(JSON.stringify(jsonCopy(odd)), JSON.stringify(JSON.parse(JSON.stringify(odd))), 'odd values');
  const neg = jsonCopy({ v: -0 }) as { v: number };
  assert(Object.is(neg.v, 0), '-0 becomes 0 as through JSON text');
  const w = createWorld('m16');
  for (let i = 0; i < 900; i++) step(w);
  const c = jsonCopy(w.state);
  eq(JSON.stringify(c), JSON.stringify(w.state), 'a mission state');
  assert(c !== w.state && (c as typeof w.state).wagons !== w.state.wagons, 'a deep copy');
});

test('D-733: the paused reading equals a cold one, leaves the world alone and repeats no memoized search', () => {
  let readings = 0, borrowedSearches = 0, coldSearches = 0;
  for (const id of ['m4', 'm16', 'sandbox']) {
    const w = createWorld(id);
    const drive = id === 'sandbox' ? valleyDriver() : null;
    const end = (id === 'sandbox' ? 25 : 6) * 60 * TICK_HZ;
    while (w.state.tick < end && w.state.mission.result === 'running') {
      if (drive) for (const c of drive(w)) applyCommand(w, c);
      step(w);
      // a pause every 20 s, one tick after the dispatch tick and at an odd one
      if (w.state.tick % (20 * TICK_HZ) !== 1 && w.state.tick % (20 * TICK_HZ) !== 13) continue;
      const hash = stateHash(w), memo = w.distMemo, maps = memo ? new Map(memo.maps) : null, cache = w.cache;
      const r = pausedReading(w);
      const cold = coldReading(w);
      eq(JSON.stringify(r.state), JSON.stringify(cold.state), `${id}@${w.state.tick}: same reading as a cold copy`);
      eq(stateHash(w), hash, 'the world is untouched');
      assert(w.distMemo === memo && w.cache === cache, 'the world keeps its own memo and cache objects');
      if (memo && maps) {
        eq(memo.maps.size, maps.size, 'no entry added to the world\'s memo');
        for (const [k, v] of maps) assert(memo.maps.get(k) === v, 'the world\'s memo maps are its own');
      }
      readings++;
      const rm = r.distMemo;
      borrowedSearches += !rm ? 0 : rm.borrowed ? rm.maps.size - (memo?.maps.size ?? 0) : rm.maps.size;
      coldSearches += cold.distMemo?.maps.size ?? 0;
    }
  }
  assert(readings >= 20, `enough readings (${readings})`);
  assert(coldSearches > 0, 'the cold copies search');
  // the borrowed memo repeats at most a tenth of the searches a cold copy runs (bridge queues, weather may differ)
  assert(borrowedSearches * 10 <= coldSearches, `searches in the readings: ${borrowedSearches} vs ${coldSearches} cold`);
  console.log(`     readings=${readings} searches borrowed=${borrowedSearches} cold=${coldSearches}`);
});

test('D-732: the span cells of a held wagon are walked once per network version, not per building and tick', () => {
  for (const id of ['m2', 'm4']) {
    const w = createWorld(id);
    w.state.coins += 1000;
    const before = readStats.spanWalks;
    const nets = new Set<number>();
    let held = 0;
    while (w.state.tick < 9 * 60 * TICK_HZ) {
      step(w);
      for (const e of rankStalls(w)) {
        const h = heldSpanFor(w, w.state.buildings.find((q) => q.id === e.id)!);
        if (h) { held++; nets.add(w.state.netVersion * 100000 + net(w).span[h.cells[0]!]!); }
      }
    }
    assert(held > 50, `${id}: a wagon held at a span for a while (${held} readings)`);
    const walks = readStats.spanWalks - before;
    assert(walks <= nets.size + 2, `${id}: ${walks} walks for ${nets.size} spans × network versions`);
  }
});

test('D-731: the HUD clock formats once a game minute, plural numbers reuse one formatter', () => {
  setFmtLang('pl');
  const proto = Intl.DateTimeFormat.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'format')!;
  let calls = 0;
  // `format` is a getter returning the bound formatter: count the reads
  Object.defineProperty(proto, 'format', { ...desc, get() { calls++; return desc.get!.call(this); } });
  try {
    const f = 0.5 + 10 / (24 * 60);
    const a = fmtDayTime(f);
    for (let i = 0; i < 100; i++) eq(fmtDayTime(f + i * 1e-7), a, 'same minute, same text');
    eq(calls, 1, 'one format call for one minute');
    eq(fmtDayTime(f + 1 / (24 * 60)), '12:11', 'the next minute');
  } finally {
    Object.defineProperty(proto, 'format', desc);
  }
  const Real = Intl.NumberFormat;
  let made = 0;
  (Intl as { NumberFormat: unknown }).NumberFormat = new Proxy(Real, { construct(t, args) { made++; return Reflect.construct(t, args); } });
  try {
    const rules = new Intl.PluralRules('pl');
    for (let i = 0; i < 50; i++) pluralize('{n, plural, one {# wóz} few {# wozy} other {# wozów}}', { n: i }, 'pl', rules, false);
    assert(made <= 1, `${made} NumberFormat constructions for 50 plural texts`);
    eq(pluralize('{n, plural, one {# wóz} few {# wozy} other {# wozów}}', { n: 1234 }, 'pl', rules, false), `${new Real('pl-u-nu-latn').format(1234)} wozy`, 'same text');
  } finally {
    (Intl as { NumberFormat: unknown }).NumberFormat = Real;
  }
});
