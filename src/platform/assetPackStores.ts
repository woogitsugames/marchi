// PackStore backends for the 4K texture pack (see assetPack.ts, docs/ASSET_PACK.md):
//   native — @capacitor/filesystem, Directory.Data/ultra-pack/v<N>/…, served to the WebView via
//            Capacitor.convertFileSrc();
//   web    — Cache Storage (one cache per version) served at <app>/__ultra-pack/v<N>/… by the tiny
//            service worker public/ultra-pack-sw.js; without a controlling worker the renderer
//            falls back to the network base URL (browser HTTP cache);
//   memory — for tests.
// Capacitor is imported dynamically so Node tests never load a native runtime.
import type { PackState, PackStore } from './assetPack';

const NATIVE_ROOT = 'ultra-pack';
const VIRTUAL_DIR = '__ultra-pack';
const STATE_CACHE = 'marchia-ultra-state';
const versionCache = (v: number): string => `marchia-ultra-v${v}`;
export const ULTRA_SW_FILE = 'ultra-pack-sw.js';

/** In-memory store (tests, or a session-only fallback). Copies data in and out. */
export class MemoryPackStore implements PackStore {
  state: PackState | null = null;
  readonly files = new Map<string, Uint8Array>();
  writes = 0;

  async readState(): Promise<PackState | null> {
    return this.state ? (JSON.parse(JSON.stringify(this.state)) as PackState) : null;
  }
  async writeState(state: PackState | null): Promise<void> {
    this.state = state ? (JSON.parse(JSON.stringify(state)) as PackState) : null;
  }
  async read(version: number, path: string): Promise<Uint8Array | null> {
    const d = this.files.get(`v${version}/${path}`);
    return d ? d.slice() : null;
  }
  async write(version: number, path: string, data: Uint8Array): Promise<void> {
    this.writes++;
    this.files.set(`v${version}/${path}`, data.slice());
  }
  async removeVersion(version: number): Promise<void> {
    for (const k of [...this.files.keys()]) if (k.startsWith(`v${version}/`)) this.files.delete(k);
  }
  async baseUrl(version: number): Promise<string> {
    return `memory://ultra/v${version}/`;
  }
}

export function bytesToBase64(data: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < data.length; i += CHUNK) s += String.fromCharCode(...data.subarray(i, i + CHUNK));
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Native app storage (Android / iOS). */
export async function createNativeStore(): Promise<PackStore> {
  const [{ Capacitor }, { Filesystem, Directory, Encoding }] = await Promise.all([
    import('@capacitor/core'),
    import('@capacitor/filesystem'),
  ]);
  const directory = Directory.Data;
  const statePath = `${NATIVE_ROOT}/state.json`;
  const filePath = (v: number, p: string): string => `${NATIVE_ROOT}/v${v}/${p}`;
  const exists = async (path: string): Promise<boolean> => {
    try { await Filesystem.stat({ path, directory }); return true; } catch { return false; }
  };
  return {
    async readState() {
      if (!(await exists(statePath))) return null;
      const r = await Filesystem.readFile({ path: statePath, directory, encoding: Encoding.UTF8 });
      try { return JSON.parse(String(r.data)) as PackState; } catch { return null; }
    },
    async writeState(state) {
      if (state === null) {
        if (await exists(statePath)) await Filesystem.deleteFile({ path: statePath, directory });
        return;
      }
      await Filesystem.writeFile({ path: statePath, directory, encoding: Encoding.UTF8, recursive: true, data: JSON.stringify(state) });
    },
    async read(v, p) {
      const path = filePath(v, p);
      if (!(await exists(path))) return null;
      const r = await Filesystem.readFile({ path, directory });
      return typeof r.data === 'string' ? base64ToBytes(r.data) : new Uint8Array(await r.data.arrayBuffer());
    },
    async write(v, p, data) {
      await Filesystem.writeFile({ path: filePath(v, p), directory, recursive: true, data: bytesToBase64(data) });
    },
    async removeVersion(v) {
      const path = `${NATIVE_ROOT}/v${v}`;
      if (await exists(path)) await Filesystem.rmdir({ path, directory, recursive: true });
    },
    async baseUrl(v) {
      const { uri } = await Filesystem.getUri({ path: `${NATIVE_ROOT}/v${v}`, directory });
      const url = Capacitor.convertFileSrc(uri);
      return url.endsWith('/') ? url : `${url}/`;
    },
  };
}

/** Registers the pack service worker and waits briefly for it to control the page. */
async function ultraWorkerReady(timeoutMs = 3000): Promise<boolean> {
  const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
  if (!sw) return false;
  if (sw.controller) return true;
  try {
    await sw.register(new URL(ULTRA_SW_FILE, document.baseURI).href, { scope: './' });
  } catch {
    return false;
  }
  if (sw.controller) return true;
  return new Promise<boolean>((resolve) => {
    const t = setTimeout(() => resolve(!!sw.controller), timeoutMs);
    sw.addEventListener('controllerchange', () => { clearTimeout(t); resolve(true); }, { once: true });
  });
}

/** Browser storage: Cache Storage, served by public/ultra-pack-sw.js. */
export function createWebStore(): PackStore {
  const root = new URL(`${VIRTUAL_DIR}/`, document.baseURI).href;
  const fileKey = (v: number, p: string): string => `${root}v${v}/${p}`;
  const stateKey = `${root}state.json`;
  return {
    async readState() {
      const r = await (await caches.open(STATE_CACHE)).match(stateKey);
      if (!r) return null;
      try { return (await r.json()) as PackState; } catch { return null; }
    },
    async writeState(state) {
      const c = await caches.open(STATE_CACHE);
      if (state === null) await c.delete(stateKey);
      else await c.put(stateKey, new Response(JSON.stringify(state), { headers: { 'content-type': 'application/json' } }));
    },
    async read(v, p) {
      const r = await (await caches.open(versionCache(v))).match(fileKey(v, p));
      return r ? new Uint8Array(await r.arrayBuffer()) : null;
    },
    async write(v, p, data) {
      const body = new Blob([data as Uint8Array<ArrayBuffer>]);
      await (await caches.open(versionCache(v))).put(fileKey(v, p),
        new Response(body, { headers: { 'content-type': 'image/ktx2', 'content-length': String(data.length) } }));
    },
    async removeVersion(v) {
      await caches.delete(versionCache(v));
    },
    async baseUrl(v, sourceBase) {
      return (await ultraWorkerReady()) ? `${root}v${v}/` : sourceBase;
    },
  };
}

/** Native filesystem in the Capacitor app, Cache Storage in a browser, memory as a last resort. */
export async function createPlatformStore(): Promise<PackStore> {
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.isNativePlatform()) return createNativeStore();
  if (typeof caches !== 'undefined' && typeof document !== 'undefined') return createWebStore();
  return new MemoryPackStore();
}
