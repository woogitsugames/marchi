import { pl, type MessageKey } from './i18n-keys';
import { en } from './i18n-keys';
import { uk } from '../src/i18n/uk';
import { assert, eq, test } from './harness';
import { PENDING_KEYS } from '../src/i18n/pl';
// keys still pending for some language (e.g. hi) may already be translated here
const PENDING_SET: ReadonlySet<string> = new Set(PENDING_KEYS);

// A plural block consumes the same parameter as a simple placeholder.
function parameters(message: string): string[] {
  return [...new Set([...message.matchAll(/\{(\w+)(?:\}|,\s*plural,)/g)].map((m) => m[1]!))].sort();
}

test('Ukrainian dictionary has exactly the Polish keys', () => {
  eq(JSON.stringify(Object.keys(uk).filter((k) => !PENDING_SET.has(k))), JSON.stringify(Object.keys(pl)), 'key order');
});

test('Ukrainian messages preserve English parameters', () => {
  for (const key of Object.keys(pl) as MessageKey[]) {
    const value = uk[key];
    assert(typeof value === 'string' && value.trim().length > 0, `Missing or empty translation: ${key}`);
    if (key.startsWith('goodGen.') || key.startsWith('goodAcc.')) continue;
    eq(JSON.stringify(parameters(value)), JSON.stringify(parameters(en[key])), key);
  }
});
