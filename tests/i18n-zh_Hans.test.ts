import { en } from './i18n-keys';
import { zh_Hans } from '../src/i18n/zh_Hans';
import { pl, type MessageKey } from './i18n-keys';
import { assert, test } from './harness';
import { PENDING_KEYS } from '../src/i18n/pl';
// keys still pending for some language (e.g. hi) may already be translated here
const PENDING_SET: ReadonlySet<string> = new Set(PENDING_KEYS);

function placeholders(value: string): string[] {
  return [...new Set([...value.matchAll(/\{(\w+)(?=\}|,\s*plural\s*,)/g)].map((m) => m[1]!))].sort();
}

test('Simplified Chinese dictionary has all Polish keys and English placeholders', () => {
  const expected = Object.keys(pl);
  const actual = Object.keys(zh_Hans).filter((k) => !PENDING_SET.has(k));
  assert(JSON.stringify(actual) === JSON.stringify(expected), 'Simplified Chinese dictionary key order differs from Polish');
  for (const key of expected as MessageKey[]) {
    const value = zh_Hans[key];
    assert(typeof value === 'string' && value.trim().length > 0, `Missing or empty translation: ${key}`);
    if (key.startsWith('goodGen.') || key.startsWith('goodAcc.')) continue;
    assert(JSON.stringify(placeholders(value)) === JSON.stringify(placeholders(en[key])), `Placeholder mismatch: ${key}`);
  }
});
