// Downloadable 4K texture pack (D-17 / D-20): fetch the files listed in assets-ultra/manifest.json,
// verify SHA-256, store them per pack version, resume after interruptions, report progress, and
// hand back the base URL for setUltraBase() (src/render/textures.ts).
//
// Install model (safe upgrades): each pack version lives in its own folder / cache. A new version
// is downloaded as `pending` next to the installed one; only when every file is verified does the
// state record switch `installed` to it and the old version is removed. A half-installed new
// version therefore never breaks the old one.
//
// The storage is behind PackStore (native filesystem, web Cache Storage, in-memory for tests); this
// file has no Capacitor / DOM imports so it runs in Node tests. See docs/ASSET_PACK.md.

/** One file of the pack (path relative to the pack root, e.g. `textures/meadow/albedo_4096.ktx2`). */
export interface PackFile {
  path: string;
  bytes: number;
  sha256: string;
}

export interface PackManifest {
  pack: string;
  version: number;
  totalBytes: number;
  files: PackFile[];
}

/** Persisted install record (small JSON; kept by the store). */
export interface PackState {
  pack: string;
  /** Fully verified, active version (null = none). */
  installed: { version: number; totalBytes: number; files: number } | null;
  /** Version being downloaded and the paths already verified and stored for it. */
  pending: { version: number; completed: string[] } | null;
}

/** Storage backend. Every method may throw; errors surface as AssetPackError('storage'). */
export interface PackStore {
  readState(): Promise<PackState | null>;
  writeState(state: PackState | null): Promise<void>;
  /** Stored bytes of a file of a version, or null when absent. */
  read(version: number, path: string): Promise<Uint8Array | null>;
  write(version: number, path: string, data: Uint8Array): Promise<void>;
  /** Removes every file of a version (no-op when absent). */
  removeVersion(version: number): Promise<void>;
  /**
   * URL of a version's root for setUltraBase() (ends in '/'). `sourceBase` is where the pack was
   * downloaded from; a store that cannot serve files by URL may return it (see the web store).
   */
  baseUrl(version: number, sourceBase: string): Promise<string>;
}

export type AssetPackErrorCode =
  | 'manifest-invalid'
  | 'http'
  | 'size-mismatch'
  | 'hash-mismatch'
  | 'aborted'
  | 'storage';

/** Error with a stable code the UI maps to an i18n string. */
export class AssetPackError extends Error {
  readonly code: AssetPackErrorCode;
  readonly path: string | undefined;
  constructor(code: AssetPackErrorCode, message: string, path?: string) {
    super(message);
    this.name = 'AssetPackError';
    this.code = code;
    this.path = path;
  }
}

export interface PackProgress {
  /** Verified bytes of finished files + bytes received of the current file. Never decreases. */
  bytesDone: number;
  totalBytes: number;
  filesDone: number;
  filesTotal: number;
  /** File being processed, or null on the final event. */
  file: string | null;
}

export type FetchFn = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

/** Hard ceiling against a hostile / broken manifest (the real pack is ~59 MB). */
export const MAX_PACK_BYTES = 1024 * 1024 * 1024;
const MAX_FILES = 4096;
const SHA256_RE = /^[0-9a-f]{64}$/;
const SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

function invalid(msg: string): never {
  throw new AssetPackError('manifest-invalid', msg);
}

/** Relative, forward-slash path without '.', '..', empty segments, schemes or drive letters. */
export function isSafePackPath(p: string): boolean {
  if (p.length === 0 || p.length > 512) return false;
  return p.split('/').every((s) => SEGMENT_RE.test(s) && s !== '.' && s !== '..');
}

/** Validates untrusted JSON as a manifest; throws AssetPackError('manifest-invalid'). */
export function validateManifest(raw: unknown): PackManifest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) invalid('manifest is not an object');
  const m = raw as Record<string, unknown>;
  if (typeof m.pack !== 'string' || !SEGMENT_RE.test(m.pack)) invalid('bad pack name');
  if (typeof m.version !== 'number' || !Number.isSafeInteger(m.version) || m.version < 1) invalid('bad version');
  if (typeof m.totalBytes !== 'number' || !Number.isSafeInteger(m.totalBytes) || m.totalBytes < 0) invalid('bad totalBytes');
  if (m.totalBytes > MAX_PACK_BYTES) invalid('pack too large');
  if (!Array.isArray(m.files) || m.files.length === 0 || m.files.length > MAX_FILES) invalid('bad files list');
  const seen = new Set<string>();
  let sum = 0;
  const files: PackFile[] = m.files.map((f: unknown, i: number) => {
    if (!f || typeof f !== 'object') invalid(`file ${i} is not an object`);
    const { path, bytes, sha256 } = f as Record<string, unknown>;
    if (typeof path !== 'string' || !isSafePackPath(path)) invalid(`file ${i}: unsafe path`);
    if (seen.has(path)) invalid(`file ${i}: duplicate path ${path}`);
    seen.add(path);
    if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0) invalid(`file ${i}: bad size`);
    if (typeof sha256 !== 'string' || !SHA256_RE.test(sha256)) invalid(`file ${i}: bad sha256`);
    sum += bytes;
    return { path, bytes, sha256 };
  });
  if (sum !== m.totalBytes) invalid(`totalBytes ${m.totalBytes} != sum of files ${sum}`);
  return { pack: m.pack, version: m.version, totalBytes: m.totalBytes, files };
}

function aborted(): AssetPackError {
  return new AssetPackError('aborted', 'download cancelled');
}

function checkAbort(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw aborted();
}

function isAbortError(e: unknown): boolean {
  return e instanceof AssetPackError ? e.code === 'aborted' : (e as { name?: string } | null)?.name === 'AbortError';
}

async function storage<T>(what: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AssetPackError) throw e;
    throw new AssetPackError('storage', `${what}: ${(e as Error)?.message ?? String(e)}`);
  }
}

/** Lower-case hex SHA-256 via SubtleCrypto (browsers, WebViews, Node 20+). */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new AssetPackError('storage', 'SubtleCrypto unavailable (needs a secure context)');
  const digest = new Uint8Array(await subtle.digest('SHA-256', data as Uint8Array<ArrayBuffer>));
  let hex = '';
  for (const b of digest) hex += b.toString(16).padStart(2, '0');
  return hex;
}

function joinUrl(base: string, path: string): string {
  return (base.endsWith('/') ? base : `${base}/`) + path;
}

/** Downloads and validates `<base>manifest.json`. */
export async function fetchManifest(base: string, opts: { fetch?: FetchFn; signal?: AbortSignal } = {}): Promise<PackManifest> {
  const fetchFn = opts.fetch ?? (globalThis.fetch as FetchFn);
  checkAbort(opts.signal);
  let res: Response;
  try {
    res = await fetchFn(joinUrl(base, 'manifest.json'), { signal: opts.signal });
  } catch (e) {
    if (isAbortError(e) || opts.signal?.aborted) throw aborted();
    throw new AssetPackError('http', `manifest: ${(e as Error)?.message ?? String(e)}`);
  }
  if (!res.ok) throw new AssetPackError('http', `manifest: HTTP ${res.status}`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    invalid('manifest is not JSON');
  }
  return validateManifest(json);
}

/** Reads a response body into memory, reporting received bytes; enforces the expected size. */
async function readBody(res: Response, expected: number, path: string, signal: AbortSignal | undefined,
  onBytes: (n: number) => void): Promise<Uint8Array> {
  const out = new Uint8Array(expected);
  let got = 0;
  const reader = res.body?.getReader();
  if (!reader) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length !== expected) throw new AssetPackError('size-mismatch', `${path}: ${buf.length} != ${expected} bytes`, path);
    onBytes(buf.length);
    return buf;
  }
  try {
    for (;;) {
      checkAbort(signal);
      const { done, value } = await reader.read();
      if (done) break;
      if (got + value.length > expected) throw new AssetPackError('size-mismatch', `${path}: more than ${expected} bytes`, path);
      out.set(value, got);
      got += value.length;
      onBytes(value.length);
    }
  } finally {
    reader.releaseLock?.();
  }
  if (got !== expected) throw new AssetPackError('size-mismatch', `${path}: ${got} != ${expected} bytes`, path);
  return out;
}

export interface InstallOptions {
  manifest: PackManifest;
  /** Pack root the files are fetched from (`<sourceBase><file.path>`). */
  sourceBase: string;
  store: PackStore;
  fetch?: FetchFn;
  onProgress?: (p: PackProgress) => void;
  signal?: AbortSignal;
}

function emptyState(pack: string): PackState {
  return { pack, installed: null, pending: null };
}

/**
 * Installs (or resumes / upgrades to) `manifest.version` and returns the base URL for
 * setUltraBase(). Files already verified are skipped; a file present in the store but not yet
 * recorded is re-hashed and kept when it matches. A failed or cancelled file is downloaded again
 * from the start next time (no HTTP Range: files are 2–4 MB). Throws AssetPackError.
 */
export async function installPack(opts: InstallOptions): Promise<string> {
  const { manifest, store, signal, sourceBase } = opts;
  const fetchFn = opts.fetch ?? (globalThis.fetch as FetchFn);
  const report = opts.onProgress ?? (() => {});
  checkAbort(signal);

  let state = (await storage('read state', () => store.readState())) ?? emptyState(manifest.pack);
  if (state.pack !== manifest.pack) {
    // A different pack id owns the record: drop its files, start clean.
    await removeAll(store, state);
    state = emptyState(manifest.pack);
  }
  const v = manifest.version;
  const filesTotal = manifest.files.length;
  if (state.installed?.version === v) {
    report({ bytesDone: manifest.totalBytes, totalBytes: manifest.totalBytes, filesDone: filesTotal, filesTotal, file: null });
    return storage('base url', () => store.baseUrl(v, sourceBase));
  }
  if (state.pending && state.pending.version !== v) {
    const stale = state.pending.version;
    if (stale !== state.installed?.version) await storage('remove stale pending', () => store.removeVersion(stale));
    state = { ...state, pending: null };
  }
  const known = new Set(state.pending?.completed ?? []);
  const completed = manifest.files.filter((f) => known.has(f.path)).map((f) => f.path);
  state = { ...state, pending: { version: v, completed } };
  await storage('write state', () => store.writeState(state));

  let bytesDone = 0, filesDone = 0;
  const done = new Set(completed);
  for (const f of manifest.files) {
    checkAbort(signal);
    report({ bytesDone, totalBytes: manifest.totalBytes, filesDone, filesTotal, file: f.path });
    if (!done.has(f.path)) {
      const existing = await storage(`read ${f.path}`, () => store.read(v, f.path));
      const reuse = existing !== null && existing.length === f.bytes && (await sha256Hex(existing)) === f.sha256;
      if (!reuse) {
        let received = 0;
        const data = await downloadFile(fetchFn, sourceBase, f, signal, (n) => {
          received += n;
          report({ bytesDone: bytesDone + received, totalBytes: manifest.totalBytes, filesDone, filesTotal, file: f.path });
        });
        checkAbort(signal);
        await storage(`write ${f.path}`, () => store.write(v, f.path, data));
      }
      done.add(f.path);
      state = { ...state, pending: { version: v, completed: [...done] } };
      await storage('write state', () => store.writeState(state));
    }
    bytesDone += f.bytes;
    filesDone++;
  }

  const old = state.installed;
  state = { pack: manifest.pack, installed: { version: v, totalBytes: manifest.totalBytes, files: filesTotal }, pending: null };
  await storage('write state', () => store.writeState(state));
  if (old && old.version !== v) {
    try { await store.removeVersion(old.version); } catch { /* best effort: orphan files only cost space */ }
  }
  report({ bytesDone, totalBytes: manifest.totalBytes, filesDone, filesTotal, file: null });
  return storage('base url', () => store.baseUrl(v, sourceBase));
}

async function downloadFile(fetchFn: FetchFn, base: string, f: PackFile, signal: AbortSignal | undefined,
  onBytes: (n: number) => void): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetchFn(joinUrl(base, f.path), { signal });
  } catch (e) {
    if (isAbortError(e) || signal?.aborted) throw aborted();
    throw new AssetPackError('http', `${f.path}: ${(e as Error)?.message ?? String(e)}`, f.path);
  }
  if (!res.ok) throw new AssetPackError('http', `${f.path}: HTTP ${res.status}`, f.path);
  let data: Uint8Array;
  try {
    data = await readBody(res, f.bytes, f.path, signal, onBytes);
  } catch (e) {
    if (e instanceof AssetPackError) throw e;
    if (isAbortError(e) || signal?.aborted) throw aborted();
    throw new AssetPackError('http', `${f.path}: ${(e as Error)?.message ?? String(e)}`, f.path);
  }
  const hash = await sha256Hex(data);
  if (hash !== f.sha256) throw new AssetPackError('hash-mismatch', `${f.path}: sha256 ${hash} != ${f.sha256}`, f.path);
  return data;
}

async function removeAll(store: PackStore, state: PackState): Promise<void> {
  const versions = new Set<number>();
  if (state.installed) versions.add(state.installed.version);
  if (state.pending) versions.add(state.pending.version);
  for (const v of versions) await storage(`remove v${v}`, () => store.removeVersion(v));
}

export interface PackStatus {
  installedVersion: number | null;
  /** A download was started for this version but not finished. */
  pendingVersion: number | null;
  /** True when a manifest was given and it is newer than the installed version. */
  stale: boolean;
}

export async function packStatus(store: PackStore, manifest?: PackManifest): Promise<PackStatus> {
  const s = await storage('read state', () => store.readState());
  const installedVersion = s?.installed?.version ?? null;
  const differentPack = !!manifest && !!s && s.pack !== manifest.pack;
  return {
    installedVersion: differentPack ? null : installedVersion,
    pendingVersion: differentPack ? null : s?.pending?.version ?? null,
    stale: !!manifest && (differentPack || installedVersion === null || installedVersion < manifest.version),
  };
}

/** Base URL of the installed version, or null (call at startup and pass to setUltraBase). */
export async function installedBaseUrl(store: PackStore, sourceBase: string): Promise<string | null> {
  const s = await storage('read state', () => store.readState());
  if (!s?.installed) return null;
  const v = s.installed.version;
  return storage('base url', () => store.baseUrl(v, sourceBase));
}

/** Removes the installed and any half-downloaded version and clears the state record. */
export async function deletePack(store: PackStore): Promise<void> {
  const s = await storage('read state', () => store.readState());
  if (s) await removeAll(store, s);
  await storage('write state', () => store.writeState(null));
}

// ---------------------------------------------------------------------------------------------
// App-facing convenience API (picks the platform store and the configured base URL lazily).

let defaultStore: Promise<PackStore> | null = null;

async function appStore(): Promise<PackStore> {
  defaultStore ??= import('./assetPackStores').then((m) => m.createPlatformStore());
  return defaultStore;
}

async function appBase(): Promise<string> {
  return (await import('./assetPackConfig')).packBaseUrl();
}

/** Downloads (or resumes / upgrades) the Ultra pack; resolves to the URL for setUltraBase(). */
export async function downloadUltraPack(opts: { onProgress?: (p: PackProgress) => void; signal?: AbortSignal } = {}): Promise<string> {
  const [store, base] = await Promise.all([appStore(), appBase()]);
  const manifest = await fetchManifest(base, { signal: opts.signal });
  return installPack({ manifest, sourceBase: base, store, onProgress: opts.onProgress, signal: opts.signal });
}

/** URL of the installed Ultra pack or null; never touches the network. */
export async function ultraPackBase(): Promise<string | null> {
  const [store, base] = await Promise.all([appStore(), appBase()]);
  return installedBaseUrl(store, base);
}

export async function deleteUltraPack(): Promise<void> {
  await deletePack(await appStore());
}
