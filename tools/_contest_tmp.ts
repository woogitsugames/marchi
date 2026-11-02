import { createWorld, step, applyCommand, checkInvariants, TICK_HZ } from '../src/sim/index';
import { place } from '../src/sim/commands';
const w = createWorld('sandbox');
const r = place(w, 'charcoalBurner', 18, 25, 2, true); console.log(JSON.stringify(r));
const st = w.state; const stable = st.buildings.find((b) => b.type === 'stable')!.id;
for (let i = 0; i < Number(process.argv[2] ?? 2); i++) { st.coins += 30; applyCommand(w, { t: 'buyWagon', stable }); }
const seen: Record<string, number> = {};
for (let t = 0; t < 15 * 60 * TICK_HZ; t++) {
  step(w);
  if (t % 10 === 0) for (const b of st.buildings) if (b.type === 'charcoalBurner' || b.type === 'sawmill') { const s = b.status as any; const k = b.type + ':' + s.k + (s.cause ? '.' + s.cause : ''); seen[k] = (seen[k] ?? 0) + 1; }
  const v = checkInvariants(w); if (v.length) { console.log(v); break; }
}
console.log('planks', st.ledger.produced.planks, 'charcoal', st.ledger.produced.charcoal, 'wood', st.ledger.produced.wood);
console.log(seen);
