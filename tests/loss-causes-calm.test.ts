// The loss letter's three costs leave out calm seconds (D-335, BACKLOG P3 from D-212): a root that stood calm with
// nothing to do about it (XV's small store full of fish nobody wants, X's charcoal burner whose order is filled) is
// not a cost — unless a building whose stall is not calm hangs on it (XV's woodcutters refused by the store).
import { TICK_HZ, applyCommand, createWorld, step, topStallCauses, type Command, type World } from '../src/sim/index';
import { LESSON } from '../tools/balance-night6';
import { lossCauses, sampleCalmCosts } from '../src/ui/stalls';
import { lossActionKey } from '../src/ui/stallKinds';
import { assert, eq, test } from './harness';

/** Play `id` to tick `until` (or the end) with the sampler running as App.onTick runs it; `fix` once at 0:00. */
function play(id: string, until: number, fix?: (w: World) => Command[], sample = true): World {
  const w = createWorld(id);
  if (fix) for (const c of fix(w)) assert(applyCommand(w, c).ok, `${id}: ${c.t} applies`);
  if (sample) sampleCalmCosts(w);
  while (w.state.mission.result === 'running' && w.state.tick < until) {
    step(w);
    if (sample) sampleCalmCosts(w);
  }
  return w;
}

const key = (c: { kind: string; id: number; status: string }) => `${c.kind}:${c.id}:${c.status}`;

test('loss causes: XV without a granary keeps the store, charged only for the time the woodcutters stood', () => {
  const w = play('m15', w0(createWorld('m15')));
  const raw = topStallCauses(w, 1)[0]!;
  eq(raw.status, 'STORAGE_FULL', 'the ledger names the fish store first');
  const top = lossCauses(w, 3)[0]!;
  eq(key(top), key({ ...raw }), 'the store still heads the three costs (the woodcutters hang on it)');
  assert(top.seconds < raw.seconds - 30, `the calm seconds before the woodcutters stood are left out (${top.seconds} < ${raw.seconds})`);
  eq(lossActionKey(top.status), 'end.act.granary', 'the advice stays "build a granary" (D-212)');
});

test('loss causes: XV with the granary by the castle no longer lists the calm fish store', () => {
  const w = play('m15', w0(createWorld('m15')), LESSON.m15);
  const store = topStallCauses(w, 10).find((c) => c.status === 'STORAGE_FULL');
  assert(!!store && store.seconds > 120, 'the ledger charges the full fish store');
  assert(!lossCauses(w, 3).some((c) => key(c) === key(store)), 'the three costs leave it out (a full store next to one with room)');
});

test('loss causes: X lost without a move does not blame the charcoal burner whose order is filled', () => {
  const w = play('m10', 30 * 60 * TICK_HZ);
  eq(w.state.mission.result, 'lost', 'passive X is lost');
  const raw = topStallCauses(w, 1)[0]!;
  eq(raw.status, 'OUTPUT_FULL.NO_DESTINATION', 'the ledger names the burner first');
  const top = lossCauses(w, 3);
  assert(!top.some((c) => key(c) === key(raw)), 'the three costs leave it out');
  eq(top[0]!.status, 'NO_INPUT.CONTESTED', 'the contested sawmill heads the letter');
});

test('loss causes: without the sampler (a loaded game) the reading at the end judges the unwatched seconds', () => {
  const w = play('m10', 30 * 60 * TICK_HZ, undefined, false);
  const raw = topStallCauses(w, 1)[0]!;
  assert(!lossCauses(w, 3).some((c) => key(c) === key(raw)), 'the calm burner is left out all the same');
  // the same ledger order as topStallCauses when nothing reads calm: wagons and spans are never judged
  const m1 = play('m1', 4 * 60 * TICK_HZ);
  const a = topStallCauses(m1, 3).filter((c) => c.seconds >= 5).map(key).join(), b = lossCauses(m1, 3).map(key).join();
  eq(b, a, 'mission I at 4:00: nothing calm, the same three');
});

/** XV's 2-seal threshold: the ledger a slower player's loss would show (every strategy wins XV late). */
function w0(w: World): number { return w.state.mission.contract!.star2Tick; }
