// Sheet contents: "Dlaczego stoi?" (building), wagon card, and their cause chains.
import {
  BUILDINGS, GOODS, buildingById, explainBuilding, explainWagon, inputGoods, outputGoods, wagonEta,
  type Building, type Good, type ReasonLink, type World,
} from '../sim/index';
import { t, type MessageKey } from '../i18n/index';
import { esc, setHtml } from './dom';
import {
  buildingStatusIcon, buildingStatusText, clock, goodName, isStall, linkIcon, linkSubject, linkText, ticksClock, wagonName,
  wagonStatusText,
} from './format';
import { iconSvg, type IconId } from './icons';
import type { Sheet, SheetContent } from './sheets';

export interface PanelNav {
  readonly world: World;
  /** Jump the camera to a subject and open its sheet. */
  go(kind: 'building' | 'wagon', id: number): void;
  buyWagon(stable: number): void;
  toggleFollow(wagon: number): void;
  following(): number | null;
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
    if (act === 'buy') nav.buyWagon(Number(arg));
    if (act === 'follow') nav.toggleFollow(Number(arg));
  });
}

function chainHtml(world: World, chain: ReasonLink[], selfKind: 'building' | 'wagon', selfId: number): string {
  const because = esc(t('why.because'));
  const last = chain.length - 1;
  const rootIsStall = (l: ReasonLink): boolean =>
    l.kind === 'building' ? isStall(l.status) || l.status.k === 'NO_INPUT' : l.status.k === 'BRIDGE_JAM' || l.status.k === 'NO_ROUTE';
  return `<ol class="chain">${chain.map((l, i) => {
    const self = l.kind === selfKind && l.id === selfId;
    const root = i === last && chain.length > 1 && rootIsStall(l);
    const tag = root ? `<span class="root-tag">${esc(t('why.root'))}</span>` : '';
    const attrs = self ? 'disabled' : `data-go="${l.kind}:${l.id}"`;
    return `<li data-because="${because}"><button class="link cf${root ? ' is-root' : ''}${self ? ' is-self' : ''}" ${attrs}>
      <span class="l-icon">${linkIcon(world, l, 32)}</span>
      <span><span class="l-who">${esc(linkSubject(world, l))}${tag}</span><span class="l-why">${esc(linkText(world, l))}</span></span>
      <span class="l-go">${self ? '' : iconSvg('back', 18)}</span></button></li>`;
  }).join('')}</ol>`;
}

function chip(g: Good, have: number, cap: number | null, extra: string, empty = false): string {
  return `<div class="good-chip cf${empty ? ' is-empty' : ''}">${iconSvg(g, 28, goodName(g))}
    <span><b class="num">${have}</b>${cap !== null ? `<span class="cap num">/${cap}</span>` : ''}${extra}</span></div>`;
}

function stockHtml(world: World, b: Building): string {
  const def = BUILDINGS[b.type];
  const parts: string[] = [];
  const inc = (g: Good): string => (b.incoming[g] > 0 ? `<span class="inc num">${esc(t('why.inbound', { n: b.incoming[g] }))}</span>` : '');
  if (def.recipe) {
    const ins = inputGoods(b.type), outs = outputGoods(b.type);
    if (ins.length) {
      parts.push(`<div class="section-h">${esc(t('why.needs'))}</div><div class="goods">${ins.map((g) =>
        chip(g, b.stock[g], def.inCap, inc(g), b.stock[g] === 0 && b.incoming[g] === 0)).join('')}</div>`);
    }
    parts.push(`<div class="section-h">${esc(t('why.makes'))}</div><div class="goods">${outs.map((g) =>
      chip(g, b.stock[g], def.outCap, b.reservedOut[g] > 0 ? `<span class="inc num">${esc(t('why.reserved', { n: b.reservedOut[g] }))}</span>` : '')).join('')}</div>`);
    if (b.progress >= 0) {
      const pct = Math.min(100, (b.progress / def.recipe.ticks) * 100);
      parts.push(`<div class="progress" title="${esc(t('why.cycle'))}"><i style="width:${pct.toFixed(1)}%"></i></div>`);
    }
  } else if (b.type === 'warehouse') {
    parts.push(`<div class="section-h">${esc(t('why.holds'))} <span class="num">${GOODS.reduce((a, g) => a + b.stock[g], 0)}/${def.storeCap}</span></div>
      <div class="goods">${GOODS.map((g) => chip(g, b.stock[g], null, inc(g))).join('')}</div>`);
  } else if (b.type === 'castle') {
    const c = world.state.mission.contract;
    if (c) {
      const gs = GOODS.filter((g) => c.need[g] > 0);
      parts.push(`<div class="section-h">${esc(t('why.order'))}</div><div class="goods">${gs.map((g) =>
        chip(g, Math.min(b.stock[g], c.need[g]), c.need[g], inc(g))).join('')}</div>`);
    }
  } else if (b.type === 'stable') {
    const n = world.state.wagons.filter((w) => w.home === b.id).length;
    parts.push(`<div class="section-h">${esc(t('why.wagons', { n }))}</div>
      <div class="sheet-actions"><button class="btn primary cf" data-act="buy:${b.id}">${iconSvg('buy_wagon', 26)}<span>${esc(t('tool.wagon'))}</span><span class="num">−30</span></button></div>`);
  }
  return parts.join('');
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
      const chain = explainBuilding(world, id);
      const since = b.stalledTicks > 0 ? `<span class="since num">${esc(t('why.stalledFor', { time: ticksClock(b.stalledTicks) }))}</span>` : '';
      let top: string;
      if (chain.length > 1) {
        top = `<div class="section-h">${esc(t('why.chain'))}${since}</div>${chainHtml(world, chain, 'building', id)}`;
      } else {
        const cls = stalled ? 'bad' : b.status.k === 'WORKING' || b.status.k === 'CONTRACT_DONE' ? 'ok' : '';
        top = `<div class="status-line ${cls}">${buildingStatusIcon(b.status, 28, b.type)}<span>${esc(buildingStatusText(b.status))}</span>${since}</div>`;
      }
      setHtml(sheet.body, top + stockHtml(world, b));
      return true;
    },
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
      sheet.title.textContent = wagonName(id);
      const eta = wagonEta(world, id);
      const waiting = w.status.k === 'BRIDGE_JAM' || w.status.k === 'NO_ROUTE';
      const cargo = w.cargoGood && w.cargoQty > 0
        ? `<span style="display:inline-flex;align-items:center;gap:6px">${iconSvg(w.cargoGood, 26, goodName(w.cargoGood))}<span class="num">× ${w.cargoQty}</span> ${esc(goodName(w.cargoGood))}</span>`
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
        rows.push(`<dt>${esc(t('wagon.eta'))}</dt><dd class="eta num">${clock(eta.toDest)}</dd>`);
        if (job) rows.push(`<dt>${esc(t('wagon.etaFinish'))}</dt><dd class="eta num">${clock(eta.toFinish)}</dd>`);
        if (job && job.phase === 'pickup') {
          const to = buildingById(world, job.to);
          if (to) rows.push(`<dt>&nbsp;</dt><dd style="font-weight:500">${iconSvg(job.good, 18)}<span style="display:inline-block;vertical-align:top;margin-left:4px">${esc(goodName(job.good))} → <button class="linkish" data-go="building:${to.id}">${esc(t(`building.${to.type}` as MessageKey))}</button></span></dd>`);
        }
      }
      const follow = nav.following() === id;
      let html = `<div class="status-line${waiting ? ' bad' : ''}">${waiting ? linkIcon(world, { kind: 'wagon', id, status: w.status }, 28) : iconSvg('wagon', 28)}<span>${esc(wagonStatusText(world, w.status))}</span>${
        w.status.k === 'NO_ROUTE' ? `<span class="since num">${esc(t('why.stalledFor', { time: ticksClock(world.state.tick - w.status.since) }))}</span>` : ''}</div>`;
      html += `<dl class="kv" style="margin-top:10px">${rows.join('')}</dl>`;
      if (waiting) {
        const chain = explainWagon(world, id);
        if (chain.length > 1) html += `<div class="section-h">${esc(t('wagon.chain'))}</div>${chainHtml(world, chain, 'wagon', id)}`;
      }
      html += `<div class="sheet-actions"><button class="btn cf${follow ? ' is-on' : ''}" data-act="follow:${id}">${iconSvg('follow', 26)}<span>${esc(t(follow ? 'wagon.unfollow' : 'wagon.follow'))}</span></button></div>`;
      setHtml(sheet.body, html);
      return true;
    },
  };
}

