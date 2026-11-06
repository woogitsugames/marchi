// Research valley-fame-gap (docs/research/2026-11-07-valley-fame-gap.md): where the time goes for the card-30 /
// card-60 players after rank 3 — what the slot shows per minute, why the grow card is absent, what the fleet does.
//   npx tsx tools/valley-fame-gap.ts [--seeds 1301,1302] [--players card-30,card-60] [--from 40] [--minutes 120]
import { BUILDINGS, MARKET, TICK_HZ, outputGoods, type BuildingType, type World } from '../src/sim/index';
import { sandboxStatus } from '../src/sim/town';
import { rankStalls } from '../src/ui/stalls';
import { bottleneckCard } from '../src/ui/bottleneck';
import { fleetBusyShare, forecastFor, growCard, paceCard, rankCard } from '../src/ui/paceCard';
import { siteExists } from '../src/ui/site';
import { run } from './sandbox-first30';

const args = process.argv.slice(2);
const arg = (n: string): string | null => { const i = args.indexOf(n); return i >= 0 ? args[i + 1]! : null; };
const seeds = (arg('--seeds') ?? '1301,1302,1303,1304').split(',').map(Number);
const players = (arg('--players') ?? 'card-30,card-60').split(',');
const from = Number(arg('--from') ?? 40), minutes = Number(arg('--minutes') ?? 120);
const verbose = args.includes('--verbose');
const CHAIN_TYPES: BuildingType[] = ['farm', 'mill', 'bakery', 'fisher', 'woodcutter', 'sawmill', 'charcoalBurner', 'malthouse', 'brewery'];

for (const seed of seeds) for (const p of players) {
  const eye = Number(p.split('-')[1]);
  const slot: Record<string, number> = {};
  const why: Record<string, number> = {};
  let idleW = 0, busyS = 0, n = 0;
  const r = run(p, { plan: null, eye, events: false, game: true, onSecond: (w: World, log) => {
    const st = w.state;
    if (st.tick < from * 60 * TICK_HZ) return;
    n++;
    const ranked = rankStalls(w);
    const free = !ranked.length || ranked[0]!.minor;
    const pc = free ? paceCard(w, forecastFor(w, log)) : null;
    const neck = free && !pc ? bottleneckCard(w) : null;
    const key = !free ? 'stall' : pc ? 'pace:' + pc.k : neck ? 'neck:' + neck.kind + (neck.good ? ':' + neck.good : '') : ranked.length ? 'calm' : 'empty';
    slot[key] = (slot[key] ?? 0) + 1;
    idleW += st.wagons.filter((q) => q.status.k === 'IDLE' && !q.job).length;
    busyS += fleetBusyShare(w);
    if (free && !pc) {
      // why no grow card
      const sb = sandboxStatus(w);
      let reason: string;
      if (!sb.next) reason = 'max';
      else if (rankCard(w)) reason = 'rankCard(fleetShort)';
      else if (sb.goodsSold < sb.next.goods) reason = 'goods';
      else if (neck) reason = 'neck';
      else if (growCard(w)) reason = 'grow?';
      else {
        const castle = st.buildings.find((b) => b.type === 'castle')!;
        const parts: string[] = [];
        for (const t of CHAIN_TYPES) {
          if (!st.buildings.some((b) => b.type === t)) continue;
          const g = outputGoods(t)[0]!;
          const sat = st.market.saturation[g] >= MARKET.cap / 2;
          const site = siteExists(w, t, castle.id);
          if (sat || !site) parts.push(`${t}:${sat ? 'sat' : ''}${site ? '' : 'nosite'}`);
        }
        reason = (sb.renown >= sb.next.renown && sb.bestFlow >= sb.next.flow ? 'met ' : sb.bestFlow < sb.next.flow ? 'flow-short ' : '') + 'grow-null ' + parts.join(',');
        if (st.coins < 200) reason = 'coins';
      }
      why[reason] = (why[reason] ?? 0) + 1;
    }
    if (verbose && st.tick % (180 * TICK_HZ) === 0) {
      const cnt: Record<string, number> = {};
      for (const b of st.buildings) if (BUILDINGS[b.type].recipe) cnt[b.type + ':' + b.status.k] = (cnt[b.type + ':' + b.status.k] ?? 0) + 1;
      console.log(`  ${seed} ${p} m${st.tick / TICK_HZ / 60} ${key} coins ${st.coins} wagons ${st.wagons.length} idle ${st.wagons.filter((q) => q.status.k === 'IDLE' && !q.job).length} busy ${fleetBusyShare(w).toFixed(2)} ${JSON.stringify(cnt)}`);
    }
  } }, seed, minutes);
  const pct = (o: Record<string, number>): string => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / n).toFixed(0)}%`).join(' | ');
  console.log(`${p} ${seed}: rank ${r.rank} [${r.rankMin.slice(1).join('/')}] ${r.next} coins ${r.coins} wagons ${r.wagons} bld ${r.buildings}`);
  console.log(`  slot from ${from} min: ${pct(slot)}`);
  console.log(`  no pace card because: ${pct(why)}`);
  console.log(`  mean idle wagons ${(idleW / n).toFixed(1)}, fleet busy share ${(busyS / n).toFixed(2)}`);
}
