// Pseudo-locale for layout screenshots (`?lang=pseudo`, BACKLOG P1 i18n): English text with every ASCII
// letter accented and the words stretched by about 40 % (German / Russian / Finnish run that much longer),
// wrapped in ⟦ ⟧ so a cut-off end is visible at a glance. {param} placeholders, the ICU-lite plural syntax
// (`{n, plural, one {# cart} other {# carts}}`, `#`) and HTML tags/entities are kept as they are.

const ACCENT: Record<string, string> = {
  a: 'à', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'î', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ',
  n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'û', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'À', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Î', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ',
  N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Û', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
};
const VOWEL = /[aeiouyAEIOUY]/;

/** Accent and stretch plain text (no syntax inside): every 2nd vowel and 1 in 5 consonants is doubled. */
function stretch(s: string, st: { n: number }): string {
  let out = '';
  for (const ch of s) {
    const a = ACCENT[ch];
    if (!a) { out += ch; continue; }
    out += a;
    st.n++;
    // ~40 %: vowels are ~40 % of English letters (half doubled = 20 %), consonants 60 % (1/3 doubled = 20 %)
    if (VOWEL.test(ch) ? st.n % 2 === 0 : st.n % 3 === 0) out += a.toLowerCase();
  }
  return out;
}

/** Pseudo-localize one message, keeping placeholders, plural blocks and markup. */
export function pseudoize(msg: string): string {
  const st = { n: 0 };
  return '⟦' + walk(msg, st) + '⟧';
}

function walk(s: string, st: { n: number }): string {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (ch === '<' || ch === '&') {
      // tag or entity: copy verbatim
      const m = (ch === '<' ? /^<\/?[a-zA-Z][^>]*>/ : /^&#?\w+;/).exec(s.slice(i));
      if (m) { out += m[0]; i += m[0].length; continue; }
      out += ch; i++; continue;
    }
    if (ch === '{') {
      const close = matching(s, i);
      const inner = s.slice(i + 1, close);
      const pl = /^(\s*\w+\s*,\s*plural\s*,)([\s\S]*)$/.exec(inner);
      if (pl) {
        // keep the header and the branch keys, stretch the branch texts
        let body = '';
        let j = 0;
        const b = pl[2]!;
        while (j < b.length) {
          if (b[j] === '{') {
            const e = matching(b, j);
            body += '{' + walk(b.slice(j + 1, e), st) + '}';
            j = e + 1;
          } else { body += b[j]; j++; }
        }
        out += '{' + pl[1] + body + '}';
      } else {
        out += '{' + inner + '}'; // {param}
      }
      i = close + 1;
      continue;
    }
    if (ch === '#') { out += ch; i++; continue; }
    let j = i;
    while (j < s.length && !'<&{#'.includes(s[j]!)) j++;
    out += stretch(s.slice(i, j), st);
    i = j;
  }
  return out;
}

function matching(s: string, open: number): number {
  let d = 0;
  for (let k = open; k < s.length; k++) {
    if (s[k] === '{') d++;
    else if (s[k] === '}' && --d === 0) return k;
  }
  return s.length - 1;
}
