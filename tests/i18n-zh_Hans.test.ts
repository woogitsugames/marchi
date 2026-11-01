import { en } from './i18n-keys';
import { zh_Hans } from '../src/i18n/zh_Hans';
import { pl, type MessageKey } from './i18n-keys';
import { assert, test } from './harness';

function placeholders(value: string): string[] {
  return [...new Set([...value.matchAll(/\{(\w+)(?=\}|,\s*plural\s*,)/g)].map((m) => m[1]!))].sort();
}

test('Simplified Chinese dictionary has all Polish keys and English placeholders', () => {
  const expected = Object.keys(pl).sort();
  const actual = Object.keys(zh_Hans).sort();
  assert(JSON.stringify(actual) === JSON.stringify(expected), 'Simplified Chinese dictionary keys differ from Polish');
  for (const key of expected as MessageKey[]) {
    if (key.startsWith('goodGen.') || key.startsWith('goodAcc.')) continue;
    assert(JSON.stringify(placeholders(zh_Hans[key])) === JSON.stringify(placeholders(en[key])), `Placeholder mismatch: ${key}`);
  }
});
