// Acceptance suite runs directly against the proposal data, never edits missions.ts.
import {
  applyCommand, checkInvariants, createWorld, explainBuilding, findPath, lineCells,
  onRock, nearWater, stoneAvailable, validatePlace, validateRoad,
} from '../src/sim/index';
import {
  M7_DRY_SITE, M7_FISHER_SITE, M7_VALLEY, M8_FALSE_QUARRY_SITE, M8_QUARRY_SITE, M8_VALLEY,
  M9_VALLEY, M9_WOODCUTTER_SITE, PROPOSED_MISSIONS_7_9,
} from '../src/sim/proposals/missions-7-9';
import { generateValley } from '../src/sim/terrain';
import { STRATEGIES, runProposed, withProposal } from '../tools/bot-missions-7-9';
import { assert, eq, test } from './harness';

const W = 96;
const row = (y: number, x1: number, x2: number): number[] => lineCells(W, y * W + x1, y * W + x2);
for (const [id, spec] of [['m7', M7_VALLEY], ['m8', M8_VALLEY], ['m9', M9_VALLEY]] as const) {
  test(id + ': proposal uses the promised 96x72 valley and an existing terrain alias', () => {
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

test('m8: dry quarry rejected, rocky quarry valid, NO_STONE until its 4-unit wagons bring stone', () => {
  withProposal('m8', () => {
    const w = createWorld('m8');
    assert(onRock(w.terrain, M8_QUARRY_SITE.x, M8_QUARRY_SITE.y, 3, 2), 'quarry on rock');
    const dry = validatePlace(w, 'quarry', M8_FALSE_QUARRY_SITE.x, M8_FALSE_QUARRY_SITE.y, M8_FALSE_QUARRY_SITE.facing);
    assert(!dry.ok, 'dry quarry rejected');
    if (!dry.ok) eq(dry.err.k, 'NOT_ON_ROCK', 'correct geological reason');
    const path = row(44, 45, 60);
    const blocked = validateRoad(w, path, 2);
    assert(!blocked.ok, 'no stone in granary at start');
    if (!blocked.ok) eq(blocked.err.k, 'NO_STONE', 'proper construction bottleneck');
    eq(stoneAvailable(w), 0, 'source stone is not yet usable before delivery');
    const q = w.state.buildings.find((b) => b.type === 'quarry')!;
    const wh = w.state.buildings.find((b) => b.type === 'warehouse')!;
    assert(findPath(w, q.gate, wh.gate, true), 'quarry can deliver to granary');
  });
  const repaired = runProposed('m8', STRATEGIES.m8[2]!);
  assert(repaired.peakStoneStored >= 16, 'quarry brought 16 stone to granary before paving');
  eq(repaired.stoneUsed, 16, '16 units consumed by cobbled road');
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
    assert(r[0]!.seals <= r[1]!.seals && r[1]!.seals <= r[2]!.seals,
      id + ': nondecreasing seals; seals=' + r.map((x) => x.seals).join('/'));
  });
}
