// Proposal only (order 12): timed river ice for mission IV.
// This file is deliberately NOT imported by the existing simulation.
import { TICK_HZ } from '../defs';
import type { SimState, Terrain } from '../types';

export interface IceWindow {
  /** Inclusive start tick. */
  start: number;
  /** Exclusive end tick. */
  end: number;
}

/** Fixed mission clock: ice closes wooden crossings from 03:00 to 08:00. */
export const M4_ICE_WINDOW: Readonly<IceWindow> = Object.freeze({
  start: 180 * TICK_HZ,
  end: 480 * TICK_HZ,
});

/** Proposed additions to i18n/pl.ts and i18n/en.ts (not registered yet). */
export const BRIDGE_CLOSED_TRANSLATIONS = {
  pl: { 'wagon.BRIDGE_CLOSED': 'Kra zamknęła drewniany most (odcinek {span}) do {until}.' },
  en: { 'wagon.BRIDGE_CLOSED': 'Ice has closed the wooden bridge (span {span}) until {until}.' },
} as const;

/** Proposed WagonStatus member; use `until` in simulation ticks, not wall-clock time. */
export interface BridgeClosedStatus {
  k: 'BRIDGE_CLOSED';
  span: number;
  until: number;
}

/** Returns the reopening tick, or null outside the closure interval / other missions. */
export function iceClosingUntil(state: Pick<SimState, 'mission' | 'tick'>): number | null {
  if (state.mission.id !== 'm4') return null;
  return state.tick >= M4_ICE_WINDOW.start && state.tick < M4_ICE_WINDOW.end
    ? M4_ICE_WINDOW.end
    : null;
}

/**
 * Pure, deterministic set of frozen wooden span IDs.
 *
 * Span IDs MUST match `network.net(world).span`: flood-fill 8-neighbour-connected
 * water cells whose road surface is exactly 1, in ascending cell-index order.
 * Stone bridges (surface 2), land roads and rivers without bridges are excluded.
 * No RNG, no writes to state, no mutation of terrain, no module-level cache.
 */
export function closedSpans(
  state: Pick<SimState, 'mission' | 'tick' | 'roads'>,
  terrain: Pick<Terrain, 'w' | 'h' | 'water'>,
): Set<number> {
  const closed = new Set<number>();
  if (iceClosingUntil(state) === null) return closed;
  const { w, h, water } = terrain;
  const n = w * h;
  if (state.roads.length !== n || water.length !== n) {
    throw new RangeError('closedSpans: terrain and roads dimensions differ');
  }
  const visited = new Uint8Array(n);
  for (let root = 0; root < n; root++) {
    if (visited[root] || water[root] !== 1 || state.roads[root] !== 1) continue;
    closed.add(root);
    visited[root] = 1;
    const stack = [root];
    while (stack.length) {
      const cell = stack.pop()!;
      const x = cell % w, y = (cell - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const next = yy * w + xx;
          if (visited[next] || water[next] !== 1 || state.roads[next] !== 1) continue;
          visited[next] = 1;
          stack.push(next);
        }
      }
    }
  }
  return closed;
}

/**
 * True only for ENTERING a frozen span. Traversal inside / exiting an already
 * occupied span stays possible, so the window cannot freeze wagons mid-bridge.
 */
export function closedSpanEntry(
  frozen: ReadonlySet<number>,
  spanOf: ArrayLike<number>,
  from: number,
  to: number,
): number | null {
  const span = spanOf[to] ?? -1;
  return span >= 0 && spanOf[from] !== span && frozen.has(span) ? span : null;
}
