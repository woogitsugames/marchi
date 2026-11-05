// "Wieści z doliny" (D-54): the free valley's event card under the town plaque. Royal orders (accept /
// set aside, per-good progress, reward), the seasonal fair (announced / open) and the travelling
// merchant (sell surplus / put aside). Reads the sim only; player choices go out as commands.
// The card starts folded to its header and count (the choice is kept for the session, UI prefs only); a new
// event says so once in a toast and lights the folded header briefly. Open, it shows one item in full (the
// accepted order, else the newest order, else the merchant); the other orders and the merchant are one-line
// rows that open on a tap (one open at a time, so 3–4 events stay a short card in portrait).
import {
  GOODS, fairStage, merchantSurplus,
  type Command, type Good, type RoyalOrder, type ValleyEventState, type World,
} from '../sim/index';
import { getLang, t, type MessageKey } from '../i18n/index';
import { esc, h, setHtml } from './dom';
import { fmtDec, fmtInt, goodName } from './format';
import { iconSvg, type IconId } from './icons';
import { loadSessionFlag, saveSessionFlag } from './prefs';

export interface EventCardActions {
  command(cmd: Command): void;
  toast(text: string, icon: IconId): void;
}

const goodAcc = (g: Good): string => t(`goodAcc.${g}` as MessageKey);
const orderTitle = (o: RoyalOrder): string => t(`events.order.t.${o.templateId}` as MessageKey);
const orderGoods = (o: RoyalOrder): Good[] => GOODS.filter((g) => (o.need[g] ?? 0) > 0);

/** One of four wordings for a merchant's arrival, fixed per offer (from its id, so a reload says the same). */
function merchantLine(id: string): MessageKey {
  let hsh = 0;
  for (let i = 0; i < id.length; i++) hsh = (hsh * 31 + id.charCodeAt(i)) % 9973;
  const v = hsh % 4;
  return (v === 0 ? 'events.merchant.new' : `events.merchant.new.${v}`) as MessageKey;
}

function kbar(frac: number): string {
  const pct = Math.max(0, Math.min(1, frac)) * 100;
  return `<span class="kbar ev-bar"><i style="width:${pct.toFixed(1)}%"></i></span>`;
}

/** Ids of everything the card shows (a new id = a new event worth one toast). */
function eventIds(ev: ValleyEventState, tick: number): string[] {
  const ids = ev.orders.map((o) => o.id);
  if (ev.merchant) ids.push(ev.merchant.id);
  if (ev.fair && fairStage(ev.fair, tick) !== 'none') ids.push(ev.fair.id);
  return ids;
}

/** A folded item: one 48 px row (icon, title, a short figure, chevron) that opens it in full. */
function rowHtml(id: string, icon: string, title: string, figure: string, cls: string): string {
  return `<li class="ev-item ev-row ${cls}"><button class="ev-rowbtn" data-evx="${esc(id)}" aria-expanded="false"
    aria-label="${esc(t('events.row.open', { title }))}">${icon}<span class="ev-t ev-rt" dir="auto">${esc(title)}</span>${figure}<span class="ev-chev" aria-hidden="true"></span></button></li>`;
}

/** An order as a row: accepted ones show the delivered / required units, offers the silver reward. */
function orderRow(o: RoyalOrder): string {
  const goods = orderGoods(o);
  const need = goods.reduce((s, g) => s + (o.need[g] ?? 0), 0);
  const have = goods.reduce((s, g) => s + Math.min(o.need[g] ?? 0, o.delivered[g] ?? 0), 0);
  const figure = o.accepted
    ? `<bdi class="num ev-rv">${fmtInt(have)}<small>/${fmtInt(need)}</small></bdi>`
    : `<bdi class="num ev-rv">${iconSvg('coin', 16)}${fmtInt(o.rewardSilver)}</bdi>`;
  return rowHtml(o.id, `<span class="ev-seal">${iconSvg('seal', 18)}</span>`, orderTitle(o), figure, `ev-order${o.accepted ? ' is-on' : ''}`);
}

export class EventCard {
  readonly root: HTMLElement;
  private head: HTMLButtonElement;
  private count: HTMLElement;
  private body: HTMLElement;
  private open = loadSessionFlag('eventsOpen', false);
  /** The item the player opened by tapping its row (null: the default focus). */
  private pick: string | null = null;
  private hudFolded = false;
  private sig = '';
  /** Focus/open state of the last render: the list scrolls to the full item only when this changes. */
  private shown = '';
  /** Toast bookkeeping: the world it belongs to, ids already seen, orders of the last frame. */
  private world: World | null = null;
  private seen = new Set<string>();
  private prevOrders: RoyalOrder[] = [];
  private prevDone = 0;

  constructor(private act: EventCardActions) {
    this.count = h('bdi.ev-n.num');
    this.head = h('button.ev-head', { 'aria-expanded': 'false' },
      h('span.ev-ic', { html: iconSvg('seal', 22) }), h('span.ev-title', null, t('events.card.title')), this.count,
      h('span.ev-chev', { 'aria-hidden': 'true' })) as HTMLButtonElement;
    this.head.addEventListener('click', () => {
      this.open = !this.open;
      saveSessionFlag('eventsOpen', this.open);
      this.root.classList.remove('is-fresh');
      this.sig = '';
    });
    this.body = h('ul.ev-list');
    this.body.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-evx]');
      if (row) { this.pick = row.dataset.evx ?? null; this.sig = ''; return; }
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-ev]');
      if (!el || el.getAttribute('aria-disabled') === 'true') return;
      const [k, id] = (el.dataset.ev ?? '').split('|') as [string, string];
      const t2 = k === 'accept' ? 'orderAccept' : k === 'decline' ? 'orderDecline' : k === 'sell' ? 'merchantSell' : 'merchantDecline';
      this.act.command({ t: t2, id } as Command);
    });
    this.root = h('section.ev-card', { 'aria-label': t('events.card.title') }, this.head, this.body);
    this.root.hidden = true;
    this.root.addEventListener('animationend', (e) => { if (e.target === this.head) this.root.classList.remove('is-fresh'); });
  }

  /** The HUD's fold (ribbon, tiny screens): the card shrinks to its header too. */
  setHudFolded(f: boolean): void {
    if (this.hudFolded === f) return;
    this.hudFolded = f;
    this.sig = '';
  }

  update(world: World): void {
    const st = world.state;
    const ev = st.mission.contract ? undefined : st.valleyEvents;
    if (!ev) { this.root.hidden = true; this.world = world; return; }
    this.notify(world, ev);
    const fairOn = ev.fair ? fairStage(ev.fair, st.tick) : 'none';
    const n = ev.orders.length + (ev.merchant ? 1 : 0) + (fairOn !== 'none' ? 1 : 0);
    const surplus = ev.merchant ? Math.min(ev.merchant.quantity, merchantSurplus(st)[ev.merchant.good] ?? 0) : 0;
    const open = this.open && !this.hudFolded;
    const focus = this.focusId(ev);
    const sig = `${n}|${open}|${focus}|${fairOn}|${surplus}|${getLang()}|${JSON.stringify(ev.orders)}|${JSON.stringify(ev.merchant)}|${ev.fair?.id}`;
    if (sig === this.sig) return;
    this.sig = sig;
    this.root.hidden = n === 0;
    if (n === 0) return;
    this.root.classList.toggle('is-folded', !open);
    this.head.setAttribute('aria-expanded', String(open));
    this.head.setAttribute('aria-label', open ? t('events.card.fold') : t('events.card.unfold', { n }));
    this.count.textContent = fmtInt(n);
    this.body.hidden = !open;
    if (!open) { this.shown = ''; return; }

    const items: string[] = [];
    if (ev.fair && fairOn !== 'none') {
      const g = ev.fair.good;
      const text = t(fairOn === 'active' ? 'events.fair.active' : 'events.fair.upcoming', { good: goodAcc(g) });
      items.push(`<li class="ev-item ev-fair${fairOn === 'active' ? ' is-on' : ''}">
        <span class="ev-gi">${iconSvg(g, 22, goodName(g))}</span><span class="ev-txt" dir="auto">${esc(text)}</span></li>`);
    }
    for (const o of ev.orders) items.push(o.id === focus ? this.orderHtml(o) : orderRow(o));
    if (ev.merchant) {
      const m = ev.merchant;
      if (m.id !== focus) {
        items.push(rowHtml(m.id, `<span class="ev-gi">${iconSvg(m.good, 20, goodName(m.good))}</span>`, t('events.merchant.title'),
          `<bdi class="num ev-rv">${iconSvg('coin', 16)}${esc(fmtDec(m.unitCents / 100))}</bdi>`, 'ev-merchant'));
      } else {
        const offer = t('events.merchant.offer', { good: goodName(m.good), qty: fmtInt(m.quantity), price: fmtDec(m.unitCents / 100) });
        const sell = surplus > 0
          ? `<button class="btn primary cf ev-btn" data-ev="sell|${esc(m.id)}">${iconSvg('coin', 22)}<span>${esc(t('events.merchant.sell', { n: fmtInt(surplus) }))}</span></button>`
          : `<span class="ev-note">${esc(t('events.merchant.none'))}</span>`;
        items.push(`<li class="ev-item ev-merchant is-focus">
          <div class="ev-oh"><span class="ev-gi">${iconSvg(m.good, 20, goodName(m.good))}</span><span class="ev-t" dir="auto">${esc(t('events.merchant.title'))}</span></div>
          <div class="ev-txt" dir="auto">${esc(offer)}</div>
          <div class="ev-acts">${sell}<button class="btn ev-btn ev-later" data-ev="mdecline|${esc(m.id)}">${esc(t('events.merchant.dismiss'))}</button></div></li>`);
      }
    }
    setHtml(this.body, items.join(''));
    // the item shown in full (its actions) inside the list's visible part when the card opens or another
    // item opens: in landscape the list is short and an item lower down otherwise opens below the fold (D-136)
    const shown = `${focus}`;
    if (shown !== this.shown) {
      this.shown = shown;
      this.revealFocus();
    }
  }

  private revealFocus(): void {
    const li = this.body.querySelector<HTMLElement>(':scope > .ev-item.is-focus');
    if (!li || this.body.scrollHeight <= this.body.clientHeight) return;
    const lr = li.getBoundingClientRect(), br = this.body.getBoundingClientRect();
    // the bottom (the action buttons) first; the title may then sit above the fold of a very short list
    if (lr.bottom > br.bottom) this.body.scrollTop += lr.bottom - br.bottom;
    else if (lr.top < br.top) this.body.scrollTop -= br.top - lr.top;
  }

  /** The one item shown in full: the row the player opened, else the oldest accepted order (it takes the
   *  deliveries first), else the newest order, else the merchant. */
  private focusId(ev: ValleyEventState): string | null {
    const ids = ev.orders.map((o) => o.id);
    if (ev.merchant) ids.push(ev.merchant.id);
    if (this.pick && ids.includes(this.pick)) return this.pick;
    this.pick = null;
    const acc = ev.orders.find((o) => o.accepted);
    return acc?.id ?? ev.orders[ev.orders.length - 1]?.id ?? ev.merchant?.id ?? null;
  }

  private orderHtml(o: RoyalOrder): string {
    const goods = orderGoods(o).map((g) => {
      const need = o.need[g] ?? 0, have = Math.min(need, o.delivered[g] ?? 0);
      const label = t('events.order.progress', { delivered: fmtInt(have), required: fmtInt(need), good: goodName(g) });
      return `<li class="${have >= need ? 'is-met' : ''}" aria-label="${esc(label)}"><span class="ev-gi">${iconSvg(g, 20, goodName(g))}</span>
        <bdi class="num ev-v">${fmtInt(have)}<small>/${fmtInt(need)}</small></bdi>${kbar(have / Math.max(1, need))}</li>`;
    }).join('');
    const later = `<button class="btn ev-btn ev-later" data-ev="decline|${esc(o.id)}">${esc(t('events.order.dismiss'))}</button>`;
    const reward = `<div class="ev-rw">${iconSvg('coin', 16)}<span>${esc(t('events.order.reward', { silver: fmtInt(o.rewardSilver), renown: fmtInt(o.rewardRenown) }))}</span>${
      o.accepted ? `<b class="ev-tag">${esc(t('events.order.accepted'))}</b>` : ''}</div>`;
    const tail = o.accepted
      ? `<div class="ev-ob"><ul class="ev-goods">${goods}</ul>${later}</div>`
      : `<ul class="ev-goods">${goods}</ul><div class="ev-acts"><button class="btn primary cf ev-btn" data-ev="accept|${esc(o.id)}">${iconSvg('seal', 20)}<span>${esc(t('events.order.accept'))}</span></button>${later}</div>`;
    // the castle's request in a sentence (docs/content/events.md) while it is an offer to weigh; once
    // accepted the item is about deliveries and stays short
    const desc = o.accepted ? '' : `<div class="ev-txt ev-desc" dir="auto">${esc(t(`events.order.d.${o.templateId}` as MessageKey))}</div>`;
    return `<li class="ev-item ev-order is-focus${o.accepted ? ' is-on' : ''}">
      <div class="ev-oh"><span class="ev-seal">${iconSvg('seal', 18)}</span><span class="ev-t" dir="auto">${esc(orderTitle(o))}</span></div>
      ${desc}${reward}${tail}</li>`;
  }

  /** One toast per new event or fulfilled order; nothing on load, a new game or a language change. */
  private notify(world: World, ev: ValleyEventState): void {
    const ids = eventIds(ev, world.state.tick);
    if (this.world !== world) {
      this.world = world;
      this.seen = new Set(ids);
      this.prevOrders = ev.orders;
      this.prevDone = ev.ordersDone;
      return;
    }
    if (ev.ordersDone > this.prevDone) {
      const done = this.prevOrders.find((o) => o.accepted && !ev.orders.some((q) => q.id === o.id));
      if (done) this.act.toast(t('events.order.done', { silver: fmtInt(done.rewardSilver), renown: fmtInt(done.rewardRenown) }), 'seal');
    }
    this.prevDone = ev.ordersDone;
    this.prevOrders = ev.orders;
    const fresh = ids.filter((id) => !this.seen.has(id));
    if (!fresh.length) return;
    for (const id of fresh) this.seen.add(id);
    if (!this.open || this.hudFolded) this.flash();
    const id = fresh[0]!;
    const order = ev.orders.find((o) => o.id === id);
    if (order) this.act.toast(t('events.order.new', { title: orderTitle(order) }), 'seal');
    else if (ev.merchant?.id === id) this.act.toast(t(merchantLine(id), { good: goodAcc(ev.merchant.good) }), ev.merchant.good);
    else if (ev.fair) this.act.toast(t('events.fair.upcoming', { good: goodAcc(ev.fair.good) }), ev.fair.good);
  }

  /** Light the folded header once (CSS one-shot); restarting it for a second event does not stack. */
  private flash(): void {
    this.root.classList.remove('is-fresh');
    void this.root.offsetWidth;
    this.root.classList.add('is-fresh');
  }
}
