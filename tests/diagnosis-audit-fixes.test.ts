// Fixes from the diagnosis audit (docs/research/2026-11-03-diagnosis-audit.md, section 5). All of them are
// player-view reads (src/sim/diagnose.ts helpers that step() never calls, src/ui/stalls.ts): the sim's own
// chains, statuses and hashes stay as they were (tests/determinism-reads.test.ts covers the reads).
import {
  TICK_HZ, applyCommand, buildingById, busyOutOfReach, createWorld, explainBuilding, findPath, granaryRelief, heldWagon, inputGoods, isHeld,
  outputGoods, outputSurplus, step, suggestLinkToStable, type World,
} from '../src/sim/index';
import { DECENT, runSandbox } from '../tools/bot-sandbox';
import { calmWhy, cureFor, gapTarget, rankStalls } from '../src/ui/stalls';
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

test('audit fix 3: a full granary chains to the granary without a road (cure: road), or is calm when another has room (m6, m12)', () => {
  let unlinked = 0, room = 0, none = 0;
  for (const id of ['m6', 'm12']) {
    for (const lesson of [false, true]) {
      const w = createWorld(id);
      let linked = false;
      while (w.state.mission.result === 'running' && w.state.tick < 12 * minute) {
        // the lesson in short: the cut-off granary gets its road at 0:30 (the cheapest link to the stable)
        if (lesson && !linked && w.state.tick === 30 * TICK_HZ) {
          for (const g of w.state.buildings.filter((b) => b.type === 'warehouse' && b.status.k === 'NO_ROAD')) {
            const s = suggestLinkToStable(w, g.id);
            if (s) { w.state.coins += s.cost; assert(applyCommand(w, { t: 'road', surface: 1, cells: s.cells }).ok, 'link the granary'); }
          }
          linked = true;
        }
        step(w);
        if (w.state.tick % 20) continue;
        const ranked = rankStalls(w);
        for (const b of w.state.buildings) {
          if (b.status.k !== 'STORAGE_FULL') continue;
          const r = granaryRelief(w, b.id);
          const chain = explainBuilding(w, b.id, 5, true);
          eq(explainBuilding(w, b.id).length, 1, 'the sim chain is unchanged');
          const e = ranked.find((x) => x.id === b.id);
          if (r?.k === 'ROOM') {
            room++;
            eq(chain.length, 1, 'room elsewhere: nothing to chain to');
            eq(calmWhy(w, b), 'storeRoom', 'the card says another granary has room');
            eq(cureFor(w, b.id), null, 'nothing to buy or build');
            if (e) assert(e.minor && !e.crit, `${id}: a full granary next to one with room is a minor pin`);
          } else if (r?.k === 'UNLINKED') {
            unlinked++;
            const l = chain[1]!;
            assert(l && l.kind === 'building' && l.id === r.granary && l.status.k === 'NO_ROAD', 'chain goes on to the granary without a road');
            eq(cureFor(w, b.id), 'road', 'cure: the road to it');
          } else {
            none++;
            eq(cureFor(w, b.id), 'granary', 'no other granary to fill: another granary');
          }
        }
      }
    }
  }
  assert(unlinked > 10 && room > 10, `samples: unlinked ${unlinked}, room ${room}, none ${none}`);
});

test('audit fix 5: "every wagon busy" with no source in reach of the stable is a missing road (m1 before the bridge)', () => {
  let out = 0, busy = 0;
  for (const id of ['m1', 'm4']) {
    run(id, 10 * minute, (w) => {
      for (const b of w.state.buildings) {
        const s = b.status;
        if (s.k !== 'NO_WAGON' || s.cause !== 'ALL_BUSY') continue;
        const src = busyOutOfReach(w, b.id);
        const stable = w.state.buildings.find((q) => q.type === 'stable')!;
        const sources = w.state.buildings.filter((q) => q.id !== b.id && (q.type === 'warehouse' || outputGoods(q.type).includes(s.good)) && q.stock[s.good] - q.reservedOut[s.good] > 0);
        const inReach = sources.some((q) => !!findPath(w, stable.gate, q.gate, false));
        if (inReach || !sources.length) { eq(src, -1, `${id}: a source in reach — buying a wagon is honest`); busy++; continue; }
        out++;
        assert(sources.some((q) => q.id === src), 'names an unreachable source');
        const chain = explainBuilding(w, b.id, 5, true);
        if (chain.length !== 1) continue; // a held fleet goes first (fix 2)
        eq(cureFor(w, b.id), 'road', `${id}: the cure is a road`);
        eq(gapTarget(w, chain), src, 'the gap finder links the source');
        const fix = suggestLinkToStable(w, src);
        assert(fix && fix.newCells.length > 0, 'a road from the stable to the source exists');
      }
    }, 10);
  }
  assert(out > 3, `m1 out-of-reach samples (${out})`);
  assert(busy > 3, `ordinary ALL_BUSY samples (${busy})`);
});
