// Drawn spacing between wagons going the same way (D-35) and the waiting row beside a stable (D-43).
// Render-only and three.js-free so it can be tested headless: the sim lets several wagons share a
// stretch of road or a node (positions are not changed), the view draws each follower at least
// DRAW_GAP metres behind the wagon ahead and fans wagons waiting at a stable out beside it.
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

/** A drawn waiting place beside a stable (D-43): rig origin (metres) and heading (atan2(fx, fz)). */
export interface ParkSlot {
  x: number;
  z: number;
  heading: number;
}

/** Side-by-side pitch of parked wagons (m): the rig is 1.72 m track + hubs, ~2.3 m wide. */
export const PARK_PITCH = 3.2;
/** Front-to-back pitch of parked ranks (m): the rig is 7.4 m long. */
export const PARK_RANK = 8.6;
/** Slots per side of the stable in one rank, and ranks. */
const PARK_PER_SIDE = 7;
const PARK_RANKS = 3;
/** Rig extent along its heading from the origin (rear of the bed, horse's muzzle), metres. */
const RIG_REAR = -2.0;
const RIG_FRONT = 5.4;

/** Wagons that stand without work at a stable's gate (the ones the view parks). */
export function isParked(w: Wagon, stableGates: ReadonlySet<number>): boolean {
  return w.next < 0 && (w.status.k === 'IDLE' || w.status.k === 'RETURNING') && stableGates.has(w.at);
}

/**
 * Waiting places beside one stable, best first: wagons side by side along both flanks, horses toward the
 * gate side (the road), alternating sides outward, then further ranks behind. Only places whose whole rig
 * stands on open ground (no road, gate, building, water, field or forest) are kept.
 */
export function stableSlots(world: World, b: { x: number; y: number; w: number; h: number; facing: number }, blocked: Uint8Array): ParkSlot[] {
  const t = world.terrain, C = t.cellSize;
  const f = b.facing & 3;
  // outward (gate side) direction o and lateral u, in world x/z
  const ox = f === 1 ? 1 : f === 3 ? -1 : 0, oz = f === 0 ? 1 : f === 2 ? -1 : 0;
  const ux = -oz, uz = ox;
  const cx = (b.x + b.w / 2) * C, cz = (b.y + b.h / 2) * C;
  const depth = (f & 1 ? b.w : b.h) * C, width = (f & 1 ? b.h : b.w) * C;
  // muzzle ~1 m past the front line: the horses look out at the road, the bed stands beside the flank
  const v0 = depth / 2 + 1 - RIG_FRONT;
  const heading = Math.atan2(ox, oz);
  const out: ParkSlot[] = [];
  const free = (x: number, z: number): boolean => {
    const gx = Math.floor(x / C), gy = Math.floor(z / C);
    if (gx < 0 || gy < 0 || gx >= t.w || gy >= t.h) return false;
    return blocked[gy * t.w + gx] === 0;
  };
  for (let r = 0; r < PARK_RANKS; r++) {
    for (let j = 0; j < PARK_PER_SIDE; j++) {
      for (const side of [1, -1]) {
        const u = side * (width / 2 + 2 + j * PARK_PITCH);
        const v = v0 - r * PARK_RANK;
        const x = cx + ux * u + ox * v, z = cz + uz * u + oz * v;
        let ok = true;
        // sample the rig's footprint (the muzzle may overhang the edge of a road a little)
        for (const a of [RIG_REAR, (RIG_REAR + RIG_FRONT) / 2, RIG_FRONT - 1.4]) {
          for (const l of [-0.9, 0.9]) {
            if (!free(x + ox * a + ux * l, z + oz * a + uz * l)) { ok = false; break; }
          }
          if (!ok) break;
        }
        if (ok) out.push({ x, z, heading });
      }
    }
  }
  return out;
}

/** Cells a parked rig may not stand on: roads, gates, footprints, water, fields, forest. */
export function parkingBlocked(world: World): Uint8Array {
  const t = world.terrain, st = world.state;
  const n = t.w * t.h;
  const m = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (t.water[i] || st.roads[i] || t.field[i] || t.forest[i]! > 0.15) m[i] = 1;
  }
  for (const b of st.buildings) {
    m[b.gate] = 1;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) m[y * t.w + x] = 1;
  }
  return m;
}

/**
 * Drawn waiting place of every wagon standing idle (or just back) at a stable gate, render-only (D-43): the
 * sim keeps them all on the gate node; the view fans them out into the stable's slots, in wagon id order
 * (deterministic: same state, same places). Wagons beyond the free slots get none (the view tucks them
 * into the stable). `slots` caches stableSlots per stable id; pass the same map while netVersion is unchanged.
 */
export function stableParking(world: World, slots?: Map<number, ParkSlot[]>): Map<number, ParkSlot> {
  const gates = new Map<number, number>();
  for (const b of world.state.buildings) if (b.type === 'stable') gates.set(b.gate, b.id);
  const res = new Map<number, ParkSlot>();
  if (!gates.size) return res;
  const gateSet = new Set(gates.keys());
  const byGate = new Map<number, Wagon[]>();
  for (const w of world.state.wagons) {
    if (!isParked(w, gateSet)) continue;
    const l = byGate.get(w.at);
    if (l) l.push(w); else byGate.set(w.at, [w]);
  }
  if (!byGate.size) return res;
  const cache = slots ?? new Map<number, ParkSlot[]>();
  let blocked: Uint8Array | null = null;
  const taken: ParkSlot[] = [];
  for (const [gate, list] of byGate) {
    const id = gates.get(gate)!;
    let s = cache.get(id);
    if (!s) {
      const b = world.state.buildings.find((q) => q.id === id)!;
      blocked ??= parkingBlocked(world);
      s = stableSlots(world, b, blocked);
      cache.set(id, s);
    }
    list.sort((a, b) => a.id - b.id);
    let k = 0;
    for (const w of list) {
      // two stables side by side: never hand out a place another stable's wagon already stands on
      while (k < s.length && taken.some((o) => Math.hypot(o.x - s[k]!.x, o.z - s[k]!.z) < (o.heading === s[k]!.heading ? PARK_PITCH - 0.01 : RIG_FRONT - RIG_REAR))) k++;
      if (k >= s.length) break;
      res.set(w.id, s[k]!);
      taken.push(s[k]!);
      k++;
    }
  }
  return res;
}
