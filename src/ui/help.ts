// Player help (docs/content/help.md, D-236; seventh topic D-344): seven short topics on one sheet, each a woodcut-headed fold; one open at a
// time so a phone shows a heading list plus one answer. Reached from the pause menu and the main menu; it closes like
// every sheet (the close button, a swipe down, Back / Escape).
import { t, type MessageKey } from '../i18n/index';
import { esc, setHtml } from './dom';
import { iconSvg, type IconId } from './icons';
import type { Sheet, SheetContent } from './sheets';

export const HELP_TOPICS: readonly { id: string; icon: IconId }[] = [
  { id: 'cause', icon: 'inspect' },
  { id: 'seals', icon: 'seal' },
  { id: 'wagons', icon: 'wagon' },
  { id: 'roads', icon: 'road_dirt' },
  { id: 'granaries', icon: 'warehouse' },
  // two castles (mission XVI, D-344): the castle's pennant of the "this castle first" switch
  { id: 'castles', icon: 'first' },
  { id: 'valley', icon: 'castle' },
];

/** The topic left open between visits (per session; the first visit opens "Find the cause"). */
let openTopic = 'cause';

/** Help opened on one topic (the "?" of a game card, D-254); without one the last open topic stays. */
export function helpSheet(topic?: string): SheetContent {
  const asked = !!topic && HELP_TOPICS.some((x) => x.id === topic);
  if (asked) openTopic = topic!;
  return {
    key: 'help',
    update(sheet: Sheet) {
      setHtml(sheet.icon, iconSvg('inspect', 30));
      sheet.kicker.textContent = '';
      sheet.title.textContent = t('help.title');
      const rows = HELP_TOPICS.map(({ id, icon }) => {
        const on = id === openTopic;
        return `<section class="help-topic${on ? ' is-open' : ''}">
          <button class="help-tog" data-topic="${id}" aria-expanded="${on}" aria-controls="help-${id}">
            <span class="help-ic">${iconSvg(icon, 26)}</span><span class="help-h" dir="auto">${esc(t(`help.${id}.h` as MessageKey))}</span><span class="codex-chev" aria-hidden="true"></span></button>
          <p class="help-p" id="help-${id}" dir="auto"${on ? '' : ' hidden'}>${esc(t(`help.${id}.p` as MessageKey))}</p></section>`;
      }).join('');
      if (setHtml(sheet.body, `<div class="help">${rows}</div>`)) {
        sheet.body.querySelectorAll<HTMLElement>('[data-topic]').forEach((b) => b.addEventListener('click', () => {
          const id = b.dataset.topic!;
          openTopic = openTopic === id ? '' : id;
          this.update(sheet);
          // the opened topic (heading and answer) under a short landscape sheet: bring it into view
          if (openTopic) sheet.body.querySelector(`#help-${id}`)?.closest('.help-topic')?.scrollIntoView({ block: 'nearest' });
        }));
        // opened from a card's "?" (D-254) on a topic low in the list (wagons, valley): a short landscape sheet showed
        // only its heading at the bottom edge — bring heading and answer into view once laid out (QA 2026-11-07, D-286)
        // (the body's own scrollTop, not scrollIntoView: the sheet is still sliding in and no ancestor may scroll)
        if (asked) requestAnimationFrame(() => {
          const el = sheet.body.querySelector('.help-topic.is-open');
          if (!el) return;
          const r = el.getBoundingClientRect(), box = sheet.body.getBoundingClientRect();
          if (r.bottom > box.bottom) sheet.body.scrollTop += Math.min(r.bottom - box.bottom, r.top - box.top);
        });
      }
      return true;
    },
  };
}
