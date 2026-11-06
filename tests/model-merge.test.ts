// Startup model merge (D-255) and lazy instanced parts (D-256): the fast merge must give three's mergeGeometries
// result bit for bit, and lazily built parts must not dispose the shared cached models.
import { BoxGeometry, BufferGeometry, CylinderGeometry, Group, Matrix4, SphereGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Parts } from '../src/render/instancedParts';
import { mergeIndexed, PartBuilder, trs } from '../src/render/models/kit';
import { cargoUnitParts } from '../src/render/models/cargo';
import { assert, eq, test } from './harness';

const sameGeometry = (a: BufferGeometry, b: BufferGeometry, what: string): void => {
  eq(Object.keys(a.attributes).join(','), Object.keys(b.attributes).join(','), `${what}: attribute names`);
  for (const k of Object.keys(a.attributes)) {
    const x = a.attributes[k]!.array, y = b.attributes[k]!.array;
    eq(x.constructor.name, y.constructor.name, `${what}: ${k} array type`);
    eq(x.length, y.length, `${what}: ${k} length`);
    for (let i = 0; i < x.length; i++) if (!Object.is(x[i], y[i])) throw new Error(`${what}: ${k}[${i}] ${x[i]} != ${y[i]}`);
  }
  const ia = a.index!.array, ib = b.index!.array;
  eq(ia.constructor.name, ib.constructor.name, `${what}: index type`);
  eq(ia.join(','), ib.join(','), `${what}: index`);
};

test('model merge: mergeIndexed with transforms equals mergeGeometries of transformed clones', () => {
  const b = new PartBuilder({ seed: 5 });
  b.add('wood', new BoxGeometry(1, 2, 3, 2, 2, 2), { color: '#806040', jitter: 0.03 });
  b.add('wood', new CylinderGeometry(0.3, 0.4, 2, 9), { color: '#806040', m: trs(1, 1, 0, 0.2, 0.4, 0) });
  const parts = b.build();
  const g = parts[0]!.geometry;
  const mats = [trs(3, 0.5, -2, 0, 1.1, 0, 1.3, 1, 0.8), new Matrix4().makeRotationY(2.2).setPosition(-7, 1, 4), new Matrix4()];
  const geos = [g, g, g];
  const ref = mergeGeometries(geos.map((x, i) => x.clone().applyMatrix4(mats[i]!)), false)!;
  sameGeometry(mergeIndexed(geos, mats), ref, 'transformed');
  sameGeometry(mergeIndexed(geos), mergeGeometries(geos, false)!, 'plain');
});

test('model merge: index width follows three (Uint32 from 65535 vertices)', () => {
  const big = new SphereGeometry(1, 255, 130); // 33 670 vertices
  const two = mergeIndexed([big, big]);
  eq(two.index!.array.constructor.name, mergeGeometries([big, big], false)!.index!.array.constructor.name, 'index type');
  assert(two.index!.array instanceof Uint32Array, '67 340 vertices need 32-bit indices');
  eq(mergeIndexed([big]).index!.array.constructor.name, 'Uint16Array', 'one sphere fits 16-bit');
});

test('lazy parts: built on first push, disposing keeps the shared cached model', () => {
  const group = new Group();
  const p = new Parts(() => cargoUnitParts('wood'), 8, group, 'cargo-test');
  assert(!p.ready && group.children.length === 0, 'nothing built before use');
  p.begin(); p.end();
  assert(!p.ready, 'an empty frame builds nothing');
  p.begin(); p.push(new Matrix4()); p.end();
  assert(p.ready && group.children.length === cargoUnitParts('wood').length, 'built on the first push');
  let disposed = 0;
  for (const part of cargoUnitParts('wood')) part.geometry.addEventListener('dispose', () => disposed++);
  p.dispose();
  eq(group.children.length, 0, 'meshes removed');
  eq(disposed, 0, 'the cached cargo model is not disposed');
  assert(cargoUnitParts('wood') === cargoUnitParts('wood'), 'cargo unit model is cached');
  // geometries made by `geo` belong to the parts
  let own = 0;
  const q = new Parts(cargoUnitParts('wood'), 4, group, 'cargo-own', undefined, (g) => { const c = g.clone(); c.addEventListener('dispose', () => own++); return c; });
  q.dispose();
  eq(own, cargoUnitParts('wood').length, 'per-view copies are disposed');
});
