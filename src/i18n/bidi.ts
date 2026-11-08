// Bidi isolation of number parameters in right-to-left messages (D-340); pure, testable headless.

const FSI = '⁨';
const PDI = '⁩';
/** Opening isolate / embedding marks (LRI, RLI, FSI, LRE, RLE, LRO, RLO) and their closers (PDI, PDF). */
const OPEN = /[⁦⁧⁨‪‫‭‮]/g;
const CLOSE = /[⁩‬]/g;

/** A parameter value that is a number, time, ratio or price: no letter in it, not already isolated. */
export function isNumberParam(v: string | number): boolean {
  if (typeof v === 'number') return true;
  return v !== '' && !/\p{L}/u.test(v) && !/[⁦-⁩‪-‮\u0000-\u001f]/.test(v);
}

function openMarksBefore(s: string, at: number): number {
  const head = s.slice(0, at);
  return (head.match(OPEN)?.length ?? 0) - (head.match(CLOSE)?.length ?? 0);
}

/**
 * Wrap each number parameter of a template in FSI … PDI, so "07:58", "2:20" or "+5" keep their digit order inside an
 * Arabic sentence without the translator writing the marks. The isolate takes in a sign before the parameter
 * ("+{n}", "−{price}", "×{k}"), a percent sign after it ("{pct}%") and number parameters joined by "/", ":", "–"
 * ("{have}/{need}"): a sign left outside an isolate lands on the wrong side of the digits. A parameter the
 * template already isolates (⁨{time}⁩, ⁨+{n}⁩) is left as it is. Names (values with letters) are never wrapped:
 * an isolate between two Arabic letters would break their joining.
 */
export function isolateNumberParams(template: string, params: Record<string, string | number>): string {
  const keys = Object.keys(params).filter((k) => isNumberParam(params[k]!)).map((k) => k.replace(/[^\w]/g, ''));
  if (!keys.length) return template;
  const p = `\\{(?:${keys.join('|')})\\}`;
  const run = new RegExp(`[+\\-−±×]?${p}(?:[/:–\\-]${p})*[%٪‰]?`, 'g');
  return template.replace(run, (m: string, at: number) => (openMarksBefore(template, at) > 0 ? m : FSI + m + PDI));
}
