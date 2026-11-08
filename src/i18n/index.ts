// i18n: typed dictionaries (pl.ts is the key source, D-11), lazily loaded per language (D-18),
// ICU-lite plurals via Intl.PluralRules, RTL direction and per-script font stacks.
import { en } from './en';
import { pl, type Dict, type MessageKey } from './pl';
import { pluralize } from './plural';
import { isolateNumberParams } from './bidi';
import { pseudoize } from './pseudo';

/** Supported languages (owner's list, D-18). Order = order in the settings list. */
export const LANGS = [
  'en', 'pl', 'de', 'fr', 'es', 'it', 'pt-BR', 'nl', 'sv', 'tr', 'ru', 'uk', 'ja', 'ko', 'zh-Hans', 'ar', 'hi',
] as const;
export type Lang = (typeof LANGS)[number];

/** Native names for the language picker (never translated). */
export const LANG_NAMES: Record<Lang, string> = {
  en: 'English', pl: 'Polski', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano',
  'pt-BR': 'Português (Brasil)', nl: 'Nederlands', sv: 'Svenska', tr: 'Türkçe', ru: 'Русский',
  uk: 'Українська', ja: '日本語', ko: '한국어', 'zh-Hans': '简体中文', ar: 'العربية', hi: 'हिन्दी',
};

export const RTL_LANGS: ReadonlySet<Lang> = new Set<Lang>(['ar']);

/** Script family -> CSS class on <html> so styles can switch font stacks (see main.css). */
export function scriptOf(l: Lang): 'latin' | 'cyrillic' | 'cjk' | 'arabic' | 'devanagari' {
  if (l === 'ru' || l === 'uk') return 'cyrillic';
  if (l === 'ja' || l === 'ko' || l === 'zh-Hans') return 'cjk';
  if (l === 'ar') return 'arabic';
  if (l === 'hi') return 'devanagari';
  return 'latin';
}

/**
 * Lazy loaders for the other dictionaries. A missing file simply falls back to English per key,
 * so a language can ship partially translated during development.
 */
const loaders = import.meta.glob<{ default?: Partial<Dict> } & Record<string, Partial<Dict>>>(['./*.ts', '!./index.ts', '!./pl.ts', '!./en.ts']);
const dicts: Partial<Record<Lang, Partial<Dict>>> = { pl, en };

let current: Lang = 'en';
const listeners = new Set<() => void>();

function isLang(x: string | null | undefined): x is Lang {
  return !!x && (LANGS as readonly string[]).includes(x);
}

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem('marchia.lang');
    if (isLang(saved)) return saved;
  } catch { /* storage unavailable */ }
  const navs = typeof navigator !== 'undefined' ? [...(navigator.languages ?? []), navigator.language] : [];
  for (const raw of navs) {
    const n = raw.toLowerCase();
    if (n.startsWith('pt')) return 'pt-BR';
    if (n.startsWith('zh')) return 'zh-Hans';
    const base = n.split('-')[0]!;
    const hit = LANGS.find((l) => l.toLowerCase() === base);
    if (hit) return hit;
  }
  return 'en';
}

/** Languages that have a dictionary in the build (others are hidden in the picker until translated). */
export function availableLangs(): Lang[] {
  return LANGS.filter((l) => l === 'pl' || l === 'en' || `./${l.replace('-', '_')}.ts` in loaders);
}

/**
 * Pseudo-locale (`?lang=pseudo`, layout screenshots only): English rules and hyphenation, every message
 * accented and ~40 % longer (pseudo.ts). Not a language: never listed, never saved.
 */
let pseudo: Map<string, string> | null = null;
export function setPseudo(on: boolean): void {
  pseudo = on ? new Map() : null;
}
export function isPseudo(): boolean {
  return pseudo !== null;
}

export function parseLang(x: string | null | undefined): Lang | null {
  return isLang(x) ? x : null;
}

async function loadDict(l: Lang): Promise<void> {
  if (dicts[l]) return;
  const file = `./${l.replace('-', '_')}.ts`;
  const loader = loaders[file];
  if (!loader) return; // not translated yet: English fallback
  const mod = await loader();
  const exportName = l.replace('-', '_').replace(/[^a-zA-Z_]/g, '');
  dicts[l] = mod[exportName] ?? mod.default ?? {};
}

/** Switch language; resolves once the dictionary is loaded. Listeners re-render afterwards. */
export async function setLang(l: Lang): Promise<void> {
  await loadDict(l);
  current = l;
  pluralCache = null;
  if (!pseudo) try { localStorage.setItem('marchia.lang', l); } catch { /* ignore */ }
  const root = document.documentElement;
  root.lang = l;
  root.dir = RTL_LANGS.has(l) ? 'rtl' : 'ltr';
  root.dataset.script = scriptOf(l);
  for (const f of listeners) f();
}

export function getLang(): Lang {
  return current;
}

export function onLangChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

let pluralCache: Intl.PluralRules | null = null;

/**
 * ICU-lite plural blocks: `{n, plural, one {# wóz} few {# wozy} many {# wozów} other {# wozu}}`.
 * `#` is replaced by the number. Categories follow Intl.PluralRules for the current language;
 * `other` is required. Nested braces inside a branch are not supported (keep messages flat).
 */
export function formatPlural(s: string, params: Record<string, string | number>): string {
  return pluralize(s, params, current, (pluralCache ??= new Intl.PluralRules(current)), RTL_LANGS.has(current));
}

/** Translate with plural blocks and {param} substitution; falls back to English, then the key. */
/** The current language has its own text for `key` (not the English per-key fallback of a pending key). */
export function translated(key: MessageKey): boolean {
  return dicts[current]?.[key] !== undefined || current === 'en';
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let s: string = dicts[current]?.[key] ?? en[key] ?? key;
  if (pseudo) {
    let p = pseudo.get(key);
    if (p === undefined) { p = pseudoize(en[key] ?? key); pseudo.set(key, p); }
    s = p;
  }
  if (params) {
    if (s.includes(', plural,')) s = formatPlural(s, params);
    // right-to-left: number parameters keep their digit order without marks in the translation (D-340)
    if (RTL_LANGS.has(current)) s = isolateNumberParams(s, params);
    for (const [k, v] of Object.entries(params)) s = s.split('{' + k + '}').join(String(v));
  }
  return s;
}

export type { MessageKey, Dict };
