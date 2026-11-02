// State v7 (D-44): wagon fleet numbers `Wagon.n` (1..N in purchase order, never reused) and
// `nextWagonN`. The fixture is a real v6 save written by the pre-v7 build (commit 32eaa94): mission II
// after buying 3 wagons and selling the first starting one (ids 12..20, a gap at 11), 150 s in, with
// grain and wood on wagons.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  STATE_VERSION, applyCommand, checkInvariants, createWorld, deserialize, serialize, stateHash, step,
} from '../src/sim/index';
import { migrate } from '../src/platform/save';
import { gateEnvelope, makeEnvelope, parseSave } from '../src/platform/saveGate';
import { assert, eq, test } from './harness';

const FIXTURE = readFileSync(fileURLToPath(new URL('./fixtures/save-v6-m2-sold-wagon.json', import.meta.url)), 'utf8');

function loadFixture() {
  const parsed = parseSave(FIXTURE);
  assert(parsed.ok, 'v6 fixture passes the gate: ' + (parsed.ok ? '' : parsed.errors.map((e) => e.code + '@' + e.path + ' ' + e.detail).join('; ')));
  if (!parsed.ok) throw new Error('unreachable');
  eq(parsed.envelope.stateVersion, 6, 'fixture is a v6 save');
  return migrate(parsed.envelope);
}

test('save v6 -> v7: wagons get fleet numbers 1..N in id order, the counter N + 1, goods conserved', () => {
  const raw = JSON.parse(FIXTURE) as { state: { wagons: { id: number; n?: number; cargoQty: number }[]; nextWagonN?: number } };
  assert(raw.state.wagons.every((w) => w.n === undefined) && raw.state.nextWagonN === undefined, 'fixture has no fleet numbers');
  const ids = raw.state.wagons.map((w) => w.id);
  const env = loadFixture();
  eq(env.stateVersion, STATE_VERSION, 'migrated to the current version');
  eq(STATE_VERSION, 7, 'current state version');
  const w = deserialize(JSON.stringify(env.state));
  const byId = [...w.state.wagons].sort((a, b) => a.id - b.id);
  eq(byId.map((q) => q.n).join(','), byId.map((_, i) => i + 1).join(','), 'numbers 1..N in id order');
  eq(w.state.wagons.map((q) => q.id).join(','), ids.join(','), 'wagon order and ids kept');
  eq(w.state.nextWagonN, ids.length + 1, 'counter after the last number');
  eq(checkInvariants(w).join('; '), '', 'conservation and fleet invariants after migration');
  assert(w.state.wagons.some((q) => q.cargoQty > 0), 'cargo on wagons survived');
  // key order of a fresh v7 state (the hash is taken over JSON.stringify)
  const fresh = createWorld('m2');
  eq(Object.keys(w.state).join(','), Object.keys(fresh.state).join(','), 'state key order');
  eq(Object.keys(w.state.wagons[0]!).join(','), Object.keys(fresh.state.wagons[0]!).join(','), 'wagon key order');
  // the migrated save is a valid v7 save and round trips exactly
  const again = parseSave(JSON.stringify(makeEnvelope('m2', w.state, 0)));
  assert(again.ok, 'migrated state passes the v7 gate');
  if (again.ok) eq(serialize(deserialize(JSON.stringify(migrate(again.envelope).state))), serialize(w), 'v7 round trip');
});

test('save v7: numbers are stable, new wagons continue the count, a sold number is not reused', () => {
  const w = deserialize(JSON.stringify(loadFixture().state));
  const n0 = w.state.nextWagonN;
  const stable = w.state.buildings.find((b) => b.type === 'stable')!.id;
  const before = new Map(w.state.wagons.map((q) => [q.id, q.n]));
  for (let i = 0; i < 600; i++) step(w);
  for (const q of w.state.wagons) eq(q.n, before.get(q.id), `wagon ${q.id} keeps its number`);
  w.state.coins += 100;
  assert(applyCommand(w, { t: 'buyWagon', stable }).ok, 'buy');
  const bought = w.state.wagons[w.state.wagons.length - 1]!;
  eq(bought.n, n0, 'next number');
  // the new wagon still stands empty in the stable: sell it, buy another
  assert(applyCommand(w, { t: 'sellWagon', wagon: bought.id }).ok, 'sell');
  assert(applyCommand(w, { t: 'buyWagon', stable }).ok, 'buy after sell');
  const nw = w.state.wagons[w.state.wagons.length - 1]!;
  eq(nw.n, n0 + 1, `sold number ${n0} not reused`);
  eq(checkInvariants(w).join('; '), '', 'invariants');
  // save/load continuation stays bit-identical
  const loaded = deserialize(serialize(w));
  for (let i = 0; i < 1500; i++) { step(w); step(loaded); }
  eq(stateHash(loaded), stateHash(w), 'continuation hash');
});

test('save gate v7: missing, duplicate or out-of-range fleet numbers are rejected', () => {
  const w = createWorld('m2');
  const stable = w.state.buildings.find((b) => b.type === 'stable')!.id;
  applyCommand(w, { t: 'buyWagon', stable });
  for (let i = 0; i < 100; i++) step(w);
  const ok = makeEnvelope('m2', w.state, 0);
  assert(gateEnvelope(ok).ok, 'valid v7 save');
  const bad = (f: (s: { wagons: { n?: number }[]; nextWagonN?: number }) => void, what: string) => {
    const env = JSON.parse(JSON.stringify(ok));
    f(env.state);
    assert(!gateEnvelope(env).ok, what + ' rejected');
  };
  bad((s) => { delete s.wagons[0]!.n; }, 'missing n');
  bad((s) => { s.wagons[1]!.n = s.wagons[0]!.n; }, 'duplicate n');
  bad((s) => { s.wagons[0]!.n = s.nextWagonN; }, 'n >= nextWagonN');
  bad((s) => { delete s.nextWagonN; }, 'missing nextWagonN');
});
