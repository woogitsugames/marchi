// Deterministic terrain generation. Only polynomial math (see D-03).
import { CELL_SIZE } from './defs';
import { fbm } from './rng';
import type { Terrain } from './types';

/** Catmull-Rom through evenly spaced control points (spacing in cells). */
export function spline(points: readonly number[], spacing: number, x: number): number {
  const fx = x / spacing;
  let i = Math.floor(fx);
  if (i < 0) i = 0;
  if (i > points.length - 2) i = points.length - 2;
  const t = fx - i;
  const p0 = points[Math.max(0, i - 1)]!;
  const p1 = points[i]!;
  const p2 = points[i + 1]!;
  const p3 = points[Math.min(points.length - 1, i + 2)]!;
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export interface ValleySpec {
  w: number;
  h: number;
  seed: number;
  waterLevel: number;
  /** River centreline y (cells) at x = 0, spacing, 2*spacing, ... */
  riverY: number[];
  riverHalfWidth: number[];
  spacing: number;
  hills: { x: number; y: number; r: number; h: number }[];
  /** North ridge: rows below this y rise steeply. */
  northRidge: number;
  southRidge: number;
  forestNorthOf: number;
  fields: { x: number; y: number; w: number; h: number }[];
}

export function riverDistance(spec: ValleySpec, x: number, y: number): number {
  const ry = spline(spec.riverY, spec.spacing, x);
  const hw = spline(spec.riverHalfWidth, spec.spacing, x);
  return Math.abs(y - ry) - hw;
}

export function generateValley(spec: ValleySpec): Terrain {
  const { w, h, seed, waterLevel: WL } = spec;
  const corners: number[] = new Array((w + 1) * (h + 1));
  for (let cy = 0; cy <= h; cy++) {
    for (let cx = 0; cx <= w; cx++) {
      const d = riverDistance(spec, cx, cy);
      let z: number;
      if (d < 0) {
        const depth = Math.min(1, -d / 1.5);
        z = WL - 0.35 - depth * 1.1;
      } else {
        const amp = Math.min(1, d / 5);
        const n = (fbm(seed, cx / 11, cy / 11) - 0.5) * 2;
        z = WL + 0.55 + 0.2 * Math.min(d, 18) + n * 1.8 * amp;
      }
      if (cy < spec.northRidge) {
        const k = spec.northRidge - cy;
        z += k * k * 0.22;
      }
      if (cy > spec.southRidge) {
        const k = cy - spec.southRidge;
        z += k * k * 0.25;
      }
      for (const hill of spec.hills) {
        const dx = cx - hill.x, dy = cy - hill.y;
        const u = (dx * dx + dy * dy) / (hill.r * hill.r);
        if (u < 1) z += hill.h * (1 - u) * (1 - u);
      }
      corners[cy * (w + 1) + cx] = z;
    }
  }
  const water: number[] = new Array(w * h).fill(0);
  const cellH: number[] = new Array(w * h);
  const forest: number[] = new Array(w * h).fill(0);
  const field: number[] = new Array(w * h).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const isWater = riverDistance(spec, x + 0.5, y + 0.5) < 0;
      water[i] = isWater ? 1 : 0;
      const a = corners[y * (w + 1) + x]!, b = corners[y * (w + 1) + x + 1]!;
      const c = corners[(y + 1) * (w + 1) + x]!, d = corners[(y + 1) * (w + 1) + x + 1]!;
      cellH[i] = isWater ? WL + 0.95 : (a + b + c + d) / 4;
      if (!isWater) {
        const n = fbm(seed + 101, x / 6, y / 6);
        let f = 0;
        if (y < spec.forestNorthOf) f = (n - 0.32) * 2.6 + (spec.forestNorthOf - y) / 14;
        else f = (n - 0.66) * 3.2;
        if (riverDistance(spec, x + 0.5, y + 0.5) < 2) f -= 0.6;
        forest[i] = Math.max(0, Math.min(1, f));
      }
    }
  }
  for (const r of spec.fields) {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = y * w + x;
        if (!water[i]) {
          field[i] = 1;
          forest[i] = 0;
        }
      }
  }
  return { w, h, cellSize: CELL_SIZE, corners, cellH, water, forest, field, waterLevel: WL };
}
