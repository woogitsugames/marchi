// In-game HUD (D-43, concept "D" on the painted UI kit). Top: menu, time and silver chips, speed
// segments, the contract under a red ribbon (seals, "M:SS to snow", a bar per good) or the free
// valley's rank panel. Bottom: the worst stall card with its eye button, the alarm seal that cycles
// through the stalls, and the row of tool cards. Plus toasts, notices and the rank-up letter.
// The DOM is built once; update() only writes text, widths and classes when a value changes.
import {
  GOODS, RANKS, WAGON_PRICE, buildingById, canSurface, isRaining, nextChange, sandboxStatus, seasonAt, seasonal,
  thawing, timeOfDay, TICK_HZ, yearAt,
  type BuildingType, type Command, type Contract, type Good, type PaceLog, type SandboxStatus, type Season, type World,
  emptyGoods,
} from '../sim/index';
import type { Speed } from '../game/loop';
import { getLang, t, type MessageKey } from '../i18n/index';
import { deckle, esc, h, setHtml, setText } from './dom';
import { bdi, buildingName, buildingStatusIcon, buildingStatusText, dayClock, fmtInt, goodName, joinList, rankName, tHtml, ticksClock } from './format';
import { iconSvg, type IconId } from './icons';
import { missionTitle } from './menu';
import { forecastFor, waybillPaceHtml } from './pace';
import { cureFor, type Cure, type StallEntry } from './stalls';
import { EventCard } from './eventCard';

export type Tool = 'none' | 'road' | 'cobble' | 'demolish' | 'build';

export interface HudActions {
  setTool(t: Tool): void;
  buyWagon(): void;
  toggleOverlay(): void;
  setSpeed(s: Speed): void;
  openGameMenu(): void;
  openCastle(): void;
  /** Open a building's card (the waybill's supplier line). */
  openBuilding(id: number): void;
  /** Jump the camera to a stalled building and open its "why" card (stall card eye, alarm seal). */
  showStall(id: number): void;
  waybillCollapsed(c: boolean): void;
  /** The town plaque was tapped: market & rank sheet. */
  openMarket(): void;
  /** The town reached a new rank while playing (not on load). */
  rankUp(rank: number): void;
  /** Valley event card (D-54): accept / set aside an order, sell to / dismiss the merchant. */
  eventCommand(cmd: Command): void;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** Existing woodcut icons stand in for the seasons (no new art, docs/design/seasons.md §5 is pending). */
const SEASON_ICON: Record<Season, IconId> = { spring: 'rain', summer: 'sun', autumn: 'beer', winter: 'snow' };
/** What a season (or the thaw) changes, said once when it begins. Spring itself changes nothing until the thaw. */
const SEASON_EFFECT: Partial<Record<Season | 'thaw', MessageKey>> = {
  summer: 'season.effect.summer-farm', winter: 'season.effect.winter-farm', thaw: 'season.effect.spring-thaw',
};
const CHANGE_ICON: Record<string, IconId> = { 'thaw-start': 'road_dirt', 'thaw-end': 'road_dirt', 'ice-start': 'bridge_ice', 'ice-end': 'bridge_ice' };
/** Languages whose sentences may start lower-case after "Name:" (German nouns keep their capital). */
const LOWER_AFTER_COLON = new Set(['pl', 'en', 'fr', 'es', 'it', 'pt-BR', 'nl', 'sv', 'ru', 'uk', 'tr']);

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

/** Kit progress bar (track + fill sprites), quarter marks drawn by CSS. */
function bar(frac: number, cls = ''): string {
  const pct = Math.max(0, Math.min(1, frac)) * 100;
  return `<span class="kbar${cls}"><i style="width:${pct.toFixed(1)}%"></i></span>`;
}

/** Three kit seals, the first `n` pressed in wax. */
function seals(n: number, label: string, dim = false): string {
  let s = '';
  for (let i = 0; i < 3; i++) s += `<i class="kseal${i < n ? ' on' : ''}"></i>`;
  return `<span class="wb-seals${dim ? ' is-dim' : ''}" role="img" aria-label="${esc(label)}">${s}</span>`;
}

/** The folded contract / plaque: a wax seal that fills with progress, a short value underneath. */
function sealOnly(frac: number, text: string): string {
  const f = Math.max(0, Math.min(1, frac));
  return `<span class="so-seal"><i class="so-fill" style="clip-path:inset(${((1 - f) * 100).toFixed(1)}% 0 0 0)"></i></span>${bdi(text, 'seal-time num')}`;
}

/** Short reason for the stall card: the ledger's short cause ("all wagons busy"), else the status line. */
function stallReason(world: World, id: number): string {
  const b = buildingById(world, id);
  if (!b) return '';
  const s = b.status;
  const cause = 'cause' in s ? s.cause : null;
  for (const k of [cause ? `cause.${s.k}.${cause}` : '', `cause.${s.k}`]) {
    if (!k) continue;
    const v = t(k as MessageKey);
    if (v !== k) return v;
  }
  const full = buildingStatusText(s, world);
  const lang = getLang();
  return LOWER_AFTER_COLON.has(lang) && full ? full[0]!.toLocaleLowerCase(lang) + full.slice(1) : full;
}

export class Hud {
  readonly root: HTMLElement;
  private waybillWrap: HTMLElement;
  private wbTitle: HTMLElement;
  private wbSeals: HTMLElement;
  private wbPill: HTMLElement;
  private wbBody: HTMLElement;
  private sealOnly: HTMLElement;
  private coins: HTMLElement;
  private dayIcon: HTMLElement;
  private day: HTMLElement;
  private speedBtns = new Map<Speed, HTMLButtonElement>();
  private toolBtns = new Map<string, HTMLButtonElement>();
  private wagonLabel: HTMLElement;
  private wagonCost: HTMLElement;
  private stallRow: HTMLElement;
  private stallText: HTMLElement;
  private stallEye: HTMLButtonElement;
  private alarm: HTMLButtonElement;
  private alarmIcon: HTMLElement;
  private alarmBadge: HTMLElement;
  private toasts: HTMLElement;
  private notice: HTMLElement | null = null;
  private live: HTMLElement;
  private lastSig = '';
  /** Contract milestones already announced (D-60): 'half', '<dueTick>:2', '<dueTick>:1'; seeded on the first update. */
  private milestones: Set<string> | null = null;
  /** Contract goods in the castle at the last update (for the bar flash). */
  private prevHave = new Map<Good, number>();
  private sealsSig = '';
  private plaqueSig = '';
  private stallSig = '';
  private wagonSig = '';
  private cure: Cure = null;
  private lastRank = -1;
  private plaqueWrap: HTMLElement;
  private plTitle: HTMLElement;
  private plBody: HTMLElement;
  private plaqueOnly: HTMLElement;
  private events: EventCard;
  private rankLetter: HTMLElement | null = null;
  private wasRaining = false;
  /** Season bookkeeping for notices (null = not seen yet: loading a game announces nothing old). */
  private lastSeason: Season | null = null;
  private wasThaw = false;
  private announced = '';
  private collapsed: boolean;
  /** Watch mode on tiny screens (Flip cover): seal only, no building tools. */
  private compact = false;
  /** A bottom sheet is open in portrait: the waybill folds to its seal so the sheet's subject has map (D-62). */
  private sheetFold = false;
  /** Stalls ranked worst first (last update) and the one the alarm seal showed last. */
  private stalls: StallEntry[] = [];
  private lastShown = -1;
  private topObserver: ResizeObserver | null = null;

  constructor(private act: HudActions, collapsed: boolean) {
    this.collapsed = collapsed;

    // ---- top bar: menu, time, silver, speed
    const menuBtn = h('button.menu-btn', { 'aria-label': t('tool.menu'), title: t('tool.menu'), html: iconSvg('menu', 24) });
    menuBtn.addEventListener('click', () => this.act.openGameMenu());
    this.day = h('span.num');
    this.dayIcon = h('span.chip-ic', { html: iconSvg('sun', 22) });
    this.coins = h('span.num');
    const dayChip = h('div.chip.chip-time', { title: t('hud.day') }, this.dayIcon, h('bdi', null, this.day));
    const coinChip = h('div.chip.chip-coin', { title: t('contract.left') }, h('span.chip-ic', { html: iconSvg('coin', 22) }), h('bdi', null, this.coins));
    const speed = h('div.speed', { role: 'group', 'aria-label': t('tool.speed') });
    const sp: [Speed, string, string][] = [[0, iconSvg('pause', 20), t('speed.pause')], [1, '×1', t('speed.x1')], [2, '×2', t('speed.x2')], [4, '×4', t('speed.x4')]];
    for (const [s, face, label] of sp) {
      const b = h('button.seg', { 'aria-label': label, title: label, 'aria-pressed': 'false', html: `<span>${face}</span>` });
      b.addEventListener('click', () => this.act.setSpeed(s));
      speed.append(b);
      this.speedBtns.set(s, b);
    }
    const hint = h('div.rail-hint', null, t('hud.openPhone'));
    const top = h('div.topbar', null, menuBtn, h('div.chips', null, dayChip, coinChip), speed, hint);

    // ---- contract: ribbon (folds), panel with seals + snow pill, a bar per good, pace rows
    this.wbTitle = h('span.rb-t');
    const ribbon = h('button.ribbon', { 'data-wb': 'fold', 'aria-label': t('hud.collapse'), 'aria-expanded': 'true' }, this.wbTitle);
    this.wbSeals = h('span.wb-seals-slot');
    this.wbPill = h('span.snow-pill.num');
    this.wbBody = h('div.wb-body');
    const panel = h('div.wb-panel', null, h('div.wb-head', null, this.wbSeals, this.wbPill), this.wbBody);
    const waybill = h('div.waybill', { role: 'region', 'aria-label': t('contract.title') }, ribbon, panel);
    this.sealOnly = h('button.seal-only', { 'aria-label': t('hud.expand') });
    this.waybillWrap = h('div.waybill-wrap', null, waybill, this.sealOnly);
    this.waybillWrap.classList.toggle('is-collapsed', collapsed);
    this.sealOnly.addEventListener('click', () => {
      if (this.compact) this.act.openCastle();
      else { this.sheetFold = false; this.setCollapsed(false); }
    });
    waybill.addEventListener('keydown', (e) => {
      const wb = (e.target as HTMLElement).dataset.wb;
      if ((e.key === 'Enter' || e.key === ' ') && wb && wb !== 'fold') { e.preventDefault(); this.openWb(wb); }
    });
    waybill.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-wb]');
      if (!el) return;
      const wb = (el as HTMLElement).dataset.wb ?? '';
      if (wb === 'fold') this.setCollapsed(true);
      else this.openWb(wb);
    });

    // ---- town plaque (free valley): rank under the ribbon, the checklist towards the next rank, income
    this.plTitle = h('span.rb-t');
    const plRibbon = h('button.ribbon', { 'data-pl': 'fold', 'aria-label': t('town.fold'), 'aria-expanded': 'true' }, this.plTitle);
    this.plBody = h('div.wb-panel.plaque', { role: 'button', tabindex: '0', 'aria-label': t('town.open') });
    this.plaqueOnly = h('button.seal-only', { 'aria-label': t('town.unfold') });
    this.plaqueWrap = h('div.waybill-wrap.plaque-wrap', null, h('div.waybill', null, plRibbon, this.plBody), this.plaqueOnly);
    this.plaqueWrap.hidden = true;
    this.plaqueWrap.classList.toggle('is-collapsed', collapsed);
    this.plaqueOnly.addEventListener('click', () => {
      if (this.compact) this.act.openMarket();
      else this.setCollapsed(false);
    });
    plRibbon.addEventListener('click', () => this.setCollapsed(true));
    this.plBody.addEventListener('click', () => this.act.openMarket());
    this.plBody.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.act.openMarket(); }
    });

    // ---- bottom: worst stall card + alarm seal
    this.stallText = h('span.sc-text');
    this.stallEye = h('button.stall-eye', { html: iconSvg('eye', 28) });
    this.stallEye.addEventListener('click', () => { const w = this.stalls[0]; if (w) { this.lastShown = w.id; this.act.showStall(w.id); } });
    const card = h('div.stall-card', { role: 'status' }, h('span.sc-txt', null, h('span.sc-kick', null, t('hud.worst')), this.stallText), this.stallEye);
    this.alarmIcon = h('span.al-ic');
    this.alarmBadge = h('span.al-badge.num');
    this.alarm = h('button.alarm-seal', null, this.alarmIcon, this.alarmBadge);
    this.alarm.addEventListener('click', () => this.nextStall());
    this.stallRow = h('div.stall-row', null, card, this.alarm);
    this.stallRow.hidden = true;

    // ---- tool cards
    const tools = h('div.rail-tools');
    const defs: [string, IconId, string, () => void][] = [
      ['build', 'build', t('tool.build'), () => this.act.setTool(this.toolOn('build') ? 'none' : 'build')],
      ['road', 'road_dirt', t('tool.road'), () => this.act.setTool(this.toolOn('road') ? 'none' : 'road')],
      ['cobble', 'road_cobble', t('tool.cobble'), () => this.act.setTool(this.toolOn('cobble') ? 'none' : 'cobble')],
      ['demolish', 'demolish', t('tool.demolish'), () => this.act.setTool(this.toolOn('demolish') ? 'none' : 'demolish')],
      ['wagon', 'buy_wagon', t('tool.wagon'), () => this.act.buyWagon()],
      ['overlay', 'overlay_load', t('tool.overlay'), () => this.act.toggleOverlay()],
    ];
    this.wagonLabel = h('span.tl');
    this.wagonCost = h('span.cost.num');
    for (const [id, icon, label, fn] of defs) {
      const b = h('button.tool', { 'aria-label': label, 'data-tool': id });
      b.innerHTML = `<span class="ti">${iconSvg(icon, 30)}</span>`;
      if (id === 'wagon') {
        this.wagonLabel.textContent = label;
        this.wagonCost.textContent = fmtInt(WAGON_PRICE);
        b.append(this.wagonLabel, this.wagonCost);
      } else b.append(h('span.tl', null, label));
      b.addEventListener('click', fn);
      tools.append(b);
      this.toolBtns.set(id, b);
    }
    const rail = h('nav.rail', { 'aria-label': t('tool.menu') }, this.stallRow, tools);

    // ---- valley events (D-54): under the plaque, free valley only
    this.events = new EventCard({ command: (c) => this.act.eventCommand(c), toast: (text, icon) => this.toast(text, 'info', icon, 4200) });

    this.toasts = h('div.toasts', { 'aria-live': 'polite' });
    this.live = h('div.sr-only', { 'aria-live': 'polite', role: 'status' });
    this.root = h('div', null, h('div.hud-top', null, top, this.waybillWrap, this.plaqueWrap, this.events.root), rail, this.toasts, this.live);
    this.setBuild(false);
    // notices sit under the top cluster: its height changes with folding, pace rows, layout
    try {
      this.topObserver = new ResizeObserver(() => this.measureTop());
      for (const el of [top, this.waybillWrap, this.plaqueWrap, this.events.root, speed]) this.topObserver.observe(el);
    } catch { /* old WebView: CSS fallback */ }
  }

  /**
   * --hud-top: bottom edge of the whole top cluster (bar + contract); --bar-b: bottom of the chips and
   * speed alone; --ev-b: bottom of the landscape news card (0 when it is not beside the bar). Notices and the landscape build shelf hang below them. Measured on resize only.
   */
  private measureTop(): void {
    let y = 0, bar = 0, ev = 0;
    for (const el of this.root.querySelectorAll<HTMLElement>('.hud-top > *, .topbar > *')) {
      // landscape: the news card hangs beside the contract, not below it; notices go under the card (--ev-b).
      // (checked first: a position: fixed element has no offsetParent)
      if (!el.hidden && el.classList.contains('ev-card') && getComputedStyle(el).position === 'fixed') { ev = el.getBoundingClientRect().bottom; continue; }
      if (el.hidden || !el.offsetParent || el.classList.contains('topbar')) continue;
      const b = el.getBoundingClientRect().bottom;
      y = Math.max(y, b);
      if (el.matches('.chips, .speed, .menu-btn')) bar = Math.max(bar, b);
    }
    const root = document.documentElement.style;
    root.setProperty('--hud-top', `${Math.round(y)}px`);
    root.setProperty('--bar-b', `${Math.round(bar)}px`);
    root.setProperty('--ev-b', `${Math.round(ev)}px`);
  }

  dispose(): void {
    this.topObserver?.disconnect();
  }

  /** A waybill target: "b:<id>" opens that building (the pace line's supplier), anything else the castle. */
  private openWb(wb: string): void {
    if (wb.startsWith('b:')) this.act.openBuilding(Number(wb.slice(2)));
    else this.act.openCastle();
  }

  /** Alarm seal: the next stall after the one shown last (worst first). */
  private nextStall(): void {
    const n = this.stalls.length;
    if (!n) return;
    const i = this.stalls.findIndex((s) => s.id === this.lastShown);
    const next = this.stalls[(i + 1) % n]!;
    this.lastShown = next.id;
    this.act.showStall(next.id);
  }

  /** The build tool exists in the free valley and in missions that allow building. */
  setBuild(on: boolean): void {
    const b = this.toolBtns.get('build');
    if (b) b.hidden = !on;
    this.root.classList.toggle('has-build', on);
  }

  private toolOn(id: string): boolean {
    return this.toolBtns.get(id)?.classList.contains('is-on') ?? false;
  }

  private setCollapsed(c: boolean): void {
    this.collapsed = c;
    this.applyFold();
    this.act.waybillCollapsed(c);
  }

  private applyFold(): void {
    const f = this.folded();
    this.waybillWrap.classList.toggle('is-collapsed', f);
    this.plaqueWrap.classList.toggle('is-collapsed', f);
    this.events.setHudFolded(f);
    this.lastSig = '';
    this.sealsSig = '';
    this.plaqueSig = '';
    requestAnimationFrame(() => this.measureTop());
  }

  private folded(): boolean {
    return this.collapsed || this.compact || this.sheetFold;
  }

  /** A bottom sheet opened / closed (portrait): fold the waybill meanwhile, keep the player's preference. */
  setSheetFold(c: boolean): void {
    if (this.sheetFold === c) return;
    this.sheetFold = c;
    this.applyFold();
  }

  /** Tiny screen (Flip cover): show only the seal, keep the player's own collapse preference. */
  setCompact(c: boolean): void {
    if (this.compact === c) return;
    this.compact = c;
    this.applyFold();
  }

  /** After a layout change (rotation, fold): re-measure the top cluster. */
  relayout(): void {
    requestAnimationFrame(() => this.measureTop());
  }

  setTool(tool: Tool, overlay: boolean): void {
    for (const [id, b] of this.toolBtns) {
      const on = id === tool || (id === 'overlay' && overlay);
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    }
  }

  setSpeed(s: Speed): void {
    for (const [k, b] of this.speedBtns) {
      b.classList.toggle('is-on', k === s);
      b.setAttribute('aria-pressed', String(k === s));
    }
  }

  /**
   * Cheap; call every frame — only touches the DOM when values change. `pace`: the delivery log the
   * app samples every tick (contract pace forecast, F10). `stalls`: rankStalls() of this frame.
   */
  update(world: World, pace: PaceLog | null = null, stalls: StallEntry[] = []): void {
    const st = world.state;
    setText(this.coins, fmtInt(st.coins));
    const raining = isRaining(st);
    setText(this.day, dayClock(timeOfDay(world)));
    const dayKey = raining ? 'rain' : 'sun';
    if (this.dayIcon.dataset.k !== dayKey) {
      this.dayIcon.dataset.k = dayKey;
      this.dayIcon.innerHTML = iconSvg(dayKey, 22);
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
    this.updateStalls(world, stalls);
    this.updateWagon(st.coins);

    if (seasonal(world)) this.updateSeasons(world);

    const c = st.mission.contract;
    this.waybillWrap.hidden = !c;
    const sb = c ? null : sandboxStatus(world);
    this.plaqueWrap.hidden = !sb?.market;
    if (sb?.market) this.updatePlaque(sb, seasonal(world) ? seasonAt(st.tick) : null, yearAt(st.tick));
    this.events.update(world);
    if (c) this.updateContract(world, c, pace);
  }

  /** Kup wóz: the cost badge, the shortfall in place of the label when silver is short, the cure mark. */
  private updateWagon(coins: number): void {
    const b = this.toolBtns.get('wagon');
    if (!b) return;
    const short = Math.max(0, WAGON_PRICE - coins);
    const sig = `${short}|${this.cure}`;
    if (sig === this.wagonSig) return;
    this.wagonSig = sig;
    b.classList.toggle('is-disabled', short > 0);
    b.setAttribute('aria-disabled', String(short > 0));
    setText(this.wagonLabel, short > 0 ? t('tool.wagonShort', { n: fmtInt(short) }) : t('tool.wagon'));
    b.setAttribute('aria-label', short > 0 ? `${t('tool.wagon')} — ${t('fix.short', { n: fmtInt(short) })}` : t('tool.wagon'));
    for (const [id, tb] of this.toolBtns) tb.classList.toggle('is-cure', (id === 'wagon' && this.cure === 'wagon' && short === 0) || (id === 'road' && this.cure === 'road'));
  }

  /** Worst stall card and alarm seal; only rewritten when the worst stall, its cause or the count change. */
  private updateStalls(world: World, stalls: StallEntry[]): void {
    this.stalls = stalls;
    const w = stalls[0];
    const b = w ? buildingById(world, w.id) : null;
    this.cure = b ? cureFor(world, b.id) : null;
    const sig = b ? `${b.id}|${JSON.stringify(b.status)}|${stalls.length}|${w!.crit}|${getLang()}` : '';
    if (sig === this.stallSig) return;
    this.stallSig = sig;
    this.wagonSig = '';
    this.stallRow.hidden = !b;
    this.root.classList.toggle('has-stall', !!b);
    if (!b || !w) return;
    const name = buildingName(world, b.id);
    setHtml(this.stallText, `<b>${esc(name)}:</b> <span dir="auto">${esc(stallReason(world, b.id))}</span>`);
    this.stallRow.classList.toggle('is-crit', w.crit);
    this.stallEye.setAttribute('aria-label', t('hud.worstShow', { name }));
    setHtml(this.alarmIcon, buildingStatusIcon(b.status, 34, b.type));
    setText(this.alarmBadge, fmtInt(stalls.length));
    this.alarm.setAttribute('aria-label', t('hud.stallsNext', { n: stalls.length }));
  }

  private updateContract(world: World, c: Contract, pace: PaceLog | null): void {
    const st = world.state;
    const castle = st.buildings.find((b) => b.id === c.castle);
    const stock = castle ? castle.stock : emptyGoods();
    const goods = GOODS.filter((g) => c.need[g] > 0) as Good[];
    const have = goods.map((g) => Math.min(stock[g], c.need[g]));
    const tr = c.tranches;
    const cur = tr.findIndex((x) => x.doneTick < 0);
    // the clock runs to the tranche now due (its own deadline), or to the contract deadline
    const dueTick = cur >= 0 && !tr[cur]!.missed ? tr[cur]!.deadlineTick : c.deadlineTick;
    const left = Math.max(0, dueTick - st.tick);
    const late = left < 120 * TICK_HZ;
    const total = goods.reduce((a, g) => a + c.need[g], 0);
    const got = have.reduce((a, v) => a + v, 0);
    const frac = got / Math.max(1, total);
    this.contractMilestones(st.mission.result === 'running', frac, got, total, dueTick, left);
    const folded = this.folded();
    if (folded) {
      setHtml(this.sealOnly, sealOnly(frac, ticksClock(left)));
      this.sealOnly.classList.toggle('late', late);
      return;
    }
    setText(this.wbTitle, missionTitle(st.mission.id));
    setHtml(this.wbPill, `${iconSvg('snow', 18)}<span>${tHtml('contract.toSnow', { time: ticksClock(left) })}</span>`);
    this.wbPill.classList.toggle('late', late);

    const fc = pace ? forecastFor(world, pace) : null;
    const ready = !!fc && fc.ready && fc.bottleneck >= 0;
    const missed = tr.filter((x) => x.missed).length;
    const sealN = tr.length ? 3 - missed : ready ? fc!.seals : 0;
    const sealsSig = `${sealN}|${ready}|${tr.length}`;
    if (sealsSig !== this.sealsSig) {
      this.sealsSig = sealsSig;
      setHtml(this.wbSeals, seals(sealN, t('contract.stars', { n: sealN }), !tr.length && !ready));
    }
    const fcSig = ready ? `${fc!.seals}:${Math.floor((fc!.finishTick - st.tick) / TICK_HZ)}:${fc!.bottleneck}:${Math.round((fc!.goods[fc!.bottleneck]?.perMin ?? 0) * 10)}` : '';
    const sig = `${have.join(',')}|${tr.map((x) => `${x.doneTick >= 0 ? 1 : 0}${x.missed ? 1 : 0}`).join('')}|${fcSig}|${getLang()}`;
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    const line = (g: Good, got: number, need: number): string => `<div class="wb-line${got >= need ? ' done' : ''}" data-wb="castle" data-g="${g}" role="button" tabindex="0">
        <span class="wb-gi">${iconSvg(g, 22, goodName(g))}</span>${bar(got / Math.max(1, need))}
        <bdi class="count num">${fmtInt(got)}<small>/${fmtInt(need)}</small></bdi></div>`;
    let body: string;
    if (!tr.length) {
      body = `<div class="wb-goods">${goods.map((g, i) => line(g, have[i]!, c.need[g])).join('')}</div>${waybillPaceHtml(world, fc)}`;
    } else {
      body = `<ol class="wb-tranches">${tr.map((x, i) => {
        const tg = GOODS.filter((g) => x.need[g] > 0) as Good[];
        const got = trancheHave(c, stock, i);
        const head = `<span class="tr-n">${ROMAN[i] ?? i + 1}.</span><span class="tr-t">${tHtml('contract.tranche', { n: i + 1, time: ticksClock(x.deadlineTick) })}</span>`;
        if (x.doneTick >= 0) {
          return `<li class="wb-tr is-done${x.missed ? ' is-late' : ''}" data-wb="castle"><div class="tr-h">${head}<i class="kseal${x.missed ? '' : ' on'}"></i></div>
            <div class="tr-state">${esc(t(x.missed ? 'contract.trancheLate' : 'contract.trancheDone'))}</div></li>`;
        }
        if (i === cur) {
          return `<li class="wb-tr is-now${x.missed ? ' is-late' : ''}"><div class="tr-h">${head}</div>
            <div class="wb-goods">${tg.map((g) => line(g, got[g], x.need[g])).join('')}</div>
            ${x.missed ? `<div class="tr-state">${esc(t('contract.trancheLate'))}</div>` : ''}</li>`;
        }
        return `<li class="wb-tr is-later" data-wb="castle"><div class="tr-h">${head}</div>
          <div class="tr-goods">${tg.map((g) => `<span>${iconSvg(g, 18, goodName(g))}${bdi(fmtInt(x.need[g]))}</span>`).join('')}</div></li>`;
      }).join('')}</ol>`;
    }
    setHtml(this.wbBody, body);
    // a delivery: the line of each good that rose flashes once (240 ms, CSS), so the eye finds what changed
    goods.forEach((g, i) => {
      const before = this.prevHave.get(g);
      if (before !== undefined && have[i]! > before) this.wbBody.querySelector(`.wb-line[data-g="${g}"]`)?.classList.add('is-bump');
      this.prevHave.set(g, have[i]!);
    });
  }

  /**
   * One notice per milestone while the contract runs (BACKLOG P2 "10-minute session"): half the goods
   * in the castle, two minutes and the last minute before the deadline now due (each tranche has its
   * own), with how many units are still missing. Milestones already passed when the HUD first sees the
   * contract (a loaded game) stay silent.
   */
  private contractMilestones(running: boolean, frac: number, got: number, total: number, dueTick: number, left: number): void {
    const first = this.milestones === null;
    const seen = (this.milestones ??= new Set());
    const fire = (key: string, icon: IconId, text: string): void => {
      if (seen.has(key)) return;
      seen.add(key);
      if (!first && running) this.showNotice(icon, esc(text));
    };
    if (frac >= 1) return;
    const missing = fmtInt(total - got);
    if (frac >= 0.5) fire('half', 'seal', t('contract.half', { have: fmtInt(got), total: fmtInt(total) }));
    if (left <= 0) return;
    if (left < 60 * TICK_HZ) fire(`${dueTick}:1`, 'snow', t('contract.lastMin', { n: missing }));
    else if (left < 120 * TICK_HZ) fire(`${dueTick}:2`, 'snow', t('contract.twoMin', { n: missing }));
  }

  /**
   * Seasons (free valley): a notice two game minutes before each change (season, thaw, ice), once per
   * event, and a short line saying what a season changes when it begins. Reads the calendar only.
   */
  private updateSeasons(world: World): void {
    const tick = world.state.tick;
    const season = seasonAt(tick), thaw = thawing(world);
    const ch = nextChange(tick);
    const key = `${ch.kind}:${ch.atTick}`;
    if (this.lastSeason !== null && season !== this.lastSeason) {
      const fx = SEASON_EFFECT[season];
      // winter slows fishers too (50%), not only farms: say both in the one notice
      const text = season === 'winter' ? `${t('season.effect.winter-farm')} ${t('season.effect.winter-fisher')}` : fx ? t(fx) : t(`season.${season}`);
      this.showNotice(SEASON_ICON[season], esc(text));
    } else if (this.lastSeason !== null && thaw && !this.wasThaw) {
      this.showNotice('road_dirt', esc(t(SEASON_EFFECT.thaw!)));
    } else if (ch.announced && key !== this.announced) {
      this.announced = key;
      const time = ticksClock(ch.ticksUntil);
      const text = ch.kind === 'season'
        ? t('season.notice.season', { time, season: t(`season.${ch.nextSeason}`) })
        : t(`season.notice.${ch.kind}`, { time });
      this.showNotice(ch.kind === 'season' ? SEASON_ICON[ch.nextSeason] : CHANGE_ICON[ch.kind]!, esc(text));
    }
    this.lastSeason = season;
    this.wasThaw = thaw;
  }

  /** The free valley's plaque: rank on the ribbon, a checklist towards the next one, income, season and year. */
  private updatePlaque(sb: SandboxStatus, season: Season | null, year: number): void {
    if (this.lastRank >= 0 && sb.rank > this.lastRank) this.act.rankUp(sb.rank);
    this.lastRank = sb.rank;
    const n = sb.next;
    const folded = this.folded();
    const reqs = n ? [
      { label: t('town.renownShort'), have: sb.renown, need: n.renown },
      { label: t('town.goodsShort'), have: sb.goodsSold, need: n.goods },
      { label: t('town.flowShort'), have: sb.bestFlow, need: n.flow },
    ] : [];
    // the seal fills with the share of the next rank already earned (each requirement weighs a third)
    const frac = n ? reqs.reduce((a, r) => a + Math.min(1, r.have / Math.max(1, r.need)), 0) / reqs.length : 1;
    const sig = `${sb.rank}|${reqs.map((r) => `${r.have}`).join(',')}|${sb.flowNow}|${folded}|${season}|${year}|${getLang()}`;
    if (sig === this.plaqueSig) return;
    this.plaqueSig = sig;
    if (folded) {
      setHtml(this.plaqueOnly, sealOnly(frac, `+${fmtInt(sb.flowNow)}/min`));
      return;
    }
    setText(this.plTitle, rankName(sb.rank));
    const income = `<span class="pl-income">${iconSvg('coin', 18)}<span>${tHtml('town.income', { n: fmtInt(sb.flowNow) })}</span></span>`;
    const when = season ? `<span class="pl-season is-${season}">${iconSvg(SEASON_ICON[season], 18)}<span>${tHtml('season.when', { season: t(`season.${season}`), year: fmtInt(year) })}</span></span>` : '';
    const rows = reqs.map((r) => {
      const met = r.have >= r.need;
      return `<li class="${met ? 'is-met' : ''}"><span class="pl-l">${esc(r.label)}</span>
        <bdi class="num pl-v">${fmtInt(Math.min(r.have, 99999))}<small>/${fmtInt(r.need)}</small></bdi>
        ${bar(r.have / Math.max(1, r.need), ' pl-bar')}</li>`;
    }).join('');
    const next = n ? `<div class="pl-next">${tHtml('town.toNext', { name: rankName(n.rank) })}</div><ul class="pl-req">${rows}</ul>`
      : `<div class="pl-next">${esc(t('town.top'))}</div>`;
    setHtml(this.plBody, `${next}<div class="pl-foot">${income}${when}</div>`);
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
    letter.append(h('i.rl-seal.kseal.on', { 'aria-hidden': 'true' }));
    const wrap = h('button.rank-letter-wrap.hit', { 'aria-label': t('sheet.close') }, h('div.float', null, letter));
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
    const el = h('div.toast', null);
    if (kind === 'err') el.classList.add('err');
    el.innerHTML = `${icon ? iconSvg(icon, 22) : ''}<span>${text.replace(/</g, '&lt;')}</span><b class="toast-n num"></b>`;
    const wrap = h('div.toast-wrap', null, el) as HTMLElement & { __toast?: { text: string; n: number; timer: number } };
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
    this.measureTop(); // the news card may have appeared since the last resize: the notice goes under it (--ev-b)
    const el = h('div.notice', { role: 'status', html: `${iconSvg(icon, 26)}<span>${text}</span>` });
    const wrap = h('div.notice-wrap', null, el);
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
