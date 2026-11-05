// Sheet stack: bottom sheet in portrait, side sheet in landscape / >= 720 px (src/ui/layout.ts).
// Closes with: close button, swipe down (or sideways on side sheets), Escape, Android back
// (history entry per open sheet), tap on the empty map (handled by the app).
import { h, isRtl } from './dom';
import { iconSvg } from './icons';
import { t } from '../i18n/index';

export interface SheetContent {
  /** Stable identity, e.g. 'b:12', 'w:3', 'settings'. Re-opening the same key refreshes in place. */
  key: string;
  /** Called ~4x a second while open; return false to close (subject vanished). */
  update(sheet: Sheet): boolean;
  onClose?(): void;
  /** When another content replaces this one inside the same sheet (pause menu -> settings),
   *  run onClose only when the sheet itself finally closes. Default: run it on replace. */
  closeWithSheet?: boolean;
}

export interface Sheet {
  el: HTMLElement;
  icon: HTMLElement;
  kicker: HTMLElement;
  title: HTMLElement;
  body: HTMLElement;
  content: SheetContent;
  /** onClose callbacks of replaced contents that asked to wait for the sheet (closeWithSheet). */
  deferred: (() => void)[];
  /** The element focused before the sheet opened; focus returns there on close (a11y). */
  returnFocus?: HTMLElement | null;
}

let sheetSeq = 0;

/** Height of the sheet's docked fix ("Naprawa", D-100) plus its fade, as --dock-h on the body: the body's
 *  scroll-padding keeps focused and scrolled-to content above it. Only written when it changes. */
function syncDock(sheet: Sheet): void {
  const dock = sheet.body.querySelector<HTMLElement>('.fix-dock');
  const hgt = dock ? `${dock.offsetHeight + 14}px` : '';
  if (sheet.body.style.getPropertyValue('--dock-h') !== hgt) {
    if (hgt) sheet.body.style.setProperty('--dock-h', hgt);
    else sheet.body.style.removeProperty('--dock-h');
  }
}

/** The docked fix's fade above it (px): content scrolled into it reads as going under the dock. */
const DOCK_FADE = 14;

/**
 * Scroll a sheet body by the least amount that puts `el` above the docked fix and its fade (block: nearest),
 * never pushing its top above the body's top. No-op without a dock or when `el` already clears it.
 */
export function revealAboveDock(body: HTMLElement, el: HTMLElement): void {
  const dock = body.querySelector<HTMLElement>('.fix-dock');
  if (!dock || dock.contains(el)) return;
  const r = el.getBoundingClientRect(), d = dock.getBoundingClientRect(), b = body.getBoundingClientRect();
  if (r.bottom > d.top - DOCK_FADE) body.scrollTop += Math.min(r.bottom - (d.top - DOCK_FADE), Math.max(0, r.top - b.top));
}

/**
 * The root of the sheet's cause chain stands above the docked fix when a subject is shown (D-146): on a short
 * landscape side sheet the dock leaves ~60 px of body, and the chain's root — the reason the fix answers — used
 * to sit under it while the subject row (already named by the title) took the space.
 */
function revealRoot(sheet: Sheet): void {
  const reveal = (): void => {
    const root = sheet.body.querySelector<HTMLElement>('.chain > li:last-child');
    if (root) revealAboveDock(sheet.body, root);
  };
  reveal();
  // once more after two frames: a sheet opened while the screen's layout classes or the dock were still settling
  // (a start with ?open=, a rotation) measured a different body; the player's own scroll in between wins
  const at = sheet.body.scrollTop;
  requestAnimationFrame(() => requestAnimationFrame(() => { if (sheet.body.isConnected && sheet.body.scrollTop === at) reveal(); }));
}

export class Sheets {
  private stack: Sheet[] = [];
  private suppressPop = 0;
  private gestureCancels = new WeakMap<Sheet, () => void>();
  /** Removes the window-level swipe listeners of a sheet once it is closed. */
  private detachers = new WeakMap<Sheet, () => void>();
  onChange: (() => void) | null = null;

  constructor(private host: HTMLElement) {
    window.addEventListener('popstate', () => {
      if (this.suppressPop > 0) { this.suppressPop--; return; }
      this.closeTop(true);
    });
  }

  get top(): Sheet | null {
    return this.stack[this.stack.length - 1] ?? null;
  }

  get count(): number {
    return this.stack.length;
  }

  /** Open (or replace the top sheet with) new content. Only one sheet is visible at a time. */
  open(content: SheetContent): Sheet {
    const sheet = this.place(content);
    // frame style hook (D-43): 'building', 'wagon', 'market' get the bright frame, menus the dim one
    sheet.el.dataset.kind = content.key.split(':')[0];
    return sheet;
  }

  private place(content: SheetContent): Sheet {
    const top = this.top;
    if (top && top.content.key === content.key) {
      top.content = content;
      content.update(top);
      syncDock(top);
      return top;
    }
    if (top) {
      // replace: links in the chain navigate within one sheet; back/escape still closes it
      const prev = top.content;
      if (prev.closeWithSheet) { if (prev.onClose) top.deferred.push(() => prev.onClose?.()); }
      else prev.onClose?.();
      top.content = content;
      top.body.scrollTop = 0;
      top.body.innerHTML = '';
      (top.body as HTMLElement & { __html?: string }).__html = undefined;
      content.update(top);
      syncDock(top);
      revealRoot(top);
      return top;
    }
    const sheet = this.build(content);
    sheet.returnFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    this.stack.push(sheet);
    // the entry state before the first style resolution: syncDock (and some updates) read layout, which used to
    // resolve the sheet at full opacity first, so it dipped out and back in instead of fading up (day 9c, N5)
    sheet.el.classList.add('is-entering');
    this.host.append(sheet.el);
    content.update(sheet);
    syncDock(sheet);
    revealRoot(sheet);
    requestAnimationFrame(() => requestAnimationFrame(() => sheet.el.classList.remove('is-entering')));
    try { history.pushState({ marchiaSheet: this.stack.length }, ''); } catch { /* sandboxed */ }
    // keyboard and screen-reader focus into the sheet (the dialog itself: announced by its title, no ring on the
    // close button for touch players; Tab reaches the close button next)
    requestAnimationFrame(() => sheet.el.focus({ preventScroll: true }));
    this.onChange?.();
    return sheet;
  }

  closeTop(fromPop = false): boolean {
    const s = this.stack.pop();
    if (!s) return false;
    if (!fromPop) {
      this.suppressPop++;
      try { history.back(); } catch { this.suppressPop--; }
    }
    s.content.onClose?.();
    for (const f of s.deferred.splice(0)) f();
    this.detachers.get(s)?.();
    s.el.classList.add('is-leaving');
    window.setTimeout(() => s.el.remove(), 240);
    // onChange first: it drops body.has-sheet, which hides the rail in portrait — focus() on the worst-stall eye
    // or a rail button that is still visibility:hidden silently fails and focus stayed in the closing sheet
    this.onChange?.();
    // focus back to what opened the sheet (a bubble, a card link, a rail button) if it is still there
    if (s.el.contains(document.activeElement)) {
      const back = s.returnFocus && s.returnFocus.isConnected ? s.returnFocus : null;
      if (back) back.focus({ preventScroll: true });
      if (!back || document.activeElement !== back) (document.activeElement as HTMLElement).blur();
    }
    return true;
  }

  closeAll(): void {
    while (this.stack.length) this.closeTop();
  }

  update(): void {
    for (const s of [...this.stack]) {
      const alive = s.content.update(s);
      syncDock(s);
      if (!alive) {
        const i = this.stack.indexOf(s);
        if (i === this.stack.length - 1) this.closeTop();
      }
    }
  }

  /** Screen changed shape (fold/unfold, rotation): drop drags, snap sheets to their new dock
   *  without animating across the screen. The dock itself (bottom vs side) is pure CSS. */
  relayout(): void {
    for (const s of this.stack) {
      this.gestureCancels.get(s)?.();
      s.el.classList.remove('is-dragging', 'is-entering');
      s.el.style.transform = '';
    }
  }

  private build(content: SheetContent): Sheet {
    const icon = h('div.sh-icon');
    const kicker = h('div.kicker');
    const title = h('h3', { id: `sheet-title-${++sheetSeq}` });
    const close = h('button.close', { 'aria-label': t('sheet.close'), html: iconSvg('close', 22) });
    const head = h('div.sheet-head', null, icon, h('div.sh-text', null, kicker, title), close);
    const body = h('div.sheet-body');
    const grip = h('div.sheet-grip');
    const inner = h('div.sp-in', null, grip, head, body);
    // a NON-modal dialog (a11y audit 2026-11-04, F3a; D-118): the map, the pins and the HUD keep working beside a
    // game sheet, so it must not claim aria-modal (screen readers would hide what keyboard focus still reaches).
    // Named by its title; focus moves in on open and back on close; Tab walks on into the page, no trap.
    const el = h('section.sheet', { role: 'dialog', 'aria-labelledby': title.id, tabindex: '-1' }, h('div.sheet-paper', null, inner));
    const sheet: Sheet = { el, icon, kicker, title, body, content, deferred: [] };
    close.addEventListener('click', () => {
      if (this.top === sheet) this.closeTop();
    });
    this.swipeToClose(sheet, grip, head, body);
    // a focused control never hides under the docked "Naprawa" (D-100; a11y audit F1, WCAG 2.4.11): the body's
    // scroll-padding (--dock-h, syncDock) steers focus scrolling, and this catches what the browser left under it
    body.addEventListener('focusin', (e) => {
      const el = e.target as HTMLElement;
      requestAnimationFrame(() => revealAboveDock(body, el));
    });
    return sheet;
  }

  private swipeToClose(sheet: Sheet, ...zones: HTMLElement[]): void {
    let start: { x: number; y: number; t: number; id: number; fromBody: boolean } | null = null;
    let d = 0;
    const side = (): boolean => document.body.classList.contains('is-side');
    const sideSign = (): number => {
      // side sheets dock at the inline end (D-55: in a landscape game too, opposite the contract); RTL mirrors it
      return isRtl() ? -1 : 1;
    };
    for (const z of zones) {
      z.addEventListener('pointerdown', (e) => {
        if ((e.target as HTMLElement).closest('input, select, textarea')) return; // sliders drag sideways
        const fromBody = z === sheet.body;
        if (fromBody && sheet.body.scrollTop > 0) return;
        start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, fromBody };
        d = 0;
      });
    }
    const move = (e: PointerEvent): void => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      let along = side() ? dx * sideSign() : dy;
      const across = side() ? Math.abs(dy) : Math.abs(dx);
      if (d === 0 && (along < 6 || across > along)) {
        if (Math.abs(across) > 12 || along < -6) start = null;
        return;
      }
      if (start.fromBody && sheet.body.scrollTop > 0) { start = null; return; }
      along = Math.max(0, along);
      d = along;
      sheet.el.classList.add('is-dragging');
      sheet.el.style.transform = side() ? `translateX(${along * sideSign()}px)` : `translateY(${along}px)`;
    };
    const end = (e: PointerEvent): void => {
      if (!start || e.pointerId !== start.id) return;
      const v = d / Math.max(1, performance.now() - start.t);
      start = null;
      sheet.el.classList.remove('is-dragging');
      if ((d > 90 || (d > 30 && v > 0.5)) && this.top === sheet) {
        this.closeTop(); // keeps the dragged offset, fades out from there
      } else {
        sheet.el.style.transform = '';
      }
      d = 0;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    this.detachers.set(sheet, () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    });
    this.gestureCancels.set(sheet, () => { start = null; d = 0; });
  }
}
