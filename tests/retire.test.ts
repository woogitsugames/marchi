// D-590: a sheet or letter that is fading out takes no taps — inert from the first frame of its exit, removed after
// the fade; the wagon sheet's "Sprzedaj" works once. The DOM wiring is read as source (as tests/a11y-markup.test.ts).
import { readFileSync } from 'node:fs';
import { SHEET_LEAVE_MS, pressOnce, retire } from '../src/ui/retire';
import { assert, eq, test } from './harness';

const src = (f: string): string => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

function fakeEl(): { inert: boolean; classes: Set<string>; removed: boolean; attrs: Record<string, string>;
  classList: { add(c: string): void; contains(c: string): boolean }; remove(): void; setAttribute(n: string, v: string): void } {
  const el = {
    inert: false, classes: new Set<string>(), removed: false, attrs: {} as Record<string, string>,
    classList: { add: (c: string) => { el.classes.add(c); }, contains: (c: string) => el.classes.has(c) },
    remove: () => { el.removed = true; },
    setAttribute: (n: string, v: string) => { el.attrs[n] = v; },
  };
  return el;
}

test('retire: the leaving element is inert at once and removed only after the fade (D-590)', () => {
  const el = fakeEl();
  const timers: { f: () => void; ms: number }[] = [];
  retire(el, 'is-leaving', SHEET_LEAVE_MS, (f, ms) => timers.push({ f, ms }));
  assert(el.inert, 'inert from the first frame: taps pass through to the map');
  assert(el.classes.has('is-leaving'), 'the fade class');
  assert(!el.removed, 'still on the page while it fades');
  eq(timers.length, 1, 'one removal timer');
  eq(timers[0]!.ms, 240, 'the 240 ms of the sheet fade');
  timers[0]!.f();
  assert(el.removed, 'gone after the fade');
});

test('retire: "Sprzedaj" works once — a second press before the sheet closes does nothing (D-590)', () => {
  const btn = fakeEl();
  assert(pressOnce(btn), 'the first press goes through');
  assert(btn.classes.has('is-disabled') && btn.attrs['aria-disabled'] === 'true', 'greyed out at once');
  assert(!pressOnce(btn), 'the second press is dropped');
  const grey = fakeEl();
  grey.classes.add('is-disabled');
  assert(!pressOnce(grey), 'a button that was grey already never fires');
});

test('retire: every fading sheet / letter goes through retire(), and the CSS passes taps through (D-590)', () => {
  const sheets = src('ui/sheets.ts');
  const close = sheets.slice(sheets.indexOf('closeTop(fromPop'), sheets.indexOf('closeAll()'));
  assert(close.includes("retire(s.el, 'is-leaving', SHEET_LEAVE_MS)"), 'sheets.closeTop retires the sheet');
  assert(!/classList\.add\('is-leaving'\)/.test(sheets), 'no bare is-leaving without inert');
  assert(src('ui/menu.ts').includes("retire(scrim, 'is-out', 220)"), 'the opening letter');
  assert(src('ui/hud.ts').includes("retire(wrap, 'is-out', 220)"), 'the rank letter');
  assert(/act === 'sell' && pressOnce\(el\)/.test(src('ui/panels.ts')), 'the sell button presses once');
  const css = src('styles/main.css');
  assert(/#ui \.sheet\.is-leaving[^{]*\{ pointer-events: none; \}/.test(css), 'CSS: a leaving sheet takes no taps');
});
