// Save migrations run as a chain 1 -> 2 -> 3 -> 4 behind the save gate, and the gate checks the
// state v3 fields (ice windows, contract tranches, per-building capOverride, D-26, D-23) and the
// state v4 fields (free valley market, town ranks, placedTick; docs/design/sandbox.md).
import { migrate } from '../src/platform/save';
import { gateEnvelope, makeEnvelope, prepareLoad, type GateResult } from '../src/platform/saveGate';
import { STATE_VERSION, createWorld, deserialize, emptyGoods, serialize, stateHash, step } from '../src/sim/index';
import { freshMarket, freshTown } from '../src/sim/town';
import { assert, eq, test } from './harness';

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** The same state as an older schema version (fields of later versions removed). */
function downgrade(v4: J, to: 1 | 2 | 3): J {
  const s = JSON.parse(JSON.stringify(v4)) as J;
  s.version = to;
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

function mid(id: string, ticks: number) {
  const w = createWorld(id);
  for (let i = 0; i < ticks; i++) step(w);
  return w;
}

/** What a fresh state looks like after the migration semantics (fields an old save could not hold). */
function expectedAfterMigration(fresh: J, from: 1 | 2 | 3): J {
  const s = JSON.parse(JSON.stringify(fresh)) as J;
  for (const b of s.buildings) b.placedTick = -1;
  s.ledger.silverEarned = 0;
  s.ledger.sold = emptyGoods();
  s.market = freshMarket(s.mission.contract === null);
  s.town = freshTown();
  if (from === 3) return s;
  s.ice = [];
  for (const b of s.buildings) b.capOverride = -1;
  if (s.mission.contract) s.mission.contract.tranches = [];
  if (from === 1) s.ledger.stallSeconds = {};
  return s;
}

// Missions IV-VI did not exist before state v3, so only m1-m3 can have v1/v2 saves. The free
// valley ('sandbox', market open after migration) can have saves of every version.
for (const from of [1, 2, 3] as const) {
  for (const id of from === 3 ? ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'sandbox'] : ['m1', 'm2', 'm3', 'sandbox']) {
    test(`save chain ${from} -> ${STATE_VERSION} on ${id}: gate, migrate, identical to a fresh state, same continuation`, () => {
      const w = mid(id, 2400);
      const fresh = JSON.parse(serialize(w)) as J;
      const old = downgrade(fresh, from);
      // a format-1 envelope (before the terrain hash) carrying the old state
      const env = { ...makeEnvelope('auto', old as never, 0), format: 1, stateVersion: from } as J;
      delete env.terrainHash;
      const frozen = JSON.stringify(env);
      const v = prepareLoad(env);
      assert(v.ok, `gate: ${v.ok ? '' : v.errors.map((e) => `${e.code}@${e.path} ${e.detail}`).join('; ')}`);
      const out = migrate(v.ok ? v.envelope : (null as never));
      eq(JSON.stringify(env), frozen, 'input not mutated');
      eq(out.stateVersion, STATE_VERSION, 'migrated to current');
      eq(JSON.stringify(out.state), JSON.stringify(expectedAfterMigration(fresh, from)), 'byte-identical, same key order (hash-relevant)');
      // continuation: the migrated save runs exactly like the fresh state with the same migration applied
      const ref = deserialize(JSON.stringify(expectedAfterMigration(fresh, from)));
      const w2 = deserialize(JSON.stringify(out.state));
      for (let i = 0; i < 600; i++) { step(ref); step(w2); }
      eq(stateHash(w2), stateHash(ref), 'continuation');
      // missions with a contract never trade, so a v2/v3 save of them loses nothing at all
      // (v1 had no stall accounting yet)
      if (id !== 'sandbox' && from !== 1) eq(stateHash(ref), (() => { for (let i = 0; i < 600; i++) step(w); return stateHash(w); })(), `${id}: v${from} saves lose nothing`);
    });
  }
}

function gateV3(f: (s: J) => void): GateResult {
  const w = mid('m5', 1200);
  const env = JSON.parse(JSON.stringify(makeEnvelope('auto', w.state, 0))) as J;
  f(env.state);
  return gateEnvelope(env);
}

test('save gate checks state v3 fields: ice windows, tranches, capOverride', () => {
  assert(gateV3(() => {}).ok, 'valid v3 save');
  const bad: [string, (s: J) => void, string][] = [
    ['ice end before start', (s) => { s.ice = [{ start: 50, end: 10 }]; }, 'OUT_OF_RANGE'],
    ['ice not an array', (s) => { s.ice = 'winter'; }, 'BAD_TYPE'],
    ['ice missing in v3', (s) => { delete s.ice; }, 'BAD_TYPE'],
    ['huge ice list', (s) => { s.ice = Array.from({ length: 300 }, () => ({ start: 0, end: 1 })); }, 'BUDGET'],
    ['capOverride below -1', (s) => { s.buildings[0].capOverride = -7; }, 'OUT_OF_RANGE'],
    ['capOverride fractional', (s) => { s.buildings[0].capOverride = 2.5; }, 'BAD_TYPE'],
    ['tranches not an array', (s) => { s.mission.contract.tranches = {}; }, 'BAD_TYPE'],
    ['tranche negative need', (s) => { s.mission.contract.tranches[0].need.bread = -3; }, 'OUT_OF_RANGE'],
    ['tranche missed not boolean', (s) => { s.mission.contract.tranches[1].missed = 'yes'; }, 'BAD_TYPE'],
    ['tranche doneTick below -1', (s) => { s.mission.contract.tranches[2].doneTick = -5; }, 'OUT_OF_RANGE'],
  ];
  for (const [what, f, code] of bad) {
    const r = gateV3(f);
    assert(!r.ok, `${what}: rejected`);
    if (!r.ok) assert(r.errors.some((e) => e.code === code || (code === 'BUDGET' && e.code === 'OUT_OF_RANGE')),
      `${what}: expected ${code}, got ${r.errors.map((e) => e.code + '@' + e.path).join(', ')}`);
  }
});

function gateV4(f: (s: J) => void): GateResult {
  const w = mid('sandbox', 3000);
  const env = JSON.parse(JSON.stringify(makeEnvelope('auto', w.state, 0))) as J;
  f(env.state);
  return gateEnvelope(env);
}

test('save gate checks state v4 fields: market, town, ledger income, placedTick', () => {
  assert(gateV4(() => {}).ok, 'valid v4 save');
  const bad: [string, (s: J) => void, string][] = [
    ['market missing in v4', (s) => { delete s.market; }, 'BAD_TYPE'],
    ['market.open not boolean', (s) => { s.market.open = 1; }, 'BAD_TYPE'],
    ['saturation above cap', (s) => { s.market.saturation.planks = 999; }, 'OUT_OF_RANGE'],
    ['cents above 99', (s) => { s.market.cents = 100; }, 'OUT_OF_RANGE'],
    ['rank above the top', (s) => { s.town.rank = 9; }, 'OUT_OF_RANGE'],
    ['flow ring wrong length', (s) => { s.town.flow = [1, 2]; }, 'BAD_TYPE'],
    ['negative flow', (s) => { s.town.flow[3] = -4; }, 'OUT_OF_RANGE'],
    ['rankTicks below -1', (s) => { s.town.rankTicks[2] = -9; }, 'OUT_OF_RANGE'],
    ['silverEarned fractional', (s) => { s.ledger.silverEarned = 1.5; }, 'BAD_TYPE'],
    ['sold negative', (s) => { s.ledger.sold.planks = -1; }, 'OUT_OF_RANGE'],
    ['sold more than consumed', (s) => { s.ledger.sold.planks = s.ledger.consumed.planks + 6; }, 'INCONSISTENT'],
    ['placedTick in the future', (s) => { s.buildings[0].placedTick = s.tick + 50; }, 'INCONSISTENT'],
    ['placedTick missing in v4', (s) => { delete s.buildings[1].placedTick; }, 'BAD_TYPE'],
  ];
  for (const [what, f, code] of bad) {
    const r = gateV4(f);
    assert(!r.ok, `${what}: rejected`);
    if (!r.ok) assert(r.errors.some((e) => e.code === code), `${what}: expected ${code}, got ${r.errors.map((e) => e.code + '@' + e.path).join(', ')}`);
  }
});
