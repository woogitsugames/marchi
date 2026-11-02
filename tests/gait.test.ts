// Render-side horse gait (src/render/gait.ts): hooves must not slide while planted, at any
// walk/trot blend and frame step (×1/×2/×4 game speed), and wheels must roll without slipping.
import { Matrix4, Vector3 } from 'three';
import { fetlockTarget, gaitAt, gaitBlend, HORSE_LEGS, horsePose, legPoint, POSE_SIZE, strideOf } from '../src/render/gait';
import { SPEED_DIRT, SPEED_WOOD_BRIDGE } from '../src/sim/index';
import { assert, test } from './harness';

/** Hoof sole under the toe (horse space, rest pose): the point that touches the ground. */
const sole = (i: number) => ({ y: 0, z: HORSE_LEGS[i]!.fz + 0.064 });

function slipRun(blend: number, step: number): { slip: number; lift: number; stances: number } {
  const g = gaitAt(blend, { duty: 0, offset: [0, 0, 0, 0], liftF: 0, liftH: 0, flex: 0, reach: 0 });
  const stride = strideOf(g);
  const pose = new Float32Array(POSE_SIZE);
  const t = { y: 0, z: 0, hoof: 0, stance: false };
  const prev = HORSE_LEGS.map(() => ({ stance: false, z: 0 }));
  let slip = 0, lift = 0, stances = 0;
  // the rig moves forward `step` metres per frame; the phase follows the distance
  for (let d = 0; d < stride * 3; d += step) {
    const phase = d / stride;
    horsePose(phase, blend, 1, pose);
    for (let i = 0; i < 4; i++) {
      fetlockTarget(i, phase, g, t);
      const s = sole(i);
      const [y, z] = legPoint(i, 2, s.y, s.z, pose);
      const wz = d + z;
      if (t.stance) {
        lift = Math.max(lift, Math.abs(y));
        if (prev[i]!.stance) slip = Math.max(slip, Math.abs(wz - prev[i]!.z));
        else stances++;
      }
      prev[i] = { stance: t.stance, z: wz };
    }
  }
  return { slip, lift, stances };
}

test('planted hooves stay put through the stance (walk, trot, blend; x1/x2/x4 frame steps)', () => {
  for (const blend of [0, 0.5, 1]) {
    for (const step of [0.06, 0.12, 0.24]) {
      const r = slipRun(blend, step);
      assert(r.stances > 4, `blend ${blend}: no stance phases seen`);
      assert(r.slip < 1e-3, `blend ${blend} step ${step}: planted hoof slid ${r.slip.toFixed(4)} m`);
      assert(r.lift < 1e-3, `blend ${blend} step ${step}: planted hoof off the ground by ${r.lift.toFixed(4)} m`);
    }
  }
});

test('swinging hooves clear the ground and the legs reach their targets', () => {
  const pose = new Float32Array(POSE_SIZE);
  for (const blend of [0, 1]) {
    const g = gaitAt(blend);
    const t = { y: 0, z: 0, hoof: 0, stance: false };
    let maxLift = 0, maxErr = 0;
    for (let k = 0; k < 200; k++) {
      horsePose(k / 200, blend, 1, pose);
      for (let i = 0; i < 4; i++) {
        fetlockTarget(i, k / 200, g, t);
        const l = HORSE_LEGS[i]!;
        const [y, z] = legPoint(i, 2, l.fy, l.fz, pose);
        maxErr = Math.max(maxErr, Math.hypot(y - t.y, z - t.z));
        if (!t.stance) maxLift = Math.max(maxLift, y - l.fy);
      }
    }
    assert(maxErr < 1e-4, `blend ${blend}: fetlock misses its target by ${maxErr}`);
    assert(maxLift > 0.08, `blend ${blend}: hooves barely lift (${maxLift})`);
  }
});

test('gait follows the ground speed: dirt road trots, slow going walks', () => {
  assert(gaitBlend(SPEED_DIRT) === 1, 'dirt road speed should be a trot');
  assert(gaitBlend(1.6) === 0, 'slow going should be a walk');
  const b = gaitBlend(SPEED_WOOD_BRIDGE);
  assert(b > 0 && b < 1, 'a wooden bridge sits between walk and trot');
  assert(strideOf(gaitAt(1)) > strideOf(gaitAt(0)), 'trot stride is longer than the walk stride');
});

test('standing pose is the rest pose', () => {
  const pose = horsePose(0.37, 1, 0, new Float32Array(POSE_SIZE));
  for (let k = 0; k < 13; k++) assert(Math.abs(pose[k]!) < 1e-9, `pose[${k}] = ${pose[k]} while standing`);
});

test('wheels roll without slipping (rotation = distance / radius)', () => {
  // as in wagonsView: wheel matrix = translate(hub) · rotX(roll / r); the rim point at the
  // bottom must not move along the road over a small advance
  for (const r of [0.5, 0.6]) {
    for (const roll0 of [0, 1.3, 7.9]) {
      const contact = new Vector3(0, -r, 0).applyMatrix4(new Matrix4().makeRotationX(-roll0 / r)); // wheel-space point now at the bottom
      const at = (roll: number) => contact.clone().applyMatrix4(new Matrix4().makeRotationX(roll / r)).z + roll;
      const dz = at(roll0 + 0.01) - at(roll0);
      assert(Math.abs(dz) < 1e-3 * 0.01 * 10, `wheel r=${r} slips ${dz} m per cm`);
    }
  }
});
