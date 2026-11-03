// Mission I tutorial step 5: the ghost crossing is the part to draw, short enough for a phone screen,
// and dragging exactly those cells connects the sawmill and the castle (day 6 repro: the full
// 62-cell route started and ended off screen, so a drag along it built nothing).
import { applyCommand, createWorld, findPath, suggestConnection } from '../src/sim/index';
import { crossingSpan, trimToNew } from '../src/ui/tutorialCrossing';
import { assert, eq, test } from './harness';

test('tutorial crossing: trimmed to the new cells plus one road cell at each end', () => {
  eq(String(trimToNew([1, 2, 3, 4, 5, 6], [0, 1, 1, 0, 0, 1, 1])), '2,3,4,5', 'margin of one road cell');
  eq(String(trimToNew([3, 4], [0, 0, 0, 0, 0])), '3,4', 'all new: unchanged');
  eq(trimToNew([1, 2], [0, 1, 1]), null, 'nothing new');
});

test('tutorial crossing in mission I: short, starts and ends on road, building it connects the sawmill to the castle', () => {
  const w = createWorld('m1');
  const st = w.state;
  const saw = st.buildings.find((b) => b.type === 'sawmill')!;
  const castle = st.buildings.find((b) => b.id === st.mission.contract!.castle)!;
  const full = suggestConnection(w, saw.gate, castle.gate)!;
  const span = crossingSpan(w)!;
  assert(span !== null, 'a crossing exists');
  assert(span.length < full.cells.length / 2, `span ${span.length} much shorter than the route ${full.cells.length}`);
  assert(span.length <= 24, `span ${span.length} fits a phone screen`);
  assert(!!st.roads[span[0]!] && !!st.roads[span[span.length - 1]!], 'both ends on existing road');
  for (const c of full.newCells) assert(span.includes(c), `new cell ${c} in the span`);
  eq(findPath(w, saw.gate, castle.gate, false), null, 'not connected before');
  const r = applyCommand(w, { t: 'road', cells: span, surface: 1 });
  assert(r.ok, 'the drawn crossing is a valid road');
  assert(findPath(w, saw.gate, castle.gate, false) !== null, 'connected after');
  eq(crossingSpan(w), null, 'nothing left to draw');
});
