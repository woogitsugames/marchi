/**
 * Medieval peasant figures at real scale (≈1.70 m, head ≈ 1/7.5 of the height): a woollen
 * tunic belted at the waist with a purse, hose with leg wraps, turnshoes, and a hood with a
 * shoulder cape and liripipe, a brimmed felt hat or a linen coif. Built from smooth
 * lathe/cylinder pieces, ~600–800 triangles at the default segment count.
 */
import { type BufferGeometry, ConeGeometry, CylinderGeometry, Matrix4, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { type ModelPart, PartBuilder, trs, v3 } from './kit';
import { box, lathe, rod, type Opts } from './shapes';

export interface HumanStyle {
  tunic: string;
  hose: string;
  /** Hood / hat / coif colour. */
  hood: string;
  skin: string;
  hair: string;
  /** Leg wraps (winingas) over the hose. */
  wraps: string;
  /** Headwear: hood with shoulder cape, brimmed felt hat, or a close linen coif. */
  head: 'hood' | 'hat' | 'coif';
}

export const HUMAN_STYLES: HumanStyle[] = [
  { tunic: '#6b5f4c', hose: '#4a4136', hood: '#7a6f5a', skin: '#a98a74', hair: '#3b2f25', wraps: '#5d5444', head: 'hood' },
  { tunic: '#525640', hose: '#3f3a31', hood: '#4d4336', skin: '#9e7d66', hair: '#4a3a2a', wraps: '#6a604e', head: 'hat' },
  { tunic: '#5e4a3c', hose: '#4c463c', hood: '#6c6352', skin: '#a8846c', hair: '#2f2620', wraps: '#4a4237', head: 'hood' },
  { tunic: '#7a705e', hose: '#4f4436', hood: '#c2b9a3', skin: '#a3826b', hair: '#5a4632', wraps: '#5b5141', head: 'coif' },
];

export type HumanPose = 'stand' | 'sit' | 'work';

const cloth = (color: string): Opts => ({ color, vary: 0.04, noise: 0.08, ao: 0.25, dirt: 0.25 });
const flesh = (color: string): Opts => ({ color, ao: 0, dirt: 0, vary: 0.03, noise: 0.03 });

/**
 * Add a human to a builder. `m` places the figure: origin between the feet (stand/work) or at
 * the seat surface under the pelvis (sit); facing +Z. `hands` (builder space, sit pose) is
 * where both hands meet, e.g. holding the reins.
 */
/** Which pieces addHuman builds: everything, or one rig part of an animated worker (legs / torso + head / arms). */
export type HumanPart = 'all' | 'legs' | 'torso' | 'arms';

export function addHuman(b: PartBuilder, m: Matrix4, style: HumanStyle, pose: HumanPose = 'stand', seg = 8, hands?: Vector3, part: HumanPart = 'all'): void {
  const want = (p: HumanPart): boolean => part === 'all' || part === p;
  const P = (x: number, y: number, z: number) => v3(x, y, z).applyMatrix4(m);
  const sit = pose === 'sit';
  /** Small details (purse, wraps, face, liripipe) only at the near segment counts. */
  const fine = seg > 5;
  // key heights (standing): hip 0.9, waist 1.04, shoulder 1.40, chin 1.49, head centre 1.6
  const hipY = sit ? 0.12 : 0.9;
  const dy = hipY - 0.9;
  const lean = sit ? 0.06 : 0; // a seated driver leans forward a little
  const T = (x: number, y: number, z: number) => P(x, y + dy, z + y * lean); // ≈ torso rotated by `lean`
  const torsoM = m.clone().multiply(trs(0, dy, 0, lean, 0, 0)).multiply(trs(0, 0, 0, 0, 0, 0, 1, 1, 0.7));

  if (want('torso')) {
  // --- torso: tunic lathe (the skirt flares over the thighs when standing)
  const prof: [number, number][] = sit
    ? [[0.001, 0.86], [0.18, 0.86], [0.195, 0.95], [0.168, 1.04], [0.182, 1.16], [0.195, 1.28], [0.188, 1.35], [0.15, 1.41], [0.075, 1.465], [0.001, 1.47]]
    : [[0.001, 0.52], [0.245, 0.52], [0.232, 0.6], [0.21, 0.74], [0.195, 0.88], [0.168, 1.04], [0.182, 1.16], [0.195, 1.28], [0.188, 1.35], [0.15, 1.41], [0.075, 1.465], [0.001, 1.47]];
  lathe(b, 'cloth', prof, seg + 5, torsoM, {
    ...cloth(style.tunic),
    jitter: seg > 5 ? 0.008 : 0,
    jitterFreq: 11,
    // folds hanging from the belt (darker valleys), a darker hem band
    shade: (p, _n, c) => {
      const lo = Math.min(1, Math.max(0, (1.0 + dy - p.y) / 0.3));
      c.multiplyScalar(1 - lo * 0.12 * (0.5 + 0.5 * Math.sin(Math.atan2(p.x - m.elements[12], p.z - m.elements[14]) * 9)));
      if (!sit && p.y < 0.565) c.multiplyScalar(0.82);
    },
  });
  // belt, buckle and purse
  b.add('hide', new CylinderGeometry(0.172, 0.172, 0.045, seg + 4, 1, true), { color: '#3a2e24', m: torsoM.clone().multiply(trs(0, 1.04, 0)) });
  if (fine) box(b, 'hide', 0.035, 0.035, 0.012, m.clone().multiply(trs(0, 1.04 + dy, 0.122 + 0.14 * lean)), { color: '#5a554b', ao: 0, dirt: 0 });
  if (fine) box(b, 'hide', 0.085, 0.1, 0.035, m.clone().multiply(trs(0.12, 0.97 + dy, 0.08, 0, 0.5, 0)), { color: '#4a3b2d', ao: 0, dirt: 0.1 });

  }
  // --- legs: hose, leg wraps from ankle to below the knee, turnshoes
  if (want('legs')) for (const s of [-1, 1]) {
    const hx = 0.09 * s;
    let hip: Vector3, knee: Vector3, ankle: Vector3;
    if (sit) {
      hip = T(hx, 0.92, 0.02);
      knee = P(hx * 1.15, 0.12 + 0.03, 0.45);
      ankle = P(hx * 1.2, -0.36, 0.52);
      rod(b, 'cloth', hip, knee, 0.088, 0.066, seg, cloth(style.tunic));
    } else {
      const work = pose === 'work';
      const fz = work ? (s > 0 ? 0.18 : -0.12) : 0;
      hip = P(hx, 0.88, 0);
      knee = P(hx * 1.05, 0.5, fz * 0.55 + 0.02);
      ankle = P(hx * 1.1, 0.08, fz);
      rod(b, 'cloth', hip, knee, 0.078, 0.058, seg, cloth(style.hose));
    }
    rod(b, 'cloth', knee, ankle, 0.056, 0.042, seg, cloth(style.hose), true);
    // wraps: a slightly thicker, banded sleeve over the shin
    const w0 = knee.clone().lerp(ankle, 0.22), w1 = knee.clone().lerp(ankle, 0.96);
    if (fine) rod(b, 'cloth', w0, w1, 0.054, 0.047, seg, {
      ...cloth(style.wraps),
      shade: (p, _n, c) => { if (Math.sin(p.y * 95 + p.z * 40) > 0.55) c.multiplyScalar(0.8); },
    }, true);
    shoe(b, ankle, m);
  }

  // --- arms: sleeves with a cuff, hands
  if (want('arms')) for (const s of [-1, 1]) {
    const sh = T(0.195 * s, 1.37, 0);
    let elbow: Vector3, wrist: Vector3;
    if (sit && hands) {
      wrist = hands.clone().add(new Vector3(0.07 * s, -0.02, -0.06).transformDirection(m).multiplyScalar(Math.hypot(0.07, 0.02, 0.06)));
      elbow = sh.clone().lerp(wrist, 0.5).add(new Vector3(0.09 * s, -0.12, -0.04).transformDirection(m).multiplyScalar(Math.hypot(0.09, 0.12, 0.04)));
    } else if (sit) {
      elbow = T(0.23 * s, 1.12, 0.12);
      wrist = T(0.15 * s, 1.07, 0.38);
    } else if (pose === 'work') {
      elbow = T(0.24 * s, 1.15, 0.14);
      wrist = T(0.08 * s, 1.18, 0.38);
    } else {
      elbow = T(0.215 * s, 1.11, -0.045);
      wrist = T(0.2 * s, 0.86, 0.06);
    }
    // rounded shoulder (no flat sleeve cap showing), open sleeve tube down to the elbow
    b.add('cloth', new SphereGeometry(0.064, Math.max(5, seg - 1), 4), { ...cloth(style.tunic), m: new Matrix4().makeTranslation(sh.x, sh.y, sh.z) });
    rod(b, 'cloth', sh, elbow, 0.058, 0.047, Math.max(4, seg - 1), cloth(style.tunic), true);
    rod(b, 'cloth', elbow, wrist, 0.047, 0.041, Math.max(4, seg - 1), cloth(style.tunic), true);
    if (fine) b.add('cloth', new SphereGeometry(0.047, Math.max(4, seg - 1), 3), { ...cloth(style.tunic), m: new Matrix4().makeTranslation(elbow.x, elbow.y, elbow.z) });
    const dir = new Vector3().subVectors(wrist, elbow).normalize();
    rod(b, 'cloth', wrist.clone().addScaledVector(dir, -0.05), wrist.clone().addScaledVector(dir, 0.005), 0.05, 0.05, seg - 2, cloth(style.hose), true);
    const hand = wrist.clone().addScaledVector(dir, 0.06);
    const hm = new Matrix4().lookAt(hand, hand.clone().add(dir), new Vector3(0, 1, 0).applyMatrix4(new Matrix4().extractRotation(m)));
    hm.setPosition(hand);
    b.add('skin', new SphereGeometry(1, 5, 3), { ...flesh(style.skin), m: hm.multiply(new Matrix4().makeScale(0.04, 0.03, 0.065)) });
  }

  if (!want('torso')) return;
  // --- neck + head (face with a nose, jaw and brow so the profile reads)
  rod(b, 'skin', T(0, 1.43, 0), T(0, 1.53, 0.012), 0.048, 0.046, 6, flesh(style.skin), true);
  const hc = T(0, 1.6, 0.015);
  const headM = new Matrix4().copy(m).setPosition(hc).multiply(trs(0, 0, 0, lean * 0.5, 0, 0));
  b.add('skin', new SphereGeometry(1, seg + 2, Math.max(4, seg - 1)), { ...flesh(style.skin), m: headM.clone().multiply(trs(0, 0, 0, 0, 0, 0, 0.083, 0.108, 0.098)) });
  if (fine) b.add('skin', new SphereGeometry(1, 5, 3), { ...flesh(style.skin), m: headM.clone().multiply(trs(0, -0.06, 0.035, 0, 0, 0, 0.062, 0.045, 0.06)) });
  if (fine) b.add('skin', new CylinderGeometry(0.004, 0.017, 0.045, 4), { ...flesh(style.skin), m: headM.clone().multiply(trs(0, -0.005, 0.098, -0.35)) });
  // hair below the headwear and a beard shadow for the darker-haired
  b.add('cloth', new SphereGeometry(1, seg, 3, Math.PI * 0.68, Math.PI * 1.64, 0, Math.PI * 0.62), {
    color: style.hair, ao: 0, dirt: 0, m: headM.clone().multiply(trs(0, 0.0, -0.004, 0, 0, 0, 0.088, 0.112, 0.1)),
  });

  if (style.head === 'hood') {
    // chaperon hood: shell open at the face, shoulder cape, liripipe hanging down the back
    b.add('cloth', new SphereGeometry(1, seg + 2, Math.max(3, seg - 2), Math.PI * 0.82, Math.PI * 1.36, 0, Math.PI * 0.64), {
      ...cloth(style.hood), m: headM.clone().multiply(trs(0, 0.015, -0.008, 0, 0, 0, 0.108, 0.13, 0.122)),
    });
    lathe(b, 'cloth', [[0.001, 1.25], [0.26, 1.24], [0.255, 1.3], [0.22, 1.37], [0.15, 1.44], [0.1, 1.5], [0.001, 1.52]], seg + 2,
      m.clone().multiply(trs(0, dy, -0.01, lean, 0, 0, 1, 1, 0.8)), {
        ...cloth(style.hood),
        shade: (p, _n, c) => { if (Math.sin(Math.atan2(p.x, p.z) * 7) > 0.6) c.multiplyScalar(0.9); },
      });
    const crown = headM.clone();
    const a = v3(0, 0.07, -0.09).applyMatrix4(crown), c = v3(0, -0.2, -0.16).applyMatrix4(crown);
    if (fine) rod(b, 'cloth', a, c, 0.035, 0.012, 5, cloth(style.hood));
  } else if (style.head === 'hat') {
    // brimmed felt hat, slightly worn out of shape
    const hm = headM.clone().multiply(trs(0, 0.07, -0.005, -0.08, 0, 0.04));
    b.add('cloth', new CylinderGeometry(0.075, 0.098, 0.1, seg + 2, 1, false), { ...cloth(style.hood), ao: 0, dirt: 0, m: hm.clone().multiply(trs(0, 0.05, 0)) });
    b.add('cloth', new CylinderGeometry(0.175, 0.17, 0.012, seg + 6, 1, false), {
      ...cloth(style.hood), ao: 0, dirt: 0, m: hm.clone().multiply(trs(0, 0.0, 0.01, 0.05, 0, 0, 1, 1, 0.95)), jitter: 0.008, jitterFreq: 9,
    });
  } else {
    // linen coif tied under the chin
    b.add('cloth', new SphereGeometry(1, seg + 2, Math.max(3, seg - 3), Math.PI * 0.74, Math.PI * 1.52, 0, Math.PI * 0.7), {
      ...cloth(style.hood), ao: 0, dirt: 0, m: headM.clone().multiply(trs(0, 0.01, -0.006, 0, 0, 0, 0.094, 0.118, 0.106)),
    });
  }
}

function shoe(b: PartBuilder, ankle: Vector3, m: Matrix4): void {
  const fwd = new Vector3(0, 0, 1).transformDirection(m);
  const c = ankle.clone().addScaledVector(fwd, 0.055).add(new Vector3(0, -0.04, 0));
  const ry = Math.atan2(fwd.x, fwd.z);
  b.add('hide', new SphereGeometry(1, 6, 3), { color: '#3b3027', m: trs(c.x, c.y, c.z, 0, ry, 0, 0.05, 0.045, 0.13), dirt: 0.5 });
}

/** Standalone standing worker for building yards. Origin between the feet, facing +Z. */
export function workerParts(variant = 0, pose: HumanPose = 'stand'): ModelPart[] {
  const b = new PartBuilder({ seed: 40 + variant, ao: 0.2 });
  addHuman(b, new Matrix4(), HUMAN_STYLES[variant % HUMAN_STYLES.length], pose);
  return b.build();
}

/** Animated yard workers (render-only): rig parts that the buildings view poses every frame. */
export type WorkerKind = 'chop' | 'sack' | 'peel' | 'sawTop' | 'sawPit' | 'hoe' | 'net';
/** All kinds, in the order their rig seeds were assigned (append only: a new kind must not reseed the old ones). */
export const WORKER_KINDS: WorkerKind[] = ['chop', 'sack', 'peel', 'sawTop', 'sawPit', 'hoe', 'net'];

export interface WorkerRig {
  /** Legs and shoes, origin between the feet, facing +Z. */
  legs: ModelPart[];
  /** Tunic, belt, head; origin at the hip pivot (HIP_Y above the feet). */
  torso: ModelPart[];
  /** Both arms and the tool in the hands; origin at the shoulder axis (SHOULDER_Y above the hip). */
  arms: ModelPart[];
  /**
   * A tool that moves on its own, not with the arms (the pit saw): origin between the feet, lifted by the
   * pose's `lift` each frame. Absent for tools carried in the hands.
   */
  tool?: ModelPart[];
}

export const WORKER_HIP_Y = 0.9;
export const WORKER_SHOULDER_Y = 1.37 - WORKER_HIP_Y;

const rigCache = new Map<string, WorkerRig>();

/** The rig of a worker kind (cached; shared geometry). Arms rest forward in the 'work' pose. */
export function workerRig(kind: WorkerKind, variant = 0): WorkerRig {
  const key = `${kind}:${variant}`;
  const hit = rigCache.get(key);
  if (hit) return hit;
  const style = HUMAN_STYLES[variant % HUMAN_STYLES.length]!;
  const seed = 60 + variant * 3 + WORKER_KINDS.indexOf(kind);
  const lb = new PartBuilder({ seed, ao: 0.2 });
  addHuman(lb, new Matrix4(), style, 'work', 7, undefined, 'legs');
  const tb = new PartBuilder({ seed: seed + 100, ao: 0.2 });
  addHuman(tb, new Matrix4().makeTranslation(0, -WORKER_HIP_Y, 0), style, 'work', 7, undefined, 'torso');
  const ab = new PartBuilder({ seed: seed + 200, ao: 0.2 });
  addHuman(ab, new Matrix4().makeTranslation(0, -1.37, 0), style, 'work', 7, undefined, 'arms');
  // tools, in the shoulder frame: the hands meet ~0.19 m below and 0.45 m in front of the shoulder axis
  const handle = { color: '#6b5440', vary: 0.05, noise: 0.06, ao: 0, dirt: 0.2 };
  if (kind === 'chop') {
    // felling axe: a 0.8 m haft held near its end, the iron head with the bit pointing down
    rod(ab, 'wood', v3(0, -0.2, 0.36), v3(0, -0.13, 1.12), 0.018, 0.016, 5, handle);
    box(ab, 'metal', 0.035, 0.1, 0.07, trs(0, -0.12, 1.1), { color: '#5d5d58', ao: 0, dirt: 0.1 });
    box(ab, 'metal', 0.012, 0.13, 0.11, trs(0, -0.2, 1.12), { color: '#7a7a72', ao: 0, dirt: 0.05 });
  } else if (kind === 'peel') {
    // baker's peel: a long ash pole with a flat blade to slide loaves in and out of the oven
    rod(ab, 'wood', v3(0, -0.21, 0.3), v3(0, -0.14, 1.85), 0.017, 0.017, 5, handle);
    box(ab, 'wood', 0.3, 0.018, 0.34, trs(0, -0.14, 2.0), { color: '#8a7354', ao: 0, dirt: 0.15 });
  } else if (kind === 'sack') {
    // a flour sack held against the body
    ab.add('cloth', new SphereGeometry(1, 9, 6), { color: '#c4bba6', m: trs(0, -0.36, 0.42, 0, 0, 0, 0.22, 0.3, 0.17), vary: 0.04, noise: 0.1, ao: 0, dirt: 0.15, jitter: 0.02, jitterFreq: 4 });
  } else if (kind === 'hoe') {
    // field hoe: a 1.2 m haft, the iron blade set across it at the far end, edge down
    rod(ab, 'wood', v3(0, -0.21, 0.3), v3(0, -0.3, 1.32), 0.017, 0.015, 5, handle);
    box(ab, 'metal', 0.2, 0.15, 0.014, trs(0, -0.38, 1.33, 0.35, 0, 0), { color: '#5d5d58', ao: 0, dirt: 0.25 });
  } else if (kind === 'net') {
    // lift net: a 3.3 m pole, a willow hoop at its end and the net bag hanging from it
    const tip = v3(0, -1.0, 3.25);
    rod(ab, 'wood', v3(0, -0.2, 0.28), tip, 0.022, 0.016, 5, handle);
    ab.add('wood', new TorusGeometry(0.42, 0.018, 4, 14), { color: '#6f5a3e', m: trs(tip.x, tip.y - 0.03, tip.z + 0.4, Math.PI / 2), ao: 0, dirt: 0.2 });
    ab.add('cloth', new ConeGeometry(0.4, 0.55, 10, 2, true), { color: '#8a8270', m: trs(tip.x, tip.y - 0.31, tip.z + 0.4, Math.PI), vary: 0.05, noise: 0.25, ao: 0, dirt: 0.1, jitter: 0.03, jitterFreq: 6 });
  } else if (kind === 'sawPit') {
    // the pit man: no tool of his own, his hands meet the saw's lower box handle (drawn with the top sawyer)
  }
  let tool: ModelPart[] | undefined;
  if (kind === 'sawTop') {
    // pit saw, in the top sawyer's frame (feet on the log): the blade runs down through the log in the
    // plane he faces along, the tiller across its top in his hands, the box handle at the bottom for the pit man
    const kb = new PartBuilder({ seed: seed + 300, ao: 0 });
    const z = 0.45;
    box(kb, 'metal', 0.012, 1.75, 0.15, trs(0, 0.33, z), { color: '#6a6862', ao: 0, dirt: 0.05 });
    box(kb, 'metal', 0.016, 1.75, 0.02, trs(0, 0.33, z - 0.075), { color: '#4c4a45', ao: 0, dirt: 0 }); // toothed edge, darker
    rod(kb, 'wood', v3(-0.27, 1.2, z), v3(0.27, 1.2, z), 0.022, 0.022, 5, handle);
    rod(kb, 'wood', v3(-0.18, -0.55, z), v3(0.18, -0.55, z), 0.02, 0.02, 5, handle);
    for (const s of [-1, 1]) rod(kb, 'wood', v3(0.02 * s, -0.55, z), v3(0.02 * s, -0.4, z), 0.018, 0.018, 4, handle);
    tool = oneMesh(kb.build());
  }
  const rig: WorkerRig = { legs: oneMesh(lb.build()), torso: oneMesh(tb.build()), arms: oneMesh(ab.build()), tool };
  rigCache.set(key, rig);
  return rig;
}

const RIG_ATTRS = ['position', 'normal', 'color'];
/**
 * One draw call per rig piece: every material of a worker merged under 'cloth' (the colour is in the
 * vertices; at yard scale skin, leather and the axe iron read the same under the cloth sheen).
 */
function oneMesh(parts: ModelPart[]): ModelPart[] {
  const geos: BufferGeometry[] = [];
  for (const p of parts) {
    const g = (p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone());
    for (const k of Object.keys(g.attributes)) if (!RIG_ATTRS.includes(k)) g.deleteAttribute(k);
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!merged) return parts;
  merged.computeBoundingSphere();
  return [{ ...parts[0]!, material: 'cloth', geometry: merged }];
}

function smooth01(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/**
 * Pose of a worker at time `t` (s): hip bend `bend` and arm swing `arm` (radians about the
 * side axis; > 0 = forward / down). `working` false = the rest pose with a slow breath.
 */
export interface WorkerPose {
  bend: number;
  arm: number;
  /** Vertical travel of the rig's free tool (m), the pit saw's stroke; 0 otherwise. */
  lift: number;
}

/** Rest pose arm angle per kind: tools held so their ends stay clear of the ground. */
const REST_ARM: Record<WorkerKind, number> = { chop: 0.35, sack: 0.35, peel: -0.05, sawTop: 0, sawPit: 0.35, hoe: 0.8, net: -0.15 };

/** The hoe stroke (s) and the step the farmer takes back along the furrow after each stroke (m). */
export const HOE_CYCLE = 2.6;
export const HOE_STEP = 0.45;

/**
 * Distance (m) the farmer has walked along the furrow after `t` s of hoeing: still while the hoe goes up, bites
 * and draws the earth, one short step back at the end of each stroke (the last 14 %, ~0.36 s) — slow, never a glide.
 */
export function hoeWalk(t: number): number {
  const n = Math.floor(t / HOE_CYCLE), p = t / HOE_CYCLE - n;
  return HOE_STEP * (n + smooth01((p - 0.86) / 0.14));
}

export function workerPose(kind: WorkerKind, t: number, working: boolean, out: WorkerPose): void {
  out.lift = 0;
  if (!working) {
    out.bend = 0.03 + 0.015 * Math.sin(t * 1.3);
    out.arm = REST_ARM[kind];
    return;
  }
  const D = Math.PI / 180;
  if (kind === 'sawTop' || kind === 'sawPit') {
    // 1.5 s per stroke pair: the cut on the way down (the pit man pulls), a lighter return; both men share
    // the saw, so the stroke `s` (+1 top, −1 bottom) is the same phase for both (same building, same t)
    const p = (t / 1.5) % 1;
    const s = 1 - 2 * smooth01(p / 0.55) + 2 * smooth01((p - 0.55) / 0.45);
    out.lift = 0.17 * s;
    if (kind === 'sawTop') {
      out.bend = 8 * D + 9 * D * (1 - s) * 0.5;
      out.arm = -0.37 * s - out.bend * 0.6;
    } else {
      out.bend = -3 * D + 7 * D * (1 - s) * 0.5;
      out.arm = -80 * D - 20 * D * s - out.bend;
    }
    return;
  }
  if (kind === 'hoe') {
    // 2.6 s: lift the hoe to the shoulder, chop it into the soil, draw the earth back toward the feet
    const p = (t / HOE_CYCLE) % 1;
    const up = smooth01(p / 0.35), strike = smooth01((p - 0.42) / 0.1), pull = smooth01((p - 0.6) / 0.3);
    out.bend = 14 * D + 14 * D * strike - 4 * D * up * (1 - strike) + 6 * D * pull * (1 - pull) * 4 - 10 * D * pull;
    out.arm = 40 * D - 85 * D * up + 80 * D * strike + 15 * D * pull;
    return;
  }
  if (kind === 'net') {
    // 6 s: the net lowered into the water, a long wait with the pole twitching, hauled up to see the catch, held
    const p = (t / 6) % 1;
    const k = smooth01(p / 0.12) - smooth01((p - 0.62) / 0.12);
    out.bend = 6 * D + 8 * D * k;
    out.arm = -20 * D + 34 * D * k + 0.012 * Math.sin(t * 2.1) * k;
    return;
  }
  if (kind === 'chop') {
    // 1.7 s: raise the axe over the head, a quick stroke into the block, a short pause, pull it free
    const p = (t / 1.7) % 1;
    const up = smooth01(p / 0.5), strike = smooth01((p - 0.55) / 0.12), free = smooth01((p - 0.82) / 0.18);
    out.arm = 15 * D + (-145 * D) * up + (160 * D) * strike + (-15 * D) * free;
    out.bend = 12 * D + (-20 * D) * up + (22 * D) * strike + (-14 * D) * free;
  } else if (kind === 'peel') {
    // 3.2 s: lean in and slide the peel into the oven, hold, draw it back
    const p = (t / 3.2) % 1;
    const k = smooth01(p / 0.35) - smooth01((p - 0.6) / 0.35);
    out.bend = 4 * D + 16 * D * k;
    out.arm = -out.bend * 0.85 - 4 * D;
  } else {
    // 3.6 s: bend down to the sack, straighten up with it against the chest, set it down again
    const p = (t / 3.6) % 1;
    const down = smooth01(p / 0.3) - smooth01((p - 0.38) / 0.3);
    const lift = smooth01((p - 0.4) / 0.25) - smooth01((p - 0.82) / 0.18);
    out.bend = 70 * D * down;
    out.arm = 25 * D * down - 55 * D * lift;
  }
}
