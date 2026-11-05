// Acceptance suite for missions VII-IX (registered in missions.ts from src/sim/proposals/missions-7-9.ts).
import {
  MISSIONS, checkInvariants, createWorld, explainBuilding, findPath, lineCells,
  onRock, nearWater, roadStoneCost, stoneAvailable, validatePlace, validateRoad,
} from '../src/sim/index';
import {
  M7_DRY_SITE, M7_FISHER_SITE, M7_VALLEY, M8_FALSE_QUARRY_SITE, M8_LANE, M8_QUARRY_SITE, M8_SEED,
  M9_VALLEY, M9_WOODCUTTER_SITE, PROPOSED_MISSIONS_7_9,
} from '../src/sim/proposals/missions-7-9';
import { generateValley } from '../src/sim/terrain';
import { valleySpec } from '../src/sim/missions';
import { STRATEGIES, runProposed, withProposal } from '../tools/bot-missions-7-9';
import { assert, eq, test } from './harness';

const W = 96;
const row = (y: number, x1: number, x2: number): number[] => lineCells(W, y * W + x1, y * W + x2);

test('missions VII-IX are registered; only mission VIII builds cobbles with stone (MissionDef.roadStone, D-32)', () => {
  for (const id of ['m7', 'm8', 'm9'] as const) {
    eq(MISSIONS[id], PROPOSED_MISSIONS_7_9[id], id + ' registered');
    eq(MISSIONS[id]!.mapId, 'valley-' + id, id + ' own map id');
    eq(createWorld(id).state.mission.roadStone, id === 'm8', id + ' road stone flag copied into the state');
  }
  assert(roadStoneCost(createWorld('m8'), row(44, 45, 60), 2) > 0, 'm8: cobbles cost stone');
  for (const id of ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm9']) {
    eq(roadStoneCost(createWorld(id), row(44, 45, 60), 2), 0, id + ': cobbles cost silver only');
  }
});
for (const [id, spec] of [['m7', M7_VALLEY], ['m8', valleySpec(M8_SEED)], ['m9', M9_VALLEY]] as const) {
  test(id + ': uses the promised 96x72 valley under its own map id', () => {
    const data = PROPOSED_MISSIONS_7_9[id];
    eq(spec.w, 96, 'width'); eq(spec.h, 72, 'height');
    eq(data.seed, spec.seed, 'terrain and mission seed agree');
    withProposal(id, () => {
      const w = createWorld(id);
      const generated = generateValley(spec);
      eq(w.terrain.water.join(''), generated.water.join(''), id + ' water map');
      eq(w.state.mission.contract!.need.fish, id === 'm7' ? 54 : 0, 'contract from proposal');
      eq(checkInvariants(w).length, 0, 'clean initial state');
      const castle = w.state.buildings.find((b) => b.type === 'castle')!;
      assert(castle, 'castle exists');
      for (const b of w.state.buildings) if (b.type !== 'castle') {
        assert(findPath(w, b.gate, castle.gate, true), id + ': ' + b.type + ' can reach castle');
      }
    });
  });
}

test('m7: dry hut rejected as NOT_NEAR_WATER, shoreline allowed, fish travel over the wooden bridge', () => {
  withProposal('m7', () => {
    const w = createWorld('m7');
    const dry = validatePlace(w, 'fisher', M7_DRY_SITE.x, M7_DRY_SITE.y, M7_DRY_SITE.facing);
    assert(!dry.ok, 'dry fisher rejected');
    if (!dry.ok) eq(dry.err.k, 'NOT_NEAR_WATER', 'correct site reason');
    const good = validatePlace(w, 'fisher', M7_FISHER_SITE.x, M7_FISHER_SITE.y, M7_FISHER_SITE.facing);
    assert(good.ok, 'bank-side fisher placeable');
    const gate = w.state.buildings.find((b) => b.type === 'fisher')!.gate;
    assert(nearWater(w.terrain, 22, 30, 2, 2, gate), 'starting fisher near real water');
    const waterBridge = lineCells(W, 29 * W + 51, 42 * W + 51)
      .filter((cell) => w.terrain.water[cell] === 1);
    assert(waterBridge.length > 0 && waterBridge.every((c) => w.state.roads[c] === 1),
      'bridge is built over water');
  });
  const baseline = runProposed('m7', STRATEGIES.m7[0]!);
  assert(baseline.fishCrossings > 0, 'a loaded fish wagon crosses water before reaching the castle');
  assert(baseline.produced.fish >= 54, 'fisher makes enough fish for the contract');
});

test('m8: dry quarry rejected, rocky quarry valid, NO_STONE until its 4-unit wagons bring the lane\'s 23 stone', () => {
  withProposal('m8', () => {
    const w = createWorld('m8');
    assert(onRock(w.terrain, M8_QUARRY_SITE.x, M8_QUARRY_SITE.y, 3, 2), 'quarry on rock');
    const dry = validatePlace(w, 'quarry', M8_FALSE_QUARRY_SITE.x, M8_FALSE_QUARRY_SITE.y, M8_FALSE_QUARRY_SITE.facing);
    assert(!dry.ok, 'dry quarry rejected');
    if (!dry.ok) eq(dry.err.k, 'NOT_ON_ROCK', 'correct geological reason');
    const lane = row(M8_LANE.y, M8_LANE.x1, M8_LANE.x2);
    eq(lane.length, 23, 'the lane is 23 cells');
    for (const c of lane) eq(w.state.roads[c], 1, 'the lane is dirt at the start');
    const blocked = validateRoad(w, lane, 2);
    assert(!blocked.ok, 'not enough stone in the granaries at start');
    if (!blocked.ok) eq(blocked.err.k, 'NO_STONE', 'proper construction bottleneck');
    eq(stoneAvailable(w), 16, 'the two granaries hold 16 of the 23 at the start; the quarry\'s 8 must be hauled');
    const q = w.state.buildings.find((b) => b.type === 'quarry')!;
    for (const wh of w.state.buildings.filter((b) => b.type === 'warehouse')) {
      assert(findPath(w, q.gate, wh.gate, true), 'quarry can deliver to every granary');
    }
  });
  const repaired = runProposed('m8', STRATEGIES.m8[2]!);
  assert(repaired.peakStoneStored >= 23, 'the quarry brought the missing stone to the granaries before paving');
  eq(repaired.stoneUsed, 23, '23 units consumed by the cobbled lane');
  assert(repaired.maxStoneWagon <= 4 && repaired.maxStoneWagon > 0, 'heavy stone load limited to four');
  assert((repaired.actionSecond ?? 0) > 45, 'not paved without delivered material');
});

test('m9: the chain produces malt and beer, charcoal burner and sawmill compete for wood', () => {
  withProposal('m9', () => {
    const w = createWorld('m9');
    const candidate = validatePlace(w, 'woodcutter', M9_WOODCUTTER_SITE.x, M9_WOODCUTTER_SITE.y, M9_WOODCUTTER_SITE.facing);
    assert(candidate.ok, 'repair woodcutter can be built');
    const chain = ['farm', 'malthouse', 'brewery', 'castle'];
    const buildings = chain.map((type) => w.state.buildings.find((b) => b.type === type)!);
    for (let i = 0; i < buildings.length - 1; i++)
      assert(findPath(w, buildings[i]!.gate, buildings[i + 1]!.gate, true), chain[i] + ' -> ' + chain[i + 1]);
    const charcoal = w.state.buildings.find((b) => b.type === 'charcoalBurner')!;
    assert(explainBuilding(w, charcoal.id).length >= 1, 'cause chain inspectable');
  });
  const base = runProposed('m9', STRATEGIES.m9[0]!);
  assert(base.produced.malt >= 13 && base.produced.beer >= 26, 'full new chain is exercised');
  assert(base.contestedSamples > 0, 'CONTESTED reported while wood is assigned to rival consumer');
});

for (const id of ['m7', 'm8', 'm9'] as const) {
  test(id + ': all three balance scenarios are executable, invariant-safe and their seals are ordered', () => {
    const r = STRATEGIES[id].map((strategy) => runProposed(id, strategy));
    for (const v of r) {
      eq(v.commandErrors.length, 0, v.strategy + ': accepted commands ' + v.commandErrors.join('; '));
      eq(v.invariantErrors.length, 0, v.strategy + ': no invariant violations ' + v.invariantErrors.join('; '));
      eq(v.result, 'won', v.strategy + ': reaches the contract');
      assert(v.minutes > 0 && v.minutes <= PROPOSED_MISSIONS_7_9[id].deadlineMin,
        v.strategy + ': finishes before deadline');
    }
    assert(r[0]!.minutes > r[1]!.minutes && r[1]!.minutes > r[2]!.minutes,
      id + ': repair must beat partial repair, which must beat no action; minutes=' + r.map((x) => x.minutes.toFixed(2)).join('/'));
    eq(r.map((x) => x.seals).join('/'), '1/2/3', id + ': measured 1/2/3 seal ladder');
  });
}
