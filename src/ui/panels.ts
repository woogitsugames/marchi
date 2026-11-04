// Sheet contents: "Dlaczego stoi?" (building), wagon card, and their cause chains.
import {
  BUILDINGS, GOODS, buildingById, roadCellCost, cycleTicks, contractFilled, explainBuilding, explainWagon, granaryRelief, inputGoods, lastUndoable, outputGoods, outputSurplus, seasonAt, seasonNote, seasonal, seasonalSupplier, stoneInStore, topUpHold, STONE_COBBLE,
  suggestLinkToStable, wagonEta, wagonSlowdown, type SeasonNote,
  STONE_RESERVE, UNDO_TICKS, WAGON_PRICE, canPlace, canSurface, validateRoad, type BuildingType, rankGated, stoneAvailable, type Building, type Good, type PaceLog, type ReasonLink, type RoadSuggestion, type World,
} from '../sim/index';
import { t, translated, type MessageKey } from '../i18n/index';
import { esc, setHtml } from './dom';
import {
  bdi, buildingName, buildingStatusIcon, buildingStatusText, clock, codexLink, fmtDec, fmtInt, fmtPercent, fmtRatio, iceWaitSec, goodName, isStall, isStallLink, isWagonWait, linkIcon, linkSubject, linkText, tHtml, ticksClock,
  wagonName, wagonStatusText,
} from './format';
import { iconSvg, type IconId } from './icons';
import type { Sheet, SheetContent } from './sheets';
import { WAGON_REFUND } from './deadEnd';
import { castlePaceHtml, forecastFor, sharedHtml, thinHtml } from './pace';
import { codexCalm, cureFor, gapTarget, paveCheck, paveSpanFor, sharedOneProducer } from './stalls';
import { paceCard, type PaceCard, type PaceMud } from './paceCard';

export { gapTarget };
import { buildTypes } from './buildTool';
import { errorText } from './roadTool';
import { codexHtml, toggleCodex } from './codex';

export interface PanelNav {
  readonly world: World;
  /** Contract pace samples for the castle card's forecast. */
  readonly pace: PaceLog;
  /** Mission I's tutorial runs: the castle card folds its order and pace (research P6, ~45 words at once). */
  tutorialRunning?(): boolean;
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
  setGhost(cells: number[] | null): void;
  /** Take back a building placed moments ago (full refund while lastUndoable names it). */
  undoPlace(building: number): void;
  /** Open the build tool with this building type already picked (the sheet closes). */
  pickBuild(type: BuildingType, near: number): void;
}

// ---------------------------------------------------------------- gap finder

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
  return fixSection(btn, hint, short > 0);
}

/**
 * The "Naprawa" section (D-100): header, the fix button in a dock that sticks to the sheet's bottom edge while
 * the chain above it scrolls (a short landscape side sheet shows ~140 px of body), then the explaining hint in
 * the flow. A disabled button keeps its reason ("Brakuje 10 srebra") inside the dock, next to it.
 * The dock must be a direct box child of the scrolling body: the sheet's parts are `display: contents`.
 */
function fixSection(btn: string, hint: string, why: boolean): string {
  const head = `<div class="section-h">${esc(t('fix.title'))}</div>`;
  return why
    ? `${head}<div class="fix fix-dock">${btn}${hint}</div>`
    : `${head}<div class="fix fix-dock">${btn}</div><div class="fix fix-note">${hint}</div>`;
}

/**
 * The pace card's fix on its producer's sheet (day 8c): the producers work flat out and still miss the next seal,
 * so one more of them (the build tool opens with that type, the ghost on the mission's authored site, D-107).
 */
function paceCureHtml(world: World, pc: PaceCard): string {
  if (pc.k === 'mud') return mudCureHtml(world, pc);
  const gate = canPlace(world, pc.type);
  const price = BUILDINGS[pc.type].price;
  const short = price - world.state.coins;
  const off = !gate.ok || short > 0;
  const btn = `<button class="btn primary cf fix-btn${off ? ' is-disabled' : ''}" data-act="producer:${pc.producer}" aria-disabled="${off}">${
    iconSvg('build', 26)}<span>${esc(t('fix.producer', { name: t(`building.${pc.type}` as MessageKey) }))}</span>${bdi(`−${fmtInt(price)}`)}</button>`;
  const hint = !gate.ok
    ? `<div class="s-hint fix-why">${iconSvg('build', 18)}<span>${esc(errorText(gate.err))}</span></div>`
    : short > 0
      ? `<div class="s-hint fix-why">${iconSvg('coin', 18)}<span>${tHtml('fix.short', { n: fmtInt(short) })}</span></div>`
      : `<div class="s-hint">${esc(t('fix.paceProducerWhy', { n: fmtInt(pc.n), cap: fmtDec(pc.cap, 1), seals: t('why.pace.seals', { n: pc.seals }), need: fmtDec(pc.need, 1) }))}</div>`;
  return fixSection(btn, hint, off);
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
    : `<div class="s-hint fix-why">${iconSvg(ok.err.k === 'NO_COINS' ? 'coin' : 'road_cobble', 18)}<span>${
      ok.err.k === 'NO_COINS' ? tHtml('fix.short', { n: fmtInt(ok.err.need - ok.err.have) }) : esc(errorText(ok.err))}</span></div>`;
  return fixSection(btn, hint, !ok.ok);
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
    return fixSection(btn, hint, off);
  }
  if (cure === 'producer') {
    // one producer feeds two workshops (research P5): build a second one next to it (the build tool opens
    // with that type picked, the ghost by the first producer)
    const sh = sharedOneProducer(world, b);
    if (!sh) return '';
    const gate = canPlace(world, sh.type);
    const price = BUILDINGS[sh.type].price;
    const short = price - world.state.coins;
    const off = !gate.ok || short > 0;
    const btn = `<button class="btn primary cf fix-btn${off ? ' is-disabled' : ''}" data-act="producer:${sh.producer}" aria-disabled="${off}">${
      iconSvg('build', 26)}<span>${esc(t('fix.producer', { name: t(`building.${sh.type}` as MessageKey) }))}</span>${bdi(`−${fmtInt(price)}`)}</button>`;
    const hint = !gate.ok
      ? `<div class="s-hint fix-why">${iconSvg('build', 18)}<span>${esc(errorText(gate.err))}</span></div>`
      : short > 0
        ? `<div class="s-hint fix-why">${iconSvg('coin', 18)}<span>${tHtml('fix.short', { n: fmtInt(short) })}</span></div>`
        : `<div class="s-hint">${esc(t('fix.producerWhy', { who: buildingName(world, sh.producer), n: fmtInt(sh.consumers) }))}</div>`;
    return fixSection(btn, hint, off);
  }
  if (cure === 'pave') {
    // a wagon of this building's job stands at a wooden span (research P4), or the ice ahead outranks a wagon
    // (day 8c): pave the span in stone
    const h = paveSpanFor(world, b);
    if (!h) return '';
    const ok = paveCheck(world, h);
    let price = 0;
    for (const c of h.cells) price += roadCellCost(world, c, 2);
    const btn = `<button class="btn primary cf fix-btn${ok.ok ? '' : ' is-disabled'}" data-act="pave:${b.id}" aria-disabled="${!ok.ok}">${
      iconSvg('road_cobble', 26)}<span>${esc(t('fix.pave'))}</span>${bdi(`−${fmtInt(price)}`)}</button>`;
    const hint = ok.ok
      ? `<div class="s-hint">${esc(h.held
        ? t('fix.paveWhy', { wagon: wagonName(world, h.held.wagon) })
        : t('fix.iceAheadWhy', { time: ticksClock(h.ice!.startTick - world.state.tick), n: fmtInt(price) }))}</div>`
      : `<div class="s-hint fix-why">${iconSvg(ok.err.k === 'NO_COINS' ? 'coin' : 'road_cobble', 18)}<span>${
        ok.err.k === 'NO_COINS' ? tHtml('fix.short', { n: fmtInt(ok.err.need - ok.err.have) }) : esc(errorText(ok.err))}</span></div>`;
    return fixSection(btn, hint, !ok.ok);
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
    return fixSection(btn, hint, short > 0);
  }
  // a wagon in the chain waits at a one-lane bridge (also behind the wagon it waits for, audit fix 2)
  if (chain.some((l) => l.kind === 'wagon' && l.status.k === 'BRIDGE_JAM')) {
    const text = canSurface(world, 2).ok ? t('fix.jamStone') : t('fix.jam');
    return `<div class="section-h">${esc(t('fix.title'))}</div><div class="s-hint jam-hint">${iconSvg('bridge_jam', 18)}<span>${esc(text)}</span></div>`;
  }
  return '';
}

/**
 * A stall with nothing to fix, said plainly instead of a cure that would not work (audit 2026-11-03): a full
 * yard nobody needs right now (fix 1: no "Kup wóz"), a full granary while another one has room (fix 3, with one
 * tap to it), the rest of a good whose order is complete (fix 6: no granary hint). Only when the chain stops at the
 * building itself; placed right under the count, above the codex fold, so it is read before the generic advice.
 */
function calmHtml(world: World, b: Building, chain: ReasonLink[]): string {
  if (chain.length > 1) return '';
  const en = (k: MessageKey): string => (translated(k) ? '' : ' lang="en" dir="ltr"');
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
      const pc = paceCard(nav.world, forecastFor(nav.world, nav.pace));
      if (pc && pc.k === 'mud' && pc.producer === Number(arg)) nav.buildRoad(pc.cells, 2);
    }
    if (act === 'producer' && !el.classList.contains('is-disabled')) {
      const p = buildingById(nav.world, Number(arg));
      if (p) nav.pickBuild(p.type, p.id);
    }
    if (act === 'fix' && !el.classList.contains('is-disabled')) {
      const s = gapSuggestion(nav.world, Number(arg));
      if (s && s.cost <= nav.world.state.coins) nav.buildRoad(s.cells);
    }
  });
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
    const tag = root ? `<span class="root-tag">${esc(t('why.root'))}</span>` : '';
    const attrs = self ? 'disabled' : `data-go="${l.kind}:${l.id}"`;
    const pos = i === 0 ? 'c-first' : i === last ? 'c-last' : 'c-mid';
    return `<li class="${pos}" data-because="${because}"><button class="link cf${root ? ' is-root' : ''}${self ? ' is-self' : ''}" ${attrs}>
      <span class="l-icon">${linkIcon(world, l, 32)}</span>
      <span class="l-text"><span class="l-who">${esc(linkSubject(world, l))}${tag}</span><span class="l-why">${esc(linkText(world, l))}</span></span>
      ${self ? `<span class="l-since">${since}</span>` : `<span class="l-go fwd">${iconSvg('back', 18)}</span>`}</button></li>`;
  });
  if (mid > 0) {
    items.splice(1, 0, `<li class="c-more"><button class="c-more-btn" data-act="chain:${key}" aria-expanded="${open}"><span class="c-n" dir="auto"${translated('why.more') ? '' : ' lang="en"'}>${
      esc(t('why.more', { n: mid }))}</span><span class="codex-chev" aria-hidden="true"></span></button></li>`);
  }
  return `<ol class="chain${mid > 0 ? ' has-mid' : ''}${open ? ' is-open' : ''}">${items.join('')}</ol>`;
}

/** Unfold the middle links in place (the sheet's next refresh renders the same open state). */
function openChain(btn: HTMLElement, key: string): void {
  chainOpen.add(key);
  const ol = btn.closest('.chain');
  ol?.classList.add('is-open');
  btn.setAttribute('aria-expanded', 'true');
  ol?.querySelector<HTMLButtonElement>('.c-mid button[data-go]')?.focus({ preventScroll: true });
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
      const own: string[] = [];
      own.push(`<div class="section-h">${esc(t('why.order'))}</div><div class="goods">${gs.map((g) =>
        chip(g, Math.min(b.stock[g], c.need[g]), c.need[g], inc(g))).join('')}</div>`);
      // a slow supply is not a stall: the pace and the forecast say what the statuses cannot (F10);
      // while the castle only waits for wagons this section leads the card instead (buildingSheet)
      if (c.castle === b.id && (isStall(b.status) || b.status.k === 'NO_INPUT')) own.push(castlePaceHtml(world, forecastFor(world, pace)));
      parts.push(fold ? castleFold(own.join('')) : own.join(''));
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
      if (pressed(sheet)) return true;
      const stalled = isStall(b.status) || b.status.k === 'NO_INPUT';
      setHtml(sheet.icon, iconSvg(b.type as IconId, 36));
      sheet.kicker.textContent = stalled ? t('why.title') : '';
      sheet.title.textContent = t(`building.${b.type}` as MessageKey);
      const chain = explainBuilding(world, id, 5, true);
      const since = b.stalledTicks > 0 ? `<span class="since">${tHtml('why.stalledFor', { time: ticksClock(b.stalledTicks) })}</span>` : '';
      let top: string;
      if (chain.length > 1) {
        top = `<div class="section-h chain-h">${esc(t('why.chain'))}${since}</div>${chainHtml(world, chain, 'building', id, b.stalledTicks > 0 ? `<bdi class="num">${esc(ticksClock(b.stalledTicks))}</bdi>` : '')}`;
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
      const fold = b.type === 'castle' && !!nav.tutorialRunning?.();
      const pace = b.type === 'castle' && !stalled && !fold && world.state.mission.contract?.castle === b.id ? castlePaceHtml(world, forecastFor(world, nav.pace)) : '';
      // "what does it mean?" for the last stall of the chain (the one the player has to fix), never for a
      // producer at work or a wagon on its way (audit fix 4)
      const cl = codexLink(chain, { kind: 'building', id, status: b.status });
      const codex = stalled ? codexHtml(cl.kind, cl.status, codexCalm(world, cl)) : '';
      const lead = pace + thinHtml(world, b.id) + sharedHtml(world, b.id) + (b.status.k === 'NO_INPUT' ? upSeason + top : top + upSeason) + fullHtml(world, b, chain) + (stalled ? calmHtml(world, b, chain) : '') + codex;
      // three parts, each re-rendered only when its own HTML changes: the stall clock ticking in the chain no
      // longer replaces the fix button under the player's finger (first-10-minutes-b, item 4)
      const [pLead, pFix, pRest] = sheetParts(sheet.body, 3);
      setHtml(pLead!, lead + seasonHtml(world, b.id) + iceHtml(world, chain));
      // a waiting (not stalled) building on the card for a shared single producer or a held span (research P4/P5)
      // gets that card's fix too
      const carded = !stalled && !fix && (cureFor(world, b.id) === 'producer' || cureFor(world, b.id) === 'pave');
      // the pace card's producer (day 8c): its fix, unless this building has a stall with a cure of its own
      const pc = !fix && !(stalled && cureFor(world, b.id)) ? paceCard(world, forecastFor(world, nav.pace)) : null;
      const pcHere = pc && pc.producer === b.id ? pc : null;
      // the muddy stretch shows on the map like the gap finder's road
      if (pcHere?.k === 'mud') nav.setGhost(pcHere.cells);
      setHtml(pFix!, fix ? fixHtml(world, target, fix) : pcHere ? paceCureHtml(world, pcHere) : stalled || carded ? cureHtml(world, b, chain) : '');
      setHtml(pRest!, undo + stockHtml(world, b, nav.pace, fold));
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
        `<button class="btn cf${canSell ? '' : ' is-disabled'}" data-act="sell:${id}" aria-disabled="${!canSell}">${iconSvg('coin', 22)}<span>${tHtml('wagon.sell', { n: fmtInt(WAGON_REFUND) })}</span></button></div>` +
        (canSell ? '' : `<div class="s-hint sell-hint">${esc(t('wagon.sellBusy'))}</div>`);
      // the road fix sits after the chain (and the ice hint) as before, in its own part (D-100)
      const cut = html.indexOf('<div class="sheet-actions">');
      const [pLead, pFix, pRest] = sheetParts(sheet.body, 3);
      setHtml(pLead!, html.slice(0, cut));
      setHtml(pFix!, fix ? fixHtml(world, target, fix) : '');
      setHtml(pRest!, html.slice(cut));
      return true;
    },
    onClose() { nav.setGhost(null); chainOpen.delete('wagon:' + id); },
  };
}

