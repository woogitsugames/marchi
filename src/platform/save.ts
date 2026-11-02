// IndexedDB save slots with a versioned envelope and migrations.
import { RANKS, STATE_VERSION, emptyGoods, goodsOf, type GoodMap, type SimState } from '../sim/index';
import { freshMarket, freshTown } from '../sim/town';
import { SaveError, makeEnvelope, prepareLoad, type SaveEnvelope, type SaveErrorCode } from './saveGate';

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
  // v4 -> v5: data-driven goods (D-29: fish, stone, charcoal, malt, beer) and ranks 4-5. Every goods
  // map is rebuilt in GOODS order with the new goods at 0 (the hash is taken over JSON.stringify, so
  // the key order must equal a fresh state's); town.rankTicks grows to RANKS.length with -1.
  4: (s) => {
    const gm = (m: unknown): GoodMap => goodsOf((m ?? {}) as Partial<GoodMap>);
    const mission = s.mission as Record<string, unknown>;
    const contract = mission.contract as Record<string, unknown> | null;
    const ledger = s.ledger as Record<string, unknown>;
    const market = s.market as Record<string, unknown>;
    const town = s.town as Record<string, unknown>;
    const rankTicks = (town.rankTicks as number[]).slice();
    while (rankTicks.length < RANKS.length) rankTicks.push(-1);
    return {
      ...s,
      version: 5,
      buildings: (s.buildings as Record<string, unknown>[]).map((b) => ({
        ...b, stock: gm(b.stock), reservedOut: gm(b.reservedOut), incoming: gm(b.incoming),
      })),
      mission: {
        ...mission,
        contract: contract ? {
          ...contract, need: gm(contract.need),
          tranches: (contract.tranches as Record<string, unknown>[]).map((t) => ({ ...t, need: gm(t.need) })),
        } : null,
      },
      ledger: {
        ...ledger, produced: gm(ledger.produced), consumed: gm(ledger.consumed), destroyed: gm(ledger.destroyed), sold: gm(ledger.sold),
      },
      market: { ...market, saturation: gm(market.saturation) },
      town: { ...town, rankTicks },
    };
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

// --- Slots (D-29): one contract slot, three free-valley ledgers ----------------------------------

/** Contract missions keep a single slot (a new contract replaces the old one). */
export const CONTRACT_SLOT = 'auto';
/** Free valley: three independent settlements. */
export const VALLEY_SLOTS = ['valley1', 'valley2', 'valley3'] as const;
export type ValleySlot = (typeof VALLEY_SLOTS)[number];

export function isValleySlot(s: string | null | undefined): s is ValleySlot {
  return (VALLEY_SLOTS as readonly string[]).includes(s ?? '');
}

/** What the slot picker shows for a stored slot, read through the save gate (never throws). */
export type SlotSummary =
  | { slot: string; ok: true; savedAt: number; missionId: string; tick: number; rank: number; renown: number; coins: number }
  | { slot: string; ok: false; savedAt: number; code: SaveErrorCode };

function num(x: unknown, d = 0): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : d;
}

/** Summaries of every stored slot (damaged ones with their error code). Rejects on IndexedDB failure / timeout. */
export async function readSlots(): Promise<SlotSummary[]> {
  const all = await tx<unknown[]>('readonly', (s) => s.getAll());
  return all.map((raw): SlotSummary => {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const slot = typeof r.slot === 'string' ? r.slot : '';
    const v = prepareLoad(raw);
    if (!v.ok) return { slot, ok: false, savedAt: num(r.savedAt), code: v.errors[0]?.code ?? 'INTERNAL' };
    const e = v.envelope;
    // pre-v4 saves have no town yet: they read as the starting rank
    const town = (e.state as Partial<SimState>).town;
    return {
      slot, ok: true, savedAt: e.savedAt, missionId: e.missionId, tick: e.tick,
      rank: num(town?.rank), renown: num(town?.renown), coins: num(e.state.coins),
    };
  });
}

/**
 * Saves from before D-29 kept a free-valley game in the single 'auto' slot: move it into the first
 * empty valley ledger (same envelope, only `slot` changes). No-op otherwise; best effort.
 */
export async function adoptLegacyValley(): Promise<void> {
  const raw = await tx<unknown>('readonly', (s) => s.get(CONTRACT_SLOT));
  if (!raw || typeof raw !== 'object' || (raw as { missionId?: unknown }).missionId !== 'sandbox') return;
  const keys = await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
  const free = VALLEY_SLOTS.find((v) => !keys.includes(v));
  if (!free) return;
  await tx('readwrite', (s) => s.put({ ...(raw as object), slot: free }));
  await deleteSave(CONTRACT_SLOT);
}
