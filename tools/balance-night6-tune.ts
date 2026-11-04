// Retuning candidates for docs/research/2026-11-04-mission-balance.md: patches MissionDef fields IN THIS
// PROCESS ONLY (no src/ change) and reruns the night-6 survey. Seal thresholds do not change any run (the
// mission ends when the order is complete), so they are evaluated from the times afterwards.
//   npx tsx tools/balance-night6-tune.ts [--json out.json]
import { MISSIONS } from '../src/sim/index';
import type { MissionDef } from '../src/sim/missions';
import { UI_CANDIDATE, survey, type Row } from './balance-night6';
import { writeFileSync } from 'node:fs';

type Variant = { id: string; name: string; patch: Partial<MissionDef>; ui?: Partial<typeof UI_CANDIDATE> };
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('--') && !a.endsWith('.json'));
export const VARIANTS_ALL: Variant[] = [
  { id: 'm1', name: 'coins 240', patch: { coins: 240 } },
  { id: 'm1', name: 'wagons 3', patch: { wagons: 3 } },
  { id: 'm1', name: 'wagons 3, coins 210', patch: { wagons: 3, coins: 210 } },
  { id: 'm4', name: 'coins 140', patch: { coins: 140 } },
  { id: 'm4', name: 'coins 150', patch: { coins: 150 } },
  { id: 'm8', name: 'coins 230', patch: { coins: 230 } },
  { id: 'm8', name: 'coins 180', patch: { coins: 180 } },
  { id: 'm8', name: 'coins 150', patch: { coins: 150 } },
  { id: 'm8', name: 'coins 120', patch: { coins: 120 } },
  { id: 'm2', name: 'coins 120', patch: { coins: 120 } },
  { id: 'm2', name: 'UI: held-bridge card', patch: {}, ui: { jamCard: true } },
  { id: 'm4', name: 'UI: held-bridge card', patch: {}, ui: { jamCard: true } },
  { id: 'm4', name: 'coins 140 + UI: held-bridge card', patch: { coins: 140 }, ui: { jamCard: true } },
  { id: 'm9', name: 'UI: CONTESTED first', patch: {}, ui: { contestedFirst: true } },
  { id: 'm10', name: 'UI: CONTESTED first', patch: {}, ui: { contestedFirst: true } },
  { id: 'm9', name: 'UI: shared-supply card', patch: {}, ui: { sharedCard: true } },
  { id: 'm10', name: 'UI: shared-supply card', patch: {}, ui: { sharedCard: true } },
];

const VARIANTS = ONLY.length ? VARIANTS_ALL.filter((v) => ONLY.some((o) => (v.id + ' ' + v.name).includes(o))) : VARIANTS_ALL;
const out: (Row & { variant: string })[] = [];
const ji = process.argv.indexOf('--json');
for (const v of VARIANTS) {
  const def = MISSIONS[v.id]!;
  const saved = { ...def };
  Object.assign(def, v.patch);
  Object.assign(UI_CANDIDATE, { jamCard: false, contestedFirst: false, sharedCard: false }, v.ui ?? {});
  try {
    console.log(`\n== ${v.id} ${v.name}`);
    for (const r of survey(v.id)) {
      out.push({ ...r, variant: v.name });
      console.log(`${r.strat.padEnd(34)} ${r.result.padEnd(4)} ${r.minutes.toFixed(2).padStart(6)} min seals ${r.seals} coins ${r.coins} wagons ${r.wagons} ${JSON.stringify(r.actions)}`);
    }
  } finally { Object.assign(def, saved); for (const k of Object.keys(v.patch)) if (!(k in saved)) delete (def as unknown as Record<string, unknown>)[k]; }
}
if (ji >= 0) writeFileSync(process.argv[ji + 1]!, JSON.stringify(out, null, 1));
