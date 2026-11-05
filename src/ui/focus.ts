// Where to put the subject of an open sheet (D-43): the part of the map the sheet, the tool rail and the
// waybill leave visible. Pure geometry on screen rects (CSS px), so the side a sheet docks on — bottom,
// left, right, mirrored in RTL (D-37) or swapped for the left hand — is simply measured, never assumed.

export interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}

/**
 * Largest rect left of `scene` after cutting each obstacle away in turn (most important first): of the four
 * ways to cut an overlapping obstacle off (keep what lies above, below, left or right of it), the one
 * keeping the most area wins. Obstacles outside the current free rect are ignored.
 * With `fit` (the screen size of something to frame, D-144) the cut that shows that box largest wins instead:
 * a long, flat road stretch goes under a short side sheet rather than into the tall column beside it.
 */
export function freeRect(scene: Rect, obstacles: readonly Rect[], fit?: { w: number; h: number }): Rect {
  let f = { ...scene };
  for (const o of obstacles) {
    if (o.r <= f.l || o.l >= f.r || o.b <= f.t || o.t >= f.b) continue;
    const cuts: Rect[] = [
      { ...f, b: Math.min(f.b, o.t) },
      { ...f, t: Math.max(f.t, o.b) },
      { ...f, r: Math.min(f.r, o.l) },
      { ...f, l: Math.max(f.l, o.r) },
    ];
    let best = f, area = -1;
    for (const c of cuts) {
      const cw = Math.max(0, c.r - c.l), ch = Math.max(0, c.b - c.t);
      const a = fit ? Math.min(cw / Math.max(1, fit.w), ch / Math.max(1, fit.h)) : cw * ch;
      if (a > area) { area = a; best = c; }
    }
    f = best;
  }
  return f;
}

/** Point well inside the rect: at least `frac` of its size (and 24 px) away from every edge. */
export function wellInside(x: number, y: number, r: Rect, frac = 0.15): boolean {
  const mx = Math.max(24, (r.r - r.l) * frac), my = Math.max(24, (r.b - r.t) * frac);
  return x >= r.l + mx && x <= r.r - mx && y >= r.t + my && y <= r.b - my;
}

/** Layout rect of an element in viewport CSS px, ignoring transforms (a sheet still sliding in). */
export function layoutRect(el: HTMLElement): Rect {
  let l = 0, t = 0;
  for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) {
    l += e.offsetLeft - (e === el ? 0 : e.scrollLeft) + (e === el ? 0 : e.clientLeft);
    t += e.offsetTop - (e === el ? 0 : e.scrollTop) + (e === el ? 0 : e.clientTop);
  }
  return { l, t, r: l + el.offsetWidth, b: t + el.offsetHeight };
}
