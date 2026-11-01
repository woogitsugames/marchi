// Wagon actors: movement along the road graph, bridge lanes, loading/unloading, re-routing.
import {
  BUILDINGS, DT, LOAD_TICKS, NO_ROUTE_CANCEL_TICKS, UNLOAD_TICKS, WAGON_CAPACITY, WOOD_BRIDGE_MAX_WAGONS, inputGoods, sumGoods,
} from './defs';
import { buildingById } from './logistics';
import { dijkstra, edgeLength, edgeSpeedAt, findPath, hasEdge, isRaining, net, type World } from './network';
import type { Building, Good, Wagon } from './types';

const REPLAN_RETRY_TICKS = 50;

export function stepWagons(world: World): void {
  for (const w of world.state.wagons) stepWagon(world, w);
}

function targetNode(world: World, w: Wagon): number {
  if (w.job) {
    const b = buildingById(world, w.job.phase === 'pickup' ? w.job.from : w.job.to);
    return b ? b.gate : -1;
  }
  const home = buildingById(world, w.home);
  return home ? home.gate : -1;
}

function stepWagon(world: World, w: Wagon): void {
  const st = world.state;
  if (w.busyTicks > 0) {
    w.busyTicks--;
    if (w.busyTicks === 0) finishBusy(world, w);
    return;
  }
  // a job whose endpoints vanished (demolished building) is repaired here
  if (w.job) repairJob(world, w);

  const target = targetNode(world, w);
  if (target !== w.dest) {
    w.dest = target;
    w.pathVer = -1;
    w.path = [];
  }

  let budget = 1; // fraction of this tick still available for movement
  for (let guard = 0; guard < 4 && budget > 0; guard++) {
    if (w.next < 0) {
      if (w.dest < 0) { strandedCargo(world, w); return; }
      if (w.at === w.dest) { arrive(w); return; }
      if (!ensurePath(world, w)) return;
      const nxt = w.path[0]!;
      if (!hasEdge(world, w.at, nxt)) { w.pathVer = -1; if (!ensurePath(world, w)) return; }
      const n2 = w.path[0]!;
      const blocker = bridgeBlocker(world, w, n2);
      if (blocker) {
        w.status = { k: 'BRIDGE_JAM', span: blocker.span, blocker: blocker.wagon };
        return;
      }
      w.path.shift();
      enterEdge(world, w, n2);
    }
    // advance along at -> next
    const len = edgeLength(world.terrain, w.at, w.next);
    const loaded = w.cargoQty > 0;
    const v = edgeSpeedAt(world, w.at, w.next, w.edgeT / len, loaded, isRaining(st));
    const step = v * DT * budget;
    if (w.edgeT + step < len) {
      w.edgeT += step;
      w.odometer += step;
      budget = 0;
    } else {
      const used = len - w.edgeT;
      w.odometer += used;
      budget -= budget * (used / step);
      arriveNode(world, w);
    }
  }
}

/** Loaded wagon whose destination disappeared and nobody else accepts the cargo yet. */
function strandedCargo(world: World, w: Wagon): void {
  const st = world.state;
  if (!w.job) { idleStatus(w); return; }
  if (w.status.k !== 'NO_ROUTE') w.status = { k: 'NO_ROUTE', target: -1, since: st.tick };
  if ((st.tick - w.status.since) % REPLAN_RETRY_TICKS !== 0) return;
  const alt = alternativeDestination(world, w, -1);
  if (alt) {
    alt.incoming[w.job.good] += w.job.qty;
    w.job.to = alt.id;
    w.dest = alt.gate;
    w.pathVer = -1;
  }
}

function movingStatus(w: Wagon): void {
  if (w.job) w.status = { k: w.job.phase === 'pickup' ? 'TO_PICKUP' : 'TO_DROPOFF' };
  else w.status = { k: 'RETURNING' };
}

function idleStatus(w: Wagon): void {
  w.status = { k: 'IDLE' };
}

function enterEdge(world: World, w: Wagon, to: number): void {
  const c = net(world);
  const fromSpan = c.span[w.at]!, toSpan = c.span[to]!;
  if (toSpan >= 0 && fromSpan !== toSpan) w.bridgeFrom = w.at;
  w.next = to;
  w.edgeT = 0;
  world.state.traffic[to] = (world.state.traffic[to] ?? 0) + 1;
  movingStatus(w);
}

function arriveNode(world: World, w: Wagon): void {
  w.at = w.next;
  w.next = -1;
  w.edgeT = 0;
  const c = net(world);
  if (w.bridgeFrom >= 0 && c.span[w.at] === -1) w.bridgeFrom = -1;
}

/** If entering `to` puts the wagon on a one-lane bridge against traffic, return who blocks it. */
function bridgeBlocker(world: World, w: Wagon, to: number): { span: number; wagon: number } | null {
  const c = net(world);
  const span = c.span[to]!;
  if (span < 0 || c.span[w.at] === span) return null;
  let count = 0;
  let opposing = -1;
  for (const o of world.state.wagons) {
    if (o === w) continue;
    const onSpan = c.span[o.at] === span || (o.next >= 0 && c.span[o.next] === span);
    if (!onSpan || o.bridgeFrom < 0) continue;
    count++;
    if (o.bridgeFrom !== w.at && opposing === -1) opposing = o.id;
  }
  if (opposing >= 0) return { span, wagon: opposing };
  if (count >= WOOD_BRIDGE_MAX_WAGONS) {
    for (const o of world.state.wagons) {
      if (o !== w && (c.span[o.at] === span || (o.next >= 0 && c.span[o.next] === span))) return { span, wagon: o.id };
    }
  }
  return null;
}

/** Make sure w.path leads from w.at to w.dest on the current network. Sets NO_ROUTE when impossible. */
function ensurePath(world: World, w: Wagon): boolean {
  const st = world.state;
  if (w.pathVer === st.netVersion && w.path.length > 0) return true;
  if (w.status.k === 'NO_ROUTE' && w.pathVer === st.netVersion && (st.tick - w.status.since) % REPLAN_RETRY_TICKS !== 0) {
    handleNoRoute(world, w);
    return false;
  }
  const p = findPath(world, w.at, w.dest, w.cargoQty > 0);
  w.pathVer = st.netVersion;
  if (p && p.length > 0) {
    w.path = p;
    movingStatus(w);
    return true;
  }
  w.path = [];
  const target = w.job ? (w.job.phase === 'pickup' ? w.job.from : w.job.to) : -1;
  if (w.status.k !== 'NO_ROUTE' || w.status.target !== target) w.status = { k: 'NO_ROUTE', target, since: st.tick };
  handleNoRoute(world, w);
  return false;
}

/** After waiting too long without a route: cancel an unloaded job, or re-target a loaded one. */
function handleNoRoute(world: World, w: Wagon): void {
  const st = world.state;
  if (w.status.k !== 'NO_ROUTE' || !w.job) return;
  if (st.tick - w.status.since < NO_ROUTE_CANCEL_TICKS) return;
  if (w.job.phase === 'pickup') {
    cancelJob(world, w);
    w.status = { k: 'NO_ROUTE', target: -1, since: st.tick };
    w.pathVer = -1;
    return;
  }
  const alt = alternativeDestination(world, w, w.job.to);
  if (alt) {
    const old = buildingById(world, w.job.to);
    if (old) old.incoming[w.job.good] -= w.job.qty;
    alt.incoming[w.job.good] += w.job.qty;
    w.job.to = alt.id;
    w.pathVer = -1;
    w.dest = alt.gate;
  }
  w.status = { k: 'NO_ROUTE', target: w.job.to, since: st.tick };
}

export function cancelJob(world: World, w: Wagon): void {
  const j = w.job;
  if (!j) return;
  const from = buildingById(world, j.from);
  const to = buildingById(world, j.to);
  if (j.phase === 'pickup' && from) from.reservedOut[j.good] -= j.qty;
  if (to) to.incoming[j.good] -= j.qty;
  w.job = null;
}

/** A reachable building (not `except`) that accepts `qty` of the wagon's cargo. */
function alternativeDestination(world: World, w: Wagon, except: number): Building | null {
  const g = w.cargoGood;
  if (!g) return null;
  const st = world.state;
  const m = dijkstra(world, w.next >= 0 ? w.next : w.at, false, true);
  let best: Building | null = null, bestT = Infinity;
  for (const b of st.buildings) {
    if (b.id === except) continue;
    if (!accepts(world, b, g, w.cargoQty)) continue;
    const t = m.dist[b.gate]!;
    if (t < bestT) { bestT = t; best = b; }
  }
  return best;
}

/** How many more units of g the building can accept beyond what is already promised. */
export function acceptsUpTo(world: World, b: Building, g: Good): number {
  const def = BUILDINGS[b.type];
  if (b.type === 'warehouse') return def.storeCap - sumGoods(b.stock) - sumGoods(b.incoming);
  if (b.type === 'castle') {
    const m = world.state.mission;
    if (!m.contract || m.result !== 'running' || m.contract.castle !== b.id) return 0;
    return m.contract.need[g] - b.stock[g] - b.incoming[g];
  }
  if (inputGoods(b.type).includes(g)) return def.inCap - b.stock[g] - b.incoming[g];
  return 0;
}

export function accepts(world: World, b: Building, g: Good, qty: number): boolean {
  const def = BUILDINGS[b.type];
  if (b.type === 'warehouse') return def.storeCap - sumGoods(b.stock) - sumGoods(b.incoming) >= qty;
  if (b.type === 'castle') {
    const m = world.state.mission;
    return !!m.contract && m.result === 'running' && m.contract.castle === b.id && m.contract.need[g] - b.stock[g] - b.incoming[g] >= qty;
  }
  if (inputGoods(b.type).includes(g)) return def.inCap - b.stock[g] - b.incoming[g] >= qty;
  return false;
}

/** Fix jobs whose source or destination was demolished. */
function repairJob(world: World, w: Wagon): void {
  const j = w.job!;
  const from = buildingById(world, j.from);
  const to = buildingById(world, j.to);
  if (j.phase === 'pickup' && !from) {
    if (to) to.incoming[j.good] -= j.qty;
    w.job = null;
    return;
  }
  if (!to) {
    if (j.phase === 'pickup') {
      if (from) from.reservedOut[j.good] -= j.qty;
      w.job = null;
      return;
    }
    const alt = alternativeDestination(world, w, -1);
    if (alt) {
      alt.incoming[j.good] += j.qty;
      j.to = alt.id;
    } else {
      // keep cargo, wait in place; destination -1 is reported as NO_ROUTE
      j.to = -1;
      w.status = { k: 'NO_ROUTE', target: -1, since: world.state.tick };
    }
  }
}

function arrive(w: Wagon): void {
  const j = w.job;
  if (!j) { idleStatus(w); return; }
  if (j.phase === 'pickup') {
    w.status = { k: 'LOADING' };
    w.busyTicks = LOAD_TICKS;
  } else {
    w.status = { k: 'UNLOADING' };
    w.busyTicks = UNLOAD_TICKS;
  }
}

function finishBusy(world: World, w: Wagon): void {
  const j = w.job;
  if (!j) { idleStatus(w); return; }
  if (j.phase === 'pickup') {
    const from = buildingById(world, j.from);
    if (!from) { cancelJob(world, w); idleStatus(w); return; }
    // Move the reserved units from stock to cargo atomically.
    const qty = Math.min(j.qty, from.stock[j.good]);
    from.stock[j.good] -= qty;
    from.reservedOut[j.good] -= j.qty;
    if (qty < j.qty) {
      const to = buildingById(world, j.to);
      if (to) to.incoming[j.good] -= j.qty - qty;
      j.qty = qty;
    }
    // Top up with unreserved units produced while the wagon was on its way.
    const to = buildingById(world, j.to);
    if (to && qty === j.qty) {
      const spare = from.stock[j.good] - from.reservedOut[j.good];
      const extra = Math.min(WAGON_CAPACITY - qty, spare, acceptsUpTo(world, to, j.good));
      if (extra > 0) {
        from.stock[j.good] -= extra;
        to.incoming[j.good] += extra;
        j.qty += extra;
      }
    }
    w.cargoGood = j.good;
    w.cargoQty = j.qty;
    j.phase = 'dropoff';
    w.pathVer = -1;
    w.status = { k: 'TO_DROPOFF' };
    if (qty === 0) { w.cargoGood = null; w.job = null; w.status = { k: 'RETURNING' }; }
    return;
  }
  const to = buildingById(world, j.to);
  if (!to) { w.status = { k: 'NO_ROUTE', target: -1, since: world.state.tick }; return; }
  to.stock[j.good] += w.cargoQty;
  to.incoming[j.good] -= j.qty;
  w.cargoQty = 0;
  w.cargoGood = null;
  w.job = null;
  w.pathVer = -1;
  w.status = { k: 'RETURNING' };
}

/** All goods currently loaded on wagons. */
export function cargoTotals(world: World): Record<Good, number> {
  const out = { wood: 0, planks: 0, grain: 0, flour: 0, bread: 0 };
  for (const w of world.state.wagons) if (w.cargoGood) out[w.cargoGood] += w.cargoQty;
  return out;
}
