// Build tool (docs/design/sandbox.md §2): a shelf of building cards, then a placement ghost that
// follows one finger ~72 dp above it, snapped to cells, validated with the sim's pure
// validatePlace every frame; a rotate-gate button and cost/error text float beside the ghost,
// "Postaw" sits in the thumb zone. Two fingers still move the camera (input.ts multi mode).
// The ghost footprint is drawn by the view's cell preview (setRoadPreview); the gate pin and the
// labels are DOM, placed by locating cells on screen with view.cellAt (no render change needed).
import {
  BUILDINGS, canPlace, gateCell, lastUndoable, net, unlockRank, validatePlace,
  type BuildingType, type Command, type CommandError, type CommandResult, type World,
  missionBuildable,
} from '../sim/index';
import type { WorldView } from '../render/api';
import { t, type MessageKey } from '../i18n/index';
import { esc, h, setHtml } from './dom';
import { bdi, fmtInt, rankName, tHtml } from './format';
import { iconSvg, type IconId } from './icons';
import { errorText } from './roadTool';

/** How far above the finger the ghost's centre sits while dragging (CSS px ≈ dp). */
export const GHOST_LIFT = 72;

/** Building types the player may place in this world; empty = no build tool. */
export function buildTypes(world: World): BuildingType[] {
  const allowed = missionBuildable(world.state.mission.id);
  if (allowed === 'ranked') {
    const all = (Object.keys(BUILDINGS) as BuildingType[]).filter((b) => unlockRank(b) >= 0);
    // shelf order: what is open now first, then by the rank that unlocks it (stable sort keeps chain order)
    return all.sort((a, b) => unlockRank(a) - unlockRank(b));
  }
  return allowed;
}

export interface BuildHost {
  view(): WorldView;
  world(): World;
  enqueue(cmd: Command): void;
  toast(text: string, kind: 'info' | 'err', icon: IconId | null): void;
  /** Leave the build tool (shelf "close"). */
  close(): void;
  /** Area of the scene not covered by HUD, for the first ghost position. */
  sceneCentre(): [number, number];
}

interface Located { x: number; y: number; px: number }

/**
 * Screen point (CSS px) of the centre of a map cell, found by inverting view.cellAt: a few Newton
 * steps on a finite-difference Jacobian, then the mean of samples that land in the cell.
 * px = approximate cell size on screen. null when the cell is off screen.
 */
export function locateCell(view: WorldView, W: number, cell: number, guess: [number, number]): Located | null {
  const tx = (cell % W) + 0.5, ty = Math.floor(cell / W) + 0.5;
  const at = (x: number, y: number): [number, number] | null => {
    const c = view.cellAt(x, y);
    return c < 0 ? null : [(c % W) + 0.5, Math.floor(c / W) + 0.5];
  };
  let [sx, sy] = guess;
  let px = 20;
  const D = 48;
  for (let it = 0; it < 7; it++) {
    const p = at(sx, sy);
    if (!p) return null;
    if (p[0] === tx && p[1] === ty) break;
    const a = at(sx + D, sy), b = at(sx, sy + D);
    if (!a || !b) return null;
    const j00 = (a[0] - p[0]) / D, j01 = (b[0] - p[0]) / D, j10 = (a[1] - p[1]) / D, j11 = (b[1] - p[1]) / D;
    const det = j00 * j11 - j01 * j10;
    if (Math.abs(det) < 1e-6) return null;
    px = Math.min(200, Math.max(3, 1 / Math.sqrt(Math.abs(det))));
    const ex = tx - p[0], ey = ty - p[1];
    let dx = (j11 * ex - j01 * ey) / det, dy = (-j10 * ex + j00 * ey) / det;
    const len = Math.hypot(dx, dy);
    if (len > 600) { dx *= 600 / len; dy *= 600 / len; }
    sx += dx;
    sy += dy;
  }
  // refine: the centre of the samples that fall inside the cell
  let n = 0, mx = 0, my = 0;
  const step = px / 3;
  for (let i = -3; i <= 3; i++) {
    for (let k = -3; k <= 3; k++) {
      const x = sx + i * step, y = sy + k * step;
      const p = at(x, y);
      if (p && p[0] === tx && p[1] === ty) { n++; mx += x; my += y; }
    }
  }
  if (!n) return null;
  return { x: mx / n, y: my / n, px };
}

/** Why a placement is refused, in plain words (water / road / building / gate) when the sim names a cell. */
function placeError(world: World, err: CommandError, gate: number, foot: Set<number>): string {
  if (err.k === 'BLOCKED') {
    const c = err.cell;
    if (c === gate && !foot.has(c)) return t('place.gate');
    if (world.terrain.water[c]) return t('place.water');
    if (world.state.roads[c]) return t('place.road');
    return t('place.building');
  }
  return errorText(err);
}

export class BuildTool {
  /** Shelf / placement bar and the undo button (HUD layer). */
  readonly root: HTMLElement;
  /** Ghost labels: rotate button + cost/error, and the gate pin (markers layer). */
  readonly floating: HTMLElement;
  private shelf: HTMLElement;
  private undoBtn: HTMLButtonElement;
  private tag: HTMLElement;
  private tagMain: HTMLElement;
  private tagSub: HTMLElement;
  private pin: HTMLElement;
  private open = false;
  type: BuildingType | null = null;
  private gx = 0;
  private gy = 0;
  private facing = 0;
  private manualFacing = false;
  private result: CommandResult | null = null;
  private previewKey = '';
  private shelfSig = '';
  private undoSig = '';
  private centreGuess: [number, number] = [200, 300];
  private gateGuess: [number, number] = [200, 340];
  private frameN = 0;
  /** A place command is in flight: wait for its result before taking another. */
  pending: { type: BuildingType; x: number; y: number } | null = null;

  constructor(private host: BuildHost) {
    this.shelf = h('div.build-shelf.hit', { role: 'toolbar' });
    this.shelf.hidden = true;
    this.undoBtn = h('button.btn.cf.undo-btn', null);
    this.undoBtn.hidden = true;
    this.undoBtn.addEventListener('click', () => this.undo());
    this.root = h('div.build-ui', null, this.shelf, this.undoBtn);
    this.shelf.addEventListener('click', (e) => this.onShelfClick(e));

    const rotate = h('button.btn.cf.rotate-btn', { 'aria-label': t('build.rotate'), title: t('build.rotate'), html: `<span>${iconSvg('rotate', 26)}</span>` });
    rotate.addEventListener('click', () => this.rotate());
    this.tagMain = h('span.gt-main');
    this.tagSub = h('span.gt-sub');
    this.tag = h('div.ghost-tag.cf.parch.hit', { role: 'status' }, rotate, h('span.gt-text', null, this.tagMain, this.tagSub));
    // the gate pin: a post with a pennant, drawn here (woodcut-flat), ink on a parchment halo
    this.pin = h('div.gate-pin', {
      html: `<svg viewBox="0 0 24 30" width="24" height="30" aria-hidden="true"><path class="halo" d="M5 29V3.5h1.6L20 8.6 6.8 13.4V29z"/>
        <path d="M5.9 28.6V4h1.2l11.4 4.6-11.2 4.1v15.9z"/><path class="cut" d="M8.2 6.7l6.6 2-6.6 2.3z"/></svg>`,
    });
    this.floating = h('div.build-float', null, h('div.float.ghost-tag-wrap', null, this.tag), this.pin);
    this.tag.parentElement!.hidden = true;
    this.pin.hidden = true;
  }

  get isOpen(): boolean { return this.open; }
  /** Placement mode: a ghost is on the map and one-finger drags move it. */
  get placing(): boolean { return this.open && this.type !== null; }
  /** The ghost owns the cell preview (the app's gap/tutorial ghosts wait). */
  get ghostOn(): boolean { return this.placing; }

  setOpen(on: boolean): void {
    if (this.open === on) return;
    this.open = on;
    if (!on) this.clearGhost();
    this.type = null;
    this.shelfSig = '';
    this.renderShelf();
  }

  /** Language switch: rebuild every label. */
  relabel(): void {
    this.shelfSig = '';
    this.undoSig = '';
    const rot = this.tag.querySelector('.rotate-btn');
    rot?.setAttribute('aria-label', t('build.rotate'));
    rot?.setAttribute('title', t('build.rotate'));
    this.renderShelf();
  }

  pick(type: BuildingType): void {
    const world = this.host.world();
    const gate = canPlace(world, type);
    if (!gate.ok) { this.host.toast(errorText(gate.err), 'err', 'build'); return; }
    this.type = type;
    this.manualFacing = false;
    const [cx, cy] = this.host.sceneCentre();
    this.centreGuess = [cx, cy];
    this.gateGuess = [cx, cy + 30];
    const c = this.host.view().cellAt(cx, cy);
    this.moveTo(c >= 0 ? c : Math.floor(world.terrain.h / 2) * world.terrain.w + Math.floor(world.terrain.w / 2));
    this.shelfSig = '';
    this.renderShelf();
  }

  /** Back from placement to the shelf. */
  back(): void {
    this.type = null;
    this.clearGhost();
    this.shelfSig = '';
    this.renderShelf();
  }

  // ---------------------------------------------------------------- ghost input

  dragStart(x: number, y: number): void { this.dragMove(x, y); }
  dragMove(x: number, y: number): void {
    if (!this.placing) return;
    const c = this.host.view().cellAt(x, y - GHOST_LIFT);
    if (c >= 0) {
      this.centreGuess = [x, y - GHOST_LIFT];
      this.moveTo(c);
    }
  }
  dragEnd(x: number, y: number): void { this.dragMove(x, y); }
  dragCancel(): void { /* the ghost simply stays where it was */ }

  /** A tap puts the ghost where the finger was (it never places: "Postaw" does). */
  tap(x: number, y: number): void {
    if (!this.placing) return;
    const c = this.host.view().cellAt(x, y);
    if (c >= 0) { this.centreGuess = [x, y]; this.moveTo(c); }
  }

  rotate(): void {
    if (!this.placing) return;
    this.facing = (this.facing + 1) & 3;
    this.manualFacing = true;
    this.revalidate();
  }

  confirm(): void {
    if (!this.placing || !this.type || this.pending) return;
    this.revalidate();
    const r = this.result;
    if (!r || !r.ok) {
      if (r && !r.ok) this.host.toast(this.errText(r.err), 'err', 'build');
      return;
    }
    this.pending = { type: this.type, x: this.gx, y: this.gy };
    this.host.enqueue({ t: 'place', type: this.type, x: this.gx, y: this.gy, facing: this.facing });
  }

  /** The place command came back (ok or not). */
  settled(): void {
    this.pending = null;
  }

  private undo(): void {
    const world = this.host.world();
    const u = lastUndoable(world);
    if (!u) return;
    const b = world.state.buildings.find((q) => q.id === u.building);
    if (b) this.host.enqueue({ t: 'demolish', cell: b.y * world.terrain.w + b.x });
  }

  // ---------------------------------------------------------------- ghost state

  /** Centre the footprint on a cell; clamp into the map; pick the gate side facing the nearest road. */
  private moveTo(cell: number): void {
    if (!this.type) return;
    const world = this.host.world();
    const W = world.terrain.w, H = world.terrain.h;
    const def = BUILDINGS[this.type];
    const cx = cell % W, cy = Math.floor(cell / W);
    const x = Math.max(1, Math.min(W - def.w - 1, cx - (def.w >> 1)));
    const y = Math.max(1, Math.min(H - def.h - 1, cy - (def.h >> 1)));
    if (x === this.gx && y === this.gy && this.result) return;
    this.gx = x;
    this.gy = y;
    if (!this.manualFacing) this.facing = this.bestFacing(world);
    this.revalidate();
  }

  private bestFacing(world: World): number {
    if (!this.type) return 0;
    let best = this.facing, bestScore = Infinity;
    for (let f = 0; f < 4; f++) {
      const ok = validatePlace(world, this.type, this.gx, this.gy, f).ok;
      const score = (ok ? 0 : 100) + this.roadDistance(world, f) + (f === this.facing ? -0.5 : 0);
      if (score < bestScore) { bestScore = score; best = f; }
    }
    return best;
  }

  private gateOf(world: World, facing: number): number {
    const def = BUILDINGS[this.type!];
    return gateCell(world, this.gx, this.gy, def.w, def.h, facing);
  }

  /** Chebyshev distance from the gate cell to the nearest road cell outside the footprint (cap 6). */
  private roadDistance(world: World, facing: number): number {
    const W = world.terrain.w, H = world.terrain.h;
    const g = this.gateOf(world, facing);
    const gx = g % W, gy = Math.floor(g / W);
    const def = BUILDINGS[this.type!];
    const inFoot = (x: number, y: number): boolean => x >= this.gx && x < this.gx + def.w && y >= this.gy && y < this.gy + def.h;
    for (let r = 1; r <= 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = gx + dx, y = gy + dy;
          if (x < 0 || y < 0 || x >= W || y >= H || inFoot(x, y)) continue;
          if (world.state.roads[y * W + x]) return r;
        }
      }
    }
    return 7;
  }

  private footprint(world: World): number[] {
    const def = BUILDINGS[this.type!];
    const W = world.terrain.w;
    const cells: number[] = [];
    for (let y = this.gy; y < this.gy + def.h; y++) for (let x = this.gx; x < this.gx + def.w; x++) cells.push(y * W + x);
    return cells;
  }

  private errText(err: CommandError): string {
    const world = this.host.world();
    return placeError(world, err, this.gateOf(world, this.facing), new Set(this.footprint(world)));
  }

  private revalidate(): void {
    if (!this.type) return;
    const world = this.host.world();
    this.result = validatePlace(world, this.type, this.gx, this.gy, this.facing);
    const r = this.result;
    const cells = this.footprint(world);
    const bad = !r.ok && 'cell' in r.err ? r.err.cell : -1;
    const key = `${cells[0]}|${this.type}|${r.ok}|${bad}`;
    if (key !== this.previewKey) {
      this.previewKey = key;
      this.host.view().setRoadPreview({ cells, valid: r.ok, badCell: bad });
    }
    const coins = world.state.coins;
    const price = BUILDINGS[this.type].price;
    this.tag.classList.toggle('is-bad', !r.ok);
    if (r.ok) setHtml(this.tagMain, tHtml('build.cost', { n: fmtInt(price), have: fmtInt(coins) }));
    else setHtml(this.tagMain, esc(this.errText(r.err)));
    const gate = this.gateOf(world, this.facing);
    const onRoad = this.gateTouchesRoad(world, gate);
    this.tagSub.classList.toggle('is-warn', !onRoad);
    setHtml(this.tagSub, `${iconSvg(onRoad ? 'road_dirt' : 'no_road', 16)}<span>${esc(t(onRoad ? 'build.gateRoad' : 'build.gateNoRoad'))}</span>`);
    const place = this.shelf.querySelector<HTMLButtonElement>('.pb-place');
    if (place) {
      place.classList.toggle('is-disabled', !r.ok);
      place.setAttribute('aria-disabled', String(!r.ok));
    }
  }

  /** A road cell next to the gate (the sim lays the gate cell itself). */
  private gateTouchesRoad(world: World, gate: number): boolean {
    const W = world.terrain.w, H = world.terrain.h;
    const gx = gate % W, gy = Math.floor(gate / W);
    const occ = net(world).occupied;
    const def = BUILDINGS[this.type!];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = gx + dx, y = gy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        if (x >= this.gx && x < this.gx + def.w && y >= this.gy && y < this.gy + def.h) continue;
        const c = y * W + x;
        if (world.state.roads[c] && occ[c] === -1) return true;
      }
    }
    return false;
  }

  private clearGhost(): void {
    if (this.previewKey) this.host.view().setRoadPreview(null);
    this.previewKey = '';
    this.result = null;
    this.tag.parentElement!.hidden = true;
    this.pin.hidden = true;
  }

  // ---------------------------------------------------------------- per frame

  frame(): void {
    const world = this.host.world();
    this.updateUndo(world);
    if (!this.open) return;
    this.renderShelf();
    if (!this.placing) return;
    // coins and the network change under a standing ghost: re-check a few times a second
    if (++this.frameN % 8 === 0) this.revalidate();
    this.placeLabels(world);
  }

  private placeLabels(world: World): void {
    const view = this.host.view();
    const W = world.terrain.w;
    const def = BUILDINGS[this.type!];
    const centre = (this.gy + (def.h >> 1)) * W + this.gx + (def.w >> 1);
    const c = locateCell(view, W, centre, this.centreGuess);
    const g = locateCell(view, W, this.gateOf(world, this.facing), this.gateGuess);
    const wrap = this.tag.parentElement!;
    if (c) {
      this.centreGuess = [c.x, c.y];
      wrap.hidden = false;
      const tw = this.tag.offsetWidth || 220, th = this.tag.offsetHeight || 56;
      const lift = c.px * (def.h / 2 + 0.6) + 10;
      const maxX = window.innerWidth - tw - 8;
      const px = Math.max(8, Math.min(maxX, c.x - tw / 2));
      const py = Math.max(8, c.y - lift - th);
      wrap.style.transform = `translate3d(${px.toFixed(0)}px, ${py.toFixed(0)}px, 0)`;
    } else wrap.hidden = true;
    if (g) {
      this.gateGuess = [g.x, g.y];
      this.pin.hidden = false;
      this.pin.classList.toggle('is-bad', !!this.result && !this.result.ok && 'cell' in this.result.err && this.result.err.cell === this.gateOf(world, this.facing));
      this.pin.style.transform = `translate3d(${(g.x - 6).toFixed(0)}px, ${(g.y - 28).toFixed(0)}px, 0)`;
    } else this.pin.hidden = true;
  }

  private updateUndo(world: World): void {
    const u = lastUndoable(world);
    const sig = u ? `${u.building}|${u.secondsLeft}|${u.refund}` : '';
    if (sig === this.undoSig) return;
    this.undoSig = sig;
    this.undoBtn.hidden = !u;
    document.body.classList.toggle('has-undo', !!u);
    if (!u) return;
    const name = t(`building.${u.type}` as MessageKey);
    setHtml(this.undoBtn, `<span>${iconSvg('undo', 24)}</span><span>${tHtml('undo.btn', { s: fmtInt(u.secondsLeft) })}</span>`);
    this.undoBtn.setAttribute('aria-label', t('undo.place', { name, n: fmtInt(u.refund) }));
    this.undoBtn.title = t('undo.place', { name, n: fmtInt(u.refund) });
  }

  // ---------------------------------------------------------------- shelf

  private renderShelf(): void {
    const world = this.host.world();
    this.shelf.hidden = !this.open;
    document.body.classList.toggle('build-open', this.open);
    document.body.classList.toggle('build-placing', this.placing);
    if (!this.open) { this.shelfSig = ''; return; }
    const types = buildTypes(world);
    const coins = world.state.coins;
    const gates = types.map((b) => { const g = canPlace(world, b); return g.ok ? -1 : g.err.k === 'LOCKED' ? g.err.rank : 99; });
    const sig = `${t('tool.build')}|${this.type ?? ''}|${types.map((b, i) => `${b}${gates[i]}${coins >= BUILDINGS[b].price ? 1 : 0}`).join(',')}`;
    if (sig === this.shelfSig) return;
    this.shelfSig = sig;
    const price = (b: BuildingType): string =>
      `<span class="bc-price${coins < BUILDINGS[b].price ? ' is-short' : ''}">${iconSvg('coin', 14)}${bdi(fmtInt(BUILDINGS[b].price))}</span>`;
    const size = (b: BuildingType): string => bdi(`${BUILDINGS[b].w}×${BUILDINGS[b].h}`, 'bc-size num');
    if (this.type) {
      const b = this.type;
      setHtml(this.shelf, `<div class="pb-card">${iconSvg(b as IconId, 36)}<span class="pb-t"><b>${esc(t(`building.${b}` as MessageKey))}</b><span class="pb-m">${price(b)}${size(b)}</span></span></div>
        <div class="pb-hint">${esc(t('build.hint'))}</div>
        <div class="pb-actions">
          <button class="btn cf pb-back" data-b="back">${iconSvg('back', 20)}<span>${esc(t('build.back'))}</span></button>
          <button class="btn primary cf pb-place" data-b="place">${iconSvg('build', 24)}<span>${esc(t('build.place'))}</span></button>
        </div>`);
      this.shelf.setAttribute('aria-label', t('build.place'));
      this.revalidate();
      this.measure();
      return;
    }
    const cards = types.map((b, i) => {
      const locked = gates[i]! >= 0 && gates[i]! < 99;
      const tag = locked ? `<span class="bc-lock" title="${esc(rankName(gates[i]!))}">${esc(t('build.rankN', { n: gates[i]! }))}</span>` : '';
      return `<button class="build-card cf${locked ? ' is-locked' : ''}" data-b="pick:${b}" aria-disabled="${locked}"
        aria-label="${esc(`${t(`building.${b}` as MessageKey)}, ${BUILDINGS[b].price}`)}${locked ? esc(` — ${errorText({ k: 'LOCKED', rank: gates[i]! })}`) : ''}">
        <span class="bc-icon">${iconSvg(b as IconId, 40)}</span><span class="bc-name">${esc(t(`building.${b}` as MessageKey))}</span>
        <span class="bc-meta">${price(b)}${size(b)}</span>${tag}</button>`;
    }).join('');
    setHtml(this.shelf, `<div class="bs-cards">${cards}</div>`);
    this.shelf.setAttribute('aria-label', t('build.shelf'));
    this.measure();
  }

  /** Height of the shelf for toasts and the undo button above it. */
  measure(): void {
    requestAnimationFrame(() => {
      const r = this.shelf.hidden ? 0 : this.shelf.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--shelf-h', `${Math.round(r)}px`);
    });
  }

  private onShelfClick(e: Event): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-b]');
    if (!el) return;
    const [a, arg] = (el.dataset.b ?? '').split(':');
    if (a === 'pick') this.pick(arg as BuildingType);
    else if (a === 'back') this.back();
    else if (a === 'close') this.host.close();
    else if (a === 'place') this.confirm();
  }
}
