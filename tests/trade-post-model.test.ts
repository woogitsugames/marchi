// The trading post's model (D-170): within budget, existing materials only (it merges into the buildings' draw calls).
import { BUILDING_KINDS, buildingModel, tradePostClosedParts, tradePostOpenParts } from '../src/render/models/buildings';
import { triangles } from '../src/render/models/kit';
import { assert, test } from './harness';

const MATS = new Set(['wood', 'stone', 'plaster', 'metal', 'cloth', 'bark', 'thatch']);
const tris = triangles;

test('trade post model: base <= 8000 triangles, overlays <= 1500, existing materials, no workers or piles', () => {
  assert(BUILDING_KINDS.includes('tradePost'), 'a building kind');
  const m = buildingModel('tradePost');
  assert(m.kind === 'tradePost', 'its own model, not the fallback');
  const base = tris(m.parts), closed = tris(tradePostClosedParts()), open = tris(tradePostOpenParts());
  assert(base + closed <= 8000, `base + shutters: ${base + closed} triangles`);
  assert(open <= 1500, `open overlay: ${open} triangles`);
  for (const p of [...m.parts, ...tradePostClosedParts(), ...tradePostOpenParts()]) assert(MATS.has(p.material), `material ${p.material}`);
  assert(!m.workers?.length && !m.piles?.length && !m.yard, 'no workers, no piles');
  console.log(`    trade post: base ${base}, shutters ${closed}, open ${open} triangles`);
});
