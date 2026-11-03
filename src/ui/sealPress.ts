// End of a won contract (owner decision 6, 2026-11-03; D-60 remainder): the castle's wax seal is pressed onto
// the screen before the end letter — 200 ms down (ease-out, no spring), held ~1 s, then the letter. One tap or
// key skips it. Reduced motion: the CSS animation collapses and the hold shortens. UI only, reads nothing.
import { h } from './dom';

/** Press (ms) and the whole cue before the letter (ms). */
export const SEAL_PRESS_MS = 200;
export const SEAL_TOTAL_MS = 1200;

/**
 * Shows the pressing seal over `host` and calls `done` once — after SEAL_TOTAL_MS or at the first tap / key.
 * Returns a cancel function (no `done`), for leaving the game mid-cue.
 */
export function pressSeal(host: HTMLElement, done: () => void): () => void {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = h('div.seal-press', { 'aria-hidden': 'true' }, h('i.seal-press-wax.kseal.on'), h('i.seal-press-ring'));
  host.append(el);
  let over = false;
  const finish = (call: boolean): void => {
    if (over) return;
    over = true;
    window.clearTimeout(timer);
    el.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip, true);
    el.remove();
    if (call) done();
  };
  const skip = (e: Event): void => { e.preventDefault(); e.stopPropagation(); finish(true); };
  const timer = window.setTimeout(() => finish(true), reduced ? 500 : SEAL_TOTAL_MS);
  el.addEventListener('pointerdown', skip);
  window.addEventListener('keydown', skip, true);
  return () => finish(false);
}
