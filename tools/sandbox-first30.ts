// Free valley, the first 30 game minutes of a player who just finished mission I (research day 9b,
// docs/research/2026-11-05-sandbox-first-30.md). Headless, read-only use of the sim and the UI's card helpers.
//   npx tsx tools/sandbox-first30.ts [--json out.json] [--minutes 30] [--seeds default,1301,1302,1303]
// Players:
//   none            — no input;
//   build           — the minimal build order only (farm at 0:30; mill + bakery at rank 1; road + fisher at rank 2);
//   eye-N           — every N s looks at the worst-stall card (rankStalls()[0], or the pace card when it would
//                     take the slot) and presses the cure its sheet offers (gap road, Kup wóz, granary ghost);
//   build+eye-N     — both;
//   build+eye-N+ev  — both, plus accepts every royal order and sells to every merchant (the event card's buttons);
//   decent          — tools/bot-sandbox.ts DECENT plan (reference).
// Logged per look: card kind, calm/critical, cure, the cure's result (and why it failed), pace/fleet cue (must stay
// null without a contract), events and chronicle entries per minute.
import {
  BUILDINGS, MAX_WAGONS, TICK_HZ, WAGON_PRICE, applyCommand, isHeld, buildingById, checkInvariants, createWorld, explainBuilding, lineCells, step, suggestLinkToStable,
  unexplainedStalls, newPaceLog, samplePace, type BuildingType, type Command, type PaceLog, type World,
} from '../src/sim/index';
import { sandboxStatus } from '../src/sim/town';
import { calmWhy, cureFor, gapTarget, rankStalls, sampleInputWaits } from '../src/ui/stalls';
import { fleetCueFor, forecastFor, paceCard, sampleFleet } from '../src/ui/paceCard';
import { buildSite } from '../src/ui/site';
import { checkChronicle } from '../src/sim/proposals/chronicle';
import { DECENT, type BotStep } from './bot-sandbox';
import { writeFileSync } from 'node:fs';

const at = (w: World, x: number, y: number): number => y * w.terrain.w + x;
const col = (w: World, x: number, y1: number, y2: number): number[] => lineCells(w.terrain.w, at(w, x, y1), at(w, x, y2));
const put = (type: BuildingType, x: number, y: number, facing: number): Command => ({ t: 'place', type, x, y, facing });
const stableOf = (w: World): number => w.state.buildings.find((b) => b.type === 'stable')!.id;

/**
 * The minimal build order of a mission-I graduate: the only thing mission I did not teach is the build tool, and the
 * rank plaque / rank-up note names what each rank unlocks. One new chain per unlock, nothing else (no wagons: those
 * come only from the card). Sites: the DECENT plan's (by the castle road, so no link road is needed).
 */
export const MIN: BotStep[] = [
  { name: 'farm by the castle road', after: 30, cmds: () => [put('farm', 55, 25, 2)] },
  { name: 'mill', rank: 1, cmds: () => [put('mill', 58, 25, 2)] },
  { name: 'bakery', rank: 1, cmds: () => [put('bakery', 49, 25, 2)] },
  { name: 'road to the river', rank: 2, cmds: (w) => [{ t: 'road', surface: 1, cells: col(w, 45, 25, 30) }] },
  { name: 'fisher by the river', rank: 2, cmds: () => [put('fisher', 44, 32, 2)] },
];

interface Opts {
  plan: readonly BotStep[] | null; eye: number; events: boolean;
  /**
   * Prototype (not in the game): a free-valley fleet cue. When the card shows a calm pickup wait (or nothing) and a
   * yard has waited for pickup >= 20 s, no wagon idles and the fleet was on the road >= 90 % of the last minute, the
   * sheet offers "Kup wóz" — D-127's gate without the contract parts (forecast, aim, 3:30 room). `keep`: silver the
   * cue leaves for the next building (no cue below WAGON_PRICE + keep).
   */
  sbFleet?: { keep: number; maxWagons?: number };
  /**
   * Prototype (not in the game): a free-valley rank card. When the slot is empty or calm and the next rank still
   * lacks distinct goods sold, the card names the next unbuilt producer of an unsold good that the rank allows
   * (farm; mill once a farm stands; bakery once a mill stands; fisher) and its button opens the build ghost
   * by the castle (buildSite), as the pace card's "Postaw jeszcze" does.
   */
  sbRank?: boolean;
  /**
   * The game's own cards (day 9h): when no real stall needs the slot, the pace card the HUD shows (paceCard: the
   * fleet cue D-140 or the rank card D-152) and its sheet's cure — "Kup wóz", or "Postaw: …" at the ghost by the
   * castle. Replaces the sbFleet / sbRank prototypes.
   */
  game?: boolean;
}

export interface Look {
  t: number; kind: string; calm: boolean; crit: boolean; calmWhy: string | null; cure: string | null; act: string;
  stalls: number; coins: number; wagons: number; rank: number;
}

export interface Result {
  name: string; seed: string; minutes: number; rank: number; rankMin: number[]; earned: number; coins: number; wagons: number;
  buildings: number; actions: Record<string, number>; looks: Look[]; done: string[]; paceWrong: number; fleetWrong: number;
  ordersOffered: number; ordersDone: number; merchants: number; chronicle: { t: number; id: string }[];
  /** per minute: share of looks whose card was empty / calm / actionable (cure applied) / failed / no cure */
  violations: string[];
  /** next rank's requirements at the end: have/need */
  next: string;
  /** seconds of game time with an empty card (sampled every second) and with a calm-only card */
  emptySec: number; calmSec: number; actSec: number; noCureSec: number;
  topSubjects: Record<string, number>;
}

function placeAtGhost(w: World, type: BuildingType, near: number): boolean {
  const s = buildSite(w, type, near);
  if (!s) return false;
  const before = w.state.buildings.length;
  if (!applyCommand(w, put(type, s.x, s.y, s.facing)).ok) return false;
  const b = w.state.buildings[before]!;
  const link = suggestLinkToStable(w, b.id);
  if (!link || !link.cells.length || applyCommand(w, { t: 'road', surface: 1, cells: link.cells }).ok) return true;
  applyCommand(w, { t: 'demolish', cell: b.gate });
  return false;
}

/** One look: the slot (pace card if it would take it, else the worst stall) and the sheet's cure. */
function look(w: World, log: PaceLog, r: Result, sb: { keep: number; maxWagons?: number; bits: number[] } | null, rk = false, game = false): Look {
  const st = w.state;
  const ranked = rankStalls(w);
  const base = { t: st.tick / TICK_HZ, stalls: ranked.length, coins: st.coins, wagons: st.wagons.length, rank: st.town.rank };
  // the pace card would take the slot when no real stall needs it: it must never exist without a contract
  if (!ranked.length || ranked[0]!.minor) {
    const pc = paceCard(w, forecastFor(w, log));
    if (pc && game) {
      const kind = 'card:' + pc.k + (pc.k === 'rank' || pc.k === 'fleet' ? ':' + pc.type : '');
      const card = { ...base, kind, calm: true, crit: false, calmWhy: null };
      if (pc.k === 'fleet') { const res = applyCommand(w, { t: 'buyWagon', stable: stableOf(w) }); return { ...card, cure: 'wagon', act: res.ok ? 'wagon:card' : 'wagon?' + res.err.k }; }
      if (pc.k === 'rank') {
        if (st.coins < BUILDINGS[pc.type].price) return { ...card, cure: 'producer', act: 'producer?NO_COINS' };
        return { ...card, cure: 'producer', act: placeAtGhost(w, pc.type, pc.producer) ? 'build:' + pc.type : 'build?fail:' + pc.type };
      }
      return { ...card, cure: null, act: '' };
    }
    if (pc && !game) { r.paceWrong++; return { ...base, kind: 'pace:' + pc.k, calm: true, crit: false, calmWhy: null, cure: null, act: 'pace?' }; }
  }
  if (!game) for (const b of st.buildings) if (fleetCueFor(w, forecastFor(w, log), b)) r.fleetWrong++;
  // prototype free-valley rank card (see Opts.sbRank)
  if (rk && (!ranked.length || ranked[0]!.minor)) {
    const sb = sandboxStatus(w);
    if (sb.next && sb.goodsSold < sb.next.goods) {
      const has = (t: BuildingType): boolean => st.buildings.some((q) => q.type === t);
      const order: [BuildingType, BuildingType | null][] = [['farm', null], ['mill', 'farm'], ['bakery', 'mill'], ['fisher', null], ['quarry', null]];
      const castle = st.buildings.find((q) => q.type === 'castle')!;
      for (const [type, needs] of order) {
        const good = Object.keys(BUILDINGS[type].recipe!.outputs)[0] as keyof typeof st.ledger.sold;
        if (st.ledger.sold[good] > 0 || has(type) || (needs && !has(needs)) || !sb.unlocked.includes(type)) continue;
        if (st.coins < BUILDINGS[type].price) return { ...base, kind: 'sbRank:' + type, calm: true, crit: false, calmWhy: null, cure: 'producer', act: 'producer?NO_COINS' };
        const ok = placeAtGhost(w, type, castle.id);
        return { ...base, kind: 'sbRank:' + type, calm: true, crit: false, calmWhy: null, cure: 'producer', act: ok ? 'build:' + type : 'build?fail:' + type };
      }
    }
  }
  // prototype free-valley fleet cue (see Opts.sbFleet)
  if (sb && (!ranked.length || ranked[0]!.minor) && st.coins >= WAGON_PRICE + sb.keep && st.wagons.length < (sb.maxWagons ?? MAX_WAGONS) &&
    !st.wagons.some((q) => q.status.k === 'IDLE' && !q.job) && sb.bits.length >= 60 && sb.bits.reduce((a, x) => a + x, 0) >= 54) {
    const y = st.buildings.find((q) => q.status.k === 'WAITING_PICKUP' && q.stalledTicks >= 20 * TICK_HZ &&
      !isHeld(st.wagons.find((v) => v.id === (q.status as { wagon: number }).wagon)?.status ?? { k: 'IDLE' } as never));
    if (y) {
      const res = applyCommand(w, { t: 'buyWagon', stable: stableOf(w) });
      return { ...base, kind: 'sbFleet:' + y.type, calm: true, crit: false, calmWhy: null, cure: 'wagon', act: res.ok ? 'wagon:sbFleet' : 'wagon?' + res.err.k };
    }
  }
  if (!ranked.length) return { ...base, kind: '(no card)', calm: true, crit: false, calmWhy: null, cure: null, act: '' };
  const e = ranked[0]!;
  const b = buildingById(w, e.id)!;
  const s = b.status as { k: string; cause?: string };
  const kind = `${b.type}:${s.k}${s.cause ? '.' + s.cause : ''}`;
  const chain = explainBuilding(w, b.id, 5, true);
  const target = gapTarget(w, chain.length ? chain : [{ kind: 'building', id: b.id, status: b.status }]);
  let cure: string | null = null, act = '';
  if (target >= 0) {
    cure = 'road';
    const sug = suggestLinkToStable(w, target);
    if (!sug) act = 'road?none';
    else { const res = applyCommand(w, { t: 'road', surface: 1, cells: sug.cells }); act = res.ok ? 'road' : 'road?' + res.err.k; }
  } else {
    cure = cureFor(w, b.id);
    if (cure === 'wagon') { const res = applyCommand(w, { t: 'buyWagon', stable: stableOf(w) }); act = res.ok ? 'wagon' : 'wagon?' + res.err.k; }
    else if (cure === 'granary') {
      // the sheet's "Postaw spichlerz" opens the build tool with the ghost by the root (nav.pickBuild)
      const root = chain.length ? chain[chain.length - 1]! : null;
      const rb = root && root.kind === 'building' ? root.id : b.id;
      act = placeAtGhost(w, 'warehouse', rb) ? 'granary' : 'granary?fail';
    } else if (cure) act = cure + '?unhandled';
  }
  return { ...base, kind, calm: e.minor, crit: e.crit, calmWhy: calmWhy(w, b), cure, act };
}

export function run(name: string, o: Opts, seed: number | undefined, minutes = 30): Result {
  const w = createWorld('sandbox', seed);
  const log = newPaceLog();
  const r: Result = {
    name, seed: seed === undefined ? 'default' : String(seed), minutes, rank: 0, rankMin: [], earned: 0, coins: 0, wagons: 0, buildings: 0,
    actions: {}, looks: [], done: [], paceWrong: 0, fleetWrong: 0, ordersOffered: 0, ordersDone: 0, merchants: 0, chronicle: [],
    violations: [], next: '', emptySec: 0, calmSec: 0, actSec: 0, noCureSec: 0, topSubjects: {},
  };
  const seenOrders = new Set<string>(), seenMerch = new Set<string>();
  const chron: string[] = [];
  let k = 0;
  const fleetBits: number[] = [];
  const end = minutes * 60 * TICK_HZ;
  while (w.state.tick < end) {
    const t = w.state.tick;
    if (t % TICK_HZ === 0) {
      // build order: next step once rank, time and silver allow (waits on NO_COINS / NO_STONE)
      if (o.plan && k < o.plan.length) {
        const s = o.plan[k]!;
        if ((s.rank ?? 0) <= w.state.town.rank && (s.after ?? 0) * TICK_HZ <= t) {
          let ok = true;
          for (const c of s.cmds(w)) {
            const res = applyCommand(w, c);
            if (!res.ok) { ok = false; if (res.err.k !== 'NO_COINS' && res.err.k !== 'NO_STONE') { r.violations.push(`step ${s.name}: ${JSON.stringify(res.err)}`); k++; } break; }
          }
          if (ok) { r.done.push(`${(t / TICK_HZ / 60).toFixed(1)} ${s.name}`); k++; }
        }
      }
      // events
      const ev = w.state.valleyEvents;
      if (ev) {
        for (const ord of ev.orders) {
          if (!seenOrders.has(ord.id)) { seenOrders.add(ord.id); r.ordersOffered++; }
          if (o.events && !ord.accepted) applyCommand(w, { t: 'orderAccept', id: ord.id });
        }
        if (ev.merchant && !seenMerch.has(ev.merchant.id)) { seenMerch.add(ev.merchant.id); r.merchants++; }
        if (o.events && ev.merchant) applyCommand(w, { t: 'merchantSell', id: ev.merchant.id });
      }
      // card time budget (what the slot shows each second, no action)
      const ranked = rankStalls(w);
      if (!ranked.length) r.emptySec++;
      else {
        const top = buildingById(w, ranked[0]!.id)!;
        const s = top.status as { k: string; cause?: string };
        const kk = `${top.type}:${s.k}${s.cause ? '.' + s.cause : ''}${ranked[0]!.minor ? '(calm)' : ''}`;
        r.topSubjects[kk] = (r.topSubjects[kk] ?? 0) + 1;
        if (ranked[0]!.minor) r.calmSec++;
        else if (cureFor(w, top.id) || gapTarget(w, explainBuilding(w, top.id, 5, true)) >= 0) r.actSec++;
        else r.noCureSec++;
      }
      for (const id of checkChronicle(w.state, chron)) { chron.push(id); r.chronicle.push({ t: t / TICK_HZ, id }); }
    }
    if (t % TICK_HZ === 0) {
      fleetBits.push(w.state.wagons.some((q) => (q.status.k === 'IDLE' && !q.job) || isHeld(q.status)) ? 0 : 1);
      if (fleetBits.length > 60) fleetBits.shift();
    }
    if (o.eye > 0 && t > 0 && t % (o.eye * TICK_HZ) === 0) {
      const l = look(w, log, r, o.sbFleet ? { ...o.sbFleet, bits: fleetBits } : null, !!o.sbRank, !!o.game);
      r.looks.push(l);
      if (l.act && !l.act.includes('?')) r.actions[l.act] = (r.actions[l.act] ?? 0) + 1;
    }
    step(w);
    sampleInputWaits(w);
    samplePace(log, w);
    sampleFleet(w);
    if (w.state.tick % (10 * TICK_HZ) === 0) {
      const v = [...checkInvariants(w), ...unexplainedStalls(w)];
      if (v.length && r.violations.length < 10) r.violations.push(`tick ${w.state.tick}: ${v.join('; ')}`);
    }
  }
  const st = sandboxStatus(w);
  r.rank = st.rank; r.rankMin = st.rankTicks.map((x) => (x < 0 ? -1 : +(x / TICK_HZ / 60).toFixed(1)));
  r.earned = st.silverEarned; r.coins = w.state.coins; r.wagons = w.state.wagons.length; r.buildings = w.state.buildings.length;
  r.ordersDone = w.state.valleyEvents?.ordersDone ?? 0;
  r.next = st.next ? `renown ${st.renown}/${st.next.renown} goods ${st.goodsSold}/${st.next.goods} flow ${st.bestFlow}/${st.next.flow}` : 'max';
  return r;
}

const fmtT = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function summary(r: Result): string {
  const looks = r.looks;
  const by: Record<string, number> = {};
  for (const l of looks) { const key = `${l.kind}${l.calm ? '(calm)' : l.crit ? '(crit)' : ''} -> ${l.act || 'nothing'}`; by[key] = (by[key] ?? 0) + 1; }
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${v}x ${k}`).join('\n      ');
  const subj = Object.entries(r.topSubjects).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}s`).join(' | ');
  return `${r.name.padEnd(18)} seed ${r.seed.padEnd(7)} rank ${r.rank} [${r.rankMin.slice(1).join(' / ')}] earned ${r.earned} coins ${r.coins} wagons ${r.wagons} bld ${r.buildings} ` +
    `orders ${r.ordersOffered}/${r.ordersDone} merch ${r.merchants} chron ${r.chronicle.length} paceWrong ${r.paceWrong} fleetWrong ${r.fleetWrong} ${JSON.stringify(r.actions)}\n` +
    `    next: ${r.next}\n    slot/s: empty ${r.emptySec} calm ${r.calmSec} actionable ${r.actSec} no-cure ${r.noCureSec}\n    subjects: ${subj}\n` +
    (looks.length ? `    looks (${looks.length}):\n      ${top}\n` : '') +
    (looks.some((l) => l.act) ? `    acts: ${looks.filter((l) => l.act).map((l) => `${fmtT(l.t)} ${l.act}`).join(', ')}\n` : '') +
    (r.done.length ? `    built: ${r.done.join(', ')}\n` : '') + (r.violations.length ? `    VIOLATIONS ${r.violations.join(' | ')}\n` : '');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const arg = (n: string): string | null => { const i = args.indexOf(n); return i >= 0 ? args[i + 1]! : null; };
  const minutes = Number(arg('--minutes') ?? 30);
  const seeds = (arg('--seeds') ?? 'default').split(',').map((s) => (s === 'default' ? undefined : Number(s)));
  const only = arg('--only');
  const players: [string, Opts][] = [
    ['none', { plan: null, eye: 0, events: false }],
    ['build', { plan: MIN, eye: 0, events: false }],
    ['eye-10', { plan: null, eye: 10, events: false }],
    ['eye-30', { plan: null, eye: 30, events: false }],
    ['eye-60', { plan: null, eye: 60, events: false }],
    ['build+eye-10', { plan: MIN, eye: 10, events: false }],
    ['build+eye-30', { plan: MIN, eye: 30, events: false }],
    ['build+eye-60', { plan: MIN, eye: 60, events: false }],
    ['build+eye-30+ev', { plan: MIN, eye: 30, events: true }],
    ['eye-30+sbF', { plan: null, eye: 30, events: false, sbFleet: { keep: 0 } }],
    ['build+eye-10+sbF', { plan: MIN, eye: 10, events: false, sbFleet: { keep: 40 } }],
    ['build+eye-30+sbF', { plan: MIN, eye: 30, events: false, sbFleet: { keep: 40 } }],
    ['build+eye-60+sbF', { plan: MIN, eye: 60, events: false, sbFleet: { keep: 40 } }],
    ['eye-10+sbF+sbR', { plan: null, eye: 10, events: false, sbFleet: { keep: 40 }, sbRank: true }],
    ['eye-30+sbF+sbR', { plan: null, eye: 30, events: false, sbFleet: { keep: 40 }, sbRank: true }],
    ['eye-60+sbF+sbR', { plan: null, eye: 60, events: false, sbFleet: { keep: 40 }, sbRank: true }],
    ['eye-30+sbR', { plan: null, eye: 30, events: false, sbRank: true }],
    ['card-10', { plan: null, eye: 10, events: false, game: true }],
    ['card-30', { plan: null, eye: 30, events: false, game: true }],
    ['card-60', { plan: null, eye: 60, events: false, game: true }],
    ['decent', { plan: DECENT, eye: 0, events: false }],
  ];
  const all: Result[] = [];
  for (const seed of seeds) {
    for (const [name, o] of players) {
      if (only && !only.split(',').includes(name)) continue;
      const r = run(name, o, seed, minutes);
      all.push(r);
      console.log(summary(r));
    }
  }
  const jo = arg('--json');
  if (jo) writeFileSync(jo, JSON.stringify(all, null, 1));
}
