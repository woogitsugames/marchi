// Sheet contents: "Dlaczego stoi?" (building), wagon card, and their cause chains.
import {
  BUILDINGS, GOODS, buildingById, cycleTicks, explainBuilding, explainWagon, inputGoods, lastUndoable, outputGoods, outputSurplus, seasonAt, seasonNote, seasonal, seasonalSupplier,
  suggestLinkToStable, wagonEta, wagonSlowdown, type SeasonNote,
  STONE_RESERVE, UNDO_TICKS, WAGON_PRICE, canPlace, canSurface, type BuildingType, rankGated, stoneAvailable, type Building, type Good, type PaceLog, type ReasonLink, type RoadSuggestion, type World,
} from '../sim/index';
import { t, translated, type MessageKey } from '../i18n/index';
import { esc, setHtml } from './dom';
import {
  bdi, buildingName, buildingStatusIcon, buildingStatusText, clock, fmtInt, fmtPercent, fmtRatio, iceWaitSec, goodName, isStall, isWagonWait, linkIcon, linkSubject, linkText, tHtml, ticksClock,
  wagonName, wagonStatusText,
} from './format';
import { iconSvg, type IconId } from './icons';
import type { Sheet, SheetContent } from './sheets';
import { WAGON_REFUND } from './deadEnd';
import { castlePaceHtml, forecastFor, sharedHtml, thinHtml } from './pace';
import { cureFor } from './stalls';
import { buildTypes } from './buildTool';
import { errorText } from './roadTool';
import { codexHtml, toggleCodex } from './codex';

export interface PanelNav {
  readonly world: World;
  /** Contract pace samples for the castle card's forecast. */
  readonly pace: PaceLog;
  /** Jump the camera to a subject and open its sheet. */
  go(kind: 'building' | 'wagon', id: number): void;
  buyWagon(stable: number): void;
  sellWagon(wagon: number): void;
  toggleFollow(wagon: number): void;
  following(): number | null;
  /** Enqueue a dirt road (wooden bridge over water) along these cells. */
  buildRoad(cells: number[]): void;
  /** Ghost road on the map for the gap finder (null clears it). */
  setGhost(cells: number[] | null): void;
  /** Take back a building placed moments ago (full refund while lastUndoable names it). */
  undoPlace(building: number): void;
  /** Open the build tool with this building type already picked (the sheet closes). */
  pickBuild(type: BuildingType, near: number): void;
}

// ---------------------------------------------------------------- gap finder

/** Building whose missing link to the stable is the root of this chain, or -1. */
export function gapTarget(world: World, chain: ReasonLink[]): number {
  const root = chain[chain.length - 1];
  if (!root) return -1;
  if (root.kind === 'building') {
    const s = root.status;
    if (s.k === 'NO_ROAD' || (s.k === 'NO_WAGON' && s.cause === 'NONE_CAN_REACH')) return root.id;
    return -1;
  }
  if (root.status.k === 'NO_ROUTE' && root.status.target >= 0 && buildingById(world, root.status.target)) return root.status.target;
  return -1;
}

let gapCache: { key: string; s: RoadSuggestion | null } | null = null;
/** suggestLinkToStable runs a whole-grid Dijkstra: compute once per road network version. */
export function gapSuggestion(world: World, target: number): RoadSuggestion | null {
  const key = `${target}:${world.state.netVersion}:${world.state.buildings.length}`;
  if (gapCache?.key !== key) gapCache = { key, s: suggestLinkToStable(world, target) };
  return gapCache.s;
}

function fixHtml(world: World, target: number, s: RoadSuggestion): string {
  const short = s.cost - world.state.coins;
  const label = tHtml(s.bridgeCells > 0 ? 'fix.bridge' : 'fix.road', { n: fmtInt(s.cost) });
  const btn = `<button class="btn primary cf fix-btn${short > 0 ? ' is-disabled' : ''}" data-act="fix:${target}" aria-disabled="${short > 0}">${
    iconSvg('road_dirt', 26)}<span>${label}</span></button>`;
  const hint = short > 0
    ? `<div class="s-hint fix-why">${iconSvg('coin', 18)}<span>${tHtml('fix.short', { n: fmtInt(short) })}</span></div>`
    : `<div class="s-hint">${esc(t('fix.shown'))}</div>`;
  return `<div class="section-h">${esc(t('fix.title'))}</div><div class="fix">${btn}${hint}</div>`;
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
    const btn = `<button class="btn primary cf fix-btn${off ? ' is-disabled' : ''}" data-act="granary:${b.id}" aria-disabled="${off}">${
      iconSvg('warehouse', 26)}<span>${esc(t('fix.granary'))}</span>${bdi(`−${fmtInt(BUILDINGS.warehouse.price)}`)}</button>`;
    const hint = !gate.ok
      ? `<div class="s-hint fix-why">${iconSvg('build', 18)}<span>${esc(errorText(gate.err))}</span></div>`
      : short > 0
        ? `<div class="s-hint fix-why">${iconSvg('coin', 18)}<span>${tHtml('fix.short', { n: fmtInt(short) })}</span></div>`
        : `<div class="s-hint">${esc(t('fix.granaryWhy'))}</div>`;
    return `<div class="section-h">${esc(t('fix.title'))}</div><div class="fix">${btn}${hint}</div>`;
  }
  if (cure === 'wagon') {
    const stable = world.state.buildings.find((q) => q.type === 'stable');
    if (!stable) return '';
    const short = WAGON_PRICE - world.state.coins;
    const btn = `<button class="btn primary cf fix-btn${short > 0 ? ' is-disabled' : ''}" data-act="buy:${stable.id}" aria-disabled="${short > 0}">${
      iconSvg('buy_wagon', 26)}<span>${esc(t('fix.wagon'))}</span>${bdi(`−${fmtInt(WAGON_PRICE)}`)}</button>`;
    const hint = short > 0
      ? `<div class="s-hint fix-why">${iconSvg('coin', 18)}<span>${tHtml('fix.short', { n: fmtInt(short) })}</span></div>`
      : `<div class="s-hint">${esc(t('fix.wagonWhy'))}</div>`;
    return `<div class="section-h">${esc(t('fix.title'))}</div><div class="fix">${btn}${hint}</div>`;
  }
  // a wagon in the chain waits at a one-lane bridge (also behind the wagon it waits for, audit fix 2)
  if (chain.some((l) => l.kind === 'wagon' && l.status.k === 'BRIDGE_JAM')) {
    const text = canSurface(world, 2).ok ? t('fix.jamStone') : t('fix.jam');
    return `<div class="section-h">${esc(t('fix.title'))}</div><div class="s-hint jam-hint">${iconSvg('bridge_jam', 18)}<span>${esc(text)}</span></div>`;
  }
  return calmHtml(world, b, chain);
}

/**
 * A stall with nothing to fix, said plainly instead of a cure that would not work (audit 2026-11-03): a full
 * yard nobody needs right now (fix 1: no "Kup wóz"). Only when the chain stops at the building itself.
 */
function calmHtml(world: World, b: Building, chain: ReasonLink[]): string {
  if (chain.length > 1) return '';
  const en = (k: MessageKey): string => (translated(k) ? '' : ' lang="en" dir="ltr"');
  const s = b.status;
  if (s.k === 'OUTPUT_FULL' && outputSurplus(world, b.id) === 'SPARE') {
    return `<div class="s-hint calm-hint">${iconSvg(s.good, 22, goodName(s.good))}<span${en('fix.surplus')}>${
      esc(t('fix.surplus', { goodGen: t(`goodGen.${s.good}` as MessageKey) }))}</span></div>`;
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
  let html = `<div class="full-hint">${named ? `<div class="fh-who">${named}</div>` : ''}<div class="fh-count">${line}</div>`;
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
function wire(sheet: Sheet, nav: PanelNav): void {
  const body = sheet.body as HTMLElement & { __wired?: boolean };
  if (body.__wired) return;
  body.__wired = true;
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
    if (act === 'buy') nav.buyWagon(Number(arg));
    if (act === 'follow') nav.toggleFollow(Number(arg));
    if (act === 'sell' && !el.classList.contains('is-disabled')) nav.sellWagon(Number(arg));
    if (act === 'undo') nav.undoPlace(Number(arg));
    if (act === 'granary' && !el.classList.contains('is-disabled')) nav.pickBuild('warehouse', Number(arg));
    if (act === 'fix' && !el.classList.contains('is-disabled')) {
      const s = gapSuggestion(nav.world, Number(arg));
      if (s && s.cost <= nav.world.state.coins) nav.buildRoad(s.cells);
    }
  });
}

function chainHtml(world: World, chain: ReasonLink[], selfKind: 'building' | 'wagon', selfId: number): string {
  const because = esc(t('why.because'));
  const last = chain.length - 1;
  const rootIsStall = (l: ReasonLink): boolean =>
    l.kind === 'building' ? isStall(l.status) || l.status.k === 'NO_INPUT' : isWagonWait(l.status);
  return `<ol class="chain">${chain.map((l, i) => {
    const self = l.kind === selfKind && l.id === selfId;
    const root = i === last && chain.length > 1 && rootIsStall(l);
    const tag = root ? `<span class="root-tag">${esc(t('why.root'))}</span>` : '';
    const attrs = self ? 'disabled' : `data-go="${l.kind}:${l.id}"`;
    return `<li data-because="${because}"><button class="link cf${root ? ' is-root' : ''}${self ? ' is-self' : ''}" ${attrs}>
      <span class="l-icon">${linkIcon(world, l, 32)}</span>
      <span><span class="l-who">${esc(linkSubject(world, l))}${tag}</span><span class="l-why">${esc(linkText(world, l))}</span></span>
      <span class="l-go fwd">${self ? '' : iconSvg('back', 18)}</span></button></li>`;
  }).join('')}</ol>`;
}

function chip(g: Good, have: number, cap: number | null, extra: string, empty = false): string {
  return `<div class="good-chip cf${empty ? ' is-empty' : ''}">${iconSvg(g, 28, goodName(g))}
    <span><bdi class="num"><b>${fmtInt(have)}</b>${cap !== null ? `<span class="cap">/${fmtInt(cap)}</span>` : ''}</bdi>${extra}</span></div>`;
}

function stockHtml(world: World, b: Building, pace: PaceLog): string {
  const def = BUILDINGS[b.type];
  const parts: string[] = [];
  const inc = (g: Good): string => (b.incoming[g] > 0 ? `<span class="inc">${tHtml('why.inbound', { n: fmtInt(b.incoming[g]) })}</span>` : '');
  if (def.recipe) {
    const ins = inputGoods(b.type), outs = outputGoods(b.type);
    if (ins.length) {
      parts.push(`<div class="section-h">${esc(t('why.needs'))}</div><div class="goods">${ins.map((g) =>
        chip(g, b.stock[g], def.inCap, inc(g), b.stock[g] === 0 && b.incoming[g] === 0)).join('')}</div>`);
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
      <div class="cap-bar${full ? ' is-full' : ''}" role="img" aria-label="${esc(`${held}/${cap}`)}"><i style="width:${pct.toFixed(1)}%"></i><b style="width:${promisedPct.toFixed(1)}%"></b></div>${small}
      <div class="goods">${GOODS.map((g) => chip(g, b.stock[g], null, inc(g))).join('')}</div>`);
    if (rankGated(world) || world.state.mission.roadStone) {
      // free valley (and missions that build with stone): granaries keep a stone reserve for cobbles and stone bridges
      const res = Math.min(b.stock.stone, STONE_RESERVE);
      parts.push(`<div class="s-hint stone-res">${iconSvg('stone', 22, goodName('stone'))}<span>${
        tHtml('why.stoneReserve', { n: fmtInt(res), max: fmtInt(STONE_RESERVE) })}<br><small>${
        tHtml('why.stoneAll', { n: fmtInt(stoneAvailable(world)) })}</small></span></div>`);
    }
  } else if (b.type === 'castle') {
    const c = world.state.mission.contract;
    if (c) {
      const gs = GOODS.filter((g) => c.need[g] > 0);
      parts.push(`<div class="section-h">${esc(t('why.order'))}</div><div class="goods">${gs.map((g) =>
        chip(g, Math.min(b.stock[g], c.need[g]), c.need[g], inc(g))).join('')}</div>`);
      // a slow supply is not a stall: the pace and the forecast say what the statuses cannot (F10);
      // while the castle only waits for wagons this section leads the card instead (buildingSheet)
      if (c.castle === b.id && (isStall(b.status) || b.status.k === 'NO_INPUT')) parts.push(castlePaceHtml(world, forecastFor(world, pace)));
    }
  } else if (b.type === 'stable') {
    const n = world.state.wagons.filter((w) => w.home === b.id).length;
    parts.push(`<div class="section-h">${esc(t('why.wagons', { n }))}</div>
      <div class="sheet-actions"><button class="btn primary cf" data-act="buy:${b.id}">${iconSvg('buy_wagon', 26)}<span>${esc(t('tool.wagon'))}</span>${bdi(`−${fmtInt(WAGON_PRICE)}`)}</button></div>`);
  }
  return parts.join('');
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
    update(sheet) {
      const world = nav.world;
      const b = buildingById(world, id);
      if (!b) return false;
      wire(sheet, nav);
      const stalled = isStall(b.status) || b.status.k === 'NO_INPUT';
      setHtml(sheet.icon, iconSvg(b.type as IconId, 36));
      sheet.kicker.textContent = stalled ? t('why.title') : '';
      sheet.title.textContent = t(`building.${b.type}` as MessageKey);
      const chain = explainBuilding(world, id, 5, true);
      const since = b.stalledTicks > 0 ? `<span class="since">${tHtml('why.stalledFor', { time: ticksClock(b.stalledTicks) })}</span>` : '';
      let top: string;
      if (chain.length > 1) {
        top = `<div class="section-h">${esc(t('why.chain'))}${since}</div>${chainHtml(world, chain, 'building', id)}`;
      } else {
        const cls = stalled ? 'bad' : b.status.k === 'WORKING' || b.status.k === 'CONTRACT_DONE' ? 'ok' : '';
        top = `<div class="status-line ${cls}">${buildingStatusIcon(b.status, 28, b.type)}<span>${esc(buildingStatusText(b.status, world))}</span>${since}</div>`;
      }
      // gap finder: the root is a missing road -> cheapest road / bridge from the stable, one tap to build;
      // a building the player just placed gets the link at once, before its first status update
      let target = gapTarget(world, chain.length ? chain : [{ kind: 'building', id, status: b.status }]);
      if (target < 0 && b.placedTick >= 0 && world.state.tick - b.placedTick <= UNDO_TICKS && b.type !== 'stable' && gapSuggestion(world, id)) target = id;
      const fix = target >= 0 ? gapSuggestion(world, target) : null;
      nav.setGhost(fix ? fix.cells : null);
      // just placed: the same undo as the floating button, here because the sheet covers it
      const u = lastUndoable(world);
      const undo = u && u.building === id
        ? `<div class="sheet-actions"><button class="btn cf" data-act="undo:${id}"><span class="rtl-flip">${iconSvg('undo', 24)}</span><span>${tHtml('undo.btn', { s: fmtInt(u.secondsLeft) })}</span>${bdi(`+${fmtInt(u.refund)}`)}</button></div>` : '';
      // a winter-slowed supplier is the real root of a missing input: say so above the chain
      const upSeason = upstreamSeasonHtml(world, b.id);
      // an input shared with a consumer of another kind goes first: a wagon on the way or busy
      // wagons are the chain's root, but the lesson is the shared supply (F3)
      const pace = b.type === 'castle' && !stalled && world.state.mission.contract?.castle === b.id ? castlePaceHtml(world, forecastFor(world, nav.pace)) : '';
      // "what does it mean?" for the status at the root of the chain (the one the player has to fix)
      const root = chain.length > 1 ? chain[chain.length - 1]! : null;
      const codex = stalled ? (root ? codexHtml(root.kind, root.status) : codexHtml('building', b.status)) : '';
      const lead = pace + thinHtml(world, b.id) + sharedHtml(world, b.id) + (b.status.k === 'NO_INPUT' ? upSeason + top : top + upSeason) + fullHtml(world, b, chain) + codex;
      setHtml(sheet.body, lead + seasonHtml(world, b.id) + iceHtml(world, chain) + (fix ? fixHtml(world, target, fix) : stalled ? cureHtml(world, b, chain) : '') + undo + stockHtml(world, b, nav.pace));
      return true;
    },
    onClose() { nav.setGhost(null); },
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
        // "what does it mean?" for the root of the chain (or the wagon's own status)
        const root = chain.length > 1 ? chain[chain.length - 1]! : null;
        html += root ? codexHtml(root.kind, root.status) : codexHtml('wagon', w.status);
        target = gapTarget(world, chain.length ? chain : [{ kind: 'wagon', id, status: w.status }]);
        fix = target >= 0 ? gapSuggestion(world, target) : null;
        if (fix) html += fixHtml(world, target, fix);
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
        `<button class="btn cf${canSell ? '' : ' is-disabled'}" data-act="sell:${id}" aria-disabled="${!canSell}">${iconSvg('coin', 22)}<span>${tHtml('wagon.sell', { n: fmtInt(WAGON_REFUND) })}</span></button></div>` +
        (canSell ? '' : `<div class="s-hint sell-hint">${esc(t('wagon.sellBusy'))}</div>`);
      setHtml(sheet.body, html);
      return true;
    },
    onClose() { nav.setGhost(null); },
  };
}

