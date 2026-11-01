// Mission 2 proposal acceptance bot. No edit/registration in missions.ts.
import {
  applyCommand, checkInvariants, explainWagon, isRaining, lineCells, step, stars, TICK_HZ,
  unexplainedStalls, type Command, type World,
} from '../src/sim/index';
import { createWorld } from '../src/sim/index';

function cells(w: World, x: number, y1: number, y2: number): number[] {
  return lineCells(w.terrain.w, y1 * w.terrain.w + x, y2 * w.terrain.w + x);
}
function requireCommand(w: World, cmd: Command): void {
  const r = applyCommand(w, cmd);
  if (!r.ok) throw new Error(`command failed: ${JSON.stringify(cmd)} / ${JSON.stringify(r.err)}`);
}

function run(): void {
  const w = createWorld('m2');
  const stable = w.state.buildings.find((b) => b.type === 'stable');
  if (!stable) throw new Error('stable missing');
  if (isRaining(w.state)) throw new Error('m2 must not introduce rain as a second lesson');

  // Verify the start is ONE WOODEN 4-cell river crossing.
  const crossing = cells(w, 51, 30, 42);
  const waterCells = crossing.filter((c) => w.terrain.water[c] === 1);
  if (waterCells.length < 4 || waterCells.some((c) => w.state.roads[c] !== 1)) {
    throw new Error(`m2 initial bridge incorrect: ${waterCells.length} wooden water cells`);
  }
  for (let i = 0; i < 2; i++) requireCommand(w, { t: 'buyWagon', stable: stable.id });

  let seenJam = 0, sampleExplanation = '';
  let checked = 0;
  const beforeFix = 45 * TICK_HZ;
  const deadline = w.state.mission.contract!.deadlineTick;
  while (w.state.mission.result === 'running' && w.state.tick <= deadline) {
    if (w.state.tick === beforeFix) {
      // An in-place two-lane stone upgrade: all water cells AND cobbled approaches.
      // A second all-wood crossing at x=63 would be the cheaper alternative.
      requireCommand(w, { t: 'road', cells: crossing, surface: 2 });
      if (waterCells.some((c) => w.state.roads[c] !== 2)) throw new Error('stone upgrade incomplete');
      console.log(`m2 upgraded to stone after ${beforeFix / TICK_HZ}s; jam samples=${seenJam}`);
    }
    step(w);
    if (w.state.tick <= beforeFix) {
      const jam = w.state.wagons.find((wagon) => wagon.status.k === 'BRIDGE_JAM');
      if (jam) {
        seenJam++;
        if (!sampleExplanation) sampleExplanation = JSON.stringify(explainWagon(w, jam.id));
      }
    }
    if (w.state.tick % 10 === 0) {
      const errors = [...checkInvariants(w), ...unexplainedStalls(w)];
      if (errors.length) throw new Error(`invariant at tick ${w.state.tick}: ${errors.join('; ')}`);
      checked++;
    }
  }
  const castle = w.state.buildings.find((b) => b.type === 'castle')!;
  const won = w.state.mission.result === 'won' && stars(w) >= 1;
  console.log(`M2 result=${w.state.mission.result}, min=${(w.state.mission.endTick / TICK_HZ / 60).toFixed(2)}, seals=${stars(w)}, coins=${w.state.coins}, checked=${checked}`);
  console.log(`M2 cargo planks=${castle.stock.planks}/24 bread=${castle.stock.bread}/16; BRIDGE_JAM samples before repair=${seenJam}`);
  if (sampleExplanation) console.log('M2 why-stalled sample: ' + sampleExplanation);
  if (!won) throw new Error('Mission 2 proposal was not completed before deadline');
}
try { run(); } catch (e) { console.error(e); process.exitCode = 1; }
