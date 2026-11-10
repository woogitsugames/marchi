// A sheet or letter that is leaving still sits on the page for its fade (D-590): 240 ms for a sheet, 220 ms for a
// letter. Until then it took taps — a second tap on "Sprzedaj" in a closing wagon sheet sold a wagon that no longer
// existed (red toast), and the fading opening letter swallowed the first tap on the map. A leaving element goes
// `inert` from the first frame of its exit: hit-testing passes through it to what lies beneath (as pointer-events:
// none, also for children that set pointer-events: auto), and it drops out of keyboard focus. Kept free of the DOM
// types so the rule is tested headless (tests/retire.test.ts).

export interface Leaving {
  inert: boolean;
  classList: { add(cls: string): void };
  remove(): void;
}

export interface Pressable {
  classList: { add(cls: string): void; contains(cls: string): boolean };
  setAttribute(name: string, value: string): void;
}

/** The sheet's exit: is-leaving (CSS fade) plus inert at once, gone after `ms`. */
export const SHEET_LEAVE_MS = 240;

/** Start the exit of `el`: no input from now on, removed after `ms` (the fade's length). */
export function retire(el: Leaving, cls: string, ms: number, later: (f: () => void, ms: number) => unknown = (f, t) => setTimeout(f, t)): void {
  el.inert = true;
  el.classList.add(cls);
  later(() => el.remove(), ms);
}

/**
 * A button whose command makes its own subject vanish (sell this wagon): true for the first press, which greys it
 * out at once; false for any press after that, until the sheet re-renders without it.
 */
export function pressOnce(el: Pressable): boolean {
  if (el.classList.contains('is-disabled')) return false;
  el.classList.add('is-disabled');
  el.setAttribute('aria-disabled', 'true');
  return true;
}
