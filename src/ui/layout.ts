// Screen classes for phones, foldables (Fold cover / inner / Flex mode, Flip main / cover) and
// tablets, plus hinge detection. Three independent sources for a hinge, first one wins:
//   1. Viewport Segments API: window.viewport.segments (JS) or env(viewport-segment-*) (CSS,
//      mirrored into --env-hinge-* custom properties in main.css),
//   2. the native fallback: MainActivity (androidx.window FoldingFeature) dispatches
//      'marchia:fold' with the hinge rect in CSS px and keeps it in window.__marchiaFold,
//   3. nothing: a flat screen.
// The Device Posture API (navigator.devicePosture) only triggers a re-layout: 'folded' alone
// does not say where the hinge is (book and Flex mode both report it).

export type ScreenClass = 'mini' | 'narrow' | 'phone' | 'phone-land' | 'square' | 'tablet';

/** A separating fold, in CSS px of the layout viewport. */
export interface Hinge {
  orientation: 'horizontal' | 'vertical';
  /** top (horizontal) or left (vertical) edge of the hinge band */
  start: number;
  /** bottom / right edge; equal to start for a zero-width fold */
  end: number;
  source: 'segments' | 'css' | 'native';
}

export interface LayoutInfo {
  w: number;
  h: number;
  dpr: number;
  cls: ScreenClass;
  /** rail on the right edge (short landscape phone screens) */
  landscape: boolean;
  /** sheets dock at the side instead of the bottom */
  side: boolean;
  /** tools bottom-left, speed bottom-right (near-square / wide portrait) */
  split: boolean;
  /** Flip cover screen and tiny windows: watch mode, no building tools */
  mini: boolean;
  /** horizontal hinge with room for scene above and HUD below (Flex / tabletop mode) */
  flex: Hinge | null;
  /** vertical hinge (half-opened book): sheets stay inside the right segment */
  book: Hinge | null;
  posture: string;
  /** height of the 3D scene (CSS px) — the top segment in Flex mode, otherwise h */
  sceneH: number;
}

/** What MainActivity sends (CSS px relative to the WebView). */
export interface NativeFold {
  state: 'FLAT' | 'HALF_OPENED' | string;
  orientation: 'HORIZONTAL' | 'VERTICAL' | string;
  separating?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Minimum height of each segment for the split scene/HUD layout to be worth it. */
const MIN_SEGMENT = 200;
/** Gutter kept clear on both sides of the hinge (the crease is hard to read and to tap). */
export const HINGE_GUTTER = 8;

interface SegmentsWindow {
  viewport?: { segments?: ReadonlyArray<{ x: number; y: number; width: number; height: number }> | null };
  __marchiaFold?: NativeFold | null;
}
interface PostureNavigator { devicePosture?: EventTarget & { type?: string } }

export function devicePosture(): EventTarget & { type?: string } | null {
  return (navigator as unknown as PostureNavigator).devicePosture ?? null;
}

function hingeFromSegments(): Hinge | null {
  let segs: ReadonlyArray<{ x: number; y: number; width: number; height: number }> | null | undefined;
  try { segs = (window as unknown as SegmentsWindow).viewport?.segments; } catch { segs = undefined; }
  if (!segs || segs.length !== 2) return null;
  const [a, b] = [segs[0]!, segs[1]!];
  if (Math.abs(a.x - b.x) < 2 && b.y >= a.y + a.height - 1) {
    return { orientation: 'horizontal', start: a.y + a.height, end: b.y, source: 'segments' };
  }
  if (Math.abs(a.y - b.y) < 2 && b.x >= a.x + a.width - 1) {
    return { orientation: 'vertical', start: a.x + a.width, end: b.x, source: 'segments' };
  }
  return null;
}

/** CSS route: main.css copies env(viewport-segment-*) into custom properties under the media queries. */
function hingeFromCss(): Hinge | null {
  const st = getComputedStyle(document.documentElement);
  const num = (n: string): number => parseFloat(st.getPropertyValue(n));
  const ht = num('--env-hinge-top'), hb = num('--env-hinge-bottom');
  if (Number.isFinite(ht) && Number.isFinite(hb) && ht > 0) return { orientation: 'horizontal', start: ht, end: hb, source: 'css' };
  const vl = num('--env-hinge-left'), vr = num('--env-hinge-right');
  if (Number.isFinite(vl) && Number.isFinite(vr) && vl > 0) return { orientation: 'vertical', start: vl, end: vr, source: 'css' };
  return null;
}

function hingeFromNative(): Hinge | null {
  const f = (window as unknown as SegmentsWindow).__marchiaFold;
  if (!f || f.state !== 'HALF_OPENED') return null;
  if (f.orientation === 'HORIZONTAL') return { orientation: 'horizontal', start: f.y, end: f.y + f.h, source: 'native' };
  if (f.orientation === 'VERTICAL') return { orientation: 'vertical', start: f.x, end: f.x + f.w, source: 'native' };
  return null;
}

export function detectHinge(): Hinge | null {
  return hingeFromSegments() ?? hingeFromCss() ?? hingeFromNative();
}

export function computeLayout(): LayoutInfo {
  const w = Math.max(1, Math.round(window.innerWidth));
  const h = Math.max(1, Math.round(window.innerHeight));
  const dpr = window.devicePixelRatio || 1;
  const hinge = detectHinge();
  const posture = devicePosture()?.type ?? 'continuous';
  let flex: Hinge | null = null, book: Hinge | null = null;
  if (hinge?.orientation === 'horizontal' && hinge.start >= MIN_SEGMENT && h - hinge.end >= MIN_SEGMENT) flex = hinge;
  else if (hinge?.orientation === 'vertical' && hinge.start > 0 && hinge.end < w) book = hinge;

  const short = Math.min(w, h), long = Math.max(w, h);
  const mini = !flex && short < 400 && long < 560;
  const landscape = !mini && !flex && w > h && h < 700;
  const split = !mini && !landscape && w >= 720;
  const side = !mini && (landscape || w >= 720);
  let cls: ScreenClass;
  if (mini) cls = 'mini';
  else if (landscape) cls = 'phone-land';
  else if (w < 400) cls = 'narrow';
  else if (w < 720) cls = 'phone';
  else if (long / short < 1.25) cls = 'square';
  else cls = 'tablet';
  return { w, h, dpr, cls, landscape, side, split, mini, flex, book, posture, sceneH: flex ? Math.round(flex.start) : h };
}

/** True when the change is big enough that in-flight gestures must not continue (fold/unfold, rotation). */
export function isAbrupt(a: LayoutInfo | null, b: LayoutInfo): boolean {
  if (!a) return false;
  return a.cls !== b.cls || a.dpr !== b.dpr || !!a.flex !== !!b.flex || !!a.book !== !!b.book ||
    Math.abs(a.w - b.w) > 40 || Math.abs(a.h - b.h) > 60 || a.sceneH !== b.sceneH;
}

/** Apply body classes and CSS custom properties for a layout. */
export function applyLayoutClasses(l: LayoutInfo): void {
  const b = document.body.classList;
  b.toggle('is-landscape', l.landscape);
  b.toggle('is-side', l.side);
  b.toggle('is-split', l.split);
  b.toggle('is-mini', l.mini);
  b.toggle('is-narrow', l.cls === 'narrow');
  b.toggle('is-flex', !!l.flex);
  b.toggle('is-book', !!l.book);
  // a side sheet with at most 500 px of height under it (landscape phones, the HUD half in Flex mode): the cause
  // chain folds its middle links so the root stays above the fix dock (D-111)
  b.toggle('is-short', l.side && l.h - (l.flex ? l.flex.end : 0) <= 500);
  document.body.dataset.screen = l.cls;
  const root = document.documentElement.style;
  if (l.flex) {
    root.setProperty('--hinge-top', `${Math.round(l.flex.start)}px`);
    root.setProperty('--hinge-bottom', `${Math.round(l.flex.end)}px`);
  } else {
    root.removeProperty('--hinge-top');
    root.removeProperty('--hinge-bottom');
  }
  if (l.book) {
    root.setProperty('--seg-right-w', `${Math.round(l.w - l.book.end)}px`);
    root.setProperty('--book-start', `${Math.round(l.book.start)}px`);
    root.setProperty('--book-end', `${Math.round(l.book.end)}px`);
  } else {
    root.removeProperty('--seg-right-w');
    root.removeProperty('--book-start');
    root.removeProperty('--book-end');
  }
  root.setProperty('--scene-h', `${l.sceneH}px`);
}

/**
 * Text scale of the page (a11y audit F2, D-120): Android's font size reaches the Capacitor WebView as textZoom,
 * which multiplies every computed font size; a browser's text zoom does the same. A hidden 16 px probe with
 * line-height 1 inside the UI root reports its real line box; `onChange` gets the ratio (1 = 100 %, 2 = 200 %)
 * on start and whenever it changes (ResizeObserver: no polling).
 */
export function watchTextScale(host: HTMLElement, onChange: (scale: number) => void): void {
  const probe = document.createElement('span');
  probe.className = 'text-probe';
  probe.setAttribute('aria-hidden', 'true');
  probe.textContent = 'M';
  host.append(probe);
  let last = 0;
  const check = (): void => {
    const s = Math.round((probe.getBoundingClientRect().height / 16) * 20) / 20;
    if (s > 0 && s !== last) { last = s; onChange(s); }
  };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(check).observe(probe);
  check();
}

/** Cheap fingerprint of the fold state, polled twice a second: some WebViews (and DevTools
 *  emulation) change viewport segments or posture without firing 'resize'. */
export function foldSignature(): string {
  let s = '';
  try {
    const segs = (window as unknown as SegmentsWindow).viewport?.segments;
    if (segs) for (const r of segs) s += `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)};`;
  } catch { /* ignore */ }
  return s + '|' + (devicePosture()?.type ?? '');
}
