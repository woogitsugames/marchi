import {
  applyCommand, checkInvariants, createWorld, explainBuilding, net, step, unexplainedStalls, type World,
} from '../src/sim/index';
import { bridgeA, bridgeB, stableId } from '../tools/bot';
import { assert, eq, test } from './harness';

function stepChecked(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    step(w);
    const v = checkInvariants(w);
    if (v.length) throw new Error(`tick ${w.state.tick}: ${v.join('; ')}`);
    const u = unexplainedStalls(w);
    if (u.length) throw new Error(`tick ${w.state.tick}: ${u.join('; ')}`);
  }
}

/** Bridge cells of crossing A (x=41). */
function bridgeCells(w: World, x: number): number[] {
  const out: number[] = [];
  for (let y = 0; y < w.terrain.h; y++) {
    const c = y * w.terrain.w + x;
    if (w.terrain.water[c] && w.state.roads[c]) out.push(c);
  }
  return out;
}

const occupied = (w: World, c: number) => w.state.wagons.some((q) => q.at === c || q.next === c);

/** Run until a loaded wagon heads south over bridge A but is not on it. */
function waitForCrossingWagon(w: World, x: number, requireLoaded = true) {
  const cells = new Set(bridgeCells(w, x));
  for (let i = 0; i < 6000; i++) {
    stepChecked(w, 1);
    for (const q of w.state.wagons) {
      if (!q.job || (requireLoaded && q.cargoQty === 0)) continue;
      if (q.path.some((c) => cells.has(c)) && !cells.has(q.at) && !(q.next >= 0 && cells.has(q.next))) {
        const cell = [...cells].find((c) => !occupied(w, c));
        if (cell !== undefined) return { wagon: q, cell };
      }
    }
  }
  throw new Error('no wagon crossed');
}

test('auto bridge: road over water becomes a wooden bridge span', () => {
  const w = createWorld('m1');
  const r = applyCommand(w, bridgeA(w));
  assert(r.ok, 'bridge built');
  const cells = bridgeCells(w, 41);
  assert(cells.length >= 2, 'has bridge cells');
  const span = net(w).span[cells[0]!]!;
  for (const c of cells) eq(net(w).span[c], span, 'same span');
});

test('demolishing a bridge mid-delivery reroutes over the other bridge, nothing duplicated', () => {
  const w = createWorld('m1');
  assert(applyCommand(w, bridgeA(w)).ok, 'A');
  assert(applyCommand(w, bridgeB(w)).ok, 'B');
  for (let i = 0; i < 3; i++) applyCommand(w, { t: 'buyWagon', stable: stableId(w) });
  const { wagon, cell } = waitForCrossingWagon(w, 41, false);
  const job = wagon.job!;
  const phase = job.phase;
  const r = applyCommand(w, { t: 'demolish', cell });
  assert(r.ok, 'demolish ok: ' + JSON.stringify(r));
  stepChecked(w, 15); // replanning happens at the next node
  assert(!wagon.path.includes(cell), 'path avoids the demolished cell');
  const bCells = new Set(bridgeCells(w, 60));
  let usedB = wagon.path.some((c) => bCells.has(c));
  // run until this leg completes (pickup loaded, or cargo delivered)
  let done = false;
  for (let i = 0; i < 5000 && !done; i++) {
    stepChecked(w, 1);
    if (bCells.has(wagon.at)) usedB = true;
    done = wagon.job !== job || job.phase !== phase;
  }
  assert(done, 'leg completed after re-route');
  assert(usedB, 'wagon crossed bridge B');
});

test('demolishing the only bridge: wagon waits with NO_ROUTE, reservations released after timeout', () => {
  const w = createWorld('m1');
  assert(applyCommand(w, bridgeA(w)).ok, 'A');
  applyCommand(w, { t: 'buyWagon', stable: stableId(w) });
  const cells = bridgeCells(w, 41);
  // find a wagon on its way to pick up across the bridge, or a loaded one
  const { wagon, cell } = waitForCrossingWagon(w, 41);
  assert(applyCommand(w, { t: 'demolish', cell }).ok, 'demolish');
  stepChecked(w, 5);
  // wagon must not stand still silently
  for (let i = 0; i < 400; i++) {
    stepChecked(w, 1);
    if (wagon.status.k === 'NO_ROUTE') break;
  }
  eq(wagon.status.k, 'NO_ROUTE', 'wagon reason');
  const castle = w.state.buildings.find((b) => b.type === 'castle')!;
  const chain = explainBuilding(w, castle.id);
  assert(chain.length >= 1 && chain[0]!.status.k !== 'IDLE', 'castle explains its stall: ' + JSON.stringify(chain));
  // waiting 30 s: invariants hold the whole time (checked in stepChecked)
  stepChecked(w, 300);
  // rebuild the missing cell -> deliveries resume
  assert(applyCommand(w, { t: 'road', surface: 1, cells: [cell] }).ok, 'rebuild');
  let resumed = false;
  for (let i = 0; i < 3000 && !resumed; i++) {
    stepChecked(w, 1);
    if (wagon.status.k !== 'NO_ROUTE') resumed = true;
  }
  assert(resumed, 'wagon moves again after rebuild');
  void cells;
});

test('cannot demolish a road cell under a wagon', () => {
  const w = createWorld('m1');
  const q = w.state.wagons[0]!;
  const r = applyCommand(w, { t: 'demolish', cell: q.at });
  assert(!r.ok, 'refused');
  if (!r.ok) assert(r.err.k === 'IS_GATE' || r.err.k === 'WAGON_ON_ROAD', 'reason ' + r.err.k);
});

test('one-lane wooden bridge: opposing wagons wait with BRIDGE_JAM and the blocker named', () => {
  const w = createWorld('m1');
  assert(applyCommand(w, bridgeA(w)).ok, 'A');
  for (let i = 0; i < 4; i++) applyCommand(w, { t: 'buyWagon', stable: stableId(w) });
  let seen = false;
  for (let i = 0; i < 7000 && !seen; i++) {
    stepChecked(w, 1);
    const j = w.state.wagons.find((q) => q.status.k === 'BRIDGE_JAM');
    if (j && j.status.k === 'BRIDGE_JAM') {
      const blocker = w.state.wagons.find((q) => q.id === (j.status as { blocker: number }).blocker);
      assert(!!blocker, 'blocker exists');
      seen = true;
    }
  }
  assert(seen, 'a bridge jam occurred and was explained');
});
