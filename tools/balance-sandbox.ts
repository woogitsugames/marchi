/**
 * D-52: Free Valley 180-minute season balance bench.
 *
 * Run: npx tsx tools/balance-sandbox.ts [--tuned] [--json]
 * Six fixed bot policies, three real terrain/weather seeds, 10 ticks/game-second.
 * The optional --tuned scenario temporarily mutates the in-memory definitions;
 * it never writes to src/sim and restores the original constants afterwards.
 *
 * No Date, Math.random, or wall-clock state affects the simulation. Runtime is
 * reported separately, not included in any balance result.
 */
import {
  applyCommand, checkInvariants, createWorld, lineCells, quoteCents, step,
  TICK_HZ, type Command, type World,
} from '../src/sim/index';
import { BUILDINGS, MARKET } from '../src/sim/defs';
import { seasonAt, type Season } from '../src/sim/seasons';
import { DECENT, type BotStep } from './bot-sandbox';

export const SEEDS = [1301, 1302, 1303] as const;
export const MINUTES = 180;
const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
const SEASON_MINUTES = 15;
const YEARS = MINUTES / (SEASON_MINUTES * SEASONS.length);

const at = (w: World, x: number, y: number): number => y * w.terrain.w + x;
const row = (w: World, y: number, x1: number, x2: number): number[] =>
  lineCells(w.terrain.w, at(w, x1, y), at(w, x2, y));
const col = (w: World, x: number, y1: number, y2: number): number[] =>
  lineCells(w.terrain.w, at(w, x, y1), at(w, x, y2));
const buy: BotStep = {
  name: 'wagon', cmds: (w) => [{ t: 'buyWagon', stable: w.state.buildings.find((b) => b.type === 'stable')!.id }],
};
const put = (name: string, type: 'woodcutter' | 'sawmill' | 'farm' | 'malthouse' | 'brewery', x: number, y: number, facing = 2): BotStep => ({
  name, cmds: () => [{ t: 'place', type, x, y, facing }],
});
const road = (name: string, y: number, x1: number, x2: number): BotStep => ({
  name, cmds: (w) => [{ t: 'road', surface: 1, cells: row(w, y, x1, x2) }],
});

// The base map already makes wood and planks, so "nothing" is a passive economy,
// not zero income. All plans use ordinary player commands; no free spawning.
const PLANS: readonly { name: string; plan: readonly BotStep[]; focus: string }[] = [
  { name: 'nothing', focus: 'No player commands, starter wood+planks only', plan: [] },
  {
    name: 'wood', focus: 'Wood and planks, no new production chains',
    plan: [buy, buy, buy, buy, buy,
      put('woodcutter 2', 'woodcutter', 16, 16, 3),
      put('sawmill 2', 'sawmill', 16, 22, 3),
      road('woodcutter lane', 23, 25, 25),
      put('woodcutter 3', 'woodcutter', 24, 20, 0),
      buy, buy],
  },
  {
    name: 'bread', focus: 'Farms, mills, bakeries (plus starter wood+planks)',
    plan: [...DECENT.slice(0, 12), ...DECENT.slice(15, 21)],
  },
  {
    name: 'stone', focus: 'Bread, fish, quarry/paving and a working wooden river bridge',
    plan: [
      ...DECENT.slice(0, 27),
      { name: 'wooden river bridge', rank: 2, cmds: (w: World) => [{ t: 'road', surface: 1, cells: col(w, 41, 24, 44) }] },
      { name: 'south-bank lane', rank: 2, cmds: (w: World) => [{ t: 'road', surface: 1, cells: [...row(w, 44, 41, 44), at(w, 44, 45)] }] },
      put('south-bank farm', 'farm', 43, 46),
      ...DECENT.slice(27, 37).filter((s) => s.name !== 'second fisher'),
    ],
  },
  {
    name: 'beer', focus: 'All chains, extra brewery/malthouse and grain farm',
    plan: [
      ...DECENT.slice(0, DECENT.findIndex((s) => s.name === 'brewery') + 1),
      put('second brewery', 'brewery', 42, 25),
      put('third malthouse', 'malthouse', 38, 25),
      road('extend east road for grain', 24, 72, 82),
      put('beer farm', 'farm', 75, 25),
      buy, buy,
      ...DECENT.slice(DECENT.findIndex((s) => s.name === 'brewery') + 1),
    ],
  },
  { name: 'mixed', focus: 'Existing DECENT plan (all supply chains)', plan: DECENT },
];

export interface BalanceRun {
  strategy: string;
  focus: string;
  seed: number;
  rank: number;
  ranksMin: number[];
  earned: number;
  coins: number;
  soldBeer: number;
  fairBeerUnits: number;
  fairExtraCents: number;
  incomeBySeason: Record<Season, number>;
  silverPerMinBySeason: Record<Season, number>;
  /** Per-year silver/min in each 15-minute season, oldest first. */
  perYear: Record<Season, number>[];
  /** Negative means winter earned more than preceding autumn. */
  autumnToWinterDropPct: (number | null)[];
  winterClosedEpisodes: number;
  /** Root-cause seconds, summed across distinct roots. Concurrent roots can exceed wall time. */
  stallSeconds: Record<string, number>;
  actionsDone: number;
  errors: string[];
  rankFell: boolean;
}

export interface BalanceSuite {
  scenario: 'baseline' | 'tuned';
  minutes: number;
  seeds: readonly number[];
  rows: BalanceRun[];
}

function runOne(strategy: typeof PLANS[number], seed: number): BalanceRun {
  const w = createWorld('sandbox', seed);
  if (!w.seasons) throw new Error('sandbox must enable seasons');
  const st = w.state;
  const byYear: Record<Season, number>[] = Array.from({ length: YEARS }, () => ({
    spring: 0, summer: 0, autumn: 0, winter: 0,
  }));
  const total: Record<Season, number> = { spring: 0, summer: 0, autumn: 0, winter: 0 };
  const errors: string[] = [];
  const done: string[] = [];
  const plan = strategy.plan;
  const end = MINUTES * 60 * TICK_HZ;
  let nextAction = 0, lastRank = st.town.rank, rankFell = false;
  let closedPrevious = new Set<number>(), winterClosedEpisodes = 0;
  let fairBeerUnits = 0, fairExtraCents = 0;

  while (st.tick < end) {
    if (st.tick % TICK_HZ === 0 && nextAction < plan.length) {
      const a = plan[nextAction]!;
      if ((a.rank ?? 0) <= st.town.rank && (a.after ?? 0) * TICK_HZ <= st.tick) {
        let ok = true, recoverable = false;
        for (const c of a.cmds(w) as Command[]) {
          const r = applyCommand(w, c);
          if (!r.ok) {
            ok = false;
            if (r.err.k === 'NO_COINS' || r.err.k === 'NO_STONE') recoverable = true;
            else errors.push(`action "${a.name}" at ${(st.tick / TICK_HZ / 60).toFixed(2)}m: ${JSON.stringify(r.err)}`);
            break;
          }
        }
        if (ok) { done.push(a.name); nextAction++; }
        else if (!recoverable) nextAction++; // never spin forever on an invalid coordinate
      }
    }

    const tick = st.tick;
    const year = Math.floor(tick / (60 * SEASON_MINUTES * SEASONS.length * TICK_HZ));
    const season = seasonAt(tick);
    const earnedBefore = st.ledger.silverEarned;
    const beerBefore = st.ledger.sold.beer;
    const satBefore = st.market.saturation.beer;
    step(w);
    const silver = st.ledger.silverEarned - earnedBefore;
    total[season] += silver;
    byYear[year]![season] += silver;

    const beer = st.ledger.sold.beer - beerBefore;
    if (season === 'autumn' && beer > 0) {
      // Reprice the EXACT sold batch against the same starting saturation.
      // Per-unit rounding matches sellAt()/quoteCents(); no fake "25% of revenue".
      const marketBefore = { market: { ...st.market, saturation: { ...st.market.saturation, beer: satBefore } } };
      fairExtraCents += quoteCents(marketBefore, 'beer', beer, 125) -
        quoteCents(marketBefore, 'beer', beer, 100);
      fairBeerUnits += beer;
    }

    const closedNow = new Set<number>();
    for (const wagon of st.wagons) {
      if (wagon.status.k !== 'BRIDGE_CLOSED') continue;
      closedNow.add(wagon.id);
      if (season === 'winter' && !closedPrevious.has(wagon.id)) winterClosedEpisodes++;
    }
    closedPrevious = closedNow;
    if (st.town.rank < lastRank) rankFell = true;
    lastRank = st.town.rank;

    // Check conservation and reservations once per game minute, not 108,000 times.
    if (st.tick % (60 * TICK_HZ) === 0) {
      for (const v of checkInvariants(w)) if (errors.length < 20) errors.push(`tick ${st.tick}: ${v}`);
    }
  }
  for (const v of checkInvariants(w)) if (errors.length < 20) errors.push(`end: ${v}`);
  const stalls: Record<string, number> = {};
  for (const [root, seconds] of Object.entries(st.ledger.stallSeconds)) {
    const reason = root.split(':').slice(2).join(':') || root;
    stalls[reason] = (stalls[reason] ?? 0) + seconds;
  }
  const perYear = byYear.map((r) => ({
    spring: r.spring / SEASON_MINUTES, summer: r.summer / SEASON_MINUTES,
    autumn: r.autumn / SEASON_MINUTES, winter: r.winter / SEASON_MINUTES,
  }));
  return {
    strategy: strategy.name, focus: strategy.focus, seed, rank: st.town.rank,
    ranksMin: st.town.rankTicks.slice(1).map((t) => t < 0 ? -1 : t / (TICK_HZ * 60)),
    earned: st.ledger.silverEarned, coins: st.coins, soldBeer: st.ledger.sold.beer,
    fairBeerUnits, fairExtraCents, incomeBySeason: total,
    silverPerMinBySeason: {
      spring: total.spring / (YEARS * SEASON_MINUTES),
      summer: total.summer / (YEARS * SEASON_MINUTES),
      autumn: total.autumn / (YEARS * SEASON_MINUTES),
      winter: total.winter / (YEARS * SEASON_MINUTES),
    },
    perYear,
    autumnToWinterDropPct: perYear.map((p) => p.autumn > 0 ? 100 * (p.autumn - p.winter) / p.autumn : null),
    winterClosedEpisodes,
    stallSeconds: Object.fromEntries(Object.entries(stalls).sort(([a], [b]) => a.localeCompare(b))),
    actionsDone: done.length,
    errors, rankFell,
  };
}

/** Counterfactual: numbers are changed only in memory, never in source or saved state. */
export function runBalanceSuite(tuned = false): BalanceSuite {
  const originalBeerPrice = MARKET.base.beer;
  const brewery = BUILDINGS.brewery.recipe!;
  const originalBreweryTicks = brewery.ticks;
  try {
    if (tuned) {
      MARKET.base.beer = 8;                     // defs.ts: 9 -> 8 silver
      brewery.ticks = 18 * TICK_HZ;            // defs.ts: 16 -> 18 seconds
    }
    const rows: BalanceRun[] = [];
    for (const strategy of PLANS) for (const seed of SEEDS) rows.push(runOne(strategy, seed));
    return {
      scenario: tuned ? 'tuned' : 'baseline', minutes: MINUTES, seeds: SEEDS,
      rows,
    };
  } finally {
    MARKET.base.beer = originalBeerPrice;
    brewery.ticks = originalBreweryTicks;
  }
}

function fmt(n: number, digits = 1): string { return n.toFixed(digits); }
function rankTime(n: number): string { return n < 0 ? '—' : fmt(n); }

export function balanceMarkdown(s: BalanceSuite): string {
  const out = [
    `# ${s.scenario}: ${s.minutes} min, 3 seeds`,
    '',
    '| Strategy | Seed | Rank | R1 | R2 | R3 | R4 | R5 | Earned | Spring sr/min | Summer | Autumn | Winter | Winter BRIDGE_CLOSED | Fair bonus sr | Errors |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const r of s.rows) {
    out.push(`| ${r.strategy} | ${r.seed} | ${r.rank} | ${r.ranksMin.map(rankTime).join(' | ')} | ${r.earned} | ${fmt(r.silverPerMinBySeason.spring)} | ${fmt(r.silverPerMinBySeason.summer)} | ${fmt(r.silverPerMinBySeason.autumn)} | ${fmt(r.silverPerMinBySeason.winter)} | ${r.winterClosedEpisodes} | ${fmt(r.fairExtraCents / 100, 2)} | ${r.errors.length} |`);
  }
  out.push('', '| Strategy | Seed | Autumn yr1→winter drop | Yr2 | Yr3 | Total root-cause stall-seconds by key |',
    '|---|---:|---:|---:|---:|---|');
  for (const r of s.rows) {
    const drops = r.autumnToWinterDropPct.map((n) => n === null ? 'n/a' : fmt(n) + '%');
    const stalls = Object.entries(r.stallSeconds).sort((a, b) => b[1] - a[1]);
    out.push(`| ${r.strategy} | ${r.seed} | ${drops.join(' | ')} | ${stalls.map(([k, n]) => `${k}: ${n}s`).join('; ') || '—'} |`);
  }
  return out.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const tuned = process.argv.includes('--tuned');
  const suite = runBalanceSuite(tuned);
  if (process.argv.includes('--json')) console.log(JSON.stringify(suite));
  else console.log(balanceMarkdown(suite));
  if (suite.rows.some((r) => r.errors.length > 0 || r.rankFell)) process.exitCode = 1;
}
