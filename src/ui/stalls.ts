// Ranking of the stalls on the map for the HUD (D-43): the "worst stall" card, the alarm seal that
// cycles through them, the red / brass pins and the tool that cures the worst one. Read-only:
// statuses, stalledTicks and the cause chains come from the sim; nothing here writes state.
import { BUILDINGS, MISSIONS, TICK_HZ, contractsOf, outputGoods, reachable, suggestConnection, suggestLinkToStable, demolishQuote, WAGON_PRICE, busyOutOfReach, findPath, roadCellCost, inputGoods, canSurface, canPlace, cycleTicks, rankGated, net, validateRoad, buildingById, contractFilled, explainBuilding, granaryRelief, missionBuildable, outputCustomer, outputSurplus, seasonalSupplier, sharedInput, stoneInStore, topStallCauses, type Building, type BuildingType, type Good, type ReasonLink, type RoadSuggestion, type World } from '../sim/index';
import { freshGranary, granaryFilling, granaryLoads, granaryUnwanted, isCritical, isStall, isWagonWait } from './stallKinds';
export { freshGranary, granaryFilling, granaryLoads, granaryUnwanted, marketTakesLoad, postWouldTake } from './stallKinds';
import { bottleneckFor, bottleneckKey, sampleBottleneck } from './bottleneck';
import { siteAnchor } from './site';
import { memoryWorld } from './readWorld';

/**
 * Free valley (research 2026-11-04, valley-3h proposal 2): a full granary that holds at least one wagon load
 * of a good the castle market buys is not short of room but of wagons — the market loop serves the dearest
 * goods first (75 % of the fleet), so cheap wood waits there forever. Another granary fills up as well;
 * a wagon empties it. Pure read.
 */
export function clogNeedsWagon(world: World, granaryId: number): boolean {
  return granaryLoads(world, granaryId) === 'wagon';
}

// marketTakesLoad / granaryLoads live in stallKinds.ts (the status title reads them, D-180)

/** A full granary (or a producer refused by one) whose loads no market takes now (D-174). */
export function marketSaturated(world: World, b: Building): boolean {
  const s = b.status;
  if (s.k === 'STORAGE_FULL') return granaryLoads(world, b.id) === 'saturated';
  if (s.k === 'OUTPUT_FULL' && s.cause === 'NO_DESTINATION' && s.blockedBy >= 0) {
    const g = buildingById(world, s.blockedBy);
    return !!g && g.status.k === 'STORAGE_FULL' && granaryLoads(world, g.id) === 'saturated';
  }
  return false;
}

/**
 * D-630: a full granary (or a producer refused by one) whose only market loads the next dispatch books — a wagon
 * without a job is ready and the market has a slot: room is coming within half a second. Pure read.
 */
export function granaryPending(world: World, b: Building): boolean {
  const s = b.status;
  if (s.k === 'STORAGE_FULL') return granaryLoads(world, b.id) === 'pending';
  if (s.k === 'OUTPUT_FULL' && s.cause === 'NO_DESTINATION' && s.blockedBy >= 0) {
    const g = buildingById(world, s.blockedBy);
    return !!g && g.status.k === 'STORAGE_FULL' && granaryLoads(world, g.id) === 'pending';
  }
  return false;
}

/** 2 s: no pin or card for a short hiccup. */
export const MIN_STALL_TICKS = 20;

/** Weight of a stall in the ranking: critical (nothing on the way to fix it) beats a long wait. */
const W_CRIT = 3, W_NORMAL = 1, W_MINOR = 0.25;

/** The tool that fixes the root of a stall chain (the HUD highlights that tool card). */
export type Cure = 'wagon' | 'road' | 'granary' | 'producer' | 'pave' | 'demolish' | null;

export interface StallEntry {
  id: number;
  ticks: number;
  crit: boolean;
  /** Resolves by itself: output waiting for a pickup or a customer that still takes it, a season. */
  minor: boolean;
  score: number;
}

/**
 * A stall that resolves by itself (output waits for a customer that still takes it, input slowed by
 * the season, a surplus nobody needs right now, a full granary next to one with room, the rest of a filled
 * order — audit 2026-11-03 fixes 1, 3, 6): a minor pin, never the
 * critical one. outputCustomer runs a path search, so the answer is kept per building until its
 * status, the road network or the second changes.
 */
// per world (D-592): two worlds with the same building id, status and second shared one answer
const calmCaches = new WeakMap<World, Map<number, { key: string; calm: boolean }>>();
export function calmStall(world: World, b: Building, sig: string): boolean {
  // D-630: the fleet size too — a wagon bought in the same tick makes a granary load "pending" (granaryPending)
  const key = `${sig}|${world.state.netVersion}|${world.state.buildings.length}|${world.state.wagons.length}|${Math.floor(world.state.tick / 10)}`;
  let calmCache = calmCaches.get(world);
  if (!calmCache) calmCaches.set(world, (calmCache = new Map()));
  const c = calmCache.get(b.id);
  if (c && c.key === key) return c.calm;
  // the trading post waiting for its road (D-170): the player may not want it; a brass pin, never a red card
  const calm = b.type === 'tradePost' || chainSwitchStall(world, b) || outputCustomer(world, b.id) >= 0 || seasonalSupplier(world, b.id) !== null || outputSurplus(world, b.id) !== null ||
    granaryRelief(world, b.id)?.k === 'ROOM' || yardStoreRoom(world, b) >= 0 || contractFilled(world, b.id) !== null || inputOrderFilled(world, b) || starvedForGood(world, b) || stoneInStore(world, b.id) > 0 ||
    marketSaturated(world, b) || granaryPending(world, b) || granaryUnwanted(world, b.id) || granaryFilling(world, b.id) || freshGranary(world, b) >= 0;
  calmCache.set(b.id, { key, calm });
  return calm;
}

/**
 * D-614: a workshop short of its input whose every product the castles already hold in full, and which no other
 * building uses as an input (mission XIII's sawmill once the planks are in and the granary's wood is gone): nothing
 * needs it any more — calm "zamówienie wypełnione", not a red card with nothing to press. Missions only. Pure read.
 */
export function inputOrderFilled(world: World, b: Building): boolean {
  if (b.status.k !== 'NO_INPUT') return false;
  const m = world.state.mission;
  if (!m.contract || m.result !== 'running') return false;
  const outs = outputGoods(b.type);
  if (!outs.length) return false;
  const orders = contractsOf(m);
  let ordered = false;
  for (const g of outs) {
    for (const k of orders) {
      if (k.need[g] <= 0) continue;
      ordered = true;
      if ((buildingById(world, k.castle)?.stock[g] ?? 0) < k.need[g]) return false;
    }
    if (world.state.buildings.some((q) => q.type !== 'warehouse' && q.type !== 'castle' && inputGoods(q.type).includes(g))) return false;
  }
  return ordered;
}

/**
 * D-610: mission XVII — a workshop short of the shared input because a workshop of another castle's chain takes it
 * (NO_INPUT.CONTESTED at the even split or with the castle leg only, NO_INPUT.CHAIN_FIRST with the other chain first).
 * Its cure is the castles' chain switch, not anything on this workshop: a brass pin, so the castle pace card (late
 * castle, rival, the switch on its sheet) keeps the HUD slot instead of a red card with nothing to press. Only in a
 * mission with `chainPriority`; the waiting workshop's own sheet still names the rival. Pure read.
 */
export function chainSwitchStall(world: World, b: Building): boolean {
  const s = b.status;
  if (s.k !== 'NO_INPUT') return false;
  const m = world.state.mission;
  if (!m.extraContracts || m.result !== 'running' || !MISSIONS[m.id]?.chainPriority) return false;
  // ...and the castle (or workshop) that has nothing to fetch because its producer is that workshop
  if (s.cause === 'NONE_AVAILABLE') {
    const p = buildingById(world, s.blockedBy);
    return !!p && p.id !== b.id && p.status.k === 'NO_INPUT' && p.status.cause !== 'NONE_AVAILABLE' && chainSwitchStall(world, p);
  }
  if (s.cause !== 'CONTESTED' && s.cause !== 'CHAIN_FIRST') return false;
  const rival = buildingById(world, s.blockedBy);
  return !!rival && rival.type !== b.type && inputGoods(rival.type).includes(s.good);
}

/**
 * A stall with nothing to do about it, for the HUD card's wording (audit 2026-11-03): 'surplus' — a full
 * yard nobody needs right now (fix 1); 'storeRoom' — a full granary while another one has room (fix 3);
 * 'orderFilled' — the contract castle already holds this whole good (fix 6).
 * null: the status text says it right.
 */
export type CalmWhy = 'surplus' | 'storeRoom' | 'yardRoom' | 'orderFilled' | 'stoneStored' | 'postNoRoad' | 'marketFull' | 'unwanted' | 'filling' | 'granaryFilling' | null;
export function calmWhy(world: World, b: Building): CalmWhy {
  // D-170: the trading post across the river waits for a road with a bridge (cause.postNoRoad)
  if (b.type === 'tradePost' && b.status.k === 'NO_ROAD') return 'postNoRoad';
  if (outputSurplus(world, b.id) === 'SPARE') return 'surplus';
  if (granaryRelief(world, b.id)?.k === 'ROOM') return 'storeRoom';
  // D-592: a full yard refused by a full granary while another one has room (the next dispatch sends it there)
  if (yardStoreRoom(world, b) >= 0) return 'yardRoom';
  // D-451: a saturated market outranks both D-393 waits below — the sheet's title ("rynek nasycony") and hint
  // (sell another good) say so, and the card must not promise that waiting for loads or a fresh granary helps
  const saturated = marketSaturated(world, b);
  // D-393: a free-valley granary "full" of loads still on the way (a fresh one reads 0 in stock)
  if (!saturated && granaryFilling(world, b.id)) return 'filling';
  // D-393: a full yard while a fresh granary takes its first loads
  if (!saturated && freshGranary(world, b) >= 0) return 'granaryFilling';
  if (contractFilled(world, b.id) || inputOrderFilled(world, b)) return 'orderFilled';
  // D-95: the granary already holds stone to pave with (mission VIII's quarry)
  if (stoneInStore(world, b.id) > 0) return 'stoneStored';
  // D-174: the markets take no more of what the granary holds; another wagon would only wait
  if (saturated) return 'marketFull';
  // D-212: a granary full of goods nothing wants now (mission XV's fish)
  if (granaryUnwanted(world, b.id)) return 'unwanted';
  return null;
}

/**
 * Calm seconds per ledger root (D-335): once per sim second, every root the ledger charged since the last look is
 * judged — a building still in the charged status that reads calm with nothing to do about it (`calmWhy`: a granary
 * full of goods nobody wants, a spare yard, a full granary next to one with room, ...) adds those seconds to `calm`.
 * `seen` counts every charged second the sampler watched, so a game loaded mid-way knows which part it did not see.
 * Called every tick from App.onTick, next to sampleInputWaits. Pure read of the sim.
 */
interface CalmLog { tick: number; prev: Record<string, number>; seen: Record<string, number>; calm: Record<string, number> }
const calmLogs = new WeakMap<World, CalmLog>();
export function sampleCalmCosts(world: World): void {
  const st = world.state;
  if (st.tick % TICK_HZ !== 0) return;
  let log = calmLogs.get(world);
  // a new world, or a loaded one (tick went back): start over, taking the ledger as found — those seconds were not watched
  const fresh = !log || st.tick < log.tick;
  if (!log || fresh) { log = { tick: st.tick, prev: {}, seen: {}, calm: {} }; calmLogs.set(world, log); }
  else if (st.tick === log.tick) return;
  log.tick = st.tick;
  const ledger = st.ledger.stallSeconds;
  for (const key in ledger) {
    const now = ledger[key]!, grew = now - (log.prev[key] ?? 0);
    log.prev[key] = now;
    if (fresh || grew <= 0) continue;
    log.seen[key] = (log.seen[key] ?? 0) + grew;
    if (calmRoot(world, key)) log.calm[key] = (log.calm[key] ?? 0) + grew;
  }
}

/** The statuses accountStalls (sim.ts) never charges; everything else, held past its grace, is a stall there. */
const LEDGER_NOT_STALL = new Set(['WORKING', 'IDLE', 'CONTRACT_DONE', 'WAITING_DELIVERY', 'WAITING_UPSTREAM', 'WAGON_DUE']);
const LEDGER_GRACE_TICKS = 2 * TICK_HZ;

/**
 * A ledger key ('building:7:STORAGE_FULL') that is a calm second now: its building still stands in that status, reads
 * calm with nothing to do about it, and no other building whose stall is not calm hangs on it. XV's fish store is calm
 * alone from 0:02, but from ~0:44 the woodcutters it refuses are charged to it too — those seconds stay a cost, and the
 * letter keeps "build a granary" (D-212's advice) with the time the woodcutters really stood.
 */
function calmRoot(world: World, key: string): boolean {
  const [kind, id, status] = key.split(':');
  if (kind !== 'building') return false;
  const root = buildingById(world, Number(id));
  if (!root) return false;
  const s = root.status as { k: string; cause?: string };
  if ((s.cause ? `${s.k}.${s.cause}` : s.k) !== status || calmWhy(world, root) === null) return false;
  for (const d of world.state.buildings) {
    if (d.id === root.id || LEDGER_NOT_STALL.has(d.status.k) || d.stalledTicks < LEDGER_GRACE_TICKS) continue;
    if (calmWhy(world, d) !== null) continue;
    if (explainBuilding(world, d.id).some((l) => l.kind === 'building' && l.id === root.id)) return false;
  }
  return true;
}

/**
 * The loss letter's "three costs" (D-335, BACKLOG P3 from D-212): the ledger's root causes by seconds lost, minus the
 * seconds they read calm with nothing to do about them (sampleCalmCosts); seconds the sampler did not watch (a game
 * loaded mid-way, a headless run) are judged by the root's reading now. Wagons and spans are never calm. The pickup
 * on its way and the season stay costs: too few wagons is a real cause. Pure read.
 */
export function lossCauses(world: World, n = 3, minSeconds = 5): ReturnType<typeof topStallCauses> {
  const log = calmLogs.get(memoryWorld(world));
  const rows: [string, number][] = [];
  for (const [key, seconds] of Object.entries(world.state.ledger.stallSeconds)) {
    const seen = Math.min(seconds, log?.seen[key] ?? 0);
    const calm = (log?.calm[key] ?? 0) + (seconds > seen && calmRoot(world, key) ? seconds - seen : 0);
    if (seconds - calm >= minSeconds) rows.push([key, seconds - calm]);
  }
  // the ledger's own order (topStallCauses): most seconds first, ties by key
  rows.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return rows.slice(0, n).map(([key, seconds]) => {
    const [kind, id, status] = key.split(':');
    return { kind: kind!, id: Number(id), status: status!, seconds };
  });
}

/**
 * The sheet's calm reading (D-193, owner 2026-11-06 "calm everywhere"): every stall the HUD pins in brass reads calm
 * in its sheet too, not only the ones with a calmWhy — the pickup already on its way (WAITING_PICKUP, while its wagon
 * is not itself held at a bridge or cut off), a full yard whose customer still takes the good, an input the season
 * slows. A shared single producer or a held span is the critical card, never calm.
 */
export function quietStall(world: World, b: Building): boolean {
  if (calmWhy(world, b) !== null) return true;
  if (sharedOneCard(world, b) || heldSpanFor(world, b)) return false;
  if (b.status.k === 'WAITING_PICKUP') {
    const id = b.status.wagon;
    const w = world.state.wagons.find((q) => q.id === id);
    return !w || !isWagonWait(w.status);
  }
  return calmStall(world, b, JSON.stringify(b.status));
}

/**
 * The "Co to znaczy?" fold reads the calm variant of the codex entry for this link (D-98): a building
 * stall with a calm reason (surplus, filled order, granary with room, stone in store) — the same cases
 * the sheet's calm line names, so the fold never advises "Kup wóz" under it.
 */
export function codexCalm(world: World, l: ReasonLink): boolean {
  if (l.kind !== 'building') return false;
  const b = buildingById(world, l.id);
  return !!b && calmWhy(world, b) !== null;
}

/**
 * One producer feeds two (or more) workshops of this input, and the mission lets the player build another one
 * (research 2026-11-04, P5; missions IX, X): the cure is a second producer, not a wagon. sharedInput holds only
 * while the building waits for that input (NO_INPUT, NO_WAGON, WAGON_DUE, WAITING_DELIVERY / _UPSTREAM). Pure read.
 */
export interface SharedOne { producer: number; type: BuildingType; consumers: number }
export function sharedOneProducer(world: World, b: Building): SharedOne | null {
  const sh = sharedInput(world, b.id);
  if (!sh || sh.producers !== 1 || sh.consumers < 2 || sh.producer < 0) return null;
  const p = buildingById(world, sh.producer);
  if (!p) return null;
  const can = missionBuildable(world.state.mission.id);
  if (can === 'ranked' || !can.includes(p.type)) return null;
  return { producer: p.id, type: p.type, consumers: sh.consumers };
}

/**
 * The producer cure of a waiting workshop's sheet: the shared single producer (D-110, missions) or the free valley's
 * bottleneck card (D-171). `producer` is the building to build next to, `type` the one to build.
 */
export interface ProducerCure { producer: number; type: BuildingType; consumers: number; source: 'shared' | 'neck' | 'missing'; good: Good }
export function producerCure(world: World, b: Building): ProducerCure | null {
  const sh = sharedOneProducer(world, b);
  if (sh) return { ...sh, source: 'shared', good: (b.status as { good: Good }).good };
  const mp = missingProducer(world, b);
  if (mp) return mp;
  const n = bottleneckFor(world, b);
  if (!n || !n.good || !n.build) return null;
  return { producer: n.near >= 0 ? n.near : n.focus, type: n.build, consumers: n.consumers, source: 'neck', good: n.good };
}

/**
 * D-615: no building on the map makes the good this building's chain waits for (NO_INPUT.NONE_AVAILABLE with no
 * producer to blame — its last one was taken down, e.g. a charcoal burner rebuilt elsewhere in mission XIV), and the
 * mission's build list has a type that makes it: the cure is that building. The ghost opens by a producer of its own
 * input (the woodcutter for a burner), else by the waiting building. Missions with a build list only (the free
 * valley has its bottleneck card). Pure read.
 */
export function missingProducer(world: World, b: Building): ProducerCure | null {
  const can = missionBuildable(world.state.mission.id);
  if (can === 'ranked' || can.length === 0 || (!isStall(b.status) && b.status.k !== 'NO_INPUT')) return null;
  const chain = explainBuilding(world, b.id, 5, true);
  const links: { id: number; status: Building['status'] }[] = [{ id: b.id, status: b.status }];
  for (const l of chain) if (l.kind === 'building') links.push({ id: l.id, status: l.status });
  for (const l of links) {
    const s = l.status;
    if (s.k !== 'NO_INPUT' || s.cause !== 'NONE_AVAILABLE' || s.blockedBy >= 0) continue;
    const type = can.find((t) => outputGoods(t).includes(s.good));
    if (!type) continue;
    const ins = inputGoods(type);
    const near = world.state.buildings.find((q) => ins.some((g) => outputGoods(q.type).includes(g)));
    return { producer: near ? near.id : l.id, type, consumers: 1, source: 'missing', good: s.good };
  }
  return null;
}

/**
 * The shared-supply card waits until the consumer has waited this long for its input (owner 2026-11-04, D-110):
 * from the first second it gave the lesson away before the player had seen the workshops stand.
 */
export const SHARED_CARD_WAIT_TICKS = 30 * TICK_HZ;

/** Since which tick each building has waited for an input without a break; UI-owned, never in the state. */
interface WaitLog { tick: number; since: Map<number, number> }
const waitLogs = new WeakMap<World, WaitLog>();

/** Waiting for an input good: no stock and none (yet) on the way, no wagon, or a delivery on the way. */
export function waitsForInput(b: Building): boolean {
  const s = b.status;
  if (s.k !== 'WAITING_DELIVERY' && s.k !== 'NO_WAGON' && s.k !== 'WAGON_DUE' && s.k !== 'WAITING_UPSTREAM' && !(s.k === 'NO_INPUT' && s.cause !== 'UNREACHABLE')) return false;
  return inputGoods(b.type).includes(s.good);
}

/**
 * Call once per sim tick (the app's onTick; headless tools right after step()): remembers since when each
 * building has waited for its input. Only in missions that may build a producer (the shared-supply card exists
 * nowhere else). Read-only on the state.
 */
export function sampleInputWaits(world: World): void {
  const st = world.state;
  const can = missionBuildable(st.mission.id);
  // the free valley samples too (D-171): the bottleneck card's eye picks the workshop that has waited longest
  if (can !== 'ranked' && can.length === 0) return;
  if (can === 'ranked') sampleBottleneck(world);
  let log = waitLogs.get(world);
  if (!log || st.tick < log.tick) { log = { tick: st.tick, since: new Map() }; waitLogs.set(world, log); }
  log.tick = st.tick;
  for (const b of st.buildings) {
    if (!waitsForInput(b)) log.since.delete(b.id);
    else if (!log.since.has(b.id)) log.since.set(b.id, st.tick);
  }
}

/** Ticks this building has waited for its input without a break (0 when the world was never sampled). */
export function inputWaitTicks(world: World, b: Building): number {
  const since = waitLogs.get(memoryWorld(world))?.since.get(b.id);
  return since === undefined || !waitsForInput(b) ? 0 : world.state.tick - since;
}

/** The shared-supply card for this building: one producer for two workshops, after 30 s of waiting (D-110). */
export function sharedOneCard(world: World, b: Building): SharedOne | null {
  const sh = sharedOneProducer(world, b);
  return sh && inputWaitTicks(world, b) >= SHARED_CARD_WAIT_TICKS ? sh : null;
}

/**
 * The other workshop takes this one's input (NO_INPUT.CONTESTED) and a second producer would end the contest: the
 * cure is that producer from the first second. D-616 kept it only after the shared-supply card had shown once;
 * D-670 (owner 2026-11-11): also the opening contest of missions IX and X (0:02–0:21) — a red card that names the
 * contest offers "Postaw drwala" at once instead of nothing until the 30 s card (D-110). The card's text stays the
 * contest; the shared-supply card itself still waits 30 s. Missions only (the valley has no shared producer). Pure read.
 */
export function sharedContested(world: World, b: Building): boolean {
  return b.status.k === 'NO_INPUT' && b.status.cause === 'CONTESTED' && !!sharedOneProducer(world, b);
}

/**
 * A wagon of this building's job (pickup here, or delivery here) has stood at a wooden span for 20 s or more —
 * a one-lane jam or ice (research 2026-11-04, P4; missions II, IV). The buildings behind it only "wait for a
 * delivery", which is no stall, so the jam never reached the card. Cure: pave that span in stone (no one-lane
 * rule, ice does not close it), when the surface is allowed here. `cells` is the span in drive order.
 */
export interface HeldSpan { wagon: number; kind: 'BRIDGE_JAM' | 'BRIDGE_CLOSED'; span: number; heldTicks: number; cells: number[] }
export const HELD_SPAN_TICKS = 20 * TICK_HZ;
export function heldSpanFor(world: World, b: Building): HeldSpan | null {
  const own = heldSpanOf(world, b);
  if (own) return own;
  // D-652: a building short of an input its producer waits for (NO_INPUT blamed on it) is held by that producer's
  // wagon too — mission IV: the castle "brak zapasów" behind the sawmill whose wood stood at the ice read critical
  // with nothing to press (up to 87 s) while the sawmill's own card offered the stone bridge. One level only.
  const s = b.status;
  if (s.k !== 'NO_INPUT' || s.cause !== 'NONE_AVAILABLE' || s.blockedBy < 0 || s.blockedBy === b.id) return null;
  const p = buildingById(world, s.blockedBy);
  // (either leg of the producer's job: its input's wagon may be held on the way to the pickup)
  return p ? heldSpanOf(world, p, true) : null;
}

function heldSpanOf(world: World, b: Building, anyLeg = false): HeldSpan | null {
  const st = world.state;
  let best: HeldSpan | null = null;
  for (const w of st.wagons) {
    const s = w.status;
    if (s.k !== 'BRIDGE_JAM' && s.k !== 'BRIDGE_CLOSED') continue;
    const held = st.tick - s.since;
    if (held < HELD_SPAN_TICKS || !w.job) continue;
    if ((w.job.phase === 'pickup' ? w.job.from : w.job.to) !== b.id && !(anyLeg && w.job.to === b.id)) continue;
    if (!best || held > best.heldTicks || (held === best.heldTicks && w.id < best.wagon)) {
      best = { wagon: w.id, kind: s.k, span: s.span, heldTicks: held, cells: [] };
    }
  }
  if (!best || !canSurface(world, 2).ok) return null;
  best.cells = spanCells(world, best.span);
  return best.cells.length ? best : null;
}

/** The cells of a span, ordered end to end (a contiguous list for the road command). */
function spanCells(world: World, span: number): number[] {
  const sp = net(world).span, W = world.terrain.w;
  const set: number[] = [];
  for (let i = 0; i < sp.length; i++) if (sp[i] === span) set.push(i);
  if (set.length < 2) return set;
  const near = (a: number, c: number): boolean => a !== c && Math.abs((a % W) - (c % W)) <= 1 && Math.abs(Math.floor(a / W) - Math.floor(c / W)) <= 1;
  // start at an end (a cell with one neighbour in the span), then walk
  const start = set.find((a) => set.filter((c) => near(a, c)).length <= 1) ?? set[0]!;
  const out = [start];
  const left = new Set(set.filter((c) => c !== start));
  while (left.size) {
    const cur = out[out.length - 1]!;
    let nx = -1;
    for (const c of left) if (near(cur, c) && (nx < 0 || c < nx)) nx = c;
    if (nx < 0) break;
    out.push(nx);
    left.delete(nx);
  }
  return out.length === set.length ? out : [];
}

/** Can the player pave this span now (silver, stone, rank)? The command's own check; read-only. */
export function paveCheck(world: World, h: { cells: number[] }): ReturnType<typeof validateRoad> {
  return validateRoad(world, h.cells, 2);
}

/**
 * Ice ahead (day 8c, D-109 follow-up): the mission's authored ice will close the wooden span the deliveries cross
 * at `startTick`, and a stone bridge there costs `price`. Pure read; one span (the one most producer -> castle
 * trips cross), cached per network version.
 */
export interface IceAhead { span: number; cells: number[]; price: number; startTick: number }
let iceCache: { world: World; key: string; v: IceAhead | null } | null = null;
export function iceAheadSpan(world: World): IceAhead | null {
  const st = world.state;
  const c = st.mission.contract;
  if (!c || st.mission.result !== 'running' || !canSurface(world, 2).ok) return null;
  let start = -1;
  for (const w of st.ice) if (w.start > st.tick && (start < 0 || w.start < start)) start = w.start;
  if (start < 0) return null;
  const key = `${st.netVersion}|${st.buildings.length}|${start}`;
  if (iceCache?.key === key && iceCache.world === world) return iceCache.v;
  const castle = buildingById(world, c.castle);
  const sp = net(world).span;
  const uses = new Map<number, number>();
  if (castle) {
    for (const b of st.buildings) {
      if (b.id === castle.id || !BUILDINGS[b.type].recipe) continue;
      const path = findPath(world, b.gate, castle.gate, true);
      if (!path) continue;
      const crossed = new Set<number>();
      for (const q of path) if (sp[q]! >= 0) crossed.add(sp[q]!);
      for (const k of crossed) uses.set(k, (uses.get(k) ?? 0) + 1);
    }
  }
  let span = -1, most = 0;
  for (const [k, n] of uses) if (n > most || (n === most && k < span)) { span = k; most = n; }
  let v: IceAhead | null = null;
  if (span >= 0) {
    const cells = spanCells(world, span);
    let price = 0;
    for (const q of cells) price += roadCellCost(world, q, 2);
    if (cells.length) v = { span, cells, price, startTick: start };
  }
  iceCache = { world, key, v };
  return v;
}

/**
 * "Kup wóz" yields to the span (day 8c): before the ice, when one more wagon would leave too little silver for the
 * stone bridge that the player can still afford now. Generic: any contract with authored ice on a crossed span.
 */
export function iceBeforeWagon(world: World): IceAhead | null {
  const ice = iceAheadSpan(world);
  if (!ice) return null;
  const coins = world.state.coins;
  return coins >= ice.price && coins - WAGON_PRICE < ice.price ? ice : null;
}

/** The span a 'pave' cure lays in stone: a wagon held there now, or the ice ahead when it outranks a wagon. */
export function paveSpanFor(world: World, b: Building): { cells: number[]; held: HeldSpan | null; ice: IceAhead | null } | null {
  const held = heldSpanFor(world, b);
  if (held) return { cells: held.cells, held, ice: null };
  if (cureFor(world, b.id) !== 'pave') return null;
  const ice = iceBeforeWagon(world);
  return ice ? { cells: ice.cells, held: null, ice } : null;
}

/**
 * D-390: the pave cure's span needs paving stone and no quarry stands to dig it (free valley seed 1304: no rock by the
 * castle, so the rank card never offered one) — the sheet's grey "Wyłóż most kamieniem" would stay the card's only
 * cure for good. Instead the sheet offers the quarry: the building it opens the ghost by (this building, the castle,
 * the stable, then any other with a site a road reaches), or -1 (stone on its way or being dug, rank, no site).
 */
export function quarryForPave(world: World, b: Building): number {
  if (!rankGated(world)) return -1;
  const h = paveSpanFor(world, b);
  if (!h) return -1;
  const ok = paveCheck(world, h);
  if (ok.ok || ok.err.k !== 'NO_STONE' || ok.err.quarries > 0 || !canPlace(world, 'quarry').ok) return -1;
  const st = world.state;
  const ids = [b.id];
  for (const t of ['castle', 'stable'] as const) for (const q of st.buildings) if (q.type === t) ids.push(q.id);
  for (const q of st.buildings) if (!ids.includes(q.id)) ids.push(q.id);
  return siteAnchor(world, 'quarry', ids);
}

/**
 * D-420: the held span's stone bridge waits for stone that will come by itself (free valley, a quarry stands): the
 * stone is on its way, lies at a quarry, or a working quarry is still digging it. Nothing to press — the card is
 * calm and the sheet says how long, instead of a grey "Wyłóż most kamieniem" for minutes. `short`: stone missing;
 * `incoming` / `atQuarry`: of it already dug; `digTicks`: until a working quarry has dug the rest (0 = all dug).
 * null: not this case (stone in store, no quarry — D-390's quarry button — or no quarry digging the rest).
 */
export interface StoneWait { short: number; incoming: number; atQuarry: number; digTicks: number }
export function paveStoneWait(world: World, b: Building): StoneWait | null {
  if (!rankGated(world)) return null;
  const h = heldSpanFor(world, b);
  if (!h) return null;
  const ok = paveCheck(world, h);
  if (ok.ok || ok.err.k !== 'NO_STONE' || ok.err.quarries === 0) return null;
  const { need, have, incoming, atQuarry } = ok.err;
  const short = need - have;
  const dig = short - incoming - atQuarry;
  let digTicks = 0;
  if (dig > 0) {
    const cycle = cycleTicks(world, 'quarry', BUILDINGS.quarry.recipe!.ticks);
    let working = 0, first = cycle;
    for (const q of world.state.buildings) {
      if (q.type !== 'quarry') continue;
      // D-430: a yard full of stone a wagon is already booked to fetch (WAITING_PICKUP — often loads the trading post
      // buys) is no stall: the quarry digs again once the wagon comes. A whole cycle from now (pickup not guessed).
      // D-591: likewise a yard a wagon is already driving to (WAGON_DUE, the booking lands when it arrives)
      // D-632: between cycles a quarry still reads WORKING with no cycle running — placed this tick (the next step
      // starts it: the sheet's "Postaw kamieniołom" read the grey stone button until then) or a cycle just done (the
      // next dispatch books the yard, WAITING_PICKUP, or the status turns OUTPUT_FULL). It digs, as one mid-cycle.
      if (q.progress < 0 && q.status.k === 'WORKING') {
        working++;
        continue;
      }
      if (q.progress < 0) {
        if (q.status.k !== 'WAITING_PICKUP' && q.status.k !== 'WAGON_DUE') continue;
        working++;
        continue;
      }
      working++;
      first = Math.min(first, Math.max(0, cycle - q.progress));
    }
    // no quarry digging: the quarry's own stall is the card (full yard, no road), not this wait
    if (!working) return null;
    digTicks = first + (Math.ceil(dig / working) - 1) * cycle;
  }
  return { short, incoming, atQuarry, digTicks };
}

/**
 * D-591: the held span's stone bridge lacks stone, and the stone it needs is dug: it lies in a quarry's full yard
 * that no wagon collects (OUTPUT_FULL.NO_WAGON — every wagon busy), so the quarry cannot dig the rest either. Not a
 * calm wait (paveStoneWait is null) and not a grey stone button: what is missing is a free wagon to haul the stone,
 * so the cure is "Kup wóz". Returns that quarry (the fullest one), or -1. Pure read.
 */
export function paveStoneHaul(world: World, b: Building): number {
  if (!rankGated(world)) return -1;
  const h = heldSpanFor(world, b);
  if (!h) return -1;
  const ok = paveCheck(world, h);
  if (ok.ok || ok.err.k !== 'NO_STONE' || ok.err.quarries === 0 || paveStoneWait(world, b)) return -1;
  let best = -1, most = 0;
  for (const q of world.state.buildings) {
    if (q.type !== 'quarry' || q.status.k !== 'OUTPUT_FULL' || q.status.cause !== 'NO_WAGON') continue;
    const free = q.stock.stone - q.reservedOut.stone;
    if (free > most) { most = free; best = q.id; }
  }
  return best;
}

/**
 * D-633: the held span's stone bridge lacks stone, the stone it needs is dug, and it lies in a quarry's full yard the
 * granaries refuse (OUTPUT_FULL.NO_DESTINATION — a full granary), so the quarry digs no more. Neither a calm stone wait
 * nor the grey stone button: what holds the bridge is the quarry's own stall, whose card names its granary and
 * offers that chain's cure (a wagon to empty it, another granary, or "rynek nasycony" — calm). The held building is a
 * calm pin so the quarry's card can head the HUD, and its sheet points to the quarry. Returns that quarry (the
 * fullest one), or -1. Pure read.
 */
export function paveStoneYard(world: World, b: Building): number {
  if (!rankGated(world)) return -1;
  const h = heldSpanFor(world, b);
  if (!h) return -1;
  const ok = paveCheck(world, h);
  if (ok.ok || ok.err.k !== 'NO_STONE' || ok.err.quarries === 0 || paveStoneWait(world, b)) return -1;
  let best = -1, most = 0;
  for (const q of world.state.buildings) {
    // a granary that refuses it (blockedBy): the texts say "the granary will not take it"
    if (q.type !== 'quarry' || q.status.k !== 'OUTPUT_FULL' || q.status.cause !== 'NO_DESTINATION' || q.status.blockedBy < 0) continue;
    const free = q.stock.stone - q.reservedOut.stone;
    if (free > most) { most = free; best = q.id; }
  }
  return best;
}

/**
 * D-592: a producer's full yard refused by a full granary (OUTPUT_FULL.NO_DESTINATION) while another granary its
 * road reaches has room: the next dispatch (≤ 6 ticks) sends the load there. The yard is no fault (as the full
 * granary next to one with room, calmWhy 'storeRoom'), so it reads calm instead of a red card with no cure.
 * Returns the granary with room, or -1. Pure read.
 */
export function yardStoreRoom(world: World, b: Building): number {
  const s = b.status;
  if (s.k !== 'OUTPUT_FULL' || s.cause !== 'NO_DESTINATION' || s.blockedBy < 0) return -1;
  const r = granaryRelief(world, s.blockedBy);
  if (r?.k !== 'ROOM') return -1;
  const g = buildingById(world, r.granary);
  return g && reachable(world, b.gate, g.gate) ? g.id : -1;
}

/** The last building of a chain (its root), else `self`. */
export function chainRoot(chain: readonly ReasonLink[], self: number): number {
  const r = chain.length ? chain[chain.length - 1]! : null;
  return r && r.kind === 'building' ? r.id : self;
}

/**
 * D-391: where the sheet's "Postaw spichlerz" opens the ghost — by this building, then the chain's root (the full yard
 * or granary), another granary, the castle, the stable: the first with a site a road reaches (siteAnchor), or -1. In
 * the free valley a granary cure with no such site is not offered (the card would name a building the player cannot
 * place); missions keep the building itself (their sites are authored or open).
 */
export function granaryAnchor(world: World, b: Building, root: number): number {
  if (!rankGated(world)) return b.id;
  const ids = [b.id];
  if (root !== b.id) ids.push(root);
  for (const t of ['warehouse', 'castle', 'stable'] as const) for (const q of world.state.buildings) if (q.type === t && !ids.includes(q.id)) ids.push(q.id);
  return siteAnchor(world, 'warehouse', ids);
}

/**
 * A shared single producer outranks the long waits: its lesson state (CONTESTED) is too short-lived to reach the
 * card by duration (research P5), so once the workshop has waited 30 s (D-110) it counts as critical, ahead of a
 * 45 s stall.
 */
const SHARED_LEAD_TICKS = 45 * TICK_HZ;

/** Buildings with a stall worth a pin, worst first (stalledTicks × criticality). */
/**
 * D-653: the wagon of this building's delivery or pickup has had no road to its target for MIN_STALL_TICKS or more
 * (NO_ROUTE: a road cell on its way taken back). The building only "waits for the delivery", which is no stall, so
 * the HUD had no card at all — mission VII: the castle's six fish on a wagon cut off from it for 6 min, the order
 * lost with nothing on the card (the wagon's own red pin on the map was the only sign). Its wagon and how long. Pure read.
 */
export function routeLostFor(world: World, b: Building): { wagon: number; ticks: number } | null {
  const s = b.status;
  if (s.k !== 'WAITING_DELIVERY' && s.k !== 'WAITING_PICKUP') return null;
  const w = world.state.wagons.find((q) => q.id === s.wagon);
  if (!w || w.status.k !== 'NO_ROUTE') return null;
  const ticks = world.state.tick - w.status.since;
  return ticks >= MIN_STALL_TICKS ? { wagon: w.id, ticks } : null;
}

export function rankStalls(world: World): StallEntry[] {
  const out: StallEntry[] = [];
  for (const b of world.state.buildings) {
    if (sharedOneCard(world, b)) {
      out.push({ id: b.id, ticks: b.stalledTicks, crit: true, minor: false, score: (b.stalledTicks + SHARED_LEAD_TICKS) * W_CRIT });
      continue;
    }
    const held = heldSpanFor(world, b);
    if (held) {
      // D-420: the stone bridge only waits for stone already coming or being dug — a calm pin, not the red card
      // D-633: ...or for stone dug into a quarry yard a full granary refuses (the quarry's own card leads)
      if (paveStoneWait(world, b) || (paveStoneHaul(world, b) < 0 && paveStoneYard(world, b) >= 0)) out.push({ id: b.id, ticks: held.heldTicks, crit: false, minor: true, score: held.heldTicks * W_MINOR });
      else out.push({ id: b.id, ticks: held.heldTicks, crit: true, minor: false, score: (held.heldTicks + SHARED_LEAD_TICKS) * W_CRIT });
      continue;
    }
    const lost = routeLostFor(world, b);
    if (lost) {
      out.push({ id: b.id, ticks: lost.ticks, crit: true, minor: false, score: lost.ticks * W_CRIT });
      continue;
    }
    if (!isStall(b.status) && b.status.k !== 'NO_INPUT') continue;
    if (b.stalledTicks < MIN_STALL_TICKS) continue;
    const calm = calmStall(world, b, JSON.stringify(b.status));
    const crit = isCritical(b.status, b.stalledTicks, calm);
    const minor = b.status.k === 'WAITING_PICKUP' || calm;
    const w = crit ? W_CRIT : minor ? W_MINOR : W_NORMAL;
    out.push({ id: b.id, ticks: b.stalledTicks, crit, minor, score: b.stalledTicks * w });
  }
  // ties: lower id first, so the order (and the alarm seal's cycle) is stable between frames
  out.sort((a, b) => b.score - a.score || a.id - b.id);
  return out;
}

/**
 * D-173 (research valley-ranks-2-3, F2): a producer whose full yard has nowhere to go (OUTPUT_FULL.NO_DESTINATION)
 * because its own gate is off the stable's road network — e.g. a later building cut the diagonal road step it hung
 * on. The sim names the first granary it cannot reach (`blockedBy`), so the chain ends at an empty granary; the cure
 * is the road from this producer to the network, not that granary. Its id, or -1. Pure read.
 */
export function cutOffProducer(world: World, chain: ReasonLink[]): number {
  const stable = world.state.buildings.find((q) => q.type === 'stable');
  if (!stable) return -1;
  for (const l of chain) {
    if (l.kind !== 'building' || l.status.k !== 'OUTPUT_FULL' || l.status.cause !== 'NO_DESTINATION') continue;
    const b = buildingById(world, l.id);
    if (b && !reachable(world, b.gate, stable.gate)) return b.id;
  }
  return -1;
}

/**
 * D-650: the other side of cutOffProducer — the producer is on the stable's roads, but the granary the sim names
 * (`blockedBy`, the first one it cannot reach, not a full one) is off them: a road cell taken back left the granary on
 * a piece of its own (mission IV: the stable's half cut from the sawmill's; mission I before the bridge). The card
 * stayed critical with nothing to press (up to 8 min in the early-mission scan); the cure is the road to that granary.
 * Its id, or -1. Pure read.
 */
export function cutOffGranary(world: World, chain: ReasonLink[]): number {
  const stable = world.state.buildings.find((q) => q.type === 'stable');
  if (!stable) return -1;
  for (const l of chain) {
    if (l.kind !== 'building' || l.status.k !== 'OUTPUT_FULL' || l.status.cause !== 'NO_DESTINATION' || l.status.blockedBy < 0) continue;
    const b = buildingById(world, l.id), g = buildingById(world, l.status.blockedBy);
    if (!b || !g || g.type !== 'warehouse' || g.status.k === 'STORAGE_FULL') continue;
    if (reachable(world, b.gate, stable.gate) && !reachable(world, b.gate, g.gate)) return g.id;
  }
  return -1;
}

/**
 * D-394: the free valley's mirror of cutOffProducer — the chain's own building waits for an input it cannot reach
 * (NO_INPUT.UNREACHABLE) because its own gate is off the stable's road network (a later building cut the diagonal step
 * it hung on); the chain then ends at a working source, so the gap finder had nothing to offer and the card stayed
 * critical with no cure (card-10 `--no-pairs` seed 1303: a brewery from 69 min on, its link 4 cells). Its id, or -1.
 */
export function cutOffConsumer(world: World, chain: ReasonLink[]): number {
  const head = chain[0];
  if (!head || head.kind !== 'building' || head.status.k !== 'NO_INPUT') return -1;
  // D-611: a mission building cut off from the stable's roads (a castle whose last road cell was taken back) reads
  // NONE_AVAILABLE when its source holds less than a load (or UNREACHABLE when it holds one): either way the cure is
  // the road to it, in a mission as in the free valley
  // (NONE_AVAILABLE only with a producer of the good on the map: with none, a road alone brings nothing)
  if (head.status.cause !== 'UNREACHABLE' && !(head.status.cause === 'NONE_AVAILABLE' && head.status.blockedBy >= 0)) return -1;
  const stable = world.state.buildings.find((q) => q.type === 'stable');
  const b = buildingById(world, head.id);
  return stable && b && !reachable(world, stable.gate, b.gate) ? b.id : -1;
}

/**
 * D-611: the chain's own building waits for a good its only producer holds less than a load of (NO_INPUT.NONE_AVAILABLE
 * blamed on it), and that producer's gate is off the stable's road network (mission XIV: the burner's road taken back):
 * its loads will never come — the road to the producer is the cure. Its id, or -1. Pure read.
 */
export function cutOffSource(world: World, chain: ReasonLink[]): number {
  const head = chain[0];
  if (!head || head.kind !== 'building' || head.status.k !== 'NO_INPUT' || head.status.cause !== 'NONE_AVAILABLE') return -1;
  const stable = world.state.buildings.find((q) => q.type === 'stable');
  const p = buildingById(world, head.status.blockedBy);
  return stable && p && p.id !== head.id && !reachable(world, p.gate, stable.gate) ? p.id : -1;
}

/**
 * D-617: a building short of a good nothing can bring any more — no producer of it on the map, none in the mission's
 * build list, not a unit left in any yard, granary or wagon (mission XIII's mill once the granary's grain is gone).
 * Nothing to press: if the castles still needed it, the dead-end letter (D-613) says so; otherwise it is idle for good.
 * Missions only. Pure read.
 */
export function starvedForGood(world: World, b: Building): boolean {
  const s = b.status;
  if (s.k !== 'NO_INPUT' || s.cause !== 'NONE_AVAILABLE' || s.blockedBy >= 0) return false;
  const can = missionBuildable(world.state.mission.id);
  if (can === 'ranked' || !world.state.mission.contract) return false;
  const g = s.good;
  if (can.some((t) => outputGoods(t).includes(g))) return false;
  for (const q of world.state.buildings) if (q.type !== 'castle' && (q.stock[g] > 0 || outputGoods(q.type).includes(g))) return false;
  return !world.state.wagons.some((w) => w.cargoGood === g && w.cargoQty > 0);
}

/**
 * D-410: a building cut off later (cutOffProducer / cutOffConsumer) whose gate no road can reach any more — later
 * neighbours boxed it in, so the gap finder has no link to offer (`suggestLinkToStable` null). The card used to stay
 * red with an empty sheet for the rest of the game (card-10 seed 1305: a brewery, 41 min; seed 1307: a malthouse,
 * 41 min). Free valley only (a mission's map keeps its links); never the castle, stable or trading post. Its id, or
 * -1. The link search is a whole-grid Dijkstra: kept per building until the road network or the building count
 * changes. Pure read.
 */
// per world (D-593): a new valley game ("Jeszcze raz", another seed) reuses building ids, network versions and
// counts — one shared map answered the new game's building with the old game's link search
const noLinkCaches = new WeakMap<World, Map<number, { key: string; none: boolean }>>();
export function cutOffNoLink(world: World, chain: ReasonLink[]): number {
  if (!rankGated(world)) return -1;
  let id = cutOffProducer(world, chain);
  if (id < 0) id = cutOffConsumer(world, chain);
  // D-634: a workshop whose own gate lost its road (NO_ROAD at the chain's root — a road or building laid later took
  // the cell its gate hung on) is cut off the same way
  if (id < 0) {
    const root = chain[chain.length - 1];
    if (root?.kind === 'building' && root.status.k === 'NO_ROAD') id = root.id;
  }
  const b = id >= 0 ? buildingById(world, id) : undefined;
  if (!b || !BUILDINGS[b.type].recipe || b.type === 'tradePost' || b.type === 'castle' || b.type === 'stable') return -1;
  const key = `${world.state.netVersion}|${world.state.buildings.length}`;
  let noLinkCache = noLinkCaches.get(world);
  if (!noLinkCache) noLinkCaches.set(world, (noLinkCache = new Map()));
  let c = noLinkCache.get(id);
  if (!c || c.key !== key) noLinkCache.set(id, (c = { key, none: !suggestLinkToStable(world, id) }));
  return c.none ? id : -1;
}

/**
 * The gap finder's road for the sheet (suggestLinkToStable runs a whole-grid Dijkstra: once per road network
 * version). D-593: the cache holds its world — a game started after another one (another mission, a new valley)
 * with the same target id, network version and building count showed the old map's road, and its "fix" button
 * laid the old map's cells.
 */
let gapCache: { world: World; key: string; s: RoadSuggestion | null } | null = null;
export function gapSuggestion(world: World, target: number): RoadSuggestion | null {
  const key = `${target}:${world.state.netVersion}:${world.state.buildings.length}`;
  if (gapCache?.key !== key || gapCache.world !== world) {
    gapCache = { world, key, s: buildingById(world, target)?.type === 'stable' ? stableLink(world) : suggestLinkToStable(world, target) ?? strandLink(world, target) };
  }
  return gapCache.s;
}

/**
 * D-654: a wagon of this building's job stranded on a road piece with no building on it (the producer it loaded at
 * was taken down, or two cells around it were taken back — mission VII's fish), so D-618's `strandedTarget` had no
 * building to link and the target needs no road of its own: the cheapest road from the wagon to the target's gate.
 * Null when no such wagon or no road can be built. Pure read (one whole-grid Dijkstra, cached by `gapSuggestion`).
 */
function strandLink(world: World, id: number): RoadSuggestion | null {
  const b = buildingById(world, id);
  const stable = world.state.buildings.find((q) => q.type === 'stable');
  if (!b || !stable) return null;
  for (const wg of world.state.wagons) {
    if (wg.status.k !== 'NO_ROUTE' || !wg.job || (wg.job.to !== id && wg.job.from !== id) || reachable(world, wg.at, b.gate)) continue;
    const s = suggestConnection(world, wg.at, b.gate);
    if (s && s.newCells.length) return s;
  }
  return null;
}

/**
 * D-651: the stable itself off the roads (NO_ROAD: the cell at its gate taken back). `suggestLinkToStable` links a
 * building *to* the stable's network, so for the stable it offered nothing and the card stayed critical with an
 * empty sheet (missions III and IX in the early-mission scan, up to 4.5 min) while a bought wagon had nowhere to go.
 * The cheapest road from its gate to the castle (or, without one, to the first building whose gate is on a road): the
 * castle's network is the one the deliveries use. Pure read; a whole-grid Dijkstra (cached by `gapSuggestion`).
 */
function stableLink(world: World): RoadSuggestion | null {
  const st = world.state;
  const stable = st.buildings.find((q) => q.type === 'stable');
  if (!stable) return null;
  const castle = st.mission.contract ? buildingById(world, st.mission.contract.castle) : undefined;
  const to = castle && st.roads[castle.gate] ? castle : st.buildings.find((q) => q.id !== stable.id && st.roads[q.gate]);
  if (!to) return null;
  const s = suggestConnection(world, stable.gate, to.gate);
  return s && s.newCells.length ? s : null;
}

/** D-410: what taking the cut-off building back returns right now (half its price once it has worked). */
export function cutOffRefund(world: World, id: number): number {
  const b = buildingById(world, id);
  return b ? demolishQuote(world, b).refund : 0;
}

/**
 * Building whose missing link to the stable is the root of this chain, or -1 (the sheet's gap finder offers
 * the cheapest road from the stable to it). NO_WAGON.ALL_BUSY counts when no stable reaches any source of
 * the good (audit 2026-11-03, fix 5): the target is that source, as for NONE_CAN_REACH it is the consumer.
 */
export function gapTarget(world: World, chain: ReasonLink[]): number {
  const root = chain[chain.length - 1];
  if (!root) return -1;
  const cut = cutOffProducer(world, chain);
  if (cut >= 0) return cut;
  const off = cutOffConsumer(world, chain);
  if (off >= 0) return off;
  const src = cutOffSource(world, chain);
  if (src >= 0) return src;
  const wh = cutOffGranary(world, chain);
  if (wh >= 0) return wh;
  if (root.kind === 'building') {
    const s = root.status;
    if (s.k === 'NO_ROAD') return root.id;
    // D-618: no wagon can reach a building that is on the stable's network — the wagons are the ones stranded (the
    // only wagon left on a castle whose road was taken back): link their road piece instead
    if (s.k === 'NO_WAGON' && s.cause === 'NONE_CAN_REACH') return strandedTarget(world, root.id) ?? root.id;
    if (s.k === 'NO_WAGON' && s.cause === 'ALL_BUSY') return busyOutOfReach(world, root.id);
    return -1;
  }
  if (root.status.k === 'NO_ROUTE' && root.status.target >= 0) {
    const to = buildingById(world, root.status.target);
    if (!to) return -1;
    // D-618: the target is on the stable's network — the wagon is the one stranded (its road piece cut off with a
    // producer, e.g. a farm whose link was taken back): the gap finder links that producer, not the target, which
    // needs no road (an empty suggestion left the sheet without a fix while the rail lit the road tool)
    const wg = world.state.wagons.find((v) => v.id === root.id);
    return (wg ? strandedTarget(world, to.id, [wg]) : null) ?? to.id;
  }
  return -1;
}

/**
 * D-618: when `id` is on the stable's road network but wagons stand on a road piece cut off from it, a building on
 * that piece (the gap finder links it to the stable), or null. `wagons` defaults to every wagon. Pure read.
 */
function strandedTarget(world: World, id: number, wagons = world.state.wagons): number | null {
  const stable = world.state.buildings.find((q) => q.type === 'stable');
  const b = buildingById(world, id);
  if (!stable || !b || !reachable(world, b.gate, stable.gate)) return null;
  for (const wg of wagons) {
    if (reachable(world, wg.at, stable.gate)) continue;
    const strand = world.state.buildings.find((q) => q.type !== 'stable' && reachable(world, wg.at, q.gate));
    if (strand) return strand.id;
  }
  return null;
}

/** How long after a wagon shortage resolves its sheet still offers the wagon (first-10-e N8, D-161): 20 s. */
export const BUSY_MEMO_TICKS = 20 * TICK_HZ;
const busyMemo = new WeakMap<World, Map<number, number>>();

/** A wait for a free wagon (NO_WAGON.ALL_BUSY, or a full yard no wagon collects that is not a surplus). */
function waitsForWagon(world: World, b: Building): boolean {
  const s = b.status;
  return (s.k === 'NO_WAGON' && s.cause === 'ALL_BUSY' && busyOutOfReach(world, b.id) < 0) ||
    (s.k === 'OUTPUT_FULL' && s.cause === 'NO_WAGON' && outputSurplus(world, b.id) !== 'SPARE' && stoneInStore(world, b.id) === 0);
}

/**
 * Remember the tick each building last waited for a free wagon (UI memory, not state). StallRanking calls it on
 * every recompute, i.e. once per sim tick the app sees.
 */
export function noteWagonWaits(world: World): void {
  let m = busyMemo.get(memoryWorld(world));
  if (!m) busyMemo.set(memoryWorld(world), (m = new Map()));
  for (const b of world.state.buildings) if (b.stalledTicks >= MIN_STALL_TICKS && waitsForWagon(world, b)) m.set(b.id, world.state.tick);
}

/**
 * The stall card said "wszystkie wozy zajęte", but by the time its sheet opened (×4) a wagon had taken the job:
 * the sheet still offers "Kup wóz" for BUSY_MEMO_TICKS after the wait, while nothing else is wrong there
 * (first-10-e N8, D-161). Ticks since that wait, or -1.
 */
export function recentWagonWait(world: World, id: number): number {
  const at = busyMemo.get(memoryWorld(world))?.get(id);
  if (at === undefined) return -1;
  const ago = world.state.tick - at;
  return ago >= 0 && ago <= BUSY_MEMO_TICKS ? ago : -1;
}

// per world and building (D-631): the HUD card and an open sheet ask for different buildings in the same frame
const cureCaches = new WeakMap<World, Map<number, { key: string; cure: Cure }>>();

/** The quarries' status kinds (D-591: the stone haul cure follows a quarry's yard, not the stalled building's status). */
function quarryKey(world: World): string {
  let k = '';
  for (const q of world.state.buildings) if (q.type === 'quarry') k += `${q.status.k}${'cause' in q.status ? q.status.cause : ''},`;
  return k;
}
/**
 * What the player can buy or build against the root of a building's stall chain: a wagon when the
 * root waits for a free wagon, a road when it lacks one, a granary when its output has nowhere to go
 * (OUTPUT_FULL.NO_DESTINATION) or the granary is full with no other to link or fill. Nothing when the chain runs into a wagon held at a bridge (ice, a
 * one-lane jam: a new wagon would wait there too) or when the full output is a surplus nobody needs
 * (audit 2026-11-03, fixes 1-2). Cached per tick, status and network version (D-631: the key held a 2 s bucket, so a
 * cure read in its first tick — a quarry's yard, a granary's load, a stone count — stayed up to 2 s after the state
 * had moved on; the dead-card scan saw those as 1 s flashes).
 */
export function cureFor(world: World, id: number): Cure {
  const b = world.state.buildings.find((q) => q.id === id);
  if (!b) return null;
  const key = `${JSON.stringify(b.status)}|${world.state.netVersion}|${world.state.buildings.length}|${world.state.wagons.length}|${world.state.tick}|${inputWaitTicks(world, b) >= SHARED_CARD_WAIT_TICKS}|${sharedContested(world, b)}|${world.state.coins}|${bottleneckKey(world)}|${quarryKey(world)}`;
  let cache = cureCaches.get(world);
  if (!cache) cureCaches.set(world, (cache = new Map()));
  const hit = cache.get(id);
  if (hit && hit.key === key) return hit.cure;
  const cure = cureOf(world, b);
  cache.set(id, { key, cure });
  return cure;
}

function cureOf(world: World, b: Building): Cure {
  const id = b.id;
  if (sharedOneCard(world, b) || sharedContested(world, b)) {
    return 'producer';
  }
  if (bottleneckFor(world, b)) {
    // the free valley's bottleneck card (D-171): this workshop waits for the card's good; one more producer
    return 'producer';
  }
  if (missingProducer(world, b)) {
    // D-615: nobody makes the good any more and the mission lets the player build its producer
    return 'producer';
  }
  if (heldSpanFor(world, b)) {
    // D-591: the stone is dug but lies in a quarry's yard no wagon collects — a wagon, not the grey stone button
    const c: Cure = paveStoneHaul(world, b) >= 0 ? 'wagon' : 'pave';
    return c;
  }
  const chain = explainBuilding(world, id, 5, true);
  // D-410: cut off with no road left to build — take it back (the gap finder would offer nothing)
  if (cutOffNoLink(world, chain) >= 0) {
    return 'demolish';
  }
  let cure: Cure = cutOffProducer(world, chain) >= 0 || cutOffConsumer(world, chain) >= 0 || cutOffSource(world, chain) >= 0 || cutOffGranary(world, chain) >= 0 ? 'road' : null;
  for (let i = chain.length - 1; i >= 0 && !cure; i--) {
    const l = chain[i]!;
    if (l.kind === 'building') {
      const s = l.status;
      if (s.k === 'NO_ROAD' || (s.k === 'NO_INPUT' && s.cause === 'UNREACHABLE') || (s.k === 'NO_WAGON' && s.cause === 'NONE_CAN_REACH')) cure = 'road';
      // every wagon busy, but none could reach a source of the good anyway: the road to it (fix 5)
      else if (s.k === 'NO_WAGON' && s.cause === 'ALL_BUSY') cure = busyOutOfReach(world, l.id) >= 0 ? 'road' : 'wagon';
      // (not when the granary already has paving stone, D-95: a new wagon would carry workshop inputs first)
      else if (s.k === 'OUTPUT_FULL' && s.cause === 'NO_WAGON' && outputSurplus(world, l.id) !== 'SPARE' && stoneInStore(world, l.id) === 0) cure = 'wagon';
      // only as the root: a full output whose customer still takes the good chains on to it (calm stall)
      // (not when the order of this good is complete: nothing needs it any more, fix 6)
      else if (s.k === 'OUTPUT_FULL' && s.cause === 'NO_DESTINATION' && i === chain.length - 1 && !contractFilled(world, l.id)) {
        // D-174: a granary full of loads no market takes: nothing to buy or build (calm "rynek nasycony")
        const loads = s.blockedBy >= 0 ? granaryLoads(world, s.blockedBy) : null;
        // D-630: the granary's load is booked by the next dispatch — room is coming, nothing to buy
        if (loads === 'saturated' || loads === 'pending') break;
        cure = loads === 'wagon' ? 'wagon' : 'granary';
      }
      // a full granary with no other granary to link or fill: another granary (fix 3); in the free valley a
      // granary full of goods the market buys needs wagons, not room (valley-3h proposal 2)
      else if (s.k === 'STORAGE_FULL' && i === chain.length - 1 && !granaryRelief(world, l.id)) {
        const loads = granaryLoads(world, l.id);
        if (loads === 'saturated' || loads === 'pending') break;
        // D-212: its own goods are wanted by nobody — nothing to build for the granary itself; a producer of a
        // wanted good it refuses (i > 0) still needs another granary
        if (i === 0 && granaryUnwanted(world, l.id)) break;
        // D-393: it is still filling (loads on the way, stock under its cap) — no second granary before it holds them
        if (i === 0 && granaryFilling(world, l.id)) break;
        cure = loads === 'wagon' ? 'wagon' : 'granary';
      }
    } else if (l.status.k === 'NO_ROUTE') cure = 'road';
    else if (l.status.k === 'BRIDGE_CLOSED' || l.status.k === 'BRIDGE_JAM') break;
  }
  // before the ice, one more wagon would leave too little silver for the stone bridge: the span first (day 8c)
  if (cure === 'wagon' && iceBeforeWagon(world)) cure = 'pave';
  // D-393: a producer's full yard while the last granary still takes its first loads — no other one before it has
  // (calm 'granaryFilling'; the chain may end at the producer or at the granary that refused it)
  if (cure === 'granary' && freshGranary(world, b) >= 0) cure = null;
  // D-391: no granary site a road reaches anywhere the ghost would look — nothing to offer
  if (cure === 'granary' && granaryAnchor(world, b, chainRoot(chain, b.id)) < 0) cure = null;
  return cure;
}

/**
 * rankStalls() once per sim tick instead of every frame (frame-cost research, item 3): the ranking only
 * changes when the state does — a tick, a command applied in pause (`version`: e.g. the loop's journal
 * length), a new world or a loaded save. `invalidate()` forces the next call to recompute (sheet or
 * selection changes, a language switch). The returned array is shared between calls: read it, never mutate it.
 */
export class StallRanking {
  private world: World | null = null;
  private state: object | null = null;
  private tick = -1;
  private net = -1;
  private count = -1;
  private version = -1;
  private cached: StallEntry[] = [];
  /** Recomputations since construction (tests, perf overlay). */
  computed = 0;

  get(world: World, version = 0): StallEntry[] {
    const st = world.state;
    if (world !== this.world || st !== this.state || st.tick !== this.tick || st.netVersion !== this.net ||
      st.buildings.length !== this.count || version !== this.version) {
      this.world = world; this.state = st; this.tick = st.tick; this.net = st.netVersion;
      this.count = st.buildings.length; this.version = version;
      this.cached = rankStalls(world);
      noteWagonWaits(world);
      this.computed++;
    }
    return this.cached;
  }

  invalidate(): void {
    this.tick = -1;
  }
}
