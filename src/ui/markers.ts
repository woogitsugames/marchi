// Markers that live in the scene: stall bubbles above buildings (and stuck wagons),
// the ochre ETA tag beside the selected wagon, and the road-draft label near the finger.
// Positions come from view.anchorOf every frame; DOM nodes are pooled, only transforms change.
import { wagonEta, type World } from '../sim/index';
import type { WorldView } from '../render/api';
import { h, setText } from './dom';
import { buildingStatusIcon, clock, isCritical, isStall, wagonStatusIcon } from './format';
import { iconSvg } from './icons';

const MIN_STALL_TICKS = 20; // 2 s: avoid flicker on short hiccups

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
    if (!hidden) {
      for (const bd of world.state.buildings) {
        if (!isStall(bd.status) && bd.status.k !== 'NO_INPUT') continue;
        if (bd.stalledTicks < MIN_STALL_TICKS) continue;
        const a = view.anchorOf('building', bd.id);
        if (!a.visible) continue;
        const crit = isCritical(bd.status, bd.stalledTicks);
        const sig = JSON.stringify(bd.status) + crit;
        const b = this.take('building:' + bd.id);
        b.el.classList.toggle('is-minor', bd.status.k === 'WAITING_PICKUP');
        this.place(b, a.x, a.y, sig, () => buildingStatusIcon(bd.status, 26, bd.type), crit, false);
      }
      for (const w of world.state.wagons) {
        if (w.status.k !== 'BRIDGE_JAM' && w.status.k !== 'NO_ROUTE') continue;
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

    // ETA tag beside the selected wagon
    let etaOn = false;
    if (selectedWagon !== null && !hidden) {
      const w = world.state.wagons.find((q) => q.id === selectedWagon);
      const a = w ? view.anchorOf('wagon', w.id) : null;
      if (w && a && a.visible && w.status.k !== 'IDLE') {
        const e = wagonEta(world, w.id);
        if (e) {
          etaOn = true;
          setText(this.etaText, clock(e.toDest));
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
    this.byKey.clear();
    this.clearDraft();
    this.eta.classList.remove('is-shown');
  }
}
