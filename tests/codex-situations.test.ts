// Situational entries of the "Co to znaczy?" fold (orders 72 + 102, D-339): every entry is complete in all 17
// languages, and each one is picked for the state it explains — WAGON_DUE, a surplus, a saturated market, the
// trading post's road, the build tutorial's cut-off hut, and mission XVI's castles (rival, even split, first).
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MARKET, TRADE_POST, applyCommand, capacityOf, createWorld, newPaceLog, outputSurplus, samplePace, stateHash, step, validatePlace, type World } from '../src/sim/index';
import { CODEX_SITUATIONS, CODEX_SITUATION_FIELDS, castleCodexSituation, codexSituation, situationKey, type CodexSituation } from '../src/ui/codexSituations';
import { buildSite } from '../src/ui/site';
import { castlesOf } from '../tools/bot-m16';
import { hutConnected, hutIds, hutStalled, newHut } from '../src/ui/tutorialBuildSteps';
import { assert, eq, test } from './harness';

const I18N = fileURLToPath(new URL('../src/i18n/', import.meta.url));
const SKIP = new Set(['index', 'plural', 'pseudo']);

test('D-339: every situational entry is complete in all 17 languages, at most 220 characters a field', async () => {
  const files = readdirSync(I18N).filter((f) => f.endsWith('.ts') && !SKIP.has(f.replace(/\.ts$/, '')));
  eq(files.length, 17, 'seventeen dictionaries');
  for (const f of files) {
    const code = f.replace(/\.ts$/, '');
    const mod = (await import(I18N + f)) as Record<string, Record<string, string>>;
    const d = mod[code]!;
    assert(d, 'dictionary export ' + code);
    for (const s of CODEX_SITUATIONS) for (const field of CODEX_SITUATION_FIELDS) {
      const v = d[situationKey(s, field)];
      assert(typeof v === 'string' && v.trim().length > 0, `${code}: missing ${situationKey(s, field)}`);
      assert([...v].length <= 220, `${code}: over 220 characters ${situationKey(s, field)}`);
      assert(!/[{}]/.test(v), `${code}: no placeholders in ${situationKey(s, field)}`);
      if (field === 'meaning') assert(/[.!?。．।]$/.test(v), `${code}: meaning is one sentence ${s}`);
    }
  }
});

test('D-339: never "buy a wagon" in an entry whose state another wagon does not help (pl/en)', async () => {
  const { pl } = await import('../src/i18n/pl');
  const { en } = await import('../src/i18n/en');
  for (const s of ['wagonDue', 'marketFull', 'surplus'] as CodexSituation[]) {
    for (const f of ['fix1', 'fix2'] as const) {
      assert(!/^Kup wóz/.test(pl[situationKey(s, f)]), `pl ${s} ${f}`);
      assert(!/^Buy a wagon/.test(en[situationKey(s, f)]), `en ${s} ${f}`);
    }
  }
});

test('D-339: WAGON_DUE, the trading post without its road and a surplus read their own entries', () => {
  const w = createWorld('sandbox');
  eq(codexSituation(w, { kind: 'building', id: 0, status: { k: 'WAGON_DUE', wagon: 1, good: 'wood', at: 50 } }), 'wagonDue', 'WAGON_DUE');
  eq(codexSituation(w, { kind: 'wagon', id: 0, status: { k: 'NO_ROUTE' } as never }), null, 'a wagon link: the plain codex');
  // the post opens at rank 4 (D-170): staged here, as a later valley would reach it
  w.state.town.rank = TRADE_POST.rank;
  for (let i = 0; i < 40; i++) step(w);
  const post = w.state.buildings.find((b) => b.type === 'tradePost');
  assert(post, 'the valley has its trading post');
  eq(post!.status.k, 'NO_ROAD', 'open, and no road reaches the post');
  eq(codexSituation(w, { kind: 'building', id: post!.id, status: post!.status }), 'postNoRoad', 'the post');
  let surplus = 0;
  for (const id of ['m4', 'm8', 'm9']) {
    const m = createWorld(id);
    while (m.state.mission.result === 'running' && surplus < 5) {
      step(m);
      if (m.state.tick % 20) continue;
      for (const b of m.state.buildings) {
        if (b.status.k !== 'OUTPUT_FULL' || b.status.cause !== 'NO_WAGON') continue;
        const sit = codexSituation(m, { kind: 'building', id: b.id, status: b.status });
        eq(sit === 'surplus', outputSurplus(m, b.id) === 'SPARE', `${id}: surplus entry iff a spare yard`);
        if (sit === 'surplus') surplus++;
      }
    }
  }
  assert(surplus >= 5, `surplus samples (${surplus})`);
});

test('D-339: a granary full at a saturated market reads "rynek nasycony", read-only', () => {
  const w = createWorld('sandbox');
  const st = w.state;
  let wh = st.buildings.find((b) => b.type === 'warehouse');
  const castle = st.buildings.find((b) => b.type === 'castle')!;
  if (!wh) {
    const s = buildSite(w, 'warehouse', castle.id)!;
    assert(validatePlace(w, 'warehouse', s.x, s.y, s.facing).ok, 'granary site');
    st.buildings.push({ ...JSON.parse(JSON.stringify(castle)), id: st.nextId++, type: 'warehouse', x: s.x, y: s.y, status: { k: 'IDLE' }, stalledTicks: 0 });
    wh = st.buildings[st.buildings.length - 1]!;
  }
  wh.stock.bread = capacityOf('bread') * 2;
  wh.reservedOut.bread = 0;
  wh.status = { k: 'STORAGE_FULL' } as never;
  wh.stalledTicks = 600;
  const link = { kind: 'building' as const, id: wh.id, status: wh.status };
  eq(codexSituation(w, link), null, 'a market takes a load: the plain STORAGE_FULL entry');
  st.market.saturation.bread = MARKET.cap;
  const h = stateHash(w);
  eq(codexSituation(w, link), 'marketFull', 'price on the floor: the saturated-market entry');
  eq(stateHash(w), h, 'read-only');
});

function placeCutOffHut(w: World): void {
  for (let y = 4; y < 20; y++) for (let x = 22; x < 44; x++) {
    if (!validatePlace(w, 'woodcutter', x, y, 0).ok) continue;
    if (!applyCommand(w, { t: 'place', type: 'woodcutter', x, y, facing: 0 }).ok) continue;
    const hut = w.state.buildings[w.state.buildings.length - 1]!;
    if (!hutConnected(w, hut)) return;
    applyCommand(w, { t: 'demolish', cell: y * w.terrain.w + x });
  }
  throw new Error('no free woodcutter site');
}

test('D-339 (D-259): the build tutorial\'s cut-off hut reads the lesson\'s entry, only while it is the lesson\'s hut', () => {
  const w = createWorld('sandbox');
  const baseline = hutIds(w);
  placeCutOffHut(w);
  const hut = newHut(w, baseline)!;
  for (let i = 0; i < 1200 && !hutStalled(hut); i++) step(w);
  eq(hut.status.k, 'NO_ROAD', 'the hut stalls for its road');
  const link = { kind: 'building' as const, id: hut.id, status: hut.status };
  eq(codexSituation(w, link, hut.id), 'tutorialNoRoad', 'in the lesson');
  eq(codexSituation(w, link, -1), null, 'outside the lesson: the plain NO_ROAD entry');
});

test('D-339 (XVI): the castle card reads the even split or the rival, then "first" once the switch is on', () => {
  const w = createWorld('m16');
  const log = newPaceLog();
  const [east, north] = castlesOf(w);
  const castle = (id: number) => w.state.buildings.find((b) => b.id === id)!;
  const seen = new Set<CodexSituation | null>();
  for (let i = 0; i < 90 * 10; i++) {
    step(w); samplePace(log, w);
    if (i % 10) continue;
    for (const id of [east, north]) {
      const s = castleCodexSituation(w, castle(id), log);
      assert(s === 'castleEven' || s === 'castleRival', `no castle first: even or rival (${s})`);
      seen.add(s);
    }
  }
  assert(seen.has('castleEven') && seen.has('castleRival'), `both readings seen: ${[...seen].join(',')}`);
  assert(applyCommand(w, { t: 'castleFirst', castle: east }).ok, 'east first');
  step(w); samplePace(log, w);
  eq(castleCodexSituation(w, castle(east), log), 'castleFirst', 'the first castle');
  const n = castleCodexSituation(w, castle(north), log);
  assert(n === 'castleFirst' || n === 'castleRival', `the other castle: first is the other one, or it takes the goods (${n})`);
  eq(castleCodexSituation(createWorld('m3'), castle(east), log), null, 'one castle: no XVI entry');
});
