// Render #5 (research 2026-11-05): InstancedMesh users draw a mirror of each kind's material. The mirror must keep
// the program-relevant state of its base through every change made by the materials module.
import { DataTexture } from 'three';
import { applyTextures, instancedMaterial, materialsFor, mirrorDrift, modelMaterial, texturedVariant } from '../src/render/models/materials';
import { assert, eq, test } from './harness';

test('materials: instanced mirror shares hooks and key, follows applyTextures', () => {
  const base = modelMaterial('wood'), im = instancedMaterial('wood');
  assert(im !== base, 'a separate material');
  eq(im, instancedMaterial('wood'), 'one mirror per kind');
  eq(im.customProgramCacheKey, base.customProgramCacheKey, 'same program cache key');
  eq(im.onBeforeCompile, base.onBeforeCompile, 'same shader hook');
  eq(materialsFor('wood').length, 2, 'pre-warm sees both');
  const t = new DataTexture(new Uint8Array(4), 1, 1);
  const v0 = im.version;
  applyTextures('wood', { normalMap: t, roughnessMap: t });
  eq(im.normalMap, t, 'normal map mirrored');
  eq(im.roughnessMap, t, 'roughness map mirrored');
  assert(im.version > v0, 'mirror marked for update');
  const tv = texturedVariant('wood', { normalMap: null });
  eq(tv.customProgramCacheKey, base.customProgramCacheKey, 'variant keyed like both');
  applyTextures('wood', { normalMap: null, roughnessMap: null });
  eq(im.normalMap, null, 'removal mirrored');
  // grass has its own hooks (foliage lift): the mirror keeps them
  const g = instancedMaterial('grass');
  eq(g.customProgramCacheKey, modelMaterial('grass').customProgramCacheKey, 'hooked kind keeps its key');
});

// (leaf/needle kinds build canvas textures, so the tree-quality switch is covered by the browser pixel run)
test('materials: mirrors never drift (creation, textures); billboard has no mirror', () => {
  for (const k of ['wood', 'cloth', 'hide', 'metal', 'stone', 'skin', 'bark'] as const) instancedMaterial(k);
  eq(mirrorDrift().join(','), '', 'in sync after creation');
  const t = new DataTexture(new Uint8Array(4), 1, 1);
  applyTextures('stone', { normalMap: t, roughnessMap: t });
  eq(mirrorDrift().join(','), '', 'in sync after textures');
  let threw = false;
  try { instancedMaterial('billboard'); } catch { threw = true; }
  assert(threw, 'billboard refuses a mirror (the impostor bake writes it outside the module)');
});
