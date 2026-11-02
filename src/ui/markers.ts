// Markers that live in the scene: stall pins above buildings (and stuck wagons; kit sprites, red =
// the worst or a critical stall, brass = a lesser one), the slate ETA plaque beside the selected wagon, and the road-draft label near the finger.
// Positions come from view.anchorOf every frame; DOM nodes are pooled, only transforms change.
import { TICK_HZ, wagonEta, type World } from '../sim/index';
import type { WorldView } from '../render/api';
import { h, setText } from './dom';
import { buildingName, buildingStatusIcon, buildingStatusText, clock, iceWaitSec, isCritical, isStall, isWagonWait, wagonName, wagonStatusIcon, wagonStatusText } from './format';
import { iconSvg } from './icons';
import { MIN_STALL_TICKS, calmStall } from './stalls';

/** "Stall fixed" wax stamp: pressed in (120 ms), held, then faded (220 ms). No bounce. */
const STAMP_HOLD_MS = 650;
const STAMP_FADE_MS = 220;
/** A stall pin shows its running time from 20 s on. */
const PIN_TIME_TICKS = 20 * TICK_HZ;

interface Stamp { el: HTMLElement; id: number; bornAt: number; out: boolean }

interface Bubble { el: HTMLElement; icon: HTMLElement; time: HTMLElement; secs: number; key: string; sig: string; used: boolean; shownAt: number }

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
  /** Per building: the last status seen and what was derived from it (sig strings reused between frames). */
  private pinCache = new Map<number, { status: object; ticks: number; st: string; calm: boolean; crit: boolean; sig0: string; sig1: string }>();

  constructor() {
    this.etaText = h('span.num');
    this.eta = h('div.eta-tag', null, h('span.eta-ic', { html: iconSvg('wagon', 18) }), this.etaText);
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
      const time = h('span.bb-t.num', { 'aria-hidden': 'true' });
      const el = h('button.bubble.hit', null, h('div.bb', null, icon), time);
      el.addEventListener('click', () => {
        const k = el.dataset.k ?? '';
        const [kind, id] = k.split(':');
        this.onBubble?.(kind as 'building' | 'wagon', Number(id));
      });
      b = { el, icon, time, secs: -1, key: '', sig: '', used: true, shownAt: 0 };
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

  /** worst: the building the HUD's worst-stall card names (always a red pin). */
  update(world: World, view: WorldView, selectedWagon: number | null, hidden: boolean, worst = -1): void {
    for (const b of this.pool) b.used = false;
    const shown = new Set<number>();
    if (!hidden) {
      for (const bd of world.state.buildings) {
        if (!isStall(bd.status) && bd.status.k !== 'NO_INPUT') continue;
        if (bd.stalledTicks < MIN_STALL_TICKS) continue;
        const a = view.anchorOf('building', bd.id);
        if (!a.visible) continue;
        // the status text and its calm/critical class change only with a tick: keep them per building while the
        // status object and stalledTicks are the same (no JSON.stringify per pin per frame, BACKLOG P2 / GC audit)
        let c = this.pinCache.get(bd.id);
        if (!c || c.status !== bd.status || c.ticks !== bd.stalledTicks) {
          const st = JSON.stringify(bd.status);
          const calm = calmStall(world, bd, st);
          const crit = isCritical(bd.status, bd.stalledTicks, calm);
          if (c && c.st === st && c.calm === calm && c.crit === crit) { c.status = bd.status; c.ticks = bd.stalledTicks; }
          else { c = { status: bd.status, ticks: bd.stalledTicks, st, calm, crit, sig0: st + crit + calm, sig1: st + crit + calm + true }; this.pinCache.set(bd.id, c); }
        }
        const { calm, crit } = c;
        const isWorst = bd.id === worst;
        const sig = isWorst ? c.sig1 : c.sig0;
        const b = this.take('building:' + bd.id);
        shown.add(bd.id);
        b.el.classList.toggle('is-minor', (bd.status.k === 'WAITING_PICKUP' || calm) && !isWorst);
        this.place(b, a.x, a.y, sig, () => buildingStatusIcon(bd.status, 24, bd.type), crit || isWorst, false,
          () => `${buildingName(world, bd.id)}: ${buildingStatusText(bd.status, world)}`);
        // how long it has stood, from 20 s on (BACKLOG P2): a pin that keeps counting is the one to read first
        this.setTime(b, bd.stalledTicks >= PIN_TIME_TICKS ? Math.floor(bd.stalledTicks / TICK_HZ) : -1);
      }
      for (const w of world.state.wagons) {
        if (!isWagonWait(w.status)) continue;
        const a = view.anchorOf('wagon', w.id);
        if (!a.visible) continue;
        const crit = w.status.k === 'NO_ROUTE';
        const wb = this.take('wagon:' + w.id);
        this.place(wb, a.x, a.y, w.status.k + crit, () => wagonStatusIcon(w.status, 24), crit, true,
          () => `${wagonName(world, w.id)}: ${wagonStatusText(world, w.status)}`);
        this.setTime(wb, -1);
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
          this.eta.style.transform = `translate3d(${a.x.toFixed(1)}px, ${(a.y - 10).toFixed(1)}px, 0) translate(-50%, -100%)`;
        }
      }
    }
    this.eta.classList.toggle('is-shown', etaOn);
  }

  private place(b: Bubble, x: number, y: number, sig: string, icon: () => string, crit: boolean, wagon: boolean, label: () => string): void {
    if (b.sig !== sig) {
      const first = b.sig === '';
      b.sig = sig;
      b.icon.innerHTML = icon();
      // the bubble's accessible name is the cause, e.g. "Piekarnia: brak dostępnych zapasów mąki"
      b.el.setAttribute('aria-label', label());
      b.el.classList.toggle('is-critical', crit);
      b.el.classList.toggle('is-wagon', wagon);
      if (first) {
        b.el.style.visibility = '';
        requestAnimationFrame(() => b.el.classList.add('is-shown', 'breathe'));
      }
    }
    b.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  /** Seconds stalled under the pin (-1: none); the text changes once a second at most. */
  private setTime(b: Bubble, secs: number): void {
    if (secs === b.secs) return;
    b.secs = secs;
    b.time.hidden = secs < 0;
    if (secs >= 0) setText(b.time, clock(secs));
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
    this.pinCache.clear();
    this.byKey.clear();
    this.clearDraft();
    this.eta.classList.remove('is-shown');
  }
}
