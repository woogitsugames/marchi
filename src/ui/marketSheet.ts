// "Targ i ranga" sheet (free valley): what the next rank needs, castle market prices per good
// (base, current %, saturation), buildings open and locked, and when each rank was reached.
import { BUILDINGS, MARKET, RANKS, TRADE_POST, sandboxStatus, tradePostStatus, type BuildingType, type World } from '../sim/index';
import { t, type MessageKey } from '../i18n/index';
import { esc, setHtml } from './dom';
import { bdi, fmtDec, fmtInt, fmtPercent, goodName, rankName, tHtml, ticksClock } from './format';
import { iconSvg, type IconId } from './icons';
import type { Sheet, SheetContent } from './sheets';
import { unlockList } from './hud';

export function marketSheet(world: () => World, go?: (id: number) => void): SheetContent {
  return {
    key: 'market',
    update(sheet: Sheet) {
      const w = world();
      const sb = sandboxStatus(w);
      if (!sb.market) return false;
      const body = sheet.body as HTMLElement & { __postGo?: boolean };
      if (go && !body.__postGo) {
        // "Pokaż punkt handlowy" (D-170): the post's own sheet
        body.__postGo = true;
        body.addEventListener('click', (e) => {
          const el = (e.target as HTMLElement).closest<HTMLElement>('[data-go]');
          const id = el?.dataset.go?.startsWith('building:') ? Number(el.dataset.go.slice(9)) : NaN;
          if (Number.isFinite(id)) go(id);
        });
      }
      setHtml(sheet.icon, iconSvg('castle', 36));
      sheet.kicker.textContent = t('town.open');
      sheet.title.textContent = rankName(sb.rank);

      const n = sb.next;
      const req = (label: string, have: number, need: number, unit = ''): string => {
        const met = have >= need;
        const pct = Math.min(100, (have / Math.max(1, need)) * 100);
        // the kit (day 2): an empty seal pressed in wax once the requirement is met, the brass progress groove
        return `<li class="${met ? 'is-met' : ''}"><i class="pl-mark kseal${met ? ' on' : ''}" aria-hidden="true"></i><span class="pl-l">${esc(label)}</span>
          <bdi class="num pl-v">${fmtInt(have)}<small>/${fmtInt(need)}${unit}</small></bdi><span class="kbar pl-bar"><i style="width:${pct.toFixed(1)}%"></i></span></li>`;
      };
      const next = n
        ? `<div class="section-h"><span>${tHtml('town.toNext', { name: rankName(n.rank) })}</span></div>
          <ul class="pl-req ms-req">${req(t('town.renownShort'), sb.renown, n.renown)}${req(t('town.goodsShort'), sb.goodsSold, n.goods)}${req(t('town.flowShort'), sb.bestFlow, n.flow)}</ul>
          ${unlockList(n.rank) ? `<div class="s-hint ms-unlocks">${iconSvg('build', 18)}<span>${esc(t('town.willUnlock', { list: unlockList(n.rank) }))}</span></div>` : ''}`
        : `<div class="status-line ok">${iconSvg('seal', 26)}<span>${esc(t('town.top'))}</span></div>`;
      const income = `<div class="ms-income">${iconSvg('coin', 22)}<span>${tHtml('town.income', { n: fmtInt(sb.flowNow) })}</span></div>`;

      // prices: one row per good — icon, name, price now (and % of base), saturation bar
      const rows = sb.prices.map((p) => {
        const sat = Math.min(100, (p.saturation / MARKET.cap) * 100);
        // the % column is the price now against base: saturation and the valley fair (D-54) (cents carry both)
        const pct = Math.floor((p.pct * p.fairPct) / 100);
        const low = pct <= 75;
        return `<li class="ms-good${low ? ' is-low' : ''}">${iconSvg(p.good, 28, goodName(p.good))}
          <span class="ms-name"><b>${esc(goodName(p.good))}</b><small>${tHtml('market.base', { n: fmtInt(p.base) })} · ${tHtml('market.sold', { n: fmtInt(p.sold) })}</small></span>
          <span class="ms-price"><b>${bdi(fmtDec(p.cents / 100))}</b><small>${bdi(fmtPercent(pct / 100))}</small></span>
          <span class="ms-sat" title="${esc(t('market.sat'))}"><span class="kbar pl-bar"><i style="width:${sat.toFixed(1)}%"></i></span></span></li>`;
      }).join('');
      const headRow = `<li class="ms-good ms-headrow" aria-hidden="true"><span></span><span></span><small>${esc(t('market.colPrice'))}</small><small>${esc(t('market.sat'))}</small></li>`;
      const fair = sb.prices.find((p) => p.fairPct > 100);
      const fairHint = fair ? `<div class="s-hint season-hint">${iconSvg(fair.good, 18, goodName(fair.good))}<span>${esc(t('events.fair.active', { good: t(`goodAcc.${fair.good}` as MessageKey) }))}</span></div>` : '';
      // the trading post across the river (D-170), once it buys: one line and the way to its sheet
      const ps = tradePostStatus(w);
      const post = ps && ps.open ? `<div class="s-hint ms-post">${iconSvg('tradePost', 18)}<span>${esc(t('post.marketLine', { pct: fmtPercent(TRADE_POST.pricePct / 100) }))}</span></div>
        <div class="sheet-actions"><button class="btn cf" data-go="building:${ps.building.id}">${iconSvg('tradePost', 24)}<span>${esc(t('post.show'))}</span></button></div>` : '';
      const prices = `<div class="section-h">${esc(t('market.prices'))}</div><ul class="ms-prices">${headRow}${rows}</ul>
        ${fairHint}<div class="s-hint">${esc(t('market.satHint'))}</div>${post}`;

      // buildings: open ones plain, locked ones hatched with their rank
      const card = (b: BuildingType, rank: number): string => `<span class="ms-b${rank >= 0 ? ' is-locked' : ''}">${iconSvg(b as IconId, 28)}
        <span>${esc(t(`building.${b}` as MessageKey))}</span>${rank >= 0 ? `<small>${esc(t('build.rankN', { n: rank }))}</small>` : ''}</span>`;
      const blds = `<div class="section-h">${esc(t('market.buildings'))}</div><div class="ms-blds">${
        sb.unlocked.filter((b) => b !== 'castle' && b !== 'tradePost' && BUILDINGS[b]).map((b) => card(b, -1)).join('')}${sb.locked.map((l) => card(l.type, l.rank)).join('')}</div>`;

      // rank history
      const hist = `<div class="section-h">${esc(t('market.history'))}</div><ol class="ms-hist">${RANKS.map((_, i) => {
        const at = sb.rankTicks[i] ?? -1;
        const opens = unlockList(i);
        return `<li class="${at >= 0 ? 'is-reached' : ''}"><span class="mh-n">${esc(rankName(i))}${
          i > 0 && opens ? `<small class="mh-u">${esc(opens)}</small>` : ''}</span><span class="lg-dots" aria-hidden="true"></span>${
          at >= 0 ? `<span class="mh-t">${tHtml('market.reached', { time: ticksClock(at) })}</span>` : `<span class="mh-t is-not">${esc(t('market.notYet'))}</span>`}</li>`;
      }).join('')}</ol>`;

      setHtml(sheet.body, next + income + prices + blds + hist);
      return true;
    },
  };
}
