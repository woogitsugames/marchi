// 4K texture pack installer (src/platform/assetPack.ts): offline, mocked fetch, in-memory store.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assert, eq, test } from './harness';
import {
  AssetPackError, deletePack, fetchManifest, installPack, installedBaseUrl, packStatus, sha256Hex,
  validateManifest, type FetchFn, type PackManifest, type PackProgress,
} from '../src/platform/assetPack';
import { MemoryPackStore, base64ToBytes, bytesToBase64 } from '../src/platform/assetPackStores';
import { ASSET_PACK_PROD_BASE, resolvePackBase } from '../src/platform/assetPackConfig';

const BASE = 'https://cdn.test/pack/';

function bytesOf(seed: number, n: number): Uint8Array {
  const out = new Uint8Array(n);
  let x = seed * 2654435761 >>> 0;
  for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) >>> 0; out[i] = x >>> 24; }
  return out;
}

const hex = (d: Uint8Array): string => createHash('sha256').update(d).digest('hex');

interface Fixture { manifest: PackManifest; blobs: Map<string, Uint8Array> }

function fixture(version: number, sizes = [70_000, 1, 0, 130_001], seed = 1): Fixture {
  const blobs = new Map<string, Uint8Array>();
  const files = sizes.map((n, i) => {
    const path = `textures/set${i}/albedo_4096.ktx2`;
    const d = bytesOf(seed * 100 + i + version * 7, n);
    blobs.set(path, d);
    return { path, bytes: n, sha256: hex(d) };
  });
  return { manifest: { pack: 'marchia-textures-ultra', version, totalBytes: sizes.reduce((a, b) => a + b, 0), files }, blobs };
}

interface MockOpts {
  /** Throw a network error on the request for this path (once, then behave). */
  failOnce?: string;
  /** Serve corrupted bytes for this path. */
  corrupt?: string;
  chunk?: number;
}

function mockFetch(fx: Fixture, opts: MockOpts = {}): { fetch: FetchFn; requests: string[] } {
  const requests: string[] = [];
  let failed = false;
  const fetch: FetchFn = async (url, init) => {
    if (init?.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    requests.push(url);
    if (url === `${BASE}manifest.json`) return new Response(JSON.stringify(fx.manifest), { status: 200 });
    const path = url.slice(BASE.length);
    if (path === opts.failOnce && !failed) { failed = true; throw new TypeError('network down'); }
    const src = fx.blobs.get(path);
    if (!src) return new Response('nope', { status: 404 });
    const data = src.slice();
    if (path === opts.corrupt && data.length > 0) data[0] ^= 0xff;
    const chunk = opts.chunk ?? 16_384;
    let off = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (off >= data.length) { c.close(); return; }
        c.enqueue(data.subarray(off, off + chunk));
        off += chunk;
      },
    });
    return new Response(body, { status: 200 });
  };
  return { fetch, requests };
}

async function rejects(p: Promise<unknown>, code: string, msg: string): Promise<AssetPackError> {
  try { await p; } catch (e) {
    assert(e instanceof AssetPackError, `${msg}: expected AssetPackError, got ${String(e)}`);
    eq(e.code, code, msg);
    return e;
  }
  throw new Error(`${msg}: expected rejection with ${code}`);
}

test('assetPack: real manifest validates and sums', () => {
  const raw = JSON.parse(readFileSync(new URL('../assets-ultra/manifest.json', import.meta.url), 'utf8')) as unknown;
  const m = validateManifest(raw);
  assert(m.files.length > 0, 'files');
  eq(m.files.reduce((a, f) => a + f.bytes, 0), m.totalBytes, 'sum');
});

test('assetPack: sha256Hex matches node:crypto', async () => {
  const d = bytesOf(9, 100_000);
  eq(await sha256Hex(d), hex(d), 'digest');
  eq(await sha256Hex(new Uint8Array(0)), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'empty');
});

test('assetPack: full install, monotonic progress summing to totalBytes', async () => {
  const fx = fixture(1);
  const store = new MemoryPackStore();
  const { fetch } = mockFetch(fx);
  const events: PackProgress[] = [];
  const manifest = await fetchManifest(BASE, { fetch });
  const url = await installPack({ manifest, sourceBase: BASE, store, fetch, onProgress: (p) => events.push({ ...p }) });
  eq(url, 'memory://ultra/v1/', 'base url');
  for (const f of fx.manifest.files) {
    const got = await store.read(1, f.path);
    assert(got && hex(got) === f.sha256, `stored ${f.path}`);
  }
  for (let i = 1; i < events.length; i++) assert(events[i]!.bytesDone >= events[i - 1]!.bytesDone, `monotonic at ${i}`);
  const last = events[events.length - 1]!;
  eq(last.bytesDone, fx.manifest.totalBytes, 'final bytes');
  eq(last.totalBytes, fx.manifest.totalBytes, 'total');
  eq(last.filesDone, 4, 'files done');
  eq(last.file, null, 'final file null');
  assert(events.some((e) => e.bytesDone > 0 && e.bytesDone < 70_000), 'in-file progress reported');
  const st = await packStatus(store, fx.manifest);
  eq(st.installedVersion, 1, 'installed');
  eq(st.pendingVersion, null, 'no pending');
  eq(st.stale, false, 'not stale');
  eq(await installedBaseUrl(store, BASE), 'memory://ultra/v1/', 'installed base');
});

test('assetPack: second install of same version downloads nothing', async () => {
  const fx = fixture(1);
  const store = new MemoryPackStore();
  await installPack({ manifest: fx.manifest, sourceBase: BASE, store, fetch: mockFetch(fx).fetch });
  const m = mockFetch(fx);
  await installPack({ manifest: fx.manifest, sourceBase: BASE, store, fetch: m.fetch });
  eq(m.requests.length, 0, 'no requests');
});

test('assetPack: hash mismatch => error, file not marked done or stored', async () => {
  const fx = fixture(1);
  const bad = fx.manifest.files[3]!.path;
  const store = new MemoryPackStore();
  const err = await rejects(installPack({ manifest: fx.manifest, sourceBase: BASE, store, fetch: mockFetch(fx, { corrupt: bad }).fetch }),
    'hash-mismatch', 'corrupt file');
  eq(err.path, bad, 'error path');
  const st = await store.readState();
  assert(st?.pending && !st.pending.completed.includes(bad), 'not completed');
  eq(st.pending.completed.length, 3, 'earlier files completed');
  eq(st.installed, null, 'not installed');
  eq(await store.read(1, bad), null, 'not stored');
});

test('assetPack: size mismatch and HTTP errors are reported', async () => {
  const fx = fixture(1);
  const longer = { ...fx, blobs: new Map(fx.blobs) };
  longer.blobs.set(fx.manifest.files[0]!.path, bytesOf(5, 70_010));
  await rejects(installPack({ manifest: fx.manifest, sourceBase: BASE, store: new MemoryPackStore(), fetch: mockFetch(longer).fetch }),
    'size-mismatch', 'too long');
  const missing = { ...fx, blobs: new Map(fx.blobs) };
  missing.blobs.delete(fx.manifest.files[1]!.path);
  await rejects(installPack({ manifest: fx.manifest, sourceBase: BASE, store: new MemoryPackStore(), fetch: mockFetch(missing).fetch }),
    'http', '404');
});

test('assetPack: resume after failure skips completed files', async () => {
  const fx = fixture(1);
  const store = new MemoryPackStore();
  const failing = fx.manifest.files[3]!.path;
  const m1 = mockFetch(fx, { failOnce: failing });
  await rejects(installPack({ manifest: fx.manifest, sourceBase: BASE, store, fetch: m1.fetch }), 'http', 'network failure');
  const m2 = mockFetch(fx);
  const events: PackProgress[] = [];
  await installPack({ manifest: fx.manifest, sourceBase: BASE, store, fetch: m2.fetch, onProgress: (p) => events.push({ ...p }) });
  eq(m2.requests.length, 1, 'only the failed file re-requested');
  eq(m2.requests[0], BASE + failing, 'which file');
  for (let i = 1; i < events.length; i++) assert(events[i]!.bytesDone >= events[i - 1]!.bytesDone, 'monotonic on resume');
  eq(events[events.length - 1]!.bytesDone, fx.manifest.totalBytes, 'resume total');
  eq((await packStatus(store)).installedVersion, 1, 'installed after resume');
});

test('assetPack: stored but unrecorded file is re-hashed and reused', async () => {
  const fx = fixture(1);
  const store = new MemoryPackStore();
  const f0 = fx.manifest.files[0]!;
  await store.write(1, f0.path, fx.blobs.get(f0.path)!);
  const f1 = fx.manifest.files[3]!;
  await store.write(1, f1.path, bytesOf(77, f1.bytes)); // wrong content, right size
  const m = mockFetch(fx);
  await installPack({ manifest: fx.manifest, sourceBase: BASE, store, fetch: m.fetch });
  assert(!m.requests.includes(BASE + f0.path), 'valid file reused');
  assert(m.requests.includes(BASE + f1.path), 'invalid file re-downloaded');
  eq(hex((await store.read(1, f1.path))!), f1.sha256, 'replaced');
});

test('assetPack: cancel via AbortSignal', async () => {
  const fx = fixture(1);
  const store = new MemoryPackStore();
  const ac = new AbortController();
  const m = mockFetch(fx);
  const p = installPack({
    manifest: fx.manifest, sourceBase: BASE, store, fetch: m.fetch, signal: ac.signal,
    onProgress: (e) => { if (e.bytesDone > 20_000) ac.abort(); },
  });
  await rejects(p, 'aborted', 'aborted');
  const st = await store.readState();
  eq(st?.installed ?? null, null, 'nothing installed');
  eq(st?.pending?.completed.length ?? 0, 0, 'aborted file not completed');
  eq(await store.read(1, fx.manifest.files[0]!.path), null, 'partial file not stored');
  const pre = new AbortController();
  pre.abort();
  await rejects(fetchManifest(BASE, { fetch: m.fetch, signal: pre.signal }), 'aborted', 'manifest aborted');
  // Resumable afterwards.
  await installPack({ manifest: fx.manifest, sourceBase: BASE, store, fetch: mockFetch(fx).fetch });
  eq((await packStatus(store)).installedVersion, 1, 'installed after cancel');
});

test('assetPack: delete removes files and state', async () => {
  const fx = fixture(1);
  const store = new MemoryPackStore();
  await installPack({ manifest: fx.manifest, sourceBase: BASE, store, fetch: mockFetch(fx).fetch });
  assert(store.files.size > 0, 'has files');
  await deletePack(store);
  eq(store.files.size, 0, 'no files');
  eq(store.state, null, 'no state');
  eq(await installedBaseUrl(store, BASE), null, 'no base');
  eq((await packStatus(store, fx.manifest)).stale, true, 'stale after delete');
});

test('assetPack: version upgrade keeps old pack until the new one is complete', async () => {
  const v1 = fixture(1);
  const v2 = fixture(2, [50_000, 60_000], 3);
  const store = new MemoryPackStore();
  await installPack({ manifest: v1.manifest, sourceBase: BASE, store, fetch: mockFetch(v1).fetch });
  eq((await packStatus(store, v2.manifest)).stale, true, 'v1 stale vs v2');
  // Interrupted upgrade: v1 stays installed and usable.
  await rejects(installPack({ manifest: v2.manifest, sourceBase: BASE, store, fetch: mockFetch(v2, { failOnce: v2.manifest.files[1]!.path }).fetch }),
    'http', 'upgrade fails');
  let st = await packStatus(store, v2.manifest);
  eq(st.installedVersion, 1, 'v1 still installed');
  eq(st.pendingVersion, 2, 'v2 pending');
  eq(await installedBaseUrl(store, BASE), 'memory://ultra/v1/', 'base still v1');
  assert(await store.read(1, v1.manifest.files[0]!.path), 'v1 files intact');
  // Completed upgrade swaps and removes v1.
  const url = await installPack({ manifest: v2.manifest, sourceBase: BASE, store, fetch: mockFetch(v2).fetch });
  eq(url, 'memory://ultra/v2/', 'v2 base');
  st = await packStatus(store, v2.manifest);
  eq(st.installedVersion, 2, 'v2 installed');
  eq(st.stale, false, 'fresh');
  assert([...store.files.keys()].every((k) => k.startsWith('v2/')), 'v1 files removed');
});

test('assetPack: abandoned pending version is removed when another version starts', async () => {
  const v2 = fixture(2, [10_000, 20_000]);
  const v3 = fixture(3, [10_000]);
  const store = new MemoryPackStore();
  await rejects(installPack({ manifest: v2.manifest, sourceBase: BASE, store, fetch: mockFetch(v2, { failOnce: v2.manifest.files[1]!.path }).fetch }),
    'http', 'v2 fails');
  assert([...store.files.keys()].some((k) => k.startsWith('v2/')), 'v2 partial present');
  await installPack({ manifest: v3.manifest, sourceBase: BASE, store, fetch: mockFetch(v3).fetch });
  assert([...store.files.keys()].every((k) => k.startsWith('v3/')), 'v2 partial removed');
});

test('assetPack: manifest validation rejects hostile input', () => {
  const ok = fixture(1).manifest;
  const bad = (mut: (m: Record<string, unknown> & { files: Record<string, unknown>[] }) => void, msg: string): void => {
    const m = JSON.parse(JSON.stringify(ok)) as Record<string, unknown> & { files: Record<string, unknown>[] };
    mut(m);
    let threw = false;
    try { validateManifest(m); } catch (e) { threw = e instanceof AssetPackError && e.code === 'manifest-invalid'; }
    assert(threw, `should reject: ${msg}`);
  };
  validateManifest(ok);
  bad((m) => { m.files[0]!.path = '../../etc/passwd'; }, 'dot-dot');
  bad((m) => { m.files[0]!.path = 'textures/../x.ktx2'; }, 'inner dot-dot');
  bad((m) => { m.files[0]!.path = '/abs/x.ktx2'; }, 'absolute');
  bad((m) => { m.files[0]!.path = 'C:/x.ktx2'; }, 'drive letter');
  bad((m) => { m.files[0]!.path = 'https://evil/x'; }, 'url');
  bad((m) => { m.files[0]!.path = 'a\\b.ktx2'; }, 'backslash');
  bad((m) => { m.files[0]!.path = 'a//b.ktx2'; }, 'empty segment');
  bad((m) => { m.files[0]!.path = './a.ktx2'; }, 'dot segment');
  bad((m) => { m.files[1]!.path = m.files[0]!.path; }, 'duplicate');
  bad((m) => { m.files[0]!.bytes = -1; m.totalBytes = (m.totalBytes as number) - 70_001; }, 'negative size');
  bad((m) => { m.files[0]!.bytes = 1.5; }, 'fractional size');
  bad((m) => { m.files[0]!.sha256 = 'zz'.repeat(32); }, 'bad hex');
  bad((m) => { m.files[0]!.sha256 = (m.files[0]!.sha256 as string).toUpperCase(); }, 'upper-case hex');
  bad((m) => { m.files[0]!.sha256 = 'ab'; }, 'short hex');
  bad((m) => { m.totalBytes = (m.totalBytes as number) + 1; }, 'total mismatch');
  bad((m) => { m.version = 0; }, 'version 0');
  bad((m) => { m.version = '1'; }, 'string version');
  bad((m) => { m.files = []; }, 'empty files');
  bad((m) => { m.pack = '../x'; }, 'pack name');
  let threw = false;
  try { validateManifest(null); } catch { threw = true; }
  assert(threw, 'null rejected');
});

test('assetPack: fetchManifest rejects non-JSON and HTTP errors', async () => {
  const notJson: FetchFn = async () => new Response('<html>', { status: 200 });
  await rejects(fetchManifest(BASE, { fetch: notJson }), 'manifest-invalid', 'html');
  const e500: FetchFn = async () => new Response('', { status: 500 });
  await rejects(fetchManifest(BASE, { fetch: e500 }), 'http', '500');
});

test('assetPack: base64 round trip and base URL config', () => {
  const d = bytesOf(4, 100_003);
  const back = base64ToBytes(bytesToBase64(d));
  eq(hex(back), hex(d), 'round trip');
  eq(resolvePackBase({ dev: false }), ASSET_PACK_PROD_BASE, 'prod placeholder');
  eq(resolvePackBase({ dev: true, origin: 'http://192.168.1.5:5173' }), 'http://192.168.1.5:5173/assets-ultra/', 'dev server');
  eq(resolvePackBase({ dev: true, origin: 'http://x:5173', override: 'https://cdn.example/p' }), 'https://cdn.example/p/', 'override');
});
