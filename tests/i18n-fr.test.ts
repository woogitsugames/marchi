import { assert, test } from './harness';
import { pl } from './i18n-keys';
import { en } from './i18n-keys';
import { fr } from '../src/i18n/fr';
import { PENDING_KEYS } from '../src/i18n/pl';
// keys still pending for some language (e.g. hi) may already be translated here
const PENDING_SET: ReadonlySet<string> = new Set(PENDING_KEYS);

function placeholders(value: string): string[] {
  return [...new Set([...value.matchAll(/\{(\w+)(?=\}|,\s*plural\s*,)/g)].map((m) => m[1]!))].sort();
}

test('French dictionary has all keys and matching placeholders', () => {
  const keys = Object.keys(pl);
  assert(JSON.stringify(Object.keys(fr).filter((k) => !PENDING_SET.has(k))) === JSON.stringify(keys), 'French key order differs from Polish');
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    const value = fr[key];
    assert(typeof value === 'string' && value.trim().length > 0, `Missing or empty translation: ${key}`);
    if (key.startsWith('goodGen.') || key.startsWith('goodAcc.')) continue;
    assert(JSON.stringify(placeholders(value)) === JSON.stringify(placeholders(en[key])), `Placeholder mismatch: ${key}`);
  }
});
