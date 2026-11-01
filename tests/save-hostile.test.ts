// Hostile / damaged saves against the save gate (D-23). Vectors are built in memory; nothing here
// allocates more than a few MB (huge arrays are sparse, the size limit is tested at its edge).
import { migrate } from '../src/platform/save';
import {
  LIMITS, SaveError, gateEnvelope, saveErrorMessageKey, gateState, makeEnvelope, parseSave, prepareLoad,
  type GateResult, type SaveEnvelope, type SaveErrorCode,
} from '../src/platform/saveGate';
import { MISSIONS, terrainFor } from '../src/sim/missions';
import { terrainHash } from '../src/sim/terrainHash';
import {
  STATE_VERSION, applyCommand, checkInvariants, createWorld, step, worldFromState, type SimState, type World,
} from '../src/sim/index';
import { bridgeA, stableId } from '../tools/bot';
import { generateScenario, makeWorld } from '../tools/fuzz-lib';
import { assert, eq, test } from './harness';

// --- helpers -------------------------------------------------------------------------------------

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function deepFreeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze((v as J)[k]);
  }
  return v;
}

function envOf(w: World, slot = 'auto'): SaveEnvelope {
  return makeEnvelope(slot, w.state, 1_700_000_000_000);
}

/** A mid-game m1 save: bridge built, extra wagon, some wagon carrying cargo between nodes. */
function midDelivery(): World {
  const w = createWorld('m1');
  applyCommand(w, bridgeA(w));
  applyCommand(w, { t: 'buyWagon', stable: stableId(w) });
  while (!w.state.wagons.some((q) => q.cargoQty > 0 && q.next >= 0)) step(w);
  return w;
}

const BASE = midDelivery();
const BASE_ENV = deepFreeze(envOf(BASE));

/** Gate on a frozen copy (proves no mutation) and also check the JSON did not change. */
function gate(env: unknown): GateResult {
  const frozen = deepFreeze(clone(env));
  const before = JSON.stringify(frozen);
  const r = gateEnvelope(frozen);
  eq(JSON.stringify(frozen), before, 'gate must not mutate its input');
  return r;
}

function expectReject(r: GateResult | ReturnType<typeof prepareLoad>, code: SaveErrorCode, what: string): void {
  assert(!r.ok, `${what}: expected rejection ${code}, got ok`);
  if (!r.ok) {
    assert(r.errors.length > 0, `${what}: errors listed`);
    assert(r.errors.some((e) => e.code === code), `${what}: expected ${code}, got ${r.errors.map((e) => `${e.code}@${e.path}`).join(', ')}`);
    for (const e of r.errors) assert(typeof e.path === 'string' && typeof e.detail === 'string', 'error shape');
  }
}

/** Mutate a copy of the base envelope's state and gate it. */
function withState(f: (s: J) => void): GateResult {
  const env = clone(BASE_ENV) as J;
  f(env.state as J);
  return gate(env);
}

/**
 * Like withState but without a JSON round trip, for values JSON cannot carry (sparse 10M arrays,
 * class instances, functions, undefined, 100k-deep objects). Shallow copies along the patched path.
 */
function patched(path: (string | number)[], value: unknown): GateResult {
  const root: J = { ...BASE_ENV, state: { ...BASE_ENV.state } };
  let node: J = root.state as J;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i]!;
    const child = node[k as string] as J;
    node[k as string] = Array.isArray(child) ? [...child] : { ...child };
    node = node[k as string] as J;
  }
  node[path[path.length - 1] as string] = value;
  return gateEnvelope(root);
}

function expectOk(r: GateResult | ReturnType<typeof prepareLoad>, what: string): void {
  assert(r.ok, `${what}: expected ok, got ${r.ok ? '' : r.errors.slice(0, 3).map((e) => `${e.code}@${e.path}: ${e.detail}`).join('; ')}`);
}

// --- valid saves ---------------------------------------------------------------------------------

test('valid saves of every mission (several points in time) pass the gate and the full load pipeline', () => {
  for (const id of Object.keys(MISSIONS)) {
    const w = createWorld(id);
    if (id === 'm1' || id === 'sandbox') applyCommand(w, bridgeA(w));
    for (const until of [0, 300, 1500]) {
      while (w.state.tick < until) step(w);
      const env = envOf(w);
      expectOk(gate(env), `${id}@${until} gate`);
      const p = parseSave(JSON.stringify(env));
      expectOk(p, `${id}@${until} parseSave`);
      if (p.ok) {
        const st = migrate(p.envelope).state;
        const w2 = worldFromState(clone(st));
        for (let i = 0; i < 50; i++) step(w2);
        eq(checkInvariants(w2).length, 0, `${id}@${until} invariants after reload`);
      }
    }
  }
  expectOk(gate(BASE_ENV), 'mid-delivery m1');
});

test('states reached by seeded fuzz command sequences are never rejected (no false positives)', () => {
  const bad: string[] = [];
  for (let seed = 1; seed <= 6; seed++) {
    const sc = generateScenario(seed, { ticks: 2000, minCmds: 10, maxCmds: 40 });
    const w = makeWorld(sc.mission, sc.coins);
    const cmds = [...sc.commands].sort((a, b) => a.tick - b.tick);
    let ci = 0;
    for (let t = 0; t < sc.ticks; t++) {
      while (ci < cmds.length && cmds[ci]!.tick <= t) applyCommand(w, cmds[ci++]!.cmd);
      // between a command and the next tick is a legal save point too
      if (t % 250 === 0) {
        const r = gateEnvelope(envOf(w));
        if (!r.ok) bad.push(`seed ${seed} tick ${t}: ${r.errors.slice(0, 2).map((e) => `${e.code}@${e.path}: ${e.detail}`).join('; ')}`);
      }
      step(w);
    }
  }
  assert(bad.length === 0, bad.slice(0, 5).join('\n'));
});

test('unknown extra fields from a newer schema are tolerated (state v3 forward-compat)', () => {
  expectOk(withState((s) => {
    s.mission.tranches = [{ need: { wood: 0, planks: 5, grain: 0, flour: 0, bread: 0 }, dueTick: 100 }];
    s.buildings[0].capOverride = 4;
    s.wagons[0].extra = { note: 'future' };
    s.futureTopLevel = [1, 2, 3];
  }), 'extra fields');
});

// --- size and structure budgets ------------------------------------------------------------------

test('raw JSON larger than the limit is refused before parsing', () => {
  const big = '"' + 'x'.repeat(LIMITS.maxJsonChars) + '"';
  expectReject(parseSave(big), 'TOO_LARGE', 'giant string');
  expectReject(parseSave('{"format":2,'), 'BAD_JSON', 'truncated json');
  expectReject(parseSave(''), 'BAD_JSON', 'empty');
  expectReject(parseSave(42 as unknown as string), 'BAD_JSON', 'not a string');
});

test('huge arrays are refused by length without iterating (10M roads, 1M buildings)', () => {
  const t0 = Date.now();
  const huge: number[] = [];
  huge.length = 10_000_000; // sparse: no memory, but Array.isArray and .length are real
  expectReject(patched(['roads'], huge), 'BUDGET', '10M roads');
  expectReject(patched(['wagons', 0, 'path'], huge), 'BUDGET', '10M path');
  const many: unknown[] = [];
  many.length = 1_000_000;
  expectReject(patched(['buildings'], many), 'BUDGET', '1M buildings');
  const wagons = Array.from({ length: LIMITS.maxWagons + 1 }, () => ({}));
  expectReject(patched(['wagons'], wagons), 'BUDGET', 'too many wagons');
  const keys: J = {};
  for (let i = 0; i <= LIMITS.maxObjectKeys; i++) keys['k' + i] = 1;
  expectReject(withState((s) => { s.ledger.stallSeconds = keys; }), 'BUDGET', 'too many keys');
  expectReject(withState((s) => { s.mapId = 'v'.repeat(LIMITS.maxStringLen + 1); }), 'BUDGET', 'long string');
  assert(Date.now() - t0 < 3000, 'budget checks are fast');
});

test('roads / traffic must have exactly W*H cells for the map', () => {
  expectReject(withState((s) => { s.roads = s.roads.slice(1); }), 'OUT_OF_RANGE', 'short roads');
  expectReject(withState((s) => { s.traffic = [...s.traffic, 0]; }), 'OUT_OF_RANGE', 'long traffic');
  expectReject(withState((s) => { s.roads[5] = 3; }), 'OUT_OF_RANGE', 'unknown surface');
  expectReject(withState((s) => { s.traffic[5] = -1; }), 'OUT_OF_RANGE', 'negative traffic');
});

test('deep nesting is refused without blowing the stack (objects and JSON text)', () => {
  let deep: J = {};
  const root = deep;
  for (let i = 0; i < 100_000; i++) { const n: J = {}; deep.x = n; deep = n; }
  expectReject(patched(['mission', 'extra'], root), 'TOO_DEEP', 'deep object');
  const text = '['.repeat(50_000) + ']'.repeat(50_000);
  const r = parseSave(text);
  assert(!r.ok && (r.errors[0]!.code === 'TOO_DEEP' || r.errors[0]!.code === 'BAD_JSON' || r.errors[0]!.code === 'BAD_ENVELOPE'), 'deep JSON text refused');
  // cycles end up as TOO_DEEP too
  const cyc: J = { format: 2 };
  cyc.self = cyc;
  expectReject(gateEnvelope(cyc), 'TOO_DEEP', 'cyclic object');
});

// --- types, ranges, references -------------------------------------------------------------------

test('NaN / Infinity are refused (objects passed directly and 1e999 in JSON)', () => {
  expectReject(withState((s) => { s.coins = NaN; }), 'BAD_TYPE', 'NaN coins');
  expectReject(withState((s) => { s.tick = Infinity; }), 'BAD_TYPE', 'Infinity tick');
  expectReject(withState((s) => { s.wagons[0].edgeT = -Infinity; }), 'BAD_TYPE', '-Infinity edgeT');
  const json = JSON.stringify(BASE_ENV).replace(/"coins":[0-9.]+/, '"coins":1e999');
  assert(json.includes('1e999'), 'vector built');
  expectReject(parseSave(json), 'BAD_TYPE', '1e999 coins');
});

test('negative stock / coins / tick and non-integers are refused', () => {
  expectReject(withState((s) => { s.buildings[0].stock.wood = -1; }), 'OUT_OF_RANGE', 'negative stock');
  expectReject(withState((s) => { s.buildings[0].stock.wood = 0.5; }), 'BAD_TYPE', 'fractional stock');
  expectReject(withState((s) => { s.coins = -5; }), 'OUT_OF_RANGE', 'negative coins');
  expectReject(withState((s) => { s.tick = -1; }), 'OUT_OF_RANGE', 'negative tick');
  expectReject(withState((s) => { s.rng = [1, 2, 3]; }), 'BAD_TYPE', 'short rng');
  expectReject(withState((s) => { s.rng[0] = 2 ** 32; }), 'OUT_OF_RANGE', 'rng word too big');
  expectReject(withState((s) => { s.buildings[0].reservedOut.wood = s.buildings[0].stock.wood + 1; }), 'INCONSISTENT', 'reserved > stock');
});

test('missing fields and wrong types are refused', () => {
  for (const k of ['tick', 'rng', 'coins', 'roads', 'traffic', 'buildings', 'wagons', 'mission', 'ledger', 'nextId', 'mapId']) {
    const r = withState((s) => { delete s[k]; });
    assert(!r.ok, `missing ${k} refused`);
  }
  expectReject(withState((s) => { s.buildings = {}; }), 'BAD_TYPE', 'buildings as object');
  expectReject(withState((s) => { s.wagons[0].job = 'x'; }), 'BAD_TYPE', 'job as string');
  expectReject(withState((s) => { delete s.wagons[0].job; }), 'BAD_TYPE', 'job missing');
  expectReject(withState((s) => { s.buildings[0].type = 'tavern'; }), 'BAD_TYPE', 'unknown building type');
  expectReject(withState((s) => { s.buildings[0].status = { k: 'HAPPY' }; }), 'BAD_TYPE', 'unknown status');
  expectReject(withState((s) => { s.wagons[0].status = { k: 'FLYING' }; }), 'BAD_TYPE', 'unknown wagon status');
  expectReject(withState((s) => { s.mission.result = 'draw'; }), 'BAD_TYPE', 'unknown result');
  expectReject(withState((s) => { s.wagons[0].cargoGood = 'gold'; }), 'BAD_TYPE', 'unknown good');
  expectReject(withState((s) => { s.mapId = 'atlantis'; }), 'UNKNOWN_MAP', 'unknown map');
  expectReject(withState((s) => { s.mapId = 'constructor'; }), 'UNKNOWN_MAP', 'prototype map id');
  expectReject(patched(['buildings', 0, 'when'], new Date(0)), 'BAD_TYPE', 'class instance');
  expectReject(patched(['buildings', 0, 'stock'], new Map()), 'BAD_TYPE', 'Map instead of object');
  expectReject(patched(['buildings', 0, 'fn'], () => 1), 'BAD_TYPE', 'function');
  expectReject(patched(['buildings', 0, 'u'], undefined), 'BAD_TYPE', 'undefined');
  expectReject(patched(['roads'], new Int32Array(96 * 72)), 'BAD_TYPE', 'typed array');
});

test('cell indexes and footprints must lie inside the map', () => {
  const N = BASE.terrain.w * BASE.terrain.h;
  expectReject(withState((s) => { s.wagons[0].at = N; }), 'OUT_OF_RANGE', 'at = W*H');
  expectReject(withState((s) => { s.wagons[0].next = -2; }), 'OUT_OF_RANGE', 'next = -2');
  expectReject(withState((s) => { s.wagons[0].dest = N + 7; }), 'OUT_OF_RANGE', 'dest');
  expectReject(withState((s) => { s.wagons[0].path = [1, 2, -5]; }), 'OUT_OF_RANGE', 'path entry');
  expectReject(withState((s) => { s.wagons[0].bridgeFrom = N; }), 'OUT_OF_RANGE', 'bridgeFrom');
  expectReject(withState((s) => { s.buildings[0].gate = N; }), 'OUT_OF_RANGE', 'gate');
  expectReject(withState((s) => { s.buildings[0].x = BASE.terrain.w - 1; }), 'OUT_OF_RANGE', 'footprint leaves map');
  expectReject(withState((s) => { s.buildings[0].w = 9; }), 'OUT_OF_RANGE', 'wrong footprint size');
  expectReject(withState((s) => { s.buildings[1].x = s.buildings[0].x; s.buildings[1].y = s.buildings[0].y; }), 'INCONSISTENT', 'overlap');
  expectReject(withState((s) => { s.buildings[0].gate += 1; }), 'INCONSISTENT', 'gate not at facing');
});

test('duplicate ids and dangling references are refused', () => {
  expectReject(withState((s) => { s.buildings[1].id = s.buildings[0].id; }), 'DUPLICATE_ID', 'building ids');
  expectReject(withState((s) => { s.wagons[0].id = s.buildings[0].id; }), 'DUPLICATE_ID', 'wagon vs building id');
  expectReject(withState((s) => { s.nextId = 1; }), 'INCONSISTENT', 'nextId behind ids');
  expectReject(withState((s) => { s.wagons[0].home = s.buildings[0].id; }), 'DANGLING_REF', 'home not a stable');
  expectReject(withState((s) => { s.wagons[0].home = 99999; }), 'DANGLING_REF', 'home missing');
  expectReject(withState((s) => { s.mission.contract.castle = 99999; }), 'DANGLING_REF', 'contract castle');
  expectReject(withState((s) => {
    const w = s.wagons[0];
    w.cargoQty = 0; w.cargoGood = null;
    w.job = { id: 1, good: 'wood', qty: 1, from: 99999, to: -1, phase: 'pickup' };
  }), 'DANGLING_REF', 'pickup from missing building');
  expectReject(withState((s) => {
    const w = s.wagons.find((q: J) => q.job);
    w.job.to = s.wagons[0].id;
  }), 'DANGLING_REF', 'job to a wagon');
});

test('conservation / reservation mismatches are refused via checkInvariants', () => {
  // +1 wood out of nowhere passes every field check but breaks conservation
  expectReject(withState((s) => { s.buildings[0].stock.wood += 1; }), 'INCONSISTENT', 'goods created');
  expectReject(withState((s) => { s.buildings[0].incoming.planks += 3; }), 'INCONSISTENT', 'phantom incoming');
});

test('prototype-pollution keys are refused and pollute nothing', () => {
  const json = JSON.stringify(BASE_ENV).replace('"mission":{', '"mission":{"__proto__":{"polluted":true},');
  expectReject(parseSave(json), 'FORBIDDEN_KEY', '__proto__ in JSON');
  const json2 = JSON.stringify(BASE_ENV).replace('"ledger":{', '"ledger":{"constructor":{"prototype":{"polluted":true}},');
  expectReject(parseSave(json2), 'FORBIDDEN_KEY', 'constructor in JSON');
  expectReject(parseSave('{"__proto__":{"polluted":true},"format":2}'), 'FORBIDDEN_KEY', 'top-level __proto__');
  assert(({} as J).polluted === undefined, 'Object.prototype not polluted');
  assert((Object.prototype as J).polluted === undefined, 'Object.prototype clean');
});

// --- envelope ------------------------------------------------------------------------------------

test('envelope: format / version checks; newer saves are refused without touching the object', () => {
  const newer = deepFreeze({ ...clone(BASE_ENV), stateVersion: STATE_VERSION + 1 });
  const before = JSON.stringify(newer);
  expectReject(gateEnvelope(newer), 'NEWER_VERSION', 'newer state');
  eq(JSON.stringify(newer), before, 'newer envelope untouched');
  expectReject(gate({ ...clone(BASE_ENV), format: 3 }), 'UNSUPPORTED_FORMAT', 'format 3');
  expectReject(gate({ ...clone(BASE_ENV), stateVersion: 0 }), 'BAD_VERSION', 'version 0');
  expectReject(gate({ ...clone(BASE_ENV), stateVersion: 1.5 }), 'BAD_VERSION', 'version 1.5');
  expectReject(gate({ ...clone(BASE_ENV), stateVersion: 1 }), 'INCONSISTENT', 'envelope/state version mismatch');
  expectReject(gate({ ...clone(BASE_ENV), terrainHash: 42 }), 'BAD_ENVELOPE', 'bad terrain hash');
  expectReject(gate({ ...clone(BASE_ENV), slot: null }), 'BAD_ENVELOPE', 'bad slot');
  const noState = clone(BASE_ENV) as J;
  delete noState.state;
  expectReject(gate(noState), 'BAD_ENVELOPE', 'no state');
  expectReject(gateState(clone(BASE_ENV.state), STATE_VERSION + 1), 'NEWER_VERSION', 'gateState newer');
});

test('old format-1 envelope with a v1 state upgrades (trust-on-first-load) and migrates', () => {
  const s = clone(BASE_ENV.state) as J;
  s.version = 1;
  delete s.ledger.stallSeconds;
  const v1 = deepFreeze({ format: 1, stateVersion: 1, slot: 'auto', savedAt: 1, missionId: 'm1', tick: s.tick, state: s });
  const before = JSON.stringify(v1);
  const r = prepareLoad(v1);
  expectOk(r, 'v1 envelope');
  eq(JSON.stringify(v1), before, 'v1 envelope untouched');
  if (r.ok) {
    eq(r.envelope.format, 2, 'upgraded format');
    eq(r.envelope.terrainHash, terrainHash(terrainFor('valley1', 1301)), 'terrain hash computed on load');
    const st = migrate(r.envelope).state;
    eq(st.version, STATE_VERSION, 'migrated to current');
    assert(st.ledger.stallSeconds && typeof st.ledger.stallSeconds === 'object', 'stallSeconds added');
    const w = worldFromState(clone(st));
    for (let i = 0; i < 50; i++) step(w);
    eq(checkInvariants(w).length, 0, 'runs after migration');
  }
  // v2 state requires stallSeconds
  expectReject(withState((st) => { delete st.ledger.stallSeconds; }), 'BAD_TYPE', 'v2 without stallSeconds');
});

test('terrain hash mismatch is reported as TERRAIN_CHANGED', () => {
  const env = { ...clone(BASE_ENV), terrainHash: 't1-0000000000000000' };
  const r = prepareLoad(deepFreeze(env));
  expectReject(r, 'TERRAIN_CHANGED', 'terrain changed');
  if (!r.ok) {
    const e = new SaveError(r.errors);
    eq(e.code, 'TERRAIN_CHANGED', 'SaveError.code');
    assert(e instanceof Error && e.message.includes('TERRAIN_CHANGED'), 'readable message');
  }
  expectOk(prepareLoad(BASE_ENV), 'matching hash');
});

test('gate never throws on hostile non-JSON values', () => {
  const throwing = { get format(): number { throw new Error('boom'); } };
  const proxy = new Proxy({}, { ownKeys() { throw new Error('trap'); }, get() { throw new Error('trap'); } });
  const values: unknown[] = [null, undefined, 0, -1, 'x', true, [], {}, () => 1, Symbol('s'), 10n, throwing, proxy,
    { format: 2, stateVersion: 2, state: null }, { format: 2, stateVersion: 2, slot: 'a', savedAt: 0, missionId: 'm1', tick: 0, terrainHash: 't1-0000000000000000', state: [] }];
  for (const v of values) {
    let r: ReturnType<typeof prepareLoad> | null = null;
    try { r = prepareLoad(v); } catch (e) { assert(false, `prepareLoad threw on ${typeof v}: ${String(e)}`); }
    assert(r && !r.ok && r.errors.length > 0, `refused ${typeof v}`);
  }
});

// --- fuzz ----------------------------------------------------------------------------------------

/** mulberry32: test-only seeded generator. */
function rngOf(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function leaves(v: unknown, path: (string | number)[], out: (string | number)[][], skipBig: boolean): void {
  if (Array.isArray(v)) {
    if (skipBig && v.length > 500) { out.push([...path, Math.floor(v.length / 2)]); return; }
    v.forEach((x, i) => leaves(x, [...path, i], out, skipBig));
    if (v.length === 0) out.push(path);
  } else if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) leaves((v as J)[k], [...path, k], out, skipBig);
  } else out.push(path);
}

test('fuzz: seeded (600, SAVE_FUZZ_RUNS=N for more) field mutations never crash the gate; accepted saves run 50 ticks cleanly', () => {
  const bases: SaveEnvelope[] = [BASE_ENV];
  for (const id of ['m2', 'm3']) {
    const w = createWorld(id);
    for (let i = 0; i < 700; i++) step(w);
    bases.push(envOf(w));
  }
  const rnd = rngOf(20261101);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
  const failures: string[] = [];
  let accepted = 0;
  const RUNS = Number(process.env.SAVE_FUZZ_RUNS ?? 600);
  for (let run = 0; run < RUNS; run++) {
    const base = pick(bases);
    const env = clone(base) as J;
    const paths: (string | number)[][] = [];
    leaves(env, [], paths, true);
    const nMut = 1 + Math.floor(rnd() * 2);
    const desc: string[] = [];
    for (let m = 0; m < nMut; m++) {
      const p = pick(paths);
      if (p.length === 0) continue;
      let parent: J = env;
      for (let i = 0; i < p.length - 1; i++) parent = parent?.[p[i] as string];
      if (!parent || typeof parent !== 'object') continue;
      const key = p[p.length - 1]!;
      const cur = parent[key as string];
      const ids = (env.state?.buildings ?? []).map((b: J) => b.id).concat((env.state?.wagons ?? []).map((w: J) => w.id));
      const N = 96 * 72;
      const choices: unknown[] = [
        -1, 0, 1, 2, 3, 6, 7, N - 1, N, 2 ** 31, -(2 ** 31), 0.5, 1e300, NaN, Infinity, null, true, 'x', 'wood', 'IDLE',
        [], {}, typeof cur === 'number' ? cur + 1 : 0, typeof cur === 'number' ? cur - 1 : 0, pick(ids.length ? ids : [1]),
      ];
      const r = rnd();
      if (r < 0.1 && !Array.isArray(parent)) { delete (parent as J)[key as string]; desc.push(`delete ${p.join('.')}`); }
      else { const v = pick(choices); (parent as J)[key as string] = v; desc.push(`${p.join('.')}=${String(v)}`); }
    }
    let res: ReturnType<typeof prepareLoad>;
    try {
      res = prepareLoad(env);
    } catch (e) {
      failures.push(`run ${run} gate threw: ${String(e)} [${desc.join(', ')}]`);
      continue;
    }
    if (!res.ok) {
      if (res.errors.some((e) => e.code === 'INTERNAL')) failures.push(`run ${run} INTERNAL: ${res.errors[0]!.detail} [${desc.join(', ')}]`);
      continue;
    }
    accepted++;
    try {
      const st = migrate(res.envelope).state as SimState;
      const w = worldFromState(clone(st));
      for (let t = 0; t < 50; t++) {
        step(w);
        const inv = checkInvariants(w);
        if (inv.length) { failures.push(`run ${run} accepted but invariants broke at +${t}: ${inv[0]} [${desc.join(', ')}]`); break; }
      }
    } catch (e) {
      failures.push(`run ${run} accepted but sim threw: ${String(e).slice(0, 160)} [${desc.join(', ')}]`);
    }
  }
  assert(failures.length === 0, `${failures.length} fuzz failures:\n${failures.slice(0, 8).join('\n')}`);
  if (process.env.FUZZ_DEBUG) console.log("accepted", accepted);
  assert(accepted >= RUNS / 20, `fuzz should accept some harmless mutations (accepted ${accepted})`);
});

test('every error code maps to an existing player-facing i18n key', async () => {
  const { pl } = await import('../src/i18n/pl');
  const { en } = await import('../src/i18n/en');
  const codes: SaveErrorCode[] = ['TOO_LARGE', 'BAD_JSON', 'TOO_DEEP', 'BUDGET', 'FORBIDDEN_KEY', 'BAD_ENVELOPE', 'UNSUPPORTED_FORMAT',
    'BAD_VERSION', 'NEWER_VERSION', 'UNKNOWN_MAP', 'BAD_TYPE', 'OUT_OF_RANGE', 'DUPLICATE_ID', 'DANGLING_REF', 'INCONSISTENT',
    'TERRAIN_CHANGED', 'NO_MIGRATION', 'INTERNAL'];
  for (const c of codes) {
    const k = saveErrorMessageKey(c);
    assert(k in pl && k in en, `${c} -> ${k} exists in pl and en`);
  }
  eq(saveErrorMessageKey('TERRAIN_CHANGED'), 'menu.saveTerrain', 'terrain key');
  eq(saveErrorMessageKey('NEWER_VERSION'), 'menu.saveNewer', 'newer key');
});
