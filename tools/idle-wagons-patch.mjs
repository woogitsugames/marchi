// Builds a throw-away copy of the repo (outside the worktree) whose src/sim/wagons.ts implements
// idle-wagon policies selected at runtime by env IDLE_POLICY (home | wait | grace30 | grace90).
// Research only: the real src/ is never modified.   node tools/idle-wagons-patch.mjs <targetDir>
import { cpSync, readFileSync, writeFileSync, symlinkSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const dst = resolve(process.argv[2]);
rmSync(dst, { recursive: true, force: true });
mkdirSync(dst, { recursive: true });
const skip = ['node_modules', '.git', 'dist', 'android', 'ios', 'dist-apk', 'shots'];
cpSync(root, dst, { recursive: true, filter: (src) => !skip.includes(src.split('/').pop()) });
symlinkSync(join(root, 'node_modules'), join(dst, 'node_modules'));

const f = join(dst, 'src/sim/wagons.ts');
let s = readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('patch anchor missing: ' + a); s = s.replace(a, b); };

rep(`  const home = buildingById(world, w.home);
  return home ? home.gate : -1;
}`, `  return idleTarget(world, w);
}

// ---- research patch: idle-wagon parking policies (not state; WeakMap keyed by wagon object) ----
const POLICY: string = (globalThis as any).process?.env?.IDLE_POLICY ?? 'home';
const parks = new WeakMap<object, { node: number; since: number }>();
function homeGate(world: World, w: Wagon): number {
  const home = buildingById(world, w.home);
  return home ? home.gate : -1;
}
function idleTarget(world: World, w: Wagon): number {
  if (POLICY === 'home') return homeGate(world, w);
  const p = parks.get(w);
  if (!p) return homeGate(world, w);
  if (POLICY === 'wait') return p.node;
  const grace = (POLICY === 'grace30' ? 30 : 90) * 10;
  if (world.state.tick - p.since < grace) return p.node;
  return homeGate(world, w);
}
/** Called when a wagon finished unloading at \`node\`: pick its parking node (<=1 idle wagon per node). */
function onDelivered(world: World, w: Wagon, node: number): void {
  if (POLICY === 'home') return;
  const taken = new Set<number>();
  for (const o of world.state.wagons) {
    if (o === w || o.job) continue;
    const q = parks.get(o);
    taken.add(q ? q.node : (o.next >= 0 ? o.next : o.at));
  }
  let pick = node;
  if (taken.has(node)) {
    const m = dijkstra(world, node, false, false);
    let bestT = Infinity;
    pick = homeGate(world, w);
    for (const b of world.state.buildings) {
      if (taken.has(b.gate) || b.type === 'stable') continue;
      const t = m.dist[b.gate]!;
      if (t < bestT) { bestT = t; pick = b.gate; }
    }
  }
  parks.set(w, { node: pick, since: world.state.tick });
}`);
rep(`  w.cargoQty = 0;
  w.cargoGood = null;
  w.job = null;
  w.pathVer = -1;
  w.status = { k: 'RETURNING' };
}`, `  w.cargoQty = 0;
  w.cargoGood = null;
  w.job = null;
  w.pathVer = -1;
  w.status = { k: 'RETURNING' };
  onDelivered(world, w, to.gate);
}`);
writeFileSync(f, s);
console.log('patched copy at', dst);
