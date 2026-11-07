/**
 * Trees of a late-autumn Central European march, built for `InstancedMesh`:
 *  - spruce : conical crown of ragged, drooping branch tiers round a slim core (~480 tris)
 *  - pine   : Scots pine, tall trunk with a muted orange upper bark, crown of needle-tuft masses
 *  - oak    : broad crown of rounded leaf clumps that keep their dry leaves into November
 *  - birch  : slender pale trunk, loose yellow crown of drooping clumps
 *  - bush   : hazel / blackthorn shrub (~2.6 m) for forest edges, hedgerows and copse rims
 *
 * Crowns are built from foliage *clumps* (a few large crossed cards with a clump texture and
 * blended crown/clump normals), trunks from a lathe with root flare and taper; `TREE_VARIANTS`
 * geometry variants per kind. Origin at the trunk base, unit scale ≈ a mature tree (spruce
 * 15 m, pine 16 m, oak 12 m, birch 11 m). Far LOD: `treeBillboard(kind)` camera-facing cards
 * textured from albedo + normal atlases baked from 30° above and 8 azimuths (`bakeTreeBillboards`,
 * the card picks/blends the views nearest to the camera in the tree's own frame); they cast
 * blob shadows (`billboardDepthMaterial`). The near/far swap is a dithered crossfade (materials.ts).
 */
import {
  ArrayCamera,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  GLSL3,
  LatheGeometry,
  LinearMipmapLinearFilter,
  Mesh,
  MeshDepthMaterial,
  NearestFilter,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  RGBADepthPacking,
  Scene,
  ShaderMaterial,
  type Texture,
  Vector4,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { fnoise, type ModelPart, PartBuilder, rng, trs, v3 } from './kit';
import { leafTexture, modelMaterial, needleTexture, treeUniforms, TWIG_GLSL } from './materials';
import { rod } from './shapes';
import { TREE_KINDS, TREE_SIZE, TREE_VARIANTS, type TreeKind } from './treeKinds';

export { TREE_KINDS, TREE_SIZE, TREE_VARIANTS, type TreeKind };

const BARK = '#4a4036';

/** LOD radius factor per kind (shrubs keep full models further out) and tint family. */
const TREE_ATTR: Record<TreeKind, [number, number]> = {
  spruce: [1, 0],
  pine: [1, 0],
  oak: [1, 1],
  birch: [1, 1],
  bush: [1.9, 0], // shrubs: the gentle conifer tint range (no orange swing against the meadow)
};
export const treeLodFactor = (kind: TreeKind): number => TREE_ATTR[kind][0];

interface Clump {
  c: Vector3;
  r: number;
}

/**
 * Foliage clumps: each clump is `cards` large crossed cards carrying the leaf-clump texture.
 * Vertex normals blend the direction out of the whole crown with the direction out of the clump
 * (and a little "up"), so a crown shades as a few rounded masses instead of confetti; colour is
 * lighter on the outer, upper side of the crown and darker in its core.
 */
function clumps(b: PartBuilder, mat: 'leaves' | 'needles', list: Clump[], cards: number, crownC: Vector3, crownR: Vector3, colors: string[], seed: number, flat = 0): void {
  const r = rng(seed);
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const col: string[] = [];
  const vMax = mat === 'needles' ? 0.5 : 1;
  for (const { c, r: cr } of list) {
    const out = c.clone().sub(crownC);
    out.set(out.x / crownR.x, out.y / crownR.y, out.z / crownR.z);
    const outN = out.lengthSq() > 1e-4 ? out.clone().normalize() : v3(0, 1, 0);
    const clumpCol = Math.floor(r() * colors.length);
    for (let k = 0; k < cards; k++) {
      // card facing: partly outward, partly random, `flat` biases toward horizontal sprays
      const f = outN.clone().multiplyScalar(0.55).add(v3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.3));
      f.y += flat * 1.6;
      f.normalize();
      const t = v3(r() - 0.5, r() - 0.5, r() - 0.5).cross(f).normalize();
      const bt = f.clone().cross(t).normalize();
      const sz = cr * (1.85 + r() * 0.45);
      const cc = c.clone().add(v3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(cr * 0.5));
      const base = pos.length / 3;
      const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      const tone = colors[(clumpCol + (r() < 0.35 ? 1 + Math.floor(r() * (colors.length - 1)) : 0)) % colors.length]!;
      for (const [cx, cy] of corners) {
        const q = cc.clone().addScaledVector(t, (cx * sz) / 2).addScaledVector(bt, (cy * sz) / 2);
        const dC = q.clone().sub(crownC);
        dC.set(dC.x / crownR.x, dC.y / crownR.y, dC.z / crownR.z);
        const dK = q.clone().sub(c);
        const n = (dC.lengthSq() > 1e-4 ? dC.normalize() : v3(0, 1, 0)).multiplyScalar(0.6)
          .add((dK.lengthSq() > 1e-4 ? dK.normalize() : v3(0, 1, 0)).multiplyScalar(0.4))
          .add(v3(0, 0.3, 0))
          .normalize();
        pos.push(q.x, q.y, q.z);
        nor.push(n.x, n.y, n.z);
        uv.push((cx + 1) / 2, ((cy + 1) / 2) * vMax);
        col.push(tone);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  let vi = 0;
  b.add(mat, g, {
    color: colors[0]!,
    keepUv: true,
    vary: 0,
    noise: 0.08,
    noiseFreq: 0.5,
    ao: 0,
    dirt: 0,
    shade: (p, n, c) => {
      c.set(col[vi++]!);
      const d = p.clone().sub(crownC);
      const inner = Math.min(1, Math.sqrt((d.x / crownR.x) ** 2 + (d.y / crownR.y) ** 2 + (d.z / crownR.z) ** 2));
      // lit rim of the crown lighter, core a little darker (the shadow map does the rest)
      c.multiplyScalar(0.84 + 0.22 * inner + 0.1 * Math.max(0, n.y));
    },
  });
}

/** Points on an ellipsoid shell (k = fraction of the radius, 1 = on the shell). */
function shell(r: () => number, centre: Vector3, rad: Vector3, n: number, kMin: number, cr: [number, number], below = -0.55): Clump[] {
  const out: Clump[] = [];
  for (let i = 0; i < n; i++) {
    const u = below + r() * (1 - below), th = r() * Math.PI * 2, k = kMin + (1 - kMin) * Math.sqrt(r());
    const s = Math.sqrt(1 - u * u);
    out.push({ c: v3(s * Math.cos(th) * rad.x * k, u * rad.y * k, s * Math.sin(th) * rad.z * k).add(centre), r: cr[0] + r() * (cr[1] - cr[0]) });
  }
  return out;
}

/** Spray cards radiating from the trunk in whorls; crown radius follows `radius(y)`. */
function whorls(b: PartBuilder, y0: number, y1: number, step: number, perTier: number, radius: (y: number) => number, droop: number, colors: string[], seed: number, axisTop: Vector3): void {
  const r = rng(seed);
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const tipK: number[] = [];
  let tier = 0;
  for (let y = y0; y <= y1; y += step * (0.85 + r() * 0.3), tier++) {
    const R = radius(y);
    const n = Math.max(4, Math.round(perTier * Math.min(1, 0.45 + R / 2.4)));
    for (let k = 0; k < n; k++) {
      const a = tier * 2.39996 + (k / n) * Math.PI * 2 + r() * 0.5;
      const d = v3(Math.cos(a), 0, Math.sin(a));
      const len = R * (0.85 + r() * 0.3);
      const wid = Math.max(0.8, len * 0.85);
      const axis = v3(axisTop.x * (y / axisTop.y), y, axisTop.z * (y / axisTop.y));
      const start = axis.clone().addScaledVector(d, 0.05);
      const end = axis.clone().addScaledVector(d, len).add(v3(0, -len * droop * (0.7 + r() * 0.6), 0));
      const along = new Vector3().subVectors(end, start).normalize();
      // card plane mostly horizontal, rolled a little so some sprays show their face from the side
      const roll = (r() - 0.5) * 0.9;
      const side = v3(-d.z, 0, d.x).applyAxisAngle(along, roll);
      const base = pos.length / 3;
      const corners: [number, number][] = [[0, -1], [1, -1], [1, 1], [0, 1]];
      for (const [u, v] of corners) {
        const q = start.clone().lerp(end, u).addScaledVector(side, (v * wid) / 2);
        // cone normal: out of the crown and up, rounder toward the tip of the spray
        const nrm = d.clone().multiplyScalar(0.55 + 0.35 * u).add(v3(0, 0.75, 0)).addScaledVector(side, v * 0.25).normalize();
        pos.push(q.x, q.y, q.z);
        nor.push(nrm.x, nrm.y, nrm.z);
        uv.push(u * 0.5, 0.5 + (v + 1) / 4);
        tipK.push(u);
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
    color: colors[0]!,
    keepUv: true,
    vary: 0,
    noise: 0.1,
    noiseFreq: 0.7,
    ao: 0,
    dirt: 0,
    shade: (p, _n, c) => {
      const card = Math.floor(ci / 4);
      const u = tipK[ci++]!;
      c.set(colors[(card * 7 + (card >> 2)) % colors.length]!);
      // near the trunk darker, sunlit tips lighter; the top of the cone fresher
      c.multiplyScalar(0.8 + 0.34 * u + 0.08 * Math.min(1, p.y / (y1 + 1)));
    },
  });
}

/** Thin opaque core (cone) so a dense conifer is not see-through; normals point out and up. */
function crownCore(b: PartBuilder, y0: number, y1: number, r0: number, color: string): void {
  const g = new CylinderGeometry(0.05, r0, y1 - y0, 6, 2, true);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.75, 0.75);
  const nr = g.getAttribute('normal');
  for (let i = 0; i < nr.count; i++) {
    const n = v3(nr.getX(i), nr.getY(i) + 0.8, nr.getZ(i)).normalize();
    nr.setXYZ(i, n.x, n.y, n.z);
  }
  b.add('needles', g, { color, keepUv: true, m: trs(0, (y0 + y1) / 2, 0), ao: 0, dirt: 0, jitter: 0.12, jitterFreq: 0.8 });
}

/**
 * Trunk with a root flare and taper (lathe), slightly crooked by the builder's jitter.
 * `lean` tips the top by (dx, dz) metres.
 */
function trunk(b: PartBuilder, h: number, r0: number, r1: number, seg: number, o: { color: string; shade?: (p: Vector3, n: Vector3, c: Color) => void }, lean = v3(0, 0, 0), flare = 1.5): void {
  const prof: [number, number][] = [
    [r0 * flare * 1.05, -0.25],
    [r0 * flare, 0.0],
    [r0 * (1 + (flare - 1) * 0.35), 0.35],
    [r0 * 1.02, 0.9],
    [r0 * 0.94 + r1 * 0.06, h * 0.35],
    [r1, h],
  ];
  const g = new LatheGeometry(prof.map(([x, y]) => new Vector2(x, y)), seg);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = Math.max(0, y / h);
    p.setXYZ(i, p.getX(i) + lean.x * t * t, y, p.getZ(i) + lean.z * t * t);
  }
  g.computeVertexNormals();
  b.add('bark', g, { color: o.color, shade: o.shade, jitter: 0.04, jitterFreq: 1.2, ao: 0.45, dirt: 0.35 });
}

function spruce(b: PartBuilder, v: number): void {
  const H = TREE_SIZE.spruce.height;
  const R = TREE_SIZE.spruce.radius * (v ? 0.9 : 1);
  trunk(b, H * 0.97, 0.26, 0.03, 6, { color: '#4b4038' }, v3(0.1 * v, 0, -0.08 * v), 1.6);
  const radius = (y: number) => 0.3 + R * Math.pow(Math.max(0, 1 - (y - 1.2) / (H - 1.2)), v ? 1.05 : 0.92);
  crownCore(b, 2.6, H - 2.2, R * 0.17, '#3d4a35');
  whorls(b, 1.4, H - 0.5, 0.52, 8, radius, 0.32, ['#506046', '#48573f', '#5a6a4b', '#546444', '#626b4a', '#44523d'], 61 + v * 17, v3(0, 1, 0));
}

function pine(b: PartBuilder, v: number): void {
  const H = TREE_SIZE.pine.height;
  const r = rng(11 + v * 31);
  // slightly leaning trunk: grey-brown at the bottom, muted orange-brown above
  const top = v3(v ? -0.3 : 0.35, H * 0.86, v ? 0.25 : 0.15);
  const upper = new Color('#7e5d45');
  trunk(b, H * 0.88, 0.27, 0.1, 7, {
    color: '#4c4239',
    shade: (q, _n, c) => {
      if (q.y > H * 0.42) c.lerp(upper, Math.min(1, (q.y - H * 0.42) / 3.5) * 0.65);
    },
  }, v3(top.x, 0, top.z), 1.4);
  // limbs ending in needle tufts: an irregular, flat-topped crown of a few masses
  const crownC = v3(top.x * 0.9, H * 0.83, top.z * 0.9);
  const crownR = v3(3.3, 1.9, 3.3);
  const list: Clump[] = [{ c: v3(top.x, H * 0.93, top.z), r: 1.15 }];
  const n = 8 + v;
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + r() * 0.6;
    const y = H * (0.62 + (i / n) * 0.26);
    const reach = (2.0 + r() * 1.0) * (1 - (i / n) * 0.35);
    const e = v3(top.x * 0.8 + Math.cos(a) * reach, y + 0.9 + r() * 0.5, top.z * 0.8 + Math.sin(a) * reach);
    rod(b, 'bark', v3(top.x * (y / top.y), y, top.z * (y / top.y)), e, 0.08, 0.03, 4, { color: '#5a4638', ao: 0, dirt: 0 }, true);
    list.push({ c: e.clone().add(v3(0, 0.2, 0)), r: 1.0 + r() * 0.35 });
    list.push({ c: e.clone().lerp(crownC, 0.45).add(v3(0, 0.35, 0)), r: 0.8 });
  }
  clumps(b, 'needles', list, 4, crownC, crownR, ['#4c5a40', '#56634a', '#45523b', '#5c6847'], 70 + v * 13, 0.55);
}

function oak(b: PartBuilder, v: number): void {
  const r = rng(21 + v * 101);
  const trunkTop = v3(v ? -0.2 : 0.1, 3.2 + v * 0.4, v ? 0.15 : 0);
  trunk(b, trunkTop.y + 0.2, 0.46, 0.34, 8, { color: BARK }, v3(trunkTop.x, 0, trunkTop.z), 1.55);
  // main limbs (sub-segmented for a slight crook)
  const ends: Vector3[] = [];
  const nl = 5 + v;
  for (let i = 0; i < nl; i++) {
    const a = (i / nl) * Math.PI * 2 + r() * 0.6;
    const mid = v3(Math.cos(a) * 1.6, 5.1 + r() * 1.2, Math.sin(a) * 1.6);
    const end = v3(Math.cos(a) * (3.3 + r()), 7.0 + r() * 2.4, Math.sin(a) * (3.3 + r()));
    rod(b, 'bark', trunkTop, mid, 0.25, 0.16, 5, { color: BARK, ao: 0, dirt: 0 }, true);
    rod(b, 'bark', mid, end, 0.16, 0.05, 4, { color: BARK, ao: 0, dirt: 0 }, true);
    ends.push(end);
  }
  rod(b, 'bark', trunkTop, v3(0.3, 10.2, -0.2), 0.26, 0.06, 5, { color: BARK, ao: 0, dirt: 0 }, true);
  // dry leaves kept into November: a broad crown of rounded masses, a few warm lighter ones
  const crownC = v3(0, 8.2, 0);
  const crownR = v3(4.6, 2.9, 4.6);
  const list: Clump[] = ends.map((e) => ({ c: e.clone().add(v3(0, 0.4, 0)), r: 1.5 + r() * 0.4 }));
  list.push(...shell(r, crownC, crownR, 16, 0.55, [1.3, 1.8], -0.35));
  list.push({ c: v3(0.2, 10.4, 0), r: 1.7 });
  // the bare winter crown shows its scaffold (D-260): a thin branch from the nearest limb into every outer clump, so
  // no twig spray floats in the air
  const joints = [trunkTop, ...ends, v3(0.3, 10.2, -0.2)];
  for (const k of list.slice(ends.length)) branchTo(b, joints, k.c, 0.09, BARK);
  const cols = ['#7a5a33', '#6c5232', '#8d6b3a', '#5f4a30', '#9a7440', '#6f6236', '#a5643a'];
  clumps(b, 'leaves', list, 3, crownC, crownR, cols, 31 + v * 7);
}

function birch(b: PartBuilder, v: number): void {
  const r = rng(41 + v * 53);
  const H = TREE_SIZE.birch.height;
  const pale = '#b9b2a2';
  const shade = (q: Vector3, _n: Vector3, c: Color) => {
    // dark lenticel bands and a dark, fissured base
    const band = fnoise(q.x * 3, q.y * 4.5, q.z * 3, 7);
    if (band > 0.35) c.multiplyScalar(0.4);
    if (q.y < 1.4) c.multiplyScalar(0.42 + 0.48 * (q.y / 1.4));
  };
  const lean = v3(v ? 0.35 : -0.2, 0, v ? -0.15 : 0.25);
  trunk(b, H * 0.92, 0.2, 0.05, 7, { color: pale, shade }, lean, 1.35);
  const crownC = v3(lean.x * 0.6, H * 0.68, lean.z * 0.6);
  const crownR = v3(2.5, 3.3, 2.5);
  const list: Clump[] = [];
  for (let i = 0; i < 8; i++) {
    const a = r() * Math.PI * 2;
    const y = H * (0.36 + 0.5 * (i / 8));
    const t = y / (H * 0.92);
    const ax = v3(lean.x * t * t, y, lean.z * t * t);
    const len = 2.4 * (1 - (i / 8) * 0.55);
    const e = ax.clone().add(v3(Math.cos(a) * len, len * 0.85, Math.sin(a) * len));
    rod(b, 'bark', ax, e, 0.065, 0.015, 4, { color: '#5e5249', ao: 0, dirt: 0 }, true);
    // drooping clumps below the branch end
    list.push({ c: e.clone().add(v3(Math.cos(a) * 0.3, -0.5, Math.sin(a) * 0.3)), r: 0.95 + r() * 0.3 });
  }
  const n0 = list.length;
  list.push(...shell(r, crownC, crownR, 10, 0.5, [0.9, 1.2], -0.5));
  // bare crown scaffold (D-260): thin rising branches from the stem into the outer clumps
  for (const k of list.slice(n0)) {
    const y = Math.max(H * 0.3, k.c.y - 1.4), t = y / (H * 0.92);
    branchTo(b, [v3(lean.x * t * t, y, lean.z * t * t)], k.c, 0.05, '#5e5249');
  }
  clumps(b, 'leaves', list, 3, crownC, crownR, ['#a08a45', '#8f7c45', '#b39a4f', '#857446', '#97894a', '#7b7a44'], 43 + v * 11);
}

function bush(b: PartBuilder, v: number): void {
  const r = rng(51 + v * 29);
  // a few stems fanning out of one root, mostly hidden in the leaf mass
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r() * 0.7;
    const l = 0.7 + r() * 0.6;
    const e = v3(Math.cos(a) * l, 1.3 + r() * 0.7, Math.sin(a) * l);
    rod(b, 'bark', v3(Math.cos(a) * 0.1, -0.1, Math.sin(a) * 0.1), e, 0.05, 0.02, 4, { color: '#4a4038', ao: 0.3, dirt: 0.2 }, true);
  }
  const crownC = v3(0, 1.35, 0);
  const crownR = v3(1.75, 1.15, 1.75);
  const list = shell(r, crownC, crownR, 8 + v, 0.35, [0.7, 0.95], -0.3);
  list.push({ c: v3(0.15, 1.9, -0.1), r: 0.85 });
  // (no extra scaffold for the shrub, D-261: its twig sprays and five stems carry the bare look, and shrubs are the
  // most numerous near model — 6 triangles a clump would be the largest share of the added geometry)
  // hazel/blackthorn in November: dull olive and ochre with a few russet clumps
  const cols = v
    ? ['#646541', '#706b3c', '#5a5e3e', '#7b6a3c', '#7f5a3c']
    : ['#5d6440', '#6a6a3e', '#535b3c', '#74683e', '#6e5636'];
  clumps(b, 'leaves', list, 3, crownC, crownR, cols, 52 + v * 5);
}

/**
 * A thin branch (3-sided open rod, 6 triangles) from the nearest of `from` to just short of the clump centre `to`
 * (D-260): hidden in the leaf mass in summer, the scaffold of the bare crown in winter.
 */
function branchTo(b: PartBuilder, from: Vector3[], to: Vector3, r0: number, color: string): void {
  let best = from[0]!, bd = Infinity;
  for (const f of from) { const d = f.distanceToSquared(to); if (d < bd) { bd = d; best = f; } }
  const end = best.clone().lerp(to, 0.88);
  rod(b, 'bark', best, end, r0, r0 * 0.35, 3, { color, ao: 0, dirt: 0 }, true);
}

const BUILD: Record<TreeKind, (b: PartBuilder, v: number) => void> = { spruce, pine, oak, birch, bush };
const cache = new Map<string, ModelPart[]>();

/** Full-detail tree (LOD0), `variant` in [0, TREE_VARIANTS). */
export function treeParts(kind: TreeKind, variant = 0): ModelPart[] {
  const key = `${kind}:${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const b = new PartBuilder({ seed: 600 + TREE_KINDS.indexOf(kind) + variant * 37, ao: 0.3, aoHeight: 1.5 });
  BUILD[kind](b, variant);
  // trunks get their own material: bark maps plus the tree shader (LOD dither, sway)
  const parts = b.build().map((p): ModelPart => ({ geometry: p.geometry, material: p.material === 'bark' ? 'trunk' : p.material }));
  for (const p of parts) addTreeAttr(p.geometry, kind, 0, p.material === 'leaves' ? 600 + TREE_KINDS.indexOf(kind) * 7 + variant : 0);
  cache.set(key, parts);
  return parts;
}

/**
 * `aTree` = (LOD factor, tint family, z). z is the far card's lift; on leaf cards (`cardSeed` > 0) it is the card's
 * own hash in [0.02, 0.98] instead, the same for its 4 corners (clumps() writes 4 consecutive vertices per card): the
 * bare factor drops the cards in this order (D-260).
 */
function addTreeAttr(g: BufferGeometry, kind: TreeKind, lift = 0, cardSeed = 0): void {
  const n = g.getAttribute('position').count;
  const a = new Float32Array(n * 3);
  const [k, t] = TREE_ATTR[kind];
  const r = cardSeed > 0 ? rng(cardSeed) : null;
  let h = lift;
  for (let i = 0; i < n; i++) {
    if (r && (i & 3) === 0) h = 0.02 + 0.96 * r();
    a[i * 3] = k; a[i * 3 + 1] = t; a[i * 3 + 2] = h;
  }
  g.setAttribute('aTree', new BufferAttribute(a, 3));
}

/** Half-width (max distance from the trunk axis) and top of a kind's variant-0 model. */
function treeExtent(kind: TreeKind): { half: number; top: number } {
  let half = 0, top = 0;
  for (const p of treeParts(kind)) {
    const pos = p.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      half = Math.max(half, Math.hypot(pos.getX(i), pos.getZ(i)));
      top = Math.max(top, pos.getY(i));
    }
  }
  return { half, top };
}

// -------------------------------------------------------------------------------------------
// Billboards
// -------------------------------------------------------------------------------------------

const ATLAS_COLS = TREE_KINDS.length;
/**
 * Azimuth views per kind in the far-card atlas (rows; view i has the bake camera at i/N turns
 * around the tree). The card shader picks the two views nearest to the camera direction in the
 * tree's own frame, so a far tree keeps its yaw and its crown shape changes as the camera orbits
 * instead of every distant tree showing the same face.
 */
export const BB_VIEWS = 8;
const bbCache = new Map<TreeKind, ModelPart[]>();

/**
 * Far cards are baked from this elevation (radians): the game camera looks down at 35–60°, and a
 * level side view of a spruce is a thin spike that turns a distant forest into vertical streaks;
 * from 30° the sprays show their upper faces and the crown its real width.
 */
export const BB_ELEV = 0.52;

/**
 * Card extent per kind in the elevated view: width = model extent plus an empty margin (no mip
 * bleed between atlas columns); height in the bake camera's up direction, the trunk foot at 0.
 */
const cardSizes = new Map<TreeKind, { W: number; y0: number; y1: number }>();

function cardSize(kind: TreeKind): { W: number; y0: number; y1: number } {
  // cached: the model is (D-260: a season re-bake asked for it 80 times, each a walk over every vertex)
  let cs = cardSizes.get(kind);
  if (cs) return cs;
  const { half, top } = treeExtent(kind);
  const c = Math.cos(BB_ELEV), s = Math.sin(BB_ELEV);
  cs = { W: half * 2 * 1.16, y0: -0.25 * c - half * s * 1.08, y1: (top + 0.2) * c + half * s * 1.08 };
  cardSizes.set(kind, cs);
  return cs;
}

/**
 * One card (2 triangles) sized to the tree, UV-mapped into the shared billboard atlas column for
 * `kind`. The `billboard` material swings it about its vertical axis to face the camera and
 * shades it with the baked normal atlas; it casts a soft blob (`billboardDepthMaterial`) instead
 * of the card's silhouette. Vertex colour darkens toward the base so a card reads as a clump
 * standing on the ground. Material key `billboard`; call `bakeTreeBillboards` once to fill it.
 */
export function treeBillboard(kind: TreeKind): ModelPart[] {
  const hit = bbCache.get(kind);
  if (hit) return hit;
  const { W, y0, y1 } = cardSize(kind);
  const col = TREE_KINDS.indexOf(kind);
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], color: number[] = [], idx: number[] = [];
  const dx = W / 2;
  const corners: [number, number, number][] = [[-dx, y0, 0], [dx, y0, 1], [dx, y1, 1], [-dx, y1, 0]];
  for (const [x, y, u] of corners) {
    // stored raised so the bottom edge sits on the ground (the shader moves it toward the camera)
    pos.push(x, y - y0, 0);
    // fallback "dome" normals (the normal atlas replaces them once baked)
    const n = v3(x / (W / 2), 1.2, 0).normalize();
    nor.push(n.x, n.y, n.z);
    // view 0 row; the shader adds the row offset of the views it samples
    uv.push((col + u) / ATLAS_COLS, (y - y0) / (y1 - y0) / BB_VIEWS);
    // ground occlusion: shrubs darken a lot at the base, tall trees only around the trunk foot
    const k = y > 0 ? 1 : 0.88;
    color.push(k, k, k);
  }
  idx.push(0, 1, 2, 0, 2, 3);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new BufferAttribute(new Float32Array(color), 3));
  g.setIndex(idx);
  addTreeAttr(g, kind, -y0);
  g.computeBoundingSphere();
  const parts: ModelPart[] = [{ geometry: g, material: 'billboard' }];
  bbCache.set(kind, parts);
  return parts;
}

let bbDepth: MeshDepthMaterial | null = null;

/**
 * Shadow-pass material for far-tree cards (set as `customDepthMaterial`): the card turns to face
 * the light and its alpha is read from a coarse mip of the atlas, so each far tree casts one
 * soft, rounded blob instead of the hard cross of two cut-out cards.
 */
export function billboardDepthMaterial(): MeshDepthMaterial {
  if (bbDepth) return bbDepth;
  const m = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  m.name = 'billboard-depth';
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `vec3 transformed = vec3(position);
#ifdef USE_INSTANCING
  // face the light: the shadow camera's backward axis (exact for the orthographic sun camera)
  vec3 bbF = normalize(vec3(viewMatrix[0][2], 0.0, viewMatrix[2][2]) + vec3(1e-4, 0.0, 0.0));
  vec3 bbR = vec3(bbF.z, 0.0, -bbF.x);
  vec3 bbLR = normalize(transpose(mat3(instanceMatrix)) * bbR);
  transformed = bbLR * position.x + vec3(0.0, position.y, 0.0);
  // push the blob away from the light along the shadow camera's depth axis: the ground shadow is
  // unchanged, but the tree's own camera-facing card is no longer cut in half by it
  vec3 bbZ = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  float bbS2 = dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz);
  transformed -= transpose(mat3(instanceMatrix)) * bbZ * (6.0 * sqrt(bbS2) / bbS2);
#endif`,
    );
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <map_fragment>',
      /* glsl */ `#ifdef USE_MAP
  // blurred silhouette (coarse mip) -> one rounded blob per crown
  diffuseColor.a = textureLod(map, vMapUv, 4.5).a * 1.7;
#endif`,
    );
  };
  m.customProgramCacheKey = () => 'billboard-depth-2';
  bbDepth = m;
  return m;
}

let atlas: WebGLRenderTarget | null = null;
let atlasN: WebGLRenderTarget | null = null;
let atlasCell = 0;
/** Bare factor the atlas pair holds (D-260); the bake materials read it from `bakeBare`. */
let atlasBare = -1;
const bakeBare = { value: 0 };
/** Spring green level the atlas pair holds (D-303); the bake materials read it from `bakeSpring`. */
let atlasSpring = -1;
const bakeSpring = { value: 0 };

// Bake shaders: albedo (vertex colour × card texture) and object-space normals, both cut by the
// card alpha. Object space = card space for a camera on +Z (x right, y up, z toward the viewer).
const BAKE_VERT = /* glsl */ `
attribute vec3 color;
attribute vec3 aTree;
uniform float bare;
uniform float spring;
uniform float leafUv;
varying vec3 vN;
varying vec3 vC;
varying vec2 vUv;
varying float vTwig;
${TWIG_GLSL}
void main() {
  vN = normalize(normalMatrix * normal);
  vC = color;
  vUv = uv;
  vTwig = 0.0;
  // leaf cards: the same winter card selection as the leaf material (D-260)
  if (leafUv > 0.5) {
    float sel = twigSel(aTree.z, bare);
    vUv = twigUv(uv, sel, aTree.z);
    vC = mix(springLeaf(color, spring, aTree.z), TWIG_COL, sel);
    vTwig = sel;
  }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const BAKE_FRAG = /* glsl */ `
// both atlases in one pass (D-327): albedo to attachment 0 (whose alpha drives alpha to coverage), normals to 1
layout(location = 0) out highp vec4 oAlbedo;
layout(location = 1) out highp vec4 oNormal;
uniform sampler2D map;
uniform float useMap;
varying vec3 vN;
varying vec3 vC;
varying vec2 vUv;
varying float vTwig;
void main() {
  vec4 t = useMap > 0.5 ? texture2D(map, vUv) : vec4(1.0);
  float a = 1.0;
  // twig cards (D-260): partial coverage through alpha to coverage on the multisampled row, so the resolved atlas
  // holds a bare crown as a thin haze of twigs (premultiplied like the rest of the atlas), not as a solid mass;
  // a little mip hold-up like the leaf material's. Leaf and needle cards stay fully covered or cut, as before.
  if (vTwig > 0.5) {
    vec2 tuv = vUv * vec2(textureSize(map, 0));
    float lod = max(0.0, 0.5 * log2(max(dot(dFdx(tuv), dFdx(tuv)), dot(dFdy(tuv), dFdy(tuv)))));
    a = clamp(t.a * 0.55 * (1.0 + lod * 0.15), 0.0, 1.0);
    if (a < 0.08) discard;
  } else if (t.a < 0.5) discard;
  oNormal = vec4(normalize(vN) * 0.5 + 0.5, a);
  // the full model also shades itself through the shadow map (darker, a little greyer in the
  // crown's depth); the card cannot, so its albedo is pulled down the same way
  vec3 c = vC * t.rgb;
  oAlbedo = vec4(mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))), 0.12) * 0.84, a);
}`;

function bakeMaterial(map: Texture | null, leaf = false): ShaderMaterial {
  return new ShaderMaterial({
    glslVersion: GLSL3,
    // leaf cards: the twig haze goes in by coverage (opaque leaves and the other kinds write alpha 1: unchanged)
    alphaToCoverage: leaf,
    vertexShader: BAKE_VERT,
    fragmentShader: BAKE_FRAG,
    // `bare` and `spring` are shared by every bake material (one value per bake)
    uniforms: { map: { value: map }, useMap: { value: map ? 1 : 0 }, leafUv: { value: leaf ? 1 : 0 }, bare: bakeBare, spring: bakeSpring },
    side: DoubleSide,
  });
}

// Row-to-atlas copy: the views are rendered row by row into a small multisampled target and
// copied into the (single-sample, mipmapped) atlases, so the big atlases need no MSAA buffers.
const COPY_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;
const COPY_FRAG = /* glsl */ `
uniform sampler2D src;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(src, vUv); }`;

/**
 * Render every tree kind from `BB_VIEWS` azimuths into a shared albedo atlas and a matching
 * normal atlas (columns = kinds, rows = views), attached to the `billboard` material: the far
 * card is then lit like the full model (same crown normals, same vertex-colour occlusion), so the
 * LOD swap does not change the value of the forest. Call once after the renderer exists; cheap
 * (5 kinds x 8 views x 2 passes of small renders + 16 row copies). `cellPx` is the cell width (the
 * view.ts tier picks it): atlas = 5·cell x 16·cell RGBA8 + mips, two of them — 128 px (low, high)
 * 2 x 7 MB, 256 px (ultra) 2 x 28 MB. Calling again with another size
 * re-bakes (old pair disposed).
 */
/**
 * Bake materials kept across bakes: disposing them freed their programs, so every tier switch
 * re-linked them inside the frame that re-baked (2 links per switch, measured with SwiftShader).
 */
let bakeMats: { leaves: ShaderMaterial; needles: ShaderMaterial; solid: ShaderMaterial } | null = null;
let copyMat: ShaderMaterial | null = null;

/** GPU bytes held by the baked far-tree atlas pair (albedo + normal, RGBA8 with a full mip chain). */
export function treeAtlasBytes(): number {
  if (!atlas) return 0;
  let bytes = 0;
  for (let w = atlas.width, h = atlas.height; ; w = Math.max(1, w >> 1), h = Math.max(1, h >> 1)) {
    bytes += w * h * 4;
    if (w === 1 && h === 1) break;
  }
  return bytes * (atlasN ? 2 : 1);
}

export function bakeTreeBillboards(renderer: WebGLRenderer, cellPx = 128, bare = 0, spring = 0): WebGLRenderTarget {
  if (atlas && atlasCell === cellPx && atlasBare === bare && atlasSpring === spring) return atlas;
  const rowW = cellPx * ATLAS_COLS, rowH = cellPx * 2;
  const mk = () => {
    const rt = new WebGLRenderTarget(rowW, rowH * BB_VIEWS);
    // mipmapped so distant crowns stay solid instead of sparkling into thin sticks
    rt.texture.generateMipmaps = true;
    rt.texture.minFilter = LinearMipmapLinearFilter;
    return rt;
  };
  // a new bare factor at the same size re-renders into the pair it has (D-260: no new GPU memory per season step);
  // another resolution (quality tier switch) frees the old pair first
  const reuse = !!(atlas && atlasN && atlasCell === cellPx);
  if (!reuse) {
    atlas?.dispose();
    atlasN?.dispose();
  }
  const rtA = reuse ? atlas! : mk();
  const rtN = reuse ? atlasN! : mk();
  bakeBare.value = bare;
  bakeSpring.value = spring;
  // two attachments (D-327): albedo and normals of the same draws, resolved together
  const row = new WebGLRenderTarget(rowW, rowH, { samples: 4, count: 2 });
  for (const t of row.textures) {
    t.generateMipmaps = false;
    t.minFilter = NearestFilter;
    t.magFilter = NearestFilter;
  }
  const scene = new Scene();
  const copyScene = new Scene();
  copyMat ??= new ShaderMaterial({ vertexShader: COPY_VERT, fragmentShader: COPY_FRAG, uniforms: { src: { value: null } }, depthTest: false, depthWrite: false, blending: NoBlending });
  const quadGeo = new PlaneGeometry(2, 2);
  const quad = new Mesh(quadGeo, copyMat);
  quad.frustumCulled = false;
  copyScene.add(quad);
  const copyCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new Color()).clone();
  const prevAlpha = renderer.getClearAlpha();
  const prevAutoClear = renderer.autoClear;
  const bm = bakeMats ??= {
    leaves: bakeMaterial(leafTexture(), true),
    needles: bakeMaterial(needleTexture()),
    solid: bakeMaterial(null),
  };
  // one camera per kind (its column of the row as its viewport, its card's extent as its frustum), all rendered by
  // one ArrayCamera pass per row (D-326): the 5 per-kind passes each ended in a resolve of the whole multisampled
  // row (and a scissor around their column); one pass resolves it once. Kind i draws only on layer i + 1.
  const cams = TREE_KINDS.map((kind, i) => {
    const { W, y0, y1 } = cardSize(kind);
    const c = new OrthographicCamera(-W / 2, W / 2, y1, y0, 0.1, 120);
    // the target's own viewport (render-target pixels, independent of the pixel ratio)
    c.viewport = new Vector4(i * cellPx, 0, cellPx, rowH);
    c.layers.set(i + 1);
    return c;
  });
  const cam = new ArrayCamera(cams as unknown as ConstructorParameters<typeof ArrayCamera>[0]);
  cam.layers.enableAll();
  // the meshes of every kind, built once per bake (not per view); every view's frustum holds the whole tree (the
  // card is sized to it), so nothing is culled, and the ArrayCamera's own frustum is not the views'
  TREE_KINDS.forEach((kind, i) => {
    for (const p of treeParts(kind)) {
      const mesh = new Mesh(p.geometry, p.material === 'leaves' ? bm.leaves : p.material === 'needles' ? bm.needles : bm.solid);
      mesh.layers.set(i + 1);
      mesh.frustumCulled = false;
      scene.add(mesh);
    }
  });
  // cleared to 0 with opaque foliage on top = a premultiplied atlas: mips and MSAA edges stay
  // correct when the card shader divides by alpha (no dark or olive fringe)
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  // the copy program's first use (link check) before any tree is drawn (D-325): three waits for the link at the
  // first draw with a program, and that wait also waits for every draw queued before it, so a first copy after
  // the first row's trees held the main thread until the GPU had rendered them. Drawn into the row (cleared
  // before each view) with no source bound; the bake programs' first use comes with the first tree, also on an
  // empty queue, after which the bake only queues work and returns.
  copyMat.uniforms.src!.value = null;
  renderer.setRenderTarget(row);
  renderer.render(copyScene, copyCam);
  for (const rt of [rtA, rtN]) {
    renderer.setRenderTarget(rt);
    renderer.clear();
  }
  for (let v = 0; v < BB_VIEWS; v++) {
    const az = (v / BB_VIEWS) * Math.PI * 2;
    // looking down at BB_ELEV from azimuth `az`: image "up" tilts toward the tree, the trunk foot at the origin
    const h = Math.cos(BB_ELEV) * 50;
    for (const c of cams) {
      c.position.set(Math.sin(az) * h, Math.sin(BB_ELEV) * 50, Math.cos(az) * h);
      c.lookAt(0, 0, 0);
      c.updateMatrixWorld();
    }
    renderer.setRenderTarget(row);
    renderer.clear();
    renderer.render(scene, cam);
    // copy the resolved row into its atlas rows; the mip chains are built once, after the last row's copy (three
    // rebuilds them after every render into a mipmapped target: 8 full-chain rebuilds per atlas, each from scratch)
    [rtA, rtN].forEach((rt, i) => {
      copyMat!.uniforms.src!.value = row.textures[i];
      rt.viewport.set(0, v * rowH, rowW, rowH);
      rt.scissor.set(0, v * rowH, rowW, rowH);
      rt.scissorTest = true;
      rt.texture.generateMipmaps = v === BB_VIEWS - 1;
      renderer.setRenderTarget(rt);
      renderer.render(copyScene, copyCam);
    });
  }
  for (const rt of [rtA, rtN]) {
    rt.texture.generateMipmaps = true;
    rt.scissorTest = false;
    rt.viewport.set(0, 0, rt.width, rt.height);
    rt.scissor.set(0, 0, rt.width, rt.height);
  }
  row.dispose();
  copyMat.uniforms.src!.value = null;
  quadGeo.dispose();
  renderer.autoClear = prevAutoClear;
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevClear, prevAlpha);
  const m = modelMaterial('billboard');
  const md = m as unknown as { defines?: Record<string, string> };
  // a season re-bake into the same pair changes no program input: no needsUpdate (D-260)
  if (m.map !== rtA.texture || !md.defines || !('TREE_BB_NORMAL' in md.defines)) {
    m.map = rtA.texture;
    m.alphaTest = 0.4;
    md.defines = { ...md.defines, TREE_BB_NORMAL: '', TREE_BB_VIEWS: BB_VIEWS.toFixed(1) };
    m.needsUpdate = true;
  }
  treeUniforms.uBbNormal.value = rtN.texture;
  // hand the queued work to the GPU now (D-325): WebGL sends it only when its command buffer fills or something
  // waits on it, so a bake queued before a long CPU task (the world build) otherwise ran after it, not during it
  renderer.getContext().flush();
  atlas = rtA;
  atlasN = rtN;
  atlasCell = cellPx;
  atlasBare = bare;
  atlasSpring = spring;
  return rtA;
}
