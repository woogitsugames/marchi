// One-off maintenance helper: rewrite every translated dictionary in Polish key order and
// report which PENDING_KEYS are now translated in all languages.
// Usage: npx tsx tools/i18n-reorder.ts [--write]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pl, PENDING_KEYS } from '../src/i18n/pl';

const dir = new URL('../src/i18n/', import.meta.url).pathname;
const write = process.argv.includes('--write');
const plKeys = Object.keys(pl);
const files = readdirSync(dir).filter((f) => /^[a-z]{2}(_[A-Za-z]+)?\.ts$/.test(f) && !['pl.ts', 'en.ts'].includes(f));
const dicts: Record<string, Record<string, string>> = {};
for (const f of files) {
  const mod = await import(dir + f);
  const d = Object.values(mod).find((v) => v && typeof v === 'object') as Record<string, string>;
  dicts[f] = d;
}
const done = PENDING_KEYS.filter((k) => files.every((f) => typeof dicts[f]![k] === 'string'));
const stillPending = new Set<string>(PENDING_KEYS.filter((k) => !done.includes(k)));
console.log('translated everywhere:', done.length, '/', PENDING_KEYS.length, 'still pending:', [...stillPending].join(', '));
for (const f of files) {
  const d = dicts[f]!;
  const extra = Object.keys(d).filter((k) => !plKeys.includes(k));
  const partial = Object.keys(d).filter((k) => stillPending.has(k));
  if (extra.length || partial.length) console.log(f, 'extra:', extra, 'partial pending:', partial);
  if (!write) continue;
  const src = readFileSync(dir + f, 'utf8');
  const head = src.slice(0, src.indexOf('= {') + 3);
  const body = plKeys.filter((k) => k in d && !stillPending.has(k)).map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(d[k])},`);
  writeFileSync(dir + f, `${head}\n${body.join('\n')}\n};\n`);
}
