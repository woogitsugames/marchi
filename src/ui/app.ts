// App shell: main menu over a live scene, the game screen (HUD, sheets, markers, tools),
// autosave, end-of-mission letter, debug params for screenshots.
import {
  TICK_HZ, applyCommand, buildingById, createWorld, grade, lineCells, net, stars, validateRoad, worldFromState,
  type Command, type CommandResult, type SimState, type SurfaceKind, type World,
} from '../sim/index';
import { GameLoop, type Speed } from '../game/loop';
import type { PickResult, Quality, WorldView } from '../render/api';
import { listSaves, loadGame, saveGame, deleteSave } from '../platform/save';
import { onLangChange, t } from '../i18n/index';
import { bridgeA, stableId } from '../../tools/bot';
import { h } from './dom';
import { Hud, type Tool } from './hud';
import { attachInput } from './input';
import { Markers } from './markers';
import { buildEndLetter, buildMainMenu, gameMenuSheet, settingsSheet, type SaveInfo } from './menu';
import { buildingSheet, wagonSheet, type PanelNav } from './panels';
import { loadPrefs, savePrefs, type Prefs } from './prefs';
import { RoadDraft, errorText } from './roadTool';
import { Sheets } from './sheets';
import type { IconId } from './icons';

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
  private layers: { markers: HTMLElement; hud: HTMLElement; sheets: HTMLElement; menu: HTMLElement; overlay: HTMLElement };
  world: World;
  private loop: GameLoop;
  private mode: 'menu' | 'game' = 'menu';
  private missionId: 'm1' | 'sandbox' = 'm1';
  private sheets: Sheets;
  private hud: Hud | null = null;
  private markers = new Markers();
  private draft: RoadDraft;
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

  constructor(o: AppOptions) {
    this.view = o.view;
    this.canvas = o.canvas;
    this.params = o.params;
    const layer = (id: string): HTMLElement => h('div', { id });
    this.layers = { markers: layer('markers'), hud: layer('hud'), sheets: layer('sheets'), menu: layer('menu'), overlay: layer('overlay') };
    o.ui.append(this.layers.markers, this.layers.hud, this.layers.menu, this.layers.sheets, this.layers.overlay);
    this.layers.markers.append(this.markers.root);
    this.markers.onBubble = (kind, id) => this.go(kind, id, false);
    this.sheets = new Sheets(this.layers.sheets);
    this.sheets.onChange = () => this.syncSelection();

    this.view.mount(this.canvas);
    this.world = createWorld('m1');
    this.loop = new GameLoop(this.world);
    this.draft = new RoadDraft(() => this.view, () => this.world, this.markers, (cells, surface) => this.enqueue({ t: 'road', cells, surface }));

    this.applyLayout();
    window.addEventListener('resize', () => this.applyLayout());
    window.visualViewport?.addEventListener('resize', () => this.applyLayout());
    document.body.classList.toggle('left-handed', this.prefs.leftHanded);
    this.view.setQuality(this.prefs.quality);

    attachInput(this.canvas, () => this.view.camera, {
      tap: (x, y) => this.onTap(x, y),
      draftMode: () => this.mode === 'game' && (this.tool === 'road' || this.tool === 'cobble'),
      draftStart: (x, y) => { this.draft.surface = (this.tool === 'cobble' ? 2 : 1) as SurfaceKind; this.draft.start(x, y); },
      draftMove: (x, y) => this.draft.move(x, y),
      draftEnd: (x, y) => this.draft.end(x, y),
      draftCancel: () => this.draft.cancel(),
      twoFingerTap: () => document.body.classList.toggle('is-clear'),
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
      ready: false,
    };
  }

  async start(): Promise<void> {
    const play = this.params.get('play');
    if (play === 'm1' || play === 'sandbox') {
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
    try {
      const saves = await listSaves();
      const s = saves.find((x) => x.slot === SAVE_SLOT);
      this.save = s ? { missionId: s.missionId, tick: s.tick } : null;
    } catch { this.save = null; }
    this.renderMenu();
  }

  private renderMenu(): void {
    this.layers.menu.innerHTML = '';
    if (this.mode !== 'menu') return;
    this.layers.menu.append(buildMainMenu({
      continueGame: () => void this.continueGame(),
      newGame: (m) => this.newGame(m),
      openSettings: () => this.openSettings(),
    }, this.save));
  }

  private setWorld(w: World): void {
    this.world = w;
    this.loop = new GameLoop(w);
    this.loop.onTick = () => this.onTick();
    this.loop.onCommandResult = (cmd, r) => this.onCommandResult(cmd, r);
    this.view.setWorld(w);
    this.lastSaveTick = w.state.tick;
    this.endShown = false;
    this.selection = null;
    this.followId = null;
    this.view.setSelection(null);
    this.view.setRoadPreview(null);
  }

  newGame(id: 'm1' | 'sandbox'): void {
    this.missionId = id;
    this.enterGame(createWorld(id));
  }

  private async continueGame(): Promise<void> {
    try {
      const st: SimState | null = await loadGame(SAVE_SLOT);
      if (!st) return;
      this.missionId = st.mission.id === 'sandbox' ? 'sandbox' : 'm1';
      this.enterGame(worldFromState(st));
    } catch (e) {
      console.error(e);
    }
  }

  private enterGame(w: World): void {
    this.mode = 'game';
    this.sheets.closeAll();
    this.layers.menu.innerHTML = '';
    this.layers.overlay.querySelector('.scrim')?.remove();
    document.body.classList.remove('mode-menu', 'is-clear');
    document.body.classList.add('mode-game');
    this.view.setMenuMode(false);
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
    }, this.prefs.waybillCollapsed);
    this.layers.hud.append(this.hud.root);
    this.hud.setSpeed(this.loop.speed);
    this.hud.setTool(this.tool, this.overlay);
    this.hud.update(this.world);
    requestAnimationFrame(() => this.measureRail());
  }

  private clearGameUi(): void {
    this.layers.hud.innerHTML = '';
    this.layers.overlay.querySelector('.scrim')?.remove();
    this.markers.reset();
    this.hud = null;
    this.draft.cancel();
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
    const alpha = this.loop.advance(dt);
    this.view.frame(alpha, dt);
    if (this.mode === 'game') {
      this.hud?.update(this.world);
      this.markers.update(this.world, this.view, this.selection?.kind === 'wagon' ? this.selection.id : null, false);
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
        `${t('why.wagons', { n: this.world.state.wagons.length })}  tick ${this.world.state.tick}` + (mem ? `  heap ${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : '');
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  private onTick(): void {
    this.view.afterTick();
    if (this.mode === 'game' && this.world.state.tick - this.lastSaveTick >= AUTOSAVE_TICKS) void this.autosave();
  }

  private async autosave(): Promise<void> {
    if (this.mode !== 'game' || this.world.state.mission.result !== 'running') return;
    this.lastSaveTick = this.world.state.tick;
    try { await saveGame(SAVE_SLOT, this.world.state); } catch (e) { console.warn('autosave failed', e); }
  }

  private showEnd(): void {
    this.endShown = true;
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
    if (this.mode !== 'game' || !this.hud) return;
    const icon: IconId = cmd.t === 'road' ? (cmd.surface === 2 ? 'road_cobble' : 'road_dirt') : cmd.t === 'demolish' ? 'demolish' : 'buy_wagon';
    if (!r.ok) {
      this.hud.toast(errorText(r.err), 'err', icon);
      return;
    }
    if (cmd.t === 'road') this.hud.toast(t('hud.built', { n: r.cost }), 'info', icon, 1800);
    else if (cmd.t === 'demolish') this.hud.toast(t('hud.demolished', { n: -r.cost }), 'info', icon, 1800);
    else if (cmd.t === 'buyWagon') this.hud.toast(t('hud.wagonBought', { n: r.cost }), 'info', icon, 1800);
  }

  private buyWagonFromRail(): void {
    const stable = this.world.state.buildings.find((b) => b.type === 'stable');
    if (stable) this.enqueue({ t: 'buyWagon', stable: stable.id });
  }

  // ------------------------------------------------------------------ PanelNav

  go(kind: 'building' | 'wagon', id: number, focus = true): void {
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
  }

  buyWagon(stable: number): void {
    this.enqueue({ t: 'buyWagon', stable });
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
    }
  }

  private setTool(tl: Tool): void {
    this.tool = tl;
    this.draft.cancel();
    this.hud?.setTool(tl, this.overlay);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack') {
      if (this.sheets.count) this.sheets.closeTop();
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
      else if (k === 'h') document.body.classList.toggle('is-clear');
    }
  }

  private openSettings(): void {
    this.sheets.open(settingsSheet({
      quality: () => this.prefs.quality,
      setQuality: (q: Quality) => { this.prefs.quality = q; savePrefs(this.prefs); this.view.setQuality(q); this.applyLayout(); },
      leftHanded: () => this.prefs.leftHanded,
      setLeftHanded: (v) => {
        this.prefs.leftHanded = v;
        savePrefs(this.prefs);
        document.body.classList.toggle('left-handed', v);
        requestAnimationFrame(() => this.measureRail());
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
    this.sheets.open(content);
  }

  // ------------------------------------------------------------------ layout

  private applyLayout(): void {
    const w = window.innerWidth, hgt = window.innerHeight;
    const land = w > hgt && hgt < 700;
    document.body.classList.toggle('is-landscape', land);
    document.body.classList.toggle('is-side', land || w >= 840);
    const dpr = Math.min(window.devicePixelRatio || 1, this.prefs.quality === 'low' ? 1 : 2);
    this.view.resize(w, hgt, dpr);
    requestAnimationFrame(() => this.measureRail());
  }

  private measureRail(): void {
    const rail = this.layers.hud.querySelector<HTMLElement>('.rail');
    if (!rail) return;
    const r = rail.getBoundingClientRect();
    const st = getComputedStyle(document.documentElement);
    const safeB = parseFloat(st.getPropertyValue('--safe-b')) || 0;
    if (!document.body.classList.contains('is-landscape')) document.documentElement.style.setProperty('--rail-h', `${Math.max(0, r.height - safeB)}px`);
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
    if (tool === 'road' || tool === 'cobble' || tool === 'demolish') this.setTool(tool);
    const open = p.get('open');
    if (open) {
      const b = this.world.state.buildings.find((q) => q.type === open);
      if (b) this.go('building', b.id, true);
    }
    const wg = p.get('wagon');
    if (wg) {
      const moving = this.world.state.wagons.filter((q) => q.status.k !== 'IDLE');
      const w = wg === 'jam' ? this.world.state.wagons.find((q) => q.status.k === 'BRIDGE_JAM') ?? moving[0] : moving[0];
      if (w) this.go('wagon', w.id, true);
    }
    if (p.get('collapsed') === '1') this.prefs.waybillCollapsed = true;
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
