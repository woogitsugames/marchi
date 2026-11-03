// App shell: main menu over a live scene, the game screen (HUD, sheets, markers, tools),
// autosave, end-of-mission letter, debug params for screenshots.
import { AudioEngine } from '../audio/audio';
import { MusicPlayer } from '../audio/music';
import { bindAudioEngine, captureAudioState, observeSim, type AudioSnapshot } from '../audio/bindings';
import {
  TICK_HZ, buildingById, canSurface, createWorld, demolishIsFinal, grade, lineCells, net, stars, suggestLinkToStable, validateRoad, worldFromState,
  type Command, type CommandResult, type SimState, type SurfaceKind, type World,
  isRaining, newPaceLog, samplePace, type PaceLog,
  type BuildingType,
} from '../sim/index';
import { GameLoop, type Speed } from '../game/loop';
import type { PickResult, ScreenOffset, WorldView } from '../render/api';
import {
  LEGACY_SLOT, adoptLegacySaves, contractSlot, contractSlotMission, deleteSave, isGameSlot, isValleySlot, listSaves, loadSave, readSlots, readProfile, recordContractResult,
  saveGame, slotFor,
} from '../platform/save';
import { onLangChange, t } from '../i18n/index';
import { botPlan, menuWorld } from '../game/menuScene';
import { h, isRtl } from './dom';
import { Hud, type Tool } from './hud';
import { attachInput, type InputHandle } from './input';
import { applyLayoutClasses, computeLayout, devicePosture, foldSignature, isAbrupt, type LayoutInfo } from './layout';
import { Markers } from './markers';
import { StallRanking } from './stalls';
import { freeRect, layoutRect, wellInside, type Rect } from './focus';
import {
  buildDeadEndLetter, buildEndLetter, buildMainMenu, buildOpeningLetter, gameMenuSheet, isMissionKey, missionSaveSheet, nextMission, settingsSheet, valleySheet, type MissionKey, type SaveInfo,
} from './menu';
import { deadEnd } from './deadEnd';
import { BuildTool, buildTypes } from './buildTool';
import { SpeedHint } from './speedHint';
import { pressSeal } from './sealPress';
import type { BestResult } from '../platform/profile';
import { marketSheet } from './marketSheet';
import { buildingSheet, wagonSheet, type PanelNav } from './panels';
import { loadPrefs, savePrefs, type Prefs } from './prefs';
import { CHRONICLE } from '../sim/proposals/chronicle';
import { ChronicleLog, chronicleSheet, chronicleTitle, clearChronicle } from './chronicle';
import { RoadDraft, errorText } from './roadTool';
import { Sheets } from './sheets';
import { Tutorial } from './tutorial';
import { DiagPanel } from './diagPanel';
import { fmtInt, iso, buildingName } from './format';
import type { IconId } from './icons';
import { DynamicResolution, detectTier, dprCap, isQualityPref, renderQuality, type QualityChoice, type QualityPref } from './tier';

const audio = new AudioEngine();
const music = new MusicPlayer();
bindAudioEngine(audio);
let audioUnlockArmed = false;
/** Web Audio may only start from a trusted gesture: unlock on the first touch/click/key. */
function armAudioUnlock(): void {
  if (audioUnlockArmed) return;
  audioUnlockArmed = true;
  const unlock = (): void => { void audio.init(); music.unlock(); };
  window.addEventListener('pointerdown', unlock, { capture: true, once: true });
  window.addEventListener('keydown', unlock, { capture: true, once: true });
}

/** Clear-screen mode: only the scene stays, plus one small button to bring the UI back. */
let restoreBtn: HTMLButtonElement | null = null;
function setClear(on: boolean): void {
  document.body.classList.toggle('is-clear', on);
  if (!restoreBtn) {
    restoreBtn = document.createElement('button');
    restoreBtn.className = 'clear-restore';
    restoreBtn.type = 'button';
    restoreBtn.addEventListener('click', () => setClear(false));
    document.body.append(restoreBtn);
  }
  restoreBtn.textContent = t('hud.showUi');
  restoreBtn.setAttribute('aria-label', t('hud.showUi'));
}

/** Player volumes (0..1 sliders) -> engine channels; effects scale sfx, ambience and UI clicks together. */
function applyVolumes(p: Prefs): void {
  music.setVolume(p.musicVolume * MUSIC_FULL);
  audio.setVolume('sfx', 0.65 * p.effectsVolume);
  audio.setVolume('ambient', 0.55 * p.effectsVolume);
  audio.setVolume('ui', 0.7 * p.effectsVolume);
}
/** Music level at slider 100 %; the default slider (0.8) gives ~0.56, the player's built-in level. */
const MUSIC_FULL = 0.7;

const AUTOSAVE_TICKS = 30 * TICK_HZ;
/** How often the no-road-to-victory check runs (game time). */
const DEAD_END_EVERY = 5 * TICK_HZ;
/** Window for the second tap that confirms demolishing a building a contract cannot replace. */
const DEMOLISH_CONFIRM_MS = 4000;
/** What a stall pin must not sit under (D-62): the floating HUD pieces and the open sheets. */
const OCCLUDERS = '#hud .topbar > .menu-btn, #hud .topbar > .chips, #hud .topbar > .speed, #hud .waybill-wrap .wb-panel, '
  + '#hud .waybill-wrap .ribbon, #hud .waybill-wrap .seal-only, #hud .ev-card, #hud .stall-row, #hud .rail-tools, #sheets .sheet-paper';

export interface AppOptions {
  canvas: HTMLCanvasElement;
  ui: HTMLElement;
  view: WorldView;
  params: URLSearchParams;
}

export class App implements PanelNav {
  readonly view: WorldView;
  private canvas: HTMLCanvasElement;
  private params: URLSearchParams;
  private layers: { markers: HTMLElement; hud: HTMLElement; sheets: HTMLElement; tutorial: HTMLElement; menu: HTMLElement; overlay: HTMLElement };
  world: World;
  /** Contract pace samples (UI-owned, never in the state): the waybill / castle-card forecast. */
  pace: PaceLog = newPaceLog();
  private loop: GameLoop;
  private mode: 'menu' | 'game' = 'menu';
  private missionId: MissionKey = 'm1';
  /** Save slot of the running game: the mission's own slot for contracts (D-36), a valley ledger in the free valley (D-29). */
  private slot: string = contractSlot('m1');
  private prevAudio: AudioSnapshot | null = null;
  /** Valley chronicle entries of the ledger being played (UI-owned, D-57). */
  private chronicle = new ChronicleLog();
  private sheets: Sheets;
  private hud: Hud | null = null;
  private markers = new Markers();
  private draft: RoadDraft;
  /** Build tool: shelf, placement ghost, undo (free valley and missions that allow building). */
  readonly build: BuildTool;
  private tool: Tool = 'none';
  private overlay = false;
  private selection: PickResult = null;
  private followId: number | null = null;
  private prefs: Prefs = loadPrefs();
  private lastSaveTick = 0;
  private endShown = false;
  private lastFrame = 0;
  private lastSheetUpdate = 0;
  /** rankStalls() once per tick / applied command / selection change, not every frame (frame-cost item 3). */
  private readonly ranking = new StallRanking();
  private perfEl: HTMLElement | null = null;
  private perfAt = 0;
  /** ?diag=1: frame-time percentiles per speed bucket, JSON for docs/PERF.md (BACKLOG P2). */
  private diagPanel: DiagPanel | null = null;
  /** The mission's first critical stall has had its one-time cue (markers.flash + hud.flashFirstStall). */
  private firstCritSeen = false;
  /** ×4 while a critical stall grows: one toast per stall (owner decision 7). */
  private readonly speedHint = new SpeedHint();
  /** The seal-press cue before the end letter, while it runs (cancelled when the world changes). */
  private cancelSeal: (() => void) | null = null;
  private save: SaveInfo | null = null;
  /** Unfinished contract saves by mission id (newest per mission), for the menu rows and the ask sheet (D-36). */
  private unfinished = new Map<string, SaveInfo>();
  /** Best seals and time per contract mission (profile store, owner decision 13). */
  private best: Record<string, BestResult> = {};
  /** The slot "Continue" failed to load (shown as damaged in the menu): wiped when that contract starts afresh. */
  private brokenSlot: string | null = null;
  private speedBeforeMenu: Speed = 1;
  /** Demolish tool: the contract building a first tap warned about (second tap within the window demolishes). */
  private demolishArm: { id: number; until: number } | null = null;
  private input: InputHandle;
  private layout: LayoutInfo | null = null;
  private layoutQueued = false;
  private dprQuery: MediaQueryList | null = null;
  private dynres = new DynamicResolution();
  /** Session-only quality override from ?quality= (screenshots, tests). */
  private qualityParam: QualityPref | null = null;
  private menuToken = 0;
  private foldSig = '';
  private foldCheckAt = 0;
  private tutorial: Tutorial | null = null;
  /** Started from ?play= (screenshots, bots): no tutorial unless ?tut=1. */
  private debugStart = false;
  /** The no-road-to-victory letter was shown in this game (D-48): once per game. */
  private deadEndShown = false;
  /** Ghost roads on the map: the gap finder (open sheet) wins over the tutorial's crossing. */
  private ghosts: { gap: number[] | null; tut: number[] | null } = { gap: null, tut: null };
  private ghostKey = '';

  constructor(o: AppOptions) {
    this.view = o.view;
    this.canvas = o.canvas;
    this.params = o.params;
    const layer = (id: string): HTMLElement => h('div', { id });
    this.layers = { markers: layer('markers'), hud: layer('hud'), sheets: layer('sheets'), tutorial: layer('tutorial'), menu: layer('menu'), overlay: layer('overlay') };
    o.ui.append(this.layers.markers, this.layers.hud, this.layers.menu, this.layers.sheets, this.layers.tutorial, this.layers.overlay);
    this.layers.markers.append(this.markers.root);
    this.markers.onBubble = (kind, id) => this.go(kind, id, false);
    this.markers.onFixed = (id) => {
      if (this.mode !== 'game') return;
      if (audio.ready) void audio.play('ui.paper');
      this.hud?.announce(t('hud.stallFixed', { name: buildingName(this.world, id) }));
    };
    this.sheets = new Sheets(this.layers.sheets);
    this.sheets.onChange = () => { this.syncSelection(); document.body.classList.toggle('has-sheet', this.sheets.count > 0); this.syncSheetFold(); this.lastSheetUpdate = 0; };

    this.view.mount(this.canvas);
    this.world = createWorld('m1');
    this.loop = new GameLoop(this.world);
    this.draft = new RoadDraft(() => this.view, () => this.world, this.markers, (cells, surface) => this.enqueue({ t: 'road', cells, surface }));
    this.build = new BuildTool({
      view: () => this.view,
      world: () => this.world,
      enqueue: (cmd) => this.enqueue(cmd),
      toast: (text, kind, icon) => {
        if (kind === 'err' && audio.ready) void audio.play('ui.error');
        this.hud?.toast(text, kind, icon);
      },
      close: () => this.setTool('none'),
      sceneCentre: () => this.sceneCentre(),
      undoInSheet: (id) => this.sheets.top?.content.key === `building:${id}`,
    });
    this.layers.markers.append(this.build.floating);
    // contract goods handed over at the castle: a quiet delivery sound (owner decision 6)
    this.markers.onDelivery = () => { if (audio.ready) void audio.play('contract.delivery'); };

    const qp = this.params.get('quality');
    this.qualityParam = isQualityPref(qp) ? qp : null;
    this.dynres.enabled = this.params.get('dynres') !== '0';
    this.applyHand();
    applyVolumes(this.prefs);
    this.view.setQuality(renderQuality(this.view, this.effectiveQuality()));
    this.applyLayout();
    this.watchLayout();

    this.input = attachInput(this.canvas, () => this.view.camera, {
      tap: (x, y) => this.onTap(x, y),
      draftMode: () => this.mode === 'game' && (this.tool === 'road' || this.tool === 'cobble' || (this.tool === 'build' && this.build.placing)),
      draftStart: (x, y) => {
        if (this.tool === 'build') { this.build.dragStart(x, y); return; }
        this.draft.surface = (this.tool === 'cobble' ? 2 : 1) as SurfaceKind;
        this.draft.start(x, y);
      },
      draftMove: (x, y) => { if (this.tool === 'build') this.build.dragMove(x, y); else this.draft.move(x, y); },
      draftEnd: (x, y) => { if (this.tool === 'build') this.build.dragEnd(x, y); else this.draft.end(x, y); },
      draftCancel: () => { if (this.tool === 'build') this.build.dragCancel(); else this.draft.cancel(); },
      twoFingerTap: () => setClear(!document.body.classList.contains('is-clear')),
      cameraTouched: () => this.stopFollow(),
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void this.autosave(); });
    window.addEventListener('pagehide', () => void this.autosave());
    onLangChange(() => { this.applyHand(); this.rebuildUi(); });

    if (this.params.get('perf') === '1') {
      this.perfEl = h('div.perf.num');
      this.layers.overlay.append(this.perfEl);
    }
    if (this.params.get('diag') === '1') this.diagPanel = new DiagPanel(this.layers.overlay, () => this.diagMeta());
    // window.__marchia: `ready` always (smoke tests and screenshot scripts wait for it); the App handle and the
    // screenshot helpers only for ?debug=1 or the Vite dev server, never in a release page (D-51)
    const debugHandle = this.params.get('debug') === '1' || import.meta.env.DEV;
    (window as unknown as { __marchia: unknown }).__marchia = debugHandle ? {
      app: this,
      findSteepDraft: () => this.findSteepDraft(),
      /** Screenshots: the rank-up letter without playing ten minutes. */
      rankUp: (r: number) => this.hud?.showRankUp(r, 60000),
      ready: false,
    } : { ready: false };
  }

  /**
   * The tool rail follows the hand, not the language (owner, 2026-11-02): RTL mirrors the content,
   * so the 'left-handed' class (which swaps the logical side) is set when hand XOR RTL — a
   * right-handed Arabic player keeps the rail under the right thumb.
   */
  private applyHand(): void {
    document.body.classList.toggle('left-handed', this.prefs.leftHanded !== isRtl());
  }

  async start(): Promise<void> {
    const play = this.params.get('play');
    if (isMissionKey(play)) {
      this.debugStart = this.params.get('tut') !== '1';
      this.newGame(play, this.params.get('slot') ?? undefined); // ?slot=valley2: which ledger a debug valley writes to
      this.applyDebug();
    } else {
      await this.showMenu();
    }
    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    (window as unknown as { __marchia: { ready: boolean } }).__marchia.ready = true;
  }

  // ------------------------------------------------------------------ screens

  private async showMenu(): Promise<void> {
    this.mode = 'menu';
    this.sheets.closeAll();
    this.clearGameUi();
    document.body.classList.add('mode-menu');
    document.body.classList.remove('mode-game');
    // live scene: mission 1 valley with a bridge already thrown over the river and wagons on it
    const w = menuWorld();
    this.setWorld(w);
    for (let i = 0; i < 70 * TICK_HZ; i++) this.loop.tickOnce();
    this.loop.speed = 1;
    this.view.setMenuMode(true);
    music.setMood('menu');
    armAudioUnlock();
    // render at once: IndexedDB may be slow or hang (save.ts times out after 1.5 s);
    // "Continue" is added when the save list arrives
    this.save = null;
    this.renderMenu();
    await this.refreshSaves(true);
  }

  /** "Continue" = the most recently played save of any kind (contract or any valley ledger). */
  private async refreshSaves(adopt = false): Promise<void> {
    const token = ++this.menuToken;
    let save: SaveInfo | null = null;
    const unfinished = new Map<string, SaveInfo>();
    let best: Record<string, BestResult> = {};
    try {
      if (adopt) await adoptLegacySaves().catch((e: unknown) => console.warn('legacy save not moved', e));
      const saves = await listSaves(); // newest first
      const info = (x: (typeof saves)[number]): SaveInfo => ({ missionId: x.missionId, tick: x.tick, slot: x.slot, savedAt: x.savedAt });
      const s = saves.find((x) => isGameSlot(x.slot));
      save = s ? info(s) : null;
      for (const x of saves) {
        const m = contractSlotMission(x.slot);
        if (m && !unfinished.has(m)) unfinished.set(m, info(x));
      }
    } catch { save = null; }
    best = (await readProfile()).best;
    if (token !== this.menuToken || this.mode !== 'menu') return;
    const changed = JSON.stringify([save, [...unfinished], best]) !== JSON.stringify([this.save, [...this.unfinished], this.best]);
    this.save = save;
    this.unfinished = unfinished;
    this.best = best;
    if (changed) this.renderMenu();
  }

  /** Free valley ledger picker (over the menu scene). */
  private openValley(): void {
    if (this.mode !== 'menu') return;
    this.sheets.open(valleySheet({
      read: () => readSlots(),
      play: (slot) => void this.continueGame(slot),
      fresh: (slot) => {
        clearChronicle(slot);
        void deleteSave(slot).catch(() => undefined);
        this.newGame('sandbox', slot);
      },
      remove: async (slot) => {
        clearChronicle(slot);
        await deleteSave(slot);
        void this.refreshSaves();
      },
    }));
  }

  private renderMenu(broken: MissionKey | null = null): void {
    this.layers.menu.innerHTML = '';
    if (this.mode !== 'menu') return;
    this.layers.menu.append(buildMainMenu({
      continueGame: () => void this.continueGame(),
      newGame: (m) => this.pickMission(m),
      startFresh: (m) => {
        if (this.brokenSlot && this.brokenSlot !== contractSlot(m)) void deleteSave(this.brokenSlot).catch(() => undefined);
        this.startFresh(m);
      },
      openValley: () => this.openValley(),
      openSettings: () => this.openSettings(),
    }, broken ? null : this.save, broken, this.unfinished, this.best));
  }

  /** A mission tapped in the menu: straight in, or first the ask sheet when it has an unfinished save (D-36). */
  private pickMission(m: MissionKey): void {
    if (this.mode !== 'menu') return;
    const u = m === 'sandbox' ? undefined : this.unfinished.get(m);
    if (!u) { this.newGame(m); return; }
    this.sheets.open(missionSaveSheet({
      continueGame: () => void this.continueGame(u.slot),
      startFresh: () => this.startFresh(m),
    }, m, u));
  }

  /**
   * Tutorial step 5: the whole ghost crossing (both road ends included, where the drag starts and ends) in
   * the free part of the map. A card opened in step 3 may have glided the camera away; the crossing's
   * middle cell is not the middle of its box (the path bends), so the glide offsets by the difference.
   * Zooms out first only when the crossing is larger than the free area.
   */
  private frameCells(cells: number[]): void {
    const to = this.view.cellToScreen?.bind(this.view);
    if (!to || !cells.length) return;
    const { rect, offset } = this.visibleScene();
    const box = (): { l: number; t: number; r: number; b: number; ok: boolean } => {
      const ps = cells.map(to);
      const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
      const b = { l: Math.min(...xs), t: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) };
      return { ...b, ok: ps.every((p) => p.visible && wellInside(p.x, p.y, rect, 0.04)) };
    };
    let b = box();
    if (b.ok) return;
    this.stopFollow();
    const fw = (rect.r - rect.l) * 0.8, fh = (rect.b - rect.t) * 0.8;
    const k = Math.max((b.r - b.l) / fw, (b.b - b.t) / fh);
    if (k > 1) { this.view.camera.zoom(Math.min(2, k), (b.l + b.r) / 2, (b.t + b.b) / 2); b = box(); }
    const mid = cells[cells.length >> 1]!;
    const pm = to(mid);
    this.view.camera.focusCell(mid, { x: offset.x + pm.x - (b.l + b.r) / 2, y: offset.y + pm.y - (b.t + b.b) / 2 });
  }

  /** "Next mission" on a won end letter: straight in, or through the menu's ask sheet when that contract
   *  has an unfinished save (D-36: never overwrite a save without asking). */
  private async startNext(m: MissionKey): Promise<void> {
    const w = this.world;
    const saved = await listSaves().then((xs) => xs.some((x) => x.slot === slotFor(m)), () => false);
    if (this.world !== w || this.mode !== 'game') return; // a second tap already moved on
    if (!saved) { this.newGame(m); return; }
    await this.showMenu();
    this.pickMission(m);
  }

  /** Wipes the mission's own save, then starts it afresh (never another mission's save). */
  private startFresh(m: MissionKey): void {
    const slot = slotFor(m);
    // the delete is queued before any autosave of the new game (IndexedDB runs them in order)
    void deleteSave(slot).catch(() => undefined);
    this.unfinished.delete(m);
    this.newGame(m);
  }

  private setWorld(w: World): void {
    this.world = w;
    this.pace = newPaceLog();
    this.loop = new GameLoop(w);
    this.loop.onTick = () => this.onTick();
    this.prevAudio = captureAudioState(w.state);
    armAudioUnlock();
    this.loop.onCommandResult = (cmd, r) => this.onCommandResult(cmd, r);
    this.view.setWorld(w);
    this.lastSaveTick = w.state.tick;
    this.endShown = false;
    this.firstCritSeen = false;
    this.speedHint.reset();
    this.cancelSeal?.();
    this.cancelSeal = null;
    this.selection = null;
    this.followId = null;
    this.view.setSelection(null);
    this.build.setOpen(false);
    this.view.setRoadPreview(null);
    this.ghosts = { gap: null, tut: null };
    this.ghostKey = '';
  }

  /** slot: the valley ledger to play in (free valley only; default the first ledger). */
  /** letter: show the castellan's opening letter (not for debug ?play= starts, not on "Again"). */
  newGame(id: MissionKey, slot: string | null = null, letter = true): void {
    this.missionId = id;
    this.slot = slotFor(id, slot);
    this.enterGame(createWorld(id));
    const forced = this.params.get('tut') === '1';
    const tutorial = id === 'm1' && (forced || (!this.debugStart && this.prefs.tutorialM1 === 'new'));
    const opening = letter && !this.debugStart ? buildOpeningLetter(id, () => {
      // the game waits paused under the letter; the tutorial (mission I) starts once it is read
      this.loop.speed = 1;
      this.hud?.setSpeed(1);
      if (tutorial) this.startTutorial();
    }) : null;
    if (opening) {
      this.loop.speed = 0;
      this.hud?.setSpeed(0);
      this.layers.overlay.append(opening);
    } else if (tutorial) this.startTutorial();
  }

  // ------------------------------------------------------------------ tutorial (mission I)

  private startTutorial(): void {
    this.tutorial?.dispose();
    const app = this;
    const tut = new Tutorial({
      get world() { return app.world; },
      topKey: () => this.sheets.top?.content.key ?? null,
      tool: () => this.tool,
      closeSheets: () => this.sheets.closeAll(),
      setGhost: (cells) => { this.ghosts.tut = cells; },
      cellScreen: (cell) => this.view.cellToScreen?.(cell) ?? null,
      showCells: (cells) => this.frameCells(cells),
      finish: (r) => {
        this.prefs.tutorialM1 = r;
        savePrefs(this.prefs);
        if (this.tutorial === tut) this.tutorial = null;
      },
    });
    this.tutorial = tut;
    this.layers.tutorial.append(tut.root);
  }

  private stopTutorial(): void {
    this.tutorial?.dispose();
    this.tutorial = null;
    this.ghosts.tut = null;
  }

  /** PanelNav: the gap finder's ghost road while its sheet is open. */
  setGhost(cells: number[] | null): void {
    this.ghosts.gap = cells;
  }

  undoPlace(building: number): void {
    const b = buildingById(this.world, building);
    if (b) this.enqueue({ t: 'demolish', cell: b.y * this.world.terrain.w + b.x });
  }

  buildRoad(cells: number[]): void {
    this.enqueue({ t: 'road', cells, surface: 1 });
  }

  private applyGhost(): void {
    if (this.draft.busy) { this.ghostKey = '#draft'; return; }
    if (this.build.ghostOn) { this.ghostKey = '#build'; return; }
    const c = this.ghosts.gap ?? this.ghosts.tut;
    const k = c ? c.join(',') : '';
    if (k === this.ghostKey) return;
    this.ghostKey = k;
    this.view.setRoadPreview(c ? { cells: c, valid: true, badCell: -1 } : null);
  }

  /** slot: a valley ledger from the picker; default = the main menu's "Continue" save. */
  private async continueGame(slot: string | null = null): Promise<void> {
    const from = slot ?? this.save?.slot ?? LEGACY_SLOT;
    try {
      const loaded = await loadSave(from);
      if (!loaded) throw new Error('save slot is empty');
      const st: SimState = loaded.state;
      if (this.mode !== 'menu') return; // a second tap already started a game
      this.missionId = isMissionKey(st.mission.id) ? st.mission.id : 'm1';
      // a contract still in the legacy slot moves to its own slot with the next autosave (the stale
      // copy is dropped by adoptLegacySaves); a valley game stays put (its ledgers may all be taken)
      this.slot = from === LEGACY_SLOT && st.mission.id !== 'sandbox' ? slotFor(st.mission.id) : from;
      this.brokenSlot = null;
      this.enterGame(worldFromState(st), loaded.chronicle);
    } catch (e) {
      // damaged / incompatible save: say so; a contract is offered afresh, a valley ledger in the picker
      console.error('continue failed', e);
      if (this.mode !== 'menu') return;
      if (audio.ready) void audio.play('ui.error');
      if (isValleySlot(from)) {
        this.sheets.closeAll();
        this.renderMenu('sandbox');
        this.openValley();
        return;
      }
      const id = contractSlotMission(from) ?? this.save?.missionId;
      const m: MissionKey = isMissionKey(id) && id !== 'sandbox' ? id : 'm1';
      this.brokenSlot = from;
      this.sheets.closeAll();
      this.renderMenu(m);
    }
  }

  /** `chronicle`: the valley chronicle ids of a loaded ledger's envelope (none for a new game). */
  private enterGame(w: World, chronicle: readonly string[] = []): void {
    this.stopTutorial();
    this.mode = 'game';
    this.deadEndShown = false;
    this.sheets.closeAll();
    this.layers.menu.innerHTML = '';
    this.layers.overlay.querySelector('.scrim')?.remove();
    document.body.classList.remove('mode-menu', 'is-clear');
    document.body.classList.add('mode-game');
    this.view.setMenuMode(false);
    music.setMood(isRaining(w.state) ? 'rain' : 'play');
    this.setWorld(w);
    if (w.state.mission.id === 'sandbox' && isValleySlot(this.slot)) this.chronicle.attach(this.slot, w, chronicle);
    else this.chronicle.detach();
    this.loop.speed = 1;
    this.overlay = false;
    this.view.setOverlay('none');
    this.tool = 'none';
    this.buildHud();
  }

  private buildHud(): void {
    this.hud?.dispose();
    this.layers.hud.innerHTML = '';
    this.markers.reset();
    this.hud = new Hud({
      setTool: (tl) => this.setTool(tl),
      buyWagon: () => this.buyWagonFromRail(),
      toggleOverlay: () => {
        this.overlay = !this.overlay;
        this.view.setOverlay(this.overlay ? 'traffic' : 'none');
        this.hud?.setTool(this.tool, this.overlay);
      },
      setSpeed: (s) => { this.loop.speed = s; this.hud?.setSpeed(s); },
      openGameMenu: () => this.openGameMenu(),
      openCastle: () => {
        const c = this.world.state.mission.contract;
        if (c) this.go('building', c.castle, true);
      },
      openBuilding: (id) => this.go('building', id, true),
      showStall: (id) => this.go('building', id, true),
      waybillCollapsed: (c) => { this.prefs.waybillCollapsed = c; savePrefs(this.prefs); },
      openMarket: () => this.openMarket(),
      eventCommand: (cmd) => this.enqueue(cmd),
      rankUp: (r) => {
        if (audio.ready) void audio.play('ui.paper');
        this.hud?.showRankUp(r);
        this.hud?.announce(t('town.rankUp', { name: t(`rank.${r}` as 'rank.0') }));
      },
    }, this.prefs.waybillCollapsed);
    this.hud.setBuild(buildTypes(this.world).length > 0);
    this.build.relabel();
    this.layers.hud.append(this.hud.root, this.build.root);
    this.hud.setSpeed(this.loop.speed);
    this.hud.setTool(this.tool, this.overlay);
    this.hud.setCompact(!!this.layout?.mini);
    this.syncSheetFold();
    this.ranking.invalidate();
    this.hud.update(this.world, this.pace, this.ranking.get(this.world, this.loop.journal.length));
    this.watchRail();
  }

  /** The bottom rail grows and shrinks with the worst-stall row: keep --rail-h in step (no per-frame reads). */
  private railObserver: ResizeObserver | null = null;
  private watchRail(): void {
    this.railObserver?.disconnect();
    const rail = this.layers.hud.querySelector<HTMLElement>('.rail');
    if (rail) {
      try { this.railObserver = new ResizeObserver(() => this.measureRail()); this.railObserver.observe(rail); } catch { /* old WebView */ }
    }
    requestAnimationFrame(() => this.measureRail());
  }

  private clearGameUi(): void {
    this.stopTutorial();
    this.hud?.dispose();
    this.railObserver?.disconnect();
    this.layers.hud.innerHTML = '';
    this.layers.overlay.querySelector('.scrim')?.remove();
    this.markers.reset();
    this.hud = null;
    this.draft.cancel();
    this.build.setOpen(false);
    this.tool = 'none';
    document.body.classList.remove('has-undo', 'build-open', 'build-placing');
  }

  /** What a ?diag=1 report needs to be compared with another run (device, layout, quality, load). */
  private diagMeta(): Record<string, unknown> {
    const s = this.view.stats();
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return {
      ua: navigator.userAgent,
      viewport: [window.innerWidth, window.innerHeight],
      dpr: window.devicePixelRatio || 1,
      renderDpr: this.renderDpr(),
      scale: this.dynres.scale,
      quality: this.effectiveQuality(),
      layout: this.layout ? `${this.layout.cls}${this.layout.flex ? ' flex' : ''}` : null,
      posture: devicePosture()?.type ?? null,
      mission: this.mode === 'game' ? this.world.state.mission.id : null,
      wagons: this.mode === 'game' ? this.world.state.wagons.length : 0,
      tick: this.world.state.tick,
      drawCalls: s.drawCalls,
      triangles: s.triangles,
      heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
    };
  }

  private rebuildUi(): void {
    if (this.mode === 'menu') this.renderMenu();
    else this.buildHud();
    this.sheets.update();
    if (this.endShown) { this.endShown = false; this.layers.overlay.querySelector('.scrim')?.remove(); }
  }

  // ------------------------------------------------------------------ frame & ticks

  private frame(now: number): void {
    const raw = now - this.lastFrame;
    const dt = Math.min(250, raw);
    this.lastFrame = now;
    if (document.visibilityState === 'visible' && this.dynres.sample(dt, now)) this.applyRenderSize();
    if (now - this.foldCheckAt > 500) {
      this.foldCheckAt = now;
      const sig = foldSignature();
      if (sig !== this.foldSig) { this.foldSig = sig; this.scheduleLayout(); }
    }
    const t0 = this.diagPanel ? performance.now() : 0;
    const alpha = this.loop.advance(dt);
    const t1 = this.diagPanel ? performance.now() : 0;
    this.view.frame(alpha, dt);
    if (this.diagPanel && document.visibilityState === 'visible') {
      const key = this.mode !== 'game' ? 'menu' : this.loop.speed === 0 ? 'pause' : `x${this.loop.speed}`;
      this.diagPanel.frame(key, raw, t1 - t0, performance.now() - t1, now);
    }
    if (this.mode === 'game') {
      const ranked = this.ranking.get(this.world, this.loop.journal.length);
      // D-92: while the castellan's notes 1-5 teach the waybill and the crossing, the worst-stall card and
      // its alarm stay hidden (a third pointer beside the ring and the note); they appear, with the
      // first-stall flash, from the re-check note on or as soon as the tutorial ends or is skipped
      const stalls = this.tutorial && this.tutorial.current < 6 ? [] : ranked;
      this.hud?.update(this.world, this.pace, stalls);
      this.markers.update(this.world, this.view, this.selection?.kind === 'wagon' ? this.selection.id : null, false, stalls[0]?.id ?? -1);
      if (!this.firstCritSeen && stalls[0]?.crit && this.world.state.mission.result === 'running') {
        this.firstCritSeen = true;
        this.markers.flash(stalls[0].id);
        this.hud?.flashFirstStall(this.world, stalls[0].id);
      }
      const slow = this.speedHint.check(this.world, this.loop.speed, stalls);
      if (slow >= 0) this.hud?.toast(t('hud.speedHint', { name: buildingName(this.world, slow) }), 'info', 'speed1', 4200);
      this.tutorial?.update(dt);
      this.build.frame();
      this.applyGhost();
      if (now - this.lastSheetUpdate > 250) {
        this.lastSheetUpdate = now;
        this.sheets.update();
        this.markers.occluders = this.occluderRects();
      }
      if (this.world.state.mission.result !== 'running' && !this.endShown) this.showEnd();
    }
    if (this.perfEl && now - this.perfAt > 500) {
      this.perfAt = now;
      const s = this.view.stats();
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      this.perfEl.textContent = `fps ${s.fps.toFixed(0)}  draw ${s.drawCalls}  tri ${(s.triangles / 1000).toFixed(0)}k\n` +
        `${t('why.wagons', { n: this.world.state.wagons.length })}  tick ${this.world.state.tick}` + (mem ? `  heap ${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : '') +
        `\n${this.effectiveQuality()}  dpr ${this.renderDpr().toFixed(2)}/${(window.devicePixelRatio || 1).toFixed(2)}  scale ${this.dynres.scale}` +
        `  ${this.layout?.cls ?? ''}${this.layout?.flex ? ' flex' : ''}`;
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  private onTick(): void {
    this.view.afterTick();
    samplePace(this.pace, this.world);
    if (this.prevAudio && audio.ready) {
      const l = this.view.audioListener?.() ?? { x: 0, z: 0, yaw: 0 };
      const tr = this.world.terrain;
      observeSim(this.prevAudio, this.world.state, {
        x: l.x, z: l.z, yaw: l.yaw, mapWidth: tr.w, cellSize: tr.cellSize, water: tr.water, audibleRadius: 90,
      });
    }
    this.prevAudio = captureAudioState(this.world.state, this.prevAudio);
    if (this.mode === 'game' && this.world.state.mission.result === 'running') music.setMood(isRaining(this.world.state) ? 'rain' : 'play');
    if (this.mode === 'game' && this.world.state.tick - this.lastSaveTick >= AUTOSAVE_TICKS) void this.autosave();
    if (this.mode === 'game' && !this.deadEndShown && this.world.state.tick % DEAD_END_EVERY === 0) this.checkDeadEnd();
    if (this.mode === 'game' && this.chronicle.active && this.world.state.tick % TICK_HZ === 0) {
      const fresh = this.chronicle.check(this.world);
      for (const id of fresh) this.hud?.toast(t('chron.new', { title: chronicleTitle(id) }), 'info', 'seal', 3200);
      // a new entry is written with the ledger at once (it may be momentary: winter, a fleet size)
      if (fresh.length) void this.autosave();
    }
  }

  /** D-48: a contract that can no longer be won says why at once (read-only check, every 5 s of game time). */
  private checkDeadEnd(): void {
    const d = deadEnd(this.world);
    if (!d) return;
    this.deadEndShown = true;
    const speed = this.loop.speed;
    this.loop.speed = 0;
    this.hud?.setSpeed(0);
    const letter = buildDeadEndLetter(d, {
      again: () => this.newGame(this.missionId, this.slot, false),
      menu: () => void this.showMenu(),
      watch: () => {
        letter.remove();
        this.loop.speed = speed || 1;
        this.hud?.setSpeed(this.loop.speed);
      },
    });
    this.layers.overlay.append(letter);
  }

  private async autosave(): Promise<void> {
    if (this.mode !== 'game' || this.world.state.mission.result !== 'running') return;
    this.lastSaveTick = this.world.state.tick;
    const slot = this.slot;
    const chron = this.chronicle.active ? this.chronicle.ids() : undefined;
    try {
      await saveGame(slot, this.world.state, chron);
      if (chron) this.chronicle.saved(slot);
    } catch (e) { console.warn('autosave failed', e); }
  }

  private showEnd(): void {
    this.endShown = true;
    this.stopTutorial();
    music.setMood(this.world.state.mission.result === 'won' ? 'won' : 'lost');
    this.loop.speed = 0;
    this.hud?.setSpeed(0);
    this.sheets.closeAll();
    this.setTool('none');
    void deleteSave(this.slot).catch(() => undefined);
    const seals = stars(this.world);
    const m = this.world.state.mission;
    // best seals and time per contract (owner decision 13): kept in the profile, the contract save is gone now
    if (m.contract && seals > 0) {
      const id = m.id;
      void recordContractResult(id, seals, m.endTick).then((better) => {
        if (better) this.best = { ...this.best, [id]: { seals, ticks: m.endTick, at: Date.now() } };
      }).catch((e: unknown) => console.warn('best result not kept', e));
    }
    const next = nextMission(this.missionId);
    const letter = buildEndLetter(this.world, seals, {
      again: () => this.newGame(this.missionId, this.slot, false),
      menu: () => void this.showMenu(),
      next: next ? () => void this.startNext(next) : undefined,
    });
    // a won contract: the castle's seal is pressed onto the waybill first (~1.2 s, a tap skips it), then the
    // letter (D-82). One frame later, so the waybill has unfolded from under the sheets closed above.
    if (m.result === 'won' && m.contract) {
      const w = this.world;
      let cancelPress: (() => void) | null = null;
      const raf = requestAnimationFrame(() => {
        cancelPress = pressSeal(this.layers.overlay, () => {
          this.cancelSeal = null;
          if (this.world === w && this.mode === 'game') this.layers.overlay.append(letter);
        }, this.hud?.sealTarget() ?? null);
      });
      this.cancelSeal = () => { cancelAnimationFrame(raf); cancelPress?.(); };
    } else this.layers.overlay.append(letter);
  }

  // ------------------------------------------------------------------ commands

  private enqueue(cmd: Command): void {
    this.loop.enqueue(cmd);
    if (this.loop.speed === 0) this.loop.flushCommands();
  }

  private onCommandResult(cmd: Command, r: CommandResult): void {
    if (cmd.t === 'place') this.build.settled();
    if (this.mode !== 'game' || !this.hud) return;
    const icon: IconId = cmd.t === 'road' ? (cmd.surface === 2 ? 'road_cobble' : 'road_dirt') : cmd.t === 'demolish' ? 'demolish'
      : cmd.t === 'sellWagon' || cmd.t === 'merchantSell' ? 'coin' : cmd.t === 'place' ? 'build'
      : cmd.t === 'buyWagon' ? 'buy_wagon' : 'seal';
    if (!r.ok) {
      if (audio.ready) void audio.play('ui.error');
      this.hud.toast(errorText(r.err), 'err', icon);
      return;
    }
    const n = iso(fmtInt(Math.abs(r.cost)));
    if (cmd.t === 'road') this.hud.toast(t('hud.built', { n }), 'info', icon, 1800);
    else if (cmd.t === 'demolish') this.hud.toast(t('hud.demolished', { n }), 'info', icon, 1800);
    else if (cmd.t === 'buyWagon') this.hud.toast(t('hud.wagonBought', { n }), 'info', icon, 1800);
    else if (cmd.t === 'sellWagon') this.hud.toast(t('hud.wagonSold', { n }), 'info', icon, 1800);
    else if (cmd.t === 'merchantSell') this.hud.toast(t('events.merchant.sold', { n }), 'info', 'coin', 2200);
    else if (cmd.t === 'place') this.afterPlace(cmd.type, cmd.x, cmd.y, n);
  }

  /**
   * A building went up: toast, back to the shelf, and if its gate is cut off, the gap finder at once.
   * The build tool stays open under the card (closing the card returns to the shelf); the card holds
   * the undo then, so the floating undo button steps aside (undoInSheet).
   */
  private afterPlace(type: string, x: number, y: number, n: string): void {
    if (audio.ready) void audio.play('ui.wood');
    this.hud?.toast(t('hud.placed', { name: t(`building.${type}` as 'building.farm'), n }), 'info', 'build', 2200);
    this.build.back();
    const b = this.world.state.buildings.find((q) => q.x === x && q.y === y && q.placedTick >= 0);
    if (!b || b.type === 'stable' || !suggestLinkToStable(this.world, b.id)) return;
    this.go('building', b.id, false);
  }

  private openMarket(): void {
    this.sheets.open(marketSheet(() => this.world));
  }

  /** Middle of the map area between the top cluster and the bottom rail / build shelf (first ghost position). */
  private sceneCentre(): [number, number] {
    const l = this.layout ?? computeLayout();
    let x0 = 0, x1 = l.w, y0 = 0, y1 = l.sceneH;
    for (const el of document.querySelectorAll<HTMLElement>('#hud .rail, #hud .build-shelf, #hud .topbar')) {
      if (el.hidden || el.offsetParent === null) continue;
      const r = el.getBoundingClientRect();
      if (el.classList.contains('topbar')) { if (r.bottom < l.sceneH * 0.4) y0 = Math.max(y0, r.bottom); continue; }
      // a side shelf (landscape) narrows the scene; anything along the bottom lifts its floor
      if (r.height > l.sceneH * 0.5 && r.left > l.w * 0.5) x1 = Math.min(x1, r.left);
      else if (r.height > l.sceneH * 0.5 && r.right < l.w * 0.5) x0 = Math.max(x0, r.right);
      else if (r.top > l.sceneH * 0.4 && r.top < y1) y1 = Math.max(l.sceneH * 0.45, r.top);
    }
    return [(x0 + x1) / 2, y0 + (y1 - y0) * 0.5];
  }

  private buyWagonFromRail(): void {
    const stable = this.world.state.buildings.find((b) => b.type === 'stable');
    if (stable) this.enqueue({ t: 'buyWagon', stable: stable.id });
  }

  // ------------------------------------------------------------------ PanelNav

  /** PanelNav: "Naprawa" for a full output with nowhere to go — the build tool with the granary picked. */
  pickBuild(type: BuildingType, near: number): void {
    if (!buildTypes(this.world).includes(type)) return;
    this.sheets.closeAll();
    this.setTool('build');
    if (this.tool === 'build') this.build.pick(type, near);
  }

  go(kind: 'building' | 'wagon', id: number, focus = true): void {
    const prevTop = this.sheets.top?.content.key ?? null;
    if (kind === 'building') {
      const b = buildingById(this.world, id);
      if (!b) return;
      if (focus) this.stopFollow();
      this.sheets.open(buildingSheet(this, id));
      this.focusSubject('building', id, (b.y + (b.h >> 1)) * this.world.terrain.w + b.x + (b.w >> 1), b.gate);
    } else {
      const w = this.world.state.wagons.find((q) => q.id === id);
      if (!w) return;
      if (focus) this.stopFollow();
      this.sheets.open(wagonSheet(this, id));
      if (this.followId !== id) this.focusSubject('wagon', id, w.next >= 0 ? w.next : w.at, -1);
    }
    this.select({ kind, id });
    this.tutorial?.onOpen(kind, id, prevTop);
  }

  /**
   * Map area the open sheet, the tool rail and the waybill leave visible (CSS px, canvas-relative), and the
   * offset of its centre from the canvas centre — where the camera puts the subject of a sheet (D-43).
   */
  private visibleScene(): { rect: Rect; offset: ScreenOffset } {
    const c = this.canvas.getBoundingClientRect();
    const scene: Rect = { l: 0, t: 0, r: c.width, b: c.height };
    const obstacles: Rect[] = [];
    const add = (el: HTMLElement | null | undefined, layout = false): void => {
      if (!el || el.hidden || el.offsetParent === null) return;
      const r = layout ? layoutRect(el) : el.getBoundingClientRect();
      const q = 'left' in r ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : r;
      if (q.r - q.l > 0 && q.b - q.t > 0) obstacles.push({ l: q.l - c.left, t: q.t - c.top, r: q.r - c.left, b: q.b - c.top });
    };
    add(this.sheets.top?.el, true);
    add(this.layers.hud.querySelector<HTMLElement>('.rail'));
    add(this.layers.hud.querySelector<HTMLElement>('.waybill-wrap'));
    // HUD v3 (D-43): top chips/speed bar and the worst-stall row also hide the map. The .topbar box itself is
    // empty (its pieces sit in the .hud-top grid), so its pieces are the obstacles (layout check, D-62).
    for (const el of this.layers.hud.querySelectorAll<HTMLElement>('.topbar > .menu-btn, .topbar > .chips, .topbar > .speed')) add(el);
    add(this.layers.hud.querySelector<HTMLElement>('.stall-row'));
    const rect = freeRect(scene, obstacles);
    return { rect, offset: { x: (rect.l + rect.r - scene.r) / 2, y: (rect.t + rect.b - scene.b) / 2 } };
  }

  /** A bottom sheet (not a side one) folds the waybill while it is open (D-62). */
  private syncSheetFold(): void {
    this.hud?.setSheetFold(this.sheets.count > 0 && !document.body.classList.contains('is-side'));
  }

  /** HUD pieces and sheets above the map, in markers-root px: pins under them fade out (D-62). */
  private occluderRects(): Rect[] {
    const o = this.layers.markers.getBoundingClientRect();
    const out: Rect[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(OCCLUDERS)) {
      if (el.offsetParent === null) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || getComputedStyle(el).visibility !== 'visible') continue;
      out.push({ l: r.left - o.left, t: r.top - o.top, r: r.right - o.left, b: r.bottom - o.top });
    }
    return out;
  }

  /**
   * Bring the subject of a just-opened sheet into the visible part of the map (D-43): glide only when its
   * marker (or, for a building, its gate) is not already well inside; keeps the zoom, restores nothing on close.
   */
  private focusSubject(kind: 'building' | 'wagon', id: number, cell: number, gate: number): void {
    const { rect, offset } = this.visibleScene();
    const a = this.view.anchorOf(kind, id);
    let inside = a.visible && wellInside(a.x, a.y, rect);
    if (inside && gate >= 0 && this.view.cellToScreen) {
      const g = this.view.cellToScreen(gate);
      inside = g.visible && wellInside(g.x, g.y, rect, 0.05);
    }
    if (!inside) this.view.camera.focusCell(cell, offset);
  }

  buyWagon(stable: number): void {
    this.enqueue({ t: 'buyWagon', stable });
  }

  sellWagon(wagon: number): void {
    if (this.followId === wagon) this.stopFollow();
    this.enqueue({ t: 'sellWagon', wagon });
  }

  following(): number | null {
    return this.followId;
  }

  toggleFollow(id: number): void {
    if (this.followId === id) this.stopFollow();
    else {
      this.followId = id;
      this.view.camera.follow(id, this.visibleScene().offset);
    }
    this.sheets.update();
  }

  private stopFollow(): void {
    if (this.followId === null) return;
    this.followId = null;
    this.view.camera.follow(null);
  }

  private select(sel: PickResult): void {
    this.selection = sel;
    this.view.setSelection(sel);
    this.ranking.invalidate();
  }

  private syncSelection(): void {
    this.ranking.invalidate();
    const top = this.sheets.top;
    if (!top || !(top.content.key.startsWith('building:') || top.content.key.startsWith('wagon:'))) {
      if (this.selection) this.select(null);
      if (!top) this.stopFollow();
    }
  }

  // ------------------------------------------------------------------ input

  private onTap(x: number, y: number): void {
    if (this.mode !== 'game') return;
    if (this.tool === 'build' && this.build.placing) {
      this.build.tap(x, y);
      return;
    }
    if (this.tool === 'demolish') {
      const p = this.view.pick(x, y);
      let cell = -1;
      if (p?.kind === 'building') {
        const b = buildingById(this.world, p.id);
        if (b) cell = b.y * this.world.terrain.w + b.x;
        // a contract building that cannot be built again: warn first, demolish on a second tap
        if (b && demolishIsFinal(this.world, b.id)) {
          const now = performance.now();
          const armed = this.demolishArm && this.demolishArm.id === b.id && now < this.demolishArm.until;
          if (!armed) {
            this.demolishArm = { id: b.id, until: now + DEMOLISH_CONFIRM_MS };
            if (audio.ready) void audio.play('ui.error');
            this.hud?.toast(t('demolish.confirm', { name: buildingName(this.world, b.id) }), 'err', 'demolish', DEMOLISH_CONFIRM_MS);
            return;
          }
        }
      } else cell = this.view.cellAt(x, y);
      this.demolishArm = null;
      if (cell >= 0) this.enqueue({ t: 'demolish', cell });
      return;
    }
    const p = this.view.pick(x, y);
    if (p && p.kind === 'wagon') this.go('wagon', p.id, false);
    else if (p && p.kind === 'building') this.go('building', p.id, false);
    else {
      this.sheets.closeAll();
      this.select(null);
      if (this.tool === 'build') this.setTool('none');
    }
  }

  private setTool(tl: Tool): void {
    if (tl === 'cobble') {
      const gate = canSurface(this.world, 2);
      if (!gate.ok) {
        if (audio.ready) void audio.play('ui.error');
        this.hud?.toast(errorText(gate.err), 'err', 'road_cobble');
        return;
      }
    }
    if (tl === 'build' && !buildTypes(this.world).length) tl = 'none';
    this.tool = tl;
    this.draft.cancel();
    this.build.setOpen(tl === 'build');
    this.hud?.setTool(tl, this.overlay);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack') {
      if (this.sheets.count) this.sheets.closeTop();
      else if (this.tool === 'build' && this.build.placing) this.build.back();
      else if (this.tool !== 'none') this.setTool('none');
      else if (this.mode === 'game' && !this.endShown) this.openGameMenu();
      e.preventDefault();
    } else if (this.mode === 'game' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === ' ') { const s: Speed = this.loop.speed === 0 ? 1 : 0; this.loop.speed = s; this.hud?.setSpeed(s); }
      else if (k === '1' || k === '2' || k === '4') { const s = Number(k) as Speed; this.loop.speed = s; this.hud?.setSpeed(s); }
      else if (k === 'r') this.setTool(this.tool === 'road' ? 'none' : 'road');
      else if (k === 'c') this.setTool(this.tool === 'cobble' ? 'none' : 'cobble');
      else if (k === 'x') this.setTool(this.tool === 'demolish' ? 'none' : 'demolish');
      else if (k === 'b') this.setTool(this.tool === 'build' ? 'none' : 'build');
      else if (k === 'enter' && this.tool === 'build') this.build.confirm();
      else if (k === 'g' && this.tool === 'build') this.build.rotate();
      else if (k === 'h') document.body.classList.toggle('is-clear');
    }
  }

  private openSettings(): void {
    this.sheets.open(settingsSheet({
      quality: () => this.qualityParam ?? this.prefs.quality,
      autoQuality: () => detectTier().tier,
      setQuality: (q: QualityPref) => {
        this.prefs.quality = q;
        this.qualityParam = null;
        savePrefs(this.prefs);
        this.view.setQuality(renderQuality(this.view, this.effectiveQuality()));
        this.dynres.reset();
        this.applyRenderSize();
      },
      leftHanded: () => this.prefs.leftHanded,
      setLeftHanded: (v) => {
        this.prefs.leftHanded = v;
        savePrefs(this.prefs);
        this.applyHand();
        requestAnimationFrame(() => this.measureRail());
      },
      musicVolume: () => this.prefs.musicVolume,
      effectsVolume: () => this.prefs.effectsVolume,
      setVolume: (kind, v, commit) => {
        if (kind === 'music') this.prefs.musicVolume = v;
        else this.prefs.effectsVolume = v;
        applyVolumes(this.prefs);
        if (commit) savePrefs(this.prefs);
      },
    }));
  }

  private openGameMenu(): void {
    this.speedBeforeMenu = this.loop.speed === 0 ? 1 : this.loop.speed;
    this.loop.speed = 0;
    this.hud?.setSpeed(0);
    const resume = (): void => { this.loop.speed = this.speedBeforeMenu; this.hud?.setSpeed(this.loop.speed); };
    const content = gameMenuSheet({
      resume: () => { this.sheets.closeTop(); },
      settings: () => this.openSettings(),
      restart: () => {
        if (isValleySlot(this.slot)) clearChronicle(this.slot);
        void deleteSave(this.slot).catch(() => undefined);
        this.newGame(this.missionId, this.slot);
      },
      chronicle: this.chronicle.active ? () => this.sheets.open(chronicleSheet(this.chronicle)) : undefined,
      chronicleCount: () => [this.chronicle.done.size, CHRONICLE.length],
      toMenu: () => { void this.autosave().then(() => this.showMenu()); },
    }, this.world, isValleySlot(this.slot) ? this.slot : null);
    content.onClose = resume;
    // Settings opened from here replace this content in the same sheet: stay paused until the sheet closes
    content.closeWithSheet = true;
    this.sheets.open(content);
  }

  // ------------------------------------------------------------------ layout

  private effectiveQuality(): QualityChoice {
    const q = this.qualityParam ?? this.prefs.quality;
    return q === 'auto' ? detectTier().tier : q;
  }

  /** Drawing-buffer pixel ratio: device DPR, capped per quality, times the adaptive scale.
   *  Never below 0.75 (blur) and never above the device DPR. The DOM UI is unaffected. */
  private renderDpr(): number {
    const dev = window.devicePixelRatio || 1;
    const base = Math.min(dev, dprCap(this.effectiveQuality()));
    return Math.max(Math.min(0.75, base), base * this.dynres.scale);
  }

  private applyRenderSize(): void {
    const l = this.layout ?? computeLayout();
    this.view.resize(l.w, l.sceneH, this.renderDpr());
  }

  /** Coalesce bursts of resize / visualViewport / ResizeObserver / posture / fold events into one layout per frame. */
  private scheduleLayout = (): void => {
    if (this.layoutQueued) return;
    this.layoutQueued = true;
    requestAnimationFrame(() => {
      this.layoutQueued = false;
      this.applyLayout();
    });
  };

  private watchLayout(): void {
    window.addEventListener('resize', this.scheduleLayout);
    window.addEventListener('orientationchange', this.scheduleLayout);
    window.visualViewport?.addEventListener('resize', this.scheduleLayout);
    try { new ResizeObserver(this.scheduleLayout).observe(document.getElementById('app') ?? document.body); } catch { /* old WebView */ }
    devicePosture()?.addEventListener('change', this.scheduleLayout);
    // native fallback from MainActivity (androidx.window FoldingFeature)
    window.addEventListener('marchia:fold', this.scheduleLayout);
    this.watchDpr();
  }

  /** DPR differs between the cover and the inner screen: a resolution query fires once per change. */
  private watchDpr(): void {
    try {
      this.dprQuery?.removeEventListener('change', this.onDprChange);
      this.dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      this.dprQuery.addEventListener('change', this.onDprChange);
    } catch { /* matchMedia unsupported */ }
  }

  private onDprChange = (): void => {
    this.watchDpr();
    this.scheduleLayout();
  };

  private applyLayout(): void {
    const prev = this.layout;
    const l = computeLayout();
    const abrupt = isAbrupt(prev, l);
    if (abrupt) {
      // fold/unfold or rotation: snap, do not animate panels across the new screen,
      // and never let a half-drawn road or a pinch continue on a different geometry
      document.body.classList.add('is-relayout');
      this.input.cancel();
      this.draft.cancel();
      this.sheets.relayout();
      this.dynres.reset();
      requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('is-relayout')));
    }
    this.layout = l;
    applyLayoutClasses(l);
    if (l.mini && this.tool !== 'none') this.setTool('none');
    this.hud?.setCompact(l.mini);
    this.syncSheetFold();
    if (prev && prev.dpr !== l.dpr) this.watchDpr();
    // The camera orbits a target at the canvas centre, so the subject stays centred through any resize.
    this.view.resize(l.w, l.sceneH, this.renderDpr());
    requestAnimationFrame(() => { this.measureRail(); this.hud?.relayout(); });
  }

  private measureRail(): void {
    const rail = this.layers.hud.querySelector<HTMLElement>('.rail');
    const root = document.documentElement.style;
    if (!rail || document.body.classList.contains('is-mini') || rail.offsetParent === null) {
      root.setProperty('--rail-h', '0px');
      return;
    }
    const r = rail.getBoundingClientRect();
    const safeB = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-b')) || 0;
    root.setProperty('--rail-h', `${Math.max(0, Math.round(r.height - safeB))}px`);
  }

  // ------------------------------------------------------------------ debug (screenshots, bots)

  private applyDebug(): void {
    const p = this.params;
    const hudBefore = this.hud;
    this.hud = null; // no toasts for the scripted plan or while fast-forwarding
    if (p.get('bot') === '1') {
      const w = this.world;
      const plan: Command[] = botPlan(w);
      for (const c of plan) this.loop.enqueue(c);
      this.loop.flushCommands();
    }
    const ff = Number(p.get('ff') ?? 0);
    if (ff > 0) {
      const target = Math.min(ff * TICK_HZ, 60 * 60 * TICK_HZ);
      this.lastSaveTick = Number.MAX_SAFE_INTEGER; // no autosaves of half-forwarded states
      while (this.world.state.tick < target && this.world.state.mission.result === 'running') this.loop.tickOnce();
      this.lastSaveTick = this.world.state.tick;
    }
    this.hud = hudBefore;
    const speed = p.get('speed');
    if (speed !== null) { this.loop.speed = Number(speed) as Speed; this.hud?.setSpeed(this.loop.speed); }
    const tool = p.get('tool');
    if (tool === 'road' || tool === 'cobble' || tool === 'demolish' || tool === 'build') this.setTool(tool);
    const pick = p.get('pick');
    if (pick && this.tool === 'build') this.build.pick(pick as Parameters<BuildTool['pick']>[0]);
    const open = p.get('open');
    if (open) {
      const b = this.world.state.buildings.find((q) => q.type === open);
      if (b) this.go('building', b.id, true);
    }
    const wg = p.get('wagon');
    if (wg) {
      const moving = this.world.state.wagons.filter((q) => q.status.k !== 'IDLE');
      const want = wg === 'jam' ? 'BRIDGE_JAM' : wg === 'closed' ? 'BRIDGE_CLOSED' : '';
      const w = (want ? this.world.state.wagons.find((q) => q.status.k === want) : undefined) ?? moving[0];
      if (w) this.go('wagon', w.id, true);
    }
    if (p.get('collapsed') === '1') this.prefs.waybillCollapsed = true;
    if (p.get('market') === '1') this.openMarket();
  }

  /** Two screen points whose straight drag drafts a road failing with TOO_STEEP (for screenshots/tests). */
  private findSteepDraft(): { from: [number, number]; to: [number, number]; text: string } | null {
    const world = this.world, view = this.view, W = world.terrain.w;
    const map = new Map<number, [number, number]>();
    const vw = window.innerWidth, vh = window.innerHeight;
    for (let y = 120; y < vh - 160; y += 5) {
      for (let x = 20; x < vw - 20; x += 5) {
        const c = view.cellAt(x, y);
        if (c >= 0 && !map.has(c)) map.set(c, [x, y]);
      }
    }
    const occ = net(world).occupied;
    let best: { from: [number, number]; to: [number, number]; text: string } | null = null;
    let bestD = Infinity;
    for (const [c, pt] of map) {
      for (const d of [W, 1]) {
        const b = c + d;
        if (!map.has(b) || world.terrain.water[c] || occ[c] !== -1) continue;
        if (Math.abs(grade(world.terrain, c, b)) < 0.16) continue;
        const a0 = c - 3 * d, b0 = b + 2 * d;
        const pa = map.get(a0), pb = map.get(b0);
        if (!pa || !pb) continue;
        const cells = lineCells(W, a0, b0);
        const r = validateRoad(world, cells, 1);
        if (r.ok || r.err.k !== 'TOO_STEEP') continue;
        const dd = Math.hypot(pt[0] - vw / 2, pt[1] - vh / 2);
        if (dd < bestD) { bestD = dd; best = { from: pa, to: pb, text: errorText(r.err) }; }
      }
    }
    return best;
  }
}
