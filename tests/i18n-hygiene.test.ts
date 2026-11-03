// i18n hygiene (BACKLOG P3 docs gates): every message key is used by the code, and no player-facing
// text is written straight into index.html or into the UI's element builders (CLAUDE.md: all through i18n).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pl } from '../src/i18n/pl';
import { assert, test } from './harness';

const root = fileURLToPath(new URL('..', import.meta.url));
function files(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== 'i18n') files(p, out); } else if (f.endsWith('.ts')) out.push(p);
  }
  return out;
}
const srcFiles = files(join(root, 'src'));
const src = srcFiles.map((f) => readFileSync(f, 'utf8')).join('\n');

test('every message key is used by the code (literally or through a `prefix.${…}` template)', () => {
  // dynamic keys: `good.${g}`, `rank.${r}`, `tutorial.m1.step${n}` -> prefixes "good.", "rank.", "tutorial.m1.step"
  const prefixes = new Set<string>();
  for (const m of src.matchAll(/`([a-zA-Z][\w.]*)\$\{/g)) prefixes.add(m[1]!);
  for (const m of src.matchAll(/['"]([a-zA-Z][\w]*(?:\.[\w]+)*\.)['"]\s*\+/g)) prefixes.add(m[1]!);
  const dead = Object.keys(pl).filter((k) =>
    !src.includes(`'${k}'`) && !src.includes(`"${k}"`) && !src.includes(`\`${k}\``) && ![...prefixes].some((p) => p.length > 2 && k.startsWith(p)));
  assert(dead.length === 0, `unused message keys (remove them from all dictionaries or use them):\n${dead.join('\n')}`);
});

test('index.html carries no player-facing text besides the <title> brand', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const body = html.slice(html.indexOf('<body'));
  const text = body.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, ' ').trim();
  assert(text === '', `literal text in index.html body: "${text.slice(0, 80)}"`);
  const attrs = [...html.matchAll(/\s(aria-label|title|alt|placeholder)="([^"]*)"/g)].filter((m) => /\p{L}/u.test(m[2]!));
  assert(attrs.length === 0, `literal ${attrs.map((m) => m[1]).join(', ')} in index.html`);
});

test('UI element builders take their text from t(), not from string literals', () => {
  const bad: string[] = [];
  for (const f of srcFiles.filter((p) => /[/\\]src[/\\]ui[/\\]/.test(p))) {
    const s = readFileSync(f, 'utf8');
    const rel = f.slice(root.length);
    // h('tag', attrs, 'Some words') and aria-label / title / placeholder / alt set to a literal with letters
    for (const m of s.matchAll(/\bh\('[^']*',\s*(?:null|\{[^}]*\})\s*,\s*'([^']*)'/g)) if (/\p{L}{2}/u.test(m[1]!)) bad.push(`${rel}: h(…, '${m[1]}')`);
    for (const m of s.matchAll(/['"]?(aria-label|title|placeholder|alt)['"]?\s*:\s*'([^']*)'/g)) if (/\p{L}{2}/u.test(m[2]!)) bad.push(`${rel}: ${m[1]}: '${m[2]}'`);
    for (const m of s.matchAll(/\.(textContent|innerText)\s*=\s*'([^']*)'/g)) if (/\p{L}{2}/u.test(m[2]!)) bad.push(`${rel}: ${m[1]} = '${m[2]}'`);
  }
  assert(bad.length === 0, `hard-coded UI text:\n${bad.join('\n')}`);
});
