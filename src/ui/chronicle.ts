// Valley chronicle (gpt 51 proposal, D-57): milestone entries of the free valley, read from the state by
// checkChronicle (src/sim/proposals/chronicle.ts, pure). The UI owns the list of recorded entries. Since day 1
// (owner decision 1, D-68) it travels in the ledger's save envelope (`chronicle`, beside the state, never in
// SimState or its hash); the old per-ledger localStorage list is still read once and merged, and dropped after
// the first save that carries it. Entries the state still satisfies are re-derived on load, so a lost list only
// forgets momentary ones.
import { CHRONICLE } from '../sim/proposals/chronicle';
import { ChronicleLog } from './chronicleLog';
import { t, type MessageKey } from '../i18n/index';
import { esc, setHtml } from './dom';
import { iconSvg } from './icons';
import type { Sheet, SheetContent } from './sheets';

export { ChronicleLog, clearChronicle } from './chronicleLog';

export const chronicleTitle = (id: string): string => t(`chron.${id}.t` as MessageKey);

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
