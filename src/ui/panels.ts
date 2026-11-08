// Sheet contents: "Dlaczego stoi?" (building), wagon card, and their cause chains.
import {
  BUILDINGS, GOODS, buildingById, contractsOf, roadCellCost, cycleTicks, contractFilled, explainBuilding, explainWagon, granaryRelief, inputGoods, lastUndoable, outputGoods, outputSurplus, seasonAt, seasonNote, seasonal, seasonalSupplier, stoneInStore, topUpHold, STONE_COBBLE,
  suggestLinkToStable, wagonEta, wagonSlowdown, type SeasonNote, TRADE_POST, MARKET, tradePostStatus,
  STONE_RESERVE, UNDO_TICKS, WAGON_PRICE, canPlace, canSurface, validateRoad, type BuildingType, rankGated, stoneAvailable, type Building, type Good, type PaceLog, type ReasonLink, type RoadSuggestion, type World,
} from '../sim/index';
import { t, translated, type MessageKey } from '../i18n/index';
import { cardBuild } from './cardBuild';
import { esc, setHtml } from './dom';
import {
  bdi, buildingName, buildingStateIcon, buildingStatusText, clock, codexLink, fmtDec, fmtInt, fmtPercent, fmtRatio, iceWaitSec, goodName, isStall, isStallLink, isWagonWait, linkIcon, linkSubject, linkText, rankName, sentences, tHtml, ticksClock,
  wagonName, wagonStatusText,
} from './format';
import { iconSvg, type IconId } from './icons';
import { revealAboveDock, type Sheet, type SheetContent } from './sheets';
import { WAGON_REFUND } from './deadEnd';
import { castlePaceHtml, forecastFor, sharedHtml, thinHtml } from './pace';
import { castleOrderHtml, castleSwitchHtml, twoCastleOrder } from './castles';
import { chainRoot, codexCalm, quietStall, cureFor, granaryAnchor, gapTarget, granaryUnwanted, marketSaturated, iceBeforeWagon, paveCheck, paveSpanFor, postWouldTake, producerCure, quarryForPave, recentWagonWait } from './stalls';
import { bottleneckCard, neckWaiting } from './bottleneck';
import { fleetCueFor, paceCard, type PaceCard, type PaceFleet, type PaceHaul, type PaceMud, type PaceRank, type PaceGrow } from './paceCard';

export { gapTarget };
import { buildTypes } from './buildTool';
import { errorText } from './roadTool';
import { codexHtml, codexSituationHtml, toggleCodex } from './codex';
import { castleCodexSituation, codexSituation } from './codexSituations';

export interface PanelNav {
  readonly world: World;
  /** Contract pace samples for the castle card's forecast. */
  readonly pace: PaceLog;
  /** Mission I's tutorial runs: the castle card folds its order and pace (research P6, ~45 words at once). */
  tutorialRunning?(): boolean;
  /** The build tutorial's new woodcutter's hut while the lesson runs, else -1 (its stall reads the lesson's entry). */
  tutorialHut?(): number;
  /** Jump the camera to a subject and open its sheet. */
  go(kind: 'building' | 'wagon', id: number): void;
  buyWagon(stable: number): void;
  sellWagon(wagon: number): void;
  toggleFollow(wagon: number): void;
  following(): number | null;
  /** Enqueue a dirt road (wooden bridge over water) along these cells. */
  /** Lay road (1, dirt) or cobbles / a stone bridge (2) over these cells. */
  buildRoad(cells: number[], surface?: 1 | 2): void;
  /** Ghost road on the map for the gap finder (null clears it). */
  /** Ghost road on the map while a sheet is open; `pave`: an existing dirt stretch proposed for cobbles (D-132). */
  /**
   * `frameAt` >= 0: one camera move to the ghost even when it is a plain road, keeping this cell (the far building's
   * centre) in view too (D-245, the trading post's road across the river).
   */
  setGhost(cells: number[] | null, pave?: boolean, frameAt?: number): void;
  /** Take back a building placed moments ago (full refund while lastUndoable names it). */
  undoPlace(building: number): void;
  /** Open the build tool with this building type already picked (the sheet closes). */
  /** `then` (D-380): the build tool opens again with this type by the new building once `type` stands. */
  pickBuild(type: BuildingType, near: number, then?: BuildingType): void;
  /** Two castles (D-289): this castle's order first (castleFirst command); -1 shares evenly again. */
  castleFirst(castle: number): void;
}

// ---------------------------------------------------------------- gap finder

let gapCache: { key: string; s: RoadSuggestion | null } | null = null;
/** suggestLinkToStable runs a whole-grid Dijkstra: compute once per road network version. */
export function gapSuggestion(world: World, target: number): RoadSuggestion | null {
  const key = `${target}:${world.state.netVersion}:${world.state.buildings.length}`;
  if (gapCache?.key !== key) gapCache = { key, s: suggestLinkToStable(world, target) };
  return gapCache.s;
}

function fixHtml(world: World, target: number, s: RoadSuggestion, why: MessageKey | null = null): string {
  const short = s.cost - world.state.coins;
  const label = tHtml(s.bridgeCells > 0 ? 'fix.bridge' : 'fix.road', { n: fmtInt(s.cost) });
  const btn = `<button class="btn primary cf fix-btn${short > 0 ? ' is-disabled' : ''}" data-act="fix:${target}" aria-disabled="${short > 0}">${
    iconSvg('road_dirt', 26)}<span>${label}</span></button>`;
  const hint = short > 0
    ? `<div class="s-hint fix-why">${iconSvg('coin', 18)}<span dir="auto">${tHtml('fix.short', { n: fmtInt(short) })}</span></div>`
    : why
      // D-245: the reason docks with the button (as the pace cures, D-138): a short side sheet scrolls the lead away
      ? `<div class="s-hint">${iconSvg('tradePost', 18)}<span dir="auto">${esc(t(why))}</span></div>`
      : `<div class="s-hint">${esc(t('fix.shown'))}</div>`;
  return fixSection(btn, hint, short > 0);
}

/**
 * The "Naprawa" section (D-100): header, the fix button in a dock that sticks to the sheet's bottom edge while
 * the chain above it scrolls (a short landscape side sheet shows ~140 px of body). The explaining hint docks with
 * it (D-138: for the pace cures it is the reason itself, "Wóz 1 dojedzie po ładunek za 1:19"), under the button,
 * and beside it on a short landscape sheet; a disabled button's reason ("Brakuje 10 srebra") likewise.
 * The dock must be a direct box child of the scrolling body: the sheet's parts are `display: contents`.
 */
function fixSection(btn: string, hint: string, why: boolean, wide = false): string {
  const head = `<div class="section-h">${esc(t('fix.title'))}</div>`;
  // wide (D-270): a long reason (the grow card's two sentences) takes its own full-width row under the button on a
  // short landscape sheet and wraps there, instead of a three-line clamp beside the button
  const cls = `fix fix-dock${wide ? ' fix-wide' : ''}`;
  return why
    ? `${head}<div class="${cls}">${btn}${hint}</div>`
    : `${head}<div class="${cls}">${btn}<div class="fix-note" dir="auto">${hint}</div></div>`;
}

/**
 * The pace card's fix on its producer's sheet (day 8c): the producers work flat out and still miss the next seal,
 * so one more of them (the build tool opens with that type, the ghost on the mission's authored site, D-107).
 */
function paceCureHtml(world: World, pc: PaceCard, log: PaceLog): string {
  if (pc.k === 'castle') { const b = buildingById(world, pc.producer); return b ? castleSwitchHtml(world, b, log) : ''; }
  if (pc.k === 'mud') return mudCureHtml(world, pc);
  if (pc.k === 'fleet') return fleetCureHtml(world, pc);
  if (pc.k === 'haul') return haulCureHtml(world, pc);
  if (pc.k === 'rank') return rankCureHtml(world, pc);
  if (pc.k === 'grow') return growCureHtml(pc);
  // D-245: the post card's subject is the post itself; its sheet's gap finder holds the road (normally `fix` wins)
  if (pc.k === 'post') { const s = gapSuggestion(world, pc.producer); return s ? fixHtml(world, pc.producer, s) : ''; }
  const gate = canPlace(world, pc.type);
  const price = BUILDINGS[pc.type].price;
  const short = price - world.state.coins;
  const off = !gate.ok || short > 0;
  const btn = `<button class="btn primary cf fix-btn${off ? ' is-disabled' : ''}" data-act="producer:${pc.producer}" aria-disabled="${off}">${
    iconSvg('build', 26)}<span>${esc(t('fix.producer', { name: t(`building.${pc.type}` as MessageKey) }))}</span>${bdi(`−${fmtInt(price)}`)}</button>`;
  const hint = !gate.ok
    ? `<div class="s-hint fix-why">${iconSvg('build', 18)}<span dir="auto">${esc(errorText(gate.err))}</span></div>`
    : short > 0
      ? `<div class="s-hint fix-why">${iconSvg('coin', 18)}<span dir="auto">${tHtml('fix.short', { n: fmtInt(short) })}</span></div>`
      : `<div class="s-hint">${esc(t('fix.paceProducerWhy', { n: fmtInt(pc.n), cap: fmtDec(pc.cap, 1), seals: t('why.pace.seals', { n: pc.seals }), need: fmtDec(pc.need, 1) }))}</div>`;
  return fixSection(btn, hint, off);
}

/**
 * The free valley's rank card on the castle's sheet (D-152): the next rank lacks a good sold, so the producer that
 * brings one — the build tool opens with that type, the ghost by the castle. Disabled with the shortfall.
 */
function rankCureHtml(world: World, pc: PaceRank): string {
  const { name, price } = cardBuild(pc);
  const short = BUILDINGS[pc.type].price - world.state.coins;
  const off = short > 0;
  const btn = `<button class="btn primary cf fix-btn${off ? ' is-disabled' : ''}" data-act="rank:${pc.type}" aria-disabled="${off}">${
    iconSvg('build', 26)}<span>${esc(t('fix.rank', { name }))}</span>${bdi(`−${fmtInt(price)}`)}</button>`;
  const hint = off
    ? `<div class="s-hint fix-why">${iconSvg('coin', 18)}<span dir="auto">${tHtml('fix.short', { n: fmtInt(short) })}</span></div>`
    : `<div class="s-hint">${esc(t('fix.rankWhy', { sold: fmtInt(pc.sold), goods: fmtInt(pc.goods), rankName: rankName(pc.rank), good: goodName(pc.good) }))}</div>`;
  return fixSection(btn, hint, off);
}

/**
 * The free valley's grow card on the castle's sheet (D-192): the next rank lacks renown (D-264: or flow), so one more producer of
 * a standing chain — the build tool opens with that type, the ghost by the castle. The card exists only while the
 * building is affordable with the reserve, so the button is never disabled for silver.
 */
function growCureHtml(pc: PaceGrow): string {
  const { name, price } = cardBuild(pc);
  const btn = `<button class="btn primary cf fix-btn" data-act="grow:${pc.type}" aria-disabled="false">${
    iconSvg('build', 26)}<span>${esc(t('fix.producer', { name }))}</span>${bdi(`−${fmtInt(price)}`)}</button>`;
  const goodGen = t(`goodGen.${pc.good}` as MessageKey);
  // D-264: the flow variant names the silver per minute the next rank still lacks
  const why = pc.short === 'flow'
    ? t('fix.growWhyFlow', { flow: fmtInt(pc.flow), need: fmtInt(pc.flowNeed), rankName: rankName(pc.rank), name, goodGen })
    : t('fix.growWhy', { renown: fmtInt(pc.renown), need: fmtInt(pc.need), rankName: rankName(pc.rank), name, goodGen });
  const hint = `<div class="s-hint">${esc(why)}</div>`;
  return fixSection(btn, hint, false, true);
}

/**
 * Mud on this producer's delivery to the castle (day 8c): not a stall, the wagons drive slower. Shown only when the
 * forecast misses three seals (owner 2026-11-04): the cobble button and how much the stretch would help.
 */
function mudCureHtml(world: World, pc: PaceMud): string {
  const pct = fmtPercent(pc.pct / 100);
  const ok = validateRoad(world, pc.cells, 2);
  const btn = `<button class="btn primary cf fix-btn${ok.ok ? '' : ' is-disabled'}" data-act="mud:${pc.producer}" aria-disabled="${!ok.ok}">${
    iconSvg('road_cobble', 26)}<span>${esc(t('fix.mud', { n: fmtInt(pc.cells.length) }))}</span>${bdi(`−${fmtInt(pc.cost)}`)}</button>`;
  const hint = ok.ok
    ? `<div class="s-hint">${esc(t('fix.mudWhy', { pct }))}</div>`
    : `<div class="s-hint fix-why">${iconSvg(ok.err.k === 'NO_COINS' ? 'coin' : 'road_cobble', 18)}<span dir="auto">${
      ok.err.k === 'NO_COINS' ? tHtml('fix.short', { n: fmtInt(ok.err.need - ok.err.have) }) : esc(errorText(ok.err))}</span></div>`;
  return fixSection(btn, hint, !ok.ok);
}

/**
 * The fleet kind of the pace card (D-127): this yard waits for a wagon while the whole fleet is on the road and the
 * forecast misses a seal. "Kup wóz" here, with the reason; the card only appears when the silver is there.
 */
function fleetCureHtml(world: World, pc: PaceFleet): string {
  const stable = world.state.buildings.find((q) => q.type === 'stable');
  if (!stable) return '';
  const short = WAGON_PRICE - world.state.coins;
  const eta = wagonEta(world, pc.wagon);
  const btn = `<button class="btn primary cf fix-btn${short > 0 ? ' is-disabled' : ''}" data-act="buy:${stable.id}" aria-disabled="${short > 0}">${
    iconSvg('buy_wagon', 26)}<span>${esc(t('fix.wagon'))}</span>${bdi(`−${fmtInt(WAGON_PRICE)}`)}</button>`;
  const hint = short > 0
    ? `<div class="s-hint fix-why">${iconSvg('coin', 18)}<span dir="auto">${tHtml('fix.short', { n: fmtInt(short) })}</span></div>`
    : `<div class="s-hint">${esc(eta ? t('fix.paceFleetEta', { wagon: wagonName(world, pc.wagon), time: clock(eta.toDest) }) + ' ' : '')}${
      esc(pc.seals < 0 ? t('fix.paceFleetWhyFree') : t('fix.paceFleetWhy', { seals: t('why.pace.seals', { n: pc.seals }) }))}</div>`;
  return fixSection(btn, hint, short > 0);
}

/**
 * The two-castle haul card (D-307) on the shared producer's sheet: the fleet cannot keep it at work, and the order of
 * both castles is forecast past (or too close to, D-313) the next seal. "Kup wóz" with the forecast's finish and the
 * seal in reach.
 */
function haulCureHtml(world: World, pc: PaceHaul): string {
  // D-313: the whole order's forecast finish comes first — while the card shows it holds to within ~20 s of the run's
  // finish (tools/m16-forecast-error.ts), so "ok." (around) is honest; then the seal in reach and its exact time
  const why = sentences(t('fix.paceHaulAt', { finish: ticksClock(pc.finishTick) }),
    t('fix.paceHaulWhy', { goodGen: t(`goodGen.${pc.good}` as MessageKey), by: ticksClock(pc.byTick), aim: t('why.pace.seals', { n: pc.aim }) }));
  const stable = world.state.buildings.find((q) => q.type === 'stable');
  if (!stable) return '';
  const short = WAGON_PRICE - world.state.coins;
  const btn = `<button class="btn primary cf fix-btn${short > 0 ? ' is-disabled' : ''}" data-act="buy:${stable.id}" aria-disabled="${short > 0}">${
    iconSvg('buy_wagon', 26)}<span>${esc(t('fix.wagon'))}</span>${bdi(`−${fmtInt(WAGON_PRICE)}`)}</button>`;
  const hint = short > 0
    ? `<div class="s-hint fix-why">${iconSvg('coin', 18)}<span dir="auto">${tHtml('fix.short', { n: fmtInt(short) })}</span></div>`
    : `<div class="s-hint">${esc(why)}</div>`;
  // two sentences: their own full-width row on a short landscape sheet (D-270), as the grow card's
  return fixSection(btn, hint, short > 0, true);
}

/** "Kup wóz" from the stable, with its reason (or the silver short of it). */
function wagonCureHtml(world: World, why: string): string {
  const stable = world.state.buildings.find((q) => q.type === 'stable');
  if (!stable) return '';
  const short = WAGON_PRICE - world.state.coins;
  const btn = `<button class="btn primary cf fix-btn${short > 0 ? ' is-disabled' : ''}" data-act="buy:${stable.id}" aria-disabled="${short > 0}">${
    iconSvg('buy_wagon', 26)}<span>${esc(t('fix.wagon'))}</span>${bdi(`−${fmtInt(WAGON_PRICE)}`)}</button>`;
  const hint = short > 0
    ? `<div class="s-hint fix-why">${iconSvg('coin', 18)}<span dir="auto">${tHtml('fix.short', { n: fmtInt(short) })}</span></div>`
    : `<div class="s-hint">${esc(why)}</div>`;
  return fixSection(btn, hint, short > 0);
}

/**
 * One remedy under the chain when its root is not a missing road (that one has the road fix above):
 * every wagon busy -> buy a wagon here (no trip back to the rail); a one-lane wooden bridge jams ->
 * a second crossing, or a stone bridge once cobbles are unlocked (stone spans have no one-lane rule).
 */
function cureHtml(world: World, b: Building, chain: ReasonLink[]): string {
  const cure = cureFor(world, b.id);
  if (cure === 'granary') {
    // full output with nowhere to deliver: a granary where the player may build (owner decision 2,
    // 2026-11-03), otherwise only the hint — in a fixed-map mission the cure is a road or a freed store
    if (!buildTypes(world).includes('warehouse')) {
      return `<div class="section-h">${esc(t('fix.title'))}</div><div class="s-hint granary-hint">${iconSvg('warehouse', 18)}<span>${esc(t('fix.granaryHint'))}</span></div>`;
    }
    const gate = canPlace(world, 'warehouse');
    const short = BUILDINGS.warehouse.price - world.state.coins;
    const off = !gate.ok || short > 0;
    // D-391: the ghost opens by the first building with a site a road reaches (cureFor offers no granary without one)
    const near = granaryAnchor(world, b, chainRoot(chain, b.id));
    const btn = `<button class="btn primary cf fix-btn${off ? ' is-disabled' : ''}" data-act="granary:${near >= 0 ? near : b.id}" aria-disabled="${off}">${
      iconSvg('warehouse', 26)}<span>${esc(t('fix.granary'))}</span>${bdi(`−${fmtInt(BUILDINGS.warehouse.price)}`)}</button>`;
    const hint = !gate.ok
      ? `<div class="s-hint fix-why">${iconSvg('build', 18)}<span dir="auto">${esc(errorText(gate.err))}</span></div>`
      : short > 0
        ? `<div class="s-hint fix-why">${iconSvg('coin', 18)}<span dir="auto">${tHtml('fix.short', { n: fmtInt(short) })}</span></div>`
        : `<div class="s-hint">${esc(t('fix.granaryWhy'))}</div>`;
    return fixSection(btn, hint, off);
  }
  if (cure === 'producer') {
    // one producer feeds two workshops (research P5): build a second one next to it (the build tool opens
    // with that type picked, the ghost by the first producer)
    // (or the free valley's bottleneck card, D-171: build one more producer of the good most workshops wait for)
    const sh = producerCure(world, b);
    if (!sh) return '';
    const gate = canPlace(world, sh.type);
    const price = BUILDINGS[sh.type].price;
    const short = price - world.state.coins;
    const off = !gate.ok || short > 0;
    const btn = `<button class="btn primary cf fix-btn${off ? ' is-disabled' : ''}" data-act="producer:${sh.producer}:${sh.type}" aria-disabled="${off}">${
      iconSvg('build', 26)}<span>${esc(t('fix.producer', { name: t(`building.${sh.type}` as MessageKey) }))}</span>${bdi(`−${fmtInt(price)}`)}</button>`;
    const hint = !gate.ok
      ? `<div class="s-hint fix-why">${iconSvg('build', 18)}<span dir="auto">${esc(errorText(gate.err))}</span></div>`
      : short > 0
        ? `<div class="s-hint fix-why">${iconSvg('coin', 18)}<span dir="auto">${tHtml('fix.short', { n: fmtInt(short) })}</span></div>`
        : sh.source === 'neck'
          ? `<div class="s-hint">${esc(t('neck.why', { goodAcc: t(`goodAcc.${sh.good}` as MessageKey), n: neckN(world), m: fmtInt(sh.consumers) }))}</div>`
          : `<div class="s-hint">${esc(t('fix.producerWhy', { who: buildingName(world, sh.producer), n: fmtInt(sh.consumers) }))}</div>`;
    return fixSection(btn, hint, off);
  }
  if (cure === 'pave') {
    // a wagon of this building's job stands at a wooden span (research P4), or the ice ahead outranks a wagon
    // (day 8c): pave the span in stone
    const h = paveSpanFor(world, b);
    if (!h) return '';
    // D-390: no stone and no quarry to dig it — the quarry first (the grey stone button would be a dead end)
    const qa = quarryForPave(world, b);
    if (qa >= 0) {
      const price = BUILDINGS.quarry.price, short = price - world.state.coins, off = short > 0;
      const btn = `<button class="btn primary cf fix-btn${off ? ' is-disabled' : ''}" data-act="producer:${qa}:quarry" aria-disabled="${off}">${
        iconSvg('build', 26)}<span>${esc(t('fix.producer', { name: t('building.quarry') }))}</span>${bdi(`−${fmtInt(price)}`)}</button>`;
      const hint = off
        ? `<div class="s-hint fix-why">${iconSvg('coin', 18)}<span dir="auto">${tHtml('fix.short', { n: fmtInt(short) })}</span></div>`
        : `<div class="s-hint">${esc(t('fix.paveQuarry'))}</div>`;
      return fixSection(btn, hint, off);
    }
    const ok = paveCheck(world, h);
    let price = 0;
    for (const c of h.cells) price += roadCellCost(world, c, 2);
    const btn = `<button class="btn primary cf fix-btn${ok.ok ? '' : ' is-disabled'}" data-act="pave:${b.id}" aria-disabled="${!ok.ok}">${
      iconSvg('road_cobble', 26)}<span>${esc(t('fix.pave'))}</span>${bdi(`−${fmtInt(price)}`)}</button>`;
    const hint = ok.ok
      ? `<div class="s-hint">${esc(h.held
        ? t('fix.paveWhy', { wagon: wagonName(world, h.held.wagon) })
        : t('fix.iceAheadWhy', { time: ticksClock(h.ice!.startTick - world.state.tick), n: fmtInt(price) }))}</div>`
      : `<div class="s-hint fix-why">${iconSvg(ok.err.k === 'NO_COINS' ? 'coin' : 'road_cobble', 18)}<span dir="auto">${
        ok.err.k === 'NO_COINS' ? tHtml('fix.short', { n: fmtInt(ok.err.need - ok.err.have) }) : esc(errorText(ok.err))}</span></div>`;
    return fixSection(btn, hint, !ok.ok);
  }
  if (cure === 'wagon') return wagonCureHtml(world, t('fix.wagonWhy'));
  // a wagon in the chain waits at a one-lane bridge (also behind the wagon it waits for, audit fix 2)
  if (chain.some((l) => l.kind === 'wagon' && l.status.k === 'BRIDGE_JAM')) {
    const text = canSurface(world, 2).ok ? t('fix.jamStone') : t('fix.jam');
    return `<div class="section-h">${esc(t('fix.title'))}</div><div class="s-hint jam-hint">${iconSvg('bridge_jam', 18)}<span>${esc(text)}</span></div>`;
  }
  return '';
}

/**
 * D-245: a saturated granary the unlinked trading post would empty — the reason that goes with the post's road
 * ("Zamek nie weźmie teraz więcej. Posterunek handlowy za rzeką kupi więcej — doprowadź drogę z mostem."), or null.
 */
function postWhy(world: World, b: Building): MessageKey | null {
  if (b.type !== 'warehouse' || !marketSaturated(world, b)) return null;
  const post = postWouldTake(world, b.id);
  const link = post >= 0 ? gapSuggestion(world, post) : null;
  return link ? (link.bridgeCells > 0 ? 'fix.marketFullPost' : 'fix.marketFullPostRoad') : null;
}

/**
 * A stall with nothing to fix, said plainly instead of a cure that would not work (audit 2026-11-03): a full
 * yard nobody needs right now (fix 1: no "Kup wóz"), a full granary while another one has room (fix 3, with one
 * tap to it), the rest of a good whose order is complete (fix 6: no granary hint). Only when the chain stops at the
 * building itself; placed right under the count, above the codex fold, so it is read before the generic advice.
 */
function calmHtml(world: World, b: Building, chain: ReasonLink[], fleet: boolean): string {
  const en = (k: MessageKey): string => (translated(k) ? '' : ' lang="en" dir="ltr"');
  // D-193: the pickup already on its way, with its arrival (the fleet cue's own hint names it when "Kup wóz" shows)
  if (b.status.k === 'WAITING_PICKUP' && !fleet && quietStall(world, b)) {
    const wagon = b.status.wagon;
    const eta = wagonEta(world, wagon);
    const key: MessageKey = eta && eta.destBuilding === b.id ? 'fix.pickupDue' : 'fix.pickupOnWay';
    return `<div class="s-hint calm-hint">${iconSvg('wagon_due', 22)}<span${en(key)}>${
      esc(t(key, { wagon: wagonName(world, wagon), time: eta ? clock(eta.toDest) : '' }))}</span></div>`;
  }
  // D-174: a granary full of loads no market takes now (or a yard it refuses): no "Kup wóz", the plain reason
  if (marketSaturated(world, b)) {
    // D-245: ...unless the open trading post across the river would take them: lead to its road (the fix below)
    // (the reason docks with the fix button, postWhy)
    if (postWhy(world, b)) return '';
    return `<div class="s-hint calm-hint">${iconSvg('market_full', 22)}<span${en('fix.marketFull')}>${esc(t('fix.marketFull'))}</span></div>`;
  }
  // D-212: a granary full of goods nothing wants now (mission XV's fish): no repair, no wagon
  if (granaryUnwanted(world, b.id)) {
    return `<div class="s-hint calm-hint">${iconSvg('warehouse', 22)}<span${en('fix.unwanted')}>${esc(t('fix.unwanted'))}</span></div>`;
  }
  if (chain.length > 1) return '';
  const s = b.status;
  if (s.k === 'OUTPUT_FULL' && outputSurplus(world, b.id) === 'SPARE') {
    return `<div class="s-hint calm-hint">${iconSvg(s.good, 22, goodName(s.good))}<span${en('fix.surplus')}>${
      esc(t('fix.surplus', { goodGen: t(`goodGen.${s.good}` as MessageKey) }))}</span></div>`;
  }
  // D-95 (owner decision): mission VIII's quarry waits for the granary's reserve run, while the granary already
  // holds paving stone; the real numbers, and no "Kup wóz" (a new wagon carries workshop inputs first)
  const stored = stoneInStore(world, b.id);
  if (stored > 0) {
    return `<div class="s-hint calm-hint">${iconSvg('stone', 22, goodName('stone'))}<span${en('fix.stoneStored')}>${
      esc(t('fix.stoneStored', { n: stored, cells: t('road.cells', { n: Math.floor(stored / STONE_COBBLE) }) }))}</span></div>`;
  }
  const filled = contractFilled(world, b.id);
  if (filled) {
    return `<div class="s-hint calm-hint">${iconSvg(filled, 22, goodName(filled))}<span${en('fix.orderFilled')}>${
      esc(t('fix.orderFilled', { goodAcc: t(`goodAcc.${filled}` as MessageKey) }))}</span></div>`;
  }
  if (s.k === 'STORAGE_FULL') {
    const r = granaryRelief(world, b.id);
    if (r?.k === 'ROOM') {
      return `<div class="s-hint calm-hint">${iconSvg('warehouse', 22)}<span${en('fix.storeRoom')}>${esc(t('fix.storeRoom'))} <button class="linkish" data-go="building:${r.granary}">${
        esc(buildingName(world, r.granary))}</button></span></div>`;
    }
  }
  return '';
}

/**
 * H5 (full storage): the plain count against the cap — "8/8 zboża — brak miejsca na nowy towar" on a producer's
 * yard (OUTPUT_FULL), "60/60 — brak miejsca na odbiór" on a granary (STORAGE_FULL) — and the effect: what stops
 * and who waits because of it, one tap to each. For the building itself, or for the full building at the root of
 * its chain (then named). Read-only; promises no action (the cure section below says what can be done).
 */
function fullHtml(world: World, b: Building, chain: ReasonLink[]): string {
  // a pending key reads its English fallback: laid out left to right even in an RTL sheet (as the codex)
  const en = (k: MessageKey): string => (translated(k) ? '' : ' lang="en" dir="ltr"');
  const root = chain.length > 1 ? chain[chain.length - 1]! : null;
  const self = b.status.k === 'OUTPUT_FULL' || b.status.k === 'STORAGE_FULL';
  const subject = self ? b : root && root.kind === 'building' && (root.status.k === 'OUTPUT_FULL' || root.status.k === 'STORAGE_FULL')
    ? buildingById(world, root.id) : null;
  if (!subject) return '';
  const s = subject.status;
  let line: string;
  if (s.k === 'OUTPUT_FULL') {
    const def = BUILDINGS[subject.type];
    const have = subject.stock[s.good], cap = def.outCap, batch = def.recipe?.outputs[s.good] ?? 1;
    const key: MessageKey = have >= cap ? 'why.full.out' : 'why.full.outBatch';
    line = `${iconSvg(s.good, 26, goodName(s.good))}<span${en(key)}>${tHtml(key, { count: fmtRatio(have, cap), goodGen: t(`goodGen.${s.good}` as MessageKey), n: fmtInt(batch) })}</span>`;
  } else if (s.k === 'STORAGE_FULL') {
    const cap = subject.capOverride >= 0 ? subject.capOverride : BUILDINGS[subject.type].storeCap ?? 0;
    const held = GOODS.reduce((a, g) => a + subject.stock[g] + subject.incoming[g], 0);
    line = `${iconSvg('storage_full', 26)}<span${en('why.full.store')}>${tHtml('why.full.store', { count: fmtRatio(held, cap) })}</span>`;
  } else return '';
  const named = subject.id !== b.id
    ? `<button class="linkish" data-go="building:${subject.id}">${esc(buildingName(world, subject.id))}</button>` : '';
  // a calm full (surplus, saturated market, room elsewhere — calmWhy — or a customer that still takes it, D-193):
  // the plain panel, the count in ink (D-180)
  const calm = quietStall(world, subject);
  let html = `<div class="full-hint${calm ? ' is-calm' : ''}">${named ? `<div class="fh-who">${named}</div>` : ''}<div class="fh-count">${line}</div>`;
  if (subject.id === b.id) {
    // the effect: buildings whose cause chain runs through this one (a producer refused by a full granary), and
    // for a full yard the customers short of this very good — it lies here while they wait for a wagon
    const g = s.k === 'OUTPUT_FULL' ? s.good : null;
    const hit: Building[] = [];
    for (const c of world.state.buildings) {
      if (c.id === b.id || !(isStall(c.status) || c.status.k === 'NO_INPUT')) continue;
      const short = g !== null && (c.status.k === 'NO_INPUT' || c.status.k === 'NO_WAGON') && c.status.good === g;
      if (short || explainBuilding(world, c.id, 5, true).some((l, i) => i > 0 && l.kind === 'building' && l.id === b.id)) hit.push(c);
    }
    const effectKey: MessageKey = s.k === 'OUTPUT_FULL' ? 'why.full.halted' : 'why.full.refuses';
    const names = hit.slice(0, 3).map((c) => `<button class="linkish" data-go="building:${c.id}">${esc(buildingName(world, c.id))}</button>`).join('');
    const lead = g !== null
      ? t('why.full.waiting', { goodAcc: t(`goodAcc.${g}` as MessageKey), goodGen: t(`goodGen.${g}` as MessageKey) })
      : t('why.full.blocked');
    html += `<div class="fh-effect"${en(effectKey)}>${esc(t(effectKey))}</div>${
      hit.length ? `<div class="fh-wait"><span${en(g !== null ? 'why.full.waiting' : 'why.full.blocked')}>${esc(lead)}</span>${names}</div>` : ''}`;
  }
  return html + '</div>';
}

/** Delegated clicks: [data-go="building:12"], [data-act="buy:3"]. */
/**
 * The body's fixed parts (`div.sb-part`, `display: contents`), created once per content; a sheet that navigates
 * to other content empties its body (Sheets.place), so they are rebuilt then.
 */
function sheetParts(body: HTMLElement, n: number): HTMLElement[] {
  const kids = [...body.children] as HTMLElement[];
  if (kids.length === n && kids.every((k) => k.classList.contains('sb-part'))) return kids;
  body.innerHTML = '';
  (body as HTMLElement & { __html?: string }).__html = undefined;
  const parts: HTMLElement[] = [];
  for (let i = 0; i < n; i++) { const d = document.createElement('div'); d.className = 'sb-part'; body.append(d); parts.push(d); }
  return parts;
}

/** A finger (or mouse button) is down on the sheet's body: its update waits until it lifts (item 4). */
function pressed(sheet: Sheet): boolean {
  return !!(sheet.body as HTMLElement & { __press?: boolean }).__press;
}

function wire(sheet: Sheet, nav: PanelNav): void {
  const body = sheet.body as HTMLElement & { __wired?: boolean; __press?: boolean };
  if (body.__wired) return;
  body.__wired = true;
  // hold re-renders while pressed, so the button under the finger is the one the click lands on; a scroll
  // drag cancels the pointer (touch-action: pan-y) and lifts the hold
  body.addEventListener('pointerdown', () => { body.__press = true; });
  // pointerup: lift after the click that follows it in the same task has been dispatched
  body.addEventListener('pointerup', () => { window.setTimeout(() => { body.__press = false; }, 0); });
  for (const ev of ['pointercancel', 'pointerleave'] as const) body.addEventListener(ev, () => { body.__press = false; });
  body.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-go],[data-act]');
    if (!el) return;
    const go = el.dataset.go;
    if (go) {
      const [kind, id] = go.split(':');
      nav.go(kind as 'building' | 'wagon', Number(id));
      return;
    }
    const [act, arg] = (el.dataset.act ?? '').split(':');
    if (act === 'codex') { toggleCodex(el); return; }
    if (act === 'sfold') { toggleCastleFold(el); return; }
    if (act === 'chain') { openChain(el, (el.dataset.act ?? '').slice(6)); return; }
    if (act === 'buy') nav.buyWagon(Number(arg));
    if (act === 'first') nav.castleFirst(Number(arg));
    if (act === 'follow') nav.toggleFollow(Number(arg));
    if (act === 'sell' && !el.classList.contains('is-disabled')) nav.sellWagon(Number(arg));
    if (act === 'undo') nav.undoPlace(Number(arg));
    if (act === 'granary' && !el.classList.contains('is-disabled')) nav.pickBuild('warehouse', Number(arg));
    if (act === 'pave' && !el.classList.contains('is-disabled')) {
      const b = buildingById(nav.world, Number(arg));
      const h = b ? paveSpanFor(nav.world, b) : null;
      if (h) nav.buildRoad(h.cells, 2);
    }
    if (act === 'mud' && !el.classList.contains('is-disabled')) {
      // the pace card's mud stretch (day 8c), recomputed now: the same cells the sheet showed
      const pc = paceCard(nav.world, forecastFor(nav.world, nav.pace), nav.pace);
      if (pc && pc.k === 'mud' && pc.producer === Number(arg)) nav.buildRoad(pc.cells, 2);
    }
    if (act === 'rank' && !el.classList.contains('is-disabled')) {
      // the free valley's rank card (D-152), recomputed now: build that producer, the ghost by the castle
      const pc = paceCard(nav.world, forecastFor(nav.world, nav.pace), nav.pace);
      if (pc && pc.k === 'rank' && pc.type === arg) nav.pickBuild(pc.type, pc.producer, pc.then);
    }
    if (act === 'grow') {
      // the free valley's grow card (D-192), recomputed now: one more producer, the ghost by the castle
      const pc = paceCard(nav.world, forecastFor(nav.world, nav.pace), nav.pace);
      if (pc && pc.k === 'grow' && pc.type === arg) nav.pickBuild(pc.type, pc.producer, pc.then);
    }
    if (act === 'producer' && !el.classList.contains('is-disabled')) {
      // D-390: the type rides along — the bottleneck card's ghost may open by a consumer, the castle or the stable
      const p = buildingById(nav.world, Number(arg));
      const type = (el.dataset.act ?? '').split(':')[2] as BuildingType | undefined;
      if (p) nav.pickBuild(type ?? p.type, p.id);
    }
    if (act === 'fix' && !el.classList.contains('is-disabled')) {
      const s = gapSuggestion(nav.world, Number(arg));
      if (s && s.cost <= nav.world.state.coins) nav.buildRoad(s.cells);
    }
  });
}

/**
 * setHtml that keeps keyboard focus on the same control (matched by its data-go / data-act) when the part is
 * re-rendered: the chain's stall clock and an unfolded "+N" change the markup, and focus used to drop to <body>.
 */
function setHtmlKeep(el: Element, html: string): void {
  const a = document.activeElement;
  const k = a instanceof HTMLElement && el.contains(a)
    ? a.dataset.go ? `[data-go="${CSS.escape(a.dataset.go)}"]` : a.dataset.act ? `[data-act="${CSS.escape(a.dataset.act)}"]` : null
    : null;
  if (setHtml(el, html) && k) el.querySelector<HTMLElement>(k)?.focus({ preventScroll: true });
}

/** Chains whose middle links the player unfolded on a short landscape sheet (per session, never in the sim). */
const chainOpen = new Set<string>();

/**
 * The cause chain. On a short landscape side sheet (D-111) the fix dock covers most of the ~136 px body, so the
 * chain shows the subject and directly the root; the links between fold behind one "+N" row that unfolds in
 * place. Both forms are in the markup and CSS picks one (portrait never folds); the unfolded state survives the
 * sheet's refreshes until it closes.
 */
function chainHtml(world: World, chain: ReasonLink[], selfKind: 'building' | 'wagon', selfId: number, since = ''): string {
  const because = esc(t('why.because'));
  const last = chain.length - 1;
  const key = `${selfKind}:${selfId}`;
  const mid = Math.max(0, chain.length - 2);
  const open = mid > 0 && chainOpen.has(key);
  const items = chain.map((l, i) => {
    const self = l.kind === selfKind && l.id === selfId;
    const root = i === last && chain.length > 1 && isStallLink(l);
    // a calm root (surplus, saturated market, …: nothing to fix there) keeps the "cause" tag but not the clay (D-180)
    const calmRoot = root && codexCalm(world, l);
    const tag = root ? `<span class="root-tag">${esc(t('why.root'))}</span>` : '';
    // the sheet's own subject is a plain row, not a dead button (a11y: no 26 px "target" in the short chain, D-111)
    const el = self ? 'div' : 'button';
    const attrs = self ? '' : `data-go="${l.kind}:${l.id}"`;
    const pos = i === 0 ? 'c-first' : i === last ? 'c-last' : 'c-mid';
    return `<li class="${pos}" data-because="${because}"><${el} class="link cf${root ? ' is-root' : ''}${calmRoot ? ' is-calm' : ''}${self ? ' is-self' : ''}" ${attrs}>
      <span class="l-icon">${linkIcon(world, l, 32)}</span>
      <span class="l-text"><span class="l-who">${esc(linkSubject(world, l))}${tag}</span><span class="l-why">${esc(linkText(world, l))}</span></span>
      ${self ? `<span class="l-since">${since}</span>` : `<span class="l-go fwd">${iconSvg('back', 18)}</span>`}</${el}></li>`;
  });
  if (mid > 0) {
    items.splice(1, 0, `<li class="c-more"><button class="c-more-btn" data-act="chain:${key}" aria-expanded="${open}"><span class="c-n" dir="auto"${translated('why.more') ? '' : ' lang="en"'}>${
      esc(t('why.more', { n: mid }))}</span><span class="codex-chev" aria-hidden="true"></span></button></li>`);
  }
  return `<ol class="chain${mid > 0 ? ' has-mid' : ''}${open ? ' is-open' : ''}">${items.join('')}</ol>`;
}

/**
 * Unfold the middle links in place (the sheet's next refresh renders the same open state). The body then scrolls
 * so the root stands above the docked fix (D-146): on a short landscape sheet only ~60 px of chain shows, and the
 * root is what the fix answers; the subject and the first links may scroll away above. Focus goes to the root's
 * link (a link focused while scrolled out of view would hide the ring); Shift+Tab walks back up the chain.
 */
function openChain(btn: HTMLElement, key: string): void {
  chainOpen.add(key);
  const ol = btn.closest('.chain');
  ol?.classList.add('is-open');
  btn.setAttribute('aria-expanded', 'true');
  const body = btn.closest<HTMLElement>('.sheet-body');
  const root = ol?.querySelector<HTMLElement>(':scope > li:last-child');
  if (body && root) revealAboveDock(body, root);
  const to = root?.querySelector<HTMLButtonElement>('button[data-go]') ?? ol?.querySelector<HTMLButtonElement>('.c-mid button[data-go]');
  to?.focus({ preventScroll: true });
}

function chip(g: Good, have: number, cap: number | null, extra: string, empty = false): string {
  return `<div class="good-chip cf${empty ? ' is-empty' : ''}">${iconSvg(g, 28, goodName(g))}
    <span><bdi class="num"><b>${fmtInt(have)}</b>${cap !== null ? `<span class="cap">/${fmtInt(cap)}</span>` : ''}</bdi>${extra}</span></div>`;
}

/** Folds of the castle card opened by the player during the tutorial (per session, never in the sim). */
let castleFoldOpen = false;

/**
 * The castle's order and pace folded behind one 48 px row while the tutorial runs (research P6): step 2 only asks
 * for the cause chain, so the card shows the status and the chain; the numbers are one tap away.
 */
function castleFold(inner: string): string {
  if (!inner) return '';
  return `<div class="sfold${castleFoldOpen ? ' is-open' : ''}">
    <button class="sfold-tog cf" data-act="sfold" aria-expanded="${castleFoldOpen}"><span class="sfold-q" dir="auto">${
      esc(t('why.order'))} · ${esc(t('why.pace.title'))}</span><span class="codex-chev" aria-hidden="true"></span></button>
    <div class="sfold-body"${castleFoldOpen ? '' : ' hidden'}>${inner}</div></div>`;
}

function toggleCastleFold(btn: HTMLElement): void {
  castleFoldOpen = !castleFoldOpen;
  const root = btn.closest('.sfold');
  root?.classList.toggle('is-open', castleFoldOpen);
  btn.setAttribute('aria-expanded', String(castleFoldOpen));
  const body = root?.querySelector<HTMLElement>('.sfold-body');
  if (body) body.hidden = !castleFoldOpen;
}

function stockHtml(world: World, b: Building, pace: PaceLog, fold = false): string {
  const def = BUILDINGS[b.type];
  const parts: string[] = [];
  const inc = (g: Good): string => (b.incoming[g] > 0 ? `<span class="inc">${tHtml('why.inbound', { n: fmtInt(b.incoming[g]) })}</span>` : '');
  if (def.recipe) {
    const ins = inputGoods(b.type), outs = outputGoods(b.type);
    if (ins.length) {
      parts.push(`<div class="section-h">${esc(t('why.needs'))}</div><div class="goods">${ins.map((g) =>
        chip(g, b.stock[g], def.inCap, inc(g), b.stock[g] === 0 && b.incoming[g] === 0)).join('')}</div>`);
      // free valley (D-94): a fed workshop with a small gap waits for a fuller wagon — said calmly, not a stall
      for (const g of ins) {
        const n = topUpHold(world, b, g);
        if (n > 0) parts.push(`<div class="s-hint calm-hint top-up">${iconSvg(g, 22, goodName(g))}<span${translated('why.topUp') ? '' : ' lang="en" dir="ltr"'}>${
          esc(t('why.topUp', { goodGen: t(`goodGen.${g}` as MessageKey), n: fmtInt(n) }))}</span></div>`);
      }
    }
    parts.push(`<div class="section-h">${esc(t('why.makes'))}</div><div class="goods">${outs.map((g) =>
      chip(g, b.stock[g], def.outCap, b.reservedOut[g] > 0 ? `<span class="inc">${tHtml('why.reserved', { n: b.reservedOut[g] })}</span>` : '')).join('')}</div>`);
    if (b.progress >= 0) {
      const pct = Math.min(100, (b.progress / cycleTicks(world, b.type, def.recipe.ticks)) * 100);
      parts.push(`<div class="progress" title="${esc(t('why.cycle'))}"><i style="width:${pct.toFixed(1)}%"></i></div>`);
    }
  } else if (b.type === 'warehouse') {
    // per-building capacity (mission VI's small granary) wins over the type default
    const cap = b.capOverride >= 0 ? b.capOverride : def.storeCap ?? 0;
    const held = GOODS.reduce((a, g) => a + b.stock[g], 0);
    const promised = GOODS.reduce((a, g) => a + b.incoming[g], 0);
    const pct = cap > 0 ? Math.min(100, (held / cap) * 100) : 0;
    const promisedPct = cap > 0 ? Math.min(100 - pct, (promised / cap) * 100) : 0;
    const full = cap > 0 && held + promised >= cap;
    const small = b.capOverride >= 0 && b.capOverride < (def.storeCap ?? 0)
      ? `<div class="s-hint cap-small">${iconSvg('storage_full', 18)}<span>${tHtml('why.capSmall', { n: fmtInt(cap) })}</span></div>` : '';
    parts.push(`<div class="section-h"><span>${tHtml('why.holdsCount', { count: fmtRatio(held, cap) })}</span></div>
      <div class="cap-bar${full ? ' is-full' : ''}${full && quietStall(world, b) ? ' is-calm' : ''}" role="img" aria-label="${esc(`${held}/${cap}`)}"><i style="width:${pct.toFixed(1)}%"></i><b style="width:${promisedPct.toFixed(1)}%"></b></div>${small}
      <div class="goods">${GOODS.map((g) => chip(g, b.stock[g], null, inc(g))).join('')}</div>`);
    if (rankGated(world) || world.state.mission.roadStone) {
      // free valley (and missions that build with stone): granaries keep a stone reserve for cobbles and stone bridges
      const res = Math.min(b.stock.stone, STONE_RESERVE);
      parts.push(`<div class="s-hint stone-res">${iconSvg('stone', 22, goodName('stone'))}<span>${
        tHtml('why.stoneReserve', { n: fmtInt(res), max: fmtInt(STONE_RESERVE) })}<br><small>${
        tHtml('why.stoneAll', { n: fmtInt(stoneAvailable(world)) })}</small></span></div>`);
    }
  } else if (b.type === 'castle') {
    // two castles (D-288): each castle shows its own order
    const c = contractsOf(world.state.mission).find((k) => k.castle === b.id) ?? world.state.mission.contract;
    if (c) {
      const gs = GOODS.filter((g) => c.need[g] > 0);
      const own: string[] = [];
      own.push(`<div class="section-h">${esc(t('why.order'))}</div><div class="goods">${gs.map((g) =>
        chip(g, Math.min(b.stock[g], c.need[g]), c.need[g], inc(g))).join('')}</div>`);
      // a slow supply is not a stall: the pace and the forecast say what the statuses cannot (F10);
      // while the castle only waits for wagons this section leads the card instead (buildingSheet)
      if (c.castle === b.id && !world.state.mission.extraContracts && (isStall(b.status) || b.status.k === 'NO_INPUT')) own.push(castlePaceHtml(world, forecastFor(world, pace)));
      parts.push(fold ? castleFold(own.join('')) : own.join(''));
    }
  } else if (b.type === 'tradePost') {
    parts.push(postHtml(world));
  } else if (b.type === 'stable') {
    const n = world.state.wagons.filter((w) => w.home === b.id).length;
    parts.push(`<div class="section-h">${esc(t('why.wagons', { n }))}</div>
      <div class="sheet-actions"><button class="btn primary cf" data-act="buy:${b.id}">${iconSvg('buy_wagon', 26)}<span>${esc(t('tool.wagon'))}</span>${bdi(`−${fmtInt(WAGON_PRICE)}`)}</button></div>`);
  }
  return parts.join('');
}

/** The bottleneck card's "n of m" (D-171): the mean waiting consumers, rounded, at least 1. */
function neckN(world: World): string {
  const c = bottleneckCard(world);
  return fmtInt(c ? neckWaiting(c) : 1);
}

/** The trading post's status line (D-170): closed with the rank it opens at, or buying; null = the usual line (NO_ROAD). */
function postStatusHtml(world: World, b: Building): string | null {
  const ps = tradePostStatus(world);
  if (!ps || b.status.k !== 'IDLE') return null;
  if (!ps.open) return `<div class="status-line">${iconSvg('seal', 28)}<span>${esc(t('post.closed', { rank: rankName(TRADE_POST.rank) }))}</span></div>`;
  return `<div class="status-line ok">${iconSvg('tradePost', 28)}<span>${esc(t('post.open'))}</span></div>`;
}

/**
 * The trading post's sheet body (D-170): the terms, its prices (own saturation) against the castle's, the last
 * sales and, in winter, why a stone bridge pays. Read-only.
 */
function postHtml(world: World): string {
  const ps = tradePostStatus(world);
  if (!ps) return '';
  const pct = fmtPercent(TRADE_POST.pricePct / 100);
  const out: string[] = [];
  if (ps.open && !ps.linked) out.push(`<div class="s-hint calm-hint">${iconSvg('no_road', 18)}<span>${esc(t('post.noRoad'))}</span></div>`);
  out.push(`<div class="s-hint calm-hint">${iconSvg('tradePost', 22)}<span>${esc(t('post.terms', { pct }))}</span></div>`);
  const rows = ps.prices.map((p) => {
    const sat = Math.min(100, (p.saturation / MARKET.cap) * 100);
    const vs = p.castleCents > 0 ? fmtPercent(Math.floor((p.cents * 100) / p.castleCents) / 100) : '';
    return `<li class="ms-good">${iconSvg(p.good, 28, goodName(p.good))}
      <span class="ms-name"><b>${esc(goodName(p.good))}</b><small>${esc(t('post.vsCastle', { pct: vs }))}</small></span>
      <span class="ms-price"><b>${bdi(fmtDec(p.cents / 100))}</b><small>${bdi(fmtPercent(p.pct / 100))}</small></span>
      <span class="ms-sat" title="${esc(t('market.sat'))}"><span class="kbar pl-bar"><i style="width:${sat.toFixed(1)}%"></i></span></span></li>`;
  }).join('');
  const head = `<li class="ms-good ms-headrow" aria-hidden="true"><span></span><span></span><small>${esc(t('market.colPrice'))}</small><small>${esc(t('market.sat'))}</small></li>`;
  out.push(`<div class="section-h">${esc(t('post.prices'))}</div><ul class="ms-prices post-prices">${head}${rows}</ul>`);
  const now = world.state.tick;
  const sales = ps.recent.map((r) => `<li class="post-sale">${iconSvg(r.good, 22, goodName(r.good))}<span>${
    esc(t('post.sale', { qty: fmtInt(r.qty), good: goodName(r.good), n: fmtDec(r.cents / 100) }))}</span><small>${esc(t('post.ago', { time: ticksClock(now - r.tick) }))}</small></li>`).join('');
  out.push(`<div class="section-h">${esc(t('post.recent'))}</div>${sales ? `<ul class="post-sales">${sales}</ul>` : `<div class="s-hint">${esc(t('post.none'))}</div>`}`);
  if (ps.units > 0) out.push(`<div class="ms-income">${iconSvg('coin', 22)}<span>${tHtml('post.total', { units: ps.units, n: fmtInt(ps.earned) })}</span></div>`);
  if (seasonal(world) && seasonAt(now) === 'winter') out.push(`<div class="s-hint ice-hint">${iconSvg('bridge_ice', 18)}<span>${esc(t('post.iceHint'))}</span></div>`);
  return out.join('');
}

const SEASON_NOTE_KEY: Record<string, MessageKey> = {
  'winter:farm': 'season.effect.winter-farm', 'winter:fisher': 'season.effect.winter-fisher', 'summer:farm': 'season.effect.summer-farm',
};

function seasonNoteText(n: SeasonNote): string | null {
  if (n.k === 'FAIR') return t('events.fair.active', { good: t(`goodAcc.${n.good}` as MessageKey) });
  const key = SEASON_NOTE_KEY[`${n.season}:${n.type}`];
  return key ? t(key) : null;
}

/**
 * Season line on a building card (free valley): the building's own seasonal pace (farm, fisher, the
 * castle's fair). `own` only; the supplier and ice hints are separate (upstreamSeasonHtml, iceHtml).
 */
function seasonHtml(world: World, id: number): string {
  const own = seasonNote(world, id);
  if (!own) return '';
  const text = seasonNoteText(own);
  return text ? `<div class="s-hint season-hint">${iconSvg(own.k === 'FAIR' ? 'beer' : 'snow', 18)}<span>${esc(text)}</span></div>` : '';
}

/**
 * A building waiting for an input that a season slows (winter farm or fisher behind a mill or a
 * malthouse): "slower supply, not a stall", with one tap to that supplier. Shown above the chain
 * when the status is NO_INPUT (e.g. CONTESTED: the rival is real, but the root is the slow farm).
 */
function upstreamSeasonHtml(world: World, id: number): string {
  const up = seasonalSupplier(world, id);
  const text = up ? seasonNoteText(up.note) : null;
  if (!up || !text) return '';
  const p = buildingById(world, up.from);
  const go = p ? ` <button class="linkish" data-go="building:${p.id}">${esc(t(`building.${p.type}` as MessageKey))}</button>` : '';
  return `<div class="s-hint season-hint">${iconSvg('snow', 18)}<span>${esc(t('season.upstream', { why: text }))}${go}</span></div>`;
}

/**
 * The chain ends at a wagon held by ice on a wooden bridge: the same reassurance as the wagon card
 * (a stone bridge does not freeze; in a seasonal winter, the ice recedes on its own).
 */
function iceHtml(world: World, chain: ReasonLink[]): string {
  if (!chain.some((l) => l.kind === 'wagon' && l.status.k === 'BRIDGE_CLOSED')) return '';
  const winter = seasonal(world) && seasonAt(world.state.tick) === 'winter' ? ` ${t('season.iceWinter')}` : '';
  return `<div class="s-hint ice-hint">${iconSvg('road_cobble', 18)}<span>${esc(t('wagon.iceHint') + winter)}</span></div>`;
}

export function buildingSheet(nav: PanelNav, id: number): SheetContent {
  return {
    key: 'building:' + id,
    // "?" on a castle holding one of two castle orders opens "Several castles" (D-344); every other card "Find the cause"
    helpTopic() {
      const b = buildingById(nav.world, id);
      return b && twoCastleOrder(nav.world, b) ? 'castles' : undefined;
    },
    update(sheet) {
      const world = nav.world;
      const b = buildingById(world, id);
      if (!b) return false;
      wire(sheet, nav);
      if (pressed(sheet)) return true;
      const stalled = isStall(b.status) || b.status.k === 'NO_INPUT';
      // a stall with nothing to fix (calmWhy) reads calm: ink title, no clay (D-180); so does every other stall the
      // HUD pins in brass — a pickup on its way, a customer that still takes it, a season (D-193)
      const calm = stalled && quietStall(world, b);
      setHtml(sheet.icon, iconSvg(b.type as IconId, 36));
      sheet.kicker.textContent = stalled ? t('why.title') : '';
      sheet.kicker.classList.toggle('is-calm', calm);
      // two castles (D-288): each castle by its own name
      sheet.title.textContent = buildingName(world, id);
      const chain = explainBuilding(world, id, 5, true);
      const since = b.stalledTicks > 0 ? `<span class="since">${tHtml('why.stalledFor', { time: ticksClock(b.stalledTicks) })}</span>` : '';
      let top: string;
      if (chain.length > 1) {
        top = `<div class="section-h chain-h${calm ? ' is-calm' : ''}">${esc(t('why.chain'))}${since}</div>${chainHtml(world, chain, 'building', id, b.stalledTicks > 0 ? `<bdi class="num">${esc(ticksClock(b.stalledTicks))}</bdi>` : '')}`;
      } else {
        const cls = stalled ? (calm ? 'calm' : 'bad') : b.status.k === 'WORKING' || b.status.k === 'CONTRACT_DONE' ? 'ok' : '';
        top = `<div class="status-line ${cls}">${buildingStateIcon(world, b.id, b.status, 28)}<span>${esc(buildingStatusText(b.status, world, id))}</span>${since}</div>`;
      }
      // the trading post (D-170): "closed until rank 4" / "buying" instead of the plain idle line
      if (b.type === 'tradePost') top = postStatusHtml(world, b) ?? top;
      // gap finder: the root is a missing road -> cheapest road / bridge from the stable, one tap to build;
      // a building the player just placed gets the link at once, before its first status update
      let target = gapTarget(world, chain.length ? chain : [{ kind: 'building', id, status: b.status }]);
      // D-245: a saturated granary the unlinked trading post would empty: the post's road (with its bridge) is the fix
      if (target < 0 && b.type === 'warehouse' && stalled) target = postWouldTake(world, id);
      if (target < 0 && b.placedTick >= 0 && world.state.tick - b.placedTick <= UNDO_TICKS && b.type !== 'stable' && gapSuggestion(world, id)) target = id;
      const fix = target >= 0 ? gapSuggestion(world, target) : null;
      // the road to the trading post crosses the river, mostly off screen: framed once, as the sett ghost (D-144/D-245)
      const far = fix ? buildingById(world, target) : undefined;
      nav.setGhost(fix ? fix.cells : null, false, far?.type === 'tradePost' ? (far.y + (far.h >> 1)) * world.terrain.w + far.x + (far.w >> 1) : -1);
      // just placed: the same undo as the floating button, here because the sheet covers it
      const u = lastUndoable(world);
      const undo = u && u.building === id
        ? `<div class="sheet-actions"><button class="btn cf" data-act="undo:${id}"><span class="rtl-flip">${iconSvg('undo', 24)}</span><span>${tHtml('undo.btn', { s: fmtInt(u.secondsLeft) })}</span>${bdi(`+${fmtInt(u.refund)}`)}</button></div>` : '';
      // a winter-slowed supplier is the real root of a missing input: say so above the chain
      const upSeason = upstreamSeasonHtml(world, b.id);
      // an input shared with a consumer of another kind goes first: a wagon on the way or busy
      // wagons are the chain's root, but the lesson is the shared supply (F3)
      const fold = b.type === 'castle' && !!nav.tutorialRunning?.();
      // two castles (D-290): the split, the forecast against this castle's own deadline and the rival castle instead
      const two = twoCastleOrder(world, b);
      const pace = two ? castleOrderHtml(world, b, nav.pace)
        : b.type === 'castle' && !stalled && !fold && world.state.mission.contract?.castle === b.id ? castlePaceHtml(world, forecastFor(world, nav.pace)) : '';
      // "what does it mean?" for the last stall of the chain (the one the player has to fix), never for a
      // producer at work or a wagon on its way (audit fix 4)
      const cl = codexLink(chain, { kind: 'building', id, status: b.status });
      // a state the sheet reads its own way gets its own entry (D-339): a wagon due shortly (not a stall, still
      // explained), a surplus, a saturated market, the trading post's road, the build tutorial's hut, a XVI castle
      const sit = two ? castleCodexSituation(world, b, nav.pace)
        : stalled || b.status.k === 'WAGON_DUE' ? codexSituation(world, cl, nav.tutorialHut?.() ?? -1) : null;
      const codex = sit ? codexSituationHtml(sit) : stalled ? codexHtml(cl.kind, cl.status, codexCalm(world, cl)) : '';
      // a waiting (not stalled) building on the card for a shared single producer or a held span (research P4/P5)
      // gets that card's fix too
      const carded = !stalled && !fix && (cureFor(world, b.id) === 'producer' || cureFor(world, b.id) === 'pave');
      // the pace card's producer (day 8c): its fix, unless this building has a stall with a cure of its own
      // (no forecast without a contract: the free valley still gets the fleet cue, D-140)
      // a calm stall never gets "Kup wóz" from its chain (D-193): only the fleet cue below offers it (D-128)
      const own = stalled ? cureFor(world, b.id) : null;
      const ownCure = calm && own === 'wagon' ? null : own;
      const paced = !fix && !ownCure;
      const fc = paced ? forecastFor(world, nav.pace) : null;
      const pc = paced ? paceCard(world, fc, nav.pace) : null;
      // a long pickup wait while the fleet is on the road gets "Kup wóz" on its own sheet too (D-128), not only
      // the yard the card names
      const pcHere = pc && pc.producer === b.id ? pc : paced ? fleetCueFor(world, fc, b) : null;
      // the muddy stretch shows on the map like the gap finder's road
      const lead = pace + thinHtml(world, b.id) + sharedHtml(world, b.id) + (b.status.k === 'NO_INPUT' ? upSeason + top : top + upSeason) + fullHtml(world, b, chain) + (stalled ? calmHtml(world, b, chain, pcHere?.k === 'fleet') : '') + codex;
      // three parts, each re-rendered only when its own HTML changes: the stall clock ticking in the chain no
      // longer replaces the fix button under the player's finger (first-10-minutes-b, item 4)
      const [pLead, pFix, pRest] = sheetParts(sheet.body, 3);
      setHtmlKeep(pLead!, lead + seasonHtml(world, b.id) + iceHtml(world, chain));
      if (pcHere?.k === 'mud') nav.setGhost(pcHere.cells, true);
      // the stone-span cure ("Wyłóż most kamieniem"): the same sett ghost, on the wooden deck (D-134)
      else if (!fix && !pcHere && (stalled || carded) && cureFor(world, b.id) === 'pave') {
        const span = paveSpanFor(world, b);
        if (span) nav.setGhost(span.cells, true);
      }
      // the card said "wszystkie wozy zajęte" but a wagon took the job while the sheet opened (×4): the same cure,
      // with the wait it answers (first-10-e N8, D-161)
      const ago = !fix && !pcHere && !stalled && !carded && !nav.tutorialRunning?.() && !iceBeforeWagon(world) ? recentWagonWait(world, id) : -1;
      setHtmlKeep(pFix!, fix ? fixHtml(world, target, fix, postWhy(world, b)) : two ? castleSwitchHtml(world, b, nav.pace) : pcHere ? paceCureHtml(world, pcHere, nav.pace) : (stalled && !(calm && own === 'wagon')) || carded ? cureHtml(world, b, chain)
        : ago >= 0 ? wagonCureHtml(world, t('fix.wagonLately')) : '');
      setHtmlKeep(pRest!, undo + stockHtml(world, b, nav.pace, fold));
      return true;
    },
    onClose() { nav.setGhost(null); chainOpen.delete('building:' + id); },
  };
}

export function wagonSheet(nav: PanelNav, id: number): SheetContent {
  return {
    key: 'wagon:' + id,
    update(sheet) {
      const world = nav.world;
      const w = world.state.wagons.find((q) => q.id === id);
      if (!w) return false;
      wire(sheet, nav);
      if (pressed(sheet)) return true;
      setHtml(sheet.icon, iconSvg('wagon', 36));
      sheet.kicker.textContent = t('wagon.kicker');
      sheet.title.textContent = wagonName(world, id);
      const eta = wagonEta(world, id);
      const waiting = isWagonWait(w.status);
      const cargo = w.cargoGood && w.cargoQty > 0
        ? `${iconSvg(w.cargoGood, 26, goodName(w.cargoGood))}${bdi(`× ${fmtInt(w.cargoQty)}`)}<span>${esc(goodName(w.cargoGood))}</span>`
        : esc(t('wagon.empty'));
      const job = w.job;
      const destId = eta && eta.destBuilding >= 0 ? eta.destBuilding : job ? (job.phase === 'pickup' ? job.from : job.to) : -1;
      const destB = destId >= 0 ? buildingById(world, destId) : null;
      const dest = destB
        ? `<button class="linkish" data-go="building:${destB.id}">${esc(t(`building.${destB.type}` as MessageKey))}</button>`
        : w.status.k === 'IDLE' ? esc(t('wagon.home')) : esc(t('wagon.none'));
      const rows: string[] = [
        `<dt>${esc(t('wagon.cargo'))}</dt><dd>${cargo}</dd>`,
        `<dt>${esc(t('wagon.dest'))}</dt><dd>${dest}</dd>`,
      ];
      if (eta && w.status.k !== 'IDLE') {
        const ice = iceWaitSec(world, w.status);
        rows.push(`<dt>${esc(t('wagon.eta'))}</dt><dd class="eta num">${clock(eta.toDest + ice)}</dd>`);
        if (job) rows.push(`<dt>${esc(t('wagon.etaFinish'))}</dt><dd class="eta num">${clock(eta.toFinish + ice)}</dd>`);
        const slow = w.next >= 0 ? wagonSlowdown(world, id) : null;
        if (slow && slow.factor < 0.93) {
          const pct = Math.round(slow.factor * 100);
          // mud is a pace, not a stall (H4): one plain comparison with the same stretch paved, no alert colour
          const why = slow.mud
            ? tHtml(slow.thaw ? 'wagon.thawVsCobble' : 'wagon.mudVsCobble', { pct: fmtPercent(pct / 100), paved: fmtPercent(Math.round(slow.paved * 100) / 100) })
            : tHtml(slow.grade > 0.02 ? 'wagon.slowUphill' : 'wagon.slowOther', { pct: fmtInt(pct) });
          rows.push(`<dt>${esc(t('wagon.pace'))}</dt><dd class="pace-note">${iconSvg(slow.mud && !slow.thaw ? 'rain' : 'road_dirt', 20)}<span dir="auto">${why}</span></dd>`);
        }
        if (job && job.phase === 'pickup') {
          const to = buildingById(world, job.to);
          if (to) rows.push(`<dt>&nbsp;</dt><dd style="font-weight:500">${iconSvg(job.good, 20)}<span>${esc(goodName(job.good))}</span><span class="fwd" aria-hidden="true">${iconSvg('back', 16)}</span><button class="linkish" data-go="building:${to.id}">${esc(t(`building.${to.type}` as MessageKey))}</button></dd>`);
        }
      }
      const follow = nav.following() === id;
      let html = `<div class="status-line${waiting ? ' bad' : ''}">${waiting ? linkIcon(world, { kind: 'wagon', id, status: w.status }, 28) : ''}<span>${esc(wagonStatusText(world, w.status))}</span>${
        w.status.k === 'NO_ROUTE' ? `<span class="since">${tHtml('why.stalledFor', { time: ticksClock(world.state.tick - w.status.since) })}</span>` : ''}</div>`;
      html += `<dl class="kv" style="margin-top:10px">${rows.join('')}</dl>`;
      let fix: RoadSuggestion | null = null, target = -1;
      if (waiting) {
        const chain = explainWagon(world, id, 4, true);
        if (chain.length > 1) html += `<div class="section-h">${esc(t('wagon.chain'))}</div>${chainHtml(world, chain, 'wagon', id)}`;
        // "what does it mean?" for the last stall of the chain (or the wagon's own status, audit fix 4)
        const cl = codexLink(chain, { kind: 'wagon', id, status: w.status });
        html += codexHtml(cl.kind, cl.status);
        target = gapTarget(world, chain.length ? chain : [{ kind: 'wagon', id, status: w.status }]);
        fix = target >= 0 ? gapSuggestion(world, target) : null;
        if (w.status.k === 'BRIDGE_CLOSED') {
          // free valley winter: the same cause as mission IV's ice, plus the reassurance that it passes
          const winter = seasonal(world) && seasonAt(world.state.tick) === 'winter' ? ` ${t('season.iceWinter')}` : '';
          html += `<div class="s-hint ice-hint">${iconSvg('road_cobble', 18)}<span>${esc(t('wagon.iceHint') + winter)}</span></div>`;
        }
      }
      nav.setGhost(fix ? fix.cells : null);
      // same rule as the sim's sellWagon: no job, no cargo, not loading, standing still
      const canSell = !w.job && w.cargoQty === 0 && w.busyTicks === 0 && w.next < 0;
      html += `<div class="sheet-actions"><button class="btn cf${follow ? ' is-on' : ''}" data-act="follow:${id}">${iconSvg('follow', 26)}<span>${esc(t(follow ? 'wagon.unfollow' : 'wagon.follow'))}</span></button>` +
        // disabled: the kit's hatched card with the label on a parchment plaque (readable, like "brak N", D-122)
        // and the reason tied to the button (day 9b, D-131)
        `<button class="btn cf sell-btn${canSell ? '' : ' is-disabled'}" data-act="sell:${id}" aria-disabled="${!canSell}"${canSell ? '' : ` aria-describedby="sell-why-${id}"`}>${iconSvg('coin', 22)}<span class="sell-l">${tHtml('wagon.sell', { n: fmtInt(WAGON_REFUND) })}</span></button></div>` +
        (canSell ? '' : `<div class="s-hint sell-hint" id="sell-why-${id}">${esc(t('wagon.sellBusy'))}</div>`);
      // the road fix sits after the chain (and the ice hint) as before, in its own part (D-100)
      const cut = html.indexOf('<div class="sheet-actions">');
      const [pLead, pFix, pRest] = sheetParts(sheet.body, 3);
      setHtmlKeep(pLead!, html.slice(0, cut));
      setHtmlKeep(pFix!, fix ? fixHtml(world, target, fix) : '');
      setHtmlKeep(pRest!, html.slice(cut));
      return true;
    },
    onClose() { nav.setGhost(null); chainOpen.delete('wagon:' + id); },
  };
}

