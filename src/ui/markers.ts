// Markers that live in the scene: stall pins above buildings (and stuck wagons; kit sprites, red =
// the worst or a critical stall, brass = a lesser one), the slate ETA plaque beside the selected wagon, and the road-draft label near the finger.
// Positions come from view.anchorOf every frame; DOM nodes are pooled, only transforms change.
import { GOODS, TICK_HZ, wagonEta, type Good, type World } from '../sim/index';
import type { WorldView } from '../render/api';
import { h, setText } from './dom';
import { bdi, buildingName, buildingStateIcon, buildingStatusText, clock, fmtInt, goodName, iceWaitSec, isCritical, isStall, isWagonWait, wagonName, wagonStatusIcon, wagonStatusText } from './format';
import { iconSvg } from './icons';
import { t } from '../i18n/index';
import { MIN_STALL_TICKS, calmStall } from './stalls';

/** "Stall fixed" wax stamp: pressed in (120 ms), held, then faded (220 ms). No bounce. */
const STAMP_HOLD_MS = 650;
const STAMP_FADE_MS = 220;
/** A stall pin shows its running time from 20 s on. */
const PIN_TIME_TICKS = 20 * TICK_HZ;

interface Stamp { el: HTMLElement; id: number; bornAt: number; out: boolean }

/** Contract delivery over the castle (D-60): "+6" with the good's icon, rising a little, then faded. */
const DELIVERY_HOLD_MS = 1300;
const DELIVERY_FADE_MS = 220;
interface Delivery { el: HTMLElement; id: number; bornAt: number; out: boolean; row: number }

interface Rect { l: number; t: number; r: number; b: number }
/**
 * px / py / occ: the anchor last written and the occluder list it was tested against. A pin whose anchor is exactly
 * the same under the same occluders is not touched again (no style write, no style recalc; research 2026-11-04
 * "Poprawki" #6: the usual case is a still camera while the player reads a cause).
 */
/**
 * name: "<subject>: <cause>"; sev: how bad it reads (the worst-stall card's subject, a critical one, or lesser);
 * aria: the accessible name last written (name + severity + time stood, D-121), compared before every write.
 */
interface Bubble { el: HTMLElement; icon: HTMLElement; time: HTMLElement; secs: number; key: string; sig: string; used: boolean; shownAt: number; px: number; py: number; occ: readonly Rect[] | null; name: string; sev: PinSeverity; aria: string }
type PinSeverity = 'worst' | 'critical' | '';
/** The pin's accessible name follows its running time in 10 s steps: a screen reader on a focused pin is not
 *  told a new name every second (the visible tally keeps counting each second). */
const LABEL_STEP_SEC = 10;

function sameRects(a: readonly Rect[], b: readonly Rect[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p = a[i]!, q = b[i]!;
    if (p.l !== q.l || p.t !== q.t || p.r !== q.r || p.b !== q.b) return false;
  }
  return true;
}

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
  private deliveries: Delivery[] = [];
  /** "Diagnosis snapshot" (BACKLOG P3): the pin of the mission's first critical stall rings once, briefly. */
  private flashId = -1;
  private flashUntil = 0;
  /**
   * Screen rects (markers-root px) of the HUD pieces and the sheet that sit above the map. A pin under one of
   * them would only peek out from behind the panel and steal taps meant for it, so it fades out until the
   * camera moves it back into the open map (D-62). Refreshed by the app a few times a second.
   */
  get occluders(): readonly Rect[] { return this.occ; }
  /** Keeps the old list when the rects are the same, so unmoved pins can tell nothing changed. */
  set occluders(v: readonly Rect[]) { if (!sameRects(v, this.occ)) this.occ = v; }
  private occ: readonly Rect[] = [];
  /** Contract goods in the castle at the last frame (castle id, tick, per good); null = not seeded. */
  private castleSeen: { id: number; tick: number; have: Map<Good, number> } | null = null;

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
      b = { el, icon, time, secs: -1, key: '', sig: '', used: true, shownAt: 0, px: NaN, py: NaN, occ: null, name: '', sev: '', aria: '' };
      this.pool.push(b);
      this.root.append(el);
    }
    b.key = key;
    b.sig = '';
    b.used = true;
    b.el.dataset.k = key;
    this.byKey.set(key, b);
    b.el.classList.remove('is-shown', 'breathe', 'is-first');
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
        this.place(b, a.x, a.y, sig, () => buildingStateIcon(world, bd.id, bd.status, 24), crit || isWorst, false,
          () => `${buildingName(world, bd.id)}: ${buildingStatusText(bd.status, world, bd.id)}`, isWorst ? 'worst' : crit ? 'critical' : '');
        // how long it has stood, from 20 s on (BACKLOG P2): a pin that keeps counting is the one to read first
        this.setTime(b, bd.stalledTicks >= PIN_TIME_TICKS ? Math.floor(bd.stalledTicks / TICK_HZ) : -1);
        const ring = bd.id === this.flashId && performance.now() < this.flashUntil;
        if (ring !== b.el.classList.contains('is-first')) b.el.classList.toggle('is-first', ring);
      }
      for (const w of world.state.wagons) {
        if (!isWagonWait(w.status)) continue;
        const a = view.anchorOf('wagon', w.id);
        if (!a.visible) continue;
        const crit = w.status.k === 'NO_ROUTE';
        const wb = this.take('wagon:' + w.id);
        this.place(wb, a.x, a.y, w.status.k + crit, () => wagonStatusIcon(w.status, 24), crit, true,
          () => `${wagonName(world, w.id)}: ${wagonStatusText(world, w.status)}`, crit ? 'critical' : '');
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

    this.updateDeliveries(world, view, hidden, now);

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

  private place(b: Bubble, x: number, y: number, sig: string, icon: () => string, crit: boolean, wagon: boolean, label: () => string, sev: PinSeverity): void {
    if (b.sig !== sig) {
      const first = b.sig === '';
      b.sig = sig;
      b.icon.innerHTML = icon();
      // the bubble's accessible name is the cause, e.g. "Piekarnia: brak dostępnych zapasów mąki", led by its
      // severity and followed by the time stood (a11y audit F7, D-121): the red pin is not told by colour alone
      b.name = label();
      b.sev = sev;
      this.label(b);
      b.el.classList.toggle('is-critical', crit);
      b.el.classList.toggle('is-wagon', wagon);
      if (first) {
        b.el.style.visibility = '';
        requestAnimationFrame(() => b.el.classList.add('is-shown', 'breathe'));
      }
    }
    if (x === b.px && y === b.py && b.occ === this.occ) return;
    b.px = x;
    b.py = y;
    b.occ = this.occ;
    b.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    // the pin box: 48 x 56 above its anchor (main.css .bubble margin)
    let under = false;
    for (const o of this.occ) {
      if (x + 24 > o.l && x - 24 < o.r && y > o.t && y - 56 < o.b) { under = true; break; }
    }
    if (under !== b.el.classList.contains('is-under')) {
      b.el.classList.toggle('is-under', under);
      // a pin hidden under the HUD (rail, card, sheet) leaves the Tab order too (D-143, ui audit day 9 P2-6): a
      // keyboard focus nobody can see; the same building is reached through the card or the panel above it
      b.el.tabIndex = under ? -1 : 0;
    }
  }

  /** Seconds stalled under the pin (-1: none); the text changes once a second at most. */
  private setTime(b: Bubble, secs: number): void {
    if (secs === b.secs) return;
    const step = Math.floor(secs / LABEL_STEP_SEC) !== Math.floor(b.secs / LABEL_STEP_SEC) || (secs < 0) !== (b.secs < 0);
    b.secs = secs;
    b.time.hidden = secs < 0;
    if (secs >= 0) setText(b.time, clock(secs));
    if (step) this.label(b);
  }

  /** "Najgorszy zastój — Piekarnia: brak mąki, stoi 1:30"; written only when it changes. */
  private label(b: Bubble): void {
    const head = b.sev === 'worst' ? t('pin.worst', { name: b.name }) : b.sev === 'critical' ? t('pin.critical', { name: b.name }) : b.name;
    const aria = b.secs >= 0 ? t('pin.stood', { name: head, time: clock(Math.floor(b.secs / LABEL_STEP_SEC) * LABEL_STEP_SEC) }) : head;
    if (aria === b.aria) return;
    b.aria = aria;
    b.el.setAttribute('aria-label', aria);
  }

  private stamp(id: number, now: number): void {
    if (this.stamps.some((s) => s.id === id)) return;
    const el = h('div.fix-stamp', { 'aria-hidden': 'true' }, h('div.fs-in', { html: iconSvg('seal', 30) }));
    this.root.append(el);
    this.stamps.push({ el, id, bornAt: now, out: false });
    requestAnimationFrame(() => el.classList.add('is-in'));
    this.onFixed?.(id);
  }

  /**
   * Goods that reached the castle for the contract since the last frame float up over it as "+N" with
   * the good's icon (one tag per good, stacked; at most three on screen). A first sight of the castle,
   * a loaded game or a restart (tick went back) only seeds the counts.
   */
  /** A contract good reached the castle (also off screen): the app plays the delivery sound. */
  onDelivery: ((g: Good, n: number) => void) | null = null;

  private updateDeliveries(world: World, view: WorldView, hidden: boolean, now: number): void {
    const st = world.state;
    const c = st.mission.contract;
    const castle = c ? st.buildings.find((b) => b.id === c.castle) : undefined;
    if (!c || !castle) { this.castleSeen = null; return; }
    const prev = this.castleSeen;
    const fresh = !prev || prev.id !== castle.id || st.tick < prev.tick;
    const have = fresh ? new Map<Good, number>() : prev.have;
    for (const g of GOODS) {
      if (!(c.need[g] > 0)) continue;
      const n = castle.stock[g];
      const before = have.get(g);
      have.set(g, n);
      if (fresh || before === undefined || n <= before || st.mission.result !== 'running') continue;
      this.onDelivery?.(g, n - before);
      if (hidden) continue;
      if (!(castle.gate >= 0 && view.cellToScreen ? view.cellToScreen(castle.gate) : view.anchorOf('building', castle.id)).visible) continue;
      this.deliveryTag(castle.id, g, n - before, now);
    }
    this.castleSeen = { id: castle.id, tick: st.tick, have };
    // at the gate, where the wagon hands the goods over (the castle's pin anchor tops a tall keep,
    // often under the waybill)
    const gate = castle.gate >= 0 && view.cellToScreen ? view.cellToScreen(castle.gate) : null;
    for (const d of [...this.deliveries]) {
      const age = now - d.bornAt;
      const a = gate ?? view.anchorOf('building', d.id);
      if (age > DELIVERY_HOLD_MS + DELIVERY_FADE_MS + 40 || !a.visible || hidden) {
        d.el.remove();
        this.deliveries.splice(this.deliveries.indexOf(d), 1);
        continue;
      }
      if (!d.out && age > DELIVERY_HOLD_MS) { d.out = true; d.el.classList.add('is-out'); }
      // just above the gate, drifting up ~24 px over its life (linear, no bounce)
      const rise = Math.min(1, age / (DELIVERY_HOLD_MS + DELIVERY_FADE_MS)) * 24;
      d.el.style.transform = `translate3d(${a.x.toFixed(1)}px, ${(a.y - 30 - d.row * 40 - rise).toFixed(1)}px, 0)`;
    }
  }

  private deliveryTag(id: number, g: Good, n: number, now: number): void {
    while (this.deliveries.length >= 3) this.deliveries.shift()!.el.remove();
    const row = [0, 1, 2].find((r) => !this.deliveries.some((d) => d.row === r)) ?? 0;
    const el = h('div.dlv-tag', { 'aria-hidden': 'true' },
      h('div.dlv-in', { html: `<span class="eta-ic">${iconSvg(g, 18, goodName(g))}</span>${bdi(`+${fmtInt(n)}`)}` }));
    this.root.append(el);
    this.deliveries.push({ el, id, bornAt: now, out: false, row });
    requestAnimationFrame(() => el.classList.add('is-in'));
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

  /** Ring the building's pin for `ms` (three 240 ms rings, CSS .is-first); the camera does not move. */
  flash(id: number, ms = 2000): void {
    this.flashId = id;
    this.flashUntil = performance.now() + ms;
  }

  reset(): void {
    this.flashId = -1;
    for (const b of this.pool) { b.el.remove(); }
    this.pool = [];
    for (const st of this.stamps) st.el.remove();
    this.stamps = [];
    for (const d of this.deliveries) d.el.remove();
    this.deliveries = [];
    this.castleSeen = null;
    this.shownStalls.clear();
    this.pinCache.clear();
    this.byKey.clear();
    this.clearDraft();
    this.eta.classList.remove('is-shown');
  }
}
