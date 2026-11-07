// Missions XIV "Węgiel z lasu" and XV "Skład pod zamkiem" (research 2026-11-06, in the game since D-210): data, the
// cards that teach them, the calm full granary of goods nobody wants (D-212), the seal ladders and the thresholds
// (D-211: the wrong site with a wagon misses three seals by >= 20 s over the build-time sweep, the lesson keeps >= 20 s).
import { MISSIONS, checkInvariants, createWorld, findPath, missionBuildable, step } from '../src/sim/index';
import { M14_BURNER_SITE, M15_GRANARY_SITE, MISSIONS_14_15 } from '../src/sim/proposals/missions-14-15';
import { LESSON, WRONG, eyePlayer, run } from '../tools/balance-night6';
import { lessonPlayer } from '../tools/m8-ladder';
import { M14_EXTRA, M14_STRATEGIES, runSiteBot } from '../tools/bot-m14';
import { M15_EXTRA, M15_STRATEGIES } from '../tools/bot-m15';
import { buildSite } from '../src/ui/site';
import { calmWhy, cureFor, granaryUnwanted, rankStalls } from '../src/ui/stalls';
import { statusKey } from '../src/ui/stallKinds';
import { readFileSync } from 'node:fs';
import { assert, eq, test } from './harness';

const lesson = (id: string, k: number, at: number) => { const a = {}; return run(id, 'lesson', lessonPlayer(k, at, LESSON[id]!, a), a); };
const wrong = (id: string, k: number, at: number) => { const a = {}; return run(id, 'wrong', lessonPlayer(k, at, WRONG[id]!, a), a); };
const wagons = (id: string, k: number) => { const a = {}; return run(id, 'wagons', lessonPlayer(k, 0, null, a), a); };
const eye = (id: string, s: number) => {
  const a: Record<string, number> = {}, seen: Record<string, number> = {};
  return { ...run(id, 'eye', eyePlayer(s, true, a, seen), a, seen), acts: a };
};

test('m14-m15: registered, appended as XIV and XV after XIII, the dry valley, goods conserved', () => {
  eq(MISSIONS.m14, MISSIONS_14_15.m14, 'm14 registered');
  eq(MISSIONS.m15, MISSIONS_14_15.m15, 'm15 registered');
  // the menu module needs the browser i18n loader: read its list as text
  const menu = readFileSync(new URL('../src/ui/menu.ts', import.meta.url), 'utf8');
  // later missions follow them (XVI, D-288)
  assert(/MENU_MISSIONS = \[[^\]]*'m13', 'm14', 'm15'[,\]]/.test(menu) && /'XIII', 'XIV', 'XV'[,\]]/.test(menu), 'appended as XIV, XV (D-210)');
  eq(String(missionBuildable('m14')), 'charcoalBurner', 'XIV builds burners only');
  eq(String(missionBuildable('m15')), 'warehouse', 'XV builds granaries only');
  for (const id of ['m14', 'm15']) {
    const w = createWorld(id);
    eq(w.state.mapId, 'valley-m3', id + ' reuses the dry valley');
    eq(checkInvariants(w).length, 0, id + ' initial goods are conserved');
    const castle = w.state.buildings.find((b) => b.type === 'castle')!;
    for (const b of w.state.buildings) if (b !== castle) assert(findPath(w, b.gate, castle.gate, true), `${id}: ${b.type} reaches the castle`);
  }
});

test('m14: the build ghost starts at the forest site; the pace card asks for a burner', () => {
  const w = createWorld('m14');
  const burner = w.state.buildings.find((b) => b.type === 'charcoalBurner')!;
  const s = buildSite(w, 'charcoalBurner', burner.id)!;
  assert(s.hint && s.x === M14_BURNER_SITE.x && s.y === M14_BURNER_SITE.y, 'ghost at the authored site by the woodcutters');
  const r = eye('m14', 10);
  assert((r.seen!['pace:producer -> producer:charcoalBurner'] ?? 0) >= 1, 'the eye player follows the producer card');
});

test('m14: ladder — nothing and wagons 1 seal, the castle site misses 3 by >= 20 s, the forest 3 with >= 20 s', () => {
  eq(run('m14', 'passive', () => {}).seals, 1, 'passive');
  for (const k of [1, 3]) eq(wagons('m14', k).seals, 1, `wagons-${k}`);
  for (const k of [0, 1]) for (const at of [0, 40, 80, 120]) {
    const r = wrong('m14', k, at);
    assert(r.seals <= 2 && r.m3 <= -20, `burner by the castle +${k}w @${at}s misses 3 seals by >= 20 s (${r.m3.toFixed(0)} s)`);
  }
  const l = lesson('m14', 0, 0);
  assert(l.seals === 3 && l.m3 >= 20, `burner by the forest @0:00: 3 seals with >= 20 s (${l.m3.toFixed(0)} s)`);
  assert(lesson('m14', 0, 60).seals === 3, 'burner by the forest @1:00: 3 seals');
  const e10 = eye('m14', 10);
  assert(e10.seals === 3, `reasonable player every 10 s: 3 seals (${e10.m3.toFixed(0)} s)`);
  for (const s of [30, 60]) assert(eye('m14', s).seals >= 2, `reasonable player every ${s} s >= 2 seals`);
});

test('m15: the fish granary is a calm pin (D-212); the woodcutters ask for a granary, the ghost starts by the castle', () => {
  const w = createWorld('m15');
  const small = w.state.buildings.find((b) => b.type === 'warehouse')!;
  const s = buildSite(w, 'warehouse', small.id)!;
  assert(s.hint && s.x === M15_GRANARY_SITE.x && s.y === M15_GRANARY_SITE.y, 'ghost at the authored site by the castle');
  for (let i = 0; i < 60 * 10; i++) step(w);
  eq(small.status.k, 'STORAGE_FULL', 'the fish store is full');
  assert(granaryUnwanted(w, small.id), 'nothing wants fish');
  eq(calmWhy(w, small), 'unwanted', 'calm reason');
  eq(statusKey(small.status, w, small.id), 'status.STORAGE_FULL.unwanted', 'calm title');
  eq(cureFor(w, small.id), null, 'no repair for the fish store itself');
  const top = rankStalls(w)[0]!;
  const head = w.state.buildings.find((b) => b.id === top.id)!;
  eq(head.type, 'woodcutter', 'the woodcutters head the stall list');
  eq(cureFor(w, head.id), 'granary', 'their cure: another granary');
  assert(rankStalls(w).find((e) => e.id === small.id)?.minor === true, 'the fish store ranks as a minor (brass) pin');
  // the same store holding a good the order still wants is a real full granary again
  w.state.mission.contract!.need.fish = 5;
  assert(!granaryUnwanted(w, small.id), 'wanted fish: not calm');
  const r = eye('m15', 10);
  assert((r.seen!['warehouse:STORAGE_FULL -> granary'] ?? 0) === 0, 'the fish store never offers a granary');
  assert((r.seen!['woodcutter:OUTPUT_FULL.NO_DESTINATION -> granary'] ?? 0) >= 1, 'the eye player follows the woodcutters to a granary');
});

test('m15: ladder — nothing and wagons 1 seal, the woodcutters site misses 3 by >= 20 s, the castle 3 with >= 20 s', () => {
  eq(run('m15', 'passive', () => {}).seals, 1, 'passive');
  eq(wagons('m15', 2).seals, 1, 'wagons-2');
  for (const k of [0, 1]) for (const at of [0, 40, 80, 120]) {
    const r = wrong('m15', k, at);
    assert(r.seals <= 2 && r.m3 <= -20, `granary by the woodcutters +${k}w @${at}s misses 3 seals by >= 20 s (${r.m3.toFixed(0)} s)`);
  }
  const l = lesson('m15', 0, 0);
  assert(l.seals === 3 && l.m3 >= 20, `granary by the castle @0:00: 3 seals with >= 20 s (${l.m3.toFixed(0)} s)`);
  eq(lesson('m15', 0, 60).seals, 3, 'granary by the castle @1:00');
  const e10 = eye('m15', 10);
  assert(e10.seals === 3, `reasonable player every 10 s: 3 seals (${e10.m3.toFixed(0)} s)`);
  eq(e10.acts.granary ?? 0, 1, 'no needless second granary for the fish store (D-212)');
  for (const s of [30, 60]) assert(eye('m15', s).seals >= 2, `reasonable player every ${s} s >= 2 seals`);
});

test('m14-m15 bots: seal ladders 1/2/3, clean commands and invariants', () => {
  for (const [id, ladder, extra] of [['m14', M14_STRATEGIES, M14_EXTRA], ['m15', M15_STRATEGIES, M15_EXTRA]] as const) {
    const runs = ladder.map((s) => runSiteBot(id, s));
    for (const r of [...runs, ...extra.map((s) => runSiteBot(id, s))]) {
      eq(r.commandErrors.length, 0, `${id} ${r.strategy} commands: ${r.commandErrors.join('; ')}`);
      eq(r.invariantErrors.length, 0, `${id} ${r.strategy} invariants: ${r.invariantErrors.join('; ')}`);
    }
    eq(runs.map((r) => r.seals).join('/'), '1/2/3', `${id} nothing / partial / right`);
  }
});
