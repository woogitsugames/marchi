import { en } from './i18n-keys';
import { ko } from '../src/i18n/ko';
import { pl, type MessageKey } from './i18n-keys';
import { assert, test } from './harness';

function placeholders(value: string): string[] {
  return [...new Set([...value.matchAll(/\{(\w+)(?=\}|,\s*plural\s*,)/g)].map((m) => m[1]!))].sort();
}

test('Korean dictionary has all Polish keys and English placeholders', () => {
  const expected = Object.keys(pl).sort();
  const actual = Object.keys(ko).sort();
  assert(JSON.stringify(actual) === JSON.stringify(expected), 'Korean dictionary keys differ from Polish');
  for (const key of expected as MessageKey[]) {
    if (key.startsWith('goodGen.') || key.startsWith('goodAcc.')) continue;
    assert(JSON.stringify(placeholders(ko[key])) === JSON.stringify(placeholders(en[key])), `Placeholder mismatch: ${key}`);
  }
});
