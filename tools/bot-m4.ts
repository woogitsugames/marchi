// M4 acceptance bot: proof that the proposed 96x72 map and contract work
// with the CURRENT simulation (ice has NOT been wired into network/wagons).
// npx tsx tools/bot-m4.ts [--stone]
import {
  MISSIONS, applyCommand, checkInvariants, createWorld, findPath, isRaining,
  lineCells, net, step, stars, TICK_HZ, unexplainedStalls,
  type Command, type World,
} from '../src/sim/index';
import { closedSpans, M4_ICE_WINDOW } from '../src/sim/proposals/ice';
import { M4_BRIDGE, M4_MISSION } from '../src/sim/proposals/m4';

function mustApply(world: World, command: Command): void {
  const r = applyCommand(world, command);
  if (!r.ok) throw new Error(`Command failed: ${JSON.stringify(command)}: ${JSON.stringify(r.err)}`);
}

function run(stone: boolean): void {
  // Deliberately register the MissionDef only in this bot process. No sim edits.
  const previous = MISSIONS.m4;
  MISSIONS.m4 = M4_MISSION;
  try {
    const w = createWorld('m4');
    const st = w.state, t = w.terrain;
    if (t.w !== 96 || t.h !== 72) throw new Error('M4 must be 96x72');
    if (st.rain.length !== 0 || isRaining(st)) throw new Error('No rain allowed in M4');
    const bridge = lineCells(t.w, M4_BRIDGE.northY * t.w + M4_BRIDGE.x,
      M4_BRIDGE.southY * t.w + M4_BRIDGE.x);
    const water = bridge.filter((cell) => t.water[cell] === 1);
    if (water.length < 4 || water.some((cell) => st.roads[cell] !== 1)) {
      throw new Error(`Wooden bridge missing: ${water.length} water cells`);
    }
    const spans = new Set(water.map((cell) => net(w).span[cell]));
    if (spans.size !== 1 || spans.has(-1)) throw new Error('Expected exactly one wooden span');

    const wood = st.buildings.find((b) => b.type === 'woodcutter')!;
    const saw = st.buildings.find((b) => b.type === 'sawmill')!;
    const castle = st.buildings.find((b) => b.type === 'castle')!;
    const warehouse = st.buildings.find((b) => b.type === 'warehouse')!;
    if (!wood || !saw || !castle || !warehouse) throw new Error('Missing M4 logistics building');
    if (!findPath(w, wood.gate, saw.gate, true)) throw new Error('North -> south wood delivery is unreachable');
    if (!findPath(w, saw.gate, castle.gate, true)) throw new Error('Sawmill -> castle unreachable');

    const stoneAt = 60 * TICK_HZ;
    let checked = 0, crossings = 0, maxWoodBuffer = 0, iceSamples = 0;
    const deadline = st.mission.contract!.deadlineTick;
    while (st.mission.result === 'running' && st.tick <= deadline) {
      if (stone && st.tick === stoneAt) {
        mustApply(w, { t: 'road', cells: bridge, surface: 2 });
        if (water.some((cell) => st.roads[cell] !== 2)) throw new Error('Stone upgrade incomplete');
      }
      if (st.tick >= M4_ICE_WINDOW.start && st.tick < M4_ICE_WINDOW.end) {
        const closed = closedSpans(st, t);
        if (stone ? closed.size !== 0 : closed.size !== 1) {
          throw new Error(`Proposal helper disagrees with bridge surface: ${closed.size}`);
        }
        iceSamples++;
      }
      step(w); // NO ice check here until the proposal is integrated.
      maxWoodBuffer = Math.max(maxWoodBuffer, warehouse.stock.wood);
      for (const wagon of st.wagons) {
        if (wagon.next >= 0 && t.water[wagon.next] === 1 && t.water[wagon.at] !== 1) crossings++;
        if (wagon.status.k === 'BRIDGE_JAM') continue; // Existing one-lane delay is expected.
      }
      if (st.tick % 10 === 0) {
        const errors = [...checkInvariants(w), ...unexplainedStalls(w)];
        if (errors.length > 0) throw new Error(`M4 invariant at tick ${st.tick}: ${errors.join('; ')}`);
        checked++;
      }
    }
    console.log(`M4 ${stone ? 'stone@60s' : 'baseline'} (ice NOT integrated) ` +
      `result=${st.mission.result} min=${(st.mission.endTick / TICK_HZ / 60).toFixed(2)} ` +
      `seals=${stars(w)} coins=${st.coins} checks=${checked} entries=${crossings} iceSamples=${iceSamples}`);
    console.log(`M4 castle: planks=${castle.stock.planks}/36 bread=${castle.stock.bread}/20; ` +
      `warehouse peak wood=${maxWoodBuffer}`);
    if (st.mission.result !== 'won' || crossings === 0 || stars(w) < 1) {
      throw new Error('M4 map is not traversable or contract was not delivered without ice');
    }
  } finally {
    if (previous) MISSIONS.m4 = previous;
    else delete MISSIONS.m4;
  }
}

try {
  run(process.argv.includes('--stone'));
} catch (e) {
  console.error(e);
  process.exitCode = 1;
}
