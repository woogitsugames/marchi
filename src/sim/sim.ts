// Simulation entry points: create, step, save/load, invariants.
import { BUILDINGS, DISPATCH_INTERVAL, GOODS, STATE_VERSION, TRAFFIC_DECAY_TICKS, emptyGoods, inputGoods, outputGoods } from './defs';
import { applyCommand, type Command, type CommandResult } from './commands';
import { hashState } from './hash';
import { dispatch } from './logistics';
import { buildMission, terrainFor } from './missions';
import type { World } from './network';
import { stepWagons } from './wagons';
import type { GoodMap, SimState } from './types';

export type { World } from './network';

export function createWorld(missionId: string, seed?: number): World {
  const { terrain, state } = buildMission(missionId, seed);
  return { terrain, state, cache: null, scratch: null };
}

/** Rebuild a world from a saved state (terrain is regenerated from mapId + seed). */
export function worldFromState(state: SimState): World {
  return { terrain: terrainFor(state.mapId, state.seed), state, cache: null, scratch: null };
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
  for (const b of st.buildings) {
    const k = b.status.k;
    b.stalledTicks = k === 'WORKING' || k === 'IDLE' || k === 'CONTRACT_DONE' || k === 'WAITING_DELIVERY' || k === 'WAITING_UPSTREAM' ? 0 : b.stalledTicks + 1;
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
      if (b.progress >= r.ticks) {
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

function checkMission(world: World): void {
  const st = world.state, m = st.mission;
  if (!m.contract || m.result !== 'running') return;
  const castle = st.buildings.find((b) => b.id === m.contract!.castle);
  if (!castle) return;
  let done = true;
  for (const g of GOODS) if (castle.stock[g] < m.contract.need[g]) done = false;
  if (done) {
    m.result = 'won';
    m.endTick = st.tick;
  } else if (st.tick >= m.contract.deadlineTick) {
    m.result = 'lost';
    m.endTick = st.tick;
  }
}

export function stars(world: World): number {
  const m = world.state.mission;
  if (m.result !== 'won' || !m.contract) return 0;
  if (m.endTick <= m.contract.star3Tick) return 3;
  if (m.endTick <= m.contract.star2Tick) return 2;
  return 1;
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
  for (const b of st.buildings) for (const g of GOODS) inStock[g] += b.stock[g];
  for (const w of st.wagons) if (w.cargoGood) onWagons[w.cargoGood] += w.cargoQty;
  return { produced: st.ledger.produced, consumed: st.ledger.consumed, destroyed: st.ledger.destroyed, inStock, onWagons };
}

/** Returns a list of violated invariants (empty = all good). */
export function checkInvariants(world: World): string[] {
  const st = world.state;
  const errs: string[] = [];
  const bal = goodsBalance(world);
  for (const g of GOODS) {
    const lhs = bal.produced[g] - bal.consumed[g] - bal.destroyed[g];
    const rhs = bal.inStock[g] + bal.onWagons[g];
    if (lhs !== rhs) errs.push(`conservation ${g}: produced-consumed-destroyed=${lhs} but stock+cargo=${rhs}`);
  }
  // reservations must match active jobs exactly
  const resOut = new Map<string, number>(), inc = new Map<string, number>();
  for (const w of st.wagons) {
    if (w.cargoQty < 0) errs.push(`wagon ${w.id} negative cargo`);
    if (w.cargoQty > 0 && !w.cargoGood) errs.push(`wagon ${w.id} cargo without good`);
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
      if (b.stock[g] < 0) errs.push(`building ${b.id} negative stock ${g}`);
      if (b.reservedOut[g] !== (resOut.get(b.id + ':' + g) ?? 0)) errs.push(`building ${b.id} reservedOut ${g}=${b.reservedOut[g]} != jobs ${resOut.get(b.id + ':' + g) ?? 0}`);
      if (b.incoming[g] !== (inc.get(b.id + ':' + g) ?? 0)) errs.push(`building ${b.id} incoming ${g}=${b.incoming[g]} != jobs ${inc.get(b.id + ':' + g) ?? 0}`);
      if (b.reservedOut[g] > b.stock[g]) errs.push(`building ${b.id} reserved ${g} more than stock`);
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
    if (w.next < 0 && w.busyTicks === 0 && w.job && w.status.k !== 'NO_ROUTE' && w.status.k !== 'BRIDGE_JAM' && w.status.k !== 'TO_PICKUP' && w.status.k !== 'TO_DROPOFF') {
      out.push(`wagon ${w.id} with job stands still as ${w.status.k}`);
    }
  }
  return out;
}
