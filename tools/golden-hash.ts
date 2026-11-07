// Golden state hash for the strategy tools: the state hash with `version` set to 0, so a state-version bump
// with an identity migration (v9 -> v10, D-288) leaves every recorded mission hash literally unchanged
// (the same convention as CONTRACT_GOLDEN in tests/valley-events-live.test.ts).
import { hashString } from '../src/sim/hash';
import type { World } from '../src/sim/index';

export function goldenHash(w: World): string {
  return hashString(JSON.stringify({ ...w.state, version: 0 }));
}
