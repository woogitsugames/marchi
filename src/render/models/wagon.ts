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
      rod(b, 'wood', v3(s * 0.66, top - 0.18, z), v3(s * 0.8, top + 0.44, z), 0.035, 0.03, 4, wood(WOOD_DARK), true);
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
    rod(b, 'wood', a, m1, 0.045, 0.042, 5, wood('#6e5a44'), true);
    rod(b, 'wood', m1, c, 0.042, 0.035, 5, wood('#6e5a44'));
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
    b.add('wood', new CylinderGeometry(radius, radius, w, 8, 1, false), {
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
    new Vector2(radius, -w / 2),
    new Vector2(radius, w / 2),
    new Vector2(rin, w / 2),
    new Vector2(rin, -w / 2),
  ];
  b.add('wood', new LatheGeometry(prof, radius > 0.55 ? 18 : 16), {
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
    rod(b, 'wood', dir.clone().multiplyScalar(0.09), dir.clone().multiplyScalar(rin + 0.02), 0.026, 0.02, 3, { color: '#6a5845', ao: 0, dirt: 0, vary: 0.08 }, true);
  }
  // hub (nave) with an iron band
  const hub = [
    new Vector2(0.001, -0.17), new Vector2(0.06, -0.17), new Vector2(0.1, -0.05),
    new Vector2(0.1, 0.05), new Vector2(0.06, 0.17), new Vector2(0.001, 0.17),
  ];
  b.add('wood', new LatheGeometry(hub, 7), {
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

const COAT = '#4f3d30';
const POINTS = '#2a221c';
const LEATHER = '#2f2620';
const POINTS_C = new Color(POINTS);

function buildHorse(b: PartBuilder, Z: number, lod: 0 | 1): void {
  const coat: Opts = {
    color: COAT,
    vary: 0,
    noise: 0.05,
    ao: 0.2,
    dirt: 0.25,
    shade: (p, n, c) => {
      // dark lower legs (bay points), slightly lighter belly
      if (p.y < 0.62) c.lerp(POINTS_C, Math.min(1, (0.62 - p.y) / 0.2));
      if (n.y < -0.6 && p.y > 0.8) c.multiplyScalar(1.1);
    },
  };
  const hi = lod === 0;
  const S = (y: number, z: number, rx: number, ry = rx, x = 0) => sec(x, y, z + Z, rx, ry);
  // body + neck as one smooth loft along the spine (tail root → chest → poll)
  b.add('hide', loftGeometry([
    S(1.43, -1.0, 0.05), S(1.38, -0.95, 0.2, 0.24), S(1.3, -0.78, 0.31, 0.36), S(1.24, -0.5, 0.36, 0.39),
    S(1.18, -0.15, 0.37, 0.39), S(1.16, 0.2, 0.36, 0.39), S(1.2, 0.5, 0.33, 0.4), S(1.28, 0.75, 0.28, 0.37),
    S(1.45, 0.97, 0.23, 0.33), S(1.62, 1.15, 0.18, 0.27), S(1.77, 1.3, 0.14, 0.2), S(1.86, 1.4, 0.11, 0.15),
  ].filter((_, k) => hi || k % 2 === 0 || k === 11), hi ? 10 : 6), coat);
  // head: poll → muzzle
  b.add('hide', loftGeometry([
    S(1.92, 1.37, 0.05), S(1.88, 1.42, 0.12, 0.14), S(1.78, 1.52, 0.13, 0.18), S(1.66, 1.6, 0.11, 0.14),
    S(1.55, 1.69, 0.095, 0.115), S(1.47, 1.76, 0.09, 0.105), S(1.43, 1.8, 0.05, 0.06),
  ].filter((_, k) => hi || k % 2 === 0), hi ? 8 : 5), coat);
  const legs: [number, number, boolean, number][] = [
    [-0.17, 0.6, true, 1], [0.17, 0.6, true, -1], [-0.18, -0.62, false, -1], [0.18, -0.62, false, 1],
  ];
  for (const [x, z, front, ph] of legs) {
    const o: Opts = { ...coat, swing: [ph, front ? 1.1 : 1.18, z + Z] };
    const L = front
      ? [S(1.15, z - 0.02, 0.12, 0.15, x), S(0.85, z + 0.0, 0.09, 0.12, x), S(0.58, z + 0.02, 0.065, 0.07, x), S(0.42, z + 0.02, 0.05, 0.056, x),
         S(0.2, z + 0.03, 0.055, 0.06, x), S(0.13, z + 0.05, 0.068, 0.072, x), S(0.06, z + 0.07, 0.076, 0.082, x), S(0.0, z + 0.08, 0.08, 0.086, x)]
      : [S(1.2, z + 0.12, 0.14, 0.18, x), S(0.9, z - 0.03, 0.11, 0.14, x), S(0.62, z - 0.16, 0.065, 0.08, x), S(0.42, z - 0.12, 0.05, 0.056, x),
         S(0.2, z - 0.06, 0.055, 0.06, x), S(0.13, z - 0.04, 0.068, 0.072, x), S(0.06, z - 0.02, 0.076, 0.082, x), S(0.0, z - 0.01, 0.08, 0.086, x)];
    b.add('hide', loftGeometry(hi ? L : [L[0], L[2], L[4], L[7]], hi ? 5 : 3), {
      ...o,
      shade: (p, n, c) => {
        coat.shade?.(p, n, c);
        if (p.y < 0.075) c.set('#25201c'); // hoof
        else if (p.y < 0.16) c.set('#3d342c'); // feathering
      },
    });
  }
  if (!hi) return;
  // ears, mane, tail
  for (const s of [-1, 1]) rod(b, 'hide', P3(s * 0.06, 1.9, 1.38 + Z), P3(s * 0.085, 2.02, 1.33 + Z), 0.032, 0.008, 4, { ...coat, color: '#4a3426' }, true);
  b.add('hide', loftGeometry([S(1.64, 0.7, 0.02, 0.03), S(1.83, 0.95, 0.045, 0.07), S(1.93, 1.15, 0.045, 0.065), S(1.98, 1.3, 0.035, 0.05), S(1.97, 1.41, 0.02, 0.03)], 5), {
    ...coat, color: POINTS, jitter: 0.012, jitterFreq: 8,
  });
  b.add('hide', loftGeometry([S(1.45, -1.02, 0.05), S(1.3, -1.16, 0.08), S(1.0, -1.2, 0.09, 0.08), S(0.7, -1.16, 0.06), S(0.6, -1.14, 0.03)], 5), {
    ...coat, color: POINTS, jitter: 0.01, jitterFreq: 6,
  });
  // --- harness: collar with hames, cart saddle, belly band, breeching, traces, bridle
  const leather: Opts = { color: LEATHER, vary: 0, noise: 0.05, ao: 0, dirt: 0 };
  b.add('hide', new TorusGeometry(0.25, 0.07, 4, 10), { ...leather, color: '#3a2c22', m: trs(0, 1.47, Z + 0.95, -0.78, 0, 0, 0.84, 1.15, 1) });
  b.add('hide', new TorusGeometry(0.28, 0.028, 3, 6, Math.PI * 1.15), { ...leather, color: '#6e5a45', m: trs(0, 1.42, Z + 0.93, -0.78, 0, Math.PI * 0.92, 0.88, 1.18, 1) });
  box(b, 'hide', 0.52, 0.08, 0.32, trs(0, 1.58, Z + 0.15), leather);
  b.add('hide', new TorusGeometry(1, 0.025, 3, 10), { ...leather, m: trs(0, 1.18, Z + 0.15, 0, 0, 0, 0.375, 0.415, 1) });
  b.add('hide', new TorusGeometry(1, 0.03, 3, 8, Math.PI), { ...leather, m: trs(0, 1.1, Z - 0.42, Math.PI / 2, 0, Math.PI, 0.385, 0.64, 1) });
  for (const s of [-1, 1]) {
    rod(b, 'hide', P3(s * 0.3, 1.3, Z + 0.85), P3(s * 0.39, 1.14, Z + 0.15), 0.018, 0.018, 3, leather, true);
    rod(b, 'hide', P3(s * 0.39, 1.14, Z + 0.15), P3(s * 0.4, 1.04, Z - 0.6), 0.016, 0.016, 3, leather, true);
    rod(b, 'hide', P3(s * 0.11, 1.86, Z + 1.42), P3(s * 0.095, 1.55, Z + 1.68), 0.012, 0.012, 3, leather, true);
  }
  b.add('hide', new TorusGeometry(1, 0.018, 3, 6), { ...leather, m: trs(0, 1.55, Z + 1.7, 0.85, 0, 0, 0.1, 0.12, 1) });
}

const P3 = (x: number, y: number, z: number) => v3(x, y, z);

function buildReins(b: PartBuilder, hands: Vector3): void {
  const bit = v3(0, 1.5, WAGON.horseZ + 1.72);
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
  buildWheel(wf, WAGON.frontWheelRadius, 8, 0);
  const wr = new PartBuilder({ seed: 5 });
  buildWheel(wr, WAGON.rearWheelRadius, 10, 0);
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
  b.add('cloth', new SphereGeometry(0.12, 5, 3), { ...d, color: HUMAN_STYLES[0].hood, m: trs(0, top + 1.18, 1.34) });
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
