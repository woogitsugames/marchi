// Per-device UI preferences (localStorage, best effort).
import type { Quality } from '../render/api';

export interface Prefs {
  quality: Quality;
  leftHanded: boolean;
  waybillCollapsed: boolean;
}

const KEY = 'marchia.prefs';
const DEFAULTS: Prefs = { quality: 'high', leftHanded: false, waybillCollapsed: false };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch { /* storage unavailable */ }
  return { ...DEFAULTS };
}

export function savePrefs(p: Prefs): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
