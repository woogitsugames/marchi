// Player profile (owner decisions 1 + 13, 2026-11-03): what outlives a single save. Today only the best
// result per contract mission — seals 1..3 and the contract time — kept in IndexedDB's `profile` store
// beside the saves (it travels with the Android backup), because a contract's own save is deleted at its end
// letter. Pure: sanitizing and merging are Node-testable; save.ts does the IndexedDB part.
// No sim change: the record is written from `stars(world)` and `mission.endTick` after the mission is over.

export const PROFILE_ID = 'profile';
export const PROFILE_FORMAT = 1;

export interface BestResult {
  /** Seals 1..3 (stars(world) of a won contract). */
  seals: number;
  /** Contract time in sim ticks (mission.endTick). Lower is better at equal seals. */
  ticks: number;
  /** Wall-clock ms of the run that set it (display / debugging only). */
  at: number;
}

export interface Profile {
  id: typeof PROFILE_ID;
  format: typeof PROFILE_FORMAT;
  /** Best won result per contract mission id ('m1'..'m15'). */
  best: Record<string, BestResult>;
}

export function emptyProfile(): Profile {
  return { id: PROFILE_ID, format: PROFILE_FORMAT, best: {} };
}

const MISSION_ID = /^m\d{1,2}$/;
const MAX_TICKS = 2 ** 40;

const okInt = (x: unknown, lo: number, hi: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi;

/**
 * Reads a stored profile leniently: anything missing, damaged or from an older build becomes an empty
 * entry instead of an error (a profile is a nicety; it must never block the menu). Unknown mission ids
 * and malformed entries are dropped; a newer format keeps the entries it can read.
 */
export function sanitizeProfile(raw: unknown): Profile {
  const out = emptyProfile();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const best = (raw as { best?: unknown }).best;
  if (!best || typeof best !== 'object' || Array.isArray(best)) return out;
  let n = 0;
  for (const [k, v] of Object.entries(best as Record<string, unknown>)) {
    if (++n > 64) break;
    if (!MISSION_ID.test(k) || k === '__proto__' || !v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    if (!okInt(r.seals, 1, 3) || !okInt(r.ticks, 0, MAX_TICKS)) continue;
    out.best[k] = { seals: r.seals, ticks: r.ticks, at: typeof r.at === 'number' && Number.isFinite(r.at) && r.at >= 0 ? r.at : 0 };
  }
  return out;
}

/** True when `r` beats `old`: more seals, or the same seals in less time. */
export function isBetter(r: Pick<BestResult, 'seals' | 'ticks'>, old: Pick<BestResult, 'seals' | 'ticks'> | undefined): boolean {
  if (!old) return true;
  return r.seals > old.seals || (r.seals === old.seals && r.ticks < old.ticks);
}

/**
 * The profile with a finished contract recorded (new object; the input is not changed). Only a won contract
 * (seals >= 1) counts; `improved` says whether it set a new best.
 */
export function recordBest(p: Profile, missionId: string, seals: number, ticks: number, at: number): { profile: Profile; improved: boolean } {
  if (!MISSION_ID.test(missionId) || !okInt(seals, 1, 3) || !okInt(ticks, 0, MAX_TICKS)) return { profile: p, improved: false };
  const old = p.best[missionId];
  if (!isBetter({ seals, ticks }, old)) return { profile: p, improved: false };
  return { profile: { ...p, best: { ...p.best, [missionId]: { seals, ticks, at } } }, improved: true };
}

// --- Valley chronicle in the save envelope (owner decision 1) ---------------------------------------

/** Upper bound of chronicle ids kept in an envelope (30 entries exist; room for later ones). */
export const MAX_CHRONICLE = 128;
const CHRONICLE_ID = /^[a-z0-9_]{1,48}$/;

/**
 * The chronicle ids stored in a save envelope (valley ledgers), read leniently: an envelope without the field
 * (every save before day 1, every contract) or with a damaged one gives []. Duplicates are dropped.
 */
export function envelopeChronicle(env: unknown): string[] {
  if (!env || typeof env !== 'object') return [];
  const c = (env as { chronicle?: unknown }).chronicle;
  if (!Array.isArray(c)) return [];
  const out: string[] = [];
  for (const x of c.slice(0, MAX_CHRONICLE)) if (typeof x === 'string' && CHRONICLE_ID.test(x) && !out.includes(x)) out.push(x);
  return out;
}
