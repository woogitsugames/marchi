// Tiny DOM helpers. No framework: the HUD is small and mostly updated by text/transform.

type Attrs = Record<string, string | number | boolean | null | undefined>;

/** Create an element: h('div.cls.cls2', {attr}, children...). */
export function h<K extends keyof HTMLElementTagNameMap>(
  spec: K | `${K}.${string}`,
  attrs?: Attrs | null,
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const [tag, ...classes] = spec.split('.') as [K, ...string[]];
  const el = document.createElement(tag);
  if (classes.length) el.className = classes.join(' ');
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'html') el.innerHTML = String(v);
      else if (k === 'text') el.textContent = String(v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c);
  }
  return el;
}

/** Element from an HTML string (first element). */
export function fromHtml<T extends Element = HTMLElement>(html: string): T {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

const NEEDS_ESC = /[&<>"]/;
export function esc(s: string): string {
  if (!NEEDS_ESC.test(s)) return s; // most labels: no copies (GC audit)
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Set innerHTML only when it changed (keeps :active state and avoids layout churn). */
export function setHtml(el: Element, html: string): boolean {
  const prev = (el as HTMLElement & { __html?: string }).__html;
  if (prev === html) return false;
  (el as HTMLElement & { __html?: string }).__html = html;
  el.innerHTML = html;
  return true;
}

export function setText(el: Element, s: string): void {
  if (el.textContent !== s) el.textContent = s;
}

/**
 * Deterministic deckled / torn edge as a clip-path polygon (percent along the edge, px depth).
 * edge: 'bottom' tears the bottom edge, 'right' the right edge.
 */
export function deckle(edge: 'bottom' | 'right', seed: number, depth = 7, steps = 26): string {
  let a = seed >>> 0 || 1;
  const rnd = (): number => {
    a ^= a << 13; a >>>= 0;
    a ^= a >>> 17;
    a ^= a << 5; a >>>= 0;
    return a / 4294967296;
  };
  const pts: string[] = [];
  if (edge === 'bottom') {
    pts.push('0 0', '100% 0');
    for (let i = steps; i >= 0; i--) {
      const d = (rnd() * 0.75 + (i % 3 === 0 ? 0.25 : 0)) * depth;
      pts.push(`${((i / steps) * 100).toFixed(2)}% calc(100% - ${d.toFixed(1)}px)`);
    }
  } else {
    pts.push('0 0');
    for (let i = 0; i <= steps; i++) {
      const d = (rnd() * 0.75 + (i % 3 === 0 ? 0.25 : 0)) * depth;
      pts.push(`calc(100% - ${d.toFixed(1)}px) ${((i / steps) * 100).toFixed(2)}%`);
    }
    pts.push('0 100%');
  }
  return `polygon(${pts.join(', ')})`;
}

/** The document runs right-to-left (Arabic, D-37): the HUD is mirrored by the CSS logical properties. */
export function isRtl(): boolean {
  return document.documentElement.dir === 'rtl';
}

/**
 * Is the tool rail on the physical left edge (landscape)? It sits at the inline end, so on the right in
 * LTR; the left-handed setting and RTL each mirror it once.
 */
export function railOnLeft(): boolean {
  return document.body.classList.contains('left-handed') !== isRtl();
}

