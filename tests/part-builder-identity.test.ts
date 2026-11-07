// Perf day 15 (D-320..D-322): PartBuilder builds its pieces from shared primitive templates as plain typed arrays,
// transforms and colours them in scalar loops, works noise out once per shared vertex and merges / bounds them in
// plain loops. This test keeps the builder as it was before (three's applyMatrix4, Color operations,
// computeVertexNormals, computeBoundingBox / Sphere, a BufferGeometry per piece) as the reference and compares every
// attribute, the index and the bounds bit for bit (Object.is) on primitives with every option the models use.
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { type AddOpts, type BuilderSettings, fnoise, mergeIndexed, type ModelPart, PartBuilder, prim, rng, smoothstep, trs, UV_METRES } from '../src/render/models/kit';
import type { MatKey } from '../src/render/models/materials';
import { buildingModel } from '../src/render/models/buildings';
import { treeParts } from '../src/render/models/trees';
import { eq, test } from './harness';

const MUD = new Color('#4a3c2e');

// --- reference: kit.ts PartBuilder before D-320 ------------------------------------------------------------------
class RefBuilder {
  private readonly groups = new Map<MatKey, BufferGeometry[]>();
  private readonly settings: Required<BuilderSettings>;
  readonly rand: () => number;
  private hasRig = false;

  constructor(settings: BuilderSettings = {}) {
    this.settings = {
      seed: settings.seed ?? 1,
      aoHeight: settings.aoHeight ?? 1.4,
      ao: settings.ao ?? 0.45,
      dirt: settings.dirt ?? 0.3,
      dirtHeight: settings.dirtHeight ?? 0.5,
    };
    this.rand = rng(this.settings.seed * 7919 + 13);
  }

  /** Random number in [a, b). */
  r(a = 0, b = 1): number {
    return a + (b - a) * this.rand();
  }

  add(mat: MatKey, src: BufferGeometry, o: AddOpts): this {
    // a plain copy of the index and the attributes we merge (D-255): `src.clone()` first ran the primitive's own
    // constructor with default parameters (a 32 x 16 sphere for every SphereGeometry piece), copied every attribute
    // twice and kept the groups and bounds, all thrown away again
    const g = new BufferGeometry();
    if (src.index) g.setIndex(new BufferAttribute(src.index.array.slice(), 1));
    for (const name of Object.keys(src.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') continue;
      const a = src.attributes[name]!;
      g.setAttribute(name, (a as BufferAttribute).isBufferAttribute ? new BufferAttribute(a.array.slice(), a.itemSize, a.normalized) : a.clone());
    }
    if (!g.index) {
      const n = g.getAttribute('position').count;
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      g.setIndex(new BufferAttribute(idx, 1));
    }
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if (o.m) g.applyMatrix4(o.m);

    const pos = g.getAttribute('position') as BufferAttribute;
    const nor = g.getAttribute('normal') as BufferAttribute;
    const count = pos.count;
    const seed = this.settings.seed;

    if (o.jitter) {
      const f = o.jitterFreq ?? 2.5;
      const a = o.jitter;
      const pa = pos.array as Float32Array;
      for (let i = 0; i < count; i++) {
        const x = pa[i * 3]!, y = pa[i * 3 + 1]!, z = pa[i * 3 + 2]!;
        pa[i * 3] = x + fnoise(x * f, y * f, z * f, seed + 1) * a;
        pa[i * 3 + 1] = y + fnoise(x * f + 31.7, y * f, z * f, seed + 2) * a;
        pa[i * 3 + 2] = z + fnoise(x * f, y * f + 57.1, z * f, seed + 3) * a;
      }
      if (o.renormal) g.computeVertexNormals();
    }

    // vertex colours
    const base = new Color(o.color);
    const vary = o.vary ?? 0.06;
    const pieceK = 1 + (this.rand() * 2 - 1) * vary;
    const noiseA = o.noise ?? 0.06;
    const nf = o.noiseFreq ?? 1.7;
    const aoK = o.ao ?? this.settings.ao;
    const dirtK = o.dirt ?? this.settings.dirt;
    const col = new Float32Array(count * 3);
    const c = new Color();
    const p = new Vector3();
    const n = new Vector3();
    // plain array reads (same values as getX/getY/getZ: the attributes are not normalized)
    const pa = pos.array as Float32Array, na = nor.array as Float32Array;
    for (let i = 0; i < count; i++) {
      p.set(pa[i * 3]!, pa[i * 3 + 1]!, pa[i * 3 + 2]!);
      n.set(na[i * 3]!, na[i * 3 + 1]!, na[i * 3 + 2]!);
      c.copy(base);
      if (o.shade) o.shade(p, n, c);
      const k = pieceK * (1 + fnoise(p.x * nf, p.y * nf, p.z * nf, seed + 9) * noiseA);
      const ao = 1 - aoK * (1 - smoothstep(0, this.settings.aoHeight, p.y));
      // faces pointing down receive less sky light
      const down = n.y < 0 ? 1 + n.y * 0.25 : 1;
      c.multiplyScalar(k * ao * down);
      const d = dirtK * (1 - smoothstep(0, this.settings.dirtHeight, p.y));
      if (d > 0) c.lerp(MUD, d);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new BufferAttribute(col, 3));

    if (!o.keepUv) refBoxUv(g);
    else if (!g.getAttribute('uv')) refBoxUv(g);

    // the skinning attribute only for rigged pieces; build() gives the others zeros when the model has a rig
    // (D-255: an all-zero array per piece was merged and then deleted for every unrigged model)
    if (o.rig) {
      this.hasRig = true;
      const rg = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) rg.set(o.rig(p.set(pa[i * 3]!, pa[i * 3 + 1]!, pa[i * 3 + 2]!)), i * 4);
      g.setAttribute('rig', new BufferAttribute(rg, 4));
    }

    let list = this.groups.get(mat);
    if (!list) this.groups.set(mat, (list = []));
    list.push(g);
    return this;
  }

  /** Merge everything added so far into one geometry per material kind. */
  build(): ModelPart[] {
    const out: ModelPart[] = [];
    for (const [material, list] of this.groups) {
      if (this.hasRig) for (const g of list) if (!g.getAttribute('rig')) g.setAttribute('rig', new BufferAttribute(new Float32Array(g.getAttribute('position').count * 4), 4));
      const merged = mergeIndexed(list);
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      out.push({ geometry: merged, material });
    }
    return out;
  }
}


/** Box-projected UVs in model space (dominant normal axis). */
function refBoxUv(g: BufferGeometry): void {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  const s = 1 / UV_METRES;
  const pa = pos.array as Float32Array, na = nor.array as Float32Array;
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(na[i * 3]!), ay = Math.abs(na[i * 3 + 1]!), az = Math.abs(na[i * 3 + 2]!);
    const x = pa[i * 3]!, y = pa[i * 3 + 1]!, z = pa[i * 3 + 2]!;
    let u: number, v: number;
    if (ay >= ax && ay >= az) { u = x; v = z; }
    else if (ax >= az) { u = z; v = y; }
    else { u = x; v = y; }
    uv[i * 2] = u * s;
    uv[i * 2 + 1] = v * s;
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
}


// -----------------------------------------------------------------------------------------------------------------

const same = (a: ModelPart[], b: ModelPart[], what: string): void => {
  eq(a.map((p) => p.material).join(','), b.map((p) => p.material).join(','), `${what}: materials`);
  a.forEach((pa, k) => {
    const x = pa.geometry, y = b[k]!.geometry, w = `${what} ${pa.material}`;
    eq(Object.keys(x.attributes).join(','), Object.keys(y.attributes).join(','), `${w}: attribute names`);
    for (const n of Object.keys(x.attributes)) {
      const ax = x.attributes[n]!, ay = y.attributes[n]!;
      eq(`${ax.array.constructor.name} ${ax.itemSize} ${ax.normalized}`, `${ay.array.constructor.name} ${ay.itemSize} ${ay.normalized}`, `${w}: ${n} kind`);
      eq(ax.array.length, ay.array.length, `${w}: ${n} length`);
      for (let i = 0; i < ax.array.length; i++) if (!Object.is(ax.array[i], ay.array[i])) throw new Error(`${w}: ${n}[${i}] ${ax.array[i]} != ${ay.array[i]}`);
    }
    eq(x.index!.array.constructor.name, y.index!.array.constructor.name, `${w}: index type`);
    eq(x.index!.array.join(','), y.index!.array.join(','), `${w}: index`);
    const bx = x.boundingBox!, by = y.boundingBox!, sx = x.boundingSphere!, sy = y.boundingSphere!;
    const nums = (v: number[]) => v.map((q) => (Object.is(q, -0) ? '-0' : String(q))).join(',');
    eq(nums([...bx.min.toArray(), ...bx.max.toArray()]), nums([...by.min.toArray(), ...by.max.toArray()]), `${w}: bounding box`);
    eq(nums([...sx.center.toArray(), sx.radius]), nums([...sy.center.toArray(), sy.radius]), `${w}: bounding sphere`);
  });
};

/** Every add of `fill` goes to both builders: the new one with shared templates, the reference with fresh primitives. */
function both(settings: BuilderSettings, fill: (add: (mat: MatKey, make: () => BufferGeometry, o: AddOpts, shared?: BufferGeometry) => void) => void, what: string): void {
  const nb = new PartBuilder(settings), rb = new RefBuilder(settings);
  fill((mat, make, o, shared) => { nb.add(mat, shared ?? make(), o); rb.add(mat, make(), o); });
  same(nb.build(), rb.build(), what);
}

function custom(): BufferGeometry {
  // non-indexed, no normals (the slow path: three's computeVertexNormals after the copy)
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0.3, 1, 0, 0, 1, 1, 0.2, 0, 1, 0.3], 3));
  return g;
}

function cards(): BufferGeometry {
  // indexed, own normals and uvs, as trees.ts clumps
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([0, 1, 0, 1, 1, 0, 1, 2, 0.1, 0, 2, 0.1, 0.5, 1.2, 0.4, 1.4, 1.1, 0.5, 1.3, 2.1, 0.6], 3));
  g.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0.6, 0.8, 0, 0, 1, 0.6, 0, 0.8, 0, 1, 0, 0, 0, 1, 0, 0, 1], 3));
  g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 0.2, 0.2, 0.8, 0.3, 0.7, 0.9], 2));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6]);
  return g;
}

test('part builder: primitives with transforms, jitter, renormal, shades, kept uvs equal the pre-D-320 builder', () => {
  const lathe = () => new LatheGeometry([new Vector2(0.3, 0), new Vector2(0.5, 0.4), new Vector2(0.2, 1)], 7);
  both({ seed: 3, ao: 0.4, aoHeight: 1.6, dirt: 0.3, dirtHeight: 0.45 }, (add) => {
    add('wood', () => new BoxGeometry(1.2, 0.3, 4), { color: '#5b4b3b', m: trs(0.3, 1.1, -2, 0.1, 0.7, -0.05) }, prim(BoxGeometry, 1.2, 0.3, 4));
    add('wood', () => new BoxGeometry(1.2, 0.3, 4), { color: '#5b4b3b', m: trs(-1, 0.2, 1, 0, -0.4, 0, 1, 1.3, 0.7) }, prim(BoxGeometry, 1.2, 0.3, 4));
    add('stone', () => new BoxGeometry(3, 2.5, 0.6, 8, 6, 2), {
      color: '#7b766b', m: trs(0, 1.25, 0, 0, 0.3, 0), jitter: 0.04, jitterFreq: 2.2, noise: 0.2, noiseFreq: 1.6, dirt: 0.35,
      shade: (p, n, c) => { if (Math.abs(n.y) < 0.5 && fnoise(p.x, p.y, p.z, 41) > 0.1) c.lerp(new Color('#857b69'), 0.3); else if (n.y > 0.5) c.multiplyScalar(1.08); },
    }, prim(BoxGeometry, 3, 2.5, 0.6, 8, 6, 2));
    add('bark', () => new CylinderGeometry(0.2, 0.208, 3, 8, 1, false), {
      color: '#544636', m: trs(1, 0.4, 2, 0, 0, Math.PI / 2), jitter: 0.024, jitterFreq: 5, noise: 0.12,
      shade: (_p, n, c) => { if (Math.abs(n.x) > 0.7) c.set('#a8916c'); },
    }, prim(CylinderGeometry, 0.2, 0.208, 3, 8, 1, false));
    add('thatch', () => new CylinderGeometry(0.3, 0.3, 4, 10, 4, false), { color: '#8a7a5a', m: trs(0, 4, 0, 0, 0, Math.PI / 2, 1, 1, 0.8), jitter: 0.04, jitterFreq: 1.6, renormal: true, ao: 0.15, dirt: 0 });
    add('stone', () => new SphereGeometry(1, 10, 7), { color: 0x6a5a48, m: trs(2, 0.5, 2, 0, 0, 0, 0.8, 0.5, 0.8), jitter: 0.05, renormal: true, vary: 0.12 }, prim(SphereGeometry, 1, 10, 7));
    add('wood', lathe, { color: '#6a5a48', m: trs(-2, 0, 0), jitter: 0.02, shade: (p, _n, c) => c.multiplyScalar(0.85 + 0.15 * Math.min(1, p.y)) });
    add('metal', () => new TorusGeometry(0.4, 0.03, 5, 12), { color: '#33302c', m: trs(0, 0.6, 1, Math.PI / 2, 0, 0), ao: 0, dirt: 0 });
    add('wood', custom, { color: new Color('#806040'), m: trs(0.5, 0, 0.5, 0, 1, 0) });
    add('leaves', cards, { color: '#4f5a33', keepUv: true, vary: 0, noise: 0.08, noiseFreq: 0.5, shade: (p, _n, c) => { if (p.y > 1.5) c.set('#5d6a3a'); } });
    add('wood', () => new BoxGeometry(0.5, 0.5, 0.5), { color: '#5b4b3b', keepUv: true, m: new Matrix4() }, prim(BoxGeometry, 0.5, 0.5, 0.5));
    add('wood', () => new BoxGeometry(0.5, 0.5, 0.5), { color: '#5b4b3b' }, prim(BoxGeometry, 0.5, 0.5, 0.5));
  }, 'mixed');
  // a rigged model (the horse): pieces without a rig get zeros
  both({ seed: 9 }, (add) => {
    add('hide', () => new SphereGeometry(1, 12, 8), { color: '#6b4a32', m: trs(0, 1.2, 0, 0, 0, 0, 0.5, 0.45, 1.1), rig: (p) => [p.z > 0 ? 1 : 0, 0.5, p.y, 0] });
    add('hide', () => new CylinderGeometry(0.08, 0.1, 0.9, 6), { color: '#6b4a32', m: trs(0.2, 0.45, 0.6) });
  }, 'rigged');
});

test('part builder: shared templates are never written, a big piece takes a 32-bit index', () => {
  const t = prim(BoxGeometry, 2, 1, 1, 3, 2, 2);
  const before = [...t.getAttribute('position').array, ...t.getAttribute('normal').array, ...t.getAttribute('uv').array, ...t.index!.array].join(',');
  const b = new PartBuilder({ seed: 2 });
  b.add('stone', t, { color: '#7b766b', m: trs(1, 2, 3, 0.2, 0.3, 0.4), jitter: 0.1, renormal: true, shade: (_p, _n, c) => c.set('#808080') });
  b.add('stone', t, { color: '#7b766b', jitter: 0.1 });
  b.build();
  eq([...t.getAttribute('position').array, ...t.getAttribute('normal').array, ...t.getAttribute('uv').array, ...t.index!.array].join(','), before, 'template unchanged');
  eq(prim(BoxGeometry, 2, 1, 1, 3, 2, 2) === t, true, 'one template per argument list');
  both({ seed: 4 }, (add) => {
    add('stone', () => new SphereGeometry(1, 200, 180), { color: '#7b766b', jitter: 0.01 });
    add('stone', () => new SphereGeometry(1, 40, 30), { color: '#7b766b', m: trs(3, 0, 0) });
  }, 'big');
});

test('part builder: models still build (castle, woodcutter, spruce, bush)', () => {
  for (const k of ['castle', 'woodcutter'] as const) eq(buildingModel(k).parts.length > 0, true, k);
  for (const k of ['spruce', 'bush'] as const) eq(treeParts(k).length > 0, true, k);
});
