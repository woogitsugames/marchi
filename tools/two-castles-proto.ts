// EXPERIMENTAL throwaway prototype (research 2026-11-07, docs/research/2026-11-07-two-castles.md): can the dispatcher
// serve two castle orders deterministically, and does "which castle first" decide the seals? Registers two
// tool-only missions (never in the menu, never in MISSIONS outside this process), adds the second castle's order
// through the experimental `mission.extraContracts`, and plays a few fixed strategies.
//   npx tsx tools/two-castles-proto.ts [--map] [--sweep]
// Proof of "no change for existing missions": tools/mission-hashes.ts before/after and the golden tests in npm test.
import {
  MISSIONS, TICK_HZ, applyCommand, createWorld, deserialize, net, serialize, stateHash, step, stars, type World,
} from '../src/sim/index';
import { goodsOf } from '../src/sim/defs';
import { TWO_CASTLES } from '../src/sim/logistics';
import type { MissionDef } from '../src/sim/missions';
import type { Contract, GoodMap } from '../src/sim/types';
import { M3_VALLEY } from '../src/sim/missions-proposed';

const min = (m: number): number => Math.round(m * 60 * TICK_HZ);

interface Proto {
  def: MissionDef;
  /** Main castle (first castle in def.buildings): its own deadline as a single tranche. */
  mainDueMin: number;
  /** Second castle's order and deadline. */
  second: { need: Partial<GoodMap>; dueMin: number };
}

const ROADS_BASE: [number, number][][] = [
  [[15, 40], [88, 40]],
  [[18, 39], [18, 40]],
  [[23, 39], [23, 40]],
  [[47, 37], [47, 40]],
  [[86, 40], [86, 41]],
];

/**
 * A "Jeden tartak, dwa listy": two woodcutters and ONE sawmill in the middle of the dry valley; the east castle
 * wants 24 planks early (5:00), the north castle 30 planks late (9:00). Shared producer, shared wagons.
 */
const PROTO_A: Proto = {
  def: {
    id: 'x2c-a', mapId: 'valley-m3', seed: M3_VALLEY.seed, coins: 60, wagons: 4, rain: [],
    buildings: [
      { type: 'woodcutter', x: 17, y: 37, facing: 0, stock: { wood: 4 } },
      { type: 'woodcutter', x: 22, y: 37, facing: 0, stock: { wood: 4 } },
      { type: 'sawmill', x: 38, y: 42, facing: 2, stock: { wood: 4 } },
      { type: 'stable', x: 46, y: 35, facing: 0 },
      { type: 'castle', x: 84, y: 42, facing: 2 },
      { type: 'castle', x: 62, y: 27, facing: 0 },
    ],
    roads: [...ROADS_BASE, [[39, 40], [39, 41]], [[64, 31], [64, 40]]],
    contract: { planks: 24 },
    deadlineMin: 12, star3Min: 7.0, star2Min: 9.0,
  },
  mainDueMin: 5.0,
  second: { need: { planks: 30 }, dueMin: 9.0 },
};

/**
 * B "Dwa łańcuchy, jeden stajnia": the east castle wants bread (farm -> mill -> bakery in the south-east), the north
 * castle planks (woodcutters -> sawmill in the west). No shared producer: the only contested resource is the four
 * wagons from one stable, so the lesson is the fleet split.
 */
const PROTO_B: Proto = {
  def: {
    id: 'x2c-b', mapId: 'valley-m3', seed: M3_VALLEY.seed, coins: 60, wagons: 3, rain: [],
    buildings: [
      { type: 'woodcutter', x: 17, y: 37, facing: 0, stock: { wood: 4 } },
      { type: 'woodcutter', x: 22, y: 37, facing: 0, stock: { wood: 4 } },
      { type: 'sawmill', x: 30, y: 42, facing: 2, stock: { wood: 4 } },
      { type: 'farm', x: 56, y: 48, facing: 2, stock: { grain: 4 } },
      { type: 'mill', x: 66, y: 42, facing: 2 },
      { type: 'bakery', x: 72, y: 42, facing: 2 },
      { type: 'stable', x: 46, y: 35, facing: 0 },
      { type: 'castle', x: 84, y: 42, facing: 2 },
      { type: 'castle', x: 62, y: 27, facing: 0 },
    ],
    roads: [...ROADS_BASE, [[31, 40], [31, 41]], [[57, 40], [57, 47]], [[67, 40], [67, 41]], [[73, 40], [73, 41]], [[64, 31], [64, 40]]],
    contract: { bread: 20 },
    deadlineMin: 12, star3Min: 7.0, star2Min: 9.0,
  },
  mainDueMin: 6.0,
  second: { need: { planks: 30 }, dueMin: 8.0 },
};

/**
 * C "Drewno na dwa listy": the east castle wants planks early, the north castle charcoal late; the sawmill and the
 * charcoal burner both live on the wood of the same two woodcutters (the free valley's CONTESTED input).
 */
const PROTO_C: Proto = {
  def: {
    id: 'x2c-c', mapId: 'valley-m3', seed: M3_VALLEY.seed, coins: 60, wagons: 4, rain: [],
    buildings: [
      { type: 'woodcutter', x: 17, y: 37, facing: 0, stock: { wood: 4 } },
      { type: 'woodcutter', x: 22, y: 37, facing: 0, stock: { wood: 4 } },
      { type: 'sawmill', x: 38, y: 42, facing: 2, stock: { wood: 2 } },
      { type: 'charcoalBurner', x: 52, y: 42, facing: 2, stock: { wood: 2 } },
      { type: 'stable', x: 46, y: 35, facing: 0 },
      { type: 'castle', x: 84, y: 42, facing: 2 },
      { type: 'castle', x: 62, y: 27, facing: 0 },
    ],
    roads: [...ROADS_BASE, [[39, 40], [39, 41]], [[53, 40], [53, 41]], [[64, 31], [64, 40]]],
    contract: { planks: 30 },
    deadlineMin: 12, star3Min: 7.0, star2Min: 9.0,
  },
  mainDueMin: 5.0,
  second: { need: { charcoal: 10 }, dueMin: 8.0 },
};

const PROTOS: Record<string, Proto> = { a: PROTO_A, b: PROTO_B, c: PROTO_C };
for (const p of Object.values(PROTOS)) MISSIONS[p.def.id] = p.def;

function make(p: Proto): World {
  const w = createWorld(p.def.id);
  const st = w.state;
  const main = st.mission.contract!;
  const castles = st.buildings.filter((b) => b.type === 'castle');
  // the main castle's order gets its own deadline as one tranche (the "late letter costs a seal" rule of V / XV)
  main.tranches = [{ need: { ...main.need }, deadlineTick: min(p.mainDueMin), doneTick: -1, missed: false }];
  const second: Contract = {
    need: goodsOf(p.second.need), castle: castles[1]!.id,
    deadlineTick: main.deadlineTick, star3Tick: main.star3Tick, star2Tick: main.star2Tick,
    tranches: [{ need: goodsOf(p.second.need), deadlineTick: min(p.second.dueMin), doneTick: -1, missed: false }],
  };
  st.mission.extraContracts = [second];
  return w;
}

interface Strategy { name: string; act: (w: World, tick: number) => void }

const castleIds = (w: World): [number, number] => {
  const c = w.state.buildings.filter((b) => b.type === 'castle');
  return [c[0]!.id, c[1]!.id];
};
const stableId = (w: World): number => w.state.buildings.find((b) => b.type === 'stable')!.id;

const STRATEGIES: Strategy[] = [
  { name: 'nothing (fill share)', act: () => {} },
  { name: 'main castle first @0:00', act: (w, t) => { if (t === 0) w.state.mission.firstCastle = castleIds(w)[0]; } },
  { name: 'second castle first @0:00', act: (w, t) => { if (t === 0) w.state.mission.firstCastle = castleIds(w)[1]; } },
  ...[1, 2, 3].map((m): Strategy => ({ name: `main first @${m}:00`, act: (w, t) => { if (t === min(m)) w.state.mission.firstCastle = castleIds(w)[0]; } })),
  {
    name: 'main first, then second after main done',
    act: (w, t) => {
      const [a, b] = castleIds(w);
      if (t === 0) w.state.mission.firstCastle = a;
      if (w.state.mission.contract!.tranches[0]!.doneTick >= 0 && w.state.mission.firstCastle === a) w.state.mission.firstCastle = b;
    },
  },
  { name: '+1 wagon @0:30 (no priority)', act: (w, t) => { if (t === min(0.5)) applyCommand(w, { t: 'buyWagon', stable: stableId(w) }); } },
  {
    name: '+1 wagon @0:30, main first',
    act: (w, t) => {
      if (t === 0) w.state.mission.firstCastle = castleIds(w)[0];
      if (t === min(0.5)) applyCommand(w, { t: 'buyWagon', stable: stableId(w) });
    },
  },
];

interface Result { result: string; end: string; doneA: string; doneB: string; missed: string; seals: number; hash: string }

const mmss = (tick: number): string => tick < 0 ? '—' : `${Math.floor(tick / TICK_HZ / 60)}:${String(Math.floor(tick / TICK_HZ) % 60).padStart(2, '0')}`;

function play(p: Proto, s: Strategy, saveAt = -1): Result {
  let w = make(p);
  while (w.state.mission.result === 'running' && w.state.tick < min(13)) {
    s.act(w, w.state.tick);
    step(w);
    if (w.state.tick === saveAt) w = deserialize(serialize(w));
  }
  const m = w.state.mission;
  const ta = m.contract!.tranches[0]!, tb = m.extraContracts![0]!.tranches[0]!;
  return {
    result: m.result, end: mmss(m.endTick), doneA: mmss(ta.doneTick), doneB: mmss(tb.doneTick),
    missed: `${ta.missed ? 'A' : ''}${tb.missed ? 'B' : ''}` || '-', seals: stars(w), hash: stateHash(w),
  };
}

function ascii(w: World): string {
  const t = w.terrain, st = w.state, c = net(w);
  const sym: Record<string, string> = { woodcutter: 'W', sawmill: 'S', stable: 'H', farm: 'F', mill: 'M', bakery: 'B', castle: 'C', warehouse: 'G' };
  let out = '';
  for (let y = 25; y < 52; y++) {
    let row = String(y).padStart(3) + ' ';
    for (let x = 10; x < 92; x++) {
      const i = y * t.w + x, b = c.occupied[i]!;
      if (b >= 0) row += sym[st.buildings.find((q) => q.id === b)!.type] ?? '?';
      else if (c.gateOf[i]! >= 0) row += '@';
      else if (st.roads[i]) row += '#';
      else if (t.field[i]) row += ',';
      else row += t.forest[i]! > 0.5 ? 'T' : '.';
    }
    out += row + '\n';
  }
  return out;
}

/** --sweep: prototype A with other deadlines / orders; when does "main first" still save the early letter? */
function sweepA(): void {
  console.log('\n== sweep A: mainDue | second need | strategy -> end, A done, late, seals (3★ 7:00, 2★ 9:00 minus a late letter)');
  for (const mainDueMin of [5.0, 5.5, 6.0]) for (const planks of [24, 30, 36]) {
    const p: Proto = { ...PROTO_A, mainDueMin, second: { need: { planks }, dueMin: 9.0 } };
    const cells: string[] = [];
    const strategies: Strategy[] = [
      STRATEGIES[0]!,
      ...[0, 0.5, 1, 1.5, 2, 2.5].map((m): Strategy => ({ name: `first@${m}`, act: (w, t) => { if (t === min(m)) w.state.mission.firstCastle = castleIds(w)[0]; } })),
      STRATEGIES.find((s) => s.name.startsWith('+1 wagon @0:30 (no'))!,
      STRATEGIES.find((s) => s.name.startsWith('+1 wagon @0:30, main'))!,
    ];
    for (const s of strategies) {
      const r = play(p, s);
      cells.push(`${s.name.split(' (')[0]}: ${r.end} A${r.doneA} ${r.missed} ${r.seals}★`);
    }
    console.log(`${mainDueMin} | ${planks} | ${cells.join(' · ')}`);
  }
}

const args = process.argv.slice(2);
TWO_CASTLES.chainPriority = args.includes('--chain');
if (args.includes('--sweep')) { sweepA(); process.exit(0); }
console.log(`chain priority: ${TWO_CASTLES.chainPriority ? 'on (first castle lifts its upstream workshops)' : 'off (only the castle leg)'}`);
for (const [key, p] of Object.entries(PROTOS)) {
  console.log(`\n== prototype ${key.toUpperCase()} (${p.def.id}): main ${JSON.stringify(p.def.contract)} by ${p.mainDueMin}, ` +
    `second ${JSON.stringify(p.second.need)} by ${p.second.dueMin}; 3★ ${p.def.star3Min} 2★ ${p.def.star2Min}, end ${p.def.deadlineMin}`);
  if (args.includes('--map')) console.log(ascii(make(p)));
  console.log('strategy | result end | A done | B done | late | seals | hash | det | save@3:00');
  for (const s of STRATEGIES) {
    const r1 = play(p, s), r2 = play(p, s), r3 = play(p, s, min(3));
    const det = r1.hash === r2.hash ? 'same' : 'DIFF';
    const sv = r1.hash === r3.hash ? 'same' : 'DIFF';
    console.log(`${s.name} | ${r1.result} ${r1.end} | ${r1.doneA} | ${r1.doneB} | ${r1.missed} | ${r1.seals} | ${r1.hash} | ${det} | ${sv}`);
  }
}
