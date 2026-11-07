// Prebaked model catalogue (D-331): the build bakes every catalogue model into a binary file that the game decodes
// instead of building them. These tests hold the file to what the model code builds:
//  - the bake in a fresh process, checked by a second fresh process (`tools/bake-models.ts --check`): the same bytes
//    again (the bake is deterministic, so the file the build emits is the code's), and decode + encode gives the
//    same bytes (the decoder drops nothing the encoder stored);
//  - in process: decoded models equal the built ones field by field (Object.is on every number and array element,
//    Vector3 stays Vector3, geometries shared between models stay shared, undefined fields stay present).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { bakedOr, decodeAllBaked, encodeBakedModels, installBakedModels } from '../src/render/models/baked';
import { buildingModel } from '../src/render/models/buildings';
import { workerBody, workerRig } from '../src/render/models/people';
import { treeBillboard, treeParts } from '../src/render/models/trees';
import { wagonLod1, wagonModel } from '../src/render/models/wagon';
import { assert, eq, test } from './harness';

const root = fileURLToPath(new URL('..', import.meta.url));

test('the bake is deterministic and its file decodes to the same bytes (fresh processes)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'baked-test-'));
  try {
    const file = join(dir, 'models.bin');
    const run = (args: string[]) => execFileSync(process.execPath, ['--import', 'tsx', 'tools/bake-models.ts', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    run([file]);
    const out = run(['--check', file]); // exits 1 (throws here) when the bytes differ
    assert(out.includes('matches the code'), out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Deep equality with Object.is on numbers and typed-array elements; geometry identity mapped built -> decoded. */
function same(a: unknown, b: unknown, path: string, geos: Map<BufferGeometry, BufferGeometry>): void {
  if (typeof a === 'number') { assert(Object.is(a, b), `${path}: ${String(b)} != ${a}`); return; }
  if (a === null || typeof a !== 'object') { eq(b, a, path); return; }
  assert(b !== null && typeof b === 'object', `${path}: missing`);
  if (a instanceof Vector3) { assert(b instanceof Vector3, `${path}: not a Vector3`); for (const k of ['x', 'y', 'z'] as const) same(a[k], (b as Vector3)[k], `${path}.${k}`, geos); return; }
  if (a instanceof BufferGeometry) {
    assert(b instanceof BufferGeometry, `${path}: not a geometry`);
    const seen = geos.get(a);
    if (seen) { assert(seen === b, `${path}: a shared geometry decoded twice`); return; }
    geos.set(a, b as BufferGeometry);
    const g = b as BufferGeometry;
    eq(Object.keys(g.attributes).join(), Object.keys(a.attributes).join(), `${path} attribute order`);
    const attrs: [string, BufferAttribute | null, BufferAttribute | null][] = [['index', a.index, g.index]];
    for (const n of Object.keys(a.attributes)) attrs.push([n, a.getAttribute(n) as BufferAttribute, g.getAttribute(n) as BufferAttribute]);
    for (const [n, x, y] of attrs) {
      if (!x) { assert(!y, `${path}.${n}: extra`); continue; }
      assert(y, `${path}.${n}: missing`);
      eq(y.array.constructor, x.array.constructor, `${path}.${n} type`);
      eq(y.itemSize, x.itemSize, `${path}.${n} itemSize`);
      eq(y.normalized, x.normalized, `${path}.${n} normalized`);
      eq(y.array.length, x.array.length, `${path}.${n} length`);
      for (let i = 0; i < x.array.length; i++) if (!Object.is(x.array[i], y.array[i])) assert(false, `${path}.${n}[${i}]: ${y.array[i]} != ${x.array[i]}`);
    }
    for (const k of ['boundingBox', 'boundingSphere'] as const) {
      eq(g[k] === null, a[k] === null, `${path}.${k} presence`);
    }
    if (a.boundingBox) { same(a.boundingBox.min, g.boundingBox!.min, `${path}.bb.min`, geos); same(a.boundingBox.max, g.boundingBox!.max, `${path}.bb.max`, geos); }
    if (a.boundingSphere) { same(a.boundingSphere.center, g.boundingSphere!.center, `${path}.bs.c`, geos); same(a.boundingSphere.radius, g.boundingSphere!.radius, `${path}.bs.r`, geos); }
    eq(JSON.stringify(g.userData), JSON.stringify(a.userData), `${path}.userData`);
    return;
  }
  if (Array.isArray(a)) {
    assert(Array.isArray(b), `${path}: not an array`);
    eq((b as unknown[]).length, a.length, `${path} length`);
    a.forEach((x, i) => same(x, (b as unknown[])[i], `${path}[${i}]`, geos));
    return;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  eq(kb.join(), ka.join(), `${path} keys`);
  for (const k of ka) same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`, geos);
}

test('decoded models equal the built ones (numbers, arrays, vectors, shared geometry, undefined fields)', () => {
  const built = new Map<string, unknown>([
    ['building:mill', buildingModel('mill')], // wheel parts and pivot, smoke, workers
    ['building:farm', buildingModel('farm')], // field worker, undefined fields
    ['tree:oak:1', treeParts('oak', 1)],
    ['billboard:pine', treeBillboard('pine')], // bounding sphere without a box
    ['wagon:near', wagonModel('near')],
    ['wagon:mid', wagonModel('mid')], // its body is the near body's geometry
    ['wagonLod1', wagonLod1()],
    ['workerBody:2', workerBody(2)],
    ['workerRig:chop:2', workerRig('chop', 2)], // legs and torso shared with workerBody(2); non-indexed merged arms
    ['odd', { neg: -0, nan: NaN, inf: -Infinity, u: undefined, v: new Vector3(-0, 1e-300, 2 ** 53), s: 'x', b: true, n: null }],
  ]);
  try {
    const file = encodeBakedModels(built);
    eq(installBakedModels(file.buffer.slice(0) as ArrayBuffer), built.size, 'models in the file');
    const decoded = decodeAllBaked();
    const geos = new Map<BufferGeometry, BufferGeometry>();
    for (const [k, v] of built) same(v, decoded.get(k), k, geos);
    // the catalogue answers bakedOr without building, and a key it does not hold is built
    eq(bakedOr('building:mill', () => { throw new Error('built'); }), decoded.get('building:mill'), 'bakedOr returns the decoded model');
    eq(bakedOr('not-there', () => 7), 7, 'a key not in the file is built');
    // shared geometry stays shared
    const near = decoded.get('wagon:near') as ReturnType<typeof wagonModel>, mid = decoded.get('wagon:mid') as ReturnType<typeof wagonModel>;
    assert(near.body[0]!.geometry === mid.body[0]!.geometry, 'near and mid body share their geometry');
    // and decoding again re-encodes to the same bytes
    const again = encodeBakedModels(decoded);
    assert(again.length === file.length && again.every((x, i) => x === file[i]), 'decode + encode gives the same bytes');
  } finally {
    installBakedModels(null);
  }
});

test('a geometry the catalogue cannot hold is refused at bake time', () => {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
  g.addGroup(0, 3, 0);
  let msg = '';
  try { encodeBakedModels(new Map([['g', [{ geometry: g, material: 'wood' }]]])); } catch (e) { msg = (e as Error).message; }
  assert(msg.includes('groups'), `refused: ${msg}`);
  let msg2 = '';
  try { encodeBakedModels(new Map([['m', new Map()]])); } catch (e) { msg2 = (e as Error).message; }
  assert(msg2.includes('cannot store'), `refused: ${msg2}`);
});
