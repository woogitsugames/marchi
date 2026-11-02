// Demolish guard (backlog P1): in a contract mission, a building whose type is not on the mission's
// build list can never stand again, so the demolish tool asks for a second tap. demolishIsFinal is
// the pure read the UI asks; the sim itself still accepts the command (old replays stay valid).
import { applyCommand, createWorld, demolishIsFinal, missionBuildable, stateHash } from '../src/sim/index';
import { assert, eq, test } from './harness';

test('contract mission I: every production building is final, castle and stable are not', () => {
  const w = createWorld('m1');
  let finals = 0;
  for (const b of w.state.buildings) {
    const want = b.type !== 'castle' && b.type !== 'stable';
    eq(demolishIsFinal(w, b.id), want, `${b.type} #${b.id}`);
    if (want) finals++;
  }
  assert(finals >= 4, `mission I has production buildings (${finals})`);
});

test('a type on the mission build list can be rebuilt, so it is not final', () => {
  for (const id of ['m6', 'm7', 'm8', 'm9']) {
    const w = createWorld(id);
    const can = missionBuildable(id);
    assert(can !== 'ranked' && can.length > 0, `${id} has a build list`);
    for (const b of w.state.buildings) {
      if (b.type === 'castle' || b.type === 'stable') continue;
      eq(demolishIsFinal(w, b.id), !can.includes(b.type), `${id} ${b.type}`);
    }
  }
});

test('the free valley never asks (no contract, every type can be built again)', () => {
  const w = createWorld('sandbox');
  for (const b of w.state.buildings) eq(demolishIsFinal(w, b.id), false, `sandbox ${b.type}`);
  eq(demolishIsFinal(createWorld('m1'), -1), false, 'unknown id');
});

test('demolishIsFinal is a pure read and the sim still accepts the demolition', () => {
  const w = createWorld('m1');
  const farm = w.state.buildings.find((b) => b.type === 'farm')!;
  const before = stateHash(w);
  for (let i = 0; i < 3; i++) demolishIsFinal(w, farm.id);
  eq(stateHash(w), before, 'state unchanged');
  const r = applyCommand(w, { t: 'demolish', cell: farm.y * w.terrain.w + farm.x });
  assert(r.ok, 'sim demolishes after the UI confirmation');
  assert(!w.state.buildings.some((b) => b.id === farm.id), 'farm gone');
});
