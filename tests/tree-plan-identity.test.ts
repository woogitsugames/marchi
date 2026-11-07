// Perf day 14 (D-311, D-312): the reed candidates and the tree plan are kept per ground and filtered per world. Each
// test keeps a copy of the replaced code (placeTrees and the reed scan before D-311 / D-312) as the reference and
// compares bit for bit (Object.is) on several worlds, through road and building changes, with grounds alternating so
// both a fresh and a kept plan are used.
import { createWorld, type World } from '../src/sim/index';
import { net } from '../src/sim/index';
import { CELL, Heightfield } from '../src/render/heightfield';
import { hash3, rng, vnoise } from '../src/render/models/kit';
import { TREE_KINDS, TREE_SIZE } from '../src/render/models/treeKinds';
import { menuWorld } from '../src/game/menuScene';
import { cellDistance, fieldClear, K, makeTree, pickKind, placeTrees, reedCandidates, type Tree } from '../src/render/placement';
import { RoadField } from '../src/render/roads';
import { eq, test } from './harness';

// --- reference: vegetation.ts placeTrees before D-312 -----------------------------------------------------------
function refPlaceTrees(world: World, hf: Heightfield, roads: RoadField): Tree[] {
  const t = world.terrain, st = world.state;
  const occ = net(world).occupied;
  const out: Tree[] = [];
  const W = t.w, H = t.h;
  const yard = new Uint8Array(W * H);
  for (const b of st.buildings) {
    const r = b.type === 'castle' ? 3 : 2;
    for (let y = b.y - r; y < b.y + b.h + r; y++) for (let x = b.x - r; x < b.x + b.w + r; x++) {
      if (x >= 0 && y >= 0 && x < W && y < H) yard[y * W + x] = 1;
    }
  }
  const blocked = (i: number) => !!(t.water[i] || t.field[i] || occ[i] !== -1 || st.roads[i] || yard[i]);
  const fd = cellDistance(W, H, (i) => t.forest[i]! > 0.3, 8);
  const rd = cellDistance(W, H, (i) => st.roads[i]! > 0 || occ[i] !== -1, 8);
  const put = (px: number, pz: number, kind: number, scale: number, rot: number) => {
    const bush = kind === K('bush');
    const crown = TREE_SIZE[TREE_KINDS[kind]!].radius * scale;
    const clear = bush ? Math.min(5.8, 2.7 + crown * 0.8) : 2.6 + crown * 0.35;
    if (roads.distAt(px, pz) < clear) return;
    if (!hf.inside(px, pz)) return;
    const cx = Math.floor(px / CELL), cz = Math.floor(pz / CELL);
    if (blocked(cz * W + cx)) return;
    if (!fieldClear(t, px, pz, bush ? crown * 0.75 : 1.6)) return;
    const py = hf.height(px, pz);
    if (py < hf.waterLevel + (kind === K('bush') ? 0.3 : 0.45)) return;
    out.push(makeTree(px, py, pz, kind, rot, scale));
  };
  const bushes = (x: number, y: number, n: number, r: () => number, s0 = 0.7) => {
    for (let k = 0; k < n; k++) put((x + r()) * CELL, (y + r()) * CELL, K('bush'), s0 + r() * 0.55, r() * 6.28);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (blocked(i)) continue;
      const r = rng(i * 7919 + 17);
      const f = t.forest[i]!;
      if (f >= 0.05) {
        let n = Math.floor(f * 1.3 + r() * 0.9);
        if (n > 2) n = 2;
        for (let k = 0; k < n; k++) {
          const kind = pickKind(r(), y < 22 && f > 0.2);
          put((x + 0.1 + r() * 0.8) * CELL, (y + 0.1 + r() * 0.8) * CELL, kind, 0.72 + r() * 0.45, r() * Math.PI * 2);
        }
        if (f < 0.6 && r() < 0.9 - f) bushes(x, y, 1 + (r() < 0.5 ? 1 : 0), r);
      } else {
        const d = fd[i]!;
        if (d < 3.5) {
          const p = Math.pow(1 - d / 3.5, 1.4);
          const clump = vnoise(x / 3, y / 3, 2.5, 85) + p * 0.45;
          if (clump > 0.62 && r() < p + 0.25) bushes(x, y, 1 + (r() < p ? 1 : 0) + (r() < p * 0.5 ? 1 : 0), r, 0.6);
          if (clump > 0.55 && r() < p * 0.35) put((x + 0.2 + r() * 0.6) * CELL, (y + 0.2 + r() * 0.6) * CELL, r() < 0.6 ? K('birch') : y < 22 ? K('spruce') : K('pine'), 0.55 + r() * 0.3, r() * 6.28);
        }
        const fieldN = (x > 0 && t.field[i - 1]) || (x < W - 1 && t.field[i + 1]) || (y > 0 && t.field[i - W]) || (y < H - 1 && t.field[i + W]);
        if (fieldN && vnoise(x / 3.5, y / 3.5, 0.5, 81) > 0.36) {
          bushes(x, y, 3, r, 0.85);
          if (r() < 0.28) put((x + 0.5) * CELL, (y + 0.5) * CELL, r() < 0.6 ? K('oak') : K('birch'), 0.7 + r() * 0.35, r() * 6.28);
        }
        const wd = hf.waterDist[i]!;
        if (wd >= 1 && wd < 2.5 && rd[i]! > 2 && vnoise(x / 4, y / 4, 1.5, 83) > 0.55) {
          bushes(x, y, 1 + (r() < 0.4 ? 1 : 0), r, 0.7);
          if (r() < 0.12) put((x + 0.5) * CELL, (y + 0.5) * CELL, K('birch'), 0.65 + r() * 0.3, r() * 6.28);
        }
      }
    }
  }
  const G = 12;
  for (let by = 0; by < H; by += G) for (let bx = 0; bx < W; bx += G) {
    const r = rng((by * 131 + bx) * 7 + 99);
    if (r() > 0.42) continue;
    const cx = bx + Math.floor(r() * G), cy = by + Math.floor(r() * G);
    if (cx >= W || cy >= H) continue;
    const ci = cy * W + cx;
    if (blocked(ci) || t.forest[ci]! > 0.05 || fd[ci]! < 5 || rd[ci]! < 3 || hf.waterDist[ci]! < 3) continue;
    const ox = (cx + 0.5) * CELL, oz = (cy + 0.5) * CELL;
    const nT = 3 + Math.floor(r() * 5);
    const spread = 4 + nT * 0.9;
    for (let k = 0; k < nT; k++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * spread;
      const q = r();
      put(ox + Math.cos(a) * d, oz + Math.sin(a) * d, q < 0.5 ? K('oak') : q < 0.88 ? K('birch') : K('pine'), 0.65 + r() * 0.45, r() * 6.28);
    }
    const nB = 3 + Math.floor(r() * 4);
    for (let k = 0; k < nB; k++) {
      const a = r() * 6.28, d = spread * (0.65 + r() * 0.35);
      put(ox + Math.cos(a) * d, oz + Math.sin(a) * d, K('bush'), 0.6 + r() * 0.6, r() * 6.28);
    }
  }
  return out;
}

// --- reference: groundCover.ts buildReeds' scan before D-311 (the reed items, before the instance matrices) -------
function refReeds(hf: Heightfield, roads: RoadField): number[] {
  const WL = hf.waterLevel;
  const items: number[] = [];
  const S = 1.0;
  for (let z = 0; z < hf.sizeZ; z += S) for (let x = 0; x < hf.sizeX; x += S) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    if (hf.waterDist[cz * hf.w + cx]! > 2.5) continue;
    const jx = x + hash3(Math.round(x * 4), Math.round(z * 4), 1, 5) * S;
    const jz = z + hash3(Math.round(x * 4), Math.round(z * 4), 2, 5) * S;
    const hy = hf.height(jx, jz), h = hy - WL;
    if (h < -0.22 || h > 0.32) continue;
    const patch = vnoise(jx / 11, jz / 9, 0.5, 61) + (vnoise(jx / 3, jz / 3, 1.5, 62) - 0.5) * 0.3;
    if (patch < 0.5) continue;
    if (roads.distAt(jx, jz) < 3.6) continue;
    const s = 0.75 + 0.6 * Math.min(1, (patch - 0.5) * 3) * (0.7 + hash3(Math.round(jx * 3), Math.round(jz * 3), 3, 5) * 0.5);
    items.push(jx, hy - 0.05, jz, hash3(Math.round(jx * 5), 0, Math.round(jz * 5), 7) * 6.28, s);
  }
  return items;
}

const flat = (l: Tree[]) => l.flatMap((t) => [t.x, t.y, t.z, t.kind, t.variant, ...t.m.elements, ...t.blob.elements]);
const same = (a: ArrayLike<number>, b: ArrayLike<number>, what: string): void => {
  eq(a.length, b.length, `${what}: length`);
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) throw new Error(`${what}[${i}]: ${a[i]} != ${b[i]}`);
};

test('tree plan identity: trees and reeds equal the replaced placement (road / building changes, kept plans)', () => {
  let q = 11;
  const rnd = () => ((q = (Math.imul(q, 1103515245) + 12345) >>> 0) / 4294967296);
  const changes: [string, (w: World) => void][] = [
    ['as built', () => {}],
    ['more roads', (w) => { for (let k = 0; k < 250; k++) { const i = Math.floor(rnd() * w.state.roads.length); if (!w.terrain.water[i]) w.state.roads[i] = rnd() < 0.3 ? 2 : 1; } }],
    ['half the roads', (w) => { let c = 0; for (let i = 0; i < w.state.roads.length; i++) if (w.state.roads[i]! > 0 && (c++ & 1)) w.state.roads[i] = 0; }],
    ['half the buildings', (w) => { w.state.buildings = w.state.buildings.slice(0, w.state.buildings.length >> 1); }],
  ];
  // menu and m1 share a ground; m2 / m7 share one under different map ids; the free valley has its own; menu and m2
  // come back, so their plans are kept ones
  for (const id of ['menu', 'm1', 'm2', 'm7', 'sandbox:7', 'menu', 'm2']) {
    const [m, sd] = id.split(':');
    const w = m === 'menu' ? menuWorld() : createWorld(m!, sd ? Number(sd) : undefined);
    const hf = new Heightfield(w.terrain);
    const roads = new RoadField(hf.w, hf.h);
    for (const [what, change] of changes) {
      change(w);
      w.state.netVersion++;
      roads.rebuild(w);
      same(flat(placeTrees(w, hf, roads)), flat(refPlaceTrees(w, hf, roads)), `${id} ${what}: trees`);
      const cand = reedCandidates(hf), reeds: number[] = [];
      for (let k = 0; k < cand.length; k += 5) if (!(roads.distAt(cand[k]!, cand[k + 2]!) < 3.6)) reeds.push(...cand.subarray(k, k + 5));
      same(reeds, refReeds(hf, roads), `${id} ${what}: reeds`);
    }
    roads.texture.dispose();
  }
});
