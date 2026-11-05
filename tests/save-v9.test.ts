// State v9 (D-170): the free valley's trading post. The fixture is a real v8 save written by the pre-v9 build
// (tools/make-fixture-v8.ts: DECENT plan, 40 min, rank 2). The v8 -> v9 migration places the post with the sim's own
// place() on the first free site and appends the slice last; the save gate checks the slice.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  STATE_VERSION, TRADE_POST, checkInvariants, createWorld, deserialize, serialize, step, tradePostStatus,
} from '../src/sim/index';
import { migrate } from '../src/platform/save';
import { gateEnvelope, makeEnvelope, parseSave } from '../src/platform/saveGate';
import { assert, eq, test } from './harness';

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const FIXTURE = readFileSync(fileURLToPath(new URL('./fixtures/save-v8-sandbox.json', import.meta.url)), 'utf8');
const W = 96;

function migrated(edit?: (s: J) => void): { old: J; state: J } {
  const raw = JSON.parse(FIXTURE) as J;
  if (edit) edit(raw.state);
  const v = parseSave(JSON.stringify(raw));
  assert(v.ok, 'v8 fixture passes the gate: ' + (v.ok ? '' : v.errors.map((e) => `${e.code}@${e.path} ${e.detail}`).join('; ')));
  if (!v.ok) throw new Error('unreachable');
  eq(v.envelope.stateVersion, 8, 'fixture is a v8 save');
  const frozen = JSON.stringify(v.envelope);
  const out = migrate(v.envelope);
  eq(JSON.stringify(v.envelope), frozen, 'migration does not touch the loaded envelope');
  eq(out.stateVersion, STATE_VERSION, 'migrated to the current version');
  return { old: raw.state, state: out.state as unknown as J };
}

test('save v8 -> v9: a real v8 valley save gets the trading post on (37,58) with the next id, keeps running', () => {
  eq(STATE_VERSION, 9, 'current state version (v9: trading post, D-170)');
  const { old, state } = migrated();
  assert(!('tradePost' in old), 'no slice in v8');
  assert(!old.buildings.some((b: J) => b.type === 'tradePost'), 'no post in v8');
  const post = state.buildings.find((b: J) => b.type === 'tradePost');
  assert(!!post, 'post placed');
  eq(`${post.x},${post.y},${post.w}x${post.h}`, '37,58,4x4', 'first site, 4 x 4');
  eq(post.id, old.nextId, 'id = nextId before the migration');
  eq(state.nextId, old.nextId + 1, 'counter moved on');
  eq(state.netVersion, old.netVersion + 1, 'network version bumped once');
  eq(post.gate, 57 * W + 39, 'gate (39,57)');
  eq(state.roads[post.gate], 1, 'dirt road at the gate');
  eq(state.tradePost.building, post.id, 'slice names the post');
  const fresh = createWorld('sandbox');
  eq(Object.keys(state).join(','), Object.keys(fresh.state).join(','), 'key order of a fresh v9 state');
  eq(Object.keys(post).join(','), Object.keys(fresh.state.buildings.find((b) => b.type === 'tradePost')!).join(','), 'building key order');
  eq(JSON.stringify(state.tradePost), JSON.stringify({ ...fresh.state.tradePost, building: post.id }), 'fresh slice');
  const w = deserialize(JSON.stringify(state));
  eq(checkInvariants(w).join('; '), '', 'invariants after migration');
  for (let i = 0; i < 1200; i++) {
    step(w);
    if (i % 60 === 0) eq(checkInvariants(w).join('; '), '', `invariants at ${i}`);
  }
  eq(w.state.buildings.find((b) => b.type === 'tradePost')!.status.k, 'IDLE', 'closed post idles');
  // the migrated save is a valid v9 save and round trips exactly
  const again = parseSave(JSON.stringify(makeEnvelope('valley1', w.state, 0)));
  assert(again.ok, 'v9 passes the gate');
  if (again.ok) eq(serialize(deserialize(JSON.stringify(migrate(again.envelope).state))), serialize(w), 'v9 round trip');
});

test('save v8 -> v9: an occupied first site moves the post on; no free site leaves the valley without a post', () => {
  const road = (s: J, x: number, y: number) => { s.roads[y * W + x] = 1; };
  const moved = migrated((s) => road(s, 38, 59)).state;
  const p2 = moved.buildings.find((b: J) => b.type === 'tradePost');
  eq(`${p2.x},${p2.y}`, '43,58', 'second site');
  const none = migrated((s) => { for (const c of TRADE_POST.sites) road(s, c.x + 1, c.y + 1); }).state;
  assert(!none.buildings.some((b: J) => b.type === 'tradePost'), 'no post building');
  eq(none.tradePost.building, -1, 'slice with building -1');
  const w = deserialize(JSON.stringify(none));
  for (let i = 0; i < 600; i++) step(w);
  eq(checkInvariants(w).join('; '), '', 'plays on');
  eq(tradePostStatus(w), null, 'the UI shows nothing');
  assert(parseSave(JSON.stringify(makeEnvelope('valley1', w.state, 0))).ok, 'a post-less v9 save passes the gate');
});

test('save v8 -> v9: a contract save migrates without slice or post', () => {
  const w = createWorld('m2');
  for (let i = 0; i < 300; i++) step(w);
  const env = JSON.parse(JSON.stringify(makeEnvelope('m2', w.state, 0))) as J;
  env.stateVersion = 8; env.state.version = 8;
  const v = parseSave(JSON.stringify(env));
  assert(v.ok, 'v8 contract save passes the gate');
  if (!v.ok) return;
  const out = migrate(v.envelope).state as unknown as J;
  assert(!('tradePost' in out), 'no slice');
  assert(!out.buildings.some((b: J) => b.type === 'tradePost'), 'no post');
  eq(JSON.stringify({ ...out, version: 0 }), JSON.stringify({ ...env.state, version: 0 }), 'unchanged apart from the version');
});

test('save gate v9: trading post slice shape, references and placement are checked', () => {
  const w = createWorld('sandbox');
  for (let i = 0; i < 600; i++) step(w);
  w.state.tradePost!.recent.push({ tick: 10, good: 'planks', qty: 6, cents: 2000 });
  const ok = JSON.parse(JSON.stringify(makeEnvelope('valley1', w.state, 0))) as J;
  assert(gateEnvelope(ok).ok, 'valid v9 save');
  const postOf = (s: J) => s.buildings.find((b: J) => b.type === 'tradePost');
  const bad: [string, (s: J) => void][] = [
    ['missing slice in a v9 valley', (s) => { delete s.tradePost; }],
    ['slice outside the valley', (s) => { s.mission.id = 'm1'; delete s.valleyEvents; }],
    ['saturation above the cap', (s) => { s.tradePost.saturation.planks = 25; }],
    ['saturation missing a good', (s) => { delete s.tradePost.saturation.beer; }],
    ['building points at a castle', (s) => { s.tradePost.building = s.buildings.find((b: J) => b.type === 'castle').id; }],
    ['building points nowhere', (s) => { s.tradePost.building = 999; }],
    ['two posts', (s) => { s.buildings.push({ ...postOf(s), id: s.nextId, x: 43 }); s.nextId += 1; }],
    ['post without the slice', (s) => { delete s.tradePost; s.version = 8; }],
    ['six recent sales', (s) => { s.tradePost.recent = Array.from({ length: 6 }, () => ({ tick: 1, good: 'wood', qty: 1, cents: 100 })); }],
    ['sale in the future', (s) => { s.tradePost.recent[0].tick = s.tick + 1; }],
    ['sale of 7 units', (s) => { s.tradePost.recent[0].qty = 7; }],
    ['negative earnings', (s) => { s.tradePost.earnedCents = -1; }],
  ];
  for (const [what, f] of bad) {
    const env = JSON.parse(JSON.stringify(ok)) as J;
    f(env.state);
    if (env.state.version === 8) env.stateVersion = 8;
    assert(!gateEnvelope(env).ok, 'rejected: ' + what);
  }
});
