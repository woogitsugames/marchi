// Markers that live in the scene: stall bubbles above buildings (and stuck wagons),
// the ochre ETA tag beside the selected wagon, and the road-draft label near the finger.
// Positions come from view.anchorOf every frame; DOM nodes are pooled, only transforms change.
import { outputCustomer, seasonalSupplier, wagonEta, type Building, type World } from '../sim/index';
import type { WorldView } from '../render/api';
import { h, setText } from './dom';
import { buildingStatusIcon, clock, iceWaitSec, isCritical, isStall, isWagonWait, wagonStatusIcon } from './format';
import { iconSvg } from './icons';

const MIN_STALL_TICKS = 20; // 2 s: avoid flicker on short hiccups

/**
 * A stall that resolves by itself (output waits for a customer that still takes it, input slowed by
 * the season): a minor bubble, never the critical one. outputCustomer runs a path search, so the
 * answer is kept per building until its status, the road network or the second changes.
 */
const calmCache = new Map<number, { key: string; calm: boolean }>();
function calmStall(world: World, b: Building, sig: string): boolean {
  const key = `${sig}|${world.state.netVersion}|${world.state.buildings.length}|${Math.floor(world.state.tick / 10)}`;
  const c = calmCache.get(b.id);
  if (c && c.key === key) return c.calm;
  const calm = outputCustomer(world, b.id) >= 0 || seasonalSupplier(world, b.id) !== null;
  calmCache.set(b.id, { key, calm });
  return calm;
}
/** "Stall fixed" wax stamp: pressed in (120 ms), held, then faded (220 ms). No bounce. */
const STAMP_HOLD_MS = 650;
const STAMP_FADE_MS = 220;

interface Stamp { el: HTMLElement; id: number; bornAt: number; out: boolean }

interface Bubble { el: HTMLElement; icon: HTMLElement; key: string; sig: string; used: boolean; shownAt: number }

export class Markers {
  readonly root: HTMLElement;
  private pool: Bubble[] = [];
  private byKey = new Map<string, Bubble>();
  private eta: HTMLElement;
  private etaText: HTMLElement;
  private draft: HTMLElement;
  private draftMain: HTMLElement;
  private draftSub: HTMLElement;
  onBubble: ((kind: 'building' | 'wagon', id: number) => void) | null = null;
  /** A building's stall bubble went away because it is WORKING again. */
  onFixed: ((buildingId: number) => void) | null = null;
  /** Buildings with a stall bubble on screen in the previous frame. */
  private shownStalls = new Set<number>();
  private stamps: Stamp[] = [];

  constructor() {
    this.etaText = h('span.num');
    this.eta = h('div.eta-tag', null, h('span', { html: iconSvg('waiting', 16) }), this.etaText);
    this.draftMain = h('span');
    this.draftSub = h('span.dt-sub');
    this.draft = h('div.draft-tag.cf.parch', { role: 'status' }, this.draftMain, this.draftSub);
    const draftWrap = h('div.float', null, this.draft);
    this.root = h('div', null, this.eta, draftWrap);
  }

  private take(key: string): Bubble {
    let b = this.byKey.get(key);
    if (b) { b.used = true; return b; }
    b = this.pool.find((p) => !p.used && !this.byKey.has(p.key));
    if (!b) {
      const icon = h('div.bb-in');
      const el = h('button.bubble.hit', null, h('div.bb', null, icon));
      el.addEventListener('click', () => {
        const k = el.dataset.k ?? '';
        const [kind, id] = k.split(':');
        this.onBubble?.(kind as 'building' | 'wagon', Number(id));
      });
      b = { el, icon, key: '', sig: '', used: true, shownAt: 0 };
      this.pool.push(b);
      this.root.append(el);
    }
    b.key = key;
    b.sig = '';
    b.used = true;
    b.el.dataset.k = key;
    this.byKey.set(key, b);
    b.el.classList.remove('is-shown', 'breathe');
    return b;
  }

  update(world: World, view: WorldView, selectedWagon: number | null, hidden: boolean): void {
    for (const b of this.pool) b.used = false;
    const shown = new Set<number>();
    if (!hidden) {
      for (const bd of world.state.buildings) {
        if (!isStall(bd.status) && bd.status.k !== 'NO_INPUT') continue;
        if (bd.stalledTicks < MIN_STALL_TICKS) continue;
        const a = view.anchorOf('building', bd.id);
        if (!a.visible) continue;
        const st = JSON.stringify(bd.status);
        const calm = calmStall(world, bd, st);
        const crit = isCritical(bd.status, bd.stalledTicks, calm);
        const sig = st + crit + calm;
        const b = this.take('building:' + bd.id);
        shown.add(bd.id);
        b.el.classList.toggle('is-minor', bd.status.k === 'WAITING_PICKUP' || calm);
        this.place(b, a.x, a.y, sig, () => buildingStatusIcon(bd.status, 26, bd.type), crit, false);
      }
      for (const w of world.state.wagons) {
        if (!isWagonWait(w.status)) continue;
        const a = view.anchorOf('wagon', w.id);
        if (!a.visible) continue;
        const crit = w.status.k === 'NO_ROUTE';
        this.place(this.take('wagon:' + w.id), a.x, a.y, w.status.k + crit, () => wagonStatusIcon(w.status, 26), crit, true);
      }
    }
    for (const b of this.pool) {
      if (!b.used && b.key) {
        this.byKey.delete(b.key);
        b.key = '';
        b.el.classList.remove('is-shown');
        b.el.style.visibility = 'hidden';
      }
    }

    // stall fixed: the bubble left because the building resumed WORKING -> a quiet wax stamp in its place
    const now = performance.now();
    if (!hidden) {
      for (const id of this.shownStalls) {
        if (shown.has(id)) continue;
        const bd = world.state.buildings.find((q) => q.id === id);
        if (bd && bd.status.k === 'WORKING' && view.anchorOf('building', id).visible) this.stamp(id, now);
      }
    }
    this.shownStalls = shown;
    for (const st of [...this.stamps]) {
      const age = now - st.bornAt;
      const a = view.anchorOf('building', st.id);
      if (age > STAMP_HOLD_MS + STAMP_FADE_MS + 40 || !a.visible || hidden) {
        st.el.remove();
        this.stamps.splice(this.stamps.indexOf(st), 1);
        continue;
      }
      if (!st.out && age > STAMP_HOLD_MS) { st.out = true; st.el.classList.add('is-out'); }
      st.el.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`;
    }

    // ETA tag beside the selected wagon
    let etaOn = false;
    if (selectedWagon !== null && !hidden) {
      const w = world.state.wagons.find((q) => q.id === selectedWagon);
      const a = w ? view.anchorOf('wagon', w.id) : null;
      if (w && a && a.visible && w.status.k !== 'IDLE') {
        const e = wagonEta(world, w.id);
        if (e) {
          etaOn = true;
          setText(this.etaText, clock(e.toDest + iceWaitSec(world, w.status)));
          this.eta.style.transform = `translate3d(${(a.x + 14).toFixed(1)}px, ${(a.y - 4).toFixed(1)}px, 0)`;
        }
      }
    }
    this.eta.classList.toggle('is-shown', etaOn);
  }

  private place(b: Bubble, x: number, y: number, sig: string, icon: () => string, crit: boolean, wagon: boolean): void {
    if (b.sig !== sig) {
      const first = b.sig === '';
      b.sig = sig;
      b.icon.innerHTML = icon();
      b.el.classList.toggle('is-critical', crit);
      b.el.classList.toggle('is-wagon', wagon);
      if (first) {
        b.el.style.visibility = '';
        requestAnimationFrame(() => b.el.classList.add('is-shown', 'breathe'));
      }
    }
    b.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  private stamp(id: number, now: number): void {
    if (this.stamps.some((s) => s.id === id)) return;
    const el = h('div.fix-stamp', { 'aria-hidden': 'true' }, h('div.fs-in', { html: iconSvg('seal', 30) }));
    this.root.append(el);
    this.stamps.push({ el, id, bornAt: now, out: false });
    requestAnimationFrame(() => el.classList.add('is-in'));
    this.onFixed?.(id);
  }

  /** Road draft label near the finger: main line + sub line, bad = clay. */
  setDraft(x: number, y: number, main: string, sub: string, bad: boolean): void {
    this.draft.classList.add('is-shown');
    this.draft.classList.toggle('is-bad', bad);
    setText(this.draftMain, main);
    setText(this.draftSub, sub);
    // above the finger, clamped into the viewport
    const w = this.draft.offsetWidth || 200, hh = this.draft.offsetHeight || 40;
    const px = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2));
    const py = Math.max(8, y - hh - 64);
    this.draft.style.transform = `translate3d(${px.toFixed(0)}px, ${py.toFixed(0)}px, 0)`;
  }

  clearDraft(): void {
    this.draft.classList.remove('is-shown');
  }

  reset(): void {
    for (const b of this.pool) { b.el.remove(); }
    this.pool = [];
    for (const st of this.stamps) st.el.remove();
    this.stamps = [];
    this.shownStalls.clear();
    this.byKey.clear();
    this.clearDraft();
    this.eta.classList.remove('is-shown');
  }
}
