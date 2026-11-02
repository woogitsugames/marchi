/**
 * On-device WebGL benchmark. Separate Vite entry, never starts the game UI.
 * Runs the production GameLoop at x4 with a repeatable 60-second camera script.
 */
import { GameLoop } from '../src/game/loop';
import { type Quality, type WorldView } from '../src/render/api';
import { CELL } from '../src/render/heightfield';
import { disposeTextures } from '../src/render/textures';
import { createWorldView, viewInternals } from '../src/render/view';
import { step, TICK_HZ, type World } from '../src/sim/index';
import { benchWorld } from './bench';

const WAGON_COUNTS = [50, 100, 200] as const;
const RUN_MS = 60_000;
const WARMUP_FRAMES = 45;
const WARMUP_TICKS = 4 * TICK_HZ;
const CAMERA = [
  { name: 'near', distance: 60, yaw: -0.55 },
  { name: 'medium', distance: 160, yaw: -0.35 },
  { name: 'far', distance: 320, yaw: -0.2 },
] as const;
const MB = 1024 * 1024;

interface ViewportInfo {
  width: number;
  height: number;
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  dpr: number;
}

interface DeviceInfo {
  userAgent: string;
  platform: string;
  hardwareConcurrency: number | null;
  deviceMemoryGB: number | null;
  webglVersion: string;
  renderer: string;
  vendor: string;
  unmaskedRenderer: boolean;
}

interface PhaseStats {
  zoom: string;
  distance: number;
  fpsAvg: number;
  fps1Low: number;
}

interface BenchRow {
  quality: Quality;
  wagons: number;
  seconds: number;
  frames: number;
  ticks: number;
  achievedSpeed: number;
  fpsAvg: number;
  fps1Low: number;
  frameMsP99: number;
  simCpuMsPerFrame: number;
  renderCpuMsPerFrame: number;
  simCpuMsP95: number;
  renderCpuMsP95: number;
  drawCallsAvg: number;
  trianglesAvg: number;
  texturesPeak: number;
  geometriesPeak: number;
  heapStartMB: number | null;
  heapEndMB: number | null;
  heapPeakMB: number | null;
  heapDeltaMB: number | null;
  viewport: ViewportInfo;
  camera: PhaseStats[];
}

interface DeviceReport {
  schema: 'marchia.device-bench.v1';
  recordedAt: string;
  device: DeviceInfo | null;
  setup: {
    durationSeconds: 60;
    speed: 4;
    tickHz: number;
    warmupFrames: number;
    warmupTicks: number;
    cameraDistances: number[];
    dynamicResolution: false;
  };
  runs: BenchRow[];
}

const canvas = get<HTMLCanvasElement>('scene');
const qualitySelect = get<HTMLSelectElement>('quality');
const runButton = get<HTMLButtonElement>('run');
const stopButton = get<HTMLButtonElement>('stop');
const copyButton = get<HTMLButtonElement>('copy');
const saveButton = get<HTMLButtonElement>('save');
const statusText = get<HTMLElement>('status');
const progress = get<HTMLProgressElement>('progress');
const resultsPanel = get<HTMLElement>('results');
const resultsBody = get<HTMLTableSectionElement>('result-rows');
const jsonPreview = get<HTMLElement>('json-preview');

let report: DeviceReport | null = null;
let currentView: WorldView | null = null;
let running = false;
let cancelled = false;
let cancelReason = '';
let referenceSize: { width: number; height: number; dpr: number } | null = null;

function get<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error('Missing benchmark element: ' + id);
  return el as T;
}

function round(value: number, decimals = 2): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function average(values: readonly number[]): number {
  return values.length ? values.reduce((n, v) => n + v, 0) / values.length : 0;
}

function percentile(values: readonly number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]!;
}

/** "1% low FPS" = reciprocal of mean frame time in the slowest 1% of frames. */
function lowOnePercent(frameMs: readonly number[]): number {
  if (!frameMs.length) return 0;
  const descending = [...frameMs].sort((a, b) => b - a);
  const count = Math.max(1, Math.ceil(descending.length * 0.01));
  return round(1000 / average(descending.slice(0, count)), 1);
}

function fps(frameMs: readonly number[]): number {
  return frameMs.length ? round(1000 / average(frameMs), 1) : 0;
}

function memoryMB(): number | null {
  const m = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
  return typeof m?.usedJSHeapSize === 'number' ? round(m.usedJSHeapSize / MB, 1) : null;
}

function canvasSize(): { width: number; height: number; dpr: number } {
  return {
    width: Math.max(1, Math.round(canvas.clientWidth)),
    height: Math.max(1, Math.round(canvas.clientHeight)),
    dpr: window.devicePixelRatio || 1,
  };
}

function viewportInfo(): ViewportInfo {
  return { ...canvasSize(), drawingBufferWidth: canvas.width, drawingBufferHeight: canvas.height };
}

function deviceInfo(): DeviceInfo {
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  const debug = gl?.getExtension('WEBGL_debug_renderer_info');
  const renderer = gl ? String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : 'WebGL unavailable';
  const vendor = gl ? String(gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR)) : 'WebGL unavailable';
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    deviceMemoryGB: nav.deviceMemory ?? null,
    webglVersion: gl ? String(gl.getParameter(gl.VERSION)) : 'unavailable',
    renderer,
    vendor,
    unmaskedRenderer: !!debug,
  };
}

/** Camera is a function of measured wall time, never of frame count. */
function cameraAt(view: WorldView, world: World, elapsedMs: number): number {
  const phase = Math.min(CAMERA.length - 1, Math.floor(elapsedMs / (RUN_MS / CAMERA.length)));
  const cfg = CAMERA[phase]!;
  const t = elapsedMs / RUN_MS;
  const x = world.terrain.w * CELL * (0.5 + 0.09 * Math.sin(t * 2 * Math.PI));
  const z = world.terrain.h * CELL * (0.5 + 0.06 * Math.cos(t * 2 * Math.PI));
  viewInternals(view).rig.setGoal(x, z, cfg.distance, cfg.yaw + 0.08 * Math.sin(t * 2 * Math.PI));
  return phase;
}

async function warmup(view: WorldView, world: World): Promise<void> {
  // Fixed initial sim state for every run, outside the measured interval.
  for (let i = 0; i < WARMUP_TICKS; i++) {
    step(world);
    view.afterTick();
  }
  const rig = viewInternals(view).rig;
  rig.set(world.terrain.w * CELL * 0.5, world.terrain.h * CELL * 0.56, CAMERA[0].distance, CAMERA[0].yaw);
  await new Promise<void>((resolve) => {
    let count = 0;
    let previous = 0;
    function frame(now: number): void {
      if (cancelled) { resolve(); return; }
      if (document.hidden) { previous = 0; requestAnimationFrame(frame); return; }
      const dt = previous ? Math.min(250, now - previous) : 1000 / 60;
      previous = now;
      cameraAt(view, world, 0);
      view.frame(1, dt);
      if (++count < WARMUP_FRAMES) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

function setStatus(message: string): void {
  statusText.textContent = message;
}

function cancel(message: string): void {
  cancelled = true;
  cancelReason = message;
  setStatus(message);
}

function sizeUnchanged(): boolean {
  if (!referenceSize) return true;
  const next = canvasSize();
  return Math.abs(next.width - referenceSize.width) <= 3 &&
    Math.abs(next.height - referenceSize.height) <= 3 &&
    Math.abs(next.dpr - referenceSize.dpr) < 0.01;
}

async function measure(view: WorldView, world: World, quality: Quality, wagons: number, index: number, total: number): Promise<BenchRow | null> {
  const loop = new GameLoop(world);
  loop.speed = 4;
  loop.onTick = () => view.afterTick();
  const samples: number[] = [];
  const simMs: number[] = [];
  const renderMs: number[] = [];
  const phases: number[][] = CAMERA.map(() => []);
  const startingTick = world.state.tick;
  const heapStartMB = memoryMB();
  let heapPeakMB = heapStartMB;
  let calls = 0;
  let triangles = 0;
  let texturesPeak = 0;
  let geometriesPeak = 0;
  let elapsed = 0;
  let lastReport = 0;
  const viewport = viewportInfo();

  setStatus('Przebieg ' + index + '/' + total + ': ' + quality + ' / ' + wagons + ' wozów — 0/60 s');
  progress.value = 0;

  return new Promise<BenchRow | null>((resolve, reject) => {
    let previous = 0;
    function frame(now: number): void {
      if (cancelled) { resolve(null); return; }
      if (document.hidden) {
        previous = 0;
        setStatus('Pomiar wstrzymany — karta jest w tle.');
        requestAnimationFrame(frame);
        return;
      }
      if (!previous) {
        previous = now;
        requestAnimationFrame(frame);
        return;
      }
      if (!sizeUnchanged()) {
        cancel('Zmieniono rozmiar ekranu lub DPR; pomiar przerwany. Ustaw orientację i rozpocznij ponownie.');
        resolve(null);
        return;
      }
      const dt = now - previous;
      previous = now;
      if (dt <= 0) { requestAnimationFrame(frame); return; }
      try {
        const phase = cameraAt(view, world, elapsed);
        const start = performance.now();
        // The same cap (250 ms) as App.frame; the loop also has its production tick cap.
        const alpha = loop.advance(Math.min(250, dt));
        const afterSim = performance.now();
        view.frame(alpha, dt);
        const afterRender = performance.now();
        samples.push(dt);
        phases[phase]!.push(dt);
        simMs.push(afterSim - start);
        renderMs.push(afterRender - afterSim);
        const stat = view.stats();
        calls += stat.drawCalls;
        triangles += stat.triangles;
        texturesPeak = Math.max(texturesPeak, stat.textures);
        geometriesPeak = Math.max(geometriesPeak, stat.geometries);
        elapsed += dt;
        if (now - lastReport >= 500) {
          lastReport = now;
          const heap = memoryMB();
          if (heap !== null) heapPeakMB = Math.max(heapPeakMB ?? heap, heap);
          progress.value = Math.min(100, elapsed / RUN_MS * 100);
          setStatus('Przebieg ' + index + '/' + total + ': ' + quality + ' / ' + wagons + ' wozów — ' +
            Math.min(60, Math.floor(elapsed / 1000)) + '/60 s, ' + fps(samples) + ' FPS');
        }
        if (elapsed >= RUN_MS) {
          const heapEndMB = memoryMB();
          if (heapEndMB !== null) heapPeakMB = Math.max(heapPeakMB ?? heapEndMB, heapEndMB);
          progress.value = 100;
          resolve({
            quality, wagons, seconds: round(elapsed / 1000, 2),
            frames: samples.length, ticks: world.state.tick - startingTick,
            achievedSpeed: round((world.state.tick - startingTick) / (TICK_HZ * elapsed / 1000)),
            fpsAvg: fps(samples), fps1Low: lowOnePercent(samples),
            frameMsP99: round(percentile(samples, 0.99)),
            simCpuMsPerFrame: round(average(simMs), 3),
            renderCpuMsPerFrame: round(average(renderMs), 3),
            simCpuMsP95: round(percentile(simMs, 0.95), 3),
            renderCpuMsP95: round(percentile(renderMs, 0.95), 3),
            drawCallsAvg: Math.round(calls / samples.length),
            trianglesAvg: Math.round(triangles / samples.length),
            texturesPeak, geometriesPeak,
            heapStartMB, heapEndMB, heapPeakMB,
            heapDeltaMB: heapStartMB === null || heapEndMB === null ? null : round(heapEndMB - heapStartMB, 1),
            viewport,
            camera: CAMERA.map((c, i) => ({
              zoom: c.name, distance: c.distance,
              fpsAvg: fps(phases[i]!), fps1Low: lowOnePercent(phases[i]!),
            })),
          });
        } else {
          requestAnimationFrame(frame);
        }
      } catch (error) {
        reject(error);
      }
    }
    requestAnimationFrame(frame);
  });
}

function showResults(): void {
  const runs = report?.runs ?? [];
  resultsBody.replaceChildren();
  for (const r of runs) {
    const tr = document.createElement('tr');
    const cells = [
      r.quality, String(r.wagons), r.fpsAvg.toFixed(1), r.fps1Low.toFixed(1),
      r.simCpuMsPerFrame.toFixed(3), r.renderCpuMsPerFrame.toFixed(3),
      String(r.drawCallsAvg), String(r.trianglesAvg),
      String(r.texturesPeak), r.heapDeltaMB === null ? 'n/d' : String(r.heapDeltaMB),
      String(r.achievedSpeed),
    ];
    for (const value of cells) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.append(td);
    }
    resultsBody.append(tr);
  }
  resultsPanel.hidden = runs.length === 0;
  copyButton.disabled = runs.length === 0;
  saveButton.disabled = runs.length === 0;
  jsonPreview.textContent = report ? JSON.stringify(report, null, 2) : '';
}

async function start(): Promise<void> {
  if (running) return;
  running = true;
  cancelled = false;
  cancelReason = '';
  runButton.disabled = true;
  stopButton.disabled = false;
  qualitySelect.disabled = true;
  resultsPanel.hidden = true;
  const choice = qualitySelect.value;
  const qualities: Quality[] = choice === 'all' ? ['low', 'high', 'ultra'] : [choice as Quality];
  const total = qualities.length * WAGON_COUNTS.length;
  referenceSize = canvasSize();
  report = {
    schema: 'marchia.device-bench.v1',
    recordedAt: new Date().toISOString(),
    device: null,
    setup: {
      durationSeconds: 60, speed: 4, tickHz: TICK_HZ,
      warmupFrames: WARMUP_FRAMES, warmupTicks: WARMUP_TICKS,
      cameraDistances: CAMERA.map((c) => c.distance), dynamicResolution: false,
    },
    runs: [],
  };
  let index = 0;
  try {
    for (const quality of qualities) {
      for (const wagons of WAGON_COUNTS) {
        if (cancelled) break;
        index++;
        setStatus('Przygotowanie ' + index + '/' + total + ': ' + quality + ' / ' + wagons + ' wozów; ładowanie tekstur…');
        progress.value = 0;
        const world = benchWorld(wagons);
        const view = createWorldView();
        currentView = view;
        try {
          view.setQuality(quality);
          view.setWorld(world);
          view.mount(canvas);
          const size = canvasSize();
          view.resize(size.width, size.height, size.dpr);
          if (!report.device) report.device = deviceInfo();
          await viewInternals(view).ready();
          if (cancelled) break;
          setStatus('Rozgrzewanie renderera ' + index + '/' + total + '…');
          await warmup(view, world);
          if (cancelled) break;
          const row = await measure(view, world, quality, wagons, index, total);
          if (row) {
            report.runs.push(row);
            showResults();
          }
        } finally {
          view.dispose();
          currentView = null;
          // Drop cached PBR textures between runs; don't measure setup/teardown.
          await disposeTextures();
        }
      }
      if (cancelled) break;
    }
    setStatus(cancelled
      ? cancelReason || ('Zatrzymano. Zakończone przebiegi: ' + report.runs.length + '/' + total + '.')
      : 'Gotowe: ' + report.runs.length + ' przebiegów po 60 sekund. Skopiuj lub zapisz JSON.');
  } catch (error) {
    console.error('[device-bench] failed', error);
    setStatus('Błąd benchmarku: ' + String(error));
  } finally {
    running = false;
    referenceSize = null;
    runButton.disabled = false;
    stopButton.disabled = true;
    qualitySelect.disabled = false;
    showResults();
  }
}

async function copyJSON(): Promise<void> {
  if (!report?.runs.length) return;
  const value = JSON.stringify(report, null, 2);
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      // HTTP LAN preview is not a secure context, so Clipboard API may be unavailable.
      const input = document.createElement('textarea');
      input.value = value;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.append(input);
      input.focus();
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      if (!copied) throw new Error('Clipboard not permitted');
    }
    setStatus('Wyniki JSON skopiowane.');
  } catch (error) {
    setStatus('Kopiowanie niedostępne: ' + String(error) + '. Skopiuj tekst z podglądu JSON.');
  }
}

function saveJSON(): void {
  if (!report?.runs.length) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'marchia-device-bench-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  document.body.append(link);
  link.click();
  link.remove();
  setStatus('Zlecono pobranie JSON. Jeśli WebView blokuje pliki, użyj kopiowania.');
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

runButton.addEventListener('click', () => { void start(); });
stopButton.addEventListener('click', () => { cancel('Zatrzymano pomiar na żądanie. Zakończone przebiegi zachowano.'); });
copyButton.addEventListener('click', () => { void copyJSON(); });
saveButton.addEventListener('click', saveJSON);
window.addEventListener('resize', () => {
  if (running && !sizeUnchanged()) cancel('Zmiana rozmiaru okna w trakcie pomiaru. Wynik cząstkowy odrzucono.');
  if (!running && currentView) {
    const s = canvasSize();
    currentView.resize(s.width, s.height, s.dpr);
  }
});
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  if (running) cancel('Utracono kontekst WebGL; pomiar przerwany.');
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running && !cancelled) setStatus('Pomiar wstrzymany — karta jest w tle.');
});
