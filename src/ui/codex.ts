// "Co to znaczy?" (owner decision, day 2 question 1): a fold under the cause in the "Dlaczego stoi?" sheet
// with the stall codex entry (src/content/stallCodex.ts) for the status at the root of the chain — what it
// means, how to check it, what to do, an example chain. Collapsed by default; once opened it stays open for
// the session (the sheet re-renders every second). PL and EN are authored; other languages read the English
// entry, marked lang="en" so an RTL sheet still lays it out left to right. Situational entries (codexSituations.ts,
// D-339) are i18n keys in all 17 languages and replace the status entry where the sheet reads the state its own way.
import { getLang, t } from '../i18n/index';
import { STALL_CODEX, STALL_CODEX_CALM, type StallCodexLocale } from '../content/stallCodex';
import type { BuildingStatus, WagonStatus } from '../sim/index';
import { esc } from './dom';
import { iconSvg } from './icons';
import { situationKey, type CodexSituation, type CodexSituationField } from './codexSituations';

let open = false;

/** Codex key of a status: `status.K` / `status.K.CAUSE` for a building, `wagon.K` for a wagon. */
export function codexKey(kind: 'building' | 'wagon', s: BuildingStatus | WagonStatus): string {
  if (kind === 'wagon') return `wagon.${s.k}`;
  const cause = (s as { cause?: string }).cause;
  return cause ? `status.${s.k}.${cause}` : `status.${s.k}`;
}

/** The entry for a status in the reading language (English outside pl / en), or null when none is authored.
 *  `calm` (D-98): the stall needs nothing done (calmWhy) — its calm variant when one is authored. */
export function codexEntry(kind: 'building' | 'wagon', s: BuildingStatus | WagonStatus, calm = false): { e: StallCodexLocale; lang: 'pl' | 'en' } | null {
  const key = codexKey(kind, s);
  const entry = (calm ? STALL_CODEX_CALM[key] : undefined) ?? STALL_CODEX[key];
  if (!entry) return null;
  const lang = getLang() === 'pl' ? 'pl' : 'en';
  return { e: entry[lang], lang };
}

export function codexHtml(kind: 'building' | 'wagon', s: BuildingStatus | WagonStatus, calm = false): string {
  const c = codexEntry(kind, s, calm);
  if (!c) return '';
  return foldHtml(c.e, getLang() !== c.lang);
}

/** A situational entry (src/ui/codexSituations.ts, D-339): translated into every language, read through t(). */
export function codexSituationHtml(sit: CodexSituation): string {
  const f = (x: CodexSituationField): string => t(situationKey(sit, x));
  return foldHtml({ name: f('name'), meaning: f('meaning'), check: f('check'), fixes: [f('fix1'), f('fix2')], chain: f('chain') }, false);
}

function foldHtml(e: StallCodexLocale, foreign: boolean): string {
  const fixes = e.fixes.filter((f): f is string => !!f).map((f) => `<li>${esc(f)}</li>`).join('');
  return `<div class="codex${open ? ' is-open' : ''}">
    <button class="codex-tog cf" data-act="codex" aria-expanded="${open}" aria-controls="codex-body"><span class="codex-ic">${iconSvg('inspect', 20)}</span><span class="codex-q" dir="auto">${esc(t('codex.toggle'))}</span><span class="codex-chev" aria-hidden="true"></span></button>
    <div class="codex-body" id="codex-body"${foreign ? ' lang="en" dir="ltr"' : ''}${open ? '' : ' hidden'}>
      <p class="codex-name"><b>${esc(e.name)}</b> — ${esc(e.meaning)}</p>
      <div class="codex-h">${esc(t('codex.check'))}</div><p>${esc(e.check)}</p>
      <div class="codex-h">${esc(t('codex.fixes'))}</div><ol class="codex-fixes">${fixes}</ol>
      <div class="codex-h">${esc(t('codex.example'))}</div><p class="codex-chain">${esc(e.chain)}</p>
    </div></div>`;
}

/** Tap on the fold: flip it in place (the next re-render keeps the state). */
export function toggleCodex(btn: HTMLElement): void {
  open = !open;
  const root = btn.closest('.codex');
  root?.classList.toggle('is-open', open);
  btn.setAttribute('aria-expanded', String(open));
  const body = root?.querySelector<HTMLElement>('.codex-body');
  if (body) body.hidden = !open;
  // opened under the docked fix, the answer was below the fold with nothing moving (a11y 2026-11-08, D-347): bring its
  // first line into view (the sheet body's scroll-padding keeps it clear of the dock)
  if (open) body?.querySelector<HTMLElement>('.codex-name')?.scrollIntoView({ block: 'nearest' });
}
