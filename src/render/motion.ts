// prefers-reduced-motion for the renderer (a11y audit 2026-11-04 F14, D-124): CSS and the seal press already honour
// it; the camera's focus glides, the menu's slow sway and the pulsing "bad draft" overlay did not. One shared
// MediaQueryList, read every frame for the price of a property access.
let mq: MediaQueryList | null = null;
try { mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null; } catch { mq = null; }

/** True when the player asked the system for less motion. */
export function reducedMotion(): boolean {
  return mq?.matches === true;
}
