// Canvas2D top-down fallback implementation of WorldView (src/render/api.ts).
// Used until/unless the three.js view loads, and with ?view=flat. Read-only on sim state.
import {
  BUILDINGS, edgeLength, hasEdge, isRaining, type Building, type Good, type World,
} from '../sim/index';
import type {
  CameraControl, Overlay, PickResult, Quality, RoadPreview, ScreenAnchor, WorldView,
} from '../render/api';

const TEX = 8; // terrain texture px per cell

const CARGO: Record<Good, string> = {
  wood: '#6b5034', planks: '#c2a878', grain: '#a88d5c', flour: '#ddd6c6', bread: '#b8893a',
};
const ROOF: Record<string, string> = {
  woodcutter: '#7c6a4c', sawmill: '#8a7350', farm: '#9a8058', mill: '#8f7d5d', bakery: '#94704e',
  warehouse: '#857456', stable: '#7a6a4f', castle: '#8a8478',
};
const LETTER: Record<string, string> = {
  woodcutter: 'D', sawmill: 'T', farm: 'G', mill: 'M', bakery: 'P', warehouse: 'S', stable: 'St', castle: 'Z',
};

interface Cam { cx: number; cy: number; scale: number; rot: number }

function mix(a: number[], b: number[], t: number): number[] {
  return [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];
}
function hash01(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const hex = (s: string): number[] => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

class FlatView implements WorldView {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private world: World | null = null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private cam: Cam = { cx: 48, cy: 36, scale: 8, rot: 0 };
  private goal: { cx: number; cy: number } | null = null;
  private followId: number | null = null;
  private terrainImg: HTMLCanvasElement | null = null;
  private roadImg: HTMLCanvasElement | null = null;
  private roadKey = '';
  private prev = new Map<number, [number, number]>();
  private cur = new Map<number, [number, number]>();
  private preview: RoadPreview | null = null;
  private overlay: Overlay = 'none';
  private selection: PickResult = null;
  private quality: Quality = 'high';
  private menu = false;
  private fps = 60;
  private draws = 0;
  private alpha = 1;
  private t = 0;

  readonly camera: CameraControl = {
    pan: (dx, dy) => {
      this.followId = null;
      this.goal = null;
      const [wx, wy] = this.rotVec(-dx / this.cam.scale, -dy / this.cam.scale, -this.cam.rot);
      this.cam.cx += wx;
      this.cam.cy += wy;
      this.clampCam();
    },
    zoom: (f, x, y) => {
      const [bx, by] = this.screenToWorld(x, y);
      this.cam.scale = Math.min(48, Math.max(this.minScale(), this.cam.scale / f));
      const [ax, ay] = this.screenToWorld(x, y);
      this.cam.cx += bx - ax;
      this.cam.cy += by - ay;
      this.clampCam();
    },
    rotate: (r) => {
      this.cam.rot += r;
    },
    focusCell: (cell) => {
      if (!this.world) return;
      const W = this.world.terrain.w;
      this.goal = { cx: (cell % W) + 0.5, cy: Math.floor(cell / W) + 0.5 };
    },
    follow: (id) => {
      this.followId = id;
    },
  };

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
  }

  setWorld(world: World): void {
    this.world = world;
    this.terrainImg = this.bakeTerrain(world);
    this.roadKey = '';
    this.prev.clear();
    this.cur.clear();
    this.snapshot(this.cur);
    this.snapshot(this.prev);
    this.followId = null;
    this.goal = null;
    this.cam.cx = world.terrain.w / 2;
    this.cam.cy = world.terrain.h / 2;
    this.cam.rot = 0;
    this.cam.scale = Math.max(this.minScale(), Math.min(13, Math.max(this.w, this.h) / 64));
    this.cam.cx = 46;
    this.cam.cy = 37;
  }

  afterTick(): void {
    const p = this.prev;
    this.prev = this.cur;
    this.cur = p;
    this.cur.clear();
    this.snapshot(this.cur);
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.w = Math.max(1, cssW);
    this.h = Math.max(1, cssH);
    this.dpr = dpr;
    if (this.canvas) {
      this.canvas.width = Math.round(cssW * dpr);
      this.canvas.height = Math.round(cssH * dpr);
    }
    this.cam.scale = Math.max(this.cam.scale, this.minScale());
  }

  frame(alpha: number, dtMs: number): void {
    const ctx = this.ctx;
    const world = this.world;
    if (!ctx || !world) return;
    this.alpha = alpha;
    this.t += dtMs;
    if (dtMs > 0) this.fps += (1000 / dtMs - this.fps) * 0.05;
    this.draws = 0;
    // camera motion
    if (this.menu) {
      this.cam.rot += dtMs * 0.000018;
    }
    if (this.followId !== null) {
      const p = this.wagonPos(this.followId);
      if (p) this.goal = { cx: p[0], cy: p[1] };
    }
    if (this.goal) {
      const k = 1 - Math.exp(-dtMs / 160);
      this.cam.cx += (this.goal.cx - this.cam.cx) * k;
      this.cam.cy += (this.goal.cy - this.cam.cy) * k;
      if (this.followId === null && Math.abs(this.goal.cx - this.cam.cx) + Math.abs(this.goal.cy - this.cam.cy) < 0.02) this.goal = null;
    }
    const d = this.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = '#2f3a2c';
    ctx.fillRect(0, 0, this.w, this.h);
    // world transform
    const c = Math.cos(this.cam.rot), s = Math.sin(this.cam.rot), k = this.cam.scale;
    ctx.setTransform(d * k * c, d * k * s, -d * k * s, d * k * c,
      d * (this.w / 2 - k * (c * this.cam.cx - s * this.cam.cy)),
      d * (this.h / 2 - k * (s * this.cam.cx + c * this.cam.cy)));
    ctx.imageSmoothingEnabled = this.quality === 'high';
    if (this.terrainImg) {
      ctx.drawImage(this.terrainImg, 0, 0, world.terrain.w, world.terrain.h);
      this.draws++;
    }
    this.drawRoads(ctx, world);
    this.drawPreview(ctx, world);
    this.drawBuildings(ctx, world);
    this.drawWagons(ctx, world, alpha);
    if (isRaining(world.state)) {
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = 'rgba(76,91,92,0.16)';
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (this.menu) {
      // low dawn haze over the menu scene
      ctx.setTransform(d, 0, 0, d, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, this.h);
      g.addColorStop(0, 'rgba(201,198,187,0.30)');
      g.addColorStop(0.6, 'rgba(201,198,187,0.05)');
      g.addColorStop(1, 'rgba(43,38,32,0.25)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  pick(x: number, y: number): PickResult {
    const world = this.world;
    if (!world) return null;
    const [wx, wy] = this.screenToWorld(x, y);
    let best = -1, bestD = Math.max(14, this.cam.scale * 0.7) / this.cam.scale;
    for (const wg of world.state.wagons) {
      const p = this.wagonPos(wg.id);
      if (!p) continue;
      const dd = Math.hypot(p[0] - wx, p[1] - wy);
      if (dd < bestD) { bestD = dd; best = wg.id; }
    }
    if (best >= 0) return { kind: 'wagon', id: best };
    const cx = Math.floor(wx), cy = Math.floor(wy);
    for (const b of world.state.buildings) {
      if (cx >= b.x && cx < b.x + b.w && cy >= b.y && cy < b.y + b.h) return { kind: 'building', id: b.id };
    }
    const cell = this.cellAt(x, y);
    return cell >= 0 ? { kind: 'cell', cell } : null;
  }

  cellAt(x: number, y: number): number {
    const world = this.world;
    if (!world) return -1;
    const [wx, wy] = this.screenToWorld(x, y);
    const cx = Math.floor(wx), cy = Math.floor(wy);
    if (cx < 0 || cy < 0 || cx >= world.terrain.w || cy >= world.terrain.h) return -1;
    return cy * world.terrain.w + cx;
  }

  anchorOf(kind: 'building' | 'wagon', id: number): ScreenAnchor {
    const world = this.world;
    if (!world) return { x: 0, y: 0, visible: false };
    let wx: number, wy: number, lift: number;
    if (kind === 'building') {
      const b = world.state.buildings.find((q) => q.id === id);
      if (!b) return { x: 0, y: 0, visible: false };
      wx = b.x + b.w / 2;
      wy = b.y + b.h / 2;
      lift = (Math.min(b.w, b.h) / 2) * this.cam.scale * 0.8 + 4;
    } else {
      const p = this.wagonPos(id);
      if (!p) return { x: 0, y: 0, visible: false };
      [wx, wy] = p;
      lift = Math.max(6, this.cam.scale * 0.5);
    }
    const [sx, sy] = this.worldToScreen(wx, wy);
    const y = sy - lift;
    return { x: sx, y, visible: sx > -20 && sy > -20 && sx < this.w + 20 && sy < this.h + 20 };
  }

  setRoadPreview(p: RoadPreview | null): void { this.preview = p; }
  setOverlay(o: Overlay): void { this.overlay = o; this.roadKey = ''; }
  setSelection(sel: PickResult): void { this.selection = sel; }
  setQuality(q: Quality): void {
    this.quality = q;
    if (this.world) this.terrainImg = this.bakeTerrain(this.world);
  }
  setMenuMode(on: boolean): void {
    this.menu = on;
    if (on && this.world) {
      this.cam.cx = 44;
      this.cam.cy = 32;
      this.cam.scale = Math.max(this.minScale(), Math.min(14, Math.max(this.w, this.h) / 52));
      this.cam.rot = -0.18;
    }
  }
  stats(): { fps: number; drawCalls: number; triangles: number; geometries: number; textures: number } {
    return { fps: this.fps, drawCalls: this.draws, triangles: 0, geometries: 0, textures: this.terrainImg ? 1 : 0 };
  }
  dispose(): void {
    this.world = null;
    this.terrainImg = null;
    this.roadImg = null;
  }

  // ------------------------------------------------------------------ helpers

  private minScale(): number {
    const world = this.world;
    const W = world ? world.terrain.w : 96, H = world ? world.terrain.h : 72;
    return Math.min(this.w / W, this.h / H) * 0.9;
  }

  private clampCam(): void {
    const world = this.world;
    if (!world) return;
    this.cam.cx = Math.min(world.terrain.w, Math.max(0, this.cam.cx));
    this.cam.cy = Math.min(world.terrain.h, Math.max(0, this.cam.cy));
  }

  private rotVec(x: number, y: number, r: number): [number, number] {
    const c = Math.cos(r), s = Math.sin(r);
    return [x * c - y * s, x * s + y * c];
  }

  worldToScreen(wx: number, wy: number): [number, number] {
    const [rx, ry] = this.rotVec(wx - this.cam.cx, wy - this.cam.cy, this.cam.rot);
    return [this.w / 2 + rx * this.cam.scale, this.h / 2 + ry * this.cam.scale];
  }

  screenToWorld(x: number, y: number): [number, number] {
    const [rx, ry] = this.rotVec((x - this.w / 2) / this.cam.scale, (y - this.h / 2) / this.cam.scale, -this.cam.rot);
    return [rx + this.cam.cx, ry + this.cam.cy];
  }

  private snapshot(into: Map<number, [number, number]>): void {
    const world = this.world;
    if (!world) return;
    const W = world.terrain.w;
    for (const wg of world.state.wagons) {
      const ax = (wg.at % W) + 0.5, ay = Math.floor(wg.at / W) + 0.5;
      if (wg.next >= 0) {
        const bx = (wg.next % W) + 0.5, by = Math.floor(wg.next / W) + 0.5;
        const len = edgeLength(world.terrain, wg.at, wg.next) || 1;
        const f = Math.min(1, wg.edgeT / len);
        into.set(wg.id, [ax + (bx - ax) * f, ay + (by - ay) * f]);
      } else {
        into.set(wg.id, [ax, ay]);
      }
    }
  }

  private wagonPos(id: number): [number, number] | null {
    const c = this.cur.get(id);
    if (!c) return null;
    const p = this.prev.get(id) ?? c;
    const a = this.alpha;
    return [p[0] + (c[0] - p[0]) * a, p[1] + (c[1] - p[1]) * a];
  }

  private bakeTerrain(world: World): HTMLCanvasElement {
    const t = world.terrain;
    const cv = document.createElement('canvas');
    const k = this.quality === 'high' ? TEX : 4;
    cv.width = t.w * k;
    cv.height = t.h * k;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(cv.width, cv.height);
    let lo = Infinity, hi = -Infinity;
    for (const v of t.corners) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const meadowLo = hex('#3f4a31'), meadowHi = hex('#6f7550'), forest = hex('#2a3427'), forestHi = hex('#3d4a35'), field = hex('#8a7752');
    const bil = (arr: number[], fx: number, fy: number): number => {
      const x = fx - 0.5, y = fy - 0.5;
      const x0 = Math.max(0, Math.min(t.w - 1, Math.floor(x))), y0 = Math.max(0, Math.min(t.h - 1, Math.floor(y)));
      const x1 = Math.min(t.w - 1, x0 + 1), y1 = Math.min(t.h - 1, y0 + 1);
      const tx = Math.min(1, Math.max(0, x - x0)), ty = Math.min(1, Math.max(0, y - y0));
      const a = arr[y0 * t.w + x0] ?? 0, b = arr[y0 * t.w + x1] ?? 0, c = arr[y1 * t.w + x0] ?? 0, d = arr[y1 * t.w + x1] ?? 0;
      return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    };
    const water = hex('#4c5b5c'), waterDeep = hex('#3e4b4d');
    const W1 = t.w + 1;
    const hAt = (fx: number, fy: number): number => {
      // bilinear over corner heights
      const x0 = Math.max(0, Math.min(t.w - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(t.h - 1, Math.floor(fy)));
      const tx = Math.min(1, Math.max(0, fx - x0)), ty = Math.min(1, Math.max(0, fy - y0));
      const a = t.corners[y0 * W1 + x0]!, b = t.corners[y0 * W1 + x0 + 1]!;
      const c = t.corners[(y0 + 1) * W1 + x0]!, d = t.corners[(y0 + 1) * W1 + x0 + 1]!;
      return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    };
    for (let py = 0; py < cv.height; py++) {
      for (let px = 0; px < cv.width; px++) {
        const fx = (px + 0.5) / k, fy = (py + 0.5) / k;
        const cx = Math.min(t.w - 1, Math.floor(fx)), cy = Math.min(t.h - 1, Math.floor(fy));
        const ci = cy * t.w + cx;
        const hgt = hAt(fx, fy);
        // hillshade, light from the north-west, low sun
        const dx = hAt(fx + 0.5, fy) - hAt(fx - 0.5, fy);
        const dy = hAt(fx, fy + 0.5) - hAt(fx, fy - 0.5);
        const shade = Math.max(0.55, Math.min(1.25, 1 - (dx + dy) * 0.22));
        let col: number[];
        const noise = hash01(px, py);
        if (t.water[ci]) {
          col = mix(water, waterDeep, Math.min(1, (t.waterLevel - hgt + 0.5) * 0.6));
          col = mix(col, hex('#c9c6bb'), 0.04 + 0.05 * hash01(Math.floor(px / 5), py));
        } else {
          const n = (hgt - lo) / Math.max(1, hi - lo);
          col = mix(meadowLo, meadowHi, Math.min(1, n * 1.3));
          col = mix(col, meadowLo, (noise - 0.5) * 0.18);
          const fd = bil(t.field, fx, fy);
          if (fd > 0.05) col = mix(col, field, Math.min(1, fd * 1.2) * (Math.floor(fy * 3) % 2 === 0 ? 0.55 : 0.38));
          const f = bil(t.forest, fx, fy);
          if (f > 0.02) {
            // tree crowns as clumped stipple: dense forest -> mostly crowns, edges -> scattered trees
            const clump = hash01(Math.floor(px / 3), Math.floor(py / 3)) * 0.6 + noise * 0.4;
            if (clump < f * 1.05) col = mix(forest, forestHi, hash01(Math.floor(px / 3) + 7, Math.floor(py / 3)) * 0.5);
            else col = mix(col, forest, f * 0.35);
          }
          col = col.map((v) => v * shade);
        }
        const o = (py * cv.width + px) * 4;
        img.data[o] = col[0]!;
        img.data[o + 1] = col[1]!;
        img.data[o + 2] = col[2]!;
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  private drawRoads(ctx: CanvasRenderingContext2D, world: World): void {
    const st = world.state;
    const key = st.netVersion + ':' + this.overlay + ':' + (this.overlay === 'traffic' ? Math.floor(st.tick / 20) : 0);
    if (key !== this.roadKey || !this.roadImg) {
      this.roadKey = key;
      this.roadImg = this.bakeRoads(world);
    }
    ctx.drawImage(this.roadImg, 0, 0, world.terrain.w, world.terrain.h);
    this.draws++;
  }

  private bakeRoads(world: World): HTMLCanvasElement {
    const t = world.terrain, st = world.state;
    const k = 12;
    const cv = this.roadImg && this.roadImg.width === t.w * k ? this.roadImg : document.createElement('canvas');
    cv.width = t.w * k;
    cv.height = t.h * k;
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, cv.width, cv.height);
    g.setTransform(k, 0, 0, k, 0, 0);
    g.lineCap = 'round';
    let maxT = 1;
    if (this.overlay === 'traffic') for (const v of st.traffic) maxT = Math.max(maxT, v);
    const W = t.w;
    const dirs = [[1, 0], [0, 1], [1, 1], [-1, 1]] as const;
    for (const pass of [0, 1]) {
      for (let i = 0; i < st.roads.length; i++) {
        const s = st.roads[i]!;
        if (!s) continue;
        const x = i % W, y = (i - x) / W;
        const water = t.water[i] === 1;
        let color: string;
        if (pass === 0) color = water ? '#2b2620' : 'rgba(43,38,32,0.55)';
        else if (this.overlay === 'traffic') {
          const v = Math.min(1, (st.traffic[i] ?? 0) / maxT);
          color = v < 0.05 ? '#6c5f4e' : v < 0.4 ? '#b8893a' : v < 0.75 ? '#a5662f' : '#8c4a2f';
        } else color = water ? (s === 2 ? '#a19a8c' : '#7a6248') : s === 2 ? '#8a8478' : '#5a4a39';
        const wdt = pass === 0 ? (water ? 0.86 : 0.74) : water ? 0.66 : 0.56;
        g.strokeStyle = color;
        g.fillStyle = color;
        g.lineWidth = wdt;
        let any = false;
        for (const [dx, dy] of dirs) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= t.h) continue;
          const j = ny * W + nx;
          if (!st.roads[j] || !hasEdge(world, i, j)) continue;
          g.beginPath();
          g.moveTo(x + 0.5, y + 0.5);
          g.lineTo(nx + 0.5, ny + 0.5);
          g.stroke();
          any = true;
        }
        g.beginPath();
        g.arc(x + 0.5, y + 0.5, wdt / 2, 0, Math.PI * 2);
        g.fill();
        if (pass === 1 && s === 2 && !water && this.overlay === 'none') {
          g.fillStyle = 'rgba(201,198,187,0.35)';
          g.fillRect(x + 0.35, y + 0.35, 0.3, 0.3);
        }
        if (pass === 1 && water && this.overlay === 'none') {
          // bridge planks / rails
          g.strokeStyle = 'rgba(228,220,203,0.35)';
          g.lineWidth = 0.06;
          g.beginPath();
          g.moveTo(x + 0.2, y + 0.2); g.lineTo(x + 0.8, y + 0.8);
          g.stroke();
        }
        void any;
      }
    }
    return cv;
  }

  private drawPreview(ctx: CanvasRenderingContext2D, world: World): void {
    const p = this.preview;
    if (!p || !p.cells.length) return;
    const W = world.terrain.w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = p.valid ? 'rgba(184,137,58,0.9)' : 'rgba(140,74,47,0.9)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    p.cells.forEach((c, i) => {
      const x = (c % W) + 0.5, y = Math.floor(c / W) + 0.5;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    for (const c of p.cells) {
      const x = c % W, y = Math.floor(c / W);
      ctx.fillStyle = world.terrain.water[c] ? 'rgba(228,220,203,0.55)' : 'rgba(228,220,203,0.18)';
      ctx.fillRect(x + 0.4, y + 0.4, 0.2, 0.2);
    }
    if (p.badCell >= 0) {
      const x = (p.badCell % W) + 0.5, y = Math.floor(p.badCell / W) + 0.5;
      ctx.strokeStyle = '#8c4a2f';
      ctx.lineWidth = 0.18;
      ctx.beginPath();
      ctx.arc(x, y, 0.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#e4dccb';
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      ctx.moveTo(x - 0.35, y - 0.35); ctx.lineTo(x + 0.35, y + 0.35);
      ctx.moveTo(x + 0.35, y - 0.35); ctx.lineTo(x - 0.35, y + 0.35);
      ctx.stroke();
    }
    this.draws++;
  }

  private drawBuildings(ctx: CanvasRenderingContext2D, world: World): void {
    const W = world.terrain.w;
    for (const b of world.state.buildings) {
      this.drawBuilding(ctx, b, W);
    }
  }

  private drawBuilding(ctx: CanvasRenderingContext2D, b: Building, W: number): void {
    const sel = this.selection?.kind === 'building' && this.selection.id === b.id;
    const inset = 0.12;
    // shadow (low sun from the north-west -> shadow to the south-east)
    ctx.fillStyle = 'rgba(43,38,32,0.45)';
    ctx.fillRect(b.x + inset + 0.35, b.y + inset + 0.35, b.w - inset * 2, b.h - inset * 2);
    ctx.fillStyle = ROOF[b.type] ?? '#8a7350';
    ctx.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
    // roof ridge
    ctx.strokeStyle = 'rgba(43,38,32,0.5)';
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    if (b.w >= b.h) { ctx.moveTo(b.x + inset, b.y + b.h / 2); ctx.lineTo(b.x + b.w - inset, b.y + b.h / 2); }
    else { ctx.moveTo(b.x + b.w / 2, b.y + inset); ctx.lineTo(b.x + b.w / 2, b.y + b.h - inset); }
    ctx.stroke();
    ctx.strokeStyle = sel ? '#8c4a2f' : '#2b2620';
    ctx.lineWidth = sel ? 0.22 : 0.1;
    ctx.strokeRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
    // gate
    const gx = b.gate % W, gy = Math.floor(b.gate / W);
    ctx.fillStyle = '#2b2620';
    ctx.fillRect(gx + 0.3, gy + 0.3, 0.4, 0.4);
    // type letter, kept upright on screen
    if (this.cam.scale >= 5) {
      ctx.save();
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
      ctx.rotate(-this.cam.rot);
      const fs = Math.min(1.1, Math.min(b.w, b.h) * 0.55);
      ctx.font = `700 ${fs}px 'Alegreya Sans', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(43,38,32,0.85)';
      ctx.fillText(LETTER[b.type] ?? '?', 0, 0.04);
      ctx.restore();
    }
    void BUILDINGS;
    this.draws += 3;
  }

  private drawWagons(ctx: CanvasRenderingContext2D, world: World, _alpha: number): void {
    for (const wg of world.state.wagons) {
      const p = this.wagonPos(wg.id);
      if (!p) continue;
      const sel = this.selection?.kind === 'wagon' && this.selection.id === wg.id;
      ctx.fillStyle = 'rgba(43,38,32,0.45)';
      ctx.beginPath();
      ctx.arc(p[0] + 0.12, p[1] + 0.12, 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a3b2b';
      ctx.beginPath();
      ctx.arc(p[0], p[1], 0.42, 0, Math.PI * 2);
      ctx.fill();
      if (wg.cargoGood && wg.cargoQty > 0) {
        ctx.fillStyle = CARGO[wg.cargoGood];
        ctx.beginPath();
        ctx.arc(p[0], p[1], 0.26, 0, Math.PI * 2);
        ctx.fill();
      }
      if (sel) {
        ctx.strokeStyle = '#b8893a';
        ctx.lineWidth = 0.14;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 0.66, 0, Math.PI * 2);
        ctx.stroke();
      }
      this.draws++;
    }
  }
}

export function createFlatView(): WorldView {
  return new FlatView();
}
