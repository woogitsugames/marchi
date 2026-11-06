// The moderator's playtest screen (D-189): the APK has no address bar, so PROTOCOL's setups are started from here.
// Hidden from players: it opens only after a 3 s press on the menu title (armPlaytestGesture), and nothing on
// the menu hints at it. Each start reloads the page with the protocol's query plus `pt=<scenario>`; such a page
// never writes the save slots or the profile (the fixture no-save mode, D-185). The trial recorder (D-190) counts
// what the game can measure itself and the screen copies it as one CSV row (src/game/playtest.ts).
import {
  PARTICIPANT_CODES, PLAYTEST_STARTS, cleanDeviceNote, isParticipantCode, playtestQuery, resultsFields, resultsRow,
  type PlaytestStart, type TrialRecord,
} from '../game/playtest';
import { t } from '../i18n/index';
import { esc, setHtml } from './dom';
import { iconSvg } from './icons';
import { missionTitle } from './menu';
import type { Sheet, SheetContent } from './sheets';

/** How long the menu title must be held (ms): deliberate, longer than any accidental touch or text press. */
export const PLAYTEST_HOLD_MS = 3000;

/**
 * Arms the hidden gesture on `el`: one finger held still for PLAYTEST_HOLD_MS opens the screen. A move of more
 * than 12 px, a second finger, lifting or cancelling disarms it. No visual feedback (players never learn of it).
 */
export function armPlaytestGesture(el: HTMLElement, open: () => void): void {
  let timer = 0, x = 0, y = 0, id = -1;
  const stop = (): void => { if (timer) clearTimeout(timer); timer = 0; id = -1; };
  el.addEventListener('pointerdown', (e) => {
    if (id >= 0) { stop(); return; } // a second finger
    id = e.pointerId; x = e.clientX; y = e.clientY;
    timer = window.setTimeout(() => { stop(); open(); }, PLAYTEST_HOLD_MS);
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId === id && Math.hypot(e.clientX - x, e.clientY - y) > 12) stop();
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) el.addEventListener(ev, stop);
  // a long press in a WebView would otherwise select the title or open a context menu
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

/** The moderator's last participant code and device note: a convenience, never part of a save. */
const STORE_KEY = 'marchia.playtest.v1';
export function readPlaytestPrefs(): { pid: string; dev: string } {
  try {
    const o = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as { pid?: unknown; dev?: unknown };
    return { pid: typeof o.pid === 'string' && isParticipantCode(o.pid) ? o.pid : '', dev: cleanDeviceNote(typeof o.dev === 'string' ? o.dev : '') };
  } catch { return { pid: '', dev: '' }; }
}
function writePlaytestPrefs(p: { pid: string; dev: string }): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch { /* private window: the fields just start empty */ }
}

/** Records one trial page (`?pt=`): set up by the App, read by the screen. Times are performance.now() ms. */
export class TrialRecorder {
  readonly record: TrialRecord;
  /** Stops counting once the page leaves the game (the moderator went to the menu). */
  frozen = false;
  focus: { kind: 'building' | 'wagon'; id: number } | null = null;

  constructor(readonly start: PlaytestStart, params: URLSearchParams, lang: string, build: string) {
    this.record = {
      scenario: start.id, pid: params.get('pid') ?? '', device: params.get('dev') ?? '', lang, build,
      fixture: null, readyAt: 0, firstTouchAt: null, whyAt: null, wagonOpened: false, taps: 0, firstFix: null,
      outcome: '', focusStatus: '',
    };
  }

  touch(now: number): void {
    if (this.frozen) return;
    if (this.record.firstTouchAt === null) this.record.firstTouchAt = now;
    this.record.taps++;
  }

  /** A card on screen: `why` = it is a "Why is it stalled?" card (stalled building, waiting wagon). */
  card(now: number, kind: 'building' | 'wagon', why: boolean): void {
    if (this.frozen || this.record.firstTouchAt === null) return;
    if (kind === 'wagon') this.record.wagonOpened = true;
    if (why && this.record.whyAt === null) this.record.whyAt = now;
  }

  /** A command the sim accepted; the first one after the first touch is the participant's first fix. */
  command(what: string): void {
    if (this.frozen || this.record.firstTouchAt === null || this.record.firstFix !== null) return;
    this.record.firstFix = what;
  }

  /** Mission result and the fixture subject's status, read while the trial's world is still loaded. */
  snapshot(outcome: string, focusStatus: string): void {
    if (this.frozen) return;
    this.record.outcome = outcome;
    this.record.focusStatus = focusStatus;
  }

  freeze(): void { this.frozen = true; }
}

export interface PlaytestActions {
  lang(): string;
  /** The trial of this page, if it is a `?pt=` page. */
  trial(): TrialRecorder | null;
  /** Reloads the page into the start (fresh world, no-save). */
  go(query: string): void;
  /** Reloads into a plain menu (leaves playtest mode). */
  exit(): void;
}

export function playtestSheet(act: PlaytestActions): SheetContent {
  const saved = readPlaytestPrefs();
  let pid = act.trial()?.record.pid || saved.pid;
  let dev = act.trial()?.record.device || saved.dev;
  let copyState: 'idle' | 'copied' | 'failed' = 'idle';
  let sheetRef: Sheet | null = null;
  const content: SheetContent = {
    key: 'playtest',
    update(sheet: Sheet) {
      sheetRef = sheet;
      setHtml(sheet.icon, iconSvg('menu', 30));
      sheet.kicker.textContent = t('playtest.kicker');
      sheet.title.textContent = t('playtest.title');
      if (setHtml(sheet.body, html())) bind(sheet);
      return true;
    },
  };
  const rerender = (): void => { if (sheetRef) content.update(sheetRef); };

  function trialHtml(): string {
    const tr = act.trial();
    if (!tr) return `<p class="pt-none">${esc(t('playtest.lastNone'))}</p>`;
    const row = resultsRow(tr.record);
    const fields = Object.entries(resultsFields(tr.record)).filter(([, v]) => v !== '');
    const status = copyState === 'copied' ? `<p class="pt-status" role="status">${esc(t('playtest.copied'))}</p>`
      : copyState === 'failed' ? `<p class="pt-status is-fail" role="alert">${esc(t('playtest.copyFailed'))}</p>
        <textarea class="pt-row num" readonly rows="4" aria-label="${esc(t('playtest.row'))}">${esc(row)}</textarea>` : '';
    return `<div class="pt-trial">
      <div class="pt-trial-h"><span class="slot-no" aria-hidden="true">${esc(tr.start.id)}</span>
        <span class="pt-trial-name">${esc(t('playtest.last', { id: tr.start.id }))}</span></div>
      <dl class="pt-fields num">${fields.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <button class="btn primary cf pt-copy" data-a="copy">${esc(t('playtest.copy'))}</button>${status}</div>`;
  }

  function startHtml(s: PlaytestStart): string {
    const tag = s.fixture ? `<span class="pt-tag">${esc(t('playtest.fixture'))}</span>` : '';
    return `<li class="slot-row is-empty"><button class="slot-new pt-start" data-a="go" data-id="${esc(s.id)}"
        aria-label="${esc(`${s.id}: ${missionTitle(s.mission)}`)}">
      <span class="slot-no" aria-hidden="true">${esc(s.id)}</span>
      <span class="slot-main"><span class="slot-name">${esc(missionTitle(s.mission))}</span>
        <span class="slot-sub"><bdi class="pt-q" dir="ltr">${esc(s.query)}</bdi>${tag}</span></span>
      <span class="slot-go fwd" aria-hidden="true">${iconSvg('back', 20)}</span></button></li>`;
  }

  function html(): string {
    const codes = PARTICIPANT_CODES.map((c) =>
      `<button class="btn cf${c === pid ? ' is-on' : ''}" data-a="pid" data-v="${c}" aria-pressed="${c === pid}">${c}</button>`).join('');
    return `${trialHtml()}
      <div class="setting"><span class="s-label" id="pt-pid-l">${esc(t('playtest.participant'))}</span>
        <div class="seg pt-codes" role="group" aria-labelledby="pt-pid-l">${codes}</div></div>
      <div class="setting"><label class="s-label" for="pt-dev">${esc(t('playtest.device'))}</label>
        <input class="pt-dev" id="pt-dev" type="text" maxlength="60" autocomplete="off" spellcheck="false"></div>
      <div class="pt-starts-h">${esc(t('playtest.starts'))}</div>
      <ol class="slots pt-starts">${PLAYTEST_STARTS.map(startHtml).join('')}</ol>
      <button class="btn paper cf pt-exit" data-a="exit">${esc(t('playtest.exit'))}</button>`;
  }

  function bind(sheet: Sheet): void {
    const input = sheet.body.querySelector<HTMLInputElement>('#pt-dev');
    if (input) {
      input.value = dev;
      input.addEventListener('input', () => { dev = cleanDeviceNote(input.value); writePlaytestPrefs({ pid, dev }); });
    }
    sheet.body.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.a;
      if (a === 'pid') {
        pid = pid === b.dataset.v ? '' : b.dataset.v ?? '';
        writePlaytestPrefs({ pid, dev });
        rerender();
      } else if (a === 'go') {
        const s = PLAYTEST_STARTS.find((x) => x.id === b.dataset.id);
        if (s) act.go(playtestQuery(s, { lang: act.lang(), pid, dev }));
      } else if (a === 'exit') act.exit();
      else if (a === 'copy') void copy();
    }));
  }

  async function copy(): Promise<void> {
    const tr = act.trial();
    if (!tr) return;
    try {
      await navigator.clipboard.writeText(resultsRow(tr.record));
      copyState = 'copied';
    } catch {
      copyState = 'failed';
    }
    rerender();
    if (copyState === 'failed') {
      const ta = sheetRef?.body.querySelector<HTMLTextAreaElement>('.pt-row');
      ta?.focus();
      ta?.select();
    }
  }

  return content;
}
