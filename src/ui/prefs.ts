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
  /** Single-key shortcuts (Space, 1 2 4, R C X B G H; a11y audit F5, D-119). null = not chosen yet: on where the
   *  main pointer is a mouse (desktop), off on touch devices (a keyboard there is rare; Voice Access or an
   *  on-screen keyboard could fire them by accident). */
  shortcuts: boolean | null;
}

const KEY = 'marchia.prefs';
const DEFAULTS: Prefs = { quality: 'auto', leftHanded: false, waybillCollapsed: false, musicVolume: 0.8, effectsVolume: 1, tutorialM1: 'new', shortcuts: null };

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
      if (typeof p.shortcuts !== 'boolean') p.shortcuts = null;
      return p;
    }
  } catch { /* storage unavailable */ }
  return { ...DEFAULTS };
}

/** Whether the single-key shortcuts are on (the player's choice, else on for a fine main pointer). */
export function shortcutsOn(p: Prefs): boolean {
  if (p.shortcuts !== null) return p.shortcuts;
  try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return true; }
}

export function savePrefs(p: Prefs): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

/** Per-session UI choices (sessionStorage, best effort; gone when the app is closed). Not part of the sim. */
const SESSION_KEY = 'marchia.session';
let sessionMem: Record<string, boolean> = {};

export function loadSessionFlag(name: string, fallback: boolean): boolean {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) sessionMem = { ...(JSON.parse(raw) as Record<string, boolean>) };
  } catch { /* storage unavailable: the in-memory copy still holds this run's choices */ }
  const v = sessionMem[name];
  return typeof v === 'boolean' ? v : fallback;
}

export function saveSessionFlag(name: string, value: boolean): void {
  sessionMem = { ...sessionMem, [name]: value };
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionMem)); } catch { /* ignore */ }
}
