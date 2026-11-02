// RTL (D-37): the UI stylesheet uses logical properties, so `dir="rtl"` mirrors the HUD and the sheets.
// A physical left/right may only appear on the listed exceptions: boxes placed by JS screen coordinates
// (markers, ghost labels, tutorial ring), boxes centred with left: 50% + translateX(-50%), explicit
// [dir='rtl'] overrides, and the definitions of the physical safe-area variables.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assert, test } from './harness';

const CSS = fileURLToPath(new URL('../src/styles/main.css', import.meta.url));

/** Rules whose box JS positions with a transform from screen coordinates (left: 0; top: 0 anchor). */
const SCREEN_PLACED = ['.bubble', '.eta-tag', '.draft-tag', '.tut-', '.fix-stamp', '.ghost-tag', '.gate-pin'];

interface Decl { line: number; selector: string; prop: string; value: string }

function declarations(css: string): Decl[] {
  const out: Decl[] = [];
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  let selector = '';
  noComments.split('\n').forEach((ln, i) => {
    if (ln.includes('{')) selector = ln.split('{')[0]!.trim() || selector;
    for (const m of ln.matchAll(/(?<![\w-])([a-z-]+)\s*:\s*([^;{}]+)/g)) {
      out.push({ line: i + 1, selector, prop: m[1]!, value: m[2]!.trim() });
    }
  });
  return out;
}

const PHYSICAL = /^(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right|border-left-[a-z]+|border-right-[a-z]+|float|clear)$/;

test('UI stylesheet: no physical left/right outside the listed exceptions (RTL mirrors by logical properties)', () => {
  const bad: string[] = [];
  for (const d of declarations(readFileSync(CSS, 'utf8'))) {
    const physical = PHYSICAL.test(d.prop) || (d.prop === 'text-align' && /^(left|right)\b/.test(d.value))
      || ((d.prop === 'float' || d.prop === 'clear') && /left|right/.test(d.value));
    if (!physical) continue;
    if (d.selector.includes("[dir='rtl']")) continue; // explicit mirrored override
    if ((d.prop === 'left' || d.prop === 'right') && /^(calc\()?\(?50%/.test(d.value)) continue; // centred
    if (/rank-letter-wrap/.test(d.selector) && d.prop === 'left') continue; // centred, mirrored explicitly
    if (SCREEN_PLACED.some((s) => d.selector.includes(s)) && (d.prop === 'left' || d.prop === 'right')) continue;
    bad.push(`main.css:${d.line} ${d.selector} { ${d.prop}: ${d.value} }`);
  }
  assert(bad.length === 0, `physical left/right in the UI stylesheet (use inset-inline-*, margin/padding-inline-*, text-align: start/end):\n${bad.join('\n')}`);
});

test('UI stylesheet: inline offsets use the logical safe areas, which swap in RTL', () => {
  const css = readFileSync(CSS, 'utf8');
  const uses = [...css.matchAll(/var\(--safe-(l|r)\)/g)].length;
  // only the two definitions of the logical pair may read the physical safe areas
  assert(uses === 4, `var(--safe-l/-r) used outside the --safe-s/--safe-e definitions (${uses} uses, want 4)`);
  assert(/:root\[dir='rtl'\][^{]*\{[^}]*--safe-s:\s*var\(--safe-r\)[^}]*--safe-e:\s*var\(--safe-l\)/.test(css), 'RTL swaps the safe-area pair');
});
