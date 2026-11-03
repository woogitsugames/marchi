// Partial wagon loads research driver (backlog P3). Runs every mission bot strategy (m1-m12) and the
// free valley plan, printing one JSON line per run with the outcome and the probe's load / wagon /
// status counts. Only runs inside the patched copy built by tools/partial-loads-patch.mjs (it imports
// the probe module that exists only there); the policy is chosen by env LOAD_POLICY.
//   node tools/partial-loads-patch.mjs /tmp/pl && cd /tmp/pl && LOAD_POLICY=d4 npx tsx tools/partial-loads.ts [m1 m2 ... m12 sandbox]
import { TICK_HZ, stateHash } from '../src/sim/index';
// @ts-ignore research-only module (patched copy)
import { POLICY, probe, resetProbe } from '../src/sim/plprobe';
import { plans, runStrategy } from './balance';
import { STRATEGIES as S789, runProposed as run789 } from './bot-missions-7-9';
import { STRATEGIES as S1012, runProposed as run1012 } from './bot-missions-10-12';
import { DECENT, runSandbox } from './bot-sandbox';
import { runBot } from './bot';

interface Row {
  policy: string; scenario: string; strategy: string; result: string; minutes: number; seals: number;
  missed?: number; expect?: number; hash?: string; extra?: Record<string, unknown>; errors: number; probe: unknown;
}

function snapshot(): unknown {
  const p = probe();
  return {
    assigned: p.assigned, loaded: p.loaded, delivered: p.delivered, odometer: Math.round(p.odometer), wagons: p.wagons,
    wagonTicks: p.wagonTicks, jobTicks: p.jobTicks, idleTicks: p.idleTicks, busyNoJob: p.busyNoJob, ticks: p.ticks,
    status: p.status, confusing: p.confusing, heldPrevented: p.heldPrevented, heldWithFreeWagon: p.heldWithFreeWagon, heldStatus: p.heldStatus,
  };
}
const out = (r: Row) => console.log(JSON.stringify(r));

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['m1bot', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12', 'sandbox'];
for (const id of ids) {
  if (id === 'm1bot') {
    resetProbe();
    const r = runBot({ checkEvery: 10 });
    out({ policy: POLICY, scenario: 'm1', strategy: 'npm run bot', result: r.result, minutes: r.endTick / TICK_HZ / 60, seals: r.stars,
      errors: r.violations.length, probe: snapshot() });
  } else if (plans[id]) {
    for (const s of plans[id]!) {
      resetProbe();
      const r = runStrategy(id, s);
      out({ policy: POLICY, scenario: id, strategy: s.name, result: r.result, minutes: r.minutes, seals: r.seals, missed: r.missed,
        expect: s.expect, hash: r.hash, errors: r.errors.length, probe: snapshot() });
    }
  } else if (id === 'm7' || id === 'm8' || id === 'm9') {
    S789[id].forEach((s, i) => {
      resetProbe();
      const r = run789(id, s);
      out({ policy: POLICY, scenario: id, strategy: s.name, result: r.result, minutes: r.minutes, seals: r.seals, expect: i + 1, hash: r.hash,
        errors: r.commandErrors.length + r.invariantErrors.length, probe: snapshot() });
    });
  } else if (id === 'm10' || id === 'm11' || id === 'm12') {
    S1012[id].forEach((s, i) => {
      resetProbe();
      const r = run1012(id, s);
      out({ policy: POLICY, scenario: id, strategy: s.name, result: r.result, minutes: r.minutes, seals: r.seals, missed: r.lateTranches,
        expect: i + 1, hash: r.hash, errors: r.commandErrors.length + r.invariantErrors.length, probe: snapshot() });
    });
  } else if (id === 'sandbox') {
    const minutes = Number(process.env.SANDBOX_MIN ?? 60);
    resetProbe();
    const r = runSandbox(DECENT, minutes, { checkEvery: 50 });
    out({ policy: POLICY, scenario: 'sandbox', strategy: `decent ${minutes} min`, result: `rank ${r.rank}`, minutes, seals: r.rank,
      extra: { earned: r.earned, renown: r.renown, rankMin: r.rankMin, wagons: r.wagons, sold: r.sold }, errors: r.violations.length, probe: snapshot() });
  }
}
void stateHash;
