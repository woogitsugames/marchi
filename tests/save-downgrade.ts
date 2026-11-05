// Shared by the save tests: a current state rewritten as an older state schema (fields of later versions removed).
import { GOODS_V4, RANKS_V4 } from '../src/sim/index';

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Keep only the v4 goods of a goods map (state v5 added fish, stone, charcoal, malt, beer). */
function v4goods(m: J): J {
  return Object.fromEntries(GOODS_V4.map((g) => [g, m[g]]));
}

/**
 * state v9 (D-170): a state before v9 has no trading post (slice, building, its gate road, one netVersion step).
 * Its id is simply gone (wagons share the id counter, so nextId stays).
 */
export function dropTradePost(s: J): void {
  if (!('tradePost' in s)) return;
  delete s.tradePost;
  const b = s.buildings.find((x: J) => x.type === 'tradePost');
  if (!b) return;
  s.buildings = s.buildings.filter((x: J) => x !== b);
  s.roads[b.gate] = 0;
  s.netVersion -= 1;
}

/** The same state as an older schema version (fields of later versions removed). */
export function downgrade(v6: J, to: 1 | 2 | 3 | 4 | 5): J {
  const s = JSON.parse(JSON.stringify(v6)) as J;
  s.version = to;
  delete s.valleyEvents; // state v8 (D-54)
  dropTradePost(s); // state v9 (D-170)
  // v6 -> v5: no road stone flag
  delete s.mission.roadStone;
  if (to === 5) return s;
  // v5 -> v4: five goods per goods map, four ranks
  for (const b of s.buildings) for (const k of ['stock', 'reservedOut', 'incoming']) b[k] = v4goods(b[k]);
  for (const k of ['produced', 'consumed', 'destroyed', 'sold']) s.ledger[k] = v4goods(s.ledger[k]);
  if (s.mission.contract) {
    s.mission.contract.need = v4goods(s.mission.contract.need);
    for (const t of s.mission.contract.tranches) t.need = v4goods(t.need);
  }
  s.market.saturation = v4goods(s.market.saturation);
  s.town.rankTicks = s.town.rankTicks.slice(0, RANKS_V4);
  if (to === 4) return s;
  delete s.market;
  delete s.town;
  delete s.ledger.silverEarned;
  delete s.ledger.sold;
  for (const b of s.buildings) delete b.placedTick;
  if (to === 3) return s;
  delete s.ice;
  for (const b of s.buildings) delete b.capOverride;
  if (s.mission.contract) delete s.mission.contract.tranches;
  if (to === 1) delete s.ledger.stallSeconds;
  return s;
}

