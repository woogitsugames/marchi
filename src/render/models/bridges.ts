/**
 * Bridge segments, one per 4 m road cell. Frame: origin at the cell centre at bank (road)
 * level, the road runs along Z (segment spans z ∈ [−2, 2]); rotate around Y to follow the road.
 * Segments tile seamlessly when placed end to end. Everything below y = 0 is meant to sit in the
 * river bed (water surface ≈ −0.3 … −0.6 m).
 *
 *  - wood : one lane, plank deck across three stringers, a pile bent at mid-cell driven into
 *           the bed with cross bracing, post-and-rail railings.
 *  - stone: two lanes, one segmental arch per cell between half-piers (adjacent cells join
 *           into full piers with cutwaters), parapets with coping.
 */
import { ExtrudeGeometry, Shape } from 'three';
import { type ModelPart, PartBuilder, trs, v3 } from './kit';
import { beam, box, type Opts, rod } from './shapes';

export type BridgeKind = 'wood' | 'stone';

export const BRIDGE = {
  cell: 4,
  /** Deck (driving surface) height above bank level. */
  woodDeckY: 0.3,
  stoneDeckY: 0.35,
  woodWidth: 3.2,
  stoneWidth: 4.0,
  /** Depth the piles / piers reach below bank level. */
  footY: -3.2,
};

const TIMBER = '#4f4336';
const PLANK = '#6a5947';
const STONE = '#8a8478';

function woodSegment(b: PartBuilder): void {
  const Y = BRIDGE.woodDeckY, W = BRIDGE.woodWidth, L = BRIDGE.cell;
  // deck planks across the road, slightly irregular
  const n = 14;
  for (let i = 0; i < n; i++) {
    const z = -L / 2 + (i + 0.5) * (L / n);
    box(b, 'wood', W + b.r(-0.08, 0.1), 0.07, L / n - 0.025, trs(b.r(-0.04, 0.04), Y - 0.035, z, 0, b.r(-0.012, 0.012)), {
      color: PLANK,
      vary: 0.14,
      noise: 0.1,
      ao: 0,
      dirt: 0.15,
      shade: (p, _n, c) => {
        // wheel tracks worn darker
        if (Math.abs(Math.abs(p.x) - 0.75) < 0.25) c.multiplyScalar(0.82);
      },
    });
  }
  // stringers
  for (const x of [-1.3, 0, 1.3]) beam(b, 'wood', v3(x, Y - 0.2, -L / 2), v3(x, Y - 0.2, L / 2), 0.22, 0.26, { color: TIMBER, ao: 0 });
  // pile bent at mid-cell: cap beam, 4 piles, X bracing
  beam(b, 'wood', v3(-W / 2 - 0.3, Y - 0.45, 0), v3(W / 2 + 0.3, Y - 0.45, 0), 0.26, 0.26, { color: TIMBER, ao: 0 });
  const piles = [-1.55, -0.5, 0.5, 1.55];
  const wet: Opts['shade'] = (p, _n, c) => {
    if (p.y < -0.45) c.multiplyScalar(0.55); // wet, algae-dark below the waterline
  };
  for (const x of piles) rod(b, 'bark', v3(x * 1.05, BRIDGE.footY, 0), v3(x, Y - 0.55, 0), 0.15, 0.13, 7, { color: '#4d4238', ao: 0, dirt: 0, shade: wet });
  beam(b, 'wood', v3(-1.55, -0.2, 0.0), v3(1.55, -1.9, 0.0), 0.08, 0.16, { color: TIMBER, ao: 0, dirt: 0, shade: wet }, v3(0, 0, 1));
  beam(b, 'wood', v3(1.55, -0.2, 0.0), v3(-1.55, -1.9, 0.0), 0.08, 0.16, { color: TIMBER, ao: 0, dirt: 0, shade: wet }, v3(0, 0, 1));
  // ice breaker / cutwater pile upstream is left to the renderer (flow direction unknown)
  // railings: posts every 2 m, two rails, braces to the deck
  for (const s of [-1, 1]) {
    const x = s * (W / 2 + 0.05);
    for (const z of [-1, 1]) {
      beam(b, 'wood', v3(x, Y - 0.3, z), v3(x, Y + 1.05, z), 0.13, 0.13, { color: TIMBER, ao: 0 });
      beam(b, 'wood', v3(x + s * 0.45, Y - 0.25, z), v3(x + s * 0.06, Y + 0.55, z), 0.09, 0.09, { color: TIMBER, ao: 0 });
    }
    rod(b, 'wood', v3(x, Y + 1.0, -L / 2), v3(x, Y + 1.0, L / 2), 0.06, 0.06, 6, { color: '#5d5040', ao: 0, jitter: 0.01 });
    rod(b, 'wood', v3(x, Y + 0.5, -L / 2), v3(x, Y + 0.5, L / 2), 0.045, 0.045, 5, { color: '#5d5040', ao: 0, jitter: 0.01 });
  }
}

function stoneSegment(b: PartBuilder): void {
  const Y = BRIDGE.stoneDeckY, W = BRIDGE.stoneWidth, L = BRIDGE.cell;
  const span = 2.9; // clear opening per cell, half-piers of 0.55 m at each end
  const rise = 1.25;
  const spring = -1.15; // springing line height
  const rad = (span * span / 4 + rise * rise) / (2 * rise);
  const cy = spring + rise - rad;
  const a0 = Math.asin(span / 2 / rad);
  // side elevation in (z, y), extruded across the width (x)
  const sh = new Shape();
  sh.moveTo(-L / 2, BRIDGE.footY);
  sh.lineTo(-span / 2, BRIDGE.footY);
  sh.lineTo(-span / 2, spring);
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    const a = -a0 + (2 * a0 * i) / steps;
    sh.lineTo(Math.sin(a) * rad, cy + Math.cos(a) * rad);
  }
  sh.lineTo(span / 2, BRIDGE.footY);
  sh.lineTo(L / 2, BRIDGE.footY);
  sh.lineTo(L / 2, Y);
  sh.lineTo(-L / 2, Y);
  sh.closePath();
  const g = new ExtrudeGeometry(sh, { depth: W, bevelEnabled: false, curveSegments: 1 });
  const stoneO: Opts = {
    color: STONE,
    noise: 0.18,
    noiseFreq: 1.4,
    jitter: 0.02,
    ao: 0,
    dirt: 0,
    shade: (p, _n, c) => {
      if (p.y < -0.45) c.multiplyScalar(0.6);
    },
  };
  // shape x → model z, extrude → model x
  b.add('stone', g, { ...stoneO, m: trs(-W / 2, 0, 0, 0, Math.PI / 2, 0) });
  // voussoir ring on both faces (slightly proud, darker), as small blocks
  for (const s of [-1, 1]) {
    for (let i = 0; i < 11; i++) {
      const a = -a0 + (2 * a0 * (i + 0.5)) / 11;
      const r = rad + 0.22;
      box(b, 'stone', 0.06, 0.45, 2 * a0 * rad / 11 - 0.03, trs(s * (W / 2 + 0.02), cy + Math.cos(a) * r, Math.sin(a) * r, -a, 0, 0), { ...stoneO, color: '#7a756a' });
    }
    // cutwater on the half-piers (pointed), both faces
    for (const zc of [-L / 2, L / 2]) {
      b.add('stone', new ExtrudeGeometry(triangle(1.0, 0.7), { depth: 0.01 + (spring - BRIDGE.footY) + 0.3, bevelEnabled: false }), {
        ...stoneO,
        m: trs(s * (W / 2), BRIDGE.footY, zc, -Math.PI / 2, -s * Math.PI / 2, 0),
      });
    }
  }
  // parapets with coping
  for (const s of [-1, 1]) {
    box(b, 'stone', 0.4, 0.85, L, trs(s * (W / 2 - 0.2), Y + 0.42, 0), { ...stoneO, jitter: 0.025 }, 0.5);
    box(b, 'stone', 0.5, 0.12, L, trs(s * (W / 2 - 0.2), Y + 0.9, 0), { ...stoneO, color: '#958f82' }, 1);
  }
  // cobbled deck tint strip (deck surface is the top of the extrusion; add a thin cobble layer)
  box(b, 'stone', W - 0.8, 0.04, L, trs(0, Y + 0.02, 0), { color: '#7b7466', noise: 0.25, noiseFreq: 4, ao: 0, dirt: 0.1 }, 0.4);
}

/** Pointed cutwater footprint (in the extrusion plane), base width w, length l. */
function triangle(w: number, l: number): Shape {
  const s = new Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, l);
  s.closePath();
  return s;
}

const cache = new Map<BridgeKind, ModelPart[]>();

export function bridgeParts(kind: BridgeKind): ModelPart[] {
  const hit = cache.get(kind);
  if (hit) return hit;
  const b = new PartBuilder({ seed: kind === 'wood' ? 701 : 702, ao: 0, dirt: 0 });
  if (kind === 'wood') woodSegment(b);
  else stoneSegment(b);
  const parts = b.build();
  cache.set(kind, parts);
  return parts;
}
