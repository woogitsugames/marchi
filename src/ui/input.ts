// Pointer input on the scene canvas: tap, one-finger pan or road draft, pinch zoom,
// two-finger twist rotate, three-finger tap (clear screen), mouse wheel / right-drag.
import type { CameraControl } from '../render/api';

export interface InputHandlers {
  tap(x: number, y: number): void;
  /** True when a drag should draft a road instead of panning. */
  draftMode(): boolean;
  draftStart(x: number, y: number): void;
  draftMove(x: number, y: number): void;
  draftEnd(x: number, y: number): void;
  draftCancel(): void;
  twoFingerTap(): void;
  /** Any camera gesture by the player (stops follow etc.). */
  cameraTouched?(): void;
}

interface Ptr { id: number; x: number; y: number; sx: number; sy: number; t0: number; button: number; type: string }

const TAP_SLOP = 9;
const TAP_MS = 350;

export interface InputHandle {
  /** Drop every in-flight gesture (fold/unfold, rotation): a road draft is cancelled, a pinch or
   *  pan just stops. Fingers still down are ignored until they lift. */
  cancel(): void;
  detach(): void;
}

export function attachInput(canvas: HTMLCanvasElement, camera: () => CameraControl, hd: InputHandlers): InputHandle {
  const ptrs = new Map<number, Ptr>();
  let mode: 'idle' | 'pending' | 'pan' | 'draft' | 'multi' | 'rotate' | 'drain' = 'idle';
  let multi = { dist: 0, ang: 0, cx: 0, cy: 0, t0: 0, moved: false, maxPtrs: 2 };

  const local = (e: PointerEvent | WheelEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const two = (): [Ptr, Ptr] => {
    const it = ptrs.values();
    return [it.next().value as Ptr, it.next().value as Ptr];
  };

  const startMulti = (): void => {
    const [a, b] = two();
    multi = {
      dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
      ang: Math.atan2(b.y - a.y, b.x - a.x),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      t0: Math.min(a.t0, b.t0),
      moved: Math.hypot(a.x - a.sx, a.y - a.sy) > TAP_SLOP,
      maxPtrs: ptrs.size,
    };
  };

  const down = (e: PointerEvent): void => {
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    const [x, y] = local(e);
    ptrs.set(e.pointerId, { id: e.pointerId, x, y, sx: x, sy: y, t0: performance.now(), button: e.button, type: e.pointerType });
    if (ptrs.size === 1) {
      mode = e.pointerType === 'mouse' && (e.button === 2 || e.button === 1) ? (e.button === 2 ? 'rotate' : 'pan') : 'pending';
    } else if (ptrs.size === 2) {
      if (mode === 'draft') hd.draftCancel();
      mode = 'multi';
      startMulti();
    } else if (mode === 'multi') {
      multi.maxPtrs = Math.max(multi.maxPtrs, ptrs.size);
    }
  };

  const move = (e: PointerEvent): void => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const [x, y] = local(e);
    const dx = x - p.x, dy = y - p.y;
    p.x = x;
    p.y = y;
    const cam = camera();
    switch (mode) {
      case 'pending':
        if (Math.hypot(x - p.sx, y - p.sy) > TAP_SLOP) {
          if (hd.draftMode()) {
            mode = 'draft';
            hd.draftStart(p.sx, p.sy);
            hd.draftMove(x, y);
          } else {
            mode = 'pan';
            hd.cameraTouched?.();
            cam.pan(x - p.sx, y - p.sy);
          }
        }
        break;
      case 'pan':
        cam.pan(dx, dy);
        break;
      case 'rotate':
        cam.rotate(dx * 0.008);
        break;
      case 'draft':
        hd.draftMove(x, y);
        break;
      case 'multi': {
        if (ptrs.size < 2) break;
        const [a, b] = two();
        const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        if (Math.hypot(a.x - a.sx, a.y - a.sy) > TAP_SLOP || Math.hypot(b.x - b.sx, b.y - b.sy) > TAP_SLOP) {
          if (!multi.moved) hd.cameraTouched?.();
          multi.moved = true;
        }
        if (multi.moved) {
          cam.pan(cx - multi.cx, cy - multi.cy);
          cam.zoom(multi.dist / dist, cx, cy);
          let da = ang - multi.ang;
          if (da > Math.PI) da -= 2 * Math.PI;
          if (da < -Math.PI) da += 2 * Math.PI;
          cam.rotate(da, cx, cy);
        }
        multi.dist = dist;
        multi.ang = ang;
        multi.cx = cx;
        multi.cy = cy;
        break;
      }
      default:
        break;
    }
  };

  const up = (e: PointerEvent): void => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const [x, y] = local(e);
    ptrs.delete(e.pointerId);
    const cancelled = e.type === 'pointercancel';
    if (mode === 'pending' && !cancelled && ptrs.size === 0) {
      if (performance.now() - p.t0 < TAP_MS * 2 && p.button === 0) hd.tap(x, y);
      mode = 'idle';
    } else if (mode === 'draft') {
      if (cancelled) hd.draftCancel();
      else hd.draftEnd(x, y);
      mode = 'idle';
    } else if (mode === 'multi') {
      // Clear screen = deliberate THREE-finger tap. A two-finger tap fired by accident at the start of
      // pinch/rotate on big screens (owner report on a Fold), hiding the whole HUD.
      if (!multi.moved && !cancelled && multi.maxPtrs >= 3 && performance.now() - multi.t0 < TAP_MS * 1.5 && ptrs.size === 2) {
        hd.twoFingerTap();
      }
      mode = ptrs.size ? 'drain' : 'idle';
    } else if (ptrs.size === 0) {
      mode = 'idle';
    }
  };

  const wheel = (e: WheelEvent): void => {
    e.preventDefault();
    const [x, y] = local(e);
    hd.cameraTouched?.();
    if (e.ctrlKey) camera().zoom(Math.exp(e.deltaY * 0.01), x, y); // trackpad pinch
    else if (e.shiftKey) camera().rotate(e.deltaY * 0.002);
    else camera().zoom(Math.exp(e.deltaY * 0.0015), x, y);
  };

  const ctx = (e: Event): void => e.preventDefault();

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('contextmenu', ctx);
  const cancel = (): void => {
    if (mode === 'draft') hd.draftCancel();
    for (const id of ptrs.keys()) {
      try { canvas.releasePointerCapture?.(id); } catch { /* already released */ }
    }
    ptrs.clear();
    mode = 'idle';
  };
  const detach = (): void => {
    cancel();
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
    canvas.removeEventListener('wheel', wheel);
    canvas.removeEventListener('contextmenu', ctx);
  };
  return { cancel, detach };
}
