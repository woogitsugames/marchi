/**
 * Cargo loads drawn on the wagon bed, one distinct silhouette per good (ART_DIRECTION §2):
 *  - wood   : long logs in a pyramid, overhanging the tailboard, light end grain
 *  - planks : flat stacked boards with spacer sticks, fresh-sawn colour
 *  - grain  : upright round sacks with tied necks (straw colour)
 *  - flour  : pale square sacks lying flat, stacked in two layers
 *  - bread  : wide wicker baskets heaped with ochre loaves
 *  - fish   : tall narrow wicker creels with fish tails sticking out of the open tops
 *  - stone  : rough grey blocks, low and heavy (a wagon carries 4), two-by-two on the floor
 *  - charcoal: black sacks standing open, heaped with dull lumps
 *  - malt   : small pale tied bags lying in pairs, necks opposite (smaller than grain/flour)
 *  - beer   : barrels lying lengthwise, four on the floor and two nested on top
 *  - crate  : fallback for a good without its own load (plain crates)
 *
 * Everything is in wagon rig space (see `WAGON` in `wagon.ts`): bed floor at y = 1.0, cargo
 * area z ∈ [−1.55, 1.0]. `cargoParts(good, qty)` gives a merged mesh per quantity (1..6, cache
 * these 30 variants and swap them per wagon); `cargoUnitParts` + `cargoSlots` support
 * per-unit instancing instead.
 */
import { Box3, BoxGeometry, Color, CylinderGeometry, LatheGeometry, Matrix4, SphereGeometry, Vector2 } from 'three';
import { creel, fishGeom } from './chains';
import { type ModelPart, PartBuilder, prim, trs } from './kit';
import { box, logGeom } from './shapes';
import { WAGON } from './wagon';

export type CargoGood = 'wood' | 'planks' | 'grain' | 'flour' | 'bread' | 'fish' | 'stone' | 'charcoal' | 'malt' | 'beer' | 'crate';
/** Every load the wagon can draw (goods in chain order, then the `crate` fallback). */
export const CARGO_GOODS: CargoGood[] = ['wood', 'planks', 'grain', 'flour', 'bread', 'fish', 'stone', 'charcoal', 'malt', 'beer', 'crate'];
export const CARGO_MAX = 6;

/** The load drawn for a sim good id; unknown goods get plain crates instead of nothing. */
export function cargoFor(good: string): CargoGood {
  return (CARGO_GOODS as string[]).includes(good) ? (good as CargoGood) : 'crate';
}

const Y = WAGON.bedTopY;
const CRUST = new Color('#b8893a');

const yardCache = new Map<CargoGood, Matrix4>();
/**
 * From a yard pile's base (ground point and turn, see BuildingModel.yard) to the cargo slot space: the wagon-bed
 * arrangement of `cargoSlots` set down on the ground, centred on the base (D-71). Units and order are the
 * wagon's, so the pile reads as "one load waiting".
 */
export function yardPileLocal(good: CargoGood): Matrix4 {
  let m = yardCache.get(good);
  if (m) return m;
  // centred on the full load's ground footprint (day 2): the slot centres alone left the barrels, whose unit
  // geometry is not centred on its slot, half a metre off the spot
  const unit = new Box3();
  for (const p of cargoUnitParts(good)) { p.geometry.computeBoundingBox(); unit.union(p.geometry.boundingBox!); }
  const pile = new Box3();
  for (const t of cargoSlots(good)) pile.union(unit.clone().applyMatrix4(t));
  m = new Matrix4().makeTranslation(-(pile.min.x + pile.max.x) / 2, -Y, -(pile.min.z + pile.max.z) / 2);
  yardCache.set(good, m);
  return m;
}

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
    case 'bread':
    case 'fish':
    case 'charcoal': {
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
    case 'stone': {
      // heavy load: 2×2 low on the floor over the axles, extras (never more than 4 in the sim) between
      const pts: [number, number, number][] = [[-0.3, Y, -1.0], [0.3, Y, -1.0], [-0.3, Y, 0.1], [0.3, Y, 0.1], [0, Y + 0.5, -0.45], [0, Y, 0.85]];
      pts.forEach(([x, y, z], i) => out.push(trs(x, y, z, 0, (i % 3) * 0.06 - 0.06)));
      break;
    }
    case 'malt':
    case 'crate': {
      const pts: [number, number, number][] = [[-0.3, Y, -1.1], [0.3, Y, -1.1], [-0.3, Y, -0.35], [0.3, Y, -0.35], [-0.3, Y, 0.4], [0.3, Y, 0.4]];
      pts.forEach(([x, y, z], i) => out.push(trs(x, y, z, 0, good === 'crate' ? 0 : i * 0.9)));
      break;
    }
    case 'beer': {
      // lying barrels along Z: 2×2 on the floor, then two nested in the grooves on top
      const r = 0.31, top = Y + r + Math.sqrt((2 * r) ** 2 - r * r) * 0.98;
      const pts: [number, number, number][] = [[-r, Y + r, -1.05], [r, Y + r, -1.05], [-r, Y + r, -0.15], [r, Y + r, -0.15], [0, top, -1.05], [0, top, -0.15]];
      for (const [x, y, z] of pts) out.push(trs(x, y, z));
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
  if (addChainUnit(b, good, m)) return;
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
      b.add('cloth', prim(SphereGeometry, 0.05, 5, 3), { color: '#9f9783', m: m.clone().multiply(trs(0.2, 0.03, 0.5, 0, 0, 0, 1, 0.7, 1.4)), ao: 0, dirt: 0 });
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
        b.add('cloth', prim(SphereGeometry, 1, 6, 3, 0, Math.PI * 2, 0, Math.PI * 0.55), {
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

/** A unit of the D-29 chain goods (and the crate fallback); returns false for other goods. */
function addChainUnit(b: PartBuilder, good: CargoGood, m: Matrix4): boolean {
  switch (good) {
    case 'fish': {
      // tall creel, three or four tails poking up out of it at angles
      creel(b, m.clone().multiply(trs(0, 0, 0, b.r(-0.05, 0.05), 0, b.r(-0.05, 0.05))), 0.6 + b.r(-0.03, 0.03), 0.25, '#6a573d');
      const n = 3;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + b.r(0, 1);
        // head down in the basket, tail out: fishGeom grows along +Y from its nose
        fishGeom(b, m.clone().multiply(trs(Math.cos(a) * 0.09, 0.32, Math.sin(a) * 0.09, Math.sin(a) * 0.45, b.r(0, 3), -Math.cos(a) * 0.45)), 0.42);
      }
      return true;
    }
    case 'stone': {
      const w = 0.56 + b.r(-0.05, 0.03), h = 0.5 + b.r(-0.04, 0.04), d = 0.66 + b.r(-0.06, 0.06);
      b.add('stone', prim(BoxGeometry, w, h, d, 2, 2, 2), {
        color: '#5f5e59',
        m: m.clone().multiply(trs(0, h / 2, 0, b.r(-0.04, 0.04), 0, b.r(-0.04, 0.04))),
        jitter: 0.075,
        jitterFreq: 2.8,
        renormal: true,
        noise: 0.22,
        noiseFreq: 5,
        ao: 0,
        dirt: 0,
        shade: (_p, n, c) => {
          if (n.y > 0.6) c.multiplyScalar(1.08); // top catches the light
          else if (n.y < -0.3) c.multiplyScalar(0.65);
          else c.multiplyScalar(0.88);
        },
      });
      return true;
    }
    case 'charcoal': {
      // upright black sack, mouth rolled open, heaped with lumps
      const h = 0.58 + b.r(-0.03, 0.03);
      const prof = [[0.001, 0], [0.21, 0.02], [0.26, 0.16], [0.25, 0.4], [0.22, h - 0.04], [0.25, h], [0.2, h + 0.02], [0.001, h - 0.02]].map(([r, y]) => new Vector2(r, y));
      b.add('cloth', new LatheGeometry(prof, 9), {
        color: '#2c2926',
        m: m.clone().multiply(trs(0, 0, 0, b.r(-0.06, 0.06), 0, b.r(-0.06, 0.06))),
        jitter: 0.02,
        jitterFreq: 4,
        renormal: true,
        noise: 0.12,
        ao: 0,
        dirt: 0,
      });
      b.add('stone', prim(SphereGeometry, 1, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), {
        color: '#1f1d1c',
        m: m.clone().multiply(trs(0, h - 0.04, 0, 0, b.r(0, 3), 0, 0.2, 0.12, 0.2)),
        jitter: 0.03,
        jitterFreq: 14,
        noise: 0.35,
        noiseFreq: 12,
        ao: 0,
        dirt: 0,
      });
      return true;
    }
    case 'malt': {
      // a squat open tub of staves with two dark hoops, heaped with amber kilned malt (D-201): a round low drum with a
      // bright domed top reads apart from the upright grain sacks, the flat flour sacks and the bread baskets
      const prof = [[0.001, 0.02], [0.22, 0.02], [0.23, 0], [0.27, 0.34], [0.25, 0.35], [0.22, 0.04]].map(([r, y]) => new Vector2(r, y));
      b.add('wood', new LatheGeometry(prof, 10), {
        color: '#6e5a42',
        m,
        noise: 0.14,
        noiseFreq: 16,
        ao: 0,
        dirt: 0,
      });
      for (const [y, r] of [[0.07, 0.237], [0.27, 0.26]] as const) {
        b.add('metal', prim(CylinderGeometry, r, r, 0.035, 10, 1, true), { color: '#34302c', m: m.clone().multiply(trs(0, y, 0)), ao: 0, dirt: 0 });
      }
      b.add('cloth', prim(SphereGeometry, 1, 9, 3, 0, Math.PI * 2, 0, Math.PI / 2), {
        color: '#a8834a',
        m: m.clone().multiply(trs(0, 0.32, 0, 0, b.r(0, 3), 0, 0.25, 0.13, 0.25)),
        jitter: 0.012,
        jitterFreq: 10,
        noise: 0.3,
        noiseFreq: 18,
        ao: 0,
        dirt: 0,
      });
      return true;
    }
    case 'beer': {
      // barrel on its side along Z: bulging staves, two dark iron hoops each end, a bung
      const prof = [[0.001, 0], [0.25, 0], [0.25, 0.03], [0.29, 0.2], [0.31, 0.415], [0.29, 0.63], [0.25, 0.8], [0.25, 0.83], [0.001, 0.83]].map(([r, y]) => new Vector2(r * 0.97, y * 0.95));
      // lay it along Z, then roll it about its own axis (the staves and bung turn, the barrel stays on its slot);
      // a yaw in the same Euler turned the whole barrel in a random direction, half out over the side boards
      const mm = m.clone().multiply(trs(0, 0, -0.39, Math.PI / 2)).multiply(trs(0, 0, 0, 0, b.r(0, 3), 0));
      b.add('wood', new LatheGeometry(prof, 12), {
        color: '#6a5641',
        m: mm,
        noise: 0.12,
        noiseFreq: 9,
        ao: 0,
        dirt: 0,
        shade: (_p, n, c) => {
          if (Math.abs(n.z) > 0.9) c.set('#5a4836'); // heads
        },
      });
      const rAt = (y: number): number => {
        for (let i = 1; i < prof.length; i++) {
          const p0 = prof[i - 1]!, p1 = prof[i]!;
          if (y <= p1.y) return p0.x + ((p1.x - p0.x) * (y - p0.y)) / Math.max(1e-6, p1.y - p0.y);
        }
        return prof[prof.length - 1]!.x;
      };
      for (const f of [0.12, 0.27, 0.73, 0.88]) {
        const y = f * 0.83 * 0.95, r = rAt(y) + 0.006;
        b.add('metal', prim(CylinderGeometry, r, r, 0.035, 12, 1, true), { color: '#34302c', m: mm.clone().multiply(trs(0, y, 0)), ao: 0, dirt: 0 });
      }
      return true;
    }
    case 'crate': {
      box(b, 'wood', 0.55, 0.45, 0.6, m.clone().multiply(trs(0, 0.225, 0)), { color: '#5e4e3d', ao: 0, dirt: 0, shade: (_p, n, c) => { if (n.y > 0.6) c.multiplyScalar(1.15); } });
      for (const s of [-1, 1]) box(b, 'wood', 0.6, 0.07, 0.05, m.clone().multiply(trs(0, 0.3, s * 0.3)), { color: '#74624b', ao: 0, dirt: 0 });
      return true;
    }
    default:
      return false;
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

const unitCache = new Map<CargoGood, ModelPart[]>();

/** One unit at the origin (slot transforms come from `cargoSlots`), for per-unit instancing. Cached; do not dispose. */
export function cargoUnitParts(good: CargoGood): ModelPart[] {
  const hit = unitCache.get(good);
  if (hit) return hit;
  const b = new PartBuilder({ seed: 201 + CARGO_GOODS.indexOf(good), ao: 0, dirt: 0 });
  addUnit(b, good, new Matrix4());
  const parts = b.build();
  unitCache.set(good, parts);
  return parts;
}
