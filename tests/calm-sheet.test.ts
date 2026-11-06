// "Calm everywhere" (D-193, owner 2026-11-06): every stall the HUD pins in brass reads calm in its sheet too —
// the pickup already on its way, a full yard whose customer still takes it, a season-slowed input — and a calm
// stall never gets "Kup wóz" from its own chain; only the fleet cue offers it (D-128).
import { TICK_HZ, createWorld, newPaceLog, samplePace, stateHash, step, wagonEta, type World } from '../src/sim/index';
import { fleetCueFor, forecastFor, paceCard, sampleFleet } from '../src/ui/paceCard';
import { MIN_STALL_TICKS, calmWhy, cureFor, quietStall, rankStalls } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

function runTo(w: World, ticks: number): void {
  while (w.state.tick < ticks) step(w);
}

test('calm sheet: mission II farm waiting for its pickup reads calm, with the wagon ETA (D-193)', () => {
  const w = createWorld('m2');
  runTo(w, 45 * TICK_HZ);
  const farm = w.state.buildings.find((b) => b.status.k === 'WAITING_PICKUP' && b.stalledTicks >= MIN_STALL_TICKS);
  if (!farm || farm.status.k !== 'WAITING_PICKUP') throw new Error('expected a pickup wait at 0:45');
  eq(calmWhy(w, farm), null, 'no calmWhy: the case D-182 (a) left open');
  const hash = stateHash(w);
  assert(quietStall(w, farm), 'the sheet reads it calm');
  eq(stateHash(w), hash, 'read-only');
  const e = rankStalls(w).find((s) => s.id === farm.id);
  assert(!!e && e.minor && !e.crit, 'its pin is the brass (minor) one');
  const eta = wagonEta(w, farm.status.wagon);
  assert(!!eta && eta.destBuilding === farm.id && eta.toDest > 0, 'the wagon is on its way to this yard');
  assert(cureFor(w, farm.id) !== 'wagon', 'no "Kup wóz" from its chain');
});

test('calm sheet: every minor pin reads calm in its sheet, every critical one does not (missions II, III, XI)', () => {
  for (const id of ['m2', 'm3', 'm11'] as const) {
    const w = createWorld(id);
    while (w.state.tick < 6 * 60 * TICK_HZ && w.state.mission.result === 'running') {
      step(w);
      if (w.state.tick % (10 * TICK_HZ)) continue;
      for (const s of rankStalls(w)) {
        const b = w.state.buildings.find((q) => q.id === s.id)!;
        if (s.crit) assert(!quietStall(w, b) || calmWhy(w, b) !== null, `${id} ${b.type}: a critical pin never reads calm`);
        // a pickup whose wagon is held at a bridge keeps its clay (the root is a real wait)
        else if (s.minor && b.status.k !== 'WAITING_PICKUP') assert(quietStall(w, b), `${id} ${b.type} ${b.status.k}: a brass pin reads calm`);
      }
    }
  }
});

test('calm sheet: the D-128 fleet cue still offers "Kup wóz" on a long pickup wait (mission XI)', () => {
  const w = createWorld('m11');
  const log = newPaceLog();
  let pc: ReturnType<typeof paceCard> = null;
  while (w.state.tick < 7 * 60 * TICK_HZ && w.state.mission.result === 'running') {
    step(w); samplePace(log, w); sampleFleet(w);
    if (w.state.tick % TICK_HZ) continue;
    pc = paceCard(w, forecastFor(w, log));
    if (pc?.k === 'fleet') break;
  }
  if (!pc || pc.k !== 'fleet') throw new Error('expected the fleet card');
  const farm = w.state.buildings.find((b) => b.id === pc!.producer)!;
  eq(farm.status.k, 'WAITING_PICKUP', 'a pickup wait');
  assert(quietStall(w, farm), 'calm');
  // the sheet's gate: no own cure, so the fleet cue is consulted and holds
  assert(!cureFor(w, farm.id), 'no own cure keeps the sheet paced');
  eq(fleetCueFor(w, forecastFor(w, log), farm)?.producer, farm.id, 'the fleet cue offers the wagon');
});
