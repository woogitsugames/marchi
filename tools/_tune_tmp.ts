import { DECENT, runSandbox, report } from './bot-sandbox';
import { TICK_HZ } from '../src/sim/index';
const marks: string[] = [];
const causes: Record<string, number> = {};
const r = runSandbox(DECENT, Number(process.argv[2] ?? 150), { checkEvery: 50, onTick: (w) => {
  if (w.state.tick % (5 * 60 * TICK_HZ) === 0) marks.push(`${w.state.tick / 600}m R${w.state.town.renown} F${w.state.town.bestFlow} rank${w.state.town.rank} c${w.state.coins} wag${w.state.wagons.length}`);
  if (w.state.tick % TICK_HZ === 0) for (const b of w.state.buildings) { const s = b.status as any; const k = `${b.type}:${s.k}${s.cause ? '.' + s.cause : ''}`; causes[k] = (causes[k] ?? 0) + 1; }
} });
console.log(report(r)); console.log(marks.join('\n'));
console.log(Object.entries(causes).filter(([k]) => !k.endsWith('WORKING')).sort().map(([k, v]) => `${k}=${v}`).join('  '));
if (r.violations.length) console.log('VIOL', r.violations.slice(0, 5));
