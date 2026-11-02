// Read-only helpers that turn state into explanations: cause chains, ETAs, time of day.
import { DAY_TICKS, LOAD_TICKS, START_DAY_FRACTION, TICK_HZ, UNLOAD_TICKS, capacityOf, inputGoods, outputGoods } from './defs';
import { buildingById } from './logistics';
import { cellSpeed, edgeLength, edgeSpeedAt, findPath, grade, isRaining, pathTime, slopeFactor, type World } from './network';
import { AUTUMN_FAIR_GOOD, seasonAt, seasonal, thawing, yieldPercentAt, type Season } from './seasons';
import type { BuildingStatus, BuildingType, Good, Wagon, WagonStatus } from './types';

export type ReasonLink =
  /**
   * `waits: 'CUSTOMER'` (player chains only, see explainBuilding's `customers`): the building's
   * output is full with no granary to take it, but a reachable customer still consumes the good —
   * the next link is that customer, and the output waits for it rather than being stranded.
   */
  | { kind: 'building'; id: number; status: BuildingStatus; waits?: 'CUSTOMER' }
  | { kind: 'wagon'; id: number; status: WagonStatus };

function wagonById(world: World, id: number): Wagon | null {
  for (const w of world.state.wagons) if (w.id === id) return w;
  return null;
}

/**
 * Follow the cause of a building's state upstream, e.g. bakery -> mill -> farm (no road).
 * `customers` (the player's cards, not the sim's stall ledger): an output that is full with no
 * granary at all (OUTPUT_FULL.NO_DESTINATION, blockedBy -1) continues to its customer when one
 * still takes the good (see outputCustomer), so the chain ends at the real bottleneck.
 */
export function explainBuilding(world: World, id: number, maxDepth = 5, customers = false): ReasonLink[] {
  const chain: ReasonLink[] = [];
  const seen = new Set<string>();
  let cur: { kind: 'building' | 'wagon'; id: number } | null = { kind: 'building', id };
  while (cur && chain.length < maxDepth) {
    const key = cur.kind + cur.id;
    if (seen.has(key)) break;
    seen.add(key);
    if (cur.kind === 'building') {
      const b = buildingById(world, cur.id);
      if (!b) break;
      const c = customers ? outputCustomer(world, b.id) : -1;
      if (c >= 0) {
        chain.push({ kind: 'building', id: b.id, status: b.status, waits: 'CUSTOMER' });
        cur = { kind: 'building', id: c };
        continue;
      }
      chain.push({ kind: 'building', id: b.id, status: b.status });
      cur = nextFromBuilding(b.status);
    } else {
      const w = wagonById(world, cur.id);
      if (!w) break;
      chain.push({ kind: 'wagon', id: w.id, status: w.status });
      cur = nextFromWagon(w.status);
    }
  }
  return chain;
}

export function explainWagon(world: World, id: number, maxDepth = 4, customers = false): ReasonLink[] {
  const w = wagonById(world, id);
  if (!w) return [];
  const first: ReasonLink = { kind: 'wagon', id, status: w.status };
  const nxt = nextFromWagon(w.status);
  if (!nxt) return [first];
  const rest = nxt.kind === 'building' ? explainBuilding(world, nxt.id, maxDepth - 1, customers) : explainWagon(world, nxt.id, maxDepth - 1, customers);
  return [first, ...rest.filter((r) => !(r.kind === 'wagon' && r.id === id))];
}

/**
 * OUTPUT_FULL with no granary at all (NO_DESTINATION, blockedBy -1): a building that still takes
 * this good from here — a consumer of it as an input (malthouse for grain), the contract castle
 * while its order lacks the good, or the free-valley market — and that a loaded wagon can reach.
 * Returns its id (nearest-first is not needed: lowest id), or -1 when the output is truly stranded.
 * Such an output is not a dead end: it waits until the customer has room or a wagon is free.
 */
export function outputCustomer(world: World, id: number): number {
  const b = buildingById(world, id);
  if (!b || b.status.k !== 'OUTPUT_FULL' || b.status.cause !== 'NO_DESTINATION' || b.status.blockedBy >= 0) return -1;
  const g = b.status.good;
  const st = world.state;
  for (const c of st.buildings) {
    if (c.id === b.id) continue;
    let takes = inputGoods(c.type).includes(g);
    if (!takes && c.type === 'castle') {
      const k = st.mission.contract;
      takes = k ? k.castle === c.id && k.need[g] > c.stock[g] : st.market.open;
    }
    if (takes && findPath(world, b.gate, c.gate, true)) return c.id;
  }
  return -1;
}

/**
 * The supplier the season slows (a winter farm or fisher) behind a building that waits for an
 * input: NO_INPUT (another customer took it, none available) or WAITING_UPSTREAM. The real root is
 * the slower supply, not a missing road or the rival — the card says so above the chain. Returns
 * the producer (the one named by the status when it is slowed, else the first slowed one) and its
 * season note, or null (no seasons, a summer farm, an unrelated stall).
 */
export function seasonalSupplier(world: World, id: number): { from: number; note: SeasonNote & { k: 'YIELD' } } | null {
  if (!seasonal(world)) return null;
  const b = buildingById(world, id);
  if (!b) return null;
  const s = b.status;
  let g: Good, named = -1;
  if (s.k === 'WAITING_UPSTREAM') { g = s.good; named = s.from; }
  else if (s.k === 'NO_INPUT' && s.cause !== 'UNREACHABLE') { g = s.good; named = s.cause === 'NONE_AVAILABLE' ? s.blockedBy : -1; }
  else return null;
  const slowed = (pid: number): (SeasonNote & { k: 'YIELD' }) | null => {
    const n = seasonNote(world, pid);
    return n && n.k === 'YIELD' && n.pct < 100 ? n : null;
  };
  if (named >= 0) {
    const n = slowed(named);
    if (n) return { from: named, note: n };
  }
  for (const p of world.state.buildings) {
    if (p.id === b.id || !outputGoods(p.type).includes(g)) continue;
    const n = slowed(p.id);
    if (n) return { from: p.id, note: n };
  }
  return null;
}

function nextFromBuilding(s: BuildingStatus): { kind: 'building' | 'wagon'; id: number } | null {
  switch (s.k) {
    case 'NO_INPUT': return s.blockedBy >= 0 ? { kind: 'building', id: s.blockedBy } : null;
    case 'WAITING_DELIVERY': return { kind: 'wagon', id: s.wagon };
    case 'WAITING_UPSTREAM': return { kind: 'building', id: s.from };
    case 'WAITING_PICKUP': return { kind: 'wagon', id: s.wagon };
    case 'OUTPUT_FULL': return s.blockedBy >= 0 ? { kind: 'building', id: s.blockedBy } : null;
    default: return null;
  }
}

function nextFromWagon(s: WagonStatus): { kind: 'building' | 'wagon'; id: number } | null {
  if (s.k === 'BRIDGE_JAM') return { kind: 'wagon', id: s.blocker };
  if (s.k === 'NO_ROUTE' && s.target >= 0) return { kind: 'building', id: s.target };
  return null;
}

export interface Eta {
  /** Seconds until the wagon reaches its current destination node. */
  toDest: number;
  /** Seconds until the current job is delivered (or toDest when there is no job). */
  toFinish: number;
  /** Building the wagon is heading to (-1 home/none). */
  destBuilding: number;
}

/** Estimated times for a wagon at current conditions; null when it has no route. */
export function wagonEta(world: World, wagonId: number): Eta | null {
  const w = wagonById(world, wagonId);
  if (!w) return null;
  if (w.status.k === 'NO_ROUTE') return null;
  const rain = isRaining(world.state), thaw = thawing(world);
  const loaded = w.cargoQty > 0;
  let t = w.busyTicks / TICK_HZ;
  let node = w.at;
  if (w.next >= 0) {
    const len = edgeLength(world.terrain, w.at, w.next);
    t += (len - w.edgeT) / edgeSpeedAt(world, w.at, w.next, 0.5, loaded, rain, thaw);
    node = w.next;
  }
  if (w.dest >= 0 && node !== w.dest) {
    const p = w.pathVer === world.state.netVersion && w.path.length > 0 && w.path[w.path.length - 1] === w.dest
      ? w.path : findPath(world, node, w.dest, loaded);
    if (!p) return null;
    t += pathTime(world, node, p, loaded);
  }
  const toDest = t;
  let toFinish = t;
  let destBuilding = -1;
  const j = w.job;
  if (j) {
    destBuilding = j.phase === 'pickup' ? j.from : j.to;
    if (j.phase === 'pickup') {
      const from = buildingById(world, j.from), to = buildingById(world, j.to);
      if (from && to) {
        const p = findPath(world, from.gate, to.gate, true);
        if (p) toFinish += (w.busyTicks > 0 ? 0 : LOAD_TICKS / TICK_HZ) + pathTime(world, from.gate, p, true) + UNLOAD_TICKS / TICK_HZ;
      }
    } else if (w.busyTicks === 0) {
      toFinish += UNLOAD_TICKS / TICK_HZ;
    }
  }
  return { toDest, toFinish, destBuilding };
}

/** 0..1, 0 = midnight, 0.25 = dawn-ish, 0.5 = noon. */
export function timeOfDay(world: World): number {
  const f = START_DAY_FRACTION + world.state.tick / DAY_TICKS;
  return f - Math.floor(f);
}

export interface Slowdown {
  /** Surface under the wagon right now. */
  surface: 'dirt' | 'cobble' | 'woodBridge' | 'stoneBridge';
  raining: boolean;
  /** True when rain or the spring thaw turns the current dirt track into mud. */
  mud: boolean;
  /** The spring thaw (free valley seasons) is what makes the dirt track muddy right now. */
  thaw: boolean;
  /** Current speed divided by the dry, flat speed of the same surface (1 = no slowdown). */
  factor: number;
  /** Grade of the current edge, positive uphill. */
  grade: number;
}

/**
 * Why a moving wagon is slow (mud, slope), for the wagon card. Moving slowly is not a stall,
 * so this is not a WagonStatus — it is an explanation the UI shows next to the ETA.
 */
export function wagonSlowdown(world: World, wagonId: number): Slowdown | null {
  const w = wagonById(world, wagonId);
  if (!w) return null;
  const a = w.at, b = w.next >= 0 ? w.next : w.at;
  const cell = w.next >= 0 && w.edgeT / Math.max(1e-6, edgeLength(world.terrain, a, b)) >= 0.5 ? b : a;
  const water = world.terrain.water[cell] === 1;
  const cobble = world.state.roads[cell] === 2;
  const surface = water ? (cobble ? 'stoneBridge' : 'woodBridge') : cobble ? 'cobble' : 'dirt';
  const raining = isRaining(world.state), thaw = thawing(world);
  const g = a !== b ? grade(world.terrain, a, b) : 0;
  const dry = cellSpeed(world, cell, false);
  const now = cellSpeed(world, cell, raining, thaw) * slopeFactor(g, w.cargoQty > 0);
  const muddy = surface === 'dirt' && (raining || thaw);
  return { surface, raining, mud: muddy, thaw: muddy && thaw && !raining, factor: now / dry, grade: g };
}

/**
 * The season's effect on a building, for its card (free valley): a farm or fisher working slower in
 * winter (or a farm faster in summer), the castle paying the autumn fair price for beer. A slower
 * producer is not a stall: the consumers downstream stay WAITING_UPSTREAM and point here.
 */
export type SeasonNote =
  | { k: 'YIELD'; season: Season; type: BuildingType; pct: number }
  | { k: 'FAIR'; good: Good; pct: number };

export function seasonNote(world: World, id: number): SeasonNote | null {
  if (!seasonal(world)) return null;
  const b = buildingById(world, id);
  if (!b) return null;
  const tick = world.state.tick, season = seasonAt(tick);
  if (b.type === 'farm' || b.type === 'fisher') {
    const pct = yieldPercentAt(b.type, tick);
    return pct === 100 ? null : { k: 'YIELD', season, type: b.type, pct };
  }
  if (b.type === 'castle' && season === 'autumn' && world.state.mission.contract === null) return { k: 'FAIR', good: AUTUMN_FAIR_GOOD, pct: 125 };
  return null;
}

/**
 * One input shared by consumers of different kinds (mission IX: wood for the sawmill and the
 * charcoal burner). The sim says CONTESTED only while nothing else explains the wait; most of the
 * time a wagon is already on the way or every wagon is busy, which hides the lesson. This is the
 * card's read-only view of the same fact: `id` waits for its input `good` (WAITING_DELIVERY,
 * NO_WAGON, WAITING_UPSTREAM, NO_INPUT except UNREACHABLE) while that good is promised to a
 * consumer of another kind or already held by one. `rival`: the one with most of it held or on
 * the way (`there`, lowest id on ties); `here`: the same count for `id`; `producers` /
 * `consumers`: buildings that make / use the good (granaries excluded). Null when no consumer of
 * another kind holds or awaits the good right now.
 */
export interface SharedInput {
  good: Good;
  rival: number;
  there: number;
  here: number;
  producers: number;
  /** Lowest-id producer of the good, −1 when none. */
  producer: number;
  consumers: number;
}

export function sharedInput(world: World, id: number): SharedInput | null {
  const b = buildingById(world, id);
  if (!b) return null;
  const s = b.status;
  let g: Good;
  if (s.k === 'WAITING_DELIVERY' || s.k === 'NO_WAGON' || s.k === 'WAITING_UPSTREAM') g = s.good;
  else if (s.k === 'NO_INPUT' && s.cause !== 'UNREACHABLE') g = s.good;
  else return null;
  if (!inputGoods(b.type).includes(g)) return null;
  let rival = -1, there = 0, producers = 0, producer = -1, consumers = 1;
  for (const o of world.state.buildings) {
    if (o.id === b.id) continue;
    if (outputGoods(o.type).includes(g)) { producers++; if (producer < 0) producer = o.id; }
    if (!inputGoods(o.type).includes(g)) continue;
    consumers++;
    if (o.type === b.type) continue;
    const n = o.incoming[g] + o.stock[g];
    if (n > there) { there = n; rival = o.id; }
  }
  if (rival < 0) return null;
  return { good: g, rival, there, here: b.incoming[g] + b.stock[g], producers, producer, consumers };
}

/** A consumer's input arrives in a thin load because its supplier cannot keep up (mission X, D-47). */
export interface ThinDelivery {
  good: Good;
  wagon: number;
  /** Units on the way in this load, and a full load of this good. */
  qty: number;
  full: number;
  /** The producing building the load comes from. */
  source: number;
}

/**
 * Read-only (never called by step(), so no hash changes): the building waits for a delivery that is a
 * small part of a wagon load and comes from a producer, i.e. the supplier had no more to give. Then
 * "wood on the way" is true but hides the real cause — the woodcutter cannot keep up.
 */
export function thinDelivery(world: World, id: number): ThinDelivery | null {
  const b = buildingById(world, id);
  if (!b || b.status.k !== 'WAITING_DELIVERY') return null;
  const g = b.status.good, wid = b.status.wagon;
  if (!inputGoods(b.type).includes(g)) return null;
  const w = world.state.wagons.find((q) => q.id === wid);
  const j = w?.job;
  if (!w || !j || j.to !== b.id || j.good !== g) return null;
  const src = buildingById(world, j.from);
  if (!src || !outputGoods(src.type).includes(g)) return null; // a granary sending little is not a shortage
  const full = capacityOf(g);
  if (j.qty * 2 > full) return null; // half a load or more is a normal run
  return { good: g, wagon: w.id, qty: j.qty, full, source: src.id };
}

