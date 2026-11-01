import { assert, test } from './harness';
import { pl } from '../src/i18n/pl';
import { en } from '../src/i18n/en';
import { tr } from '../src/i18n/tr';

function placeholders(value: string): string[] {
  return [...new Set([...value.matchAll(/\{(\w+)(?=\}|,\s*plural\s*,)/g)].map((m) => m[1]!))].sort();
}

test('Turkish dictionary has all keys and matching placeholders', () => {
  const keys = Object.keys(pl).sort();
  assert(JSON.stringify(Object.keys(tr).sort()) === JSON.stringify(keys), 'Turkish keys differ from Polish');
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    if (key.startsWith('goodGen.') || key.startsWith('goodAcc.')) continue;
    assert(JSON.stringify(placeholders(tr[key])) === JSON.stringify(placeholders(en[key])), `Placeholder mismatch: ${key}`);
  }
});
