// Plural blocks in every dictionary resolve for the numbers the game shows (0, 1, 2, 3, 5, 11, 22, 100, 1000):
// an `other` branch everywhere, no braces left, the number in the text; and the road-draft cell count reads as the
// language counts (it was a separate {cells} word glued to the number before night 3).
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assert, eq, test } from './harness';
import { pluralize } from '../src/i18n/plural';

const dir = fileURLToPath(new URL('../src/i18n/', import.meta.url));
const files = readdirSync(dir).filter((f) => /^[a-z]{2}(_[A-Za-z]+)?\.ts$/.test(f));
const NUMS = [0, 1, 2, 3, 5, 11, 22, 100, 1000];
const BLOCK = /\{(\w+), plural,((?:\s*(?:=\d+|zero|one|two|few|many|other)\s*\{[^{}]*\})+)\s*\}/g;

async function dicts(): Promise<[string, Record<string, string>][]> {
  const out: [string, Record<string, string>][] = [];
  for (const f of files) {
    const mod = (await import(`../src/i18n/${f}`)) as Record<string, unknown>;
    const name = f.replace('.ts', '');
    const d = (mod[name] ?? mod.default) as Record<string, string> | undefined;
    if (d && typeof d === 'object') out.push([name.replace('_', '-'), d]);
  }
  return out;
}
const fmt = (lang: string, s: string, n: number) => pluralize(s, { n, count: n, have: n, need: n }, lang, new Intl.PluralRules(lang), lang === 'ar');

test('every plural block in every dictionary resolves with an other branch and the number', async () => {
  const bad: string[] = [];
  for (const [lang, d] of await dicts()) {
    for (const [k, v] of Object.entries(d)) {
      if (!v.includes(', plural,')) continue;
      for (const m of v.matchAll(BLOCK)) if (!/\bother\s*\{/.test(m[2]!)) bad.push(`${lang} ${k}: no other branch`);
      if (v.replace(BLOCK, '').includes(', plural,')) { bad.push(`${lang} ${k}: plural block does not parse`); continue; }
      for (const n of NUMS) {
        const vars = [...v.matchAll(BLOCK)].map((m) => m[1]!);
        const out = pluralize(v, Object.fromEntries(vars.map((x) => [x, n])), lang, new Intl.PluralRules(lang), lang === 'ar');
        if (/\{\w+, plural/.test(out)) bad.push(`${lang} ${k}(${n}): unresolved`);
      }
    }
  }
  assert(bad.length === 0, bad.slice(0, 20).join('\n'));
});

test('road cell counts read as each language counts', async () => {
  const d = Object.fromEntries(await dicts());
  eq(fmt('pl', d.pl!['road.cells']!, 1), '1 pole', 'pl 1');
  eq(fmt('pl', d.pl!['road.cells']!, 3), '3 pola', 'pl 3');
  eq(fmt('pl', d.pl!['road.cells']!, 5), '5 pól', 'pl 5');
  eq(fmt('pl', d.pl!['road.cells']!, 22), '22 pola', 'pl 22');
  eq(fmt('en', d.en!['road.cells']!, 1), '1 cell', 'en 1');
  eq(fmt('en', d.en!['road.cells']!, 1000), '1,000 cells', 'en 1000');
  eq(fmt('ru', d.ru!['road.cells']!, 11), '11 клеток', 'ru 11');
  eq(fmt('ja', d.ja!['road.cells']!, 3), '3マス', 'ja 3');
  eq(fmt('pl', d.pl!['road.bridge']!, 2), 'most drewniany: 2 pola', 'pl bridge');
  for (const [lang, dict] of Object.entries(d)) {
    for (const n of NUMS) assert(fmt(lang, dict['road.cells']!, n).includes(new Intl.NumberFormat(`${lang}-u-nu-latn`).format(n)), `${lang} ${n}: number missing`);
  }
});

test('i18n plural: "the only wagon" is said for exactly one wagon, not for 21 in Russian / Ukrainian (QA 7 XI)', async () => {
  for (const [lang, d] of await dicts()) {
    if (lang !== 'ru' && lang !== 'uk') continue;
    const rules = new Intl.PluralRules(lang);
    for (const key of ['cause.paceFleet', 'cause.paceHaul']) {
      const one = pluralize(d[key]!, { n: 1 }, lang, rules, false);
      const many = pluralize(d[key]!, { n: 21 }, lang, rules, false);
      assert(/единствен|єдин/.test(one), `${lang} ${key} n=1: ${one}`);
      assert(!/единствен|єдин/.test(many) && many.includes('21'), `${lang} ${key} n=21: ${many}`);
    }
  }
});
