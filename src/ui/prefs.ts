// Per-device UI preferences (localStorage, best effort).
import { isQualityPref, type QualityPref } from './tier';

export interface Prefs {
  /** 'auto' = pick from the device tier (src/ui/tier.ts). */
  quality: QualityPref;
  leftHanded: boolean;
  waybillCollapsed: boolean;
}

const KEY = 'marchia.prefs';
const DEFAULTS: Prefs = { quality: 'auto', leftHanded: false, waybillCollapsed: false };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
      if (!isQualityPref(p.quality)) p.quality = 'auto';
      return p;
    }
  } catch { /* storage unavailable */ }
  return { ...DEFAULTS };
}

export function savePrefs(p: Prefs): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
