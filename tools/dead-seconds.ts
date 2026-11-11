// Free valley dead-card seconds (D-430): plays one scripted card player of tools/sandbox-first30.ts and, every game
// second, reads the HUD's red card (rankStalls()[0], not minor) and whether its sheet offers anything to press: no cure
// (`nocure`), a gap road with no link (`road-none`), or a grey stone button with no quarry offer and no calm stone wait
// (`pave-grey`). Prints seconds and intervals per building and kind; `dumpSec` prints the chain at that second.
// Read before the look's command (D-637): the state the running game shows — a command is stepped before the next
// frame, so the earlier read after the command (a one-second flash on every look tick) was the tool's order.
//   npx tsx tools/dead-seconds.ts card-30 1314 [minutes=120] [dumpSec]
import { run } from './sandbox-first30';
import { TICK_HZ, buildingById, explainBuilding, suggestLinkToStable } from '../src/sim/index';
import { paveStoneWait, paveSpanFor, paveCheck, rankStalls, cureFor, quarryForPave, gapTarget, calmWhy, freshGranary, granaryAnchor, chainRoot } from '../src/ui/stalls';
const [player, seedS, minS, dumpAt] = process.argv.slice(2);
const eye = Number(player!.split('-')[1]);
const runs: Record<string, number[]> = {};
run(player!, { plan: null, eye, events: false, game: true, secondBeforeLook: true, onSecond: (w) => {
  const s = w.state.tick / TICK_HZ;
  const r = rankStalls(w)[0];
  if (!r || r.minor) return;
  const b = buildingById(w, r.id)!;
  const chain = explainBuilding(w, b.id, 5, true);
  const tgt = gapTarget(w, chain.length ? chain : [{ kind: 'building', id: b.id, status: b.status }]);
  let k = '';
  if (tgt >= 0) { if (!suggestLinkToStable(w, tgt) && cureFor(w, b.id) !== 'demolish') k = 'road-none'; }
  else {
    const c = cureFor(w, b.id);
    if (c === null) k = 'nocure';
    else if (c === 'pave') { const h = paveSpanFor(w, b); const ok = h ? paveCheck(w, h) : null; if (ok && !ok.ok && quarryForPave(w, b) < 0 && !paveStoneWait(w, b)) k = 'pave-grey:' + ok.err.k; }
  }
  if (!k) return;
  const s2 = b.status as any;
  const key = `${b.type}#${b.id}:${s2.k}${s2.cause ? '.' + s2.cause : ''}${r.crit ? '(crit)' : ''} ${k}`;
  (runs[key] ??= []).push(s);
  if (dumpAt && Math.abs(s - Number(dumpAt)) < 1) {
    console.log('DUMP', key, JSON.stringify(b.status), 'chain', JSON.stringify(chain.map((l: any) => l.kind === 'building' ? buildingById(w, l.id)!.type + '#' + l.id + ':' + JSON.stringify(l.status) : 'wagon#' + l.id + ':' + JSON.stringify(l.status))));
    console.log('  fresh', freshGranary(w, b), 'anchor', granaryAnchor(w, b, chainRoot(chain, b.id)), 'calmWhy', calmWhy(w, b), 'stock', JSON.stringify(b.stock));
  }
} }, Number(seedS), Number(minS ?? 120));
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
for (const [k, ts] of Object.entries(runs)) {
  const iv: string[] = []; let a = ts[0]!, p = ts[0]!;
  for (const t of ts.slice(1).concat([1e9])) { if (t > p + 2) { iv.push(`${fmt(a)}-${fmt(p)}`); a = t; } p = t; }
  console.log(`${ts.length}s ${k}  ${iv.slice(0, 8).join(' ')}${iv.length > 8 ? ' …' : ''}`);
}
