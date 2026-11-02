// Mission X (D-47): how often the sawmill's card names the wood shortage while the sawmill is not working.
// npx tsx tools/supply-readability.ts
// before: the sim status alone (NO_INPUT CONTESTED) / the D-38 shared-input note (sharedInput);
// after: + the thin-load note (thinDelivery: "wagon carries only 2 of 6 — the woodcutter cannot keep up").
// The reads never write state: each run's final hash is compared with a run that does not read.
import { TICK_HZ, applyCommand, createWorld, hashState, sharedInput, step, thinDelivery, type World } from '../src/sim/index';
import { STRATEGIES, type Strategy } from './bot-missions-10-12';

export interface SupplyRun {
  strategy: string; idleSec: number;
  contested: number; shared: number; thin: number; after: number;
  /** Idle seconds with "wood on the way" on the card. */
  onTheWay: number; onTheWayExplained: number;
  hashSame: boolean;
}

function play(s: Strategy, read: (w: World) => void): World {
  const w = createWorld('m10');
  let done = false;
  while (w.state.mission.result === 'running') {
    if (!done && w.state.tick >= s.after * TICK_HZ) { for (const c of s.cmds(w)) applyCommand(w, c); done = true; }
    step(w);
    read(w);
  }
  return w;
}

export function supplyRun(s: Strategy): SupplyRun {
  const r: SupplyRun = { strategy: s.name, idleSec: 0, contested: 0, shared: 0, thin: 0, after: 0, onTheWay: 0, onTheWayExplained: 0, hashSame: false };
  const w = play(s, (w) => {
    if (w.state.tick % TICK_HZ) return;
    for (const b of w.state.buildings) {
      if (b.type !== 'sawmill' || b.status.k === 'WORKING') continue;
      r.idleSec++;
      const c = b.status.k === 'NO_INPUT' && b.status.cause === 'CONTESTED';
      const sh = sharedInput(w, b.id) !== null;
      const th = thinDelivery(w, b.id) !== null;
      if (c) r.contested++;
      if (c || sh) r.shared++;
      if (th) r.thin++;
      if (c || sh || th) r.after++;
      if (b.status.k === 'WAITING_DELIVERY') { r.onTheWay++; if (th) r.onTheWayExplained++; }
    }
  });
  r.hashSame = hashState(w.state) === hashState(play(s, () => {}).state);
  return r;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) : '0.0') + ' %';
  for (const s of STRATEGIES.m10) {
    const r = supplyRun(s);
    console.log(`${s.name.padEnd(34)} idle ${String(r.idleSec).padStart(4)} s | CONTESTED ${pct(r.contested, r.idleSec)} | +shared ${pct(r.shared, r.idleSec)} | thin ${pct(r.thin, r.idleSec)} | after ${pct(r.after, r.idleSec)} | "on the way" explained ${pct(r.onTheWayExplained, r.onTheWay)} of ${r.onTheWay} s | hash same ${r.hashSame}`);
  }
}
