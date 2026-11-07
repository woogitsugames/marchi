// Perf day 14 (D-310): RoadField.rebuild encodes only the texel spans its segments swept and starts the rest as 255.
// The reference is the replaced full encode of every texel from the same distance fields; compared byte for byte,
// on several worlds and after roads are removed (texels a previous rebuild wrote must come back to 255).
import { createWorld, type World } from '../src/sim/index';
import { menuWorld } from '../src/game/menuScene';
import { RoadField, ROAD_MAXD } from '../src/render/roads';
import { eq, test, assert } from './harness';

function refEncode(r: RoadField): Uint8Array {
  const n = r.tw * r.th, dd = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    dd[i * 4] = Math.round((r.dirt[i]! / ROAD_MAXD) * 255);
    dd[i * 4 + 1] = Math.round((r.cobble[i]! / ROAD_MAXD) * 255);
    dd[i * 4 + 2] = Math.round((r.junc[i]! / ROAD_MAXD) * 255);
    dd[i * 4 + 3] = 255;
  }
  return dd;
}

function check(r: RoadField, what: string): void {
  const got = (r as unknown as { data: Uint8Array }).data, ref = refEncode(r);
  eq(got.length, ref.length, `${what}: length`);
  for (let i = 0; i < ref.length; i++) if (got[i] !== ref[i]) throw new Error(`${what}: byte ${i} ${got[i]} != ${ref[i]}`);
}

test('road mask identity: span encode equals the full encode (menu, missions, free valley, roads removed)', () => {
  const worlds: [string, () => World][] = [
    ['menu', menuWorld], ['m1', () => createWorld('m1')], ['m2', () => createWorld('m2')], ['m7', () => createWorld('m7')],
    ['m12', () => createWorld('m12')], ['m16', () => createWorld('m16')], ['sandbox:7', () => createWorld('sandbox', 7)],
  ];
  for (const [name, mk] of worlds) {
    const w = mk();
    const r = new RoadField(w.terrain.w, w.terrain.h);
    r.rebuild(w);
    check(r, name);
    // drop every other road cell and rebuild into the same field: the old texels must be re-encoded too
    const roads = w.state.roads;
    let had = 0;
    for (let i = 0; i < roads.length; i++) if (roads[i]! > 0) { had++; if (had % 2) roads[i] = 0; }
    assert(had > 0, `${name}: has roads`);
    r.rebuild(w);
    check(r, `${name} after removing roads`);
    for (let i = 0; i < roads.length; i++) roads[i] = 0;
    r.rebuild(w);
    check(r, `${name} without roads`);
  }
});
