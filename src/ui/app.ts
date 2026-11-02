// App shell: main menu over a live scene, the game screen (HUD, sheets, markers, tools),
// autosave, end-of-mission letter, debug params for screenshots.
import { AudioEngine } from '../audio/audio';
import { MusicPlayer } from '../audio/music';
import { bindAudioEngine, captureAudioState, observeSim, type AudioSnapshot } from '../audio/bindings';
import {
  TICK_HZ, applyCommand, buildingById, canSurface, createWorld, grade, lineCells, net, stars, suggestLinkToStable, validateRoad, worldFromState,
  type Command, type CommandResult, type SimState, type SurfaceKind, type World,
  isRaining,
} from '../sim/index';
import { GameLoop, type Speed } from '../game/loop';
import type { PickResult, WorldView } from '../render/api';
import { listSaves, loadGame, saveGame, deleteSave } from '../platform/save';
import { onLangChange, t } from '../i18n/index';
import { bridgeA, stableId } from '../../tools/bot';
import { h } from './dom';
import { Hud, type Tool } from './hud';
import { attachInput, type InputHandle } from './input';
import { applyLayoutClasses, computeLayout, devicePosture, foldSignature, isAbrupt, type LayoutInfo } from './layout';
import { Markers } from './markers';
import { buildEndLetter, buildMainMenu, gameMenuSheet, isMissionKey, settingsSheet, type MissionKey, type SaveInfo } from './menu';
import { BuildTool, buildTypes } from './buildTool';
import { marketSheet } from './marketSheet';
import { buildingSheet, wagonSheet, type PanelNav } from './panels';
import { loadPrefs, savePrefs, type Prefs } from './prefs';
import { RoadDraft, errorText } from './roadTool';
import { Sheets } from './sheets';
import { Tutorial } from './tutorial';
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

const SAVE_SLOT = 'auto';
const AUTOSAVE_TICKS = 30 * TICK_HZ;

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
  private loop: GameLoop;
  private mode: 'menu' | 'game' = 'menu';
  private missionId: MissionKey = 'm1';
  private prevAudio: AudioSnapshot | null = null;
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
  private perfEl: HTMLElement | null = null;
  private perfAt = 0;
  private save: SaveInfo | null = null;
  private speedBeforeMenu: Speed = 1;
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
    this.sheets.onChange = () => this.syncSelection();

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
    });
    this.layers.markers.append(this.build.floating);

    const qp = this.params.get('quality');
    this.qualityParam = isQualityPref(qp) ? qp : null;
    this.dynres.enabled = this.params.get('dynres') !== '0';
    document.body.classList.toggle('left-handed', this.prefs.leftHanded);
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
    onLangChange(() => this.rebuildUi());

    if (this.params.get('perf') === '1') {
      this.perfEl = h('div.perf.num');
      this.layers.overlay.append(this.perfEl);
    }
    (window as unknown as { __marchia: unknown }).__marchia = {
      app: this,
      findSteepDraft: () => this.findSteepDraft(),
      /** Screenshots: the rank-up letter without playing ten minutes. */
      rankUp: (r: number) => this.hud?.showRankUp(r, 60000),
      ready: false,
    };
  }

  async start(): Promise<void> {
    const play = this.params.get('play');
    if (isMissionKey(play)) {
      this.debugStart = this.params.get('tut') !== '1';
      this.newGame(play);
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
    const w = createWorld('m1');
    applyCommand(w, bridgeA(w));
    for (let i = 0; i < 2; i++) applyCommand(w, { t: 'buyWagon', stable: stableId(w) });
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
    const token = ++this.menuToken;
    try {
      const saves = await listSaves();
      const s = saves.find((x) => x.slot === SAVE_SLOT);
      this.save = s ? { missionId: s.missionId, tick: s.tick } : null;
    } catch { this.save = null; }
    if (token !== this.menuToken || this.mode !== 'menu') return;
    if (this.save) this.renderMenu();
  }

  private renderMenu(broken: MissionKey | null = null): void {
    this.layers.menu.innerHTML = '';
    if (this.mode !== 'menu') return;
    this.layers.menu.append(buildMainMenu({
      continueGame: () => void this.continueGame(),
      newGame: (m) => this.newGame(m),
      openSettings: () => this.openSettings(),
    }, broken ? null : this.save, broken));
  }

  private setWorld(w: World): void {
    this.world = w;
    this.loop = new GameLoop(w);
    this.loop.onTick = () => this.onTick();
    this.prevAudio = captureAudioState(w.state);
    armAudioUnlock();
    this.loop.onCommandResult = (cmd, r) => this.onCommandResult(cmd, r);
    this.view.setWorld(w);
    this.lastSaveTick = w.state.tick;
    this.endShown = false;
    this.selection = null;
    this.followId = null;
    this.view.setSelection(null);
    this.build.setOpen(false);
    this.view.setRoadPreview(null);
    this.ghosts = { gap: null, tut: null };
    this.ghostKey = '';
  }

  newGame(id: MissionKey): void {
    this.missionId = id;
    this.enterGame(createWorld(id));
    const forced = this.params.get('tut') === '1';
    if (id === 'm1' && (forced || (!this.debugStart && this.prefs.tutorialM1 === 'new'))) this.startTutorial();
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

  private async continueGame(): Promise<void> {
    try {
      const st: SimState | null = await loadGame(SAVE_SLOT);
      if (!st) throw new Error('save slot is empty');
      this.missionId = isMissionKey(st.mission.id) ? st.mission.id : 'm1';
      this.enterGame(worldFromState(st));
    } catch (e) {
      // damaged / incompatible save: say so and offer the same contract afresh
      console.error('continue failed', e);
      if (this.mode !== 'menu') return;
      const m: MissionKey = isMissionKey(this.save?.missionId) ? this.save!.missionId as MissionKey : 'm1';
      if (audio.ready) void audio.play('ui.error');
      this.renderMenu(m);
    }
  }

  private enterGame(w: World): void {
    this.stopTutorial();
    this.mode = 'game';
    this.sheets.closeAll();
    this.layers.menu.innerHTML = '';
    this.layers.overlay.querySelector('.scrim')?.remove();
    document.body.classList.remove('mode-menu', 'is-clear');
    document.body.classList.add('mode-game');
    this.view.setMenuMode(false);
    music.setMood(isRaining(w.state) ? 'rain' : 'play');
    this.setWorld(w);
    this.loop.speed = 1;
    this.overlay = false;
    this.view.setOverlay('none');
    this.tool = 'none';
    this.buildHud();
  }

  private buildHud(): void {
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
      waybillCollapsed: (c) => { this.prefs.waybillCollapsed = c; savePrefs(this.prefs); },
      openMarket: () => this.openMarket(),
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
    this.hud.update(this.world);
    requestAnimationFrame(() => this.measureRail());
  }

  private clearGameUi(): void {
    this.stopTutorial();
    this.layers.hud.innerHTML = '';
    this.layers.overlay.querySelector('.scrim')?.remove();
    this.markers.reset();
    this.hud = null;
    this.draft.cancel();
    this.build.setOpen(false);
    this.tool = 'none';
    document.body.classList.remove('has-undo', 'build-open', 'build-placing');
  }

  private rebuildUi(): void {
    if (this.mode === 'menu') this.renderMenu();
    else this.buildHud();
    this.sheets.update();
    if (this.endShown) { this.endShown = false; this.layers.overlay.querySelector('.scrim')?.remove(); }
  }

  // ------------------------------------------------------------------ frame & ticks

  private frame(now: number): void {
    const dt = Math.min(250, now - this.lastFrame);
    this.lastFrame = now;
    if (document.visibilityState === 'visible' && this.dynres.sample(dt, now)) this.applyRenderSize();
    if (now - this.foldCheckAt > 500) {
      this.foldCheckAt = now;
      const sig = foldSignature();
      if (sig !== this.foldSig) { this.foldSig = sig; this.scheduleLayout(); }
    }
    const alpha = this.loop.advance(dt);
    this.view.frame(alpha, dt);
    if (this.mode === 'game') {
      this.hud?.update(this.world);
      this.markers.update(this.world, this.view, this.selection?.kind === 'wagon' ? this.selection.id : null, false);
      this.tutorial?.update(dt);
      this.build.frame();
      this.applyGhost();
      if (now - this.lastSheetUpdate > 250) {
        this.lastSheetUpdate = now;
        this.sheets.update();
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
    if (this.prevAudio && audio.ready) {
      const l = this.view.audioListener?.() ?? { x: 0, z: 0, yaw: 0 };
      const tr = this.world.terrain;
      observeSim(this.prevAudio, this.world.state, {
        x: l.x, z: l.z, yaw: l.yaw, mapWidth: tr.w, cellSize: tr.cellSize, water: tr.water, audibleRadius: 90,
      });
    }
    this.prevAudio = captureAudioState(this.world.state);
    if (this.mode === 'game' && this.world.state.mission.result === 'running') music.setMood(isRaining(this.world.state) ? 'rain' : 'play');
    if (this.mode === 'game' && this.world.state.tick - this.lastSaveTick >= AUTOSAVE_TICKS) void this.autosave();
  }

  private async autosave(): Promise<void> {
    if (this.mode !== 'game' || this.world.state.mission.result !== 'running') return;
    this.lastSaveTick = this.world.state.tick;
    try { await saveGame(SAVE_SLOT, this.world.state); } catch (e) { console.warn('autosave failed', e); }
  }

  private showEnd(): void {
    this.endShown = true;
    this.stopTutorial();
    music.setMood(this.world.state.mission.result === 'won' ? 'won' : 'lost');
    this.loop.speed = 0;
    this.hud?.setSpeed(0);
    this.sheets.closeAll();
    this.setTool('none');
    void deleteSave(SAVE_SLOT).catch(() => undefined);
    const letter = buildEndLetter(this.world, stars(this.world), {
      again: () => this.newGame(this.missionId),
      menu: () => void this.showMenu(),
    });
    this.layers.overlay.append(letter);
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
      : cmd.t === 'sellWagon' ? 'coin' : cmd.t === 'place' ? 'build' : 'buy_wagon';
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
    else if (cmd.t === 'place') this.afterPlace(cmd.type, cmd.x, cmd.y, n);
  }

  /** A building went up: toast, back to the shelf, and if its gate is cut off, the gap finder at once. */
  private afterPlace(type: string, x: number, y: number, n: string): void {
    if (audio.ready) void audio.play('ui.wood');
    this.hud?.toast(t('hud.placed', { name: t(`building.${type}` as 'building.farm'), n }), 'info', 'build', 2200);
    this.build.back();
    const b = this.world.state.buildings.find((q) => q.x === x && q.y === y && q.placedTick >= 0);
    if (!b || b.type === 'stable' || !suggestLinkToStable(this.world, b.id)) return;
    this.setTool('none');
    this.go('building', b.id, false);
  }

  private openMarket(): void {
    this.sheets.open(marketSheet(() => this.world));
  }

  /** Middle of the map area not covered by the rail or the build shelf (first ghost position). */
  private sceneCentre(): [number, number] {
    const l = this.layout ?? computeLayout();
    let x0 = 0, x1 = l.w, y1 = l.sceneH;
    const y0 = 0;
    for (const el of document.querySelectorAll<HTMLElement>('#hud .rail-tools, #hud .rail-line, #hud .build-shelf')) {
      if (el.hidden || el.offsetParent === null) continue;
      const r = el.getBoundingClientRect();
      if (r.top > l.sceneH * 0.45 && r.top < y1 && !l.landscape) y1 = Math.max(l.sceneH * 0.4, r.top);
      if (l.landscape && r.left > l.w * 0.5) x1 = Math.min(x1, r.left);
      if (l.landscape && r.right < l.w * 0.5) x0 = Math.max(x0, r.right);
    }
    return [(x0 + x1) / 2, y0 + (y1 - y0) * 0.5];
  }

  private buyWagonFromRail(): void {
    const stable = this.world.state.buildings.find((b) => b.type === 'stable');
    if (stable) this.enqueue({ t: 'buyWagon', stable: stable.id });
  }

  // ------------------------------------------------------------------ PanelNav

  go(kind: 'building' | 'wagon', id: number, focus = true): void {
    const prevTop = this.sheets.top?.content.key ?? null;
    if (kind === 'building') {
      const b = buildingById(this.world, id);
      if (!b) return;
      if (focus) { this.stopFollow(); this.view.camera.focusCell(b.gate); }
      this.sheets.open(buildingSheet(this, id));
    } else {
      const w = this.world.state.wagons.find((q) => q.id === id);
      if (!w) return;
      if (focus) { this.stopFollow(); this.view.camera.focusCell(w.next >= 0 ? w.next : w.at); }
      this.sheets.open(wagonSheet(this, id));
    }
    this.select({ kind, id });
    this.tutorial?.onOpen(kind, id, prevTop);
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
      this.view.camera.follow(id);
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
  }

  private syncSelection(): void {
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
      } else cell = this.view.cellAt(x, y);
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
        document.body.classList.toggle('left-handed', v);
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
      restart: () => { void deleteSave(SAVE_SLOT).catch(() => undefined); this.newGame(this.missionId); },
      toMenu: () => { void this.autosave().then(() => this.showMenu()); },
    }, this.world);
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
    if (prev && prev.dpr !== l.dpr) this.watchDpr();
    // The camera orbits a target at the canvas centre, so the subject stays centred through any resize.
    this.view.resize(l.w, l.sceneH, this.renderDpr());
    requestAnimationFrame(() => { this.measureRail(); this.hud?.relayout(); });
  }

  private measureRail(): void {
    const rail = this.layers.hud.querySelector<HTMLElement>('.rail');
    if (!rail) return;
    const r = rail.getBoundingClientRect();
    const st = getComputedStyle(document.documentElement);
    const safeB = parseFloat(st.getPropertyValue('--safe-b')) || 0;
    const b = document.body.classList;
    const root = document.documentElement.style;
    if (b.contains('is-mini')) {
      root.setProperty('--rail-h', '0px');
      root.setProperty('--rail-top', `${r.height}px`);
    } else {
      root.setProperty('--rail-top', '0px');
      if (!b.contains('is-landscape')) root.setProperty('--rail-h', `${Math.max(0, r.height - safeB)}px`);
    }
  }

  // ------------------------------------------------------------------ debug (screenshots, bots)

  private applyDebug(): void {
    const p = this.params;
    const hudBefore = this.hud;
    this.hud = null; // no toasts for the scripted plan or while fast-forwarding
    if (p.get('bot') === '1') {
      const w = this.world;
      const plan: Command[] = [bridgeA(w)];
      for (let i = 0; i < 4; i++) plan.push({ t: 'buyWagon', stable: stableId(w) });
      for (const c of plan) this.loop.enqueue(c);
      this.loop.flushCommands();
    }
    const ff = Number(p.get('ff') ?? 0);
    if (ff > 0) {
      const target = Math.min(ff * TICK_HZ, 60 * 60 * TICK_HZ);
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
