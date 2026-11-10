// Readability audit (D-450): find free-valley moments where the HUD's stall card shows one of the recent cards
// (D-393 "zapełnia się", D-410/411 "bez dojazdu / Rozbierz", D-420/421 "kamieniołom jeszcze kopie") and write the
// world (state + terrain) to JSON, so tools/read-shots.mjs can stage it in the browser and screenshot the card and
// its sheet. Headless, read-only use of the sim and the UI's card helpers (the card-10 player of sandbox-first30).
//   npx tsx tools/read-states.ts <outDir> [--seeds 1305,1307] [--minutes 120]
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildingById, TICK_HZ, type World } from '../src/sim/index';
import { calmWhy, cureFor, heldSpanFor, paveStoneWait, rankStalls } from '../src/ui/stalls';
import { forecastFor, paceCard } from '../src/ui/paceCard';
import { bottleneckCard } from '../src/ui/bottleneck';
import { run } from './sandbox-first30';

const args = process.argv.slice(2);
const out = resolve(args[0] ?? 'read-states');
const arg = (n: string): string | null => { const i = args.indexOf(n); return i >= 0 ? args[i + 1]! : null; };
const seeds = (arg('--seeds') ?? '1301,1303,1305,1307').split(',').map(Number);
const minutes = Number(arg('--minutes') ?? 120);
mkdirSync(out, { recursive: true });

const want = ['filling', 'granaryFilling', 'cutOff', 'cutOffCrit', 'stoneDig', 'stoneComing', 'stoneIce'] as const;
type Want = (typeof want)[number];
const got = new Set<Want>();

for (const seed of seeds) {
  if (got.size === want.length) break;
  run('card-10', {
    plan: null, eye: 10, events: false, game: true,
    onSecond: (w: World, log) => {
      const ranked = rankStalls(w);
      const top = ranked[0];
      if (!top) return;
      const b = buildingById(w, top.id)!;
      // the card the HUD shows: a calm top entry gives way to the pace and bottleneck cards
      if (top.minor && (paceCard(w, forecastFor(w, log), log) || bottleneckCard(w))) return;
      let k: Want | null = null;
      const why = top.minor ? calmWhy(w, b) : null;
      if (why === 'filling' || why === 'granaryFilling') k = why;
      else if (!top.minor && cureFor(w, b.id) === 'demolish') k = top.crit ? 'cutOffCrit' : 'cutOff';
      else if (top.minor) {
        const sw = paveStoneWait(w, b);
        // D-455: ice on the span is its own scene (the card names the ice, the sheet keeps the stone hint)
        if (sw) k = heldSpanFor(w, b)?.kind === 'BRIDGE_CLOSED' ? 'stoneIce' : sw.digTicks > 0 ? 'stoneDig' : 'stoneComing';
      }
      if (!k || got.has(k)) return;
      got.add(k);
      const file = resolve(out, `${k}.json`);
      writeFileSync(file, JSON.stringify({ seed, t: w.state.tick / TICK_HZ, focus: b.id, terrain: w.terrain, state: w.state }));
      console.log(`${k}: seed ${seed} t=${(w.state.tick / TICK_HZ / 60).toFixed(1)} min, building ${b.id} (${b.type}) -> ${file}`);
    },
  }, seed, minutes);
}
for (const k of want) if (!got.has(k)) console.log(`${k}: not found`);
