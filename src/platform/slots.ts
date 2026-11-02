// Save slot naming (D-29, D-36): one slot per contract mission, three free-valley ledgers.
// Pure (no IndexedDB): the app, save.ts and the headless tests share it.

/** Before D-36 every contract (and, before D-29, the free valley too) wrote to this one slot. */
export const LEGACY_SLOT = 'auto';
const CONTRACT_PREFIX = 'auto-';

/** Free valley: three independent settlements. */
export const VALLEY_SLOTS = ['valley1', 'valley2', 'valley3'] as const;
export type ValleySlot = (typeof VALLEY_SLOTS)[number];

export function isValleySlot(s: string | null | undefined): s is ValleySlot {
  return (VALLEY_SLOTS as readonly string[]).includes(s ?? '');
}

/** The slot of a contract mission: 'auto-m3'. Starting another mission never touches it. */
export function contractSlot(missionId: string): string {
  return CONTRACT_PREFIX + missionId;
}

export function isContractSlot(s: string | null | undefined): boolean {
  return typeof s === 'string' && s.startsWith(CONTRACT_PREFIX) && s.length > CONTRACT_PREFIX.length;
}

/** Mission id of a contract slot ('auto-m3' -> 'm3'), null for any other slot. */
export function contractSlotMission(s: string | null | undefined): string | null {
  return isContractSlot(s) ? s!.slice(CONTRACT_PREFIX.length) : null;
}

/** A slot the main menu's "Continue" may offer (the legacy slot too, until it is migrated). */
export function isGameSlot(s: string | null | undefined): boolean {
  return s === LEGACY_SLOT || isContractSlot(s) || isValleySlot(s);
}

/**
 * Where a game writes: its valley ledger in the free valley (default the first ledger), its own
 * contract slot otherwise. A non-valley `slot` for the free valley falls back to the first ledger.
 */
export function slotFor(missionId: string, slot: string | null = null): string {
  if (missionId === 'sandbox') return isValleySlot(slot) ? slot : VALLEY_SLOTS[0];
  return contractSlot(missionId);
}

/** What the legacy 'auto' slot should become. */
export type LegacyPlan =
  | { kind: 'keep' }
  | { kind: 'move'; to: string }
  /** the target already holds a newer (or equally new) game: the legacy copy is stale */
  | { kind: 'drop' };

/**
 * Decides the fate of a save found in the legacy 'auto' slot, given the other stored slots.
 * A free-valley game goes to the first empty ledger (kept when all three are taken); a contract
 * goes to its mission's slot, unless that slot already holds a game saved at the same time or later.
 * Anything unreadable (no mission id) is kept where it is: the menu reports it as damaged.
 */
export function planLegacy(raw: unknown, others: readonly { slot: string; savedAt: number }[]): LegacyPlan {
  if (!raw || typeof raw !== 'object') return { kind: 'keep' };
  const r = raw as { missionId?: unknown; savedAt?: unknown };
  if (typeof r.missionId !== 'string' || r.missionId === '') return { kind: 'keep' };
  if (r.missionId === 'sandbox') {
    const free = VALLEY_SLOTS.find((v) => !others.some((o) => o.slot === v));
    return free ? { kind: 'move', to: free } : { kind: 'keep' };
  }
  const to = contractSlot(r.missionId);
  const there = others.find((o) => o.slot === to);
  if (!there) return { kind: 'move', to };
  const at = typeof r.savedAt === 'number' && Number.isFinite(r.savedAt) ? r.savedAt : 0;
  return there.savedAt >= at ? { kind: 'drop' } : { kind: 'move', to };
}
