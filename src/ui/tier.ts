// Device tier (default graphics quality) and dynamic render resolution.
// The DOM UI is never scaled: only the WebGL drawing buffer's pixel ratio changes, so text,
// icons and markers stay crisp on big high-DPI screens (Fold inner screen at DPR ~2.6).
import * as renderApi from '../render/api';
import type { Quality, WorldView } from '../render/api';

/** The quality levels the UI offers. 'ultra' is passed to the view only when it supports it. */
export type QualityChoice = 'low' | 'high' | 'ultra';
export type QualityPref = QualityChoice | 'auto';

export const QUALITY_CHOICES: readonly QualityChoice[] = ['low', 'high', 'ultra'];

export function isQualityPref(v: unknown): v is QualityPref {
  return v === 'auto' || v === 'low' || v === 'high' || v === 'ultra';
}

/**
 * Whether the render layer understands 'ultra'. Checked at runtime so this compiles (and does
 * the right thing) both before and after `Quality` in src/render/api.ts gains 'ultra':
 * the render may export `QUALITIES` from api.ts or expose `qualities` / `supportsQuality` on the view.
 */
export function viewSupports(view: WorldView, q: string): boolean {
  const mod = renderApi as unknown as { QUALITIES?: readonly string[] };
  const v = view as unknown as { qualities?: readonly string[]; supportsQuality?(q: string): boolean };
  try {
    return !!(mod.QUALITIES?.includes(q) || v.qualities?.includes(q) || v.supportsQuality?.(q));
  } catch { return false; }
}

/** The value handed to view.setQuality: 'ultra' falls back to 'high' when the view lacks it. */
export function renderQuality(view: WorldView, q: QualityChoice): Quality {
  if (q === 'ultra' && !viewSupports(view, 'ultra')) return 'high' as Quality;
  return q as Quality;
}

/** Upper bound for the drawing-buffer pixel ratio per quality (before dynamic scaling). */
export function dprCap(q: QualityChoice): number {
  return q === 'low' ? 1 : q === 'high' ? 2 : 3;
}

export interface DeviceTier {
  tier: QualityChoice;
  gpu: string;
  cores: number;
  memory: number;
  reason: string;
}

function gpuString(): string {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const s = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return s;
  } catch { return ''; }
}

/** Pure classification, exported for tests. */
export function classifyTier(gpu: string, cores: number, memory: number): { tier: QualityChoice; reason: string } {
  const g = gpu.toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|software|microsoft basic/.test(g)) return { tier: 'low', reason: 'software GL' };
  const adreno = /adreno[^0-9]*(\d{3})/.exec(g);
  if (adreno) {
    const n = Number(adreno[1]);
    // Adreno 8xx: Snapdragon 8 Elite (830) / 8 Elite Gen 5 (840) — Fold 7/8, Fold 8 Ultra, Flip 7/8
    if (n >= 830) return { tier: memory >= 8 || memory === 0 ? 'ultra' : 'high', reason: `Adreno ${n}` };
    if (n >= 640) return { tier: 'high', reason: `Adreno ${n}` };
    return { tier: 'low', reason: `Adreno ${n}` };
  }
  const mali = /mali-g(\d+)/.exec(g);
  if (mali) {
    const n = Number(mali[1]);
    return { tier: n >= 710 || (n >= 77 && n < 100) ? 'high' : 'low', reason: `Mali-G${n}` };
  }
  if (/immortalis/.test(g)) return { tier: 'high', reason: 'Immortalis' };
  const xclipse = /xclipse\D*(\d{3})/.exec(g);
  if (xclipse) return { tier: Number(xclipse[1]) >= 950 ? 'ultra' : 'high', reason: `Xclipse ${xclipse[1]}` };
  if (/powervr|vivante|videocore/.test(g)) return { tier: 'low', reason: 'low-end GPU' };
  if (/apple|nvidia|geforce|radeon|amd|intel\(r\) arc/.test(g)) return { tier: 'high', reason: 'desktop / Apple GPU' };
  if ((memory > 0 && memory <= 3) || (cores > 0 && cores <= 4)) return { tier: 'low', reason: 'few cores / little memory' };
  return { tier: 'high', reason: 'default' };
}

let cached: DeviceTier | null = null;
export function detectTier(): DeviceTier {
  if (cached) return cached;
  const gpu = gpuString();
  const cores = navigator.hardwareConcurrency || 0;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 0;
  const { tier, reason } = classifyTier(gpu, cores, memory);
  cached = { tier, gpu, cores, memory, reason };
  return cached;
}

/**
 * Adaptive render scale. Feed it every frame's dt; it averages over windows of >= 1 s / 30
 * frames. Below 55 fps it steps the scale down; after 5 good windows (and a cooldown that
 * doubles each time a raise had to be taken back) it steps up again.
 */
export class DynamicResolution {
  static readonly STEPS = [1, 0.85, 0.72, 0.6, 0.5] as const;
  private i = 0;
  private frames = 0;
  private acc = 0;
  private good = 0;
  private lastChange = 0;
  private lastRaise = -Infinity;
  private cooldown = 15000;
  enabled = true;
  lastFps = 0;

  get scale(): number {
    return this.enabled ? DynamicResolution.STEPS[this.i]! : 1;
  }

  /** Forget the running window (resize, tab switch, quality change): the next window starts clean. */
  reset(): void {
    this.frames = 0;
    this.acc = 0;
    this.good = 0;
  }

  /** Returns true when the scale changed. */
  sample(dtMs: number, now: number): boolean {
    if (!this.enabled) return false;
    if (dtMs <= 0 || dtMs > 200) return false; // hitch (resize, GC, tab switch): not a steady-state sample
    this.frames++;
    this.acc += dtMs;
    if (this.frames < 30 || this.acc < 1000) return false;
    const fps = (this.frames * 1000) / this.acc;
    this.lastFps = fps;
    this.frames = 0;
    this.acc = 0;
    const steps = DynamicResolution.STEPS.length;
    if (fps < 55) {
      this.good = 0;
      if (this.i < steps - 1 && now - this.lastChange > 900) {
        // a raise that did not hold: back off for longer next time
        if (now - this.lastRaise < 8000) this.cooldown = Math.min(240000, this.cooldown * 2);
        this.i++;
        this.lastChange = now;
        return true;
      }
      return false;
    }
    if (fps >= 58) {
      this.good++;
      if (this.i > 0 && this.good >= 5 && now - this.lastChange > this.cooldown) {
        this.i--;
        this.good = 0;
        this.lastChange = now;
        this.lastRaise = now;
        return true;
      }
    }
    return false;
  }
}
