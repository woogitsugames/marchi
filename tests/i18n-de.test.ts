import { assert, test } from './harness';
import { pl } from './i18n-keys';
import { en } from './i18n-keys';
import { de } from '../src/i18n/de';

function placeholders(value: string): string[] {
  return [...new Set([...value.matchAll(/\{(\w+)(?=\}|,\s*plural\s*,)/g)].map((m) => m[1]!))].sort();
}

test('German dictionary has all keys and matching placeholders', () => {
  const keys = Object.keys(pl);
  assert(JSON.stringify(Object.keys(de)) === JSON.stringify(keys), 'German key order differs from Polish');
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    const value = de[key];
    assert(typeof value === 'string' && value.trim().length > 0, `Missing or empty translation: ${key}`);
    if (key.startsWith('goodGen.') || key.startsWith('goodAcc.')) continue;
    assert(JSON.stringify(placeholders(value)) === JSON.stringify(placeholders(en[key])), `Placeholder mismatch: ${key}`);
  }
});
