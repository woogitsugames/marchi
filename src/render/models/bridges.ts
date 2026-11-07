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
import { bakedOr } from './baked';
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
  // wheel guards: a squared log along each deck edge, bolted through the planks (keeps the hubs
  // off the railing posts)
  for (const sx of [-1, 1]) beam(b, 'wood', v3(sx * (W / 2 - 0.14), Y + 0.06, -L / 2), v3(sx * (W / 2 - 0.14), Y + 0.06, L / 2), 0.16, 0.13, { color: '#574a3b', vary: 0.1, ao: 0, dirt: 0.2 });
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
  const rise = 1.15;
  const spring = -1.6; // springing line height (crown at −0.45, water ≈ −1.2)
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
      box(b, 'stone', 0.06, 0.45, 2 * a0 * rad / 11 - 0.03, trs(s * (W / 2 + 0.02), cy + Math.cos(a) * r, Math.sin(a) * r, a, 0, 0), { ...stoneO, color: i % 2 ? '#737064' : '#827c70' });
    }
    // cutwater on the half-piers (pointed), both faces
    for (const zc of [-L / 2, L / 2]) {
      b.add('stone', new ExtrudeGeometry(triangle(1.0, 0.7), { depth: 0.01 + (spring - BRIDGE.footY) + 0.3, bevelEnabled: false }), {
        ...stoneO,
        m: trs(s * (W / 2), BRIDGE.footY, zc, -Math.PI / 2, -s * Math.PI / 2, 0),
      });
    }
  }
  // masonry read at game distance: a projecting string course at deck level and dressed blocks
  // (alternating long / short) on the pier spandrels between the arches
  for (const s of [-1, 1]) {
    box(b, 'stone', 0.1, 0.16, L, trs(s * (W / 2 + 0.04), Y - 0.12, 0), { ...stoneO, color: '#958f82', jitter: 0.01 }, 1);
    for (const zc of [-L / 2 + 0.28, L / 2 - 0.28]) {
      for (let k = 0; k < 4; k++) {
        const long = k % 2 === 0;
        box(b, 'stone', 0.05, 0.3, long ? 0.56 : 0.34, trs(s * (W / 2 + 0.025), -1.05 + k * 0.34, zc + (long ? 0 : Math.sign(zc) * 0.11), 0, 0, 0), { ...stoneO, color: k % 2 ? '#7f796d' : '#918b7e' });
      }
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

/**
 * Bridge end on the bank, built for the +Z end of a segment (z = L/2 onward into the land cell;
 * the renderer turns it 180° for the −Z end). Wood: a log sill and crib under the deck end, a
 * plank ramp down to the road, splayed wing logs holding the bank and heavier end posts. Stone:
 * splayed wing walls continuing the parapets with coping and a terminal block, a cobbled ramp
 * and a footing under the bank.
 */
function woodEnd(b: PartBuilder): void {
  const Y = BRIDGE.woodDeckY, W = BRIDGE.woodWidth, z0 = BRIDGE.cell / 2;
  const len = 1.5, n = 6, slope = Math.atan2(Y, len);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    box(b, 'wood', W - 0.3 + b.r(-0.08, 0.08), 0.06, len / n - 0.03, trs(b.r(-0.03, 0.03), Y * (1 - t) - 0.03, z0 + t * len, slope, b.r(-0.015, 0.015)), {
      color: PLANK, vary: 0.16, noise: 0.12, ao: 0, dirt: 0.3,
      shade: (p, _n, c) => { if (Math.abs(Math.abs(p.x) - 0.75) < 0.25) c.multiplyScalar(0.8); },
    });
  }
  // sill and crib logs across the road under the deck end, stepping down into the bank
  const log: Opts = { color: '#4d4238', ao: 0, dirt: 0.25, jitter: 0.01 };
  rod(b, 'bark', v3(-W / 2 - 0.4, -0.12, z0 + 0.12), v3(W / 2 + 0.4, -0.12, z0 + 0.12), 0.17, 0.16, 7, log);
  rod(b, 'bark', v3(-W / 2 - 0.3, -0.45, z0 - 0.1), v3(W / 2 + 0.3, -0.45, z0 - 0.1), 0.16, 0.15, 7, log);
  rod(b, 'bark', v3(-W / 2 - 0.2, -0.78, z0 - 0.3), v3(W / 2 + 0.2, -0.78, z0 - 0.3), 0.15, 0.15, 7, { ...log, color: '#3f362e' });
  for (const sx of [-1, 1]) {
    // wing logs splayed back into the bank
    for (const [y, r] of [[-0.3, 0.14], [-0.6, 0.13]] as const) {
      rod(b, 'bark', v3(sx * (W / 2 + 0.25), y, z0 - 0.3), v3(sx * (W / 2 + 0.7), y - 0.1, z0 + 1.1), r, r * 0.9, 6, log);
    }
    // end post, heavier than the railing posts, with a chamfered cap
    const x = sx * (W / 2 + 0.05);
    beam(b, 'wood', v3(x, -0.35, z0 - 0.05), v3(x, Y + 1.2, z0 - 0.05), 0.18, 0.18, { color: TIMBER, ao: 0 });
    box(b, 'wood', 0.24, 0.06, 0.24, trs(x, Y + 1.23, z0 - 0.05), { color: '#5d5040', ao: 0 });
    // the top rail runs on to the end post
    rod(b, 'wood', v3(x, Y + 1.0, z0 - 0.3), v3(x, Y + 1.0, z0 - 0.05), 0.06, 0.06, 6, { color: '#5d5040', ao: 0 });
  }
}

function stoneEnd(b: PartBuilder): void {
  const Y = BRIDGE.stoneDeckY, W = BRIDGE.stoneWidth, z0 = BRIDGE.cell / 2;
  const stoneO: Opts = { color: STONE, noise: 0.18, noiseFreq: 1.4, jitter: 0.02, ao: 0, dirt: 0.1 };
  const len = 1.6, splay = 0.32;
  // cobbled ramp from the deck down to the road
  box(b, 'stone', W - 0.8, 0.1, len, trs(0, Y * 0.5 - 0.03, z0 + len / 2, Math.atan2(Y, len), 0), { color: '#7b7466', noise: 0.25, noiseFreq: 4, ao: 0, dirt: 0.2 }, 0.4);
  // footing under the bank end
  box(b, 'stone', W + 0.4, 1.6, 1.1, trs(0, -0.85, z0 + 0.45), { ...stoneO, color: '#7d776b' }, 0.6);
  for (const sx of [-1, 1]) {
    // wing wall: the parapet carried on and turned outward into the bank
    const cx = sx * (W / 2 - 0.2 + Math.sin(splay) * len / 2), cz = z0 + Math.cos(splay) * len / 2;
    box(b, 'stone', 0.45, 2.3, len + 0.3, trs(cx, Y + 0.85 - 1.15, cz, 0, sx * splay, 0), { ...stoneO, jitter: 0.03 }, 0.5);
    box(b, 'stone', 0.55, 0.12, len + 0.3, trs(cx, Y + 0.9, cz, 0, sx * splay, 0), { ...stoneO, color: '#958f82' }, 1);
    // terminal block at the wing's end
    const ex = sx * (W / 2 - 0.2 + Math.sin(splay) * (len + 0.15)), ez = z0 + Math.cos(splay) * (len + 0.15);
    box(b, 'stone', 0.62, 1.2, 0.62, trs(ex, Y + 0.45, ez, 0, sx * splay, 0), { ...stoneO, color: '#857f73' }, 0.6);
    box(b, 'stone', 0.72, 0.12, 0.72, trs(ex, Y + 1.11, ez, 0, sx * splay, 0), { ...stoneO, color: '#958f82' }, 1);
  }
}

const endCache = new Map<BridgeKind, ModelPart[]>();

/** Bank-end pieces for a bridge run (see woodEnd / stoneEnd); frame as `bridgeParts`, +Z end. */
export function bridgeEndParts(kind: BridgeKind): ModelPart[] {
  const hit = endCache.get(kind);
  if (hit) return hit;
  const parts = bakedOr(`bridgeEnd:${kind}`, () => {
    const b = new PartBuilder({ seed: kind === 'wood' ? 711 : 712, ao: 0, dirt: 0 });
    if (kind === 'wood') woodEnd(b);
    else stoneEnd(b);
    return b.build();
  });
  endCache.set(kind, parts);
  return parts;
}

/**
 * Where a segment stands in the water (frame of `bridgeParts`): footprints that get a foam
 * collar and a wake. `hx`/`hz` are half sizes across / along the road. Wood: the four piles of
 * the mid-cell bent; stone: the pier at the −Z end (shared with the neighbour segment).
 */
export function bridgeFootings(kind: BridgeKind): { x: number; z: number; hx: number; hz: number }[] {
  if (kind === 'wood') return [-1.63, -0.53, 0.53, 1.63].map((x) => ({ x, z: 0, hx: 0.17, hz: 0.17 }));
  return [{ x: 0, z: -BRIDGE.cell / 2, hx: BRIDGE.stoneWidth / 2 + 0.6, hz: 0.55 }];
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
  const parts = bakedOr(`bridge:${kind}`, () => {
    const b = new PartBuilder({ seed: kind === 'wood' ? 701 : 702, ao: 0, dirt: 0 });
    if (kind === 'wood') woodSegment(b);
    else stoneSegment(b);
    return b.build();
  });
  cache.set(kind, parts);
  return parts;
}
