// IndexedDB save slots with a versioned envelope and migrations.
import { RANKS, STATE_VERSION, emptyGoods, goodsOf, type GoodMap, type SimState } from '../sim/index';
import { freshMarket, freshTown } from '../sim/town';
import { freshValleyEvents } from '../sim/events';
import { freshTradePost, placeTradePost } from '../sim/tradePost';
import { worldFromState } from '../sim/sim';
import { LEGACY_SLOT, planLegacy } from './slots';
import { SaveError, makeEnvelope, prepareLoad, type SaveEnvelope, type SaveErrorCode } from './saveGate';
import { PROFILE_ID, envelopeChronicle, recordBest, sanitizeProfile, type Profile } from './profile';

const DB_NAME = 'marchia';
/**
 * 2: a `meta` store beside `saves` (envelope without the state) so listing does not read whole games (D-50).
 * 3: a `profile` store (best result per contract mission, owner decision 13): one record, key 'profile'.
 */
const DB_VERSION = 3;
const STORE = 'saves';
const META = 'meta';
const PROFILE = 'profile';

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
  // v5 -> v6: `mission.roadStone` (D-32, mission VIII builds cobbles with stone). Saves before v6
  // never had such a mission: false. Appended last, as in a fresh state (hash over JSON.stringify).
  5: (s) => ({ ...s, version: 6, mission: { ...(s.mission as Record<string, unknown>), roadStone: false } }),
  // v6 -> v7: fleet numbers (D-44). Wagons get `n` = 1..N in id order (purchase order: ids only grow),
  // right after `id`; the state gets `nextWagonN` = N + 1 right after `nextId` (key order of a fresh
  // state, the hash is taken over JSON.stringify). Numbers of wagons sold before v7 are not known.
  6: (s) => {
    const wagons = s.wagons as Record<string, unknown>[];
    const order = wagons.map((w) => w.id as number).sort((a, b) => a - b);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(s)) {
      out[k] = s[k];
      if (k === 'nextId') out.nextWagonN = wagons.length + 1;
    }
    out.version = 7;
    out.wagons = wagons.map((w) => {
      const nw: Record<string, unknown> = {};
      for (const k of Object.keys(w)) {
        if (k === 'n') continue;
        nw[k] = w[k];
        if (k === 'id') nw.n = order.indexOf(w.id as number) + 1;
      }
      return nw;
    });
    return out;
  },
  // v7 -> v8: free valley events (D-54). A sandbox save gets an empty event slice appended last (key
  // order of a fresh state); every other mission is unchanged apart from the version.
  7: (s) => {
    const mission = s.mission as Record<string, unknown>;
    const out: Record<string, unknown> = { ...s, version: 8 };
    if (mission.id === 'sandbox') out.valleyEvents = freshValleyEvents();
    return out;
  },
  // v8 -> v9: the free valley's trading post (D-170). A sandbox save gets the post building on the first free site
  // of TRADE_POST.sites (placed with the sim's own place(), on a clone: id = nextId, gate road, netVersion + 1) and
  // the tradePost slice appended last (key order of a fresh state). No free site: the slice with building -1 (the
  // valley plays on without a post). Every other mission is unchanged apart from the version.
  8: (s) => {
    const mission = s.mission as Record<string, unknown>;
    if (mission.id !== 'sandbox') return { ...s, version: 9 };
    const out = JSON.parse(JSON.stringify({ ...s, version: 9 })) as Record<string, unknown>;
    const st = out as unknown as SimState;
    st.tradePost = freshTradePost(placeTradePost(worldFromState(st))); // terrain from mapId + seed, as on load
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

/** Envelope without the state: what the menu needs to list saves (META store). */
export type SaveMeta = Omit<SaveEnvelope, 'state'>;

function metaOf(env: Record<string, unknown>): Record<string, unknown> {
  const { state: _s, chronicle: _c, ...rest } = env;
  return rest;
}

/** One connection per page, reused by every transaction; dropped when the browser closes it (D-50). */
let dbPromise: Promise<IDBDatabase> | null = null;
/** The open connection once ready: transactions then start synchronously, in the caller's own turn. */
let dbReady: IDBDatabase | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const p = withTimeout(new Promise<IDBDatabase>((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'slot' });
      if (!db.objectStoreNames.contains(META)) {
        const meta = db.createObjectStore(META, { keyPath: 'slot' });
        // v1 -> v2: fill the metadata of saves written before (one pass inside the upgrade transaction)
        if ((ev.oldVersion ?? 0) >= 1) {
          const cur = req.transaction!.objectStore(STORE).openCursor();
          cur.onsuccess = () => {
            const c = cur.result;
            if (!c) return;
            if (c.value && typeof c.value === 'object') meta.put(metaOf(c.value as Record<string, unknown>));
            c.continue();
          };
        }
      }
      // v2 -> v3: the profile store starts empty (no best results were kept before day 1)
      if (!db.objectStoreNames.contains(PROFILE)) db.createObjectStore(PROFILE, { keyPath: 'id' });
    };
    req.onsuccess = () => {
      const db = req.result;
      const drop = (): void => { if (dbPromise === p) dbPromise = null; if (dbReady === db) dbReady = null; };
      db.onversionchange = () => { db.close(); drop(); }; // never block another tab's upgrade
      db.onclose = drop; // the browser closed it (storage cleared, crash): reopen next time
      dbReady = db;
      resolve(db);
    };
    req.onerror = () => {
      // B6 (research 2026-11-02-save-robustness): the database is newer than this build (a later build ran,
      // or another tab upgraded it). Open it at its own version and use it if our stores are there: saves and
      // autosave keep working instead of failing silently; the save gate still rejects newer envelopes.
      if (req.error?.name !== 'VersionError') { reject(req.error); return; }
      let any: IDBOpenDBRequest;
      try { any = indexedDB.open(DB_NAME); } catch (e) { reject(e); return; }
      any.onsuccess = () => {
        const db = any.result;
        if (!db.objectStoreNames.contains(STORE) || !db.objectStoreNames.contains(META)) {
          db.close();
          reject(req.error);
          return;
        }
        const drop = (): void => { if (dbPromise === p) dbPromise = null; if (dbReady === db) dbReady = null; };
        db.onversionchange = () => { db.close(); drop(); };
        db.onclose = drop;
        dbReady = db;
        resolve(db);
      };
      any.onerror = () => reject(req.error);
    };
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  }), 'open');
  dbPromise = p;
  p.catch(() => { if (dbPromise === p) dbPromise = null; });
  return p;
}

/** Test hook: forget the cached connection (closing it), as a page reload would. */
export function resetSaveConnection(): void {
  const p = dbPromise;
  dbPromise = null;
  dbReady = null;
  if (p) void p.then((db) => db.close(), () => undefined);
}

/**
 * Runs one transaction over `stores`; resolves with `f`'s result after commit. With the connection open the
 * transaction (and `f`) starts synchronously in the caller's turn; otherwise after the open. Retries once on a
 * dead connection.
 */
function run<T>(mode: IDBTransactionMode, stores: string[], f: (t: IDBTransaction) => IDBRequest<T> | null, retry = true): Promise<T> {
  const exec = (db: IDBDatabase): Promise<T> => withTimeout(new Promise<T>((resolve, reject) => {
    let t: IDBTransaction | undefined;
    let r: IDBRequest<T> | null;
    try {
      t = db.transaction(stores, mode);
      r = f(t);
    } catch (e) {
      // a put that throws after an earlier one (e.g. meta written, state not cloneable) must not commit half
      try { t?.abort(); } catch { /* already finished */ }
      // InvalidStateError: the cached connection is closing / closed -> reopen once
      if (retry && e instanceof DOMException && e.name === 'InvalidStateError') {
        dbPromise = null;
        dbReady = null;
        run(mode, stores, f, false).then(resolve, reject);
      } else reject(e);
      return;
    }
    const tr = t;
    tr.oncomplete = () => resolve((r ? r.result : undefined) as T);
    tr.onerror = () => reject(tr.error ?? new Error('IndexedDB transaction failed'));
    tr.onabort = () => reject(tr.error ?? new Error('IndexedDB transaction aborted'));
  }), mode);
  return dbReady ? exec(dbReady) : open().then(exec);
}

function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return run(mode, [STORE], (t) => f(t.objectStore(STORE)));
}

/**
 * Writes an envelope and its metadata in one transaction. `make` runs inside the transaction callback, i.e. in the
 * same microtask as put(), which takes IndexedDB's structured clone at once: no game tick can slip between reading
 * the state's tick for the metadata and copying the state (D-50).
 */
function putEnvelope(make: () => Record<string, unknown>): Promise<void> {
  return run<IDBValidKey>('readwrite', [STORE, META], (t) => {
    const env = make();
    t.objectStore(META).put(metaOf(env));
    return t.objectStore(STORE).put(env);
  }).then(() => undefined);
}

/**
 * `chronicle`: the valley chronicle ids of this ledger (owner decision 1), stored in the envelope beside the
 * state — not in it, so state hashes do not change. Omitted for contracts.
 */
export async function saveGame(slot: string, state: SimState, chronicle?: readonly string[]): Promise<void> {
  // No JSON round trip: with the connection open, put() runs now and takes IndexedDB's structured clone of the
  // live state at once. Only the first save of a page (the database still opening) copies the state first,
  // so a game tick during the open cannot change what is saved.
  const snap = dbReady ? state : structuredClone(state);
  const chron = chronicle ? [...chronicle] : undefined;
  await putEnvelope(() => makeEnvelope(slot, snap, Date.now(), false, chron) as unknown as Record<string, unknown>);
}

/** A loaded slot: the migrated state and the envelope's UI data (chronicle [] when the save has none). */
export interface LoadedSave { state: SimState; chronicle: string[] }

/**
 * Loads a slot through the save gate (D-23): validation -> envelope upgrade -> terrain hash check ->
 * migrate(). Throws SaveError (with `.code`) for a damaged, newer or terrain-changed save.
 */
export async function loadSave(slot: string): Promise<LoadedSave | null> {
  const raw = await tx<unknown>('readonly', (s) => s.get(slot));
  if (raw === undefined) return null;
  const v = prepareLoad(raw);
  if (!v.ok) throw new SaveError(v.errors);
  try {
    return { state: migrate(v.envelope).state, chronicle: envelopeChronicle(raw) };
  } catch (e) {
    throw new SaveError([{ code: 'NO_MIGRATION', path: '$.stateVersion', detail: e instanceof Error ? e.message : String(e) }]);
  }
}

/** loadSave() without the envelope extras. */
export async function loadGame(slot: string): Promise<SimState | null> {
  return (await loadSave(slot))?.state ?? null;
}

// --- Profile (owner decision 13): best seals and time per contract mission ----------------------

/** The stored profile, sanitized; an empty one when there is none or it cannot be read. Never throws. */
export async function readProfile(): Promise<Profile> {
  try {
    return sanitizeProfile(await run<unknown>('readonly', [PROFILE], (t) => t.objectStore(PROFILE).get(PROFILE_ID)));
  } catch {
    return sanitizeProfile(null);
  }
}

/**
 * Records a won contract (seals 1..3, contract time in ticks) when it beats the stored best. Read and write
 * in one transaction, so two quick ends cannot lose one. Resolves with whether it set a new best.
 */
export async function recordContractResult(missionId: string, seals: number, ticks: number, at = Date.now()): Promise<boolean> {
  let improved = false;
  await run<IDBValidKey | undefined>('readwrite', [PROFILE], (t) => {
    const store = t.objectStore(PROFILE);
    const get = store.get(PROFILE_ID);
    get.onsuccess = () => {
      const r = recordBest(sanitizeProfile(get.result), missionId, seals, ticks, at);
      improved = r.improved;
      if (r.improved) store.put(r.profile);
    };
    return null;
  });
  return improved;
}

/** Checks a slot without loading it (e.g. to disable "Continue"): null = loadable or empty. */
export async function verifySave(slot: string): Promise<SaveError | null> {
  const raw = await tx<unknown>('readonly', (s) => s.get(slot));
  if (raw === undefined) return null;
  const v = prepareLoad(raw);
  return v.ok ? null : new SaveError(v.errors);
}

/** Saves newest first, read from the metadata store: no game state is loaded (D-50). */
export async function listSaves(): Promise<SaveMeta[]> {
  const all = await run<SaveMeta[]>('readonly', [META], (t) => t.objectStore(META).getAll() as IDBRequest<SaveMeta[]>);
  return all.slice().sort((a, b) => (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0));
}

export async function deleteSave(slot: string): Promise<void> {
  await run('readwrite', [STORE, META], (t) => {
    t.objectStore(META).delete(slot);
    return t.objectStore(STORE).delete(slot);
  });
}

// --- Slots (D-29, D-36): one slot per contract mission, three free-valley ledgers --------------

export {
  LEGACY_SLOT, VALLEY_SLOTS, contractSlot, contractSlotMission, isContractSlot, isGameSlot, isValleySlot, planLegacy, slotFor,
  type LegacyPlan, type ValleySlot,
} from './slots';

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
 * Moves a game out of the legacy single 'auto' slot (before D-29 also the free valley, before D-36
 * every contract) into its own slot: same envelope, only `slot` changes. The copy is written before
 * the legacy slot is deleted, so a failure in between leaves two copies, never none. Best effort.
 */
export async function adoptLegacySaves(): Promise<void> {
  const raw = await tx<unknown>('readonly', (s) => s.get(LEGACY_SLOT));
  if (raw === undefined) return;
  // a damaged or newer-version legacy save must never replace (or be moved over) a playable slot: keep it
  // in 'auto', where the menu reports it as damaged (research 2026-11-02-save-robustness B1)
  if (!prepareLoad(raw).ok) return;
  const others = (await listSaves()).filter((x) => x.slot !== LEGACY_SLOT);
  const plan = planLegacy(raw, others);
  if (plan.kind === 'keep') return;
  if (plan.kind === 'move') await putEnvelope(() => ({ ...(raw as Record<string, unknown>), slot: plan.to }));
  await deleteSave(LEGACY_SLOT);
}
