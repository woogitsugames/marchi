// Per-cell overlay data drawn by the terrain shader (so everything drapes on the ground):
//   R = road traffic level (0..1), G = road preview (valid), B = road preview (invalid),
//   A = the offending cell of an invalid preview.
// Plus the placement ghost's ground marks (footprint outline, gate arrow, offending cell).
// Plus selection outline uniforms (rectangle for a building footprint, ring for a wagon).
import { DataTexture, LinearFilter, RGBAFormat, UnsignedByteType, Vector2, Vector4 } from 'three';
import type { World } from '../sim/index';
import type { RoadPreview } from './api';

export class OverlayData {
  readonly texture: DataTexture;
  private readonly data: Uint8Array;
  /** min x, min z, max x, max z (metres) */
  readonly selRect = new Vector4(0, 0, 0, 0);
  /** centre x, centre z, radius, enabled */
  readonly selRing = new Vector4(0, 0, 0, 0);
  selRectOn = { value: 0 };
  /** Placement ghost footprint: min x, min z, max x, max z (metres). */
  readonly ghostRect = new Vector4(0, 0, 0, 0);
  /** Ghost gate cell: centre x, centre z, outward direction x, z (unit). */
  readonly ghostGate = new Vector4(0, 0, 0, 1);
  /** Ghost offending cell: centre x, centre z, half size, enabled. */
  readonly ghostBad = new Vector4(0, 0, 0, 0);
  /** x = ghost on, y = placement valid. */
  readonly ghostOn = new Vector2(0, 0);
  /** 1 = the road preview is a proposed connection (hatched), 0 = a drawn road (solid). */
  previewDash = { value: 0 };
  /** 1 = the road preview is a dirt stretch to pave (pale setts with dark joints), 0 = a road to build. */
  previewPave = { value: 0 };
  /** Suitable ground for the building being placed (quarry: rock, fisher: by the water), R channel. */
  readonly siteTexture: DataTexture;
  private readonly siteData: Uint8Array;
  /** 1 while site cells are shown. */
  siteOn = { value: 0 };
  private sites: number[] = [];
  private preview: RoadPreview | null = null;
  private trafficMax = 1;

  constructor(readonly w: number, readonly h: number) {
    this.data = new Uint8Array(w * h * 4);
    this.texture = new DataTexture(this.data, w, h, RGBAFormat, UnsignedByteType);
    this.texture.magFilter = LinearFilter;
    this.texture.minFilter = LinearFilter;
    this.texture.needsUpdate = true;
    this.siteData = new Uint8Array(w * h * 4);
    this.siteTexture = new DataTexture(this.siteData, w, h, RGBAFormat, UnsignedByteType);
    this.siteTexture.magFilter = LinearFilter;
    this.siteTexture.minFilter = LinearFilter;
    this.siteTexture.needsUpdate = true;
  }

  /** Show (or with null hide) the cells where the building being placed may stand. */
  setSites(cells: readonly number[] | null): void {
    const d = this.siteData, n = this.w * this.h;
    for (const c of this.sites) d[c * 4] = 0;
    this.sites = [];
    if (cells) for (const c of cells) if (c >= 0 && c < n) { d[c * 4] = 255; this.sites.push(c); }
    this.siteOn.value = this.sites.length > 0 ? 1 : 0;
    this.siteTexture.needsUpdate = true;
  }

  /** Refresh the traffic channel from sim state (cheap; call ~1 Hz). */
  updateTraffic(world: World): void {
    const tr = world.state.traffic, roads = world.state.roads;
    let mx = 0;
    for (let i = 0; i < tr.length; i++) if (roads[i]) mx = Math.max(mx, tr[i]!);
    // slow-moving normaliser so colours don't flicker as counters decay
    const target = Math.max(8, mx);
    this.trafficMax += (target - this.trafficMax) * 0.3;
    const d = this.data;
    for (let i = 0; i < tr.length; i++) {
      const v = roads[i] ? Math.min(1, tr[i]! / this.trafficMax) : 0;
      d[i * 4] = Math.round(Math.sqrt(v) * 255);
    }
    this.texture.needsUpdate = true;
  }

  setPreview(p: RoadPreview | null): void {
    const d = this.data;
    if (this.preview) for (const c of this.preview.cells) { d[c * 4 + 1] = 0; d[c * 4 + 2] = 0; }
    if (this.preview && this.preview.badCell >= 0) d[this.preview.badCell * 4 + 3] = 0;
    this.preview = p ? { cells: p.cells.slice(), valid: p.valid, badCell: p.badCell } : null;
    this.previewDash.value = p && p.dashed ? 1 : 0;
    this.previewPave.value = p && p.pave ? 1 : 0;
    if (p) {
      const n = this.w * this.h;
      for (const c of p.cells) if (c >= 0 && c < n) d[c * 4 + (p.valid ? 1 : 2)] = 255;
      if (!p.valid && p.badCell >= 0 && p.badCell < n) d[p.badCell * 4 + 3] = 255;
    }
    this.texture.needsUpdate = true;
  }

  clearSelection(): void {
    this.selRectOn.value = 0;
    this.selRing.w = 0;
  }
}
