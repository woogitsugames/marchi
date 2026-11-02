import { assert, eq, test } from './harness';
import { createWorld, lineCells, net } from '../src/sim/index';
import { generateValley } from '../src/sim/terrain';
import type { SimState } from '../src/sim/types';
import {
  closedSpanEntry, closedSpans, iceClosingUntil, M4_ICE_WINDOW,
} from '../src/sim/proposals/ice';
import { M4_MISSION, M4_VALLEY } from '../src/sim/proposals/m4';

function sample(roads: number[], tick: number, id = 'm4'): Pick<SimState, 'roads' | 'tick' | 'mission'> {
  return {
    tick, roads,
    mission: { id, contract: null, result: 'running', endTick: -1, roadStone: false },
  };
}

test('M4 ice: start is inclusive, end exclusive, other missions stay dry', () => {
  const w = createWorld('m2');
  const st = w.state;
  st.mission.id = 'm4';
  const before = JSON.stringify(st.roads);
  st.tick = M4_ICE_WINDOW.start - 1;
  eq(iceClosingUntil(st), null, 'before ice');
  eq(closedSpans(st, w.terrain).size, 0, 'no premature closure');
  st.tick = M4_ICE_WINDOW.start;
  eq(iceClosingUntil(st), M4_ICE_WINDOW.end, 'the reopening tick');
  eq(closedSpans(st, w.terrain).size, 1, 'one original wooden span');
  st.tick = M4_ICE_WINDOW.end - 1;
  eq(closedSpans(st, w.terrain).size, 1, 'last frozen tick');
  st.tick = M4_ICE_WINDOW.end;
  eq(iceClosingUntil(st), null, 'end is exclusive');
  eq(closedSpans(st, w.terrain).size, 0, 'open again');
  st.mission.id = 'm2';
  st.tick = M4_ICE_WINDOW.start;
  eq(closedSpans(st, w.terrain).size, 0, 'M2 is unaffected');
  eq(JSON.stringify(st.roads), before, 'ice helper never modifies roads');
});

test('M4 ice: span IDs agree with network 8-neighbour flood fill', () => {
  const w = createWorld('m2');
  w.state.mission.id = 'm4';
  w.state.tick = M4_ICE_WINDOW.start;
  const expected = new Set(Array.from(net(w).span).filter((s) => s >= 0));
  const actual = closedSpans(w.state, w.terrain);
  eq(JSON.stringify([...actual]), JSON.stringify([...expected].sort((a, b) => a - b)), 'same span IDs');
  const terrain = { w: 5, h: 5, water: new Array(25).fill(0) };
  const roads = new Array(25).fill(0);
  for (const cell of [1, 7, 20]) { terrain.water[cell] = 1; roads[cell] = 1; }
  const ice = closedSpans(sample(roads, M4_ICE_WINDOW.start), terrain);
  eq(JSON.stringify([...ice]), JSON.stringify([1, 20]), 'diagonal cells share span; isolated one differs');
  roads[7] = 2;
  eq(JSON.stringify([...closedSpans(sample(roads, M4_ICE_WINDOW.start), terrain)]),
    JSON.stringify([1, 20]), 'stone cell cannot join wooden spans');
});

test('M4 ice: stone bypass and safe exit for wagons already on the bridge', () => {
  const w = createWorld('m2');
  const st = w.state, t = w.terrain;
  st.mission.id = 'm4';
  st.tick = M4_ICE_WINDOW.start;
  const bridge = lineCells(t.w, 30 * t.w + 51, 42 * t.w + 51);
  const initial = closedSpans(st, t);
  eq(initial.size, 1, 'one icy bridge');
  const sp = [...initial][0]!;
  const onSpan = bridge.filter((c) => net(w).span[c] === sp);
  assert(onSpan.length >= 4, 'nonempty wooden bridge');
  const from = bridge[0]!;
  const enter = onSpan[0]!;
  const inside = onSpan[1]!;
  eq(closedSpanEntry(initial, net(w).span, from, enter), sp, 'do not enter ice');
  eq(closedSpanEntry(initial, net(w).span, enter, inside), null, 'inside movement allowed');
  eq(closedSpanEntry(initial, net(w).span, onSpan[onSpan.length - 1]!, bridge[bridge.length - 1]!), null,
    'exit remains allowed');
  for (const cell of onSpan) st.roads[cell] = 2;
  st.netVersion++;
  eq(closedSpans(st, t).size, 0, 'stone bridge stays open through ice');
  assert(onSpan.every((cell) => net(w).span[cell] === -1), 'stone bridge is no longer a wooden span');
});

test('M4 data: same supported valley geometry and exactly one original crossing', () => {
  const t = generateValley(M4_VALLEY), roads = new Array(t.w * t.h).fill(0);
  eq(t.w, 96, 'valley width');
  eq(t.h, 72, 'valley height');
  eq(M4_MISSION.rain?.length, 0, 'no second weather lesson');
  for (const poly of M4_MISSION.roads) {
    for (let k = 1; k < poly.length; k++) {
      const a = poly[k - 1]!, b = poly[k]!;
      for (const c of lineCells(t.w, a[1] * t.w + a[0], b[1] * t.w + b[0])) {
        if (M4_MISSION.roadsOverWater || !t.water[c]) roads[c] = 1;
      }
    }
  }
  const frozen = closedSpans(sample(roads, M4_ICE_WINDOW.start), t);
  eq(frozen.size, 1, 'one target wooden span in mission roads');
  const bridgeCells = lineCells(t.w, 30 * t.w + 51, 42 * t.w + 51);
  assert(bridgeCells.filter((c) => t.water[c] === 1).length >= 4, 'bridge covers river width');
  assert(bridgeCells.filter((c) => t.water[c] === 1).every((c) => roads[c] === 1),
    'water crossing is wooden');
});
