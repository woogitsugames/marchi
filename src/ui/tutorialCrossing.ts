// Mission I tutorial, step 5: the ghost crossing the player is asked to drag. suggestConnection
// returns the whole route from the sawmill gate to the castle gate, existing road included (62 cells
// in mission I, both ends off a phone screen). The player only has to draw the missing part, so the
// ghost is cut down to the new cells plus one existing road cell at each end, where the drag starts
// and ends. Read-only, no DOM: tested headless (tests/tutorial-crossing.test.ts).
import { suggestConnection, type World } from '../sim/index';

/** The cells to drag for the sawmill–castle crossing, or null when there is nothing to build. */
export function crossingSpan(world: World): number[] | null {
  const st = world.state;
  const saw = st.buildings.find((b) => b.type === 'sawmill');
  const c = st.mission.contract;
  const castle = c ? st.buildings.find((b) => b.id === c.castle) : undefined;
  if (!saw || !castle) return null;
  const s = suggestConnection(world, saw.gate, castle.gate);
  return s ? trimToNew(s.cells, st.roads) : null;
}

/** First to last new (non-road) cell of a path, with one road cell of margin on each side. */
export function trimToNew(cells: readonly number[], roads: ArrayLike<number | boolean>): number[] | null {
  let i0 = -1, i1 = -1;
  for (let i = 0; i < cells.length; i++) {
    if (!roads[cells[i]!]) { if (i0 < 0) i0 = i; i1 = i; }
  }
  if (i0 < 0) return null;
  return cells.slice(Math.max(0, i0 - 1), Math.min(cells.length, i1 + 2));
}
