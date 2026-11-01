// Screen-space picking without scene raycasts: the ground is ray-marched against the
// Heightfield, wagons are picked by distance to their projected position (touch-friendly
// radius), buildings by their bounding box along the view ray.
import { Ray, type PerspectiveCamera, Vector3 } from 'three';
import { CELL, type Heightfield } from './heightfield';

const _dir = new Vector3();
const _p = new Vector3();
const _ray = new Ray();
const _hit = new Vector3();

export function screenRay(camera: PerspectiveCamera, x: number, y: number, w: number, h: number, out: Ray): Ray {
  const ndcX = (x / w) * 2 - 1, ndcY = -(y / h) * 2 + 1;
  _dir.set(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
  return out.set(camera.position, _dir);
}

/** First intersection of a ray with the rendered ground inside the map, or null. */
export function rayGround(hf: Heightfield, ray: Ray, out: Vector3, maxT = 3000): Vector3 | null {
  const o = ray.origin, d = ray.direction;
  let t = 0;
  let prevT = 0;
  let prevAbove = true;
  for (let i = 0; i < 2000 && t < maxT; i++) {
    _p.copy(o).addScaledVector(d, t);
    const inside = hf.inside(_p.x, _p.z);
    const gh = inside ? hf.height(_p.x, _p.z) : -1e9;
    const above = _p.y - gh;
    if (inside && above <= 0) {
      if (!prevAbove) return null;
      // bisection between prevT and t
      let a = prevT, b = t;
      for (let k = 0; k < 18; k++) {
        const m = (a + b) * 0.5;
        _p.copy(o).addScaledVector(d, m);
        if (_p.y - hf.height(_p.x, _p.z) > 0) a = m; else b = m;
      }
      return out.copy(o).addScaledVector(d, b);
    }
    prevAbove = true;
    prevT = t;
    // adaptive step: big when far above the ground
    const h = inside ? above : Math.max(1, _p.y - hf.waterLevel);
    t += Math.max(0.35, Math.min(20, h * 0.5));
    // left the map going away and below the lowest ground: stop
    if (!inside && _p.y < hf.waterLevel - 5) return null;
  }
  return null;
}

export function cellAtPoint(hf: Heightfield, p: Vector3): number {
  const x = Math.floor(p.x / CELL), z = Math.floor(p.z / CELL);
  if (x < 0 || z < 0 || x >= hf.w || z >= hf.h) return -1;
  return z * hf.w + x;
}

export { _ray as pickRay, _hit as pickHit };
