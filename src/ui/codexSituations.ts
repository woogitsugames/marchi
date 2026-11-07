// Situational entries of the "Co to znaczy?" fold (orders 72 + 102, D-339). The stall codex (src/content/stallCodex.ts)
// explains a status; some states read differently from their bare status and the sheet already says so in a calm line
// or a castle line — a busy wagon due shortly (WAGON_DUE, D-156), a surplus nobody needs (D-160), a granary full at a
// saturated market (D-174/D-180), the trading post waiting for its road (D-170), the build tutorial's cut-off hut
// (D-259), and mission XVI's castles: the other castle taking the goods (castleRival, D-291), the even split and the
// castle-first switch (D-289/D-290). For those the fold reads its own entry, translated into every language (i18n keys
// `codex.s.<situation>.<field>`). Pure reads of the sim and of the UI's pace log; no i18n runtime, no DOM.
import type { MessageKey } from '../i18n/index';
import { buildingById, castleRival, type Building, type PaceLog, type ReasonLink, type World } from '../sim/index';
import { calmWhy } from './stalls';
import { castleForecastFor } from './paceCard';

export const CODEX_SITUATIONS = [
  'wagonDue', 'marketFull', 'surplus', 'postNoRoad', 'castleRival', 'castleEven', 'castleFirst', 'tutorialNoRoad',
] as const;
export type CodexSituation = (typeof CODEX_SITUATIONS)[number];

/** The fields of a situational entry, in the order the fold shows them (as a stall codex entry, two fixes). */
export const CODEX_SITUATION_FIELDS = ['name', 'meaning', 'check', 'fix1', 'fix2', 'chain'] as const;
export type CodexSituationField = (typeof CODEX_SITUATION_FIELDS)[number];

export function situationKey(s: CodexSituation, f: CodexSituationField): MessageKey {
  return `codex.s.${s}.${f}` as MessageKey;
}

/**
 * The situational entry for the link the fold explains (codexLink), or null for the plain stall codex entry.
 * `hut`: the build tutorial's new woodcutter's hut (-1 outside the lesson) — its NO_ROAD is the lesson's stall.
 */
export function codexSituation(world: World, l: ReasonLink, hut = -1): CodexSituation | null {
  if (l.kind !== 'building') return null;
  if (l.status.k === 'WAGON_DUE') return 'wagonDue';
  const b = buildingById(world, l.id);
  if (!b) return null;
  if (b.id === hut && b.status.k === 'NO_ROAD') return 'tutorialNoRoad';
  switch (calmWhy(world, b)) {
    case 'postNoRoad': return 'postNoRoad';
    case 'surplus': return 'surplus';
    case 'marketFull': return 'marketFull';
    default: return null;
  }
}

/**
 * A castle of a running two-castle order (mission XVI): the same reading as its lead lines (castleOrderHtml) — the
 * other castle takes the goods now (while this one is not first), the even split, or a castle going first.
 * null when the castle's order is done or there is no forecast.
 */
export function castleCodexSituation(world: World, b: Building, log: PaceLog): CodexSituation | null {
  const fc = castleForecastFor(world, log, b.id);
  if (!fc || fc.done) return null;
  if (fc.share !== 'first' && castleRival(world, b.id)) return 'castleRival';
  return fc.share === 'even' ? 'castleEven' : 'castleFirst';
}
