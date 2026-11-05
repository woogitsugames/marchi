// Dispatcher: matches demand to supply, reserves cargo, assigns the nearest free wagon.
// Also computes each building's status (the "why is it stalled?" data).
import { BUILDINGS, GOODS, MARKET, STONE_RESERVE, TICK_HZ, TOP_UP_MIN, UNLOAD_TICKS, capacityOf, inputGoods, outputGoods, sumGoods } from './defs';
import { contractTarget, storeCapOf } from './contract';
import { marketOpen, unitCents } from './town';
import { fairPercent, orderOutstanding } from './events';
import { dijkstra, hasEdge, net, reachable, releaseDistMap, DX, DY, type DistMap, type World } from './network';
import type { Building, BuildingStatus, Contract, Good, Wagon } from './types';

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

/**
 * Research knobs (dispatcher 2, lesson-safe round 2026-11-05). Tools flip these; the game uses the defaults.
 * a: rule A on/off. aMargin: busy wagon must arrive this many s sooner. aRatio: free wagon's empty run must be
 * >= aRatio x the busy wagon's ETA. aMinFree: free wagon's run must be >= this many s. aCastle / aInput /
 * aPush / aMarket: contexts where A may hold. aTopUpOnly: on inputs, hold only when the workshop is not
 * starving. aNoBottleneck: never hold an input whose workshop feeds a good the castle still lacks.
 * c: rule C on/off. cStrict: C also needs the workshop to hold input for one cycle (no idle stall from C).
 */
export const RULES = {
  a: 1, aMargin: 0, aRatio: 0, aMinFree: 0, aCastle: 1, aInput: 1, aPush: 1, aMarket: 1, aTopUpOnly: 0, aNoBottleneck: 0,
  c: 1, cStrict: 0,
};

/** A job left for a busy wagon that reaches the source sooner than any free one (rule A, D-155). */
interface Held { wagon: number; at: number }

class DistCache {
  private fwd = new Map<number, DistMap>();
  private rev = new Map<number, DistMap>();
  private revLoaded = new Map<number, DistMap>();
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
  /** time from anything (loaded) to node */
  toLoaded(node: number): DistMap {
    let m = this.revLoaded.get(node);
    if (!m) { m = dijkstra(this.world, node, true, true); this.revLoaded.set(node, m); }
    return m;
  }
  /** Recycle every map handed out; none may be read afterwards (they never leave `dispatch`). */
  release(): void {
    for (const m of this.fwd.values()) releaseDistMap(this.world, m);
    for (const m of this.rev.values()) releaseDistMap(this.world, m);
    for (const m of this.revLoaded.values()) releaseDistMap(this.world, m);
    this.revLoaded.clear();
    this.fwd.clear();
    this.rev.clear();
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
  return contractTarget(m.contract, g) - b.stock[g] - b.incoming[g];
}

/**
 * Rule C (D-155): the castle still lacks `g` for the whole letter (stock + on the way), or a workshop on
 * the map uses `g` as an input. Granaries do not count: storing a good nobody needs is no reason to make it.
 */
function stillWanted(world: World, contract: Contract, g: Good): boolean {
  const castle = buildingById(world, contract.castle);
  if (castle && contract.need[g] - castle.stock[g] - castle.incoming[g] > 0) return true;
  return world.state.buildings.some((c) => c.type !== 'warehouse' && c.type !== 'castle' && inputGoods(c.type).includes(g));
}

function warehouseSpace(b: Building): number {
  return storeCapOf(b) - sumGoods(b.stock) - sumGoods(b.incoming);
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

/**
 * D-94, free valley only: a workshop that still has input for a cycle (or some on the way) asks for more of
 * `g` only once min(load, TOP_UP_MIN) units fit. Returns that number while the request is held back, else 0
 * (asks now, starving, full, not an input, or a contract mission). Read-only: the dispatcher and the card's
 * "waits for a fuller wagon" line use the same test.
 */
export function topUpHold(world: World, b: Building, g: Good): number {
  if (world.state.mission.id !== 'sandbox') return 0;
  const def = BUILDINGS[b.type];
  if (!def.recipe || b.type === 'castle' || b.type === 'warehouse' || !inputGoods(b.type).includes(g)) return 0;
  const want = def.inCap - b.stock[g] - b.incoming[g];
  const starving = b.stock[g] < (def.recipe.inputs[g] ?? 1) && b.incoming[g] === 0;
  const need = Math.min(capacityOf(g), TOP_UP_MIN);
  return want > 0 && !starving && want < need ? need : 0;
}

export function dispatch(world: World): void {
  const st = world.state;
  const dc = new DistCache(world);
  const free: Wagon[] = st.wagons.filter(isFree);
  const unmet = new Map<string, Unmet>();
  const pushFail = new Map<string, PushFail>();
  const held = new Map<string, Held>();
  const contract = st.mission.contract && st.mission.result === 'running' ? st.mission.contract : null;

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
    // Dispatcher 2, rule C (D-155): in a contract mission a workshop none of whose outputs is still wanted
    // asks for no more input. Wanted = the castle still lacks some of it for the whole letter (stock and
    // what is on the way), or another workshop on the map uses it. Without this, a sawmill whose planks
    // are all delivered keeps pulling wood one unit at a time and takes wagons from the chains that are
    // still short (mission I: the bread chain lost the contract after a late extra wagon).
    const unwanted = RULES.c && contract !== null && !outputGoods(b.type).some((og) => stillWanted(world, contract, og));
    if (unwanted && !RULES.cStrict) continue;
    for (const g of inputGoods(b.type)) {
      if (unwanted && b.stock[g] + b.incoming[g] >= (def.recipe?.inputs[g] ?? 1)) continue;
      const want = def.inCap - b.stock[g] - b.incoming[g];
      if (want > 0) demands.push({ b, good: g, want, prio: 1, fill: (b.stock[g] + b.incoming[g]) / def.inCap });
    }
  }
  // free valley and missions with road stone (D-32): granaries keep a stone reserve for cobbles and
  // stone bridges (design S5), after every producer input and before the market (full loads only)
  if (marketOpen(world) || st.mission.roadStone) {
    for (const b of st.buildings) {
      if (b.type !== 'warehouse') continue;
      const want = Math.min(STONE_RESERVE - b.stock.stone - b.incoming.stone, warehouseSpace(b));
      if (want >= capacityOf('stone')) demands.push({ b, good: 'stone', want, prio: 2, fill: (b.stock.stone + b.incoming.stone) / STONE_RESERVE });
    }
  }
  // Ties (two empty consumers) go to the lower id in contract missions. In the free valley, where
  // one source often feeds two kinds of consumer (wood: sawmill + charcoal burner, grain: mill +
  // malthouse), the consumer stalled longer goes first, so a contested input alternates fairly.
  const fair = marketOpen(world);
  demands.sort((a, c) => a.prio - c.prio || a.fill - c.fill || (fair ? c.b.stalledTicks - a.b.stalledTicks : 0) ||
    a.b.id - c.b.id || GOODS.indexOf(a.good) - GOODS.indexOf(c.good));

  // a source holds unreserved stock of g (read inline in the loops below: no array per demand)
  const isSource = (s: Building, g: Good): boolean =>
    (s.type === 'warehouse' || outputGoods(s.type).includes(g)) && s.stock[g] - s.reservedOut[g] > 0;

  // Dispatcher 2, rule A (D-155) — arrival before dispatch. The nearest FREE wagon is not always the one
  // that gets to `source` first: a wagon still delivering close by (rest of its loaded run + unloading +
  // the empty run on to `source`) may stand there sooner. Sending the far free wagon then reserves the
  // goods for a long empty run while the near one arrives, finds nothing and drives off for scraps —
  // the "one more wagon makes it slower" effect (research 2026-11-05: 56 of 195 extra-wagon tries
  // slower, 28 lost a seal). So the job waits: pickWagon returns the busy wagon as a `Held` (the next
  // dispatch, every DISPATCH_INTERVAL ticks, decides again with fresh positions and nothing is reserved
  // meanwhile). A wagon held at ice or without a route never holds a job: its arrival is unknown.
  const pickWagon = (source: Building, ctx: 'castle' | 'input' | 'push' | 'market', d: Demand | null = null): Wagon | Held | null => {
    if (free.length === 0) return null;
    const rev = dc.to(source.gate);
    let best: Wagon | null = null, bestT = Infinity;
    for (const w of free) {
      const t = rev.dist[wagonNode(w)]!;
      if (t < bestT) { bestT = t; best = w; }
    }
    if (!best) return null;
    if (!RULES.a) return best;
    if (ctx === 'castle' ? !RULES.aCastle : ctx === 'input' ? !RULES.aInput : ctx === 'push' ? !RULES.aPush : !RULES.aMarket) return best;
    if (ctx === 'input' && d && RULES.aTopUpOnly) {
      const starvingNow = d.b.stock[d.good] < (BUILDINGS[d.b.type].recipe?.inputs[d.good] ?? 1);
      if (starvingNow) return best;
    }
    if (ctx === 'input' && d && RULES.aNoBottleneck && contract) {
      const castle = buildingById(world, contract.castle);
      if (castle && outputGoods(d.b.type).some((og) => contractTarget(contract, og) - castle.stock[og] - castle.incoming[og] > 0)) return best;
    }
    if (bestT < RULES.aMinFree) return best;
    let due: Wagon | null = null, dueT = bestT;
    for (const w of st.wagons) {
      const j = w.job;
      if (!j || j.phase !== 'dropoff' || w.status.k === 'BRIDGE_CLOSED' || w.status.k === 'NO_ROUTE') continue;
      const to = buildingById(world, j.to);
      if (!to) continue;
      // seconds until the drop-off is done: the unloading left, or the loaded run plus a full unloading
      const rest = w.status.k === 'UNLOADING' ? w.busyTicks / TICK_HZ : dc.toLoaded(to.gate).dist[wagonNode(w)]! + UNLOAD_TICKS / TICK_HZ;
      const t = rest + (to.gate === source.gate ? 0 : rev.dist[to.gate]!);
      if (t < dueT) { dueT = t; due = w; }
    }
    // the status shows when the busy wagon should stand at the source (whole ticks, rounded up)
    if (due && (bestT - dueT < RULES.aMargin || bestT < RULES.aRatio * dueT)) due = null;
    if (due) return { wagon: due.id, at: st.tick + Math.max(1, Math.floor(dueT * TICK_HZ) + 1) };
    return best;
  };
  const isHeldJob = (w: Wagon | Held | null): w is Held => w !== null && !('job' in w);

  for (const d of demands) {
    // Full loads by default; a starving producer accepts a small first load to restart.
    const cap = capacityOf(d.good);
    // starving = cannot start one more cycle and nothing is on the way (input 1: an empty stock)
    const starving = d.prio === 1 && d.b.stock[d.good] < (BUILDINGS[d.b.type].recipe?.inputs[d.good] ?? 1) && d.b.incoming[d.good] === 0;
    // free valley (D-94): a workshop with input for a cycle waits until a fuller load fits (contract
    // missions keep the one-unit top-up their balance and golden hashes were built on)
    if (d.prio === 1 && topUpHold(world, d.b, d.good) > 0) continue;
    const minQty = Math.min(d.want, starving ? 2 : cap);
    let best: Building | null = null, bestT = Infinity, anyAvail = -1;
    for (const s of st.buildings) {
      if (!isSource(s, d.good) || s.id === d.b.id) continue;
      if (s.type === 'warehouse' && d.b.type === 'warehouse') continue;
      const avail = s.stock[d.good] - s.reservedOut[d.good];
      const producer = s.type !== 'warehouse';
      if (producer && avail < minQty) continue;
      if (anyAvail === -1) anyAvail = s.id;
      // No free wagon: nothing can be assigned, only "is any source reachable" decides the stall
      // (ALL_BUSY vs UNREACHABLE), so answer it from the component labels, not a full Dijkstra.
      const t = free.length === 0 ? (reachable(world, s.gate, d.b.gate) ? 0 : Infinity) : dc.from(s.gate).dist[d.b.gate]!;
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
    const wagon = pickWagon(best, d.prio === 0 ? 'castle' : 'input', d);
    if (isHeldJob(wagon)) { held.set(key, wagon); continue; }
    if (!wagon || dc.to(best.gate).dist[wagonNode(wagon)] === Infinity) {
      unmet.set(key, { k: 'NO_WAGON', cause: 'NONE_CAN_REACH' });
      continue;
    }
    const qty = Math.min(d.want, best.stock[d.good] - best.reservedOut[d.good], cap);
    assignJob(world, wagon, best, d.b, d.good, qty);
    free.splice(free.indexOf(wagon), 1);
  }

  // --- market (free valley): the castle buys full loads of spare goods, most valuable first.
  // Runs after the producers' own inputs (they get first call on every source) and before the
  // granary push. At most MARKET.wagonSharePct of the fleet hauls to the market at once.
  if (marketOpen(world)) {
    let slots = Math.max(1, Math.floor((st.wagons.length * MARKET.wagonSharePct) / 100));
    const markets = st.buildings.filter((b) => b.type === 'castle');
    for (const w of st.wagons) if (w.job && markets.some((m) => m.id === w.job!.to)) slots--;
    // goods still owed to accepted royal orders go first (D-54; no order = the old price order)
    const owed = (g: Good): number => (orderOutstanding(st, g) > 0 ? 1 : 0);
    const goods = GOODS.filter((g) => MARKET.base[g] > 0)
      .sort((a, c) => owed(c) - owed(a) || unitCents(st, c, fairPercent(world, c)) - unitCents(st, a, fairPercent(world, a)) || GOODS.indexOf(a) - GOODS.indexOf(c));
    for (const m of markets) {
      for (const g of goods) {
        if (slots <= 0 || free.length === 0) break;
        const cap = capacityOf(g);
        if (MARKET.inflightPerGood - m.incoming[g] < cap) continue;
        let best: Building | null = null, bestT = Infinity;
        for (const s of st.buildings) {
          if (!isSource(s, g) || s.stock[g] - s.reservedOut[g] < cap) continue;
          // stone in a granary is building material (cobbles, stone bridges), not for sale
          if (g === 'stone' && s.type === 'warehouse') continue;
          const t = dc.from(s.gate).dist[m.gate]!;
          if (t < bestT) { bestT = t; best = s; }
        }
        if (!best) continue;
        const wagon = pickWagon(best, 'market');
        if (isHeldJob(wagon) || !wagon || dc.to(best.gate).dist[wagonNode(wagon)] === Infinity) continue;
        assignJob(world, wagon, best, m, g, cap);
        free.splice(free.indexOf(wagon), 1);
        slots--;
      }
    }
  }

  // --- surplus: producers push output to warehouses before they fill up
  for (const b of st.buildings) {
    if (b.type === 'warehouse' || b.type === 'castle' || b.type === 'stable') continue;
    const def = BUILDINGS[b.type];
    for (const g of outputGoods(b.type)) {
      const avail = b.stock[g] - b.reservedOut[g];
      // only when nearly full: consumers get first call on output
      const cap = capacityOf(g);
      if (avail < Math.max(cap / 2, def.outCap - 2)) continue;
      let best: Building | null = null, bestT = Infinity, fullWh = -1, cutOffWh = -1;
      // no free wagon: only reachability matters (best !== null, the cut-off granary), see above
      const fwd = free.length === 0 ? null : dc.from(b.gate);
      for (const wh of st.buildings) {
        if (wh.type !== 'warehouse') continue;
        if (warehouseSpace(wh) < 1) { if (fullWh === -1) fullWh = wh.id; continue; }
        const t = fwd ? fwd.dist[wh.gate]! : reachable(world, b.gate, wh.gate) ? 0 : Infinity;
        if (t === Infinity) { if (cutOffWh === -1) cutOffWh = wh.id; continue; }
        if (t < bestT) { bestT = t; best = wh; }
      }
      const key = b.id + ':' + g;
      // point at the granary that would help: a full one, else one cut off from the roads (NO_ROAD)
      if (!best) { pushFail.set(key, { cause: 'NO_DESTINATION', blockedBy: fullWh >= 0 ? fullWh : cutOffWh }); continue; }
      const wagon = pickWagon(b, 'push');
      if (isHeldJob(wagon)) { held.set(key, wagon); continue; }
      if (!wagon || dc.to(b.gate).dist[wagonNode(wagon)] === Infinity) {
        pushFail.set(key, { cause: 'NO_WAGON', blockedBy: -1 });
        continue;
      }
      const qty = Math.min(avail, cap, warehouseSpace(best));
      assignJob(world, wagon, b, best, g, qty);
      free.splice(free.indexOf(wagon), 1);
    }
  }

  diagnose(world, unmet, pushFail, held, dc);
  dc.release();
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

function diagnose(world: World, unmet: Map<string, Unmet>, pushFail: Map<string, PushFail>, held: Map<string, Held>, dc: DistCache): void {
  const st = world.state;
  void net(world);
  for (const b of st.buildings) {
    b.status = statusFor(world, b, unmet, pushFail, held, dc);
  }
}

/**
 * A supplier that waits for its own input (WAITING_DELIVERY) is held when that delivery is stuck:
 * the wagon stands at a closed or jammed bridge, or has no route. Then it makes nothing for its
 * customers and the wait is a real stall upstream, not production in progress (D-44, F5).
 */
function heldUpstream(world: World, p: Building): boolean {
  if (p.status.k !== 'WAITING_DELIVERY') return false;
  const wagonId = p.status.wagon;
  const wg = world.state.wagons.find((x) => x.id === wagonId);
  return !!wg && (wg.status.k === 'BRIDGE_CLOSED' || wg.status.k === 'BRIDGE_JAM' || wg.status.k === 'NO_ROUTE');
}

/**
 * When nothing of `g` is available: is a producer that can reach `b` busy making it? Returns
 * WAITING_UPSTREAM for a reachable producer that is producing (preferred) or waiting for an input
 * that is moving; the card names the supplier's own wait when it is not producing. A supplier whose
 * own delivery is held (heldUpstream) makes nothing: `b` reads NO_INPUT.NONE_AVAILABLE blamed on
 * it, so the chain and the stall ledger follow the supplier's wait to the bridge (D-44, F5).
 * Otherwise the producer to blame: stalled ones first, so the cause chain follows the real
 * blockage rather than the lowest id.
 */
function upstreamReason(world: World, b: Building, g: Good, dc: DistCache): BuildingStatus {
  let waiting = -1, held = -1, stalled = -1, any = -1;
  for (const p of world.state.buildings) {
    if (p.id === b.id || !outputGoods(p.type).includes(g)) continue;
    const reach = dc.from(p.gate).dist[b.gate]! < Infinity;
    const producing = p.progress >= 0 || p.status.k === 'WORKING';
    if (reach && producing) return { k: 'WAITING_UPSTREAM', good: g, from: p.id };
    const isHeld = heldUpstream(world, p);
    const healthy = !isHeld && (p.status.k === 'WAITING_DELIVERY' || p.status.k === 'WAITING_UPSTREAM');
    if (reach && healthy && waiting === -1) waiting = p.id;
    if (reach && isHeld && held === -1) held = p.id;
    if (any === -1) any = p.id;
    if (stalled === -1 && !producing && !healthy) stalled = p.id;
  }
  if (waiting >= 0) return { k: 'WAITING_UPSTREAM', good: g, from: waiting };
  return { k: 'NO_INPUT', good: g, cause: 'NONE_AVAILABLE', blockedBy: held >= 0 ? held : stalled >= 0 ? stalled : any };
}

function inputReason(world: World, b: Building, g: Good, unmet: Map<string, Unmet>, held: Map<string, Held>, dc: DistCache): BuildingStatus {
  if (b.incoming[g] > 0) {
    const w = incomingWagon(world, b, g);
    if (w >= 0) return { k: 'WAITING_DELIVERY', good: g, wagon: w };
  }
  // the goods exist and a busy wagon will fetch them sooner than a free one could (rule A): not a wagon shortage
  const h = held.get(b.id + ':' + g);
  if (h) return { k: 'WAGON_DUE', good: g, wagon: h.wagon, at: h.at };
  const u = unmet.get(b.id + ':' + g);
  if (u && u.k === 'NO_WAGON') return { k: 'NO_WAGON', good: g, cause: u.cause };
  if (u && u.k === 'NO_INPUT' && u.cause === 'UNREACHABLE') return { k: 'NO_INPUT', good: g, cause: u.cause, blockedBy: u.blockedBy };
  const rival = contestedBy(world, b, g, dc);
  if (rival >= 0) return { k: 'NO_INPUT', good: g, cause: 'CONTESTED', blockedBy: rival };
  return upstreamReason(world, b, g, dc);
}

/**
 * Competition for an input (free valley chains, e.g. wood for the sawmill and the charcoal burner):
 * the good exists and `b` could reach it, but it is promised to a consumer of another kind. Returns
 * that consumer (the first such job in wagon order), or -1. Consumers of the same kind (two mills)
 * and granaries do not count: that is ordinary sharing, explained by WAITING_UPSTREAM.
 */
function contestedBy(world: World, b: Building, g: Good, dc: DistCache): number {
  for (const w of world.state.wagons) {
    const j = w.job;
    if (!j || j.good !== g || j.to === b.id) continue;
    const to = buildingById(world, j.to);
    if (!to || to.type === b.type || !inputGoods(to.type).includes(g)) continue;
    const from = buildingById(world, j.from);
    if (!from || dc.from(from.gate).dist[b.gate]! === Infinity) continue;
    return to.id;
  }
  return -1;
}

function statusFor(world: World, b: Building, unmet: Map<string, Unmet>, pushFail: Map<string, PushFail>, held: Map<string, Held>, dc: DistCache): BuildingStatus {
  const def = BUILDINGS[b.type];
  if (b.type === 'stable') return gateConnected(world, b) ? { k: 'IDLE' } : { k: 'NO_ROAD' };
  if (b.type === 'warehouse') {
    if (!gateConnected(world, b)) return { k: 'NO_ROAD' };
    // full counts what is already promised to arrive, matching the dispatcher's view of free space
    return sumGoods(b.stock) + sumGoods(b.incoming) >= storeCapOf(b) ? { k: 'STORAGE_FULL' } : { k: 'IDLE' };
  }
  if (b.type === 'castle') {
    const m = world.state.mission;
    // free valley: the castle is the market; it only needs a road
    if (marketOpen(world)) return gateConnected(world, b) ? { k: 'IDLE' } : { k: 'NO_ROAD' };
    if (!m.contract || m.contract.castle !== b.id) return { k: 'IDLE' };
    if (m.result === 'won') return { k: 'CONTRACT_DONE' };
    if (!gateConnected(world, b)) return { k: 'NO_ROAD' };
    // report the first good still missing, preferring a real stall over "on the way"
    let waiting: BuildingStatus | null = null;
    for (const g of GOODS) {
      // with tranches only the goods of the letter currently due count
      const target = contractTarget(m.contract, g);
      if (target - b.stock[g] <= 0) continue;
      const r = inputReason(world, b, g, unmet, held, dc);
      if (r.k === 'WAITING_DELIVERY' || r.k === 'WAITING_UPSTREAM' || r.k === 'WAGON_DUE') { if (!waiting) waiting = r; continue; }
      if (target - b.stock[g] - b.incoming[g] > 0) return r;
    }
    return waiting ?? { k: 'IDLE' };
  }
  if (b.progress >= 0) return { k: 'WORKING' };
  if (!gateConnected(world, b)) return { k: 'NO_ROAD' };
  const r = def.recipe!;
  for (const g of inputGoods(b.type)) {
    if (b.stock[g] < (r.inputs[g] ?? 0)) return inputReason(world, b, g, unmet, held, dc);
  }
  for (const g of outputGoods(b.type)) {
    if (b.stock[g] + (r.outputs[g] ?? 0) > def.outCap) {
      const pw = pickupWagon(world, b, g);
      if (pw >= 0) return { k: 'WAITING_PICKUP', good: g, wagon: pw };
      const h = held.get(b.id + ':' + g);
      if (h) return { k: 'WAGON_DUE', good: g, wagon: h.wagon, at: h.at };
      const f = pushFail.get(b.id + ':' + g);
      if (f) return { k: 'OUTPUT_FULL', good: g, cause: f.cause, blockedBy: f.blockedBy };
      return { k: 'OUTPUT_FULL', good: g, cause: 'NO_WAGON', blockedBy: -1 };
    }
  }
  return { k: 'IDLE' };
}
