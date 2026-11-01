// Per-device UI preferences (localStorage, best effort).
import { isQualityPref, type QualityPref } from './tier';

export interface Prefs {
  /** 'auto' = pick from the device tier (src/ui/tier.ts). */
  quality: QualityPref;
  leftHanded: boolean;
  waybillCollapsed: boolean;
  /** 0..1 sliders in Settings */
  musicVolume: number;
  effectsVolume: number;
  /** Mission I tutorial: offered on a new m1 game until finished or skipped (docs/tutorial/m1.md). */
  tutorialM1: 'new' | 'skipped' | 'done';
}

const KEY = 'marchia.prefs';
const DEFAULTS: Prefs = { quality: 'auto', leftHanded: false, waybillCollapsed: false, musicVolume: 0.8, effectsVolume: 1, tutorialM1: 'new' };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
      if (!isQualityPref(p.quality)) p.quality = 'auto';
      const vol = (v: unknown, d: number): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d;
      p.musicVolume = vol(p.musicVolume, DEFAULTS.musicVolume);
      p.effectsVolume = vol(p.effectsVolume, DEFAULTS.effectsVolume);
      if (p.tutorialM1 !== 'skipped' && p.tutorialM1 !== 'done') p.tutorialM1 = 'new';
      return p;
    }
  } catch { /* storage unavailable */ }
  return { ...DEFAULTS };
}

export function savePrefs(p: Prefs): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
