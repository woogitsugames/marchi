// Save robustness on fake-indexeddb (research 2026-11-02, docs/research/2026-11-02-save-robustness.md):
// migration chains through the real IDB layer incl. the legacy 'auto' slot, v1 -> v2 upgrade, damaged /
// future envelopes, concurrent saves, a dead cached connection, round trips in missions m1/m5/m9/m12/sandbox.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  adoptLegacySaves, contractSlot, deleteSave, listSaves, loadGame, readSlots, resetSaveConnection, saveGame, verifySave,
  SaveError,
} from '../src/platform/save';
import { makeEnvelope } from '../src/platform/saveGate';
import { GOODS_V4, RANKS_V4, STATE_VERSION, applyCommand, checkInvariants, createWorld, stateHash, step, worldFromState, type World } from '../src/sim/index';
import { generateScenario } from '../tools/fuzz-lib';
import { freshValleyEvents } from '../src/sim/events';
import { assert, eq, test } from './harness';

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function freshDb(): void {
  resetSaveConnection();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
}

/** Writes records straight into `saves` (no meta), as an old build or a damaged disk would leave them. */
function rawPut(...recs: unknown[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open('marchia');
    rq.onupgradeneeded = () => {
      const d = rq.result;
      if (!d.objectStoreNames.contains('saves')) d.createObjectStore('saves', { keyPath: 'slot' });
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'slot' });
    };
    rq.onsuccess = () => {
      const d = rq.result, t = d.transaction('saves', 'readwrite');
      for (const r of recs) t.objectStore('saves').put(r);
      t.oncomplete = () => { d.close(); resolve(); };
      t.onerror = () => reject(t.error);
    };
    rq.onerror = () => reject(rq.error);
  });
}

function rawGet(slot: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open('marchia');
    rq.onsuccess = () => {
      const d = rq.result, g = d.transaction('saves').objectStore('saves').get(slot);
      g.onsuccess = () => { d.close(); resolve(g.result); };
      g.onerror = () => reject(g.error);
    };
  });
}

function mid(id: string, ticks: number): World {
  const w = createWorld(id);
  for (let i = 0; i < ticks; i++) step(w);
  return w;
}

const v4goods = (m: J): J => Object.fromEntries(GOODS_V4.map((g) => [g, m[g]]));

/** The current state as an older schema (same as tests/save-chain.test.ts, extended with v6). */
function downgrade(cur: J, to: 4 | 5 | 6): J {
  const s = JSON.parse(JSON.stringify(cur)) as J;
  s.version = to;
  delete s.valleyEvents; // state v8 (D-54)
  delete s.nextWagonN;
  for (const w of s.wagons) delete w.n;
  if (to === 6) return s;
  delete s.mission.roadStone;
  if (to === 5) return s;
  for (const b of s.buildings) for (const k of ['stock', 'reservedOut', 'incoming']) b[k] = v4goods(b[k]);
  for (const k of ['produced', 'consumed', 'destroyed', 'sold']) s.ledger[k] = v4goods(s.ledger[k]);
  if (s.mission.contract) {
    s.mission.contract.need = v4goods(s.mission.contract.need);
    for (const t of s.mission.contract.tranches) t.need = v4goods(t.need);
  }
  s.market.saturation = v4goods(s.market.saturation);
  s.town.rankTicks = s.town.rankTicks.slice(0, RANKS_V4);
  return s;
}

function oldEnvelope(slot: string, w: World, to: 4 | 5 | 6, savedAt: number): J {
  const env = JSON.parse(JSON.stringify(makeEnvelope(slot, w.state, savedAt))) as J;
  env.state = downgrade(env.state, to);
  env.stateVersion = to;
  return env;
}

async function failCode(p: Promise<unknown>): Promise<string> {
  try { await p; return 'no error'; } catch (e) { return e instanceof SaveError ? e.errors[0]!.code : 'raw:' + String(e); }
}

// (1) chains from v4/v5/v6 through IDB, legacy 'auto' slot ------------------------------------------

for (const from of [4, 5, 6] as const) {
  for (const id of ['m2', 'm5', 'sandbox']) {
    test(`robust: v${from} ${id} in the legacy 'auto' slot is adopted, migrated to v${STATE_VERSION} and continues identically`, async () => {
      freshDb();
      const w = mid(id, 1500);
      await rawPut(oldEnvelope('auto', w, from, 111));
      // an old save had no valley events: the migration starts them empty (D-54), so does the reference
      if (w.state.valleyEvents) w.state.valleyEvents = freshValleyEvents();
      await adoptLegacySaves();
      const want = id === 'sandbox' ? 'valley1' : contractSlot(id);
      const list = await listSaves();
      eq(list.map((x) => x.slot).join(','), want, 'moved, auto gone, meta consistent');
      eq(list[0]!.stateVersion, from, 'the envelope is moved as it was (migrated on load)');
      const st = (await loadGame(want))!;
      eq(st.version, STATE_VERSION, 'migrated');
      const b = worldFromState(st);
      eq(checkInvariants(b).length, 0, 'invariants after load');
      for (let i = 0; i < 400; i++) { step(w); step(b); }
      eq(stateHash(b), stateHash(w), 'continuation equals the uninterrupted run');
      await saveGame(want, b.state); // next autosave rewrites at the current version
      eq((await listSaves())[0]!.stateVersion, STATE_VERSION, 'resaved as current');
    });
  }
}

test('robust: the real v6 fixture loads from IDB, and the legacy slot with a valley game goes to the first free ledger', async () => {
  freshDb();
  const fx = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/save-v6-m2-sold-wagon.json', import.meta.url)), 'utf8')) as J;
  await rawPut({ ...fx, slot: 'auto' });
  await saveGame('valley1', mid('sandbox', 100).state);
  await adoptLegacySaves();
  eq((await listSaves()).map((x) => x.slot).sort().join(','), ['auto-m2', 'valley1'].join(','), 'fixture is a contract: own slot');
  const st = (await loadGame('auto-m2'))!;
  eq(st.version, STATE_VERSION, 'fixture migrated');
  await deleteSave('auto-m2');
  await rawPut(oldEnvelope('auto', mid('sandbox', 50), 5, 7));
  await adoptLegacySaves();
  assert((await listSaves()).some((x) => x.slot === 'valley2'), 'valley game -> valley2 (valley1 taken)');
  await rawPut(oldEnvelope('auto', mid('sandbox', 60), 6, 8));
  await saveGame('valley3', mid('sandbox', 10).state);
  await adoptLegacySaves();
  assert((await rawGet('auto')) !== undefined, 'all ledgers taken: the legacy slot is kept, nothing lost');
});

// (2) DB upgrade v1 -> v2 ------------------------------------------------------------------------

test('robust: v1 -> v2 upgrade backfills meta for every record and listSaves sorts newest first', async () => {
  freshDb();
  const a = makeEnvelope('auto-m1', mid('m1', 50).state, 300);
  const b = makeEnvelope('valley2', mid('sandbox', 50).state, 900);
  await new Promise<void>((resolve, reject) => {
    const rq = indexedDB.open('marchia', 1);
    rq.onupgradeneeded = () => { rq.result.createObjectStore('saves', { keyPath: 'slot' }); };
    rq.onsuccess = () => {
      const d = rq.result, t = d.transaction('saves', 'readwrite');
      t.objectStore('saves').put(a);
      t.objectStore('saves').put(b);
      t.oncomplete = () => { d.close(); resolve(); };
      t.onerror = () => reject(t.error);
    };
  });
  const list = await listSaves();
  eq(list.length, 2, 'both listed');
  eq(list.map((x) => x.slot).join(','), 'valley2,auto-m1', 'newest first');
  assert(list.every((x) => !('state' in x)), 'no state in meta');
  eq(JSON.stringify(list.find((x) => x.slot === 'auto-m1')), JSON.stringify((({ state: _s, ...r }) => r)(a)), 'meta = envelope minus state');
});

test('robust: a fresh database (v0 -> v2) creates both stores and lists nothing', async () => {
  freshDb();
  eq((await listSaves()).length, 0, 'empty');
  eq(await loadGame('auto-m1'), null, 'no slot');
  eq((await readSlots()).length, 0, 'no summaries');
});

// (5) damaged / wrong / future envelopes -----------------------------------------------------------

test('robust: damaged, wrong-version and newer envelopes give a SaveError code, never a crash, and stay untouched', async () => {
  freshDb();
  const w = mid('m3', 200);
  const good = JSON.parse(JSON.stringify(makeEnvelope('x', w.state, 5))) as J;
  const mk = (slot: string, f: (e: J) => void): J => { const e = JSON.parse(JSON.stringify(good)) as J; e.slot = slot; f(e); return e; };
  const recs = [
    mk('auto-m1', (e) => { e.stateVersion = STATE_VERSION + 1; }),
    mk('auto-m2', (e) => { e.stateVersion = 99; e.state.version = 99; }),
    mk('auto-m3', (e) => { e.stateVersion = 0; }),
    mk('auto-m4', (e) => { e.format = 3; }),
    mk('auto-m5', (e) => { delete e.state; }),
    mk('auto-m6', (e) => { e.state.coins = -1; }),
    mk('auto-m7', (e) => { e.terrainHash = 't1-0000000000000000'; }),
    mk('auto-m8', (e) => { e.state.version = 4; }), // envelope says 7, state says 4
    mk('auto-m9', (e) => { e.state = 'garbage'; }),
    { slot: 'valley1', format: 2 },
    { slot: 'valley2', x: 1 },
  ];
  const frozen = recs.map((r) => JSON.stringify(r));
  await rawPut(...recs);
  const want: Record<string, string> = {
    'auto-m1': 'NEWER_VERSION', 'auto-m2': 'NEWER_VERSION', 'auto-m3': 'BAD_VERSION', 'auto-m4': 'UNSUPPORTED_FORMAT',
    'auto-m5': 'BAD_ENVELOPE', 'auto-m7': 'TERRAIN_CHANGED', 'auto-m8': 'INCONSISTENT', valley1: 'BAD_VERSION', valley2: 'UNSUPPORTED_FORMAT',
  };
  for (const [slot, code] of Object.entries(want)) {
    eq(await failCode(loadGame(slot)), code, slot + ' loadGame');
    eq((await verifySave(slot))?.errors[0]?.code, code, slot + ' verifySave');
  }
  assert((await failCode(loadGame('auto-m6'))) !== 'no error', 'negative coins refused');
  assert((await failCode(loadGame('auto-m9'))) !== 'no error', 'string state refused');
  const sums = await readSlots();
  eq(sums.length, recs.length, 'readSlots lists every record, damaged ones with a code');
  for (let i = 0; i < recs.length; i++) eq(JSON.stringify(await rawGet(recs[i]!.slot)), frozen[i]!, recs[i]!.slot + ' original untouched');
});

// (4) concurrency + connection ---------------------------------------------------------------------

test('robust: autosave and manual save in flight together: the later call wins, meta equals state', async () => {
  freshDb();
  const w = mid('m1', 100);
  const p1 = saveGame('auto-m1', w.state); // first save of the page: the database is still opening
  for (let i = 0; i < 10; i++) step(w);
  const p2 = saveGame('auto-m1', w.state);
  for (let i = 0; i < 10; i++) step(w);
  const p3 = saveGame('auto-m1', w.state);
  await Promise.all([p1, p2, p3]);
  const st = (await loadGame('auto-m1'))!;
  eq(st.tick, 120, 'state of the last call');
  eq((await listSaves())[0]!.tick, 120, 'meta of the same save');
  const rest = [saveGame('valley1', w.state), saveGame('auto-m1', w.state), listSaves(), saveGame('valley1', w.state)];
  await Promise.all(rest);
  eq((await listSaves()).length, 2, 'two slots');
});

test('robust: a connection closed behind our back is reopened (one retry) and saving goes on', async () => {
  freshDb();
  let cap: IDBDatabase | null = null;
  const f = indexedDB.open.bind(indexedDB);
  indexedDB.open = ((n: string, v?: number) => { const q = f(n, v); q.addEventListener('success', () => { cap = q.result; }); return q; }) as typeof f;
  try {
    const w = mid('m1', 30);
    await saveGame('auto-m1', w.state);
    cap!.close();
    step(w);
    await saveGame('auto-m1', w.state);
    eq((await loadGame('auto-m1'))!.tick, 31, 'second save after close landed');
  } finally { indexedDB.open = f; }
});

test('robust: a versionchange from another tab closes the cached connection instead of blocking it', async () => {
  freshDb();
  const w = mid('m1', 30);
  await saveGame('auto-m1', w.state);
  let blocked = false;
  await new Promise<void>((resolve) => {
    const q = indexedDB.open('marchia', 4);
    q.onblocked = () => { blocked = true; };
    q.onsuccess = () => { q.result.close(); resolve(); };
  });
  eq(blocked, false, 'upgrade was not blocked by our connection');
});

test('robust: a database newer than this build (v4) still lists, loads and saves (B6)', async () => {
  freshDb();
  const w = mid('m1', 30);
  await saveGame('auto-m1', w.state);
  resetSaveConnection();
  await new Promise<void>((resolve, reject) => {
    const q = indexedDB.open('marchia', 4);
    q.onsuccess = () => { q.result.close(); resolve(); };
    q.onerror = () => reject(q.error);
  });
  resetSaveConnection();
  eq((await listSaves()).map((x) => x.slot).join(','), 'auto-m1', 'listed from the v4 database');
  const st = await loadGame('auto-m1');
  eq(st?.tick, w.state.tick, 'loaded');
  const w2 = mid('m5', 20);
  await saveGame('auto-m5', w2.state);
  eq((await listSaves()).length, 2, 'saved into the v4 database');
});

// (6) round-trip determinism ------------------------------------------------------------------------

for (const id of ['m1', 'm5', 'm9', 'm12', 'sandbox']) {
  test(`robust: ${id}: save to IDB at seeded random ticks, load, continue = uninterrupted run (hash)`, async () => {
    freshDb();
    const total = 2400;
    const sc = generateScenario(1000 + id.length * 7 + id.charCodeAt(id.length - 1), { ticks: total, minCmds: 15, maxCmds: 40, missions: [id] });
    eq(sc.mission, id, 'scenario mission');
    const cmds = [...sc.commands].sort((a, b) => a.tick - b.tick);
    const mk = (): World => { const w = createWorld(id); if (sc.coins !== null) w.state.coins = sc.coins; return w; };
    const ref = mk(), cur = mk();
    const play = (w: World, i: { n: number }) => {
      while (i.n < cmds.length && cmds[i.n]!.tick === w.state.tick) { applyCommand(w, cmds[i.n]!.cmd); i.n++; }
      step(w);
    };
    const rI = { n: 0 }, cI = { n: 0 };
    // seeded saves points
    let seed = 12345 + id.length;
    const rnd = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };
    const points = new Set<number>([1 + (rnd() % 400), 500 + (rnd() % 600), 1200 + (rnd() % 1000)]);
    let live: World = cur;
    for (let t = 0; t < total; t++) {
      play(ref, rI);
      if (points.has(t)) {
        const slot = id === 'sandbox' ? 'valley1' : contractSlot(id);
        await saveGame(slot, live.state);
        const st = (await loadGame(slot))!;
        live = worldFromState(st);
      }
      play(live, cI);
    }
    eq(stateHash(live), stateHash(ref), 'final hash equals uninterrupted run');
    eq(checkInvariants(live).length, 0, 'invariants');
  });
}

// --- regressions for the bugs found by the robustness research (fixed in save.ts) ------------------------

test('B1: a newer-version legacy auto save never replaces a playable per-mission save', async () => {
  freshDb();
  const w3 = createWorld('m3');
  for (let i = 0; i < 100; i++) step(w3);
  await saveGame(contractSlot('m3'), w3.state);
  const w = createWorld('m3');
  await rawPut({ ...makeEnvelope('auto', w.state, Date.now() + 9999), stateVersion: STATE_VERSION + 1 });
  await adoptLegacySaves();
  const back = await loadGame(contractSlot('m3'));
  assert(back !== null, 'good per-mission save kept');
  eq(stateHash(worldFromState(back!)), stateHash(w3), 'it is still the good game');
});

test('B3: a state put that throws after the meta put commits nothing (no orphan meta)', async () => {
  freshDb();
  const w = createWorld('m5');
  const proto = IDBObjectStore.prototype as unknown as { put: (v: unknown, k?: unknown) => IDBRequest };
  const orig = proto.put;
  proto.put = function (this: IDBObjectStore, v: unknown, k?: unknown) {
    if (this.name === 'saves') throw new DOMException('boom', 'DataCloneError');
    return orig.call(this, v, k);
  };
  try { await saveGame(contractSlot('m5'), w.state).catch(() => undefined); } finally { proto.put = orig; }
  eq((await listSaves()).map((x) => x.slot).join(','), '', 'no metadata without a state');
  eq(await loadGame(contractSlot('m5')), null, 'and no state');
});
