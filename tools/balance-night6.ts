// Mission I-XII balance survey (research night 6, docs/research/2026-11-04-mission-balance.md).
// Headless, read-only use of the sim and of the UI's stall helpers; no src/ change.
//   npx tsx tools/balance-night6.ts [m1 m2 ...] [--json out.json] [--no-search]
// Strategies per mission:
//   passive       — no input at all;
//   wagons-k      — only k extra wagons at 0:00 (best k reported; the generic "wrong fix");
//   lesson@T+k    — the mission's intended fix at second T (retried every second until it applies, e.g.
//                   mission VIII's stone) plus k wagons at 0:00; the grid minimum is the "optimum";
//   eye-N / eye+-N — the "reasonable player": every N s taps the worst stall card (rankStalls()[0]) and its
//                   "Naprawa" button (gap road, Kup wóz, granary). eye+ also follows the sheet's TEXT hints
//                   (jam/ice -> pave the span in stone, shared/thin input from a single producer -> build one
//                   more producer of that type if the mission allows it);
//   letter+eye-30 — reads the contract letter: the lesson fix at 1:00, then eye+ every 30 s.
import {
  MISSIONS, TICK_HZ, applyCommand, buildingById, createWorld, explainBuilding, lineCells, missionBuildable,
  net, sharedInput, stars, stateHash, step, suggestLinkToStable, thinDelivery, type BuildingType, type Command, type World,
} from '../src/sim/index';
import { cureFor, gapTarget, paveSpanFor, rankStalls, sampleInputWaits, sharedOneProducer } from '../src/ui/stalls';
import { M7_FISHER_SITE, M8_LANE, M9_WOODCUTTER_SITE } from '../src/sim/proposals/missions-7-9';
import { M10_SECOND_WOODCUTTER, M12_GRANARY_LINK } from '../src/sim/proposals/missions-10-12';
import { M14_BURNER_SITE, M14_WRONG_SITE, M15_GRANARY_SITE, M15_WRONG_SITE } from '../src/sim/proposals/missions-14-15';
import { missionSiteHint } from '../src/sim/index';
import { buildSite } from '../src/ui/site';
import { forecastFor, paceCard, sampleFleet } from '../src/ui/paceCard';
import { newPaceLog, samplePace, type PaceLog } from '../src/sim/index';
import { writeFileSync } from 'node:fs';

// RULE_ARRIVE=1..5, RULE_TOPUP=N: research day 9g dispatcher prototypes; they need
// docs/research/2026-11-05-more-wagons-slower-variants.patch applied (RULES in src/sim/logistics.ts)
import * as logistics from '../src/sim/logistics';
const RULES = (logistics as unknown as { RULES?: { arrive: number; topUp: number } }).RULES;
if (RULES) { RULES.arrive = Number(process.env.RULE_ARRIVE ?? 0); RULES.topUp = Number(process.env.RULE_TOPUP ?? 0); }

// NOHINT=1: measure the build ghost without the missions' authored sites (before D-107)
if (process.env.NOHINT) for (const m of Object.values(MISSIONS)) delete m.siteHints;

const col = (w: World, x: number, y1: number, y2: number): number[] => lineCells(w.terrain.w, y1 * w.terrain.w + x, y2 * w.terrain.w + x);
const row = (w: World, y: number, x1: number, x2: number): number[] => lineCells(w.terrain.w, y * w.terrain.w + x1, y * w.terrain.w + x2);
export const stableOf = (w: World): number => w.state.buildings.find((b) => b.type === 'stable')!.id;

/** The intended fix of each mission (docs/missions/mN.md), as commands. m11's and m13's lessons are wagons only. */
export const LESSON: Record<string, (w: World) => Command[]> = {
  m1: (w) => [{ t: 'road', surface: 1, cells: col(w, 41, 24, 44) }],
  m2: (w) => [{ t: 'road', surface: 2, cells: col(w, 51, 30, 42) }],
  m3: (w) => [{ t: 'road', surface: 2, cells: row(w, 40, 32, 80) }],
  m4: (w) => [{ t: 'road', surface: 2, cells: col(w, 51, 30, 42) }],
  m5: (w) => [{ t: 'road', surface: 1, cells: col(w, 37, 38, 39) }],
  m6: (w) => [{ t: 'road', surface: 1, cells: col(w, 37, 38, 39) }],
  m7: () => [{ t: 'place', type: 'fisher', ...M7_FISHER_SITE }],
  m8: (w) => [{ t: 'road', surface: 2, cells: row(w, M8_LANE.y, M8_LANE.x1, M8_LANE.x2) }],
  m9: () => [{ t: 'place', type: 'woodcutter', ...M9_WOODCUTTER_SITE }],
  m10: () => [{ t: 'place', type: 'woodcutter', ...M10_SECOND_WOODCUTTER }],
  m11: () => [],
  m12: (w) => [{ t: 'road', surface: 1, cells: col(w, M12_GRANARY_LINK.x, M12_GRANARY_LINK.y1, M12_GRANARY_LINK.y2) }],
  m13: () => [],
  // XIV's second charcoal burner by the forest, XV's granary by the castle (D-210)
  m14: (w) => [
    { t: 'place', type: 'charcoalBurner', ...M14_BURNER_SITE }, { t: 'road', surface: 1, cells: col(w, M14_BURNER_SITE.x + 1, 40, 41) },
  ],
  m15: (w) => [{ t: 'place', type: 'warehouse', ...M15_GRANARY_SITE }, { t: 'road', surface: 1, cells: col(w, M15_GRANARY_SITE.x + 1, 40, 41) }],
  // XVI: the castle with the early deadline first (D-289)
  m16: (w) => [{ t: 'castleFirst', castle: w.state.mission.contract!.castle }],
};

/** The tempting wrong fix of missions XIV-XV: the same building at the wrong end of the road. */
export const WRONG: Record<string, (w: World) => Command[]> = {
  m14: (w) => [
    { t: 'place', type: 'charcoalBurner', ...M14_WRONG_SITE }, { t: 'road', surface: 1, cells: col(w, M14_WRONG_SITE.x + 1, 39, 40) },
  ],
  m15: (w) => [{ t: 'place', type: 'warehouse', ...M15_WRONG_SITE }, { t: 'road', surface: 1, cells: col(w, M15_WRONG_SITE.x + 1, 40, 41) }],
  // XVI: the castle with the late deadline first
  m16: (w) => [{ t: 'castleFirst', castle: w.state.mission.extraContracts![0]!.castle }],
};

export interface Row {
  mission: string; strat: string; result: string; minutes: number; seals: number;
  /** Seconds left to the 3- and 2-seal thresholds (negative: missed by that much); deadline likewise. */
  m3: number; m2: number; mDead: number;
  late: number; coins: number; wagons: number; actions: Record<string, number>; hash: string;
  /** eye players: what the worst-stall card showed at each look, "status/cure" -> count. */
  seen?: Record<string, number>;
  /** eye players: "second action" list. */
  tl?: string[];
}

type Player = (w: World) => void;

/** The app's contract pace log per world (sampled every tick, as App.onTick does): the pace card reads it. */
const paceLogs = new WeakMap<World, PaceLog>();
/** PACE=0: measure without the pace card (day 8c), as before. */
const PACE_CARD = process.env.PACE !== '0';
/** FLEET=0: measure without the pace card's fleet kind (day 9a, D-127). */
const FLEET_CARD = process.env.FLEET !== '0';
/** EYE_PHASE=s: the eye players look s seconds later in each period (robustness of a rule against timing). */
const EYE_PHASE = Number(process.env.EYE_PHASE ?? 0);

/** Research probes (day 9g): called after every step of run(). */
export const probe: { onTick: ((w: World) => void) | null } = { onTick: null };

export function run(id: string, strat: string, player: Player, actions: Record<string, number> = {}, seen?: Record<string, number>): Row {
  const w = createWorld(id);
  const log = newPaceLog();
  paceLogs.set(w, log);
  let guard = 30 * 60 * TICK_HZ;
  while (w.state.mission.result === 'running' && guard-- > 0) {
    player(w);
    step(w);
    sampleInputWaits(w); // as the app does every tick (the shared-supply card waits 30 s, D-110)
    samplePace(log, w);
    sampleFleet(w); // as the app does every tick (the fleet card reads the last minute, D-127)
    probe.onTick?.(w);
  }
  const c = w.state.mission.contract!;
  const end = w.state.mission.result === 'won' ? w.state.mission.endTick : c.deadlineTick + 1;
  return {
    mission: id, strat, result: w.state.mission.result, minutes: w.state.mission.endTick / TICK_HZ / 60, seals: stars(w),
    m3: (c.star3Tick - end) / TICK_HZ, m2: (c.star2Tick - end) / TICK_HZ, mDead: (c.deadlineTick - end) / TICK_HZ,
    late: c.tranches.filter((t) => t.missed).length, coins: w.state.coins, wagons: w.state.wagons.length, actions, hash: stateHash(w),
    ...(seen ? { seen } : {}),
  };
}

/** k wagons at 0:00, then `fix` from second `at` on, retried once a second until every command applies. */
function scripted(w0: { k: number; at: number; fix: ((w: World) => Command[]) | null }, actions: Record<string, number>): Player {
  let done = w0.fix === null;
  return (w) => {
    const t = w.state.tick;
    if (t === 0) for (let i = 0; i < w0.k; i++) if (applyCommand(w, { t: 'buyWagon', stable: stableOf(w) }).ok) actions.wagon = (actions.wagon ?? 0) + 1;
    if (!done && t >= w0.at * TICK_HZ && t % TICK_HZ === 0) {
      const cmds = w0.fix!(w);
      if (cmds.length === 0) { done = true; return; }
      // all-or-nothing: try the first; a failure (no stone yet, no coins) waits for the next second
      const r = applyCommand(w, cmds[0]!);
      if (r.ok) {
        for (const c of cmds.slice(1)) applyCommand(w, c);
        actions.fix = t / TICK_HZ;
        done = true;
      }
    }
  };
}

/** Try placing `type` near (x, y), spiralling out; returns the new building id or -1. */
function placeNear(w: World, type: BuildingType, x: number, y: number): number {
  for (let r = 2; r <= 14; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        for (let f = 0; f < 4; f++) {
          const before = w.state.buildings.length;
          if (applyCommand(w, { t: 'place', type, x: x + dx, y: y + dy, facing: f }).ok) {
            const b = w.state.buildings[before]!;
            const link = suggestLinkToStable(w, b.id);
            if (link && link.cells.length) {
              if (!applyCommand(w, { t: 'road', surface: 1, cells: link.cells }).ok) {
                // cannot afford the link: undo is a demolish (refund while fresh)
                applyCommand(w, { t: 'demolish', cell: b.gate });
                continue;
              }
            }
            return b.id;
          }
        }
      }
    }
  }
  return -1;
}

const cellXY = (w: World, c: number): [number, number] => [c % w.terrain.w, Math.floor(c / w.terrain.w)];

/** Where the game's build ghost starts after "Naprawa" (src/ui/site.ts, D-107): place there and link it like placeNear. */
function placeAtGhost(w: World, type: BuildingType, near: number): number {
  const s = buildSite(w, type, near);
  if (s) {
    const before = w.state.buildings.length;
    if (applyCommand(w, { t: 'place', type, x: s.x, y: s.y, facing: s.facing }).ok) {
      const b = w.state.buildings[before]!;
      const link = suggestLinkToStable(w, b.id);
      if (!link || !link.cells.length || applyCommand(w, { t: 'road', surface: 1, cells: link.cells }).ok) return b.id;
      applyCommand(w, { t: 'demolish', cell: b.gate });
    }
  }
  const src = buildingById(w, near)!;
  const [x, y] = cellXY(w, src.gate);
  return placeNear(w, type, x, y);
}

/** One look at the worst stall card and one tap on what the sheet offers. Returns the action taken or ''. */
/** UI candidates measured by tools/balance-night6-tune.ts (not in the game): a held-bridge card, CONTESTED as critical. */
export const UI_CANDIDATE = { jamCard: false, contestedFirst: false, sharedCard: false };

function eyeTap(w: World, hints: boolean, seen: Record<string, number>, scan = false): string {
  if (UI_CANDIDATE.jamCard) {
    // candidate: a span with a wagon held >= 20 s gets its own card whose fix paves the span in stone
    const held = w.state.wagons.find((q) => (q.status.k === 'BRIDGE_JAM' || q.status.k === 'BRIDGE_CLOSED') && w.state.tick - q.status.since >= 20 * TICK_HZ);
    if (held) {
      const span = (held.status as { span: number }).span, sp = net(w).span;
      const cells: number[] = [];
      for (let i = 0; i < sp.length; i++) if (sp[i] === span) cells.push(i);
      const ok = cells.length > 0 && applyCommand(w, { t: 'road', surface: 2, cells }).ok;
      seen['span:' + held.status.k + (ok ? ' -> stoneBridge' : ' -> fail')] = (seen['span:' + held.status.k + (ok ? ' -> stoneBridge' : ' -> fail')] ?? 0) + 1;
      if (ok) return 'stoneBridge';
    }
  }
  if (UI_CANDIDATE.sharedCard) {
    // candidate: a consumer whose input comes from ONE producer shared with a rival consumer gets a card
    // ("one woodcutter feeds two workshops") whose fix places another producer of that type
    const can = missionBuildable(w.state.mission.id);
    for (const b of w.state.buildings) {
      const sh = sharedInput(w, b.id);
      const src = sh && sh.producers === 1 && sh.consumers >= 2 ? buildingById(w, sh.producer) : null;
      if (src && can !== 'ranked' && can.includes(src.type)) {
        const [x, y] = cellXY(w, src.gate);
        const ok = placeNear(w, src.type, x, y) >= 0;
        seen['shared card -> ' + (ok ? 'producer' : 'fail')] = (seen['shared card -> ' + (ok ? 'producer' : 'fail')] ?? 0) + 1;
        if (ok) return 'producer:' + src.type;
        break;
      }
    }
  }
  const ranked = [...rankStalls(w)];
  if (UI_CANDIDATE.contestedFirst) {
    ranked.sort((a, b) => {
      const ca = buildingById(w, a.id)!.status, cb = buildingById(w, b.id)!.status;
      const ka = ca.k === 'NO_INPUT' && ca.cause === 'CONTESTED' ? 1 : 0, kb = cb.k === 'NO_INPUT' && cb.cause === 'CONTESTED' ? 1 : 0;
      return kb - ka;
    });
  }
  // the pace card (day 8c) takes the slot when no real stall needs it: an empty card or a calm one
  if (PACE_CARD && (!ranked.length || ranked[0]!.minor)) {
    const log = paceLogs.get(w);
    let pc = log ? paceCard(w, forecastFor(w, log), log) : null;
    if (pc?.k === 'fleet' && !FLEET_CARD) pc = null;
    if (pc) {
      const act = tapPace(w, pc);
      const key = `pace:${pc.k} -> ${act || 'nothing'}`;
      seen[key] = (seen[key] ?? 0) + 1;
      if (act && !act.includes('?')) return act;
      if (!scan) return '';
    }
  }
  if (!ranked.length) { seen['(no card)'] = (seen['(no card)'] ?? 0) + 1; return ''; }
  // scan: the alarm seal cycles through every pin; tap the first whose sheet offers something
  for (const e of scan ? ranked : ranked.slice(0, 1)) {
    const a = tapOne(w, e, hints, seen);
    if (a) return a;
  }
  return '';
}

/** The pace card's sheet button (day 8c). */
function tapPace(w: World, pc: NonNullable<ReturnType<typeof paceCard>>): string {
  if (pc.k === 'producer') return placeAtGhost(w, pc.type, pc.producer) >= 0 ? 'producer:' + pc.type : 'producer?fail';
  // fleet (day 9a): the producer's sheet offers "Kup wóz"
  if (pc.k === 'fleet') return applyCommand(w, { t: 'buyWagon', stable: stableOf(w) }).ok ? 'wagon:fleet' : 'wagon?fail';
  // haul (two castles, D-307): the shared producer's sheet offers "Kup wóz"
  if (pc.k === 'haul') return applyCommand(w, { t: 'buyWagon', stable: stableOf(w) }).ok ? 'wagon:haul' : 'wagon?fail';
  // rank (D-152, free valley only): the castle's sheet opens the build tool by the castle
  if (pc.k === 'rank') return placeAtGhost(w, pc.type, pc.producer) >= 0 ? 'rank:' + pc.type : 'rank?fail';
  // grow (D-192, free valley only): the same, one more producer of a standing chain
  if (pc.k === 'grow') return placeAtGhost(w, pc.type, pc.producer) >= 0 ? 'grow:' + pc.type : 'grow?fail';
  // post (D-245, free valley only): never in a mission
  if (pc.k === 'post') return '';
  // two castles (D-290): the late castle's sheet holds the switch — one tap puts it first
  if (pc.k === 'castle') return applyCommand(w, { t: 'castleFirst', castle: pc.producer }).ok ? 'castleFirst' : 'castleFirst?fail';
  // mud: the cobble button only when the forecast misses three seals; otherwise the sheet only says so
  if (!pc.risk) return '';
  const r = applyCommand(w, { t: 'road', surface: 2, cells: pc.cells });
  return r.ok ? 'cobbleMud' : 'cobbleMud?fail:' + ((r as { err?: { k?: string } }).err?.k ?? '');
}

function tapOne(w: World, top: ReturnType<typeof rankStalls>[number], hints: boolean, seen: Record<string, number>): string {
  const b = buildingById(w, top.id)!;
  const chain = explainBuilding(w, b.id, 5, true);
  const s = b.status as { k: string; cause?: string };
  const tag = `${b.type}:${s.k}${s.cause ? '.' + s.cause : ''}${top.minor ? '(calm)' : ''}`;
  const target = gapTarget(w, chain.length ? chain : [{ kind: 'building', id: b.id, status: b.status }]);
  let act = '';
  if (target >= 0) {
    const sug = suggestLinkToStable(w, target);
    if (sug && applyCommand(w, { t: 'road', surface: 1, cells: sug.cells }).ok) act = 'road';
    else act = sug ? 'road?nocoins' : 'road?none';
  } else {
    const cure = cureFor(w, b.id);
    if (cure === 'wagon') act = applyCommand(w, { t: 'buyWagon', stable: stableOf(w) }).ok ? 'wagon' : 'wagon?nocoins';
    else if (cure === 'pave') {
      // the held-span card (night 6, P4 in the game): pave the span in stone
      // (or, day 8c, the span the ice will close when one more wagon would cost the stone bridge)
      const h = paveSpanFor(w, b)!;
      act = applyCommand(w, { t: 'road', surface: 2, cells: h.cells }).ok ? (h.held ? 'stoneBridge' : 'stoneBridge:iceAhead') : 'stoneBridge?fail';
    }
    else if (cure === 'producer') {
      // the shared-supply card (night 6, P5 in the game): build another producer of that type by the first one
      const src = buildingById(w, sharedOneProducer(w, b)!.producer)!;
      act = placeAtGhost(w, src.type, src.id) >= 0 ? 'producer:' + src.type : 'producer?fail';
    }
    else if (cure === 'granary') {
      const can = missionBuildable(w.state.mission.id);
      if (can !== 'ranked' && can.includes('warehouse')) {
        const root = chain.length ? chain[chain.length - 1]! : null;
        const rb = root && root.kind === 'building' ? buildingById(w, root.id)! : b;
        const [x, y] = cellXY(w, rb.gate);
        // a mission with an authored granary site (research XV) opens the ghost there, as the game's build tool does
        const hinted = missionSiteHint(w.state.mission.id, 'warehouse') !== null;
        act = (hinted ? placeAtGhost(w, 'warehouse', rb.id) : placeNear(w, 'warehouse', x, y)) >= 0 ? 'granary' : 'granary?fail';
      } else act = 'granary?hint-only';
    } else if (hints) {
      // text hints of the sheet: a held bridge (jam / ice) -> pave its span; one producer shared -> one more
      const held = chain.find((l) => l.kind === 'wagon' && (l.status.k === 'BRIDGE_JAM' || l.status.k === 'BRIDGE_CLOSED'));
      if (held && held.kind === 'wagon') {
        const span = (held.status as { span: number }).span;
        const sp = net(w).span;
        const cells: number[] = [];
        for (let i = 0; i < sp.length; i++) if (sp[i] === span) cells.push(i);
        if (cells.length) act = applyCommand(w, { t: 'road', surface: 2, cells }).ok ? 'stoneBridge' : 'stoneBridge?fail';
      } else {
        const sh = sharedInput(w, b.id);
        const th = thinDelivery(w, b.id);
        const src = sh && sh.producers === 1 && sh.producer >= 0 ? buildingById(w, sh.producer) : th ? buildingById(w, th.source) : null;
        const can = missionBuildable(w.state.mission.id);
        if (src && can !== 'ranked' && can.includes(src.type)) {
          // the build tool's ghost starts at the authored site (D-107), as for the card's button
          act = placeAtGhost(w, src.type, src.id) >= 0 ? 'producer:' + src.type : 'producer?fail';
        }
      }
    }
    if (!act) act = cure ? `${cure}?` : '';
  }
  const key = `${tag} -> ${act || 'nothing'}`;
  seen[key] = (seen[key] ?? 0) + 1;
  return act.includes('?') ? '' : act;
}

export const timeline: string[] = [];
export function eyePlayer(reactSec: number, hints: boolean, actions: Record<string, number>, seen: Record<string, number>, letter?: (w: World) => Command[], scan = false, phase = EYE_PHASE): Player {
  timeline.length = 0;
  const letterP = letter ? scripted({ k: 0, at: 60, fix: letter }, actions) : null;
  return (w) => {
    if (letterP) letterP(w);
    const t = w.state.tick;
    if (t > 0 && t % (reactSec * TICK_HZ) === (phase % reactSec) * TICK_HZ) {
      const a = eyeTap(w, hints, seen, scan);
      if (a) { actions[a] = (actions[a] ?? 0) + 1; timeline.push(`${t / TICK_HZ}s ${a}`); }
    }
  };
}

export function survey(id: string, search = true): Row[] {
  const out: Row[] = [];
  out.push(run(id, 'passive', () => {}));
  // wagons only
  let bestW: Row | null = null;
  for (let k = 1; k <= 8; k++) {
    const a: Record<string, number> = {};
    const r = run(id, `wagons-${k}`, scripted({ k, at: 0, fix: null }, a), a);
    if ((a.wagon ?? 0) < k) break;
    if (!bestW || r.minutes < bestW.minutes || (bestW.result !== 'won' && r.result === 'won')) bestW = r;
  }
  if (bestW) out.push({ ...bestW, strat: `wagons-only best (${bestW.strat})` });
  if (search && LESSON[id]!(createWorld(id)).length) {
    let best: Row | null = null;
    const times = [0, 10, 20, 30, 45, 60];
    for (const at of times) {
      for (let k = 0; k <= 8; k++) {
        const a: Record<string, number> = {};
        const r = run(id, `lesson@${at}s+${k}w`, scripted({ k, at, fix: LESSON[id]! }, a), a);
        if ((a.wagon ?? 0) < k) break;
        if (a.fix === undefined) continue;
        if (r.result === 'won' && (!best || r.minutes < best.minutes)) best = r;
        if (at === 0 && k === 0) out.push({ ...r, strat: 'lesson only @0:00' });
      }
    }
    if (best) out.push({ ...best, strat: `optimum (${best.strat})` });
  }
  for (const react of [10, 30, 60]) {
    for (const hints of [false, true]) {
      const a: Record<string, number> = {}, seen: Record<string, number> = {};
      out.push({ ...run(id, `${hints ? 'eye+' : 'eye'}-${react}s`, eyePlayer(react, hints, a, seen), a, seen), tl: [...timeline] });
    }
  }
  {
    const a: Record<string, number> = {}, seen: Record<string, number> = {};
    out.push({ ...run(id, 'scan+-30s', eyePlayer(30, true, a, seen, undefined, true), a, seen), tl: [...timeline] });
  }
  if (LESSON[id]!(createWorld(id)).length) {
    const a: Record<string, number> = {}, seen: Record<string, number> = {};
    out.push({ ...run(id, 'letter@1:00+eye+-30s', eyePlayer(30, true, a, seen, LESSON[id]!), a, seen), tl: [...timeline] });
  }
  return out;
}

const fmt = (s: number): string => (s >= 0 ? '+' : '−') + Math.abs(Math.round(s)) + 's';

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const ji = args.indexOf('--json');
  const jsonOut = ji >= 0 ? args[ji + 1] : null;
  const search = !args.includes('--no-search');
  const ids = args.filter((a, i) => /^m\d+$/.test(a) && (ji < 0 || i !== ji + 1));
  const all: Row[] = [];
  for (const id of ids.length ? ids : Object.keys(LESSON).filter((k) => k in MISSIONS)) {
    const d = MISSIONS[id]!;
    console.log(`\n== ${id}  star3 ${d.star3Min} min, star2 ${d.star2Min} min, deadline ${d.deadlineMin} min, coins ${d.coins}, wagons ${d.wagons}`);
    for (const r of survey(id, search)) {
      all.push(r);
      console.log(`${r.strat.padEnd(34)} ${r.result.padEnd(4)} ${r.minutes.toFixed(2).padStart(6)} min  seals ${r.seals}  ` +
        `to3 ${fmt(r.m3).padStart(6)} to2 ${fmt(r.m2).padStart(6)}${r.late ? ' late ' + r.late : ''}  coins ${r.coins} wagons ${r.wagons} ${JSON.stringify(r.actions)}`);
      if (r.seen) {
        const top = Object.entries(r.seen).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${v}x ${k}`).join(' | ');
        console.log(`    card: ${top}`);
        if (r.tl && r.tl.length) console.log(`    acts: ${r.tl.slice(0, 12).join(', ')}${r.tl.length > 12 ? ' …' : ''}`);
      }
    }
  }
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(all, null, 1));
}
