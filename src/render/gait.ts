/**
 * Horse gait, render-only and pure (no three.js): the leg pose is a function of the gait phase,
 * and the phase advances with the distance the drawn rig travels (phase += Δdistance / stride),
 * never with time. A hoof in stance moves backward relative to the body by exactly the distance
 * the body moves forward, so it stays planted at any speed and at ×1/×2/×4 game speed.
 *
 * Each leg is a three-joint chain in the horse's local side plane (y up, z forward, origin on
 * the ground under the barrel centre): pivot (scapula top / hip) → knee (carpus) or hock →
 * fetlock → hoof. The fetlock follows a target (planted during stance, lifted on a smooth arc
 * during swing) solved by two-bone IK; the hoof keeps its standing orientation during stance and
 * flips back during swing. The vertex shader in `models/wagon.ts` applies the angles computed
 * here (forward kinematics with the same joints), so the planted hoof in the rendered mesh is
 * exactly the target checked by `tests/gait.test.ts`.
 *
 * Angles rotate the (y, z) plane: R(a)·(y, z) = (y·cos a − z·sin a, y·sin a + z·cos a), i.e. a
 * positive angle swings a downward vector backward (toward −z).
 */

export interface LegDef {
  x: number;
  /** Pivot (scapula top / hip joint), knee or hock, fetlock: (y, z). */
  hy: number; hz: number;
  ky: number; kz: number;
  fy: number; fz: number;
  /** −1 for a front leg (knee folds forward), +1 for a hind leg (hock points back). */
  bend: -1 | 1;
  front: boolean;
  /** Left (−X) legs are 0 and 2. */
  left: boolean;
}

/** Leg order: left fore, right fore, left hind, right hind. */
export const HORSE_LEGS: LegDef[] = [
  { x: -0.19, hy: 1.45, hz: 0.6, ky: 0.5, kz: 0.66, fy: 0.17, fz: 0.645, bend: -1, front: true, left: true },
  { x: 0.19, hy: 1.45, hz: 0.6, ky: 0.5, kz: 0.66, fy: 0.17, fz: 0.645, bend: -1, front: true, left: false },
  { x: -0.2, hy: 1.32, hz: -0.6, ky: 0.6, kz: -0.76, fy: 0.17, fz: -0.66, bend: 1, front: false, left: true },
  { x: 0.2, hy: 1.32, hz: -0.6, ky: 0.6, kz: -0.76, fy: 0.17, fz: -0.66, bend: 1, front: false, left: false },
];

export interface Gait {
  /** Fraction of the cycle a hoof is on the ground. */
  duty: number;
  /** Phase offset of each leg (cycles), order as HORSE_LEGS. */
  offset: [number, number, number, number];
  /** Fetlock lift at mid-swing (m), front and hind. */
  liftF: number; liftH: number;
  /** Hoof flip at mid-swing (rad). */
  flex: number;
  /** Fetlock excursion fore/aft of its standing position during stance (m). */
  reach: number;
}

/** Four-beat walk: LH, LF, RH, RF a quarter cycle apart; three hooves down most of the time. */
export const WALK: Gait = { duty: 0.64, offset: [0.25, 0.75, 0, 0.5], liftF: 0.13, liftH: 0.1, flex: 1.0, reach: 0.4 };
/** Two-beat trot: diagonal pairs (LF+RH, RF+LH) move together. */
export const TROT: Gait = { duty: 0.46, offset: [0.5, 0, 0, 0.5], liftF: 0.2, liftH: 0.15, flex: 1.5, reach: 0.42 };

/** Distance per gait cycle (m): the stance sweeps 2·reach while the body moves duty·stride. */
export function strideOf(g: Gait): number {
  return (2 * g.reach) / g.duty;
}

/** Game-time ground speeds (m/s) between which the walk turns into a trot. */
export const TROT_FROM = 2.3;
export const TROT_FULL = 3.2;

/** 0 = walk, 1 = trot, smooth in between. */
export function gaitBlend(speed: number): number {
  const t = Math.min(1, Math.max(0, (speed - TROT_FROM) / (TROT_FULL - TROT_FROM)));
  return t * t * (3 - 2 * t);
}

const _g: Gait = { duty: 0, offset: [0, 0, 0, 0], liftF: 0, liftH: 0, flex: 0, reach: 0 };

/** Gait parameters blended between walk (0) and trot (1). Returns a shared object. */
export function gaitAt(blend: number, out: Gait = _g): Gait {
  const l = (a: number, b: number) => a + (b - a) * blend;
  out.duty = l(WALK.duty, TROT.duty);
  out.liftF = l(WALK.liftF, TROT.liftF);
  out.liftH = l(WALK.liftH, TROT.liftH);
  out.flex = l(WALK.flex, TROT.flex);
  out.reach = l(WALK.reach, TROT.reach);
  for (let i = 0; i < 4; i++) {
    // walk → trot offsets move the shortest way round the cycle
    let d = TROT.offset[i]! - WALK.offset[i]!;
    if (d > 0.5) d -= 1;
    if (d < -0.5) d += 1;
    out.offset[i] = WALK.offset[i]! + d * blend;
  }
  return out;
}

const frac = (x: number) => x - Math.floor(x);

export interface FetlockTarget {
  /** Fetlock (y, z) in horse space, ground-fixed during stance. */
  y: number;
  z: number;
  /** Absolute hoof angle (0 = standing orientation). */
  hoof: number;
  /** True while the hoof is on the ground. */
  stance: boolean;
}

/** Where leg `i`'s fetlock should be at gait phase `phase` (cycles). */
export function fetlockTarget(i: number, phase: number, g: Gait, out: FetlockTarget): FetlockTarget {
  const leg = HORSE_LEGS[i]!;
  const u = frac(phase + g.offset[i]!);
  const A = g.reach;
  if (u < g.duty) {
    out.z = leg.fz + A - (2 * A * u) / g.duty;
    out.y = leg.fy;
    out.hoof = 0;
    out.stance = true;
  } else {
    const s = (u - g.duty) / (1 - g.duty);
    const e = s * s * (3 - 2 * s);
    const arc = Math.sin(Math.PI * s);
    // the hoof leaves late and reaches early: forward travel eases, lift peaks a little early
    out.z = leg.fz - A + 2 * A * e;
    out.y = leg.fy + (leg.front ? g.liftF : g.liftH) * arc * (1.15 - 0.3 * s);
    out.hoof = g.flex * Math.sin(Math.PI * Math.min(1, s * 1.15)) * (leg.front ? 1 : 0.75);
    out.stance = false;
  }
  return out;
}

/** Angle into (−π, π]. */
const wrap = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
const ang = (y: number, z: number) => Math.atan2(z, y);
const len = (y: number, z: number) => Math.sqrt(y * y + z * z);

/** Segment lengths and rest angles of each leg (derived once). */
export const LEG_REST = HORSE_LEGS.map((l) => ({
  l1: len(l.ky - l.hy, l.kz - l.hz),
  l2: len(l.fy - l.ky, l.fz - l.kz),
  a1: ang(l.ky - l.hy, l.kz - l.hz),
  a2: ang(l.fy - l.ky, l.fz - l.kz),
}));

/** Fraction of full extension the IK may use (keeps the knee from locking straight). */
const MAX_EXT = 0.996;

/**
 * Two-bone IK: rotation of the upper segment (about the dropped pivot) and absolute rotation of
 * the lower segment that bring the fetlock to (ty, tz). `out[0]`, `out[1]`.
 */
export function solveLeg(i: number, ty: number, tz: number, drop: number, out: number[]): number[] {
  const leg = HORSE_LEGS[i]!, r = LEG_REST[i]!;
  const hy = leg.hy - drop;
  let dy = ty - hy, dz = tz - leg.hz;
  let d = len(dy, dz);
  const dMax = (r.l1 + r.l2) * MAX_EXT, dMin = Math.abs(r.l1 - r.l2) + 0.02;
  if (d > dMax) { dy *= dMax / d; dz *= dMax / d; d = dMax; }
  if (d < dMin) { dy *= dMin / d; dz *= dMin / d; d = dMin; }
  const cosA = Math.min(1, Math.max(-1, (r.l1 * r.l1 + d * d - r.l2 * r.l2) / (2 * r.l1 * d)));
  const t1 = ang(dy, dz) + leg.bend * Math.acos(cosA);
  const ky = hy + r.l1 * Math.cos(t1), kz = leg.hz + r.l1 * Math.sin(t1);
  const t2 = ang(hy + dy - ky, leg.hz + dz - kz);
  out[0] = wrap(t1 - r.a1);
  out[1] = wrap(t2 - r.a2);
  return out;
}

/** Body drop (m) that lets every fetlock reach its target (pivots sink by this much). */
function dropFor(i: number, ty: number, tz: number): number {
  const leg = HORSE_LEGS[i]!, r = LEG_REST[i]!;
  const dMax = (r.l1 + r.l2) * MAX_EXT;
  const dz = tz - leg.hz;
  const vy = Math.sqrt(Math.max(0, dMax * dMax - dz * dz));
  return Math.max(0, leg.hy - ty - vy);
}

/** Largest drop over the whole cycle of a gait (computed once per blend bucket). */
const maxDropCache = new Map<number, number>();
function maxDrop(blend: number): number {
  const key = Math.round(blend * 20);
  let v = maxDropCache.get(key);
  if (v === undefined) {
    const g = gaitAt(key / 20, { ..._g, offset: [0, 0, 0, 0] });
    const t: FetlockTarget = { y: 0, z: 0, hoof: 0, stance: false };
    v = 0;
    for (let k = 0; k < 64; k++) for (let i = 0; i < 4; i++) {
      fetlockTarget(i, k / 64, g, t);
      v = Math.max(v, dropFor(i, t.y, t.z));
    }
    maxDropCache.set(key, v);
  }
  return v;
}

/**
 * Pose layout (Float32Array(16), filled by `horsePose`): [0..3] upper-segment angle per leg,
 * [4..7] lower-segment absolute angle, [8..11] hoof absolute angle, [12] body drop (m),
 * [13] head nod (rad), [14] tail swing (rad), [15] driver bob (m).
 */
export const POSE_SIZE = 16;

const _t: FetlockTarget = { y: 0, z: 0, hoof: 0, stance: false };
const _a = [0, 0];
const _targets = new Float32Array(12);

/**
 * Leg pose at gait `phase` (cycles), walk/trot `blend` and `move` (0 = standing square,
 * 1 = full gait; in between the angles ease toward the standing pose).
 */
export function horsePose(phase: number, blend: number, move: number, out: Float32Array, at = 0): Float32Array {
  const g = gaitAt(blend);
  // the body sinks just enough for the planted legs to reach; half of the cycle's largest drop
  // is kept constant so the remaining bob stays small
  let need = 0;
  for (let i = 0; i < 4; i++) {
    fetlockTarget(i, phase, g, _t);
    _targets[i * 3] = _t.y; _targets[i * 3 + 1] = _t.z; _targets[i * 3 + 2] = _t.hoof;
    need = Math.max(need, dropFor(i, _t.y, _t.z));
  }
  const drop = (need + maxDrop(blend)) * 0.5;
  for (let i = 0; i < 4; i++) {
    solveLeg(i, _targets[i * 3]!, _targets[i * 3 + 1]!, drop, _a);
    out[at + i] = _a[0]! * move;
    out[at + 4 + i] = _a[1]! * move;
    out[at + 8 + i] = _targets[i * 3 + 2]! * move;
  }
  out[at + 12] = drop * move;
  // walk: the head nods twice per cycle with the forelegs; trot: the head is carried still
  out[at + 13] = 0.07 * (1 - blend) * Math.cos(4 * Math.PI * (phase + 0.1)) * move;
  out[at + 14] = 0;
  // the wagon jolts with each footfall: twice per cycle, sharper in the trot
  const j = Math.abs(Math.sin(2 * Math.PI * phase));
  out[at + 15] = -(0.012 + 0.014 * blend) * j * move;
  return out;
}

/** Rotate (y, z) by `a` (same convention as the shader). */
function rot(y: number, z: number, a: number): [number, number] {
  const c = Math.cos(a), s = Math.sin(a);
  return [y * c - z * s, y * s + z * c];
}

/**
 * Forward kinematics of a point of leg `i` (rest position (y, z)) for segment `seg`
 * (0 upper, 1 lower, 2 hoof), exactly as the vertex shader does it.
 */
export function legPoint(i: number, seg: 0 | 1 | 2, y: number, z: number, pose: Float32Array, at = 0): [number, number] {
  const leg = HORSE_LEGS[i]!;
  const drop = pose[at + 12]!;
  const a1 = pose[at + i]!, a2 = pose[at + 4 + i]!, a3 = pose[at + 8 + i]!;
  const hy = leg.hy - drop, hz = leg.hz;
  if (seg === 0) {
    const [ry, rz] = rot(y - leg.hy, z - leg.hz, a1);
    return [hy + ry, hz + rz];
  }
  const [ky, kz] = rot(leg.ky - leg.hy, leg.kz - leg.hz, a1);
  const Ky = hy + ky, Kz = hz + kz;
  if (seg === 1) {
    const [ry, rz] = rot(y - leg.ky, z - leg.kz, a2);
    return [Ky + ry, Kz + rz];
  }
  const [fy, fz] = rot(leg.fy - leg.ky, leg.fz - leg.kz, a2);
  const [ry, rz] = rot(y - leg.fy, z - leg.fz, a3);
  return [Ky + fy + ry, Kz + fz + rz];
}
