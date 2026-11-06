// Mission I tutorial, "the castellan's letter" (docs/tutorial/m1.md): at most six notes on a scrap
// of parchment, one at a time, each ended by something the player does (never "Next"). Driven
// from outside the sim: it reads the live World, the top sheet key, the active tool and the
// subjects the player opens; it never pauses or blocks taps, and moves the camera only once, to bring
// step 5's crossing on screen when it is not. Only the "Skip" button takes pointer events. Targets are marked with an engraved double rule and a woodcut
// arrow drawn in a separate layer, positioned from getBoundingClientRect every frame (the
// waybill and the sheets rebuild their DOM several times a second, so nothing is anchored to
// a node).
import { findPath, type World } from '../sim/index';
import { getLang, t, type MessageKey } from '../i18n/index';
import { deckle, h } from './dom';
import type { Tool } from './hud';
import { HINGE_GUTTER } from './layout';
import { crossingSpan } from './tutorialCrossing';

export type TutorialResult = 'skipped' | 'done';

export interface TutorialHost {
  readonly world: World;
  /** Key of the top sheet ('building:8', 'wagon:9', 'gamemenu', ...) or null. */
  topKey(): string | null;
  tool(): Tool;
  closeSheets(): void;
  /** Ghost road on the map (step 5), null clears it. */
  setGhost(cells: number[] | null): void;
  /** Screen position of a cell (CSS px), null when the view cannot project. */
  cellScreen(cell: number): { x: number; y: number; visible: boolean } | null;
  /** Glide the camera so these cells are in the free part of the map, unless they already are. */
  showCells(cells: number[]): void;
  /** Persist the outcome; the host drops the tutorial afterwards. */
  finish(r: TutorialResult): void;
}

type Step = number;
interface Subject { kind: 'building' | 'wagon'; id: number }
type Dir = 'up' | 'down' | 'left' | 'right';
export interface Box { x: number; y: number; w: number; h: number }

/** Hard limit of active time from the first note (m1.md rule 3). */
const MAX_ACTIVE_MS = 110_000;
/** Step 2: how long to wait (non-blocking) for the castle to show a cause chain before moving on. */
const CHAIN_WAIT_MS = 5000;
/** Step 3: a chain link must appear this soon after the card opened, else the step is skipped. */
const LINK_WAIT_MS = 900;
/** Step 4 in portrait: the card covers the tool rail; let the player read it, then fold it away. */
const CLOSE_SHEET_DELAY_MS = 2000;
/** After the last tap: outline the current reason briefly, then end. */
const CODA_MS = 2600;
const NOTE_MAX_W = 340;
const NOTE_MIN_W = 220;
const ARROW_LEN = 62;

const keyOf = (s: Subject): string => `${s.kind}:${s.id}`;

function boxOf(r: DOMRect): Box {
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}
function grow(b: Box, d: number): Box {
  return { x: b.x - d, y: b.y - d, w: b.w + 2 * d, h: b.h + 2 * d };
}
function hits(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
/** A box clipped to the viewport (the ring's outer rule stays fully visible next to a screen edge). */
function onScreen(b: Box): Box {
  const vw = window.innerWidth, vh = window.innerHeight;
  const x0 = Math.max(0, b.x), y0 = Math.max(0, b.y);
  const x1 = Math.min(vw, b.x + b.w), y1 = Math.min(vh, b.y + b.h);
  return x1 - x0 > 24 && y1 - y0 > 24 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : b;
}
export function union(bs: Box[]): Box | null {
  if (!bs.length) return null;
  const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y));
  const x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/** A box grown on every side (the build ghost's gate pin stands for the footprint around it), or null. */
function grownOrNull(b: Box | null, d: number): Box | null {
  return b ? grow(b, d) : null;
}
export function visibleBox(el: Element | null): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? boxOf(r) : null;
}

/** An engraved double rule around a box: an uneven outer line and a fine inner one (deterministic jitter). */
/** Half-opened book posture (vertical hinge): the crease and its gutter, where the note or the arrow would fold. */
function bookCrease(): Box | null {
  if (!document.body.classList.contains('is-book')) return null;
  const cs = getComputedStyle(document.documentElement);
  const a = parseFloat(cs.getPropertyValue('--book-start')), b = parseFloat(cs.getPropertyValue('--book-end'));
  if (!(b > a)) return null;
  return { x: a - HINGE_GUTTER, y: 0, w: b - a + 2 * HINGE_GUTTER, h: window.innerHeight };
}

function ringSvg(w: number, h: number): string {
  let seed = (Math.round(w) * 73856093) ^ (Math.round(h) * 19349663);
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff - 0.5;
  };
  const rough = (inset: number, j: number): string => {
    const pts: [number, number][] = [];
    const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
    const seg = (ax: number, ay: number, bx: number, by: number): void => {
      const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 26));
      for (let i = 0; i < n; i++) {
        const f = i / n;
        pts.push([ax + (bx - ax) * f + rnd() * j, ay + (by - ay) * f + rnd() * j]);
      }
    };
    // chamfered corners, like the rest of the kit
    const c = 5;
    seg(x0 + c, y0, x1 - c, y0); seg(x1 - c, y0, x1, y0 + c);
    seg(x1, y0 + c, x1, y1 - c); seg(x1, y1 - c, x1 - c, y1);
    seg(x1 - c, y1, x0 + c, y1); seg(x0 + c, y1, x0, y1 - c);
    seg(x0, y1 - c, x0, y0 + c); seg(x0, y0 + c, x0 + c, y0);
    return 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z';
  };
  const outer = rough(2.5, 1.4), inner = rough(6.5, 0.8);
  return `<svg width="${w.toFixed(0)}" height="${h.toFixed(0)}" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" aria-hidden="true">
    <path class="halo" d="${outer}"/><path class="halo thin" d="${inner}"/>
    <path class="ink" d="${outer}"/><path class="ink thin" d="${inner}"/></svg>`;
}

/** Woodcut arrow pointing right (tip at x=64, y=12): barbed head, shaft, two fletchings, cut hatching. */
const ARROW_SVG = `<svg width="64" height="24" viewBox="0 0 64 24" aria-hidden="true">
  <g class="body">
    <path d="M1 3.2L11.5 3.6L17.6 10.4L7.4 10.6Z M1 20.8L11.5 20.4L17.6 13.6L7.4 13.4Z"/>
    <path d="M9 10.7L47.5 10.4L47.6 13.7L9 13.3Z"/>
    <path d="M45 3.4L63.6 12L45 20.6L49.6 12Z"/>
  </g>
  <g class="cut"><path d="M4.4 4.6L8.8 9.4M7.6 4.8L12 9.6M4.4 19.4L8.8 14.6M7.6 19.2L12 14.4M50.4 8.6L55 11M50.4 15.4L55 13M53.6 7.7L57.4 9.6M53.6 16.3L57.4 14.4"/></g>
</svg>`;

export class Tutorial {
  readonly root: HTMLElement;
  protected noteWrap: HTMLElement;
  protected noteFrom: HTMLElement;
  protected noteText: HTMLElement;
  protected skipBtn: HTMLButtonElement;
  protected actBtn: HTMLButtonElement;
  protected ring: HTMLElement;
  protected arrow: HTMLElement;
  protected step: Step = 1;
  protected stepAt = 0;
  protected active = 0;
  protected ended = false;
  protected subject: Subject | null = null;
  protected closeAt = -1;
  protected codaUntil = -1;
  protected conn = { ver: -1, n: -1, ok: false };
  protected ghost: { ver: number; cells: number[] | null } = { ver: -1, cells: null };
  protected textSig = '';
  protected ringSig = '';
  protected arrowSig = '';
  protected placeAt = 0;
  /** Step 5's crossing has been brought on screen (once per entry). */
  protected framed = false;
  /** Steps 2-3: the chain link has been scrolled into its card's view (once per entry). */
  protected scrolled = false;
  protected notePlaced: Box | null = null;

  constructor(protected host: TutorialHost) {
    this.noteFrom = h('span.tut-from', { dir: 'auto' });
    // dir=auto: a key still missing in this language falls back to English and must keep its own direction
    this.noteText = h('p.tut-text', { 'aria-live': 'polite', dir: 'auto' });
    this.skipBtn = h('button.tut-skip', { type: 'button' });
    this.skipBtn.addEventListener('click', () => this.end('skipped'));
    // an optional action under the text (the build tutorial's "Show me"); hidden in mission I
    this.actBtn = h('button.btn.cf.tut-act', { type: 'button' });
    this.actBtn.hidden = true;
    this.actBtn.addEventListener('click', () => this.onAct());
    const note = h('div.tut-note', null,
      h('div.tut-head', null, h('i.tut-seal.kseal.on', { 'aria-hidden': 'true' }), this.noteFrom, this.skipBtn),
      this.noteText, this.actBtn);
    note.style.clipPath = deckle('bottom', 4127, 5, 22);
    this.noteWrap = h('div.tut-note-wrap', { role: 'note' }, note);
    this.ring = h('div.tut-ring');
    this.arrow = h('div.tut-arrow', null, h('div.ta-in', { html: ARROW_SVG }));
    this.root = h('div.tutorial', null, this.ring, this.arrow, this.noteWrap);
  }

  get current(): Step {
    return this.step;
  }

  /** The player opened a subject's card (waybill, chain link, bubble, map tap). prevTop: sheet key before it. */
  onOpen(kind: 'building' | 'wagon', id: number, prevTop: string | null): void {
    if (this.ended) return;
    const k = `${kind}:${id}`;
    const castle = this.castleKey();
    if (this.step === 1 && k === castle) this.go(2);
    else if (this.step === 2 && prevTop === castle && k !== castle) { this.subject = { kind, id }; this.go(3); }
    else if (this.step === 3 && this.subject && prevTop === keyOf(this.subject) && k !== prevTop) this.afterChain(true);
    else if (this.step === 6 && k === castle && this.codaUntil < 0) this.codaUntil = this.active + CODA_MS;
  }

  /** Remove without recording an outcome (leaving the game, a new world). */
  dispose(): void {
    if (this.ended) return;
    this.ended = true;
    this.host.setGhost(null);
    this.root.remove();
  }

  end(r: TutorialResult): void {
    if (this.ended) return;
    this.dispose();
    this.host.finish(r);
  }

  update(dtMs: number): void {
    if (this.ended) return;
    const top = this.host.topKey();
    if (this.pausedNow(top)) return;
    this.active += dtMs;
    const world = this.host.world;
    if (this.active > MAX_ACTIVE_MS || world.state.mission.result !== 'running') { this.end('done'); return; }
    if (this.codaUntil >= 0 && this.active >= this.codaUntil) { this.end('done'); return; }

    const tool = this.host.tool();
    const connected = this.connected();
    const castle = this.castleKey();
    const since = this.active - this.stepAt;
    if ((this.step === 4 || this.step === 5) && connected) this.go(6);
    if (this.step === 2 && top === castle && !this.chainLink() && since > CHAIN_WAIT_MS) this.afterChain(false);
    if (this.step === 3) {
      const subj = this.subject;
      if (!subj || top !== keyOf(subj) || (!this.chainLink() && since > LINK_WAIT_MS)) this.afterChain(false);
    }
    if (this.step === 4) {
      if (tool === 'road') {
        this.go(5);
        // the crossing needs the map: a card still open from step 3 (docked beside the map in landscape) closes,
        // so the note gets a free band clear of the rail (first-10-minutes-b, item 2)
        if (top) this.host.closeSheets();
      } else if (this.closeAt >= 0 && performance.now() >= this.closeAt) {
        this.closeAt = -1;
        // only if the card actually hides the Track button (portrait); docked side sheets stay
        if (this.covered(document.querySelector('.rail [data-tool="road"]'))) this.host.closeSheets();
      }
    }
    if (this.step === 5 && tool !== 'road' && tool !== 'cobble') this.go(4);

    const ghost = this.step === 5 ? this.crossing() : null;
    this.host.setGhost(ghost);
    // the one camera move of the tutorial: the card of step 3 may have glided the map away from the river
    if (ghost && !this.framed) { this.framed = true; this.host.showCells(ghost); }
    this.render();
  }

  // ---------------------------------------------------------------- hooks (the build tutorial overrides them)

  /** The note's sender, skip label, text and optional action button of the current step. */
  protected noteKeys(): { from: MessageKey; skip: MessageKey; text: MessageKey; act?: MessageKey } {
    return { from: 'tutorial.m1.from', skip: 'tutorial.m1.skip', text: `tutorial.m1.step${this.step}` as MessageKey };
  }
  /** The note's action button was pressed. */
  protected onAct(): void { /* mission I has none */ }
  /** Bring a target hidden inside a card into view (once per step). */
  protected scrollsToTarget(): boolean { return this.step === 2 || this.step === 3; }
  /** The tool rail must stay in reach (the note avoids it harder). */
  protected railNeeded(): boolean { return this.step === 5; }
  /** The game menu, settings, a cleared screen or a hidden page pause the tutorial (its clock and checks). */
  protected pausedNow(top: string | null): boolean {
    const paused = document.visibilityState !== 'visible' || top === 'gamemenu' || top === 'settings' || top === 'help' || document.body.classList.contains('is-clear');
    this.root.classList.toggle('is-paused', paused);
    return paused;
  }

  // ---------------------------------------------------------------- state

  protected go(s: Step): void {
    this.step = s;
    this.stepAt = this.active;
    this.ringSig = this.arrowSig = '';
    this.placeAt = 0;
    this.framed = false;
    this.scrolled = false;
  }

  /** Steps 2/3 done (or no longer applicable): the road hint, or straight to the re-check when a crossing exists. */
  protected afterChain(fromTap: boolean): void {
    if (this.connected()) { this.go(6); return; }
    this.go(4);
    this.closeAt = performance.now() + (fromTap ? CLOSE_SHEET_DELAY_MS : 0);
  }

  protected castleKey(): string {
    const c = this.host.world.state.mission.contract;
    return c ? `building:${c.castle}` : '';
  }

  protected ends(): { saw: number; castle: number } | null {
    const st = this.host.world.state;
    const saw = st.buildings.find((b) => b.type === 'sawmill');
    const castle = st.mission.contract ? st.buildings.find((b) => b.id === st.mission.contract!.castle) : null;
    return saw && castle ? { saw: saw.gate, castle: castle.gate } : null;
  }

  /** Sawmill gate and castle gate joined by passable road (re-checked when the network changes). */
  protected connected(): boolean {
    const st = this.host.world.state;
    if (this.conn.ver !== st.netVersion || this.conn.n !== st.buildings.length) {
      const e = this.ends();
      this.conn = { ver: st.netVersion, n: st.buildings.length, ok: !!e && findPath(this.host.world, e.saw, e.castle, false) !== null };
    }
    return this.conn.ok;
  }

  /** Step 5's ghost line: only the part to draw (new cells, one road cell at each end), an example
   *  crossing, not the only accepted one. The full sawmill-castle route ran off a phone screen. */
  protected crossing(): number[] | null {
    const st = this.host.world.state;
    if (this.ghost.ver !== st.netVersion) this.ghost = { ver: st.netVersion, cells: crossingSpan(this.host.world) };
    return this.ghost.cells;
  }

  /** Screen box of the ghost crossing (step 5): the note must not lie on the line to drag. */
  protected ghostBox(): Box | null {
    if (this.step !== 5) return null;
    const cells = this.crossing();
    if (!cells) return null;
    const pts = cells.map((c) => this.host.cellScreen(c)).filter((p): p is { x: number; y: number; visible: boolean } => !!p && p.visible);
    return union(pts.map((p) => ({ x: p.x - 18, y: p.y - 18, w: 36, h: 36 })));
  }

  // ---------------------------------------------------------------- targets

  protected chainLink(): HTMLElement | null {
    // a short landscape sheet folds the middle links behind "+N" (D-111): the first link drawn is the root
    return [...document.querySelectorAll<HTMLElement>('#sheets .sheet:last-child .chain button[data-go]:not([disabled])')]
      .find((b) => b.getClientRects().length > 0) ?? null;
  }

  protected waybillTarget(): { box: Box | null; probe: Element | null } {
    const wrap = document.querySelector('.waybill-wrap');
    if (!wrap || (wrap as HTMLElement).hidden) return { box: null, probe: null };
    if (wrap.classList.contains('is-collapsed')) {
      const seal = wrap.querySelector('.seal-only');
      return { box: visibleBox(seal), probe: seal };
    }
    const lines = [...wrap.querySelectorAll('.wb-line')];
    return { box: union(lines.map(visibleBox).filter((b): b is Box => !!b)), probe: lines[0] ?? null };
  }

  /** The element is drawn under something else at its centre (e.g. the rail under a bottom sheet). */
  protected covered(el: Element | null): boolean {
    if (!el) return true;
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return true;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !hit || !(el === hit || el.contains(hit) || hit.closest('.tutorial'));
  }

  protected target(): { box: Box | null; probe: Element | null } {
    if (this.codaUntil >= 0) {
      const el = document.querySelector('#sheets .sheet:last-child .status-line, #sheets .sheet:last-child .chain');
      return { box: visibleBox(el), probe: el };
    }
    switch (this.step) {
      case 1:
      case 6:
        return this.waybillTarget();
      case 2: {
        if (this.host.topKey() !== this.castleKey()) return this.waybillTarget();
        const l = this.chainLink();
        return { box: visibleBox(l), probe: l };
      }
      case 3: {
        const l = this.chainLink();
        return { box: visibleBox(l), probe: l };
      }
      case 4: {
        const b = document.querySelector('.rail [data-tool="road"]');
        return { box: visibleBox(b), probe: b };
      }
      default:
        return { box: null, probe: null };
    }
  }

  // ---------------------------------------------------------------- drawing

  protected render(): void {
    const coda = this.codaUntil >= 0;
    const sig = `${getLang()}|${this.step}|${coda}`;
    if (sig !== this.textSig) {
      this.textSig = sig;
      const k = this.noteKeys();
      this.noteFrom.textContent = t(k.from);
      this.skipBtn.textContent = t(k.skip);
      this.noteText.textContent = t(k.text);
      this.actBtn.hidden = !k.act;
      if (k.act) this.actBtn.textContent = t(k.act);
      this.noteWrap.classList.toggle('is-gone', coda);
      this.noteWrap.classList.remove('is-new');
      void this.noteWrap.offsetWidth;
      this.noteWrap.classList.add('is-new');
    }

    const tg = this.target();
    // a chain link below the fold of a short card (landscape, 412 px): bring it into view once per step,
    // else no ring is drawn and the note asks for something the player cannot see
    if (!this.scrolled && this.scrollsToTarget() && tg.probe instanceof HTMLElement && tg.probe.closest('#sheets') && this.covered(tg.probe)) {
      this.scrolled = true;
      tg.probe.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    // 9 px: the inner rule and its halo end 8.4 px in from the ring's edge, so text flush with the target's
    // edge (the waybill counts in landscape) stays clear of them
    // kept on screen: the rail's first tool sits ~8 px from the edge, and the ring around it was cut (ringOff)
    // a target on the map (the build tutorial's hut and gate) has no element to probe: drawn as is
    const box = tg.box && (tg.probe === null || !this.covered(tg.probe)) ? onScreen(grow(tg.box, 9)) : null;
    // inside a card the double rule is enough: an arrow there would lie across the neighbouring links
    const inSheet = !!tg.probe?.closest('#sheets');
    const now = performance.now();
    if (now - this.placeAt > 150) { this.placeAt = now; this.placeNote(box); }

    // ring
    this.ring.classList.toggle('is-shown', !!box);
    if (box) {
      const rs = `${this.step}|${Math.round(box.w)}x${Math.round(box.h)}`;
      if (rs !== this.ringSig) {
        const fresh = this.ringSig.split('|')[0] !== String(this.step);
        this.ringSig = rs;
        this.ring.innerHTML = ringSvg(box.w, box.h);
        if (fresh) { this.ring.classList.remove('is-new'); void this.ring.offsetWidth; this.ring.classList.add('is-new'); }
      }
      this.ring.style.transform = `translate3d(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px, 0)`;
    }

    // arrow: on the free side of the target that does not cross the note
    const dir = box && !inSheet ? this.arrowDir(box) : null;
    this.arrow.classList.toggle('is-shown', !!dir);
    if (box && dir) {
      const gap = 6;
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      const tip = dir === 'down' ? [cx, box.y - gap] : dir === 'up' ? [cx, box.y + box.h + gap]
        : dir === 'right' ? [box.x - gap, cy] : [box.x + box.w + gap, cy];
      const ang = dir === 'right' ? 0 : dir === 'down' ? 90 : dir === 'left' ? 180 : -90;
      this.arrow.style.transform = `translate3d(${(tip[0]! - 64).toFixed(1)}px, ${(tip[1]! - 12).toFixed(1)}px, 0) rotate(${ang}deg)`;
      const as = `${this.step}|${dir}`;
      if (as !== this.arrowSig) {
        this.arrowSig = as;
        this.arrow.classList.remove('is-new'); void this.arrow.offsetWidth; this.arrow.classList.add('is-new');
      }
    }
  }

  protected arrowDir(box: Box): Dir | null {
    const vw = window.innerWidth, vh = window.innerHeight;
    const L = ARROW_LEN + 8;
    const cand: { d: Dir; room: number; b: Box }[] = [
      { d: 'down', room: box.y, b: { x: box.x + box.w / 2 - 12, y: box.y - L, w: 24, h: L } },
      { d: 'up', room: vh - box.y - box.h, b: { x: box.x + box.w / 2 - 12, y: box.y + box.h, w: 24, h: L } },
      { d: 'right', room: box.x, b: { x: box.x - L, y: box.y + box.h / 2 - 12, w: L, h: 24 } },
      { d: 'left', room: vw - box.x - box.w, b: { x: box.x + box.w, y: box.y + box.h / 2 - 12, w: L, h: 24 } },
    ];
    // horizontal arrows read better beside short targets (waybill lines, chain links)
    cand.sort((a, b) => (b.room + (b.d === 'left' || b.d === 'right' ? 40 : 0)) - (a.room + (a.d === 'left' || a.d === 'right' ? 40 : 0)));
    const note = this.notePlaced;
    // never across other controls (coins, speed, neighbouring tools) or the open card
    // (the waybill's ribbon and seal row too: in Flex the rows have the most room above, through the title)
    const blockers = [...document.querySelectorAll('.gate-pin:not([hidden]), .build-shelf:not([hidden]), .topbar .chip, .topbar .speed, .topbar .menu-btn, .rail .tool, .stall-row, #sheets .sheet, .waybill-wrap, .waybill .ribbon, .waybill .wb-head')]
      .map(visibleBox).filter((b): b is Box => !!b && !hits(grow(box, -8), b));
    const crease = bookCrease();
    if (crease) blockers.push(crease);
    for (const c of cand) {
      if (c.room < L + 4) continue;
      if (note && hits(grow(note, 4), c.b)) continue;
      if (blockers.some((o) => hits(o, c.b))) continue;
      return c.d;
    }
    return null;
  }

  /** Put the note where it hides nothing the player needs: the widest free stretch of the top band,
   *  else under the waybill, else just above the sheet / rail. */
  protected placeNote(target: Box | null): void {
    const vw = window.innerWidth, vh = window.innerHeight;
    const q = (s: string): Box | null => visibleBox(document.querySelector(s));
    const waybill = q('.waybill-wrap:not([hidden])');
    const sheet = q('#sheets .sheet:last-child');
    const ghost = this.ghostBox();
    const obstacles = [waybill, sheet, bookCrease(), q('.notice-wrap'), q('.ev-card'), q('.seal-tempo'), q('.build-shelf:not([hidden])'), grownOrNull(q('.gate-pin:not([hidden])'), 34), q('.rail-tools'), q('.stall-row:not([hidden])'), q('.topbar .chips'), q('.topbar .speed'), q('.topbar .menu-btn'), q('.topbar .rail-hint'), target ? grow(target, 6) : null,
      this.arrowBoxGuess(target), ghost].filter((b): b is Box => !!b);
    const y0 = waybill ? waybill.y : 12;
    // one layout read per width per placement: the free-slot scan below asks for the same widths often
    const heights = new Map<number, number>();
    const measure = (w: number): number => {
      const k = Math.round(w);
      const known = heights.get(k);
      if (known !== undefined) return known;
      this.noteWrap.style.width = `${k}px`;
      const h = this.noteWrap.offsetHeight || 120;
      heights.set(k, h);
      return h;
    };
    const tryBand = (y: number): Box | null => {
      const hh = measure(NOTE_MAX_W);
      const band = { x: 0, y, w: vw, h: hh };
      const blocks = obstacles.filter((o) => hits(o, band)).map((o) => [o.x, o.x + o.w] as [number, number]).sort((a, b) => a[0] - b[0]);
      let best: [number, number] = [0, 0];
      let x = 10;
      for (const [a, b] of [...blocks, [vw - 10, vw] as [number, number]]) {
        if (a - 10 - x > best[1] - best[0]) best = [x, a - 10];
        x = Math.max(x, b + 10);
      }
      const w = Math.min(NOTE_MAX_W, best[1] - best[0]);
      if (w < NOTE_MIN_W) return null;
      const realH = measure(w);
      if (y + realH > vh - 8) return null;
      const box = { x: best[0], y, w, h: realH };
      return obstacles.some((o) => hits(o, box)) ? null : box;
    };
    let placed = tryBand(y0);
    if (!placed && waybill) placed = tryBand(waybill.y + waybill.h + 10);
    if (!placed && target) placed = tryBand(target.y + target.h + ARROW_LEN + 14);
    if (!placed && ghost) placed = tryBand(ghost.y + ghost.h + 10) ?? tryBand(ghost.y - measure(NOTE_MAX_W) - 10);
    // any free slot lower down (landscape 915x412, step 5: the bands above all cross the waybill, the clock
    // or the crossing, and the old fallback laid the note on the tool rail the step needs — day 7)
    for (let y = y0 + 12; !placed && y + measure(NOTE_MAX_W) <= vh - 8; y += 12) placed = tryBand(y);
    if (!placed) {
      // no free band: the full-width slot that hides least, the target and the waybill (the player's
      // own list, the target of steps 1 and 6) weighing most; never the old "top of the waybill" default
      const floor = Math.min(sheet ? sheet.y : vh, q('.rail')?.y ?? vh);
      const w = Math.min(NOTE_MAX_W, vw - 20);
      const hh = measure(w);
      // the rail weighs as much as the crossing in step 5: the step needs "Droga" in reach
      // the open card's head (title and close button) weighs as much: covering it leaves a card nobody can shut
      const weigh: [Box | null, number][] = [[target, 20], [waybill, 6], [ghost, 6], [sheet, 1], [q('#sheets .sheet:last-child .sheet-head'), 6],
        [q('.rail-tools'), this.railNeeded() ? 6 : 2], [q('.stall-row:not([hidden])'), 1],
        // the build tutorial: the placement bar (Postaw) and the ghost's gate pin
        [q('.build-shelf:not([hidden])'), 20], [q('.seal-tempo'), 4], [grownOrNull(q('.gate-pin:not([hidden])'), 20), 6]];
      const cost = (x: number, y: number): number => weigh.reduce((sum, [b, k]) => {
        if (!b) return sum;
        const ix = Math.min(b.x + b.w, x + w) - Math.max(b.x, x), iy = Math.min(b.y + b.h, y + hh) - Math.max(b.y, y);
        return sum + (ix > 0 && iy > 0 ? ix * iy * k : 0);
      }, 0);
      const shelf = q('.build-shelf:not([hidden])');
      const ys = [y0, waybill ? waybill.y + waybill.h + 10 : 12, floor - hh - 12, vh - hh - 8, ...(shelf ? [shelf.y - hh - 10] : [])]
        .map((y) => Math.max(8, Math.min(vh - hh - 8, y)));
      // both sides: in landscape the right half is often clearer than the rail's corner
      const xs = [10, Math.max(10, vw - w - 10)];
      let best = { x: xs[0]!, y: ys[0]!, c: Infinity };
      for (const x of xs) for (const y of ys) { const c = cost(x, y); if (c < best.c) best = { x, y, c }; }
      placed = { x: best.x, y: best.y, w, h: hh };
    }
    this.notePlaced = placed;
    this.noteWrap.style.width = `${placed.w}px`;
    this.noteWrap.style.transform = `translate3d(${placed.x.toFixed(0)}px, ${placed.y.toFixed(0)}px, 0)`;
  }

  /** Space the arrow will most likely take (below a top target / above a bottom one). */
  protected arrowBoxGuess(target: Box | null): Box | null {
    if (!target) return null;
    const vh = window.innerHeight;
    const cy = target.y + target.h / 2;
    if (target.w > window.innerWidth * 0.6 || target.x + target.w > window.innerWidth - ARROW_LEN - 20) {
      return cy > vh / 2 ? { x: target.x, y: target.y - ARROW_LEN - 10, w: target.w, h: ARROW_LEN + 10 }
        : { x: target.x, y: target.y + target.h, w: target.w, h: ARROW_LEN + 10 };
    }
    return { x: target.x + target.w, y: target.y + target.h / 2 - 14, w: ARROW_LEN + 12, h: 28 };
  }
}
