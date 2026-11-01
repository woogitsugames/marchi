/**
 * Trees of a late-autumn Central European march, built for `InstancedMesh`:
 *  - spruce : dark conical crown of ragged, drooping branch tiers (~260 tris)
 *  - pine   : Scots pine, tall bare trunk with an orange upper bark and an irregular flat crown
 *  - oak    : broad crown that keeps its dry brown leaves into November (alpha leaf cards)
 *  - birch  : slender pale trunk, thinning yellow crown
 *  - bush   : hazel / blackthorn shrub (~2.6 m) for forest edges, hedgerows and copse rims
 *
 * Origin at the trunk base, unit scale ≈ a mature tree (spruce 15 m, pine 16 m, oak 12 m,
 * birch 11 m); vary per instance with a uniform scale of 0.7–1.2 and random Y rotation.
 * Far LOD: `treeBillboard(kind)` cross-quads textured from an atlas baked once at start-up with
 * `bakeTreeBillboards(renderer)`.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { fnoise, type ModelPart, PartBuilder, rng, trs, v3 } from './kit';
import { leafTexture, modelMaterial, needleTexture } from './materials';
import { rod } from './shapes';

export type TreeKind = 'spruce' | 'pine' | 'oak' | 'birch' | 'bush';
export const TREE_KINDS: TreeKind[] = ['spruce', 'pine', 'oak', 'birch', 'bush'];

/** Nominal height and crown radius at scale 1 (used for billboards and culling). */
export const TREE_SIZE: Record<TreeKind, { height: number; radius: number }> = {
  spruce: { height: 15, radius: 3.2 },
  pine: { height: 16, radius: 3.6 },
  oak: { height: 12, radius: 5.2 },
  birch: { height: 11, radius: 3.0 },
  bush: { height: 2.8, radius: 2.0 },
};

const BARK = '#4a4036';
const PINE_UPPER = new Color('#8a5e3e');

/** Card cluster: `n` leaf quads scattered in an ellipsoid, normals pointing out of the crown. */
function leafCards(b: PartBuilder, centre: Vector3, rad: Vector3, n: number, size: number, colors: string[], seed: number, mat: 'leaves' | 'needles' = 'leaves'): void {
  const r = rng(seed);
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const crown = centre.clone();
  for (let i = 0; i < n; i++) {
    // point in ellipsoid shell (biased outward → sparse inside, like a thinning crown)
    const u = r() * 2 - 1, th = r() * Math.PI * 2, k = Math.pow(r(), 0.35);
    const s = Math.sqrt(1 - u * u);
    const p = v3(s * Math.cos(th) * rad.x * k, u * rad.y * k, s * Math.sin(th) * rad.z * k).add(centre);
    // random card orientation
    const a = v3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    const t = v3(r() - 0.5, r() - 0.5, r() - 0.5).cross(a).normalize();
    const sz = size * (0.7 + r() * 0.6);
    const base = pos.length / 3;
    const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const nrm = p.clone().sub(crown).normalize();
    nrm.y = nrm.y * 0.6 + 0.4;
    nrm.normalize();
    for (const [cx, cy] of corners) {
      const q = p.clone().addScaledVector(a, (cx * sz) / 2).addScaledVector(t, (cy * sz) / 2);
      pos.push(q.x, q.y, q.z);
      nor.push(nrm.x, nrm.y, nrm.z);
      uv.push(((cx + 1) / 2) * (mat === 'needles' ? 0.5 : 1), (cy + 1) / 2);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  let ci = 0;
  b.add(mat, g, {
    color: colors[0],
    keepUv: true,
    vary: 0,
    noise: 0.1,
    ao: 0,
    dirt: 0,
    shade: (p, _n, c) => {
      // per-card colour pick (4 vertices per card) and inner-crown darkening
      const card = Math.floor(ci++ / 4);
      c.set(colors[card % colors.length]);
      const d = p.clone().sub(crown);
      const inner = Math.sqrt((d.x / rad.x) ** 2 + (d.y / rad.y) ** 2 + (d.z / rad.z) ** 2);
      c.multiplyScalar(0.72 + 0.28 * Math.min(1, inner));
    },
  });
}

/** Spray cards radiating from the trunk in whorls; crown radius follows `radius(y)`. */
function whorls(b: PartBuilder, y0: number, y1: number, step: number, perTier: number, radius: (y: number) => number, droop: number, colors: string[], seed: number, axisTop: Vector3): void {
  const r = rng(seed);
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  let tier = 0;
  for (let y = y0; y <= y1; y += step * (0.85 + r() * 0.3), tier++) {
    const R = radius(y);
    for (let k = 0; k < perTier; k++) {
      const a = tier * 2.39996 + (k / perTier) * Math.PI * 2 + r() * 0.5;
      const d = v3(Math.cos(a), 0, Math.sin(a));
      const len = R * (0.85 + r() * 0.3);
      const wid = Math.max(0.7, len * 0.75);
      const axis = v3(axisTop.x * (y / axisTop.y), y, axisTop.z * (y / axisTop.y));
      const start = axis.clone().addScaledVector(d, 0.05);
      const end = axis.clone().addScaledVector(d, len).add(v3(0, -len * droop * (0.7 + r() * 0.6), 0));
      const along = new Vector3().subVectors(end, start).normalize();
      // card plane mostly horizontal, rolled a little so some sprays show their face from the side
      const roll = (r() - 0.5) * 0.9;
      const side = v3(-d.z, 0, d.x).applyAxisAngle(along, roll);
      const nrm = d.clone().multiplyScalar(0.75).add(v3(0, 0.65, 0)).normalize();
      const base = pos.length / 3;
      const corners: [number, number][] = [[0, -1], [1, -1], [1, 1], [0, 1]];
      for (const [u, v] of corners) {
        const q = start.clone().lerp(end, u).addScaledVector(side, (v * wid) / 2);
        pos.push(q.x, q.y, q.z);
        nor.push(nrm.x, nrm.y, nrm.z);
        uv.push(u * 0.5, (v + 1) / 2);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  let ci = 0;
  b.add('needles', g, {
    color: colors[0],
    keepUv: true,
    vary: 0,
    noise: 0.12,
    noiseFreq: 0.7,
    ao: 0,
    dirt: 0,
    shade: (p, _n, c) => {
      const card = Math.floor(ci++ / 4);
      c.set(colors[card % colors.length]);
      // inner (near the trunk) darker, tips lighter
      const rr = Math.hypot(p.x, p.z) / (radius(Math.max(y0, p.y)) + 0.3);
      c.multiplyScalar(0.82 + 0.3 * Math.min(1, rr));
    },
  });
}

/** Opaque dark core (cone) using the solid half of the needle texture. */
function crownCore(b: PartBuilder, y0: number, y1: number, r0: number, color: string, top = v3(0, 1, 0)): void {
  const g = new CylinderGeometry(0.05, r0, y1 - y0, 7, 2, true);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.75, 0.5);
  const lean = Math.atan2(top.x, top.y);
  b.add('needles', g, { color, keepUv: true, m: trs(0, (y0 + y1) / 2, 0, 0, 0, -lean), ao: 0, dirt: 0, jitter: 0.15, jitterFreq: 0.8, shade: (_p, n, c) => { if (n.y < 0) c.multiplyScalar(0.6); } });
}

function spruce(b: PartBuilder): void {
  const H = TREE_SIZE.spruce.height;
  const R = TREE_SIZE.spruce.radius;
  rod(b, 'bark', v3(0, -0.2, 0), v3(0, H * 0.97, 0), 0.24, 0.03, 6, { color: '#4b4038', ao: 0.4, dirt: 0.3 }, true);
  const radius = (y: number) => 0.35 + R * Math.pow(Math.max(0, 1 - (y - 1.2) / (H - 1.2)), 0.95);
  crownCore(b, 2.4, H - 1.6, R * 0.3, '#34402b');
  whorls(b, 1.3, H - 0.6, 0.62, 6, radius, 0.3, ['#4f5e43', '#58684a', '#475640', '#5d6b48'], 61, v3(0, 1, 0));
}

function pine(b: PartBuilder): void {
  const H = TREE_SIZE.pine.height;
  const r = rng(11);
  // slightly leaning trunk: grey-brown at the bottom, orange-brown above
  const top = v3(0.35, H * 0.86, 0.15);
  b.add('bark', new CylinderGeometry(0.1, 0.27, H * 0.88, 7, 3, true), {
    m: trs(top.x / 2, H * 0.44 - 0.2, top.z / 2, 0.012, 0, -0.022),
    color: '#4c4239',
    jitter: 0.05,
    jitterFreq: 0.6,
    ao: 0.4,
    dirt: 0.3,
    shade: (q, _n, c) => {
      if (q.y > H * 0.45) c.lerp(PINE_UPPER, Math.min(1, (q.y - H * 0.45) / 3));
    },
  });
  // crown branches with needle clusters at their ends (flat, irregular Scots-pine crown)
  const clumps: Vector3[] = [v3(0.35, H * 0.93, 0.15)];
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4 + r() * 0.6;
    const y = H * (0.66 + i * 0.045);
    const e = v3(Math.cos(a) * (1.8 + r() * 0.8), y + 1.0, Math.sin(a) * (1.8 + r() * 0.8));
    rod(b, 'bark', v3(0.3, y, 0.12), e, 0.09, 0.04, 4, { color: '#7a5640', ao: 0 }, true);
    clumps.push(e);
  }
  clumps.forEach((c, i) => {
    leafCards(b, c.clone().add(v3(0, 0.25, 0)), v3(1.5, 0.55, 1.5), 13, 1.5, ['#45533c', '#4e5b42', '#3e4a37'], 70 + i, 'needles');
  });
}

function oak(b: PartBuilder): void {
  const r = rng(21);
  const trunkTop = v3(0.1, 3.4, 0);
  rod(b, 'bark', v3(0, -0.2, 0), trunkTop, 0.45, 0.33, 8, { color: BARK, jitter: 0.06, jitterFreq: 1.5, ao: 0.4, dirt: 0.3 });
  // main limbs (sub-segmented for a slight crook)
  const ends: Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r() * 0.6;
    const mid = v3(Math.cos(a) * 1.6, 5.2 + r() * 1.2, Math.sin(a) * 1.6);
    const end = v3(Math.cos(a) * (3.4 + r()), 7.2 + r() * 2.5, Math.sin(a) * (3.4 + r()));
    rod(b, 'bark', trunkTop, mid, 0.24, 0.15, 5, { color: BARK, ao: 0, dirt: 0 }, true);
    rod(b, 'bark', mid, end, 0.15, 0.05, 4, { color: BARK, ao: 0, dirt: 0 }, true);
    ends.push(mid, end);
  }
  // leading shoot
  rod(b, 'bark', trunkTop, v3(0.3, 10.5, -0.2), 0.25, 0.06, 5, { color: BARK, ao: 0, dirt: 0 }, true);
  // dry, withered brown leaves retained in clumps — sparse, with gaps showing the limbs
  // (autumn-thinned, but a full silhouette: clumps around each limb end plus an outer shell)
  const cols = ['#7a5a33', '#6c5232', '#8a6a3c', '#5f4a30', '#6e6038'];
  leafCards(b, v3(0, 8.0, 0), v3(4.4, 2.7, 4.4), 46, 2.0, cols, 31);
  leafCards(b, v3(0.2, 10.0, 0), v3(2.6, 1.5, 2.6), 16, 1.8, cols, 32);
  ends.forEach((e, i) => {
    if (i % 2 === 1) leafCards(b, e.clone().add(v3(0, 0.3, 0)), v3(1.9, 1.3, 1.9), 11, 1.7, cols, 33 + i);
  });
}

function birch(b: PartBuilder): void {
  const r = rng(41);
  const H = TREE_SIZE.birch.height;
  const pale = '#b3ab9a';
  const barkO = {
    color: pale,
    ao: 0.3,
    dirt: 0.2,
    noise: 0.25,
    noiseFreq: 3.5,
    shade: (q: Vector3, _n: Vector3, c: Color) => {
      // dark lenticel bands and a dark, fissured base
      const band = fnoise(q.x * 3, q.y * 4.5, q.z * 3, 7);
      if (band > 0.35) c.multiplyScalar(0.35);
      if (q.y < 1.2) c.multiplyScalar(0.45 + 0.45 * (q.y / 1.2));
    },
  };
  b.add('bark', new CylinderGeometry(0.06, 0.2, H * 0.92, 7, 5, false), { ...barkO, m: trs(0, H * 0.46 - 0.2, 0, 0.02, 0, 0.03), jitter: 0.05, jitterFreq: 0.5 });
  const ends: Vector3[] = [];
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const y = H * (0.35 + 0.55 * (i / 9));
    const len = 2.6 * (1 - (i / 9) * 0.6);
    const s = v3(0.08 * Math.cos(a), y, 0.08 * Math.sin(a));
    const e = v3(Math.cos(a) * len, y + len * 0.9, Math.sin(a) * len);
    rod(b, 'bark', s, e, 0.06, 0.012, 4, { ...barkO, color: '#5e5249', shade: undefined }, true);
    // drooping twig tips
    rod(b, 'bark', e, e.clone().add(v3(Math.cos(a) * 0.6, -0.9, Math.sin(a) * 0.6)), 0.012, 0.006, 3, { color: '#4a3e36', ao: 0, dirt: 0 }, true);
    ends.push(e);
  }
  // thinning yellow crown: clumps at the branch ends, a looser shell around them
  const bc = ['#8f7c45', '#7f6d3d', '#6e6038', '#857446'];
  leafCards(b, v3(0, H * 0.72, 0), v3(2.5, 3.0, 2.5), 30, 1.3, bc, 43);
  ends.forEach((e, i) => leafCards(b, e.clone().add(v3(0, -0.3, 0)), v3(1.2, 1.1, 1.2), 6, 1.2, bc, 44 + i));
}

function bush(b: PartBuilder): void {
  const r = rng(51);
  // a few thin stems fanning out of one root, twiggy tops
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.7;
    const l = 0.9 + r() * 0.8;
    const e = v3(Math.cos(a) * l, 1.6 + r() * 0.9, Math.sin(a) * l);
    rod(b, 'bark', v3(Math.cos(a) * 0.1, -0.1, Math.sin(a) * 0.1), e, 0.05, 0.015, 4, { color: '#4a4038', ao: 0.3, dirt: 0.2 }, true);
  }
  const cols = ['#5c5537', '#6b5b36', '#4d4c33', '#776338', '#55583a'];
  leafCards(b, v3(0, 1.45, 0), v3(1.7, 1.05, 1.7), 34, 1.15, cols, 52);
  leafCards(b, v3(0.3, 2.1, -0.2), v3(1.1, 0.6, 1.1), 10, 1.0, cols, 53);
}

const BUILD: Record<TreeKind, (b: PartBuilder) => void> = { spruce, pine, oak, birch, bush };
const cache = new Map<TreeKind, ModelPart[]>();

/** Full-detail tree (LOD0). */
export function treeParts(kind: TreeKind): ModelPart[] {
  const hit = cache.get(kind);
  if (hit) return hit;
  const b = new PartBuilder({ seed: 600 + TREE_KINDS.indexOf(kind), ao: 0.3, aoHeight: 1.5 });
  BUILD[kind](b);
  const parts = b.build();
  cache.set(kind, parts);
  return parts;
}

// -------------------------------------------------------------------------------------------
// Billboards
// -------------------------------------------------------------------------------------------

const ATLAS_COLS = TREE_KINDS.length;
const bbCache = new Map<TreeKind, ModelPart[]>();

/**
 * Two crossed quads (4 triangles) sized to the tree, UV-mapped into the shared billboard atlas
 * column for `kind`. Material key `billboard`; call `bakeTreeBillboards` once to fill its map.
 */
export function treeBillboard(kind: TreeKind): ModelPart[] {
  const hit = bbCache.get(kind);
  if (hit) return hit;
  const { height: H, radius: R } = TREE_SIZE[kind];
  const W = R * 2.3;
  const col = TREE_KINDS.indexOf(kind);
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], color: number[] = [], idx: number[] = [];
  const top = H * 1.05;
  for (const ang of [0, Math.PI / 2]) {
    const dx = Math.cos(ang) * (W / 2), dz = Math.sin(ang) * (W / 2);
    const base = pos.length / 3;
    const corners: [number, number, number, number][] = [[-dx, 0, -dz, 0], [dx, 0, dz, 1], [dx, top, dz, 1], [-dx, top, -dz, 0]];
    for (const [x, y, z, u] of corners) {
      pos.push(x, y - 0.2, z);
      // soft "dome" normals so the card shades like a volume, not a flat sheet
      const n = v3(x / (W / 2), 0.9 + y / top, z / (W / 2)).normalize();
      nor.push(n.x, n.y, n.z);
      uv.push((col + u) / ATLAS_COLS, y / top);
      color.push(1, 1, 1);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new BufferAttribute(new Float32Array(color), 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const parts: ModelPart[] = [{ geometry: g, material: 'billboard' }];
  bbCache.set(kind, parts);
  return parts;
}

let atlas: WebGLRenderTarget | null = null;

/**
 * Render every tree kind (albedo only, unlit) into a shared atlas and attach it to the
 * `billboard` material. Call once after the renderer exists; cheap (4 small renders).
 */
export function bakeTreeBillboards(renderer: WebGLRenderer, cellPx = 256): WebGLRenderTarget {
  if (atlas) return atlas;
  const rt = new WebGLRenderTarget(cellPx * ATLAS_COLS, cellPx * 2, { samples: 4 });
  const scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0xffffff, 1));
  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new Color()).clone();
  const prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  const leafMat = new MeshBasicMaterial({ vertexColors: true, map: leafTexture(), alphaTest: 0.5, side: DoubleSide });
  const solidMat = new MeshBasicMaterial({ vertexColors: true });
  const needleMat = new MeshBasicMaterial({ vertexColors: true, map: needleTexture(), alphaTest: 0.5, side: DoubleSide });
  TREE_KINDS.forEach((kind, i) => {
    const { height: H, radius: R } = TREE_SIZE[kind];
    const W = R * 2.3;
    const top = H * 1.05;
    const grp = new Group();
    for (const p of treeParts(kind)) grp.add(new Mesh(p.geometry, p.material === 'leaves' ? leafMat : p.material === 'needles' ? needleMat : solidMat));
    scene.add(grp);
    const cam = new OrthographicCamera(-W / 2, W / 2, top - 0.2, -0.2, 0.1, 100);
    cam.position.set(0, 0, 40);
    cam.lookAt(0, 0, 0);
    cam.position.y = 0;
    renderer.setViewport(i * cellPx, 0, cellPx, cellPx * 2);
    renderer.setScissor(i * cellPx, 0, cellPx, cellPx * 2);
    renderer.setScissorTest(true);
    renderer.render(scene, cam);
    scene.remove(grp);
  });
  renderer.setScissorTest(false);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevClear, prevAlpha);
  renderer.setViewport(0, 0, renderer.domElement.width / renderer.getPixelRatio(), renderer.domElement.height / renderer.getPixelRatio());
  const m = modelMaterial('billboard');
  m.map = rt.texture;
  m.alphaTest = 0.5;
  m.needsUpdate = true;
  atlas = rt;
  return rt;
}
