// IndexedDB layer of src/platform/save.ts on fake-indexeddb (D-44): cached connection, metadata store for
// the menu list, no JSON copy before put(), v1 -> v2 schema upgrade, legacy 'auto' adoption.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { adoptLegacySaves, contractSlot, deleteSave, listSaves, loadGame, readSlots, resetSaveConnection, saveGame } from '../src/platform/save';
import { makeEnvelope } from '../src/platform/saveGate';
import { createWorld, stateHash, step, worldFromState } from '../src/sim/index';
import { assert, eq, test } from './harness';

function freshDb(): void {
  resetSaveConnection();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
}

function countOpens(): { n: number; restore(): void } {
  const f = globalThis.indexedDB, orig = f.open.bind(f);
  const c = { n: 0, restore: () => { f.open = orig; } };
  f.open = ((name: string, v?: number) => { c.n++; return orig(name, v); }) as typeof f.open;
  return c;
}

function playing(id: string, ticks: number) {
  const w = createWorld(id);
  for (let i = 0; i < ticks; i++) step(w);
  return w;
}

test('save-idb: save, list (metadata only), load the same game, delete both records', async () => {
  freshDb();
  const w = playing('m2', 600);
  await saveGame(contractSlot('m2'), w.state);
  const list = await listSaves();
  eq(list.length, 1, 'one save');
  eq(list[0]!.slot, contractSlot('m2'), 'slot');
  eq(list[0]!.tick, 600, 'tick in the metadata');
  assert(!('state' in list[0]!), 'the list carries no game state');
  const back = await loadGame(contractSlot('m2'));
  assert(back !== null, 'loaded');
  eq(stateHash(worldFromState(back!)), stateHash(w), 'identical game');
  await deleteSave(contractSlot('m2'));
  eq((await listSaves()).length, 0, 'metadata deleted');
  eq(await loadGame(contractSlot('m2')), null, 'game deleted');
});

test('save-idb: one connection for many operations', async () => {
  freshDb();
  const c = countOpens();
  try {
    const w = playing('m1', 50);
    for (let i = 0; i < 4; i++) { step(w); await saveGame(contractSlot('m1'), w.state); }
    await listSaves();
    await loadGame(contractSlot('m1'));
    await readSlots();
    eq(c.n, 1, 'indexedDB.open calls');
  } finally { c.restore(); }
});

test('save-idb: the stored game is a copy taken at save time (structured clone, no JSON round trip)', async () => {
  freshDb();
  const w = playing('m1', 100);
  const saved = JSON.stringify(w.state);
  const p = saveGame(contractSlot('m1'), w.state);
  step(w); // the game goes on while the save completes
  await p;
  const back = await loadGame(contractSlot('m1'));
  eq(JSON.stringify(back), saved, 'state as it was when the save started');
  eq((await listSaves())[0]!.tick, 100, 'metadata of the same moment');
});

test('save-idb: a version-1 database gets the metadata store filled on upgrade', async () => {
  freshDb();
  const w = playing('m3', 300);
  const env = makeEnvelope(contractSlot('m3'), w.state, 1234);
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('marchia', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('saves', { keyPath: 'slot' }); };
    req.onsuccess = () => {
      const db = req.result, t = db.transaction('saves', 'readwrite');
      t.objectStore('saves').put(env);
      t.oncomplete = () => { db.close(); resolve(); };
      t.onerror = () => reject(t.error);
    };
    req.onerror = () => reject(req.error);
  });
  const list = await listSaves();
  eq(list.length, 1, 'old save listed after the upgrade');
  eq(list[0]!.savedAt, 1234, 'its metadata');
  assert((await loadGame(contractSlot('m3'))) !== null, 'and still loads');
});

test('save-idb: a legacy auto save moves to its contract slot with its metadata', async () => {
  freshDb();
  const w = playing('m4', 200);
  await saveGame('auto', w.state);
  await adoptLegacySaves();
  const list = await listSaves();
  eq(list.map((x) => x.slot).join(','), contractSlot('m4'), 'only the new slot listed');
  eq(stateHash(worldFromState((await loadGame(contractSlot('m4')))!)), stateHash(w), 'same game');
});

test('save-idb: with the connection open the save is taken synchronously, without any copy beforehand', async () => {
  freshDb();
  const w = playing('m1', 100);
  await saveGame(contractSlot('m1'), w.state); // opens the connection
  for (let i = 0; i < 20; i++) step(w);
  const saved = JSON.stringify(w.state);
  const p = saveGame(contractSlot('m1'), w.state);
  step(w); // same task, right after the call
  await p;
  eq(JSON.stringify(await loadGame(contractSlot('m1'))), saved, 'state at the call');
});
