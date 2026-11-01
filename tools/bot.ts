// Scripted player for mission 1. Used by tests and `npm run bot`.
import {
  applyCommand, checkInvariants, createWorld, lineCells, step, stars, TICK_HZ, unexplainedStalls,
  type Command, type World,
} from '../src/sim/index';

export const cell = (w: World, x: number, y: number): number => y * w.terrain.w + x;

export function polyline(w: World, pts: [number, number][]): number[] {
  const out: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const seg = lineCells(w.terrain.w, cell(w, pts[i - 1]![0], pts[i - 1]![1]), cell(w, pts[i]![0], pts[i]![1]));
    out.push(...(i === 1 ? seg : seg.slice(1)));
  }
  return out;
}

/** Bridge A: straight north-south crossing at x=41. */
export function bridgeA(w: World): Command {
  return { t: 'road', surface: 1, cells: polyline(w, [[41, 24], [41, 44]]) };
}
/** Bridge B: second crossing further east at x=60. */
export function bridgeB(w: World): Command {
  return { t: 'road', surface: 1, cells: polyline(w, [[56, 24], [60, 24], [60, 44]]) };
}

export function stableId(w: World): number {
  return w.state.buildings.find((b) => b.type === 'stable')!.id;
}

export interface BotResult {
  result: string;
  endTick: number;
  stars: number;
  coins: number;
  wagons: number;
  violations: string[];
}

/** Plays mission 1: bridge, two extra wagons, then waits. Checks invariants every `checkEvery` ticks. */
export function runBot(opts: { checkEvery?: number; maxTicks?: number; log?: boolean; extraWagons?: number } = {}): BotResult {
  const w = createWorld('m1');
  const checkEvery = opts.checkEvery ?? 1;
  const violations: string[] = [];
  const plan: Command[] = [bridgeA(w)];
  for (let i = 0; i < (opts.extraWagons ?? 4); i++) plan.push({ t: 'buyWagon', stable: stableId(w) });
  for (const c of plan) {
    const r = applyCommand(w, c);
    if (!r.ok) violations.push('command failed: ' + JSON.stringify(r.err));
  }
  const maxTicks = opts.maxTicks ?? 20 * 60 * TICK_HZ;
  while (w.state.mission.result === 'running' && w.state.tick < maxTicks) {
    step(w);
    if (w.state.tick % checkEvery === 0) {
      const v = checkInvariants(w);
      if (v.length) { violations.push(`tick ${w.state.tick}: ${v.join('; ')}`); break; }
      const u = unexplainedStalls(w);
      if (u.length) { violations.push(`tick ${w.state.tick}: ${u.join('; ')}`); break; }
    }
    if (opts.log && w.state.tick % (60 * TICK_HZ) === 0) {
      const castle = w.state.buildings.find((b) => b.type === 'castle')!;
      console.log(`t=${w.state.tick / TICK_HZ}s castle planks=${castle.stock.planks} bread=${castle.stock.bread} ` +
        w.state.buildings.map((b) => `${b.type}:${b.status.k}`).join(' '));
    }
  }
  return {
    result: w.state.mission.result, endTick: w.state.mission.endTick, stars: stars(w),
    coins: w.state.coins, wagons: w.state.wagons.length, violations,
  };
}
