// Research 2026-11-05 rebuilds (frame-cost day 9 item #1): the last program-parameter rebuilds per render.
// Shadow pass: instanced casters draw their own shared depth material instead of WebGLShadowMap's shared one.
// Grass: the tufts (instanceColor) draw a colour mirror of model-grass, the reeds (no instanceColor) the base.
import { DataTexture, InstancedMesh, BoxGeometry, MeshDepthMaterial, MeshStandardMaterial, RGBADepthPacking } from 'three';
import { applyTextures, instancedDepthMaterial, instancedMaterial, materialsFor, mirrorDrift, modelMaterial, shareInstancedDepth } from '../src/render/models/materials';
import { assert, eq, test } from './harness';

test('rebuilds: instanced depth material matches the shadow map one (packing), is shared and named', () => {
  const d = instancedDepthMaterial();
  eq(d, instancedDepthMaterial(), 'one material for every instanced caster');
  eq(d.depthPacking, new MeshDepthMaterial({ depthPacking: RGBADepthPacking }).depthPacking, 'same packing as WebGLShadowMap._depthMaterial');
  eq(d.name, 'instanced-depth', 'named (research tools find it)');
});

test('rebuilds: shareInstancedDepth only for casters that would draw the shared depth material', () => {
  const g = new BoxGeometry(1, 1, 1);
  const plain = new InstancedMesh(g, instancedMaterial('wood'), 2);
  shareInstancedDepth(plain);
  eq(plain.customDepthMaterial, instancedDepthMaterial(), 'opaque kind gets it');
  const alpha = new MeshStandardMaterial({ map: new DataTexture(new Uint8Array(4), 1, 1), alphaTest: 0.5 });
  const leaf = new InstancedMesh(g, alpha, 2);
  shareInstancedDepth(leaf);
  eq(leaf.customDepthMaterial, undefined, 'alpha-tested map keeps the per-material depth clone');
  const a2c = new InstancedMesh(g, new MeshStandardMaterial({ alphaToCoverage: true }), 2);
  shareInstancedDepth(a2c);
  eq(a2c.customDepthMaterial, undefined, 'alpha to coverage keeps the per-material depth clone');
  const own = new MeshDepthMaterial();
  const horse = new InstancedMesh(g, instancedMaterial('hide'), 2);
  horse.customDepthMaterial = own;
  shareInstancedDepth(horse);
  eq(horse.customDepthMaterial, own, 'an own custom depth material is kept');
});

test('rebuilds: grass colour mirror is separate, keyed and hooked like the base, follows textures', () => {
  const base = modelMaterial('grass'), c = instancedMaterial('grass', true);
  assert(c !== base && c !== instancedMaterial('grass'), 'separate from the base and the plain mirror');
  eq(c, instancedMaterial('grass', true), 'one colour mirror per kind');
  eq(c.name, 'model-grass-inst-color', 'named');
  eq(c.customProgramCacheKey, base.customProgramCacheKey, 'same program cache key');
  eq(c.onBeforeCompile, base.onBeforeCompile, 'same shader hook');
  assert(materialsFor('grass').includes(c), 'pre-warm (texture swap) sees the colour mirror');
  const t = new DataTexture(new Uint8Array(4), 1, 1);
  applyTextures('grass', { normalMap: t });
  eq(c.normalMap, t, 'texture mirrored');
  eq(mirrorDrift().join(','), '', 'no drift');
  applyTextures('grass', { normalMap: null });
  eq(c.normalMap, null, 'removal mirrored');
  eq(mirrorDrift().join(','), '', 'no drift after removal');
});
