// In-game HUD: waybill (contract, with tranches), the town plaque (free valley), tool rail with
// coins/time/speed, toasts, rain notice, the rank-up letter.
import {
  GOODS, RANKS, WAGON_PRICE, canSurface, isRaining, sandboxStatus, timeOfDay, TICK_HZ,
  type BuildingType, type Contract, type Good, type SandboxStatus, type World,
  emptyGoods,
} from '../sim/index';
import type { Speed } from '../game/loop';
import { t, type MessageKey } from '../i18n/index';
import { deckle, esc, h, setHtml, setText } from './dom';
import { bdi, dayClock, fmtInt, goodName, joinList, rankName, tHtml, ticksClock } from './format';
import { iconSvg, type IconId } from './icons';

export type Tool = 'none' | 'road' | 'cobble' | 'demolish' | 'build';

export interface HudActions {
  setTool(t: Tool): void;
  buyWagon(): void;
  toggleOverlay(): void;
  setSpeed(s: Speed): void;
  openGameMenu(): void;
  openCastle(): void;
  waybillCollapsed(c: boolean): void;
  /** The town plaque was tapped: market & rank sheet. */
  openMarket(): void;
  /** The town reached a new rank while playing (not on load). */
  rankUp(rank: number): void;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** Goods of a tranche the castle already holds: deliveries count up in tranche order. */
function trancheHave(c: Contract, stock: Record<Good, number>, i: number): Record<Good, number> {
  const out = {} as Record<Good, number>;
  for (const g of GOODS) {
    let before = 0;
    for (let k = 0; k < i; k++) before += c.tranches[k]!.need[g];
    out[g] = Math.max(0, Math.min(c.tranches[i]!.need[g], stock[g] - before));
  }
  return out;
}

/** Buildings and surfaces a rank unlocks, as one readable list. */
export function unlockList(rank: number): string {
  const r = RANKS[rank];
  if (!r) return '';
  const parts = r.unlocks.map((b: BuildingType) => t(`building.${b}` as MessageKey));
  if (r.surfaces.includes(2)) parts.push(t('town.unlockCobble'));
  // rank 5 (Stolica) unlocks no building, only the castle upgrade (castleLevel 1)
  if (r.castleLevel > (RANKS[rank - 1]?.castleLevel ?? 0)) parts.push(t('town.unlockCastle'));
  return joinList(parts);
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
  return `<svg class="tally" viewBox="0 0 ${width.toFixed(1)} 18" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
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
  private live: HTMLElement;
  private lastSig = '';
  private plaqueSig = '';
  private lastRank = -1;
  private plaqueWrap: HTMLElement;
  private plaqueBody: HTMLElement;
  private plaqueOnly: HTMLElement;
  private rankLetter: HTMLElement | null = null;
  private wasRaining = false;
  private collapsed: boolean;
  /** Watch mode on tiny screens (Flip cover): seal only, no building tools. */
  private compact = false;

  constructor(private act: HudActions, collapsed: boolean) {
    this.collapsed = collapsed;
    // waybill
    this.waybillBody = h('div.waybill', { role: 'region', 'aria-label': t('contract.title') });
    this.waybillBody.style.clipPath = deckle('bottom', 1301, 7);
    this.sealOnly = h('button.seal-only', { 'aria-label': t('hud.expand') });
    this.waybillWrap = h('div.waybill-wrap', null, this.waybillBody, this.sealOnly);
    this.waybillWrap.classList.toggle('is-collapsed', collapsed);
    this.sealOnly.addEventListener('click', () => {
      if (this.compact) this.act.openCastle();
      else this.setCollapsed(false);
    });
    this.waybillBody.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).dataset.wb === 'castle') { e.preventDefault(); this.act.openCastle(); }
    });
    this.waybillBody.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-wb]');
      if (!el) return;
      if ((el as HTMLElement).dataset.wb === 'fold') this.setCollapsed(true);
      else this.act.openCastle();
    });

    // town plaque (free valley): rank, the checklist towards the next rank, income
    this.plaqueBody = h('div.plaque', { role: 'button', tabindex: '0', 'aria-label': t('town.open') });
    this.plaqueBody.style.clipPath = deckle('bottom', 733, 6);
    this.plaqueOnly = h('button.seal-only', { 'aria-label': t('town.unfold') });
    this.plaqueWrap = h('div.waybill-wrap.plaque-wrap', null, this.plaqueBody, this.plaqueOnly);
    this.plaqueWrap.hidden = true;
    this.plaqueWrap.classList.toggle('is-collapsed', collapsed);
    this.plaqueOnly.addEventListener('click', () => {
      if (this.compact) this.act.openMarket();
      else this.setCollapsed(false);
    });
    this.plaqueBody.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-pl="fold"]')) this.setCollapsed(true);
      else this.act.openMarket();
    });
    this.plaqueBody.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.act.openMarket(); }
    });

    // rail
    this.coins = h('span.num');
    this.day = h('span.num');
    this.dayIcon = h('span', { html: iconSvg('sun', 20) });
    const coinStat = h('div.rail-stat', { title: t('contract.left') }, h('span', { html: iconSvg('coin', 20) }), this.coins);
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
      ['build', 'build', t('tool.build'), () => this.act.setTool(this.toolOn('build') ? 'none' : 'build')],
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
    const hint = h('div.rail-hint', null, t('hud.openPhone'));
    const rail = h('nav.rail', { 'aria-label': t('tool.menu') }, line, tools, hint);

    this.toasts = h('div.toasts', { 'aria-live': 'polite' });
    this.live = h('div.sr-only', { 'aria-live': 'polite', role: 'status' });
    this.root = h('div', null, this.waybillWrap, this.plaqueWrap, rail, this.toasts, this.caption, this.live);
    rail.classList.add('hit');
    this.setBuild(false);
  }

  /** The build tool exists in the free valley and in missions that allow building. */
  setBuild(on: boolean): void {
    const b = this.toolBtns.get('build');
    if (b) b.hidden = !on;
  }

  private toolOn(id: string): boolean {
    return this.toolBtns.get(id)?.classList.contains('is-on') ?? false;
  }

  private setCollapsed(c: boolean): void {
    this.collapsed = c;
    this.waybillWrap.classList.toggle('is-collapsed', c || this.compact);
    this.plaqueWrap.classList.toggle('is-collapsed', c || this.compact);
    this.act.waybillCollapsed(c);
    this.lastSig = '';
    this.plaqueSig = '';
  }

  /** Tiny screen (Flip cover): show only the seal, keep the player's own collapse preference. */
  setCompact(c: boolean): void {
    if (this.compact === c) return;
    this.compact = c;
    this.waybillWrap.classList.toggle('is-collapsed', this.collapsed || c);
    this.plaqueWrap.classList.toggle('is-collapsed', this.collapsed || c);
    this.lastSig = '';
    this.plaqueSig = '';
  }

  /** Re-place the floating active-tool caption after a layout change. */
  relayout(): void {
    const active = [...this.toolBtns.values()].find((b) => b.classList.contains('is-on') && b.dataset.tool !== 'overlay');
    if (active) requestAnimationFrame(() => this.placeCaption(active));
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
    setText(this.coins, fmtInt(st.coins));
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

    const cobble = this.toolBtns.get('cobble');
    if (cobble) {
      const gate = canSurface(world, 2);
      cobble.classList.toggle('is-disabled', !gate.ok);
      cobble.setAttribute('aria-disabled', String(!gate.ok));
    }

    const c = st.mission.contract;
    this.waybillWrap.hidden = !c;
    const sb = c ? null : sandboxStatus(world);
    this.plaqueWrap.hidden = !sb?.market;
    if (sb?.market) this.updatePlaque(sb);
    if (!c) return;
    const castle = st.buildings.find((b) => b.id === c.castle);
    const stock = castle ? castle.stock : emptyGoods();
    const goods = GOODS.filter((g) => c.need[g] > 0) as Good[];
    const have = goods.map((g) => Math.min(stock[g], c.need[g]));
    const tr = c.tranches;
    const cur = tr.findIndex((x) => x.doneTick < 0);
    // the clock runs to the tranche now due (its own deadline), or to the contract deadline
    const dueTick = cur >= 0 && !tr[cur]!.missed ? tr[cur]!.deadlineTick : c.deadlineTick;
    const left = Math.max(0, dueTick - st.tick);
    const leftSec = Math.floor(left / TICK_HZ);
    const folded = this.collapsed || this.compact;
    const sig = `${have.join(',')}|${leftSec}|${folded}|${tr.map((x) => `${x.doneTick >= 0 ? 1 : 0}${x.missed ? 1 : 0}`).join('')}`;
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    const total = goods.reduce((a, g) => a + c.need[g], 0);
    const frac = have.reduce((a, v) => a + v, 0) / Math.max(1, total);
    const late = left < 120 * TICK_HZ;
    if (folded) {
      setHtml(this.sealOnly, `${sealStack(frac, 52)}${bdi(ticksClock(left), 'seal-time num')}`);
      return;
    }
    const tallyLine = (g: Good, got: number, need: number, i: number): string => `<div class="wb-line${got >= need ? ' done' : ''}" data-wb="castle" role="button" tabindex="0">
        ${iconSvg(g, 24, goodName(g))}${tallySvg(got, need, i + 1)}
        <bdi class="count num">${fmtInt(got)}<small>/${fmtInt(need)}</small></bdi></div>`;
    const timeLine = `<div class="wb-time num${late ? ' late' : ''}">${iconSvg('snow', 20)}<span>${tHtml('contract.timeLeft', { time: ticksClock(left) })}</span></div>`;
    let body: string;
    if (!tr.length) {
      body = `<p class="wb-to">${t('contract.to')}</p>${goods.map((g, i) => tallyLine(g, have[i]!, c.need[g], i)).join('')}${timeLine}`;
    } else {
      body = `<ol class="wb-tranches">${tr.map((x, i) => {
        const tg = GOODS.filter((g) => x.need[g] > 0) as Good[];
        const got = trancheHave(c, stock, i);
        const head = `<span class="tr-n">${ROMAN[i] ?? i + 1}.</span><span class="tr-t">${tHtml('contract.tranche', { n: i + 1, time: ticksClock(x.deadlineTick) })}</span>`;
        if (x.doneTick >= 0) {
          return `<li class="wb-tr is-done${x.missed ? ' is-late' : ''}" data-wb="castle"><div class="tr-h">${head}<span class="tr-seal">${iconSvg('seal', 22)}</span></div>
            <div class="tr-state">${esc(t(x.missed ? 'contract.trancheLate' : 'contract.trancheDone'))}</div></li>`;
        }
        if (i === cur) {
          return `<li class="wb-tr is-now${x.missed ? ' is-late' : ''}"><div class="tr-h">${head}</div>
            ${tg.map((g, k) => tallyLine(g, got[g], x.need[g], i * 3 + k)).join('')}
            ${x.missed ? `<div class="tr-state">${esc(t('contract.trancheLate'))}</div>` : ''}</li>`;
        }
        return `<li class="wb-tr is-later" data-wb="castle"><div class="tr-h">${head}</div>
          <div class="tr-goods">${tg.map((g) => `<span>${iconSvg(g, 18, goodName(g))}${bdi(fmtInt(x.need[g]))}</span>`).join('')}</div></li>`;
      }).join('')}</ol>${timeLine}`;
    }
    setHtml(this.waybillBody, `<h2>${t('contract.title')}</h2>
      <button class="seal-btn" data-wb="fold" aria-label="${t('hud.collapse')}">${sealStack(frac, 40)}</button>${body}`);
  }

  /** The free valley's plaque: rank, a checklist towards the next one, income now. */
  private updatePlaque(sb: SandboxStatus): void {
    if (this.lastRank >= 0 && sb.rank > this.lastRank) this.act.rankUp(sb.rank);
    this.lastRank = sb.rank;
    const n = sb.next;
    const folded = this.collapsed || this.compact;
    const reqs = n ? [
      { k: 'renown', label: t('town.renownShort'), have: sb.renown, need: n.renown, unit: '' },
      { k: 'goods', label: t('town.goodsShort'), have: sb.goodsSold, need: n.goods, unit: '' },
      { k: 'flow', label: t('town.flowShort'), have: sb.bestFlow, need: n.flow, unit: '' },
    ] : [];
    // the seal fills with the share of the next rank already earned (each requirement weighs a third)
    const frac = n ? reqs.reduce((a, r) => a + Math.min(1, r.have / Math.max(1, r.need)), 0) / reqs.length : 1;
    const sig = `${sb.rank}|${reqs.map((r) => `${r.have}`).join(',')}|${sb.flowNow}|${folded}`;
    if (sig === this.plaqueSig) return;
    this.plaqueSig = sig;
    const income = `<span class="pl-income">${iconSvg('coin', 18)}<span>${tHtml('town.income', { n: fmtInt(sb.flowNow) })}</span></span>`;
    if (folded) {
      setHtml(this.plaqueOnly, `${sealStack(frac, 52)}${bdi(`+${fmtInt(sb.flowNow)}/min`, 'seal-time num')}`);
      return;
    }
    const rows = reqs.map((r) => {
      const met = r.have >= r.need;
      const pct = Math.min(100, (r.have / Math.max(1, r.need)) * 100);
      return `<li class="${met ? 'is-met' : ''}"><i class="pl-mark" aria-hidden="true"></i><span class="pl-l">${esc(r.label)}</span>
        <bdi class="num pl-v">${fmtInt(Math.min(r.have, 99999))}<small>/${fmtInt(r.need)}${r.unit}</small></bdi>
        <span class="pl-bar"><i style="width:${pct.toFixed(1)}%"></i></span></li>`;
    }).join('');
    const next = n ? `<div class="pl-next">${tHtml('town.toNext', { name: rankName(n.rank) })}</div><ul class="pl-req">${rows}</ul>`
      : `<div class="pl-next">${esc(t('town.top'))}</div>`;
    setHtml(this.plaqueBody, `<div class="pl-kick">${esc(t('market.title'))}</div><h2>${esc(rankName(sb.rank))}</h2>
      <button class="seal-btn" data-pl="fold" aria-label="${esc(t('town.fold'))}">${sealStack(frac, 40)}</button>
      ${next}${income}`);
  }

  /** Sealed letter for a new rank: slides in (200 ms), the wax is pressed (120 ms), tap or 6 s to close. */
  showRankUp(rank: number, holdMs = 6000): void {
    this.rankLetter?.remove();
    const unlocks = unlockList(rank);
    const letter = h('div.rank-letter', { role: 'status', html: `
      <div class="l-kicker">${esc(t('contract.kicker'))}</div>
      <h2>${esc(t('town.rankUp', { name: rankName(rank) }))}</h2>
      <p>${esc(t('town.rankText'))}</p>
      ${unlocks ? `<p class="rl-unlocks">${iconSvg('build', 20)}<span>${esc(t('town.unlocks', { list: unlocks }))}</span></p>` : ''}` });
    letter.style.clipPath = deckle('bottom', 4111 + rank, 6, 22);
    const seal = h('span.rl-seal', { html: iconSvg('seal', 56) });
    const wrap = h('button.rank-letter-wrap.hit', { 'aria-label': t('sheet.close') }, h('div.float', null, letter), seal);
    const close = (): void => {
      if (this.rankLetter !== wrap) return;
      this.rankLetter = null;
      wrap.classList.add('is-out');
      window.setTimeout(() => wrap.remove(), 220);
    };
    wrap.addEventListener('click', close);
    this.rankLetter = wrap;
    this.root.append(wrap);
    window.setTimeout(close, holdMs);
  }

  /** Screen-reader only announcement (quiet confirmations that have no visible text). */
  announce(text: string): void {
    this.live.textContent = text;
  }

  toast(text: string, kind: 'info' | 'err' = 'info', icon: IconId | null = null, ms = 2600): void {
    // repeated message: bump a counter on the newest toast instead of stacking copies
    const first = this.toasts.firstElementChild as (HTMLElement & { __toast?: { text: string; n: number; timer: number } }) | null;
    if (first?.__toast && first.__toast.text === text && !first.querySelector('.is-out')) {
      const st = first.__toast;
      st.n++;
      const c = first.querySelector('.toast-n');
      if (c) c.textContent = `×${fmtInt(st.n)}`;
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
