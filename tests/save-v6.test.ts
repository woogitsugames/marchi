// State v6+ (current v7) round trips across the full seasonal calendar and the mission VIII stone convoy.
// Use the real save envelope gate and migration pipeline, not only JSON.parse().
import {
  SEASON_TICKS, STATE_VERSION, TICK_HZ, YEAR_TICKS, applyCommand, bridgeIceUntil,
  checkInvariants, createWorld, deserialize, effectsAt, lineCells, roadStoneCost,
  serialize, stateHash, step, stoneAvailable, thawing, type World,
} from '../src/sim/index';
import { migrate } from '../src/platform/save';
import { makeEnvelope, parseSave } from '../src/platform/saveGate';
import { assert, eq, test } from './harness';

const MINUTE = 60 * TICK_HZ;

function loadV6(w: World, label: string): World {
  const before = serialize(w);
  const envelope = makeEnvelope('auto', w.state, 0);
  eq(envelope.stateVersion, STATE_VERSION, label + ': envelope version');
  eq(envelope.stateVersion, 7, label + ': a current (v6 seasons + v7 fleet numbers) save');
  const parsed = parseSave(JSON.stringify(envelope));
  assert(parsed.ok, label + ': save gate rejected valid v6 data: ' +
    (parsed.ok ? '' : parsed.errors.map((e) => e.code + '@' + e.path).join(', ')));
  const saved = migrate(parsed.envelope);
  eq(saved.stateVersion, 7, label + ': no unexpected migration');
  const restored = deserialize(JSON.stringify(saved.state));
  eq(serialize(restored), before, label + ': exact persisted state and key order');
  eq(stateHash(restored), stateHash(w), label + ': identical hash immediately after load');
  eq(checkInvariants(restored).length, 0, label + ': conserved goods and reservations after load');
  return restored;
}

function compareEffects(a: World, b: World, label: string): void {
  eq(a.state.tick, b.state.tick, label + ': same date');
  eq(a.seasons, true, label + ': season flag');
  eq(b.seasons, true, label + ': seasonal world reconstructed');
  eq(JSON.stringify(effectsAt(a.state.tick)), JSON.stringify(effectsAt(b.state.tick)),
    label + ': same season, thaw, ice and fair effects');
  eq(thawing(a), thawing(b), label + ': identical live thaw');
  eq(bridgeIceUntil(a), bridgeIceUntil(b), label + ': identical live bridge closure');
}

for (const [name, at] of [
  ['spring', 0],
  ['thaw begins', 4 * MINUTE],
  ['thaw ends', 8 * MINUTE - 1],
  ['summer', SEASON_TICKS + 5 * MINUTE],
  ['autumn fair', 2 * SEASON_TICKS + 5 * MINUTE],
  ['winter first ice', 3 * SEASON_TICKS + 3 * MINUTE + 30],
  ['winter second ice', 3 * SEASON_TICKS + 9 * MINUTE + 30],
  ['next spring thaw', YEAR_TICKS + 4 * MINUTE + 30],
] as const) {
  test('save v6: ' + name + ' preserves effects and the next 650 ticks', () => {
    const w = createWorld('sandbox');
    w.state.tick = at;
    w.state.rain = [];
    const loaded = loadV6(w, name);
    compareEffects(w, loaded, name + ' at load');
    for (let i = 0; i < 650; i++) {
      step(w);
      step(loaded);
      if (i % 50 === 0 || i === 649) {
        compareEffects(w, loaded, name + ' +' + (i + 1));
        const failures = checkInvariants(loaded);
        assert(failures.length === 0, name + ' tick ' + loaded.state.tick + ': ' + failures.join('; '));
      }
    }
    eq(stateHash(loaded), stateHash(w), name + ': continuation hash');
  });
}

test('save v6: mission VIII preserves a loaded stone wagon before laying 12 cobbles', () => {
  const w = createWorld('m8');
  eq(w.state.mission.roadStone, true, 'mission VIII enabled stone-cost roads');
  const cells = lineCells(w.terrain.w, 44 * w.terrain.w + 45, 44 * w.terrain.w + 56);
  eq(roadStoneCost(w, cells, 2), 12, 'paving requires 12 stone');
  let cargoId = -1;
  for (let i = 0; i < 8000; i++) {
    step(w);
    const carrier = w.state.wagons.find((q) =>
      q.job?.good === 'stone' && q.job.phase === 'dropoff' && q.cargoQty > 0);
    if (carrier) { cargoId = carrier.id; break; }
  }
  assert(cargoId >= 0, 'stone convoy must carry cargo before the paving command');
  const before = w.state.wagons.find((q) => q.id === cargoId)!;
  const restored = loadV6(w, 'm8 stone in transit');
  eq(restored.state.mission.roadStone, true, 'roadStone flag persisted');
  const after = restored.state.wagons.find((q) => q.id === cargoId)!;
  eq(JSON.stringify(after), JSON.stringify(before), 'loaded wagon and job survived save');

  let ready = false;
  for (let i = 0; i < 8000; i++) {
    eq(stoneAvailable(restored), stoneAvailable(w), 'same usable stone before paving');
    if (stoneAvailable(w) >= 12) { ready = true; break; }
    step(w);
    step(restored);
  }
  assert(ready, 'stone deliveries must eventually provide all 12 units for cobbles');
  const available = stoneAvailable(w);
  const paved = applyCommand(w, { t: 'road', surface: 2, cells });
  const pavedLoaded = applyCommand(restored, { t: 'road', surface: 2, cells });
  assert(paved.ok && pavedLoaded.ok, 'paving succeeds in both worlds after deliveries');
  if (paved.ok && pavedLoaded.ok) {
    eq(paved.stone, 12, 'stone spent by the original world');
    eq(pavedLoaded.stone, 12, 'stone spent after load');
  }
  eq(stoneAvailable(w), available - 12, 'stone comes from the granary');
  eq(stateHash(restored), stateHash(w), 'same state just after laying cobbles');
  for (let i = 0; i < 650; i++) {
    step(w);
    step(restored);
    if (i % 50 === 0) {
      const failures = checkInvariants(restored);
      assert(failures.length === 0, 'm8 tick ' + restored.state.tick + ': ' + failures.join('; '));
    }
  }
  eq(stateHash(restored), stateHash(w), 'stone transit, paving, and continuation remain deterministic');
});
