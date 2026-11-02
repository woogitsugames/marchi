import { en } from './i18n-keys';
import { ja } from '../src/i18n/ja';
import { pl, type MessageKey } from './i18n-keys';
import { assert, test } from './harness';

function placeholders(value: string): string[] {
  return [...new Set([...value.matchAll(/\{(\w+)(?=\}|,\s*plural\s*,)/g)].map((m) => m[1]!))].sort();
}

test('Japanese dictionary has all Polish keys and English placeholders', () => {
  const expected = Object.keys(pl);
  const actual = Object.keys(ja);
  assert(JSON.stringify(actual) === JSON.stringify(expected), 'Japanese dictionary key order differs from Polish');
  for (const key of expected as MessageKey[]) {
    const value = ja[key];
    assert(typeof value === 'string' && value.trim().length > 0, `Missing or empty translation: ${key}`);
    if (key.startsWith('goodGen.') || key.startsWith('goodAcc.')) continue;
    assert(JSON.stringify(placeholders(value)) === JSON.stringify(placeholders(en[key])), `Placeholder mismatch: ${key}`);
  }
});
