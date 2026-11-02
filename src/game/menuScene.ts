// Scripted worlds the app shows without a player: the menu backdrop and the ?bot=1 debug plan for screenshots.
// Game code, not tools: the production bundle must not import tools/ (D-51). tools/bot.ts re-exports these.
import { applyCommand, createWorld, lineCells, type Command, type World } from '../sim/index';

/** Cells of a polyline of map points, joined without repeating the corners. */
export function polyline(w: World, pts: [number, number][]): number[] {
  const W = w.terrain.w;
  const out: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const seg = lineCells(W, a[1] * W + a[0], b[1] * W + b[0]);
    out.push(...(i === 1 ? seg : seg.slice(1)));
  }
  return out;
}

/** Mission I's wooden crossing at x = 41 (the lesson's fix). */
export function bridgeA(w: World): Command {
  return { t: 'road', surface: 1, cells: polyline(w, [[41, 24], [41, 44]]) };
}

/** Id of the first stable (where wagons are bought). */
export function stableId(w: World): number {
  return w.state.buildings.find((b) => b.type === 'stable')!.id;
}

/** Menu backdrop: mission I's valley with the bridge built and two extra wagons on the roads. */
export function menuWorld(): World {
  const w = createWorld('m1');
  applyCommand(w, bridgeA(w));
  for (let i = 0; i < 2; i++) applyCommand(w, { t: 'buyWagon', stable: stableId(w) });
  return w;
}

/** ?bot=1: the bridge and four wagons, enough for a 3-seal mission I in screenshots. */
export function botPlan(w: World): Command[] {
  const plan: Command[] = [bridgeA(w)];
  for (let i = 0; i < 4; i++) plan.push({ t: 'buyWagon', stable: stableId(w) });
  return plan;
}
