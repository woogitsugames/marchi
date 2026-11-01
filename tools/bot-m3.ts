// Mission 3 proposal acceptance bot. Uses the real rain/surface speeds and dispatcher.
import {
  applyCommand, checkInvariants, isRaining, lineCells, step, stars, TICK_HZ,
  unexplainedStalls, type Command, type World,
} from '../src/sim/index';
import { createProposedWorld, M3_RAIN } from '../src/sim/missions-proposed';

function row(w: World, y: number, x1: number, x2: number): number[] {
  return lineCells(w.terrain.w, y * w.terrain.w + x1, y * w.terrain.w + x2);
}
function column(w: World, x: number, y1: number, y2: number): number[] {
  return lineCells(w.terrain.w, y1 * w.terrain.w + x, y2 * w.terrain.w + x);
}
function requireCommand(w: World, cmd: Command): void {
  const r = applyCommand(w, cmd);
  if (!r.ok) throw new Error(`command failed: ${JSON.stringify(cmd)} / ${JSON.stringify(r.err)}`);
}

function run(): void {
  const w = createProposedWorld('m3');
  const schedule = w.state.rain;
  if (JSON.stringify(schedule) !== JSON.stringify(M3_RAIN)) throw new Error('m3 rain missing from state.rain');
  if (isRaining(w.state)) throw new Error('rain should start at 20s');
  const stable = w.state.buildings.find((b) => b.type === 'stable')!;
  for (let i = 0; i < 2; i++) requireCommand(w, { t: 'buyWagon', stable: stable.id });

  // Let weather visibly turn the dirt main road into mud before the upgrade.
  while (w.state.tick < 25 * TICK_HZ) step(w);
  if (!isRaining(w.state)) throw new Error('m3 must be raining at 25s');
  const dirtCell = 60 + 40 * w.terrain.w;
  if (w.state.roads[dirtCell] !== 1) throw new Error('expected muddy dirt road');

  // Build intermediate buffer by the delivery corridor and connect its gate.
  requireCommand(w, { t: 'place', type: 'warehouse', x: 56, y: 43, facing: 2 });
  const warehouse = w.state.buildings.find((b) => b.type === 'warehouse')!;
  requireCommand(w, { t: 'road', surface: 1, cells: column(w, 57, 40, 42) });

  // Prioritise the long, busy middle/eastern section rather than paving all roads.
  requireCommand(w, { t: 'road', surface: 2, cells: row(w, 40, 32, 80) });
  if (Number(w.state.roads[dirtCell]) !== 2) throw new Error('paved corridor missing');

  let checked = 0, warehouseJobs = 0, rainyTicks = 0;
  const deadline = w.state.mission.contract!.deadlineTick;
  while (w.state.mission.result === 'running' && w.state.tick <= deadline) {
    step(w);
    if (isRaining(w.state)) rainyTicks++;
    if (w.state.wagons.some((wagon) => wagon.job?.from === warehouse.id || wagon.job?.to === warehouse.id)) warehouseJobs++;
    if (w.state.tick % 10 === 0) {
      const errors = [...checkInvariants(w), ...unexplainedStalls(w)];
      if (errors.length) throw new Error(`invariant at tick ${w.state.tick}: ${errors.join('; ')}`);
      checked++;
    }
  }

  const castle = w.state.buildings.find((b) => b.type === 'castle')!;
  console.log(`M3 result=${w.state.mission.result}, min=${(w.state.mission.endTick / TICK_HZ / 60).toFixed(2)}, seals=${stars(w)}, coins=${w.state.coins}, checked=${checked}`);
  console.log(`M3 rainTicks=${rainyTicks}, warehouseJobTicks=${warehouseJobs}; cargo planks=${castle.stock.planks}/24 bread=${castle.stock.bread}/16`);
  if (w.state.mission.result !== 'won' || stars(w) < 1 || rainyTicks === 0) {
    throw new Error('Mission 3 proposal was not completed in rainy weather');
  }
}
try { run(); } catch (e) { console.error(e); process.exitCode = 1; }
