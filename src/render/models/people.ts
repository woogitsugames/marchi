/**
 * Simple but properly proportioned medieval peasant figures (≈1.70 m): woollen tunic belted at
 * the waist, hose, turnshoes, a hood with shoulder cape (or a felt cap). Built from smooth
 * lathe/cylinder pieces, ~300–400 triangles.
 */
import { CylinderGeometry, Matrix4, SphereGeometry, Vector3 } from 'three';
import { type ModelPart, PartBuilder, trs, v3 } from './kit';
import { lathe, rod, type Opts } from './shapes';

export interface HumanStyle {
  tunic: string;
  hose: string;
  hood: string;
  skin: string;
  hair: string;
  /** Wear a hood with shoulder cape (true) or a felt cap. */
  hooded: boolean;
}

export const HUMAN_STYLES: HumanStyle[] = [
  { tunic: '#6b5f4c', hose: '#4a4136', hood: '#7a6f5a', skin: '#a98a74', hair: '#3b2f25', hooded: true },
  { tunic: '#525640', hose: '#3f3a31', hood: '#5f5446', skin: '#9e7d66', hair: '#4a3a2a', hooded: false },
  { tunic: '#5e4a3c', hose: '#4c463c', hood: '#6c6352', skin: '#a8846c', hair: '#2f2620', hooded: true },
  { tunic: '#7a705e', hose: '#4f4436', hood: '#4f4a3e', skin: '#a3826b', hair: '#5a4632', hooded: false },
];

export type HumanPose = 'stand' | 'sit' | 'work';

const cloth = (color: string): Opts => ({ color, vary: 0.04, noise: 0.08, ao: 0.25, dirt: 0.25 });

/**
 * Add a human to a builder. `m` places the figure: origin between the feet (stand/work) or at
 * the seat surface under the pelvis (sit); facing +Z.
 */
export function addHuman(b: PartBuilder, m: Matrix4, style: HumanStyle, pose: HumanPose = 'stand', seg = 7): void {
  const P = (x: number, y: number, z: number) => v3(x, y, z).applyMatrix4(m);
  const sit = pose === 'sit';
  // key heights (standing): hip 0.9, waist 1.04, shoulder 1.40, chin 1.50, head centre 1.60
  const hipY = sit ? 0.12 : 0.9;
  const dy = hipY - 0.9;
  const T = (x: number, y: number, z: number) => P(x, y + dy, z);

  // --- torso: lathe tunic (hem flares over the thighs when standing)
  const prof: [number, number][] = sit
    ? [
        [0.001, 0.86], [0.17, 0.86], [0.19, 0.95], [0.165, 1.05], [0.185, 1.22], [0.19, 1.33], [0.15, 1.41], [0.07, 1.47], [0.001, 1.47],
      ]
    : [
        [0.001, 0.5], [0.23, 0.5], [0.21, 0.66], [0.19, 0.86], [0.165, 1.04], [0.185, 1.22], [0.19, 1.33], [0.15, 1.41], [0.07, 1.47], [0.001, 1.47],
      ];
  const torsoM = m.clone().multiply(trs(0, dy, 0, 0, 0, 0, 1, 1, 0.72));
  lathe(b, 'cloth', prof, seg + 2, torsoM, cloth(style.tunic));
  // belt
  b.add('hide', new CylinderGeometry(0.17, 0.17, 0.05, seg + 2, 1, true), { color: '#3a2e24', m: m.clone().multiply(trs(0, 1.04 + dy, 0, 0, 0, 0, 1, 1, 0.74)) });

  // --- legs
  for (const s of [-1, 1]) {
    const hx = 0.09 * s;
    if (sit) {
      const knee = T(hx * 1.15, 0.95, 0.44);
      rod(b, 'cloth', T(hx, 0.92, 0.02), knee, 0.085, 0.065, seg, cloth(style.tunic));
      const ankle = P(hx * 1.2, -0.38, 0.52);
      rod(b, 'cloth', knee, ankle, 0.06, 0.045, seg, cloth(style.hose));
      shoe(b, ankle, m, style);
    } else {
      const work = pose === 'work';
      const fz = work ? (s > 0 ? 0.18 : -0.12) : 0;
      const knee = P(hx * 1.05, 0.5, fz * 0.55 + 0.02);
      rod(b, 'cloth', P(hx, 0.88, 0), knee, 0.08, 0.06, seg, cloth(style.hose));
      const ankle = P(hx * 1.1, 0.08, fz);
      rod(b, 'cloth', knee, ankle, 0.058, 0.043, seg, cloth(style.hose));
      shoe(b, ankle, m, style);
    }
  }

  // --- arms
  for (const s of [-1, 1]) {
    const sh = T(0.2 * s, 1.37, 0);
    let elbow: Vector3, wrist: Vector3;
    if (sit) {
      elbow = T(0.23 * s, 1.12, 0.12);
      wrist = T(0.15 * s, 1.07, 0.38);
    } else if (pose === 'work') {
      elbow = T(0.24 * s, 1.15, 0.14);
      wrist = T(0.08 * s, 1.18, 0.38);
    } else {
      elbow = T(0.235 * s, 1.1, -0.02);
      wrist = T(0.23 * s, 0.84, 0.04);
    }
    rod(b, 'cloth', sh, elbow, 0.06, 0.05, seg - 1, cloth(style.tunic));
    rod(b, 'cloth', elbow, wrist, 0.05, 0.042, seg - 1, cloth(style.tunic));
    const hand = wrist.clone().add(new Vector3().subVectors(wrist, elbow).normalize().multiplyScalar(0.06));
    b.add('skin', new SphereGeometry(0.045, 6, 5), { color: style.skin, m: new Matrix4().makeTranslation(hand.x, hand.y, hand.z).multiply(new Matrix4().makeScale(0.8, 1.15, 1)), ao: 0, dirt: 0 });
  }

  // --- neck + head
  rod(b, 'skin', T(0, 1.44, 0), T(0, 1.53, 0.01), 0.05, 0.048, 6, { color: style.skin, ao: 0, dirt: 0 });
  const head = m.clone().multiply(trs(0, 1.61 + dy, 0.015, 0, 0, 0, 0.088, 0.112, 0.1));
  b.add('skin', new SphereGeometry(1, 10, 8), { color: style.skin, m: head, ao: 0, dirt: 0 });
  // nose hint
  b.add('skin', new SphereGeometry(1, 5, 4), { color: style.skin, m: m.clone().multiply(trs(0, 1.6 + dy, 0.105, 0, 0, 0, 0.018, 0.03, 0.03)), ao: 0, dirt: 0 });
  if (style.hooded) {
    // hood: sphere shell slightly larger, open at the face, + shoulder cape
    b.add('cloth', new SphereGeometry(1, 10, 7, Math.PI * 0.62, Math.PI * 1.76, 0, Math.PI * 0.62), {
      ...cloth(style.hood),
      m: m.clone().multiply(trs(0, 1.625 + dy, 0.0, 0, 0, 0, 0.113, 0.135, 0.125)),
    });
    lathe(b, 'cloth', [[0.001, 1.32], [0.25, 1.3], [0.23, 1.38], [0.16, 1.45], [0.1, 1.52], [0.001, 1.53]], seg + 3, m.clone().multiply(trs(0, dy, -0.01, 0, 0, 0, 1, 1, 0.8)), cloth(style.hood));
  } else {
    // hair cap + felt cap
    b.add('cloth', new SphereGeometry(1, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), {
      color: style.hood,
      m: m.clone().multiply(trs(0, 1.65 + dy, 0.0, -0.1, 0, 0, 0.1, 0.085, 0.11)),
      ao: 0,
      dirt: 0,
    });
    b.add('cloth', new CylinderGeometry(0.12, 0.125, 0.02, 10), { color: style.hood, m: m.clone().multiply(trs(0, 1.655 + dy, 0.0, -0.1)), ao: 0, dirt: 0 });
    b.add('cloth', new SphereGeometry(1, 8, 5, Math.PI * 0.75, Math.PI * 1.5, Math.PI * 0.35, Math.PI * 0.3), {
      color: style.hair,
      m: head.clone().multiply(new Matrix4().makeScale(1.04, 1.04, 1.04)),
      ao: 0,
      dirt: 0,
    });
  }
}

function shoe(b: PartBuilder, ankle: Vector3, m: Matrix4, style: HumanStyle): void {
  const fwd = new Vector3(0, 0, 1).transformDirection(m);
  const c = ankle.clone().addScaledVector(fwd, 0.06).add(new Vector3(0, -0.035, 0));
  const ry = Math.atan2(fwd.x, fwd.z);
  b.add('hide', new SphereGeometry(1, 7, 5), { color: '#3b3027', m: trs(c.x, c.y, c.z, 0, ry, 0, 0.055, 0.045, 0.13), dirt: 0.5 });
  void style;
}

/** Standalone standing worker for building yards. Origin between the feet, facing +Z. */
export function workerParts(variant = 0, pose: HumanPose = 'stand'): ModelPart[] {
  const b = new PartBuilder({ seed: 40 + variant, ao: 0.2 });
  addHuman(b, new Matrix4(), HUMAN_STYLES[variant % HUMAN_STYLES.length], pose);
  return b.build();
}
