import { assert, test } from './harness';
import { pl } from './i18n-keys';
import { en } from './i18n-keys';
import { fr } from '../src/i18n/fr';

function placeholders(value: string): string[] {
  return [...new Set([...value.matchAll(/\{(\w+)(?=\}|,\s*plural\s*,)/g)].map((m) => m[1]!))].sort();
}

test('French dictionary has all keys and matching placeholders', () => {
  const keys = Object.keys(pl).sort();
  assert(JSON.stringify(Object.keys(fr).sort()) === JSON.stringify(keys), 'French keys differ from Polish');
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    if (key.startsWith('goodGen.') || key.startsWith('goodAcc.')) continue;
    assert(JSON.stringify(placeholders(fr[key])) === JSON.stringify(placeholders(en[key])), `Placeholder mismatch: ${key}`);
  }
});
