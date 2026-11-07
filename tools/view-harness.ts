/**
 * Dev harness for the world view (src/render/view.ts).
 *   npx vite --port 5174   then open /tools/view-harness.html
 * URL params:
 *   speed=1|2|4      sim speed (default 1), paused=1 to freeze the sim
 *   wagons=N         buy wagons until N exist (coins forced high — harness only)
 *   t=seconds        fast-forward the sim before showing
 *   menu=1           main-menu cinematic mode
 *   overlay=traffic  road-load overlay
 *   rain=1           force rain (harness-only override of state.rain)
 *   quality=low|high|ultra  quality tier (default high). Ultra loads the 4K pack from
 *                    /assets-ultra/ on the dev server (2K without it)
 *   cam=x,z,dist,yaw camera preset (cells for x/z, metres, radians)
 *   tod=0..1         force time of day
 *   follow=1         follow the first moving loaded wagon
 *   sel=wagon|building|N  select something (N = building id)
 *   preview=x0,y0,x1,y1  show a road preview (validated like the build tool)
 *   stress=1         harness-only: scatter all wagons over the road network with random cargo
 *   hud=0            hide the stats box
 *   world=m7         another mission's world as built (default: m1 with the bot's bridge and four wagons)
 *   prior=m12        set (and draw) another mission's world before this one, like menu -> mission
 *   frames=N         render N frames (fixed 1/30 s steps) then stop — for slow software-GL screenshots
 *   baked=1          models decoded from the prebaked catalogue (D-331; the dev server bakes it per request)
 * Mouse: wheel = zoom at cursor, left drag = pan, right drag = rotate, click = pick.
 * window.__harness exposes { world, view, loop, internals, frames(), setQuality(q) } for scripted
 * screenshots; setQuality(q) switches the tier and resolves when its textures are bound.
 */
import { GameLoop, type Speed } from '../src/game/loop';
import { applyCommand, createWorld, lineCells, step, TICK_HZ, validateRoad, type Command } from '../src/sim/index';
import { QUALITIES, type Quality } from '../src/render/api';
import { createWorldView, installBakedModels, viewInternals } from '../src/render/view';
import { bridgeA, stableId } from './bot';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);

// world=<mission>: another mission's world as built (default m1 with the bot's bridge and four wagons)
const worldId = (q.get('world') ?? 'm1') as Parameters<typeof createWorld>[0];
const world = createWorld(worldId);
const plan: Command[] = worldId === 'm1' ? [bridgeA(world)] : [];
if (worldId === 'm1') for (let i = 0; i < 4; i++) plan.push({ t: 'buyWagon', stable: stableId(world) });
for (const c of plan) {
  const r = applyCommand(world, c);
  if (!r.ok) console.warn('harness command failed', c, r.err);
}
const wantWagons = num('wagons', 0);
if (wantWagons > 0) {
  world.state.coins = 1e6;
  while (world.state.wagons.length < wantWagons) {
    const r = applyCommand(world, { t: 'buyWagon', stable: stableId(world) });
    if (!r.ok) break;
  }
}
if (q.get('stress') === '1') {
  // Harness-only perf scene: put every wagon somewhere on the roads with some cargo.
  const roadCells: number[] = [];
  world.state.roads.forEach((r, i) => { if (r && !world.terrain.water[i]) roadCells.push(i); });
  const goods = ['wood', 'planks', 'grain', 'flour', 'bread'] as const;
  world.state.wagons.forEach((w, i) => {
    w.at = roadCells[(i * 7919) % roadCells.length]!;
    w.dest = -1; w.pathVer = -1; w.path = [];
    w.cargoGood = goods[i % goods.length]!;
    w.cargoQty = 1 + (i % 6);
  });
}
if (q.get('rain') === '1') world.state.rain = [{ start: 0, end: 1e9 }];
const ff = num('t', 0);
for (let i = 0; i < ff * TICK_HZ; i++) step(world);

if (q.get('baked') === '1') installBakedModels(await (await fetch('/__baked-models.bin')).arrayBuffer());
const canvas = document.getElementById('c') as HTMLCanvasElement;
const view = createWorldView();
const internals = viewInternals(view);
if (q.has('tod')) internals.debug.forceTime = num('tod', 0.3);
const qualityParam = q.get('quality') ?? 'high';
const quality: Quality = (QUALITIES as readonly string[]).includes(qualityParam) ? (qualityParam as Quality) : 'high';
view.mount(canvas);
view.setQuality(quality);
view.setMenuMode(q.get('menu') === '1');
if (q.has('prior')) {
  // prior=<mission>: show another world first, as the game does menu -> mission (D-222 restart leak check)
  view.setWorld(createWorld(q.get('prior') as Parameters<typeof createWorld>[0]));
  view.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  view.frame(0, 0); // dt 0: no clock (wind, water) advanced by the prior frame
}
view.setWorld(world);
if (q.get('overlay') === 'traffic') view.setOverlay('traffic');

const resize = () => view.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
window.addEventListener('resize', resize);
resize();

if (q.has('cam')) {
  const [x, z, d, yaw] = q.get('cam')!.split(',').map(Number);
  internals.rig.set((x ?? 48) * 4, (z ?? 36) * 4, d ?? 120, yaw ?? -0.3);
}

const loop = new GameLoop(world);
loop.speed = (q.get('paused') === '1' ? 0 : num('speed', 1)) as Speed;
loop.onTick = () => view.afterTick();

const sel = q.get('sel');
function applySel(): void {
  if (!sel) return;
  if (sel === 'wagon') {
    const w = world.state.wagons.find((x) => x.cargoQty > 0 && x.next >= 0) ?? world.state.wagons[0];
    if (w) view.setSelection({ kind: 'wagon', id: w.id });
  } else if (sel === 'building') {
    view.setSelection({ kind: 'building', id: world.state.buildings[0]!.id });
  } else {
    view.setSelection({ kind: 'building', id: Number(sel) });
  }
}
applySel();
if (q.has('preview')) {
  const [x0, y0, x1, y1] = q.get('preview')!.split(',').map(Number);
  const W = world.terrain.w;
  const cells = lineCells(W, y0! * W + x0!, y1! * W + x1!);
  const r = validateRoad(world, cells, 1);
  const bad = !r.ok && 'cell' in r.err ? (r.err as { cell: number }).cell : -1;
  view.setRoadPreview({ cells, valid: r.ok, badCell: bad });
}
if (q.get('follow') === '1' || q.get('follow') === 'near') {
  const W = world.terrain.w;
  const [cx, cz] = (q.get('cam') ?? '0,0').split(',').map(Number);
  const dist2 = (c: number) => ((c % W) - (cx ?? 0)) ** 2 + (Math.floor(c / W) - (cz ?? 0)) ** 2;
  const moving = world.state.wagons.filter((x) => x.next >= 0);
  if (q.get('follow') === 'near') moving.sort((a, b) => dist2(a.at) - dist2(b.at) - (a.cargoQty > 0 ? 30 : 0) + (b.cargoQty > 0 ? 30 : 0));
  const w = q.get('follow') === 'near' ? moving[0] : world.state.wagons.find((x) => x.cargoQty > 0 && x.next >= 0) ?? moving[0];
  if (w) {
    const W = world.terrain.w;
    const [, , d, yaw] = (q.get('cam') ?? '0,0,26,-0.5').split(',').map(Number);
    void W;
    internals.rig.set(((w.at % W) + 0.5) * 4, (Math.floor(w.at / W) + 0.5) * 4, d ?? 26, yaw ?? -0.5);
    view.camera.follow(w.id);
  }
}

// ---- input
let drag: { x: number; y: number; button: number; moved: number } | null = null;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, button: e.button, moved: 0 };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.button === 2) view.camera.rotate(-dx * 0.006);
  else view.camera.pan(dx, dy);
  drag.x = e.clientX;
  drag.y = e.clientY;
});
canvas.addEventListener('pointerup', (e) => {
  if (drag && drag.moved < 4 && drag.button === 0) {
    const p = view.pick(e.clientX, e.clientY);
    view.setSelection(p);
    lastPick = JSON.stringify(p) + ' cell ' + view.cellAt(e.clientX, e.clientY);
  }
  drag = null;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  view.camera.zoom(Math.exp(e.deltaY * 0.0012), e.clientX, e.clientY);
}, { passive: false });
window.addEventListener('keydown', (e) => {
  if (e.key === 't') view.setOverlay(overlay = overlay === 'traffic' ? 'none' : 'traffic');
  if (e.key === ' ') loop.speed = (loop.speed === 0 ? 1 : 0) as Speed;
  if (e.key >= '1' && e.key <= '4') loop.speed = Number(e.key) as Speed;
});
let overlay: 'none' | 'traffic' = q.get('overlay') === 'traffic' ? 'traffic' : 'none';
let lastPick = '';

const info = document.getElementById('info')!;
if (q.get('hud') === '0') info.classList.add('hidden');
const mark = document.getElementById('mark')!;
let last = performance.now();
let frames = 0;
const maxFrames = num('frames', 0);
const hide = (q.get('hide') ?? '').split(',').filter(Boolean);
function tick(now: number): void {
  let dt = now - last;
  last = now;
  if (maxFrames) dt = 1000 / 30;
  const alpha = loop.advance(dt);
  for (const n of hide) internals.scene.traverse((o) => { if (o.name.startsWith(n)) o.visible = false; });
  view.frame(alpha, dt);
  frames++;
  if ((frames % 15 === 0 || frames === maxFrames) && q.get('hud') !== '0') {
    const s = view.stats();
    const sel = world.state.wagons.find((w) => w.cargoQty > 0);
    const a = sel ? view.anchorOf('wagon', sel.id) : null;
    if (a && a.visible) { mark.style.display = 'block'; mark.style.left = a.x + 'px'; mark.style.top = a.y + 'px'; } else mark.style.display = 'none';
    info.textContent = `fps ${s.fps}  calls ${s.drawCalls}  tris ${(s.triangles / 1000).toFixed(0)}k  geo ${s.geometries}  tex ${s.textures}\n` +
      `t ${(world.state.tick / TICK_HZ).toFixed(0)}s  wagons ${world.state.wagons.length}  speed x${loop.speed}  ${lastPick}`;
  }
  if (maxFrames && frames >= maxFrames) {
    (window as unknown as { __done: boolean }).__done = true;
    return;
  }
  requestAnimationFrame(tick);
}
if (maxFrames) void internals.ready().then(() => requestAnimationFrame(tick));
else requestAnimationFrame(tick);

async function setQuality(next: Quality): Promise<void> {
  view.setQuality(next);
  await internals.ready();
}

(window as unknown as { __harness: unknown }).__harness = { world, view, loop, internals, frames: () => frames, setQuality };
