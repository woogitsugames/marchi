// Valley chronicle (gpt 51 proposal, D-57): milestone entries of the free valley, read from the state by
// checkChronicle (src/sim/proposals/chronicle.ts, pure). The UI owns the list of recorded entries: it is
// kept per valley ledger in localStorage (best effort; never in SimState, no reward, no effect on play).
// Entries the state still satisfies are re-derived on load, so a lost list only forgets momentary ones.
import { CHRONICLE, checkChronicle } from '../sim/proposals/chronicle';
import type { World } from '../sim/index';
import { t, type MessageKey } from '../i18n/index';
import { esc, setHtml } from './dom';
import { iconSvg } from './icons';
import type { Sheet, SheetContent } from './sheets';

const KEY = 'marchia.chronicle.';

function read(slot: string): string[] {
  try {
    const raw = localStorage.getItem(KEY + slot);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

function write(slot: string, ids: Iterable<string>): void {
  try { localStorage.setItem(KEY + slot, JSON.stringify([...ids])); } catch { /* storage unavailable */ }
}

/** A fresh or deleted valley ledger starts a new chronicle. */
export function clearChronicle(slot: string): void {
  try { localStorage.removeItem(KEY + slot); } catch { /* storage unavailable */ }
}

export const chronicleTitle = (id: string): string => t(`chron.${id}.t` as MessageKey);

export class ChronicleLog {
  readonly done = new Set<string>();
  private slot = '';

  /** A valley game was entered: recorded entries plus everything already true, silently (no toast storm). */
  attach(slot: string, world: World): void {
    this.slot = slot;
    this.done.clear();
    for (const id of read(slot)) this.done.add(id);
    for (const id of checkChronicle(world.state, this.done)) this.done.add(id);
    write(slot, this.done);
  }

  detach(): void { this.slot = ''; this.done.clear(); }

  get active(): boolean { return this.slot !== ''; }

  /** Newly reached entries since the last call (CHRONICLE order); recorded at once. */
  check(world: World): string[] {
    if (!this.slot) return [];
    const fresh = checkChronicle(world.state, this.done);
    if (!fresh.length) return fresh;
    for (const id of fresh) this.done.add(id);
    write(this.slot, this.done);
    return fresh;
  }
}

/** The chronicle as a ledger page: recorded entries with the scribe's sentence, the rest by title only. */
export function chronicleSheet(log: ChronicleLog): SheetContent {
  return {
    key: 'chronicle',
    update(sheet: Sheet) {
      setHtml(sheet.icon, iconSvg('seal', 30));
      sheet.kicker.textContent = t('hud.sandbox');
      sheet.title.textContent = t('chron.title');
      const rows = CHRONICLE.map((e) => {
        const on = log.done.has(e.id);
        return `<li class="chron-row${on ? ' is-done' : ''}"><span class="chron-mark" aria-hidden="true">${on ? iconSvg('seal', 22) : ''}</span>` +
          `<span class="chron-text"><b>${esc(chronicleTitle(e.id))}</b><small>${esc(on ? t(`chron.${e.id}.s` as MessageKey) : t('chron.open'))}</small></span></li>`;
      }).join('');
      setHtml(sheet.body, `<p class="chron-intro">${esc(t('chron.intro'))}</p>` +
        `<div class="section-h">${esc(t('chron.count', { n: log.done.size, total: CHRONICLE.length }))}</div><ol class="chron-list">${rows}</ol>`);
      return true;
    },
  };
}
