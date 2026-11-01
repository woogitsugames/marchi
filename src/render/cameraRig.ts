// Orbit camera around a ground target: narrow-FOV 3/4 view, exponential damping (no springs,
// no overshoot), pitch rises as you zoom out (map-like overview), clamped to the valley.
import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { CameraControl } from './api';
import { CELL, type Heightfield } from './heightfield';

export const MIN_DIST = 16;
export const MAX_DIST = 520;
const PITCH_NEAR = MathUtils.degToRad(27);
const PITCH_FAR = MathUtils.degToRad(52);

const _f = new Vector3();
const _r = new Vector3();

export class CameraRig implements CameraControl {
  readonly camera: PerspectiveCamera;
  readonly target = new Vector3(160, 0, 120);
  private goal = new Vector3(160, 0, 120);
  dist = 140;
  private goalDist = 140;
  yaw = -0.35;
  private goalYaw = -0.35;
  pitch = 0.6;
  followId: number | null = null;
  menu = false;
  private hf: Heightfield | null = null;
  private cssW = 1;
  private cssH = 1;

  constructor() {
    this.camera = new PerspectiveCamera(32, 1, 1, 2600);
  }

  setHeightfield(hf: Heightfield): void {
    this.hf = hf;
  }

  resize(w: number, h: number): void {
    this.cssW = Math.max(1, w);
    this.cssH = Math.max(1, h);
    const aspect = this.cssW / this.cssH;
    this.camera.aspect = aspect;
    // keep a minimum horizontal field of view in portrait
    const minH = MathUtils.degToRad(22);
    const fovV = Math.max(MathUtils.degToRad(32), 2 * Math.atan(Math.tan(minH / 2) / aspect));
    this.camera.fov = MathUtils.radToDeg(fovV);
    this.camera.updateProjectionMatrix();
  }

  /** Jump without damping. */
  set(x: number, z: number, dist: number, yaw: number): void {
    this.goal.set(x, 0, z);
    this.target.set(x, this.hf ? this.hf.height(x, z) : 0, z);
    this.dist = this.goalDist = dist;
    this.yaw = this.goalYaw = yaw;
  }

  setGoal(x: number, z: number, dist?: number, yaw?: number): void {
    this.goal.set(x, 0, z);
    if (dist !== undefined) this.goalDist = dist;
    if (yaw !== undefined) this.goalYaw = yaw;
  }

  get goalDistance(): number {
    return this.goalDist;
  }

  private metresPerPixel(): number {
    return (2 * this.dist * Math.tan(MathUtils.degToRad(this.camera.fov) / 2)) / this.cssH;
  }

  pan(dxPx: number, dyPx: number): void {
    if (this.menu) return;
    this.followId = null;
    const mpp = this.metresPerPixel();
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    // right = (cos, 0, -sin); forward (ground) = (-sin, 0, -cos)
    const fwdK = 1 / Math.max(0.5, Math.sin(this.pitch));
    this.goal.x += -cy * dxPx * mpp + -sy * dyPx * mpp * fwdK;
    this.goal.z += sy * dxPx * mpp + -cy * dyPx * mpp * fwdK;
    this.clampGoal();
  }

  zoom(factor: number, atX: number, atY: number): void {
    if (this.menu) return;
    const nd = MathUtils.clamp(this.goalDist * factor, MIN_DIST, MAX_DIST);
    const k = 1 - nd / this.goalDist;
    if (this.followId === null) {
      const p = this.groundPoint(atX, atY, _f);
      if (p) {
        this.goal.x += (p.x - this.goal.x) * k;
        this.goal.z += (p.z - this.goal.z) * k;
      }
    }
    this.goalDist = nd;
    this.clampGoal();
  }

  rotate(radians: number): void {
    if (this.menu) return;
    this.goalYaw += radians;
  }

  focusCell(cell: number): void {
    if (!this.hf) return;
    const w = this.hf.w;
    const x = cell % w, y = (cell - x) / w;
    this.followId = null;
    this.goal.set((x + 0.5) * CELL, 0, (y + 0.5) * CELL);
    this.clampGoal();
  }

  follow(wagonId: number | null): void {
    this.followId = wagonId;
  }

  /** Point on the horizontal plane through the target under a screen point (CSS px). */
  groundPoint(x: number, y: number, out: Vector3): Vector3 | null {
    const ndcX = (x / this.cssW) * 2 - 1, ndcY = -(y / this.cssH) * 2 + 1;
    _r.set(ndcX, ndcY, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    if (_r.y > -1e-3) return null;
    const t = (this.target.y - this.camera.position.y) / _r.y;
    return out.copy(this.camera.position).addScaledVector(_r, t);
  }

  private clampGoal(): void {
    if (!this.hf) return;
    this.goal.x = MathUtils.clamp(this.goal.x, 0, this.hf.sizeX);
    this.goal.z = MathUtils.clamp(this.goal.z, 0, this.hf.sizeZ);
  }

  /** Advance damping and place the camera. followPos: current position of the followed wagon. */
  update(dt: number, followPos: Vector3 | null): void {
    if (this.menu) {
      this.goalYaw += dt * 0.025;
    }
    if (followPos) {
      this.goal.x = followPos.x;
      this.goal.z = followPos.z;
      this.clampGoal();
    }
    const k = 1 - Math.exp(-dt * 8);
    const kz = 1 - Math.exp(-dt * 7);
    this.target.x += (this.goal.x - this.target.x) * k;
    this.target.z += (this.goal.z - this.target.z) * k;
    // zoom in log space so it feels even at every distance
    this.dist = Math.exp(Math.log(this.dist) + (Math.log(this.goalDist) - Math.log(this.dist)) * kz);
    this.yaw += (this.goalYaw - this.yaw) * k;
    const ty = this.hf ? this.hf.height(this.target.x, this.target.z) : 0;
    this.target.y += (ty - this.target.y) * (1 - Math.exp(-dt * 5));
    const t = Math.pow((Math.log(this.dist) - Math.log(MIN_DIST)) / (Math.log(MAX_DIST) - Math.log(MIN_DIST)), 0.9);
    this.pitch = PITCH_NEAR + (PITCH_FAR - PITCH_NEAR) * MathUtils.clamp(t, 0, 1);
    const cp = Math.cos(this.pitch);
    const c = this.camera;
    c.position.set(
      this.target.x + Math.sin(this.yaw) * cp * this.dist,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z + Math.cos(this.yaw) * cp * this.dist,
    );
    if (this.hf) {
      const gx = MathUtils.clamp(c.position.x, -200, this.hf.sizeX + 200), gz = MathUtils.clamp(c.position.z, -200, this.hf.sizeZ + 200);
      const g = this.hf.inside(gx, gz) ? this.hf.height(gx, gz) : this.target.y;
      if (c.position.y < g + 4) c.position.y = g + 4;
    }
    c.lookAt(this.target.x, this.target.y + Math.min(2, this.dist * 0.02), this.target.z);
    c.near = Math.max(0.5, this.dist * 0.04);
    c.far = 2600;
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }
}
