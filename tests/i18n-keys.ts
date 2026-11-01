// The pl/en dictionaries as the per-language i18n tests see them: without PENDING_KEYS (keys added
// after the last translation round; other languages fall back to English for them, D-18).
// Not a test file (no .test.ts suffix): imported by tests/i18n-<lang>.test.ts.
import { PENDING_KEYS, pl as plAll, type MessageKey as AnyKey, type PendingKey } from '../src/i18n/pl';
import { en as enFull } from '../src/i18n/en';

export type MessageKey = Exclude<AnyKey, PendingKey>;
const pending: ReadonlySet<string> = new Set(PENDING_KEYS);

function translated(d: Record<AnyKey, string>): Record<MessageKey, string> {
  return Object.fromEntries(Object.entries(d).filter(([k]) => !pending.has(k))) as Record<MessageKey, string>;
}

export const pl = translated(plAll);
export const en = translated(enFull);
