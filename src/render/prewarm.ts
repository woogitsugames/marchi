// Shader pre-warm (research 2026-11-02, optimisation 1): compile every program the scene can need
// before it is drawn with it, so one-off shader compiles/links do not land in the first seconds of
// play. three.js compiles a program the first time a material is drawn with a given variant
// (instanced or not, maps bound, alpha-to-coverage, shadow depth pass...) and then blocks the main
// thread in getProgramInfoLog until the driver has linked it. Here the programs are requested with
// `renderer.compile` (with KHR_parallel_shader_compile the driver links them off the main thread,
// like `compileAsync`, which is not used: see `settle`) and their first use (uniform lookup + info log) is forced in small idle slices once they are linked.
//
// Covered: everything already in the scene, visible or not (empty wagon/horse/cargo LOD instances,
// tree near/far/impostor cards, ground cover, placement ghost, water, mist, fx), one plain mesh per
// model material kind (buildings and bridges added later), the shadow depth variant of every mesh
// (the depth pass picks its material per mesh: custom depth materials, alpha-tested cards), and
// texture transitions (`prewarmMaterialSwap`: compile the textured variant before it is bound).
// Render-only; never touches sim state.
import {
  BackSide,
  type Camera,
  DoubleSide,
  FrontSide,
  Group,
  InstancedMesh,
  type Material,
  Mesh,
  MeshDepthMaterial,
  type Object3D,
  RGBADepthPacking,
  type Scene,
  type Side,
  type WebGLProgram,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three';

export interface PrewarmStats {
  /** Programs known to the renderer before / after. */
  before: number;
  after: number;
  /** Wall time from the request to all programs linked and first-used (ms). */
  ms: number;
}

type AnyMesh = Mesh & { isInstancedMesh?: boolean; instanceColor?: InstancedMesh['instanceColor']; customDepthMaterial?: Material };

/** Mirrors WebGLShadowMap: the depth pass flips single-sided materials. */
const SHADOW_SIDE: Record<Side, Side> = { [FrontSide]: BackSide, [BackSide]: FrontSide, [DoubleSide]: DoubleSide };

/** Depth-pass stand-ins per source material; kept alive so the programs they hold stay cached. */
const depthStandIns = new Map<Material, MeshDepthMaterial>();
/** The shared plain depth material: one stand-in per side and bound maps (both are part of the program key). */
const plainDepth = new Map<string, MeshDepthMaterial>();
const plainBase = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });

function needsOwnDepth(m: Material): boolean {
  const s = m as Material & { map?: unknown; alphaMap?: unknown; displacementMap?: unknown; displacementScale?: number };
  return !!(s.displacementMap && s.displacementScale !== 0) || ((!!s.alphaMap || !!s.map) && m.alphaTest > 0) || m.alphaToCoverage === true;
}

/**
 * The material WebGLShadowMap will draw `mesh` with (same program cache key), or null if it draws none.
 * A custom depth material gets the same per-draw state from the source material as the shadow pass gives it
 * (side, maps, alpha test, clipping): left in its constructed state, it was compiled as a FrontSide, map-less
 * variant that no shadow pass ever draws, and the real one linked inside the first frame that cast with it
 * (far-tree `billboard-depth` on a low → high switch, D-136).
 */
function depthMaterialOf(mesh: AnyMesh, m: Material): Material | null {
  if (!m.visible) return null;
  const side = m.shadowSide !== null ? m.shadowSide : SHADOW_SIDE[m.side];
  const s = m as Material & { map?: MeshDepthMaterial['map']; alphaMap?: MeshDepthMaterial['alphaMap']; displacementMap?: MeshDepthMaterial['displacementMap']; displacementScale?: number; displacementBias?: number };
  let d: MeshDepthMaterial;
  if (mesh.customDepthMaterial) {
    d = mesh.customDepthMaterial as MeshDepthMaterial;
  } else if (needsOwnDepth(m)) {
    let c = depthStandIns.get(m);
    if (!c) {
      c = plainBase.clone();
      depthStandIns.set(m, c);
      m.addEventListener('dispose', () => { depthStandIns.get(m)?.dispose(); depthStandIns.delete(m); });
    }
    d = c;
  } else {
    const k = `${side}|${s.map ? 1 : 0}|${s.alphaMap ? 1 : 0}|${s.displacementMap ? 1 : 0}`;
    let c = plainDepth.get(k);
    if (!c) { c = plainBase.clone(); plainDepth.set(k, c); }
    d = c;
  }
  d.side = side;
  d.alphaTest = m.alphaToCoverage === true ? 0.5 : m.alphaTest;
  d.map = s.map ?? null;
  d.alphaMap = s.alphaMap ?? null;
  d.displacementMap = s.displacementMap ?? null;
  d.displacementScale = s.displacementScale ?? 1;
  d.displacementBias = s.displacementBias ?? 0;
  d.clipShadows = m.clipShadows;
  d.clippingPlanes = m.clippingPlanes;
  d.clipIntersection = m.clipIntersection;
  return d;
}

/** A stand-in draw of `src` with material `m` (same instancing flags, shared geometry). */
function standIn(src: AnyMesh, m: Material): Mesh {
  if (src.isInstancedMesh) {
    const p = new InstancedMesh(src.geometry, m, 1);
    p.instanceColor = src.instanceColor ?? null;
    return p;
  }
  return new Mesh(src.geometry, m);
}

function meshesOf(root: Object3D, out: AnyMesh[] = []): AnyMesh[] {
  root.traverse((o) => { if ((o as Mesh).isMesh) out.push(o as AnyMesh); });
  return out;
}

function materialsOf(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function programs(r: WebGLRenderer): WebGLProgram[] {
  return r.info.programs ?? [];
}

const nextSlice = (ms = 0): Promise<void> => new Promise((res) => setTimeout(res, ms));

type Prog = WebGLProgram & { isReady?: () => boolean; program?: unknown };

/** False while the driver is still linking `p` (KHR_parallel_shader_compile); true without the extension. */
function linked(p: Prog): boolean {
  return !p.program || !p.isReady || p.isReady();
}

/**
 * Wait until no program is still linking. Polls the programs themselves rather than using
 * `compileAsync`, whose poll reads each material's current program and throws once a material is
 * disposed mid-wait (a world change while pre-warming).
 */
async function settle(r: WebGLRenderer, cancelled: () => boolean): Promise<void> {
  while (!cancelled() && programs(r).some((p) => !linked(p))) await nextSlice(10);
}

/**
 * Force the first use of every linked program (uniform table + info logs), a few per macrotask, so
 * it never lands inside a frame. Programs still linking are left for a later call.
 */
async function firstUse(r: WebGLRenderer, done: WeakSet<WebGLProgram>, cancelled: () => boolean): Promise<void> {
  let n = 0;
  for (const p of programs(r).slice()) {
    if (cancelled()) return;
    if (done.has(p)) continue;
    if (!linked(p)) continue;
    done.add(p);
    if (!(p as Prog).program) continue; // destroyed meanwhile
    p.getUniforms();
    if (++n % 4 === 0) await nextSlice();
  }
}

export class ShaderPrewarm {
  private gen = 0;
  private used = new WeakSet<WebGLProgram>();
  private depthTarget: WebGLRenderTarget | null = null;
  /** Clones compiled for a texture swap; released by the next full pre-warm that starts after it. */
  private swapClones: Material[] = [];
  last: PrewarmStats | null = null;
  /** Number of completed full pre-warms (debug). */
  runs = 0;

  constructor(private readonly renderer: WebGLRenderer) {}

  /** Cancel a pre-warm in flight (world change, dispose). */
  cancel(): void {
    this.gen++;
  }

  /**
   * Compile all programs of `scene` (plus `extras`, drawn with the scene's lights and fog) for the
   * colour pass and the shadow depth pass, then first-use them in idle slices. Resolves when done
   * or superseded by a newer call.
   */
  async run(scene: Scene, camera: Camera, extras: readonly Mesh[]): Promise<PrewarmStats | null> {
    const r = this.renderer;
    const gen = ++this.gen;
    const cancelled = () => gen !== this.gen;
    const t0 = performance.now();
    const before = programs(r).length;
    // swap clones compiled before this run started: their maps are bound to the real materials by
    // now, so this run's scene compile holds the textured programs and the clones can go
    const release = this.swapClones.splice(0);
    const extraGroup = new Group();
    for (const m of extras) extraGroup.add(m);
    // shadow depth stand-ins, one per distinct (material, instancing) pair
    const depthGroup = new Group();
    const seen = new Set<string>();
    for (const mesh of [...meshesOf(scene), ...extras as AnyMesh[]]) {
      for (const m of materialsOf(mesh)) {
        const d = depthMaterialOf(mesh, m);
        if (!d) continue;
        const key = `${d.uuid}|${mesh.isInstancedMesh ? 1 : 0}|${mesh.instanceColor ? 1 : 0}`;
        if (seen.has(key)) continue;
        seen.add(key);
        depthGroup.add(standIn(mesh, d));
      }
    }
    // compile() only requests the programs (compileShader/linkProgram); with
    // KHR_parallel_shader_compile the driver links them while frames keep running
    r.compile(scene, camera);
    r.compile(extraGroup, camera, scene);
    this.compileDepth(depthGroup, camera, scene);
    await settle(r, cancelled);
    if (cancelled()) { this.swapClones.push(...release); return null; }
    await firstUse(r, this.used, cancelled);
    if (cancelled()) { this.swapClones.push(...release); return null; }
    for (const c of release) c.dispose();
    this.runs++;
    this.last = { before, after: programs(r).length, ms: performance.now() - t0 };
    return this.last;
  }

  /**
   * The depth pass draws into the shadow map: compile with a render target bound (linear output, no tone
   * mapping), as WebGLShadowMap does.
   */
  private compileDepth(group: Group, camera: Camera, scene: Scene): void {
    const r = this.renderer;
    const prev = r.getRenderTarget();
    this.depthTarget ??= new WebGLRenderTarget(1, 1);
    r.setRenderTarget(this.depthTarget);
    try {
      r.compile(group, camera, scene);
    } finally {
      r.setRenderTarget(prev);
    }
  }

  /**
   * Before binding new maps to shared materials: compile the variants the materials will have
   * afterwards, for every mesh using them (and `extras`), so the swap itself compiles nothing.
   * `next` maps each material to a clone carrying the new maps.
   */
  async prewarmMaterialSwap(scene: Scene, camera: Camera, next: ReadonlyMap<Material, Material>, extras: readonly Mesh[]): Promise<void> {
    if (!next.size) return;
    const r = this.renderer;
    const group = new Group();
    // the shadow depth variant of the new state too (alpha-to-coverage turns into an alpha test there, and a
    // mesh that casts only on the new tier draws its depth material for the first time right after the switch)
    const depthGroup = new Group();
    const seen = new Set<string>();
    for (const mesh of [...meshesOf(scene), ...extras as AnyMesh[]]) {
      for (const m of materialsOf(mesh)) {
        const c = next.get(m);
        if (!c) continue;
        const key = `${c.uuid}|${mesh.isInstancedMesh ? 1 : 0}|${mesh.instanceColor ? 1 : 0}`;
        if (seen.has(key)) continue;
        seen.add(key);
        group.add(standIn(mesh, c));
        const d = depthMaterialOf(mesh, c);
        if (d) depthGroup.add(standIn(mesh, d));
      }
    }
    r.compile(group, camera, scene);
    this.compileDepth(depthGroup, camera, scene);
    await settle(r, () => false);
    await firstUse(r, this.used, () => false);
    // released by the next full run (after the caller has bound the maps to the real materials)
    for (const c of next.values()) this.swapClones.push(c);
  }

  dispose(): void {
    this.cancel();
    this.depthTarget?.dispose();
    this.depthTarget = null;
    for (const c of this.swapClones) c.dispose();
    this.swapClones.length = 0;
  }
}
