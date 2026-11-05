// Which building statuses are stalls and which are critical: pure, no i18n or DOM (so headless tests
// can rank stalls). Re-exported by format.ts.
import { TICK_HZ, outputSurplus, type BuildingStatus, type ReasonLink, type WagonStatus } from '../sim/index';
import type { MessageKey } from '../i18n/index';
import type { World } from '../sim/index';

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

/**
 * What to do next time about the loss's #1 cause (first-10-minutes-c N3, D-130): one action line under the ledger
 * of a lost contract, from the cause's kind — never advice about something that already stands.
 */
export function lossActionKey(status: string): MessageKey {
  const [k, cause] = status.split('.');
  if (k === 'WAITING_PICKUP' || (k === 'NO_WAGON' && cause === 'ALL_BUSY') || (k === 'OUTPUT_FULL' && cause === 'NO_WAGON')) return 'end.act.wagon';
  if (k === 'NO_ROAD' || k === 'NO_ROUTE' || (k === 'NO_INPUT' && cause === 'UNREACHABLE') || (k === 'NO_WAGON' && cause === 'NONE_CAN_REACH')) return 'end.act.road';
  if (k === 'BRIDGE_JAM' || k === 'BRIDGE_CLOSED') return 'end.act.bridge';
  if (k === 'STORAGE_FULL' || (k === 'OUTPUT_FULL' && cause === 'NO_DESTINATION')) return 'end.act.granary';
  return 'end.act.other';
}

/**
 * The status title key: 'status.<k>' or 'status.<k>.<cause>'. With the building's `id`, a full yard nobody needs
 * right now reads as the calm surplus — the sheet below it says a new wagon would not help, so the title must not
 * say "no wagon to collect" (first-10-minutes-e N7, D-160).
 */
export function statusKey(s: BuildingStatus, world?: World, id = -1): MessageKey {
  if (s.k === 'OUTPUT_FULL' && s.cause === 'NO_WAGON' && world && id >= 0 && outputSurplus(world, id) === 'SPARE') return 'status.OUTPUT_FULL.surplus';
  const cause = 'cause' in s ? s.cause : null;
  return (cause ? `status.${s.k}.${cause}` : `status.${s.k}`) as MessageKey;
}
