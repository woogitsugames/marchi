// Contract pace on the waybill and the castle card (F10), and the shared-input line on a consumer's
// card (F3). Both read the sim (contractForecast, sharedInput); nothing here writes state.
import {
  TICK_HZ, buildingById, missionBuildable, sharedInput, thinDelivery, type ContractForecast, type World,
} from '../sim/index';
import { t, type MessageKey } from '../i18n/index';
import { esc } from './dom';
import { bdi, capFirst, fmtDec, fmtInt, goodName, tHtml, ticksClock } from './format';
import { iconSvg } from './icons';

export { forecastFor } from './paceCard';

/** The deadline the forecast is read against: the tranche now due (until it is missed), else the contract's. */
export function paceDueTick(world: World): number {
  const c = world.state.mission.contract!;
  const x = c.tranches.find((t) => t.doneTick < 0);
  return x && !x.missed ? x.deadlineTick : c.deadlineTick;
}

/** Late after the deadline now due; a warning when a single order earns one seal or a tranche lands in its last minute. */
function paceState(world: World, f: ContractForecast): 'late' | 'warn' | '' {
  const due = paceDueTick(world);
  if (f.finishTick > due) return 'late';
  if (world.state.mission.contract!.tranches.length) return due - f.finishTick < 60 * TICK_HZ ? 'warn' : '';
  return f.seals <= 1 ? 'warn' : '';
}

/** Three small seals, the first `n` pressed. */
export function sealRow(n: number): string {
  let s = '';
  for (let i = 0; i < 3; i++) s += `<i class="kseal${i < n ? ' on' : ''}"></i>`;
  return `<span class="pace-seals" role="img" aria-label="${esc(t('contract.stars', { n }))}">${s}</span>`;
}

function producerName(f: ContractForecast, i: number): string {
  const g = f.goods[i]!;
  return g.producerType ? t(`building.${g.producerType}` as MessageKey) : '—';
}

/** Waybill block (the seals sit in the panel head, D-43): "At this pace: done in 9:40" and the bottleneck's supply "Fisher's hut ×1 · 5.3/min". */
export function waybillPaceHtml(world: World, f: ContractForecast | null): string {
  if (!f || !f.ready || f.bottleneck < 0) return '';
  const tick = world.state.tick;
  const state = paceState(world, f);
  const late = state === 'late';
  const eta = late
    ? tHtml('contract.pace.late', { time: ticksClock(f.finishTick - paceDueTick(world)) })
    : tHtml('contract.pace.eta', { time: ticksClock(f.finishTick - tick) });
  // the short form of the Flip cover's line (D-99), shown when the landscape card is short of room (D-353)
  const short = late
    ? tHtml('contract.sealPace.late', { time: ticksClock(f.finishTick - paceDueTick(world)) })
    : tHtml('contract.sealPace.eta', { time: ticksClock(f.finishTick - tick) });
  const b = f.goods[f.bottleneck]!;
  const supply = tHtml('contract.pace.supply', { who: producerName(f, f.bottleneck), n: fmtInt(b.producers), rate: fmtDec(b.perMin, 1) });
  const go = b.producer >= 0 ? `data-wb="b:${b.producer}"` : 'data-wb="castle"';
  return `<div class="wb-pace${state ? ' ' + state : ''}">
    <div class="wb-pace-eta" data-wb="castle" role="button" tabindex="0"><span class="eta-full">${eta}</span><span class="eta-short" aria-hidden="true">${short}</span></div>
    <div class="wb-pace-sup" ${go} role="button" tabindex="0">${iconSvg(b.good, 18, goodName(b.good))}<span>${supply}</span><small class="sup-rate" aria-hidden="true">${tHtml('contract.pace.rate', { rate: fmtDec(b.perMin, 1) })}</small></div></div>`;
}

/**
 * Watch mode (Flip cover, BACKLOG P3 from D-43; D-99): one short line under the folded seal's clock —
 * "gotowe za 9:40" at this pace, "spóźni się 1:20" when the forecast misses the due time. Empty until the
 * forecast is ready.
 */
export function sealPaceHtml(world: World, f: ContractForecast | null): string {
  if (!f || !f.ready || f.bottleneck < 0) return '';
  const state = paceState(world, f);
  const text = state === 'late'
    ? tHtml('contract.sealPace.late', { time: ticksClock(f.finishTick - paceDueTick(world)) })
    : tHtml('contract.sealPace.eta', { time: ticksClock(f.finishTick - world.state.tick) });
  return `<span class="seal-pace${state ? ' ' + state : ''}">${text}</span>`;
}

/** Castle card section: per good the producers' pace now and at most, the forecast and what a better seal needs. */
export function castlePaceHtml(world: World, f: ContractForecast | null): string {
  const c = world.state.mission.contract;
  if (!c || world.state.mission.result !== 'running') return '';
  if (c.tranches.length > 0 && c.tranches.every((x) => x.doneTick >= 0)) return '';
  if (!f || !f.ready) return `<div class="section-h">${esc(t('why.pace.title'))}</div><div class="pace-wait">${esc(t(c.tranches.length ? 'why.pace.waitTranche' : 'why.pace.wait'))}</div>`;
  const tick = world.state.tick;
  const rows = f.goods.map((g, i) => {
    if (g.have >= g.need) return '';
    const text = tHtml('why.pace.good', { who: producerName(f, i), n: fmtInt(g.producers), rate: fmtDec(Math.max(0, g.perMin), 1), cap: fmtDec(g.capPerMin, 1) });
    const btn = g.producer >= 0 ? `data-go="building:${g.producer}"` : 'disabled';
    return `<button class="pace-row cf${i === f.bottleneck ? ' is-neck' : ''}" ${btn}>${iconSvg(g.good, 24, goodName(g.good))}<span>${text}</span></button>`;
  }).join('');
  let fc = '';
  if (f.bottleneck >= 0) {
    const state = paceState(world, f);
    // a tranche's forecast is "on time or late" for that part; the seals are the whole order's
    fc = `<div class="pace-fc${state ? ' ' + state : ''}">${state === 'late'
      ? tHtml('contract.pace.late', { time: ticksClock(f.finishTick - paceDueTick(world)) })
      : `<span>${tHtml('contract.pace.eta', { time: ticksClock(f.finishTick - tick) })}</span>${c.tranches.length ? '' : sealRow(f.seals)}`}</div>`;
  }
  const aim = f.aim
    ? `<div class="pace-aim">${tHtml('why.pace.need', { seals: t('why.pace.seals', { n: f.aim.seals }), time: ticksClock(f.aim.byTick - tick), rate: fmtDec(f.aim.perMin, 1) })}</div>` : '';
  return `<div class="section-h">${esc(t('why.pace.title'))}</div>${fc}<div class="pace-rows">${rows}</div>${aim}`;
}

/**
 * A consumer waiting for an input that a consumer of another kind also takes (mission IX's lesson):
 * named above the chain so a wagon on the way or busy wagons do not hide it.
 */
export function sharedHtml(world: World, id: number): string {
  const s = sharedInput(world, id);
  if (!s) return '';
  const rival = buildingById(world, s.rival);
  if (!rival) return '';
  const name = t(`building.${rival.type}` as MessageKey);
  const text = tHtml('why.shared', { good: capFirst(goodName(s.good)), rival: '\u0001', there: fmtInt(s.there), here: fmtInt(s.here) })
    .split(bdi('\u0001')).join(`<button class="linkish" data-go="building:${rival.id}">${esc(name)}</button>`);
  let one = '';
  const p = s.producers === 1 && s.consumers >= 2 ? buildingById(world, s.producer) : null;
  // no second supplier to suggest where nothing can be built (mission XVII, D-401)
  if (p && missionBuildable(world.state.mission.id).length) one = `<br><small>${tHtml('why.sharedOne', { who: t(`building.${p.type}` as MessageKey), n: fmtInt(s.consumers) })}</small>`;
  return `<div class="s-hint shared-hint">${iconSvg('contested', 22)}<span>${text}${one}</span></div>`;
}

/**
 * "Wood on the way" in a thin load (mission X, D-47): the wagon carries a small part of a full load because
 * the supplier had no more — name the shortage at the source instead of letting the delivery hide it.
 */
export function thinHtml(world: World, id: number): string {
  const d = thinDelivery(world, id);
  if (!d) return '';
  const src = buildingById(world, d.source);
  if (!src) return '';
  const name = t(`building.${src.type}` as MessageKey);
  const text = tHtml('why.thin', { wagon: fmtInt(d.wagon), qty: fmtInt(d.qty), full: fmtInt(d.full), source: '\u0001' })
    .split(bdi('\u0001')).join(`<button class="linkish" data-go="building:${src.id}">${esc(name)}</button>`);
  return `<div class="s-hint thin-hint">${iconSvg(d.good, 22)}<span dir="auto">${text}</span></div>`;
}

