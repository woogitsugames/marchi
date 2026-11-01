// Save import gate (D-22): pure, Node-testable validation that runs BEFORE migrate().
// No DOM, no IndexedDB, never mutates its input and never throws on hostile input.
//
// Layers, cheapest first:
//   1. raw size (parseSave only)          -> TOO_LARGE / BAD_JSON
//   2. structural budget walk             -> TOO_DEEP / BUDGET / FORBIDDEN_KEY / BAD_TYPE
//   3. envelope fields                    -> BAD_ENVELOPE / UNSUPPORTED_FORMAT / BAD_VERSION / NEWER_VERSION
//   4. state schema (known fields only)   -> UNKNOWN_MAP / BAD_TYPE / OUT_OF_RANGE / DUPLICATE_ID / DANGLING_REF
//   5. sim invariants (checkInvariants)   -> INCONSISTENT
//   6. golden terrain hash (prepareLoad)  -> TERRAIN_CHANGED
//
// Forward compatibility: any state version 1..STATE_VERSION is accepted and unknown extra fields
// inside state objects are tolerated (a newer schema may add e.g. mission.tranches or
// building.capOverride). Only the fields this module knows are validated; size and depth are capped
// for everything.
import { BUILDINGS, GOODS, MAX_WAGONS, STATE_VERSION, WAGON_CAPACITY } from '../sim/defs';
import { isMapId, mapSize, terrainFor } from '../sim/missions';
import { checkInvariants } from '../sim/sim';
import { terrainHash } from '../sim/terrainHash';
import type { SimState } from '../sim/types';

// --- Public types --------------------------------------------------------------------------------

/** Machine-readable error codes. The UI maps them to i18n keys `save.err.<CODE>`. */
export type SaveErrorCode =
  | 'TOO_LARGE'
  | 'BAD_JSON'
  | 'TOO_DEEP'
  | 'BUDGET'
  | 'FORBIDDEN_KEY'
  | 'BAD_ENVELOPE'
  | 'UNSUPPORTED_FORMAT'
  | 'BAD_VERSION'
  | 'NEWER_VERSION'
  | 'UNKNOWN_MAP'
  | 'BAD_TYPE'
  | 'OUT_OF_RANGE'
  | 'DUPLICATE_ID'
  | 'DANGLING_REF'
  | 'INCONSISTENT'
  | 'TERRAIN_CHANGED'
  | 'NO_MIGRATION'
  | 'INTERNAL';

/**
 * Player-facing i18n key per code (keys live in src/i18n/*.ts). Everything that is not a newer
 * version or a changed map reads as "damaged or from another version".
 */
export function saveErrorMessageKey(code: SaveErrorCode): 'menu.saveNewer' | 'menu.saveTerrain' | 'menu.saveBroken' {
  if (code === 'NEWER_VERSION' || code === 'UNSUPPORTED_FORMAT') return 'menu.saveNewer';
  if (code === 'TERRAIN_CHANGED') return 'menu.saveTerrain';
  return 'menu.saveBroken';
}

export interface GateError {
  code: SaveErrorCode;
  /** JSON-ish path of the offending value, e.g. `state.buildings[3].stock.wood`. */
  path: string;
  /** English developer detail (not shown to players). */
  detail: string;
}

export type GateResult = { ok: true } | { ok: false; errors: GateError[] };

/** Current envelope format. Format 2 added `terrainHash`. */
export const SAVE_FORMAT = 2;

export interface SaveEnvelope {
  /** Envelope format version (independent of the sim state version). */
  format: 2;
  stateVersion: number;
  slot: string;
  savedAt: number;
  missionId: string;
  tick: number;
  /** terrainHash(terrainFor(mapId, seed)) when the save was written (see D-22). */
  terrainHash: string;
  state: SimState;
}

/** Format 1 envelope (before the terrain hash). */
export type SaveEnvelopeV1 = Omit<SaveEnvelope, 'format' | 'terrainHash'> & { format: 1 };

/** Thrown by loadGame(); `code` is the first error's code. */
export class SaveError extends Error {
  readonly code: SaveErrorCode;
  readonly errors: GateError[];
  constructor(errors: GateError[]) {
    const first = errors[0] ?? { code: 'INTERNAL' as const, path: '$', detail: 'unknown save error' };
    super(`${first.code} at ${first.path}: ${first.detail}`);
    this.name = 'SaveError';
    this.code = first.code;
    this.errors = errors;
  }
}

// --- Limits --------------------------------------------------------------------------------------

export const LIMITS = {
  /** Raw JSON text (UTF-16 code units). A busy late-game save is ~200 kB. */
  maxJsonChars: 4_000_000,
  /** Nesting depth of any value (envelope = 0). Real saves reach ~5. */
  maxDepth: 16,
  /** Any array (checked by .length before iterating). Cell arrays are checked against W*H. */
  maxArrayLen: 65_536,
  /** Keys per object (ledger.stallSeconds is the only open-ended map). */
  maxObjectKeys: 4_096,
  /** Any string value or key. */
  maxStringLen: 256,
  /** Total values visited in the walk. */
  maxNodes: 2_000_000,
  /** Map grid (W*H). The largest map today is 96x72 = 6912. */
  maxCells: 65_536,
  maxBuildings: 2_048,
  maxWagons: MAX_WAGONS,
  maxRain: 256,
  /** Bound for any integer counter (ticks, ids, ledger, coins). 2^40 ticks = 3,500 years at 10 Hz. */
  maxInt: 2 ** 40,
  maxErrors: 20,
} as const;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const BUILDING_TYPES = new Set(Object.keys(BUILDINGS));
const GOOD_SET = new Set<string>(GOODS);
const BUILDING_STATUS = new Set([
  'WORKING', 'IDLE', 'NO_ROAD', 'NO_INPUT', 'WAITING_UPSTREAM', 'WAITING_DELIVERY', 'NO_WAGON',
  'OUTPUT_FULL', 'WAITING_PICKUP', 'STORAGE_FULL', 'CONTRACT_DONE',
]);
// BRIDGE_CLOSED: announced for state v3 (closed-bridge status from a concurrent change); harmless
// to accept early, the sim recomputes wagon statuses every tick.
const WAGON_STATUS = new Set(['IDLE', 'TO_PICKUP', 'LOADING', 'TO_DROPOFF', 'UNLOADING', 'RETURNING', 'BRIDGE_JAM', 'NO_ROUTE', 'BRIDGE_CLOSED']);
const RESULTS = new Set(['running', 'won', 'lost']);

// --- Helpers -------------------------------------------------------------------------------------

class Stop extends Error {}

class Errs {
  list: GateError[] = [];
  add(code: SaveErrorCode, path: string, detail: string): void {
    if (this.list.length < LIMITS.maxErrors) this.list.push({ code, path, detail });
    if (this.list.length >= LIMITS.maxErrors) throw new Stop();
  }
  /** Add and abort the walk (budget errors: continuing would cost what the budget protects). */
  fatal(code: SaveErrorCode, path: string, detail: string): never {
    this.list.push({ code, path, detail });
    throw new Stop();
  }
}

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function has(o: Obj, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, k);
}

function show(v: unknown): string {
  try {
    if (typeof v === 'number' || typeof v === 'boolean' || v === null || v === undefined) return String(v);
    if (typeof v === 'string') return JSON.stringify(v.length > 40 ? v.slice(0, 40) + '…' : v);
    if (Array.isArray(v)) return `array(${v.length})`;
    return typeof v;
  } catch {
    return '?';
  }
}

function result(e: Errs): GateResult {
  return e.list.length ? { ok: false, errors: e.list } : { ok: true };
}

function internal(err: unknown): GateResult {
  let msg = 'unknown';
  try { msg = err instanceof Error ? err.message : String(err); } catch { /* hostile toString */ }
  return { ok: false, errors: [{ code: 'INTERNAL', path: '$', detail: `validator crashed: ${msg.slice(0, 200)}` }] };
}

// --- Layer 2: structural budget ------------------------------------------------------------------

/**
 * Walks any value once: plain objects/arrays only, bounded depth, lengths, keys, strings and total
 * nodes; rejects prototype-pollution keys and non-JSON values (functions, NaN, Infinity, undefined,
 * class instances). Array lengths are read before iterating, so a 10M-entry array costs O(1).
 */
function walkBudget(root: unknown, rootPath: string, e: Errs): void {
  let nodes = 0;
  const visit = (v: unknown, path: string, depth: number): void => {
    if (++nodes > LIMITS.maxNodes) e.fatal('BUDGET', path, `more than ${LIMITS.maxNodes} values`);
    if (depth > LIMITS.maxDepth) e.fatal('TOO_DEEP', path, `nesting deeper than ${LIMITS.maxDepth}`);
    switch (typeof v) {
      case 'number':
        if (!Number.isFinite(v)) e.add('BAD_TYPE', path, `non-finite number ${v}`);
        return;
      case 'string':
        if (v.length > LIMITS.maxStringLen) e.fatal('BUDGET', path, `string longer than ${LIMITS.maxStringLen}`);
        return;
      case 'boolean':
        return;
      case 'object':
        break;
      default:
        e.add('BAD_TYPE', path, `${typeof v} is not JSON data`);
        return;
    }
    if (v === null) return;
    if (Array.isArray(v)) {
      const n = v.length;
      if (n > LIMITS.maxArrayLen) e.fatal('BUDGET', path, `array of ${n} entries (max ${LIMITS.maxArrayLen})`);
      for (let i = 0; i < n; i++) visit(v[i], `${path}[${i}]`, depth + 1);
      return;
    }
    const proto = Object.getPrototypeOf(v) as unknown;
    if (proto !== Object.prototype && proto !== null) {
      e.add('BAD_TYPE', path, 'not a plain object');
      return;
    }
    const keys = Object.keys(v);
    if (keys.length > LIMITS.maxObjectKeys) e.fatal('BUDGET', path, `object with ${keys.length} keys (max ${LIMITS.maxObjectKeys})`);
    for (const k of keys) {
      if (FORBIDDEN_KEYS.has(k)) e.fatal('FORBIDDEN_KEY', `${path}.${k}`, `forbidden key "${k}"`);
      if (k.length > LIMITS.maxStringLen) e.fatal('BUDGET', path, `key longer than ${LIMITS.maxStringLen}`);
      visit((v as Obj)[k], `${path}.${k}`, depth + 1);
    }
  };
  visit(root, rootPath, 0);
}

// --- Layer 4: state schema -----------------------------------------------------------------------

interface Ctx {
  e: Errs;
  cells: number;
  W: number;
  H: number;
}

function int(c: Ctx, o: Obj, k: string, path: string, min: number, max: number): number | null {
  const v = o[k];
  const p = `${path}.${k}`;
  if (!has(o, k)) { c.e.add('BAD_TYPE', p, 'missing'); return null; }
  if (typeof v !== 'number' || !Number.isInteger(v)) { c.e.add('BAD_TYPE', p, `expected integer, got ${show(v)}`); return null; }
  if (v < min || v > max) { c.e.add('OUT_OF_RANGE', p, `${v} not in [${min}, ${max}]`); return null; }
  return v;
}

function num(c: Ctx, o: Obj, k: string, path: string, min: number, max: number): number | null {
  const v = o[k];
  const p = `${path}.${k}`;
  if (!has(o, k)) { c.e.add('BAD_TYPE', p, 'missing'); return null; }
  if (typeof v !== 'number' || !Number.isFinite(v)) { c.e.add('BAD_TYPE', p, `expected finite number, got ${show(v)}`); return null; }
  if (v < min || v > max) { c.e.add('OUT_OF_RANGE', p, `${v} not in [${min}, ${max}]`); return null; }
  return v;
}

function str(c: Ctx, o: Obj, k: string, path: string): string | null {
  const v = o[k];
  if (typeof v !== 'string') { c.e.add('BAD_TYPE', `${path}.${k}`, `expected string, got ${show(v)}`); return null; }
  return v;
}

function obj(c: Ctx, o: Obj, k: string, path: string): Obj | null {
  const v = o[k];
  if (!isObj(v)) { c.e.add('BAD_TYPE', `${path}.${k}`, `expected object, got ${show(v)}`); return null; }
  return v;
}

function arr(c: Ctx, o: Obj, k: string, path: string, max: number): unknown[] | null {
  const v = o[k];
  if (!Array.isArray(v)) { c.e.add('BAD_TYPE', `${path}.${k}`, `expected array, got ${show(v)}`); return null; }
  if (v.length > max) { c.e.add('BUDGET', `${path}.${k}`, `${v.length} entries (max ${max})`); return null; }
  return v;
}

/** Cell index (or -1 when allowed). */
function cell(c: Ctx, o: Obj, k: string, path: string, allowNone: boolean): number | null {
  return int(c, o, k, path, allowNone ? -1 : 0, c.cells - 1);
}

function goodMap(c: Ctx, o: Obj, k: string, path: string): Obj | null {
  const g = obj(c, o, k, path);
  if (!g) return null;
  for (const good of GOODS) int(c, g, good, `${path}.${k}`, 0, LIMITS.maxInt);
  return g;
}

function goodField(c: Ctx, o: Obj, k: string, path: string, nullable: boolean): void {
  const v = o[k];
  if (nullable && v === null) return;
  if (typeof v !== 'string' || !GOOD_SET.has(v)) c.e.add('BAD_TYPE', `${path}.${k}`, `unknown good ${show(v)}`);
}

/** Status objects: known `k`; every other known-shaped field must be a finite integer / known good / string. */
function status(c: Ctx, o: Obj, path: string, known: Set<string>): void {
  const s = obj(c, o, 'status', path);
  if (!s) return;
  const p = `${path}.status`;
  const k = s.k;
  if (typeof k !== 'string' || !known.has(k)) { c.e.add('BAD_TYPE', `${p}.k`, `unknown status ${show(k)}`); return; }
  for (const f of Object.keys(s)) {
    if (f === 'k') continue;
    const v = s[f];
    if (f === 'good') goodField(c, s, f, p, false);
    else if (f === 'cause') { if (typeof v !== 'string') c.e.add('BAD_TYPE', `${p}.${f}`, `expected string, got ${show(v)}`); }
    else if (typeof v === 'number') { if (!Number.isInteger(v) || Math.abs(v) > LIMITS.maxInt) c.e.add('BAD_TYPE', `${p}.${f}`, `expected integer, got ${show(v)}`); }
    // other future-optional fields: tolerated (already budget-checked)
  }
}

function cellArray(c: Ctx, o: Obj, k: string, path: string, maxValue: number): void {
  const a = arr(c, o, k, path, LIMITS.maxCells);
  if (!a) return;
  if (a.length !== c.cells) { c.e.add('OUT_OF_RANGE', `${path}.${k}`, `length ${a.length} != map cells ${c.cells} (${c.W}x${c.H})`); return; }
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > maxValue) c.e.add('OUT_OF_RANGE', `${path}.${k}[${i}]`, `expected integer 0..${maxValue}, got ${show(v)}`);
  }
}

function gateStateInner(s: unknown, version: number, e: Errs): void {
  const P = 'state';
  if (!isObj(s)) { e.add('BAD_TYPE', P, `expected object, got ${show(s)}`); return; }
  const c0: Ctx = { e, cells: 0, W: 0, H: 0 };
  const v = int(c0, s, 'version', P, 1, STATE_VERSION);
  if (v !== null && v !== version) e.add('INCONSISTENT', `${P}.version`, `state.version ${v} != envelope stateVersion ${version}`);
  const mapId = str(c0, s, 'mapId', P);
  if (mapId === null) return;
  const size = isMapId(mapId) ? mapSize(mapId) : null;
  if (!size) { e.add('UNKNOWN_MAP', `${P}.mapId`, `unknown map ${show(mapId)}`); return; }
  if (size.w * size.h > LIMITS.maxCells) { e.add('BUDGET', `${P}.mapId`, 'map larger than the cell budget'); return; }
  const c: Ctx = { e, cells: size.w * size.h, W: size.w, H: size.h };

  int(c, s, 'seed', P, -(2 ** 32), 2 ** 32);
  int(c, s, 'tick', P, 0, LIMITS.maxInt);
  num(c, s, 'coins', P, 0, LIMITS.maxInt); // spending is refused when short, so never negative
  int(c, s, 'netVersion', P, 0, LIMITS.maxInt);
  const nextId = int(c, s, 'nextId', P, 1, LIMITS.maxInt);
  const rng = arr(c, s, 'rng', P, 4);
  if (rng) {
    if (rng.length !== 4) e.add('BAD_TYPE', `${P}.rng`, `expected 4 words, got ${rng.length}`);
    rng.forEach((w, i) => {
      if (typeof w !== 'number' || !Number.isInteger(w) || w < 0 || w > 0xffffffff) e.add('OUT_OF_RANGE', `${P}.rng[${i}]`, `expected uint32, got ${show(w)}`);
    });
  }
  cellArray(c, s, 'roads', P, 2);
  cellArray(c, s, 'traffic', P, LIMITS.maxInt);

  // buildings
  const ids = new Map<number, string>(); // id -> building type or 'wagon'
  const buildings = arr(c, s, 'buildings', P, LIMITS.maxBuildings) ?? [];
  const occupied = new Map<number, number>();
  buildings.forEach((b, i) => {
    const bp = `${P}.buildings[${i}]`;
    if (!isObj(b)) { e.add('BAD_TYPE', bp, `expected object, got ${show(b)}`); return; }
    const id = int(c, b, 'id', bp, 1, LIMITS.maxInt);
    const type = b.type;
    if (typeof type !== 'string' || !BUILDING_TYPES.has(type)) { e.add('BAD_TYPE', `${bp}.type`, `unknown building type ${show(type)}`); return; }
    if (id !== null) {
      if (ids.has(id)) e.add('DUPLICATE_ID', `${bp}.id`, `id ${id} used twice`);
      else ids.set(id, type);
      if (nextId !== null && id >= nextId) e.add('INCONSISTENT', `${bp}.id`, `id ${id} >= nextId ${nextId}`);
    }
    const def = BUILDINGS[type as keyof typeof BUILDINGS];
    const x = int(c, b, 'x', bp, 0, c.W - 1);
    const y = int(c, b, 'y', bp, 0, c.H - 1);
    const w = int(c, b, 'w', bp, def.w, def.w);
    const h = int(c, b, 'h', bp, def.h, def.h);
    const facing = int(c, b, 'facing', bp, 0, 3);
    const gate = cell(c, b, 'gate', bp, false);
    if (x !== null && y !== null && w !== null && h !== null) {
      if (x + w > c.W || y + h > c.H) e.add('OUT_OF_RANGE', bp, `footprint ${x},${y} ${w}x${h} leaves the ${c.W}x${c.H} map`);
      else if (id !== null) {
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
          const ci = yy * c.W + xx;
          const other = occupied.get(ci);
          if (other !== undefined) { e.add('INCONSISTENT', bp, `footprint overlaps building ${other} at cell ${ci}`); yy = y + h; break; }
          occupied.set(ci, id);
        }
      }
      if (facing !== null && gate !== null) {
        const expect = facing === 0 ? (y + h) * c.W + (x + (w >> 1))
          : facing === 1 ? (y + (h >> 1)) * c.W + (x + w)
          : facing === 2 ? (y - 1) * c.W + (x + (w >> 1))
          : (y + (h >> 1)) * c.W + (x - 1);
        if (gate !== expect) e.add('INCONSISTENT', `${bp}.gate`, `gate ${gate} does not match footprint + facing (${expect})`);
      }
    }
    const stock = goodMap(c, b, 'stock', bp);
    const res = goodMap(c, b, 'reservedOut', bp);
    goodMap(c, b, 'incoming', bp);
    if (stock && res) for (const g of GOODS) {
      const sv = stock[g], rv = res[g];
      if (typeof sv === 'number' && typeof rv === 'number' && rv > sv) e.add('INCONSISTENT', `${bp}.reservedOut.${g}`, `reserved ${rv} > stock ${sv}`);
    }
    int(c, b, 'progress', bp, -1, LIMITS.maxInt);
    int(c, b, 'stalledTicks', bp, 0, LIMITS.maxInt);
    status(c, b, bp, BUILDING_STATUS);
  });
  // gates must not sit under a footprint (net() maps gate -> building)
  for (const b of buildings) {
    if (isObj(b) && typeof b.gate === 'number' && occupied.has(b.gate)) {
      e.add('INCONSISTENT', `${P}.buildings`, `gate ${b.gate} of building ${show(b.id)} lies under building ${occupied.get(b.gate)}`);
    }
  }

  // wagons
  const wagons = arr(c, s, 'wagons', P, LIMITS.maxWagons) ?? [];
  wagons.forEach((w, i) => {
    const wp = `${P}.wagons[${i}]`;
    if (!isObj(w)) { e.add('BAD_TYPE', wp, `expected object, got ${show(w)}`); return; }
    const id = int(c, w, 'id', wp, 1, LIMITS.maxInt);
    if (id !== null) {
      if (ids.has(id)) e.add('DUPLICATE_ID', `${wp}.id`, `id ${id} used twice`);
      else ids.set(id, 'wagon');
      if (nextId !== null && id >= nextId) e.add('INCONSISTENT', `${wp}.id`, `id ${id} >= nextId ${nextId}`);
    }
    cell(c, w, 'at', wp, false);
    cell(c, w, 'next', wp, true);
    cell(c, w, 'dest', wp, true);
    cell(c, w, 'bridgeFrom', wp, true);
    num(c, w, 'edgeT', wp, 0, 1e6);
    num(c, w, 'odometer', wp, 0, 1e15);
    int(c, w, 'pathVer', wp, -1, LIMITS.maxInt);
    int(c, w, 'busyTicks', wp, 0, LIMITS.maxInt);
    const path = arr(c, w, 'path', wp, c.cells);
    if (path) path.forEach((n, j) => {
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n >= c.cells) e.add('OUT_OF_RANGE', `${wp}.path[${j}]`, `expected cell 0..${c.cells - 1}, got ${show(n)}`);
    });
    goodField(c, w, 'cargoGood', wp, true);
    const cargoQty = int(c, w, 'cargoQty', wp, 0, WAGON_CAPACITY);
    if (cargoQty && w.cargoGood === null) e.add('INCONSISTENT', `${wp}.cargoQty`, 'cargo without a good');
    status(c, w, wp, WAGON_STATUS);
    // jobs and references are checked after all ids are known
  });

  // references (need every id)
  wagons.forEach((w, i) => {
    if (!isObj(w)) return;
    const wp = `${P}.wagons[${i}]`;
    const home = w.home;
    if (typeof home !== 'number' || !Number.isInteger(home)) e.add('BAD_TYPE', `${wp}.home`, `expected integer, got ${show(home)}`);
    else if (ids.get(home) !== 'stable') e.add('DANGLING_REF', `${wp}.home`, `home ${home} is not a stable`);
    if (!has(w, 'job')) { e.add('BAD_TYPE', `${wp}.job`, 'missing'); return; }
    const job = w.job;
    if (job === null) return;
    const jp = `${wp}.job`;
    if (!isObj(job)) { e.add('BAD_TYPE', jp, `expected object or null, got ${show(job)}`); return; }
    int(c, job, 'id', jp, 0, LIMITS.maxInt);
    goodField(c, job, 'good', jp, false);
    int(c, job, 'qty', jp, 1, WAGON_CAPACITY);
    const phase = job.phase;
    if (phase !== 'pickup' && phase !== 'dropoff') e.add('BAD_TYPE', `${jp}.phase`, `unknown phase ${show(phase)}`);
    const from = int(c, job, 'from', jp, -1, LIMITS.maxInt);
    const to = int(c, job, 'to', jp, -1, LIMITS.maxInt);
    // A pickup needs its source; after loading, from/to may dangle for a tick (demolished building,
    // repairJob() re-targets), so only wagons are forbidden as endpoints.
    if (from !== null) {
      if (phase === 'pickup' && !(ids.has(from) && ids.get(from) !== 'wagon')) e.add('DANGLING_REF', `${jp}.from`, `pickup source ${from} is not a building`);
      else if (ids.get(from) === 'wagon') e.add('DANGLING_REF', `${jp}.from`, `${from} is a wagon`);
    }
    if (to !== null && ids.get(to) === 'wagon') e.add('DANGLING_REF', `${jp}.to`, `${to} is a wagon`);
  });

  // rain
  const rain = arr(c, s, 'rain', P, LIMITS.maxRain) ?? [];
  rain.forEach((r, i) => {
    const rp = `${P}.rain[${i}]`;
    if (!isObj(r)) { e.add('BAD_TYPE', rp, `expected object, got ${show(r)}`); return; }
    const a = int(c, r, 'start', rp, 0, LIMITS.maxInt);
    const b = int(c, r, 'end', rp, 0, LIMITS.maxInt);
    if (a !== null && b !== null && b < a) e.add('OUT_OF_RANGE', rp, `end ${b} before start ${a}`);
  });

  // mission
  const m = obj(c, s, 'mission', P);
  if (m) {
    const mp = `${P}.mission`;
    str(c, m, 'id', mp);
    if (typeof m.result !== 'string' || !RESULTS.has(m.result)) e.add('BAD_TYPE', `${mp}.result`, `unknown result ${show(m.result)}`);
    int(c, m, 'endTick', mp, -1, LIMITS.maxInt);
    if (!has(m, 'contract')) e.add('BAD_TYPE', `${mp}.contract`, 'missing');
    else if (m.contract !== null) {
      const ct = obj(c, m, 'contract', mp);
      if (ct) {
        const cp = `${mp}.contract`;
        goodMap(c, ct, 'need', cp);
        const castle = int(c, ct, 'castle', cp, 1, LIMITS.maxInt);
        if (castle !== null && ids.get(castle) !== 'castle') e.add('DANGLING_REF', `${cp}.castle`, `castle ${castle} is not a castle`);
        int(c, ct, 'deadlineTick', cp, 0, LIMITS.maxInt);
        int(c, ct, 'star3Tick', cp, 0, LIMITS.maxInt);
        int(c, ct, 'star2Tick', cp, 0, LIMITS.maxInt);
      }
    }
  }

  // ledger
  const l = obj(c, s, 'ledger', P);
  if (l) {
    const lp = `${P}.ledger`;
    goodMap(c, l, 'produced', lp);
    goodMap(c, l, 'consumed', lp);
    goodMap(c, l, 'destroyed', lp);
    // stallSeconds arrived with state v2 (v1 -> v2 migration adds it)
    if (version >= 2 || has(l, 'stallSeconds')) {
      const ss = obj(c, l, 'stallSeconds', lp);
      if (ss) for (const k of Object.keys(ss)) {
        const v2 = ss[k];
        if (typeof v2 !== 'number' || !Number.isFinite(v2) || v2 < 0) e.add('OUT_OF_RANGE', `${lp}.stallSeconds.${k}`, `expected seconds >= 0, got ${show(v2)}`);
      }
    }
  }
}

/** Layer 5: the sim's own invariants (conservation, reservations == jobs) on a read-only world. */
function gateInvariants(s: SimState, e: Errs): void {
  const world = { terrain: terrainFor(s.mapId, s.seed), state: s, cache: null, scratch: null };
  for (const msg of checkInvariants(world).slice(0, 5)) e.add('INCONSISTENT', 'state', msg);
}

// --- Public API ----------------------------------------------------------------------------------

/**
 * Validates a sim state of the given schema version (1..STATE_VERSION) without migrating it.
 * Unknown extra fields are tolerated; known fields are checked for type, range and references.
 */
export function gateState(state: unknown, version: number): GateResult {
  const e = new Errs();
  try {
    if (!Number.isInteger(version) || version < 1 || version > STATE_VERSION) {
      e.add(version > STATE_VERSION ? 'NEWER_VERSION' : 'BAD_VERSION', 'stateVersion', `state version ${show(version)} not in 1..${STATE_VERSION}`);
      return result(e);
    }
    walkBudget(state, 'state', e);
    if (e.list.length) return result(e);
    gateStateInner(state, version, e);
    if (e.list.length) return result(e);
    gateInvariants(state as SimState, e);
    return result(e);
  } catch (err) {
    if (err instanceof Stop) return result(e);
    return internal(err);
  }
}

/** Validates a save envelope of format 1 or 2 (before format upgrade, terrain check and migrate()). */
export function gateEnvelope(env: unknown): GateResult {
  const e = new Errs();
  try {
    walkBudget(env, '$', e);
    if (e.list.length) return result(e);
    if (!isObj(env)) { e.add('BAD_ENVELOPE', '$', `expected object, got ${show(env)}`); return result(e); }
    const format = env.format;
    if (format !== 1 && format !== 2) {
      e.add('UNSUPPORTED_FORMAT', '$.format', `envelope format ${show(format)} (supported 1..${SAVE_FORMAT})`);
      return result(e);
    }
    const sv = env.stateVersion;
    if (typeof sv !== 'number' || !Number.isInteger(sv) || sv < 1) {
      e.add('BAD_VERSION', '$.stateVersion', `expected integer >= 1, got ${show(sv)}`);
      return result(e);
    }
    if (sv > STATE_VERSION) {
      e.add('NEWER_VERSION', '$.stateVersion', `save is from a newer game version (state ${sv} > ${STATE_VERSION})`);
      return result(e);
    }
    for (const k of ['slot', 'missionId'] as const) {
      if (typeof env[k] !== 'string') e.add('BAD_ENVELOPE', `$.${k}`, `expected string, got ${show(env[k])}`);
    }
    for (const k of ['savedAt', 'tick'] as const) {
      const v = env[k];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) e.add('BAD_ENVELOPE', `$.${k}`, `expected number >= 0, got ${show(v)}`);
    }
    if (format === 2 && (typeof env.terrainHash !== 'string' || !/^t\d+-[0-9a-f]{16}$/.test(env.terrainHash))) {
      e.add('BAD_ENVELOPE', '$.terrainHash', `expected terrain hash, got ${show(env.terrainHash)}`);
    }
    if (!has(env, 'state')) e.add('BAD_ENVELOPE', '$.state', 'missing');
    if (e.list.length) return result(e);
    return gateState(env.state, sv);
  } catch (err) {
    if (err instanceof Stop) return result(e);
    return internal(err);
  }
}

/** Golden hash of the terrain the generator produces today for this map + seed. */
export function currentTerrainHash(mapId: string, seed: number): string {
  return terrainHash(terrainFor(mapId, seed));
}

/**
 * Envelope migrations (format N -> N+1). Pure: returns a new object, shares `state` by reference.
 * 1 -> 2: trust-on-first-load. Format 1 never stored a terrain hash, so the terrain regenerated now
 * is assumed to be the one the save was made on; the next saveGame() records it.
 */
export function upgradeEnvelope(env: SaveEnvelopeV1 | SaveEnvelope): SaveEnvelope {
  if (env.format === 2) return env;
  const { format: _f, ...rest } = env;
  return { ...rest, format: 2, terrainHash: currentTerrainHash(env.state.mapId, env.state.seed) };
}

/** Compares the stored terrain hash with what the generator produces now. */
export function checkTerrain(env: SaveEnvelope): GateResult {
  try {
    const now = currentTerrainHash(env.state.mapId, env.state.seed);
    if (now === env.terrainHash) return { ok: true };
    return {
      ok: false,
      errors: [{ code: 'TERRAIN_CHANGED', path: '$.terrainHash', detail: `saved on terrain ${env.terrainHash}, generator now gives ${now} for ${env.state.mapId}:${env.state.seed}` }],
    };
  } catch (err) {
    return internal(err);
  }
}

export type LoadVerdict = { ok: true; envelope: SaveEnvelope } | { ok: false; errors: GateError[] };

/** Full pre-migration pipeline: gate -> envelope upgrade -> terrain check. Never throws. */
export function prepareLoad(raw: unknown): LoadVerdict {
  const g = gateEnvelope(raw);
  if (!g.ok) return g;
  try {
    const env = upgradeEnvelope(raw as SaveEnvelopeV1 | SaveEnvelope);
    const t = checkTerrain(env);
    if (!t.ok) return t;
    return { ok: true, envelope: env };
  } catch (err) {
    return internal(err) as { ok: false; errors: GateError[] };
  }
}

/** Text import (file, clipboard, tests): size check -> JSON.parse -> prepareLoad. Never throws. */
export function parseSave(json: string): LoadVerdict {
  if (typeof json !== 'string') return { ok: false, errors: [{ code: 'BAD_JSON', path: '$', detail: 'not a string' }] };
  if (json.length > LIMITS.maxJsonChars) {
    return { ok: false, errors: [{ code: 'TOO_LARGE', path: '$', detail: `${json.length} chars (max ${LIMITS.maxJsonChars})` }] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    return { ok: false, errors: [{ code: 'BAD_JSON', path: '$', detail: err instanceof Error ? err.message.slice(0, 200) : 'parse error' }] };
  }
  return prepareLoad(raw);
}

/** Builds a format-2 envelope (used by saveGame; pure apart from the caller-supplied clock). */
export function makeEnvelope(slot: string, state: SimState, savedAt: number): SaveEnvelope {
  return {
    format: 2, stateVersion: state.version, slot, savedAt, missionId: state.mission.id, tick: state.tick,
    terrainHash: currentTerrainHash(state.mapId, state.seed),
    // structured clone of plain JSON data
    state: JSON.parse(JSON.stringify(state)) as SimState,
  };
}
