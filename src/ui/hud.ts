// In-game HUD: waybill (contract), tool rail with coins/time/speed, toasts, rain notice.
import { GOODS, WAGON_PRICE, isRaining, timeOfDay, TICK_HZ, type Good, type World } from '../sim/index';
import type { Speed } from '../game/loop';
import { t } from '../i18n/index';
import { deckle, h, setHtml, setText } from './dom';
import { dayClock, goodName, ticksClock } from './format';
import { iconSvg, type IconId } from './icons';

export type Tool = 'none' | 'road' | 'cobble' | 'demolish';

export interface HudActions {
  setTool(t: Tool): void;
  buyWagon(): void;
  toggleOverlay(): void;
  setSpeed(s: Speed): void;
  openGameMenu(): void;
  openCastle(): void;
  waybillCollapsed(c: boolean): void;
}

/** Tally marks (groups of five) as one SVG: filled marks in ink, the rest faint. */
function tallySvg(have: number, need: number, seed: number): string {
  const groups = Math.ceil(need / 5);
  const pitch = 3.1, gw = pitch * 4 + 5;
  const width = groups * gw;
  let r = seed * 7919 + 13;
  const j = (): number => { r = (r * 16807) % 2147483647; return (r / 2147483647 - 0.5) * 0.8; };
  const on: string[] = [], off: string[] = [];
  for (let i = 0; i < need; i++) {
    const g = Math.floor(i / 5), k = i % 5;
    const x0 = g * gw + 1.5;
    let d: string;
    if (k < 4) {
      const x = x0 + k * pitch + j();
      d = `M${(x - 0.7).toFixed(2)} ${(2 + j()).toFixed(2)}L${(x + 0.7).toFixed(2)} ${(1.6 + j()).toFixed(2)}L${(x + 0.5 + j() * 0.3).toFixed(2)} ${(16.4 + j()).toFixed(2)}L${(x - 0.6).toFixed(2)} 16.6Z`;
    } else {
      // the fifth mark strikes across the four
      d = `M${(x0 - 1.4).toFixed(2)} ${(13.4 + j()).toFixed(2)}L${(x0 - 0.8).toFixed(2)} ${(14.8 + j()).toFixed(2)}L${(x0 + pitch * 3 + 2).toFixed(2)} ${(4.6 + j()).toFixed(2)}L${(x0 + pitch * 3 + 1.4).toFixed(2)} ${(3.3 + j()).toFixed(2)}Z`;
    }
    (i < have ? on : off).push(d);
  }
  return `<svg class="tally" viewBox="0 0 ${width.toFixed(1)} 18" width="${width.toFixed(0)}" height="18" aria-hidden="true">
    <path class="off" d="${off.join('')}"/><path class="on" d="${on.join('')}"/></svg>`;
}

function sealStack(frac: number, size: number): string {
  const f = Math.max(0, Math.min(1, frac));
  return `<div class="seal-stack" style="width:${size}px;height:${size}px">
    <span class="seal-ghost">${iconSvg('seal', size)}</span>
    <span class="seal-fill" style="clip-path:inset(${((1 - f) * 100).toFixed(1)}% 0 0 0)">${iconSvg('seal', size)}</span></div>`;
}

export class Hud {
  readonly root: HTMLElement;
  private waybillWrap: HTMLElement;
  private waybillBody: HTMLElement;
  private sealOnly: HTMLElement;
  private coins: HTMLElement;
  private dayIcon: HTMLElement;
  private day: HTMLElement;
  private speedBtns = new Map<Speed, HTMLButtonElement>();
  private toolBtns = new Map<string, HTMLButtonElement>();
  private toasts: HTMLElement;
  private notice: HTMLElement | null = null;
  private caption: HTMLElement;
  private lastSig = '';
  private wasRaining = false;
  private collapsed: boolean;

  constructor(private act: HudActions, collapsed: boolean) {
    this.collapsed = collapsed;
    // waybill
    this.waybillBody = h('div.waybill', { role: 'region', 'aria-label': t('contract.title') });
    this.waybillBody.style.clipPath = deckle('bottom', 1301, 7);
    this.sealOnly = h('button.seal-only', { 'aria-label': t('hud.expand') });
    this.waybillWrap = h('div.waybill-wrap', null, this.waybillBody, this.sealOnly);
    this.waybillWrap.classList.toggle('is-collapsed', collapsed);
    this.sealOnly.addEventListener('click', () => this.setCollapsed(false));
    this.waybillBody.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-wb]');
      if (!el) return;
      if ((el as HTMLElement).dataset.wb === 'fold') this.setCollapsed(true);
      else this.act.openCastle();
    });

    // rail
    this.coins = h('span.num');
    this.day = h('span.num');
    this.dayIcon = h('span', { html: iconSvg('sun', 20) });
    const coinStat = h('div.rail-stat', { title: t('hud.coins', { n: '' }) }, h('span', { html: iconSvg('coin', 20) }), this.coins);
    const dayStat = h('div.rail-stat.sep', { title: t('hud.day') }, this.dayIcon, this.day);
    const speed = h('div.speed', { role: 'group', 'aria-label': t('tool.speed') });
    const sp: [Speed, IconId, string][] = [[0, 'pause', t('speed.pause')], [1, 'speed1', t('speed.x1')], [2, 'speed2', t('speed.x2')], [4, 'speed4', t('speed.x4')]];
    for (const [s, icon, label] of sp) {
      const b = h('button.btn.cf', { 'aria-label': label, title: label, html: `<span>${iconSvg(icon, 22)}</span>` });
      b.addEventListener('click', () => this.act.setSpeed(s));
      speed.append(b);
      this.speedBtns.set(s, b);
    }
    const menuBtn = (cls: string): HTMLButtonElement => {
      const b = h(`button.btn.cf.${cls}` as 'button.btn', { 'aria-label': t('tool.menu'), title: t('tool.menu'), html: `<span>${iconSvg('menu', 22)}</span>` });
      b.addEventListener('click', () => this.act.openGameMenu());
      return b;
    };
    const line = h('div.rail-line', null, coinStat, dayStat, h('div.rail-spacer'), speed, menuBtn('icon-btn.menu-slot'));

    const tools = h('div.rail-tools');
    const defs: [string, IconId, string, () => void][] = [
      ['road', 'road_dirt', t('tool.road'), () => this.act.setTool(this.toolOn('road') ? 'none' : 'road')],
      ['cobble', 'road_cobble', t('tool.cobble'), () => this.act.setTool(this.toolOn('cobble') ? 'none' : 'cobble')],
      ['demolish', 'demolish', t('tool.demolish'), () => this.act.setTool(this.toolOn('demolish') ? 'none' : 'demolish')],
      ['wagon', 'buy_wagon', t('tool.wagon'), () => this.act.buyWagon()],
      ['overlay', 'overlay_load', t('tool.overlay'), () => this.act.toggleOverlay()],
    ];
    for (const [id, icon, label, fn] of defs) {
      const b = h('button.btn.cf.tool', { 'aria-label': label, 'data-tool': id, html: `<span>${iconSvg(icon, 30)}</span><span class="tl">${label}</span>` });
      b.addEventListener('click', fn);
      tools.append(b);
      this.toolBtns.set(id, b);
    }
    tools.append(menuBtn('tool.menu-slot'));
    this.caption = h('div.tool-caption');
    const rail = h('nav.rail', { 'aria-label': t('tool.menu') }, line, tools);

    this.toasts = h('div.toasts', { 'aria-live': 'polite' });
    this.root = h('div', null, this.waybillWrap, rail, this.toasts, this.caption);
    rail.classList.add('hit');
  }

  private toolOn(id: string): boolean {
    return this.toolBtns.get(id)?.classList.contains('is-on') ?? false;
  }

  private setCollapsed(c: boolean): void {
    this.collapsed = c;
    this.waybillWrap.classList.toggle('is-collapsed', c);
    this.act.waybillCollapsed(c);
    this.lastSig = '';
  }

  setTool(tool: Tool, overlay: boolean): void {
    for (const [id, b] of this.toolBtns) {
      const on = id === tool || (id === 'overlay' && overlay);
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    }
    const active = tool !== 'none' ? this.toolBtns.get(tool) : null;
    this.caption.classList.toggle('is-shown', !!active);
    if (active) {
      this.caption.textContent = active.getAttribute('aria-label') ?? '';
      requestAnimationFrame(() => this.placeCaption(active));
    }
  }

  private placeCaption(btn: HTMLElement): void {
    const r = btn.getBoundingClientRect();
    const left = document.body.classList.contains('left-handed');
    this.caption.style.top = `${r.top + r.height / 2 - 17}px`;
    if (left) { this.caption.style.left = `${r.right + 8}px`; this.caption.style.right = ''; }
    else { this.caption.style.right = `${window.innerWidth - r.left + 8}px`; this.caption.style.left = ''; }
  }

  setSpeed(s: Speed): void {
    for (const [k, b] of this.speedBtns) {
      b.classList.toggle('is-on', k === s);
      b.setAttribute('aria-pressed', String(k === s));
    }
  }

  /** Cheap; call every frame — only touches the DOM when numbers change. */
  update(world: World): void {
    const st = world.state;
    setText(this.coins, String(st.coins));
    const wagonBtn = this.toolBtns.get('wagon');
    if (wagonBtn) wagonBtn.classList.toggle('is-disabled', st.coins < WAGON_PRICE);
    const raining = isRaining(st);
    const tod = timeOfDay(world);
    setText(this.day, dayClock(tod));
    const dayKey = raining ? 'rain' : 'sun';
    if (this.dayIcon.dataset.k !== dayKey) {
      this.dayIcon.dataset.k = dayKey;
      this.dayIcon.innerHTML = iconSvg(dayKey, 20);
      this.dayIcon.parentElement?.classList.toggle('rain', raining);
    }
    if (raining && !this.wasRaining && st.tick > 0) this.showNotice('rain', t('hud.rain'));
    this.wasRaining = raining;

    const c = st.mission.contract;
    this.waybillWrap.hidden = !c;
    if (!c) return;
    const castle = st.buildings.find((b) => b.id === c.castle);
    const goods = GOODS.filter((g) => c.need[g] > 0) as Good[];
    const have = goods.map((g) => Math.min(castle ? castle.stock[g] : 0, c.need[g]));
    const left = Math.max(0, c.deadlineTick - st.tick);
    const leftSec = Math.floor(left / TICK_HZ);
    const sig = `${have.join(',')}|${leftSec}|${this.collapsed}`;
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    const total = goods.reduce((a, g) => a + c.need[g], 0);
    const frac = have.reduce((a, v) => a + v, 0) / Math.max(1, total);
    const late = left < 120 * TICK_HZ;
    if (this.collapsed) {
      setHtml(this.sealOnly, `${sealStack(frac, 52)}<span class="seal-time num">${ticksClock(left)}</span>`);
      return;
    }
    const lines = goods.map((g, i) => `<div class="wb-line${have[i]! >= c.need[g] ? ' done' : ''}" data-wb="castle">
        ${iconSvg(g, 24, goodName(g))}${tallySvg(have[i]!, c.need[g], i + 1)}
        <span class="count num">${have[i]}<small>/${c.need[g]}</small></span></div>`).join('');
    setHtml(this.waybillBody, `<h2>${t('contract.title')}</h2>
      <button class="seal-btn" data-wb="fold" aria-label="${t('hud.collapse')}">${sealStack(frac, 40)}</button>
      <p class="wb-to">${t('contract.to')}</p>${lines}
      <div class="wb-time num${late ? ' late' : ''}">${iconSvg('snow', 20)}<span>${t('contract.timeLeft', { time: ticksClock(left) })}</span></div>`);
  }

  toast(text: string, kind: 'info' | 'err' = 'info', icon: IconId | null = null, ms = 2600): void {
    // repeated message: bump a counter on the newest toast instead of stacking copies
    const first = this.toasts.firstElementChild as (HTMLElement & { __toast?: { text: string; n: number; timer: number } }) | null;
    if (first?.__toast && first.__toast.text === text && !first.querySelector('.is-out')) {
      const st = first.__toast;
      st.n++;
      const c = first.querySelector('.toast-n');
      if (c) c.textContent = `×${st.n}`;
      window.clearTimeout(st.timer);
      st.timer = this.dismiss(first, ms);
      return;
    }
    const el = h('div.toast.cf.parch', null);
    if (kind === 'err') el.classList.add('err');
    el.innerHTML = `${icon ? iconSvg(icon, 22) : ''}<span>${text.replace(/</g, '&lt;')}</span><b class="toast-n num"></b>`;
    // the shadow needs a wrapper because the chamfer clips filters
    const wrap = h('div.float', null, el) as HTMLElement & { __toast?: { text: string; n: number; timer: number } };
    wrap.__toast = { text, n: 1, timer: this.dismiss(wrap, ms) };
    this.toasts.prepend(wrap);
    while (this.toasts.children.length > 3) this.toasts.lastElementChild?.remove();
  }

  private dismiss(wrap: HTMLElement, ms: number): number {
    return window.setTimeout(() => {
      wrap.firstElementChild?.classList.add('is-out');
      window.setTimeout(() => wrap.remove(), 220);
    }, ms);
  }

  showNotice(icon: IconId, text: string, ms = 5200): void {
    this.notice?.remove();
    const el = h('div.notice.cf.parch', { role: 'status', html: `${iconSvg(icon, 26)}<span>${text}</span>` });
    const wrap = h('div.notice-wrap.float', null, el);
    this.notice = wrap;
    this.root.append(wrap);
    document.body.classList.add('has-notice');
    window.setTimeout(() => {
      el.classList.add('is-out');
      window.setTimeout(() => {
        wrap.remove();
        if (this.notice === wrap) { this.notice = null; document.body.classList.remove('has-notice'); }
      }, 260);
    }, ms);
  }
}
