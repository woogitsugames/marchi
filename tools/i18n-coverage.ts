// Translation coverage report (BACKLOG P2). pl.ts is the key source (D-11); PENDING_KEYS are the keys added after
// the last translation round (other languages fall back to English for them, D-18).
//   npx tsx tools/i18n-coverage.ts              table: per language, pending keys translated / missing, placeholder
//                                               mismatches, values identical to English (untranslated suspects)
//   npx tsx tools/i18n-coverage.ts --json       the same as JSON
//   npx tsx tools/i18n-coverage.ts --pack DIR   a translation batch for the next GPT round: DIR/keys.json (key, pl,
//                                               en, max length, missing languages) and DIR/README.md (the order)
// Exit 1 when a translated value breaks placeholders (the per-language tests check only non-pending keys).
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PENDING_KEYS, pl } from '../src/i18n/pl';
import { en } from '../src/i18n/en';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const I18N = join(ROOT, 'src/i18n');
const SKIP = new Set(['pl', 'en', 'index', 'plural', 'pseudo']);
const args = process.argv.slice(2);
const packDir = args.includes('--pack') ? args[args.indexOf('--pack') + 1] : null;

type Dict = Record<string, string | undefined>;
const placeholders = (v: string): string =>
  [...new Set([...v.matchAll(/\{(\w+)(?=\}|,\s*plural\s*,)/g)].map((m) => m[1]!))].sort().join(',');
/** Words that legitimately read the same in many languages (brand, numbers, symbols). */
const sameOk = (v: string): boolean => !/\p{L}{3}/u.test(v.replace(/\{[^}]*\}/g, '')) || /^Marchia$/.test(v);

const langs: { code: string; dict: Dict }[] = [];
for (const f of readdirSync(I18N).filter((x) => x.endsWith('.ts')).sort()) {
  const code = f.replace(/\.ts$/, '');
  if (SKIP.has(code)) continue;
  const mod = (await import(join(I18N, f))) as Record<string, Dict>;
  const dict = mod[code] ?? Object.values(mod).find((v) => typeof v === 'object');
  if (dict) langs.push({ code, dict });
}

const pending = new Set<string>(PENDING_KEYS);
const keys = Object.keys(pl);
const enD = en as Dict;
interface Row { lang: string; pendingDone: number; pendingMissing: string[]; otherMissing: string[]; placeholderBad: string[]; sameAsEn: string[] }
const rows: Row[] = langs.map(({ code, dict }) => {
  const r: Row = { lang: code, pendingDone: 0, pendingMissing: [], otherMissing: [], placeholderBad: [], sameAsEn: [] };
  for (const k of keys) {
    const v = dict[k];
    if (typeof v !== 'string' || !v.trim()) { (pending.has(k) ? r.pendingMissing : r.otherMissing).push(k); continue; }
    if (pending.has(k)) r.pendingDone++;
    const e = enD[k] ?? '';
    if (!k.startsWith('goodGen.') && !k.startsWith('goodAcc.') && placeholders(v) !== placeholders(e)) r.placeholderBad.push(k);
    if (v === e && !sameOk(v)) r.sameAsEn.push(k);
  }
  return r;
});

if (args.includes('--json')) {
  console.log(JSON.stringify({ keys: keys.length, pending: pending.size, langs: rows }, null, 1));
} else {
  console.log(`keys ${keys.length}, pending ${pending.size} (PENDING_KEYS in src/i18n/pl.ts)\n`);
  console.log('lang     pending ok  missing  other missing  placeholder!  same as en');
  for (const r of rows) {
    console.log(`${r.lang.padEnd(8)} ${String(r.pendingDone).padStart(10)}  ${String(r.pendingMissing.length).padStart(7)}  ${String(r.otherMissing.length).padStart(13)}  ${String(r.placeholderBad.length).padStart(12)}  ${String(r.sameAsEn.length).padStart(10)}`);
  }
  for (const r of rows) {
    if (r.placeholderBad.length) console.log(`\n${r.lang}: placeholder mismatch: ${r.placeholderBad.join(', ')}`);
    if (r.otherMissing.length) console.log(`\n${r.lang}: missing non-pending keys: ${r.otherMissing.join(', ')}`);
  }
}

if (packDir) {
  const out = join(ROOT, packDir);
  mkdirSync(out, { recursive: true });
  const todo = keys.filter((k) => pending.has(k) || rows.some((r) => r.otherMissing.includes(k)));
  const items = todo.map((k) => {
    const e = enD[k] ?? '';
    // room the UI gives the line today: the longer of pl/en +40 % (the pseudo locale's budget), at least 12
    const max = Math.max(12, Math.ceil(Math.max(e.length, (pl as Dict)[k]!.length) * 1.4));
    return { key: k, pl: (pl as Dict)[k], en: e, maxChars: max, missing: rows.filter((r) => r.pendingMissing.includes(k) || r.otherMissing.includes(k)).map((r) => r.lang) };
  });
  writeFileSync(join(out, 'keys.json'), JSON.stringify(items, null, 1) + '\n');
  const groups = new Map<string, number>();
  for (const it of items) { const g = it.key.split('.')[0]!; groups.set(g, (groups.get(g) ?? 0) + 1); }
  const readme = [
    `# Tłumaczenia — paczka uzupełnień (wygenerowana: \`npx tsx tools/i18n-coverage.ts --pack ${packDir}\`)`,
    '',
    `Klucze: **${items.length}** (wszystkie z \`PENDING_KEYS\` w \`src/i18n/pl.ts\` + brakujące poza nią). Lista z oryginałem PL,`,
    'angielskim i limitem długości: `keys.json` (pole `missing` = języki, którym brakuje klucza).',
    `Grupy: ${[...groups].map(([g, n]) => `\`${g}.*\` ${n}`).join(', ')}.`,
    `Języki: ${rows.map((r) => r.lang).join(', ')}.`,
    '',
    '- Edytuj tylko `src/i18n/<lang>.ts` (+ glosariusze `docs/i18n/glossary-<lang>.md`); NIE edytuj `pl.ts`, `en.ts`, `index.ts`, `tests/i18n-keys.ts`.',
    '- Kolejność kluczy jak w `pl.ts`; placeholdery `{n}`, `{good}`, `{time}` itd. bez zmian; bloki `{n, plural, …}` z kategoriami',
    '  właściwymi dla języka (Intl.PluralRules; `tests/i18n-plural` sprawdza każdy blok).',
    '- `maxChars` to budżet układu (dłuższy z PL/EN + 40 %, jak `?lang=pseudo`); notatki samouczka ≤ 140 znaków.',
    '- Ton: kasztelański, rzeczowy, bez emoji; nazwy zjawisk zgodnie z glosariuszem.',
    '- Sprawdzenie: `npx tsx tools/i18n-coverage.ts` (kolumna „placeholder!” = 0), `npm test`, `npm run layout -- --quick`.',
    '- NIE usuwaj kluczy z `PENDING_KEYS` — zrobi to integrator, gdy wszystkie języki je mają.',
    '',
  ].join('\n');
  writeFileSync(join(out, 'README.md'), readme);
  console.log(`\npack: ${items.length} keys -> ${packDir}/keys.json, ${packDir}/README.md`);
}

process.exitCode = rows.some((r) => r.placeholderBad.length) ? 1 : 0;
