// Regenerate with: npx tsx tools/decisions-index.ts
// Only explicit dates/statuses are reported; an unrecorded date is not invented.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(`${root}/docs/DECISIONS.md`, 'utf8');
const heading = /^\*\*D-(\d+)\s+[—–-]\s+([\s\S]*?)\*\*/gm;
const matches = [...source.matchAll(heading)];
const rows = matches.map((m, i) => {
  const id = Number(m[1]);
  const title = m[2]!.replace(/\s*\n\s*/g, ' ').replace(/\.$/, '').trim();
  const body = source.slice(m.index!, matches[i + 1]?.index ?? source.length);
  const dates = [...new Set([...body.matchAll(/\b20\d\d-\d\d-\d\d\b/g)].map(x => x[0]))];
  const date = dates.length === 1 ? dates[0]! : '—';
  const statusMatch = body.match(/\((?:status:\s*)?(superseded(?:\s+by)?\s+D-\d+|proposed|decided|to confirm with owner)\b[^)]*\)/i);
  const status = statusMatch?.[1] ?? 'nieokreślony';
  const area = /\b(i18n|translat|text|letter|locali[sz]|narrativ|content)\b/i.test(title) ? 'treść' : /\b(render|texture|terrain|shadow|shader|graphics|visual|colour|color)\b/i.test(title) ? 'render' : /\b(UI|screen|sheet|menu|HUD|button|layout|touch|accessib|card|icon)\b/i.test(title) ? 'UI' : /\b(sim|mission|wagon|market|road|bridge|econom|gameplay|rank|save|fuzz)\b/i.test(title) ? 'sim' : 'inne';
  return { id, title, date, status, area };
}).sort((a,b) => a.id-b.id);
const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const lines = ['# Indeks decyzji', '', 'Generowany z `docs/DECISIONS.md`: `npx tsx tools/decisions-index.ts`.', 'Data jest podana tylko wtedy, gdy treść decyzji zawiera jedną jednoznaczną datę; status nieokreślony oznacza brak jawnego oznaczenia. Obszar jest orientacyjny, na podstawie tytułu. Przy kilku datach sprawdź źródło.', '', '| Nr | Data | Tytuł | Status | Obszar |', '|---|---|---|---|---|', ...rows.map(r => `| D-${String(r.id).padStart(2, '0')} | ${r.date} | ${esc(r.title)} | ${esc(r.status)} | ${r.area} |`)];
writeFileSync(`${root}/docs/DECISIONS-index.md`, lines.join('\n')+'\n');
console.log(`Indexed ${rows.length} decisions`);
