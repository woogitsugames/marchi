import { createWorld, explainBuilding, step, unexplainedStalls, buildingById } from '../src/sim/index';
import { assert, eq, test } from './harness';

test('untouched mission (no bridge): every stalled building and wagon has a reason', () => {
  const w = createWorld('m1');
  for (let i = 0; i < 1200; i++) {
    step(w);
    const u = unexplainedStalls(w);
    assert(u.length === 0, u.join('; '));
  }
  const castle = w.state.buildings.find((b) => b.type === 'castle')!;
  const chain = explainBuilding(w, castle.id);
  assert(chain.length > 0, 'castle chain');
  assert(chain[0]!.status.k !== 'IDLE', 'castle not silently idle: ' + chain[0]!.status.k);
  // the bakery has no flour because the mill is starved or nobody can reach it
  const bakery = w.state.buildings.find((b) => b.type === 'bakery')!;
  const bc = explainBuilding(w, bakery.id);
  assert(bc.length > 0 && bc[0]!.status.k !== 'IDLE', 'bakery explains: ' + JSON.stringify(bc));
  // wagons are north of the river: the south side reports NO_WAGON (none can reach)
  const s = buildingById(w, castle.id)!.status;
  eq(s.k === 'NO_WAGON' || s.k === 'NO_INPUT', true, 'castle reason ' + s.k);
});

test('start-up is not reported as a stall: input made upstream right now = WAITING_UPSTREAM', () => {
  const w = createWorld('m2');
  for (let i = 0; i < 150; i++) step(w);
  const falseAlarms = w.state.buildings.filter((b) => b.status.k === 'NO_INPUT' && b.status.cause === 'NONE_AVAILABLE'
    && w.state.buildings.some((p) => p.id === (b.status as { blockedBy: number }).blockedBy && p.status.k === 'WORKING'));
  eq(falseAlarms.length, 0, 'NO_INPUT blaming a working producer: ' + falseAlarms.map((b) => b.type).join(','));
  assert(w.state.buildings.some((b) => b.status.k === 'WAITING_UPSTREAM'), 'someone waits for upstream at start');
});
