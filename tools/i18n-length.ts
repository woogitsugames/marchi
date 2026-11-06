// Generate a heuristic character-count report; visual layout still needs checking.
// Run: npx tsx tools/i18n-length.ts
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pl } from '../src/i18n/pl';
import { en } from '../src/i18n/en';

const root = fileURLToPath(new URL('..', import.meta.url));
type Dictionary = Record<string, string | undefined>;
const enDict: Dictionary = en, plDict: Dictionary = pl;
const languages: { code: string; dict: Dictionary }[] = [{ code: 'pl', dict: plDict }, { code: 'en', dict: enDict }];
for (const name of readdirSync(join(root, 'src/i18n')).filter(f => f.endsWith('.ts')).sort()) {
  const code = name.slice(0, -3);
  if (['pl', 'en', 'index', 'plural', 'pseudo'].includes(code)) continue;
  const mod = await import(join(root, 'src/i18n', name)) as Record<string, unknown>;
  const dict = mod[code];
  if (!dict || typeof dict !== 'object') throw new Error(`Missing dictionary export: ${code}`);
  languages.push({ code, dict: dict as Dictionary });
}
// Code points are a reproducible approximation, not rendered width. Blanks and missing entries
// are explicitly reported; an absent translation falls back to English at runtime.
const length = (s: string) => Array.from(s).length;
const ratio = (value: number, baseline: number) => baseline ? (value / baseline).toFixed(4) : '';
const csv = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
const lines = [['key', 'language', 'status', 'text', 'length_codepoints', 'en_length', 'pl_length', 'ratio_en', 'ratio_pl', 'over_130_percent'].join(',')];
const flagged: string[] = [];
for (const key of Object.keys(plDict).sort()) {
  const english = enDict[key] ?? '', polish = plDict[key] ?? '';
  for (const { code, dict } of languages) {
    const exists = typeof dict[key] === 'string';
    const value = exists ? dict[key]! : english;
    const n = length(value), e = length(english), p = length(polish);
    const risk = (e > 0 && n / e > 1.3) || (p > 0 && n / p > 1.3);
    const status = exists ? (value ? 'translated' : 'empty') : 'fallback-en';
    lines.push([key, code, status, value, n, e, p, ratio(n,e), ratio(n,p), risk ? 'yes' : 'no'].map(csv).join(','));
    if (risk) flagged.push(`${code}\t${key}\ten=${ratio(n,e)}\tpl=${ratio(n,p)}${exists ? '' : '\t(fallback)'}`);
  }
}
const output = join(root, 'docs/i18n/length-report.csv');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, lines.join('\n') + '\n');
console.log(`Wrote ${lines.length - 1} rows to ${output}; ${flagged.length} over 130%.`);
console.log(flagged.join('\n'));
