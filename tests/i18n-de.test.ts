import { assert, test } from './harness';
import { pl } from '../src/i18n/pl';
import { en } from '../src/i18n/en';
import { de } from '../src/i18n/de';

function placeholders(value: string): string[] {
  return [...new Set([...value.matchAll(/\{(\w+)(?=\}|,\s*plural\s*,)/g)].map((m) => m[1]!))].sort();
}

test('German dictionary has all keys and matching placeholders', () => {
  const keys = Object.keys(pl).sort();
  assert(JSON.stringify(Object.keys(de).sort()) === JSON.stringify(keys), 'German keys differ from Polish');
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    if (key.startsWith('goodGen.') || key.startsWith('goodAcc.')) continue;
    assert(JSON.stringify(placeholders(de[key])) === JSON.stringify(placeholders(en[key])), `Placeholder mismatch: ${key}`);
  }
});
