/**
 * Two-axle farm wagon (plank-sided box wagon, iron-tyred spoked wheels, shafts) with one
 * draught horse in collar harness and a seated driver.
 *
 * Rig frame: origin on the ground midway between the axles, wagon front (and horse) toward +Z.
 * Parts are exported separately so the renderer can instance them: body (static), front and
 * rear wheel (axis along X, centred at the origin — place with `WAGON.wheels` and spin around
 * X), horse (with a `swing` vertex attribute for a vertex-shader walk, or use the two baked
 * poses), driver. `wagonLod1()` is a single low-detail merged rig for far zoom.
 */
import {
  BufferAttribute,
  Color,
  CylinderGeometry,
  LatheGeometry,
  Matrix4,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { type ModelPart, PartBuilder, trs, v3 } from './kit';
import { modelMaterial } from './materials';
import { addHuman, HUMAN_STYLES } from './people';
import { beam, box, rod, type Opts } from './shapes';

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
const IRON = '#2f2d2b';
const wood = (color = WOOD): Opts => ({ color, vary: 0.1, noise: 0.1, jitter: 0.004, jitterFreq: 3 });

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
    box(b, 'wood', 1.32 / nb - 0.01, 0.045, 3.25, trs(x, top - 0.022, 0.0), wood('#76634b'));
  }
  // sills under the floor
  for (const s of [-1, 1]) beam(b, 'wood', v3(0.5 * s, top - 0.1, -1.7), v3(0.5 * s, top - 0.1, 1.7), 0.1, 0.12, wood(WOOD_DARK));
  // reach pole linking the axles
  beam(b, 'wood', v3(0, 0.66, zr - 0.25), v3(0, 0.6, zf + 0.1), 0.1, 0.1, wood(WOOD_DARK));
  // rear axle + bolster
  beam(b, 'wood', v3(-0.98, 0.6, zr), v3(0.98, 0.6, zr), 0.12, 0.12, wood(WOOD_DARK));
  beam(b, 'wood', v3(-0.8, 0.79, zr), v3(0.8, 0.79, zr), 0.14, 0.24, wood(WOOD_DARK));
  // front axle, bolster and turntable block
  beam(b, 'wood', v3(-0.98, 0.5, zf), v3(0.98, 0.5, zf), 0.12, 0.12, wood(WOOD_DARK));
  beam(b, 'wood', v3(-0.8, 0.66, zf), v3(0.8, 0.66, zf), 0.14, 0.18, wood(WOOD_DARK));
  beam(b, 'wood', v3(-0.75, 0.84, zf), v3(0.75, 0.84, zf), 0.14, 0.16, wood(WOOD_DARK));
  // side boards: two planks per side, slightly flared; stakes outside them
  for (const s of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const y = top + 0.09 + k * 0.18;
      const x = s * (0.7 + k * 0.03);
      box(b, 'wood', 0.04, 0.17, 3.3, trs(x, y, 0, 0, 0, s * -0.12), wood('#6e5a44'));
    }
    for (const z of [-1.45, -0.35, 0.7, 1.5]) {
      rod(b, 'wood', v3(s * 0.66, top - 0.18, z), v3(s * 0.8, top + 0.44, z), 0.035, 0.03, 5, wood(WOOD_DARK));
    }
    // iron strap where stake meets bolster (dark)
    box(b, 'wood', 0.05, 0.05, 3.32, trs(s * 0.77, top + 0.36, 0, 0, 0, s * -0.12), { color: WOOD_DARK, vary: 0.05 });
  }
  // end boards (lower), rear one is a removable tailboard
  for (const z of [-1.64, 1.64]) {
    box(b, 'wood', 1.4, 0.26, 0.04, trs(0, top + 0.13, z), wood('#6e5a44'));
  }
  // driver's seat board across the front of the bed + footboard
  box(b, 'wood', 1.5, 0.05, 0.3, trs(0, top + 0.37, 1.35), wood('#7a6650'));
  box(b, 'wood', 1.1, 0.04, 0.4, trs(0, top - 0.06, 1.95, 0.25), wood('#6b5843'));
  // shafts (thills) from the front axle along the horse's flanks to the collar
  for (const s of [-1, 1]) {
    const a = v3(s * 0.5, 0.52, zf + 0.05);
    const m1 = v3(s * 0.46, 0.85, 2.6);
    const c = v3(s * 0.42, 1.16, WAGON.horseZ + 0.8);
    rod(b, 'wood', a, m1, 0.045, 0.042, 6, wood('#6e5a44'));
    rod(b, 'wood', m1, c, 0.042, 0.035, 6, wood('#6e5a44'));
    beam(b, 'wood', a.clone().add(v3(0, 0, 0.05)), v3(0, 0.5, zf + 0.45), 0.06, 0.06, wood(WOOD_DARK));
  }
  // iron tyre hubs caps / linchpins hint on axle ends are on the wheels
  void IRON;
}

// -------------------------------------------------------------------------------------------
// Wheels
// -------------------------------------------------------------------------------------------

function buildWheel(b: PartBuilder, radius: number, spokes: number, lod: 0 | 1, at = new Matrix4()): void {
  const w = radius > 0.55 ? 0.085 : 0.075;
  if (lod === 1) {
    b.add('wood', new CylinderGeometry(radius, radius, w, 12, 1, false), {
      color: '#4d4031',
      m: at.clone().multiply(trs(0, 0, 0, 0, 0, Math.PI / 2)),
      ao: 0,
      dirt: 0.4,
    });
    return;
  }
  const rin = radius - 0.085;
  // felloe ring with an iron tyre on the outer face (lathe of the cross-section, around Y → X)
  const prof = [
    new Vector2(rin, -w / 2),
    new Vector2(radius - 0.012, -w / 2),
    new Vector2(radius, -w / 2 + 0.012),
    new Vector2(radius, w / 2 - 0.012),
    new Vector2(radius - 0.012, w / 2),
    new Vector2(rin, w / 2),
    new Vector2(rin, -w / 2),
  ];
  b.add('wood', new LatheGeometry(prof, 20), {
    color: '#655441',
    m: trs(0, 0, 0, 0, 0, Math.PI / 2),
    ao: 0,
    dirt: 0.35,
    vary: 0,
    noise: 0.08,
    shade: (p, _n, c) => {
      if (Math.hypot(p.y, p.z) > radius - 0.018) c.set('#32302d');
    },
  });
  // spokes
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const dir = v3(0, Math.cos(a), Math.sin(a));
    rod(b, 'wood', dir.clone().multiplyScalar(0.09), dir.clone().multiplyScalar(rin + 0.02), 0.024, 0.019, 4, { color: '#6a5845', ao: 0, dirt: 0, vary: 0.08 }, true);
  }
  // hub (nave) with an iron band
  const hub = [
    new Vector2(0.001, -0.17), new Vector2(0.06, -0.17), new Vector2(0.085, -0.1), new Vector2(0.1, -0.02),
    new Vector2(0.1, 0.02), new Vector2(0.085, 0.1), new Vector2(0.06, 0.17), new Vector2(0.001, 0.17),
  ];
  b.add('wood', new LatheGeometry(hub, 8), {
    color: '#5d4c3a',
    m: trs(0, 0, 0, 0, 0, Math.PI / 2),
    ao: 0,
    dirt: 0,
    shade: (p, _n, c) => {
      if (Math.abs(p.x) > 0.15) c.set('#34312d');
    },
  });
}

// -------------------------------------------------------------------------------------------
// Horse
// -------------------------------------------------------------------------------------------

const COAT = '#5a3f2e';
const POINTS = '#2a221c';
const LEATHER = '#2f2620';
const POINTS_C = new Color(POINTS);

/** Ellipsoid whose long axis runs a→c, with radii rx (side) and rz. */
function ellipsoid(b: PartBuilder, a: Vector3, c: Vector3, rx: number, rz: number, o: Opts, ws = 10, hs = 7): void {
  const d = new Vector3().subVectors(c, a);
  const len = d.length();
  d.normalize();
  const side = Math.abs(d.x) > 0.9 ? v3(0, 1, 0) : v3(1, 0, 0);
  const z = new Vector3().crossVectors(side, d).normalize();
  const x = new Vector3().crossVectors(d, z);
  const m = new Matrix4().makeBasis(x, d, z).multiply(new Matrix4().makeScale(rx, len / 2, rz));
  m.setPosition(new Vector3().addVectors(a, c).multiplyScalar(0.5));
  b.add('hide', new SphereGeometry(1, ws, hs), { ...o, m });
}

function buildHorse(b: PartBuilder, Z: number, lod: 0 | 1): void {
  const coat: Opts = {
    color: COAT,
    vary: 0,
    noise: 0.05,
    ao: 0.2,
    dirt: 0.25,
    shade: (p, n, c) => {
      // dark lower legs (bay points), slightly lighter belly/muzzle
      if (p.y < 0.62) c.lerp(POINTS_C, Math.min(1, (0.62 - p.y) / 0.2));
      if (n.y < -0.6 && p.y > 0.8) c.multiplyScalar(1.12);
    },
  };
  const P = (x: number, y: number, z: number) => v3(x, y, z + Z);
  if (lod === 1) {
    ellipsoid(b, P(0, 1.22, -0.95), P(0, 1.22, 0.95), 0.33, 0.38, coat, 7, 5);
    ellipsoid(b, P(0, 1.3, 0.7), P(0, 1.95, 1.35), 0.15, 0.2, coat, 6, 4);
    ellipsoid(b, P(0, 1.95, 1.3), P(0, 1.45, 1.62), 0.1, 0.12, coat, 5, 4);
    for (const [x, z] of [[-0.17, 0.55], [0.17, 0.55], [-0.18, -0.6], [0.18, -0.6]]) {
      rod(b, 'hide', P(x, 0, z + 0.02), P(x, 1.0, z), 0.06, 0.09, 4, coat, true);
    }
    return;
  }
  // body masses: barrel, hindquarters, chest/shoulders
  ellipsoid(b, P(0, 1.2, -0.78), P(0, 1.2, 0.78), 0.34, 0.37, coat, 12, 9);
  ellipsoid(b, P(0, 1.28, -0.98), P(0, 1.3, -0.12), 0.35, 0.39, coat, 10, 8);
  ellipsoid(b, P(0, 1.18, 0.15), P(0, 1.3, 0.92), 0.32, 0.4, coat, 10, 8);
  // neck (deep, arched) and head
  ellipsoid(b, P(0, 1.32, 0.62), P(0, 1.98, 1.3), 0.15, 0.25, coat, 10, 7);
  ellipsoid(b, P(0, 2.0, 1.22), P(0, 1.5, 1.64), 0.11, 0.13, coat, 9, 7);
  ellipsoid(b, P(0, 1.92, 1.2), P(0, 1.78, 1.38), 0.12, 0.13, coat, 7, 5); // jowl
  // ears
  for (const s of [-1, 1]) rod(b, 'hide', P(s * 0.06, 2.03, 1.2), P(s * 0.08, 2.17, 1.17), 0.03, 0.006, 4, { ...coat, color: '#4a3426' });
  // mane and forelock (dark)
  ellipsoid(b, P(0, 1.62, 0.6), P(0, 2.08, 1.18), 0.05, 0.06, { ...coat, color: POINTS, jitter: 0.012, jitterFreq: 8 }, 6, 6);
  // tail
  rod(b, 'hide', P(0, 1.6, -1.1), P(0, 1.2, -1.22), 0.06, 0.07, 6, { ...coat, color: POINTS });
  rod(b, 'hide', P(0, 1.2, -1.22), P(0, 0.62, -1.2), 0.07, 0.035, 6, { ...coat, color: POINTS, jitter: 0.01, jitterFreq: 6 });
  // legs: [x, z, front?]
  const legs: [number, number, boolean, number][] = [
    [-0.17, 0.62, true, 1], [0.17, 0.62, true, -1], [-0.18, -0.68, false, -1], [0.18, -0.68, false, 1],
  ];
  for (const [x, z, front, ph] of legs) {
    const pivotY = front ? 1.1 : 1.18;
    const o: Opts = { ...coat, swing: [ph, pivotY, z + Z] };
    if (front) {
      rod(b, 'hide', P(x, 1.12, z - 0.02), P(x * 1.05, 0.56, z + 0.02), 0.1, 0.06, 7, o);
      rod(b, 'hide', P(x * 1.05, 0.56, z + 0.02), P(x * 1.05, 0.16, z + 0.03), 0.055, 0.048, 6, o);
    } else {
      rod(b, 'hide', P(x, 1.15, z + 0.12), P(x * 1.05, 0.62, z - 0.12), 0.12, 0.065, 7, o);
      rod(b, 'hide', P(x * 1.05, 0.62, z - 0.12), P(x * 1.05, 0.16, z - 0.02), 0.055, 0.048, 6, o);
    }
    const fz = front ? z + 0.03 : z - 0.02;
    // feathered pastern + hoof
    rod(b, 'hide', P(x * 1.05, 0.17, fz), P(x * 1.05, 0.05, fz + 0.02), 0.05, 0.075, 7, { ...o, color: '#3a312a' });
    rod(b, 'hide', P(x * 1.05, 0.05, fz + 0.02), P(x * 1.05, 0.0, fz + 0.025), 0.07, 0.075, 7, { ...o, color: '#26211d' });
  }
  // --- harness: collar with hames, cart saddle, belly band, breeching, traces, bridle, reins
  const leather: Opts = { color: LEATHER, vary: 0, noise: 0.05, ao: 0, dirt: 0 };
  const collar = new TorusGeometry(0.25, 0.07, 6, 14);
  b.add('hide', collar, { ...leather, color: '#3a2c22', m: trs(0, 1.55 + 0.02, Z + 0.86, -0.75, 0, 0, 0.82, 1.15, 1) });
  b.add('hide', new TorusGeometry(0.28, 0.03, 4, 12, Math.PI * 1.15), { ...leather, color: '#6e5a45', m: trs(0, 1.5, Z + 0.84, -0.75, 0, Math.PI * 0.92, 0.88, 1.18, 1) });
  // saddle pad
  box(b, 'hide', 0.5, 0.08, 0.32, trs(0, 1.58, Z + 0.15, 0, 0, 0), leather);
  b.add('hide', new TorusGeometry(1, 0.025, 4, 18), { ...leather, m: trs(0, 1.2, Z + 0.15, 0, 0, 0, 0.36, 0.4, 1) });
  // breeching around the hindquarters
  b.add('hide', new TorusGeometry(1, 0.03, 4, 16, Math.PI), { ...leather, m: trs(0, 1.12, Z - 0.42, Math.PI / 2, 0, Math.PI, 0.37, 0.62, 1) });
  // traces: collar → shaft tugs
  for (const s of [-1, 1]) {
    rod(b, 'hide', P(s * 0.3, 1.32, 0.85), P(s * 0.4, 1.16, 0.15), 0.018, 0.018, 4, leather);
    rod(b, 'hide', P(s * 0.4, 1.16, 0.15), P(s * 0.4, 1.06, -0.6), 0.016, 0.016, 4, leather);
  }
  // bridle: noseband + cheek straps
  b.add('hide', new TorusGeometry(1, 0.018, 4, 12), { ...leather, m: trs(0, 1.62, Z + 1.52, 0.88, 0, 0, 0.115, 0.135, 1) });
  for (const s of [-1, 1]) rod(b, 'hide', P(s * 0.1, 1.98, 1.2), P(s * 0.1, 1.6, 1.52), 0.012, 0.012, 3, leather);
}

function buildReins(b: PartBuilder, hands: Vector3): void {
  const bit = v3(0, 1.55, WAGON.horseZ + 1.55);
  for (const s of [-1, 1]) {
    const a = bit.clone().add(v3(s * 0.09, 0, 0));
    const mid = v3(s * 0.22, 1.5, WAGON.horseZ - 0.2);
    const h = hands.clone().add(v3(s * 0.15, 0, 0));
    rod(b, 'hide', a, mid, 0.008, 0.008, 3, { color: LEATHER, ao: 0, dirt: 0 });
    rod(b, 'hide', mid, h, 0.008, 0.008, 3, { color: LEATHER, ao: 0, dirt: 0 });
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

let cached: WagonModel | null = null;

/** LOD0 wagon rig, built once and shared. */
export function wagonModel(): WagonModel {
  if (cached) return cached;
  const body = new PartBuilder({ seed: 3, ao: 0.25, aoHeight: 1.2 });
  buildBody(body);
  // reins are attached to the body so they stay still relative to the driver
  buildReins(body, v3(0, 1.0 + 0.37 + 1.07 - 0.78 + 0.0, 1.35 + 0.42));
  const wf = new PartBuilder({ seed: 4 });
  buildWheel(wf, WAGON.frontWheelRadius, 10, 0);
  const wr = new PartBuilder({ seed: 5 });
  buildWheel(wr, WAGON.rearWheelRadius, 12, 0);
  const horse = new PartBuilder({ seed: 6, ao: 0.15 });
  buildHorse(horse, WAGON.horseZ, 0);
  const driver = new PartBuilder({ seed: 7, ao: 0.1, dirt: 0.1 });
  addHuman(driver, trs(0, WAGON.bedTopY + 0.4, 1.33), HUMAN_STYLES[0], 'sit');
  cached = {
    body: body.build(),
    wheelFront: wf.build(),
    wheelRear: wr.build(),
    horse: horse.build(),
    driver: driver.build(),
    wheels: WAGON.wheels,
  };
  return cached;
}

let lod1: ModelPart[] | null = null;

/** Far-zoom rig: one merged static mesh per material (~400 triangles). */
export function wagonLod1(): ModelPart[] {
  if (lod1) return lod1;
  const b = new PartBuilder({ seed: 8, ao: 0.2 });
  const top = WAGON.bedTopY;
  box(b, 'wood', 1.4, 0.12, 3.3, trs(0, top - 0.06, 0), wood('#6e5a44'));
  for (const s of [-1, 1]) {
    box(b, 'wood', 0.05, 0.36, 3.3, trs(s * 0.72, top + 0.18, 0), wood('#6e5a44'));
    rod(b, 'wood', v3(s * 0.5, 0.52, 1.1), v3(s * 0.42, 1.16, WAGON.horseZ + 0.8), 0.045, 0.04, 3, wood(), true);
  }
  for (const z of [-1.64, 1.64]) box(b, 'wood', 1.4, 0.26, 0.05, trs(0, top + 0.13, z), wood('#6e5a44'));
  for (const w of WAGON.wheels) {
    buildWheel(b, w.radius, 0, 1, new Matrix4().makeTranslation(w.position.x, w.position.y, w.position.z));
  }
  buildHorse(b, WAGON.horseZ, 1);
  // driver as two blobs
  const d: Opts = { color: HUMAN_STYLES[0].tunic, ao: 0, dirt: 0 };
  b.add('cloth', new CylinderGeometry(0.15, 0.2, 0.62, 6), { ...d, m: trs(0, top + 0.72, 1.33) });
  b.add('cloth', new SphereGeometry(0.12, 6, 4), { ...d, color: HUMAN_STYLES[0].hood, m: trs(0, top + 1.18, 1.34) });
  b.add('cloth', new CylinderGeometry(0.07, 0.07, 0.5, 4, 1, true), { ...d, m: trs(0, top + 0.42, 1.6, Math.PI / 2, 0, 0, 2.2, 1, 1) });
  lod1 = b.build();
  return lod1;
}

// -------------------------------------------------------------------------------------------
// Horse walk: CPU-baked poses and a vertex-shader patch
// -------------------------------------------------------------------------------------------

/** Swing amplitude in radians at full stride. */
export const HORSE_STRIDE = 0.32;

/**
 * Horse geometry with the legs baked at walk phase `phase` (radians). Use 0 and π for a
 * two-pose flip-book, or several phases for more frames.
 */
export function horsePoseParts(phase: number, amp = HORSE_STRIDE): ModelPart[] {
  return wagonModel().horse.map((p) => {
    const g = p.geometry.clone();
    const pos = g.getAttribute('position') as BufferAttribute;
    const nor = g.getAttribute('normal') as BufferAttribute;
    const sw = g.getAttribute('swing') as BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const sy = sw.getY(i);
      if (sy <= 0) continue;
      const a = Math.sin(phase) * sw.getX(i) * amp;
      const c = Math.cos(a), s = Math.sin(a);
      const dy = pos.getY(i) - sy, dz = pos.getZ(i) - sw.getZ(i);
      pos.setY(i, sy + dy * c - dz * s);
      pos.setZ(i, sw.getZ(i) + dy * s + dz * c);
      const ny = nor.getY(i), nz = nor.getZ(i);
      nor.setY(i, ny * c - nz * s);
      nor.setZ(i, ny * s + nz * c);
    }
    return { geometry: g, material: p.material };
  });
}

export interface HorseWalkMaterial {
  material: MeshStandardMaterial;
  /** Advance `uniforms.uWalkTime.value` (seconds) each frame. */
  uniforms: { uWalkTime: { value: number }; uWalkAmp: { value: number }; uWalkFreq: { value: number } };
}

/**
 * Clone of the hide material that swings the legs in the vertex shader. Per-instance phase is
 * derived from the instance position, so a herd of instanced horses does not march in step.
 * With `perInstanceAmp`, the shader also reads a float `instanceWalk` InstancedBufferAttribute
 * (0 = standing, 1 = walking) that the renderer must provide.
 */
export function createHorseWalkMaterial(perInstanceAmp = false): HorseWalkMaterial {
  const material = modelMaterial('hide').clone();
  const uniforms = { uWalkTime: { value: 0 }, uWalkAmp: { value: HORSE_STRIDE }, uWalkFreq: { value: 1.25 } };
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec3 swing;
${perInstanceAmp ? 'attribute float instanceWalk;' : ''}
uniform float uWalkTime;
uniform float uWalkAmp;
uniform float uWalkFreq;
float walkAngle() {
  if (swing.y <= 0.0) return 0.0;
  float ph = uWalkTime * 6.2831853 * uWalkFreq;
#ifdef USE_INSTANCING
  ph += instanceMatrix[3].x * 0.71 + instanceMatrix[3].z * 0.53;
#endif
  float amp = uWalkAmp${perInstanceAmp ? ' * instanceWalk' : ''};
  return sin(ph) * swing.x * amp;
}
vec2 walkRot(vec2 d, float a) { float c = cos(a), s = sin(a); return vec2(d.x * c - d.y * s, d.x * s + d.y * c); }`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
float wA = walkAngle();
objectNormal.yz = walkRot(objectNormal.yz, wA);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
if (swing.y > 0.0) transformed.yz = swing.yz + walkRot(transformed.yz - swing.yz, wA);`,
      );
  };
  material.customProgramCacheKey = () => `horse-walk-${perInstanceAmp ? 1 : 0}`;
  return { material, uniforms };
}
