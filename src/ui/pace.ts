// Contract pace on the waybill and the castle card (F10), and the shared-input line on a consumer's
// card (F3). Both read the sim (contractForecast, sharedInput); nothing here writes state.
import {
  GOODS, buildingById, contractForecast, sharedInput, thinDelivery, type ContractForecast, type PaceLog, type World,
} from '../sim/index';
import { t, type MessageKey } from '../i18n/index';
import { esc } from './dom';
import { capFirst, fmtDec, fmtInt, goodName, tHtml, ticksClock } from './format';
import { iconSvg } from './icons';

let cache: { key: string; f: ContractForecast | null } | null = null;

/**
 * The forecast is a few path searches; recompute only when a new pace sample lands, the network
 * changes or a delivery is made or promised (the waybill and the card ask every frame).
 */
export function forecastFor(world: World, log: PaceLog): ContractForecast | null {
  const st = world.state;
  const c = st.mission.contract;
  // the order with tranches is read tranche by tranche on the waybill; the forecast is for one order
  if (!c || c.tranches.length > 0 || st.mission.result !== 'running') return null;
  const castle = buildingById(world, c.castle);
  let sum = 0;
  if (castle) for (const g of GOODS) if (c.need[g] > 0) sum += castle.stock[g] * 1000 + castle.incoming[g];
  const key = `${st.mapId}|${log.ticks[log.ticks.length - 1] ?? -1}|${st.netVersion}|${sum}|${st.buildings.length}`;
  if (cache?.key !== key) cache = { key, f: contractForecast(world, log) };
  return cache.f;
}

/** Three small seals, the first `n` pressed. */
export function sealRow(n: number): string {
  let s = '';
  for (let i = 0; i < 3; i++) s += `<i class="${i < n ? 'on' : ''}">${iconSvg('seal', 16)}</i>`;
  return `<span class="pace-seals" role="img" aria-label="${esc(t('contract.stars', { n }))}">${s}</span>`;
}

function producerName(f: ContractForecast, i: number): string {
  const g = f.goods[i]!;
  return g.producerType ? t(`building.${g.producerType}` as MessageKey) : '—';
}

/** Waybill block: "At this pace: done in 9:40 ●○○" and the bottleneck's supply "Fisher's hut ×1 · 5.3/min". */
export function waybillPaceHtml(world: World, f: ContractForecast | null): string {
  if (!f || !f.ready || f.bottleneck < 0) return '';
  const tick = world.state.tick;
  const c = world.state.mission.contract!;
  const late = f.seals === 0;
  const eta = late
    ? tHtml('contract.pace.late', { time: ticksClock(f.finishTick - c.deadlineTick) })
    : tHtml('contract.pace.eta', { time: ticksClock(f.finishTick - tick) });
  const b = f.goods[f.bottleneck]!;
  const supply = tHtml('contract.pace.supply', { who: producerName(f, f.bottleneck), n: fmtInt(b.producers), rate: fmtDec(b.perMin, 1) });
  const go = b.producer >= 0 ? `data-wb="b:${b.producer}"` : 'data-wb="castle"';
  return `<div class="wb-pace${late ? ' late' : f.seals <= 1 ? ' warn' : ''}">
    <div class="wb-pace-eta" data-wb="castle" role="button" tabindex="0"><span>${eta}</span>${late ? '' : sealRow(f.seals)}</div>
    <div class="wb-pace-sup" ${go} role="button" tabindex="0">${iconSvg(b.good, 18, goodName(b.good))}<span>${supply}</span></div></div>`;
}

/** Castle card section: per good the producers' pace now and at most, the forecast and what a better seal needs. */
export function castlePaceHtml(world: World, f: ContractForecast | null): string {
  const c = world.state.mission.contract;
  if (!c || c.tranches.length > 0 || world.state.mission.result !== 'running') return '';
  if (!f || !f.ready) return `<div class="section-h">${esc(t('why.pace.title'))}</div><div class="pace-wait">${esc(t('why.pace.wait'))}</div>`;
  const tick = world.state.tick;
  const rows = f.goods.map((g, i) => {
    if (g.have >= g.need) return '';
    const text = tHtml('why.pace.good', { who: producerName(f, i), n: fmtInt(g.producers), rate: fmtDec(Math.max(0, g.perMin), 1), cap: fmtDec(g.capPerMin, 1) });
    const btn = g.producer >= 0 ? `data-go="building:${g.producer}"` : 'disabled';
    return `<button class="pace-row cf${i === f.bottleneck ? ' is-neck' : ''}" ${btn}>${iconSvg(g.good, 24, goodName(g.good))}<span>${text}</span></button>`;
  }).join('');
  let fc = '';
  if (f.bottleneck >= 0) {
    const late = f.seals === 0;
    fc = `<div class="pace-fc${late ? ' late' : f.seals <= 1 ? ' warn' : ''}">${late
      ? tHtml('contract.pace.late', { time: ticksClock(f.finishTick - c.deadlineTick) })
      : `<span>${tHtml('contract.pace.eta', { time: ticksClock(f.finishTick - tick) })}</span>${sealRow(f.seals)}`}</div>`;
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
    .split(`<bdi class="num">\u0001</bdi>`).join(`<button class="linkish" data-go="building:${rival.id}">${esc(name)}</button>`);
  let one = '';
  const p = s.producers === 1 && s.consumers >= 2 ? buildingById(world, s.producer) : null;
  if (p) one = `<br><small>${tHtml('why.sharedOne', { who: t(`building.${p.type}` as MessageKey), n: fmtInt(s.consumers) })}</small>`;
  return `<div class="s-hint shared-hint">${iconSvg('contested', 22)}<span>${text}${one}</span></div>`;
}

/**
 * "Wood on the way" in a thin load (mission X, D-41): the wagon carries a small part of a full load because
 * the supplier had no more — name the shortage at the source instead of letting the delivery hide it.
 */
export function thinHtml(world: World, id: number): string {
  const d = thinDelivery(world, id);
  if (!d) return '';
  const src = buildingById(world, d.source);
  if (!src) return '';
  const name = t(`building.${src.type}` as MessageKey);
  const text = tHtml('why.thin', { wagon: fmtInt(d.wagon), qty: fmtInt(d.qty), full: fmtInt(d.full), source: '\u0001' })
    .split(`<bdi class="num">\u0001</bdi>`).join(`<button class="linkish" data-go="building:${src.id}">${esc(name)}</button>`);
  return `<div class="s-hint thin-hint">${iconSvg(d.good, 22)}<span dir="auto">${text}</span></div>`;
}

