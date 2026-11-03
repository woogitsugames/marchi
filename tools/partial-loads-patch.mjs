// Partial wagon loads research (backlog P3, docs/research/2026-11-03-partial-loads.md).
// Builds a throw-away copy of the repo (outside the worktree) whose dispatcher implements load
// policies selected at runtime by env LOAD_POLICY, plus a read-only probe that counts load sizes,
// wagon time, distance and building statuses. Research only: the real src/ is never modified.
//   node tools/partial-loads-patch.mjs <targetDir>
// Policies (LOAD_POLICY):
//   base  - today's dispatcher (the probe only reads; the state hash equals the real src/)
//   d4    - a producer's input demand waits until it wants >= min(cap, 4) units, unless starving
//   d6    - same with a full load (want >= cap), unless starving
//   d4t8  - d4, but a demand held for 8 s in a row is served anyway (needs per-demand age = new state)
//   d4w   - d4, and a granary source must also hold >= min(want, 4) unreserved units; the castle
//           takes any amount when its next deadline (tranche / 3rd seal / contract) is <= 60 s away
//   eta4  - like d4, but a small top-up is held only while the consumer's stock (+ on the way) lasts
//           longer than 1.25 x a round trip from the nearest source; stateless
//   sb4   - d4 in the free valley only (contract missions keep today's dispatcher)
//   late4 - nothing is held: a producer's small top-up demand (want < min(cap, 4), not starving) is
//           served after every other demand of the same pass, so only a wagon that would otherwise
//           stay idle carries it (stateless; no new stall reason possible)
import { cpSync, readFileSync, writeFileSync, symlinkSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const dst = resolve(process.argv[2]);
rmSync(dst, { recursive: true, force: true });
mkdirSync(dst, { recursive: true });
const skip = ['node_modules', '.git', 'dist', 'android', 'ios', 'dist-apk', 'shots'];
cpSync(root, dst, { recursive: true, filter: (src) => !skip.includes(src.split('/').pop()) });
symlinkSync(join(root, 'node_modules'), join(dst, 'node_modules'));

function patch(rel, pairs) {
  const f = join(dst, rel);
  let s = readFileSync(f, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`patch anchor missing in ${rel}: ${a}`);
    s = s.replace(a, b);
  }
  writeFileSync(f, s);
}

// ---- probe + policy module (lives only in the patched copy) ----
writeFileSync(join(dst, 'src/sim/plprobe.ts'), `// research probe (partial loads); not part of the game
import { BUILDINGS, capacityOf, outputGoods } from './defs';
import { reachable, type World } from './network';
import type { Building, Good } from './types';

export const POLICY: string = (globalThis as any).process?.env?.LOAD_POLICY ?? 'base';
const T = (cap: number) => Math.min(cap, POLICY === 'd6' ? 6 : 4);

export interface Probe {
  assigned: Record<string, number[]>;   // kind -> qty histogram index 0..6 (assigned at dispatch)
  loaded: Record<string, number[]>;     // kind -> qty histogram (after pickup top-up)
  delivered: number;                    // units unloaded
  wagonTicks: number; jobTicks: number; idleTicks: number; busyNoJob: number;
  status: Record<string, number>;       // building status tally (sampled every 10 ticks, producers + castle)
  confusing: Record<string, number>;    // NO_INPUT.NONE_AVAILABLE / WAITING_UPSTREAM while a reachable source holds the good
  heldPrevented: number;                // dispatch decisions a policy turned down that base would have made
  heldWithFreeWagon: number;
  heldStatus: Record<string, number>;   // status shown by a held building right after the decision
  heldKeys: Set<string>;
  age: Map<string, number>;
  odometer: number; wagons: number; ticks: number;
}
export function newProbe(): Probe {
  return { assigned: {}, loaded: {}, delivered: 0, wagonTicks: 0, jobTicks: 0, idleTicks: 0, busyNoJob: 0,
    status: {}, confusing: {}, heldPrevented: 0, heldWithFreeWagon: 0, heldStatus: {}, heldKeys: new Set(), age: new Map(),
    odometer: 0, wagons: 0, ticks: 0 };
}
const G = globalThis as any;
export function probe(): Probe { if (!G.__PL) G.__PL = newProbe(); return G.__PL; }
export function resetProbe(): void { G.__PL = newProbe(); }

const hist = (m: Record<string, number[]>, k: string, q: number) => { (m[k] ??= [0, 0, 0, 0, 0, 0, 0])[Math.min(6, q)]++; };
function kindOf(world: World, to: Building): string {
  if (to.type === 'castle') return world.state.mission.id === 'sandbox' ? 'market' : 'castle';
  if (to.type === 'warehouse') return 'granary';
  return 'input';
}
export function onAssign(world: World, to: Building, qty: number): void { hist(probe().assigned, kindOf(world, to), qty); }
export function onLoaded(world: World, to: Building | null, qty: number): void { if (to) hist(probe().loaded, kindOf(world, to), qty); }
export function onDelivered(qty: number): void { probe().delivered += qty; }

/** Next deadline (ticks from now) that still matters for the contract castle. */
function urgent(world: World): boolean {
  const c = world.state.mission.contract;
  if (!c) return false;
  const now = world.state.tick;
  let next = c.deadlineTick;
  if (c.star3Tick > now) next = Math.min(next, c.star3Tick);
  for (const t of c.tranches) if (t.doneTick < 0 && t.deadlineTick > now) { next = Math.min(next, t.deadlineTick); break; }
  return next - now <= 60 * 10;
}

/**
 * Policy gate for one demand. hold = skip the demand this dispatch; whMin = least unreserved units a
 * granary must hold to be a source.
 */
export function gate(world: World, b: Building, g: Good, want: number, prio: number, starving: boolean, minQty: number, freeWagons: number,
  secs: (from: number, to: number) => number = () => Infinity): { hold: boolean; whMin: number } {
  const p = probe();
  const cap = capacityOf(g);
  let hold = false, whMin = 1;
  const holds = POLICY === 'd4' || POLICY === 'd6' || POLICY === 'd4t8' || POLICY === 'd4w' ||
    (POLICY === 'sb4' && world.state.mission.id === 'sandbox');
  if (holds && prio === 1 && !starving && want < T(cap)) hold = true;
  // eta4: hold a small top-up only while the stock in hand (and on the way) lasts longer than a
  // round trip from the nearest source (2 x loaded travel time + load/unload), with a 25 % margin
  if (POLICY === 'eta4' && prio === 1 && !starving && want < T(cap)) {
    const r = BUILDINGS[b.type].recipe!;
    const per = r.inputs[g] ?? 1;
    const coverS = Math.floor((b.stock[g] + b.incoming[g]) / per) * (r.ticks / 10);
    let trip = Infinity;
    for (const s of world.state.buildings) {
      if (s.id === b.id || (s.type !== 'warehouse' && !outputGoods(s.type).includes(g))) continue;
      if (s.stock[g] - s.reservedOut[g] <= 0) continue;
      trip = Math.min(trip, secs(s.gate, b.gate));
    }
    if (trip < Infinity && coverS > 1.25 * (2 * trip + 6)) hold = true;
  }
  const key = b.id + ':' + g;
  if (POLICY === 'd4t8') {
    if (hold) {
      const since = p.age.get(key);
      if (since === undefined) p.age.set(key, world.state.tick);
      else if (world.state.tick - since >= 80) hold = false;
    } else p.age.delete(key);
  }
  if (POLICY === 'd4w' && !starving && !(b.type === 'castle' && urgent(world))) whMin = Math.min(want, T(cap));
  // would today's dispatcher have served it? (a source with enough stock and a free wagon)
  const wouldServe = (h: boolean, wm: number): boolean => {
    if (h) return false;
    for (const s of world.state.buildings) {
      if (s.id === b.id) continue;
      const isWh = s.type === 'warehouse';
      if (!isWh && !outputGoods(s.type).includes(g)) continue;
      if (isWh && b.type === 'warehouse') continue;
      const avail = s.stock[g] - s.reservedOut[g];
      if (avail <= 0) continue;
      if (!isWh && avail < minQty) continue;
      if (isWh && avail < wm) continue;
      if (reachable(world, s.gate, b.gate)) return true;
    }
    return false;
  };
  if (POLICY !== 'base' && wouldServe(false, 1) && !wouldServe(hold, whMin)) {
    p.heldPrevented++;
    if (freeWagons > 0) { p.heldWithFreeWagon++; p.heldKeys.add(key); }
  }
  return { hold, whMin };
}

/** late4: move small, non-starving producer top-ups behind every other demand (stable). */
export function reorder<D extends { b: Building; good: Good; want: number; prio: number }>(demands: D[]): void {
  if (POLICY !== 'late4') return;
  const small = (d: D) => {
    if (d.prio !== 1) return false;
    const need = BUILDINGS[d.b.type].recipe?.inputs[d.good] ?? 1;
    const starving = d.b.stock[d.good] < need && d.b.incoming[d.good] === 0;
    return !starving && d.want < T(capacityOf(d.good));
  };
  const a = demands.filter((d) => !small(d)), b = demands.filter(small);
  demands.length = 0;
  demands.push(...a, ...b);
}

/** After diagnose(): what does a held building show? */
export function afterDiagnose(world: World): void {
  const p = probe();
  for (const key of p.heldKeys) {
    const id = Number(key.split(':')[0]);
    const b = world.state.buildings.find((x) => x.id === id);
    if (!b) continue;
    const s = b.status as any;
    const k = s.k + (s.cause ? '.' + s.cause : '');
    p.heldStatus[k] = (p.heldStatus[k] ?? 0) + 1;
  }
  p.heldKeys.clear();
}

export function onTick(world: World): void {
  const p = probe();
  const st = world.state;
  p.ticks++;
  for (const w of st.wagons) {
    p.wagonTicks++;
    if (w.job) p.jobTicks++;
    else if (w.busyTicks > 0) p.busyNoJob++;
    else p.idleTicks++;
  }
  let odo = 0;
  for (const w of st.wagons) odo += w.odometer;
  p.odometer = odo; p.wagons = st.wagons.length;
  if (st.tick % 10 !== 0 || st.mission.result !== 'running') return;
  for (const b of st.buildings) {
    if (b.type === 'stable' || b.type === 'warehouse') continue;
    const s = b.status as any;
    const k = s.k + (s.cause ? '.' + s.cause : '');
    p.status[k] = (p.status[k] ?? 0) + 1;
    if ((k === 'NO_INPUT.NONE_AVAILABLE' || k === 'WAITING_UPSTREAM') && s.good) {
      const g = s.good as Good;
      for (const src of st.buildings) {
        if (src.id === b.id) continue;
        if (src.type !== 'warehouse' && !outputGoods(src.type).includes(g)) continue;
        if (src.stock[g] - src.reservedOut[g] <= 0) continue;
        if (!reachable(world, src.gate, b.gate)) continue;
        const kk = k + (src.type === 'warehouse' ? '@granary' : '@producer');
        p.confusing[kk] = (p.confusing[kk] ?? 0) + 1;
        break;
      }
    }
  }
  void BUILDINGS;
}
`);

patch('src/sim/logistics.ts', [
  [`import type { Building, BuildingStatus, Good, Wagon } from './types';`,
   `import type { Building, BuildingStatus, Good, Wagon } from './types';\nimport { afterDiagnose, gate as plGate, onAssign, reorder as plReorder } from './plprobe';`],
  [`GOODS.indexOf(a.good) - GOODS.indexOf(c.good));`, `GOODS.indexOf(a.good) - GOODS.indexOf(c.good));\n  plReorder(demands);`],
  [`  wagon.status = { k: 'TO_PICKUP' };\n}`, `  wagon.status = { k: 'TO_PICKUP' };\n  onAssign(world, to, qty);\n}`],
  [`    const minQty = Math.min(d.want, starving ? 2 : cap);`,
   `    const minQty = Math.min(d.want, starving ? 2 : cap);
    const pl = plGate(world, d.b, d.good, d.want, d.prio, starving, minQty, free.length, (a, b) => dc.from(a).dist[b]!);
    if (pl.hold) continue;`],
  [`      if (producer && avail < minQty) continue;`,
   `      if (producer && avail < minQty) continue;\n      if (!producer && avail < pl.whMin) continue;`],
  [`  diagnose(world, unmet, pushFail, dc);\n  dc.release();`, `  diagnose(world, unmet, pushFail, dc);\n  afterDiagnose(world);\n  dc.release();`],
]);

patch('src/sim/wagons.ts', [
  [`    w.status = { k: 'TO_DROPOFF' };\n    if (qty === 0)`,
   `    w.status = { k: 'TO_DROPOFF' };\n    onLoaded(world, to ?? null, j.qty);\n    if (qty === 0)`],
  [`  to.stock[j.good] += w.cargoQty;`, `  to.stock[j.good] += w.cargoQty;\n  onDelivered(w.cargoQty);`],
]);
{
  const f = join(dst, 'src/sim/wagons.ts');
  const s = readFileSync(f, 'utf8');
  writeFileSync(f, `import { onDelivered, onLoaded } from './plprobe';\n` + s);
}
patch('src/sim/sim.ts', [
  [`  st.tick++;`, `  onTick(world);\n  st.tick++;`],
]);
{
  const f = join(dst, 'src/sim/sim.ts');
  const s = readFileSync(f, 'utf8');
  writeFileSync(f, `import { onTick } from './plprobe';\n` + s);
}
console.log('patched copy at', dst);
