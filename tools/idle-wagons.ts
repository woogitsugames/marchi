// Idle-wagon research driver (backlog P3). Plays scenarios headless and prints one JSON line per run.
// Policy is chosen by env IDLE_POLICY (home|wait|grace30|grace90) and only has an effect inside the
// patched copy built by tools/idle-wagons-patch.mjs; in the real repo every run is policy "home".
//   npx tsx tools/idle-wagons.ts <scenario> <wagons|nat> [minutes]
//   scenario: m1 | m5 | m9 | sandbox | bench
import {
  applyCommand, checkInvariants, createWorld, lineCells, step, stateHash, TICK_HZ, unexplainedStalls,
  type Command, type World,
} from '../src/sim/index';
import { DECENT, runSandbox } from './bot-sandbox';
import { benchWorld } from './bench';
import { bridgeA } from './bot';
import { withProposal } from './bot-missions-7-9';
import { M9_WOODCUTTER_SITE } from '../src/sim/proposals/missions-7-9';

const stableOf = (w: World) => w.state.buildings.find((b) => b.type === 'stable')!;
const col = (w: World, x: number, y1: number, y2: number) => lineCells(w.terrain.w, y1 * w.terrain.w + x, y2 * w.terrain.w + x);

const buy = (w: World): Command => ({ t: 'buyWagon', stable: stableOf(w).id });

class Meter {
  ticks = 0; wagonTicks = 0; working = 0; idleDrive = 0; idleStand = 0; idleAtStable = 0; busy = 0;
  jamTicks = 0; jamMax = 0; gateSum = 0; gateMax = 0; gateJobsStart = 0;
  deliveries = 0; units = 0; jobs = 0;
  appr: number[] = []; stableDist: number[] = [];
  private prev = new Map<number, { jobId: number; phase: string; odo: number; qty: number }>();
  private apprStart = new Map<number, number>();
  constructor(readonly w: World) {}
  sample(): void {
    const w = this.w, st = w.state, g = stableOf(w).gate, W = w.terrain.w;
    this.ticks++;
    let gate = 0, jam = 0;
    for (const q of st.wagons) {
      this.wagonTicks++;
      const p = this.prev.get(q.id);
      if (q.job) this.working++;
      else if (q.busyTicks > 0) this.busy++;
      else if (q.next >= 0) this.idleDrive++;
      else { this.idleStand++; if (q.at === g) this.idleAtStable++; }
      if (q.status.k === 'BRIDGE_JAM') jam++;
      if (q.at === g && q.next < 0) gate++;
      // job transitions
      const cur = q.job;
      if (cur && (!p || p.jobId !== cur.id)) {
        this.jobs++;
        const node = q.next >= 0 ? q.next : q.at;
        const dx = (node % W) - (g % W), dy = Math.floor(node / W) - Math.floor(g / W);
        this.stableDist.push(Math.sqrt(dx * dx + dy * dy));
        this.apprStart.set(q.id, q.odometer);
      }
      if (cur && cur.phase === 'dropoff' && p && p.phase === 'pickup' && p.jobId === cur.id) {
        this.appr.push(q.odometer - (this.apprStart.get(q.id) ?? q.odometer));
      }
      if (p && p.jobId >= 0 && !cur && p.phase === 'dropoff' && p.qty > 0) { this.deliveries++; this.units += p.qty; }
      this.prev.set(q.id, { jobId: cur ? cur.id : -1, phase: cur ? cur.phase : '', odo: q.odometer, qty: cur ? cur.qty : (p && cur === null ? p.qty : 0) });
      if (cur) this.prev.get(q.id)!.qty = cur.qty;
    }
    this.jamTicks += jam; this.jamMax = Math.max(this.jamMax, jam);
    this.gateSum += gate; this.gateMax = Math.max(this.gateMax, gate);
  }
  out(w: World, extra: Record<string, unknown>) {
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const wt = this.wagonTicks || 1;
    return {
      policy: process.env.IDLE_POLICY ?? 'home', wagons: w.state.wagons.length, minutes: +(this.ticks / TICK_HZ / 60).toFixed(2),
      pctWorking: +(100 * this.working / wt).toFixed(1), pctIdleDrive: +(100 * this.idleDrive / wt).toFixed(1),
      pctIdleStand: +(100 * this.idleStand / wt).toFixed(1), pctIdleAtStable: +(100 * this.idleAtStable / wt).toFixed(1),
      jobs: this.jobs, deliveries: this.deliveries, units: this.units,
      unitsPerMin: +(this.units / (this.ticks / TICK_HZ / 60 || 1)).toFixed(2),
      meanApproachM: +avg(this.appr).toFixed(1), meanStableDistCells: +avg(this.stableDist).toFixed(1),
      gateMean: +(this.gateSum / (this.ticks || 1)).toFixed(2), gateMax: this.gateMax,
      jamPctWagonTime: +(100 * this.jamTicks / wt).toFixed(2), jamMax: this.jamMax,
      silver: w.state.ledger.silverEarned, hash: stateHash(w), ...extra,
    };
  }
}

function boost(w: World, target: number | 'nat'): void {
  if (target === 'nat') return;
  w.state.coins += 1e6;
  while (w.state.wagons.length < target) applyCommand(w, { t: 'buyWagon', stable: stableOf(w).id });
}
const check = (w: World, bad: string[]) => {
  const v = [...checkInvariants(w), ...unexplainedStalls(w)];
  if (v.length && bad.length < 5) bad.push(`tick ${w.state.tick}: ${v.join('; ')}`);
};

function missionRun(id: string, plan: (w: World) => Command[], target: number | 'nat', maxMin: number) {
  const w = createWorld(id);
  for (const c of plan(w)) applyCommand(w, c);
  boost(w, target);
  const m = new Meter(w), bad: string[] = [];
  while (w.state.mission.result === 'running' && w.state.tick < maxMin * 60 * TICK_HZ) {
    step(w); m.sample();
    if (w.state.tick % 10 === 0) check(w, bad);
  }
  return m.out(w, { result: w.state.mission.result, endMin: +(w.state.tick / TICK_HZ / 60).toFixed(2), violations: bad.length });
}

const [scenario = 'm1', wagonsArg = 'nat', minArg] = process.argv.slice(2);
const target: number | 'nat' = wagonsArg === 'nat' ? 'nat' : Number(wagonsArg);
const minutes = Number(minArg ?? 0);
let res: unknown;
if (scenario === 'm1') res = missionRun('m1', (w) => [bridgeA(w), buy(w), buy(w), buy(w), buy(w)], target, minutes || 20);
else if (scenario === 'm5') res = missionRun('m5', (w) => [{ t: 'road', surface: 1, cells: col(w, 37, 38, 39) }, buy(w)], target, minutes || 15);
else if (scenario === 'm9') res = withProposal('m9', () => missionRun('m9', (w) => [{ t: 'place', type: 'woodcutter', ...M9_WOODCUTTER_SITE }, buy(w), buy(w)], target, minutes || 25));
else if (scenario === 'bench') {
  const w = benchWorld(target === 'nat' ? 20 : target);
  const m = new Meter(w), bad: string[] = [];
  for (let i = 0; i < (minutes || 10) * 60 * TICK_HZ; i++) { step(w); m.sample(); if (i % 10 === 0) check(w, bad); }
  res = m.out(w, { violations: bad.length });
} else if (scenario === 'sandbox') {
  let m: Meter | null = null;
  const r = runSandbox(DECENT, minutes || 30, {
    checkEvery: 10,
    onTick: (w) => {
      if (!m) { m = new Meter(w); if (target !== 'nat') { w.state.coins += 1e6; } }
      if (target !== 'nat' && w.state.tick % 10 === 0 && w.state.wagons.length < target) {
        applyCommand(w, { t: 'buyWagon', stable: stableOf(w).id });
      }
      m.sample();
    },
  });
  // the Meter needs the world for output; rebuild its summary from the captured instance
  res = { ...(m as unknown as Meter).out((m as unknown as Meter).w, { earned: r.earned, rank: r.rank, violations: r.violations.length }) };
} else throw new Error('unknown scenario ' + scenario);
console.log(JSON.stringify({ scenario, ...(res as object) }));
