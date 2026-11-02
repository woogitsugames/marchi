// Wagon/horse/people close-ups, a 100-wagon render-cost probe and in-game shots (JPEG) for the
// models2 pass -> docs/shots/models2-<tag>-*.jpg.
// usage: node tools/models2-shots.mjs <tag> [preview|perf|game ...]
//   preview, perf: served by a Vite dev server started here (port 5287)
//   game: needs `npm run build` first; served by `vite preview` started here (port 4287)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const tag = process.argv[2] ?? 'after';
const parts = process.argv.slice(3).length ? process.argv.slice(3) : ['preview', 'close', 'perf', 'game'];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const jpeg = { type: 'jpeg', quality: 72 };

if (parts.includes('preview') || parts.includes('perf') || parts.includes('close')) {
  const server = await createServer({ server: { port: 5287, host: '127.0.0.1', hmr: false, strictPort: true }, logLevel: 'error' });
  await server.listen();
  if (parts.includes('preview')) {
    const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message)); page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
    for (const v of ['horse', 'horse-trot', 'wagon34', 'people', 'driver']) {
      const [view, gait] = v.split('-');
      await page.goto(`http://127.0.0.1:5287/tools/model-preview.html?view=${view}&still${gait ? `&gait=${gait}` : ''}`);
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `docs/shots/models2-${tag}-${v}.jpg`, ...jpeg });
      if (v === 'horse') console.log((await page.evaluate(() => window.__stats)).slice(0, 3).join('\n'));
      console.log(`shot ${v}`);
    }
    await page.close();
  }
  if (parts.includes('close')) {
    // the world view close to a moving wagon (the in-game renderer through the view harness)
    for (const [label, q] of [['close', 'follow=near&cam=41,34,22,-0.95&t=306&tod=0.33'], ['close2', 'follow=near&cam=41,34,19,-0.3&t=300&tod=0.4']]) {
      const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
      page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text().slice(0, 400)); });
      await page.goto(`http://127.0.0.1:5287/tools/view-harness.html?${q}&frames=4&hud=0`);
      await page.waitForFunction(() => window.__done === true, null, { timeout: 240000, polling: 500 });
      await page.screenshot({ path: `docs/shots/models2-${tag}-${label}.jpg`, ...jpeg });
      console.log(`shot ${label}`);
      await page.close();
    }
  }
  if (parts.includes('perf')) {
    // 100 wagons scattered over the roads; a mid zoom (mostly far LOD) and a near zoom (LOD0)
    for (const [label, cam] of [['mid', '45,34,110,-0.4'], ['near', '45,34,45,-0.4']]) {
      const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
      page.on('pageerror', (e) => console.log('[pageerror]', e.message)); page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
      await page.goto(`http://127.0.0.1:5287/tools/view-harness.html?cam=${cam}&t=5&wagons=100&stress=1&tod=0.4&frames=6&hud=0`);
      await page.waitForFunction(() => window.__done === true, null, { timeout: 240000, polling: 500 });
      const s = await page.evaluate(() => {
        const h = window.__harness;
        let wagonTris = 0, wagonCalls = 0;
        h.internals.scene.traverse((m) => {
          if (!m.isInstancedMesh || !m.visible || !m.count || !/^(wagon|cargo)-/.test(m.name)) return;
          const geo = m.geometry;
          wagonTris += ((geo.index ? geo.index.count : geo.attributes.position.count) / 3) * m.count;
          wagonCalls++;
        });
        return { ...h.view.stats(), wagonTris, wagonCalls };
      });
      console.log(`perf ${label}: calls ${s.drawCalls} tris ${s.triangles} | wagon meshes: calls ${s.wagonCalls} tris ${s.wagonTris}`);
      await page.screenshot({ path: `docs/shots/models2-${tag}-perf-${label}.jpg`, ...jpeg });
      await page.close();
    }
  }
  await server.close();
}

if (parts.includes('game')) {
  const srv = spawn('npx', ['vite', 'preview', '--port', '4287', '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', detached: true });
  try {
    await new Promise((r) => setTimeout(r, 2500));
    for (const [label, extra] of [['game', ''], ['game-wagon', '&wagon=1']]) {
      const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
      page.on('pageerror', (e) => console.log('[pageerror]', e.message)); page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
      await page.goto(`http://127.0.0.1:4287/?play=m1&bot=1&ff=170&quality=high&dynres=0${extra}`);
      await page.waitForFunction(() => window.__marchia?.ready === true, null, { timeout: 240000, polling: 500 });
      await page.waitForTimeout(6000);
      await page.screenshot({ path: `docs/shots/models2-${tag}-${label}.jpg`, ...jpeg, timeout: 120000 });
      console.log(`shot ${label}`);
      await page.close();
    }
  } finally {
    process.kill(-srv.pid, 'SIGTERM');
  }
}
await browser.close();
