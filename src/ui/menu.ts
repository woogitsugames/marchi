// Main menu strip over the live scene, the settings sheet, the in-game menu sheet and the
// end-of-mission sealed letter.
import { LANG_NAMES, availableLangs, getLang, setLang, t, type Lang, type MessageKey } from '../i18n/index';
import { GOODS, MISSIONS, topStallCauses, type World } from '../sim/index';
import { deckle, esc, h, setHtml } from './dom';
import { bdi, buildingName, clock, fmtInt, fmtRatio, goodName, iso, rankName, tHtml, ticksClock, wagonName } from './format';
import { saveErrorMessageKey } from '../platform/saveGate';
import { VALLEY_SLOTS, type SlotSummary, type ValleySlot } from '../platform/save';
import { iconSvg } from './icons';
import { getContractLetter } from '../content/letters';
import type { DeadEnd } from './deadEnd';
import type { Sheet, SheetContent } from './sheets';
import type { QualityChoice, QualityPref } from './tier';

/** Missions offered in the main menu, in order (the hidden test bench 'lab' never appears). */
export const MENU_MISSIONS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12', 'm13'] as const;
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
  // its own line: 'menu.contractSub' repeated the title ("Chleb i deski / Chleb i deski dla zamku...")
  if (id === 'm1') return t('menu.m1Sub');
  return t(`menu.${id}Sub` as MessageKey);
}

export interface MenuActions {
  continueGame(): void;
  /** A mission from the list: asks first when that mission has an unfinished save (D-36). */
  newGame(mission: MissionKey): void;
  /** "Start this contract afresh" under a damaged save: no question, the save is unreadable anyway. */
  startFresh(mission: MissionKey): void;
  /** Free valley: the ledger (slot) picker. */
  openValley(): void;
  openSettings(): void;
}

export interface SaveInfo { missionId: string; tick: number; slot: string; savedAt: number }

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
/** Margin numeral of a contract's save entry: the mission's own number. */
// Contract numbers stay Roman in every language (D-73): they are part of each title in all 17 translations and
// of the save-slot margin, so the medallion repeats the glyph the title starts with rather than a locale digit.
const ROMAN_MISSION = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];

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

/**
 * broken = the save could not be loaded: show why and offer that contract afresh.
 * unfinished = contract saves by mission id: their rows say "in progress, 12:34" (D-36).
 */
/** Best result of a contract mission as the menu shows it (owner decision 13). */
export interface BestSeals { seals: number; ticks: number }

/**
 * Three small wax seals (pressed = earned) and the best contract time at the end of a mission row; nothing
 * before the first win. The row's accessible name gets the same in words.
 */
function bestMark(b: BestSeals | undefined): HTMLElement | null {
  if (!b || b.seals < 1) return null;
  const time = iso(ticksClock(b.ticks));
  const el = h('span.mi-best', { role: 'img', 'aria-label': t('menu.bestAria', { n: b.seals, time }) });
  setHtml(el, `<span class="mi-seals" aria-hidden="true">${[0, 1, 2].map((i) =>
    `<span class="mi-seal${i < b.seals ? ' is-on' : ''}">${iconSvg('seal', 16)}</span>`).join('')}</span><span class="mi-time num" aria-hidden="true">${esc(time)}</span>`);
  return el;
}

export function buildMainMenu(act: MenuActions, save: SaveInfo | null, broken: MissionKey | null = null,
  unfinished: ReadonlyMap<string, SaveInfo> = new Map(), best: Readonly<Record<string, BestSeals>> = {}): HTMLElement {
  // the painted kit (D-43/D-53, owner 2026-11-03): the lily frame (frame-sheet-dim) around a scrolling list,
  // the wine ribbon for the title, a brass medallion with the mission's numeral instead of the old diamond,
  // kit buttons for Continue / Settings; the live valley scene stays behind it
  const items: HTMLElement[] = [];
  const row = (mark: HTMLElement, label: string, sub: string, fn: () => void, cls = '', extra: HTMLElement | null = null): void => {
    const b = h(`button.menu-item${cls}` as 'button.menu-item', null,
      mark,
      h('span.mi-text', null, h('span.mi-title', null, label), sub ? h('span.mi-sub', null, sub) : null, extra));
    b.addEventListener('click', fn);
    items.push(h('li', null, b));
  };
  const medal = (numeral: string, won: boolean): HTMLElement => h(`span.mi-medal${won ? '.is-won' : ''}` as 'span.mi-medal', { 'aria-hidden': 'true' }, numeral);
  MENU_MISSIONS.forEach((id, i) => {
    const u = unfinished.get(id);
    const sub = u ? `${missionSub(id)} · ${t('save.inProgress', { time: iso(ticksClock(u.tick)) })}` : missionSub(id);
    const numeral = ROMAN_MISSION[i] ?? String(i + 1);
    // the numeral moves into the medallion; a title in another form (a language without it) stays whole
    const full = missionTitle(id);
    const label = full.startsWith(numeral + '. ') ? full.slice(numeral.length + 2) : full;
    const b = best[id];
    // until mission I is won, its row says where to begin (day 6: a cold start offered 13 equal rows)
    const start = id === 'm1' && !(b && b.seals > 0);
    row(medal(numeral, !!b && b.seals > 0), label, sub, () => act.newGame(id), (u ? '.is-unfinished' : '') + (start ? '.is-start' : ''), bestMark(b));
    if (start) {
      const text = items[items.length - 1]!.querySelector('.mi-text')!;
      text.prepend(h('span.mi-start', null, t('menu.startHere')));
    }
    // the accessible name keeps the numeral ("I. Chleb i deski")
    (items[items.length - 1]!.firstElementChild as HTMLElement).setAttribute('aria-label',
      [full, sub, b && b.seals > 0 ? t('menu.bestAria', { n: b.seals, time: iso(ticksClock(b.ticks)) }) : ''].filter(Boolean).join(', '));
  });
  const valleyMark = h('span.mi-medal.is-valley', { 'aria-hidden': 'true' });
  setHtml(valleyMark, iconSvg('farm', 22));
  row(valleyMark, missionTitle('sandbox'), missionSub('sandbox'), act.openValley, '.is-valley');
  let err: HTMLElement | null = null;
  if (broken) {
    // a damaged valley ledger is dealt with in the picker (delete it there); a contract starts afresh
    const again = h('button.btn.primary.cf', null, t(broken === 'sandbox' ? 'valley.brokenOpen' : 'menu.saveBrokenNew'));
    again.addEventListener('click', () => { if (broken === 'sandbox') act.openValley(); else act.startFresh(broken); });
    err = h('div.menu-error', { role: 'alert' }, h('p', null, t('menu.saveBroken')), again);
  }
  let cont: HTMLElement | null = null;
  if (save) {
    const b = h('button.btn.primary.cf.menu-continue', null,
      h('span.mc-text', null, h('span.mc-title', null, t('menu.continue')),
        h('span.mc-sub', null, t('menu.continueSub', { what: saveWhat(save), time: iso(ticksClock(save.tick)) }))));
    b.addEventListener('click', act.continueGame);
    cont = b;
  }
  // Settings stays the last .menu-item (screenshot and layout tools open it that way)
  const settings = h('button.menu-item.btn.cf.menu-settings', null, h('span.mi-gear', { 'aria-hidden': 'true' }), h('span.mi-title', null, t('menu.settings')));
  setHtml(settings.firstElementChild as HTMLElement, iconSvg('menu', 22));
  settings.addEventListener('click', act.openSettings);
  const strip = h('div.menu-strip', null,
    h('div.menu-head', null,
      h('div.ribbon.menu-ribbon', null, h('h1.title', null, t('app.title'))),
      h('p.subtitle', null, t('app.subtitle'))),
    err,
    cont,
    h('ul.menu-list', null, ...items),
  );
  // Settings sits under the scrolling list, inside the frame: always on screen (day 6: at 412x915 it was
  // the 14th row, below the fold)
  return h('div.menu-wrap', null, h('div.menu-frame', null, strip, h('div.menu-foot-row', null, settings)));
}

export interface SettingsActions {
  quality(): QualityPref;
  setQuality(q: QualityPref): void;
  /** What 'auto' resolved to on this device. */
  autoQuality(): QualityChoice;
  leftHanded(): boolean;
  setLeftHanded(v: boolean): void;
  /** Single-key shortcuts on (D-119). */
  shortcuts(): boolean;
  setShortcuts(v: boolean): void;
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
      const seg = (name: string, opts: [string, string][], cur: string, label: string): string =>
        `<div class="seg" role="group" aria-label="${esc(label)}">${opts.map(([v, l]) =>
          `<button class="btn cf${v === cur ? ' is-on' : ''}" data-set="${name}:${v}" aria-pressed="${v === cur}">${esc(l)}</button>`).join('')}</div>`;
      // 17 languages: a 2-3 column grid of native names, each in its own language (lang/dir for fonts & screen readers)
      const langGrid = (cur: string): string =>
        `<div class="lang-grid" role="group" aria-label="${esc(t('menu.language'))}">${availableLangs().map((l) =>
          `<button class="btn cf${l === cur ? ' is-on' : ''}" data-set="lang:${l}" lang="${l}" dir="auto" aria-pressed="${l === cur}">${esc(LANG_NAMES[l])}</button>`).join('')}</div>`;
      const html = `
        <div class="setting"><span class="s-label">${esc(t('menu.language'))}</span>
          ${langGrid(getLang())}</div>
        <div class="setting"><span class="s-label">${esc(t('menu.quality'))}</span>
          ${seg('quality', [['auto', t('quality.auto')], ['low', t('quality.low')], ['high', t('quality.high')], ['ultra', t('quality.ultra')]], act.quality(), t('menu.quality'))}
          <div class="s-hint">${esc(act.quality() === 'auto' ? t('menu.qualityDetected', { q: t(`quality.${act.autoQuality()}` as MessageKey) }) : t('menu.qualityHint'))}</div></div>
        <div class="setting"><label class="s-label" for="vol-music">${esc(t('menu.music'))}</label>
          <input class="vol" id="vol-music" type="range" min="0" max="100" step="5" data-vol="music"></div>
        <div class="setting"><label class="s-label" for="vol-fx">${esc(t('menu.effects'))}</label>
          <input class="vol" id="vol-fx" type="range" min="0" max="100" step="5" data-vol="effects"></div>
        <div class="setting"><span class="s-label">${esc(t('menu.leftHanded'))}</span>
          ${seg('left', [['0', t('menu.off')], ['1', t('menu.on')]], act.leftHanded() ? '1' : '0', t('menu.leftHanded'))}</div>
        <div class="setting"><span class="s-label">${esc(t('menu.shortcuts'))}</span>
          ${seg('keys', [['0', t('menu.off')], ['1', t('menu.on')]], act.shortcuts() ? '1' : '0', t('menu.shortcuts'))}
          <div class="s-hint">${esc(t('menu.shortcutsHint'))}</div></div>
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
          if (k === 'keys') act.setShortcuts(v === '1');
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

export interface MissionSaveActions {
  continueGame(): void;
  /** Wipe the unfinished save and start the mission afresh. */
  startFresh(): void;
}

/**
 * Tapping a contract that has an unfinished save (D-36): the save as a ledger entry (time played,
 * last played) with "Continue" and "Start over"; "Start over" asks once more in the row, like the
 * valley ledgers. Closing the sheet (swipe, back, Escape) leaves the save alone.
 */
export function missionSaveSheet(act: MissionSaveActions, missionId: MissionKey, save: SaveInfo): SheetContent {
  let asking = false;
  const roman = (MENU_MISSIONS as readonly string[]).includes(missionId) ? ROMAN_MISSION[MENU_MISSIONS.indexOf(missionId as typeof MENU_MISSIONS[number])] : '';
  return {
    key: 'missionsave',
    update(sheet: Sheet) {
      setHtml(sheet.icon, iconSvg('castle', 30));
      sheet.kicker.textContent = t('menu.contractItem');
      sheet.title.textContent = missionTitle(missionId);
      const time = ticksClock(save.tick);
      const meta = `<dl class="slot-meta">
        <div><dt>${esc(t('valley.played'))}</dt><dd>${bdi(time)}</dd></div>
        <div><dt>${esc(t('valley.last'))}</dt><dd>${bdi(playedAt(save.savedAt), 'num when')}</dd></div></dl>`;
      const acts = asking
        ? `<p class="slot-ask" role="alert">${esc(t('save.confirmFresh', { time }))}</p>
          <div class="slot-acts two"><button class="btn paper cf" data-a="keep">${esc(t('valley.keep'))}</button>
          <button class="btn primary cf" data-a="fresh">${esc(t('valley.yesFresh'))}</button></div>`
        : `<div class="slot-acts"><button class="btn primary cf slot-play" data-a="play">${esc(t('menu.continue'))}</button>
          <button class="btn paper cf slot-small" data-a="ask">${esc(t('menu.restart'))}</button></div>`;
      const html = `<ol class="slots"><li class="slot-row is-filled${asking ? ' is-asking' : ''}">
        <span class="slot-no" aria-hidden="true">${roman}</span><div class="slot-main">
        <span class="slot-name">${esc(t('save.unfinished'))}</span>${meta}${acts}</div></li></ol>`;
      if (setHtml(sheet.body, html)) {
        sheet.body.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => b.addEventListener('click', () => {
          const a = b.dataset.a;
          if (a === 'play') act.continueGame();
          if (a === 'fresh') act.startFresh();
          if (a === 'ask' || a === 'keep') { asking = a === 'ask'; this.update(sheet); }
        }));
      }
      return true;
    },
  };
}

export interface GameMenuActions {
  resume(): void;
  settings(): void;
  restart(): void;
  toMenu(): void;
  /** Free valley: open the chronicle (D-57); absent in contracts. */
  chronicle?: () => void;
  chronicleCount?: () => [number, number];
}

/** slot: the free-valley ledger being written to (shown under the title), null for contracts. */
export function gameMenuSheet(act: GameMenuActions, world: World, slot: ValleySlot | null = null): SheetContent {
  // "start over" wipes the save: it always asks first (a valley settlement is hours of work, D-29;
  // a contract can be twenty minutes, D-36)
  let asking = false;
  return {
    key: 'gamemenu',
    update(sheet: Sheet) {
      setHtml(sheet.icon, iconSvg('pause', 30));
      sheet.kicker.textContent = t('menu.paused');
      // the contract's own title ("I. Chleb i deski"), not the generic word: the pause names what is paused
      sheet.title.textContent = world.state.mission.contract ? missionTitle(world.state.mission.id) : t('hud.sandbox');
      const note = slot ? `<p class="slot-note"><span class="slot-no" aria-hidden="true">${slotNumeral(slot)}</span>${esc(t('valley.saving', { n: slotNumeral(slot) }))}</p>` : '';
      const ask = slot
        ? t('valley.confirmFresh', { n: slotNumeral(slot), name: rankName(world.state.town?.rank ?? 0), renown: fmtInt(world.state.town?.renown ?? 0) })
        : t('save.confirmRestart', { time: ticksClock(world.state.tick) });
      const mark = slot ? slotNumeral(slot) : (ROMAN_MISSION[MENU_MISSIONS.indexOf(world.state.mission.id as typeof MENU_MISSIONS[number])] ?? '');
      const restart = asking
        ? `<div class="slot-row is-asking pause-ask"><span class="slot-no" aria-hidden="true">${mark}</span><div class="slot-main">
            <p class="slot-ask" role="alert">${esc(ask)}</p>
            <div class="slot-acts two"><button class="btn paper cf" data-a="keep">${esc(t('valley.keep'))}</button>
            <button class="btn primary cf" data-a="restart">${esc(t('valley.yesFresh'))}</button></div></div></div>`
        : `<button class="btn cf" data-a="ask">${esc(t('menu.restart'))}</button>`;
      const html = `${note}<div class="sheet-actions" style="flex-direction:column">
        <button class="btn primary cf" data-a="resume">${esc(t('menu.resume'))}</button>
        <button class="btn cf" data-a="settings">${esc(t('menu.settings'))}</button>
        ${act.chronicle ? `<button class="btn cf" data-a="chronicle">${iconSvg('seal', 24)}<span>${esc(t('chron.menu', { n: act.chronicleCount?.()[0] ?? 0, total: act.chronicleCount?.()[1] ?? 0 }))}</span></button>` : ''}
        ${restart}
        <button class="btn cf" data-a="menu">${esc(t('menu.toMenu'))}</button></div>`;
      if (setHtml(sheet.body, html)) {
        sheet.body.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => b.addEventListener('click', () => {
          const a = b.dataset.a;
          if (a === 'resume') act.resume();
          if (a === 'settings') act.settings();
          if (a === 'chronicle') act.chronicle?.();
          if (a === 'ask' || a === 'keep') { asking = a === 'ask'; this.update(sheet); }
          if (a === 'restart') act.restart();
          if (a === 'menu') act.toMenu();
        }));
      }
      return true;
    },
  };
}

/** next: the following contract, offered on a won letter for missions I-XI (absent = no button). */
export interface EndActions { again(): void; menu(): void; next?: () => void }

/** The contract after this one in the menu order, null for the last one and the free valley. */
export function nextMission(id: string): MissionKey | null {
  const i = (MENU_MISSIONS as readonly string[]).indexOf(id);
  return i >= 0 && i < MENU_MISSIONS.length - 1 ? MENU_MISSIONS[i + 1]! : null;
}

/** Who a ledger key ('building:5:NO_ROAD', 'wagon:9:NO_ROUTE', 'span:812:BRIDGE_JAM') is about. */
function causeSubject(world: World, kind: string, id: number): string {
  if (kind === 'building') return buildingName(world, id);
  if (kind === 'wagon') return wagonName(world, id);
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

/**
 * The castle's wax on a letter (D-53): the kit seal inside the frame's top corner, pressed (`seal-full`) for an
 * opening or a won contract, bare (`seal-empty`) for a loss or a dead end. Decorative: the title says it.
 */
function letterSeal(pressed: boolean): string {
  return `<i class="l-seal kseal${pressed ? ' on' : ''}" aria-hidden="true"></i>`;
}

/** An authored letter as HTML: one <p> per line, the closing "— name" line set as a signature. */
export function letterHtml(text: string): string {
  return text.split('\n').filter((l) => l.trim()).map((l) =>
    // dir=auto: a letter without a translation falls back to English (D-18) and must keep LTR punctuation in RTL
    /^\s*[—–-]\s/.test(l) ? `<p class="l-sign" dir="auto">${esc(l.trim())}</p>` : `<p dir="auto">${esc(l)}</p>`).join('');
}

/**
 * The castellan's opening letter for a contract (D-46). Closes with one gesture: a tap anywhere, the
 * button or Escape; `onClose` runs once. Returns null for missions without letters (the free valley).
 */
export function buildOpeningLetter(missionId: string, onClose: () => void): HTMLElement | null {
  const text = getContractLetter(missionId, 'opening');
  if (!text) return null;
  const letter = h('div.letter.l-opening' as 'div.letter', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'opening-title' });
  letter.innerHTML = `${letterSeal(true)}
    <div class="l-kicker">${esc(t('contract.kicker'))}</div>
    <h2 id="opening-title">${esc(missionTitle(missionId))}</h2>
    <div class="l-body">${letterHtml(text)}</div>
    <div class="actions"><button class="btn primary cf" data-a="start">${esc(t('letter.start'))}</button></div>`;
  letter.style.clipPath = deckle('bottom', 57, 6, 30);
  const scrim = h('div.scrim.letter-scrim', null, h('div.letter-wrap', null, letter));
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey);
    if (!scrim.isConnected) return; // removed with the game (back to the menu): nothing to resume
    scrim.classList.add('is-out');
    window.setTimeout(() => scrim.remove(), 220);
    onClose();
  };
  const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); close(); } };
  scrim.addEventListener('click', close); // one tap anywhere, the letter included
  window.addEventListener('keydown', onKey);
  requestAnimationFrame(() => letter.querySelector<HTMLButtonElement>('[data-a="start"]')?.focus());
  return scrim;
}

export interface DeadEndActions { again(): void; menu(): void; watch(): void }

/** "No road to victory" (D-48): the cause and the numbers, instead of waiting for the deadline. */
export function buildDeadEndLetter(d: DeadEnd, act: DeadEndActions): HTMLElement {
  const letter = h('div.letter.lost' as 'div.letter', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'deadend-title' });
  const why = d.cost < 0
    ? esc(t('deadEnd.none'))
    : tHtml('deadEnd.text', { cost: fmtInt(d.cost), coins: fmtInt(d.coins), raise: fmtInt(d.raise) });
  letter.innerHTML = `${letterSeal(false)}
    <div class="l-kicker">${esc(t('contract.kicker'))}</div>
    <h2 id="deadend-title" dir="auto">${esc(t('deadEnd.title'))}</h2>
    <p dir="auto">${why}</p>
    <div class="actions">
      <button class="btn primary cf" data-a="again">${esc(t('contract.again'))}</button>
      <button class="btn cf" data-a="menu">${esc(t('contract.menu'))}</button>
    </div>
    <div class="actions l-more"><button class="btn cf" data-a="watch">${esc(t('deadEnd.watch'))}</button></div>`;
  letter.style.clipPath = deckle('bottom', 73, 6, 30);
  letter.querySelector('[data-a="again"]')!.addEventListener('click', act.again);
  letter.querySelector('[data-a="menu"]')!.addEventListener('click', act.menu);
  letter.querySelector('[data-a="watch"]')!.addEventListener('click', act.watch);
  return h('div.scrim.deadend-scrim', null, h('div.letter-wrap', null, letter));
}

/** The sealed letter at the end of a contract. seals = stars(world) 0..3. */
export function buildEndLetter(world: World, seals: number, act: EndActions): HTMLElement {
  const st = world.state;
  const won = st.mission.result === 'won';
  const c = st.mission.contract;
  const castle = c ? st.buildings.find((b) => b.id === c.castle) : null;
  const delivered = c ? GOODS.filter((g) => c.need[g] > 0).map((g) =>
    `<span class="dl-item">${iconSvg(g, 20)}<span>${tHtml('contract.deliveredItem', { count: fmtRatio(Math.min(castle?.stock[g] ?? 0, c.need[g]), c.need[g]), good: goodName(g) })}</span></span>`).join('') : '';
  const def = MISSIONS[st.mission.id];
  const sealRow = [0, 1, 2].map((i) => `<i class="s kseal${i < seals ? ' on' : ''}"></i>`).join('');
  // the castellan's own words by seals (or the loss), the generic line for missions without letters
  const authored = getContractLetter(st.mission.id, won ? 'won' : 'lost', seals);
  // a won contract leads on to the next one (day 6: the way to mission II went through the menu)
  const next = won && act.next ? nextMission(st.mission.id) : null;
  const letter = h('div.letter' + (won ? '' : '.lost') as 'div.letter', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'end-title' });
  letter.innerHTML = `${letterSeal(won)}
    <div class="l-kicker">${esc(t('contract.kicker'))}</div>
    <h2 id="end-title" dir="auto">${esc(t((won ? 'contract.won' : 'contract.lost') as MessageKey))}</h2>
    ${authored ? `<div class="l-body">${letterHtml(authored)}</div>` : `<p>${esc(t(won ? 'contract.wonText' : 'contract.lostText'))}</p>`}
    ${won ? `<div class="seals">${sealRow}<span class="s-label">${esc(t('contract.stars', { n: seals }))}</span></div>` : ''}
    <dl class="kv">
      <dt>${esc(t('contract.time'))}</dt><dd>${bdi(ticksClock(st.mission.endTick >= 0 ? st.mission.endTick : st.tick))}${def ? `<span class="of-limit">${bdi(`/ ${clock(def.deadlineMin * 60)}`)}</span>` : ''}</dd>
      <dt>${esc(t('contract.delivered'))}</dt><dd>${delivered}</dd>
      <dt>${esc(t('contract.left'))}</dt><dd>${bdi(fmtInt(st.coins))}</dd>
    </dl>
    ${c ? causesHtml(world) : ''}
    ${next ? `<div class="actions l-next"><button class="btn primary cf" data-a="next"><span class="ln-t">${esc(t('contract.next'))}</span><span class="ln-s">${esc(missionTitle(next))}</span></button></div>` : ''}
    <div class="actions">
      <button class="btn${next ? '' : ' primary'} cf" data-a="again">${esc(t('contract.again'))}</button>
      <button class="btn cf" data-a="menu">${esc(t('contract.menu'))}</button>
    </div>`;
  letter.style.clipPath = deckle('bottom', 31, 6, 30);
  letter.querySelector('[data-a="again"]')!.addEventListener('click', act.again);
  letter.querySelector('[data-a="menu"]')!.addEventListener('click', act.menu);
  if (next && act.next) letter.querySelector('[data-a="next"]')!.addEventListener('click', act.next);
  return h('div.scrim', null, h('div.letter-wrap', null, letter));
}
