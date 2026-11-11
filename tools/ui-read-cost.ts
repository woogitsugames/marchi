// UI stall-card reading cost (D-730): what the app's reading code costs on top of the sim — per tick (the samplers of
// App.onTick, the stall ranking, the HUD's fresh frame, the pins), per frame between ticks, per open building / wagon
// sheet update (~4×/s), the dead-end check (every 5 s of game time) and the first frame after a command in pause
// (D-672: the reading copy, then ranking + HUD + pins + sheets all on that copy with cold caches). The real Hud,
// Markers and panels.ts sheets run on a minimal DOM stand-in (tools/fake-dom.ts); the sim is driven by the authored
// mission strategies (XIV–XVII), the free valley's DECENT player (late, big road network) and the 50/100/200-wagon
// bench. Prints p50 / p95 / max ms per call and a digest of everything the readings produced (DOM text and HTML of the
// HUD, the pins and both sheets, the ranking, the cures, the dead-end verdict) — two checkouts must print the same
// digests for the same scenes.
//   node tools/ui-read-cost-run.mjs [m14 m15 m16 m17 valley bench50 bench100 bench200] [--valley-from 100] [--min 10]
//     [--no-digest] [--json out.json]
import { installFakeDom, FakeElement } from './fake-dom';
installFakeDom();
import { writeFileSync } from 'node:fs';
import {
  TICK_HZ, applyCommand, createWorld, newPaceLog, samplePace, step, type Command, type PaceLog, type World,
} from '../src/sim/index';
import { Hud } from '../src/ui/hud';
import { Markers } from '../src/ui/markers';
import { buildingSheet, wagonSheet, type PanelNav } from '../src/ui/panels';
import type { Sheet, SheetContent } from '../src/ui/sheets';
import { StallRanking, cureFor, sampleCalmCosts, sampleInputWaits } from '../src/ui/stalls';
import { sampleFleet } from '../src/ui/paceCard';
import { deadEnd } from '../src/ui/deadEnd';
import { readingAfterCommand } from '../src/ui/readWorld';
import { isWagonWait } from '../src/ui/stallKinds';
import { setLang } from '../src/i18n/index';
import { missionDriver, valleyDriver, type Driver } from './robustness';
import { benchWorld } from './bench';

const args = process.argv.slice(2);
const opt = (n: string, d: number) => { const i = args.indexOf('--' + n); return i >= 0 ? Number(args[i + 1]) : d; };
const jsonOut = (() => { const i = args.indexOf('--json'); return i >= 0 ? args[i + 1]! : null; })();
const digestOn = !args.includes('--no-digest');
const valleyFrom = opt('valley-from', 100);
const measureMin = opt('min', 10);
const named = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1]!.startsWith('--')));
const SCENES = named.length ? named : ['m14', 'm15', 'm16', 'm17', 'valley', 'bench50', 'bench100', 'bench200'];

setLang('pl');

// ------------------------------------------------------------------ digest (FNV-1a over the produced readings)

let digest = 0x811c9dc5;
const dumpPath = (() => { const i = args.indexOf('--dump'); return i >= 0 ? args[i + 1]! : null; })();
const dump: string[] = [];
function feed(s: string): void {
  if (!digestOn) return;
  if (dumpPath) dump.push(s);
  let h = digest;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  digest = h >>> 0;
}
function tree(el: FakeElement, out: string[]): void {
  // the pins' "fixed" wax stamps and delivery tags live and fade on the wall clock (Markers): left out
  if (el.className.startsWith('fix-stamp') || el.className.startsWith('dlv-tag')) return;
  out.push(`<${el.tagName} c="${el.className}" h=${el.hidden} t="${el.textContent}">${el.innerHTML}`);
  for (const c of el.children) tree(c, out);
  out.push('>');
}
function feedTree(el: FakeElement): void {
  if (!digestOn) return;
  const out: string[] = [];
  tree(el, out);
  feed(out.join(''));
}

// ------------------------------------------------------------------ timing

const samples = new Map<string, number[]>();
function rec(k: string, ms: number): void {
  let a = samples.get(k);
  if (!a) samples.set(k, (a = []));
  a.push(ms);
}
/** Calls over 1 ms: metric, tick and whether the road network changed in that tick (cold path searches). */
const spikes: string[] = [];
let spikeTick = 0, spikeNet = false;
function time<T>(k: string, f: () => T): T {
  const a = performance.now();
  const r = f();
  const ms = performance.now() - a;
  rec(k, ms);
  if (ms > 1) spikes.push(`${k}@${spikeTick}${spikeNet ? '+net' : ''}=${ms.toFixed(1)}`);
  return r;
}

// ------------------------------------------------------------------ app stand-in

interface Ui {
  hud: Hud;
  markers: Markers;
  ranking: StallRanking;
  pace: PaceLog;
  /** What the sheets read (App.readWorld: the reading copy after a command in pause, else the world). */
  reading: World | null;
  world: World;
  bSheet: Sheet | null;
  wSheet: Sheet | null;
}

const view = { anchorOf: () => ({ x: 100, y: 100, visible: true }) };

function makeSheet(content: SheetContent): Sheet {
  const el = (t: string) => new FakeElement(t) as unknown as HTMLElement;
  return { el: el('div'), icon: el('div'), kicker: el('div'), title: el('h3'), body: el('div'), content, deferred: [] };
}

function makeUi(world: World): Ui {
  const noop = new Proxy({}, { get: () => () => undefined });
  const ui: Ui = {
    hud: new Hud(noop as never, false), markers: new Markers(), ranking: new StallRanking(), pace: newPaceLog(),
    reading: null, world, bSheet: null, wSheet: null,
  };
  return ui;
}

function nav(ui: Ui): PanelNav {
  return {
    get world() { return ui.reading ?? ui.world; },
    get pace() { return ui.pace; },
    tutorialRunning: () => false, tutorialHut: () => -1,
    go() {}, buyWagon() {}, sellWagon() {}, toggleFollow() {}, following: () => null, buildRoad() {}, setGhost() {},
    undoPlace() {}, pickBuild() {}, castleFirst() {}, chainFirst() {},
  };
}

/** App.onTick's UI samplers (the view, audio, music, autosave and chronicle left out). */
function onTick(ui: Ui): void {
  ui.reading = null;
  samplePace(ui.pace, ui.world);
  sampleInputWaits(ui.world);
  sampleCalmCosts(ui.world);
  sampleFleet(ui.world);
}

/** App.frame's game branch: ranking, HUD, pins (the tutorial, trial and build tool left out). */
function frame(ui: Ui, version: number, k: string): void {
  const rw = ui.reading ?? ui.world;
  const stalls = time(k + '.rank', () => ui.ranking.get(rw, version));
  time(k + '.hud', () => ui.hud.update(rw, ui.pace, stalls, true));
  const worst = stalls[0] && !stalls[0].minor ? stalls[0].id : -1;
  time(k + '.pins', () => ui.markers.update(rw, view as never, null, false, worst));
}

function updateSheets(ui: Ui, k: string): void {
  if (ui.bSheet) time(k + '.sheetB', () => ui.bSheet!.content.update(ui.bSheet!));
  if (ui.wSheet) time(k + '.sheetW', () => ui.wSheet!.content.update(ui.wSheet!));
}

function feedUi(ui: Ui): void {
  if (!digestOn) return;
  feedTree(ui.hud.root as unknown as FakeElement);
  feedTree(ui.markers.root as unknown as FakeElement);
  for (const s of [ui.bSheet, ui.wSheet]) if (s) { feedTree(s.kicker as unknown as FakeElement); feedTree(s.title as unknown as FakeElement); feedTree(s.body as unknown as FakeElement); }
}

/** Which building and wagon the player has open: the worst stall (else the castle), a waiting wagon (else a busy one). */
function pick(ui: Ui): void {
  const st = ui.world.state;
  const stalls = ui.ranking.get(ui.world, 0);
  const bid = stalls[0]?.id ?? st.buildings.find((b) => b.type === 'castle')?.id ?? st.buildings[0]?.id ?? -1;
  const wg = st.wagons.find((w) => isWagonWait(w.status)) ?? st.wagons.find((w) => w.job) ?? st.wagons[0];
  const n = nav(ui);
  ui.bSheet = bid >= 0 ? makeSheet(buildingSheet(n, bid)) : null;
  ui.wSheet = wg ? makeSheet(wagonSheet(n, wg.id)) : null;
}

// ------------------------------------------------------------------ scenes

interface Scene { world: World; driver: Driver; warm: number; measure: number }

function scene(name: string): Scene {
  if (/^m\d+$/.test(name)) {
    // the whole contract (the winning strategy), measured from the first minute on
    return { world: createWorld(name), driver: missionDriver(name), warm: 60 * TICK_HZ, measure: 60 * 60 * TICK_HZ };
  }
  if (name === 'valley') return { world: createWorld('sandbox'), driver: valleyDriver(), warm: valleyFrom * 60 * TICK_HZ, measure: measureMin * 60 * TICK_HZ };
  const m = /^bench(\d+)$/.exec(name);
  if (m) return { world: benchWorld(Number(m[1])), driver: () => [], warm: 60 * TICK_HZ, measure: 3 * 60 * TICK_HZ };
  throw new Error('unknown scene ' + name);
}

const DEAD_END_EVERY = 5 * TICK_HZ;
/** A command in pause every 30 s of game time (only the reading copy is taken: the world itself is not changed). */
const PAUSE_EVERY = 30 * TICK_HZ;
/** Re-pick the open sheets every 10 s of game time. */
const PICK_EVERY = 10 * TICK_HZ;

interface Row { scene: string; wagons: number; buildings: number; roads: number; ticks: number; digest: string; stats: Record<string, Stat> }
interface Stat { n: number; p50: number; p95: number; p99: number; max: number; mean: number; over1: number }

function stat(a: number[]): Stat {
  const s = [...a].sort((x, y) => x - y);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(s.length * p))]!;
  return { n: s.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: s[s.length - 1]!, mean: s.reduce((x, y) => x + y, 0) / s.length, over1: s.filter((x) => x > 1).length };
}

const rows: Row[] = [];
for (const name of SCENES) {
  samples.clear();
  spikes.length = 0;
  digest = 0x811c9dc5;
  const sc = scene(name);
  const w = sc.world;
  const ui = makeUi(w);
  let version = 0;
  const apply = (cmds: Command[]) => { for (const c of cmds) if (applyCommand(w, c).ok) version++; };
  // warm-up: the sim and the per-tick samplers (UI memory: input waits, fleet, calm seconds) — nothing timed
  while (w.state.tick < sc.warm && w.state.mission.result === 'running') {
    apply(sc.driver(w));
    step(w);
    onTick(ui);
  }
  pick(ui);
  const end = w.state.tick + sc.measure;
  let ticks = 0, lastNet = w.state.netVersion;
  while (w.state.tick < end && w.state.mission.result === 'running') {
    apply(sc.driver(w));
    const net0 = w.state.netVersion;
    step(w);
    ticks++;
    spikeTick = w.state.tick;
    spikeNet = w.state.netVersion !== net0 || lastNet !== net0;
    lastNet = w.state.netVersion;
    time('tick.samplers', () => onTick(ui));
    if (w.state.tick % PICK_EVERY === 0) pick(ui);
    // the first frame after the tick (fresh readings), then one frame between ticks (cached)
    const f0 = performance.now();
    frame(ui, version, 'tick');
    rec('tick.frame', performance.now() - f0);
    frame(ui, version, 'between');
    updateSheets(ui, 'tick');
    feedUi(ui);
    if (w.state.tick % DEAD_END_EVERY === 0) {
      const d = time('deadEnd', () => deadEnd(w));
      feed(JSON.stringify(d));
    }
    if (digestOn && w.state.tick % TICK_HZ === 0) {
      feed(JSON.stringify(ui.ranking.get(w, version)));
      let cures = '';
      for (const b of w.state.buildings) cures += `${b.id}:${cureFor(w, b.id)},`;
      feed(cures);
    }
    if (w.state.tick % PAUSE_EVERY === 0) {
      // D-672: a command in pause — the copy, then the first frame on it (ranking invalidated, sheets due at once)
      const a = performance.now();
      ui.reading = time('pause.copy', () => readingAfterCommand(w));
      ui.ranking.invalidate();
      frame(ui, version, 'pause');
      updateSheets(ui, 'pause');
      rec('pause.firstFrame', performance.now() - a);
      feedUi(ui);
      // the next sheet updates in pause (every 250 ms of wall time): the same copy, warm
      updateSheets(ui, 'pauseAgain');
      feedUi(ui);
      ui.reading = null;
      ui.ranking.invalidate();
    }
  }
  const st = w.state;
  const stats: Record<string, Stat> = {};
  for (const [k, a] of [...samples].sort()) stats[k] = stat(a);
  // the worst tick-time UI work: everything the app does in the frame after a tick (+ sheets due in it)
  rows.push({ scene: name, wagons: st.wagons.length, buildings: st.buildings.length, roads: st.roads.reduce((n, r) => n + (r ? 1 : 0), 0), ticks, digest: digest.toString(16).padStart(8, '0'), stats });
  const r = rows[rows.length - 1]!;
  console.log(`\n== ${name}: ticks=${ticks} wagons=${r.wagons} buildings=${r.buildings} roads=${r.roads} result=${st.mission.result} digest=${r.digest}`);
  console.log('metric'.padEnd(22) + 'n'.padStart(7) + 'p50'.padStart(9) + 'p95'.padStart(9) + 'p99'.padStart(9) + 'max'.padStart(9) + 'mean'.padStart(9) + '>1ms'.padStart(6));
  for (const [k, s] of Object.entries(stats)) {
    console.log(k.padEnd(22) + String(s.n).padStart(7) + s.p50.toFixed(3).padStart(9) + s.p95.toFixed(3).padStart(9) + s.p99.toFixed(3).padStart(9) + s.max.toFixed(2).padStart(9) + s.mean.toFixed(3).padStart(9) + String(s.over1).padStart(6));
  }
  if (args.includes('--spikes')) console.log('spikes: ' + spikes.join(' '));
}
console.log('\nDIGESTS ' + rows.map((r) => `${r.scene}=${r.digest}`).join(' '));
if (dumpPath) writeFileSync(dumpPath, dump.join('\n'));
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(rows, null, 1));
