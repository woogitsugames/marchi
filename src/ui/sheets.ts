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
    const top = this.top;
    if (top && top.content.key === content.key) {
      top.content = content;
      content.update(top);
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
      return top;
    }
    const sheet = this.build(content);
    this.stack.push(sheet);
    this.host.append(sheet.el);
    content.update(sheet);
    sheet.el.classList.add('is-entering');
    requestAnimationFrame(() => requestAnimationFrame(() => sheet.el.classList.remove('is-entering')));
    try { history.pushState({ marchiaSheet: this.stack.length }, ''); } catch { /* sandboxed */ }
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
    this.onChange?.();
    return true;
  }

  closeAll(): void {
    while (this.stack.length) this.closeTop();
  }

  update(): void {
    for (const s of [...this.stack]) {
      if (!s.content.update(s)) {
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
    const title = h('h3');
    const close = h('button.close', { 'aria-label': t('sheet.close'), html: iconSvg('close', 22) });
    const head = h('div.sheet-head', null, icon, h('div.sh-text', null, kicker, title), close);
    const body = h('div.sheet-body');
    const grip = h('div.sheet-grip');
    const inner = h('div.sp-in', null, grip, head, body);
    const el = h('section.sheet', { role: 'dialog' }, h('div.sheet-paper', null, inner));
    const sheet: Sheet = { el, icon, kicker, title, body, content, deferred: [] };
    close.addEventListener('click', () => {
      if (this.top === sheet) this.closeTop();
    });
    this.swipeToClose(sheet, grip, head, body);
    return sheet;
  }

  private swipeToClose(sheet: Sheet, ...zones: HTMLElement[]): void {
    let start: { x: number; y: number; t: number; id: number; fromBody: boolean } | null = null;
    let d = 0;
    const side = (): boolean => document.body.classList.contains('is-side');
    const sideSign = (): number => {
      const b = document.body.classList;
      // side sheets dock at the inline start (game) or end (menu); RTL mirrors which way that is
      const rtl = isRtl() ? -1 : 1;
      if (!b.contains('is-landscape') || b.contains('mode-menu')) return rtl;
      return (b.contains('left-handed') ? 1 : -1) * rtl;
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
