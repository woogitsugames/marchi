// Two castles (mission XVI, D-288..D-291): the castle card's order, split and forecast lines, the rival line ("the
// north castle is getting the planks now") and the "this castle first" switch. Mission XVII (D-356..D-358) adds the
// chain line ("Węglarnia stoi — drewno idzie na deski dla Zamku Wschodniego") and the "whole chain" switch. Pure reads
// of the sim and of the UI's pace log; the switches only enqueue the castleFirst / chainFirst commands
// (data-act="first:<id>" / "chainfirst:<id>", -1 = share evenly).
import { MISSIONS, castleChainRival, castleNameKey, castleRival, contractsOf, type Building, type PaceLog, type World } from '../sim/index';
import { t, type MessageKey } from '../i18n/index';
import { esc } from './dom';
import { bdi, buildingName, capFirst, lateTicks10, tHtml, ticksClock } from './format';
import { iconSvg } from './icons';
import { castleForecastFor } from './paceCard';

/** A castle holding an order in a running two-castle mission (the castle card shows the switch). */
export function twoCastleOrder(world: World, b: Building): boolean {
  const m = world.state.mission;
  return b.type === 'castle' && !!m.extraContracts && m.result === 'running' && contractsOf(m).some((c) => c.castle === b.id);
}

/** Mission XVII (D-356): the castle card offers the whole-chain switch beside the castle-leg one. */
export function chainMission(world: World): boolean {
  return MISSIONS[world.state.mission.id]?.chainPriority === true;
}

/** "dla Zamku Wschodniego" — a castle as the beneficiary, in the language's own form (D-358). */
function forCastle(world: World, id: number): string {
  const k = castleNameKey(world, id);
  return k ? t(`castle.for.${k}`) : buildingName(world, id);
}

/**
 * Mission XVII (D-358): "Węglarnia stoi — drewno idzie na deski dla Zamku Wschodniego." — this castle's producer starved
 * of the input another castle's chain takes (castleChainRival); the producer is a link. '' when none.
 */
export function castleChainHtml(world: World, b: Building): string {
  const r = castleChainRival(world, b.id);
  if (!r) return '';
  const text = tHtml('castle.chainRival', {
    producer: '\u0001', input: t(`good.${r.input}` as MessageKey), outAcc: t(`goodAcc.${r.good}` as MessageKey), forCastle: forCastle(world, r.castle),
  });
  return `<div class="s-hint shared-hint castle-chain">${iconSvg('contested', 22)}<span dir="auto">${capFirst(linked(text, world, r.producer))}</span></div>`;
}

/** A rival castle's name as a link in a translated line (the \u0001 placeholder trick of sharedHtml). */
function linked(html: string, world: World, id: number): string {
  return html.split(bdi('\u0001')).join(`<button class="linkish" data-go="building:${id}">${esc(buildingName(world, id))}</button>`);
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
  const chained = chainMission(world);
  const chainOn = !!m.chainFirst && m.firstCastle !== undefined;
  const split = chained && chainOn && m.firstCastle === b.id
    ? `<div class="s-hint castle-split is-first">${iconSvg('first', 22)}<span dir="auto">${esc(t('castle.chainOn'))}</span></div>`
    : chained && chainOn
      ? `<div class="s-hint castle-split">${iconSvg('first', 22)}<span dir="auto">${linked(tHtml('castle.splitChainAfter', { rival: '\u0001' }), world, m.firstCastle!)}</span></div>`
      : chained && fc.share === 'even'
        ? `<div class="s-hint castle-split">${iconSvg('contested', 22)}<span dir="auto">${esc(t('castle.splitEvenChain'))}</span></div>`
        : fc.share === 'first'
    ? `<div class="s-hint castle-split is-first">${iconSvg('first', 22)}<span dir="auto">${esc(t('castle.firstOn'))}</span></div>`
    : fc.share === 'after'
      ? `<div class="s-hint castle-split">${iconSvg('first', 22)}<span dir="auto">${linked(tHtml('castle.splitAfter', { rival: '\u0001' }), world, m.firstCastle!)}</span></div>`
      : `<div class="s-hint castle-split">${iconSvg('contested', 22)}<span dir="auto">${esc(t('castle.splitEven'))}</span></div>`;
  out.push(split);
  if (fc.finishTick >= 0) {
    const late = fc.finishTick > fc.dueTick;
    // same rounding as the pace card and the waybill, so landscape never shows "2:20" next to "2:12" (D-318)
    const lateBy = lateTicks10(fc.finishTick - fc.dueTick);
    const line = late
      ? tHtml('castle.fcLate', { time: ticksClock(fc.dueTick + lateBy), late: ticksClock(lateBy) })
      : tHtml('castle.fcOk', { time: ticksClock(fc.finishTick) });
    // what "first" would bring is said once, under the switch in the dock (fix.castleFirstWhy/Late), so the chain's
    // root stays above the dock on a 360 x 740 phone (D-146)
    out.push(`<div class="pace-fc castle-fc${late ? ' late' : ''}"><span dir="auto">${line}</span></div>`);
  }
  // mission XVII: the shared input goes to the other castle's chain (the producer here stands idle)
  // (not once this castle goes first with its chain: the wood already at the other workshop is no longer the news)
  if (chained && !(chainOn && m.firstCastle === b.id)) out.push(castleChainHtml(world, b));
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
  if (chainMission(world)) return chainSwitchHtml(world, b, fc.firstTick, fc.dueTick);
  if (fc.share === 'first') {
    // on: no heading (the lead line above says it is first); the dock holds the way back to the even split.
    // Both states are plain action buttons: the label changes with the state, so aria-pressed would read
    // "Share evenly, pressed" while the castle is first (a11y audit 2026-11-08, D-347)
    return `<div class="fix fix-dock castle-switch is-on">
      <button class="btn cf fix-btn" data-act="first:-1">${iconSvg('contested', 26)}<span>${esc(t('castle.even'))}</span></button></div>`;
  }
  const late = fc.firstTick >= 0 && fc.firstTick > fc.dueTick;
  const why = fc.firstTick < 0 ? '' : tHtml(late ? 'fix.castleFirstLate' : 'fix.castleFirstWhy', { time: ticksClock(fc.firstTick) });
  return `<div class="section-h">${esc(t('fix.title'))}</div><div class="fix fix-dock castle-switch">
    <button class="btn primary cf fix-btn" data-act="first:${b.id}">${iconSvg('first', 26)}<span>${esc(t('castle.first'))}</span></button>
    <div class="fix-note" dir="auto"><div class="s-hint"><span>${why}</span></div></div></div>`;
}

/**
 * Mission XVII (D-356): the whole-chain switch ("Cały łańcuch dla tego zamku", with what it brings) above the castle-leg
 * switch, whose note says it moves finished goods only; once this castle goes first with its chain, "Dziel po równo".
 * Each is one tap (≥ 48 px buttons, the XVI dock).
 */
function chainSwitchHtml(world: World, b: Building, firstTick: number, dueTick: number): string {
  const m = world.state.mission;
  const even = `<button class="btn cf fix-btn" data-act="first:-1">${iconSvg('contested', 26)}<span>${esc(t('castle.even'))}</span></button>`;
  if (m.chainFirst && m.firstCastle === b.id) return `<div class="fix fix-dock castle-switch is-on">${even}</div>`;
  const late = firstTick >= 0 && firstTick > dueTick;
  const why = firstTick < 0 ? '' : tHtml(late ? 'fix.castleChainLate' : 'fix.castleChainWhy', { time: ticksClock(firstTick) });
  const legOn = !m.chainFirst && m.firstCastle === b.id;
  const leg = legOn ? even
    : `<button class="btn cf fix-btn" data-act="first:${b.id}">${iconSvg('wagon', 26)}<span>${esc(t('castle.first'))}</span></button>`;
  return `<div class="section-h">${esc(t('fix.title'))}</div><div class="fix fix-dock castle-switch castle-chain-switch">
    <button class="btn primary cf fix-btn" data-act="chainfirst:${b.id}">${iconSvg('first', 26)}<span>${esc(t('castle.chain'))}</span></button>
    <div class="fix-note" dir="auto"><div class="s-hint"><span>${why}</span></div></div>
    ${leg}
    <div class="fix-note" dir="auto"><div class="s-hint"><span>${esc(t(legOn ? 'castle.firstOn' : 'fix.castleLegNote'))}</span></div></div></div>`;
}
