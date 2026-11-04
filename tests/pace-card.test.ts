// The pace card (day 8c): a slow order is not a stall, so when the producers of the bottleneck good work flat out
// and still miss the next seal, the card slot names that and leads to one more producer (mission VII's fisher).
import { TICK_HZ, applyCommand, createWorld, newPaceLog, samplePace, stars, stateHash, step, suggestLinkToStable } from '../src/sim/index';
import { forecastFor, paceCard } from '../src/ui/paceCard';
import { buildSite } from '../src/ui/site';
import { assert, eq, test } from './harness';

test('pace card: VII names the lone fisher and the ghost starts on the water (authored site)', () => {
  const w = createWorld('m7');
  const log = newPaceLog();
  let pc: ReturnType<typeof paceCard> = null;
  while (w.state.tick < 3 * 60 * TICK_HZ && !pc) {
    step(w);
    samplePace(log, w);
    if (w.state.tick % TICK_HZ === 0) pc = paceCard(w, forecastFor(w, log));
  }
  assert(pc !== null, 'the pace card appears within 3 minutes');
  if (!pc || pc.k !== 'producer') throw new Error('expected a producer card, got ' + JSON.stringify(pc));
  eq(pc!.type, 'fisher', 'producer type');
  eq(pc!.n, 1, 'one fisher');
  eq(pc!.seals, 3, 'three seals still in reach with one more fisher');
  assert(pc!.need > pc!.cap, 'flat out is not enough');
  const hash = stateHash(w);
  paceCard(w, forecastFor(w, log));
  eq(stateHash(w), hash, 'read-only');
  const s = buildSite(w, 'fisher', pc!.producer);
  assert(!!s && s.hint, 'the ghost starts on the mission\'s authored site');
  const before = w.state.buildings.length;
  assert(applyCommand(w, { t: 'place', type: 'fisher', x: s!.x, y: s!.y, facing: s!.facing }).ok, 'placing at the ghost applies');
  const link = suggestLinkToStable(w, w.state.buildings[before]!.id);
  if (link && link.cells.length) assert(applyCommand(w, { t: 'road', surface: 1, cells: link.cells }).ok, 'link applies');
  while (w.state.mission.result === 'running') step(w);
  eq(w.state.mission.result, 'won', 'won');
  assert(stars(w) >= 2, `at least two seals (got ${stars(w)})`);
});

for (const id of ['m2', 'm4', 'm11']) {
  test(`pace card: ${id} (nothing to build) never shows a producer card`, () => {
    const w = createWorld(id);
    const log = newPaceLog();
    while (w.state.mission.result === 'running') {
      step(w);
      samplePace(log, w);
      if (w.state.tick % (5 * TICK_HZ) === 0) {
        const pc = paceCard(w, forecastFor(w, log));
        assert(!pc || pc.k !== 'producer', `no producer card at tick ${w.state.tick}`);
      }
    }
  });
}

test('pace card: III — mud on the delivery is a calm line; the cobble cure comes once the forecast misses 3 seals', () => {
  const w = createWorld('m3');
  const log = newPaceLog();
  let calm = false, risk: ReturnType<typeof paceCard> = null;
  while (w.state.tick < 5 * 60 * TICK_HZ && !risk) {
    step(w);
    samplePace(log, w);
    if (w.state.tick % TICK_HZ) continue;
    const pc = paceCard(w, forecastFor(w, log));
    if (!pc) continue;
    if (pc.k !== 'mud') throw new Error('III builds nothing: only the mud card, got ' + pc.k);
    if (!pc.risk) calm = true;
    else risk = pc;
  }
  assert(calm, 'the mud line shows (calm) before the forecast is in');
  if (!risk || risk.k !== 'mud') throw new Error('expected the at-risk mud card');
  assert(risk.cells.length >= 6 && risk.pct >= 15, `a real stretch and gain (${risk.cells.length} cells, ${risk.pct} %)`);
  for (const c of risk.cells) eq(w.state.roads[c], 1, 'the stretch is dirt');
  const hash = stateHash(w);
  paceCard(w, forecastFor(w, log));
  eq(stateHash(w), hash, 'read-only');
  assert(applyCommand(w, { t: 'road', surface: 2, cells: risk.cells }).ok, 'cobbling the stretch applies');
  for (const c of risk.cells) eq(w.state.roads[c], 2, 'cobbled');
});
