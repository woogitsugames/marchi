// Full-year, reproducible free-valley stress: commands are generated from live state and
// recorded once, then replayed in a fresh world. No simulation changes or fake ticks.
import {
  TICK_HZ, YEAR_TICKS, applyCommand, bridgeIceUntil, checkInvariants,
  stateHash, step, unexplainedStalls, type Command, type World,
} from '../src/sim/index';
import { genCommand, makeWorld, reachable } from '../tools/fuzz-lib';
import { seedRng } from '../src/sim/rng';
import { assert, eq, test } from './harness';

const SEEDS = [53, 1053, 2053, 3053, 4053];
const STUCK_LIMIT = 10 * 60 * TICK_HZ;
const COMMAND_EVERY = 900; // 40 varied commands during each 36,000-tick year

type Track = { signature: string; since: number };

function checkTick(w: World, seed: number, tracks: Map<number, Track>): void {
  const t = w.state.tick;
  const inv = checkInvariants(w);
  assert(inv.length === 0, 'seed ' + seed + ', tick ' + t + ': ' + inv.join('; '));
  const stalls = unexplainedStalls(w);
  assert(stalls.length === 0, 'seed ' + seed + ', tick ' + t + ': ' + stalls.join('; '));

  const ice = bridgeIceUntil(w) >= t;
  const living = new Set<number>();
  for (const wagon of w.state.wagons) {
    living.add(wagon.id);
    if (!wagon.job || (ice && wagon.status.k === 'BRIDGE_CLOSED')) {
      tracks.delete(wagon.id);
      continue;
    }
    const j = wagon.job;
    const signature = [
      wagon.at, wagon.next, wagon.edgeT, wagon.busyTicks, wagon.status.k,
      j.id, j.phase, j.from, j.to, wagon.cargoQty,
    ].join(':');
    const prev = tracks.get(wagon.id);
    if (!prev || prev.signature !== signature) {
      tracks.set(wagon.id, { signature, since: t });
      continue;
    }
    if (t - prev.since <= STUCK_LIMIT) continue;
    if (wagon.status.k === 'NO_ROUTE') {
      const targetId = wagon.status.target;
      const target = w.state.buildings.find((b) => b.id === targetId);
      // An actually disconnected target is diagnosed, not an unexplained deadlock.
      if (!target || !reachable(w, wagon.at, target.gate)) continue;
    }
    throw new Error('seed ' + seed + ', tick ' + t + ': wagon ' + wagon.id +
      ' stuck outside ice for ' + (t - prev.since) + ' ticks as ' +
      JSON.stringify(wagon.status) + ', job=' + JSON.stringify(j));
  }
  for (const id of tracks.keys()) if (!living.has(id)) tracks.delete(id);
}

function runYear(seed: number, replay?: readonly Command[]): {
  hash: string; commands: Command[]; accepted: number;
} {
  const w = makeWorld('sandbox@5', 4000);
  assert(w.seasons, 'full-year fuzz must use the seasonal free valley');
  const rng = seedRng(seed ^ 0x53e4501);
  const commands: Command[] = [];
  const tracks = new Map<number, Track>();
  let accepted = 0, cursor = 0;
  for (let t = 0; t < YEAR_TICKS; t++) {
    if (t % COMMAND_EVERY === seed % COMMAND_EVERY) {
      const cmd = replay ? replay[cursor++] : genCommand(w, rng);
      assert(!!cmd, 'replay command exists at tick ' + t);
      const result = applyCommand(w, cmd);
      if (result.ok) accepted++;
      if (!replay) commands.push(cmd);
    }
    step(w);
    if (!replay) checkTick(w, seed, tracks);
  }
  eq(w.state.tick, YEAR_TICKS, 'a full calendar year ran');
  if (replay) eq(cursor, replay.length, 'all recorded commands replayed');
  return { hash: stateHash(w), commands, accepted };
}

test('seasons fuzz: five seeds, 36,000 ticks each, per-tick conservation/stalls, 10 min limit, replay hashes', () => {
  // CPU time, not wall time: a loaded machine (parallel agents, layout runs) stretched wall
  // time past the limit while the fuzz itself did not get slower.
  const start = process.cpuUsage();
  for (const seed of SEEDS) {
    const first = runYear(seed);
    assert(first.commands.length >= 30, 'seed ' + seed + ': commands generated');
    assert(first.accepted > 0, 'seed ' + seed + ': at least one valid command');
    const second = runYear(seed, first.commands);
    eq(second.hash, first.hash, 'seed ' + seed + ': deterministic full-year replay');
    eq(second.accepted, first.accepted, 'seed ' + seed + ': command acceptance is deterministic');
  }
  const ms = process.cpuUsage(start).user / 1000;
  assert(ms <= 25_000, 'full-year fuzz took ' + ms.toFixed(0) +
    ' ms CPU (>25,000 ms); shorten the stress configuration and document the reduced coverage');
});
