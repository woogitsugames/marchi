// Research prototype of missions XIV-XV (2026-11-06, docs/research/2026-11-06-missions-14-15.md): the data stays out of
// MISSIONS and the menu; every test registers the two missions and takes them out again, so the tests that walk
// MISSIONS (golden hashes, saves) keep seeing the game's list.
import { MISSIONS, checkInvariants, createWorld, findPath } from '../src/sim/index';
import {
  M14_BURNER_SITE, M15_GRANARY_SITE, registerMissions1415, unregisterMissions1415,
} from '../src/sim/proposals/missions-14-15';
import { LESSON, WRONG, eyePlayer, run } from '../tools/balance-night6';
import { lessonPlayer } from '../tools/m8-ladder';
import { buildSite } from '../src/ui/site';
import { readFileSync } from 'node:fs';
import { assert, eq, test } from './harness';

function withMissions(fn: () => void): void {
  registerMissions1415();
  try { fn(); } finally { unregisterMissions1415(); }
}

const lesson = (id: string, k: number, at: number) => { const a = {}; return run(id, 'lesson', lessonPlayer(k, at, LESSON[id]!, a), a); };
const wrong = (id: string, k: number, at: number) => { const a = {}; return run(id, 'wrong', lessonPlayer(k, at, WRONG[id]!, a), a); };
const wagons = (id: string, k: number) => { const a = {}; return run(id, 'wagons', lessonPlayer(k, 0, null, a), a); };
const eye = (id: string, s: number) => { const a = {}, seen = {}; return run(id, 'eye', eyePlayer(s, true, a, seen), a, seen); };

test('m14-m15: research data only — not registered, not in the menu', () => {
  eq('m14' in MISSIONS, false, 'm14 not in MISSIONS');
  eq('m15' in MISSIONS, false, 'm15 not in MISSIONS');
  const menu = readFileSync(new URL('../src/ui/menu.ts', import.meta.url), 'utf8');
  assert(!/'m14'|'m15'/.test(menu), 'not in the menu');
  withMissions(() => {
    for (const id of ['m14', 'm15']) {
      const w = createWorld(id);
      eq(w.state.mapId, 'valley-m3', id + ' reuses the dry valley');
      eq(checkInvariants(w).length, 0, id + ' initial goods are conserved');
      const castle = w.state.buildings.find((b) => b.type === 'castle')!;
      for (const b of w.state.buildings) if (b !== castle) assert(findPath(w, b.gate, castle.gate, true), `${id}: ${b.type} reaches the castle`);
    }
  });
  eq('m14' in MISSIONS, false, 'taken out again');
});

test('m14: the build ghost starts at the forest site; the pace card asks for a burner by 1:10', () => {
  withMissions(() => {
    const w = createWorld('m14');
    const burner = w.state.buildings.find((b) => b.type === 'charcoalBurner')!;
    const s = buildSite(w, 'charcoalBurner', burner.id)!;
    assert(s.hint && s.x === M14_BURNER_SITE.x && s.y === M14_BURNER_SITE.y, 'ghost at the authored site by the woodcutters');
    const r = eye('m14', 10);
    assert((r.seen!['pace:producer -> producer:charcoalBurner'] ?? 0) >= 1, 'the eye player follows the producer card');
  });
});

test('m14: ladder — nothing and wagons 1 seal, burner by the castle at most 2, by the forest 3 with margin', () => {
  withMissions(() => {
    const p = run('m14', 'passive', () => {});
    eq(p.seals, 1, 'passive');
    for (const k of [1, 3]) eq(wagons('m14', k).seals, 1, `wagons-${k}`);
    for (const k of [0, 1]) for (const at of [0, 60, 120]) assert(wrong('m14', k, at).seals <= 2, `burner by the castle +${k}w @${at}s <= 2 seals`);
    const l = lesson('m14', 0, 0);
    assert(l.seals === 3 && l.m3 >= 20, `burner by the forest @0:00: 3 seals with >= 20 s (${l.m3.toFixed(0)} s)`);
    assert(lesson('m14', 0, 60).seals === 3, 'burner by the forest @1:00: 3 seals');
    eq(eye('m14', 10).seals, 3, 'reasonable player every 10 s');
    for (const s of [30, 60]) assert(eye('m14', s).seals >= 2, `reasonable player every ${s} s >= 2 seals`);
  });
});

test('m15: the full seed granary is the first card (cure: granary) and the ghost starts by the castle', () => {
  withMissions(() => {
    const r = eye('m15', 10);
    assert((r.seen!['warehouse:STORAGE_FULL -> granary'] ?? 0) >= 1, 'the card names the full granary and offers a granary');
    const w = createWorld('m15');
    const small = w.state.buildings.find((b) => b.type === 'warehouse')!;
    const s = buildSite(w, 'warehouse', small.id)!;
    assert(s.hint && s.x === M15_GRANARY_SITE.x && s.y === M15_GRANARY_SITE.y, 'ghost at the authored site by the castle');
  });
});

test('m15: ladder — nothing and wagons 1 seal, granary by the woodcutters at most 2, by the castle 3 with margin', () => {
  withMissions(() => {
    eq(run('m15', 'passive', () => {}).seals, 1, 'passive');
    eq(wagons('m15', 2).seals, 1, 'wagons-2');
    for (const k of [0, 1]) for (const at of [0, 60, 120]) assert(wrong('m15', k, at).seals <= 2, `granary by the woodcutters +${k}w @${at}s <= 2 seals`);
    const l = lesson('m15', 0, 0);
    assert(l.seals === 3 && l.m3 >= 20, `granary by the castle @0:00: 3 seals with >= 20 s (${l.m3.toFixed(0)} s)`);
    for (const at of [60, 120]) eq(lesson('m15', 0, at).seals, 3, `granary by the castle @${at}s`);
    eq(eye('m15', 10).seals, 3, 'reasonable player every 10 s');
    for (const s of [30, 60]) assert(eye('m15', s).seals >= 2, `reasonable player every ${s} s >= 2 seals`);
  });
});
