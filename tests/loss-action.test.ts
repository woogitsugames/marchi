// The loss letter's one action line (first-10-minutes-c N3, D-130): the #1 cause of lost time picks what to do next
// time — never "build a crossing" when the crossing stands.
import { TICK_HZ, applyCommand, createWorld, lineCells, step, topStallCauses } from '../src/sim/index';
import { lossActionKey } from '../src/ui/stallKinds';
import { en } from '../src/i18n/en';
import { pl } from '../src/i18n/pl';
import { assert, eq, test } from './harness';

test('loss action: each kind of root cause maps to its cure', () => {
  eq(lossActionKey('WAITING_PICKUP'), 'end.act.wagon', 'pickup wait');
  eq(lossActionKey('NO_WAGON.ALL_BUSY'), 'end.act.wagon', 'all busy');
  eq(lossActionKey('OUTPUT_FULL.NO_WAGON'), 'end.act.wagon', 'full yard, no wagon');
  eq(lossActionKey('NO_ROAD'), 'end.act.road', 'no road');
  eq(lossActionKey('NO_INPUT.UNREACHABLE'), 'end.act.road', 'unreachable');
  eq(lossActionKey('NO_WAGON.NONE_CAN_REACH'), 'end.act.road', 'none can reach');
  eq(lossActionKey('BRIDGE_JAM'), 'end.act.bridge', 'jam');
  eq(lossActionKey('STORAGE_FULL'), 'end.act.granary', 'granary full');
  eq(lossActionKey('NO_INPUT.NONE_AVAILABLE'), 'end.act.other', 'anything else');
  for (const k of ['end.act.wagon', 'end.act.road', 'end.act.bridge', 'end.act.granary', 'end.act.other'] as const) {
    assert(!!pl[k] && !!en[k], `${k} in pl and en`);
  }
});

test('loss action: mission I lost with the bridge built never advises a crossing', () => {
  const w = createWorld('m1');
  const W = w.terrain.w;
  assert(applyCommand(w, { t: 'road', surface: 1, cells: lineCells(W, 24 * W + 41, 44 * W + 41) }).ok, 'the crossing');
  while (w.state.mission.result === 'running' && w.state.tick < 20 * 60 * TICK_HZ) step(w);
  eq(w.state.mission.result, 'lost', 'two wagons and a bridge lose I');
  const top = topStallCauses(w, 1)[0]!;
  assert(lossActionKey(top.status) !== 'end.act.road', `the #1 cause (${top.status}) does not ask for a road`);
});
