// The world view: owns the three.js renderer and scene, and wires terrain, roads, water,
// vegetation, buildings, bridges, wagons, sky/lighting, effects, overlays, picking and the
// camera rig together behind the WorldView contract (src/render/api.ts). Read-only on sim state.
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PCFSoftShadowMap,
  Ray,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { World } from '../sim/index';
import { isRaining, net, timeOfDay } from '../sim/index';
import type { Overlay, PickResult, PlacementGhost, Quality, RoadPreview, ScreenAnchor, WorldView } from './api';
import { BridgesView } from './bridgesView';
import { BuildingsView } from './buildingsView';
import { CameraRig } from './cameraRig';
import { Effects } from './fx';
import { GroundCover } from './groundCover';
import { CELL, Heightfield } from './heightfield';
import { Lighting } from './lighting';
import { applyTextures, foliageLift, type MatKey } from './models/materials';
import { OverlayData } from './overlay';
import { PlacementGhostView } from './placementGhost';
import { cellAtPoint, rayGround, screenRay } from './picking';
import { RoadField } from './roads';
import { TerrainView } from './terrain';
import { disposeTerrainTextures, loadTerrainTextures, type TerrainTextureSet } from './terrainTextures';
import {
  disposeTextures,
  disposeTexturesExcept,
  getUltraBase,
  initTextureLoaders,
  loadPbrSet,
  setUltraBase,
  type TextureName,
} from './textures';
import { VegetationView } from './vegetation';
import { WaterView } from './water';
import { WagonsView } from './wagonsView';

/** Drawing-buffer pixel-ratio cap per quality (the UI caps low at 1 itself, src/ui/tier.ts). */
const DPR_CAP: Readonly<Record<Quality, number>> = { low: 1.25, high: 2, ultra: 3 };

/** Menu: dawn at the river crossing. */
const MENU_TIME = 0.262;
const MENU_TARGET = { x: 41.5 * CELL, z: 35 * CELL, dist: 52, yaw: -0.75 };

const MODEL_TEXTURES: [MatKey, TextureName][] = [
  ['wood', 'wood_planks'],
  ['thatch', 'thatch'],
  ['stone', 'fieldstone_wall'],
  ['plaster', 'plaster_daub'],
  ['bark', 'bark'],
];

const _v = new Vector3();
const _v2 = new Vector3();
const _ray = new Ray();

export interface WorldViewDebug {
  /** Force a time of day (0..1) or null for the sim clock. Harness/dev only. */
  forceTime: number | null;
}

class View implements WorldView {
  audioListener(): { x: number; z: number; yaw: number } {
    return { x: this.rig.target.x, z: this.rig.target.z, yaw: this.rig.yaw };
  }
  readonly scene = new Scene();
  readonly rig = new CameraRig();
  readonly debug: WorldViewDebug = { forceTime: null };
  private renderer: WebGLRenderer | null = null;
  private world: World | null = null;
  private hf: Heightfield | null = null;
  private lighting: Lighting;
  private terrain: TerrainView | null = null;
  private water: WaterView | null = null;
  private roads: RoadField | null = null;
  private overlay: OverlayData | null = null;
  private vegetation: VegetationView | null = null;
  private cover: GroundCover | null = null;
  private buildings: BuildingsView | null = null;
  private bridges = new BridgesView();
  private wagons: WagonsView | null = null;
  private fx = new Effects();
  private ghost = new PlacementGhostView();
  private ghostReq: PlacementGhost | null = null;
  /** Selection ring of a wagon on a bridge deck (the terrain-draped ring would lie on the river bed). */
  private deckRing: Mesh;
  private worldGroup = new Group();
  private treeGroup = new Group();
  private netVer = -1;
  private quality: Quality = 'high';
  private cssW = 1;
  private cssH = 1;
  private dpr = 1;
  private time = 0;
  private rain = 0;
  private wet = 0;
  private tod = MENU_TIME;
  private fps = 60;
  private overlayMode: Overlay = 'none';
  private selection: PickResult = null;
  private trafficTimer = 0;
  private emitterTimer = 0;
  /** Bumped on every texture (re)load; results of an older generation are discarded. */
  private texGen = 0;
  /** Tier (and ultra pack base) of the last texture load started; null = none yet. */
  private texQuality: Quality | null = null;
  private texUltraBase: string | null = null;
  /** Terrain arrays that arrived before a TerrainView existed. */
  private pendingTerrainTex: TerrainTextureSet | null = null;
  texturesReady: Promise<void> = Promise.resolve();
  private baked = false;
  private menu = false;
  /** Jump environment (time of day, rain) to the sim state on the next frame. */
  private snapEnv = true;
  private lastStats = { calls: 0, triangles: 0 };

  constructor() {
    this.lighting = new Lighting(this.scene);
    this.scene.add(this.worldGroup);
    this.worldGroup.add(this.treeGroup, this.bridges.group, this.fx.smoke, this.fx.rain, this.ghost.group);
    const ring = new RingGeometry(4.46, 4.74, 56, 1);
    ring.rotateX(-Math.PI / 2);
    this.deckRing = new Mesh(ring, new MeshBasicMaterial({ color: new Color('#8c4a2f'), transparent: true, opacity: 0.85, depthWrite: false }));
    this.deckRing.name = 'deck-selection-ring';
    this.deckRing.renderOrder = 19;
    this.deckRing.visible = false;
    this.worldGroup.add(this.deckRing);
  }

  get camera() {
    return this.rig;
  }

  get terrainView(): TerrainView | null {
    return this.terrain;
  }

  mount(canvas: HTMLCanvasElement): void {
    const r = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    r.outputColorSpace = SRGBColorSpace;
    r.toneMapping = typeof AgXToneMapping === 'number' ? AgXToneMapping : ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = PCFSoftShadowMap;
    r.info.autoReset = true;
    this.renderer = r;
    try {
      initTextureLoaders(r);
    } catch (e) {
      console.warn('[view] KTX2 loader unavailable, using JPG textures', e);
    }
    // Dev server: the 4K pack is served from the repo (assets-ultra/ is not in public/), so
    // 'ultra' can be tested. Production gets the base from the pack downloader (D-17).
    if (import.meta.env.DEV && getUltraBase() === null) setUltraBase(`${import.meta.env.BASE_URL}assets-ultra/`);
    this.applyQuality();
    this.resize(canvas.clientWidth || 1, canvas.clientHeight || 1, window.devicePixelRatio || 1);
    // Deferred: a setQuality() right after mount() (the app does that) picks the tier first,
    // so the default tier is not downloaded only to be thrown away.
    queueMicrotask(() => this.loadTextures());
    if (this.vegetation && !this.baked) { this.vegetation.bake(r); this.baked = true; }
  }

  /**
   * Load the textures of the current tier if they differ from the last load (tier, or the ultra
   * pack base). The new sets are bound when complete; only then are the old ones disposed, so
   * the scene never samples a freed texture. Overlapping switches: only the newest load binds.
   */
  private loadTextures(): void {
    if (!this.renderer) return;
    const q = this.quality;
    const base = q === 'ultra' ? getUltraBase() : null;
    if (this.texQuality === q && this.texUltraBase === base) return;
    this.texQuality = q;
    this.texUltraBase = base;
    const gen = ++this.texGen;
    const terrain = loadTerrainTextures(q)
      .then((t) => {
        if (gen !== this.texGen) disposeTerrainTextures(t);
        else this.bindTerrainTextures(t);
      })
      .catch((e) => console.warn('[view] terrain textures', e));
    const models = Promise.all(
      MODEL_TEXTURES.map(([key, name]) =>
        loadPbrSet(name, q, { albedo: false })
          .then((s) => ({ key, s }))
          .catch((e) => { console.warn('[view] model textures', name, e); return null; }),
      ),
    ).then(async (sets) => {
      if (gen !== this.texGen) return; // a newer load binds (and disposes these with the rest)
      for (const it of sets) if (it) applyTextures(it.key, { normalMap: it.s.normalMap, roughnessMap: it.s.roughnessMap });
      await disposeTexturesExcept(q);
    });
    this.texturesReady = Promise.all([terrain, models]).then(() => undefined);
  }

  private bindTerrainTextures(t: TerrainTextureSet): void {
    if (this.terrain) {
      this.terrain.setTextures(t); // disposes the previous arrays
      return;
    }
    if (this.pendingTerrainTex && this.pendingTerrainTex !== t) disposeTerrainTextures(this.pendingTerrainTex);
    this.pendingTerrainTex = t;
  }

  setWorld(world: World): void {
    const sameTerrain = this.world && this.world.terrain === world.terrain && this.hf;
    this.world = world;
    if (!sameTerrain) {
      // the loaded splat arrays survive a world change: hand them to the new TerrainView
      const carried = this.terrain?.detachTextures() ?? this.pendingTerrainTex;
      this.pendingTerrainTex = null;
      this.disposeWorld();
      const hf = new Heightfield(world.terrain);
      this.hf = hf;
      this.rig.setHeightfield(hf);
      this.roads = new RoadField(hf.w, hf.h);
      this.overlay = new OverlayData(hf.w, hf.h);
      this.terrain = new TerrainView(hf, this.roads, this.overlay);
      if (carried) this.terrain.setTextures(carried);
      this.water = new WaterView(hf);
      this.vegetation = new VegetationView(hf, this.treeGroup);
      this.cover = new GroundCover(hf);
      this.worldGroup.add(this.cover.group);
      this.buildings = new BuildingsView(hf);
      this.wagons = new WagonsView(hf, this.roads);
      this.worldGroup.add(this.terrain.group, this.water.mesh, this.water.mist, this.buildings.group, this.wagons.group);
      if (this.renderer && !this.baked) { this.vegetation.bake(this.renderer); this.baked = true; }
      this.applyQuality();
      if (!this.menu) this.rig.set(hf.sizeX * 0.45, hf.sizeZ * 0.5, 230, -0.3);
    }
    this.wagons!.reset();
    this.snapEnv = true;
    this.netVer = -1;
    this.syncNetwork();
    if (!sameTerrain && this.menu) {
      const m = this.menuTarget();
      this.rig.set(m.x, m.z, MENU_TARGET.dist, MENU_TARGET.yaw);
    }
    this.wagons!.afterTick(world, performance.now());
    this.overlay!.updateTraffic(world);
    this.setSelection(this.selection);
    this.ghost.set(null, null, null, this.overlay);
    this.setPlacementGhost(this.ghostReq);
  }

  private disposeWorld(): void {
    if (this.terrain) { this.worldGroup.remove(this.terrain.group); this.terrain.dispose(); }
    if (this.water) { this.worldGroup.remove(this.water.mesh, this.water.mist); this.water.dispose(); }
    if (this.buildings) { this.worldGroup.remove(this.buildings.group); this.buildings.dispose(); }
    if (this.wagons) { this.worldGroup.remove(this.wagons.group); this.wagons.dispose(); }
    this.vegetation?.dispose();
    if (this.cover) { this.worldGroup.remove(this.cover.group); this.cover.dispose(); this.cover = null; }
    this.terrain = null;
  }

  private syncNetwork(): void {
    const w = this.world;
    if (!w || !this.roads) return;
    if (w.state.netVersion === this.netVer) return;
    this.netVer = w.state.netVersion;
    net(w);
    this.roads.rebuild(w);
    this.bridges.rebuild(this.roads.bridges);
    this.buildings!.sync(w);
    this.terrain!.updateGround(w);
    this.vegetation!.rebuild(w, this.roads);
    this.vegetation!.update(this.rig.camera.position, true);
    this.cover?.rebuild(w, this.roads);
    this.updateEmitters(true);
    if (this.ghostReq) this.ghost.set(this.ghostReq, w, this.hf, this.overlay);
  }

  private updateEmitters(force: boolean): void {
    const w = this.world;
    if (!w || !this.buildings) return;
    const list: { pos: Vector3; on: boolean }[] = [];
    for (const b of w.state.buildings) {
      const info = this.buildings.info.get(b.id);
      if (!info || !info.smoke) continue;
      // bakery smokes when working; other hearths smoulder at night/in the morning
      const on = b.type === 'bakery' ? b.status.k === 'WORKING' : false;
      list.push({ pos: info.smoke, on });
    }
    if (force || list.length) this.fx.setEmitters(list);
  }

  afterTick(): void {
    if (!this.world || !this.wagons) return;
    if (this.world.state.netVersion !== this.netVer) this.syncNetwork();
    this.wagons.afterTick(this.world, performance.now());
  }

  frame(alpha: number, dtMs: number): void {
    const r = this.renderer, w = this.world;
    if (!r || !w || !this.hf || !this.terrain || !this.wagons) return;
    const dt = Math.min(0.1, Math.max(0, dtMs / 1000));
    this.time += dt;
    if (dt > 0) this.fps += (1 / dt - this.fps) * Math.min(1, dt * 2);
    if (w.state.netVersion !== this.netVer) this.syncNetwork();

    // --- environment
    const f = this.menu ? MENU_TIME : this.debug.forceTime ?? timeOfDay(w);
    // smooth the clock across wrap-around
    let d = f - this.tod;
    if (d > 0.5) d -= 1;
    if (d < -0.5) d += 1;
    const snap = this.snapEnv;
    this.snapEnv = false;
    this.tod = snap ? f : (this.tod + d * Math.min(1, dt * 4) + 1) % 1;
    const raining = !this.menu && isRaining(w.state);
    const rt = raining ? 1 : 0;
    this.rain = snap ? rt : this.rain + (rt - this.rain) * Math.min(1, dt * 0.6);
    // ground gets wet quickly and dries slowly
    this.wet = snap ? rt : this.wet + (rt - this.wet) * Math.min(1, dt * (raining ? 0.4 : 0.05));
    this.lighting.update(this.tod, this.rain);
    const env = this.lighting.env;
    foliageLift.value.copy(this.lighting.hemi.color).multiplyScalar(this.lighting.hemi.intensity * 0.17);
    r.toneMappingExposure = env.exposure * 1.3;

    this.updateMenuWagon();
    // wagons first (with last frame's camera) so a followed wagon's position is current
    this.wagons.frame(w, alpha, dt, this.rig.camera, this.time);

    // --- camera
    let followPos: Vector3 | null = null;
    if (this.rig.followId !== null) {
      const s = this.wagons.get(this.rig.followId);
      if (s && s.init) followPos = _v2.set(s.fx, s.fy, s.fz);
    }
    this.rig.update(dt, followPos);
    const cam = this.rig.camera;
    this.lighting.followCamera(cam.position);
    const dist = this.rig.dist;
    this.lighting.fog.density = (0.8 / (dist + 300)) * (1 + this.rain * 0.45);
    this.lighting.fitShadow(this.rig.target, Math.min(320, Math.max(28, dist * 0.8)));

    // --- world
    const tu = this.terrain.uniforms;
    tu.uWet!.value = this.wet;
    (tu.uSky!.value as Color).copy(env.skyH).multiplyScalar(env.light);
    tu.uTime!.value = this.time;
    tu.uTraffic!.value = this.overlayMode === 'traffic' ? 1 : 0;
    // morning mist thins out at close zoom so the river stays dark and clear up close
    const mistZoom = this.menu ? 1 : 0.85 * (0.3 + 0.7 * Math.min(1, Math.max(0, (dist - 30) / 90)));
    this.water!.update(this.time, this.rain, env.mist * mistZoom);
    const wu = this.water!.material.uniforms;
    wu.uLight!.value = env.light;
    (wu.uSkyH!.value as Color).copy(env.skyH);
    (wu.uSkyZ!.value as Color).copy(env.skyZ);
    (wu.uSunDir!.value as Vector3).copy(env.sunDir);
    (wu.uSunCol!.value as Color).copy(env.sunColor).multiplyScalar(env.isNight ? 0.2 : 1);
    (this.water!.mistMaterial.uniforms.uColor!.value as Color).copy(env.fogColor).lerp(env.skyH, 0.3);

    this.buildings!.update(w, dt);
    this.vegetation!.update(cam.position);
    this.cover?.update(this.rig.target, dist);

    this.trafficTimer -= dt;
    if (this.trafficTimer <= 0) {
      this.trafficTimer = 1;
      if (this.overlayMode === 'traffic') this.overlay!.updateTraffic(w);
    }
    this.emitterTimer -= dt;
    if (this.emitterTimer <= 0) {
      this.emitterTimer = 0.5;
      this.updateEmitters(false);
    }
    this.fx.update(this.time, this.rain, this.rig.target, Math.min(140, 30 + dist * 0.5), env.light);
    this.updateSelectionRing();

    r.render(this.scene, cam);
    this.lastStats.calls = r.info.render.calls;
    this.lastStats.triangles = r.info.render.triangles;
  }

  /** Bridge centre and axis (first bridge found), for the menu shot. */
  private bridgeAxis(): { x: number; z: number; dx: number; dz: number } | null {
    const br = this.roads?.bridges;
    if (!br || !br.length) return null;
    let x = 0, z = 0;
    for (const b of br) { x += b.x; z += b.z; }
    const a = br[0]!.angle;
    return { x: x / br.length, z: z / br.length, dx: Math.sin(a), dz: Math.cos(a) };
  }

  private menuTarget(): { x: number; z: number } {
    const b = this.bridgeAxis();
    return b ? { x: b.x, z: b.z } : MENU_TARGET;
  }

  /** Menu cinematic: one loaded wagon keeps crossing the bridge (render-only, no sim effect). */
  private updateMenuWagon(): void {
    const wv = this.wagons, w = this.world, hf = this.hf;
    if (!wv || !w || !hf) return;
    const b = this.menu ? this.bridgeAxis() : null;
    if (!b) { wv.decor.length = 0; return; }
    const t = w.terrain;
    const yRaw = (x: number, z: number) => {
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      const c = cz * t.w + cx;
      const g = hf.inside(x, z) ? hf.height(x, z) : hf.waterLevel;
      return t.water[c] && w.state.roads[c] ? Math.max(g, t.cellH[c]!) : g;
    };
    const span = 44, speed = 1.6;
    const u = ((this.time * speed + span * 0.7) % (2 * span)) - span;
    const at = (v: number) => {
      const x = b.x + b.dx * v, z = b.z + b.dz * v;
      return (yRaw(x - b.dx * 1.5, z - b.dz * 1.5) + yRaw(x, z) * 2 + yRaw(x + b.dx * 1.5, z + b.dz * 1.5)) / 4;
    };
    const x = b.x + b.dx * u, z = b.z + b.dz * u;
    const yF = at(u + 1.6), yB = at(u - 1.6);
    const y = Math.max(hf.inside(x, z) ? hf.height(x, z) : 0, (yF + yB) / 2);
    if (!wv.decor.length) wv.decor.push({ x, y, z, heading: 0, pitch: 0, odo: 0, cargo: 'planks', qty: 4 });
    const d = wv.decor[0]!;
    d.x = x; d.y = y; d.z = z;
    d.heading = Math.atan2(b.dx, b.dz);
    d.pitch = Math.atan2(yF - yB, 3.2);
    d.odo = u + span;
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    this.dpr = dpr;
    this.rig.resize(this.cssW, this.cssH);
    if (!this.renderer) return;
    this.renderer.setPixelRatio(Math.min(dpr, DPR_CAP[this.quality] ?? 2));
    this.renderer.setSize(this.cssW, this.cssH, false);
  }

  // ------------------------------------------------------------------ picking
  cellAt(x: number, y: number): number {
    if (!this.hf) return -1;
    this.rig.camera.updateMatrixWorld();
    screenRay(this.rig.camera, x, y, this.cssW, this.cssH, _ray);
    const p = rayGround(this.hf, _ray, _v);
    return p ? cellAtPoint(this.hf, p) : -1;
  }

  pick(x: number, y: number): PickResult {
    const w = this.world;
    if (!w || !this.hf || !this.wagons || !this.buildings) return null;
    const cam = this.rig.camera;
    // wagons: nearest projected rig within a generous touch radius
    const R = 28;
    let best = -1, bestD = R * R;
    for (const wg of w.state.wagons) {
      const s = this.wagons.get(wg.id);
      if (!s || !s.visible) continue;
      for (const along of [0, 2.2]) {
        _v.set(s.fx + Math.sin(s.heading) * along, s.fy + 1.3, s.fz + Math.cos(s.heading) * along).project(cam);
        if (_v.z > 1) continue;
        const sx = (_v.x * 0.5 + 0.5) * this.cssW, sy = (-_v.y * 0.5 + 0.5) * this.cssH;
        const dd = (sx - x) * (sx - x) + (sy - y) * (sy - y);
        if (dd < bestD) { bestD = dd; best = wg.id; }
      }
    }
    if (best >= 0) return { kind: 'wagon', id: best };
    // buildings: bounding box along the ray, nearer than the ground hit
    screenRay(cam, x, y, this.cssW, this.cssH, _ray);
    const g = rayGround(this.hf, _ray, _v2);
    const gDist = g ? g.distanceTo(cam.position) : Infinity;
    let bId = -1, bDist = gDist + 0.5;
    for (const info of this.buildings.info.values()) {
      const hit = _ray.intersectBox(info.box, _v);
      if (hit) {
        const dd = hit.distanceTo(cam.position);
        if (dd < bDist) { bDist = dd; bId = info.id; }
      }
    }
    if (bId >= 0) return { kind: 'building', id: bId };
    if (!g) return null;
    const cell = cellAtPoint(this.hf, g);
    if (cell < 0) return null;
    const occ = net(w).occupied[cell]!;
    if (occ !== -1) return { kind: 'building', id: occ };
    return { kind: 'cell', cell };
  }

  anchorOf(kind: 'building' | 'wagon', id: number): ScreenAnchor {
    const cam = this.rig.camera;
    if (kind === 'building') {
      const info = this.buildings?.info.get(id);
      if (!info) return { x: 0, y: 0, visible: false };
      _v.copy(info.anchor);
    } else {
      const s = this.wagons?.get(id);
      if (!s || !s.init) return { x: 0, y: 0, visible: false };
      if (!s.visible) {
        // parked inside the stable: point at the stable
        const st = this.world?.state.buildings.find((b) => b.type === 'stable');
        const info = st ? this.buildings?.info.get(st.id) : undefined;
        if (!info) return { x: 0, y: 0, visible: false };
        _v.copy(info.anchor);
      } else {
        _v.set(s.fx + Math.sin(s.heading) * 1.2, s.fy + 3.2, s.fz + Math.cos(s.heading) * 1.2);
      }
    }
    _v.project(cam);
    const x = (_v.x * 0.5 + 0.5) * this.cssW, y = (-_v.y * 0.5 + 0.5) * this.cssH;
    const visible = _v.z < 1 && x >= 0 && y >= 0 && x <= this.cssW && y <= this.cssH;
    return { x, y, visible };
  }

  /** Centre of a cell at ground height, or the deck height of a bridge cell. */
  cellToScreen(cell: number): ScreenAnchor {
    const w = this.world, hf = this.hf;
    if (!w || !hf || cell < 0 || cell >= hf.w * hf.h) return { x: 0, y: 0, visible: false };
    const t = w.terrain;
    const x = ((cell % t.w) + 0.5) * CELL, z = (Math.floor(cell / t.w) + 0.5) * CELL;
    let y = hf.height(x, z);
    if (t.water[cell] && w.state.roads[cell]) y = Math.max(y, t.cellH[cell]!);
    _v.set(x, y, z).project(this.rig.camera);
    const sx = (_v.x * 0.5 + 0.5) * this.cssW, sy = (-_v.y * 0.5 + 0.5) * this.cssH;
    const visible = _v.z < 1 && _v.z > -1 && sx >= 0 && sy >= 0 && sx <= this.cssW && sy <= this.cssH;
    return { x: sx, y: sy, visible };
  }

  // ------------------------------------------------------------------ overlays
  setRoadPreview(p: RoadPreview | null): void {
    this.overlay?.setPreview(p);
  }

  setPlacementGhost(g: PlacementGhost | null): void {
    this.ghostReq = g ? { ...g } : null;
    this.ghost.set(this.ghostReq, this.world, this.hf, this.overlay);
  }

  setOverlay(o: Overlay): void {
    this.overlayMode = o;
    if (o === 'traffic' && this.world) this.overlay?.updateTraffic(this.world);
  }

  setSelection(sel: PickResult): void {
    this.selection = sel;
    const ov = this.overlay;
    if (!ov || !this.world) return;
    ov.clearSelection();
    if (!sel) return;
    if (sel.kind === 'building') {
      const b = this.world.state.buildings.find((x) => x.id === sel.id);
      if (!b) return;
      ov.selRect.set(b.x * CELL, b.y * CELL, (b.x + b.w) * CELL, (b.y + b.h) * CELL);
      ov.selRectOn.value = 1;
    } else if (sel.kind === 'cell') {
      const x = sel.cell % this.world.terrain.w, y = Math.floor(sel.cell / this.world.terrain.w);
      ov.selRect.set(x * CELL + 0.6, y * CELL + 0.6, (x + 1) * CELL - 0.6, (y + 1) * CELL - 0.6);
      ov.selRectOn.value = 1;
    }
    // wagons: ring updated every frame
  }

  private updateSelectionRing(): void {
    const ov = this.overlay, sel = this.selection, hf = this.hf;
    if (!ov || !hf || !sel || sel.kind !== 'wagon') { this.deckRing.visible = false; return; }
    const s = this.wagons?.get(sel.id);
    if (!s || !s.visible) { ov.selRing.w = 0; this.deckRing.visible = false; return; }
    const rx = s.fx + Math.sin(s.heading) * 1.8, rz = s.fz + Math.cos(s.heading) * 1.8;
    // on a bridge (or its ramp above the bank) the ground under the wagon is the river bed:
    // draw the ring at deck height instead of draping it on the terrain
    const ground = hf.inside(rx, rz) ? hf.height(rx, rz) : hf.waterLevel;
    if (s.bridge || s.fy > ground + 0.6) {
      ov.selRing.w = 0;
      this.deckRing.position.set(rx, s.fy + 0.12, rz);
      this.deckRing.visible = true;
    } else {
      ov.selRing.set(rx, rz, 4.6, 1);
      this.deckRing.visible = false;
    }
  }

  /** Switch tier: view settings at once, textures reloaded in the background (old ones freed after). */
  setQuality(q: Quality): void {
    this.quality = q in DPR_CAP ? q : 'high';
    this.applyQuality();
    this.resize(this.cssW, this.cssH, this.dpr);
    this.loadTextures();
  }

  private applyQuality(): void {
    // 'high' and 'ultra' share the view settings; ultra differs in textures, anisotropy and the
    // pixel-ratio cap. Shadow map stays 2048 for ultra: 4096 would add ~96 MB of render targets
    // and 4× the shadow-pass fill, while the shadow frustum is fitted to the zoom (28–320 m).
    const high = this.quality !== 'low';
    this.lighting.setShadowMapSize(high ? 2048 : 1024, true);
    this.vegetation?.setShadows(high);
    if (this.vegetation) this.vegetation.nearDist = high ? 95 : 60;
    if (this.cover) this.cover.radius = high ? 38 : 0;
    this.wagons?.setShadows(true, high);
    if (this.wagons) this.wagons.lodDist = high ? 120 : 75;
    if (this.terrain) {
      this.terrain.uniforms.uDetail!.value = high ? 1 : 0.7;
      this.terrain.setLowQuality(!high);
    }
  }

  setMenuMode(on: boolean): void {
    const was = this.menu;
    this.menu = on;
    this.snapEnv = true;
    if (was && !on && this.hf) {
      // leaving the menu: glide out to a working view of the valley
      this.rig.setGoal(this.hf.sizeX * 0.45, this.hf.sizeZ * 0.5, 200, -0.3);
    }
    this.rig.menu = on;
    if (on) {
      this.rig.follow(null);
      const m = this.menuTarget();
      this.rig.setGoal(m.x, m.z, MENU_TARGET.dist, MENU_TARGET.yaw);
      if (this.hf) this.rig.set(m.x, m.z, MENU_TARGET.dist, MENU_TARGET.yaw);
    }
  }

  stats(): { fps: number; drawCalls: number; triangles: number; geometries: number; textures: number } {
    const r = this.renderer;
    return {
      fps: Math.round(this.fps),
      drawCalls: this.lastStats.calls,
      triangles: this.lastStats.triangles,
      geometries: r ? r.info.memory.geometries : 0,
      textures: r ? r.info.memory.textures : 0,
    };
  }

  dispose(): void {
    this.texGen++;
    this.texQuality = null;
    this.disposeWorld();
    if (this.pendingTerrainTex) disposeTerrainTextures(this.pendingTerrainTex);
    this.pendingTerrainTex = null;
    void disposeTextures();
    this.bridges.dispose();
    this.ghost.dispose();
    this.deckRing.geometry.dispose();
    (this.deckRing.material as MeshBasicMaterial).dispose();
    this.fx.dispose();
    this.lighting.dispose();
    this.renderer?.dispose();
    this.renderer = null;
  }
}

export function createWorldView(): WorldView {
  return new View();
}

/** Dev/harness access to internals (rig, debug overrides). Not part of the UI contract. */
export function viewInternals(v: WorldView): {
  rig: CameraRig;
  debug: WorldViewDebug;
  /** Resolves when the textures of the current tier are bound (waits through later switches). */
  ready: () => Promise<void>;
  scene: Scene;
  terrain: () => TerrainView | null;
} {
  const x = v as View;
  const ready = async (): Promise<void> => {
    for (;;) {
      await Promise.resolve(); // let a deferred first load start
      const p = x.texturesReady;
      await p;
      if (p === x.texturesReady) return;
    }
  };
  return { rig: x.rig, debug: x.debug, ready, scene: x.scene, terrain: () => x.terrainView };
}
