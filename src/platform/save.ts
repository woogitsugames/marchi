// IndexedDB save slots with a versioned envelope and migrations.
import { STATE_VERSION, type SimState } from '../sim/index';

const DB_NAME = 'marchia';
const DB_VERSION = 1;
const STORE = 'saves';

export interface SaveEnvelope {
  /** Envelope format version (independent of the sim state version). */
  format: 1;
  stateVersion: number;
  slot: string;
  savedAt: number;
  missionId: string;
  tick: number;
  state: SimState;
}

/** Migrations from state version N to N+1. Add an entry whenever STATE_VERSION grows. */
const MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 -> v2: per-root-cause stall accounting (end-of-mission summary). Old saves start counting now.
  1: (s) => ({ ...s, version: 2, ledger: { ...(s.ledger as object), stallSeconds: {} } }),
};

export function migrate(env: SaveEnvelope): SaveEnvelope {
  let s = env.state as unknown as Record<string, unknown>;
  let v = env.stateVersion;
  while (v < STATE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`No migration from state version ${v}`);
    s = m(s);
    v++;
  }
  if (v > STATE_VERSION) throw new Error(`Save is from a newer game version (${v})`);
  return { ...env, stateVersion: v, state: s as unknown as SimState };
}

/** IndexedDB can hang (blocked upgrade, wedged WebView storage): never wait longer than this. */
const IDB_TIMEOUT_MS = 1500;

function withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`IndexedDB ${what} timed out`)), IDB_TIMEOUT_MS);
    p.then((v) => { clearTimeout(timer); resolve(v); }, (e: unknown) => { clearTimeout(timer); reject(e); });
  });
}

function open(): Promise<IDBDatabase> {
  return withTimeout(new Promise<IDBDatabase>((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'slot' });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close(); // never block another tab's upgrade
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  }), 'open');
}

function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => withTimeout(new Promise<T>((resolve, reject) => {
    let t: IDBTransaction;
    let r: IDBRequest<T>;
    try {
      t = db.transaction(STORE, mode);
      r = f(t.objectStore(STORE));
    } catch (e) { db.close(); reject(e); return; }
    t.oncomplete = () => { resolve(r.result); db.close(); };
    t.onerror = () => { reject(t.error); db.close(); };
    t.onabort = () => { reject(t.error ?? new Error('IndexedDB transaction aborted')); db.close(); };
  }), mode));
}

export async function saveGame(slot: string, state: SimState): Promise<void> {
  const env: SaveEnvelope = {
    format: 1, stateVersion: state.version, slot, savedAt: Date.now(), missionId: state.mission.id, tick: state.tick,
    // structured clone of plain JSON data
    state: JSON.parse(JSON.stringify(state)) as SimState,
  };
  await tx('readwrite', (s) => s.put(env));
}

export async function loadGame(slot: string): Promise<SimState | null> {
  const env = await tx<SaveEnvelope | undefined>('readonly', (s) => s.get(slot));
  if (!env) return null;
  return migrate(env).state;
}

export async function listSaves(): Promise<Omit<SaveEnvelope, 'state'>[]> {
  const all = await tx<SaveEnvelope[]>('readonly', (s) => s.getAll());
  return all.map(({ state: _s, ...rest }) => rest).sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteSave(slot: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(slot));
}
