// Dispatcher: matches demand to supply, reserves cargo, assigns the nearest free wagon.
// Also computes each building's status (the "why is it stalled?" data).
import { BUILDINGS, GOODS, WAGON_CAPACITY, inputGoods, outputGoods, sumGoods } from './defs';
import { dijkstra, hasEdge, net, DX, DY, type DistMap, type World } from './network';
import type { Building, BuildingStatus, Good, Wagon } from './types';

interface Demand {
  b: Building;
  good: Good;
  want: number;
  prio: number;
  fill: number;
}

type Unmet =
  | { k: 'NO_WAGON'; cause: 'ALL_BUSY' | 'NONE_CAN_REACH' }
  | { k: 'NO_INPUT'; cause: 'NONE_AVAILABLE' | 'UNREACHABLE'; blockedBy: number };

type PushFail = { cause: 'NO_WAGON' | 'NO_DESTINATION'; blockedBy: number };

class DistCache {
  private fwd = new Map<number, DistMap>();
  private rev = new Map<number, DistMap>();
  constructor(private world: World) {}
  /** time from node (loaded) to anything */
  from(node: number): DistMap {
    let m = this.fwd.get(node);
    if (!m) { m = dijkstra(this.world, node, false, true); this.fwd.set(node, m); }
    return m;
  }
  /** time from anything (empty) to node */
  to(node: number): DistMap {
    let m = this.rev.get(node);
    if (!m) { m = dijkstra(this.world, node, true, false); this.rev.set(node, m); }
    return m;
  }
}

export function wagonNode(w: Wagon): number {
  return w.next >= 0 ? w.next : w.at;
}

export function isFree(w: Wagon): boolean {
  return w.job === null && w.busyTicks === 0;
}

export function buildingById(world: World, id: number): Building | null {
  // buildings are kept sorted by id; linear scan is fine at this scale
  for (const b of world.state.buildings) if (b.id === id) return b;
  return null;
}

function remainingContract(world: World, b: Building, g: Good): number {
  const m = world.state.mission;
  if (!m.contract || m.result !== 'running' || m.contract.castle !== b.id) return 0;
  return m.contract.need[g] - b.stock[g] - b.incoming[g];
}

function warehouseSpace(b: Building): number {
  return BUILDINGS[b.type].storeCap - sumGoods(b.stock) - sumGoods(b.incoming);
}

export function assignJob(world: World, wagon: Wagon, from: Building, to: Building, good: Good, qty: number): void {
  const st = world.state;
  from.reservedOut[good] += qty;
  to.incoming[good] += qty;
  wagon.job = { id: st.nextId++, good, qty, from: from.id, to: to.id, phase: 'pickup' };
  wagon.dest = from.gate;
  wagon.pathVer = -1; // replan at the next node
  wagon.path = [];
  wagon.status = { k: 'TO_PICKUP' };
}

export function dispatch(world: World): void {
  const st = world.state;
  const dc = new DistCache(world);
  const free: Wagon[] = st.wagons.filter(isFree);
  const unmet = new Map<string, Unmet>();
  const pushFail = new Map<string, PushFail>();

  // --- demands
  const demands: Demand[] = [];
  for (const b of st.buildings) {
    const def = BUILDINGS[b.type];
    if (b.type === 'castle') {
      for (const g of GOODS) {
        const want = remainingContract(world, b, g);
        if (want > 0) demands.push({ b, good: g, want, prio: 0, fill: (b.stock[g] + b.incoming[g]) / Math.max(1, world.state.mission.contract!.need[g]) });
      }
      continue;
    }
    for (const g of inputGoods(b.type)) {
      const want = def.inCap - b.stock[g] - b.incoming[g];
      if (want > 0) demands.push({ b, good: g, want, prio: 1, fill: (b.stock[g] + b.incoming[g]) / def.inCap });
    }
  }
  demands.sort((a, c) => a.prio - c.prio || a.fill - c.fill || a.b.id - c.b.id || GOODS.indexOf(a.good) - GOODS.indexOf(c.good));

  const sourcesOf = (g: Good): Building[] =>
    st.buildings.filter((s) => (s.type === 'warehouse' || outputGoods(s.type).includes(g)) && s.stock[g] - s.reservedOut[g] > 0);

  const pickWagon = (source: Building): Wagon | null => {
    if (free.length === 0) return null;
    const rev = dc.to(source.gate);
    let best: Wagon | null = null, bestT = Infinity;
    for (const w of free) {
      const t = rev.dist[wagonNode(w)]!;
      if (t < bestT) { bestT = t; best = w; }
    }
    return best;
  };

  for (const d of demands) {
    // Full loads by default; a starving producer accepts a small first load to restart.
    const starving = d.prio > 0 && d.b.stock[d.good] === 0 && d.b.incoming[d.good] === 0;
    const minQty = Math.min(d.want, starving ? 2 : WAGON_CAPACITY);
    let best: Building | null = null, bestT = Infinity, anyAvail = -1;
    for (const s of sourcesOf(d.good)) {
      if (s.id === d.b.id) continue;
      if (s.type === 'warehouse' && d.b.type === 'warehouse') continue;
      const avail = s.stock[d.good] - s.reservedOut[d.good];
      const producer = s.type !== 'warehouse';
      if (producer && avail < minQty) continue;
      if (anyAvail === -1) anyAvail = s.id;
      const t = dc.from(s.gate).dist[d.b.gate]!;
      if (t < bestT) { bestT = t; best = s; }
    }
    const key = d.b.id + ':' + d.good;
    if (!best) {
      unmet.set(key, anyAvail === -1
        ? { k: 'NO_INPUT', cause: 'NONE_AVAILABLE', blockedBy: upstreamOf(world, d.good, d.b.id) }
        : { k: 'NO_INPUT', cause: 'UNREACHABLE', blockedBy: anyAvail });
      continue;
    }
    if (free.length === 0) { unmet.set(key, { k: 'NO_WAGON', cause: 'ALL_BUSY' }); continue; }
    const wagon = pickWagon(best);
    if (!wagon || dc.to(best.gate).dist[wagonNode(wagon)] === Infinity) {
      unmet.set(key, { k: 'NO_WAGON', cause: 'NONE_CAN_REACH' });
      continue;
    }
    const qty = Math.min(d.want, best.stock[d.good] - best.reservedOut[d.good], WAGON_CAPACITY);
    assignJob(world, wagon, best, d.b, d.good, qty);
    free.splice(free.indexOf(wagon), 1);
  }

  // --- surplus: producers push output to warehouses before they fill up
  for (const b of st.buildings) {
    if (b.type === 'warehouse' || b.type === 'castle' || b.type === 'stable') continue;
    const def = BUILDINGS[b.type];
    for (const g of outputGoods(b.type)) {
      const avail = b.stock[g] - b.reservedOut[g];
      // only when nearly full: consumers get first call on output
      if (avail < Math.max(WAGON_CAPACITY / 2, def.outCap - 2)) continue;
      let best: Building | null = null, bestT = Infinity, fullWh = -1;
      const fwd = dc.from(b.gate);
      for (const wh of st.buildings) {
        if (wh.type !== 'warehouse') continue;
        if (warehouseSpace(wh) < 1) { if (fullWh === -1) fullWh = wh.id; continue; }
        const t = fwd.dist[wh.gate]!;
        if (t < bestT) { bestT = t; best = wh; }
      }
      const key = b.id + ':' + g;
      if (!best) { pushFail.set(key, { cause: 'NO_DESTINATION', blockedBy: fullWh }); continue; }
      const wagon = pickWagon(b);
      if (!wagon || dc.to(b.gate).dist[wagonNode(wagon)] === Infinity) {
        pushFail.set(key, { cause: 'NO_WAGON', blockedBy: -1 });
        continue;
      }
      const qty = Math.min(avail, WAGON_CAPACITY, warehouseSpace(best));
      assignJob(world, wagon, b, best, g, qty);
      free.splice(free.indexOf(wagon), 1);
    }
  }

  diagnose(world, unmet, pushFail, dc);
}

/** A building that produces `good` (lowest id, not `except`), or -1. */
export function upstreamOf(world: World, good: Good, except: number): number {
  for (const b of world.state.buildings) if (b.id !== except && outputGoods(b.type).includes(good)) return b.id;
  return -1;
}

/** Does the gate have at least one drivable edge? */
export function gateConnected(world: World, b: Building): boolean {
  const t = world.terrain;
  const gx = b.gate % t.w, gy = (b.gate - gx) / t.w;
  for (let d = 0; d < 8; d++) {
    const x = gx + DX[d]!, y = gy + DY[d]!;
    if (x < 0 || y < 0 || x >= t.w || y >= t.h) continue;
    if (hasEdge(world, b.gate, y * t.w + x)) return true;
  }
  return false;
}

function incomingWagon(world: World, b: Building, g: Good): number {
  for (const w of world.state.wagons) if (w.job && w.job.to === b.id && w.job.good === g) return w.id;
  return -1;
}

function pickupWagon(world: World, b: Building, g: Good): number {
  for (const w of world.state.wagons) if (w.job && w.job.from === b.id && w.job.good === g && w.job.phase === 'pickup') return w.id;
  return -1;
}

function diagnose(world: World, unmet: Map<string, Unmet>, pushFail: Map<string, PushFail>, dc: DistCache): void {
  const st = world.state;
  void net(world);
  for (const b of st.buildings) {
    b.status = statusFor(world, b, unmet, pushFail, dc);
  }
}

/**
 * When nothing of `g` is available: is a producer that can reach `b` busy making it? Returns
 * WAITING_UPSTREAM for a working, reachable producer; otherwise the producer to blame (stalled
 * ones first, so the cause chain follows the real blockage rather than the lowest id).
 */
function upstreamReason(world: World, b: Building, g: Good, dc: DistCache): BuildingStatus {
  let stalled = -1, any = -1;
  for (const p of world.state.buildings) {
    if (p.id === b.id || !outputGoods(p.type).includes(g)) continue;
    const reach = dc.from(p.gate).dist[b.gate]! < Infinity;
    // healthy supplier: producing now, or itself just waiting for a delivery / its own supplier
    const healthy = p.progress >= 0 || p.status.k === 'WORKING' || p.status.k === 'WAITING_DELIVERY' || p.status.k === 'WAITING_UPSTREAM';
    if (reach && healthy) return { k: 'WAITING_UPSTREAM', good: g, from: p.id };
    if (any === -1) any = p.id;
    if (stalled === -1 && !healthy) stalled = p.id;
  }
  return { k: 'NO_INPUT', good: g, cause: 'NONE_AVAILABLE', blockedBy: stalled >= 0 ? stalled : any };
}

function inputReason(world: World, b: Building, g: Good, unmet: Map<string, Unmet>, dc: DistCache): BuildingStatus {
  if (b.incoming[g] > 0) {
    const w = incomingWagon(world, b, g);
    if (w >= 0) return { k: 'WAITING_DELIVERY', good: g, wagon: w };
  }
  const u = unmet.get(b.id + ':' + g);
  if (u && u.k === 'NO_WAGON') return { k: 'NO_WAGON', good: g, cause: u.cause };
  if (u && u.k === 'NO_INPUT' && u.cause === 'UNREACHABLE') return { k: 'NO_INPUT', good: g, cause: u.cause, blockedBy: u.blockedBy };
  return upstreamReason(world, b, g, dc);
}

function statusFor(world: World, b: Building, unmet: Map<string, Unmet>, pushFail: Map<string, PushFail>, dc: DistCache): BuildingStatus {
  const def = BUILDINGS[b.type];
  if (b.type === 'stable') return gateConnected(world, b) ? { k: 'IDLE' } : { k: 'NO_ROAD' };
  if (b.type === 'warehouse') {
    if (!gateConnected(world, b)) return { k: 'NO_ROAD' };
    return sumGoods(b.stock) >= def.storeCap ? { k: 'STORAGE_FULL' } : { k: 'IDLE' };
  }
  if (b.type === 'castle') {
    const m = world.state.mission;
    if (!m.contract || m.contract.castle !== b.id) return { k: 'IDLE' };
    if (m.result === 'won') return { k: 'CONTRACT_DONE' };
    if (!gateConnected(world, b)) return { k: 'NO_ROAD' };
    // report the first good still missing, preferring a real stall over "on the way"
    let waiting: BuildingStatus | null = null;
    for (const g of GOODS) {
      if (m.contract.need[g] - b.stock[g] <= 0) continue;
      const r = inputReason(world, b, g, unmet, dc);
      if (r.k === 'WAITING_DELIVERY' || r.k === 'WAITING_UPSTREAM') { if (!waiting) waiting = r; continue; }
      if (m.contract.need[g] - b.stock[g] - b.incoming[g] > 0) return r;
    }
    return waiting ?? { k: 'IDLE' };
  }
  if (b.progress >= 0) return { k: 'WORKING' };
  if (!gateConnected(world, b)) return { k: 'NO_ROAD' };
  const r = def.recipe!;
  for (const g of inputGoods(b.type)) {
    if (b.stock[g] < (r.inputs[g] ?? 0)) return inputReason(world, b, g, unmet, dc);
  }
  for (const g of outputGoods(b.type)) {
    if (b.stock[g] + (r.outputs[g] ?? 0) > def.outCap) {
      const pw = pickupWagon(world, b, g);
      if (pw >= 0) return { k: 'WAITING_PICKUP', good: g, wagon: pw };
      const f = pushFail.get(b.id + ':' + g);
      if (f) return { k: 'OUTPUT_FULL', good: g, cause: f.cause, blockedBy: f.blockedBy };
      return { k: 'OUTPUT_FULL', good: g, cause: 'NO_WAGON', blockedBy: -1 };
    }
  }
  return { k: 'IDLE' };
}
