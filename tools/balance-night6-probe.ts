// Probes behind docs/research/2026-11-04-mission-balance.md: m1 3-seal reachability, wagon sweeps.
//   npx tsx tools/balance-night6-probe.ts
import { TICK_HZ, applyCommand, createWorld, lineCells, stars, step, type Command, type World } from '../src/sim/index';
import { bridgeA, bridgeB } from './bot';
import { LESSON } from './balance-night6';

const stable = (w: World): number => w.state.buildings.find((b) => b.type === 'stable')!.id;
function play(id: string, plan: { at: number; cmds: (w: World) => Command[] }[]): string {
  const w = createWorld(id);
  const done = new Set<number>();
  let errs = 0;
  while (w.state.mission.result === 'running') {
    plan.forEach((p, i) => {
      if (!done.has(i) && w.state.tick >= p.at * TICK_HZ) {
        const cs = p.cmds(w);
        const r0 = applyCommand(w, cs[0]!);
        if (r0.ok) { for (const c of cs.slice(1)) if (!applyCommand(w, c).ok) errs++; done.add(i); }
        else if (r0.err.k !== 'NO_STONE') { errs++; done.add(i); }
      }
    });
    step(w);
  }
  const castle = w.state.buildings.find((b) => b.type === 'castle')!;
  const need = w.state.mission.contract!.need;
  const got = Object.entries(need).filter(([, n]) => n > 0).map(([g, n]) => `${g} ${castle.stock[g as keyof typeof need]}/${n}`).join(' ');
  return `${w.state.mission.result} ${(w.state.mission.endTick / 600).toFixed(2)} min seals ${stars(w)} coins ${w.state.coins} ${got}${errs ? ' errs ' + errs : ''}`;
}
const wag = (n: number) => (w: World): Command[] => Array.from({ length: n }, () => ({ t: 'buyWagon', stable: stable(w) }) as Command);
const x41 = (w: World): Command[] => LESSON.m1!(w);

console.log('--- m1: can anything reach 3 seals (7:00)?');
for (const [name, br] of [['x41', x41], ['bridgeA', (w: World) => [bridgeA(w)]], ['bridgeA+B', (w: World) => [bridgeA(w), bridgeB(w)]]] as const) {
  for (let k = 0; k <= 4; k++) console.log(`m1 ${name} + ${k}w @0: ${play('m1', [{ at: 0, cmds: (w) => [...br(w), ...wag(k)(w)] }])}`);
}
console.log('--- m4 wagon sweep (no stone bridge)');
for (let k = 0; k <= 5; k++) console.log(`m4 ${k}w @0: ${play('m4', k ? [{ at: 0, cmds: wag(k) }] : [])}`);
console.log('--- m5/m8/m2/m3/m9/m10 wagon sweeps');
for (const id of ['m2', 'm3', 'm5', 'm8', 'm9', 'm10', 'm11', 'm12']) {
  const line: string[] = [];
  for (let k = 0; k <= 8; k++) line.push(`${k}:${play(id, k ? [{ at: 0, cmds: wag(k) }] : []).split(' ').slice(0, 4).join(' ')}`);
  console.log(id + ' | ' + line.join(' | '));
}
console.log('--- m9: wagons at 2:30 / 3:30 (what the eye player does)');
for (const k of [1, 2, 4]) console.log(`m9 ${k}w @150s: ${play('m9', [{ at: 150, cmds: wag(k) }])}`);
console.log(`m9 2w@150 + 2w@360: ${play('m9', [{ at: 150, cmds: wag(2) }, { at: 360, cmds: wag(2) }])}`);
console.log('--- m10/m9: lesson + k wagons');
for (const id of ['m9', 'm10']) for (const k of [0, 1, 2, 3, 4, 6]) console.log(`${id} lesson@20 + ${k}w: ${play(id, [{ at: 20, cmds: (w) => [...LESSON[id]!(w), ...wag(k)(w)] }])}`);
console.log('--- m5: granary link timing');
for (const at of [0, 30, 90, 180, 200]) console.log(`m5 granary@${at}: ${play('m5', [{ at, cmds: LESSON.m5! }])}`);
void lineCells;
