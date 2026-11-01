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
  // 1: (s) => ({ ...s, version: 2, newField: 0 }),
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

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'slot' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = f(t.objectStore(STORE));
    t.oncomplete = () => { resolve(r.result); db.close(); };
    t.onerror = () => { reject(t.error); db.close(); };
  }));
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
