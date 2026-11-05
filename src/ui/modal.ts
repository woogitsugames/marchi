// Letters (opening, dead end, end of contract) are real modals (a11y audit 2026-11-04, F3b/F4): while one is
// open, everything else in the UI and the scene canvas is `inert` — keyboard, switch access and screen readers
// cannot wander into the HUD under the scrim. Focus goes to the letter's first action and returns to where it
// came from when the letter goes. Game sheets are NOT modal (the map and HUD keep working beside them).

interface Held {
  scrim: HTMLElement;
  returnFocus: HTMLElement | null;
  observer: MutationObserver;
}

const held: Held[] = [];
/** Elements this module made inert (others that were inert before are left alone). */
const madeInert = new Set<HTMLElement>();

function siblingsToHold(layer: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  // every layer of #ui except the one holding the letter, the scene canvas, and body-level controls
  // (the clear-screen restore button) outside the app root
  for (let el: HTMLElement | null = layer; el && el !== document.body; el = el.parentElement) {
    const parent: HTMLElement | null = el.parentElement;
    if (!parent) break;
    for (const sib of parent.children) {
      if (sib !== el && sib instanceof HTMLElement && !(sib instanceof HTMLScriptElement)) out.push(sib);
    }
  }
  return out;
}

function release(h: Held): void {
  const i = held.indexOf(h);
  if (i < 0) return;
  held.splice(i, 1);
  h.observer.disconnect();
  if (held.length) return; // another letter still holds the screen
  for (const el of madeInert) el.inert = false;
  madeInert.clear();
  const back = h.returnFocus;
  if (back && back.isConnected && (document.activeElement === document.body || document.activeElement === null)) {
    back.focus({ preventScroll: true });
  }
}

/**
 * Append `scrim` (a letter in its scrim) to `layer` as a modal: the rest of the page goes inert, focus moves to
 * the first element matching `focusSel` inside it. The hold ends by itself when the scrim leaves the page or
 * starts its exit (`is-out`), so every closing path (buttons, Escape, a tap, back to the menu) is covered.
 */
export function showModal(layer: HTMLElement, scrim: HTMLElement, focusSel: string): void {
  const active = document.activeElement;
  const h: Held = {
    scrim,
    returnFocus: active instanceof HTMLElement && active !== document.body && !scrim.contains(active) ? active : null,
    observer: new MutationObserver(() => {
      if (!scrim.isConnected || scrim.classList.contains('is-out')) release(h);
    }),
  };
  layer.append(scrim);
  for (const el of siblingsToHold(layer)) {
    if (el.inert) continue;
    el.inert = true;
    madeInert.add(el);
  }
  held.push(h);
  h.observer.observe(layer, { childList: true });
  h.observer.observe(scrim, { attributes: true, attributeFilter: ['class'] });
  // the focused element is inert now: move into the letter at once and again after layout (fonts, clip-path)
  // ...and bring it into view inside the scrolling scrim: on a short screen the letter's buttons can sit below
  // the fold (Flip 360x380, D-140), and a focus nobody can see is no focus
  const focus = (): void => {
    const el = scrim.querySelector<HTMLElement>(focusSel);
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
  };
  focus();
  requestAnimationFrame(focus);
}

/** True while a letter holds the screen (keyboard shortcuts stay off). */
export function modalOpen(): boolean {
  return held.length > 0;
}
