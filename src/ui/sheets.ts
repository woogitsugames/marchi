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
  /** The help topic of this card's "?" when it differs from its kind's topic (the map below): a castle holding one of
   *  two castle orders opens "Several castles" (D-344). Read when the sheet opens and when "?" is pressed. */
  helpTopic?(): string | undefined;
  /** Where keyboard and screen-reader focus lands when this content opens, instead of the sheet itself: help opened
   *  from a card's "?" focuses the asked topic's heading (D-355). Read once, after the sheet is laid out. */
  initialFocus?(sheet: Sheet): HTMLElement | null;
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
  /** The root reveal of the last open/replace (D-146) and until when the periodic update repeats it. */
  reveal?: () => void;
  revealUntil?: number;
}

let sheetSeq = 0;

/** The help topic (src/ui/help.ts) a game card's "?" opens (D-254); other sheets (menus, help itself) have none. */
export const HELP_TOPIC_OF_KIND: Readonly<Record<string, string>> = {
  building: 'cause',
  wagon: 'wagons',
  market: 'valley',
};

/** Height of the sheet's docked fix ("Naprawa", D-100) plus its fade, as --dock-h on the body: the body's
 *  scroll-padding keeps focused and scrolled-to content above it. Only written when it changes. */
function writeDock(body: HTMLElement, px: number | null): void {
  const hgt = px === null ? '' : `${px + 14}px`;
  if (body.style.getPropertyValue('--dock-h') !== hgt) {
    if (hgt) body.style.setProperty('--dock-h', hgt);
    else body.style.removeProperty('--dock-h');
  }
}

/**
 * The dock each sheet body last showed, observed for size (D-157): the periodic sheet update used to read the
 * dock's offsetHeight right after the HUD and the sheet content had written the DOM, a forced synchronous layout
 * every 250 ms. A ResizeObserver reports the height after the browser's own layout (and before paint, so the
 * --dock-h write still lands in the same frame); the read happens only when the dock appears or changes size.
 */
const docks = new WeakMap<HTMLElement, HTMLElement>();
let dockObserver: ResizeObserver | null | undefined;
function observer(): ResizeObserver | null {
  if (dockObserver === undefined) {
    try {
      dockObserver = new ResizeObserver((entries) => {
        for (const e of entries) {
          const dock = e.target as HTMLElement;
          const body = dock.parentElement?.closest<HTMLElement>('.sheet-body') ?? null;
          if (!body || docks.get(body) !== dock) continue;
          const box = e.borderBoxSize?.[0];
          writeDock(body, box ? Math.round(box.blockSize) : dock.offsetHeight);
        }
      });
    } catch { dockObserver = null; /* old WebView: measure in place */ }
  }
  return dockObserver;
}

/** `measure`: read the height now (opening / replacing a sheet, once); otherwise the observer keeps it. */
function syncDock(sheet: Sheet, measure = false): void {
  const body = sheet.body;
  const dock = body.querySelector<HTMLElement>('.fix-dock');
  const ro = observer();
  const prev = docks.get(body);
  if (prev !== dock) {
    if (prev) ro?.unobserve(prev);
    if (dock) { docks.set(body, dock); ro?.observe(dock); } else docks.delete(body);
  }
  if (!dock) writeDock(body, null);
  else if (measure || !ro) writeDock(body, dock.offsetHeight);
}

/** A closed sheet's dock leaves the observer (it would report the detached element once more). */
function dropDock(sheet: Sheet): void {
  const dock = docks.get(sheet.body);
  if (dock) { dockObserver?.unobserve(dock); docks.delete(sheet.body); }
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
  // `at`: the scroll position the last reveal left; a later pass runs only while the player has not scrolled
  let at = -1;
  const reveal = (): void => {
    if (!sheet.body.isConnected || (at >= 0 && sheet.body.scrollTop !== at)) return;
    const root = sheet.body.querySelector<HTMLElement>('.chain > li:last-child');
    if (root) revealAboveDock(sheet.body, root);
    at = sheet.body.scrollTop;
  };
  reveal();
  // once more after two frames: a sheet opened while the screen's layout classes or the dock were still settling
  // (a start with ?open=, a rotation) measured a different body; the player's own scroll in between wins
  requestAnimationFrame(() => requestAnimationFrame(reveal));
  // and once the fonts are in: a Cyrillic or extended-Latin subset (unicode-range) loads on first use and can
  // rewrap the dock's note and the lead lines after those two frames (m16 castle card, 360 x 740 ru / pseudo)
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts && fonts.status !== 'loaded') void fonts.ready.then(() => requestAnimationFrame(reveal));
  // and on the periodic updates of the first 2 s: a sheet opened from a start link (?openId=, a fast-forward) can get
  // its lead lines on the next refresh, after the two frames (m16 castle card, 360 x 740: root 19 px under the dock)
  // Scroll anchoring stays off meanwhile: a refresh that rewrote a line above the anchor moved the body back by
  // 33 px after the reveal, which the next pass then took for the player's own scroll.
  sheet.reveal = reveal;
  sheet.revealUntil = performance.now() + 2000;
  sheet.body.classList.add('is-revealing');
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
    const kind = content.key.split(':')[0];
    sheet.el.dataset.kind = kind;
    // help from the map (D-254): the game's own cards carry a "?" into the help sheet on their topic
    const topic = this.onHelp ? content.helpTopic?.() ?? HELP_TOPIC_OF_KIND[kind] : undefined;
    const help = sheet.el.querySelector<HTMLElement>('.sh-help');
    if (help) help.hidden = !topic;
    // after the new sheet's own focus (one frame) and the content's first scroll: the second frame
    if (content.initialFocus) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (sheet.content !== content || !this.stack.includes(sheet)) return;
        content.initialFocus?.(sheet)?.focus({ preventScroll: true });
      }));
    }
    return sheet;
  }

  /** Opens the help sheet on a topic (set by the app; without it no card shows "?"). */
  onHelp?: (topic: string) => void;

  private place(content: SheetContent): Sheet {
    const top = this.top;
    if (top && top.content.key === content.key) {
      top.content = content;
      content.update(top);
      syncDock(top, true);
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
      // a calm kicker (D-193) belongs to the building sheet that set it
      top.kicker.classList.remove('is-calm');
      content.update(top);
      syncDock(top, true);
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
    syncDock(sheet, true);
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
    dropDock(s);
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
      if (s.reveal && s.revealUntil !== undefined) {
        if (performance.now() < s.revealUntil) s.reveal();
        else { s.reveal = undefined; s.revealUntil = undefined; s.body.classList.remove('is-revealing'); }
      }
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
    const help = h('button.sh-help', { 'aria-label': t('menu.help'), hidden: true }, '?');
    const head = h('div.sheet-head', null, icon, h('div.sh-text', null, kicker, title), help, close);
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
    help.addEventListener('click', () => {
      const topic = sheet.content.helpTopic?.() ?? HELP_TOPIC_OF_KIND[sheet.el.dataset.kind ?? ''];
      if (this.top === sheet && topic) this.onHelp?.(topic);
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
