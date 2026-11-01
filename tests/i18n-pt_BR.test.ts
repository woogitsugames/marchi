import { en } from './i18n-keys';
import { pt_BR } from '../src/i18n/pt_BR';
import { pl, type MessageKey } from './i18n-keys';
import { assert, test } from './harness';

function placeholders(value: string): string[] {
  return [...new Set([...value.matchAll(/\{(\w+)(?=\}|,\s*plural\s*,)/g)].map((m) => m[1]!))].sort();
}

test('Brazilian Portuguese dictionary has all Polish keys and English placeholders', () => {
  const expected = Object.keys(pl).sort();
  const actual = Object.keys(pt_BR).sort();
  assert(JSON.stringify(actual) === JSON.stringify(expected), 'Brazilian Portuguese dictionary keys differ from Polish');
  for (const key of expected as MessageKey[]) {
    if (key.startsWith('goodGen.') || key.startsWith('goodAcc.')) continue;
    assert(JSON.stringify(placeholders(pt_BR[key])) === JSON.stringify(placeholders(en[key])), `Placeholder mismatch: ${key}`);
  }
});
