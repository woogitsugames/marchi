// Gap finder (research 2026-11-04, P2): among equally cheap links the road leaves the network straight and on the
// side of the building that has to reach the target, not diagonally toward the stable.
import { TICK_HZ, createWorld, lineCells, stateHash, step, suggestLinkToStable, type World } from '../src/sim/index';
import { M12_GRANARY_LINK } from '../src/sim/proposals/missions-10-12';
import { assert, eq, test } from './harness';

const cellsOf = (w: World, list: number[]): string => list.map((i) => `${i % w.terrain.w},${Math.floor(i / w.terrain.w)}`).sort().join(' ');

test('gap finder: the granary link of V, VI and XII is the authored straight one (37,38)-(37,39)', () => {
  for (const id of ['m5', 'm6', 'm12']) {
    const w = createWorld(id);
    for (let i = 0; i < 30 * TICK_HZ; i++) step(w);
    const big = w.state.buildings.find((b) => b.type === 'warehouse' && b.x === 36 && b.y === 35)!;
    const s = suggestLinkToStable(w, big.id)!;
    assert(!!s, `${id}: a link is offered`);
    const want = lineCells(w.terrain.w, M12_GRANARY_LINK.y1 * w.terrain.w + M12_GRANARY_LINK.x, M12_GRANARY_LINK.y2 * w.terrain.w + M12_GRANARY_LINK.x);
    eq(cellsOf(w, s.newCells), cellsOf(w, want), `${id}: new cells`);
    eq(s.cost, 2, `${id}: two dirt cells`);
    eq(s.cells[s.cells.length - 1], big.gate, `${id}: the path ends at the granary gate`);
    assert(w.state.roads[s.cells[0]!] === 1, `${id}: and starts on the network`);
  }
});

test('gap finder: mission I still offers the 30-silver crossing; reading it changes nothing', () => {
  const w = createWorld('m1');
  const before = stateHash(w);
  const saw = w.state.buildings.find((b) => b.type === 'farm')!;
  const s = suggestLinkToStable(w, saw.id)!;
  assert(!!s && s.cost === 30 && s.bridgeCells > 0, `a 30-silver crossing with a bridge (got ${s?.cost}, ${s?.bridgeCells})`);
  // contiguous: every step is to one of the 8 neighbours
  for (let i = 1; i < s.cells.length; i++) {
    const a = s.cells[i - 1]!, b = s.cells[i]!, W = w.terrain.w;
    assert(Math.abs((a % W) - (b % W)) <= 1 && Math.abs(Math.floor(a / W) - Math.floor(b / W)) <= 1, 'contiguous path');
  }
  eq(stateHash(w), before, 'read-only');
  // a connected building gets no suggestion
  const stable = w.state.buildings.find((b) => b.type === 'stable')!;
  const near = w.state.buildings.find((b) => b.type === 'sawmill')!;
  eq(suggestLinkToStable(w, near.id), null, 'connected sawmill: nothing to build');
  eq(suggestLinkToStable(w, stable.id), null, 'the stable itself: nothing');
});
