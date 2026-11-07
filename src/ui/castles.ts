// Two castles (mission XVI, D-288..D-291): the castle card's order, split and forecast lines, the rival line ("the
// north castle is getting the planks now") and the "this castle first" switch. Pure reads of the sim and of the UI's
// pace log; the switch only enqueues the castleFirst command (data-act="first:<id>", -1 = share evenly).
import { castleRival, contractsOf, type Building, type PaceLog, type World } from '../sim/index';
import { t, type MessageKey } from '../i18n/index';
import { esc } from './dom';
import { buildingName, capFirst, tHtml, ticksClock } from './format';
import { iconSvg } from './icons';
import { castleForecastFor } from './paceCard';

/** A castle holding an order in a running two-castle mission (the castle card shows the switch). */
export function twoCastleOrder(world: World, b: Building): boolean {
  const m = world.state.mission;
  return b.type === 'castle' && !!m.extraContracts && m.result === 'running' && contractsOf(m).some((c) => c.castle === b.id);
}

/** A rival castle's name as a link in a translated line (the \u0001 placeholder trick of sharedHtml). */
function linked(html: string, world: World, id: number): string {
  return html.split(`<bdi class="num">\u0001</bdi>`).join(`<button class="linkish" data-go="building:${id}">${esc(buildingName(world, id))}</button>`);
}

/**
 * Lead lines of a two-castle castle card, above its chain: who goes first (or the even split), the forecast at the
 * current split against the castle's own deadline, and — when another castle takes the goods now — the rival line.
 */
export function castleOrderHtml(world: World, b: Building, log: PaceLog): string {
  if (!twoCastleOrder(world, b)) return '';
  const m = world.state.mission;
  const fc = castleForecastFor(world, log, b.id);
  if (!fc || fc.done) return '';
  const out: string[] = [];
  const split = fc.share === 'first'
    ? `<div class="s-hint castle-split is-first">${iconSvg('first', 22)}<span dir="auto">${esc(t('castle.firstOn'))}</span></div>`
    : fc.share === 'after'
      ? `<div class="s-hint castle-split">${iconSvg('first', 22)}<span dir="auto">${linked(tHtml('castle.splitAfter', { rival: '\u0001' }), world, m.firstCastle!)}</span></div>`
      : `<div class="s-hint castle-split">${iconSvg('contested', 22)}<span dir="auto">${esc(t('castle.splitEven'))}</span></div>`;
  out.push(split);
  if (fc.finishTick >= 0) {
    const late = fc.finishTick > fc.dueTick;
    const line = late
      ? tHtml('castle.fcLate', { time: ticksClock(fc.finishTick), late: ticksClock(fc.finishTick - fc.dueTick) })
      : tHtml('castle.fcOk', { time: ticksClock(fc.finishTick) });
    const ifFirst = late && fc.share !== 'first' ? ` <small>${tHtml('castle.fcFirst', { time: ticksClock(fc.firstTick) })}</small>` : '';
    out.push(`<div class="pace-fc castle-fc${late ? ' late' : ''}"><span dir="auto">${line}${ifFirst}</span></div>`);
  }
  const r = castleRival(world, b.id);
  if (r && fc.share !== 'first') {
    const text = tHtml('castle.rival', { rival: '\u0001', goodAcc: t(`goodAcc.${r.good}` as MessageKey), n: r.wagons, short: r.short, time: ticksClock(fc.dueTick) });
    out.push(`<div class="s-hint shared-hint castle-rival">${iconSvg(r.good, 22)}<span dir="auto">${capFirst(linked(text, world, r.rival))}</span></div>`);
  }
  return out.join('');
}

/**
 * The switch on a two-castle castle card (D-289): "Ten zamek pierwszy" while it is not first (with what that would
 * bring: done by when, on time or not), else the state and "Dziel po równo". One tap; the other castle loses the mark.
 */
export function castleSwitchHtml(world: World, b: Building, log: PaceLog): string {
  if (!twoCastleOrder(world, b)) return '';
  const fc = castleForecastFor(world, log, b.id);
  if (!fc || fc.done) return '';
  if (fc.share === 'first') {
    return `<div class="section-h">${esc(t('castle.first'))}</div><div class="fix fix-dock castle-switch is-on">
      <button class="btn cf fix-btn" data-act="first:-1" aria-pressed="true">${iconSvg('contested', 26)}<span>${esc(t('castle.even'))}</span></button></div>`;
  }
  const late = fc.firstTick >= 0 && fc.firstTick > fc.dueTick;
  const why = fc.firstTick < 0 ? '' : tHtml(late ? 'fix.castleFirstLate' : 'fix.castleFirstWhy', { time: ticksClock(fc.firstTick) });
  return `<div class="section-h">${esc(t('fix.title'))}</div><div class="fix fix-dock castle-switch">
    <button class="btn primary cf fix-btn" data-act="first:${b.id}" aria-pressed="false">${iconSvg('first', 26)}<span>${esc(t('castle.first'))}</span></button>
    <div class="fix-note" dir="auto"><div class="s-hint"><span>${why}</span></div></div></div>`;
}
