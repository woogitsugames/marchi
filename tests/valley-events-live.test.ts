// D-54: valley events wired into the free valley (state v8). Live sim: commands, conservation,
// determinism, save v7 -> v8, the gate, and proof that contract missions did not change at all.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  MISSIONS, STATE_VERSION, TICK_HZ, applyCommand, checkInvariants, createWorld, deserialize, serialize,
  stateHash, step, type Command, type World,
} from '../src/sim/index';
import { hashString } from '../src/sim/hash';
import { fairPercent, freshValleyEvents, orderOutstanding } from '../src/sim/events';
import { migrate } from '../src/platform/save';
import { gateEnvelope, makeEnvelope, parseSave } from '../src/platform/saveGate';
import { seedRng, nextInt } from '../src/sim/rng';
import { assert, eq, test } from './harness';

/**
 * Recorded on the pre-D-54 build (commit 10924b2, state v7) with tools-equivalent runs: every
 * non-sandbox mission, 12 min, with and without 2 wagons bought at 0:30, hash of the state with the
 * version set to 0 every 4 min. State v8 must leave all of them untouched.
 * Re-baselined by D-156 (dispatcher 2, L1): the buy2 runs of m2, m3, m4, m5, m6, m8, m9, m11 and m12 change (2 bought
 * wagons open the fleet gate of rule A); every buy0 run, the lab and m1/m7/m10/m13 buy2 are untouched,
 * and with DISPATCH2.ruleA = false the previous values are reproduced.
 */
const CONTRACT_GOLDEN: Record<string, string> = {
  'lab|buy0': 'f1d465eefe140104,70bb6c651df3077d,3288c1723c2c39b0',
  'lab|buy2': '71c556000a799973,de8b1fc0396c26c3,93cdc1e7c1a4a625',
  'm1|buy0': 'f4c615ac8d207e28,e3e502cd6742c843,f9383920b41b750f',
  'm1|buy2': '0054e26891882946,f9bfc3eb2b75078d,fc67b6b3ebd67043',
  'm10|buy0': '02d241c44b2bcc79,4af90ada046d346e,ddf332951ee78196',
  'm10|buy2': '0eeb5cd9a58cfc9b,b3657227eabf727e,f6bd74fd2d859b30',
  'm11|buy0': '2efa46c20498c847,e6b574e9833b9f71,a0af05f383cbb207',
  'm11|buy2': '42100d3a3771b2f2,09e9c22768b86b6d,1e718a415f3f7c65',
  'm12|buy0': '3940ac24f4ff8fe4,137dfb930ff7bdde,f1ee1180bc2be3e0',
  'm12|buy2': 'c6b5d3097e506523,7738e7c4380c5671,bae292a1b76fe826',
  // mission XIII (night 6, D-102): recorded when it was added; the older entries did not change
  'm13|buy0': '87e09ed110e446b4,bf3ce0da782b609f,0bed2d07e81cd3e6',
  'm13|buy2': 'df8437e030684067,b5c569eb125532e6,38be8500152843f4',
  'm2|buy0': 'b3acb2f7ad67ff52,b015a53f06f78528,79c49585665d1105',
  'm2|buy2': 'b57515a568fec6e7,e89c45171850e6c5,b439ab7698d72ac4',
  'm3|buy0': '19ee2ab5f4a5a6b1,037568dac6697773,2e74a70e8f3ee796',
  'm3|buy2': 'af51fe7eb68381f4,2ab17f60726b7e74,833cc93cad075e83',
  'm4|buy0': '00b4b867756865f4,1c31bedc433eba62,07f962aa1f4f794b',
  'm4|buy2': 'f5e7a93bf19407a6,bc02d3b781401023,037224c52ee0bc91',
  'm5|buy0': '382f984e99443512,44e8520373ca035e,1024cb0cb41b8ddb',
  'm5|buy2': '8be41a5640785b56,154f316289a00e47,d9a9a1bdaf09e889',
  'm6|buy0': 'd76efc378da5d55f,ab47945326b59163,e0795bc353e4dd78',
  'm6|buy2': '1e6f3901c685b1c7,179b230c64b87688,f2da405bd1c2361f',
  'm7|buy0': '467a6e9d4299ab63,c37f35314bef3b09,86b72066c8b4d8f2',
  'm7|buy2': 'd707eb36d0906711,9a219174a05782b8,ef88461b9dce8377',
  'm8|buy0': '5955cbef4faef7a6,0e99bfc89f1bddc2,229e1574815296fe',
  'm8|buy2': 'c3d5ff9b3ae0308b,05724e325957a586,305b4027952099be',
  'm9|buy0': 'e7df68ecb3830e35,9fcaba7f51a9428b,1e39ee7363ae4129',
  'm9|buy2': '43a510290102fe5a,3e9b967ba61d5b84,3ba10082a6d666dc',
};

function runContract(id: string, buy: number): string {
  const w = createWorld(id);
  const marks: string[] = [];
  for (let i = 1; i <= 12 * 60 * TICK_HZ; i++) {
    if (i === 30 * TICK_HZ) {
      const s = w.state.buildings.find((b) => b.type === 'stable');
      w.state.coins += 1000;
      if (s) for (let k = 0; k < buy; k++) applyCommand(w, { t: 'buyWagon', stable: s.id });
    }
    step(w);
    if (i % 2400 === 0) {
      assert(!('valleyEvents' in w.state), `${id}: no event slice outside the free valley`);
      marks.push(hashString(JSON.stringify({ ...w.state, version: 0 })));
    }
  }
  return marks.join(',');
}

test('events live: every contract mission (and the lab) runs bit-identically to state v7 (golden hashes)', () => {
  const ids = Object.keys(MISSIONS).filter((id) => id !== 'sandbox').sort();
  eq(ids.length * 2, Object.keys(CONTRACT_GOLDEN).length, 'every mission recorded');
  const bad: string[] = [];
  for (const id of ids) for (const buy of [0, 2]) {
    const key = `${id}|buy${buy}`;
    const got = runContract(id, buy);
    if (got !== CONTRACT_GOLDEN[key]) bad.push(`${key}: ${got} != ${CONTRACT_GOLDEN[key]}`);
  }
  eq(bad.length, 0, 'contract runs changed:\n' + bad.join('\n'));
});

/** Player policy: accept every order, sell to every merchant (what an eager player would tap). */
function eventCommands(w: World): Command[] {
  const ev = w.state.valleyEvents;
  if (!ev) return [];
  const out: Command[] = [];
  for (const o of ev.orders) if (!o.accepted) out.push({ t: 'orderAccept', id: o.id });
  if (ev.merchant) out.push({ t: 'merchantSell', id: ev.merchant.id });
  return out;
}

function run(seed: number, ticks: number, saveAt = -1, onTick?: (w: World) => void): World {
  let w = createWorld('sandbox', seed);
  for (let i = 0; i < ticks; i++) {
    if (i % TICK_HZ === 0) for (const c of eventCommands(w)) applyCommand(w, c);
    if (i === 900 * TICK_HZ / 10) applyCommand(w, { t: 'buyWagon', stable: w.state.buildings.find((b) => b.type === 'stable')!.id });
    step(w);
    onTick?.(w);
    if (i === saveAt) w = deserialize(serialize(w));
  }
  return w;
}

test('events live: the free valley starts with an empty v8 event slice, last in key order', () => {
  const w = createWorld('sandbox');
  eq(w.state.version, STATE_VERSION, 'v8');
  eq(Object.keys(w.state).at(-1), 'valleyEvents', 'appended last');
  eq(JSON.stringify(w.state.valleyEvents), JSON.stringify(freshValleyEvents()), 'empty');
});

test('events live: same seed + same commands => same hash; save/load mid-run continues identically; invariants hold', () => {
  const errs: string[] = [];
  const a = run(1301, 30 * 60 * TICK_HZ, -1, (w) => {
    if (w.state.tick % 600 === 0) for (const e of checkInvariants(w)) if (errs.length < 5) errs.push(`${w.state.tick}: ${e}`);
  });
  eq(errs.join('; '), '', 'invariants every minute');
  const b = run(1301, 30 * 60 * TICK_HZ);
  const c = run(1301, 30 * 60 * TICK_HZ, 11 * 60 * TICK_HZ + 7);
  eq(stateHash(b), stateHash(a), 'two runs');
  eq(stateHash(c), stateHash(a), 'save/load continuation');
  const ev = a.state.valleyEvents!;
  assert(ev.sequence > 0, 'events happened');
  assert(ev.ordersDone >= 1, `an accepted order was fulfilled by deliveries (done ${ev.ordersDone})`);
  assert(stateHash(run(1302, 30 * 60 * TICK_HZ)) !== stateHash(a), 'seed matters');
});

test('events live: an accepted order takes castle deliveries, pays once; an offered one takes nothing', () => {
  const w = createWorld('sandbox');
  for (let i = 0; i < 20; i++) step(w);
  const ev = w.state.valleyEvents!;
  eq(ev.orders.length, 1, 'first order offered');
  const order = ev.orders[0]!;
  eq(order.accepted, false, 'not accepted by itself');
  const g = Object.keys(order.need)[0] as 'wood';
  eq(orderOutstanding(w.state, g), 0, 'offered order owes nothing yet');
  eq(applyCommand(w, { t: 'orderAccept', id: order.id }).ok, true, 'accept');
  eq(applyCommand(w, { t: 'orderAccept', id: order.id }).ok, false, 'accept twice refused');
  assert(orderOutstanding(w.state, g) > 0, 'now owed');
  const coins = w.state.coins, renown = w.state.town.renown;
  let paidAt = -1;
  for (let i = 0; i < 20 * 60 * TICK_HZ && paidAt < 0; i++) {
    step(w);
    if (!w.state.valleyEvents!.orders.some((o) => o.id === order.id)) paidAt = w.state.tick;
  }
  assert(paidAt > 0, 'order fulfilled by ordinary wagon deliveries');
  eq(w.state.valleyEvents!.ordersDone, 1, 'counted once');
  eq(w.state.valleyEvents!.orderSilver, order.rewardSilver, 'reward booked');
  assert(w.state.coins >= coins + order.rewardSilver, 'silver paid');
  assert(w.state.town.renown >= renown + order.rewardRenown, 'renown paid');
  eq(checkInvariants(w).join('; '), '', 'conservation');
  eq(applyCommand(w, { t: 'orderDecline', id: order.id }).ok, false, 'a finished order cannot be touched');
});

test('events live: declining costs nothing; the merchant buys real surplus once at 140 %', () => {
  const w = createWorld('sandbox');
  for (let i = 0; i < 20; i++) step(w);
  const before = { coins: w.state.coins, renown: w.state.town.renown };
  const id = w.state.valleyEvents!.orders[0]!.id;
  eq(applyCommand(w, { t: 'orderDecline', id }).ok, true, 'decline');
  eq(w.state.coins, before.coins, 'no silver lost');
  eq(w.state.town.renown, before.renown, 'no renown lost');
  eq(w.state.valleyEvents!.orders.length, 0, 'gone');
  // a granary full of planks: real, connected surplus
  const wh = w.state.buildings.find((b) => b.type === 'warehouse')!;
  wh.stock.planks += 30; w.state.ledger.produced.planks += 30;
  for (let i = 0; i < 20 && !w.state.valleyEvents!.merchant; i++) step(w);
  const offer = w.state.valleyEvents!.merchant;
  assert(offer !== null, 'merchant came');
  if (!offer) return;
  eq(offer.unitCents, 3 * 140, 'planks at 140 %');
  const consumed = w.state.ledger.consumed[offer.good], sold = w.state.ledger.sold[offer.good], coins = w.state.coins;
  const sat = JSON.stringify(w.state.market.saturation), flow = JSON.stringify(w.state.town.flow);
  const r = applyCommand(w, { t: 'merchantSell', id: offer.id });
  assert(r.ok, 'sold');
  eq(w.state.ledger.consumed[offer.good] - consumed, offer.quantity, 'consumed');
  eq(w.state.ledger.sold[offer.good] - sold, offer.quantity, 'sold');
  eq(w.state.coins - coins, Math.floor((offer.quantity * offer.unitCents) / 100) , 'paid (cents carry)');
  eq(JSON.stringify(w.state.market.saturation), sat, 'market not saturated by the merchant');
  eq(JSON.stringify(w.state.town.flow), flow, 'not market flow');
  eq(w.state.valleyEvents!.merchant, null, 'offer closed');
  eq(applyCommand(w, { t: 'merchantSell', id: offer.id }).ok, false, 'sells once');
  eq(checkInvariants(w).join('; '), '', 'conservation');
});

test('events live: merchant without surplus says NO_SURPLUS and keeps the offer (no auto sale, no loss)', () => {
  const w = createWorld('sandbox');
  const wh = w.state.buildings.find((b) => b.type === 'warehouse')!;
  wh.stock.planks += 30; w.state.ledger.produced.planks += 30;
  for (let i = 0; i < 20; i++) step(w);
  const offer = w.state.valleyEvents!.merchant!;
  assert(!!offer, 'offer');
  for (const b of w.state.buildings) if (b.type === 'sawmill' || b.type === 'warehouse') { w.state.ledger.destroyed.planks += b.stock.planks - b.reservedOut.planks; b.stock.planks = b.reservedOut.planks; }
  const r = applyCommand(w, { t: 'merchantSell', id: offer.id });
  assert(!r.ok && r.err.k === 'NO_SURPLUS', 'neutral refusal');
  assert(w.state.valleyEvents!.merchant?.id === offer.id, 'offer kept');
  eq(applyCommand(w, { t: 'merchantDecline', id: offer.id }).ok, true, 'put aside');
  eq(checkInvariants(w).join('; '), '', 'conservation');
});

test('events live: the fair is the only price bonus (no autumn beer on top)', () => {
  const w = createWorld('sandbox');
  w.state.tick = 2 * 9000 + 5;
  eq(fairPercent(w, 'beer'), 100, 'autumn alone pays nothing extra');
  w.state.valleyEvents!.fair = { id: 'fair-2', good: 'planks', season: 'autumn', startTick: 18000, endTick: 27000, pricePercent: 125 };
  eq(fairPercent(w, 'planks'), 125, 'fair good');
  eq(fairPercent(w, 'beer'), 100, 'other goods plain');
  w.state.tick = 27000;
  eq(fairPercent(w, 'planks'), 100, 'over');
});

const FIXTURE = readFileSync(fileURLToPath(new URL('./fixtures/save-v7-sandbox.json', import.meta.url)), 'utf8');

test('save v7 -> v8: a real v7 free-valley save gets an empty event slice, round trips, keeps running', () => {
  const parsed = parseSave(FIXTURE);
  assert(parsed.ok, 'v7 fixture passes the gate');
  if (!parsed.ok) return;
  eq(parsed.envelope.stateVersion, 7, 'fixture is v7');
  assert(!('valleyEvents' in (JSON.parse(FIXTURE).state as object)), 'no events in v7');
  const env = migrate(parsed.envelope);
  eq(env.stateVersion, STATE_VERSION, 'migrated');
  const w = deserialize(JSON.stringify(env.state));
  eq(JSON.stringify(w.state.valleyEvents), JSON.stringify(freshValleyEvents()), 'empty slice');
  eq(Object.keys(w.state).join(','), Object.keys(createWorld('sandbox').state).join(','), 'key order of a fresh v8 state');
  eq(checkInvariants(w).join('; '), '', 'invariants');
  const again = parseSave(JSON.stringify(makeEnvelope('valley1', w.state, 0)));
  assert(again.ok, 'v8 passes the gate');
  if (again.ok) eq(serialize(deserialize(JSON.stringify(migrate(again.envelope).state))), serialize(w), 'v8 round trip');
  for (let i = 0; i < 1200; i++) { for (const c of i % 10 === 0 ? eventCommands(w) : []) applyCommand(w, c); step(w); }
  assert(w.state.valleyEvents!.sequence > 0, 'events start after loading');
  eq(checkInvariants(w).join('; '), '', 'invariants after play');
  // a contract v7 save migrates to v8 without an event slice
  const m2 = parseSave(readFileSync(fileURLToPath(new URL('./fixtures/save-v6-m2-sold-wagon.json', import.meta.url)), 'utf8'));
  if (m2.ok) assert(!('valleyEvents' in migrate(m2.envelope).state), 'contract: no slice');
});

test('save gate v8: event slice shape, ids, templates, prices and placement are checked', () => {
  const w = run(1301, 8 * 60 * TICK_HZ);
  const ok = JSON.parse(JSON.stringify(makeEnvelope('valley1', w.state, 0)));
  assert(gateEnvelope(ok).ok, 'valid v8 save');
  assert(ok.state.valleyEvents.orders.length > 0 || ok.state.valleyEvents.merchant, 'something to check');
  const bad: [string, (s: any) => void][] = [ // eslint-disable-line @typescript-eslint/no-explicit-any
    ['missing slice', (s) => { delete s.valleyEvents; }],
    ['slice in a contract', (s) => { s.mission.id = 'm1'; }],
    ['three orders', (s) => { s.valleyEvents.orders = [0, 1, 2].map((i) => ({ id: 'order-' + i, templateId: 'palisade_repair', accepted: false, need: { wood: 5 }, delivered: { wood: 0 }, rewardSilver: 1, rewardRenown: 2 })); }],
    ['unknown template', (s) => { s.valleyEvents.orders = [{ id: 'order-1', templateId: 'dragon', accepted: false, need: { wood: 5 }, delivered: { wood: 0 }, rewardSilver: 1, rewardRenown: 2 }]; }],
    ['delivered over need', (s) => { s.valleyEvents.orders = [{ id: 'order-1', templateId: 'palisade_repair', accepted: true, need: { wood: 5 }, delivered: { wood: 9 }, rewardSilver: 1, rewardRenown: 2 }]; }],
    ['bad order id', (s) => { s.valleyEvents.orders = [{ id: 'x<script>', templateId: 'palisade_repair', accepted: true, need: { wood: 5 }, delivered: { wood: 0 }, rewardSilver: 1, rewardRenown: 2 }]; }],
    ['fair at 300 %', (s) => { s.valleyEvents.fair = { id: 'fair-2', good: 'beer', season: 'autumn', startTick: 18000, endTick: 27000, pricePercent: 300 }; }],
    ['fair two seasons long', (s) => { s.valleyEvents.fair = { id: 'fair-2', good: 'beer', season: 'autumn', startTick: 18000, endTick: 36000, pricePercent: 125 }; }],
    ['merchant overpays', (s) => { s.valleyEvents.merchant = { id: 'merchant-1', good: 'planks', quantity: 12, unitCents: 99999, pricePercent: 140 }; }],
    ['merchant buys 500', (s) => { s.valleyEvents.merchant = { id: 'merchant-1', good: 'planks', quantity: 500, unitCents: 420, pricePercent: 140 }; }],
    ['negative counter', (s) => { s.valleyEvents.sequence = -1; }],
  ];
  for (const [what, f] of bad) {
    const env = JSON.parse(JSON.stringify(ok));
    f(env.state);
    assert(!gateEnvelope(env).ok, 'rejected: ' + what);
  }
});

test('events fuzz: random event commands with save/load at random ticks stay deterministic and conserve goods', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const rng = seedRng(9000 + seed);
    const ticks = 6 * 60 * TICK_HZ;
    const plan: { tick: number; pick: number; kind: number }[] = [];
    for (let i = 0; i < 40; i++) plan.push({ tick: nextInt(rng, 0, ticks - 1), pick: nextInt(rng, 0, 3), kind: nextInt(rng, 0, 3) });
    plan.sort((a, b) => a.tick - b.tick || a.pick - b.pick);
    const saves = [nextInt(rng, 0, ticks - 1), nextInt(rng, 0, ticks - 1)];
    const play = (reload: boolean): string => {
      let w = createWorld('sandbox', 1301 + (seed % 3));
      w.state.coins += 2000;
      let k = 0;
      for (let t = 0; t < ticks; t++) {
        while (k < plan.length && plan[k]!.tick === t) {
          const p = plan[k++]!, ev = w.state.valleyEvents!;
          const order = ev.orders[p.pick % 2];
          const cmd: Command | null = p.kind === 0 && order ? { t: 'orderAccept', id: order.id }
            : p.kind === 1 && order ? { t: 'orderDecline', id: order.id }
              : p.kind === 2 && ev.merchant ? { t: 'merchantSell', id: ev.merchant.id }
                : p.kind === 3 && ev.merchant ? { t: 'merchantDecline', id: ev.merchant.id }
                  : p.pick === 0 ? { t: 'buyWagon', stable: w.state.buildings.find((b) => b.type === 'stable')!.id } : null;
          if (cmd) applyCommand(w, cmd);
        }
        step(w);
        if (reload && saves.includes(t)) {
          const env = parseSave(JSON.stringify(makeEnvelope('valley1', w.state, 0)));
          assert(env.ok, `seed ${seed}: save at ${t} passes the gate`);
          if (env.ok) w = deserialize(JSON.stringify(migrate(env.envelope).state));
        }
        if (t % 300 === 0) { const e = checkInvariants(w); assert(e.length === 0, `seed ${seed} @${t}: ${e[0]}`); }
      }
      return stateHash(w);
    };
    eq(play(true), play(false), `seed ${seed}: save/load continuation`);
  }
});
