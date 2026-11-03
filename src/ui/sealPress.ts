// End of a won contract (owner decision 6, 2026-11-03; D-60 remainder, D-82): the castle's wax seal is pressed
// onto the waybill before the end letter. The waybill stays lit while the map dims around it; the seal comes
// down 260 ms (ease-out, settles slightly into the wax, no spring), the squeezed wax spreads once, and the
// impression rests on the parchment until the letter at ~1.2 s. One tap or key skips it. Reduced motion: no
// cue at all — straight to the letter. UI only: it reads the waybill's place on screen, nothing from the sim.
import { h } from './dom';

/** Press (ms) and the whole cue before the letter (ms). */
export const SEAL_PRESS_MS = 260;
export const SEAL_TOTAL_MS = 1200;

interface Box { left: number; top: number; width: number; height: number }

/**
 * Seal size (px) and centre inside the target box, where a clerk would stamp it: on the goods below the
 * waybill's head (`head` px: seals and the snow pill stay readable), towards the end of the line.
 */
export function sealPlacement(r: Box, medallion: boolean, rtl: boolean, head = 0): { size: number; x: number; y: number } {
  if (medallion) return { size: Math.round(Math.max(64, Math.min(80, r.height + 8))), x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const bodyH = Math.max(0, r.height - head);
  const size = Math.round(Math.max(64, Math.min(96, bodyH + 20, r.width * 0.42)));
  const fx = rtl ? 0.36 : 0.64;
  const x = Math.min(r.left + r.width - size / 2 - 4, Math.max(r.left + size / 2 + 4, r.left + r.width * fx));
  const y = r.top + head + bodyH / 2;
  return { size, x, y };
}

/**
 * Presses the seal onto `target` (the waybill, or its folded medallion) inside `host`, then calls `done` once —
 * after SEAL_TOTAL_MS or at the first tap / key. Without a target it presses in the middle of the screen.
 * Returns a cancel function (no `done`), for leaving the game mid-cue.
 */
export function pressSeal(host: HTMLElement, done: () => void, target: HTMLElement | null = null): () => void {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    done();
    return () => undefined;
  }
  const hr = host.getBoundingClientRect();
  const tr = target?.getBoundingClientRect() ?? null;
  const rtl = document.documentElement.dir === 'rtl';
  const box: Box | null = tr && tr.width > 0 && tr.height > 0
    ? { left: tr.left - hr.left, top: tr.top - hr.top, width: tr.width, height: tr.height }
    : null;
  const medallion = !!target?.classList.contains('seal-only');
  const headEl = medallion ? null : target?.querySelector('.wb-head');
  const head = headEl && tr ? Math.max(0, headEl.getBoundingClientRect().bottom - tr.top) : 0;
  const p = box ? sealPlacement(box, medallion, rtl, head) : { size: 96, x: hr.width / 2, y: hr.height / 2 };

  const el = h('div.seal-press', { 'aria-hidden': 'true' });
  if (box) {
    el.classList.add('on-waybill');
    const pad = medallion ? 6 : 2;
    const spot = h('div.seal-press-spot', {
      style: `left:${box.left - pad}px;top:${box.top - pad}px;width:${box.width + 2 * pad}px;height:${box.height + 2 * pad}px`,
    });
    if (medallion) spot.classList.add('round');
    el.append(spot);
  }
  el.append(h('div.seal-press-at', { style: `left:${p.x - p.size / 2}px;top:${p.y - p.size / 2}px;--sz:${p.size}px` },
    h('i.seal-press-wax'), h('i.seal-press-ring')));
  host.append(el);
  let over = false;
  const finish = (call: boolean): void => {
    if (over) return;
    over = true;
    window.clearTimeout(timer);
    el.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip, true);
    el.remove();
    if (call) done();
  };
  const skip = (e: Event): void => { e.preventDefault(); e.stopPropagation(); finish(true); };
  const timer = window.setTimeout(() => finish(true), SEAL_TOTAL_MS);
  el.addEventListener('pointerdown', skip);
  window.addEventListener('keydown', skip, true);
  return () => finish(false);
}
