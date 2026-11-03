// Pseudo-locale (?lang=pseudo): every English message stays usable — same placeholders, same plural
// structure, markup intact — and comes out at least ~35 % longer, accented, bracketed.
import { assert, test } from './harness';
import { en } from './i18n-keys';
import { pseudoize } from '../src/i18n/pseudo';

function placeholders(value: string): string[] {
  return [...new Set([...value.matchAll(/\{(\w+)(?=\}|,\s*plural\s*,)/g)].map((m) => m[1]!))].sort();
}
/** Same block pattern as formatPlural in src/i18n/index.ts. */
const PLURAL = /\{(\w+), plural,((?:\s*(?:=\d+|zero|one|two|few|many|other)\s*\{[^{}]*\})+)\s*\}/g;
const tags = (s: string): string[] => s.match(/<\/?[a-zA-Z][^>]*>|&#?\w+;/g) ?? [];
const letters = (s: string): number => (s.match(/\p{L}/gu) ?? []).length;

test('pseudo-locale keeps placeholders, plural blocks and markup of every message', () => {
  for (const [key, value] of Object.entries(en)) {
    const p = pseudoize(value);
    assert(p.startsWith('⟦') && p.endsWith('⟧'), `${key}: not bracketed`);
    assert(JSON.stringify(placeholders(p)) === JSON.stringify(placeholders(value)), `${key}: placeholders ${p}`);
    assert((p.match(PLURAL) ?? []).length === (value.match(PLURAL) ?? []).length, `${key}: plural block broken: ${p}`);
    assert(JSON.stringify(tags(p)) === JSON.stringify(tags(value)), `${key}: markup changed: ${p}`);
    assert(!/[a-zA-Z]/.test(p.replace(PLURAL, '').replace(/\{\w+\}/g, '').replace(/<[^>]*>|&#?\w+;/g, '')), `${key}: unaccented ASCII left: ${p}`);
  }
});

test('pseudo-locale stretches text by about 40 %', () => {
  let a = 0, b = 0;
  for (const value of Object.values(en)) { a += letters(value); b += letters(pseudoize(value)); }
  const r = b / a;
  assert(r > 1.33 && r < 1.5, `stretch ratio ${r.toFixed(2)}`);
  assert(pseudoize('Bread and planks') !== 'Bread and planks', 'no change');
});
