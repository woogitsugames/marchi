// Listener probe (day 11b, 2026-11-07): where does Chrome's `jsEventListeners` DOM counter grow during a long
// free-valley game? Instruments addEventListener / removeEventListener (live listeners by target type, connected /
// detached / collected) and the `on*` handler setters of IndexedDB requests and transactions and audio sources
// (how many objects got a handler, how many of them are still reachable), then plays the valley with the real
// autosave (every 30 s of game time) while opening and closing sheets. Each sample reads Memory.getDOMCounters
// three times: with no GC, after HeapProfiler.collectGarbage x2, and after a further wait + GC (Blink sweeps its
// heap lazily: listener objects are counted down only when their wrapper owner is swept).
// Usage: node tools/listeners-probe.mjs <baseUrl> [blocks=6] [minutesPerBlock=30] [sheetsPerMinute=2] [audio=0]
// audio=1: autoplay allowed and one trusted tap at the start, so Web Audio unlocks and one-shot sounds (each with an
// `onended` handler) play during the run.
// Prints one JSON line on stdout, a readable table on stderr.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [base, blocksS = '6', minutesS = '30', sheetsS = '2', audioS = '0'] = process.argv.slice(2);
const withAudio = audioS === '1';
const blocks = Number(blocksS), minutes = Number(minutesS), sheetsPerMinute = Number(sheetsS);
const benchCmds = JSON.parse(readFileSync(new URL('./frame-cost-bench.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc', ...(withAudio ? ['--autoplay-policy=no-user-gesture-required'] : [])] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 0.5, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await page.addInitScript(() => {
  const L = { adds: 0, removes: 0, live: new Set(), handlerSets: {}, handlerObjs: [] };
  window.__lt = L;
  const ET = EventTarget.prototype, add = ET.addEventListener, rem = ET.removeEventListener;
  const capOf = (o) => (typeof o === 'boolean' ? o : !!(o && o.capture));
  ET.addEventListener = function (type, fn, opts) {
    if (fn) {
      const cap = capOf(opts);
      let dup = false;
      for (const e of L.live) if (e.fn.deref() === fn && e.type === type && e.cap === cap && e.ref.deref() === this) { dup = true; break; }
      if (!dup) {
        L.adds++;
        L.live.add({ ref: new WeakRef(this), fn: new WeakRef(fn), type, cap, cls: this?.constructor?.name ?? '?', once: !!(opts && opts.once) });
      }
    }
    return add.call(this, type, fn, opts);
  };
  ET.removeEventListener = function (type, fn, opts) {
    const cap = capOf(opts);
    for (const e of L.live) if (e.fn.deref() === fn && e.type === type && e.cap === cap && e.ref.deref() === this) { L.live.delete(e); L.removes++; break; }
    return rem.call(this, type, fn, opts);
  };
  // on* handler setters: count sets, keep a weak handle to every object that got one
  const watch = (proto, props) => {
    if (!proto) return;
    for (const p of props) {
      const d = Object.getOwnPropertyDescriptor(proto, p);
      if (!d || !d.set) continue;
      Object.defineProperty(proto, p, {
        ...d,
        set(v) {
          const k = `${this.constructor.name}.${p}`;
          L.handlerSets[k] = (L.handlerSets[k] ?? 0) + 1;
          if (v && !this.__ltSeen) { this.__ltSeen = true; L.handlerObjs.push({ ref: new WeakRef(this), cls: this.constructor.name }); }
          d.set.call(this, v);
        },
      });
    }
  };
  watch(globalThis.IDBRequest?.prototype, ['onsuccess', 'onerror']);
  watch(globalThis.IDBOpenDBRequest?.prototype, ['onupgradeneeded', 'onblocked']);
  watch(globalThis.IDBTransaction?.prototype, ['oncomplete', 'onerror', 'onabort']);
  watch(globalThis.IDBDatabase?.prototype, ['onversionchange', 'onclose']);
  watch(globalThis.AudioScheduledSourceNode?.prototype, ['onended']);
  window.__ltSummary = () => {
    const byClass = {};
    let connected = 0, detached = 0, collected = 0, other = 0;
    for (const e of L.live) {
      const t = e.ref.deref();
      let state;
      if (!t) { state = 'collected'; collected++; }
      else if (t instanceof Node) { if (t.isConnected) { state = 'connected'; connected++; } else { state = 'detached'; detached++; } }
      else { state = 'other'; other++; }
      const k = `${e.cls}:${state}`;
      byClass[k] = (byClass[k] ?? 0) + 1;
    }
    let handlerAlive = 0;
    const handlerAliveBy = {};
    L.handlerObjs = L.handlerObjs.filter((o) => {
      if (!o.ref.deref()) return false;
      handlerAlive++;
      handlerAliveBy[o.cls] = (handlerAliveBy[o.cls] ?? 0) + 1;
      return true;
    });
    return { adds: L.adds, removes: L.removes, live: L.live.size, connected, detached, collected, other, byClass, handlerSets: { ...L.handlerSets }, handlerAlive, handlerAliveBy };
  };
});

const cdp = await ctx.newCDPSession(page);
await page.goto(`${base.replace(/\/?$/, '/')}?quality=low&dynres=0&debug=1`);
await page.waitForFunction(() => window.__marchia && window.__marchia.ready, null, { timeout: 120000 });
await page.waitForTimeout(2000);
if (withAudio) { await page.mouse.click(5, 450); await page.waitForTimeout(1500); }
await page.evaluate(() => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__mp = { parked: true, now: performance.now() };
  window.requestAnimationFrame = (f) => (window.__mp.parked ? 0 : raf(f));
});

const counters = async () => (await cdp.send('Memory.getDOMCounters')).jsEventListeners;
const gc = async () => { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); };
const sample = async (label) => {
  await page.waitForTimeout(400); // pending IndexedDB commits finish
  const raw = await counters();
  await gc();
  const afterGc = await counters();
  await page.waitForTimeout(3000);
  await gc();
  await page.waitForTimeout(1000);
  await gc();
  const settled = await counters();
  const dom = await cdp.send('Memory.getDOMCounters');
  const s = await page.evaluate(() => ({ ...window.__ltSummary(), tick: window.__marchia.app.world.state.tick, sheets: document.querySelectorAll('.sheet').length }));
  const row = { label, raw, afterGc, settled, nodes: dom.nodes, ...s };
  process.stderr.write(`${label}: listeners raw ${raw} gc ${afterGc} settled ${settled} | nodes ${dom.nodes} | aEL live ${s.live} (conn ${s.connected} det ${s.detached} coll ${s.collected} other ${s.other}) adds ${s.adds} removes ${s.removes} | on* objs alive ${s.handlerAlive} sets ${JSON.stringify(s.handlerSets)}\n`);
  return row;
};

await page.evaluate(({ cmds }) => {
  const app = window.__marchia.app;
  app.newGame('sandbox', 'valley3', false);
  const st = app.world.state;
  app.loop.speed = 0;
  st.coins = 1e9; st.town.rank = 5;
  for (const c of cmds) { if (c.t === 'road' && c.surface === 2) c.surface = 1; app.loop.enqueue(c); }
  app.loop.flushCommands();
  const stable = st.buildings.find((b) => b.type === 'stable');
  for (let i = 0; i < 100; i++) app.loop.enqueue({ t: 'buyWagon', stable: stable.id });
  app.loop.flushCommands();
}, { cmds: benchCmds });
const rows = [await sample('valley 0:00')];
for (let k = 1; k <= blocks; k++) {
  for (let m = 0; m < minutes; m++) {
    // one minute of game at x4 granularity: 600 ticks in 4 slices with a frame after each (sheets update ~4x/s of
    // real time; here once per slice), then open and close sheets the way a player taps around
    await page.evaluate(({ m, n }) => {
      const app = window.__marchia.app, M = window.__mp;
      const frame = () => { M.now = Math.max(M.now, app.lastFrame) + 260; app.frame(M.now); };
      const st = app.world.state;
      for (let q = 0; q < 4; q++) { for (let i = 0; i < 150; i++) app.loop.tickOnce(); frame(); }
      for (let j = 0; j < n; j++) {
        const pick = (m * n + j) % 6;
        if (pick === 0 || pick === 3) { const b = st.buildings[(m * 7 + j) % st.buildings.length]; app.go('building', b.id, false); }
        else if (pick === 1) { const w = st.wagons[(m * 13 + j) % st.wagons.length]; if (w) app.go('wagon', w.id, false); }
        else if (pick === 2) app.openMarket();
        else if (pick === 4) app.openGameMenu();
        else app.sheets.onHelp?.('stalls');
        frame(); frame(); frame();
        app.sheets.closeAll();
        frame();
      }
    }, { m: (k - 1) * minutes + m, n: sheetsPerMinute });
    await page.waitForTimeout(10); // let IndexedDB transactions complete between minutes, as in real play
  }
  rows.push(await sample(`valley ${Math.floor((k * minutes) / 60)}:${String((k * minutes) % 60).padStart(2, '0')}`));
}
console.log(JSON.stringify({ withAudio, blocks, minutes, sheetsPerMinute, rows, errors: errs.slice(0, 5) }));
await browser.close();
