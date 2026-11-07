// Robustness after the day-9 sim changes (research 2026-11-06, docs/research/2026-11-06-robustness.md):
// every save version (real fixtures v6-v8; v1-v8 rewritten from a played state) migrates to the current version and
// plays 10 sim minutes with invariants + stall reasons every tick; a save -> load (envelope, JSON text, gate,
// migrations) in the middle of every mission's winning strategy and of the free valley continues bit-identically.
import { readFileSync } from 'node:fs';
import { STATE_VERSION, TICK_HZ, applyCommand, createWorld, sandboxStatus, serialize, step, type SimState } from '../src/sim/index';
import { makeEnvelope } from '../src/platform/saveGate';
import { MISSION_IDS, fixtureFiles, playMigrated, valleyDriver, verifyMission, verifyRun } from '../tools/robustness';
import { downgrade, dropTradePost } from './save-downgrade';
import { assert, eq, test } from './harness';

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** A current state as a save of schema version `to` (1..8). */
function asVersion(cur: J, to: number): J {
  if (to <= 5) return downgrade(cur, to as 1 | 2 | 3 | 4 | 5);
  const s = JSON.parse(JSON.stringify(cur)) as J;
  s.version = to;
  // v10 (D-288) adds only mission XVI's optional castle keys: a v9 state is the current one with version 9
  if (to <= 8) dropTradePost(s); // v9 (D-170)
  if (to <= 7) delete s.valleyEvents; // v8 (D-54)
  if (to <= 6) { // v7 (D-44)
    delete s.nextWagonN;
    for (const w of s.wagons) delete w.n;
  }
  return s;
}

function envelopeText(state: J, version: number): string {
  const env = makeEnvelope('auto', state as unknown as SimState, 0) as unknown as J;
  env.stateVersion = version;
  if (version <= 2) { env.format = 1; delete env.terrainHash; } // the oldest envelopes had no terrain hash
  return JSON.stringify(env);
}

const MIN = 10;

test('robustness: every save fixture (v6-v8) migrates and plays 10 min with invariants and stall reasons every tick', () => {
  const files = fixtureFiles();
  assert(files.length >= 3, 'fixtures found');
  for (const f of files) {
    const r = playMigrated(readFileSync(f, 'utf8'), MIN);
    assert(r.from < STATE_VERSION, `${f}: an old version`);
    eq(r.violations.join(' | '), '', `${f.split('/').pop()} v${r.from}`);
  }
});

for (const id of ['sandbox', 'm1', 'm4', 'm13']) {
  test(`robustness: ${id} saves of every older version (from a played state) migrate and play 10 min clean`, () => {
    const w = createWorld(id);
    const d = id === 'sandbox' ? valleyDriver() : null;
    for (let i = 0; i < (id === 'sandbox' ? 8 : 3) * 60 * TICK_HZ; i++) {
      if (d) for (const c of d(w)) applyCommand(w, c);
      step(w);
    }
    const cur = JSON.parse(serialize(w)) as J;
    // missions IV-XIII did not exist before state v3; the free valley and mission I can have saves of every version
    for (let v = id === 'sandbox' || id === 'm1' ? 1 : 3; v < STATE_VERSION; v++) {
      const r = playMigrated(envelopeText(asVersion(cur, v), v), MIN, id === 'sandbox' ? valleyDriver() : undefined);
      eq(r.from, v, 'version read from the envelope');
      eq(r.violations.join(' | '), '', `${id} v${v}`);
    }
  });
}

test('robustness: save -> load at 1/4, 1/2, 3/4 of every contract mission I-XV (winning strategy) is bit-identical', () => {
  for (const id of MISSION_IDS) {
    const r = verifyMission(id);
    eq(r.result, 'won', `${id} winning strategy`);
    eq(r.violations.join(' | '), '', `${id} invariants every tick`);
    eq(r.diverged, null, `${id} save/load continuation`);
    assert(r.saveTicks.length >= 3, `${id}: three saves`);
  }
});

test('robustness: free valley (DECENT + orders + merchants) 25 min, save -> load after each new rank is bit-identical', () => {
  let last = -1, mark = -1;
  const r = verifyRun('sandbox', () => createWorld('sandbox'), valleyDriver(), 25 * 60 * TICK_HZ, (w, t) => {
    const rank = sandboxStatus(w).rank;
    if (rank !== last) { last = rank; mark = t + 37; }
    return t === mark || t % (7 * 60 * TICK_HZ) === 0;
  });
  eq(r.violations.join(' | '), '', 'invariants every tick');
  eq(r.diverged, null, 'continuation');
  assert(last >= 1, `reached rank 1 (got ${last})`);
  assert(r.saveTicks.length >= 4, 'several saves');
});
