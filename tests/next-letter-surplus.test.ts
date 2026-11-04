// D-106 (night 6b): mission VI after the granary link. Between the two letters the castle does not take planks
// yet, so a sawmill whose planks wait for a wagon only waits to park them in a granary; the card must not offer
// "Kup wóz" (measured: a wagon there costs 11 s, and then the granary hint another 26 s).
import { activeTranche } from '../src/sim/contract';
import { TICK_HZ, applyCommand, buildingById, createWorld, lineCells, outputSurplus, stars, step } from '../src/sim/index';
import { cureFor } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

test('next-letter surplus: m6 sawmill planks before the planks letter are a calm surplus, no wagon cure', () => {
  const w = createWorld('m6');
  const W = w.terrain.w;
  eq(applyCommand(w, { t: 'road', surface: 1, cells: lineCells(W, 38 * W + 37, 39 * W + 37) }).ok, true, 'authored link');
  const saw = w.state.buildings.find((b) => b.type === 'sawmill')!.id;
  let early = 0, late = 0;
  while (w.state.mission.result === 'running') {
    step(w);
    if (w.state.tick % TICK_HZ !== 0) continue;
    const s = buildingById(w, saw)!.status;
    if (s.k !== 'OUTPUT_FULL' || s.cause !== 'NO_WAGON') continue;
    const tr = activeTranche(w.state.mission.contract!);
    if (tr === 0) {
      early++;
      eq(outputSurplus(w, saw), 'SPARE', `t=${w.state.tick / TICK_HZ}s: planks not due yet`);
      assert(cureFor(w, saw) !== 'wagon', `t=${w.state.tick / TICK_HZ}s: no "Kup wóz" for next-letter planks`);
    } else {
      late++;
      eq(outputSurplus(w, saw), null, `t=${w.state.tick / TICK_HZ}s: planks letter due, planks needed`);
    }
  }
  assert(early > 0, `the state was seen (${early} s before the planks letter, ${late} s after)`);
  eq(w.state.mission.result, 'won', 'link alone wins');
  eq(stars(w), 3, 'link alone: 3 seals');
});
