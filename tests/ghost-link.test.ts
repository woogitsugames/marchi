// Day 9j: the build ghost's access-road estimate equals the link the building sheet offers once the building
// stands (BACKLOG P3 day 9h, D-177), and a site refused for cutting a diagonal road step says so (D-176).
import { BUILDINGS, createWorld, gateCell, suggestLinkForSite, suggestLinkToStable, validatePlace, type BuildingType, type World } from '../src/sim/index';
import { place } from '../src/sim/commands';
import { blockedWhy } from '../src/ui/site';
import { assert, eq, test } from './harness';

function footprint(w: World, x: number, y: number, type: BuildingType): number[] {
  const def = BUILDINGS[type], out: number[] = [];
  for (let yy = y; yy < y + def.h; yy++) for (let xx = x; xx < x + def.w; xx++) out.push(yy * w.terrain.w + xx);
  return out;
}

/** A road cell 8-adjacent to the gate outside the footprint (the ghost then shows no access road). */
function gateTouchesRoad(w: World, gate: number, foot: Set<number>): boolean {
  const W = w.terrain.w, gx = gate % W, gy = (gate - gx) / W;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = gx + dx, y = gy + dy;
    if ((dx || dy) && x >= 0 && y >= 0 && x < W && y < w.terrain.h && !foot.has(y * W + x) && w.state.roads[y * W + x]) return true;
  }
  return false;
}

for (const [mission, type] of [['m1', 'woodcutter'], ['m3', 'farm'], ['sandbox', 'sawmill']] as const) {
  test(`ghost access road = the sheet's link after placing (${mission}, ${type})`, () => {
    const base = createWorld(mission);
    const def = BUILDINGS[type], W = base.terrain.w, H = base.terrain.h;
    let compared = 0, linked = 0;
    for (let y = 2; y < H - def.h - 2 && compared < 40; y += 5) {
      for (let x = 2; x < W - def.w - 2 && compared < 40; x += 5) {
        for (let facing = 0; facing < 4; facing += 2) {
          if (!validatePlace(base, type, x, y, facing, true).ok) continue;
          const gate = gateCell(base, x, y, def.w, def.h, facing);
          const foot = footprint(base, x, y, type);
          if (gateTouchesRoad(base, gate, new Set(foot))) continue;
          const ghost = suggestLinkForSite(base, type, gate, foot);
          const w = createWorld(mission);
          const r = place(w, type, x, y, facing, true);
          assert(r.ok, 'placed');
          const b = w.state.buildings[w.state.buildings.length - 1]!;
          const sheet = suggestLinkToStable(w, b.id);
          eq(ghost?.cost ?? -1, sheet?.cost ?? -1, `cost at ${x},${y} f${facing}`);
          eq(JSON.stringify(ghost?.newCells ?? null), JSON.stringify(sheet?.newCells ?? null), `cells at ${x},${y} f${facing}`);
          compared++;
          if (sheet) linked++;
        }
      }
    }
    assert(compared >= 10 && linked >= 5, `enough sites compared (${compared}, ${linked} with a link)`);
  });
}

test('a ghost refused for cutting a diagonal road step names the road, not a building (D-176)', () => {
  const w = createWorld('sandbox');
  const W = w.terrain.w;
  let site: { x: number; y: number } | null = null;
  for (let y = 6; y < w.terrain.h - 8 && !site; y++) for (let x = 6; x < W - 8 && !site; x++) {
    if (!validatePlace(w, 'farm', x, y, 0, true).ok) continue;
    // a dry, free, flat ring (the diagonal step must be drivable)
    let ok = true;
    for (let yy = y - 2; yy <= y + 4 && ok; yy++) for (let xx = x - 2; xx <= x + 4 && ok; xx++) {
      const i = yy * W + xx;
      if (w.terrain.water[i] || w.state.roads[i] || Math.abs(w.terrain.cellH[i]! - w.terrain.cellH[y * W + x]!) > 0.5) ok = false;
    }
    if (ok && !w.state.buildings.some((b) => b.x < x + 6 && x < b.x + b.w + 3 && b.y < y + 6 && y < b.y + b.h + 3)) site = { x, y };
  }
  assert(!!site, 'a site');
  const { x, y } = site!;
  w.state.roads[(y - 1) * W + x] = 1;
  w.state.roads[y * W + x - 1] = 1;
  w.state.netVersion++;
  const r = validatePlace(w, 'farm', x, y, 0, true);
  if (r.ok || r.err.k !== 'BLOCKED') { assert(false, `expected BLOCKED: ${JSON.stringify(r)}`); return; }
  const def = BUILDINGS.farm;
  const gate = gateCell(w, x, y, def.w, def.h, 0);
  eq(blockedWhy(w, r.err.cell, gate, new Set(footprint(w, x, y, 'farm')), [x, y, def.w, def.h]), 'cutsRoad', 'the specific reason');
  // an ordinary building in the way keeps the old reason
  const castle = w.state.buildings.find((b) => b.type === 'castle')!;
  const c0 = castle.y * W + castle.x;
  eq(blockedWhy(w, c0, -1, new Set([c0]), [castle.x, castle.y, def.w, def.h]), 'building', 'a building cell');
});
