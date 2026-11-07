/**
 * Two-axle farm wagon (plank-sided box wagon, iron-tyred spoked wheels, shafts) with one
 * draught horse in collar harness and a seated driver.
 *
 * Rig frame: origin on the ground midway between the axles, wagon front (and horse) toward +Z.
 * Parts are exported separately so the renderer can instance them: body (static), front and
 * rear wheel (axis along X, centred at the origin — place with `WAGON.wheels` and spin around
 * X), horse (skinned in the vertex shader by `createHorseMaterial`, pose from `render/gait.ts`),
 * driver. `wagonLod1()` is a single low-detail merged rig for far zoom.
 */
import {
  Color,
  CylinderGeometry,
  InstancedBufferAttribute,
  type BufferGeometry,
  LatheGeometry,
  Matrix4,
  MeshDepthMaterial,
  MeshStandardMaterial,
  RGBADepthPacking,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  Vector4,
} from 'three';
import { HORSE_LEGS } from '../gait';
import { type ModelPart, PartBuilder, prim, smoothstep, trs, v3 } from './kit';
import { bakedOr } from './baked';
import { modelMaterial } from './materials';
import { addHuman, HUMAN_STYLES } from './people';
import { beam, box, loftGeometry, rod, sec, type Opts } from './shapes';

export interface WheelMount {
  /** Wheel hub centre in rig space. */
  position: Vector3;
  radius: number;
  kind: 'front' | 'rear';
  /** −1 for the left wheel (−X side), +1 for the right. Geometry is symmetric. */
  side: -1 | 1;
}

/** Key dimensions of the rig (metres, rig space). */
export const WAGON = {
  /** Top surface of the bed floor; cargo rests here. */
  bedTopY: 1.0,
  /** Cargo area on the bed (driver's seat is in front of `cargoMaxZ`). */
  cargoMinZ: -1.55,
  cargoMaxZ: 1.0,
  cargoHalfWidth: 0.64,
  /** Height of the side boards above the bed floor. */
  sideHeight: 0.36,
  frontWheelRadius: 0.5,
  rearWheelRadius: 0.6,
  frontAxleZ: 1.05,
  rearAxleZ: -1.05,
  track: 1.72,
  /** Barrel centre of the horse along Z. */
  horseZ: 3.55,
  /** Overall length from the rear of the wagon to the horse's muzzle. */
  rigLength: 7.4,
  /** Driver's seat surface (rig space) — the driver bobs on it. */
  seatY: 1.4,
  seatZ: 1.33,
  wheels: [] as WheelMount[],
};
for (const kind of ['front', 'rear'] as const) {
  for (const side of [-1, 1] as const) {
    const r = kind === 'front' ? WAGON.frontWheelRadius : WAGON.rearWheelRadius;
    WAGON.wheels.push({
      position: v3((side * WAGON.track) / 2, r, kind === 'front' ? WAGON.frontAxleZ : WAGON.rearAxleZ),
      radius: r,
      kind,
      side,
    });
  }
}

const WOOD = '#6b5843';
const WOOD_DARK = '#4f4133';
const BOARD = '#6e5a44';
const IRON = '#302e2b';
const wood = (color = WOOD): Opts => ({ color, vary: 0.1, noise: 0.1, jitter: 0.004, jitterFreq: 3 });
const iron: Opts = { color: IRON, vary: 0.05, noise: 0.05, ao: 0, dirt: 0.2 };

// -------------------------------------------------------------------------------------------
// Body
// -------------------------------------------------------------------------------------------

function buildBody(b: PartBuilder): void {
  const top = WAGON.bedTopY;
  const zr = WAGON.rearAxleZ, zf = WAGON.frontAxleZ;
  // bed floor boards (lengthwise)
  const nb = 5;
  for (let i = 0; i < nb; i++) {
    const x = -0.66 + (i + 0.5) * (1.32 / nb);
    box(b, 'wood', 1.32 / nb - 0.012, 0.045, 3.25, trs(x, top - 0.022, 0.0), wood('#76634b'));
  }
  // sills under the floor, cross bearers
  for (const s of [-1, 1]) beam(b, 'wood', v3(0.5 * s, top - 0.1, -1.7), v3(0.5 * s, top - 0.1, 1.7), 0.1, 0.12, wood(WOOD_DARK));
  for (const z of [-1.35, 0, 1.35]) box(b, 'wood', 1.5, 0.06, 0.08, trs(0, top - 0.075, z), wood(WOOD_DARK));
  // reach pole linking the axles
  beam(b, 'wood', v3(0, 0.66, zr - 0.25), v3(0, 0.6, zf + 0.1), 0.1, 0.1, wood(WOOD_DARK));
  // rear axle + bolster
  beam(b, 'wood', v3(-0.98, 0.6, zr), v3(0.98, 0.6, zr), 0.12, 0.12, wood(WOOD_DARK));
  beam(b, 'wood', v3(-0.8, 0.79, zr), v3(0.8, 0.79, zr), 0.14, 0.24, wood(WOOD_DARK));
  // front axle, bolster and turntable block
  beam(b, 'wood', v3(-0.98, 0.5, zf), v3(0.98, 0.5, zf), 0.12, 0.12, wood(WOOD_DARK));
  beam(b, 'wood', v3(-0.8, 0.66, zf), v3(0.8, 0.66, zf), 0.14, 0.18, wood(WOOD_DARK));
  beam(b, 'wood', v3(-0.75, 0.84, zf), v3(0.75, 0.84, zf), 0.14, 0.16, wood(WOOD_DARK));
  // side boards: three planks per side with narrow gaps, slightly flared; a top rail over them
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const y = top + 0.065 + k * 0.118;
      const x = s * (0.69 + k * 0.016);
      box(b, 'wood', 0.035, 0.108, 3.3, trs(x, y, 0, 0, 0, s * -0.12), wood(k === 1 ? '#735f48' : BOARD));
    }
    beam(b, 'wood', v3(s * 0.75, top + 0.38, -1.68), v3(s * 0.75, top + 0.38, 1.68), 0.06, 0.05, wood(WOOD_DARK));
    // standards (stakes) outside the boards, iron clamps where they meet the sill
    for (const z of [-1.45, -0.4, 0.62, 1.5]) {
      rod(b, 'wood', v3(s * 0.64, top - 0.2, z), v3(s * 0.79, top + 0.42, z), 0.034, 0.028, 5, wood(WOOD_DARK), true);
      box(b, 'wood', 0.07, 0.045, 0.085, trs(s * 0.66, top - 0.1, z, 0, 0, s * -0.24), iron);
    }
  }
  // end boards: a higher front board under the seat, a tailboard with two iron straps
  for (const [z, h] of [[-1.64, 0.3], [1.64, 0.36]] as const) {
    for (let k = 0; k < 2; k++) box(b, 'wood', 1.42, h / 2 - 0.008, 0.04, trs(0, top + h / 4 + (k * h) / 2, z), wood(k ? BOARD : '#735f48'));
  }
  for (const x of [-0.45, 0.45]) box(b, 'wood', 0.05, 0.3, 0.012, trs(x, top + 0.15, -1.665), iron);
  // driver's seat board on two blocks + footboard
  box(b, 'wood', 1.5, 0.05, 0.3, trs(0, WAGON.seatY - 0.03, WAGON.seatZ + 0.02), wood('#7a6650'));
  for (const s of [-1, 1]) box(b, 'wood', 0.08, 0.1, 0.24, trs(s * 0.6, WAGON.seatY - 0.1, WAGON.seatZ + 0.02), wood(WOOD_DARK));
  box(b, 'wood', 1.1, 0.04, 0.4, trs(0, top - 0.06, 1.95, 0.25), wood(WOOD));
  for (const s of [-1, 1]) beam(b, 'wood', v3(s * 0.5, top - 0.1, 1.68), v3(s * 0.5, top - 0.1, 2.12), 0.05, 0.05, wood(WOOD_DARK));
  // shafts (thills) from the front axle along the horse's flanks to the collar; a cross bar
  // ties them behind the horse
  const Z = WAGON.horseZ;
  for (const s of [-1, 1]) {
    const a = v3(s * 0.5, 0.52, zf + 0.05);
    const m1 = v3(s * 0.47, 0.84, 2.55);
    const m2 = v3(s * 0.45, 1.0, Z + 0.1);
    const c = v3(s * 0.4, 1.12, Z + 0.86);
    rod(b, 'wood', a, m1, 0.045, 0.042, 6, wood(BOARD), true);
    rod(b, 'wood', m1, m2, 0.042, 0.038, 6, wood(BOARD), true);
    rod(b, 'wood', m2, c, 0.038, 0.03, 6, wood(BOARD));
    beam(b, 'wood', a.clone().add(v3(0, 0, 0.05)), v3(0, 0.5, zf + 0.45), 0.06, 0.06, wood(WOOD_DARK));
    // iron tip ferrule and the trace hook
    rod(b, 'wood', c.clone().lerp(m2, 0.08), c, 0.034, 0.032, 5, iron);
    box(b, 'wood', 0.05, 0.06, 0.04, trs(s * 0.47, 0.88, 2.7), iron);
  }
  beam(b, 'wood', v3(-0.47, 0.83, 2.5), v3(0.47, 0.83, 2.5), 0.07, 0.07, wood(WOOD_DARK));
}

// -------------------------------------------------------------------------------------------
// Wheels
// -------------------------------------------------------------------------------------------

/** lod 0 near (proud iron tyre, banded hub), 2 mid (plain rim), 1 far (a disc). */
function buildWheel(b: PartBuilder, radius: number, spokes: number, lod: 0 | 1 | 2, at = new Matrix4()): void {
  const w = radius > 0.55 ? 0.085 : 0.075;
  if (lod === 1) {
    b.add('wood', prim(CylinderGeometry, radius, radius, w, 8, 1, false), {
      color: '#4d4031',
      m: at.clone().multiply(trs(0, 0, 0, 0, 0, Math.PI / 2)),
      ao: 0,
      dirt: 0.4,
    });
    return;
  }
  const rin = radius - 0.08;
  // felloe ring with a proud iron tyre (one lathe of the cross-section, around Y → X)
  const t = 0.014;
  const prof = lod === 2 ? [
    new Vector2(rin, -w / 2), new Vector2(radius, -w / 2), new Vector2(radius, w / 2), new Vector2(rin, w / 2), new Vector2(rin, -w / 2),
  ] : [
    new Vector2(rin, -w / 2 + 0.006),
    new Vector2(radius - t, -w / 2 - 0.003),
    new Vector2(radius, -w / 2 + 0.004),
    new Vector2(radius, w / 2 - 0.004),
    new Vector2(radius - t, w / 2 + 0.003),
    new Vector2(rin, w / 2 - 0.006),
    new Vector2(rin, -w / 2 + 0.006),
  ];
  b.add('wood', new LatheGeometry(prof, lod === 2 ? 12 : radius > 0.55 ? 18 : 16), {
    color: '#655441',
    m: trs(0, 0, 0, 0, 0, Math.PI / 2),
    ao: 0,
    dirt: 0.35,
    vary: 0,
    noise: 0.08,
    shade: (p, _n, c) => {
      if (Math.hypot(p.y, p.z) > radius - t - 0.002) c.set(IRON);
    },
  });
  // spokes, slightly dished outward toward the felloe
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const dir = v3(0, Math.cos(a), Math.sin(a));
    rod(b, 'wood', dir.clone().multiplyScalar(0.09), dir.clone().multiplyScalar(rin + 0.02).add(v3(0.02, 0, 0)), 0.024, 0.019, lod === 2 ? 3 : 4, { color: '#6a5845', ao: 0, dirt: 0, vary: 0.08 }, true);
  }
  // hub (nave) with iron bands and the linchpin cap
  const hub = [
    new Vector2(0.001, -0.2), new Vector2(0.045, -0.2), new Vector2(0.06, -0.15), new Vector2(0.1, -0.06),
    new Vector2(0.1, 0.06), new Vector2(0.065, 0.16), new Vector2(0.03, 0.2), new Vector2(0.001, 0.205),
  ];
  b.add('wood', new LatheGeometry(lod === 2 ? [hub[0]!, hub[3]!, hub[4]!, hub[7]!] : hub, lod === 2 ? 6 : 8), {
    color: '#5d4c3a',
    m: trs(0, 0, 0, 0, 0, Math.PI / 2),
    ao: 0,
    dirt: 0,
    shade: (p, _n, c) => {
      const ax = Math.abs(p.x);
      if (ax > 0.15 || (ax > 0.04 && ax < 0.07)) c.set('#34312d');
    },
  });
}

// -------------------------------------------------------------------------------------------
// Horse
// -------------------------------------------------------------------------------------------

const COAT = '#4f3d30';
const POINTS = '#2a221c';
const LEATHER = '#2f2620';
const POINTS_C = new Color(POINTS);

/**
 * Horse skinning attribute `rig` = (leg index + 1 or 0, leg segment 0..2 with fractional blend
 * across the knee/hock and fetlock, head-nod weight, tail-swing weight). Positions are rig
 * space; the gait joints in `gait.ts` are horse space (z relative to `WAGON.horseZ`).
 */
const NOD_PIVOT = { y: 1.43, z: 0.95 };
const TAIL_PIVOT = { x: 0, z: -1.02 };

function legSeg(i: number, y: number): number {
  const l = HORSE_LEGS[i]!;
  const knee = smoothstep(l.ky + 0.045, l.ky - 0.045, y);
  const fet = smoothstep(l.fy + 0.03, l.fy - 0.03, y);
  return knee + fet;
}

function bodyRig(Z: number): (p: Vector3) => [number, number, number, number] {
  return (p) => [0, 0, smoothstep(NOD_PIVOT.z + 0.04, NOD_PIVOT.z + 0.4, p.z - Z), 0];
}

/** Leg loft sections: (y, half-width, half-depth, extra z) along the joint chain of leg i. */
function legSections(i: number, Z: number, lod: HorseLod) {
  const l = HORSE_LEGS[i]!;
  const zAt = (y: number) => {
    if (y >= l.ky) return l.hz + ((y - l.hy) / (l.ky - l.hy)) * (l.kz - l.hz);
    if (y >= l.fy) return l.kz + ((y - l.ky) / (l.fy - l.ky)) * (l.fz - l.kz);
    return l.fz;
  };
  const front: [number, number, number, number][] = [
    [1.22, 0.1, 0.16, -0.02], [1.02, 0.1, 0.135, 0.0], [0.82, 0.075, 0.095, 0.0], [0.62, 0.056, 0.068, 0.0],
    [0.53, 0.06, 0.07, 0.006], [0.45, 0.047, 0.056, 0.0], [0.3, 0.038, 0.05, 0.0], [0.21, 0.046, 0.06, -0.005],
    [0.15, 0.05, 0.062, 0.0], [0.105, 0.045, 0.05, 0.03], [0.075, 0.058, 0.062, 0.048], [0.035, 0.066, 0.074, 0.058],
    [0.0, 0.07, 0.08, 0.064],
  ];
  const hind: [number, number, number, number][] = [
    [1.24, 0.13, 0.2, 0.06], [1.05, 0.115, 0.17, 0.07], [0.86, 0.08, 0.12, 0.02], [0.7, 0.058, 0.09, -0.01],
    [0.61, 0.052, 0.088, -0.03], [0.52, 0.045, 0.062, -0.005], [0.35, 0.04, 0.054, 0.0], [0.21, 0.047, 0.06, -0.005],
    [0.15, 0.05, 0.062, 0.0], [0.105, 0.045, 0.05, 0.03], [0.075, 0.058, 0.062, 0.048], [0.035, 0.066, 0.074, 0.058],
    [0.0, 0.07, 0.08, 0.064],
  ];
  const rows = l.front ? front : hind;
  // near: every ring; mid: the joint rings (knee/hock, fetlock, coronet) and a few between
  const pick = lod === 0 ? rows : lod === 2 ? rows.filter((_, k) => [0, 1, 3, 4, 6, 7, 8, 10, 12].includes(k)) : rows.filter((_, k) => k % 2 === 0 || k === rows.length - 1);
  return pick.map(([y, rx, ry, dz]) => sec(l.x, y, zAt(y) + dz + Z, rx, ry));
}

/** Horse detail: 0 near (skinned, full harness), 2 mid (skinned, plain harness), 1 far (static). */
type HorseLod = 0 | 1 | 2;

function buildHorse(b: PartBuilder, Z: number, lod: HorseLod): void {
  const hi = lod === 0, rigged = lod !== 1;
  const coat: Opts = {
    color: COAT,
    vary: 0,
    noise: 0.05,
    ao: 0.2,
    dirt: 0.25,
    shade: (p, n, c) => {
      // dark lower legs (bay points), a lighter belly and muzzle
      if (p.y < 0.62) c.lerp(POINTS_C, Math.min(1, (0.62 - p.y) / 0.2));
      if (n.y < -0.6 && p.y > 0.8) c.multiplyScalar(1.1);
    },
    rig: rigged ? bodyRig(Z) : undefined,
  };
  const S = (y: number, z: number, rx: number, ry = rx, x = 0) => sec(x, y, z + Z, rx, ry);
  // body + neck as one smooth loft along the spine (tail root → croup → barrel → chest → poll)
  const spine = [
    S(1.43, -1.04, 0.05), S(1.42, -0.99, 0.19, 0.22), S(1.38, -0.88, 0.29, 0.31), S(1.32, -0.7, 0.36, 0.38),
    S(1.27, -0.45, 0.375, 0.4), S(1.21, -0.15, 0.38, 0.41), S(1.18, 0.15, 0.37, 0.41), S(1.19, 0.42, 0.345, 0.42),
    S(1.25, 0.64, 0.3, 0.4), S(1.36, 0.82, 0.25, 0.35), S(1.5, 0.97, 0.21, 0.3), S(1.63, 1.1, 0.165, 0.25),
    S(1.75, 1.22, 0.13, 0.2), S(1.84, 1.32, 0.11, 0.15),
  ];
  b.add('hide', loftGeometry(spine.filter((_, k) => rigged || k % 2 === 0 || k === spine.length - 1), hi ? 12 : lod === 2 ? 8 : 6), coat);
  // head: poll → forehead → long face → muzzle, with jowls and eyes
  const head = [
    S(1.9, 1.35, 0.05), S(1.89, 1.4, 0.115, 0.13), S(1.82, 1.49, 0.125, 0.17), S(1.71, 1.58, 0.105, 0.14),
    S(1.6, 1.66, 0.09, 0.115), S(1.5, 1.74, 0.085, 0.1), S(1.44, 1.8, 0.08, 0.085), S(1.41, 1.83, 0.045, 0.05),
  ];
  b.add('hide', loftGeometry(head.filter((_, k) => hi || k % 2 === 0 || k === head.length - 1), hi ? 8 : 5), coat);
  if (hi) {
    for (const s of [-1, 1]) {
      b.add('hide', prim(SphereGeometry, 1, 5, 3), { ...coat, m: trs(s * 0.065, 1.74, Z + 1.47, -0.5, 0, 0, 0.06, 0.1, 0.11) });
      b.add('hide', prim(SphereGeometry, 1, 4, 3), { ...coat, color: '#141110', shade: undefined, m: trs(s * 0.11, 1.83, Z + 1.5, 0, 0, 0, 0.018, 0.022, 0.022) });
    }
  }
  for (let i = 0; i < 4; i++) {
    const L = legSections(i, Z, lod);
    b.add('hide', loftGeometry(L, hi ? 6 : lod === 2 ? 5 : 4), {
      ...coat,
      rig: rigged ? (p) => [i + 1, legSeg(i, p.y), 0, 0] : undefined,
      shade: (p, n, c) => {
        coat.shade?.(p, n, c);
        if (p.y < 0.075) c.set('#28221d'); // hoof
      },
    });
    if (hi) {
      // feathering: coarse hair over the fetlock and coronet, a shade lighter than the points
      const l = HORSE_LEGS[i]!;
      b.add('hide', loftGeometry([
        S(0.23, l.fz - 0.01, 0.044, 0.054, l.x), S(0.13, l.fz + 0.015, 0.064, 0.074, l.x), S(0.03, l.fz + 0.06, 0.08, 0.09, l.x),
      ], 6), {
        color: '#3e342b', vary: 0.05, noise: 0.15, noiseFreq: 9, jitter: 0.012, jitterFreq: 14, ao: 0, dirt: 0.35, renormal: true,
        rig: (p) => [i + 1, legSeg(i, p.y), 0, 0],
      });
    }
  }
  if (!rigged) return;
  const hair: Opts = { ...coat, color: '#211b17', shade: undefined, jitter: 0.012, jitterFreq: 9 };
  // ears
  for (const s of [-1, 1]) {
    b.add('hide', loftGeometry([S(1.9, 1.38, 0.035, 0.022, s * 0.065), S(1.98, 1.355, 0.03, 0.018, s * 0.08), S(2.05, 1.34, 0.004, 0.004, s * 0.09)], 5), { ...coat, color: '#45352a' });
  }
  // mane along the crest (falls to the left side), forelock
  b.add('hide', loftGeometry([
    S(1.58, 0.8, 0.025, 0.03, -0.02), S(1.73, 0.96, 0.06, 0.06, -0.05), S(1.85, 1.1, 0.06, 0.055, -0.055),
    S(1.94, 1.24, 0.05, 0.045, -0.05), S(1.97, 1.36, 0.035, 0.03, -0.03),
  ], 6), hair);
  b.add('hide', loftGeometry([S(1.95, 1.4, 0.04, 0.02), S(1.86, 1.5, 0.05, 0.02), S(1.78, 1.53, 0.02, 0.01)], 5), hair);
  // tail: dock, then the long hair falling to the hocks; swings about the tail root
  b.add('hide', loftGeometry([
    S(1.44, -1.03, 0.055), S(1.38, -1.13, 0.075, 0.07), S(1.22, -1.2, 0.09, 0.08), S(1.0, -1.22, 0.095, 0.075),
    S(0.78, -1.2, 0.08, 0.06), S(0.6, -1.17, 0.05, 0.04), S(0.5, -1.15, 0.015),
  ], 7), {
    ...hair,
    jitter: 0.015,
    rig: (p) => [0, 0, 0, smoothstep(1.46, 1.2, p.y)],
  });

  // --- harness: collar with hames, cart saddle with tugs, belly band, breeching, traces, bridle
  const leather: Opts = { color: LEATHER, vary: 0, noise: 0.05, ao: 0, dirt: 0 };
  const bridle: Opts = { ...leather, rig: bodyRig(Z) };
  b.add('hide', prim(TorusGeometry, 0.25, 0.07, 4, hi ? 11 : 9), { ...leather, color: '#3a2c22', m: trs(0, 1.47, Z + 0.95, -0.78, 0, 0, 0.84, 1.15, 1) });
  b.add('hide', prim(TorusGeometry, 0.29, 0.024, 4, 10, Math.PI * 1.15), { ...leather, color: '#5c4a38', m: trs(0, 1.42, Z + 0.93, -0.78, 0, Math.PI * 0.92, 0.88, 1.18, 1) });
  box(b, 'hide', 0.5, 0.07, 0.3, trs(0, 1.6, Z + 0.15), leather);
  box(b, 'hide', 0.54, 0.035, 0.12, trs(0, 1.63, Z + 0.15), { ...leather, color: '#4a3a2c' });
  b.add('hide', prim(TorusGeometry, 1, 0.022, 3, 14), { ...leather, m: trs(0, 1.2, Z + 0.15, 0, 0, 0, 0.385, 0.425, 1) });
  b.add('hide', prim(TorusGeometry, 1, 0.03, 3, 12, Math.PI), { ...leather, m: trs(0, 1.1, Z - 0.42, Math.PI / 2, 0, Math.PI, 0.39, 0.66, 1) });
  if (!hi) return;
  for (const s of [-1, 1]) {
    // hip strap over the croup to the breeching, tug loop around the shaft
    rod(b, 'hide', P3(s * 0.2, 1.75, Z - 0.5), P3(s * 0.38, 1.12, Z - 0.42), 0.014, 0.014, 3, leather, true);
    // traces: hames → along the flank → hook on the shaft
    const t0 = P3(s * 0.3, 1.32, Z + 0.84), t1 = P3(s * 0.41, 1.06, Z + 0.2), t2 = P3(s * 0.45, 0.94, Z - 0.6), t3 = P3(s * 0.47, 0.89, 2.72);
    rod(b, 'hide', t0, t1, 0.02, 0.02, 4, leather, true);
    rod(b, 'hide', t1, t2, 0.02, 0.02, 4, leather, true);
    rod(b, 'hide', t2, t3, 0.02, 0.02, 4, leather, true);
    // bridle: cheek pieces, noseband side, bit ring, blinker
    rod(b, 'hide', P3(s * 0.11, 1.86, Z + 1.42), P3(s * 0.095, 1.53, Z + 1.7), 0.012, 0.012, 3, bridle, true);
    box(b, 'hide', 0.012, 0.08, 0.09, trs(s * 0.125, 1.82, Z + 1.47, 0.3, s * 0.25, 0), bridle);
  }
  b.add('hide', prim(TorusGeometry, 1, 0.016, 3, 8), { ...bridle, m: trs(0, 1.55, Z + 1.71, 0.85, 0, 0, 0.1, 0.12, 1) });
  b.add('hide', prim(TorusGeometry, 1, 0.014, 3, 8, Math.PI), { ...bridle, m: trs(0, 1.86, Z + 1.43, 0.35, 0, 0, 0.12, 0.08, 1) });
}

const P3 = (x: number, y: number, z: number) => v3(x, y, z);

function buildReins(b: PartBuilder, hands: Vector3): void {
  const bit = v3(0, 1.48, WAGON.horseZ + 1.75);
  for (const s of [-1, 1]) {
    const a = bit.clone().add(v3(s * 0.09, 0, 0));
    const terret = v3(s * 0.12, 1.66, WAGON.horseZ + 0.17);
    const mid = v3(s * 0.2, 1.45, WAGON.horseZ - 0.9);
    const h = hands.clone().add(v3(s * 0.06, 0, 0));
    const o: Opts = { color: LEATHER, ao: 0, dirt: 0 };
    rod(b, 'hide', a, terret, 0.008, 0.008, 3, o, true);
    rod(b, 'hide', terret, mid, 0.008, 0.008, 3, o, true);
    rod(b, 'hide', mid, h, 0.008, 0.008, 3, o, true);
  }
}

// -------------------------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------------------------

export interface WagonModel {
  body: ModelPart[];
  wheelFront: ModelPart[];
  wheelRear: ModelPart[];
  horse: ModelPart[];
  driver: ModelPart[];
  wheels: WheelMount[];
}

const cached = new Map<'near' | 'mid', WagonModel>();

/** Where the seated driver's hands hold the reins (rig space). */
const HANDS = v3(0, WAGON.seatY + 0.3, WAGON.seatZ + 0.46);

/**
 * Animated wagon rig, built once per detail level and shared. 'near' (close zoom) has the full
 * harness, banded hubs and iron tyres; 'mid' keeps the same skinned horse rig and silhouette
 * with fewer segments (the body is shared between both).
 */
export function wagonModel(detail: 'near' | 'mid' = 'near'): WagonModel {
  const hit = cached.get(detail);
  if (hit) return hit;
  const m = bakedOr(`wagon:${detail}`, () => wagonBuild(detail));
  cached.set(detail, m);
  return m;
}

function wagonBuild(detail: 'near' | 'mid'): WagonModel {
  const near = detail === 'near';
  let bodyParts: ModelPart[];
  if (near) {
    const body = new PartBuilder({ seed: 3, ao: 0.25, aoHeight: 1.2 });
    buildBody(body);
    // reins are attached to the body so they stay still relative to the driver
    buildReins(body, HANDS);
    bodyParts = body.build();
  } else bodyParts = wagonModel('near').body;
  const lod = near ? 0 : 2;
  const wf = new PartBuilder({ seed: 4 });
  buildWheel(wf, WAGON.frontWheelRadius, near ? 10 : 8, lod);
  const wr = new PartBuilder({ seed: 5 });
  buildWheel(wr, WAGON.rearWheelRadius, near ? 12 : 10, lod);
  const horse = new PartBuilder({ seed: 6, ao: 0.15 });
  buildHorse(horse, WAGON.horseZ, lod);
  const driver = new PartBuilder({ seed: 7, ao: 0.1, dirt: 0.1 });
  addHuman(driver, trs(0, WAGON.seatY, WAGON.seatZ), HUMAN_STYLES[0], 'sit', near ? 7 : 4, HANDS);
  return {
    body: bodyParts,
    wheelFront: wf.build(),
    wheelRear: wr.build(),
    horse: horse.build(),
    driver: driver.build(),
    wheels: WAGON.wheels,
  };
}

let lod1: ModelPart[] | null = null;

/** Far-zoom rig: one merged static mesh per material (~600 triangles). */
export function wagonLod1(): ModelPart[] {
  if (lod1) return lod1;
  lod1 = bakedOr('wagonLod1', wagonLod1Build);
  return lod1;
}

function wagonLod1Build(): ModelPart[] {
  const b = new PartBuilder({ seed: 8, ao: 0.2 });
  const top = WAGON.bedTopY;
  box(b, 'wood', 1.4, 0.12, 3.3, trs(0, top - 0.06, 0), wood(BOARD));
  for (const s of [-1, 1]) {
    box(b, 'wood', 0.05, 0.36, 3.3, trs(s * 0.72, top + 0.18, 0), wood(BOARD));
    rod(b, 'wood', v3(s * 0.5, 0.52, 1.1), v3(s * 0.4, 1.12, WAGON.horseZ + 0.86), 0.045, 0.04, 3, wood(), true);
  }
  for (const z of [-1.64, 1.64]) box(b, 'wood', 1.4, 0.26, 0.05, trs(0, top + 0.13, z), wood(BOARD));
  for (const w of WAGON.wheels) {
    buildWheel(b, w.radius, 0, 1, new Matrix4().makeTranslation(w.position.x, w.position.y, w.position.z));
  }
  buildHorse(b, WAGON.horseZ, 1);
  // driver as three blobs
  const d: Opts = { color: HUMAN_STYLES[0].tunic, ao: 0, dirt: 0 };
  b.add('cloth', prim(CylinderGeometry, 0.15, 0.2, 0.62, 6), { ...d, m: trs(0, top + 0.72, 1.33) });
  b.add('cloth', prim(SphereGeometry, 0.12, 5, 3), { ...d, color: HUMAN_STYLES[0].hood, m: trs(0, top + 1.18, 1.34) });
  b.add('cloth', prim(CylinderGeometry, 0.07, 0.07, 0.5, 4, 1, true), { ...d, m: trs(0, top + 0.42, 1.6, Math.PI / 2, 0, 0, 2.2, 1, 1) });
  return b.build();
}

// -------------------------------------------------------------------------------------------
// Horse skinning: vertex-shader forward kinematics of the pose from `render/gait.ts`
// -------------------------------------------------------------------------------------------

/** Per-instance attributes the horse material reads (vec4 each, layout of `POSE_SIZE`). */
export const HORSE_POSE_ATTRS = ['iLegA', 'iLegB', 'iLegC', 'iMisc'] as const;

/** Add zeroed per-instance pose attributes for `cap` instances to a (cloned) horse geometry. */
export function addHorsePoseAttributes(g: BufferGeometry, cap: number): InstancedBufferAttribute[] {
  return HORSE_POSE_ATTRS.map((name) => {
    const a = new InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    g.setAttribute(name, a);
    return a;
  });
}

/** Copy one instance's pose (Float32Array of `POSE_SIZE`) into the attributes. */
export function writeHorsePose(attrs: InstancedBufferAttribute[], i: number, pose: Float32Array): void {
  for (let k = 0; k < 4; k++) (attrs[k]!.array as Float32Array).set(pose.subarray(k * 4, k * 4 + 4), i * 4);
}

const SKIN_GLSL = /* glsl */ `
attribute vec4 rig;
attribute vec4 iLegA;
attribute vec4 iLegB;
attribute vec4 iLegC;
attribute vec4 iMisc;
uniform vec4 uLegHK[4];
uniform vec2 uLegF[4];
uniform vec4 uPivots;
vec2 hRot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(v.x * c - v.y * s, v.x * s + v.y * c); }
void horseSkin(inout vec3 p, inout vec3 n) {
  float drop = iMisc.x;
  int li = int(rig.x + 0.5) - 1;
  if (li >= 0) {
    vec4 sel = vec4(equal(ivec4(li), ivec4(0, 1, 2, 3)));
    float a1 = dot(iLegA, sel), a2 = dot(iLegB, sel), a3 = dot(iLegC, sel);
    vec4 hk = uLegHK[li];
    vec2 H = hk.xy, K = hk.zw, F = uLegF[li];
    vec2 Hd = H - vec2(drop, 0.0);
    vec2 Kn = Hd + hRot(K - H, a1);
    vec2 Fn = Kn + hRot(F - K, a2);
    float w0 = clamp(1.0 - rig.y, 0.0, 1.0), w2 = clamp(rig.y - 1.0, 0.0, 1.0), w1 = 1.0 - w0 - w2;
    vec2 v = p.yz;
    p.yz = (Hd + hRot(v - H, a1)) * w0 + (Kn + hRot(v - K, a2)) * w1 + (Fn + hRot(v - F, a3)) * w2;
    n.yz = hRot(n.yz, a1 * w0 + a2 * w1 + a3 * w2);
  } else {
    if (rig.z > 0.0) {
      vec2 piv = uPivots.xy;
      float a = iMisc.y * rig.z;
      p.yz = piv + hRot(p.yz - piv, a);
      n.yz = hRot(n.yz, a);
    }
    if (rig.w > 0.0) {
      vec2 piv = uPivots.zw;
      float a = iMisc.z * rig.w;
      p.xz = piv + hRot(p.xz - piv, a);
      n.xz = hRot(n.xz, a);
    }
    p.y -= drop;
  }
}
`;

function skinUniforms() {
  const Z = WAGON.horseZ;
  return {
    uLegHK: { value: HORSE_LEGS.map((l) => new Vector4(l.hy, l.hz + Z, l.ky, l.kz + Z)) },
    uLegF: { value: HORSE_LEGS.map((l) => new Vector2(l.fy, l.fz + Z)) },
    uPivots: { value: new Vector4(NOD_PIVOT.y, NOD_PIVOT.z + Z, TAIL_PIVOT.x, TAIL_PIVOT.z + Z) },
  };
}

export interface HorseMaterials {
  material: MeshStandardMaterial;
  /** Shadow-map material with the same skinning (assign to `mesh.customDepthMaterial`). */
  depth: MeshDepthMaterial;
}

/**
 * Hide material that poses the horse in the vertex shader from the per-instance pose
 * attributes (`HORSE_POSE_ATTRS`, written with `writeHorsePose`) and the `rig` vertex attribute.
 */
export function createHorseMaterial(): HorseMaterials {
  const u = skinUniforms();
  const material = modelMaterial('hide').clone();
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${SKIN_GLSL}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\nvec3 hP = vec3(position);\nhorseSkin(hP, objectNormal);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed = hP;`);
  };
  material.customProgramCacheKey = () => 'horse-skin-1';
  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  depth.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${SKIN_GLSL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvec3 hN = vec3(0.0, 1.0, 0.0);\nhorseSkin(transformed, hN);`);
  };
  depth.customProgramCacheKey = () => 'horse-skin-depth-1';
  return { material, depth };
}
