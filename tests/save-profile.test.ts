// Day 1 save envelope extension (owner decisions 1 + 13): the valley chronicle travels in the ledger's
// envelope (not in the state: hashes unchanged) and the best seals + time per contract live in a `profile`
// store. Old saves / databases / profiles without the fields keep working.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  contractSlot, listSaves, loadGame, loadSave, readProfile, recordContractResult, resetSaveConnection, saveGame,
} from '../src/platform/save';
import { envelopeChronicle, emptyProfile, isBetter, recordBest, sanitizeProfile } from '../src/platform/profile';
import { makeEnvelope, prepareLoad } from '../src/platform/saveGate';
import { createWorld, stateHash, step, worldFromState } from '../src/sim/index';
import { ChronicleLog } from '../src/ui/chronicleLog';
import { assert, eq, test } from './harness';

function freshDb(): void {
  resetSaveConnection();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
}

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => { m.set(k, String(v)); },
  };
}

test('profile: sanitize drops damaged entries; better = more seals, then less time; only wins count', () => {
  eq(JSON.stringify(sanitizeProfile(undefined)), JSON.stringify(emptyProfile()), 'no record -> empty');
  eq(JSON.stringify(sanitizeProfile({ best: 'x' })), JSON.stringify(emptyProfile()), 'bad best -> empty');
  const p = sanitizeProfile({
    format: 9, best: {
      m1: { seals: 2, ticks: 3000, at: 5 }, m2: { seals: 4, ticks: 10 }, m3: { seals: 1, ticks: -1 },
      sandbox: { seals: 3, ticks: 1 }, m4: { seals: 3, ticks: 900 },
    },
  });
  eq(Object.keys(p.best).sort().join(','), 'm1,m4', 'valid entries kept, newer format readable');
  assert(isBetter({ seals: 3, ticks: 9999 }, { seals: 2, ticks: 1 }), 'more seals wins');
  assert(isBetter({ seals: 2, ticks: 100 }, { seals: 2, ticks: 200 }), 'same seals, faster wins');
  assert(!isBetter({ seals: 2, ticks: 200 }, { seals: 2, ticks: 200 }), 'equal is not better');
  const r1 = recordBest(p, 'm1', 2, 2500, 7);
  assert(r1.improved && r1.profile.best.m1!.ticks === 2500, 'faster two seals recorded');
  eq(p.best.m1!.ticks, 3000, 'input not changed');
  eq(recordBest(p, 'm1', 1, 100, 7).improved, false, 'fewer seals never replaces');
  eq(recordBest(p, 'm5', 0, 100, 7).improved, false, 'a lost contract (0 seals) is not a result');
});

test('envelope chronicle: optional field, read leniently; contracts and old envelopes carry none', () => {
  const w = createWorld('sandbox');
  const old = makeEnvelope('valley1', w.state, 1);
  assert(!('chronicle' in old), 'no chronicle passed -> no field (contract envelopes unchanged)');
  eq(envelopeChronicle(old).length, 0, 'old envelope -> []');
  const env = makeEnvelope('valley1', w.state, 1, true, ['third_wagon', 'mill_turns']);
  eq(envelopeChronicle(env).join(','), 'third_wagon,mill_turns', 'ids back');
  eq(envelopeChronicle({ chronicle: ['ok_id', 7, 'Bad Id!', 'ok_id', 'x'.repeat(60)] }).join(','), 'ok_id', 'damaged items dropped');
  eq(envelopeChronicle({ chronicle: 'third_wagon' }).length, 0, 'not an array -> []');
  assert(prepareLoad(env).ok, 'the gate accepts the extended envelope');
  assert(prepareLoad({ ...env, chronicle: { a: 1 } }).ok, 'a damaged chronicle never makes the save unloadable');
});

test('save-idb: valley chronicle round trip in the envelope; state hash unchanged; meta list without it', async () => {
  freshDb();
  const w = createWorld('sandbox');
  for (let i = 0; i < 200; i++) step(w);
  await saveGame('valley2', w.state, ['third_wagon', 'planks_at_market']);
  const back = await loadSave('valley2');
  assert(back !== null, 'loaded');
  eq(back!.chronicle.join(','), 'third_wagon,planks_at_market', 'chronicle back');
  eq(stateHash(worldFromState(back!.state)), stateHash(w), 'same game, same hash');
  const meta = await listSaves();
  assert(!('chronicle' in meta[0]!), 'menu metadata carries no chronicle');
  await saveGame(contractSlot('m1'), createWorld('m1').state);
  eq((await loadSave(contractSlot('m1')))!.chronicle.length, 0, 'a contract has none');
  assert((await loadGame(contractSlot('m1'))) !== null, 'loadGame still works');
});

test('chronicle: the old localStorage list is merged on attach and dropped after a save', () => {
  const prev = (globalThis as { localStorage?: Storage }).localStorage;
  const ls = memoryStorage();
  (globalThis as { localStorage?: Storage }).localStorage = ls;
  try {
    ls.setItem('marchia.chronicle.valley1', JSON.stringify(['five_wagons']));
    const w = createWorld('sandbox');
    const log = new ChronicleLog();
    log.attach('valley1', w, ['third_wagon']);
    assert(log.done.has('five_wagons') && log.done.has('third_wagon'), 'both sources merged');
    const ids = log.ids();
    assert(ids.indexOf('third_wagon') < ids.indexOf('five_wagons'), 'CHRONICLE order');
    log.saved('valley2');
    assert(ls.getItem('marchia.chronicle.valley1') !== null, 'another ledger saved: kept');
    log.saved('valley1');
    eq(ls.getItem('marchia.chronicle.valley1'), null, 'migrated: localStorage copy dropped');
    log.check(w);
    eq(ls.getItem('marchia.chronicle.valley1'), null, 'new entries are not written to localStorage any more');
  } finally {
    (globalThis as { localStorage?: Storage }).localStorage = prev;
  }
});

test('save-idb: best result per contract in the profile store; a version-2 database gains the store', async () => {
  freshDb();
  // a day-0 database: saves + meta only, one contract save in it
  const w = createWorld('m2');
  const env = makeEnvelope(contractSlot('m2'), w.state, 99);
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('marchia', 2);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('saves', { keyPath: 'slot' }).put(env);
      const { state: _s, ...meta } = env;
      req.result.createObjectStore('meta', { keyPath: 'slot' }).put(meta);
    };
    req.onsuccess = () => { req.result.close(); resolve(); };
    req.onerror = () => reject(req.error);
  });
  eq(Object.keys((await readProfile()).best).length, 0, 'no profile yet -> empty');
  assert((await loadGame(contractSlot('m2'))) !== null, 'the old save still loads after the upgrade');
  eq(await recordContractResult('m2', 2, 4000, 1), true, 'first win recorded');
  eq(await recordContractResult('m2', 2, 4500, 2), false, 'slower: kept the old');
  eq(await recordContractResult('m2', 3, 6000, 3), true, 'more seals: new best');
  eq(await recordContractResult('m3', 0, 100, 4), false, 'lost: nothing');
  resetSaveConnection(); // a page reload
  const p = await readProfile();
  eq(JSON.stringify(p.best), JSON.stringify({ m2: { seals: 3, ticks: 6000, at: 3 } }), 'persisted');
  eq((await listSaves()).length, 1, 'the profile is not a save in the menu list');
});
