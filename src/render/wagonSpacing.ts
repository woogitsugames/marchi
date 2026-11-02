// Drawn spacing between wagons going the same way (D-35). Render-only and three.js-free so it can be
// tested headless: the sim lets several wagons share a stretch of road (positions are not changed),
// the view draws each follower at least DRAW_GAP metres behind the wagon ahead.
import { edgeLength, type Wagon, type World } from '../sim/index';

/** Drawn gap (metres along the road) between wagons going the same way. */
export const DRAW_GAP = 5;
/**
 * Furthest a wagon is drawn behind its sim position. The view can draw it back on its previous edge
 * (one road cell), so in a real jam (dozens of wagons on a few 4 m cells) the queue is shortened, not
 * stretched hundreds of metres back; beyond this, wagons may still overlap.
 */
export const MAX_DRAW_LAG = 8;

/**
 * Wanted drawn lag (metres behind the sim position) per moving wagon. On every directed edge, from
 * the front wagon back, each follower is drawn at least DRAW_GAP behind the one ahead; wagons just
 * past the next node, on the edge this one takes next, count as ahead too. Ties: the lower id leads.
 * Wagons standing at a node are not moved (the view queues them separately). Reads sim state only.
 */
export function wagonDrawLag(world: World): Map<number, number> {
  const n = world.terrain.w * world.terrain.h;
  const byEdge = new Map<number, Wagon[]>();
  for (const w of world.state.wagons) {
    if (w.next < 0) continue;
    const k = w.at * n + w.next;
    const l = byEdge.get(k);
    if (l) l.push(w); else byEdge.set(k, [w]);
  }
  const lag = new Map<number, number>();
  for (const list of byEdge.values()) {
    list.sort((a, b) => b.edgeT - a.edgeT || a.id - b.id);
    const len = edgeLength(world.terrain, list[0]!.at, list[0]!.next);
    let prevDrawn = Infinity;
    for (const w of list) {
      let cap = prevDrawn - DRAW_GAP;
      const after = w.path[0];
      if (after !== undefined) {
        const beyond = byEdge.get(w.next * n + after);
        if (beyond) for (const o of beyond) cap = Math.min(cap, len + o.edgeT - DRAW_GAP);
      }
      const drawn = Math.max(w.edgeT - MAX_DRAW_LAG, Math.min(w.edgeT, cap));
      if (w.edgeT - drawn > 0) lag.set(w.id, w.edgeT - drawn);
      prevDrawn = drawn;
    }
  }
  return lag;
}
