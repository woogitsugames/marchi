// Road drafting: drag over the map, cells joined with lineCells, live validation and cost.
import { lineCells, roadCellCost, validateRoad, type CommandError, type SurfaceKind, type World } from '../sim/index';
import type { WorldView } from '../render/api';
import { t, type MessageKey } from '../i18n/index';
import type { Markers } from './markers';

export function errorText(err: CommandError): string {
  const key = `err.${err.k}` as MessageKey;
  switch (err.k) {
    case 'TOO_STEEP': return t(key, { grade: Math.round(err.grade * 100), max: Math.round(err.max * 100) });
    case 'NO_COINS': return t(key, { need: err.need, have: err.have });
    default: return t(key);
  }
}

export class RoadDraft {
  private cells: number[] = [];
  active = false;

  constructor(
    private view: () => WorldView,
    private world: () => World,
    private markers: Markers,
    private build: (cells: number[], surface: SurfaceKind) => void,
  ) {}

  surface: SurfaceKind = 1;

  start(x: number, y: number): void {
    const c = this.view().cellAt(x, y);
    this.cells = c >= 0 ? [c] : [];
    this.active = true;
    this.refresh(x, y);
  }

  move(x: number, y: number): void {
    if (!this.active) return;
    const c = this.view().cellAt(x, y);
    if (c < 0) { this.refresh(x, y); return; }
    const last = this.cells[this.cells.length - 1];
    if (last === undefined) {
      this.cells.push(c);
    } else if (c !== last) {
      // backtracking over the previous cell erases the tail
      const back = this.cells.lastIndexOf(c);
      if (back >= 0 && back >= this.cells.length - 4) this.cells.length = back + 1;
      else this.cells.push(...lineCells(this.world().terrain.w, last, c).slice(1));
    }
    this.refresh(x, y);
  }

  end(x: number, y: number): void {
    if (!this.active) return;
    this.move(x, y);
    const world = this.world();
    const r = this.cells.length >= 2 ? validateRoad(world, this.cells, this.surface) : null;
    if (r && r.ok) {
      this.build([...this.cells], this.surface);
      this.cancel();
    } else {
      // keep the red draft visible briefly so the reason can be read
      this.active = false;
      window.setTimeout(() => { if (!this.active) this.cancel(); }, 1400);
    }
  }

  cancel(): void {
    this.active = false;
    this.cells = [];
    this.view().setRoadPreview(null);
    this.markers.clearDraft();
  }

  private refresh(x: number, y: number): void {
    const world = this.world();
    const view = this.view();
    if (this.cells.length < 2) {
      view.setRoadPreview(this.cells.length ? { cells: this.cells, valid: true, badCell: -1 } : null);
      this.markers.clearDraft();
      return;
    }
    const r = validateRoad(world, this.cells, this.surface);
    const water = this.cells.filter((c, i) => world.terrain.water[c] === 1 && this.cells.indexOf(c) === i).length;
    let cost = 0;
    const seen = new Set<number>();
    for (const c of this.cells) if (!seen.has(c)) { seen.add(c); cost += roadCellCost(world, c, this.surface); }
    const bridge = water > 0 ? t(this.surface === 2 ? 'road.bridgeStone' : 'road.bridge', { n: water }) : '';
    const costText = cost > 0 ? t('road.cost', { n: cost }) : t('road.free');
    if (r.ok) {
      view.setRoadPreview({ cells: this.cells, valid: true, badCell: -1 });
      this.markers.setDraft(x, y, costText, [bridge, t('road.cells', { n: seen.size })].filter(Boolean).join(' · '), false);
    } else {
      const bad = 'cell' in r.err ? r.err.cell : -1;
      view.setRoadPreview({ cells: this.cells, valid: false, badCell: bad });
      this.markers.setDraft(x, y, errorText(r.err), [costText, bridge].filter(Boolean).join(' · '), true);
    }
  }
}
