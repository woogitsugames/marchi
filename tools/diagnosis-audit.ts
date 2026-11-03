// Diagnosis audit (research 2026-11-03): for missions m1-m12 and the free valley, play the bots'
// strategies and every 30 s of game time look at the stall the player sees first (HUD worst-stall
// card, rankStalls()[0]): its cause chain, the root status, the codex entry, what the "Dlaczego stoi?"
// sheet offers (rendered headless in Polish via the real panels.ts) and whether that offer clears
// the stall. Efficacy: fork the state, apply the offered command (or a counterfactual: one more wagon,
// the mission's lesson fix), run 60 s, compare with an untouched fork.
// Read-only: never touches src/. Run through the bundler (i18n uses import.meta.glob):
//   node tools/diagnosis-audit-run.mjs [m1 m5 sandbox ...] [--quick] [--case=nic@390]
// Output: JSON samples in $AUDIT_OUT_DIR (default /tmp), a markdown summary on stdout.
(globalThis as { document?: unknown }).document = { documentElement: { dataset: {} } };
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setLang, t, type MessageKey } from '../src/i18n/index';
import {
  BUILDINGS, TICK_HZ, WAGON_PRICE, applyCommand, buildingById, createWorld, explainBuilding, lineCells, newPaceLog,
  samplePace, step, stoneAvailable, validatePlace, findPath, suggestConnection, inputGoods, outputGoods, sumGoods, marketOpen, STONE_RESERVE,
  type Command, type ReasonLink, type World,
} from '../src/sim/index';
import { storeCapOf } from '../src/sim/contract';
import { rankStalls, cureFor } from '../src/ui/stalls';
import { codexKey } from '../src/ui/codex';
import { STALL_CODEX } from '../src/content/stallCodex';
import { buildingSheet, gapTarget, gapSuggestion } from '../src/ui/panels';
import { buildingStatusText, isStall, isWagonWait } from '../src/ui/format';
import { plans } from './balance';
import { STRATEGIES as S789 } from './bot-missions-7-9';
import { STRATEGIES as S1012, WRONG_FIXES } from './bot-missions-10-12';
import { DECENT, runSandbox } from './bot-sandbox';

const SAMPLE_TICKS = 30 * TICK_HZ;
const HORIZON = 60 * TICK_HZ;
const OUT = process.env.AUDIT_OUT_DIR ?? '/tmp';
const args = process.argv.slice(2);
const quick = args.includes('--quick');
const only = args.filter((a) => !a.startsWith('--'));
/** --case=<scenario>@<second>: print that sample in full (chain, probes, Polish HUD and sheet text). */
const caseArg = args.find((a) => a.startsWith('--case='))?.slice(7) ?? null;

interface Action { at: number; whenStone?: number; cmds: (w: World) => Command[] }
interface Scenario { mission: string; name: string; actions: Action[]; lesson: Action[] | null }

// ------------------------------------------------------------------ scenarios from the existing bots

const byName = (id: string, re: RegExp) => plans[id]!.find((p) => re.test(p.name))!;
const fromPlan = (id: string, re: RegExp): Action[] => { const p = byName(id, re); return [{ at: p.at, cmds: p.cmds }]; };
const SCEN: Scenario[] = [];
const LESSON_M1_6: Record<string, RegExp> = {
  m1: /bridge \+ 2 wagons/, m2: /stone bridge/, m3: /cobble/, m4: /before ice/, m5: /connect granary \+ 1 wagon/, m6: /^connect big granary @0:30/,
};
for (const id of ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']) {
  const lesson = fromPlan(id, LESSON_M1_6[id]!);
  SCEN.push({ mission: id, name: 'nic', actions: [], lesson });
  SCEN.push({ mission: id, name: 'lekcja', actions: lesson, lesson: null });
  if (id === 'm5' || id === 'm6') SCEN.push({ mission: id, name: 'wóz', actions: fromPlan(id, /^buy 1 wagon/), lesson });
}
for (const id of ['m7', 'm8', 'm9'] as const) {
  const right = S789[id].find((s) => s.name.startsWith('wlasciwa'))!;
  const lesson: Action[] = [...(right.setup ? [{ at: right.setup.after, cmds: right.setup.cmds }] : []), { at: right.after, whenStone: right.whenStone, cmds: right.cmds }];
  SCEN.push({ mission: id, name: 'nic', actions: [], lesson });
  SCEN.push({ mission: id, name: 'lekcja', actions: lesson, lesson: null });
}
for (const id of ['m10', 'm11', 'm12'] as const) {
  const right = S1012[id].find((s) => s.name.startsWith('wlasciwa'))!;
  const lesson: Action[] = [{ at: right.after, cmds: right.cmds }];
  SCEN.push({ mission: id, name: 'nic', actions: [], lesson });
  SCEN.push({ mission: id, name: 'lekcja', actions: lesson, lesson: null });
  for (const wf of WRONG_FIXES[id]) SCEN.push({ mission: id, name: 'zły: 2 wozy', actions: [{ at: wf.after, cmds: wf.cmds }], lesson });
}
SCEN.push({ mission: 'sandbox', name: 'DECENT', actions: [], lesson: null });

// ------------------------------------------------------------------ helpers

function fork(w: World): World {
  return { terrain: w.terrain, state: structuredClone(w.state), cache: null, scratch: null, seasons: w.seasons };
}

/** Clear = stalledTicks 0 for 5 s in a row (a one-tick flicker is not a cure). */
const STREAK = 5 * TICK_HZ;
/** Ticks until the building's stall clears within the horizon (start of the streak), -1 when it does not. */
function clearTime(w: World, id: number): number {
  let streak = 0;
  for (let i = 1; i <= HORIZON + STREAK; i++) {
    step(w);
    if (w.state.mission.result !== 'running') return streak > 0 ? i - streak : i; // mission ended (won): cleared
    const b = buildingById(w, id);
    if (!b || b.stalledTicks === 0) { if (++streak >= STREAK) return i - streak + 1; }
    else { streak = 0; if (i > HORIZON) break; }
  }
  return -1;
}

/** Fleet by status (BRIDGE_JAM etc. explain an ALL_BUSY better than "buy a wagon"). */
function fleet(w: World): Record<string, number> {
  const f: Record<string, number> = {};
  for (const q of w.state.wagons) f[q.status.k] = (f[q.status.k] ?? 0) + 1;
  return f;
}

/** Apply commands in a fork (coins topped up so efficacy is measured apart from affordability). */
function tryCmds(w: World, id: number, cmds: (f: World) => Command[] | null): { ok: boolean; err?: string; ttc: number } {
  const f = fork(w);
  f.state.coins += 10000;
  const list = cmds(f);
  if (!list) return { ok: false, err: 'no-command', ttc: -1 };
  for (const c of list) {
    const r = applyCommand(f, c);
    if (!r.ok) return { ok: false, err: r.err.k, ttc: -1 };
  }
  return { ok: true, ttc: clearTime(f, id) };
}

const stableOf = (w: World) => w.state.buildings.find((b) => b.type === 'stable')!.id;

/** The granary cure in a fork: first valid warehouse spot by distance from the building, linked by the cheapest road. */
function granaryCmds(w: World, id: number): Command[] | null {
  const b = buildingById(w, id)!;
  const cx = b.x + (b.w >> 1), cy = b.y + (b.h >> 1);
  const spots: [number, number, number, number][] = [];
  for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) for (let f = 0; f < 4; f++) spots.push([dx * dx + dy * dy, cx + dx, cy + dy, f]);
  spots.sort((a, c) => a[0] - c[0]);
  for (const [, x, y, facing] of spots) {
    if (!validatePlace(w, 'warehouse', x, y, facing).ok) continue;
    const g = fork(w);
    g.state.coins += 10000;
    if (!applyCommand(g, { t: 'place', type: 'warehouse', x, y, facing }).ok) continue;
    const nb = g.state.buildings[g.state.buildings.length - 1]!;
    const cmds: Command[] = [{ t: 'place', type: 'warehouse', x, y, facing }];
    if (!findPath(g, b.gate, nb.gate, true)) {
      const s = suggestConnection(g, b.gate, nb.gate);
      if (!s || s.newCells.length === 0 || s.newCells.length > 12) continue;
      cmds.push({ t: 'road', surface: 1, cells: s.cells });
    }
    return cmds;
  }
  return null;
}

// ------------------------------------------------------------------ headless sheet

const el = () => ({ innerHTML: '', textContent: '', addEventListener() { /* headless */ } }) as unknown as HTMLElement;
const strip = (h: string) => h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

function renderSheet(w: World, id: number, pace: ReturnType<typeof newPaceLog>): { html: string; text: string } {
  const sheet = { icon: el(), kicker: el(), title: el(), body: el() } as unknown as Parameters<ReturnType<typeof buildingSheet>['update']>[0];
  const nav = { world: w, pace, setGhost() { /* */ }, go() { /* */ }, buyWagon() { /* */ }, sellWagon() { /* */ }, toggleFollow() { /* */ }, following: () => null, buildRoad() { /* */ }, undoPlace() { /* */ }, pickBuild() { /* */ } };
  buildingSheet(nav as never, id).update(sheet);
  const html = (sheet.body as unknown as { innerHTML: string }).innerHTML;
  return { html, text: `${(sheet.kicker as unknown as { textContent: string }).textContent} | ${(sheet.title as unknown as { textContent: string }).textContent} | ${strip(html)}` };
}

/** The HUD card line (hud.ts stallReason, not exported): cause.K.CAUSE / cause.K, else the status text. */
function hudReason(w: World, id: number): string {
  const b = buildingById(w, id)!;
  const s = b.status;
  const cause = 'cause' in s ? s.cause : null;
  for (const k of [cause ? `cause.${s.k}.${cause}` : '', `cause.${s.k}`]) {
    if (!k) continue;
    const v = t(k as MessageKey);
    if (v !== k) return v;
  }
  return buildingStatusText(s, w);
}

/** What the sheet offers, read from its rendered HTML (same source the player sees). */
function offers(html: string): string[] {
  const o: string[] = [];
  if (/data-act="fix:/.test(html)) o.push(/fix-btn is-disabled/.test(html) && /data-act="fix:/.test(html) ? 'road-fix(no coins)' : 'road-fix');
  if (/data-act="buy:/.test(html) && /fix-btn/.test(html)) o.push('wagon-btn');
  if (/data-act="granary:/.test(html)) o.push('granary-btn');
  if (/granary-hint/.test(html)) o.push('granary-hint');
  if (/jam-hint/.test(html)) o.push('jam-hint');
  if (/ice-hint/.test(html)) o.push('ice-hint');
  if (/season-hint/.test(html)) o.push('season-hint');
  if (/shared-hint/.test(html)) o.push('shared-hint');
  if (/thin-hint/.test(html)) o.push('thin-hint');
  return o;
}

const linkKey = (l: ReasonLink) => codexKey(l.kind, l.status);
const linkStr = (w: World, l: ReasonLink) => {
  const who = l.kind === 'building' ? `${buildingById(w, l.id)?.type ?? '?'}#${l.id}` : `wagon#${l.id}`;
  const g = (l.status as { good?: string }).good;
  return `${who}:${linkKey(l).replace(/^status\./, '')}${g ? `(${g})` : ''}${l.kind === 'building' && l.waits ? '[CUSTOMER]' : ''}`;
};
const rootIsStall = (l: ReasonLink) => l.kind === 'building' ? isStall(l.status) || l.status.k === 'NO_INPUT' : isWagonWait(l.status);

/**
 * Status-specific probes behind the findings: does a stronger version of the cure help (three wagons,
 * 120 s), is the stall harmless (consumers fed, contract satisfied, another granary has room), is the
 * fleet held at a bridge, can the stable reach any source of an ALL_BUSY input at all.
 */
function probe(w: World, id: number): Record<string, unknown> {
  const b = buildingById(w, id)!;
  const s = b.status;
  const st = w.state;
  const out: Record<string, unknown> = {};
  const held = st.wagons.filter((q) => q.status.k === 'BRIDGE_CLOSED' || q.status.k === 'BRIDGE_JAM' || q.status.k === 'NO_ROUTE').length;
  out.held = `${held}/${st.wagons.length}`;
  if (s.k === 'OUTPUT_FULL' && s.cause === 'NO_WAGON') {
    out.wagon3 = tryCmds(w, id, (f) => [0, 1, 2].map(() => ({ t: 'buyWagon', stable: stableOf(f) }) as Command)).ttc;
    const f = fork(w); f.state.coins += 10000; applyCommand(f, { t: 'buyWagon', stable: stableOf(f) });
    let t120 = -1;
    for (let i = 1; i <= 2 * HORIZON; i++) { step(f); if (buildingById(f, id)!.stalledTicks === 0) { t120 = i; break; } }
    out.wagon1_120 = t120;
    // consumers of the good: hungry ones (waiting for it) mean the stall hurts; fed ones mean overproduction
    const g = s.good;
    const cons = st.buildings.filter((c) => inputGoods(c.type).includes(g) || (c.type === 'castle' && st.mission.contract && st.mission.contract.need[g] > c.stock[g]));
    out.consumers = cons.map((c) => `${c.type}#${c.id}:${c.status.k}${(c.status as { good?: string }).good === g ? '' : '*'}`).join(' ');
    out.hungry = cons.some((c) => (c.status as { good?: string }).good === g && ['NO_INPUT', 'NO_WAGON', 'WAITING_UPSTREAM'].includes(c.status.k));
    out.contractNeeds = !!(st.mission.contract && st.mission.contract.need[g] > 0);
  }
  if (s.k === 'STORAGE_FULL') {
    const others = st.buildings.filter((q) => q.type === 'warehouse' && q.id !== id);
    out.otherGranaries = others.map((q) => `#${q.id}:${q.status.k}:${sumGoods(q.stock)}/${storeCapOf(q)}`).join(' ');
    out.unlinkedGranary = others.some((q) => q.status.k === 'NO_ROAD');
    out.roomElsewhere = others.some((q) => q.status.k !== 'NO_ROAD' && sumGoods(q.stock) + sumGoods(q.incoming) < storeCapOf(q) && findPath(w, b.gate, q.gate, true));
    out.stock = Object.entries(b.stock).filter(([, n]) => n > 0).map(([g, n]) => `${g}=${n}`).join(',');
  }
  if (s.k === 'OUTPUT_FULL' && s.cause === 'NO_DESTINATION') {
    const k = st.mission.contract;
    out.contractDone = !!k && k.need[s.good] > 0 && (buildingById(w, k.castle)?.stock[s.good] ?? 0) >= k.need[s.good];
    out.contractNeeds = !!k && k.need[s.good] > 0;
  }
  if (s.k === 'NO_WAGON' && s.cause === 'ALL_BUSY') {
    const stable = buildingById(w, stableOf(w))!;
    const g = s.good;
    const srcs = st.buildings.filter((q) => q.id !== id && (q.type === 'warehouse' || outputGoods(q.type).includes(g)) && q.stock[g] - q.reservedOut[g] > 0);
    out.sources = srcs.length;
    out.stableReachesSource = srcs.some((q) => !!findPath(w, stable.gate, q.gate, false));
  }
  return out;
}

// ------------------------------------------------------------------ sampling

export interface Sample {
  mission: string; scenario: string; tick: number; sec: number;
  worst: string | null; crit?: boolean; ownKey?: string; chain?: string[]; rootKey?: string; rootStall?: boolean;
  codex?: boolean; offers?: string[]; cure?: string | null; hud?: string; sheet?: string;
  /** Efficacy (ticks to clear, -1 none; null = not applicable). */
  ctrl?: number; cureTry?: { ok: boolean; err?: string; ttc: number } | null;
  wagonTry?: { ok: boolean; err?: string; ttc: number }; lessonTry?: { ok: boolean; err?: string; ttc: number } | null;
  extra?: Record<string, unknown>;
  /** Worst stall under the proposed calm rules (estimate, see harmless()). */
  after?: { worst: string; crit: boolean } | null;
  coins?: number; fleet?: Record<string, number>; fix?: { cells: number; newCells: number; bridge: number; cost: number; target: string } | null;
}

/**
 * Estimate of fixes 1, 3 and 5 of the report (not in src/): a stall is calm, not critical, when it is
 * harmless — a full output nobody is short of (contract missions), a full granary with room in another
 * reachable one, a full output whose contract good is already delivered in full.
 */
function harmless(w: World, id: number): boolean {
  const b = buildingById(w, id)!;
  const s = b.status, st = w.state;
  const k = st.mission.contract;
  if (s.k === 'OUTPUT_FULL' && s.cause === 'NO_WAGON') {
    if (marketOpen(w)) return false;
    const g = s.good;
    if (k && k.need[g] > (buildingById(w, k.castle)?.stock[g] ?? 0)) return false;
    if (g === 'stone' && st.mission.roadStone && st.buildings.some((q) => q.type === 'warehouse' && q.stock.stone + q.incoming.stone < STONE_RESERVE)) return false;
    return !st.buildings.some((c) => c.id !== id && inputGoods(c.type).includes(g) && (c.status as { good?: string }).good === g &&
      ['NO_INPUT', 'NO_WAGON', 'WAITING_UPSTREAM'].includes(c.status.k));
  }
  if (s.k === 'STORAGE_FULL') {
    return st.buildings.some((q) => q.type === 'warehouse' && q.id !== id && q.status.k !== 'NO_ROAD' &&
      sumGoods(q.stock) + sumGoods(q.incoming) < storeCapOf(q) && !!findPath(w, b.gate, q.gate, true));
  }
  if (s.k === 'OUTPUT_FULL' && s.cause === 'NO_DESTINATION') {
    return !!k && k.need[s.good] > 0 && (buildingById(w, k.castle)?.stock[s.good] ?? 0) >= k.need[s.good];
  }
  return false;
}

function sample(w: World, sc: Scenario, pace: ReturnType<typeof newPaceLog>, lessonDone: boolean): Sample {
  const base: Sample = { mission: sc.mission, scenario: sc.name, tick: w.state.tick, sec: w.state.tick / TICK_HZ, worst: null, coins: w.state.coins };
  const r = rankStalls(w);
  // the same ranking with the proposed calm rules (weights as in stalls.ts: crit 3, normal 1, minor 0.25)
  const alt = r.map((e) => {
    const calm = harmless(w, e.id);
    const crit = e.crit && !calm, minor = e.minor || calm;
    return { id: e.id, crit, score: e.ticks * (crit ? 3 : minor ? 0.25 : 1) };
  }).sort((a, c) => c.score - a.score || a.id - c.id);
  base.after = alt.length ? { worst: `${buildingById(w, alt[0]!.id)!.type}#${alt[0]!.id}:${codexKey('building', buildingById(w, alt[0]!.id)!.status).replace(/^status\./, '')}`, crit: alt[0]!.crit } : null;
  if (!r.length) return base;
  const e = r[0]!, b = buildingById(w, e.id)!;
  const chain = explainBuilding(w, b.id, 5, true);
  const root = chain.length > 1 ? chain[chain.length - 1]! : { kind: 'building' as const, id: b.id, status: b.status };
  const sheet = renderSheet(w, b.id, pace);
  const off = offers(sheet.html);
  const cure = cureFor(w, b.id);
  const ctrl = clearTime(fork(w), b.id);
  // the offered action, as the button would apply it
  let cureTry: Sample['cureTry'] = null;
  let fix: Sample['fix'] = null;
  if (off.some((o) => o.startsWith('road-fix'))) {
    const target = gapTarget(w, chain);
    const s = target >= 0 ? gapSuggestion(w, target) : null;
    if (s) fix = { cells: s.cells.length, newCells: s.newCells.length, bridge: s.bridgeCells, cost: s.cost, target: `${buildingById(w, target)?.type}#${target}` };
    cureTry = tryCmds(w, b.id, () => (s ? [{ t: 'road', surface: 1, cells: s.cells }] : null));
  } else if (off.includes('wagon-btn')) cureTry = tryCmds(w, b.id, (f) => [{ t: 'buyWagon', stable: stableOf(f) }]);
  else if (off.includes('granary-btn')) cureTry = tryCmds(w, b.id, (f) => granaryCmds(f, b.id));
  const wagonTry = tryCmds(w, b.id, (f) => [{ t: 'buyWagon', stable: stableOf(f) }]);
  const extra = probe(w, b.id);
  const lessonTry = sc.lesson && !lessonDone
    ? tryCmds(w, b.id, (f) => sc.lesson!.flatMap((a) => a.cmds(f)))
    : null;
  return {
    ...base, worst: `${b.type}#${b.id}`, crit: e.crit, ownKey: codexKey('building', b.status), chain: chain.map((l) => linkStr(w, l)),
    rootKey: linkKey(root), rootStall: rootIsStall(root), codex: !!STALL_CODEX[linkKey(root)], offers: off, cure,
    fleet: fleet(w), fix, extra,
    hud: `${t(`building.${b.type}` as MessageKey)}: ${hudReason(w, b.id)}`, sheet: sheet.text, ctrl, cureTry, wagonTry, lessonTry,
  };
}

function runScenario(sc: Scenario): Sample[] {
  const out: Sample[] = [];
  const pace = newPaceLog();
  if (sc.mission === 'sandbox') {
    runSandbox(DECENT, quick ? 20 : 60, {
      checkEvery: 100000,
      onTick: (w) => {
        samplePace(pace, w);
        if (w.state.tick % SAMPLE_TICKS === 0) out.push(sample(w, sc, pace, true));
      },
    });
    return out;
  }
  const w = createWorld(sc.mission);
  const done = sc.actions.map(() => false);
  const lessonAt = sc.lesson ? 0 : -1;
  void lessonAt;
  while (w.state.mission.result === 'running' && w.state.tick < 25 * 60 * TICK_HZ) {
    sc.actions.forEach((a, i) => {
      if (done[i] || w.state.tick < a.at * TICK_HZ) return;
      if (a.whenStone !== undefined && stoneAvailable(w) < a.whenStone) return;
      for (const c of a.cmds(w)) { const r = applyCommand(w, c); if (!r.ok) console.error(`${sc.mission}/${sc.name}: ${c.t} failed ${r.err.k}`); }
      done[i] = true;
    });
    step(w);
    samplePace(pace, w);
    if (w.state.tick % SAMPLE_TICKS === 0) out.push(sample(w, sc, pace, false));
  }
  return out;
}

// ------------------------------------------------------------------ main

await setLang('pl');
void BUILDINGS; void WAGON_PRICE; void lineCells;
const all: Sample[] = [];
for (const sc of SCEN) {
  if (only.length && !only.includes(sc.mission)) continue;
  const t0 = performance.now();
  const s = runScenario(sc);
  all.push(...s);
  console.error(`${sc.mission} / ${sc.name}: ${s.length} samples, ${s.filter((x) => x.worst).length} with a stall (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
}
const file = join(OUT, `diagnosis-audit${only.length ? '-' + only.join('-') : ''}.json`);
writeFileSync(file, JSON.stringify(all, null, 1));
console.error('wrote ' + file);

if (caseArg) {
  const [sc, sec] = caseArg.split('@');
  for (const s of all.filter((x) => x.scenario === sc && x.sec === Number(sec))) console.log(JSON.stringify(s, null, 1));
  process.exit(0);
}

// summary per mission and scenario (markdown rows for the report)
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '–');
/** The offered command clears the stall within 60 s and at least 10 s before the untouched fork does. */
const works = (s: Sample) => !!s.cureTry && s.cureTry.ok && s.cureTry.ttc >= 0 && (s.ctrl! < 0 || s.cureTry.ttc + 10 * TICK_HZ <= s.ctrl!);
const lessonWorks = (s: Sample) => !!s.lessonTry && s.lessonTry.ok && s.lessonTry.ttc >= 0 && (s.ctrl! < 0 || s.lessonTry.ttc + 10 * TICK_HZ <= s.ctrl!);
const short = (k: string) => k.replace(/^status\./, '');
console.log('| misja / scenariusz | próbek | z postojem | krytyczny | najczęstsze korzenie (udział czasu) | korzeń = prawdziwy postój (kodeks trafny) | przycisk naprawy | wskazówka bez przycisku | naprawa działa | lekcja by zadziałała, gdy brak naprawy |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const key of [...new Set(all.map((s) => `${s.mission}|${s.scenario}`))]) {
  const [m, sc] = key.split('|');
  const ss = all.filter((s) => s.mission === m && s.scenario === sc);
  const st = ss.filter((s) => s.worst);
  const roots = new Map<string, number>();
  for (const s of st) roots.set(s.rootKey!, (roots.get(s.rootKey!) ?? 0) + 1);
  const top = [...roots].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${short(k)} ${pct(n, st.length)}`).join(', ');
  const btn = st.filter((s) => s.cureTry);
  const hintOnly = st.filter((s) => !s.cureTry && (s.offers ?? []).length);
  const noCure = st.filter((s) => !s.cureTry && s.lessonTry);
  console.log(`| ${m} / ${sc} | ${ss.length} | ${st.length} | ${pct(st.filter((s) => s.crit).length, st.length)} | ${top || '–'} | ${pct(st.filter((s) => s.codex && s.rootStall).length, st.length)} | ${pct(btn.length, st.length)} | ${pct(hintOnly.length, st.length)} | ${btn.length ? `${pct(btn.filter(works).length, btn.length)} (${btn.filter(works).length}/${btn.length})` : '–'} | ${noCure.length ? `${pct(noCure.filter(lessonWorks).length, noCure.length)} (${noCure.filter(lessonWorks).length}/${noCure.length})` : '–'} |`);
}
// proposed calm rules: share of samples whose worst stall is critical, today vs after
console.log('\n| misja / scenariusz | krytyczny najgorszy postój dziś | po regułach 1+3+5 (szacunek) |');
console.log('|---|---|---|');
for (const key of [...new Set(all.map((s) => `${s.mission}|${s.scenario}`))]) {
  const [m, sc] = key.split('|');
  const ss = all.filter((s) => s.mission === m && s.scenario === sc);
  console.log(`| ${m} / ${sc} | ${pct(ss.filter((s) => s.crit).length, ss.length)} | ${pct(ss.filter((s) => s.after?.crit).length, ss.length)} |`);
}
// per root status over every mission: how often the button / the wagon / the lesson clear it
console.log('\n| status korzenia | próbek | krytyczny | przycisk | naprawa działa | +1 wóz działa | lekcja działa |');
console.log('|---|---|---|---|---|---|---|');
const st = all.filter((s) => s.worst);
const keys = new Map<string, Sample[]>();
for (const s of st) { const k = s.rootKey!; if (!keys.has(k)) keys.set(k, []); keys.get(k)!.push(s); }
for (const [k, ss] of [...keys].sort((a, b) => b[1].length - a[1].length)) {
  const btn = ss.filter((s) => s.cureTry);
  const wag = ss.filter((s) => s.wagonTry && s.wagonTry.ttc >= 0 && (s.ctrl! < 0 || s.wagonTry.ttc + 10 * TICK_HZ <= s.ctrl!));
  const les = ss.filter((s) => s.lessonTry);
  console.log(`| ${short(k)} | ${ss.length} | ${pct(ss.filter((s) => s.crit).length, ss.length)} | ${pct(btn.length, ss.length)} | ${btn.length ? pct(btn.filter(works).length, btn.length) : '–'} | ${pct(wag.length, ss.length)} | ${les.length ? `${pct(les.filter(lessonWorks).length, les.length)} (n=${les.length})` : '–'} |`);
}
