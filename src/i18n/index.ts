import { en } from './en';
import { pl, type Dict, type MessageKey } from './pl';

export type Lang = 'pl' | 'en';
const dicts: Record<Lang, Dict> = { pl, en };
let current: Lang = 'pl';
const listeners = new Set<() => void>();

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem('marchia.lang');
    if (saved === 'pl' || saved === 'en') return saved;
  } catch { /* storage unavailable */ }
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'pl';
  return nav.startsWith('pl') ? 'pl' : 'en';
}

export function setLang(l: Lang): void {
  current = l;
  try { localStorage.setItem('marchia.lang', l); } catch { /* ignore */ }
  document.documentElement.lang = l;
  for (const f of listeners) f();
}

export function getLang(): Lang {
  return current;
}

export function onLangChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** Translate with {param} substitution. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let s: string = dicts[current][key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split('{' + k + '}').join(String(v));
  return s;
}

export type { MessageKey };
