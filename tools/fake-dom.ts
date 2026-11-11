// A minimal DOM stand-in for headless cost probes (tools/ui-read-cost.ts): enough of Element / document / window for
// the HUD and the building / wagon sheets to build and update in node. No layout, no parsing: innerHTML is kept as a
// string (setting it drops the children), querySelector finds nothing. Only for measuring the reading code around the
// DOM writes — never for checking what the DOM shows.

class FakeClassList {
  private s = new Set<string>();
  add(...c: string[]): void { for (const x of c) this.s.add(x); }
  remove(...c: string[]): void { for (const x of c) this.s.delete(x); }
  contains(c: string): boolean { return this.s.has(c); }
  toggle(c: string, on?: boolean): boolean {
    const v = on ?? !this.s.has(c);
    if (v) this.s.add(c); else this.s.delete(c);
    return v;
  }
  get value(): string { return [...this.s].join(' '); }
  set value(v: string) { this.s = new Set(v.split(/\s+/).filter(Boolean)); }
}

export class FakeElement {
  tagName: string;
  children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  classList = new FakeClassList();
  dataset: Record<string, string> = {};
  style: Record<string, string> & { setProperty(k: string, v: string): void; removeProperty(k: string): void } =
    Object.assign(Object.create(null) as Record<string, string>, { setProperty() {}, removeProperty() {} });
  hidden = false;
  id = '';
  disabled = false;
  tabIndex = 0;
  scrollTop = 0;
  private attrs = new Map<string, string>();
  private html = '';
  private text = '';
  constructor(tag: string) { this.tagName = tag.toUpperCase(); }
  get className(): string { return this.classList.value; }
  set className(v: string) { this.classList.value = v; }
  get innerHTML(): string { return this.html; }
  set innerHTML(v: string) { this.html = v; for (const c of this.children) c.parentElement = null; this.children = []; }
  get textContent(): string { return this.text; }
  set textContent(v: string) { this.text = v; this.children = []; }
  get firstElementChild(): FakeElement | null { return this.children[0] ?? null; }
  get lastElementChild(): FakeElement | null { return this.children[this.children.length - 1] ?? null; }
  get childElementCount(): number { return this.children.length; }
  get isConnected(): boolean { return true; }
  get offsetWidth(): number { return 0; }
  get offsetHeight(): number { return 0; }
  get clientWidth(): number { return 0; }
  get clientHeight(): number { return 0; }
  get scrollHeight(): number { return 0; }
  setAttribute(k: string, v: string): void { this.attrs.set(k, String(v)); }
  getAttribute(k: string): string | null { return this.attrs.get(k) ?? null; }
  removeAttribute(k: string): void { this.attrs.delete(k); }
  hasAttribute(k: string): boolean { return this.attrs.has(k); }
  toggleAttribute(k: string, on?: boolean): boolean { const v = on ?? !this.attrs.has(k); if (v) this.attrs.set(k, ''); else this.attrs.delete(k); return v; }
  append(...n: (FakeElement | string)[]): void { for (const c of n) if (typeof c !== 'string') { c.remove(); c.parentElement = this; this.children.push(c); } }
  appendChild<T extends FakeElement>(c: T): T { this.append(c); return c; }
  prepend(...n: (FakeElement | string)[]): void { for (const c of n.reverse()) if (typeof c !== 'string') { c.remove(); c.parentElement = this; this.children.unshift(c); } }
  insertBefore<T extends FakeElement>(c: T): T { this.prepend(c); return c; }
  before(): void {}
  after(): void {}
  replaceWith(): void {}
  replaceChildren(...n: FakeElement[]): void { this.children = []; this.append(...n); }
  remove(): void {
    const p = this.parentElement;
    if (p) { const i = p.children.indexOf(this); if (i >= 0) p.children.splice(i, 1); }
    this.parentElement = null;
  }
  contains(o: unknown): boolean { return o === this; }
  closest(): null { return null; }
  querySelector(): null { return null; }
  querySelectorAll(): FakeElement[] { return []; }
  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean { return true; }
  focus(): void {}
  blur(): void {}
  click(): void {}
  animate(): { finished: Promise<void>; cancel(): void; onfinish: null } { return { finished: Promise.resolve(), cancel() {}, onfinish: null }; }
  getBoundingClientRect(): { x: number; y: number; left: number; top: number; right: number; bottom: number; width: number; height: number } {
    return { x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }
  get content(): FakeElement { return this; }
}

/** Install the stand-in as globalThis.document / window (idempotent). */
export function installFakeDom(): void {
  const g = globalThis as Record<string, unknown>;
  if (g.document) return;
  const body = new FakeElement('body');
  const doc = {
    body,
    documentElement: new FakeElement('html'),
    activeElement: body,
    visibilityState: 'visible',
    createElement: (t: string) => new FakeElement(t),
    createElementNS: (_: string, t: string) => new FakeElement(t),
    createTextNode: () => new FakeElement('#text'),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener() {},
    removeEventListener() {},
    fonts: { ready: Promise.resolve() },
  };
  g.document = doc;
  g.HTMLElement = FakeElement;
  g.Element = FakeElement;
  const store = new Map<string, string>();
  g.window = Object.assign(globalThis, {
    innerWidth: 412, innerHeight: 915, devicePixelRatio: 2.625,
    setTimeout, clearTimeout,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {}, removeEventListener() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  });
  if (!g.localStorage) g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  if (!g.navigator) g.navigator = { userAgent: 'node', language: 'pl' };
}
