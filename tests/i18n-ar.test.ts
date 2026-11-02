import { pl, type MessageKey } from './i18n-keys';
import { en } from './i18n-keys';
import { ar } from '../src/i18n/ar';
import { PENDING_KEYS } from '../src/i18n/pl';
import { en as enFull } from '../src/i18n/en';
import { assert, eq, test } from './harness';

// A plural block consumes the same parameter as a simple placeholder.
function parameters(message: string): string[] {
  return [...new Set([...message.matchAll(/\{(\w+)(?:\}|,\s*plural,)/g)].map((m) => m[1]!))].sort();
}

// Arabic may carry keys still pending for the other languages (the RTL HUD needs them first, D-43).
const pending: ReadonlySet<string> = new Set(PENDING_KEYS);

test('Arabic dictionary has exactly the Polish keys', () => {
  eq(JSON.stringify(Object.keys(ar).filter((k) => !pending.has(k))), JSON.stringify(Object.keys(pl)), 'key order');
});

test('Arabic pending-key translations preserve English parameters', () => {
  const extra = ar as Record<string, string>;
  for (const key of PENDING_KEYS) {
    const value = extra[key];
    if (value === undefined) continue;
    eq(JSON.stringify(parameters(value)), JSON.stringify(parameters(enFull[key])), key);
  }
});

test('Arabic messages preserve English parameters', () => {
  for (const key of Object.keys(pl) as MessageKey[]) {
    const value = ar[key];
    assert(typeof value === 'string' && value.trim().length > 0, `Missing or empty translation: ${key}`);
    if (key.startsWith('goodGen.') || key.startsWith('goodAcc.')) continue;
    eq(JSON.stringify(parameters(value)), JSON.stringify(parameters(en[key])), key);
  }
});
