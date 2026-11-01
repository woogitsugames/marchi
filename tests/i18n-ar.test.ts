import { pl, type MessageKey } from '../src/i18n/pl';
import { en } from '../src/i18n/en';
import { ar } from '../src/i18n/ar';
import { assert, eq, test } from './harness';

// A plural block consumes the same parameter as a simple placeholder.
function parameters(message: string): string[] {
  return [...new Set([...message.matchAll(/\{(\w+)(?:\}|,\s*plural,)/g)].map((m) => m[1]!))].sort();
}

test('Arabic dictionary has exactly the Polish keys', () => {
  eq(JSON.stringify(Object.keys(ar).sort()), JSON.stringify(Object.keys(pl).sort()), 'keys');
});

test('Arabic messages preserve English parameters', () => {
  for (const key of Object.keys(pl) as MessageKey[]) {
    if (key.startsWith('goodGen.') || key.startsWith('goodAcc.')) continue;
    assert(ar[key].trim().length > 0, `${key} is empty`);
    eq(JSON.stringify(parameters(ar[key])), JSON.stringify(parameters(en[key])), key);
  }
});
