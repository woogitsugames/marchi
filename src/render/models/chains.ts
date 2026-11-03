/**
 * D-29 production-chain buildings: fisher's hut, quarry, charcoal burner, malthouse, brewery.
 * Same frame and style as `buildings.ts` (origin at the footprint centre on the ground, gate
 * side +Z, whole 4 m cells, late-14th-century Central European vernacular, muted palette,
 * AO and dirt baked into vertex colours). Registered in `buildings.ts` (`BUILDERS`).
 *
 * Note: this module and `buildings.ts` import each other; everything shared is only used
 * inside function bodies, so the cycle is safe.
 */
import { BoxGeometry, Color, CylinderGeometry, LatheGeometry, type Matrix4, SphereGeometry, TorusGeometry, Vector2 } from 'three';
import { type BuildingModel, barrelGeom, C, firewoodStack, house, sack, SOOT, stoneO } from './buildings';
import { fnoise, hash3, type PartBuilder, trs, v3 } from './kit';
import { beam, box, fenceRun, logPile, type Opts, rod } from './shapes';

// chain palette (sRGB, desaturated like the rest of the world)
const P = {
  reedThatch: '#6d6250',
  fishSkin: '#7e7f76',
  net: '#45403a',
  rockFresh: '#817b70',
  rockOld: '#5f5b52',
  rubble: '#6a655c',
  earth: '#4d4337',
  sod: '#545139',
  charcoal: '#292624',
  copper: '#7b5a45',
  verdigris: '#5b675a',
  maltSack: '#b2a68a',
  bush: '#474a33',
};

const MOSS = new Color('#5f5a40');
const VERD = new Color(P.verdigris);

// -------------------------------------------------------------------------------------------
// Small shared pieces
// -------------------------------------------------------------------------------------------

/** Open wicker basket (fish creel): tapering lathe with a rolled rim. Origin on the ground. */
export function creel(b: PartBuilder, m: Matrix4, h = 0.55, r = 0.24, color = '#6f5a3e'): void {
  const prof: [number, number][] = [[0.001, 0], [r * 0.78, 0], [r * 0.9, h * 0.35], [r, h * 0.92], [r * 1.08, h], [r * 0.94, h - 0.02], [r * 0.85, h * 0.5], [0.001, h * 0.4]];
  b.add('wood', new LatheGeometry(prof.map(([x, y]) => new Vector2(x, y)), 9), {
    color,
    m,
    noise: 0.2,
    noiseFreq: 16,
    jitter: 0.006,
    jitterFreq: 9,
    ao: 0.1,
    // woven bands: alternate light/dark courses
    shade: (p, _n, c) => {
      const k = Math.floor((p.y * 26) % 2);
      if (k === 1) c.multiplyScalar(0.84);
    },
  });
}

/** One fish, nose at the origin pointing −Y (hanging) before `m`. ~40 tris. */
export function fishGeom(b: PartBuilder, m: Matrix4, len = 0.38): void {
  b.add('cloth', new SphereGeometry(1, 6, 4), {
    color: P.fishSkin,
    m: m.clone().multiply(trs(0, len * 0.45, 0, 0, 0, 0, len * 0.16, len * 0.5, len * 0.07)),
    ao: 0,
    dirt: 0,
    noise: 0.1,
    shade: (_p, n, c) => {
      if (n.y > 0.3) c.multiplyScalar(0.7); // darker back toward the tail
    },
  });
  // forked tail
  b.add('cloth', new CylinderGeometry(len * 0.15, 0.005, len * 0.22, 3), {
    color: '#5d5e57',
    m: m.clone().multiply(trs(0, len * 1.0, 0, 0, 0, 0, 1, 1, 0.25)),
    ao: 0,
    dirt: 0,
  });
}

/** Rough-hewn stone block, centre at the origin before `m`. */
export function stoneBlock(b: PartBuilder, m: Matrix4, w: number, h: number, d: number, fresh = true): void {
  b.add('stone', new BoxGeometry(w, h, d, 2, 2, 2), {
    ...stoneO(fresh ? '#76716a' : P.rockOld),
    m,
    jitter: Math.min(w, h, d) * 0.1,
    jitterFreq: 2.6,
    renormal: true,
    noise: 0.22,
    noiseFreq: 4,
    dirt: 0.25,
    vary: 0.09,
  });
}

/** Small clinker boat (1.2 × 4.2 m), keel on the ground at the origin, bow toward +Z. */
function boat(b: PartBuilder, m: Matrix4): void {
  const L = 4.2, W = 1.2, H = 0.55;
  const g = new BoxGeometry(W, H, L, 2, 2, 10);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i);
    const z = p.getZ(i);
    const t = Math.abs(z) / (L / 2); // 0 mid → 1 at the stems
    const yy = (y + H / 2) / H; // 0 keel → 1 gunwale
    x *= (1 - t * t * 0.92) * (0.45 + 0.55 * yy);
    y += t * t * 0.22 * yy; // sheer rises toward the stems
    p.setXYZ(i, x, y + H / 2, z);
  }
  g.computeVertexNormals();
  b.add('wood', g, {
    color: '#4f4234',
    m,
    noise: 0.12,
    ao: 0.2,
    shade: (q, n, c) => {
      if (n.y > 0.75) c.set('#3b3128'); // open hull: darker inside
      else if (Math.floor(q.y * 9) % 2 === 0) c.multiplyScalar(0.86); // clinker strakes
    },
  });
  // thwarts and a pair of oars across them
  for (const z of [-0.8, 0.7]) box(b, 'wood', W * 0.8, 0.05, 0.22, m.clone().multiply(trs(0, H * 0.82, z)), { color: '#6a5843', ao: 0 });
  for (const s of [-1, 1]) rod(b, 'wood', v3(0, 0, 0).applyMatrix4(m.clone().multiply(trs(s * 0.18, H * 0.9, -1.5))), v3(0, 0, 0).applyMatrix4(m.clone().multiply(trs(s * 0.22, H * 0.92, 1.4))), 0.03, 0.03, 4, { color: '#76624a', ao: 0 });
}

/** A fishing net hung over a pole between two forked posts, along X, sagging in between. */
function netRack(b: PartBuilder, x0: number, x1: number, z: number, h = 1.9): void {
  for (const x of [x0, x1]) {
    rod(b, 'wood', v3(x, -0.1, z), v3(x, h + 0.15, z), 0.06, 0.05, 5, { color: C.timber });
  }
  rod(b, 'wood', v3(x0 - 0.2, h, z), v3(x1 + 0.2, h, z), 0.035, 0.035, 5, { color: C.timberLight, ao: 0 });
  const w = x1 - x0 - 0.2;
  const g = new BoxGeometry(w, 0.015, 2.6, 10, 1, 8);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / w; // −0.5..0.5
    const v = p.getZ(i) / 2.6; // −0.5..0.5 → folds over the pole at v = 0
    const sag = (0.25 - u * u) * 0.5;
    const drop = Math.abs(v) * 2 * 1.2 + sag * Math.abs(v) * 2;
    p.setXYZ(i, p.getX(i), h - drop - 0.02, Math.sign(v) * (0.04 + Math.abs(v) * 0.5) + p.getY(i));
  }
  g.computeVertexNormals();
  b.add('cloth', g, {
    color: P.net,
    m: trs((x0 + x1) / 2, 0, z),
    ao: 0.2,
    dirt: 0.1,
    noise: 0.08,
    // mesh knots: a lighter diamond lattice
    shade: (q, _n, c) => {
      const a = Math.abs(((q.x + q.y) * 6) % 1 - 0.5) < 0.12 || Math.abs(((q.x - q.y) * 6) % 1 - 0.5) < 0.12;
      if (a) c.multiplyScalar(1.3);
    },
  });
  // cork floats along the lower edges
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const x = x0 + 0.3 + (i / 5) * (w - 0.2);
      const u = (x - (x0 + x1) / 2) / w;
      const y = h - 1.2 - (0.25 - u * u) * 0.5 - 0.05;
      b.add('wood', new SphereGeometry(0.05, 4, 3), { color: '#8a7656', m: trs(x, y, z + s * 0.31), ao: 0, dirt: 0 });
    }
  }
}

/** Two A-frame trestles with poles; fish hung in rows to dry. */
function fishRack(b: PartBuilder, cx: number, cz: number, len: number): void {
  const h = 1.75;
  for (const dx of [-len / 2, len / 2]) {
    for (const s of [-1, 1]) rod(b, 'wood', v3(cx + dx, -0.1, cz + s * 0.55), v3(cx + dx, h + 0.1, cz + s * 0.04), 0.05, 0.04, 5, { color: C.timber, vary: 0.1 });
  }
  for (const [dz, y] of [[-0.2, h - 0.25], [0.2, h - 0.25], [0, h]] as const) {
    rod(b, 'wood', v3(cx - len / 2 - 0.15, y, cz + dz), v3(cx + len / 2 + 0.15, y, cz + dz), 0.025, 0.025, 4, { color: C.timberLight, ao: 0 });
    if (y === h) continue;
    const n = Math.round(len / 0.24);
    for (let i = 0; i < n; i++) {
      const x = cx - len / 2 + 0.12 + i * (len - 0.24) / (n - 1);
      fishGeom(b, trs(x, y - 0.05, cz + dz, Math.PI + b.r(-0.08, 0.08), b.r(-0.4, 0.4), 0), 0.34 + b.r(-0.04, 0.04));
    }
  }
}

// -------------------------------------------------------------------------------------------
// Fisher's hut (2×2): reed-thatched board hut on stilts at the bank, a landing stage at the
// back, a boat drawn up, a net rack and a fish-drying rack in the yard, creels by the steps.
// -------------------------------------------------------------------------------------------

export function fisher(b: PartBuilder): Partial<BuildingModel> {
  const cx = -0.9, cz = -1.6, dep = 3.4;
  house(b, {
    cx, cz, len: 4.6, dep, wallH: 0.95 + 1.95, plinth: 0.95, pitch: 50, stilts: true,
    roof: 'thatch', roofColor: P.reedThatch, walls: 'boards', door: { u: 1.0, w: 0.85, h: 1.65 },
    windows: [{ side: 'front', u: -1.0, y: 2.0 }], hip: 'half',
  });
  // landing stage off the back-right toward the water, the boat tied alongside
  const jx = 2.5;
  for (let i = 0; i < 4; i++) {
    const z = -0.6 - i * 1.25;
    for (const s of [-1, 1]) rod(b, 'wood', v3(jx + s * 0.6, -0.8, z), v3(jx + s * 0.6, 0.85, z), 0.08, 0.07, 5, { color: C.timber });
  }
  for (const s of [-1, 1]) beam(b, 'wood', v3(jx + s * 0.6, 0.7, -0.4), v3(jx + s * 0.6, 0.7, -4.6), 0.12, 0.14, { color: C.timber });
  for (let i = 0; i < 15; i++) {
    const z = -0.5 - i * 0.28;
    box(b, 'wood', 1.5 + b.r(-0.05, 0.08), 0.05, 0.25, trs(jx + b.r(-0.03, 0.03), 0.8, z, 0, b.r(-0.03, 0.03)), { color: C.timberLight, vary: 0.14, ao: 0.1 });
  }
  boat(b, trs(jx + 1.35, 0.02, -2.7, 0.02, 0.06, 0.05));
  // mooring post with a coil of rope
  rod(b, 'wood', v3(jx + 0.65, 0.6, -4.5), v3(jx + 0.65, 1.25, -4.5), 0.07, 0.06, 5, { color: C.timber });
  b.add('cloth', new TorusGeometry(0.16, 0.035, 4, 10), { color: '#6b5f4b', m: trs(jx + 0.2, 0.86, -3.9, Math.PI / 2), ao: 0, dirt: 0 });
  // yard: drying rack (left front), net rack (right front), creels and an upturned basket by the steps
  fishRack(b, -2.3, 1.7, 2.6);
  netRack(b, 0.9, 3.4, 2.1);
  const dx = cx + 1.0;
  creel(b, trs(dx - 1.0, 0, 1.0, 0, 0.3));
  creel(b, trs(dx - 0.55, 0, 1.25, 0, 1.2), 0.5, 0.22);
  creel(b, trs(dx + 1.05, 0.22, 0.85, Math.PI / 2 - 0.15, 0.4, 0), 0.5, 0.22); // lying on its side
  for (let i = 0; i < 3; i++) fishGeom(b, trs(dx - 1.0 + (i - 1) * 0.07, 0.55, 1.0 + (i % 2) * 0.06, b.r(-0.3, 0.3), i, b.r(-0.3, 0.3)), 0.3);
  // oar leaning on the wall, eel trap on the deck
  rod(b, 'wood', v3(cx - 2.55, 0, -0.7), v3(cx - 2.38, 2.6, -0.3), 0.03, 0.03, 4, { color: '#76624a' });
  box(b, 'wood', 0.14, 0.5, 0.03, trs(cx - 2.57, 0.3, -0.72, 0, 0.1, 0.05), { color: '#76624a' });
  b.add('wood', new CylinderGeometry(0.16, 0.24, 0.9, 8, 3, true), { color: '#6a5841', m: trs(jx - 0.2, 1.05, -3.0, Math.PI / 2, 0, 0), noise: 0.2, noiseFreq: 14, ao: 0 });
  return { gate: v3(0.2, 0, 4), smoke: v3(cx - 1.4, 5.1, cz), yard: { at: v3(-2.6, 0, 3.3), yaw: Math.PI / 2 } };
}

// -------------------------------------------------------------------------------------------
// Quarry (3×2): stepped cut face at the back, a shear-legs crane with a windlass lifting a
// block, a spoil heap, a sledge and stacks of dressed blocks by the gate.
// -------------------------------------------------------------------------------------------

/**
 * Quarried rock mass: courses of bedrock stepped back as they rise, each course broken into
 * blocks of uneven depth, so the face reads as split strata with ledges. Fresh faces toward
 * +Z are lighter with dark bedding joints; tops are weathered and mossy. Front edge at `zf`.
 */
function rockFace(b: PartBuilder, cx: number, zf: number, w: number, h: number, back: number): void {
  const courses = Math.max(2, Math.round(h / 0.62));
  const ch = h / courses;
  for (let k = 0; k < courses; k++) {
    const y = k * ch;
    const setBack = k * 0.38 + b.r(0, 0.2);
    const n = Math.max(2, Math.round(w / 1.9));
    let x = cx - w / 2;
    for (let i = 0; i < n; i++) {
      const bw = i === n - 1 ? cx + w / 2 - x : (w / n) * b.r(0.75, 1.25);
      // the top course is broken: some blocks already taken, the rest weathered and lower
      if (k === courses - 1 && b.r() < 0.3) { x += bw; continue; }
      const front = zf - setBack - b.r(0, 0.55) - (i % 2) * 0.15;
      const d = front - (zf - back);
      const hh = ch * (k === courses - 1 ? b.r(0.55, 1.0) : 1) + b.r(-0.06, 0.12);
      b.add('stone', new BoxGeometry(bw + 0.04, hh, d, Math.max(1, Math.round(bw / 0.8)), 1, 2), {
        ...stoneO(P.rockFresh),
        m: trs(x + bw / 2, y + hh / 2, front - d / 2, b.r(-0.015, 0.015), b.r(-0.03, 0.03), b.r(-0.02, 0.02)),
        jitter: 0.08,
        jitterFreq: 1.7,
        renormal: true,
        dirt: 0.15,
        vary: 0.1,
        shade: (p, n, c) => {
          if (n.y > 0.55) {
            c.set(P.rockOld);
            const moss = fnoise(p.x * 0.9, p.y, p.z * 0.9, 61);
            if (k === courses - 1 || moss > 0.15) c.lerp(MOSS, k === courses - 1 ? 0.6 : 0.4);
          } else if (n.z > 0.5) {
            if (hash3(Math.floor(p.x * 4), Math.floor(p.y * 6), 0, 62) > 0.82) c.multiplyScalar(0.84); // pick marks
            if (p.y - y > hh - 0.08) c.multiplyScalar(0.7); // bedding joint shadow under the next course
            c.lerp(new Color(P.rockOld), Math.min(0.55, k * 0.12));
          } else {
            c.set(P.rockOld);
          }
        },
      });
      x += bw;
      if (x >= cx + w / 2 - 0.05) break;
    }
  }
}

/** Shear-legs: two poles to an apex leaning over the face, guy rope, windlass, hanging block. */
function shearLegs(b: PartBuilder, x: number, z: number): void {
  const apex = v3(x, 5.4, z - 1.4);
  const feet = [v3(x - 1.25, 0, z + 0.6), v3(x + 1.25, 0, z + 0.6)];
  for (const f of feet) {
    rod(b, 'bark', f.clone().setY(-0.2), apex.clone().add(v3((f.x - x) * -0.04, 0.25, 0)), 0.11, 0.08, 7, { color: '#5a4a39', vary: 0.1, jitter: 0.02 });
    box(b, 'stone', 0.5, 0.25, 0.5, trs(f.x, 0.1, f.z), stoneO(C.stoneDark));
  }
  // lashing at the apex
  b.add('cloth', new TorusGeometry(0.15, 0.05, 4, 8), { color: '#6b5f4b', m: trs(apex.x, apex.y - 0.05, apex.z, Math.PI / 2 - 0.5), ao: 0, dirt: 0 });
  // back guy rope to a stake
  const stake = v3(x - 1.6, 0, z + 3.2);
  rod(b, 'wood', stake.clone().setY(-0.2), stake.clone().setY(0.5), 0.06, 0.05, 5, { color: C.timber });
  rod(b, 'cloth', apex, stake.clone().setY(0.45), 0.018, 0.018, 3, { color: '#6b5f4b', ao: 0, dirt: 0 });
  // windlass between the legs: drum on two side frames, crank handles
  const wy = 0.85, wz = z + 0.3;
  for (const s of [-1, 1]) {
    const fx = x + s * 0.95;
    rod(b, 'wood', v3(fx, 0, wz - 0.35), v3(fx, wy + 0.1, wz), 0.05, 0.05, 4, { color: C.timber });
    rod(b, 'wood', v3(fx, 0, wz + 0.35), v3(fx, wy + 0.1, wz), 0.05, 0.05, 4, { color: C.timber });
    beam(b, 'wood', v3(fx + s * 0.18, wy, wz), v3(fx + s * 0.18, wy - 0.45, wz + 0.2), 0.05, 0.05, { color: '#6a5843' });
  }
  rod(b, 'wood', v3(x - 1.1, wy, wz), v3(x + 1.1, wy, wz), 0.13, 0.13, 8, {
    color: '#5f4f3d',
    shade: (p, _n, c) => {
      if (Math.abs(p.x - x) < 0.5) c.set('#6f6352'); // rope wound on the drum
    },
  });
  // hoisting rope: drum → apex → block
  rod(b, 'cloth', v3(x, wy + 0.12, wz), apex, 0.02, 0.02, 3, { color: '#6b5f4b', ao: 0, dirt: 0 });
  const hy = 2.1;
  rod(b, 'cloth', apex.clone().add(v3(0, -0.1, 0)), v3(apex.x, hy + 0.55, apex.z), 0.02, 0.02, 3, { color: '#6b5f4b', ao: 0, dirt: 0 });
  // lewis/sling over a hanging block
  for (const s of [-1, 1]) rod(b, 'cloth', v3(apex.x, hy + 0.55, apex.z), v3(apex.x + s * 0.32, hy + 0.2, apex.z), 0.015, 0.015, 3, { color: '#6b5f4b', ao: 0, dirt: 0 });
  stoneBlock(b, trs(apex.x, hy, apex.z, 0, 0.2), 0.8, 0.45, 0.55);
}

/** Wooden sledge for dragging blocks: two runners, crossbars, one block on it. */
function sledge(b: PartBuilder, x: number, z: number, ry: number): void {
  const m = trs(x, 0, z, 0, ry);
  for (const s of [-1, 1]) {
    box(b, 'wood', 0.12, 0.14, 2.0, m.clone().multiply(trs(s * 0.42, 0.07, 0)), { color: C.timber });
    box(b, 'wood', 0.12, 0.14, 0.35, m.clone().multiply(trs(s * 0.42, 0.14, 1.08, -0.5)), { color: C.timber });
  }
  for (const zz of [-0.7, 0, 0.7]) box(b, 'wood', 1.05, 0.06, 0.14, m.clone().multiply(trs(0, 0.17, zz)), { color: C.timberLight });
  stoneBlock(b, m.clone().multiply(trs(0, 0.43, -0.1, 0, 0.05)), 0.75, 0.48, 1.1);
  rod(b, 'cloth', v3(0, 0, 0).applyMatrix4(m.clone().multiply(trs(-0.4, 0.2, 1.15))), v3(0, 0, 0).applyMatrix4(m.clone().multiply(trs(0.1, 0.02, 2.0))), 0.02, 0.02, 3, { color: '#6b5f4b', ao: 0 });
}

function blockStack(b: PartBuilder, cx: number, cz: number, ry: number, rows: [number, number][]): void {
  const m = trs(cx, 0, cz, 0, ry);
  rows.forEach(([n, h], row) => {
    const y = rows.slice(0, row).reduce((a, [, hh]) => a + hh + 0.02, 0);
    for (let i = 0; i < n; i++) {
      const w = 0.62 + b.r(-0.06, 0.06);
      stoneBlock(b, m.clone().multiply(trs((i - (n - 1) / 2) * 0.68 + b.r(-0.03, 0.03), y + h / 2, b.r(-0.04, 0.04), 0, b.r(-0.05, 0.05))), w, h, 0.95 + b.r(-0.08, 0.06));
    }
  });
}

export function quarry(b: PartBuilder): Partial<BuildingModel> {
  // stepped face: high back wall, a lower bench in front of it with a half-cut block
  rockFace(b, 0, -1.8, 12.6, 3.7, 2.6);
  rockFace(b, -2.2, -0.6, 6.4, 1.25, 1.3);
  // a block being split off on the bench: a row of iron wedges driven into a groove on top
  stoneBlock(b, trs(-3.4, 1.25 + 0.3, -1.25, 0, 0.04), 1.6, 0.6, 1.0);
  box(b, 'stone', 1.62, 0.03, 0.04, trs(-3.4, 1.86, -1.25, 0, 0.04), { color: '#2a2622', noise: 0, ao: 0, dirt: 0, vary: 0 });
  for (let i = 0; i < 5; i++) box(b, 'metal', 0.06, 0.12, 0.08, trs(-4.0 + i * 0.3, 1.9, -1.25 + i * 0.012), { color: '#45423e', ao: 0, dirt: 0 });
  // a sledgehammer leaning against it
  rod(b, 'wood', v3(-2.4, 1.25, -0.75), v3(-2.15, 2.1, -0.95), 0.025, 0.025, 4, { color: '#7a6448', ao: 0 });
  box(b, 'metal', 0.22, 0.12, 0.12, trs(-2.42, 1.3, -0.73), { color: '#45423e', ao: 0, dirt: 0 });
  // tumbled natural boulders at the ends of the face, blending into the ground
  for (const [x, z, s] of [[-6.3, -1.2, 1.0], [6.2, -1.1, 0.8], [5.6, -1.5, 1.1], [-5.7, -0.4, 0.55]] as const) {
    b.add('stone', new SphereGeometry(1, 7, 5), { ...stoneO(P.rockOld), m: trs(x, s * 0.35, z, 0, x, 0, s, s * 0.7, s * 0.9), jitter: s * 0.18, jitterFreq: 1.6, renormal: true });
  }
  // spoil heap of rubble, right front
  const heap = [[0.001, 0], [1.75, 0], [1.6, 0.15], [1.4, 0.35], [1.15, 0.58], [0.9, 0.78], [0.6, 0.97], [0.3, 1.08], [0.001, 1.12]].map(([r, y]) => new Vector2(r, y));
  b.add('stone', new LatheGeometry(heap, 14), {
    color: P.rubble,
    m: trs(4.1, -0.05, 1.3, 0, 0, 0, 1, 1, 0.8),
    jitter: 0.2,
    jitterFreq: 3.2,
    renormal: true,
    noise: 0.3,
    noiseFreq: 4,
    dirt: 0.25,
    shade: (p, _n, c) => {
      if (hash3(Math.floor(p.x * 4), Math.floor(p.y * 4), Math.floor(p.z * 4), 64) > 0.7) c.multiplyScalar(1.15);
    },
  });
  for (let i = 0; i < 14; i++) {
    const a = b.r(0, Math.PI * 2), r = b.r(0.4, 2.0), s = b.r(0.12, 0.28);
    b.add('stone', new SphereGeometry(1, 5, 3), { ...stoneO(P.rubble), m: trs(4.1 + Math.cos(a) * r, Math.max(0, 1.12 * (1 - r / 1.75)) + s * 0.3, 1.3 + Math.sin(a) * r * 0.8, b.r(0, 3), b.r(0, 3), 0, s, s * 0.8, s * 1.1), jitter: s * 0.25, jitterFreq: 3 });
  }
  shearLegs(b, -0.4, 0.4);
  sledge(b, 1.25, 1.7, 0.3);
  // dressed blocks waiting for carts by the gate: the yard stock (drawn from the quarry's stone, D-71); one old
  // stack stays at the right
  blockStack(b, 3.4, 3.3, -0.1, [[2, 0.5]]);
  // tools: a pick and a mallet on a chopping log, a short fence along the drop at the left
  b.add('bark', new CylinderGeometry(0.26, 0.3, 0.5, 9), { color: '#584a3a', m: trs(-5.3, 0.25, 1.6) });
  rod(b, 'wood', v3(-5.3, 0.5, 1.6), v3(-4.7, 0.95, 1.9), 0.025, 0.022, 4, { color: '#7a6448', ao: 0 });
  box(b, 'metal', 0.06, 0.06, 0.55, trs(-4.72, 0.97, 1.9, 0, 1.1, 0.3), { color: '#4a4744', ao: 0, dirt: 0 });
  fenceRun(b, v3(-6.0, 0, 0.3), v3(-6.0, 0, 3.6), 1.0);
  return { gate: v3(0.6, 0, 4), yard: { at: v3(-3.4, 0, 2.6), yaw: Math.PI / 2 } };
}

// -------------------------------------------------------------------------------------------
// Charcoal burner (2×2): a smoking earth-covered kiln mound, a second stack half built from
// upright billets, wood in stacks, the burner's bark-covered pole hut and sacks of charcoal.
// -------------------------------------------------------------------------------------------

export function charcoalBurner(b: PartBuilder): Partial<BuildingModel> {
  const mx = -0.9, mz = -1.3, R = 2.35, H = 1.85;
  // the mound: sod and earth over the stacked wood, sooty crown, a ring of vent holes
  const prof: [number, number][] = [[0.001, -0.1], [R + 0.15, -0.1], [R, 0.25], [R * 0.9, 0.7], [R * 0.72, 1.15], [R * 0.48, 1.55], [R * 0.2, H - 0.05], [0.18, H], [0.001, H - 0.12]];
  b.add('plaster', new LatheGeometry(prof.map(([r, y]) => new Vector2(r, y)), 20), {
    color: P.earth,
    m: trs(mx, 0, mz),
    jitter: 0.07,
    jitterFreq: 2.2,
    renormal: true,
    noise: 0.16,
    noiseFreq: 2.4,
    dirt: 0.2,
    shade: (p, _n, c) => {
      const y = p.y;
      const a = Math.atan2(p.z - mz, p.x - mx);
      // sod patches lower down
      if (y < 1.1 && fnoise(p.x * 1.4, y * 1.4, p.z * 1.4, 71) > 0.05) c.lerp(new Color(P.sod), 0.55);
      // soot and smoke staining toward the crown
      if (y > 1.0) c.lerp(SOOT, Math.min(0.75, (y - 1.0) * 0.8));
      // vent holes: two staggered rings of small dark openings
      for (const [ry, n, off] of [[0.55, 9, 0], [1.05, 7, 0.4]] as const) {
        const k = ((a / (Math.PI * 2)) * n + off + 10) % 1;
        if (Math.abs(y - ry) < 0.09 && Math.abs(k - 0.5) < 0.09) c.set('#1b1816');
      }
    },
  });
  // shallow ash ring around the foot
  b.add('plaster', new TorusGeometry(R + 0.35, 0.22, 3, 20), { color: '#5d574f', m: trs(mx, 0.0, mz, Math.PI / 2, 0, 0, 1, 1, 0.35), ao: 0.2, dirt: 0.3 });
  // a dark smoke hole on top
  b.add('plaster', new CylinderGeometry(0.2, 0.2, 0.05, 8), { color: '#141210', m: trs(mx, H - 0.02, mz), ao: 0, dirt: 0, noise: 0 });
  // ladder leaning against the mound, and a long rake
  {
    const a = v3(mx + 1.2, 0, mz + 2.75), t = v3(mx + 0.55, 1.75, mz + 0.65);
    for (const s of [-1, 1]) rod(b, 'wood', a.clone().setX(a.x + s * 0.22), t.clone().setX(t.x + s * 0.2), 0.035, 0.03, 4, { color: '#76624a' });
    for (let i = 1; i < 7; i++) {
      const f = i / 7;
      const p = a.clone().lerp(t, f);
      rod(b, 'wood', p.clone().setX(p.x - 0.22), p.clone().setX(p.x + 0.22), 0.02, 0.02, 4, { color: '#76624a', ao: 0 });
    }
    rod(b, 'wood', v3(mx - 2.2, 0, mz + 1.9), v3(mx - 1.2, 1.5, mz + 0.9), 0.025, 0.025, 4, { color: '#7a6448' });
    box(b, 'wood', 0.55, 0.06, 0.06, trs(mx - 2.25, 0.05, mz + 1.95, 0, 0.78), { color: '#6a5843' });
  }
  // second stack being built: central chimney stakes and two courses of upright billets
  const sx = 2.25, sz = -2.4;
  for (const s of [-1, 1]) rod(b, 'wood', v3(sx + s * 0.1, 0, sz), v3(sx + s * 0.06, 1.7, sz), 0.04, 0.035, 4, { color: C.timber });
  for (const [r, n, h, tilt] of [[0.35, 8, 1.1, 0.1], [0.72, 13, 1.0, 0.16], [1.08, 18, 0.9, 0.22]] as const) {
    for (let i = 0; i < n; i++) {
      if (r > 1 && i > 12) continue; // the outer course is unfinished on one side
      const a = (i / n) * Math.PI * 2 + r;
      const x = sx + Math.cos(a) * r, z = sz + Math.sin(a) * r;
      b.add('wood', new CylinderGeometry(0.075, 0.08, h, 5), {
        color: '#6f5b45',
        m: trs(x, h / 2 - 0.02, z, Math.sin(a) * tilt, 0, -Math.cos(a) * tilt),
        vary: 0.14,
        shade: (_p, n2, c) => {
          if (n2.y > 0.7) c.set('#a08a68'); // cut ends
        },
      });
    }
  }
  // burner's hut: cone of poles covered in bark and sod, a dark doorway toward the yard
  const hx = 2.35, hz = 1.4;
  b.add('bark', new CylinderGeometry(0.08, 1.35, 2.5, 10, 3, true), {
    color: '#4a3f33',
    m: trs(hx, 1.2, hz),
    jitter: 0.06,
    jitterFreq: 2.5,
    renormal: true,
    noise: 0.18,
    shade: (p, n, c) => {
      if (p.y < 0.9) c.lerp(new Color(P.sod), 0.5);
      if (n.z > 0.75 && Math.abs(p.x - hx) < 0.35 && p.y < 1.25) c.set('#17130f');
    },
  });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    rod(b, 'wood', v3(hx + Math.cos(a) * 0.05, 2.2, hz + Math.sin(a) * 0.05), v3(hx + Math.cos(a) * 0.32, 2.85 + b.r(0, 0.2), hz + Math.sin(a) * 0.32), 0.035, 0.03, 4, { color: '#5a4a39', ao: 0 });
  }
  // wood: a pile of logs along the left, split billets stacked at the back
  logPile(b, v3(-2.6, 0, 2.3), 0.05, 2.6, 3, 0.14);
  firewoodStack(b, -0.3, -3.65, 3.2, 0.9);
  // finished charcoal by the gate: a loose heap, and the sacks are the yard stock (the burner's charcoal, D-71)
  b.add('stone', new SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), {
    color: '#232120',
    m: trs(-0.75, 0, 2.6, 0, 0, 0, 0.6, 0.28, 0.5),
    jitter: 0.05,
    jitterFreq: 6,
    renormal: true,
    noise: 0.25,
    noiseFreq: 7,
    ao: 0,
    dirt: 0,
  });
  return { gate: v3(-0.2, 0, 4), smoke: v3(mx, H + 0.1, mz), yard: { at: v3(1.2, 0, 2.6), yaw: Math.PI / 2 } };
}

// -------------------------------------------------------------------------------------------
// Malthouse (2×2): long, low daub-and-thatch malting floor with many small shutters, and a
// stone kiln at the +X end under a pyramid roof crowned by a louvred vent cowl.
// -------------------------------------------------------------------------------------------

export function malthouse(b: PartBuilder): Partial<BuildingModel> {
  const cz = -1.6, dep = 4.0;
  const mx0 = -3.95, mx1 = 0.75;
  house(b, {
    cx: (mx0 + mx1) / 2, cz, len: mx1 - mx0, dep, wallH: 2.15, plinth: 0.4, pitch: 47,
    roof: 'thatch', walls: 'daub', door: { u: 0.7, w: 1.05, h: 1.8 }, hip: 'half',
    windows: [{ side: 'front', u: -1.2, y: 1.5 }, { side: 'back', u: 0.2, y: 1.5 }, { side: 'left', u: -0.3, y: 1.5 }],
  });
  // kiln house: field stone, a little taller than the floor house
  const kx = 2.3, kw = 3.1, kd = 3.6, kh = 3.0;
  box(b, 'stone', kw, kh, kd, trs(kx, kh / 2, cz), { ...stoneO(), jitter: 0.04 }, 0.45);
  box(b, 'stone', kw + 0.3, 0.5, kd + 0.3, trs(kx, 0.2, cz), stoneO(C.stoneDark), 0.5);
  // stoke hole with a soot fan above it, and a firewood stack by it
  const sootFan: Opts = { ...stoneO('#3e3a34'), shade: (p, _n, c) => { c.lerp(SOOT, Math.max(0, 0.7 - (p.y - 0.9) * 0.35)); } };
  box(b, 'stone', 0.8, 1.6, 0.03, trs(kx, 1.6, cz + kd / 2 + 0.01), sootFan);
  box(b, 'stone', 0.55, 0.6, 0.04, trs(kx, 0.6, cz + kd / 2 + 0.03), { color: '#15110e', noise: 0, ao: 0, dirt: 0, vary: 0 });
  box(b, 'stone', 0.8, 0.14, 0.4, trs(kx, 0.97, cz + kd / 2 + 0.12), stoneO(C.stoneDark));
  firewoodStack(b, kx + 0.4, cz + kd / 2 + 1.55, 1.5, 0.8);
  // pyramid roof of shingles
  b.add('wood', new CylinderGeometry(0.42, (Math.max(kw, kd) / 2 + 0.35) * Math.SQRT2, 2.1, 4, 3, true), {
    color: C.shingle,
    m: trs(kx, kh + 1.05, cz, 0, 0, 0, kw / Math.max(kw, kd), 1, 1).multiply(trs(0, 0, 0, 0, Math.PI / 4)),
    jitter: 0.015,
    noise: 0.12,
    noiseFreq: 3,
    shade: (p, _n, c) => {
      if ((p.y * 4.2) % 1 < 0.14) c.multiplyScalar(0.72); // shingle courses
    },
  });
  // louvred vent cowl on top
  const vy = kh + 2.1, vs = 0.62;
  for (const [ix, iz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    beam(b, 'wood', v3(kx + ix * vs / 2, vy - 0.05, cz + iz * vs / 2), v3(kx + ix * vs / 2, vy + 0.75, cz + iz * vs / 2), 0.07, 0.07, { color: C.timber });
  }
  for (let i = 0; i < 4; i++) {
    const y = vy + 0.12 + i * 0.16;
    for (const s of [-1, 1]) {
      box(b, 'wood', vs + 0.04, 0.03, 0.14, trs(kx, y, cz + s * vs / 2, s * 0.6), { color: C.boards, ao: 0, dirt: 0 });
      box(b, 'wood', 0.14, 0.03, vs + 0.04, trs(kx + s * vs / 2, y, cz, 0, 0, -s * 0.6), { color: C.boards, ao: 0, dirt: 0 });
    }
  }
  b.add('wood', new CylinderGeometry(0.03, 0.62, 0.55, 4, 1), {
    color: '#4a443c',
    m: trs(kx, vy + 1.02, cz, 0, Math.PI / 4),
    ao: 0,
    dirt: 0,
  });
  // soot staining on the roof just under the cowl
  b.add('wood', new CylinderGeometry(0.44, 0.8, 0.4, 4, 1, true), { color: '#2f2b27', m: trs(kx, vy - 0.15, cz, 0, 0, 0, kw / kd, 1, 1).multiply(trs(0, 0, 0, 0, Math.PI / 4)), ao: 0, dirt: 0 });
  // yard: steeping cistern (water tub on a frame), sacks of grain and pale malt by the door
  const tx = -2.55, tz = 1.75;
  box(b, 'wood', 1.9, 0.62, 0.95, trs(tx, 0.31, tz), { color: C.timber, ao: 0.3 }, 0.5);
  box(b, 'wood', 1.7, 0.03, 0.75, trs(tx, 0.6, tz), { color: '#3f4b4b', noise: 0.04, ao: 0, dirt: 0 });
  for (const s of [-1, 1]) box(b, 'wood', 2.0, 0.08, 0.1, trs(tx, 0.64, tz + s * 0.45), { color: C.timberLight, ao: 0 });
  for (const s of [-1, 1]) box(b, 'wood', 0.1, 0.08, 1.0, trs(tx + s * 0.97, 0.64, tz), { color: C.timberLight, ao: 0 });
  // malt shovel leaning on the tub
  rod(b, 'wood', v3(tx + 1.15, 0.05, tz + 0.62), v3(tx + 1.4, 1.45, tz + 0.18), 0.022, 0.022, 4, { color: '#7a6448' });
  box(b, 'wood', 0.32, 0.4, 0.03, trs(tx + 1.13, 0.22, tz + 0.63, -0.1, 0, -0.18), { color: '#8a7454', ao: 0 });
  const dx = (mx0 + mx1) / 2 + 0.7;
  sack(b, dx - 1.0, 0.85, 0.2);
  // the pale malt bags by the door are the yard stock (the malthouse's malt, D-71)
  return { gate: v3(-0.8, 0, 4), smoke: v3(kx, vy + 1.2, cz), yard: { at: v3(dx + 1.3, 0, 1.3), yaw: Math.PI / 2 } };
}

// -------------------------------------------------------------------------------------------
// Brewery (3×2): tall half-timbered brewhouse with an ale-stake over the door; a brewing shed
// on the +X side with a muted copper over a stone furnace, its hood and chimney; barrels.
// -------------------------------------------------------------------------------------------

/** Barrel lying on its side along `ry`, resting on the ground (or at height y). */
function lyingBarrel(b: PartBuilder, x: number, y: number, z: number, ry: number): void {
  barrelGeom(b, trs(x, y + 0.31, z, 0, ry, 0).multiply(trs(0, 0, -0.415, Math.PI / 2, 0, 0)));
}

export function brewery(b: PartBuilder): Partial<BuildingModel> {
  const cx = -1.9, cz = -1.6, len = 6.8, dep = 4.8;
  house(b, {
    cx, cz, len, dep, wallH: 3.6, plinth: 0.45, pitch: 50, roof: 'shingle', walls: 'daub',
    door: { u: -0.9, w: 1.25, h: 2.0 },
    windows: [{ side: 'front', u: 1.6, y: 1.7 }, { side: 'front', u: -2.4, y: 2.9 }, { side: 'front', u: 1.6, y: 2.95 }, { side: 'left', u: 0.4, y: 1.8 }],
  });
  // ale-stake: a pole out over the door with a bush hung from it (the sign of fresh ale)
  const ax = cx - 0.9, az = cz + dep / 2;
  rod(b, 'wood', v3(ax + 0.9, 2.65, az), v3(ax + 0.9, 2.75, az + 1.6), 0.045, 0.04, 5, { color: C.timber });
  rod(b, 'wood', v3(ax + 0.9, 2.15, az + 0.02), v3(ax + 0.9, 2.7, az + 1.0), 0.03, 0.03, 4, { color: C.timber });
  b.add('cloth', new SphereGeometry(1, 7, 5), { color: P.bush, m: trs(ax + 0.9, 2.35, az + 1.6, 0, 0, 0, 0.3, 0.36, 0.3), jitter: 0.06, jitterFreq: 5, renormal: true, ao: 0, dirt: 0 });
  // brewing shed (lean-to against the gable): posts, mono-pitch shingle roof, open to the yard
  const x0 = cx + len / 2, x1 = 5.6, z0 = cz - dep / 2, z1 = cz + dep / 2 - 0.3;
  for (const x of [(x0 + x1) / 2 + 0.3, x1]) {
    for (const z of [z0 + 0.1, z1]) {
      box(b, 'stone', 0.35, 0.2, 0.35, trs(x, 0.1, z), stoneO());
      beam(b, 'wood', v3(x, 0.2, z), v3(x, 2.35, z), 0.18, 0.18, { color: C.timber });
    }
  }
  beam(b, 'wood', v3(x0, 2.45, z1), v3(x1 + 0.15, 2.45, z1), 0.18, 0.2, { color: C.timber });
  beam(b, 'wood', v3(x0, 2.45, z0 + 0.1), v3(x1 + 0.15, 2.45, z0 + 0.1), 0.18, 0.2, { color: C.timber });
  box(b, 'wood', x1 - x0 + 0.5, 0.07, dep + 0.2, trs((x0 + x1) / 2 + 0.2, 3.0, cz - 0.15, 0, 0, -0.32), {
    color: C.shingle,
    noise: 0.12,
    jitter: 0.01,
    shade: (p, _n, c) => {
      if ((p.x * 3.6) % 1 < 0.13) c.multiplyScalar(0.75);
    },
  }, 0.5);
  // back wall boards of the shed
  for (let i = 0; i < 9; i++) {
    const x = x0 + 0.15 + (i + 0.5) * ((x1 - x0) / 9);
    box(b, 'wood', (x1 - x0) / 9 - 0.01, 2.2, 0.04, trs(x, 1.3, z0 + 0.0), { color: C.boards, vary: 0.14 });
  }
  // furnace: stone block with a fire mouth; the copper set into it
  const fx = 3.85, fz = -2.3;
  box(b, 'stone', 1.9, 0.95, 1.9, trs(fx, 0.475, fz), stoneO(C.stoneDark), 0.4);
  box(b, 'stone', 0.5, 0.42, 0.03, trs(fx, 0.35, fz + 0.96), { color: '#120e0b', noise: 0, ao: 0, dirt: 0, vary: 0 });
  box(b, 'stone', 0.6, 0.22, 0.03, trs(fx, 0.18, fz + 0.97), { color: '#5a3a24', noise: 0.2, ao: 0, dirt: 0, vary: 0 }); // embers
  const copper: Opts = {
    color: P.copper,
    noise: 0.16,
    noiseFreq: 3,
    ao: 0,
    dirt: 0,
    shade: (p, _n, c) => {
      // dull verdigris blooms and darker hammer marks
      const v = fnoise(p.x * 3, p.y * 3, p.z * 3, 81);
      if (v > 0.15) c.lerp(VERD, Math.min(0.6, (v - 0.15) * 2));
      if (hash3(Math.floor(p.x * 9), Math.floor(p.y * 9), Math.floor(p.z * 9), 82) > 0.85) c.multiplyScalar(0.85);
    },
  };
  const kettle: [number, number][] = [[0.001, 0.7], [0.55, 0.72], [0.78, 0.9], [0.82, 1.25], [0.86, 1.32], [0.78, 1.3]];
  b.add('metal', new LatheGeometry(kettle.map(([r, y]) => new Vector2(r, y)), 16), { ...copper, m: trs(fx, 0, fz) });
  b.add('plaster', new CylinderGeometry(0.76, 0.76, 0.02, 14), { color: '#4b4232', m: trs(fx, 1.18, fz), ao: 0, dirt: 0, noise: 0.1 }); // wort
  // conical copper hood and flue pipe up through the shed roof
  b.add('metal', new CylinderGeometry(0.2, 0.92, 0.75, 14, 1, true), { ...copper, m: trs(fx, 1.95, fz) });
  b.add('metal', new CylinderGeometry(0.18, 0.2, 2.4, 10, 2, true), { ...copper, m: trs(fx, 3.5, fz) });
  b.add('metal', new CylinderGeometry(0.02, 0.38, 0.32, 10, 1), { ...copper, m: trs(fx, 4.95, fz) }); // rain cap
  for (const s of [-1, 1]) rod(b, 'metal', v3(fx + s * 0.12, 4.7, fz), v3(fx + s * 0.12, 4.82, fz), 0.02, 0.02, 3, { color: '#3c3833', ao: 0, dirt: 0 });
  // mash paddle in the copper
  rod(b, 'wood', v3(fx - 0.2, 1.1, fz + 0.1), v3(fx - 0.9, 2.25, fz + 0.9), 0.03, 0.03, 4, { color: '#7a6448', ao: 0 });
  // barrels: a stacked rack by the gate side, some upright by the door
  const rx = 3.6, rz = 1.9;
  for (const s of [-1, 1]) box(b, 'wood', 2.3, 0.1, 0.12, trs(rx, 0.05, rz + s * 0.3), { color: C.timber });
  for (let i = 0; i < 3; i++) lyingBarrel(b, rx - 0.64 + i * 0.64, 0.08, rz, 0);
  for (let i = 0; i < 2; i++) lyingBarrel(b, rx - 0.32 + i * 0.64, 0.63, rz, 0);
  barrelGeom(b, trs(ax - 1.25, 0, az + 0.55));
  barrelGeom(b, trs(ax - 1.85, 0, az + 0.75, 0, 1.2));
  // trestle bench with a tankard-sized cask and a tun
  b.add('wood', new CylinderGeometry(0.62, 0.55, 0.75, 14, 1, true), { color: '#5d4b39', m: trs(-5.0, 0.375, 1.5), noise: 0.1, noiseFreq: 9 });
  b.add('plaster', new CylinderGeometry(0.58, 0.58, 0.02, 12), { color: '#5a4b33', m: trs(-5.0, 0.66, 1.5), ao: 0, dirt: 0 });
  return { gate: v3(-0.8, 0, 4), smoke: v3(fx, 5.15, fz), yard: { at: v3(1.2, 0, 2.7), yaw: Math.PI / 2 } };
}
