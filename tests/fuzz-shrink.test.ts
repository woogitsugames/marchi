// D-231: shrink cut a snapshot scenario using an absolute failure tick as a relative duration.
import { cutAfterFailure, type Scenario } from '../tools/fuzz-lib';
import { eq, test } from './harness';

test('fuzz shrink: cutting after a failure converts absolute ticks of a snapshot run', () => {
  const sc: Scenario = { mission: 'valley-75', coins: 4000, ticks: 9000, saveAt: 1034, commands: [
    { tick: 45100, cmd: { t: 'buyWagon', stable: 3 } },
    { tick: 46000, cmd: { t: 'buyWagon', stable: 3 } },
  ] };
  // the snapshot starts at absolute tick 45000; the failure happens 500 ticks into the run
  const cut = cutAfterFailure(sc, 45500, 45000);
  eq(cut.ticks, 501, 'relative duration');
  eq(cut.commands.length, 1, 'only commands before the failure stay');
  eq(cut.saveAt, -1, 'a save after the cut is dropped');
  // a mission run starts at tick 0: absolute and relative coincide
  const m = cutAfterFailure({ ...sc, mission: 'm1', saveAt: 100, commands: [{ tick: 50, cmd: { t: 'buyWagon', stable: 3 } }] }, 700, 0);
  eq(m.ticks, 701, 'mission duration');
  eq(m.saveAt, 100, 'save before the failure kept');
  eq(m.commands.length, 1, 'command kept');
});
