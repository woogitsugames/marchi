// Font coverage (BACKLOG P2 i18n): the heading face must hold every letter a language shows, otherwise the
// browser draws that one letter from a fallback face (a "ł" or "ş" in a different style, or tofu).
// Bundled faces (@fontsource WOFF files) are checked glyph by glyph through their cmap; the system-font
// languages (ar, hi, CJK) are checked for having both an Android and an iOS family in their stacks.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { assert, test } from './harness';
import { pl } from '../src/i18n/pl';
import { en } from '../src/i18n/en';
import { de } from '../src/i18n/de';
import { es } from '../src/i18n/es';
import { fr } from '../src/i18n/fr';
import { it } from '../src/i18n/it';
import { nl } from '../src/i18n/nl';
import { pt_BR } from '../src/i18n/pt_BR';
import { sv } from '../src/i18n/sv';
import { tr } from '../src/i18n/tr';
import { ru } from '../src/i18n/ru';
import { uk } from '../src/i18n/uk';

const root = new URL('..', import.meta.url);
const read = (p: string) => readFileSync(fileURLToPath(new URL(p, root)));

/** Code points mapped by a WOFF 1.0 font (cmap format 4 or 12). */
export function woffCodepoints(buf: Buffer): Set<number> {
  assert(buf.toString('latin1', 0, 4) === 'wOFF', 'not a WOFF file');
  const n = buf.readUInt16BE(12);
  let cmap: Buffer | null = null;
  for (let i = 0; i < n; i++) {
    const o = 44 + i * 20;
    if (buf.toString('latin1', o, o + 4) !== 'cmap') continue;
    const off = buf.readUInt32BE(o + 4), comp = buf.readUInt32BE(o + 8), orig = buf.readUInt32BE(o + 12);
    const raw = buf.subarray(off, off + comp);
    cmap = comp < orig ? inflateSync(raw) : Buffer.from(raw);
  }
  assert(cmap, 'no cmap table');
  const out = new Set<number>();
  const subs = cmap.readUInt16BE(2);
  for (let i = 0; i < subs; i++) {
    const pid = cmap.readUInt16BE(4 + i * 8), eid = cmap.readUInt16BE(6 + i * 8), so = cmap.readUInt32BE(8 + i * 8);
    if (!(pid === 3 && (eid === 1 || eid === 10)) && pid !== 0) continue;
    const fmt = cmap.readUInt16BE(so);
    if (fmt === 4) {
      const segX2 = cmap.readUInt16BE(so + 6);
      const ends = so + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = cmap.readUInt16BE(ends + s * 2), start = cmap.readUInt16BE(starts + s * 2);
        const delta = cmap.readInt16BE(deltas + s * 2), ro = cmap.readUInt16BE(ranges + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let g: number;
          if (ro === 0) g = (c + delta) & 0xffff;
          else { const gi = ranges + s * 2 + ro + (c - start) * 2; g = cmap.readUInt16BE(gi); if (g) g = (g + delta) & 0xffff; }
          if (g) out.add(c);
        }
      }
    } else if (fmt === 12) {
      const groups = cmap.readUInt32BE(so + 12);
      for (let gIdx = 0; gIdx < groups; gIdx++) {
        const b = so + 16 + gIdx * 12, start = cmap.readUInt32BE(b), end = cmap.readUInt32BE(b + 4), g0 = cmap.readUInt32BE(b + 8);
        for (let c = start; c <= end; c++) if (g0 + (c - start)) out.add(c);
      }
    }
  }
  return out;
}

/** Union of the code points of the @fontsource files main.ts imports for one family (+ weight filter). */
function faceCoverage(pkg: string, family: string, weights: string[]): Set<number> {
  const main = read('src/main.ts').toString();
  const all = new Set<number>();
  let files = 0;
  for (const m of main.matchAll(new RegExp(`@fontsource/${pkg}/([\\w-]+)-(\\d{3})\\.css`, 'g'))) {
    if (!weights.includes(m[2]!)) continue;
    const f = `node_modules/@fontsource/${pkg}/files/${pkg}-${m[1]}-${m[2]}-normal.woff`;
    for (const c of woffCodepoints(read(f))) all.add(c);
    files++;
  }
  assert(files > 0, `${family}: no ${weights.join('/')} files imported in main.ts`);
  return all;
}

/** Letters (and the typographic marks headings use) a language's messages contain. */
function charsOf(dict: Record<string, string>): Set<number> {
  const s = new Set<number>();
  for (const v of Object.values(dict)) {
    const text = v.replace(/\{[^{}]*\}/g, ' ').replace(/<[^>]*>/g, ' ');
    for (const ch of text) if (/[\p{L}\p{N}„“”«»‘’–—…]/u.test(ch)) s.add(ch.codePointAt(0)!);
  }
  return s;
}

const LATIN: Record<string, Record<string, string>> = { pl, en, de, es, fr, it, nl, pt_BR, sv, tr };

test('Grenze Gotisch (600/700) holds every letter of the Latin-script languages', () => {
  const g = faceCoverage('grenze-gotisch', 'Grenze Gotisch', ['600', '700']);
  const bad: string[] = [];
  for (const [l, d] of Object.entries(LATIN)) {
    const miss = [...charsOf(d)].filter((c) => !g.has(c));
    if (miss.length) bad.push(`${l}: ${miss.map((c) => `${String.fromCodePoint(c)} U+${c.toString(16).toUpperCase().padStart(4, '0')}`).join(', ')}`);
  }
  assert(bad.length === 0, `missing in the heading face:\n${bad.join('\n')}`);
});

test('Cyrillic headings: Ruslan Display, then Alegreya Sans, hold every letter of ru / uk', () => {
  const r = faceCoverage('ruslan-display', 'Ruslan Display', ['400']);
  const a = faceCoverage('alegreya-sans', 'Alegreya Sans', ['400', '500', '700']);
  const bad: string[] = [];
  for (const [l, d] of Object.entries({ ru, uk })) {
    const miss = [...charsOf(d)].filter((c) => !r.has(c) && !a.has(c));
    if (miss.length) bad.push(`${l}: ${miss.map((c) => String.fromCodePoint(c)).join(' ')}`);
  }
  assert(bad.length === 0, `missing in both Cyrillic faces:\n${bad.join('\n')}`);
});

test('system-font scripts name an Android and an iOS family in both stacks', () => {
  const css = read('src/styles/main.css').toString();
  const block = (sel: string): string => {
    const i = css.indexOf(sel);
    assert(i >= 0, `no ${sel} block in main.css`);
    return css.slice(i, css.indexOf('}', i));
  };
  const need: [string, string[]][] = [
    [":root[data-script='arabic']", ['Noto Naskh Arabic', 'Geeza Pro']],
    [":root[data-script='devanagari']", ['Noto Sans Devanagari', 'Kohinoor Devanagari']],
    [":root[data-script='cjk']", ['CJK JP', 'Hiragino']],
    [":root[lang='ko']", ['CJK KR', 'Apple SD Gothic Neo']],
    [":root[lang='zh-Hans']", ['CJK SC', 'PingFang SC']],
  ];
  const bad: string[] = [];
  for (const [sel, fams] of need) {
    const b = block(sel);
    for (const v of ['--font-head', '--font-body']) {
      const decl = new RegExp(`${v}:([^;]*);`).exec(b)?.[1] ?? '';
      for (const f of fams) if (!decl.includes(f)) bad.push(`${sel} ${v}: no ${f}`);
    }
  }
  assert(bad.length === 0, `font stacks:\n${bad.join('\n')}`);
});
