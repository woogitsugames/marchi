// Simulation entry points: create, step, save/load, invariants.
import { BUILDINGS, capacityOf, DISPATCH_INTERVAL, GOODS, STATE_VERSION, TICK_HZ, TRAFFIC_DECAY_TICKS, emptyGoods, inputGoods, outputGoods } from './defs';
import { applyCommand, type Command, type CommandResult } from './commands';
import { hashState } from './hash';
import { dispatch } from './logistics';
import { contractsOf, trancheCovered } from './contract';
import { explainBuilding } from './diagnose';
import { buildMission, missionSeasons, terrainFor } from './missions';
import type { World } from './network';
import { stepWagons } from './wagons';
import { stepTown } from './town';
import { EVENT_CHECK_TICKS, stepValleyEvents } from './events';
import { cycleTicks } from './seasons';
import { MARKET } from './defs';
import type { GoodMap, SimState } from './types';

export type { World } from './network';

export function createWorld(missionId: string, seed?: number): World {
  const { terrain, state } = buildMission(missionId, seed);
  return { terrain, state, cache: null, scratch: null, seasons: missionSeasons(state.mission.id) };
}

/**
 * Rebuild a world from a saved state (terrain is regenerated from mapId + seed, the seasonal flag
 * from the mission definition: an old free-valley save gets seasons at the date its tick implies).
 */
export function worldFromState(state: SimState): World {
  return { terrain: terrainFor(state.mapId, state.seed), state, cache: null, scratch: null, seasons: missionSeasons(state.mission.id) };
}

export function serialize(world: World): string {
  return JSON.stringify(world.state);
}

export function deserialize(json: string): World {
  const state = JSON.parse(json) as SimState;
  if (state.version !== STATE_VERSION) throw new Error(`Unsupported state version ${state.version}`);
  return worldFromState(state);
}

export function stateHash(world: World): string {
  return hashState(world.state);
}

export function command(world: World, cmd: Command): CommandResult {
  return applyCommand(world, cmd);
}

/** Advance exactly one fixed tick. */
export function step(world: World): void {
  const st = world.state;
  world.queue = null; // derived penalties must not depend on reads made between ticks (UI ETAs)
  stepWagons(world);
  produce(world);
  if (st.tick % DISPATCH_INTERVAL === 0) dispatch(world);
  if (st.tick > 0 && st.tick % TRAFFIC_DECAY_TICKS === 0) {
    for (let i = 0; i < st.traffic.length; i++) if (st.traffic[i]) st.traffic[i] = st.traffic[i]! >> 1;
  }
  checkMission(world);
  stepTown(world);
  if (st.valleyEvents && st.tick % EVENT_CHECK_TICKS === 0) stepValleyEvents(world);
  if (st.tick % TICK_HZ === 0 && st.mission.result === 'running') accountStalls(world);
  for (const b of st.buildings) {
    const k = b.status.k;
    b.stalledTicks = k === 'WORKING' || k === 'IDLE' || k === 'CONTRACT_DONE' || k === 'WAITING_DELIVERY' || k === 'WAITING_UPSTREAM' || k === 'WAGON_DUE' ? 0 : b.stalledTicks + 1;
  }
  st.tick++;
}

function produce(world: World): void {
  const st = world.state;
  for (const b of st.buildings) {
    const def = BUILDINGS[b.type];
    const r = def.recipe;
    if (!r) continue;
    if (b.progress >= 0) {
      b.progress++;
      // seasons (free valley) stretch or shorten the cycle of farms and fishers; progress carries
      // over a season change, so an interrupted cycle completes exactly once
      if (b.progress >= cycleTicks(world, b.type, r.ticks)) {
        for (const g of outputGoods(b.type)) {
          const n = r.outputs[g] ?? 0;
          b.stock[g] += n;
          st.ledger.produced[g] += n;
        }
        b.progress = -1;
      }
    }
    if (b.progress < 0) {
      // start the next cycle right away when inputs and output space allow
      let ok = true;
      for (const g of inputGoods(b.type)) if (b.stock[g] < (r.inputs[g] ?? 0)) ok = false;
      for (const g of outputGoods(b.type)) if (b.stock[g] + (r.outputs[g] ?? 0) > def.outCap) ok = false;
      if (!ok) continue;
      for (const g of inputGoods(b.type)) {
        const n = r.inputs[g] ?? 0;
        b.stock[g] -= n;
        st.ledger.consumed[g] += n;
      }
      b.progress = 0;
      b.status = { k: 'WORKING' };
    }
  }
}

const NOT_STALL = new Set(['WORKING', 'IDLE', 'CONTRACT_DONE', 'WAITING_DELIVERY', 'WAITING_UPSTREAM', 'WAGON_DUE']);
/** Ignore blips shorter than this (seconds) before charging a cause. */
const STALL_GRACE_TICKS = 2 * TICK_HZ;

/** Once per sim second: charge one second to every distinct root cause currently stalling something. */
function accountStalls(world: World): void {
  const st = world.state;
  const roots = new Set<string>();
  for (const b of st.buildings) {
    if (NOT_STALL.has(b.status.k) || b.stalledTicks < STALL_GRACE_TICKS) continue;
    const chain = explainBuilding(world, b.id);
    // root = deepest link that is itself a stall (a working supplier at the end is not the cause)
    let root = chain[0];
    for (const l of chain) {
      const stalled = l.kind === 'building' ? !NOT_STALL.has(l.status.k) : l.status.k === 'BRIDGE_JAM' || l.status.k === 'NO_ROUTE' || l.status.k === 'BRIDGE_CLOSED';
      if (stalled) root = l;
    }
    if (!root) continue;
    // a wagon held at a bridge is one cause per span (the loop below charges the same key), not
    // one per wagon: a single frozen or jammed crossing must not split into several ledger rows
    // (docs/design/seasons.md §3). Every world, contract letters included (D-34, D-44).
    if (root.kind === 'wagon' && (root.status.k === 'BRIDGE_CLOSED' || root.status.k === 'BRIDGE_JAM')) roots.add(`span:${root.status.span}:${root.status.k}`);
    else roots.add(`${root.kind}:${root.id}:${statusKey(root.status)}`);
  }
  for (const w of st.wagons) {
    if (w.status.k === 'BRIDGE_JAM' && st.tick - w.status.since >= STALL_GRACE_TICKS) roots.add(`span:${w.status.span}:BRIDGE_JAM`);
    else if (w.status.k === 'BRIDGE_CLOSED' && st.tick - w.status.since >= STALL_GRACE_TICKS) roots.add(`span:${w.status.span}:BRIDGE_CLOSED`);
    else if (w.status.k === 'NO_ROUTE' && st.tick - w.status.since >= STALL_GRACE_TICKS && w.job) roots.add(`wagon:${w.id}:NO_ROUTE`);
  }
  const acc = st.ledger.stallSeconds;
  for (const r of [...roots].sort()) acc[r] = (acc[r] ?? 0) + 1;
}

function statusKey(s: { k: string; cause?: string }): string {
  return s.cause ? `${s.k}.${s.cause}` : s.k;
}

/** Top root causes by seconds lost, for the end-of-mission letter. */
export function topStallCauses(world: World, n = 3): { kind: string; id: number; status: string; seconds: number }[] {
  return Object.entries(world.state.ledger.stallSeconds)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, n)
    .map(([key, seconds]) => {
      const [kind, id, status] = key.split(':');
      return { kind: kind!, id: Number(id), status: status!, seconds };
    });
}

function checkMission(world: World): void {
  const st = world.state, m = st.mission;
  if (!m.contract || m.result !== 'running') return;
  // EXPERIMENTAL (two castles, research 2026-11-07): every castle's order is checked the same way; the mission is
  // won when all are complete and lost at the main contract's deadline. One castle: exactly the old check.
  let done = true;
  for (const c of contractsOf(m)) {
    const castle = st.buildings.find((b) => b.id === c.castle);
    if (!castle) return;
    // waybill: tranches complete in order; a passed deadline marks a tranche missed (delivery still counts)
    for (let i = 0; i < c.tranches.length; i++) {
      const tr = c.tranches[i]!;
      if (tr.doneTick >= 0) continue;
      if (trancheCovered(c, i, castle.stock)) { tr.doneTick = st.tick; continue; }
      if (!tr.missed && st.tick >= tr.deadlineTick) tr.missed = true;
      break;
    }
    for (const g of GOODS) if (castle.stock[g] < c.need[g]) done = false;
  }
  if (done) {
    m.result = 'won';
    m.endTick = st.tick;
  } else if (st.tick >= m.contract.deadlineTick) {
    m.result = 'lost';
    m.endTick = st.tick;
  }
}

/** Seals: by finishing time, minus one per tranche delivered late (never below 1 for a win). */
export function stars(world: World): number {
  const m = world.state.mission;
  if (m.result !== 'won' || !m.contract) return 0;
  const base = m.endTick <= m.contract.star3Tick ? 3 : m.endTick <= m.contract.star2Tick ? 2 : 1;
  let missed = 0;
  for (const c of contractsOf(m)) for (const t of c.tranches) if (t.missed) missed++;
  return Math.max(1, base - missed);
}

// --- Invariants ---------------------------------------------------------------

export interface GoodsBalance {
  produced: GoodMap;
  consumed: GoodMap;
  destroyed: GoodMap;
  inStock: GoodMap;
  onWagons: GoodMap;
}

export function goodsBalance(world: World): GoodsBalance {
  const st = world.state;
  const inStock = emptyGoods(), onWagons = emptyGoods();
  for (const b of st.buildings) for (const g of GOODS) inStock[g] += n0(b.stock[g]);
  for (const w of st.wagons) if (w.cargoGood) onWagons[w.cargoGood] += w.cargoQty;
  return { produced: st.ledger.produced, consumed: st.ledger.consumed, destroyed: st.ledger.destroyed, inStock, onWagons };
}

/** A good count that may be missing (the save gate checks pre-v5 states, which lack the newer goods). */
function n0(v: number | undefined): number {
  return v ?? 0;
}

/** Returns a list of violated invariants (empty = all good). Iterates every good in GOODS. */
export function checkInvariants(world: World): string[] {
  const st = world.state;
  const errs: string[] = [];
  const bal = goodsBalance(world);
  for (const g of GOODS) {
    const lhs = n0(bal.produced[g]) - n0(bal.consumed[g]) - n0(bal.destroyed[g]);
    const rhs = bal.inStock[g] + bal.onWagons[g];
    if (lhs !== rhs) errs.push(`conservation ${g}: produced-consumed-destroyed=${lhs} but stock+cargo=${rhs}`);
  }
  // fleet numbers arrived with state v7 (D-44): unique, below the counter
  if (st.nextWagonN !== undefined) {
    const seen = new Set<number>();
    for (const w of st.wagons) {
      if (!(w.n >= 1 && w.n < st.nextWagonN)) errs.push(`wagon ${w.id} number ${w.n} outside 1..${st.nextWagonN - 1}`);
      if (seen.has(w.n)) errs.push(`wagon number ${w.n} used twice`);
      seen.add(w.n);
    }
  }
  // market fields arrived with state v4; the save gate runs this on older states before migrating
  if (st.market && st.ledger.sold) for (const g of GOODS) {
    if (n0(st.ledger.sold[g]) > n0(st.ledger.consumed[g])) errs.push(`ledger sold ${g}=${st.ledger.sold[g]} > consumed ${st.ledger.consumed[g]}`);
    const sat = n0(st.market.saturation[g]);
    if (sat < 0 || sat > MARKET.cap) errs.push(`market saturation ${g}=${sat} outside 0..${MARKET.cap}`);
  }
  if (st.market && (st.market.cents < 0 || st.market.cents > 99)) errs.push(`market cents ${st.market.cents} outside 0..99`);
  // reservations must match active jobs exactly
  const resOut = new Map<string, number>(), inc = new Map<string, number>();
  for (const w of st.wagons) {
    if (w.cargoQty < 0) errs.push(`wagon ${w.id} negative cargo`);
    if (w.cargoQty > 0 && !w.cargoGood) errs.push(`wagon ${w.id} cargo without good`);
    if (w.cargoGood && w.cargoQty > capacityOf(w.cargoGood)) errs.push(`wagon ${w.id} carries ${w.cargoQty} ${w.cargoGood} > capacity ${capacityOf(w.cargoGood)}`);
    const j = w.job;
    if (!j) {
      if (w.cargoQty > 0) errs.push(`wagon ${w.id} has cargo but no job`);
      continue;
    }
    if (j.phase === 'pickup') {
      if (w.cargoQty !== 0) errs.push(`wagon ${w.id} loaded before pickup`);
      resOut.set(j.from + ':' + j.good, (resOut.get(j.from + ':' + j.good) ?? 0) + j.qty);
    } else if (w.cargoQty !== j.qty || w.cargoGood !== j.good) {
      errs.push(`wagon ${w.id} cargo ${w.cargoQty} ${w.cargoGood} != job ${j.qty} ${j.good}`);
    }
    if (j.to >= 0) inc.set(j.to + ':' + j.good, (inc.get(j.to + ':' + j.good) ?? 0) + j.qty);
  }
  for (const b of st.buildings) {
    for (const g of GOODS) {
      const stock = n0(b.stock[g]), res = n0(b.reservedOut[g]), incoming = n0(b.incoming[g]);
      if (stock < 0) errs.push(`building ${b.id} negative stock ${g}`);
      if (res !== (resOut.get(b.id + ':' + g) ?? 0)) errs.push(`building ${b.id} reservedOut ${g}=${res} != jobs ${resOut.get(b.id + ':' + g) ?? 0}`);
      if (incoming !== (inc.get(b.id + ':' + g) ?? 0)) errs.push(`building ${b.id} incoming ${g}=${incoming} != jobs ${inc.get(b.id + ':' + g) ?? 0}`);
      if (res > stock) errs.push(`building ${b.id} reserved ${g} more than stock`);
    }
  }
  return errs;
}

/** Every non-working building and every non-moving wagon must expose a reason. */
export function unexplainedStalls(world: World): string[] {
  const out: string[] = [];
  for (const b of world.state.buildings) {
    if (!b.status || !b.status.k) out.push(`building ${b.id} has no status`);
    if (b.status.k === 'IDLE' && BUILDINGS[b.type].recipe && b.progress < 0) out.push(`producer ${b.id} (${b.type}) idle without reason`);
  }
  for (const w of world.state.wagons) {
    if (!w.status || !w.status.k) out.push(`wagon ${w.id} has no status`);
    if (w.next < 0 && w.busyTicks === 0 && w.job && w.status.k !== 'NO_ROUTE' && w.status.k !== 'BRIDGE_JAM' && w.status.k !== 'BRIDGE_CLOSED' && w.status.k !== 'TO_PICKUP' && w.status.k !== 'TO_DROPOFF') {
      out.push(`wagon ${w.id} with job stands still as ${w.status.k}`);
    }
  }
  return out;
}
