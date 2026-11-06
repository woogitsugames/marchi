// Orbit camera around a ground target: narrow-FOV 3/4 view, exponential damping (no springs,
// no overshoot), pitch rises as you zoom out (map-like overview), clamped to the valley.
import { reducedMotion } from './motion';
import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { CameraControl, ScreenOffset } from './api';
import { CELL, type Heightfield } from './heightfield';

export const MIN_DIST = 16;
export const MAX_DIST = 520;
const PITCH_NEAR = MathUtils.degToRad(27);
const PITCH_FAR = MathUtils.degToRad(52);

/** Duration of a focus glide (D-43): ease-out (decelerate), no overshoot. */
export const FOCUS_MS = 220;

const _f = new Vector3();
const _r = new Vector3();
const _g = new Vector3();
const _scratch = new PerspectiveCamera();

/** Pitch for a camera distance: rises as you zoom out (map-like overview). */
function pitchFor(dist: number): number {
  const t = Math.pow((Math.log(dist) - Math.log(MIN_DIST)) / (Math.log(MAX_DIST) - Math.log(MIN_DIST)), 0.9);
  return PITCH_NEAR + (PITCH_FAR - PITCH_NEAR) * MathUtils.clamp(t, 0, 1);
}

/** Place `c` orbiting the ground target (tx, ty, tz) at `dist` / `yaw` / `pitch` (no matrices updated). */
function orbit(c: PerspectiveCamera, tx: number, ty: number, tz: number, dist: number, yaw: number, pitch: number): void {
  const cp = Math.cos(pitch);
  c.position.set(tx + Math.sin(yaw) * cp * dist, ty + Math.sin(pitch) * dist, tz + Math.cos(yaw) * cp * dist);
}

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
  private menuT = 0;
  private menuYaw = 0;
  private hf: Heightfield | null = null;
  private cssW = 1;
  private cssH = 1;
  /** Focus glide in progress: target x/z eased from (fx, fz) to the goal over FOCUS_MS. */
  private glide: { fx: number; fz: number; t: number } | null = null;
  /** How far (m) the orbit target may leave the map: the last focusCell's screen shift (D-245), 0 before any. */
  private slack = 0;
  /** Where a followed wagon is kept on screen, relative to the canvas centre (CSS px). */
  private followOffset: ScreenOffset | null = null;

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
    this.menuT = 0;
    this.glide = null;
  }

  setGoal(x: number, z: number, dist?: number, yaw?: number): void {
    this.glide = null;
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
    this.glide = null;
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
      this.glide = null;
      const p = this.groundPoint(atX, atY, _f);
      if (p) {
        this.goal.x += (p.x - this.goal.x) * k;
        this.goal.z += (p.z - this.goal.z) * k;
      }
    }
    this.goalDist = nd;
    this.clampGoal();
  }

  /**
   * Rotate the view by `radians` around the ground point under (atX, atY) — the point between the
   * fingers stays put, like a map. Without a screen point it orbits the screen centre (target).
   */
  rotate(radians: number, atX?: number, atY?: number): void {
    if (this.menu) return;
    this.goalYaw += radians;
    this.glide = null;
    if (atX === undefined || atY === undefined || this.followId !== null) return;
    const p = this.groundPoint(atX, atY, _f);
    if (!p) return;
    // the camera offset rotates by R(r): x' = x cos r + z sin r, z' = z cos r - x sin r.
    // Keep P fixed in the camera frame: goal' = P - R(P - goal).
    const c = Math.cos(radians), s = Math.sin(radians);
    const vx = p.x - this.goal.x, vz = p.z - this.goal.z;
    this.goal.x = p.x - (vx * c + vz * s);
    this.goal.z = p.z - (vz * c - vx * s);
    this.clampGoal();
  }

  /**
   * Glide so the cell lands at the canvas centre + screenOffset (CSS px), e.g. the middle of the part
   * of the map an open sheet leaves visible (D-43). Keeps the user's zoom and rotation; FOCUS_MS ease-out.
   */
  focusCell(cell: number, screenOffset?: ScreenOffset): void {
    if (!this.hf) return;
    const w = this.hf.w;
    const x = cell % w, y = (cell - x) / w;
    const px = (x + 0.5) * CELL, pz = (y + 0.5) * CELL;
    this.followId = null;
    const d = this.screenShift(px, pz, screenOffset, this.goalDist, this.goalYaw, _g);
    this.goal.set(px - d.x, 0, pz - d.z);
    // a subject by the map edge still lands in the free part of the view (D-245: the trading post on the south edge
    // under a tall portrait sheet): the orbit target may leave the map by the shift, never further
    this.slack = Math.sqrt(d.x * d.x + d.z * d.z);
    this.clampGoal();
    // reduced motion: the view cuts to the subject instead of gliding (D-124)
    if (reducedMotion()) { this.glide = null; this.target.x = this.goal.x; this.target.z = this.goal.z; return; }
    this.glide = { fx: this.target.x, fz: this.target.z, t: 0 };
  }

  settled(): boolean {
    return !this.glide && Math.abs(this.dist - this.goalDist) <= this.goalDist * 0.01 &&
      Math.abs(this.target.x - this.goal.x) + Math.abs(this.target.z - this.goal.z) <= 0.5;
  }

  follow(wagonId: number | null, screenOffset?: ScreenOffset): void {
    this.followId = wagonId;
    this.followOffset = screenOffset ?? null;
    if (wagonId !== null) this.glide = null;
  }

  /**
   * Ground vector (x, z) from the orbit target to the ground point seen at the canvas centre + offset, for
   * a camera orbiting (px, pz) at `dist` / `yaw`. The target sits at the centre, so aiming the orbit at
   * P - shift puts P under the offset point. Zero without an offset.
   */
  private screenShift(px: number, pz: number, off: ScreenOffset | null | undefined, dist: number, yaw: number, out: Vector3): Vector3 {
    out.set(0, 0, 0);
    if (!off || (off.x === 0 && off.y === 0)) return out;
    const c = _scratch;
    c.fov = this.camera.fov;
    c.aspect = this.camera.aspect;
    c.near = this.camera.near;
    c.far = this.camera.far;
    c.updateProjectionMatrix();
    const py = this.hf ? this.hf.height(px, pz) : 0;
    orbit(c, px, py, pz, dist, yaw, pitchFor(dist));
    c.lookAt(px, py + Math.min(2, dist * 0.02), pz);
    c.updateMatrixWorld();
    const ndcX = (off.x / this.cssW) * 2, ndcY = -(off.y / this.cssH) * 2;
    _r.set(ndcX, ndcY, 0.5).unproject(c).sub(c.position).normalize();
    if (_r.y > -1e-3) return out;
    const t = (py - c.position.y) / _r.y;
    out.copy(c.position).addScaledVector(_r, t);
    out.x -= px; out.z -= pz; out.y = 0;
    return out;
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
    const m = this.slack;
    this.goal.x = MathUtils.clamp(this.goal.x, -m, this.hf.sizeX + m);
    this.goal.z = MathUtils.clamp(this.goal.z, -m, this.hf.sizeZ + m);
  }

  /** Advance damping and place the camera. followPos: current position of the followed wagon. */
  update(dt: number, followPos: Vector3 | null): void {
    if (this.menu && !reducedMotion()) {
      // slow sway around the framing yaw (not a full orbit, so the bridge stays framed); still with reduced motion
      if (this.menuT === 0) this.menuYaw = this.goalYaw;
      this.menuT += dt;
      this.goalYaw = this.menuYaw + Math.sin(this.menuT * 0.045) * 0.16;
    } else {
      this.menuT = 0;
    }
    if (followPos) {
      const d = this.screenShift(followPos.x, followPos.z, this.followOffset, this.dist, this.yaw, _g);
      this.goal.x = followPos.x - d.x;
      this.goal.z = followPos.z - d.z;
      this.clampGoal();
    }
    const k = 1 - Math.exp(-dt * 8);
    const kz = 1 - Math.exp(-dt * 7);
    if (this.glide) {
      // focus glide: fixed duration, ease-out cubic (fast start, gentle stop), never past the goal
      const g = this.glide;
      g.t = Math.min(1, g.t + (dt * 1000) / FOCUS_MS);
      const e = 1 - (1 - g.t) * (1 - g.t) * (1 - g.t);
      this.target.x = g.fx + (this.goal.x - g.fx) * e;
      this.target.z = g.fz + (this.goal.z - g.fz) * e;
      if (g.t >= 1) this.glide = null;
    } else {
      this.target.x += (this.goal.x - this.target.x) * k;
      this.target.z += (this.goal.z - this.target.z) * k;
    }
    // zoom in log space so it feels even at every distance
    this.dist = Math.exp(Math.log(this.dist) + (Math.log(this.goalDist) - Math.log(this.dist)) * kz);
    this.yaw += (this.goalYaw - this.yaw) * k;
    const ty = this.hf ? this.hf.height(this.target.x, this.target.z) : 0;
    this.target.y += (ty - this.target.y) * (1 - Math.exp(-dt * 5));
    this.pitch = pitchFor(this.dist);
    const c = this.camera;
    orbit(c, this.target.x, this.target.y, this.target.z, this.dist, this.yaw, this.pitch);
    if (this.hf) {
      const gx = MathUtils.clamp(c.position.x, -200, this.hf.sizeX + 200), gz = MathUtils.clamp(c.position.z, -200, this.hf.sizeZ + 200);
      const g = this.hf.inside(gx, gz) ? this.hf.height(gx, gz) : this.target.y;
      if (c.position.y < g + 4) c.position.y = g + 4;
    }
    c.lookAt(this.target.x, this.target.y + Math.min(2, this.dist * 0.02), this.target.z);
    // menu: shift the projection so the subject sits clear of the menu panel
    // (right of it in landscape, below it in portrait)
    if (this.menu) {
      const a = this.cssW / this.cssH;
      const sx = a > 1.2 ? 0.17 : a < 0.8 ? 0 : 0.1;
      const sy = a > 1.2 ? 0.02 : a < 0.8 ? 0.17 : 0.1;
      c.setViewOffset(this.cssW, this.cssH, -sx * this.cssW, -sy * this.cssH, this.cssW, this.cssH);
    } else if (c.view?.enabled) c.clearViewOffset();
    c.near = Math.max(0.5, this.dist * 0.04);
    c.far = 2600;
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }
}
