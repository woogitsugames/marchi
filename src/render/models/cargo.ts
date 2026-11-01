/**
 * Cargo loads drawn on the wagon bed, one distinct silhouette per good (ART_DIRECTION §2):
 *  - wood   : long logs in a pyramid, overhanging the tailboard, light end grain
 *  - planks : flat stacked boards with spacer sticks, fresh-sawn colour
 *  - grain  : upright round sacks with tied necks (straw colour)
 *  - flour  : pale square sacks lying flat, stacked in two layers
 *  - bread  : wide wicker baskets heaped with ochre loaves
 *
 * Everything is in wagon rig space (see `WAGON` in `wagon.ts`): bed floor at y = 1.0, cargo
 * area z ∈ [−1.55, 1.0]. `cargoParts(good, qty)` gives a merged mesh per quantity (1..6, cache
 * these 30 variants and swap them per wagon); `cargoUnitParts` + `cargoSlots` support
 * per-unit instancing instead.
 */
import { Color, LatheGeometry, Matrix4, SphereGeometry, Vector2 } from 'three';
import { type ModelPart, PartBuilder, trs } from './kit';
import { box, logGeom } from './shapes';
import { WAGON } from './wagon';

export type CargoGood = 'wood' | 'planks' | 'grain' | 'flour' | 'bread';
export const CARGO_GOODS: CargoGood[] = ['wood', 'planks', 'grain', 'flour', 'bread'];
export const CARGO_MAX = 6;

const Y = WAGON.bedTopY;
const CRUST = new Color('#b8893a');

/** Placement of unit i (0-based) of `good` on the bed, rig space. */
export function cargoSlots(good: CargoGood): Matrix4[] {
  const out: Matrix4[] = [];
  switch (good) {
    case 'wood': {
      // 3 + 2 + 1 pyramid of logs along Z, overhanging the rear
      const r = 0.16;
      const pts: [number, number][] = [[-0.42, 0], [0.42, 0], [0, 0], [-0.21, 1], [0.21, 1], [0, 2]];
      for (const [x, row] of pts) out.push(trs(x, Y + r + row * r * 1.72, -0.45));
      break;
    }
    case 'planks':
      for (let i = 0; i < CARGO_MAX; i++) out.push(trs(0, Y + i * 0.125, -0.5));
      break;
    case 'grain':
    case 'bread': {
      const zs = [-1.18, -0.42, 0.34];
      for (let i = 0; i < CARGO_MAX; i++) out.push(trs(i % 2 ? 0.31 : -0.31, Y, zs[Math.floor(i / 2)], 0, i * 1.7));
      break;
    }
    case 'flour': {
      // bottom layer 2×2, top layer 2 crosswise in the middle
      const bottom: [number, number][] = [[-0.31, -0.95], [0.31, -0.95], [-0.31, 0.25], [0.31, 0.25]];
      for (const [x, z] of bottom) out.push(trs(x, Y + 0.13, z, 0, 0.03 * x));
      out.push(trs(0, Y + 0.38, -0.95 + 0.25, 0, Math.PI / 2 + 0.05));
      out.push(trs(0, Y + 0.38, 0.0 + 0.1, 0, Math.PI / 2 - 0.06));
      break;
    }
  }
  return out;
}

/** Rounded "pillow" box from a sphere pushed toward a superellipsoid (smooth, cheap sack). */
function pillow(w: number, h: number, d: number, ws = 8, hs = 6): SphereGeometry {
  const g = new SphereGeometry(1, ws, hs);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const sq = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 0.45);
    p.setXYZ(i, sq(p.getX(i)) * w / 2, sq(p.getY(i)) * h / 2, sq(p.getZ(i)) * d / 2);
  }
  g.computeVertexNormals();
  return g;
}

/** Add one unit of a good at transform `m`. */
function addUnit(b: PartBuilder, good: CargoGood, m: Matrix4): void {
  switch (good) {
    case 'wood': {
      const len = 3.0 + b.r(-0.15, 0.2);
      logGeom(b, m.clone().multiply(trs(0, 0, b.r(-0.12, 0.12), Math.PI / 2, 0, 0)), 0.15 + b.r(-0.012, 0.015), len, 10);
      break;
    }
    case 'planks': {
      // one unit = 2 courses of 4 boards on two spacer sticks
      for (const z of [-0.9, 0.9]) box(b, 'wood', 1.25, 0.03, 0.06, m.clone().multiply(trs(0, 0.015, z)), { color: '#5b4a39', ao: 0, dirt: 0 });
      for (let c = 0; c < 2; c++) {
        for (let k = 0; k < 4; k++) {
          const x = -0.465 + k * 0.31 + b.r(-0.01, 0.01);
          const len = 2.85 + b.r(-0.14, 0.08);
          box(b, 'wood', 0.295, 0.042, len, m.clone().multiply(trs(x, 0.03 + 0.021 + c * 0.046, b.r(-0.06, 0.06), 0, b.r(-0.006, 0.006))), {
            color: '#a88d68',
            vary: 0.08,
            noise: 0.05,
            ao: 0,
            dirt: 0,
            shade: (_p, n, col) => {
              if (Math.abs(n.z) > 0.7) col.set('#bfa47c'); // sawn ends lighter
              else if (Math.abs(n.x) > 0.7) col.multiplyScalar(0.72); // edges in shadow
            },
          });
        }
      }
      break;
    }
    case 'grain': {
      // upright round sack: lumpy lathe, tied neck with a folded-over tuft
      const h = 0.62 + b.r(-0.04, 0.04);
      const prof = [
        [0.001, 0], [0.22, 0.03], [0.27, 0.18], [0.25, 0.38], [0.15, h - 0.08], [0.055, h], [0.09, h + 0.07], [0.001, h + 0.1],
      ].map(([r, y]) => new Vector2(r, y));
      b.add('cloth', new LatheGeometry(prof, 9), {
        color: '#9c8458',
        m: m.clone().multiply(trs(0, 0, 0, b.r(-0.08, 0.08), 0, b.r(-0.08, 0.08), 1, 1, 0.9)),
        jitter: 0.025,
        jitterFreq: 4,
        renormal: true,
        noise: 0.1,
        ao: 0,
        dirt: 0,
        shade: (p, _n, c) => {
          const yy = p.y - Y;
          if (yy > h - 0.03 && yy < h + 0.02) c.set('#4c3e2e'); // twine
        },
      });
      break;
    }
    case 'flour': {
      b.add('cloth', pillow(0.56, 0.26, 1.0), {
        color: '#aaa18c',
        m: m.clone().multiply(trs(0, 0, 0, 0, 0, b.r(-0.04, 0.04))),
        jitter: 0.015,
        jitterFreq: 3,
        renormal: true,
        noise: 0.05,
        ao: 0,
        dirt: 0,
        shade: (_p, n, c) => {
          if (n.y < -0.3) c.multiplyScalar(0.7);
        },
      });
      // tied corner ear
      b.add('cloth', new SphereGeometry(0.05, 5, 3), { color: '#9f9783', m: m.clone().multiply(trs(0.2, 0.03, 0.5, 0, 0, 0, 1, 0.7, 1.4)), ao: 0, dirt: 0 });
      break;
    }
    case 'bread': {
      // wide wicker basket (open lathe with a rolled rim) heaped with ochre loaves
      const prof = [[0.001, 0.0], [0.22, 0.0], [0.28, 0.27], [0.31, 0.3], [0.26, 0.29], [0.001, 0.12]].map(([r, y]) => new Vector2(r, y));
      b.add('wood', new LatheGeometry(prof, 9), {
        color: '#7a6242',
        m,
        noise: 0.18,
        noiseFreq: 14,
        ao: 0,
        dirt: 0,
        jitter: 0.008,
        jitterFreq: 8,
      });
      const loaves: [number, number, number, number][] = [[-0.1, 0.22, 0.07, 0.16], [0.12, 0.22, -0.05, 0.15], [0.02, 0.3, 0.0, 0.14]];
      for (const [x, y, z, r] of loaves) {
        b.add('cloth', new SphereGeometry(1, 6, 3, 0, Math.PI * 2, 0, Math.PI * 0.55), {
          color: '#a67a3d',
          m: m.clone().multiply(trs(x, y, z, b.r(-0.25, 0.25), b.r(0, 3), b.r(-0.25, 0.25), r, r * 0.72, r * 1.2)),
          ao: 0,
          dirt: 0,
          noise: 0.12,
          noiseFreq: 10,
          shade: (_p, n, c) => {
            if (n.y < 0.2) c.multiplyScalar(0.75); // underside darker
            else c.lerp(CRUST, 0.35); // crust highlight
          },
        });
      }
      break;
    }
  }
}

const cache = new Map<string, ModelPart[]>();

/** Merged cargo mesh for `qty` units (0 → empty list). Cached; do not dispose. */
export function cargoParts(good: CargoGood, qty: number): ModelPart[] {
  const n = Math.max(0, Math.min(CARGO_MAX, Math.round(qty)));
  if (n === 0) return [];
  const key = `${good}:${n}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const b = new PartBuilder({ seed: 101 + CARGO_GOODS.indexOf(good) * 7, ao: 0, dirt: 0 });
  const slots = cargoSlots(good);
  for (let i = 0; i < n; i++) addUnit(b, good, slots[i]);
  const parts = b.build();
  cache.set(key, parts);
  return parts;
}

/** One unit at the origin (slot transforms come from `cargoSlots`), for per-unit instancing. */
export function cargoUnitParts(good: CargoGood): ModelPart[] {
  const b = new PartBuilder({ seed: 201 + CARGO_GOODS.indexOf(good), ao: 0, dirt: 0 });
  addUnit(b, good, new Matrix4());
  return b.build();
}
