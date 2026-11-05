// Research valley-ranks-2-3 (docs/research/2026-11-05-valley-ranks-2-3.md): reads tools/sandbox-first30.ts --json
// output and prints, per run: rank-up minutes, the minute each requirement of ranks 2 and 3 was first met (the last
// one is the binding constraint), silver at rank-ups, and what the pace slot showed per phase.
//   npx tsx tools/valley-ranks23.ts out.json [--ranks 2:renown=700]
import { readFileSync } from 'node:fs';
import { RANKS } from '../src/sim/index';
import type { Result } from './sandbox-first30';

const args = process.argv.slice(2);
const runs = JSON.parse(readFileSync(args[0]!, 'utf8')) as Result[];
const ri = args.indexOf('--ranks');
const req = RANKS.map((r) => ({ ...r }));
if (ri >= 0) for (const part of args[ri + 1]!.split(',')) {
  const [rk, kv] = part.split(':'); const [k, v] = kv!.split('=');
  (req[Number(rk)] as unknown as Record<string, number>)[k!] = Number(v);
}
const first = (r: Result, f: (x: Result['trace'][number]) => boolean): number => r.trace.find(f)?.m ?? -1;
for (const r of runs) {
  const out: string[] = [];
  for (const k of [2, 3]) {
    const q = req[k]!;
    const ren = first(r, (x) => x.renown >= q.renown), gd = first(r, (x) => x.goods >= q.goods), fl = first(r, (x) => x.best >= q.flow);
    const reached = r.rankMin[k] ?? -1;
    const prev = r.rankMin[k - 1] ?? -1;
    const ph = r.trace.filter((x) => prev >= 0 && x.m > prev && (reached < 0 || x.m <= reached));
    const cards: Record<string, number> = {};
    for (const x of ph) cards[x.card] = (cards[x.card] ?? 0) + 1;
    const at = ph.length ? ph[ph.length - 1]! : null;
    const bind = [['renown', ren], ['goods', gd], ['flow', fl]].map(([n, m]) => [n, (m as number) < 0 ? 999 : m] as [string, number]).sort((a, b) => b[1] - a[1])[0]![0];
    const rate = ph.length > 1 ? Math.round((ph[ph.length - 1]!.renown - ph[0]!.renown) / (ph.length - 1)) : 0;
    out.push(`R${k}@${reached} renown@${ren} goods@${gd} flow@${fl} bind=${bind} renown/min=${rate} coins@end-of-phase=${at?.coins} wagons=${at?.wagons} bld=${at?.bld} cards{${Object.entries(cards).map(([c, n]) => `${c}:${n}`).join(' ')}}`);
  }
  console.log(`${r.name.padEnd(14)} ${r.seed.padEnd(7)} R1@${r.rankMin[1]}\n  ${out.join('\n  ')}`);
}
