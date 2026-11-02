import { net, type WagonStatus, type World } from '../sim/index';

export type BridgeJamCause = 'ONCOMING' | 'SPAN_FULL' | 'YIELD' | 'UNKNOWN';

/**
 * Why a wagon waits at a one-lane bridge, read from the state (no sim field, hashes unchanged; BACKLOG P2):
 * the blocker is on the span coming the other way, on the span in our direction (span full),
 * or itself queued on the far bank (it has waited longer, we yield). Mirrors `bridgeBlocker` in sim/wagons.ts.
 */
export function bridgeJamCause(world: World, s: Extract<WagonStatus, { k: 'BRIDGE_JAM' }>): BridgeJamCause {
  const wagons = world.state.wagons;
  const me = wagons.find((w) => w.status === s);
  const b = wagons.find((w) => w.id === s.blocker);
  if (!me || !b) return 'UNKNOWN';
  if (b.bridgeFrom >= 0) return b.bridgeFrom === me.at ? 'SPAN_FULL' : 'ONCOMING';
  // read after the tick: the blocker may be just rolling onto the span (bridgeFrom is set on arrival)
  if (b.next >= 0 && net(world).span[b.next] === s.span) return b.at === me.at ? 'SPAN_FULL' : 'ONCOMING';
  if (b.status.k === 'BRIDGE_JAM' && b.next < 0) return 'YIELD';
  // the blocker rolled off the span this tick: onto our bank it came the other way, elsewhere it led our convoy
  return b.at === me.at ? 'ONCOMING' : 'SPAN_FULL';
}
