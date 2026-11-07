// D-330: `prim` templates (D-320) live for the whole session, keyed by their constructor arguments. Sizes that follow
// the world (slope under a building, bridge length) or random radii must use a one-off geometry instead, or every
// building / bridge / floe ever placed keeps a template (D-328 plinth, D-330 bridge ice). Guard: the model catalogue
// adds no templates when built a second time, and no view module (world-driven code) calls `prim`.
import { readdirSync, readFileSync } from 'node:fs';
import { primCount } from '../src/render/models/kit';
import { buildingModel, BUILDING_KINDS, castleUpgradeParts, propParts, PROP_KINDS, tradePostClosedParts, tradePostOpenParts } from '../src/render/models/buildings';
import { treeBillboard, treeParts, TREE_KINDS, TREE_VARIANTS } from '../src/render/models/trees';
import { wagonLod1, wagonModel } from '../src/render/models/wagon';
import { CARGO_GOODS, cargoUnitParts } from '../src/render/models/cargo';
import { bridgeEndParts, bridgeParts } from '../src/render/models/bridges';
import { assert, eq, test } from './harness';

function buildCatalogue(): void {
  for (const k of TREE_KINDS) { for (let v = 0; v < TREE_VARIANTS; v++) treeParts(k, v); treeBillboard(k); }
  for (const t of BUILDING_KINDS) buildingModel(t);
  castleUpgradeParts(); tradePostOpenParts(); tradePostClosedParts();
  for (const p of PROP_KINDS) propParts(p);
  for (const g of CARGO_GOODS) cargoUnitParts(g);
  for (const k of ['wood', 'stone'] as const) { bridgeParts(k); bridgeEndParts(k); }
  wagonModel(); wagonModel('mid'); wagonLod1();
}

test('prim guard: a second build of the model catalogue adds no shared templates', () => {
  buildCatalogue();
  const first = primCount();
  assert(first > 0, 'catalogue uses prim templates');
  buildCatalogue();
  eq(primCount(), first, 'template count after a second catalogue build');
});

test('prim guard: world-driven view modules do not call prim', () => {
  const dir = 'src/render';
  const views = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  const bad = views.filter((f) => /\bprim\(/.test(readFileSync(`${dir}/${f}`, 'utf8')));
  eq(bad.join(','), '', 'src/render/*.ts files calling prim (use a one-off geometry for world-dependent sizes)');
});
