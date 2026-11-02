// Numbers, durations and times of day through Intl for the current language (D-18, D-45). Latin digits
// everywhere ("-u-nu-latn"): counters keep a stable width and read the same in ar / hi; grouping, separators,
// the percent sign and the 24 h clock follow the language. Formatters are cached for the current language; the
// cache is dropped when it changes (format.ts calls setFmtLang from onLangChange). No i18n import, so the module
// runs in Node tests too.
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();
let lang: string | null = null;

/** Switch the formatting language (BCP 47) and drop the cached formatters. */
export function setFmtLang(l: string): void {
  if (l === lang) return;
  lang = l;
  cache.clear();
}

/** Until the first setFmtLang: the document language (index.html sets it before the first paint), else English. */
function getLang(): string {
  return lang ?? ((typeof document !== 'undefined' && document.documentElement.lang) || 'en');
}

function num(key: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  let f = cache.get(key) as Intl.NumberFormat | undefined;
  if (!f) {
    f = new Intl.NumberFormat(`${getLang()}-u-nu-latn`, opts);
    cache.set(key, f);
  }
  return f;
}

/** Whole number with the language's grouping: 12 345 (pl), 12.345 (de), 12,34,567 (hi). */
export function fmtInt(n: number): string {
  return num('int', { maximumFractionDigits: 0 }).format(Math.round(n));
}

/** Number with up to `digits` decimals (prices in silver from hundredths). */
export function fmtDec(n: number, digits = 2): string {
  return num(`dec${digits}`, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
}

/** A share 0..1 as a whole percent with the language's sign and spacing: 90% (en), 90 % (de). */
export function fmtPercent(share: number): string {
  return num('pct', { style: 'percent', maximumFractionDigits: 0 }).format(share);
}

/** A duration in seconds as m:ss (h:mm:ss from an hour on): a game clock, the same shape in every language. */
export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60), r = s % 60;
  const two = num('two', { minimumIntegerDigits: 2, useGrouping: false }), one = num('int', { maximumFractionDigits: 0 });
  if (m >= 60) return `${one.format(Math.floor(m / 60))}:${two.format(m % 60)}:${two.format(r)}`;
  return `${one.format(m)}:${two.format(r)}`;
}

/** Time of day for a day fraction (0 = midnight) on a 24 h cycle: 6:05 (pl, de), 06:05 (en, hi, ar). */
export function fmtDayTime(f: number): string {
  const mins = Math.floor(f * 24 * 60);
  let df = cache.get('day') as Intl.DateTimeFormat | undefined;
  if (!df) {
    df = new Intl.DateTimeFormat(`${getLang()}-u-nu-latn`, { hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' });
    cache.set('day', df);
  }
  return df.format(new Date(Date.UTC(2000, 0, 1, Math.floor(mins / 60) % 24, mins % 60)));
}

/** "have/need" counter with both numbers formatted. */
export function fmtRatio(have: number, need: number): string {
  return `${fmtInt(have)}/${fmtInt(need)}`;
}
