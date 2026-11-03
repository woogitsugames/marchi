// The plural-block formatter of t() without the module state (testable headless, see tests/i18n-plural.test.ts).

/**
 * Resolve `{name, plural, =0 {…} one {…} two {…} few {…} many {…} other {…}}` blocks with the given rules:
 * exact `=N` first, then the CLDR category, then `other`. `#` becomes the number in Latin digits (like every
 * number in the UI), bidi-isolated in right-to-left text so "11 كتلة" keeps the number with its word (D-37).
 */
export function pluralize(s: string, params: Record<string, string | number>, lang: string, rules: Intl.PluralRules, rtl: boolean): string {
  return s.replace(/\{(\w+), plural,((?:\s*(?:=\d+|zero|one|two|few|many|other)\s*\{[^{}]*\})+)\s*\}/g, (_m, name: string, body: string) => {
    const n = Number(params[name] ?? 0);
    const branches = new Map<string, string>();
    body.replace(/\s*(=\d+|zero|one|two|few|many|other)\s*\{([^{}]*)\}/g, (_x, k: string, v: string) => { branches.set(k, v); return ''; });
    const text = branches.get('=' + n) ?? branches.get(rules.select(n)) ?? branches.get('other') ?? '';
    const num = new Intl.NumberFormat(`${lang}-u-nu-latn`).format(n);
    return text.split('#').join(rtl ? `⁨${num}⁩` : num);
  });
}
