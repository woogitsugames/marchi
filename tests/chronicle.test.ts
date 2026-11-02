// Chronicle proposal: pure, idempotent milestones over free-valley states and a short real bot run.
import { readFileSync } from 'node:fs';
import { applyCommand, createWorld } from '../src/sim/index';
import { buildMission } from '../src/sim/missions';
import { SEASON_TICKS } from '../src/sim/seasons';
import { CHRONICLE, checkChronicle } from '../src/sim/proposals/chronicle';
import { DECENT, runSandbox } from '../tools/bot-sandbox';
import { assert, eq, test } from './harness';

const eligible = (state: ReturnType<typeof buildMission>['state']): string[] => checkChronicle(state, []);

test('chronicle: 20-30 unique, data-only entries; the starting sandbox awards nothing', () => {
  assert(CHRONICLE.length >= 20 && CHRONICLE.length <= 30, '30 or fewer authored milestones');
  eq(new Set(CHRONICLE.map((e) => e.id)).size, CHRONICLE.length, 'unique IDs');
  for (const entry of CHRONICLE) {
    eq(Object.keys(entry).sort().join(','), 'condition,id', 'no reward or mutable callback on ' + entry.id);
    assert(/^[a-z][a-z0-9_]*$/.test(entry.id), 'stable ASCII ID ' + entry.id);
  }
  const { state } = buildMission('sandbox');
  eq(eligible(state).length, 0, 'pre-placed woodcutter, sawmill, granary and wagons are not milestones');
  eq(checkChronicle(buildMission('m1').state, []).length, 0, 'contract missions never receive sandbox milestones');
});

test('chronicle: read-only, deterministic, previous IDs as Set or array, stable order', () => {
  const { state } = buildMission('sandbox');
  state.ledger.sold.planks = 1;
  state.ledger.sold.wood = 1;
  state.town.rank = 1;
  const before = JSON.stringify(state);
  const first = checkChronicle(state, []);
  assert(first.includes('planks_at_market'), 'sale is recorded');
  assert(first.includes('two_forest_goods'), 'two forest trades are recorded');
  assert(first.includes('market_village'), 'rank is recorded');
  eq(JSON.stringify(state), before, 'state was not changed');
  eq(checkChronicle(state, []).join(','), first.join(','), 'same inputs => same ordered IDs');
  const set = new Set(first.slice(0, 2));
  const setBefore = [...set].join(',');
  const remaining = checkChronicle(state, set);
  eq(remaining.join(','), first.slice(2).join(','), 'Set filters awarded IDs');
  eq(checkChronicle(state, first.slice(0, 2)).join(','), remaining.join(','), 'array and Set agree');
  eq([...set].join(','), setBefore, 'previous Set unchanged');
  eq(checkChronicle(state, new Set(first)).length, 0, 'awards once when the caller persists IDs');
});

test('chronicle: newly placed and stocked buildings are required; the starting buildings do not count', () => {
  const world = createWorld('sandbox');
  const state = world.state;
  state.ledger.sold.planks = 12;
  assert(!eligible(state).includes('second_sawmill'), 'starting sawmill has placedTick=-1');
  assert(!eligible(state).includes('working_granary'), 'starting warehouse has placedTick=-1');
  assert(applyCommand(world, { t: 'place', type: 'warehouse', x: 40, y: 25, facing: 2 }).ok, 'player built warehouse');
  assert(!eligible(state).includes('working_granary'), 'empty new warehouse is not proof of a stock transfer');
  const warehouse = state.buildings.find((b) => b.type === 'warehouse' && b.placedTick >= 0)!;
  warehouse.stock.wood = 1;
  assert(eligible(state).includes('working_granary'), 'new stocked warehouse is a milestone');
  warehouse.stock.wood = 0;
  assert(!eligible(state).includes('working_granary'), 'snapshot alone has no historical stock receipt');
});

test('chronicle: rank and paved road are not mistaken for an untracked stone bridge', () => {
  const { state } = buildMission('sandbox');
  state.town.rank = 3;
  assert(eligible(state).includes('town_rank'), 'rank 3 qualifies');
  assert(!eligible(state).includes('stronghold_rank'), 'rank 4 is still locked');
  state.town.rank = 4;
  assert(eligible(state).includes('stronghold_rank'), 'rank 4 qualifies');
  state.ledger.sold.stone = 1;
  assert(!eligible(state).includes('stone_paved_road'), 'selling stone does not build roads');
  state.roads[0] = 2;
  state.roads[1] = 2;
  state.roads[2] = 2;
  assert(!eligible(state).includes('stone_paved_road'), 'three cobbles are fewer than four');
  state.roads[3] = 2;
  assert(eligible(state).includes('stone_paved_road'), 'four cobble cells plus sold stone are enough');
});

test('chronicle: the winter note is about a sale already on record, not a stall-free winter', () => {
  const { state } = buildMission('sandbox');
  state.ledger.sold.bread = 1;
  state.tick = 3 * SEASON_TICKS - 1;
  assert(!eligible(state).includes('winter_bread_record'), 'still autumn');
  state.tick++;
  assert(eligible(state).includes('winter_bread_record'), 'first winter tick with bread in the ledger');
  state.ledger.stallSeconds['span:42:BRIDGE_CLOSED'] = 30;
  assert(eligible(state).includes('winter_bread_record'), 'this entry makes no unsupported no-stall claim');
});

test('chronicle: Polish and English prose matches the IDs, lengths and one-sentence format', () => {
  const doc = readFileSync(new URL('../docs/content/chronicle.md', import.meta.url), 'utf8');
  const rows = doc.split('\n').filter((line) => line.startsWith('| ' + String.fromCharCode(96)));
  eq(rows.length, CHRONICLE.length, 'one bilingual row for every milestone');
  const seen = new Set<string>();
  for (const row of rows) {
    const columns = row.split('|').slice(1, -1).map((s) => s.trim());
    eq(columns.length, 5, 'five columns per row');
    const id = columns[0]!.slice(1, -1);
    assert(CHRONICLE.some((entry) => entry.id === id), 'unknown text ID ' + id);
    assert(!seen.has(id), 'duplicate text ID ' + id);
    seen.add(id);
    for (const [offset, limit] of [[1, 32], [2, 90], [3, 32], [4, 90]] as const) {
      const text = columns[offset]!;
      assert([...text].length > 0 && [...text].length <= limit,
        id + ', column ' + offset + ': ' + [...text].length + ' characters (limit ' + limit + ')');
      assert(!/Gratulacje|Congratulations|\p{Extended_Pictographic}/iu.test(text), 'no applause or emoji');
      if (offset === 2 || offset === 4) assert(/^[^.!?]+\.$/.test(text), id + ': single declarative sentence');
    }
  }
});

test('chronicle: a short sandbox bot session unlocks real deliveries, without changing the economy', () => {
  const newlyDone = new Set<string>();
  const result = runSandbox(DECENT, 6, {
    checkEvery: 60,
    onTick(world) {
      for (const id of checkChronicle(world.state, newlyDone)) newlyDone.add(id);
    },
  });
  eq(result.violations.length, 0, 'bot invariant violations: ' + result.violations.join('; '));
  assert(result.sold.planks! > 0, 'the bot really sold planks');
  assert(newlyDone.has('planks_at_market'), 'chronicle observed the real sale');
  assert(newlyDone.has('third_wagon'), 'the bot added a wagon before its first sale');
  assert(!newlyDone.has('stronghold_rank'), 'no late-rank reward during the opening session');
});
