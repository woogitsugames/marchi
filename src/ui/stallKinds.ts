// Which building statuses are stalls and which are critical: pure, no i18n or DOM (so headless tests
// can rank stalls). Re-exported by format.ts.
import { TICK_HZ, type BuildingStatus, type ReasonLink, type WagonStatus } from '../sim/index';

/** A building status counts as a stall worth a bubble. */
export function isStall(s: BuildingStatus): boolean {
  switch (s.k) {
    case 'NO_ROAD':
    case 'NO_INPUT':
    case 'NO_WAGON':
    case 'OUTPUT_FULL':
    case 'WAITING_PICKUP':
    case 'STORAGE_FULL':
      return true;
    default:
      return false;
  }
}

/**
 * Critical stalls get the wax-clay marker: nothing is on the way to fix them. `calm`: the stall
 * resolves by itself — a full output whose customer still takes the good (outputCustomer), or an
 * input a season slows (seasonalSupplier) — so it is never critical, however long it lasts.
 */
export function isCritical(s: BuildingStatus, stalledTicks: number, calm = false): boolean {
  if (calm) return false;
  if (s.k === 'NO_ROAD') return true;
  if (s.k === 'NO_INPUT' && s.cause === 'UNREACHABLE') return true;
  if (s.k === 'NO_WAGON' && s.cause === 'NONE_CAN_REACH') return true;
  if (s.k === 'OUTPUT_FULL' && s.cause === 'NO_DESTINATION') return true;
  return stalledTicks > 45 * TICK_HZ && s.k !== 'WAITING_PICKUP';
}

/** A wagon status that is a wait worth explaining (bubble, red status line, cause chain). */
export function isWagonWait(s: WagonStatus): boolean {
  return s.k === 'BRIDGE_JAM' || s.k === 'NO_ROUTE' || s.k === 'BRIDGE_CLOSED';
}

/** A link of a cause chain that is itself a stall (a building stall or NO_INPUT, a wagon wait). */
export function isStallLink(l: ReasonLink): boolean {
  return l.kind === 'building' ? isStall(l.status) || l.status.k === 'NO_INPUT' : isWagonWait(l.status);
}

/**
 * The link whose status the "Co to znaczy?" fold explains (audit 2026-11-03, fix 4): the last link of the
 * chain that is a stall — not a producer that is WORKING or a wagon on its way, which answer nothing about
 * "why does it stand?" — or the subject itself when no link is (a short or calm chain).
 */
export function codexLink(chain: readonly ReasonLink[], self: ReasonLink): ReasonLink {
  for (let i = chain.length - 1; i >= 0; i--) if (isStallLink(chain[i]!)) return chain[i]!;
  return self;
}
