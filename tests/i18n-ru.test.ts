import { pl, type MessageKey } from './i18n-keys';
import { en } from './i18n-keys';
import { ru } from '../src/i18n/ru';
import { assert, eq, test } from './harness';

// A plural block consumes the same parameter as a simple placeholder.
function parameters(message: string): string[] {
  return [...new Set([...message.matchAll(/\{(\w+)(?:\}|,\s*plural,)/g)].map((m) => m[1]!))].sort();
}

test('Russian dictionary has exactly the Polish keys', () => {
  eq(JSON.stringify(Object.keys(ru).sort()), JSON.stringify(Object.keys(pl).sort()), 'keys');
});

test('Russian messages preserve English parameters', () => {
  for (const key of Object.keys(pl) as MessageKey[]) {
    if (key.startsWith('goodGen.') || key.startsWith('goodAcc.')) continue;
    assert(ru[key].trim().length > 0, `${key} is empty`);
    eq(JSON.stringify(parameters(ru[key])), JSON.stringify(parameters(en[key])), key);
  }
});
