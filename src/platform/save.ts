// IndexedDB save slots with a versioned envelope and migrations.
import { STATE_VERSION, emptyGoods, type SimState } from '../sim/index';
import { freshMarket, freshTown } from '../sim/town';
import { SaveError, makeEnvelope, prepareLoad, type SaveEnvelope } from './saveGate';

const DB_NAME = 'marchia';
const DB_VERSION = 1;
const STORE = 'saves';

export type { SaveEnvelope, SaveErrorCode, GateError } from './saveGate';
export { SaveError } from './saveGate';

/** Migrations from state version N to N+1. Add an entry whenever STATE_VERSION grows. */
const MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 -> v2: per-root-cause stall accounting (end-of-mission summary). Old saves start counting now.
  1: (s) => ({ ...s, version: 2, ledger: { ...(s.ledger as object), stallSeconds: {} } }),
  // v2 -> v3: ice windows (no ice in old missions), contract tranches (none), per-building warehouse
  // capacity (-1 = type default). Pure: returns new objects, never mutates the loaded save.
  2: (s) => {
    const mission = s.mission as Record<string, unknown>;
    const contract = mission.contract as Record<string, unknown> | null;
    // Rebuild in the key order of a fresh state ('ice' right after 'rain'): the state hash is taken
    // over JSON.stringify, so a migrated save must serialize exactly like a new one.
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(s)) {
      out[k] = s[k];
      if (k === 'rain') out.ice = [];
    }
    if (!('ice' in out)) out.ice = [];
    out.version = 3;
    out.buildings = (s.buildings as Record<string, unknown>[]).map((b) => ({ ...b, capOverride: -1 }));
    out.mission = { ...mission, contract: contract ? { ...contract, tranches: [] } : null };
    return out;
  },
  // v3 -> v4: free valley market and ranks (docs/design/sandbox.md S2-S4). Buildings get
  // `placedTick` -1 (no undo for old buildings), the ledger counts market income, and the state gets
  // `market` (open when there is no contract: an old free-valley save starts trading) and `town`.
  // Appended in the key order of a fresh state (the hash is taken over JSON.stringify).
  3: (s) => {
    const mission = s.mission as Record<string, unknown>;
    const ledger = s.ledger as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(s)) if (k !== 'market' && k !== 'town') out[k] = s[k];
    out.version = 4;
    out.buildings = (s.buildings as Record<string, unknown>[]).map((b) => ({ ...b, placedTick: -1 }));
    out.ledger = { ...ledger, silverEarned: 0, sold: emptyGoods() };
    out.market = freshMarket(mission.contract === null);
    out.town = freshTown();
    return out;
  },
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
  const env = makeEnvelope(slot, state, Date.now());
  await tx('readwrite', (s) => s.put(env));
}

/**
 * Loads a slot through the save gate (D-23): validation -> envelope upgrade -> terrain hash check ->
 * migrate(). Throws SaveError (with `.code`) for a damaged, newer or terrain-changed save.
 */
export async function loadGame(slot: string): Promise<SimState | null> {
  const raw = await tx<unknown>('readonly', (s) => s.get(slot));
  if (raw === undefined) return null;
  const v = prepareLoad(raw);
  if (!v.ok) throw new SaveError(v.errors);
  try {
    return migrate(v.envelope).state;
  } catch (e) {
    throw new SaveError([{ code: 'NO_MIGRATION', path: '$.stateVersion', detail: e instanceof Error ? e.message : String(e) }]);
  }
}

/** Checks a slot without loading it (e.g. to disable "Continue"): null = loadable or empty. */
export async function verifySave(slot: string): Promise<SaveError | null> {
  const raw = await tx<unknown>('readonly', (s) => s.get(slot));
  if (raw === undefined) return null;
  const v = prepareLoad(raw);
  return v.ok ? null : new SaveError(v.errors);
}

export async function listSaves(): Promise<Omit<SaveEnvelope, 'state'>[]> {
  const all = await tx<SaveEnvelope[]>('readonly', (s) => s.getAll());
  return all.map(({ state: _s, ...rest }) => rest).sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteSave(slot: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(slot));
}
