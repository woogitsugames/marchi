// Main menu strip over the live scene, the settings sheet, the in-game menu sheet and the
// end-of-mission sealed letter.
import { LANG_NAMES, availableLangs, getLang, setLang, t, type Lang, type MessageKey } from '../i18n/index';
import { GOODS, MISSIONS, topStallCauses, type World } from '../sim/index';
import { deckle, esc, h, setHtml } from './dom';
import { bdi, buildingName, clock, fmtInt, goodName, iso, rankName, tHtml, ticksClock, wagonName } from './format';
import { saveErrorMessageKey } from '../platform/saveGate';
import { VALLEY_SLOTS, type SlotSummary, type ValleySlot } from '../platform/save';
import { iconSvg } from './icons';
import type { Sheet, SheetContent } from './sheets';
import type { QualityChoice, QualityPref } from './tier';

/** Missions offered in the main menu, in order (the hidden test bench 'lab' never appears). */
export const MENU_MISSIONS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'] as const;
export type MissionKey = (typeof MENU_MISSIONS)[number] | 'sandbox';

export function isMissionKey(x: string | null | undefined): x is MissionKey {
  return x === 'sandbox' || (MENU_MISSIONS as readonly string[]).includes(x ?? '');
}

/** Menu title of a mission ("IV. Zima na przeprawie", "Wolna dolina"). */
export function missionTitle(id: string): string {
  return isMissionKey(id) ? t(id === 'sandbox' ? 'menu.sandbox' : `menu.${id}` as MessageKey) : t('menu.m1');
}

function missionSub(id: MissionKey): string {
  if (id === 'sandbox') return t('menu.valleySub');
  if (id === 'm1') return t('menu.contractSub');
  return t(`menu.${id}Sub` as MessageKey);
}

export interface MenuActions {
  continueGame(): void;
  newGame(mission: MissionKey): void;
  /** Free valley: the ledger (slot) picker. */
  openValley(): void;
  openSettings(): void;
}

export interface SaveInfo { missionId: string; tick: number; slot: string }

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** "Księga II" for a valley slot. */
export function slotLabel(slot: ValleySlot): string {
  return t('valley.slot', { n: ROMAN[VALLEY_SLOTS.indexOf(slot)] ?? '?' });
}

function slotNumeral(slot: ValleySlot): string {
  return ROMAN[VALLEY_SLOTS.indexOf(slot)] ?? '?';
}

/** "Wolna dolina, Księga II" for a valley save, the mission title otherwise. */
function saveWhat(save: SaveInfo): string {
  const slot = VALLEY_SLOTS.find((v) => v === save.slot);
  return slot ? t('valley.what', { mode: missionTitle('sandbox'), slot: slotLabel(slot) }) : missionTitle(save.missionId);
}

/** broken = the save could not be loaded: show why and offer that contract afresh. */
export function buildMainMenu(act: MenuActions, save: SaveInfo | null, broken: MissionKey | null = null): HTMLElement {
  const items: HTMLElement[] = [];
  const item = (label: string, sub: string, fn: () => void, primary = false, cls = ''): void => {
    const b = h(`button.menu-item${primary ? '.primary' : ''}${cls}` as 'button.menu-item', null,
      h('span.mi-mark'),
      h('span.mi-text', null, label, sub ? h('span.mi-sub', null, sub) : null));
    b.addEventListener('click', fn);
    items.push(h('li', null, b));
  };
  if (save) {
    item(t('menu.continue'), t('menu.continueSub', { what: saveWhat(save), time: iso(ticksClock(save.tick)) }), act.continueGame, true);
  }
  for (const id of MENU_MISSIONS) item(missionTitle(id), missionSub(id), () => act.newGame(id), id === 'm1' && !save);
  item(missionTitle('sandbox'), missionSub('sandbox'), act.openValley, false, '.is-valley');
  item(t('menu.settings'), '', act.openSettings);
  let err: HTMLElement | null = null;
  if (broken) {
    // a damaged valley ledger is dealt with in the picker (delete it there); a contract starts afresh
    const again = h('button.btn.primary.cf', null, t(broken === 'sandbox' ? 'valley.brokenOpen' : 'menu.saveBrokenNew'));
    again.addEventListener('click', () => { if (broken === 'sandbox') act.openValley(); else act.newGame(broken); });
    err = h('div.menu-error', { role: 'alert' }, h('p', null, t('menu.saveBroken')), again);
  }
  const strip = h('div.menu-strip', null,
    h('h1.title', null, t('app.title')),
    h('p.subtitle', null, t('app.subtitle')),
    h('div.rule'),
    err,
    h('ul.menu-list', null, ...items),
  );
  strip.style.clipPath = deckle('bottom', 977, 9, 30);
  return h('div.menu-wrap', null, strip, h('span.menu-pin'));
}

export interface SettingsActions {
  quality(): QualityPref;
  setQuality(q: QualityPref): void;
  /** What 'auto' resolved to on this device. */
  autoQuality(): QualityChoice;
  leftHanded(): boolean;
  setLeftHanded(v: boolean): void;
  musicVolume(): number;
  effectsVolume(): number;
  /** commit = slider released: persist */
  setVolume(kind: 'music' | 'effects', v: number, commit: boolean): void;
}

export function settingsSheet(act: SettingsActions): SheetContent {
  return {
    key: 'settings',
    update(sheet: Sheet) {
      setHtml(sheet.icon, iconSvg('menu', 30));
      sheet.kicker.textContent = '';
      sheet.title.textContent = t('menu.settings');
      const seg = (name: string, opts: [string, string][], cur: string): string =>
        `<div class="seg" role="group">${opts.map(([v, l]) =>
          `<button class="btn cf${v === cur ? ' is-on' : ''}" data-set="${name}:${v}" aria-pressed="${v === cur}">${esc(l)}</button>`).join('')}</div>`;
      // 17 languages: a 2-3 column grid of native names, each in its own language (lang/dir for fonts & screen readers)
      const langGrid = (cur: string): string =>
        `<div class="lang-grid" role="group" aria-label="${esc(t('menu.language'))}">${availableLangs().map((l) =>
          `<button class="btn cf${l === cur ? ' is-on' : ''}" data-set="lang:${l}" lang="${l}" dir="auto" aria-pressed="${l === cur}">${esc(LANG_NAMES[l])}</button>`).join('')}</div>`;
      const html = `
        <div class="setting"><span class="s-label">${esc(t('menu.language'))}</span>
          ${langGrid(getLang())}</div>
        <div class="setting"><span class="s-label">${esc(t('menu.quality'))}</span>
          ${seg('quality', [['auto', t('quality.auto')], ['low', t('quality.low')], ['high', t('quality.high')], ['ultra', t('quality.ultra')]], act.quality())}
          <div class="s-hint">${esc(act.quality() === 'auto' ? t('menu.qualityDetected', { q: t(`quality.${act.autoQuality()}` as MessageKey) }) : t('menu.qualityHint'))}</div></div>
        <div class="setting"><label class="s-label" for="vol-music">${esc(t('menu.music'))}</label>
          <input class="vol" id="vol-music" type="range" min="0" max="100" step="5" data-vol="music"></div>
        <div class="setting"><label class="s-label" for="vol-fx">${esc(t('menu.effects'))}</label>
          <input class="vol" id="vol-fx" type="range" min="0" max="100" step="5" data-vol="effects"></div>
        <div class="setting"><span class="s-label">${esc(t('menu.leftHanded'))}</span>
          ${seg('left', [['0', t('menu.off')], ['1', t('menu.on')]], act.leftHanded() ? '1' : '0')}</div>
        <div class="setting"><div class="s-hint">${esc(t('hud.clearHint'))}</div></div>`;
      if (setHtml(sheet.body, html)) {
        // slider values are set here, not in the HTML, so the 4 Hz refresh never rebuilds a slider mid-drag
        sheet.body.querySelectorAll<HTMLInputElement>('input[data-vol]').forEach((inp) => {
          const kind = inp.dataset.vol === 'music' ? 'music' : 'effects';
          const cur = kind === 'music' ? act.musicVolume() : act.effectsVolume();
          inp.value = String(Math.round(cur * 100));
          inp.style.setProperty('--v', `${inp.value}%`);
          inp.addEventListener('input', () => { inp.style.setProperty('--v', `${inp.value}%`); act.setVolume(kind, Number(inp.value) / 100, false); });
          inp.addEventListener('change', () => act.setVolume(kind, Number(inp.value) / 100, true));
        });
        sheet.body.querySelectorAll<HTMLElement>('[data-set]').forEach((b) => b.addEventListener('click', () => {
          const [k, v] = (b.dataset.set ?? '').split(':');
          if (k === 'lang') void setLang(v as Lang);
          if (k === 'quality') act.setQuality(v as QualityPref);
          if (k === 'left') act.setLeftHanded(v === '1');
          (sheet.body as HTMLElement & { __html?: string }).__html = undefined;
          this.update(sheet);
        }));
      }
      return true;
    },
  };
}

export interface ValleyActions {
  /** Reads the ledgers; rejects when IndexedDB fails or times out. */
  read(): Promise<SlotSummary[]>;
  play(slot: ValleySlot): void;
  /** Empty ledger: a new settlement. Filled ledger (after the confirm step): wipe and start over. */
  fresh(slot: ValleySlot): void;
  remove(slot: ValleySlot): Promise<void>;
}

const dateFmt = new Map<string, Intl.DateTimeFormat>();
/** Last-played stamp in the current language: "2 lis, 18:40" (year only when it is not this year). */
function playedAt(ms: number): string {
  const d = new Date(ms);
  const thisYear = d.getFullYear() === new Date().getFullYear();
  const key = `${getLang()}:${thisYear ? 'y' : 'n'}`;
  let f = dateFmt.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(`${getLang()}-u-nu-latn`, {
        day: 'numeric', month: 'short', ...(thisYear ? {} : { year: 'numeric' }), hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      });
    } catch { f = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }); }
    dateFmt.set(key, f);
  }
  return f.format(d);
}

/**
 * Free valley ledger picker (D-29): three rows. Filled = rank, renown, silver, play time, last played,
 * with "Play" and two small actions ("Start over", "Delete") behind an in-row confirm step. Empty =
 * "New settlement". Damaged = the gate's reason and "Delete" (confirmed).
 */
export function valleySheet(act: ValleyActions): SheetContent {
  let slots: SlotSummary[] | null = null;
  let failed = false;
  let confirm: { slot: ValleySlot; kind: 'delete' | 'fresh' } | null = null;
  let busy = false;
  let alive = true;
  let sheetRef: Sheet | null = null;
  const content: SheetContent = {
    key: 'valley',
    onClose() { alive = false; },
    update(sheet: Sheet) {
      sheetRef = sheet;
      setHtml(sheet.icon, iconSvg('castle', 30));
      sheet.kicker.textContent = missionTitle('sandbox');
      sheet.title.textContent = t('valley.title');
      let html: string;
      if (failed) {
        html = `<div class="menu-error slot-fail" role="alert"><p>${esc(t('valley.readFail'))}</p>
          <button class="btn primary cf" data-a="retry">${esc(t('valley.retry'))}</button></div>`;
      } else if (!slots) {
        html = `<p class="slot-loading">${esc(t('valley.loading'))}</p>`;
      } else {
        html = `<ol class="slots">${VALLEY_SLOTS.map((v) => rowHtml(v, slots!.find((x) => x.slot === v) ?? null)).join('')}</ol>`;
      }
      if (setHtml(sheet.body, html)) bind(sheet);
      return true;
    },
  };
  const rerender = (): void => {
    if (!alive || !sheetRef) return;
    content.update(sheetRef);
  };
  const load = (): void => {
    failed = false;
    slots = null;
    rerender();
    act.read().then((s) => { slots = s; rerender(); }, () => { failed = true; rerender(); });
  };
  function rowHtml(v: ValleySlot, s: SlotSummary | null): string {
    const no = `<span class="slot-no" aria-hidden="true">${slotNumeral(v)}</span>`;
    const label = esc(slotLabel(v));
    if (!s) {
      return `<li class="slot-row is-empty"><button class="slot-new" data-a="new" data-slot="${v}" aria-label="${label}: ${esc(t('valley.new'))}">
        ${no}<span class="slot-main"><span class="slot-name">${esc(t('valley.new'))}</span><span class="slot-sub">${esc(t('valley.newSub'))}</span></span>
        <span class="slot-go fwd" aria-hidden="true">${iconSvg('back', 20)}</span></button></li>`;
    }
    const conf = confirm && confirm.slot === v ? confirm.kind : null;
    if (!s.ok) {
      const body = conf
        ? `<p class="slot-ask">${esc(t('valley.confirmBroken', { n: slotNumeral(v) }))}</p>
           <div class="slot-acts two"><button class="btn paper cf" data-a="keep">${esc(t('valley.keep'))}</button>
           <button class="btn primary cf" data-a="yes" data-slot="${v}">${esc(t('valley.yesDelete'))}</button></div>`
        : `<div class="slot-acts"><button class="btn paper cf slot-small" data-a="ask-delete" data-slot="${v}">${esc(t('valley.delete'))}</button></div>`;
      return `<li class="slot-row is-broken${conf ? ' is-asking' : ''}" aria-label="${label}">${no}<div class="slot-main">
        <span class="slot-name">${esc(t('valley.broken'))}</span>
        <p class="slot-err" role="note">${esc(t(saveErrorMessageKey(s.code)))}</p>${body}</div></li>`;
    }
    const name = rankName(s.rank);
    const meta = `<dl class="slot-meta">
      <div><dt>${esc(t('town.renownShort'))}</dt><dd>${bdi(fmtInt(s.renown))}</dd></div>
      <div><dt>${esc(t('valley.silver'))}</dt><dd><span class="coin" aria-hidden="true">${iconSvg('coin', 16)}</span>${bdi(fmtInt(s.coins))}</dd></div>
      <div><dt>${esc(t('valley.played'))}</dt><dd>${bdi(ticksClock(s.tick))}</dd></div>
      <div><dt>${esc(t('valley.last'))}</dt><dd>${bdi(playedAt(s.savedAt), 'num when')}</dd></div></dl>`;
    let acts: string;
    if (conf) {
      const ask = conf === 'delete'
        ? t('valley.confirmDelete', { name, n: slotNumeral(v), renown: fmtInt(s.renown) })
        : t('valley.confirmFresh', { name, n: slotNumeral(v), renown: fmtInt(s.renown) });
      acts = `<p class="slot-ask" role="alert">${esc(ask)}</p>
        <div class="slot-acts two"><button class="btn paper cf" data-a="keep">${esc(t('valley.keep'))}</button>
        <button class="btn primary cf" data-a="yes" data-slot="${v}">${esc(t(conf === 'delete' ? 'valley.yesDelete' : 'valley.yesFresh'))}</button></div>`;
    } else {
      // wax-clay only on the ledger played last (the one primary action); the others are oak
      const latest = slots?.filter((x) => x.ok).reduce((m, x) => (x.savedAt > m.savedAt ? x : m)).slot === v;
      acts = `<div class="slot-acts"><button class="btn${latest ? ' primary' : ''} cf slot-play" data-a="play" data-slot="${v}">${esc(t('valley.play'))}</button>
        <button class="btn paper cf slot-small" data-a="ask-fresh" data-slot="${v}">${esc(t('valley.fresh'))}</button>
        <button class="btn paper cf slot-small" data-a="ask-delete" data-slot="${v}">${esc(t('valley.delete'))}</button></div>`;
    }
    return `<li class="slot-row is-filled${conf ? ' is-asking' : ''}" aria-label="${label}">${no}<div class="slot-main">
      <span class="slot-name">${esc(name)}</span>${meta}${acts}</div></li>`;
  }
  function bind(sheet: Sheet): void {
    sheet.body.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => b.addEventListener('click', () => {
      if (busy) return;
      const a = b.dataset.a;
      const slot = VALLEY_SLOTS.find((v) => v === b.dataset.slot) ?? null;
      if (a === 'retry') { load(); return; }
      if (a === 'keep') { confirm = null; rerender(); return; }
      if (!slot) return;
      if (a === 'new' || a === 'play') { if (a === 'new') act.fresh(slot); else act.play(slot); return; }
      if (a === 'ask-delete' || a === 'ask-fresh') { confirm = { slot, kind: a === 'ask-delete' ? 'delete' : 'fresh' }; rerender(); return; }
      if (a === 'yes' && confirm?.slot === slot) {
        const kind = confirm.kind;
        confirm = null;
        if (kind === 'fresh') { act.fresh(slot); return; }
        busy = true;
        act.remove(slot).then(() => { busy = false; load(); }, () => { busy = false; failed = true; rerender(); });
      }
    }));
  }
  queueMicrotask(load);
  return content;
}

export interface GameMenuActions {
  resume(): void;
  settings(): void;
  restart(): void;
  toMenu(): void;
}

/** slot: the free-valley ledger being written to (shown under the title), null for contracts. */
export function gameMenuSheet(act: GameMenuActions, world: World, slot: ValleySlot | null = null): SheetContent {
  // a free-valley settlement is hours of work: "start over" asks first (contracts restart at once)
  let asking = false;
  return {
    key: 'gamemenu',
    update(sheet: Sheet) {
      setHtml(sheet.icon, iconSvg('pause', 30));
      sheet.kicker.textContent = t('menu.paused');
      sheet.title.textContent = world.state.mission.contract ? t('menu.contractItem') : t('hud.sandbox');
      const note = slot ? `<p class="slot-note"><span class="slot-no" aria-hidden="true">${slotNumeral(slot)}</span>${esc(t('valley.saving', { n: slotNumeral(slot) }))}</p>` : '';
      const restart = asking && slot
        ? `<div class="slot-row is-asking pause-ask"><span class="slot-no" aria-hidden="true">${slotNumeral(slot)}</span><div class="slot-main">
            <p class="slot-ask" role="alert">${esc(t('valley.confirmFresh', { n: slotNumeral(slot), name: rankName(world.state.town?.rank ?? 0), renown: fmtInt(world.state.town?.renown ?? 0) }))}</p>
            <div class="slot-acts two"><button class="btn paper cf" data-a="keep">${esc(t('valley.keep'))}</button>
            <button class="btn primary cf" data-a="restart">${esc(t('valley.yesFresh'))}</button></div></div></div>`
        : `<button class="btn cf" data-a="${slot ? 'ask' : 'restart'}">${esc(t('menu.restart'))}</button>`;
      const html = `${note}<div class="sheet-actions" style="flex-direction:column">
        <button class="btn primary cf" data-a="resume">${esc(t('menu.resume'))}</button>
        <button class="btn cf" data-a="settings">${esc(t('menu.settings'))}</button>
        ${restart}
        <button class="btn cf" data-a="menu">${esc(t('menu.toMenu'))}</button></div>`;
      if (setHtml(sheet.body, html)) {
        sheet.body.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => b.addEventListener('click', () => {
          const a = b.dataset.a;
          if (a === 'resume') act.resume();
          if (a === 'settings') act.settings();
          if (a === 'ask' || a === 'keep') { asking = a === 'ask'; this.update(sheet); }
          if (a === 'restart') act.restart();
          if (a === 'menu') act.toMenu();
        }));
      }
      return true;
    },
  };
}

export interface EndActions { again(): void; menu(): void }

/** Who a ledger key ('building:5:NO_ROAD', 'wagon:9:NO_ROUTE', 'span:812:BRIDGE_JAM') is about. */
function causeSubject(world: World, kind: string, id: number): string {
  if (kind === 'building') return buildingName(world, id);
  if (kind === 'wagon') return wagonName(id);
  return t('ledger.bridge');
}

/** Reason text for a ledger status string ('K' or 'K.cause'): its own short key, else the base key. */
function causeReason(status: string): string {
  const key = `cause.${status}` as MessageKey;
  const base = `cause.${status.split('.')[0]}` as MessageKey;
  const s = t(key);
  return s !== key ? s : t(base) !== base ? t(base) : status;
}

/** The three root causes that cost the most time, as a short ledger (subject — reason ...... m:ss). */
function causesHtml(world: World): string {
  const top = topStallCauses(world, 3).filter((c) => c.seconds >= 5);
  const rows = top.length
    ? top.map((c) => `<li><span class="lg-what"><b>${esc(causeSubject(world, c.kind, c.id))}</b> <span dir="auto">${esc(causeReason(c.status))}</span></span>` +
      `<span class="lg-dots" aria-hidden="true"></span>${bdi(clock(c.seconds), 'lg-time num')}</li>`).join('')
    : `<li class="lg-none">${esc(t('contract.noStalls'))}</li>`;
  return `<div class="ledger"><div class="lg-h">${esc(t('contract.causes'))}</div><ol>${rows}</ol></div>`;
}

/** The sealed letter at the end of a contract. seals = stars(world) 0..3. */
export function buildEndLetter(world: World, seals: number, act: EndActions): HTMLElement {
  const st = world.state;
  const won = st.mission.result === 'won';
  const c = st.mission.contract;
  const castle = c ? st.buildings.find((b) => b.id === c.castle) : null;
  const delivered = c ? GOODS.filter((g) => c.need[g] > 0).map((g) =>
    `<span class="dl-item">${iconSvg(g, 20)}<span>${tHtml('contract.deliveredItem', { count: `${fmtInt(Math.min(castle?.stock[g] ?? 0, c.need[g]))}/${fmtInt(c.need[g])}`, good: goodName(g) })}</span></span>`).join('') : '';
  const def = MISSIONS[st.mission.id];
  const sealRow = [0, 1, 2].map((i) => `<span class="s${i < seals ? '' : ' off'}">${iconSvg('seal', 52)}</span>`).join('');
  const letter = h('div.letter' + (won ? '' : '.lost') as 'div.letter', { role: 'dialog', 'aria-modal': 'true' });
  letter.innerHTML = `
    <div class="l-kicker">${esc(t('contract.kicker'))}</div>
    <h2>${esc(t((won ? 'contract.won' : 'contract.lost') as MessageKey))}</h2>
    <p>${esc(t(won ? 'contract.wonText' : 'contract.lostText'))}</p>
    ${won ? `<div class="seals">${sealRow}<span class="s-label">${esc(t('contract.stars', { n: seals }))}</span></div>` : ''}
    <dl class="kv">
      <dt>${esc(t('contract.time'))}</dt><dd>${bdi(ticksClock(st.mission.endTick >= 0 ? st.mission.endTick : st.tick))}${def ? `<span class="of-limit">${bdi(`/ ${clock(def.deadlineMin * 60)}`)}</span>` : ''}</dd>
      <dt>${esc(t('contract.delivered'))}</dt><dd>${delivered}</dd>
      <dt>${esc(t('contract.left'))}</dt><dd>${bdi(fmtInt(st.coins))}</dd>
    </dl>
    ${c ? causesHtml(world) : ''}
    <div class="actions">
      <button class="btn primary cf" data-a="again">${esc(t('contract.again'))}</button>
      <button class="btn cf" data-a="menu">${esc(t('contract.menu'))}</button>
    </div>`;
  letter.style.clipPath = deckle('bottom', 31, 6, 30);
  letter.querySelector('[data-a="again"]')!.addEventListener('click', act.again);
  letter.querySelector('[data-a="menu"]')!.addEventListener('click', act.menu);
  const seal = h('span.big-seal', { html: iconSvg('seal', 72) });
  if (!won) seal.classList.add('broken');
  return h('div.scrim', null, h('div.letter-wrap', null, letter, seal));
}
