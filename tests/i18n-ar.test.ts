import { pl, type MessageKey } from './i18n-keys';
import { en } from './i18n-keys';
import { ar } from '../src/i18n/ar';
import { assert, eq, test } from './harness';

// A plural block consumes the same parameter as a simple placeholder.
function parameters(message: string): string[] {
  return [...new Set([...message.matchAll(/\{(\w+)(?:\}|,\s*plural,)/g)].map((m) => m[1]!))].sort();
}

test('Arabic dictionary has exactly the Polish keys', () => {
  eq(JSON.stringify(Object.keys(ar)), JSON.stringify(Object.keys(pl)), 'key order');
});

test('Arabic messages preserve English parameters', () => {
  for (const key of Object.keys(pl) as MessageKey[]) {
    const value = ar[key];
    assert(typeof value === 'string' && value.trim().length > 0, `Missing or empty translation: ${key}`);
    if (key.startsWith('goodGen.') || key.startsWith('goodAcc.')) continue;
    eq(JSON.stringify(parameters(value)), JSON.stringify(parameters(en[key])), key);
  }
});
