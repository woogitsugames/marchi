// Save slot naming and the legacy 'auto' migration (D-29, D-36): one slot per contract mission,
// three free-valley ledgers, and an old single-slot save stays playable.
import { MISSIONS } from '../src/sim/index';
import {
  LEGACY_SLOT, VALLEY_SLOTS, contractSlot, contractSlotMission, isContractSlot, isGameSlot, isValleySlot, planLegacy, slotFor,
  type LegacyPlan,
} from '../src/platform/slots';
import { assert, eq, test } from './harness';

/** Deep comparison of a plan (eq is ===). */
const plan = (a: LegacyPlan, b: LegacyPlan, msg: string): void => eq(JSON.stringify(a), JSON.stringify(b), msg);
const env = (missionId: unknown, savedAt = 1000): Record<string, unknown> => ({ slot: LEGACY_SLOT, missionId, savedAt, tick: 600 });

test('slots: every contract mission gets its own slot, distinct from the ledgers and the legacy slot', () => {
  const ids = Object.keys(MISSIONS).filter((id) => id !== 'sandbox');
  const slots = ids.map((id) => slotFor(id));
  eq(new Set(slots).size, ids.length, 'one slot per mission');
  for (const [i, s] of slots.entries()) {
    eq(s, contractSlot(ids[i]), 'slotFor = contractSlot for contracts');
    assert(isContractSlot(s) && !isValleySlot(s) && s !== LEGACY_SLOT, `${s} is a contract slot only`);
    eq(contractSlotMission(s), ids[i], 'round trip');
    assert(isGameSlot(s), `${s} offered by Continue`);
  }
  eq(contractSlot('m3'), 'auto-m3', 'stable name (stored in players\' IndexedDB)');
});

test('slots: the free valley keeps its three ledgers; a stray slot falls back to the first', () => {
  for (const v of VALLEY_SLOTS) {
    eq(slotFor('sandbox', v), v, 'ledger kept');
    assert(!isContractSlot(v) && isGameSlot(v), `${v} is a ledger`);
    eq(contractSlotMission(v), null, 'no mission in a ledger');
  }
  eq(slotFor('sandbox'), VALLEY_SLOTS[0], 'default ledger');
  eq(slotFor('sandbox', LEGACY_SLOT), VALLEY_SLOTS[0], 'never the legacy slot');
  eq(slotFor('sandbox', 'auto-m2'), VALLEY_SLOTS[0], 'never a contract slot');
  eq(slotFor('m2', 'valley2'), 'auto-m2', 'a contract ignores a ledger argument');
  assert(isGameSlot(LEGACY_SLOT), 'an unmigrated legacy save is still offered');
  assert(!isContractSlot(LEGACY_SLOT) && !isContractSlot('auto-') && !isContractSlot(null), 'legacy/empty are not contract slots');
  assert(!isGameSlot('prefs') && !isGameSlot(undefined), 'unknown slots are ignored');
});

test('legacy migration: a contract in the old auto slot moves to its mission slot', () => {
  plan(planLegacy(env('m4'), []), { kind: 'move', to: 'auto-m4' }, 'empty store');
  plan(planLegacy(env('m4'), [{ slot: 'auto-m2', savedAt: 5000 }, { slot: 'valley1', savedAt: 9000 }]),
    { kind: 'move', to: 'auto-m4' }, 'other missions and ledgers are untouched');
});

test('legacy migration: the newer of two copies of the same mission wins', () => {
  plan(planLegacy(env('m4', 1000), [{ slot: 'auto-m4', savedAt: 2000 }]), { kind: 'drop' }, 'target newer: stale legacy dropped');
  plan(planLegacy(env('m4', 2000), [{ slot: 'auto-m4', savedAt: 2000 }]), { kind: 'drop' }, 'same time: already moved (put then crash before delete)');
  plan(planLegacy(env('m4', 3000), [{ slot: 'auto-m4', savedAt: 2000 }]), { kind: 'move', to: 'auto-m4' }, 'legacy newer: replaces the target');
});

test('legacy migration: a free-valley game goes to the first empty ledger, kept when all are taken', () => {
  plan(planLegacy(env('sandbox'), []), { kind: 'move', to: 'valley1' }, 'first ledger');
  plan(planLegacy(env('sandbox'), [{ slot: 'valley1', savedAt: 1 }, { slot: 'valley3', savedAt: 1 }]), { kind: 'move', to: 'valley2' }, 'first free');
  plan(planLegacy(env('sandbox'), VALLEY_SLOTS.map((slot) => ({ slot, savedAt: 1 }))), { kind: 'keep' }, 'all ledgers taken');
});

test('legacy migration: damaged legacy saves stay where they are (the menu reports them)', () => {
  for (const raw of [null, undefined, 42, 'x', {}, env(''), env(7), { slot: LEGACY_SLOT }]) {
    plan(planLegacy(raw, []), { kind: 'keep' }, `kept: ${JSON.stringify(raw)}`);
  }
  // no savedAt on the legacy copy: an existing target counts as newer
  plan(planLegacy({ missionId: 'm1' }, [{ slot: 'auto-m1', savedAt: 0 }]), { kind: 'drop' }, 'missing savedAt');
});
