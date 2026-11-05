/**
 * Buildings and yard props, built procedurally at real scale.
 *
 * Frame: origin at the centre of the building's grid footprint on the ground, front (gate side)
 * facing +Z. Footprints are whole 4 m cells (`cells` = [along X, along Z]). The gate cell lies
 * just outside the footprint at +Z; doors face it.
 *
 * Style: late-14th-century Central European vernacular — log and half-timbered houses with
 * wattle-and-daub infill on field-stone plinths, steep (45–50°) thatched or split-shingle
 * roofs with thick ragged eaves, a stone castle with a square keep.
 */
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Matrix4,
  Path,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { fnoise, type ModelPart, PartBuilder, smoothstep, trs, v3 } from './kit';
import { brewery, charcoalBurner, fisher, malthouse, quarry } from './chains';
import { addHuman, HUMAN_STYLES, type WorkerKind } from './people';
import {
  beam,
  box,
  door,
  fenceRun,
  gableRoof,
  logGeom,
  logPile,
  type Opts,
  rod,
  type RoofSpec,
  ridgeY,
  thatchRoof,
  type ThatchSpec,
  thatchUnderY,
  timberFrame,
  wattleRun,
  windowHole,
} from './shapes';

export type BuildingKind =
  | 'woodcutter'
  | 'sawmill'
  | 'farm'
  | 'mill'
  | 'bakery'
  | 'warehouse'
  | 'stable'
  | 'castle'
  // D-29 production chains (models in `chains.ts`)
  | 'fisher'
  | 'quarry'
  | 'charcoalBurner'
  | 'malthouse'
  | 'brewery'
  // free valley late game (D-170): the trading post across the river
  | 'tradePost';
/** The D-29 chain buildings (fish, stone, charcoal, malt → beer). */
export const CHAIN_KINDS: BuildingKind[] = ['fisher', 'quarry', 'charcoalBurner', 'malthouse', 'brewery'];
export const BUILDING_KINDS: BuildingKind[] = ['woodcutter', 'sawmill', 'farm', 'mill', 'bakery', 'warehouse', 'stable', 'castle', ...CHAIN_KINDS, 'tradePost'];

export type PropKind = 'fence' | 'haystack' | 'barrel' | 'crate';
export const PROP_KINDS: PropKind[] = ['fence', 'haystack', 'barrel', 'crate'];

export interface BuildingModel {
  kind: BuildingKind;
  /** Footprint in 4 m cells: [x, z]. */
  cells: [number, number];
  parts: ModelPart[];
  /** Rotating part (watermill wheel): geometry centred on its axle, rotate around `axis`. */
  wheel?: { parts: ModelPart[]; pivot: Vector3; axis: 'x' | 'z' };
  /** Door / gate point on the footprint edge (model space). */
  gate: Vector3;
  /** Chimney/smoke emitter point, if any. */
  smoke?: Vector3;
  /**
   * Animated workers in the yard (render-only): where the feet stand (y = height above the yard, e.g. on the
   * sawmill's log or the fisher's landing stage) and the facing (model space).
   */
  workers?: WorkerSpot[];
  /**
   * A worker out in the fields (render-only, night 6): stands on the nearest tilled field cell next to the
   * building; `at`/`yaw` is the fallback spot in the yard when the map has no field nearby.
   */
  fieldWorker?: WorkerSpot;
  /**
   * Yard pile of the building's output (render-only, decision 15 / D-71): where the units stand on the ground and
   * their turn (model space). Drawn per frame from the building's stock with the wagons' cargo instances.
   */
  yard?: { at: Vector3; yaw: number };
  /**
   * More yard spots for a building without its own output (day 2, D-79): the warehouse shows its two largest
   * stocks, the contract castle one pile per ordered good (filling as the order comes in). Same units and
   * layout as `yard`.
   */
  piles?: { at: Vector3; yaw: number }[];
}

export interface WorkerSpot { kind: WorkerKind; at: Vector3; yaw: number }

export const BUILDING_CELLS: Record<BuildingKind, [number, number]> = {
  woodcutter: [2, 2],
  sawmill: [3, 2],
  farm: [3, 3],
  mill: [2, 2],
  bakery: [2, 2],
  warehouse: [3, 2],
  stable: [3, 2],
  castle: [4, 4],
  fisher: [2, 2],
  quarry: [3, 2],
  charcoalBurner: [2, 2],
  malthouse: [2, 2],
  brewery: [3, 2],
  tradePost: [4, 4],
};

// palette (sRGB)
export const C = {
  timber: '#4e4134',
  timberLight: '#6a5a48',
  boards: '#5a4f43',
  boardsDark: '#3a322a',
  daub: '#a99f88',
  thatch: '#776549',
  thatchRidge: '#5c4f3e',
  shingle: '#5a5248',
  stone: '#7b766b',
  stoneDark: '#646057',
  hay: '#9a8058',
  clay: '#8c4a2f',
};

const STREAK = new Color('#4f4b44');
/** Daub weathering: mud splashed up from the yard, and the grey-brown of rain run-off. */
const SPLASH = new Color('#6f6250');
const RUNOFF = new Color('#857b69');
export const SOOT = new Color('#2e2a26');
export const stoneO = (color = C.stone): Opts => ({
  color,
  jitter: 0.04,
  jitterFreq: 2.2,
  noise: 0.2,
  noiseFreq: 1.6,
  vary: 0.05,
  dirt: 0.35,
  shade: (p, n, c) => {
    // vertical rain streaks and lichen-dark patches on walls, lighter weathered tops
    if (Math.abs(n.y) < 0.5) {
      const st = fnoise(p.x * 2.6 + p.z * 2.6, p.y * 0.18, 0.3, 41);
      if (st > 0.1) c.lerp(STREAK, Math.min(0.55, (st - 0.1) * 1.4));
    } else if (n.y > 0.5) c.multiplyScalar(1.08);
    const blot = fnoise(p.x * 0.6, p.y * 0.6, p.z * 0.6, 42);
    if (blot > 0.2) c.multiplyScalar(1 - (blot - 0.2) * 0.6);
  },
});

// -------------------------------------------------------------------------------------------
// Generic house
// -------------------------------------------------------------------------------------------

export interface HouseSpec {
  cx: number;
  cz: number;
  /** Length along X (ridge direction) and depth along Z. */
  len: number;
  dep: number;
  wallH: number;
  plinth: number;
  pitch: number;
  roof: 'thatch' | 'shingle';
  walls: 'daub' | 'boards' | 'logs';
  door?: { u: number; w: number; h: number; open?: boolean };
  windows?: { side: 'front' | 'back' | 'left' | 'right'; u: number; y: number }[];
  overhang?: number;
  roofColor?: string;
  /** Thatch gable treatment (default half-hip). */
  hip?: 'gable' | 'half' | 'full';
  /** Raise the floor on timber stilts (plinth height) instead of a stone plinth. */
  stilts?: boolean;
}

export function house(b: PartBuilder, s: HouseSpec): void {
  const x0 = s.cx - s.len / 2, x1 = s.cx + s.len / 2;
  const z0 = s.cz - s.dep / 2, z1 = s.cz + s.dep / 2;
  const pt = s.plinth;
  if (s.stilts) {
    // plank floor on a grid of round posts, with a sill beam on top
    const nx = Math.max(2, Math.round(s.len / 1.4)), nz = Math.max(2, Math.round(s.dep / 1.4));
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
      const x = x0 + 0.1 + (i / nx) * (s.len - 0.2), z = z0 + 0.1 + (j / nz) * (s.dep - 0.2);
      rod(b, 'wood', v3(x + b.r(-0.03, 0.03), -0.3, z), v3(x, pt - 0.1, z), 0.11, 0.09, 6, { color: C.timber, vary: 0.12, jitter: 0.01 });
    }
    box(b, 'wood', s.len + 0.3, 0.12, s.dep + 0.3, trs(s.cx, pt - 0.06, s.cz), { color: C.timberLight, ao: 0.1, noise: 0.12 }, 0.4);
  } else {
    // stone plinth
    box(b, 'stone', s.len + 0.24, pt + 0.15, s.dep + 0.24, trs(s.cx, (pt - 0.15) / 2, s.cz), stoneO(), 0.45);
  }
  const h = s.wallH - pt;
  const openFront = s.door ? [{ u0: s.door.u + s.len / 2 - s.door.w / 2, u1: s.door.u + s.len / 2 + s.door.w / 2, v0: 0, v1: s.door.h }] : [];
  const winOpenings = (side: string, length: number) =>
    (s.windows ?? []).filter((w) => w.side === side).map((w) => ({ u0: w.u + length / 2 - 0.3, u1: w.u + length / 2 + 0.3, v0: w.y - pt - 0.25, v1: w.y - pt + 0.25 }));

  if (s.walls === 'daub') {
    box(b, 'plaster', s.len - 0.06, h, s.dep - 0.06, trs(s.cx, pt + h / 2, s.cz), {
      color: C.daub,
      noise: 0.09,
      noiseFreq: 1.1,
      jitter: 0.012,
      dirt: 0.45,
      ao: 0.3,
      shade: (p, n, c) => {
        // wear on the limewash: rain-splashed mud over the plinth (the base dirt is measured from
        // the ground, so a wall on a tall plinth stayed spotless), grey run-off streaks below the
        // wall plate, and patchy fresher limewash
        const yy = p.y - pt;
        c.lerp(SPLASH, 0.3 * (1 - smoothstep(0, 0.6, yy)));
        if (Math.abs(n.y) < 0.5) {
          const along = Math.abs(n.z) > Math.abs(n.x) ? p.x : p.z;
          const st = fnoise(along * 2.9, p.y * 0.22, 0.7, 51);
          if (st > 0.08) c.lerp(RUNOFF, Math.min(0.45, (st - 0.08) * 1.4) * smoothstep(h * 0.3, h, yy));
        }
        const lw = fnoise(p.x * 0.7, p.y * 0.7, p.z * 0.7, 52);
        if (lw > 0.25) c.multiplyScalar(1 + (lw - 0.25) * 0.22);
      },
    }, 0.5);
    timberFrame(b, v3(x0, pt, z1), v3(1, 0, 0), v3(0, 0, 1), s.len, h, C.timber, [...openFront, ...winOpenings('front', s.len)]);
    timberFrame(b, v3(x1, pt, z0), v3(-1, 0, 0), v3(0, 0, -1), s.len, h, C.timber, winOpenings('back', s.len));
    timberFrame(b, v3(x0, pt, z0), v3(0, 0, 1), v3(-1, 0, 0), s.dep, h, C.timber, winOpenings('left', s.dep));
    timberFrame(b, v3(x1, pt, z1), v3(0, 0, -1), v3(1, 0, 0), s.dep, h, C.timber, winOpenings('right', s.dep));
  } else if (s.walls === 'boards') {
    box(b, 'wood', s.len - 0.06, h, s.dep - 0.06, trs(s.cx, pt + h / 2, s.cz), { color: C.boardsDark, noise: 0.1, ao: 0.4, dirt: 0.3 }, 0.8);
    const bat = (o: Vector3, along: Vector3, out: Vector3, length: number, skip: { u0: number; u1: number }[]) => {
      const n = Math.round(length / 0.34);
      for (let i = 0; i <= n; i++) {
        const u = (i / n) * length;
        if (skip.some((q) => u > q.u0 - 0.05 && u < q.u1 + 0.05)) continue;
        const p = o.clone().addScaledVector(along, u).addScaledVector(out, 0.02);
        box(b, 'wood', 0.2, h, 0.035, new Matrix4().makeBasis(along, v3(0, 1, 0), out).setPosition(p.x, pt + h / 2, p.z), {
          color: C.boards,
          vary: 0.12,
          noise: 0.08,
          dirt: 0.4,
          shade: (q, _n, c) => c.multiplyScalar(0.85 + 0.15 * Math.min(1, (q.y - pt) / 0.6)),
        });
      }
      beam(b, 'wood', o.clone().setY(pt + 0.08).addScaledVector(out, 0.05), o.clone().setY(pt + 0.08).addScaledVector(along, length).addScaledVector(out, 0.05), 0.16, 0.16, { color: C.timber }, out);
      beam(b, 'wood', o.clone().setY(s.wallH - 0.08).addScaledVector(out, 0.05), o.clone().setY(s.wallH - 0.08).addScaledVector(along, length).addScaledVector(out, 0.05), 0.16, 0.16, { color: C.timber }, out);
    };
    bat(v3(x0, 0, z1), v3(1, 0, 0), v3(0, 0, 1), s.len, openFront);
    bat(v3(x1, 0, z0), v3(-1, 0, 0), v3(0, 0, -1), s.len, []);
    bat(v3(x0, 0, z0), v3(0, 0, 1), v3(-1, 0, 0), s.dep, []);
    bat(v3(x1, 0, z1), v3(0, 0, -1), v3(1, 0, 0), s.dep, []);
    for (const [x, z] of [[x0, z0], [x0, z1], [x1, z0], [x1, z1]]) beam(b, 'wood', v3(x, pt, z), v3(x, s.wallH, z), 0.2, 0.2, { color: C.timber });
  } else {
    // horizontal logs, saddle-notched corners projecting 0.25 m; side walls continue into log gables
    const r = 0.14;
    const sp = r * 1.8;
    const tanP = Math.tan((s.pitch * Math.PI) / 180);
    const half = s.dep / 2;
    const courses = Math.ceil(h / sp);
    const gableCourses = Math.ceil((half * tanP) / sp);
    for (let k = 0; k < courses + gableCourses; k++) {
      const yFB = pt + r + k * sp;
      const ySide = yFB + sp / 2;
      if (k < courses) {
        for (const z of [z0, z1]) {
          const doorCut = z === z1 && s.door && yFB < pt + s.door.h;
          if (doorCut && s.door) {
            const dx0 = s.cx + s.door.u - s.door.w / 2, dx1 = s.cx + s.door.u + s.door.w / 2;
            logBetween(b, x0 - 0.28, dx0, yFB, z, r);
            logBetween(b, dx1, x1 + 0.28, yFB, z, r);
          } else logBetween(b, x0 - 0.28 - b.r(0, 0.06), x1 + 0.28 + b.r(0, 0.06), yFB, z, r);
        }
      }
      for (const x of [x0, x1]) {
        const above = ySide - s.wallH;
        const hl = above > 0 ? half + 0.28 - above / tanP : half + 0.28;
        if (hl < 0.2) continue;
        const m = trs(x, ySide, s.cz, Math.PI / 2, 0, 0);
        logGeom(b, m, r * (0.95 + b.r(0, 0.1)), hl * 2, 8);
      }
    }
    // door frame planks
    if (s.door) {
      const dx = s.cx + s.door.u;
      for (const sx of [-1, 1]) box(b, 'wood', 0.1, s.door.h, 0.3, trs(dx + sx * (s.door.w / 2 + 0.05), pt + s.door.h / 2, z1), { color: C.timberLight });
      box(b, 'wood', s.door.w + 0.3, 0.14, 0.32, trs(dx, pt + s.door.h + 0.07, z1), { color: C.timberLight });
    }
  }

  const hip = s.hip ?? 'half';
  const thatchSpec: ThatchSpec = {
    x0, x1, z0, z1, eaveY: s.wallH, pitchDeg: s.pitch, overhang: s.overhang ?? 0.6, hip,
    thickness: 0.42, ragged: 0.2, color: s.roofColor ?? C.thatch, ridgeColor: C.thatchRidge,
  };
  // gable boards for framed/board houses (logs make their own gables), clipped under the roof
  if (s.walls !== 'logs' && !(s.roof === 'thatch' && hip === 'full')) {
    const tanP = Math.tan((s.pitch * Math.PI) / 180);
    const half = s.dep / 2;
    for (const [x, sx] of [[x0, -1], [x1, 1]] as const) {
      const n = Math.round(s.dep / 0.26);
      for (let i = 0; i < n; i++) {
        const z = z0 + (i + 0.5) * (s.dep / n);
        const top = s.roof === 'thatch' ? thatchUnderY(thatchSpec, x, z) : s.wallH + (half - Math.abs(z - s.cz)) * tanP;
        const hh = top - s.wallH + 0.05;
        if (hh < 0.08) continue;
        box(b, 'wood', 0.04, hh, s.dep / n - 0.01, trs(x + sx * 0.03, s.wallH - 0.05 + hh / 2, z), { color: C.boards, vary: 0.14, noise: 0.08, ao: 0 });
      }
      // collar beam across the gable
      beam(b, 'wood', v3(x + sx * 0.07, s.wallH, z0 - 0.1), v3(x + sx * 0.07, s.wallH, z1 + 0.1), 0.16, 0.18, { color: C.timber });
    }
  }

  // door and windows
  if (s.door) {
    const dc = v3(s.cx + s.door.u, pt + s.door.h / 2, z1 + (s.walls === 'logs' ? -0.06 : 0.0));
    if (s.door.open) {
      box(b, 'wood', s.door.w, s.door.h, 0.05, trs(dc.x, dc.y, dc.z - 0.02), { color: '#1d1813', vary: 0, ao: 0, dirt: 0 });
    } else door(b, dc, v3(0, 0, 1), s.door.w, s.door.h);
    // threshold stone, or plank steps up to a raised floor
    if (!s.stilts) box(b, 'stone', s.door.w + 0.4, 0.12, 0.5, trs(dc.x, 0.06, z1 + 0.3), stoneO(C.stoneDark));
    else {
      const n = Math.max(2, Math.round(pt / 0.3));
      for (let i = 0; i < n; i++) {
        const y = pt - (i + 1) * (pt / (n + 0.4));
        box(b, 'wood', s.door.w + 0.2, 0.06, 0.3, trs(dc.x, y, z1 + 0.25 + i * 0.27), { color: C.timberLight, ao: 0.1 });
      }
      for (const sx of [-1, 1]) beam(b, 'wood', v3(dc.x + sx * (s.door.w / 2 + 0.12), pt, z1 + 0.05), v3(dc.x + sx * (s.door.w / 2 + 0.12), 0, z1 + 0.3 + n * 0.27), 0.07, 0.16, { color: C.timber });
    }
  }
  for (const w of s.windows ?? []) {
    const out = w.side === 'front' ? v3(0, 0, 1) : w.side === 'back' ? v3(0, 0, -1) : w.side === 'left' ? v3(-1, 0, 0) : v3(1, 0, 0);
    const c = w.side === 'front' ? v3(s.cx + w.u, w.y, z1 + 0.01) : w.side === 'back' ? v3(s.cx - w.u, w.y, z0 - 0.01) : w.side === 'left' ? v3(x0 - 0.01, w.y, s.cz + w.u) : v3(x1 + 0.01, w.y, s.cz - w.u);
    if (s.walls === 'logs') c.addScaledVector(out, r0());
    windowHole(b, c, out);
  }

  if (s.roof === 'thatch') {
    thatchRoof(b, thatchSpec);
    return;
  }
  const roof: RoofSpec = {
    x0,
    x1,
    z0,
    z1,
    eaveY: s.wallH,
    pitchDeg: s.pitch,
    thickness: 0.08,
    overhang: s.overhang ?? 0.45,
    gableOverhang: 0.3,
    ragged: 0,
    jitter: 0.012,
    color: s.roofColor ?? C.shingle,
    ridgeColor: '#4a443c',
    ridge: 'board',
    segLen: 0.9,
  };
  gableRoof(b, 'wood', roof);
}

const r0 = () => 0.14;

function logBetween(b: PartBuilder, xa: number, xb: number, y: number, z: number, r: number): void {
  const len = xb - xa;
  if (len < 0.1) return;
  logGeom(b, trs((xa + xb) / 2, y, z, 0, 0, Math.PI / 2), r * (0.94 + b.r(0, 0.12)), len, 8);
}

// -------------------------------------------------------------------------------------------
// Yard pieces
// -------------------------------------------------------------------------------------------

export function choppingBlock(b: PartBuilder, x: number, z: number): void {
  b.add('bark', new CylinderGeometry(0.3, 0.34, 0.55, 10), {
    color: '#584a3a',
    m: trs(x, 0.27, z),
    jitter: 0.02,
    jitterFreq: 5,
    shade: (_p, n, c) => {
      if (n.y > 0.8) c.set('#9c8564');
    },
  });
  // axe stuck in the block: handle + head
  rod(b, 'wood', v3(x + 0.05, 0.6, z), v3(x + 0.45, 1.05, z + 0.25), 0.02, 0.018, 5, { color: '#7a6448', ao: 0 });
  box(b, 'metal', 0.05, 0.14, 0.18, trs(x + 0.06, 0.6, z + 0.02, 0, 0.55, 0.7), { color: '#4a4744', ao: 0, dirt: 0 });
  // split billets around
  for (let i = 0; i < 6; i++) {
    const a = b.r(0, Math.PI * 2);
    const rr = b.r(0.5, 0.9);
    box(b, 'wood', 0.1, 0.1, 0.42, trs(x + Math.cos(a) * rr, 0.05, z + Math.sin(a) * rr, 0, b.r(0, 3)), { color: '#9a8261', vary: 0.12 });
  }
}

/** Neat stack of split firewood (billets) against a wall, along X. */
export function firewoodStack(b: PartBuilder, cx: number, cz: number, len: number, h: number): void {
  const nx = Math.round(len / 0.13), ny = Math.round(h / 0.12);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (j === ny - 1 && b.r() < 0.35) continue;
      const x = cx - len / 2 + (i + 0.5) * (len / nx);
      b.add('wood', new CylinderGeometry(0.065, 0.065, 0.45, 3), {
        color: '#7a6448',
        m: trs(x + b.r(-0.01, 0.01), 0.07 + j * 0.115, cz + b.r(-0.03, 0.03), Math.PI / 2, 0, b.r(0, 6)),
        vary: 0.15,
        shade: (_p, n, c) => {
          if (Math.abs(n.z) > 0.8) c.set('#a58d68');
        },
      });
    }
  }
  // small lean-to cover: two boards
  box(b, 'wood', len + 0.3, 0.04, 0.6, trs(cx, h + 0.3, cz + 0.05, 0.35), { color: C.boards });
}

export function plankStack(b: PartBuilder, cx: number, cz: number, ry: number, len: number, courses: number): void {
  const base = trs(cx, 0, cz, 0, ry);
  for (let k = 0; k < courses; k++) {
    // stickers
    for (const z of [-len * 0.4, 0, len * 0.4]) box(b, 'wood', 1.5, 0.04, 0.06, base.clone().multiply(trs(0, 0.02 + k * 0.1, z)), { color: '#5a4a39' });
    for (let i = 0; i < 6; i++) {
      box(b, 'wood', 0.23, 0.045, len + b.r(-0.2, 0.1), base.clone().multiply(trs(-0.62 + i * 0.25, 0.065 + k * 0.1, b.r(-0.05, 0.05))), {
        color: '#a1866a',
        vary: 0.08,
        shade: (_p, n, c) => {
          if (Math.abs(n.z) > 0.7) c.set('#b89f7a');
        },
      });
    }
  }
}

export function sack(b: PartBuilder, x: number, z: number, ry: number, color = '#9c8458', lying = false): void {
  const prof = [[0.001, 0], [0.17, 0.01], [0.23, 0.08], [0.24, 0.22], [0.2, 0.4], [0.1, 0.52], [0.05, 0.56], [0.08, 0.62], [0.001, 0.6]].map(([r, y]) => new Vector2(r, y));
  b.add('cloth', new LatheGeometry(prof, 10), {
    color,
    m: lying ? trs(x, 0.2, z, Math.PI / 2 - 0.1, ry, 0) : trs(x, 0, z, 0, ry, 0, 1, 1, 0.9),
    jitter: 0.02,
    jitterFreq: 4,
    renormal: true,
    ao: 0.2,
  });
}

export function barrelGeom(b: PartBuilder, m: Matrix4): void {
  const prof = [[0.001, 0], [0.25, 0], [0.25, 0.03], [0.29, 0.2], [0.31, 0.42], [0.29, 0.64], [0.25, 0.81], [0.25, 0.84], [0.22, 0.83], [0.001, 0.83]].map(([r, y]) => new Vector2(r, y));
  const inv = m.clone().invert();
  b.add('wood', new LatheGeometry(prof, 14), {
    color: '#6a5641',
    m,
    noise: 0.12,
    noiseFreq: 9,
    shade: (p, n, c) => {
      const y = p.clone().applyMatrix4(inv).y;
      if (Math.abs(y - 0.12) < 0.04 || Math.abs(y - 0.72) < 0.04) c.set('#33302c'); // iron hoops
      if (n.y > 0.9) c.multiplyScalar(0.8);
    },
  });
}

export function crateGeom(b: PartBuilder, m: Matrix4, s = 0.6): void {
  box(b, 'wood', s - 0.04, s - 0.04, s - 0.04, m, { color: '#4a3e32', ao: 0.2 });
  for (const [ax, ay] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    for (const dir of [0, 1, 2]) {
      const off = [(ax ? 1 : -1) * (s / 2 - 0.03), (ay ? 1 : -1) * (s / 2 - 0.03)];
      const p = dir === 0 ? [0, off[0], off[1]] : dir === 1 ? [off[0], 0, off[1]] : [off[0], off[1], 0];
      const sz = dir === 0 ? [s, 0.06, 0.06] : dir === 1 ? [0.06, s, 0.06] : [0.06, 0.06, s];
      box(b, 'wood', sz[0], sz[1], sz[2], m.clone().multiply(trs(p[0], p[1], p[2])), { color: '#6f5c46', vary: 0.12 });
    }
  }
  // middle board on each side
  for (const s2 of [-1, 1]) {
    box(b, 'wood', s - 0.1, 0.12, 0.03, m.clone().multiply(trs(0, 0, s2 * (s / 2 - 0.005))), { color: '#655340' });
    box(b, 'wood', 0.03, 0.12, s - 0.1, m.clone().multiply(trs(s2 * (s / 2 - 0.005), 0, 0)), { color: '#655340' });
  }
}

export function haystack(b: PartBuilder, x: number, z: number, scale = 1): void {
  const prof = [[0.001, 0], [1.25, 0], [1.35, 0.35], [1.32, 0.9], [1.18, 1.6], [0.9, 2.3], [0.55, 2.85], [0.18, 3.15], [0.001, 3.2]].map(([r, y]) => new Vector2(r * scale, y * scale));
  b.add('thatch', new LatheGeometry(prof, 16), {
    color: C.hay,
    m: trs(x, -0.05, z),
    jitter: 0.09 * scale,
    jitterFreq: 1.6,
    renormal: true,
    noise: 0.14,
    noiseFreq: 1.2,
    ao: 0.35,
    dirt: 0.25,
    shade: (p, _n, c) => {
      if (p.y > 2.2 * scale) c.multiplyScalar(0.82); // weathered grey top
    },
  });
  rod(b, 'wood', v3(x, 2.8 * scale, z), v3(x + 0.04, 3.9 * scale, z), 0.05, 0.035, 5, { color: '#5e4e3d', ao: 0 });
}

/** Wooden ladder from a foot point to a top point (rails 0.42 m apart, rungs every 0.3 m). */
export function ladder(b: PartBuilder, foot: Vector3, top: Vector3, side: Vector3): void {
  const o: Opts = { color: C.timberLight, vary: 0.1, ao: 0, dirt: 0.2 };
  const len = foot.distanceTo(top);
  const half = side.clone().normalize().multiplyScalar(0.21);
  for (const s of [-1, 1]) rod(b, 'wood', foot.clone().addScaledVector(half, s), top.clone().addScaledVector(half, s), 0.035, 0.03, 5, o);
  const n = Math.floor((len - 0.2) / 0.3);
  for (let i = 1; i <= n; i++) {
    const p = foot.clone().lerp(top, (i * 0.3) / len);
    rod(b, 'wood', p.clone().sub(half), p.clone().add(half), 0.02, 0.02, 4, o);
  }
}

function well(b: PartBuilder, x: number, z: number): void {
  b.add('stone', new CylinderGeometry(0.75, 0.8, 0.8, 14, 2, true), { ...stoneO(), m: trs(x, 0.4, z) });
  b.add('stone', new TorusGeometry(0.7, 0.1, 5, 14), { ...stoneO(C.stoneDark), m: trs(x, 0.8, z, Math.PI / 2) });
  b.add('stone', new CylinderGeometry(0.62, 0.62, 0.05, 12), { color: '#1f2120', m: trs(x, 0.45, z), noise: 0, ao: 0, dirt: 0 });
  for (const s of [-1, 1]) rod(b, 'wood', v3(x + s * 0.7, 0, z), v3(x + s * 0.7, 1.8, z), 0.06, 0.05, 6, { color: C.timber });
  rod(b, 'wood', v3(x - 0.85, 1.65, z), v3(x + 0.85, 1.65, z), 0.06, 0.06, 6, { color: C.timber });
  // little roof
  for (const s of [-1, 1]) box(b, 'wood', 1.9, 0.04, 0.75, trs(x, 2.0, z + s * 0.28, s * 0.75), { color: C.shingle, ao: 0 });
}

function banner(b: PartBuilder, x: number, z: number, h = 6): void {
  rod(b, 'wood', v3(x, 0, z), v3(x, h, z), 0.07, 0.05, 6, { color: C.timber });
  rod(b, 'wood', v3(x - 0.05, h - 0.15, z), v3(x + 0.95, h - 0.15, z), 0.025, 0.025, 4, { color: C.timber });
  // hanging cloth with a gentle wave, Glina red (the castle's warm accent)
  const g = new BoxGeometry(0.9, 1.6, 0.02, 6, 6, 1);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const yy = (p.getY(i) + 0.8) / 1.6;
    p.setZ(i, p.getZ(i) + Math.sin(p.getX(i) * 5 + yy * 2) * 0.06 * (1 - yy));
    if (yy < 0.01 && Math.abs(p.getX(i)) < 0.05) p.setY(i, p.getY(i) - 0.25); // swallow-tail notch reversed: pointed bottom
  }
  g.computeVertexNormals();
  b.add('cloth', g, { color: C.clay, m: trs(x + 0.5, h - 0.98, z), ao: 0, dirt: 0, noise: 0.08 });
}

// -------------------------------------------------------------------------------------------
// Buildings
// -------------------------------------------------------------------------------------------

function woodcutter(b: PartBuilder): Partial<BuildingModel> {
  house(b, {
    cx: -0.7, cz: -1.3, len: 4.8, dep: 3.8, wallH: 2.3, plinth: 0.25, pitch: 47,
    roof: 'shingle', walls: 'logs', door: { u: 0.9, w: 0.9, h: 1.75 },
    windows: [{ side: 'front', u: -1.1, y: 1.35 }],
  });
  choppingBlock(b, 1.4, 2.1);
  // the log pile along Z on the right is the yard stock now (drawn from the building's wood, D-71)
  firewoodStack(b, -1.7, 0.95, 1.6, 1.0);
  // sawhorse with a log
  for (const z of [-0.45, 0.45]) {
    rod(b, 'wood', v3(-2.6, 0, 2.6 + z), v3(-2.3, 0.85, 2.6 + z), 0.04, 0.035, 5, { color: C.timberLight });
    rod(b, 'wood', v3(-2.0, 0, 2.6 + z), v3(-2.3, 0.85, 2.6 + z), 0.04, 0.035, 5, { color: C.timberLight });
  }
  logGeom(b, trs(-2.3, 0.92, 2.6, Math.PI / 2, 0.1, 0), 0.13, 2.0);
  return { gate: v3(0.2, 0, 4), smoke: v3(-0.7, 4.6, -1.3), workers: [{ kind: 'chop', at: v3(1.4, 0, 3.0), yaw: Math.PI }], yard: { at: v3(2.85, 0, -1.2), yaw: 0 } };
}

function sawmill(b: PartBuilder): Partial<BuildingModel> {
  // open timber-frame shed
  const x0 = -4.4, x1 = 3.4, z0 = -3.6, z1 = 0.6, H = 2.9;
  const posts = 5;
  for (const z of [z0, z1]) {
    for (let i = 0; i < posts; i++) {
      const x = x0 + (i / (posts - 1)) * (x1 - x0);
      box(b, 'stone', 0.45, 0.25, 0.45, trs(x, 0.12, z), stoneO());
      beam(b, 'wood', v3(x, 0.25, z), v3(x, H, z), 0.22, 0.22, { color: C.timber, jitter: 0.008 });
      if (i < posts - 1) {
        const xn = x0 + ((i + 1) / (posts - 1)) * (x1 - x0);
        beam(b, 'wood', v3(x + 0.1, H - 0.7, z), v3(x + 0.7, H - 0.1, z), 0.14, 0.14, { color: C.timber }, v3(0, 0, 1));
        beam(b, 'wood', v3(xn - 0.1, H - 0.7, z), v3(xn - 0.7, H - 0.1, z), 0.14, 0.14, { color: C.timber }, v3(0, 0, 1));
      }
    }
    beam(b, 'wood', v3(x0 - 0.2, H + 0.1, z), v3(x1 + 0.2, H + 0.1, z), 0.24, 0.22, { color: C.timber });
  }
  for (let i = 0; i < posts; i++) {
    const x = x0 + (i / (posts - 1)) * (x1 - x0);
    beam(b, 'wood', v3(x, H + 0.25, z0 - 0.2), v3(x, H + 0.25, z1 + 0.2), 0.2, 0.22, { color: C.timber });
  }
  // back wall boards only (open on the front and sides)
  for (let i = 0; i < 24; i++) {
    const x = x0 + (i + 0.5) * ((x1 - x0) / 24);
    box(b, 'wood', (x1 - x0) / 24 - 0.01, H - 0.3, 0.04, trs(x, 0.25 + (H - 0.3) / 2, z0 - 0.14), { color: C.boards, vary: 0.14 });
  }
  gableRoof(b, 'wood', {
    x0, x1, z0, z1, eaveY: H + 0.36, pitchDeg: 45, thickness: 0.08, overhang: 0.5, gableOverhang: 0.4,
    ragged: 0, color: C.shingle, ridge: 'board', ridgeColor: '#4a443c', segLen: 0.9, jitter: 0.015,
  });
  // gable triangles boarded
  const ry = ridgeY({ x0, x1, z0, z1, eaveY: H + 0.36, pitchDeg: 45 } as RoofSpec);
  void ry;
  // under the roof: a squared log on two blocks and an old sawdust heap
  for (const dx of [-1.3, 1.3]) box(b, 'wood', 0.3, 0.3, 0.6, trs(-0.6 + dx, 0.15, -1.6), { color: C.timber });
  logGeom(b, trs(-0.6, 0.48, -1.6, 0, 0, Math.PI / 2), 0.18, 3.8, 8);
  b.add('thatch', new SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), { color: '#a7916c', m: trs(1.6, 0, -2.2, 0, 0, 0, 0.9, 0.16, 0.7), ao: 0.1, dirt: 0.1 });
  // in the open yard, where the camera sees them (night 6): high sawing trestles with a log; the pit saw and the
  // two sawyers are animated workers — the top sawyer stands on the log, the pit man under it, the blade between
  const sx = -0.15, sz = 2.2, TY = 1.85, LY = TY + 0.23;
  for (const dx of [-1.1, 1.1]) {
    for (const s of [-1, 1]) rod(b, 'wood', v3(sx + dx, 0, sz + s * 0.6), v3(sx + dx, TY, sz + s * 0.08), 0.07, 0.06, 6, { color: C.timberLight });
    beam(b, 'wood', v3(sx + dx, TY, sz - 0.3), v3(sx + dx, TY, sz + 0.3), 0.16, 0.16, { color: C.timber });
  }
  logGeom(b, trs(sx, LY, sz, 0, 0, Math.PI / 2), 0.2, 3.3, 10);
  const sawX = -0.25; // the blade's plane across x: the top sawyer's hands meet it 0.45 m ahead, the pit man's 0.27 m
  // the kerf already sawn on the far side of the blade (the cut runs toward the top sawyer), and fresh sawdust under it
  box(b, 'wood', 1.3, 0.02, 0.03, trs(sawX - 0.65, LY + 0.195, sz), { color: '#2e2620', ao: 0, dirt: 0 });
  b.add('thatch', new SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), { color: '#b39d76', m: trs(sawX - 0.1, 0, sz, 0, 0, 0, 0.6, 0.1, 0.45), ao: 0.1, dirt: 0.05 });
  // plank stacks in the yard and logs waiting
  // the plank stack by the gate is the yard stock (drawn from the building's planks, D-71); an old stack
  // stays at the back and logs wait for the saw
  plankStack(b, 4.7, -1.2, 0, 3.0, 3);
  logPile(b, v3(-3.4, 0, 2.3), 0, 3.6, 2, 0.17);
  return {
    gate: v3(-0.6, 0, 4), yard: { at: v3(2.6, 0, 2.3), yaw: Math.PI / 2 },
    workers: [
      { kind: 'sawTop', at: v3(sawX + 0.45, LY + 0.2, sz), yaw: -Math.PI / 2 },
      { kind: 'sawPit', at: v3(sawX - 0.27, 0, sz), yaw: Math.PI / 2 },
    ],
  };
}

function farm(b: PartBuilder): Partial<BuildingModel> {
  house(b, {
    cx: -1.2, cz: -3.0, len: 7.6, dep: 5.0, wallH: 2.4, plinth: 0.35, pitch: 50,
    roof: 'thatch', walls: 'daub', door: { u: 0.6, w: 1.0, h: 1.85 },
    windows: [{ side: 'front', u: -2.0, y: 1.55 }, { side: 'right', u: 0.6, y: 1.55 }, { side: 'front', u: 2.5, y: 1.55 }],
  });
  // small granary/shed on the right
  house(b, { cx: 4.3, cz: -3.6, len: 2.6, dep: 3.4, wallH: 2.0, plinth: 0.3, pitch: 48, roof: 'thatch', walls: 'boards', door: { u: 0, w: 1.0, h: 1.6 } });
  // fenced yard
  const y0 = -0.1, y1 = 5.6;
  wattleRun(b, v3(-5.6, 0, y0), v3(-5.6, 0, y1));
  wattleRun(b, v3(5.6, 0, -1.6), v3(5.6, 0, y1));
  wattleRun(b, v3(-5.6, 0, y1), v3(-1.3, 0, y1));
  wattleRun(b, v3(1.3, 0, y1), v3(5.6, 0, y1));
  for (const s of [-1, 1]) rod(b, 'wood', v3(s * 1.35, -0.1, y1), v3(s * 1.35, 1.4, y1), 0.08, 0.07, 6, { color: C.timber });
  haystack(b, -3.6, 2.6, 0.75);
  well(b, 3.2, 2.0);
  // cart wheel leaning on the house and a few sacks of grain by the door
  b.add('wood', new TorusGeometry(0.55, 0.05, 4, 16), { color: '#5d4c3a', m: trs(-4.6, 0.6, -0.35, -0.2) });
  // bench under the front eave, and a ladder against the granary gable
  box(b, 'wood', 1.6, 0.07, 0.34, trs(-2.9, 0.48, -0.25), { color: C.timberLight, dirt: 0.2 });
  for (const sx of [-1, 1]) box(b, 'wood', 0.07, 0.45, 0.3, trs(-2.9 + sx * 0.65, 0.23, -0.25), { color: C.timber });
  ladder(b, v3(5.95, 0, -4.4), v3(5.62, 2.5, -4.4), v3(0, 0, 1));
  sack(b, 0.65, 0.0, 1.9);
  sack(b, 0.45, 0.4, 0.2, '#9c8458', true);
  return {
    gate: v3(0, 0, 6), smoke: v3(-1.2, 6.0, -3.0), yard: { at: v3(1.45, 0, 1.9), yaw: 0 },
    fieldWorker: { kind: 'hoe', at: v3(-2.4, 0, 3.6), yaw: Math.PI * 0.8 },
  };
}

function mill(b: PartBuilder): Partial<BuildingModel> & { wheel: BuildingModel['wheel'] } {
  // stone ground floor, half-timbered upper storey, thatch
  const cx = -1.2, cz = -0.6, len = 5.0, dep = 5.4;
  box(b, 'stone', len + 0.2, 1.6, dep + 0.2, trs(cx, 0.8, cz), stoneO(), 0.45);
  house(b, {
    cx, cz, len, dep, wallH: 4.0, plinth: 1.6, pitch: 48, roof: 'thatch', walls: 'daub',
    windows: [{ side: 'front', u: -1.2, y: 2.8 }, { side: 'left', u: 0.5, y: 2.8 }],
  });
  // door in the stone storey with steps
  door(b, v3(cx + 0.8, 0.95, cz + dep / 2 + 0.1), v3(0, 0, 1), 1.0, 1.8);
  box(b, 'stone', 1.4, 0.15, 0.5, trs(cx + 0.8, 0.07, cz + dep / 2 + 0.35), stoneO(C.stoneDark));
  // mill race: two board walls and a floor channel on the +X side
  const wx = 2.7;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const z = -3.8 + i * 0.9;
      rod(b, 'wood', v3(wx + s * 0.62, -0.8, z), v3(wx + s * 0.62, 0.35, z), 0.07, 0.06, 5, { color: C.timber });
    }
    box(b, 'wood', 0.06, 0.9, 7.6, trs(wx + s * 0.6, -0.2, -0.2), { color: C.boardsDark, ao: 0.5 });
  }
  // axle bearing block on the wall
  box(b, 'stone', 0.5, 0.5, 0.6, trs(cx + len / 2 + 0.25, 1.3, cz), stoneO());
  // a ladder up to the hoist door of the upper storey on the left gable
  ladder(b, v3(cx - len / 2 - 0.62, 0, cz + 0.4), v3(cx - len / 2 - 0.08, 3.1, cz + 0.4), v3(0, 0, 1));
  // the flour sacks by the door are the yard stock (drawn from the building's flour, D-71)
  // waterwheel (separate part): undershot/breastshot, 3.6 m diameter, 0.8 m wide, axis along X
  const wb = new PartBuilder({ seed: 77, ao: 0, dirt: 0 });
  const R = 1.8, W = 0.8;
  for (const s of [-1, 1]) {
    wb.add('wood', new TorusGeometry(R - 0.08, 0.07, 4, 28), { color: '#4d4034', m: trs(s * (W / 2), 0, 0, 0, Math.PI / 2, 0) });
    wb.add('wood', new TorusGeometry(R * 0.55, 0.05, 4, 20), { color: '#4d4034', m: trs(s * (W / 2), 0, 0, 0, Math.PI / 2, 0) });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      const d = v3(0, Math.cos(a), Math.sin(a));
      beam(wb, 'wood', d.clone().multiplyScalar(-(R - 0.1)).setX(s * W * 0.45), d.clone().multiplyScalar(R - 0.1).setX(s * W * 0.45), 0.08, 0.09, { color: '#55473a' }, v3(1, 0, 0));
    }
  }
  const paddles = 16;
  for (let i = 0; i < paddles; i++) {
    const a = (i / paddles) * Math.PI * 2;
    const m = trs(0, Math.cos(a) * (R - 0.05), Math.sin(a) * (R - 0.05), -a, 0, 0);
    box(wb, 'wood', W + 0.06, 0.04, 0.42, m, { color: '#5b4b3b', vary: 0.12, shade: (p, _n, c) => { if (p.y < -0.6) c.multiplyScalar(0.65); } });
  }
  rod(wb, 'wood', v3(-1.6, 0, 0), v3(W / 2 + 0.25, 0, 0), 0.13, 0.13, 8, { color: '#4a3d31' });
  const wheel = { parts: wb.build(), pivot: v3(wx, 1.3, cz), axis: 'x' as const };
  return { gate: v3(cx + 0.8, 0, 4), wheel, workers: [{ kind: 'sack', at: v3(1.9, 0, 2.1), yaw: -Math.PI / 2 - 0.4 }], yard: { at: v3(-2.75, 0, 3.1), yaw: Math.PI / 2 } };
}

function bakery(b: PartBuilder): Partial<BuildingModel> {
  house(b, {
    cx: -1.0, cz: -1.6, len: 5.4, dep: 4.2, wallH: 2.3, plinth: 0.35, pitch: 48,
    roof: 'thatch', walls: 'daub', door: { u: -0.4, w: 0.95, h: 1.8 },
    windows: [{ side: 'front', u: 1.4, y: 1.5 }],
  });
  // domed bread oven of field stone + daub, with its own stone chimney
  const ox = 2.75, oz = -1.6;
  box(b, 'stone', 2.1, 0.8, 2.3, trs(ox, 0.4, oz), stoneO(C.stoneDark), 0.4);
  b.add('plaster', new SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), {
    color: '#7a7063',
    m: trs(ox, 0.8, oz, 0, 0, 0, 0.95, 0.85, 1.05),
    jitter: 0.04,
    jitterFreq: 2.5,
    renormal: true,
    noise: 0.14,
    dirt: 0.2,
    shade: (p, _n, c) => {
      if (p.z > oz + 0.8 && Math.abs(p.x - ox) < 0.3 && p.y < 1.25) c.set('#1c1714'); // oven mouth
      else if (p.y > 1.45) c.lerp(new Color('#3a332c'), 0.35); // soot
    },
  });
  // flue: a short, soot-darkened field-stone stack at the back of the oven dome (~3.3 m)
  const flue = { ...stoneO('#4f4a42'), shade: (p: Vector3, n: Vector3, c: Color) => {
    stoneO('#4f4a42').shade!(p, n, c);
    if (p.y > 2.3) c.lerp(SOOT, Math.min(0.6, (p.y - 2.3) * 0.7));
  } };
  box(b, 'stone', 0.56, 3.2, 0.56, trs(ox + 0.15, 1.6, oz - 0.78), flue, 0.4);
  box(b, 'stone', 0.66, 0.12, 0.66, trs(ox + 0.15, 3.24, oz - 0.78), stoneO('#46423b'));
  // shelter roof over the oven mouth
  box(b, 'wood', 1.7, 0.05, 1.4, trs(ox, 2.1, oz + 0.6, 0.38), { color: C.shingle });
  for (const s of [-1, 1]) rod(b, 'wood', v3(ox + s * 0.75, 0, oz + 1.3), v3(ox + s * 0.75, 1.9, oz + 1.3), 0.06, 0.05, 6, { color: C.timber });
  // firewood and a bench with bread baskets
  firewoodStack(b, 2.8, 0.6, 1.6, 0.9);
  box(b, 'wood', 1.8, 0.07, 0.4, trs(-2.2, 0.55, 1.0), { color: C.timberLight });
  for (const s of [-1, 1]) box(b, 'wood', 0.07, 0.55, 0.36, trs(-2.2 + s * 0.75, 0.27, 1.0), { color: C.timber });
  for (const x of [-2.6, -1.85]) {
    b.add('wood', new CylinderGeometry(0.22, 0.18, 0.18, 12, 1, true), { color: '#7a6242', m: trs(x, 0.68, 1.0), ao: 0 });
    for (let i = 0; i < 3; i++) b.add('cloth', new SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.6), { color: '#a67a3d', m: trs(x + (i - 1) * 0.1, 0.74, 1.0 + (i % 2) * 0.06, 0, i, 0, 0.1, 0.07, 0.1), ao: 0 });
  }
  return { gate: v3(-0.4, 0, 4), smoke: v3(ox + 0.15, 3.45, oz - 0.78), workers: [{ kind: 'peel', at: v3(ox, 0, 1.6), yaw: Math.PI }], yard: { at: v3(2.0, 0, 2.8), yaw: Math.PI / 2 } };
}

function warehouse(b: PartBuilder): Partial<BuildingModel> {
  house(b, {
    cx: 0, cz: -0.9, len: 10.2, dep: 6.0, wallH: 3.3, plinth: 0.45, pitch: 47,
    roof: 'shingle', walls: 'boards', door: { u: 0, w: 3.0, h: 2.8, open: true }, overhang: 0.6,
  });
  // big double doors swung open
  for (const s of [-1, 1]) {
    const hx = s * 1.5;
    const m = trs(hx, 0.45 + 1.4, 2.1 + 0.05, 0, s * -1.25);
    box(b, 'wood', 1.5, 2.8, 0.06, m.clone().multiply(trs(s * 0.75, 0, 0)), { color: C.boards });
    for (const y of [-0.9, 0.9]) box(b, 'wood', 1.45, 0.14, 0.05, m.clone().multiply(trs(s * 0.75, y, 0.05)), { color: C.timber });
  }
  // a ramp of planks to the floor (plinth height)
  box(b, 'wood', 3.0, 0.08, 1.4, trs(0, 0.22, 2.75, 0.3), { color: C.timberLight });
  // the goods outside are the stock now: its two largest goods as yard piles either side of the ramp (D-79);
  // the old barrels, crates and sack would have doubled (or contradicted) them
  return { gate: v3(0, 0, 4), piles: [{ at: v3(-3.5, 0, 3.08), yaw: Math.PI / 2 }, { at: v3(3.5, 0, 3.08), yaw: Math.PI / 2 }] };
}

function stable(b: PartBuilder): Partial<BuildingModel> {
  const cx = 0, cz = -1.6, len = 10.4, dep = 4.6, H = 2.3;
  const x0 = cx - len / 2, x1 = cx + len / 2, z0 = cz - dep / 2, z1 = cz + dep / 2;
  box(b, 'stone', len + 0.2, 0.3, dep + 0.2, trs(cx, 0.15, cz), stoneO(), 0.5);
  // back and side walls in boards, dark interior
  box(b, 'wood', len, H - 0.3, 0.12, trs(cx, 0.3 + (H - 0.3) / 2, z0), { color: C.boards, ao: 0.4 }, 0.6);
  for (const x of [x0, x1]) box(b, 'wood', 0.12, H - 0.3, dep, trs(x, 0.3 + (H - 0.3) / 2, cz), { color: C.boards, ao: 0.4 }, 0.6);
  box(b, 'wood', len - 0.2, 0.05, dep - 0.2, trs(cx, 0.31, cz), { color: '#3e3328', ao: 0, dirt: 0.6 }); // mucky floor
  // open stalls along the front: posts, stall partitions, half doors
  const stalls = 5;
  for (let i = 0; i <= stalls; i++) {
    const x = x0 + (i / stalls) * len;
    beam(b, 'wood', v3(x, 0.3, z1), v3(x, H, z1), 0.2, 0.2, { color: C.timber });
    if (i > 0 && i < stalls) {
      // partition
      for (let k = 0; k < 4; k++) box(b, 'wood', 0.05, 0.25, dep - 0.3, trs(x, 0.5 + k * 0.28, cz + 0.05), { color: C.boards, vary: 0.15 });
    }
    if (i < stalls) {
      const xm = x + len / stalls / 2;
      // half door (lower leaf), every other one ajar
      const ajar = i % 2 === 1;
      const w = len / stalls - 0.3;
      const m = ajar ? trs(x + 0.15, 0.95, z1 + 0.05, 0, -1.0).multiply(trs(w / 2, 0, 0)) : trs(xm, 0.95, z1 + 0.02);
      box(b, 'wood', w, 1.1, 0.05, m, { color: C.timberLight, vary: 0.12 });
      // hay rack / trough at the back wall
      box(b, 'wood', w - 0.4, 0.35, 0.4, trs(xm, 0.75, z0 + 0.35), { color: C.timber });
      b.add('thatch', new SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), { color: C.hay, m: trs(xm, 0.92, z0 + 0.35, 0, 0, 0, w / 2 - 0.3, 0.18, 0.2), ao: 0 });
    }
  }
  beam(b, 'wood', v3(x0 - 0.2, H, z1), v3(x1 + 0.2, H, z1), 0.22, 0.24, { color: C.timber });
  thatchRoof(b, {
    x0, x1, z0, z1, eaveY: H, pitchDeg: 47, overhang: 0.75, hip: 'full', thickness: 0.4, ragged: 0.2,
    color: C.thatch, ridgeColor: C.thatchRidge,
  });
  // water trough + hay stack by the side
  box(b, 'wood', 2.0, 0.45, 0.55, trs(-2.5, 0.22, 2.0), { color: C.timber });
  box(b, 'stone', 1.85, 0.03, 0.4, trs(-2.5, 0.44, 2.0), { color: '#4c5b5c', ao: 0, dirt: 0, noise: 0 });
  haystack(b, 4.4, 2.3, 0.55);
  fenceRun(b, v3(-5.6, 0, 3.6), v3(-3.6, 0, 3.6));
  return { gate: v3(0, 0, 4) };
}

/** Stone wall block between a and c (ground to height), with merlons along the top. */
function curtain(b: PartBuilder, a: Vector3, c: Vector3, h: number, t: number): void {
  const d = new Vector3().subVectors(c, a);
  const len = d.length();
  d.normalize();
  const side = v3(-d.z, 0, d.x);
  const m = new Matrix4().makeBasis(d, v3(0, 1, 0), side).setPosition(new Vector3().addVectors(a, c).multiplyScalar(0.5).setY(h / 2));
  box(b, 'stone', len, h, t, m, { ...stoneO(), jitter: 0.06 }, 0.75);
  // batter (sloped base)
  box(b, 'stone', len + 0.3, 0.9, t + 0.5, m.clone().multiply(trs(0, -h / 2 + 0.3, 0)), stoneO(C.stoneDark), 0.7);
  // wall-walk parapet with merlons on the outer side
  const n = Math.floor(len / 1.3);
  for (let i = 0; i < n; i++) {
    const u = -len / 2 + (i + 0.5) * (len / n);
    box(b, 'stone', 0.7, 0.8, 0.45, m.clone().multiply(trs(u, h / 2 + 0.4, t / 2 - 0.22)), { ...stoneO(), jitter: 0.03 });
  }
  box(b, 'stone', len, 0.5, 0.45, m.clone().multiply(trs(0, h / 2 - 0.0, t / 2 - 0.22)), stoneO(), 0.8);
  putlogs(b, m, len, h, t / 2 + 0.005);
}

/** Alternating proud corner stones on a rectangular tower (x, z centre; w × d plan). */
function quoins(b: PartBuilder, cx: number, cz: number, w: number, d: number, y0: number, y1: number): void {
  const h = 0.48;
  const n = Math.floor((y1 - y0) / h);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const long = i % 2 === 0;
      const y = y0 + (i + 0.5) * h;
      const lx = long ? 0.75 : 0.42, lz = long ? 0.42 : 0.75;
      box(b, 'stone', lx, h - 0.03, lz, trs(cx + sx * (w / 2 - lx / 2 + 0.035), y, cz + sz * (d / 2 - lz / 2 + 0.035)), {
        ...stoneO('#837e73'),
        jitter: 0.015,
      });
    }
  }
}

/** Rows of small dark putlog (scaffold) holes on a wall face — reads as masonry at distance. */
function putlogs(b: PartBuilder, m: Matrix4, len: number, h: number, off: number, rows = [0.35, 0.68]): void {
  for (const fy of rows) {
    const n = Math.floor(len / 1.6);
    for (let i = 0; i < n; i++) {
      const u = -len / 2 + (i + 0.5) * (len / n) + b.r(-0.1, 0.1);
      box(b, 'stone', 0.16, 0.16, 0.02, m.clone().multiply(trs(u, -h / 2 + fy * h, off)), { color: '#2a2622', noise: 0, ao: 0, dirt: 0, vary: 0 });
    }
  }
}

function castle(b: PartBuilder): Partial<BuildingModel> {
  const H = 6.2, T = 1.3;
  const zb = -7.3, zf = -0.8, xl = -7.3, xr = 7.3;
  curtain(b, v3(xl, 0, zb), v3(xr, 0, zb), H, T);
  curtain(b, v3(xl, 0, zf), v3(xl, 0, zb), H, T);
  curtain(b, v3(xr, 0, zb), v3(xr, 0, zf), H, T);
  curtain(b, v3(-2.2, 0, zf), v3(xl, 0, zf), H, T);
  curtain(b, v3(xr, 0, zf), v3(2.2, 0, zf), H, T);
  // gatehouse with an arched passage (extruded shape with a hole)
  {
    const w = 4.6, gh = 8.6, d = 3.2;
    const sh = new Shape();
    sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, gh); sh.lineTo(-w / 2, gh); sh.closePath();
    const hole = new Path();
    hole.moveTo(-1.3, 0.0); hole.lineTo(1.3, 0.0); hole.lineTo(1.3, 2.6);
    hole.absarc(0, 2.6, 1.3, 0, Math.PI, false);
    hole.lineTo(-1.3, 0.0);
    sh.holes.push(hole);
    const g = new ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 10 });
    b.add('stone', g, { ...stoneO(), jitter: 0.03, m: trs(0, 0, zf - d / 2 + 0.3) });
    quoins(b, 0, zf + 0.3 - d / 2 + d / 2 - 0.0, w, d, 0.6, gh);
    // arch voussoir ring (slightly proud) on the outer face
    b.add('stone', new TorusGeometry(1.42, 0.17, 4, 12, Math.PI), { ...stoneO(C.stoneDark), m: trs(0, 2.6, zf + 1.55, 0, 0, 0, 1, 1, 0.6) });
    for (let i = 0; i < 4; i++) {
      const u = -w / 2 + 0.4 + i * ((w - 0.8) / 3);
      box(b, 'stone', 0.7, 0.85, 0.5, trs(u, gh + 0.42, zf + 1.6), stoneO());
      box(b, 'stone', 0.7, 0.85, 0.5, trs(u, gh + 0.42, zf - 1.3), stoneO());
    }
    for (const s of [-1, 1]) box(b, 'stone', 0.5, 0.85, 2.0, trs(s * (w / 2 - 0.25), gh + 0.42, zf + 0.15), stoneO());
    // timber gate leaves, open inward
    for (const s of [-1, 1]) {
      const m = trs(s * 1.3, 1.7, zf - 1.1, 0, s * 1.35).multiply(trs(-s * 0.65, 0, 0));
      for (let k = 0; k < 6; k++) box(b, 'wood', 0.21, 3.4, 0.09, m.clone().multiply(trs((k - 2.5) * 0.215, 0, 0)), { color: '#4a3c2e', vary: 0.1 });
      for (const y of [-1.1, 0.0, 1.1]) box(b, 'metal', 1.3, 0.08, 0.03, m.clone().multiply(trs(0, y, 0.06)), { color: '#34312e', ao: 0, dirt: 0 });
    }
    // floor of the passage
    box(b, 'stone', 2.6, 0.06, d, trs(0, 0.03, zf - d / 2 + 0.3 + d / 2), stoneO(C.stoneDark));
  }
  // square keep, back-left
  {
    const kx = -3.9, kz = -4.0, kw = 5.6, kh = 15.5;
    box(b, 'stone', kw, kh, kw, trs(kx, kh / 2, kz), { ...stoneO(), jitter: 0.05 }, 0.9);
    for (let sd = 0; sd < 4; sd++) {
      const fm = trs(kx, kh / 2, kz, 0, (sd * Math.PI) / 2);
      putlogs(b, fm, kw, kh, kw / 2 + 0.005, [0.22, 0.42, 0.62, 0.82]);
    }
    // string course and corner quoins
    box(b, 'stone', kw + 0.12, 0.18, kw + 0.12, trs(kx, kh * 0.5, kz), stoneO(C.stoneDark), 1);
    quoins(b, kx, kz, kw, kw, 1.2, kh);
    box(b, 'stone', kw + 0.6, 1.2, kw + 0.6, trs(kx, 0.6, kz), stoneO(C.stoneDark), 0.8);
    // corbelled parapet
    box(b, 'stone', kw + 0.5, 0.35, kw + 0.5, trs(kx, kh + 0.1, kz), stoneO(C.stoneDark), 0.8);
    const per = 4;
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < per; i++) {
        const u = -kw / 2 + 0.35 + i * ((kw - 0.7) / (per - 1));
        const off = kw / 2 + 0.03;
        const [px, pz] = side === 0 ? [u, off] : side === 1 ? [u, -off] : side === 2 ? [off, u] : [-off, u];
        box(b, 'stone', side < 2 ? 0.8 : 0.5, 1.0, side < 2 ? 0.5 : 0.8, trs(kx + px, kh + 0.8, kz + pz), stoneO());
      }
    }
    // shingled pyramid roof inside the parapet
    b.add('wood', new CylinderGeometry(0.05, kw * 0.72, 3.6, 4, 3, false), {
      color: C.shingle,
      m: trs(kx, kh + 2.0, kz, 0, Math.PI / 4),
      jitter: 0.02,
      ao: 0,
      dirt: 0,
    });
    // arrow slits and a raised entrance
    for (const y of [5, 8.5, 12]) {
      box(b, 'stone', 0.14, 0.9, 0.05, trs(kx + 0.6, y, kz + kw / 2 + 0.01), { color: '#1d1a17', noise: 0, ao: 0, dirt: 0 });
      box(b, 'stone', 0.05, 0.9, 0.14, trs(kx + kw / 2 + 0.01, y + 1, kz - 0.5), { color: '#1d1a17', noise: 0, ao: 0, dirt: 0 });
    }
    door(b, v3(kx + kw / 2 + 0.03, 4.1, kz + 1.2), v3(1, 0, 0), 1.0, 1.8);
    // wooden stair to the raised entrance
    for (let i = 0; i < 9; i++) box(b, 'wood', 0.9, 0.08, 0.3, trs(kx + kw / 2 + 0.5 + i * 0.32 * 0, 0.3 + i * 0.41, kz + 3.9 - i * 0.3), { color: C.timberLight });
    beam(b, 'wood', v3(kx + kw / 2 + 0.95, 0, kz + 4.2), v3(kx + kw / 2 + 0.95, 3.8, kz + 1.4), 0.12, 0.2, { color: C.timber });
  }
  // a timber hall along the right wall inside the bailey
  house(b, { cx: 4.0, cz: -4.4, len: 5.0, dep: 3.6, wallH: 4.6, plinth: 0.5, pitch: 48, roof: 'shingle', walls: 'daub', windows: [{ side: 'front', u: 0.6, y: 3.2 }] });

  // --- order yard in front (z 0..8): post-and-rail fence, wide entry at the front, crates and the banner
  const yz0 = 0.6, yz1 = 7.6;
  fenceRun(b, v3(-7.4, 0, yz0), v3(-7.4, 0, yz1));
  fenceRun(b, v3(7.4, 0, yz0), v3(7.4, 0, yz1));
  fenceRun(b, v3(-7.4, 0, yz1), v3(-2.2, 0, yz1));
  fenceRun(b, v3(2.2, 0, yz1), v3(7.4, 0, yz1));
  banner(b, 2.6, yz1 + 0.05, 6);
  // tally table with a steward
  box(b, 'wood', 1.6, 0.06, 0.8, trs(-3.6, 0.8, 2.2), { color: C.timberLight });
  for (const [dx, dz] of [[-0.7, -0.32], [0.7, -0.32], [-0.7, 0.32], [0.7, 0.32]]) box(b, 'wood', 0.07, 0.8, 0.07, trs(-3.6 + dx, 0.4, 2.2 + dz), { color: C.timber });
  addHuman(b, trs(-3.6, 0, 1.4, 0, 0.2), HUMAN_STYLES[1], 'stand');
  crateGeom(b, trs(5.6, 0.3, 1.6));
  crateGeom(b, trs(6.3, 0.3, 1.8, 0, 0.3));
  barrelGeom(b, trs(5.9, 0, 2.6));
  // the order delivered so far: one pile per ordered good inside the fence, left and right of the lane (D-79)
  return { gate: v3(0, 0, 8), piles: [{ at: v3(-4.3, 0, 5.7), yaw: Math.PI / 2 }, { at: v3(4.3, 0, 5.7), yaw: Math.PI / 2 }, { at: v3(-4.3, 0, 3.9), yaw: Math.PI / 2 }] };
}

// -------------------------------------------------------------------------------------------
// Trading post across the river (free valley late game, D-170)
// -------------------------------------------------------------------------------------------

/** The merchant's house front: the stall opening (shutters are separate parts, closed or open). */
const POST_STALL = { x: -1.4, y: 1.75, z: -0.4, w: 4.2, h: 1.2 };

/**
 * A merchant's house with a wide stall window, the town scales under a lean-to (a steelyard on a chain — the
 * post's silhouette from afar), a fenced yard with an entry in the middle of the front, a trough, a hitching rail
 * and barrels. Existing materials only, so it merges into the same draw calls as the other buildings.
 */
function tradePost(b: PartBuilder): Partial<BuildingModel> {
  house(b, {
    cx: 0, cz: -3.4, len: 9.6, dep: 6.0, wallH: 3.6, plinth: 0.6, pitch: 50,
    roof: 'shingle', walls: 'daub', door: { u: 3.0, w: 1.2, h: 2.2 }, overhang: 0.6,
  });
  // the stall opening: a dark recess and a sill board
  const st = POST_STALL;
  box(b, 'wood', st.w, st.h, 0.12, trs(st.x, st.y, st.z + 0.02), { color: '#2a231c', noise: 0, ao: 0, dirt: 0 });
  box(b, 'wood', st.w + 0.3, 0.12, 0.3, trs(st.x, st.y - st.h / 2 - 0.06, st.z + 0.12), { color: C.timberLight });
  // the scales under a lean-to at the right front: four bark posts, a shingle roof sloping back
  const sx = 4.8, sz = 3.0, pw = 3.6, pd = 3.2, ph = 3.2;
  for (const dx of [-pw / 2, pw / 2]) for (const dz of [-pd / 2, pd / 2]) {
    rod(b, 'bark', v3(sx + dx, -0.1, sz + dz), v3(sx + dx, ph + (dz < 0 ? 0.3 : 0), sz + dz), 0.12, 0.1, 6, { color: C.timber, vary: 0.1 });
  }
  box(b, 'wood', pw + 0.6, 0.1, pd + 0.6, trs(sx, ph + 0.25, sz, 0.12), { color: C.shingle, noise: 0.2, jitter: 0.01 }, 0.4);
  beam(b, 'wood', v3(sx - pw / 2, ph - 0.1, sz), v3(sx + pw / 2, ph - 0.1, sz), 0.16, 0.16, { color: C.timber });
  // steelyard: three chain links, the beam a little tilted, a hook with a sack, a stone weight
  for (let i = 0; i < 3; i++) b.add('metal', new TorusGeometry(0.07, 0.02, 3, 6), { color: '#3a3733', m: trs(sx, ph - 0.3 - i * 0.13, sz, 0, i % 2 ? Math.PI / 2 : 0, 0) });
  box(b, 'wood', 2.6, 0.12, 0.12, trs(sx, ph - 0.72, sz, 0, 0, 0.08), { color: C.timberLight });
  rod(b, 'metal', v3(sx - 1.2, ph - 0.8, sz), v3(sx - 1.2, ph - 1.3, sz), 0.02, 0.02, 4, { color: '#3a3733' });
  b.add('cloth', new SphereGeometry(0.32, 8, 6), { color: '#9c8458', m: trs(sx - 1.2, ph - 1.6, sz, 0, 0, 0, 1, 1.25, 1), jitter: 0.03, renormal: true });
  rod(b, 'metal', v3(sx + 1.15, ph - 0.6, sz), v3(sx + 1.15, ph - 0.95, sz), 0.015, 0.015, 4, { color: '#3a3733' });
  b.add('stone', new SphereGeometry(0.2, 8, 6), { ...stoneO(C.stoneDark), m: trs(sx + 1.15, ph - 1.15, sz) });
  // the yard: post-and-rail fence on the sides and front (entry in the middle), wattle behind the house
  fenceRun(b, v3(-7.6, 0, -7.6), v3(-7.6, 0, 7.6));
  fenceRun(b, v3(7.6, 0, -7.6), v3(7.6, 0, 7.6));
  fenceRun(b, v3(-7.6, 0, 7.6), v3(-2.2, 0, 7.6));
  fenceRun(b, v3(2.2, 0, 7.6), v3(7.6, 0, 7.6));
  wattleRun(b, v3(-7.6, 0, -7.6), v3(7.6, 0, -7.6));
  // sign post at the entry: a cut disc with a bar (a coin on a scale), no letters
  rod(b, 'bark', v3(-2.6, -0.1, 7.7), v3(-2.6, 2.8, 7.7), 0.09, 0.08, 6, { color: C.timber });
  b.add('wood', new CylinderGeometry(0.5, 0.5, 0.06, 12), { color: C.boards, m: trs(-2.6, 2.3, 7.82, Math.PI / 2, 0, 0) });
  box(b, 'wood', 0.7, 0.08, 0.04, trs(-2.6, 2.3, 7.87), { color: C.boardsDark });
  // always there: a trough, a hitching rail, a barrel
  box(b, 'wood', 1.8, 0.4, 0.5, trs(-5.2, 0.2, 2.4), { color: C.timber }, 0.3);
  box(b, 'wood', 1.6, 0.06, 0.4, trs(-5.2, 0.38, 2.4), { color: '#3c4a4c', ao: 0, dirt: 0 });
  for (const x of [-6.4, -3.6]) rod(b, 'bark', v3(x, -0.1, 4.6), v3(x, 1.0, 4.6), 0.08, 0.07, 6, { color: C.timber });
  beam(b, 'wood', v3(-6.5, 0.95, 4.6), v3(-3.5, 0.95, 4.6), 0.12, 0.12, { color: C.timberLight });
  barrelGeom(b, trs(-4.6, 0, 0.5));
  return { gate: v3(0, 0, 8) };
}

let postClosedCache: ModelPart[] | null = null;
let postOpenCache: ModelPart[] | null = null;

/** The trading post before rank 4: both shutters closed in the stall opening (same frame as tradePost()). */
export function tradePostClosedParts(): ModelPart[] {
  if (postClosedCache) return postClosedCache;
  const b = new PartBuilder({ seed: 983, ao: 0.4, aoHeight: 1.6, dirt: 0.3, dirtHeight: 0.45 });
  const st = POST_STALL;
  for (const dy of [-st.h / 4, st.h / 4]) {
    box(b, 'wood', st.w, st.h / 2 - 0.02, 0.07, trs(st.x, st.y + dy, st.z + 0.1), { color: C.boards, vary: 0.1 });
    for (const dx of [-st.w / 3, st.w / 3]) box(b, 'metal', 0.5, 0.06, 0.02, trs(st.x + dx, st.y + dy, st.z + 0.15), { color: '#33302c' });
  }
  box(b, 'wood', 0.12, st.h + 0.1, 0.08, trs(st.x, st.y, st.z + 0.15), { color: C.timber }); // the bar
  postClosedCache = b.build();
  return postClosedCache;
}

/**
 * The trading post open (rank 4): the lower shutter let down as a counter on two struts, the upper one propped up
 * as an awning, crates, sacks and planks on show, and the one warm accent — a small Glina pennant by the scales.
 */
export function tradePostOpenParts(): ModelPart[] {
  if (postOpenCache) return postOpenCache;
  const b = new PartBuilder({ seed: 991, ao: 0.4, aoHeight: 1.6, dirt: 0.3, dirtHeight: 0.45 });
  const st = POST_STALL;
  const front = st.z + 0.06;
  const ctrY = st.y - st.h / 2;
  box(b, 'wood', st.w, 0.07, st.h / 2 + 0.1, trs(st.x, ctrY, front + st.h / 4 + 0.05), { color: C.boards, vary: 0.1 });
  for (const dx of [-st.w / 2 + 0.3, st.w / 2 - 0.3]) beam(b, 'wood', v3(st.x + dx, ctrY - 0.7, front), v3(st.x + dx, ctrY - 0.04, front + st.h / 2 - 0.05), 0.07, 0.07, { color: C.timber });
  // awning: the upper shutter tilted up on two poles
  const awY = st.y + st.h / 2 + 0.05;
  box(b, 'wood', st.w, 0.07, st.h / 2 + 0.2, trs(st.x, awY + 0.18, front + 0.38, -0.5), { color: C.boards, vary: 0.1 });
  for (const dx of [-st.w / 2 + 0.2, st.w / 2 - 0.2]) rod(b, 'bark', v3(st.x + dx, -0.1, front + 0.85), v3(st.x + dx, awY + 0.38, front + 0.72), 0.045, 0.04, 5, { color: C.timber });
  // wares: crates by the counter, sacks, a plank stack
  crateGeom(b, trs(st.x - 2.4, 0.3, 0.6));
  crateGeom(b, trs(st.x - 1.8, 0.3, 1.1, 0, 0.4));
  crateGeom(b, trs(st.x - 2.1, 0.88, 0.8, 0, 0.2), 0.5);
  sack(b, st.x + 2.0, 0.6, 0.3);
  sack(b, st.x + 2.5, 0.9, 1.2, '#8f7a52');
  plankStack(b, -4.8, 6.0, Math.PI / 2, 2.6, 2);
  // pennant on a 5 m pole by the scales
  rod(b, 'wood', v3(6.9, -0.1, 4.9), v3(6.9, 5.0, 4.9), 0.05, 0.04, 5, { color: C.timber, ao: 0 });
  box(b, 'cloth', 1.2, 0.45, 0.03, trs(6.9 - 0.62, 4.7, 4.9), { color: C.clay, ao: 0, dirt: 0 });
  postOpenCache = b.build();
  return postOpenCache;
}

// -------------------------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------------------------

const BUILDERS: Record<BuildingKind, (b: PartBuilder) => Partial<BuildingModel>> = {
  woodcutter,
  sawmill,
  farm,
  mill,
  bakery,
  warehouse,
  stable,
  castle,
  fisher,
  quarry,
  charcoalBurner,
  malthouse,
  brewery,
  tradePost,
};

const cache = new Map<BuildingKind, BuildingModel>();

/** Model used for a building type this module does not know (scaled to its footprint). */
export const FALLBACK_KIND: BuildingKind = 'warehouse';

/**
 * Build (once) and return the model for a building kind. A type without a model of its own
 * (e.g. new in the sim, not drawn yet) gets the `FALLBACK_KIND` model instead of throwing.
 */
export function buildingModel(kind: BuildingKind): BuildingModel {
  const hit = cache.get(kind);
  if (hit) return hit;
  if (!(kind in BUILDERS)) {
    const fb = buildingModel(FALLBACK_KIND);
    cache.set(kind, fb);
    return fb;
  }
  const b = new PartBuilder({ seed: 300 + BUILDING_KINDS.indexOf(kind) * 11, ao: 0.4, aoHeight: 1.6, dirt: 0.3, dirtHeight: 0.45 });
  const extra = BUILDERS[kind](b);
  const cells = BUILDING_CELLS[kind];
  const model: BuildingModel = {
    kind,
    cells,
    parts: b.build(),
    gate: extra.gate ?? v3(0, 0, (cells[1] * 4) / 2),
    wheel: extra.wheel,
    smoke: extra.smoke,
    workers: extra.workers,
    fieldWorker: extra.fieldWorker,
    yard: extra.yard,
    piles: extra.piles,
  };
  cache.set(kind, model);
  return model;
}

let castleUpgradeCache: ModelPart[] | null = null;

/**
 * Castle level 1 (free valley rank 5, Stolica): a round corner tower with a conical shingle roof and a
 * Glina-red pennant, added at the back-right corner of the bailey. Same local frame as castle().
 */
export function castleUpgradeParts(): ModelPart[] {
  if (castleUpgradeCache) return castleUpgradeCache;
  const b = new PartBuilder({ seed: 977, ao: 0.4, aoHeight: 1.6, dirt: 0.3, dirtHeight: 0.45 });
  const tx = 6.4, tz = -6.4, r = 2.0, th = 12.5;
  b.add('stone', new CylinderGeometry(r, r * 1.08, th, 14, 6, false), { ...stoneO(), m: trs(tx, th / 2, tz), jitter: 0.04 });
  b.add('stone', new CylinderGeometry(r * 1.2, r * 1.25, 1.0, 14, 1, false), { ...stoneO(C.stoneDark), m: trs(tx, 0.5, tz) });
  // corbel ring and merlons
  b.add('stone', new CylinderGeometry(r + 0.35, r + 0.05, 0.5, 14, 1, false), { ...stoneO(C.stoneDark), m: trs(tx, th + 0.2, tz) });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    box(b, 'stone', 0.7, 0.9, 0.45, trs(tx + Math.cos(a) * (r + 0.15), th + 0.9, tz + Math.sin(a) * (r + 0.15), 0, -a + Math.PI / 2), stoneO());
  }
  // arrow slits facing out of the bailey
  for (const [y, a] of [[4.5, 0.3], [7.8, -0.9], [10.6, 0.3]] as const) {
    box(b, 'stone', 0.14, 0.9, 0.05, trs(tx + Math.cos(a) * (r + 0.01), y, tz + Math.sin(a) * (r + 0.01), 0, -a + Math.PI / 2), { color: '#1d1a17', noise: 0, ao: 0, dirt: 0 });
  }
  // conical shingle roof inside the merlons
  b.add('wood', new CylinderGeometry(0.04, r * 1.05, 4.2, 12, 3, false), { color: C.shingle, m: trs(tx, th + 2.3, tz), jitter: 0.02, ao: 0, dirt: 0 });
  // pennant pole and cloth (the castle's warm accent)
  rod(b, 'wood', v3(tx, th + 4.2, tz), v3(tx, th + 6.6, tz), 0.05, 0.04, 5, { color: C.timber, ao: 0 });
  box(b, 'cloth', 1.4, 0.55, 0.03, trs(tx + 0.72, th + 6.25, tz), { color: C.clay, ao: 0, dirt: 0 });
  castleUpgradeCache = b.build();
  return castleUpgradeCache;
}

const propCache = new Map<PropKind, ModelPart[]>();

/** Generic yard props. Fence: one 4 m segment along X centred on the origin. */
export function propParts(kind: PropKind): ModelPart[] {
  const hit = propCache.get(kind);
  if (hit) return hit;
  const b = new PartBuilder({ seed: 500 + PROP_KINDS.indexOf(kind), ao: 0.35 });
  switch (kind) {
    case 'fence':
      fenceRun(b, v3(-2, 0, 0), v3(2, 0, 0));
      break;
    case 'haystack':
      haystack(b, 0, 0, 0.8);
      break;
    case 'barrel':
      barrelGeom(b, new Matrix4());
      break;
    case 'crate':
      crateGeom(b, trs(0, 0.3, 0));
      break;
  }
  const parts = b.build();
  propCache.set(kind, parts);
  return parts;
}

