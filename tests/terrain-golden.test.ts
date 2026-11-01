// Golden terrain hashes (D-19). Saves do not contain terrain; it is regenerated from mapId + seed.
// If this test fails you changed generateValley(), fbm(), a ValleySpec or CELL_SIZE, and every save
// made on that map will now load with TERRAIN_CHANGED ("Continue" disabled).
//
// What to do:
//   - Unintended change: revert it. Terrain must stay bit-identical for shipped maps.
//   - Intended change (new map look, rebalanced river): give the changed map a NEW mapId (e.g.
//     'valley1b') and point the mission at it, so old saves keep loading on the old generator path;
//     or accept that old saves on that map are invalidated, note it in docs/DECISIONS.md, and update
//     the hash below.
//   - New mission / map / seed: add its row below.
import { MISSIONS, terrainFor } from '../src/sim/missions';
import { terrainHash } from '../src/sim/terrainHash';
import { assert, eq, test } from './harness';

const GOLDEN: Record<string, string> = {
  'valley1:1301': 't1-f621e2ecdd692c90',
  'valley-m2:2402': 't1-7283d964dc7e3e43',
  'valley-m3:3303': 't1-6eef9e9158b4173c',
};

const HELP = 'terrain generator output changed — see the header of tests/terrain-golden.test.ts before touching GOLDEN';

test('golden terrain hash for every map/seed used by MISSIONS', () => {
  const used = new Set<string>();
  for (const m of Object.values(MISSIONS)) used.add(`${m.mapId}:${m.seed}`);
  for (const key of used) {
    assert(key in GOLDEN, `mission map ${key} has no golden terrain hash: add it to GOLDEN in tests/terrain-golden.test.ts`);
    const [mapId, seed] = key.split(':');
    eq(terrainHash(terrainFor(mapId!, Number(seed))), GOLDEN[key]!, `${key}: ${HELP}`);
  }
});

test('terrain hash is sensitive to a single height and stable across calls', () => {
  const t = terrainFor('valley1', 1301);
  const h = terrainHash(t);
  eq(terrainHash(t), h, 'same terrain, same hash');
  const copy = { ...t, corners: t.corners.slice() };
  copy.corners[1234] = copy.corners[1234]! + 1e-9;
  assert(terrainHash(copy) !== h, 'one corner moved by 1e-9 m changes the hash');
  assert(terrainHash(terrainFor('valley1', 1302)) !== h, 'another seed gives another hash');
});
