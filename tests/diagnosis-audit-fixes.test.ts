// Fixes from the diagnosis audit (docs/research/2026-11-03-diagnosis-audit.md, section 5). All of them are
// player-view reads (src/sim/diagnose.ts helpers that step() never calls, src/ui/stalls.ts): the sim's own
// chains, statuses and hashes stay as they were (tests/determinism-reads.test.ts covers the reads).
import {
  TICK_HZ, buildingById, createWorld, explainBuilding, heldWagon, inputGoods, isHeld, outputSurplus, step, type World,
} from '../src/sim/index';
import { DECENT, runSandbox } from '../tools/bot-sandbox';
import { calmWhy, cureFor, rankStalls } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

const minute = 60 * TICK_HZ;

function run(id: string, until: number, each: (w: World) => void, every = 10): World {
  const w = createWorld(id);
  while (w.state.mission.result === 'running' && w.state.tick < until) {
    step(w);
    if (w.state.tick % every === 0) each(w);
  }
  return w;
}

test('audit fix 1: a full yard nobody needs is a calm surplus — minor, never critical, no wagon cure (m4, m8)', () => {
  let spare = 0;
  for (const id of ['m4', 'm8']) {
    run(id, 12 * minute, (w) => {
      const ranked = rankStalls(w);
      for (const b of w.state.buildings) {
        const s = b.status;
        if (s.k !== 'OUTPUT_FULL' || s.cause !== 'NO_WAGON') continue;
        const sur = outputSurplus(w, b.id);
        // the rule itself: nobody waits for the good, the contract has its whole order of it
        const hungry = w.state.buildings.some((c) => c.id !== b.id && inputGoods(c.type).includes(s.good) &&
          (c.status.k === 'NO_INPUT' || c.status.k === 'NO_WAGON' || c.status.k === 'WAITING_UPSTREAM') && c.status.good === s.good);
        const k = w.state.mission.contract!;
        const owed = k.need[s.good] > (buildingById(w, k.castle)?.stock[s.good] ?? 0);
        if (hungry || owed) { eq(sur, null, `${id} ${b.type}#${b.id}: needed good is not a surplus`); continue; }
        if (sur !== 'SPARE') continue; // road stone still asked for by a granary
        spare++;
        const e = ranked.find((x) => x.id === b.id);
        if (e) assert(e.minor && !e.crit, `${id} ${b.type}#${b.id}: surplus is a minor pin`);
        eq(calmWhy(w, b), 'surplus', 'HUD card names the surplus');
        if (explainBuilding(w, b.id, 5, true).length === 1) assert(cureFor(w, b.id) !== 'wagon', `${id} ${b.type}#${b.id}: no "buy a wagon" for a surplus`);
      }
    });
  }
  assert(spare > 50, `surplus samples (${spare})`);
});

test('audit fix 1: a hungry consumer or an unfinished order keeps the wagon cure', () => {
  const w = createWorld('m4');
  const farm = w.state.buildings.find((b) => b.type === 'farm')!;
  const mill = w.state.buildings.find((b) => b.type === 'mill')!;
  farm.status = { k: 'OUTPUT_FULL', good: 'grain', cause: 'NO_WAGON', blockedBy: -1 };
  farm.stalledTicks = 60 * TICK_HZ;
  mill.status = { k: 'NO_WAGON', good: 'grain', cause: 'ALL_BUSY' };
  eq(outputSurplus(w, farm.id), null, 'the mill waits for grain');
  eq(cureFor(w, farm.id), 'wagon', 'a wagon helps');
  mill.status = { k: 'WORKING' };
  eq(outputSurplus(w, farm.id), 'SPARE', 'the mill is busy: a surplus');
  assert(!rankStalls(w).find((e) => e.id === farm.id)!.crit, 'not critical after 60 s');
  // the castle still lacks the good itself
  const k = w.state.mission.contract!;
  const g = (Object.keys(k.need) as (keyof typeof k.need)[]).find((x) => k.need[x] > 0)!;
  farm.status = { k: 'OUTPUT_FULL', good: g, cause: 'NO_WAGON', blockedBy: -1 };
  eq(outputSurplus(w, farm.id), null, 'contract good owed: not a surplus');
});

test('audit fix 1: in the free valley a full yard the market buys stays worth a wagon, as a minor pin', () => {
  let market = 0;
  runSandbox(DECENT, 20, {
    checkEvery: 1000,
    onTick: (w) => {
      if (w.state.tick % 20) return;
      for (const b of w.state.buildings) {
        if (outputSurplus(w, b.id) !== 'MARKET') continue;
        market++;
        eq(calmWhy(w, b), null, 'the card keeps "no wagon"');
        const e = rankStalls(w).find((x) => x.id === b.id);
        if (e) assert(!e.crit, 'market surplus is not critical');
        if (explainBuilding(w, b.id, 5, true).length === 1) eq(cureFor(w, b.id), 'wagon', 'a wagon carries it to the market');
      }
    },
  });
  assert(market > 0, `market surplus samples (${market})`);
});

test('audit fix 2: a third of the fleet held at a bridge — the "no wagon" chain goes on to the nearest held wagon (m4 ice)', () => {
  let linked = 0;
  run('m4', 10 * minute, (w) => {
    const held = w.state.wagons.filter((q) => isHeld(q.status)).length;
    for (const b of w.state.buildings) {
      const s = b.status;
      const waits = (s.k === 'NO_WAGON' && s.cause === 'ALL_BUSY') || (s.k === 'OUTPUT_FULL' && s.cause === 'NO_WAGON');
      if (!waits) continue;
      const chain = explainBuilding(w, b.id, 5, true);
      eq(explainBuilding(w, b.id).length, 1, 'the sim chain (stall ledger) is unchanged');
      if (held === 0 || held * 3 < w.state.wagons.length) { eq(chain.length, 1, 'fleet moving: no extra link'); continue; }
      const l = chain[1]!;
      assert(l && l.kind === 'wagon' && isHeld(l.status), `chain goes to a held wagon: ${chain.map((x) => x.kind + x.id + ':' + x.status.k).join(' > ')}`);
      eq(l.id, heldWagon(w, b.gate), 'the nearest held wagon');
      assert(cureFor(w, b.id) !== 'wagon', 'one more wagon would wait at the bridge too');
      linked++;
    }
  }, 5);
  assert(linked > 20, `held-fleet chains in m4 (${linked})`);
});

test('audit fix 2: heldWagon picks the nearest held wagon and needs a third of the fleet', () => {
  const w = createWorld('m4');
  const ws = w.state.wagons;
  assert(ws.length >= 3, 'm4 starts with a fleet');
  const gate = w.state.buildings[0]!.gate;
  eq(heldWagon(w, gate), -1, 'nobody held');
  ws[0]!.status = { k: 'BRIDGE_CLOSED', span: 0, until: 10, since: 0 };
  eq(heldWagon(w, gate), ws.length <= 3 ? ws[0]!.id : -1, 'one of many is not a third');
  for (const q of ws) q.status = { k: 'NO_ROUTE', target: -1, since: 0 };
  const tw = w.terrain.w;
  const d = (c: number) => { const x = c % tw, y = (c - x) / tw, gx = gate % tw, gy = (gate - gx) / tw; return (x - gx) ** 2 + (y - gy) ** 2; };
  const best = [...ws].sort((a, b) => d(a.at) - d(b.at) || a.id - b.id)[0]!;
  eq(heldWagon(w, gate), best.id, 'nearest to the gate');
});
