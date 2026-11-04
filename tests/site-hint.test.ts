// D-107 (night 6b): the build ghost a "Naprawa" opens starts on the mission's authored site (mission data,
// no sim special case); when that site is taken it falls back to the closest free site by the building.
import { applyCommand, createWorld, missionSiteHint, stateHash, validatePlace } from '../src/sim/index';
import { M10_SECOND_WOODCUTTER } from '../src/sim/proposals/missions-10-12';
import { buildSite } from '../src/ui/site';
import { assert, eq, test } from './harness';

test('site hint: X second woodcutter ghost starts on the authored site, falls back when it is taken', () => {
  const w = createWorld('m10');
  const h0 = stateHash(w);
  const first = w.state.buildings.find((b) => b.type === 'woodcutter')!;
  const s = buildSite(w, 'woodcutter', first.id)!;
  eq(`${s.x},${s.y},${s.facing},${s.hint}`, `${M10_SECOND_WOODCUTTER.x},${M10_SECOND_WOODCUTTER.y},${M10_SECOND_WOODCUTTER.facing},true`, 'authored site');
  eq(stateHash(w), h0, 'read-only');
  eq(applyCommand(w, { t: 'place', type: 'woodcutter', ...M10_SECOND_WOODCUTTER }).ok, true, 'authored site is placeable');
  const s2 = buildSite(w, 'woodcutter', first.id)!;
  eq(s2.hint, false, 'taken: no hint');
  assert(validatePlace(w, 'woodcutter', s2.x, s2.y, s2.facing).ok, 'fallback site is valid');
});

test('site hint: only where authored (IX/X woodcutter; the VII fisher removed by the owner); none for other types or missions', () => {
  assert(missionSiteHint('m7', 'fisher') === null && missionSiteHint('m9', 'woodcutter') !== null && missionSiteHint('m10', 'woodcutter') !== null, 'authored');
  eq(missionSiteHint('m10', 'warehouse'), null, 'other type');
  eq(missionSiteHint('m6', 'warehouse'), null, 'other mission');
});
