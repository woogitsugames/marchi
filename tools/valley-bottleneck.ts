// "Wąskie gardło" card for the free valley (spec docs/specs/2026-11-04-valley-trade-post.md §3): measures the
// proposed UI rule headless, read-only, on the valley-3h bots. No src/ change: the rule is implemented here
// exactly as the spec describes `sampleBottleneck` / `bottleneckCard` (src/ui/bottleneck.ts, to be written).
//   npx tsx tools/valley-bottleneck.ts [player ...] [--seeds 1301,1302,1303] [--min 180] [--late]
//   (--late: with the prototype patch applied, also the trade-post players of tools/valley-late.ts)
// Players: decent, decent+farm, decent+2farms (east road + 1 / 2 farms once the DECENT plan is done),
//          passive, small (6 wagons).
// Per 30-min band: share of 10 s samples where the HUD would show the card (the worst-stall slot is empty or
// calm), the named good, the cure (producer / wagon), and how often a real stall card wins the slot instead.
import {
  applyCommand, canPlace, GOODS, inputGoods, lineCells, outputGoods, producerOf, TICK_HZ,
  type Building, type Command, type Good, type World,
} from '../src/sim/index';
import { rankStalls } from '../src/ui/stalls';
import { DECENT } from './bot-sandbox';
import { PLAYERS, runValley, type Player } from './valley-3h';

// --- the rule (as specified) -------------------------------------------------------------------------
const WINDOW = 180; // samples, one per sim second = 3 min
const SHOW_AVG_X100 = Number(process.env.BN_SHOW ?? 150); // mean waiting consumers >= 1.50 over the full window
const HIDE_AVG_X100 = Number(process.env.BN_HIDE ?? 110); // a shown card stays until the mean drops below 1.10 (hysteresis)
const MIN_CONSUMERS = 2;
/** The fleet rule (all wagons busy for the whole window) only from this rank (the starter pair is always busy). */
const FLEET_RANK = Number(process.env.BN_FLEET_RANK ?? 2);

interface Log {
  n: number; // samples taken (capped use: ring index = n % WINDOW)
  wait: Record<Good, number[]>; // waiting consumers per sample
  noWagon: Record<Good, number[]>; // of those, NO_WAGON
  sumW: Record<Good, number>; sumN: Record<Good, number>;
  starved: Record<Good, number[]>; // producers of the good that themselves wait for their input
  sumS: Record<Good, number>;
  idleZero: number[]; // 1 when no wagon stood idle in that second
  sumIdleZero: number;
  shown: Good | null;
}

function waitsForInput(b: Building): Good | null {
  const s = b.status;
  if (s.k !== 'WAITING_DELIVERY' && s.k !== 'NO_WAGON' && s.k !== 'WAITING_UPSTREAM' && !(s.k === 'NO_INPUT' && s.cause !== 'UNREACHABLE')) return null;
  return inputGoods(b.type).includes(s.good) ? s.good : null;
}

function newLog(): Log {
  const z = (): Record<Good, number[]> => Object.fromEntries(GOODS.map((g) => [g, new Array(WINDOW).fill(0)])) as Record<Good, number[]>;
  const s = (): Record<Good, number> => Object.fromEntries(GOODS.map((g) => [g, 0])) as Record<Good, number>;
  return { n: 0, wait: z(), noWagon: z(), sumW: s(), sumN: s(), starved: z(), sumS: s(), idleZero: new Array(WINDOW).fill(0), sumIdleZero: 0, shown: null };
}

function sample(w: World, log: Log): void {
  const i = log.n % WINDOW;
  const cw = Object.fromEntries(GOODS.map((g) => [g, 0])) as Record<Good, number>;
  const cn = { ...cw }, cs = { ...cw };
  for (const b of w.state.buildings) {
    const g = waitsForInput(b);
    if (!g) continue;
    cw[g]++;
    if (b.status.k === 'NO_WAGON') cn[g]++;
    for (const o of outputGoods(b.type)) cs[o]++;
  }
  for (const g of GOODS) {
    log.sumW[g] += cw[g] - log.wait[g][i]!; log.wait[g][i] = cw[g];
    log.sumN[g] += cn[g] - log.noWagon[g][i]!; log.noWagon[g][i] = cn[g];
    log.sumS[g] += cs[g] - log.starved[g][i]!; log.starved[g][i] = cs[g];
  }
  const iz = w.state.wagons.some((x) => x.status.k === 'IDLE') ? 0 : 1;
  log.sumIdleZero += iz - log.idleZero[i]!; log.idleZero[i] = iz;
  log.n++;
}

interface Card { good: Good; avgX100: number; consumers: number; cure: 'producer' | 'wagon' }

function consumersOf(w: World, g: Good): number {
  let n = 0;
  for (const b of w.state.buildings) if (inputGoods(b.type).includes(g)) n++;
  return n;
}

function card(w: World, log: Log): Card | null {
  if (log.n < WINDOW) { log.shown = null; return null; }
  let best: Card | null = null;
  for (const g of GOODS) {
    const avgX100 = Math.floor((log.sumW[g] * 100) / WINDOW);
    const keep = log.shown === g;
    if (avgX100 < (keep ? HIDE_AVG_X100 : SHOW_AVG_X100)) continue;
    const consumers = consumersOf(w, g);
    if (consumers < MIN_CONSUMERS) continue;
    const p = producerOf(g);
    if (!p || !canPlace(w, p).ok) continue;
    // upstream: when half of the good's producers themselves wait for their input, the root is further up
    const producers = w.state.buildings.filter((b) => outputGoods(b.type).includes(g)).length;
    if (producers > 0 && log.sumS[g] * 2 >= producers * WINDOW) continue;
    const cure = log.sumN[g] * 2 >= log.sumW[g] ? 'wagon' : 'producer';
    if (!best || avgX100 > best.avgX100) best = { good: g, avgX100, consumers, cure };
  }
  log.shown = best?.good ?? null;
  return best;
}

// --- players -----------------------------------------------------------------------------------------
function farms(n: number): (w: World, sec: number, done: boolean) => Command[] {
  const mem = new WeakMap<World, number>();
  return (w, _sec, done) => {
    if (!done) return [];
    const k = mem.get(w) ?? 0, W = w.terrain.w;
    const steps = ([
      { t: 'road', surface: 1, cells: lineCells(W, 24 * W + 72, 24 * W + 82) },
      { t: 'place', type: 'farm', x: 75, y: 25, facing: 2 },
      { t: 'place', type: 'farm', x: 79, y: 25, facing: 2 },
    ] as Command[]).slice(0, n + 1);
    if (k >= steps.length) return [];
    const r = applyCommand(w, steps[k]!);
    if (r.ok) mem.set(w, k + 1);
    else if (r.err.k !== 'NO_COINS') mem.set(w, k + 1);
    return [];
  };
}
const BASE: Record<string, Player> = {
  decent: { plan: DECENT },
  'decent+farm': { plan: DECENT, extra: farms(1) },
  'decent+2farms': { plan: DECENT, extra: farms(2) },
  passive: PLAYERS.passive!,
  small: PLAYERS.small!,
};

interface BandStat { samples: number; shown: number; realWins: number; goods: Record<string, number>; cures: Record<string, number>; fleet: number; avgTop: number }
const inc = (m: Record<string, number>, k: string): void => { m[k] = (m[k] ?? 0) + 1; };

function probe(): { p: (w: World) => void; bands: BandStat[] } {
  const log = newLog();
  const bands: BandStat[] = [];
  const p = (w: World): void => {
    const t = w.state.tick;
    if (t % TICK_HZ === 0) sample(w, log);
    if (t % (10 * TICK_HZ) !== 0) return;
    const bi = Math.floor((t - 1) / (30 * 60 * TICK_HZ));
    const b = (bands[bi] ??= { samples: 0, shown: 0, realWins: 0, goods: {}, cures: {}, fleet: 0, avgTop: 0 });
    b.samples++;
    const c = card(w, log);
    const top = rankStalls(w)[0];
    const calm = !top || top.minor;
    const fleet = log.n >= WINDOW && log.sumIdleZero === WINDOW && w.state.town.rank >= FLEET_RANK;
    if (!c) { if (fleet && calm) b.fleet++; return; }
    if (!calm) { b.realWins++; return; }
    b.shown++;
    b.avgTop += c.avgX100 / 100;
    inc(b.goods, c.good);
    inc(b.cures, c.cure);
  };
  return { p, bands };
}

const pct = (a: number, b: number): string => (b ? Math.round((100 * a) / b) + '%' : '—');

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (k: string): string | undefined => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const minutes = Number(opt('--min') ?? 180);
  const seeds = (opt('--seeds') ?? '1301,1302,1303').split(',').map(Number);
  const names = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1]!.startsWith('--')));
  const list = names.length ? names : ['decent', 'decent+farm', 'decent+2farms'];
  // --late: also load the prototype players of tools/valley-late.ts (needs docs/research/2026-11-04-valley-late-proto.patch)
  if (args.includes('--late')) await import('./valley-late');
  console.log(`window ${WINDOW} s, show >= ${SHOW_AVG_X100 / 100}, hide < ${HIDE_AVG_X100 / 100}, consumers >= ${MIN_CONSUMERS}; seeds ${seeds.join(',')}, ${minutes} min`);
  console.log('| player | band | card shown | real card wins | named good | cure | mean waiting (shown) | fleet card (calm slot, 0 idle 3 min) | silver | R5 |');
  console.log('|---|---|---:|---:|---|---|---:|---:|---:|---:|');
  for (const n of list) {
    const runs: { bands: BandStat[]; earned: number; r5: number }[] = [];
    for (const s of seeds) {
      const pr = probe();
      const key = `__bn_${n}`;
      PLAYERS[key] = { ...(BASE[n] ?? PLAYERS[n]!), afterStep: pr.p };
      const r = runValley(key, s, minutes);
      delete PLAYERS[key];
      runs.push({ bands: pr.bands, earned: r.earned, r5: r.rankMin[5] ?? -1 });
    }
    const nb = Math.max(...runs.map((r) => r.bands.length));
    for (let i = 0; i < nb; i++) {
      const bs = runs.map((r) => r.bands[i]).filter((x): x is BandStat => !!x);
      const S = bs.reduce((a, b) => a + b.samples, 0), sh = bs.reduce((a, b) => a + b.shown, 0);
      const goods: Record<string, number> = {}, cures: Record<string, number> = {};
      for (const b of bs) { for (const [k, v] of Object.entries(b.goods)) goods[k] = (goods[k] ?? 0) + v; for (const [k, v] of Object.entries(b.cures)) cures[k] = (cures[k] ?? 0) + v; }
      const top = (m: Record<string, number>): string => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} ${pct(v, S)}`).join(', ') || '—';
      const avgTop = sh ? (bs.reduce((a, b) => a + b.avgTop, 0) / sh).toFixed(2) : '—';
      const silver = i === 0 ? Math.round(runs.reduce((a, r) => a + r.earned, 0) / runs.length) : '';
      const r5 = i === 0 ? (runs.every((r) => r.r5 >= 0) ? (runs.reduce((a, r) => a + r.r5, 0) / runs.length).toFixed(1) : '—') : '';
      console.log(`| ${n} | ${i * 30}–${i * 30 + 30} | ${pct(sh, S)} | ${pct(bs.reduce((a, b) => a + b.realWins, 0), S)} | ${top(goods)} | ${top(cures)} | ${avgTop} | ${pct(bs.reduce((a, b) => a + b.fleet, 0), S)} | ${silver} | ${r5} |`);
    }
  }
}

export { card, newLog, sample, type Card, type Log };
